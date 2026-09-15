import type { Client, Product, Sale, SaleLine, Shipment, Supplier, Thresholds } from "./types";
import { remainingKg } from "./store";
import { daysUntil, TODAY } from "./utils";

/* ---------- period ---------- */
export type PeriodKey = "month" | "quarter" | "year" | "all";
export interface Period { key: PeriodKey; from: string; to: string; label: string; prevFrom: string; prevTo: string; prevLabel: string; }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];

export function buildPeriod(key: PeriodKey): Period {
  const t = new Date(TODAY), y = t.getFullYear(), m = t.getMonth();
  if (key === "month") {
    const f = new Date(y, m, 1), to = new Date(y, m + 1, 0), pf = new Date(y, m - 1, 1), pt = new Date(y, m, 0);
    return { key, from: iso(f), to: iso(to), label: `${MONTHS[m]} ${y}`, prevFrom: iso(pf), prevTo: iso(pt), prevLabel: `${MONTHS[pf.getMonth()]} ${pf.getFullYear()}` };
  }
  if (key === "quarter") {
    const q = Math.floor(m / 3), f = new Date(y, q * 3, 1), to = new Date(y, q * 3 + 3, 0), pf = new Date(y, q * 3 - 3, 1), pt = new Date(y, q * 3, 0);
    return { key, from: iso(f), to: iso(to), label: `Tremujori ${q + 1} ${y}`, prevFrom: iso(pf), prevTo: iso(pt), prevLabel: `Tremujori ${((q + 3) % 4) + 1} ${pf.getFullYear()}` };
  }
  if (key === "year") {
    return { key, from: `${y}-01-01`, to: `${y}-12-31`, label: `Viti ${y}`, prevFrom: `${y - 1}-01-01`, prevTo: `${y - 1}-12-31`, prevLabel: `Viti ${y - 1}` };
  }
  return { key, from: "1970-01-01", to: "2999-12-31", label: "Gjithë periudha", prevFrom: "1970-01-01", prevTo: "1970-01-01", prevLabel: "—" };
}
const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

/* ---------- core line economics (specific-identification costing) ---------- */
export interface Econ { kg: number; revenue: number; cogs: number; profit: number; margin: number; }
const zero = (): Econ => ({ kg: 0, revenue: 0, cogs: 0, profit: 0, margin: 0 });
const seal = (e: Econ): Econ => ({ ...e, profit: e.revenue - e.cogs, margin: e.revenue ? (e.revenue - e.cogs) / e.revenue : 0 });

export const costOf = (l: SaleLine, shipments: Shipment[]) => l.kg * (shipments.find(s => s.id === l.shipmentId)?.costPerKg ?? 0);

export function linesIn(sales: Sale[], from: string, to: string) {
  return sales.filter(s => inRange(s.date, from, to)).flatMap(s => s.lines.map(l => ({ ...l, date: s.date, clientId: s.clientId, saleId: s.id })));
}
export function econOf(lines: (SaleLine & { date: string })[], shipments: Shipment[]): Econ {
  const e = zero();
  for (const l of lines) { e.kg += l.kg; e.revenue += l.total; e.cogs += costOf(l, shipments); }
  return seal(e);
}

/* ---------- headline ---------- */
export interface Headline extends Econ { purchaseSpend: number; inventoryValue: number; orders: number; }
export function headline(sales: Sale[], shipments: Shipment[], from: string, to: string): Headline {
  const e = econOf(linesIn(sales, from, to), shipments);
  return {
    ...e,
    purchaseSpend: shipments.filter(s => inRange(s.entryDate, from, to)).reduce((a, s) => a + s.totalCost, 0),
    inventoryValue: shipments.reduce((a, s) => a + remainingKg(s) * s.costPerKg, 0),
    orders: sales.filter(s => inRange(s.date, from, to)).length,
  };
}

