import { buildPeriod, capitalAtRisk, clientRows, headline, lotRows, monthlyEcon, priceDispersion, priceSeries, productRows, supplierRows, trailingMonths, type PeriodKey } from "@/lib/accounting";
import { getState } from "./state";
import { sumCosts } from "@/lib/costs";

export async function getAccountingReport(period: PeriodKey, selectedProduct: string, lotPage: number) {
  const { sales, shipments, products, clients, suppliers, thresholds, adjustments } = await getState();
  const p = buildPeriod(period);
  const months = trailingMonths(8);
  const priceProd = products.some(product => product.id === selectedProduct) ? selectedProduct : products[0]?.id ?? "";
  const allLots = lotRows(shipments, products, suppliers, sales);
  const lotPageSize = 25;
  return {
    p, cur: headline(sales, shipments, p.from, p.to, adjustments), prev: headline(sales, shipments, p.prevFrom, p.prevTo, adjustments),
    missingCostShipmentCount: shipments.filter(s => s.costPerKg == null).length,
    series: monthlyEcon(sales, shipments, months),
    prods: productRows(products, sales, shipments, p),
    clis: clientRows(clients, sales, shipments, p),
    sups: supplierRows(suppliers, shipments, sales, p),
    lots: allLots.slice((lotPage - 1) * lotPageSize, lotPage * lotPageSize),
    lotPage, lotPageSize, lotsTotal: allLots.length,
    activeLotCount: allLots.filter(l => l.remainKg > 0).length,
    realizedProfit: sumCosts(allLots.map(l => l.realised)),
    risk: capitalAtRisk(shipments, thresholds), thresholds,
    products: products.map(product => ({ id: product.id, name: product.name })), priceProd,
    pSeries: priceSeries(priceProd, sales, shipments, months),
    disp: priceDispersion(priceProd, clients, sales, p),
  };
}

export type AccountingReport = Awaited<ReturnType<typeof getAccountingReport>>;
