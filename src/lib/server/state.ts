import type { Draft, Product, Sale, Shipment, ShortageReason, StockAdjustment, Supplier, Client, Thresholds } from "@/lib/types";
import { getDb } from "./db";

const num = (x: { toNumber(): number } | null) => x?.toNumber() ?? undefined;
const nullableNum = (x: { toNumber(): number } | null) => x?.toNumber() ?? null;

export async function getState(): Promise<{ products: Product[]; suppliers: Supplier[]; clients: Client[]; shipments: Shipment[]; drafts: Draft[]; sales: Sale[]; adjustments: StockAdjustment[]; thresholds: Thresholds }> {
  const db = getDb();
  const [products, suppliers, clients, shipments, drafts, sales, movements, settings, adjustments] = await Promise.all([
    db.product.findMany({ orderBy: { name: "asc" } }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.shipment.findMany({ where: { cancelledAt: null }, include: { lots: true, corrections: { orderBy: { createdAt: "asc" } }, returnOfLine: { select: { id: true, saleId: true, shipmentId: true, sale: { select: { clientId: true, date: true } } } } }, orderBy: { createdAt: "asc" } }),
    db.draft.findMany({ orderBy: { savedAt: "desc" } }),
    db.sale.findMany({ where: { cancelledAt: null }, include: { lines: { include: { shipment: { select: { productId: true } } } } }, orderBy: { createdAt: "asc" } }),
    db.movement.groupBy({ by: ["shipmentId", "type"], _sum: { kg: true, qty: true } }),
    db.settings.findUnique({ where: { id: 1 } }),
    db.stockAdjustment.findMany({ where: { shipment: { cancelledAt: null } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
  ]);
  const sold = new Map<string, { kg: number; count: number }>();
  const adjusted = new Map<string, { kg: number; count: number }>();
  // A cancelled sale's VOID movements cancel its OUT movements, so only sales that stand count as sold.
  for (const m of movements) if (m.type === "OUT" || m.type === "VOID" || m.type === "ADJUST") {
    const into = m.type === "ADJUST" ? adjusted : sold;
    const previous = into.get(m.shipmentId) ?? { kg: 0, count: 0 };
    into.set(m.shipmentId, { kg: previous.kg - (m._sum.kg?.toNumber() ?? 0), count: previous.count - (m._sum.qty ?? 0) });
  }
  // A client return is credited at the agreed price on the return date: it appears as a credit "sale" with
  // negative kg against the original load, so revenue, cost of goods and client figures net it out.
  const credits: Sale[] = shipments.flatMap(s => {
    if (!s.returnOfLine || s.returnPricePerKg == null) return [];
    const kg = s.netKgActual.toNumber(), price = s.returnPricePerKg.toNumber();
    const line = { productId: s.productId, shipmentId: s.returnOfLine.shipmentId, method: "RETURN" as const, qty: s.countActual == null ? null : -s.countActual, kg: -kg, pricePerKg: price, total: -kg * price };
    return [{ id: `return-${s.id}`, clientId: s.returnOfLine.sale.clientId, date: s.entryDate, lines: [line], totalKg: -kg, totalValue: -kg * price, isReturn: true }];
  });
  return {
    products: products.map(p => ({ id: p.id, name: p.name, weightType: p.weightType as Product["weightType"], fixedKg: num(p.fixedKg), origin: p.origin ?? undefined })),
    suppliers: suppliers.map(s => ({ id: s.id, name: s.name, country: s.country, contact: s.contact ?? undefined, phone: s.phone ?? undefined })),
    clients: clients.map(c => ({ id: c.id, name: c.name, city: c.city, contact: c.contact ?? undefined, phone: c.phone ?? undefined })),
    shipments: shipments.map(s => ({ id: s.id, productId: s.productId, supplierId: s.supplierId, orderNr: s.orderNr, loadType: s.loadType as Shipment["loadType"], countDoc: s.countDoc, countActual: s.countActual, netKgDoc: nullableNum(s.netKgDoc), netKgActual: s.netKgActual.toNumber(), lots: s.lots.map(l => ({ lotNumber: l.lotNumber, qty: l.qty })), costPerKg: nullableNum(s.costPerKg), totalCost: s.costPerKg == null ? null : s.costPerKg.toNumber() * s.netKgActual.toNumber(), dateMode: s.dateMode as Shipment["dateMode"], prodFrom: s.prodFrom, prodTo: s.prodTo ?? undefined, expFrom: s.expFrom, expTo: s.expTo ?? undefined, entryDate: s.entryDate, fixedKg: num(s.fixedKg), origin: s.origin ?? undefined, specs: s.specs ?? undefined, soldKg: sold.get(s.id)?.kg ?? 0, soldCount: sold.get(s.id)?.count ?? 0, adjustedKg: adjusted.get(s.id)?.kg ?? 0, adjustedCount: adjusted.get(s.id)?.count ?? 0, ...(s.corrections.length ? { corrections: s.corrections.map(c => ({ kgBefore: c.kgBefore.toNumber(), kgAfter: c.kgAfter.toNumber(), docKgBefore: nullableNum(c.docKgBefore), docKgAfter: nullableNum(c.docKgAfter), note: c.note, date: c.date })) } : {}), ...(s.returnOfLine ? { returnOf: { lineId: s.returnOfLine.id, saleId: s.returnOfLine.saleId, clientId: s.returnOfLine.sale.clientId, shipmentId: s.returnOfLine.shipmentId, saleDate: s.returnOfLine.sale.date, reason: s.returnReason ?? "", pricePerKg: s.returnPricePerKg?.toNumber() ?? 0 } } : {}) })),
    drafts: drafts.map(d => ({ id: d.id, productId: d.productId, data: d.data as Draft["data"], savedAt: d.savedAt.toISOString() })),
    sales: [...sales.map(s => { const lines = s.lines.map(l => ({ lineId: l.id, productId: l.shipment.productId, shipmentId: l.shipmentId, method: l.method as Sale["lines"][number]["method"], qty: l.qty, kg: l.kg.toNumber(), pricePerKg: l.pricePerKg.toNumber(), total: l.kg.toNumber() * l.pricePerKg.toNumber(), weights: Array.isArray(l.weights) ? l.weights as number[] : undefined, fixedKg: num(l.fixedKg) })); return { id: s.id, clientId: s.clientId, date: s.date, receiptNr: s.receiptNr, lines, totalKg: lines.reduce((n, l) => n + l.kg, 0), totalValue: lines.reduce((n, l) => n + l.total, 0) }; }), ...credits],
    adjustments: adjustments.map(a => ({ id: a.id, shipmentId: a.shipmentId, kg: a.kg.toNumber(), qty: a.qty, reason: a.reason as ShortageReason, note: a.note ?? undefined, date: a.date })),
    thresholds: settings ? { expiryDays: settings.expiryDays, lowShipmentCount: settings.lowShipmentCount, lowProductKg: settings.lowProductKg as Record<string, number> } : { expiryDays: 60, lowShipmentCount: 5, lowProductKg: {} },
  };
}
