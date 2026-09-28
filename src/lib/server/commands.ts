import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { assertAvailable, assertSaleDate, requiredStock } from "./sale-rules";

export class DomainError extends Error {}
const id = z.string().uuid();
const name = z.string().trim().min(1).max(150);
const date = z.iso.date();
const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const count = z.number().int().nonnegative();
const lot = z.object({ lotNumber: z.string().trim().min(1).max(100), qty: z.number().int().positive() });

const shipment = z.object({
  productId: id, supplierId: id, orderNr: z.string().trim().min(1).max(100),
  draftId: id.optional(),
  loadType: z.enum(["CARTON", "PALLET"]), countDoc: count, countActual: z.number().int().positive(),
  netKgDoc: nonnegative, netKgActual: positive, lots: z.array(lot).min(1), costPerKg: positive,
  dateMode: z.enum(["FIXED", "RANGE"]), prodFrom: date.or(z.literal("")), prodTo: date.optional(),
  expFrom: date, expTo: date.optional(), entryDate: date,
});

const line = z.object({
  productId: id, shipmentId: id, method: z.enum(["FIXED", "VARIABLE", "PALLET", "TOTAL"]),
  qty: z.number().int().positive(), kg: positive, pricePerKg: nonnegative,
  weights: z.array(positive).optional(), fixedKg: positive.optional(),
});

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addProduct"), data: z.object({ name, weightType: z.enum(["VARIABLE", "FIXED", "PALLET"]), fixedKg: positive.optional(), origin: z.string().max(100).optional() }) }),
  z.object({ type: z.literal("addSupplier"), data: z.object({ name, country: z.string().trim().max(100), contact: z.string().max(150).optional(), phone: z.string().max(50).optional() }) }),
  z.object({ type: z.literal("addClient"), data: z.object({ name, city: z.string().trim().max(100), contact: z.string().max(150).optional(), phone: z.string().max(50).optional() }) }),
  z.object({ type: z.literal("updateSupplier"), id, data: z.object({ name: name.optional(), country: z.string().trim().max(100).optional(), contact: z.string().max(150).optional(), phone: z.string().max(50).optional() }) }),
  z.object({ type: z.literal("updateClient"), id, data: z.object({ name: name.optional(), city: z.string().trim().max(100).optional(), contact: z.string().max(150).optional(), phone: z.string().max(50).optional() }) }),
  z.object({ type: z.literal("addShipment"), data: shipment }),
  z.object({ type: z.literal("saveDraft"), data: z.object({ id: id.optional(), productId: id, data: z.record(z.string(), z.unknown()) }) }),
  z.object({ type: z.literal("deleteDraft"), id }),
  z.object({ type: z.literal("finalizeSale"), data: z.object({ clientId: id, lines: z.array(line).min(1), date: date.optional() }) }),
  z.object({ type: z.literal("setThresholds"), data: z.object({ expiryDays: count.max(3650), lowShipmentCount: count.max(100000), lowProductKg: z.record(z.string(), nonnegative) }) }),
]);

export type Command = z.infer<typeof commandSchema>;
export function commandHash(command: Command) { return createHash("sha256").update(JSON.stringify(command)).digest("hex"); }

function validateShipment(s: z.infer<typeof shipment>) {
  if (new Set(s.lots.map(l => l.lotNumber.toLowerCase())).size !== s.lots.length) throw new DomainError("Duplicate lot number");
  if (s.lots.reduce((n, l) => n + l.qty, 0) !== s.countActual) throw new DomainError("Lot quantities must equal received units");
  if (s.dateMode === "RANGE" && (!s.expTo || s.expTo < s.expFrom || (s.prodTo && s.prodTo < s.prodFrom))) throw new DomainError("Invalid date range");
  if (s.expFrom < s.prodFrom) throw new DomainError("Expiry date precedes production date");
}

