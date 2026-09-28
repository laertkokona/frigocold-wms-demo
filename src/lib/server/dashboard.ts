import { clientStats, computeAlerts, daysOnHand, flows, lastMonths, productProfit, stockByProduct, monthKey } from "@/lib/calc";
import { daysUntil } from "@/lib/utils";
import { remainingCount, remainingKg } from "@/lib/stock";
import { getState } from "./state";

export async function getDashboard() {
  const { shipments, products, sales, clients, suppliers, thresholds } = await getState();
  const alerts = computeAlerts(shipments, products, thresholds);
  const allStock = stockByProduct(shipments, products);
  const months = lastMonths(6);
  const fl = flows(shipments, sales, months);
  const allClients = clientStats(clients, sales);
  const allProducts = productProfit(products, shipments, sales);
  const risk = shipments.filter(s => remainingKg(s) > 0 && daysUntil(s.expFrom) <= thresholds.expiryDays);
  const allChurn = allClients.filter(c => c.orders > 0 && c.daysSince > 30);
  const allTurnover = products.map(p => ({ product: p, days: daysOnHand(p, shipments, sales) }));
  const sortedTurnover = allTurnover.filter(x => x.days !== null).sort((a, b) => a.days! - b.days!);
  const expiring = [...shipments].filter(s => remainingKg(s) > 0).sort((a, b) => a.expFrom.localeCompare(b.expFrom)).slice(0, 6).map(s => ({
    id: s.id, lot: s.lots[0]?.lotNumber ?? "", product: products.find(p => p.id === s.productId)?.name ?? "", supplier: suppliers.find(x => x.id === s.supplierId)?.name ?? "",
    expFrom: s.expFrom, loadType: s.loadType, remainingCount: remainingCount(s), remainingKg: remainingKg(s),
  }));
  const supplierPerformance = suppliers.flatMap(sp => {
    const sh = shipments.filter(s => s.supplierId === sp.id);
    if (!sh.length) return [];
    const kg = sh.reduce((a, s) => a + s.netKgActual, 0);
    const docKg = sh.reduce((a, s) => a + s.netKgDoc, 0);
    return [{ id: sp.id, name: sp.name, country: sp.country, count: sh.length, kg,
      cost: sh.reduce((a, s) => a + s.totalCost, 0) / kg,
      life: Math.round(sh.reduce((a, s) => a + (new Date(s.expFrom).getTime() - new Date(s.entryDate).getTime()) / 86400000, 0) / sh.length / 30),
      discPct: docKg ? sh.reduce((a, s) => a + Math.abs(s.netKgDoc - s.netKgActual), 0) / docKg * 100 : 0,
    }];
  });
  return {
    alerts: alerts.slice(0, 3), stock: allStock.slice(0, 10), fl,
    cs: allClients.slice(0, 10), pp: allProducts.slice(0, 10), churn: allChurn.slice(0, 10),
    turnover: allTurnover.slice(0, 10), fastest: sortedTurnover[0] ?? null, slowest: sortedTurnover.at(-1) ?? null,
    mostProfitable: [...allProducts].sort((a, b) => b.profit - a.profit)[0] ?? null,
    expiring, supplierPerformance: supplierPerformance.sort((a, b) => b.kg - a.kg).slice(0, 10),
    clientCount: clients.length, activeClientCount: allClients.filter(c => c.orders > 0).length, churnCount: allChurn.length,
    totalKg: allStock.reduce((a, s) => a + s.kg, 0), totalVal: allStock.reduce((a, s) => a + s.value, 0),
    riskKg: risk.reduce((a, s) => a + remainingKg(s), 0), riskVal: risk.reduce((a, s) => a + remainingKg(s) * s.costPerKg, 0),
    expiryBuckets: [[0, 60], [60, 180], [180, 365], [365, 99999]].map(([a, b]) => shipments.filter(s => remainingKg(s) > 0 && daysUntil(s.expFrom) >= a && daysUntil(s.expFrom) < b).reduce((n, s) => n + remainingKg(s), 0)),
    profitMonth: sales.filter(s => monthKey(s.date) === months[5]).flatMap(s => s.lines).reduce((a, l) => a + l.kg * (l.pricePerKg - (shipments.find(x => x.id === l.shipmentId)?.costPerKg ?? 0)), 0),
    concentration: allClients.slice(0, 2).reduce((a, c) => a + c.valCur, 0) / Math.max(1, allClients.reduce((a, c) => a + c.valCur, 0)),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
