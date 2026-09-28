export class StockError extends Error {}
export type SaleInputLine = { shipmentId: string; method: "FIXED" | "VARIABLE" | "PALLET"; qty: number; kg: number; weights?: number[]; fixedKg?: number };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function requiredStock(lines: SaleInputLine[]) {
  const required = new Map<string, { kg: number; qty: number }>();
  for (const l of lines) {
    if (l.weights && (l.weights.length !== l.qty || Math.abs(round3(l.weights.reduce((n, w) => n + w, 0)) - l.kg) > 0.001)) throw new StockError("Individual weights do not match line total");
    if ((l.method === "VARIABLE" || l.method === "PALLET") && !l.weights) throw new StockError("Individual weights are required");
    if (l.method === "FIXED" && (!l.fixedKg || Math.abs(round3(l.fixedKg * l.qty) - l.kg) > 0.001)) throw new StockError("Fixed weight does not match line total");
    const prev = required.get(l.shipmentId) ?? { kg: 0, qty: 0 };
    required.set(l.shipmentId, { kg: round3(prev.kg + l.kg), qty: prev.qty + l.qty });
  }
  return required;
}

export function assertAvailable(required: Map<string, { kg: number; qty: number }>, balance: Map<string, { kg: number; qty: number }>) {
  for (const [shipmentId, amount] of required) {
    const available = balance.get(shipmentId);
    if (!available || amount.kg > available.kg + 0.0001 || amount.qty > available.qty) throw new StockError("Insufficient stock");
  }
}
