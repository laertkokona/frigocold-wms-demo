import type { Shipment } from "./types";

export const remainingKg = (s: Shipment) => Math.max(0, +(s.netKgActual - s.soldKg).toFixed(3));
export const remainingCount = (s: Shipment) => s.countActual == null ? null : Math.max(0, s.countActual - s.soldCount);

export const shipmentLabel = (s: Pick<Shipment, "id" | "lots">) => s.lots.length ? `Lot ${s.lots.map(l => l.lotNumber).join(", ")}` : `Ngarkesa ${s.id.slice(0, 8)}`;
export const incompleteReasons = (s: Pick<Shipment, "supplierId" | "orderNr" | "countActual" | "costPerKg" | "lots">) => [
  !s.supplierId && "furnizuesi", !s.orderNr && "nr. i porosisë", s.countActual == null && "numri i njësive",
  s.costPerKg == null && "kostoja", !s.lots.length && "lotet",
].filter((reason): reason is string => !!reason);

/** How a load is weighed: pallets, fixed-weight cartons, or variable-weight cartons. */
export const loadWeightType = (s: Pick<Shipment, "loadType" | "fixedKg">): "PALLET" | "FIXED" | "VARIABLE" =>
  s.loadType === "PALLET" ? "PALLET" : s.fixedKg ? "FIXED" : "VARIABLE";
export const loadSpecLabel = (s: Pick<Shipment, "loadType" | "fixedKg" | "origin" | "specs">) =>
  [loadWeightType(s) === "PALLET" ? "paleta" : s.fixedKg ? `fikse ${s.fixedKg} kg/karton` : "peshë variabile", s.origin, s.specs].filter(Boolean).join(" · ");
