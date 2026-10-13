import type { Client, Product, Sale, Shipment, Thresholds } from "./types";
import { daysUntil, todayInTirane } from "./utils";
import { remainingCount, remainingKg, shipmentLabel } from "./stock";
import { econOf } from "./accounting";
import { inventoryCosts, sumCosts } from "./costs";

export interface Alert { level: "danger" | "warn"; title: string; detail: string; href: string; }

export function computeAlerts(shipments: Shipment[], products: Product[], t: Thresholds): Alert[] {
  const out: Alert[] = [];
  const pname = (id: string) => products.find(p => p.id === id)?.name ?? id;
  for (const s of shipments) {
    const rem = remainingKg(s); if (rem <= 0) continue;
    const d = daysUntil(s.expFrom);
    if (d <= t.expiryDays) out.push({ level: d <= 30 ? "danger" : "warn", title: `${shipmentLabel(s)} · ${pname(s.productId)} — ${d <= 0 ? "ka skaduar" : `skadon për ${d} ditë`}`, detail: `${rem.toFixed(1)} kg mbeten — shit i pari`, href: `/inventari/${s.id}` });
    const count = remainingCount(s);
    if (s.loadType === "CARTON" && count != null && count > 0 && count <= t.lowShipmentCount)
      out.push({ level: "warn", title: `${shipmentLabel(s)} · ${pname(s.productId)} — sasi e ulët e lotit`, detail: `Vetëm ${remainingCount(s)} kartona mbeten nga ky lot`, href: `/inventari/${s.id}` });
  }
  for (const p of products) {
    const min = t.lowProductKg[p.id]; if (!min) continue;
    const kg = shipments.filter(s => s.productId === p.id).reduce((a, s) => a + remainingKg(s), 0);
    if (kg < min) out.push({ level: "warn", title: `${p.name} — sasi e ulët e stokut`, detail: `${kg.toFixed(0)} kg totale (pragu ${min} kg)`, href: `/inventari` });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "danger" ? -1 : 1));
}

export function stockByProduct(shipments: Shipment[], products: Product[]) {
  return products.map(p => {
    const sh = shipments.filter(s => s.productId === p.id && remainingKg(s) > 0);
    const kg = sh.reduce((a, s) => a + remainingKg(s), 0);
    const valuation = inventoryCosts(sh);
    const count = sumCosts(sh.map(s => remainingCount(s)));
    const earliest = sh.length ? Math.min(...sh.map(s => daysUntil(s.expFrom))) : Infinity;
    return { product: p, kg, ...valuation, count, shipments: sh.length, earliestDays: earliest };
  }).sort((a, b) => b.kg - a.kg);
}

export function monthKey(iso: string) { return iso.slice(0, 7); }
export function lastMonths(n: number) {
  const out: string[] = []; const d = new Date(todayInTirane());
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); }
  return out;
}
export const monthLabel = (k: string) => ["Jan","Shk","Mar","Pri","Maj","Qer","Kor","Gus","Sht","Tet","Nën","Dhj"][+k.slice(5) - 1];

export function flows(shipments: Shipment[], sales: Sale[], months: string[]) {
  return months.map(m => ({
    m, label: monthLabel(m),
    inKg: shipments.filter(s => monthKey(s.entryDate) === m).reduce((a, s) => a + s.netKgActual, 0),
    outKg: sales.filter(s => monthKey(s.date) === m).reduce((a, s) => a + s.totalKg, 0),
    revenue: sales.filter(s => monthKey(s.date) === m).reduce((a, s) => a + s.totalValue, 0),
    cost: sumCosts(shipments.filter(s => monthKey(s.entryDate) === m).map(s => s.totalCost)),
  }));
}

export function clientStats(clients: Client[], sales: Sale[]) {
  const cur = monthKey(todayInTirane()); const prev = lastMonths(2)[0];
  return clients.map(c => {
    const all = sales.filter(s => s.clientId === c.id);
    const kgCur = all.filter(s => monthKey(s.date) === cur).reduce((a, s) => a + s.totalKg, 0);
    const kgPrev = all.filter(s => monthKey(s.date) === prev).reduce((a, s) => a + s.totalKg, 0);
    const valCur = all.filter(s => monthKey(s.date) === cur).reduce((a, s) => a + s.totalValue, 0);
    const last = all.map(s => s.date).sort().at(-1);
    const daysSince = last ? -daysUntil(last) : Infinity;
    return { client: c, orders: all.length, kgAll: all.reduce((a, s) => a + s.totalKg, 0), valueAll: all.reduce((a, s) => a + s.totalValue, 0), kgCur, kgPrev, valCur, delta: kgPrev ? (kgCur - kgPrev) / kgPrev : (kgCur ? 1 : 0), last, daysSince };
  }).sort((a, b) => b.valCur - a.valCur);
}

export function productProfit(products: Product[], shipments: Shipment[], sales: Sale[]) {
  return products.map(p => {
    const lines = sales.flatMap(s => s.lines.filter(l => l.productId === p.id).map(l => ({ ...l, date: s.date })));
    const kg = lines.reduce((a, l) => a + l.kg, 0);
    const revenue = lines.reduce((a, l) => a + l.total, 0);
    const economics = econOf(lines, shipments);
    const cur = monthKey(todayInTirane()), prev = lastMonths(2)[0];
    const kgCur = lines.filter(l => monthKey(l.date) === cur).reduce((a, l) => a + l.kg, 0);
    const kgPrev = lines.filter(l => monthKey(l.date) === prev).reduce((a, l) => a + l.kg, 0);
    return { product: p, kg, revenue, cost: economics.cogs, profit: economics.profit, margin: economics.margin, missingCostKg: economics.missingCostKg, kgCur, kgPrev, delta: kgPrev ? (kgCur - kgPrev) / kgPrev : (kgCur ? 1 : 0) };
  }).sort((a, b) => b.revenue - a.revenue);
}

export function daysOnHand(p: Product, shipments: Shipment[], sales: Sale[]) {
  const sh = shipments.filter(s => s.productId === p.id);
  const stock = sh.reduce((a, s) => a + remainingKg(s), 0);
  // Sales rate over the last 90 days, or over the days since this product's first load if that is shorter,
  // so a short history (e.g. right after go-live) is not averaged over 90 days.
  const today = new Date(todayInTirane()), first = sh.reduce((m, s) => (s.entryDate < m ? s.entryDate : m), todayInTirane());
  const windowDays = Math.min(90, Math.max(1, Math.round((today.getTime() - new Date(first).getTime()) / 86400000) + 1));
  const since = new Date(today); since.setDate(since.getDate() - windowDays + 1);
  const outKg = sales.filter(s => new Date(s.date) >= since).flatMap(s => s.lines).filter(l => l.productId === p.id).reduce((a, l) => a + l.kg, 0);
  const perDay = outKg / windowDays;
  return perDay > 0 ? Math.round(stock / perDay) : null;
}

export function fefoOrder(shipments: Shipment[], productId: string) {
  return shipments.filter(s => s.productId === productId && remainingKg(s) > 0).sort((a, b) => a.expFrom.localeCompare(b.expFrom));
}
