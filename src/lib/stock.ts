import type { Shipment } from "./types";

export const remainingKg = (s: Shipment) => Math.max(0, +(s.netKgActual - s.soldKg).toFixed(3));
export const remainingCount = (s: Shipment) => Math.max(0, s.countActual - s.soldCount);

/** How a load is weighed: pallets, fixed-weight cartons, or variable-weight cartons. */
export const loadWeightType = (s: Pick<Shipment, "loadType" | "fixedKg">): "PALLET" | "FIXED" | "VARIABLE" =>
  s.loadType === "PALLET" ? "PALLET" : s.fixedKg ? "FIXED" : "VARIABLE";
export const loadSpecLabel = (s: Pick<Shipment, "loadType" | "fixedKg" | "origin" | "specs">) =>
  [loadWeightType(s) === "PALLET" ? "paleta" : s.fixedKg ? `fikse ${s.fixedKg} kg/karton` : "peshë variabile", s.origin, s.specs].filter(Boolean).join(" · ");
