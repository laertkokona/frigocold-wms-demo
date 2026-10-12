import type { Shipment } from "./types";
import { remainingKg } from "./stock";

/** A total is unknown if any contributing value is unknown. Empty totals are zero. */
export function sumCosts(values: (number | null)[]): number | null {
  return values.some(value => value == null) ? null : values.reduce<number>((total, value) => total + value!, 0);
}

export function inventoryCosts(shipments: Shipment[]) {
  const active = shipments.filter(s => remainingKg(s) > 0);
  const missingCostKg = active.filter(s => s.costPerKg == null).reduce((a, s) => a + remainingKg(s), 0);
  const knownValue = active.reduce((a, s) => a + (s.costPerKg == null ? 0 : remainingKg(s) * s.costPerKg), 0);
  return { value: missingCostKg > 0 ? null : knownValue, knownValue, missingCostKg };
}
