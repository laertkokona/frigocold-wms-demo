import type { Draft, Product, Sale, Shipment, Supplier, Client, Thresholds } from "@/lib/types";
import { getDb } from "./db";

const num = (x: { toNumber(): number } | null) => x?.toNumber() ?? undefined;

export async function getState(): Promise<{ products: Product[]; suppliers: Supplier[]; clients: Client[]; shipments: Shipment[]; drafts: Draft[]; sales: Sale[]; thresholds: Thresholds }> {
  const db = getDb();
  const [products, suppliers, clients, shipments, drafts, sales, movements, settings] = await Promise.all([
    db.product.findMany({ orderBy: { name: "asc" } }),
    db.supplier.findMany({ orderBy: { name: "asc" } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.shipment.findMany({ include: { lots: true }, orderBy: { createdAt: "asc" } }),
    db.draft.findMany({ orderBy: { savedAt: "desc" } }),
    db.sale.findMany({ include: { lines: { include: { shipment: { select: { productId: true } } } } }, orderBy: { createdAt: "asc" } }),
    db.movement.groupBy({ by: ["shipmentId", "type"], _sum: { kg: true, qty: true } }),
    db.settings.findUnique({ where: { id: 1 } }),
  ]);
  const sold = new Map<string, { kg: number; count: number }>();
  for (const m of movements) if (m.type === "OUT") {
    const previous = sold.get(m.shipmentId) ?? { kg: 0, count: 0 };
    sold.set(m.shipmentId, { kg: previous.kg - (m._sum.kg?.toNumber() ?? 0), count: previous.count - (m._sum.qty ?? 0) });
  }
  return {
    products: products.map(p => ({ id: p.id, name: p.name, weightType: p.weightType as Product["weightType"], fixedKg: num(p.fixedKg), origin: p.origin ?? undefined })),
    suppliers: suppliers.map(s => ({ id: s.id, name: s.name, country: s.country, contact: s.contact ?? undefined, phone: s.phone ?? undefined })),
    clients: clients.map(c => ({ id: c.id, name: c.name, city: c.city, contact: c.contact ?? undefined, phone: c.phone ?? undefined })),
    shipments: shipments.map(s => ({ id: s.id, productId: s.productId, supplierId: s.supplierId, orderNr: s.orderNr, loadType: s.loadType as Shipment["loadType"], countDoc: s.countDoc, countActual: s.countActual, netKgDoc: s.netKgDoc.toNumber(), netKgActual: s.netKgActual.toNumber(), lots: s.lots.map(l => ({ lotNumber: l.lotNumber, qty: l.qty })), costPerKg: s.costPerKg.toNumber(), totalCost: s.costPerKg.toNumber() * s.netKgActual.toNumber(), dateMode: s.dateMode as Shipment["dateMode"], prodFrom: s.prodFrom, prodTo: s.prodTo ?? undefined, expFrom: s.expFrom, expTo: s.expTo ?? undefined, entryDate: s.entryDate, soldKg: sold.get(s.id)?.kg ?? 0, soldCount: sold.get(s.id)?.count ?? 0 })),
    drafts: drafts.map(d => ({ id: d.id, productId: d.productId, data: d.data as Draft["data"], savedAt: d.savedAt.toISOString() })),
    sales: sales.map(s => { const lines = s.lines.map(l => ({ productId: l.shipment.productId, shipmentId: l.shipmentId, method: l.method as Sale["lines"][number]["method"], qty: l.qty, kg: l.kg.toNumber(), pricePerKg: l.pricePerKg.toNumber(), total: l.kg.toNumber() * l.pricePerKg.toNumber(), weights: Array.isArray(l.weights) ? l.weights as number[] : undefined, fixedKg: num(l.fixedKg) })); return { id: s.id, clientId: s.clientId, date: s.date, lines, totalKg: lines.reduce((n, l) => n + l.kg, 0), totalValue: lines.reduce((n, l) => n + l.total, 0) }; }),
    thresholds: settings ? { expiryDays: settings.expiryDays, lowShipmentCount: settings.lowShipmentCount, lowProductKg: settings.lowProductKg as Record<string, number> } : { expiryDays: 60, lowShipmentCount: 5, lowProductKg: {} },
  };
}
