import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { assertAvailable, assertSaleDate, requiredStock } from "./sale-rules";

export class DomainError extends Error {}
/** Why stock was found missing: supplier short-loaded, counting error, sale never recorded, spoiled/damaged, other. */
export const SHORTAGE_REASONS = ["SUPPLIER", "COUNT", "UNRECORDED_SALE", "DAMAGED", "OTHER"] as const;
const id = z.string().uuid();
const name = z.string().trim().min(1).max(150);
const date = z.iso.date();
const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const count = z.number().int().nonnegative();
const lot = z.object({ lotNumber: z.string().trim().min(1).max(100), qty: z.number().int().positive() });

const shipment = z.object({
  productId: id, supplierId: id.nullable().default(null), orderNr: z.string().trim().min(1).max(100).nullable().default(null),
  draftId: id.optional(),
  loadType: z.enum(["CARTON", "PALLET"]).default("CARTON"), countDoc: count.nullable().default(null), countActual: z.number().int().positive().nullable().default(null),
  netKgDoc: nonnegative.nullable().default(null), netKgActual: positive, lots: z.array(lot).default([]), costPerKg: positive.nullable().default(null),
  dateMode: z.enum(["FIXED", "RANGE"]).default("FIXED"), prodFrom: date.or(z.literal("")).default(""), prodTo: date.optional(),
  expFrom: date, expTo: date.optional(), entryDate: date.default(() => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" })),
  fixedKg: positive.optional(), origin: z.string().trim().max(100).optional(), specs: z.string().trim().max(200).optional(),
});

const line = z.object({
  productId: id, shipmentId: id, method: z.enum(["FIXED", "VARIABLE", "PALLET", "TOTAL"]),
  qty: z.number().int().positive().nullable().default(null), kg: positive, pricePerKg: nonnegative,
  weights: z.array(positive).optional(), fixedKg: positive.optional(),
});

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("addProduct"), data: z.object({ name, weightType: z.enum(["VARIABLE", "FIXED", "PALLET"]).optional(), fixedKg: positive.optional(), origin: z.string().max(100).optional() }) }),
  z.object({ type: z.literal("updateProduct"), id, data: z.object({ name }) }),
  z.object({ type: z.literal("addSupplier"), data: z.object({ name, country: z.string().trim().max(100), contact: z.string().max(150).optional(), phone: z.string().max(50).optional() }) }),
  z.object({ type: z.literal("addClient"), data: z.object({ name, city: z.string().trim().max(100), contact: z.string().max(150).optional(), phone: z.string().max(50).optional() }) }),
  z.object({ type: z.literal("updateSupplier"), id, data: z.object({ name: name.optional(), country: z.string().trim().max(100).optional(), contact: z.string().max(150).optional(), phone: z.string().max(50).optional() }) }),
  z.object({ type: z.literal("updateClient"), id, data: z.object({ name: name.optional(), city: z.string().trim().max(100).optional(), contact: z.string().max(150).optional(), phone: z.string().max(50).optional() }) }),
  z.object({ type: z.literal("addShipment"), data: shipment }),
  z.object({ type: z.literal("updateShipmentDetails"), id, data: z.object({
    supplierId: id.nullable().optional(), orderNr: z.string().trim().min(1).max(100).nullable().optional(), costPerKg: positive.nullable().optional(),
    entryDate: date.optional(),
  }).strict().refine(data => Object.keys(data).length > 0, "No editable details supplied") }),
  z.object({ type: z.literal("cancelShipment"), id }),
  z.object({ type: z.literal("addReturn"), data: z.object({
    saleLineId: id, kg: positive, qty: z.number().int().positive().nullable().default(null),
    pricePerKg: nonnegative, reason: z.string().trim().min(1).max(200), entryDate: date,
  }).strict() }),
  z.object({ type: z.literal("recordShortage"), id, data: z.object({
    kg: positive, qty: z.number().int().positive().nullable().default(null),
    reason: z.enum(SHORTAGE_REASONS), note: z.string().trim().max(300).optional(), date,
  }).strict() }),
  z.object({ type: z.literal("cancelSale"), id, data: z.object({ reason: z.string().trim().min(1).max(300) }).strict() }),
  z.object({ type: z.literal("correctShipmentKg"), id, data: z.object({
    netKgActual: positive, updateDoc: z.boolean().default(false), note: z.string().trim().min(1).max(300),
  }).strict() }),
  z.object({ type: z.literal("saveDraft"), data: z.object({ id: id.optional(), productId: id, data: z.record(z.string(), z.unknown()) }) }),
  z.object({ type: z.literal("deleteDraft"), id }),
  z.object({ type: z.literal("finalizeSale"), data: z.object({ clientId: id, lines: z.array(line).min(1), date: date.optional() }) }),
  z.object({ type: z.literal("setThresholds"), data: z.object({ expiryDays: count.max(3650), lowShipmentCount: count.max(100000), lowProductKg: z.record(z.string(), nonnegative) }) }),
]);