export async function executeCommand(command: Command, userId: string, requestId?: string) {
  const db = getDb();
  const protectedWrite = command.type === "addShipment" || command.type === "finalizeSale";
  if (protectedWrite && !requestId) throw new DomainError("Request ID is required");
  const hash = protectedWrite ? commandHash(command) : "";
  if (protectedWrite && requestId) {
    const previous = await db.operation.findUnique({ where: { key: requestId } });
    if (previous) {
      if (previous.kind !== command.type || previous.payloadHash !== hash || !previous.resultId) throw new DomainError("Request ID was used for different data");
      return { id: previous.resultId };
    }
  }
  switch (command.type) {
    case "addProduct": {
      if (command.data.weightType === "FIXED" && !command.data.fixedKg) throw new DomainError("Fixed weight is required");
      const row = await db.product.create({ data: command.data });
      return { id: row.id };
    }
    case "addSupplier": { const row = await db.supplier.create({ data: command.data }); return { id: row.id }; }
    case "addClient": { const row = await db.client.create({ data: command.data }); return { id: row.id }; }
    case "updateSupplier": {
      const row = await db.supplier.update({ where: { id: command.id }, data: command.data }); return { id: row.id };
    }
    case "updateClient": {
      const row = await db.client.update({ where: { id: command.id }, data: command.data }); return { id: row.id };
    }
    case "addShipment": {
      const s = command.data;
      validateShipment(s);
      const row = await db.$transaction(async tx => {
        await tx.operation.create({ data: { key: requestId!, kind: command.type, payloadHash: hash } });
        const created = await tx.shipment.create({ data: {
          productId: s.productId, supplierId: s.supplierId, orderNr: s.orderNr, loadType: s.loadType,
          countDoc: s.countDoc, countActual: s.countActual, netKgDoc: s.netKgDoc, netKgActual: s.netKgActual,
          costPerKg: s.costPerKg, dateMode: s.dateMode, prodFrom: s.prodFrom, prodTo: s.prodTo,
          expFrom: s.expFrom, expTo: s.expTo, entryDate: s.entryDate,
          lots: { create: s.lots },
        } });
        await tx.movement.create({ data: { shipmentId: created.id, userId, type: "IN", kg: s.netKgActual, qty: s.countActual } });
        if (s.draftId) await tx.draft.deleteMany({ where: { id: s.draftId } });
        await tx.operation.update({ where: { key: requestId! }, data: { resultId: created.id } });
        return created;
      });
      return { id: row.id };
    }
    case "saveDraft": {
      const d = command.data;
      const row = d.id ? await db.draft.upsert({ where: { id: d.id }, create: { id: d.id, productId: d.productId, data: d.data as Prisma.InputJsonValue }, update: { productId: d.productId, data: d.data as Prisma.InputJsonValue } }) : await db.draft.create({ data: { productId: d.productId, data: d.data as Prisma.InputJsonValue } });
      return { id: row.id };
    }
    case "deleteDraft": { await db.draft.delete({ where: { id: command.id } }); return { id: command.id }; }
    case "setThresholds": {
      await db.settings.upsert({ where: { id: 1 }, create: { id: 1, ...command.data }, update: command.data });
      return { id: 1 };
    }
    case "finalizeSale": {
      const { clientId, lines } = command.data;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
      const saleDate = command.data.date ?? today;
      const required = requiredStock(lines);
      const ids = [...required.keys()].sort();
      const sale = await db.$transaction(async tx => {
        await tx.operation.create({ data: { key: requestId!, kind: command.type, payloadHash: hash } });
        if (!(await tx.client.findUnique({ where: { id: clientId }, select: { id: true } }))) throw new DomainError("Client not found");
        // The row locks serialize concurrent sales against the same shipments.
        for (const shipmentId of ids) await tx.$queryRaw`SELECT id FROM shipments WHERE id = ${shipmentId}::uuid FOR UPDATE`;
        const shipments = await tx.shipment.findMany({ where: { id: { in: ids } }, select: { id: true, productId: true, countActual: true, netKgActual: true, entryDate: true } });
        if (shipments.length !== ids.length) throw new DomainError("Shipment not found");
        const byId = new Map(shipments.map(s => [s.id, s]));
        for (const l of lines) if (byId.get(l.shipmentId)?.productId !== l.productId) throw new DomainError("Product does not match shipment");
        assertSaleDate(saleDate, today, shipments.map(s => s.entryDate));
        const moved = await tx.movement.groupBy({ by: ["shipmentId"], where: { shipmentId: { in: ids } }, _sum: { kg: true, qty: true } });
        const balance = new Map(moved.map(m => [m.shipmentId, { kg: m._sum.kg?.toNumber() ?? 0, qty: m._sum.qty ?? 0 }]));
        assertAvailable(required, balance);
        const created = await tx.sale.create({ data: { clientId, date: saleDate } });
        for (const l of lines) {
          await tx.saleLine.create({ data: { saleId: created.id, shipmentId: l.shipmentId, method: l.method, qty: l.qty, kg: l.kg, pricePerKg: l.pricePerKg, weights: l.weights ?? Prisma.JsonNull, fixedKg: l.fixedKg } });
          await tx.movement.create({ data: { shipmentId: l.shipmentId, saleId: created.id, userId, type: "OUT", kg: -l.kg, qty: -l.qty } });
        }
        await tx.operation.update({ where: { key: requestId! }, data: { resultId: created.id } });
        return created;
      });
      return { id: sale.id };
    }
  }
}
