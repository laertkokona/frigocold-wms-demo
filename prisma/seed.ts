import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as demo from "../src/lib/mock-data";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.INITIAL_USER_USERNAME || !process.env.INITIAL_USER_PASSWORD || process.env.INITIAL_USER_PASSWORD.length < 12) {
  throw new Error("Set INITIAL_USER_USERNAME and INITIAL_USER_PASSWORD (12+ characters)");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const user = await db.user.upsert({
    where: { username: process.env.INITIAL_USER_USERNAME! },
    create: { username: process.env.INITIAL_USER_USERNAME!, passwordHash: await hash(process.env.INITIAL_USER_PASSWORD!, 12) },
    update: {},
  });
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, expiryDays: 60, lowShipmentCount: 5, lowProductKg: {} }, update: {} });
  if (!process.argv.includes("--demo")) return;
  if (await db.product.count()) throw new Error("Demo seed requires an empty database");

  const products = new Map<string, string>();
  const suppliers = new Map<string, string>();
  const clients = new Map<string, string>();
  const shipments = new Map<string, string>();
  for (const p of demo.products) products.set(p.id, (await db.product.create({ data: { name: p.name, weightType: p.weightType, fixedKg: p.fixedKg, origin: p.origin } })).id);
  for (const s of demo.suppliers) suppliers.set(s.id, (await db.supplier.create({ data: { name: s.name, country: s.country, contact: s.contact, phone: s.phone } })).id);
  for (const c of demo.clients) clients.set(c.id, (await db.client.create({ data: { name: c.name, city: c.city, contact: c.contact, phone: c.phone } })).id);
  for (const s of demo.shipments) {
    const row = await db.shipment.create({ data: {
      productId: products.get(s.productId)!, supplierId: suppliers.get(s.supplierId)!, orderNr: s.orderNr,
      loadType: s.loadType, countDoc: s.countDoc, countActual: s.countActual, netKgDoc: s.netKgDoc,
      netKgActual: s.netKgActual, costPerKg: s.costPerKg, dateMode: s.dateMode, prodFrom: s.prodFrom,
      prodTo: s.prodTo, expFrom: s.expFrom, expTo: s.expTo, entryDate: s.entryDate,
      lots: { create: s.lots.map(l => ({ lotNumber: l.lotNumber, qty: l.qty })) },
    } });
    shipments.set(s.id, row.id);
    await db.movement.create({ data: { shipmentId: row.id, userId: user.id, type: "IN", kg: s.netKgActual, qty: s.countActual } });
  }
  for (const sale of demo.sales) {
    const row = await db.sale.create({ data: { clientId: clients.get(sale.clientId)!, date: sale.date } });
    for (const l of sale.lines) {
      const shipmentId = shipments.get(l.shipmentId)!;
      await db.saleLine.create({ data: { saleId: row.id, shipmentId, method: l.method, qty: l.qty, kg: l.kg, pricePerKg: l.pricePerKg, weights: l.weights, fixedKg: l.fixedKg } });
      await db.movement.create({ data: { shipmentId, saleId: row.id, userId: user.id, type: "OUT", kg: -l.kg, qty: -l.qty } });
    }
  }
  const lowProductKg = Object.fromEntries(Object.entries(demo.thresholds.lowProductKg).map(([oldId, kg]) => [products.get(oldId)!, kg]));
  await db.settings.update({ where: { id: 1 }, data: { ...demo.thresholds, lowProductKg } });
}

main().then(() => db.$disconnect()).catch(async error => { console.error(error); await db.$disconnect(); process.exitCode = 1; });