export type Command = z.infer<typeof commandSchema>;
export function commandHash(command: Command) { return createHash("sha256").update(JSON.stringify(command)).digest("hex"); }

export function validateShipment(s: z.infer<typeof shipment>) {
  if (new Set(s.lots.map(l => l.lotNumber.toLowerCase())).size !== s.lots.length) throw new DomainError("Duplicate lot number");
  if (s.lots.length && s.countActual == null) throw new DomainError("Lot quantities require a known unit count");
  if (s.lots.length && s.lots.reduce((n, l) => n + l.qty, 0) !== s.countActual) throw new DomainError("Lot quantities must equal received units");
  if (s.dateMode === "RANGE" && (!s.expTo || s.expTo < s.expFrom || (s.prodTo && s.prodTo < s.prodFrom))) throw new DomainError("Invalid date range");
  if (s.expFrom < s.prodFrom) throw new DomainError("Expiry date precedes production date");
  if (s.fixedKg && s.loadType !== "CARTON") throw new DomainError("Fixed carton weight applies only to carton loads");
}

export async function executeCommand(command: Command, userId: string, requestId?: string) {
  const db = getDb();
  const protectedWrite = command.type === "addShipment" || command.type === "finalizeSale" || command.type === "addReturn" || command.type === "recordShortage";
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
      const { weightType, ...rest } = command.data;
      const row = await db.product.create({ data: { ...rest, weightType: weightType ?? "VARIABLE" } });
      return { id: row.id };
    }
    case "updateProduct": {
      const row = await db.product.update({ where: { id: command.id }, data: command.data }); return { id: row.id };
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
          fixedKg: s.fixedKg, origin: s.origin || undefined, specs: s.specs || undefined,
          lots: { create: s.lots },
        } });
        await tx.movement.create({ data: { shipmentId: created.id, userId, type: "IN", kg: s.netKgActual, qty: s.countActual } });
        if (s.draftId) await tx.draft.deleteMany({ where: { id: s.draftId } });
        await tx.operation.update({ where: { key: requestId! }, data: { resultId: created.id } });
        return created;
      });
      return { id: row.id };
    }
    case "updateShipmentDetails": {
      const { entryDate } = command.data;
      const row = await db.$transaction(async tx => {
        if (entryDate) {
          // A corrected entry date must not be in the future, nor later than a sale already made from this load.
          const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
          if (entryDate > today) throw new DomainError("Entry date cannot be in the future");
          const firstSale = await tx.sale.findFirst({ where: { cancelledAt: null, lines: { some: { shipmentId: command.id } } }, orderBy: { date: "asc" }, select: { date: true } });
          if (firstSale && entryDate > firstSale.date) throw new DomainError("Entry date cannot be after a sale from this load");
        }
        if ((await tx.shipment.findUnique({ where: { id: command.id }, select: { cancelledAt: true } }))?.cancelledAt) throw new DomainError("Shipment is cancelled");
        return tx.shipment.update({ where: { id: command.id }, data: command.data });
      });
      return { id: row.id };
    }
    case "cancelShipment": {
      // Cancels a load entered by mistake (e.g. saved twice), only while nothing has been sold from it.
      // The ledger stays append-only: a CANCEL movement reverses the IN movement and the load is marked
      // cancelled, so it leaves stock and reports while its original rows are kept.
      await db.$transaction(async tx => {
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM shipments WHERE id = ${command.id}::uuid FOR UPDATE`;
        if (!locked.length) throw new DomainError("Shipment not found");
        const s = await tx.shipment.findUniqueOrThrow({ where: { id: command.id }, select: { cancelledAt: true, netKgActual: true, countActual: true } });
        if (s.cancelledAt) throw new DomainError("Shipment is already cancelled");
        if (await tx.saleLine.count({ where: { shipmentId: command.id, sale: { cancelledAt: null } } })) throw new DomainError("A load with sales cannot be cancelled");
        if (await tx.stockAdjustment.count({ where: { shipmentId: command.id } })) throw new DomainError("A load with recorded shortages cannot be cancelled");
        await tx.movement.create({ data: { shipmentId: command.id, userId, type: "CANCEL", kg: s.netKgActual.negated(), qty: s.countActual == null ? null : -s.countActual } });
        await tx.shipment.update({ where: { id: command.id }, data: { cancelledAt: new Date() } });
      });
      return { id: command.id };
    }
    case "addReturn": {
      // Goods a client sends back come in as a new load linked to the sale line, copying the sold load's
      // product, lots, dates and specs and its cost, so stock value and the client's credit stay consistent.
      const r = command.data;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
      const row = await db.$transaction(async tx => {
        await tx.operation.create({ data: { key: requestId!, kind: command.type, payloadHash: hash } });
        const line = await tx.saleLine.findUnique({ where: { id: r.saleLineId }, include: { sale: { select: { date: true, cancelledAt: true } }, shipment: { include: { lots: true } } } });
        if (!line) throw new DomainError("Sale line not found");
        if (line.sale.cancelledAt) throw new DomainError("This sale was cancelled");
        // Lock the line's shipment so two returns against the same line are checked one after the other.
        await tx.$queryRaw`SELECT id FROM shipments WHERE id = ${line.shipmentId}::uuid FOR UPDATE`;
        if (r.entryDate > today) throw new DomainError("Return date cannot be in the future");
        if (r.entryDate < line.sale.date) throw new DomainError("Return date cannot be before the sale");
        const previous = await tx.shipment.findMany({ where: { returnOfLineId: line.id, cancelledAt: null }, select: { netKgActual: true, countActual: true } });
        const returnedKg = previous.reduce((n, p) => n + p.netKgActual.toNumber(), 0);
        if (r.kg > line.kg.toNumber() - returnedKg + 0.0005) throw new DomainError("More kilograms returned than were sold on this line");
        if (r.qty != null && line.qty != null && r.qty > line.qty - previous.reduce((n, p) => n + (p.countActual ?? 0), 0)) throw new DomainError("More units returned than were sold on this line");
        const o = line.shipment;
        // Lot quantities must add up to the count, so lots are copied only when that is unambiguous.
        const lots = r.qty != null && o.lots.length === 1 ? [{ lotNumber: o.lots[0].lotNumber, qty: r.qty }] : [];
        const lotNote = !lots.length && o.lots.length ? `Lot ${o.lots.map(l => l.lotNumber).join(", ")}` : null;
        const created = await tx.shipment.create({ data: {
          productId: o.productId, supplierId: null, orderNr: null, loadType: o.loadType,
          countDoc: r.qty, countActual: r.qty, netKgDoc: r.kg, netKgActual: r.kg, costPerKg: o.costPerKg,
          dateMode: o.dateMode, prodFrom: o.prodFrom, prodTo: o.prodTo, expFrom: o.expFrom, expTo: o.expTo, entryDate: r.entryDate,
          fixedKg: o.fixedKg, origin: o.origin, specs: [o.specs, lotNote].filter(Boolean).join(" · ") || null,
          returnOfLineId: line.id, returnReason: r.reason, returnPricePerKg: r.pricePerKg,
          lots: { create: lots },
        } });
        await tx.movement.create({ data: { shipmentId: created.id, userId, type: "IN", kg: r.kg, qty: r.qty } });
        await tx.operation.update({ where: { key: requestId! }, data: { resultId: created.id } });
        return created;
      });
      return { id: row.id };
    }
    case "recordShortage": {
      // Stock that is not physically there (short-loaded, miscounted, unrecorded sale, spoiled) is written off with
      // a reason and date. The ADJUST movement keeps the ledger append-only; the balance can never go below zero.
      const a = command.data;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
      const row = await db.$transaction(async tx => {
        await tx.operation.create({ data: { key: requestId!, kind: command.type, payloadHash: hash } });
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM shipments WHERE id = ${command.id}::uuid FOR UPDATE`;
        if (!locked.length) throw new DomainError("Shipment not found");
        const s = await tx.shipment.findUniqueOrThrow({ where: { id: command.id }, select: { cancelledAt: true, entryDate: true, countActual: true } });
        if (s.cancelledAt) throw new DomainError("Shipment is cancelled");
        if (a.date > today) throw new DomainError("Date cannot be in the future");
        if (a.date < s.entryDate) throw new DomainError("Date cannot be before the load was received");
        if (a.qty != null && s.countActual == null) throw new DomainError("This load has no unit count");
        const balance = await tx.movement.aggregate({ where: { shipmentId: command.id }, _sum: { kg: true, qty: true } });
        if (a.kg > (balance._sum.kg?.toNumber() ?? 0) + 0.0005) throw new DomainError("More kilograms than remain on this load");
        if (a.qty != null && a.qty > (balance._sum.qty ?? 0)) throw new DomainError("More units than remain on this load");
        const created = await tx.stockAdjustment.create({ data: { shipmentId: command.id, userId, kg: a.kg, qty: a.qty, reason: a.reason, note: a.note || null, date: a.date } });
        await tx.movement.create({ data: { shipmentId: command.id, userId, type: "ADJUST", kg: -a.kg, qty: a.qty == null ? null : -a.qty } });
        await tx.operation.update({ where: { key: requestId! }, data: { resultId: created.id } });
        return created;
      });
      return { id: row.id };
    }
    case "cancelSale": {
      // A sale recorded by mistake (wrong load, client, quantity or price) is cancelled, never deleted: the sale and
      // its lines stay for the record, VOID movements put the kilograms and units back on their loads, and the sale
      // drops out of stock, reports and client figures. The correct sale is then entered again in Dalje.
      await db.$transaction(async tx => {
        const lockedSale = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sales WHERE id = ${command.id}::uuid FOR UPDATE`;
        if (!lockedSale.length) throw new DomainError("Sale not found");
        const sale = await tx.sale.findUniqueOrThrow({ where: { id: command.id }, include: { lines: { include: { returns: { where: { cancelledAt: null }, select: { id: true } } } } } });
        if (sale.cancelledAt) throw new DomainError("Sale is already cancelled");
        if (sale.lines.some(l => l.returns.length)) throw new DomainError("This sale has client returns; cancel the returns first");
        for (const shipmentId of [...new Set(sale.lines.map(l => l.shipmentId))].sort()) await tx.$queryRaw`SELECT id FROM shipments WHERE id = ${shipmentId}::uuid FOR UPDATE`;
        for (const l of sale.lines) await tx.movement.create({ data: { shipmentId: l.shipmentId, saleId: sale.id, userId, type: "VOID", kg: l.kg, qty: l.qty } });
        await tx.sale.update({ where: { id: sale.id }, data: { cancelledAt: new Date(), cancelReason: command.data.reason } });
      });
      return { id: command.id };
    }
    case "correctShipmentKg": {
      // Corrects the received kilograms of a load entered wrongly. The load keeps its row and its sales; the
      // correction is kept with the before/after figures and a note, and a CORRECT movement of the difference keeps
      // stock equal to the signed sum of the ledger. The new figure cannot be below what has already left the load.
      const c = command.data;
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
      await db.$transaction(async tx => {
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM shipments WHERE id = ${command.id}::uuid FOR UPDATE`;
        if (!locked.length) throw new DomainError("Shipment not found");
        const s = await tx.shipment.findUniqueOrThrow({ where: { id: command.id }, select: { cancelledAt: true, returnOfLineId: true, netKgActual: true, netKgDoc: true } });
        if (s.cancelledAt) throw new DomainError("Shipment is cancelled");
        if (s.returnOfLineId) throw new DomainError("The kilograms of a client return cannot be corrected");
        const before = s.netKgActual.toNumber(), after = Math.round(c.netKgActual * 1000) / 1000, delta = Math.round((after - before) * 1000) / 1000;
        // Saving the same figure again (e.g. a retried request) changes nothing.
        if (delta === 0) return;
        const balance = (await tx.movement.aggregate({ where: { shipmentId: command.id }, _sum: { kg: true } }))._sum.kg?.toNumber() ?? 0;
        if (balance + delta < -0.0005) throw new DomainError("The corrected kilograms are less than what has already left this load");
        const docAfter = c.updateDoc ? after : s.netKgDoc?.toNumber() ?? null;
        await tx.shipmentCorrection.create({ data: { shipmentId: command.id, userId, kgBefore: before, kgAfter: after, docKgBefore: s.netKgDoc, docKgAfter: docAfter, note: c.note, date: today } });
        await tx.movement.create({ data: { shipmentId: command.id, userId, type: "CORRECT", kg: delta, qty: null } });
        await tx.shipment.update({ where: { id: command.id }, data: { netKgActual: after, ...(c.updateDoc ? { netKgDoc: after } : {}) } });
      });
      return { id: command.id };
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
        const shipments = await tx.shipment.findMany({ where: { id: { in: ids } }, select: { id: true, productId: true, countActual: true, netKgActual: true, entryDate: true, cancelledAt: true } });
        if (shipments.length !== ids.length) throw new DomainError("Shipment not found");
        if (shipments.some(s => s.cancelledAt)) throw new DomainError("Cannot sell from a cancelled load");
        const byId = new Map(shipments.map(s => [s.id, s]));
        for (const l of lines) if (byId.get(l.shipmentId)?.productId !== l.productId) throw new DomainError("Product does not match shipment");
        // A load without a known unit count can still be sold carton by carton (individual weights or a fixed
        // weight): the line's unit count is informative and only kilograms are checked against its stock.
        assertSaleDate(saleDate, today, shipments.map(s => s.entryDate));
        const moved = await tx.movement.groupBy({ by: ["shipmentId"], where: { shipmentId: { in: ids } }, _sum: { kg: true, qty: true } });
        const balance = new Map(moved.map(m => [m.shipmentId, { kg: m._sum.kg?.toNumber() ?? 0, qty: byId.get(m.shipmentId)?.countActual == null ? null : m._sum.qty ?? 0 }]));
        assertAvailable(required, balance);
        const created = await tx.sale.create({ data: { clientId, date: saleDate } });
        for (const l of lines) {
          await tx.saleLine.create({ data: { saleId: created.id, shipmentId: l.shipmentId, method: l.method, qty: l.qty, kg: l.kg, pricePerKg: l.pricePerKg, weights: l.weights ?? Prisma.JsonNull, fixedKg: l.fixedKg } });
          await tx.movement.create({ data: { shipmentId: l.shipmentId, saleId: created.id, userId, type: "OUT", kg: -l.kg, qty: l.qty == null ? null : -l.qty } });
        }
        await tx.operation.update({ where: { key: requestId! }, data: { resultId: created.id } });
        return created;
      });
      return { id: sale.id };
    }
  }
}
