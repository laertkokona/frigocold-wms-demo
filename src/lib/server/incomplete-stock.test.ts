import assert from "node:assert/strict";
import test from "node:test";
import { commandSchema, validateShipment } from "./commands";
import { assertAvailable, requiredStock } from "./sale-rules";
import { remainingCount } from "../stock";
import { stockByProduct, productProfit } from "../calc";
import { headline, lotRows, monthlyEcon, priceSeries } from "../accounting";
import type { Product, Sale, Shipment } from "../types";
import { buildDashboard } from "./dashboard";

const product: Product = { id: "00000000-0000-4000-8000-000000000001", name: "Chicken" };
const supplierId = "00000000-0000-4000-8000-000000000002";
const shipment = (id: string, costPerKg: number | null): Shipment => ({
  id, productId: product.id, supplierId, orderNr: "A", loadType: "CARTON",
  countDoc: 10, countActual: 10, netKgDoc: 100, netKgActual: 100,
  lots: [{ lotNumber: "L", qty: 10 }], costPerKg, totalCost: costPerKg === null ? null : costPerKg * 100,
  dateMode: "FIXED", prodFrom: "", expFrom: "2027-01-01", entryDate: "2026-10-01",
  soldKg: 10, soldCount: 1,
});
const known = shipment("00000000-0000-4000-8000-000000000003", 2);
const unknown = shipment("00000000-0000-4000-8000-000000000004", null);
const sale: Sale = { id: "sale", clientId: "client", date: "2026-10-02", totalKg: 20, totalValue: 100,
  lines: [known, unknown].map(s => ({ productId: product.id, shipmentId: s.id, method: "TOTAL", qty: 1, kg: 10, pricePerKg: 5, total: 50 })) };

test("receiving accepts product, kg and expiry without document data, count, supplier, lots or cost", () => {
  const result = commandSchema.safeParse({ type: "addShipment", data: {
    productId: product.id, loadType: "CARTON", netKgActual: 100, dateMode: "FIXED", prodFrom: "", expFrom: "2027-01-01", entryDate: "2026-10-01",
  } });
  assert.equal(result.success, true);
});

test("blank costs and counts are accepted as null, while zero and negative actual counts and costs are rejected", () => {
  const data = { ...known, countActual: null, countDoc: null, costPerKg: null, supplierId: null, orderNr: null, netKgDoc: null, lots: [] };
  assert.equal(commandSchema.safeParse({ type: "addShipment", data }).success, true);
  for (const patch of [{ countActual: 0 }, { countActual: -1 }, { costPerKg: 0 }, { costPerKg: -1 }, { netKgActual: 0 }]) {
    assert.equal(commandSchema.safeParse({ type: "addShipment", data: { ...data, ...patch } }).success, false);
  }
});

test("unknown opening count never reports a zero or derived remaining count", () => {
  assert.equal(remainingCount({ ...unknown, countActual: null, soldCount: 1 }), null);
  assert.equal(remainingCount(known), 9);
});

test("kg-only receipt sales work without units and still reject kilogram overdraw", () => {
  const required = requiredStock([{ shipmentId: unknown.id, method: "TOTAL", qty: null, kg: 10 }]);
  assert.doesNotThrow(() => assertAvailable(required, new Map([[unknown.id, { kg: 90, qty: null }]])));
  assert.throws(() => assertAvailable(required, new Map([[unknown.id, { kg: 5, qty: null }]])), /Insufficient stock/);
});

test("known-count stock cannot bypass unit checks by omitting units on one of several sale lines", () => {
  const required = requiredStock([
    { shipmentId: known.id, method: "TOTAL", qty: 2, kg: 10 },
    { shipmentId: known.id, method: "TOTAL", qty: null, kg: 10 },
  ]);
  assert.throws(() => assertAvailable(required, new Map([[known.id, { kg: 90, qty: 9 }]])), /count|units/i);
  assert.throws(() => requiredStock([{ shipmentId: known.id, method: "FIXED", qty: null, kg: 10, fixedKg: 10 }]), /count|units/i);
});

test("stock valuation includes every kilogram and identifies the value coverage", () => {
  const [row] = stockByProduct([known, unknown], [product]);
  assert.equal(row.kg, 180);
  assert.equal(row.value, null);
  assert.equal(row.knownValue, 180);
  assert.equal(row.missingCostKg, 90);
});

test("missing purchase costs leave sales revenue intact and make profit and margin unavailable", () => {
  const h = headline([sale], [known, unknown], "2026-10-01", "2026-10-31");
  assert.equal(h.revenue, 100);
  assert.equal(h.kg, 20);
  assert.equal(h.cogs, null);
  assert.equal(h.profit, null);
  assert.equal(h.margin, null);
  assert.equal(h.missingCostKg, 10);
  assert.equal(h.purchaseSpend, null);
  assert.equal(h.inventoryValue, null);
  assert.equal(h.knownInventoryValue, 180);
  const [p] = productProfit([product], [known, unknown], [sale]);
  assert.equal(p.revenue, 100);
  assert.equal(p.profit, null);
  assert.equal(p.margin, null);
});

test("monthly charts and lot reports preserve gaps for unknown costs", () => {
  const [month] = monthlyEcon([sale], [known, unknown], ["2026-10"]);
  assert.equal(month.revenue, 100);
  assert.equal(month.profit, null);
  assert.equal(month.spend, null);
  const [price] = priceSeries(product.id, [sale], [known, unknown], ["2026-10"]);
  assert.equal(price.sell, 5);
  assert.equal(price.cost, null);
  const lot = lotRows([unknown], [product], [], [sale])[0];
  assert.equal(lot.revenue, 50);
  assert.equal(lot.realised, null);
  assert.equal(lot.remainValue, null);
});

test("fully costed reports retain exact stock values and profits", () => {
  const fullyCosted = { ...sale, lines: [sale.lines[0]], totalKg: 10, totalValue: 50 };
  const h = headline([fullyCosted], [known], "2026-10-01", "2026-10-31");
  assert.equal(h.revenue, 50);
  assert.equal(h.cogs, 20);
  assert.equal(h.profit, 30);
  assert.equal(h.margin, 0.6);
  assert.equal(h.inventoryValue, 180);
  assert.equal(h.purchaseSpend, 200);
});

test("lots are optional but quantities require and match a known count", () => {
  const parse = (patch: object) => {
    const cmd = commandSchema.parse({ type: "addShipment", data: { ...known, ...patch } });
    if (cmd.type !== "addShipment") throw new Error("Wrong command");
    return cmd.data;
  };
  assert.doesNotThrow(() => validateShipment(parse({ lots: [] })));
  assert.throws(() => validateShipment(parse({ countActual: null })), /known unit count/);
  assert.throws(() => validateShipment(parse({ lots: [{ lotNumber: "L", qty: 9 }] })), /equal received units/);
});

test("dashboard reports missing-cost coverage without inventing total stock value or profit", () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
  const data = buildDashboard({ shipments: [known, unknown], products: [product], sales: [{ ...sale, date: today }], clients: [], suppliers: [], drafts: [], thresholds: { expiryDays: 3650, lowShipmentCount: 5, lowProductKg: {} } });
  assert.equal(data.totalKg, 180);
  assert.equal(data.totalVal, null);
  assert.equal(data.knownStockValue, 180);
  assert.equal(data.missingStockCostKg, 90);
  assert.equal(data.profitMonth, null);
  assert.equal(data.missingMonthCostKg, 10);
  assert.equal(data.riskVal, null);
  assert.equal(data.mostProfitable, null);
});
