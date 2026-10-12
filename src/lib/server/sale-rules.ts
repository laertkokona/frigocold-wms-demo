export class StockError extends Error {}
export type SaleInputLine = { shipmentId: string; method: "FIXED" | "VARIABLE" | "PALLET" | "TOTAL"; qty: number | null; kg: number; weights?: number[]; fixedKg?: number };
export type StockBalance = { kg: number; qty: number | null };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function requiredStock(lines: SaleInputLine[]) {
  const required = new Map<string, StockBalance>();
  for (const l of lines) {
    if (l.method !== "TOTAL" && l.qty == null) throw new StockError("Unit count is required for this weighing method");
    if (l.weights && (l.weights.length !== l.qty || Math.abs(round3(l.weights.reduce((n, w) => n + w, 0)) - l.kg) > 0.001)) throw new StockError("Individual weights do not match line total");
    if ((l.method === "VARIABLE" || l.method === "PALLET") && !l.weights) throw new StockError("Individual weights are required");
    // TOTAL: entered from a paper receipt — unit count + total kg only, no individual weights.
    if (l.method === "TOTAL" && (l.weights || l.fixedKg)) throw new StockError("Receipt totals must not include individual weights");
    if (l.method === "FIXED" && (!l.fixedKg || Math.abs(round3(l.fixedKg * l.qty!) - l.kg) > 0.001)) throw new StockError("Fixed weight does not match line total");
    const prev = required.get(l.shipmentId) ?? { kg: 0, qty: 0 };
    required.set(l.shipmentId, { kg: round3(prev.kg + l.kg), qty: prev.qty == null || l.qty == null ? null : prev.qty + l.qty });
  }
  return required;
}

/** A sale may be dated in the past (registered later from a receipt), but not in the future
 *  and not before the goods it draws from were received. Dates are ISO yyyy-mm-dd strings. */
export function assertSaleDate(date: string, today: string, entryDates: string[]) {
  if (date > today) throw new StockError("Sale date cannot be in the future");
  const latest = entryDates.reduce((m, d) => (d > m ? d : m), "");
  if (latest && date < latest) throw new StockError("Sale date is before the goods were received");
}

export function assertAvailable(required: Map<string, StockBalance>, balance: Map<string, StockBalance>) {
  for (const [shipmentId, amount] of required) {
    const available = balance.get(shipmentId);
    if (!available || amount.kg > available.kg + 0.0001) throw new StockError("Insufficient stock");
    if (available.qty != null) {
      if (amount.qty == null) throw new StockError("Unit count is required for stock with a known count");
      if (amount.qty > available.qty) throw new StockError("Insufficient stock");
    }
  }
}