/* ---------- monthly series ---------- */
export function monthsBetween(from: string, to: string, max = 12) {
  const a = new Date(from), b = new Date(to), out: string[] = [];
  const cur = new Date(a.getFullYear(), a.getMonth(), 1);
  while (cur <= b && out.length < 400) { out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`); cur.setMonth(cur.getMonth() + 1); }
  return out.slice(-max);
}
export function trailingMonths(n: number) {
  const t = new Date(TODAY), out: string[] = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(t.getFullYear(), t.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  return out;
}
export const mLabel = (k: string) => ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"][+k.slice(5) - 1];

export function monthlyEcon(sales: Sale[], shipments: Shipment[], months: string[]) {
  return months.map(m => {
    const e = econOf(sales.filter(s => s.date.slice(0, 7) === m).flatMap(s => s.lines.map(l => ({ ...l, date: s.date }))), shipments);
    return { m, label: mLabel(m), ...e, spend: shipments.filter(s => s.entryDate.slice(0, 7) === m).reduce((a, s) => a + s.totalCost, 0) };
  });
}

/* ---------- products ---------- */
export interface ProductRow extends Econ { product: Product; avgSell: number; avgCost: number; spread: number; profitShare: number; prevKg: number; prevRevenue: number; prevMargin: number; }
export function productRows(products: Product[], sales: Sale[], shipments: Shipment[], p: Period): ProductRow[] {
  const cur = linesIn(sales, p.from, p.to), prev = linesIn(sales, p.prevFrom, p.prevTo);
  const totalProfit = econOf(cur, shipments).profit;
  return products.map(pr => {
    const cl = cur.filter(l => l.productId === pr.id), pl = prev.filter(l => l.productId === pr.id);
    const e = econOf(cl, shipments), pe = econOf(pl, shipments);
    return { product: pr, ...e, avgSell: e.kg ? e.revenue / e.kg : 0, avgCost: e.kg ? e.cogs / e.kg : 0, spread: e.kg ? (e.revenue - e.cogs) / e.kg : 0, profitShare: totalProfit ? e.profit / totalProfit : 0, prevKg: pe.kg, prevRevenue: pe.revenue, prevMargin: pe.margin };
  }).filter(r => r.kg > 0 || r.prevKg > 0).sort((a, b) => b.profit - a.profit);
}

/** Monthly avg selling price vs avg cost per kg, for one product. */
export function priceSeries(productId: string, sales: Sale[], shipments: Shipment[], months: string[]) {
  return months.map(m => {
    const ls = sales.filter(s => s.date.slice(0, 7) === m).flatMap(s => s.lines).filter(l => l.productId === productId);
    const kg = ls.reduce((a, l) => a + l.kg, 0);
    const rev = ls.reduce((a, l) => a + l.total, 0);
    const cost = ls.reduce((a, l) => a + costOf(l, shipments), 0);
    return { m, label: mLabel(m), kg, sell: kg ? rev / kg : null, cost: kg ? cost / kg : null };
  });
}

/* ---------- clients ---------- */
export interface ClientRow extends Econ { client: Client; orders: number; avgPrice: number; profitShare: number; }
export function clientRows(clients: Client[], sales: Sale[], shipments: Shipment[], p: Period): ClientRow[] {
  const cur = linesIn(sales, p.from, p.to);
  const totalProfit = econOf(cur, shipments).profit;
  return clients.map(c => {
    const ls = cur.filter(l => l.clientId === c.id);
    const e = econOf(ls, shipments);
    return { client: c, ...e, orders: new Set(ls.map(l => l.saleId)).size, avgPrice: e.kg ? e.revenue / e.kg : 0, profitShare: totalProfit ? e.profit / totalProfit : 0 };
  }).filter(r => r.kg > 0).sort((a, b) => b.profit - a.profit);
}

/** What each client paid per kg for one product in the period — price dispersion. */
export function priceDispersion(productId: string, clients: Client[], sales: Sale[], p: Period) {
  const cur = linesIn(sales, p.from, p.to).filter(l => l.productId === productId);
  const rows = clients.map(c => {
    const ls = cur.filter(l => l.clientId === c.id);
    const kg = ls.reduce((a, l) => a + l.kg, 0);
    return { client: c, kg, avg: kg ? ls.reduce((a, l) => a + l.total, 0) / kg : 0 };
  }).filter(r => r.kg > 0).sort((a, b) => b.avg - a.avg);
  const kg = rows.reduce((a, r) => a + r.kg, 0);
  const wAvg = kg ? rows.reduce((a, r) => a + r.avg * r.kg, 0) / kg : 0;
  return { rows, wAvg, min: rows.at(-1)?.avg ?? 0, max: rows[0]?.avg ?? 0 };
}

/* ---------- suppliers ---------- */
export interface SupplierRow { supplier: Supplier; shipments: number; kgBought: number; spend: number; avgCost: number; shortfallKg: number; shortfallLek: number; realised: Econ; }
export function supplierRows(suppliers: Supplier[], shipments: Shipment[], sales: Sale[], p: Period): SupplierRow[] {
  return suppliers.map(sp => {
    const sh = shipments.filter(s => s.supplierId === sp.id && inRange(s.entryDate, p.from, p.to));
    const all = shipments.filter(s => s.supplierId === sp.id);
    const kgBought = sh.reduce((a, s) => a + s.netKgActual, 0);
    const spend = sh.reduce((a, s) => a + s.totalCost, 0);
    const shortfallKg = all.reduce((a, s) => a + (s.netKgDoc - s.netKgActual), 0);
    const shortfallLek = all.reduce((a, s) => a + (s.netKgDoc - s.netKgActual) * s.costPerKg, 0);
    const ids = new Set(all.map(s => s.id));
    const ls = linesIn(sales, p.from, p.to).filter(l => ids.has(l.shipmentId));
    return { supplier: sp, shipments: sh.length, kgBought, spend, avgCost: kgBought ? spend / kgBought : 0, shortfallKg, shortfallLek, realised: econOf(ls, shipments) };
  }).filter(r => r.shipments > 0 || r.realised.kg > 0).sort((a, b) => b.spend - a.spend);
}

/* ---------- lots / inventory capital ---------- */
export interface LotRow { shipment: Shipment; product?: Product; supplier?: Supplier; invested: number; soldKg: number; revenue: number; cogsSold: number; realised: number; margin: number; remainKg: number; remainValue: number; pctSold: number; daysHeld: number; expDays: number; }
export function lotRows(shipments: Shipment[], products: Product[], suppliers: Supplier[], sales: Sale[]): LotRow[] {
  return shipments.map(s => {
    const ls = sales.flatMap(x => x.lines).filter(l => l.shipmentId === s.id);
    const revenue = ls.reduce((a, l) => a + l.total, 0);
    const soldKg = ls.reduce((a, l) => a + l.kg, 0);
    const cogsSold = soldKg * s.costPerKg;
    const remain = remainingKg(s);
    return {
      shipment: s, product: products.find(p => p.id === s.productId), supplier: suppliers.find(x => x.id === s.supplierId),
      invested: s.totalCost, soldKg, revenue, cogsSold, realised: revenue - cogsSold, margin: revenue ? (revenue - cogsSold) / revenue : 0,
      remainKg: remain, remainValue: remain * s.costPerKg, pctSold: s.netKgActual ? soldKg / s.netKgActual : 0,
      daysHeld: -daysUntil(s.entryDate), expDays: daysUntil(s.expFrom),
    };
  }).sort((a, b) => b.remainValue - a.remainValue);
}

export function capitalAtRisk(shipments: Shipment[], t: Thresholds) {
  const at = shipments.filter(s => remainingKg(s) > 0 && daysUntil(s.expFrom) <= t.expiryDays);
  return { kg: at.reduce((a, s) => a + remainingKg(s), 0), value: at.reduce((a, s) => a + remainingKg(s) * s.costPerKg, 0), lots: at.length };
}
