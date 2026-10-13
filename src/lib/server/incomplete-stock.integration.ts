import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { commandSchema, executeCommand } from "./commands";
import { getState } from "./state";
import { getDashboard } from "./dashboard";
import { browse } from "./browse";
import { getAccountingReport } from "./accounting-report";

// An explicit test URL is required; fixtures live in their own schema and are removed in finally.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database");
const schema = `frigocold_test_${randomUUID().replaceAll("-", "")}`;
const admin = new Client({ connectionString });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, options: `-c search_path=${schema},public` }, { schema }) });
const shared = globalThis as unknown as { frigocoldDb?: PrismaClient };
const previous = shared.frigocoldDb;

async function main() {
  let connected = false;
  try {
    await admin.connect(); connected = true;
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}", public`);
    const migrations = (await readdir("prisma/migrations")).filter(name => /^\d/.test(name)).sort();
    for (const name of migrations.filter(name => name !== "20261012000000_incomplete_shipments")) {
      await admin.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    }
    shared.frigocoldDb = db;
    const user = await db.user.create({ data: { username: "integration", passwordHash: "unused" } });
    const product = await db.product.create({ data: { name: "Integration chicken" } });
    const supplier = await db.supplier.create({ data: { name: "Integration supplier", country: "AL" } });
    const client = await db.client.create({ data: { name: "Integration client", city: "Tirana" } });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
    const receive = (data: object, requestId = randomUUID()) => executeCommand(commandSchema.parse({ type: "addShipment", data }), user.id, requestId);
    const sell = (shipmentId: string, kg: number, qty: number | null, pricePerKg = 5, requestId = randomUUID()) => executeCommand(commandSchema.parse({ type: "finalizeSale", data: { clientId: client.id, date: today, lines: [{ productId: product.id, shipmentId, method: "TOTAL", qty, kg, pricePerKg }] } }), user.id, requestId);
    // Upgrade a database containing a complete receipt; the migration must preserve its ledger.
    const known = await receive({ productId: product.id, supplierId: supplier.id, orderNr: "A", loadType: "CARTON", countDoc: 10, countActual: 10, netKgDoc: 100, netKgActual: 100, costPerKg: 2, lots: [{ lotNumber: "L", qty: 10 }], dateMode: "FIXED", prodFrom: "", expFrom: "2027-01-01", entryDate: today });
    const original = await db.movement.findFirstOrThrow({ where: { shipmentId: String(known.id) } });
    await admin.query(await readFile("prisma/migrations/20261012000000_incomplete_shipments/migration.sql", "utf8"));
    // Later migrations are idempotent; re-apply them so their constraints sit on top of the upgrade under test.
    for (const name of migrations.filter(name => name > "20261012000000_incomplete_shipments")) await admin.query(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    assert.deepEqual(await db.movement.findUnique({ where: { id: original.id } }), original);
    const unknown = await receive({ productId: product.id, netKgActual: 100, expFrom: "2027-01-01", entryDate: today });
    const shipmentId = String(unknown.id), knownId = String(known.id);
    const requestId = randomUUID();
    const first = await sell(shipmentId, 20, null, 5, requestId);
    assert.deepEqual(await sell(shipmentId, 20, null, 5, requestId), first);
    await assert.rejects(sell(shipmentId, 21, null, 5, requestId), /different data/);
    await sell(shipmentId, 5, 2, 6);
    await sell(knownId, 10, 1);
    await assert.rejects(sell(knownId, 1, null), /count|units/i);
    await assert.rejects(sell(knownId, 1, 10), /Insufficient stock/);
    await assert.rejects(sell(shipmentId, 99, null), /Insufficient stock/);
    const state = await getState();
    const partial = state.shipments.find(s => s.id === shipmentId)!;
    assert.equal(partial.countActual, null);
    assert.equal(partial.costPerKg, null);
    assert.equal(partial.supplierId, null);
    assert.equal(partial.soldKg, 25);
    assert.equal(state.sales.length, 3);
    const params = { q: "", page: 1, pageSize: 25, sort: "", direction: "asc" as const, filter: "" };
    const inventory = await browse({ ...params, kind: "inventory" });
    assert.equal(inventory.total, 2);
    assert.equal(inventory.items.find(s => s.id === shipmentId)?.remaining_count, null);
    assert.equal((await browse({ ...params, kind: "movements" })).total, 5);
    assert.ok((await browse({ ...params, kind: "search", q: "Integration chicken" })).items.some(s => s.id === shipmentId));
    const dashboard = await getDashboard();
    assert.equal(dashboard.totalKg, 165);
    assert.equal(dashboard.totalVal, null);
    assert.equal(dashboard.knownStockValue, 180);
    assert.equal(dashboard.missingStockCostKg, 75);
    assert.equal(dashboard.profitMonth, null);
    assert.equal(dashboard.fl.at(-1)?.revenue, 180);
    assert.equal((await getAccountingReport("all", product.id, 1)).cur.profit, null);
    await executeCommand(commandSchema.parse({ type: "updateShipmentDetails", id: shipmentId, data: { costPerKg: 3 } }), user.id);
    const completeCosts = await getDashboard();
    assert.equal(completeCosts.totalVal, 405);
    assert.equal(completeCosts.profitMonth, 85);
    assert.equal(completeCosts.missingStockCostKg, 0);
    await assert.rejects(db.movement.update({ where: { id: original.id }, data: { qty: 999 } }), /append-only/);
    // Two simultaneous sales cannot both consume the same 75 kg balance.
    const races = await Promise.allSettled([sell(shipmentId, 50, null), sell(shipmentId, 50, null)]);
    assert.equal(races.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(races.filter(result => result.status === "rejected").length, 1);
    // A load saved twice by mistake can be cancelled while unsold; its ledger rows are kept and its stock leaves every view.
    const dupId = String((await receive({ productId: product.id, netKgActual: 40, expFrom: "2027-01-01", entryDate: today })).id);
    const kgBefore = (await getDashboard()).totalKg;
    await executeCommand(commandSchema.parse({ type: "cancelShipment", id: dupId }), user.id);
    assert.equal((await getDashboard()).totalKg, kgBefore - 40);
    assert.ok(!(await getState()).shipments.some(s => s.id === dupId));
    assert.equal(await db.movement.count({ where: { shipmentId: dupId } }), 2);
    await assert.rejects(executeCommand(commandSchema.parse({ type: "cancelShipment", id: dupId }), user.id), /already cancelled/);
    await assert.rejects(sell(dupId, 1, null), /cancelled|Insufficient/);
    await assert.rejects(executeCommand(commandSchema.parse({ type: "cancelShipment", id: shipmentId }), user.id), /with sales/);
    // Entry date can be corrected back in time, but not into the future or after a sale from the load.
    const earlier = new Date(today); earlier.setDate(earlier.getDate() - 3);
    const earlierIso = earlier.toISOString().slice(0, 10);
    await executeCommand(commandSchema.parse({ type: "updateShipmentDetails", id: shipmentId, data: { entryDate: earlierIso } }), user.id);
    assert.equal((await getState()).shipments.find(s => s.id === shipmentId)?.entryDate, earlierIso);
    await assert.rejects(executeCommand(commandSchema.parse({ type: "updateShipmentDetails", id: shipmentId, data: { entryDate: "2999-01-01" } }), user.id), /future/);
    // Client return: goods come back as a linked load copying the sold load's data; the client is credited.
    const knownLine = await db.saleLine.findFirstOrThrow({ where: { shipmentId: knownId } });
    const ret = (data: object) => executeCommand(commandSchema.parse({ type: "addReturn", data: { saleLineId: knownLine.id, entryDate: today, reason: "Produkt i dëmtuar", pricePerKg: 5, ...data } }), user.id, randomUUID());
    const revenueBefore = (await getAccountingReport("all", product.id, 1)).cur.revenue;
    const back = String((await ret({ kg: 4, qty: 1 })).id);
    const st = await getState();
    const returned = st.shipments.find(s => s.id === back)!;
    assert.equal(returned.returnOf?.shipmentId, knownId);
    assert.equal(returned.costPerKg, 2);
    assert.equal(returned.expFrom, "2027-01-01");
    assert.deepEqual(returned.lots, [{ lotNumber: "L", qty: 1 }]);
    assert.ok(st.sales.some(s => s.isReturn && s.totalKg === -4 && s.totalValue === -20));
    const afterReturn = (await getAccountingReport("all", product.id, 1)).cur;
    assert.equal(afterReturn.revenue, revenueBefore - 20);
    assert.equal(afterReturn.returnsKg, 4);
    await assert.rejects(ret({ kg: 7 }), /More kilograms returned/);
    await assert.rejects(ret({ kg: 1, qty: 1 }), /More units returned/);
    // Shortage: kilograms not physically there are written off with a reason and leave stock as a loss.
    const shortage = (id: string, data: object) => executeCommand(commandSchema.parse({ type: "recordShortage", id, data: { reason: "SUPPLIER", date: today, ...data } }), user.id, randomUUID());
    const stockBefore = (await getDashboard()).totalKg;
    await shortage(back, { kg: 1.5 });
    assert.equal((await getDashboard()).totalKg, stockBefore - 1.5);
    const withShortage = (await getState()).shipments.find(s => s.id === back)!;
    assert.equal(withShortage.adjustedKg, 1.5);
    assert.equal((await getAccountingReport("all", product.id, 1)).cur.losses.value, 3);
    await assert.rejects(shortage(back, { kg: 3 }), /More kilograms than remain/);
    await assert.rejects(executeCommand(commandSchema.parse({ type: "cancelShipment", id: back }), user.id), /shortages/);
    await shortage(back, { kg: 2.5, reason: "DAMAGED" });
    assert.ok(!(await browse({ ...params, kind: "inventory" })).items.some(s => s.id === back));
    assert.equal((await browse({ ...params, kind: "movements", filter: "ADJ" })).total, 2);
    assert.equal((await browse({ ...params, kind: "movements", filter: "RET" })).total, 1);
    console.log("Integration passed: migration preservation, incomplete receiving, kg-only sales, unit/kg overdraw protection, idempotency, browsing, missing-cost reporting, enrichment, immutable ledger and concurrent sales.");
  } finally {
    shared.frigocoldDb = previous;
    await db.$disconnect();
    if (connected) {
      if (!/^frigocold_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Unsafe test schema name");
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      const remaining = await admin.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = $1", [schema]);
      assert.equal(remaining.rowCount, 0);
      console.log("Disposable integration schema removed.");
    }
    await admin.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
