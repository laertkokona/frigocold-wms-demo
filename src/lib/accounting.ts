import type { Client, Product, Sale, SaleLine, Shipment, StockAdjustment, Supplier, Thresholds } from "./types";
import { remainingKg } from "./stock";
import { daysUntil, todayInTirane } from "./utils";
import { inventoryCosts, sumCosts } from "./costs";

/* ---------- period ---------- */
export type PeriodKey = "month" | "quarter" | "year" | "all";
export interface Period { key: PeriodKey; from: string; to: string; label: string; prevFrom: string; prevTo: string; prevLabel: string; }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MONTHS = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];

export function buildPeriod(key: PeriodKey): Period {
  const [y, month] = todayInTirane().split("-").map(Number), m = month - 1;
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
export interface Econ { kg: number; revenue: number; cogs: number | null; profit: number | null; margin: number | null; missingCostKg: number; }

export const costOf = (l: SaleLine, shipments: Shipment[]): number | null => {
  const cost = shipments.find(s => s.id === l.shipmentId)?.costPerKg;
  return cost == null ? null : l.kg * cost;
};

export function linesIn(sales: Sale[], from: string, to: string) {
  return sales.filter(s => inRange(s.date, from, to)).flatMap(s => s.lines.map(l => ({ ...l, date: s.date, clientId: s.clientId, saleId: s.id })));
}
export function econOf(lines: (SaleLine & { date: string })[], shipments: Shipment[]): Econ {
  const kg = lines.reduce((a, l) => a + l.kg, 0), revenue = lines.reduce((a, l) => a + l.total, 0);
  const costs = lines.map(l => costOf(l, shipments));
  const cogs = sumCosts(costs), profit = cogs == null ? null : revenue - cogs;
  const missingCostKg = lines.reduce((a, l, i) => a + (costs[i] == null ? l.kg : 0), 0);
  return { kg, revenue, cogs, profit, margin: profit == null ? null : revenue ? profit / revenue : 0, missingCostKg };
}

/* ---------- headline ---------- */
export interface Losses { kg: number; value: number | null; knownValue: number; missingCostKg: number; count: number; }
/** Stock written off as missing in the period, valued at each load's cost. Unknown cost is never treated as zero. */
export function lossesIn(adjustments: StockAdjustment[], shipments: Shipment[], from: string, to: string): Losses {
  const rows = adjustments.filter(a => inRange(a.date, from, to)).map(a => { const cost = shipments.find(s => s.id === a.shipmentId)?.costPerKg; return { kg: a.kg, value: cost == null ? null : a.kg * cost }; });
  const knownValue = rows.reduce((n, r) => n + (r.value ?? 0), 0), missingCostKg = rows.reduce((n, r) => n + (r.value == null ? r.kg : 0), 0);
  return { kg: rows.reduce((n, r) => n + r.kg, 0), value: missingCostKg > 0 ? null : knownValue, knownValue, missingCostKg, count: rows.length };
}

export interface Headline extends Econ { losses: Losses; returnsKg: number; returnsValue: number; purchaseSpend: number | null; inventoryValue: number | null; knownInventoryValue: number; missingInventoryCostKg: number; orders: number; }
export function headline(sales: Sale[], shipments: Shipment[], from: string, to: string, adjustments: StockAdjustment[] = []): Headline {
  const e = econOf(linesIn(sales, from, to), shipments);
  const credits = sales.filter(s => s.isReturn && inRange(s.date, from, to));
  return {
    ...e,
    losses: lossesIn(adjustments, shipments, from, to),
    returnsKg: -credits.reduce((n, s) => n + s.totalKg, 0), returnsValue: -credits.reduce((n, s) => n + s.totalValue, 0),
    // Client returns come back as loads but were not bought, so they are not purchases.
    purchaseSpend: sumCosts(shipments.filter(s => !s.returnOf && inRange(s.entryDate, from, to)).map(s => s.totalCost)),
    inventoryValue: inventoryCosts(shipments).value,
    knownInventoryValue: inventoryCosts(shipments).knownValue,
    missingInventoryCostKg: inventoryCosts(shipments).missingCostKg,
    orders: sales.filter(s => !s.isReturn && inRange(s.date, from, to)).length,
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
  const [year, month] = todayInTirane().split("-").map(Number), t = new Date(year, month - 1, 1), out: string[] = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(t.getFullYear(), t.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  return out;
}
export const mLabel = (k: string) => ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"][+k.slice(5) - 1];

export function monthlyEcon(sales: Sale[], shipments: Shipment[], months: string[]) {
  return months.map(m => {
    const e = econOf(sales.filter(s => s.date.slice(0, 7) === m).flatMap(s => s.lines.map(l => ({ ...l, date: s.date }))), shipments);
    return { m, label: mLabel(m), ...e, spend: sumCosts(shipments.filter(s => !s.returnOf && s.entryDate.slice(0, 7) === m).map(s => s.totalCost)) };
  });
}

/* ---------- products ---------- */
export interface ProductRow extends Econ { product: Product; avgSell: number; avgCost: number | null; spread: number | null; profitShare: number | null; prevKg: number; prevRevenue: number; prevMargin: number | null; }
export function productRows(products: Product[], sales: Sale[], shipments: Shipment[], p: Period): ProductRow[] {
  const cur = linesIn(sales, p.from, p.to), prev = linesIn(sales, p.prevFrom, p.prevTo);
  const totalProfit = econOf(cur, shipments).profit;
  return products.map(pr => {
    const cl = cur.filter(l => l.productId === pr.id), pl = prev.filter(l => l.productId === pr.id);
    const e = econOf(cl, shipments), pe = econOf(pl, shipments);
    return { product: pr, ...e, avgSell: e.kg ? e.revenue / e.kg : 0, avgCost: e.cogs == null ? null : e.kg ? e.cogs / e.kg : 0, spread: e.profit == null ? null : e.kg ? e.profit / e.kg : 0, profitShare: totalProfit == null || e.profit == null ? null : totalProfit ? e.profit / totalProfit : 0, prevKg: pe.kg, prevRevenue: pe.revenue, prevMargin: pe.margin };
  }).filter(r => r.kg > 0 || r.prevKg > 0).sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
}

/** Monthly avg selling price vs avg cost per kg, for one product. */
export function priceSeries(productId: string, sales: Sale[], shipments: Shipment[], months: string[]) {
  return months.map(m => {
    const ls = sales.filter(s => s.date.slice(0, 7) === m).flatMap(s => s.lines).filter(l => l.productId === productId && l.method !== "RETURN");
    const kg = ls.reduce((a, l) => a + l.kg, 0);
    const rev = ls.reduce((a, l) => a + l.total, 0);
    const cost = sumCosts(ls.map(l => costOf(l, shipments)));
    return { m, label: mLabel(m), kg, sell: kg ? rev / kg : null, cost: kg && cost != null ? cost / kg : null };
  });
}

/* ---------- clients ---------- */
export interface ClientRow extends Econ { client: Client; orders: number; avgPrice: number; profitShare: number | null; }
export function clientRows(clients: Client[], sales: Sale[], shipments: Shipment[], p: Period): ClientRow[] {
  const cur = linesIn(sales, p.from, p.to);
  const totalProfit = econOf(cur, shipments).profit;
  return clients.map(c => {
    const ls = cur.filter(l => l.clientId === c.id);
    const e = econOf(ls, shipments);
    return { client: c, ...e, orders: new Set(ls.filter(l => l.method !== "RETURN").map(l => l.saleId)).size, avgPrice: e.kg ? e.revenue / e.kg : 0, profitShare: totalProfit == null || e.profit == null ? null : totalProfit ? e.profit / totalProfit : 0 };
  }).filter(r => r.kg > 0).sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
}

/** What each client paid per kg for one product in the period — price dispersion. */
export function priceDispersion(productId: string, clients: Client[], sales: Sale[], p: Period) {
  const cur = linesIn(sales, p.from, p.to).filter(l => l.productId === productId && l.method !== "RETURN");
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
export interface SupplierRow { supplier: Supplier; shipments: number; kgBought: number; spend: number | null; avgCost: number | null; shortfallKg: number | null; shortfallLek: number | null; realised: Econ; }
export function supplierRows(suppliers: Supplier[], shipments: Shipment[], sales: Sale[], p: Period): SupplierRow[] {
  return suppliers.map(sp => {
    const sh = shipments.filter(s => s.supplierId === sp.id && inRange(s.entryDate, p.from, p.to));
    const all = shipments.filter(s => s.supplierId === sp.id);
    const kgBought = sh.reduce((a, s) => a + s.netKgActual, 0);
    const spend = sumCosts(sh.map(s => s.totalCost));
    const shortfallKg = sumCosts(all.map(s => s.netKgDoc == null ? null : s.netKgDoc - s.netKgActual));
    const shortfallLek = sumCosts(all.map(s => s.netKgDoc == null || s.costPerKg == null ? null : (s.netKgDoc - s.netKgActual) * s.costPerKg));
    const ids = new Set(all.map(s => s.id));
    const ls = linesIn(sales, p.from, p.to).filter(l => ids.has(l.shipmentId));
    return { supplier: sp, shipments: sh.length, kgBought, spend, avgCost: spend == null ? null : kgBought ? spend / kgBought : 0, shortfallKg, shortfallLek, realised: econOf(ls, shipments) };
  }).filter(r => r.shipments > 0 || r.realised.kg > 0).sort((a, b) => (b.spend ?? -Infinity) - (a.spend ?? -Infinity));
}

/* ---------- lots / inventory capital ---------- */
export interface LotRow { shipment: Shipment; product?: Product; supplier?: Supplier; invested: number | null; soldKg: number; revenue: number; cogsSold: number | null; realised: number | null; margin: number | null; remainKg: number; remainValue: number | null; pctSold: number; daysHeld: number; expDays: number; }
export function lotRows(shipments: Shipment[], products: Product[], suppliers: Supplier[], sales: Sale[]): LotRow[] {
  return shipments.map(s => {
    const ls = sales.flatMap(x => x.lines).filter(l => l.shipmentId === s.id);
    const revenue = ls.reduce((a, l) => a + l.total, 0);
    const soldKg = ls.reduce((a, l) => a + l.kg, 0);
    const cogsSold = soldKg === 0 ? 0 : s.costPerKg == null ? null : soldKg * s.costPerKg;
    const realised = cogsSold == null ? null : revenue - cogsSold;
    const remain = remainingKg(s);
    return {
      shipment: s, product: products.find(p => p.id === s.productId), supplier: suppliers.find(x => x.id === s.supplierId),
      invested: s.totalCost, soldKg, revenue, cogsSold, realised, margin: realised == null ? null : revenue ? realised / revenue : 0,
      remainKg: remain, remainValue: remain === 0 ? 0 : s.costPerKg == null ? null : remain * s.costPerKg, pctSold: s.netKgActual ? soldKg / s.netKgActual : 0,
      daysHeld: -daysUntil(s.entryDate), expDays: daysUntil(s.expFrom),
    };
  }).sort((a, b) => (b.remainValue ?? -Infinity) - (a.remainValue ?? -Infinity));
}

export function capitalAtRisk(shipments: Shipment[], t: Thresholds) {
  const at = shipments.filter(s => remainingKg(s) > 0 && daysUntil(s.expFrom) <= t.expiryDays);
  return { kg: at.reduce((a, s) => a + remainingKg(s), 0), ...inventoryCosts(at), lots: at.length };
}
