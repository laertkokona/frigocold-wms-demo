import assert from "node:assert/strict";
import test from "node:test";
import { salesByMonth } from "../accounting";
import type { Product, Sale, Shipment } from "../types";
import { todayInTirane } from "../utils";

const product: Product = { id: "p1", name: "Kofshe" };
const load: Shipment = {
  id: "s1", productId: "p1", supplierId: null, orderNr: null, loadType: "CARTON", countDoc: null, countActual: null,
  netKgDoc: null, netKgActual: 1000, lots: [], costPerKg: 2, totalCost: 2000, dateMode: "FIXED", prodFrom: "",
  expFrom: "2028-01-01", entryDate: "2026-01-01", soldKg: 0, soldCount: 0,
};
const line = (kg: number, price: number, method: "TOTAL" | "RETURN" = "TOTAL") => ({ productId: "p1", shipmentId: "s1", method, qty: null, kg, pricePerKg: price, total: kg * price });
const sale = (id: string, date: string, lines: ReturnType<typeof line>[], isReturn = false): Sale => ({ id, clientId: "c1", date, lines, totalKg: lines.reduce((a, l) => a + l.kg, 0), totalValue: lines.reduce((a, l) => a + l.total, 0), ...(isReturn ? { isReturn } : {}) });

test("salesByMonth lists every month from the first sale, newest first, with returns shown apart", () => {
  const [y, m] = todayInTirane().split("-").map(Number);
  const back = (n: number) => { const d = new Date(y, m - 1 - n, 15); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-15`; };
  const rows = salesByMonth([
    sale("a", back(2), [line(100, 5)]),
    sale("b", back(0), [line(40, 5), line(10, 6)]),
    sale("r", back(0), [line(-5, 5, "RETURN")], true),
  ], [load], [product]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].m, back(0).slice(0, 7));
  assert.equal(rows[0].orders, 1);
  assert.equal(rows[0].kg, 50);
  assert.equal(rows[0].returnsKg, 5);
  assert.equal(rows[0].revenue, 40 * 5 + 10 * 6 - 25);
  assert.equal(rows[0].profit, rows[0].revenue - 45 * 2);
  assert.deepEqual(rows[0].products.map(p => [p.name, p.kg, p.returnsKg]), [["Kofshe", 50, 5]]);
  assert.equal(rows[1].kg, 0);
  assert.equal(rows[1].products.length, 0);
  assert.equal(rows[2].kg, 100);
});
