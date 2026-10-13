import type { Shipment } from "./types";

export const remainingKg = (s: Shipment) => Math.max(0, +(s.netKgActual - s.soldKg - (s.adjustedKg ?? 0)).toFixed(3));
export const remainingCount = (s: Shipment) => s.countActual == null ? null : Math.max(0, s.countActual - s.soldCount - (s.adjustedCount ?? 0));

export const shipmentLabel = (s: Pick<Shipment, "id" | "lots"> & { returnOf?: Shipment["returnOf"] }) => (s.returnOf ? "Kthim · " : "") + (s.lots.length ? `Lot ${s.lots.map(l => l.lotNumber).join(", ")}` : `Ngarkesa ${s.id.slice(0, 8)}`);
/** Missing data on a load. A client return has no supplier/order/lots of its own (they live on the original load). */
export const incompleteReasons = (s: Pick<Shipment, "supplierId" | "orderNr" | "countActual" | "costPerKg" | "lots"> & { returnOf?: Shipment["returnOf"] }) => [
  !s.returnOf && !s.supplierId && "furnizuesi", !s.returnOf && !s.orderNr && "nr. i porosisë", s.countActual == null && "numri i njësive",
  s.costPerKg == null && "kostoja", !s.returnOf && !s.lots.length && "lotet",
].filter((reason): reason is string => !!reason);

/** How a load is weighed: pallets, fixed-weight cartons, or variable-weight cartons. */
export const loadWeightType = (s: Pick<Shipment, "loadType" | "fixedKg">): "PALLET" | "FIXED" | "VARIABLE" =>
  s.loadType === "PALLET" ? "PALLET" : s.fixedKg ? "FIXED" : "VARIABLE";
export const loadSpecLabel = (s: Pick<Shipment, "loadType" | "fixedKg" | "origin" | "specs">) =>
  [loadWeightType(s) === "PALLET" ? "paleta" : s.fixedKg ? `fikse ${s.fixedKg} kg/karton` : "peshë variabile", s.origin, s.specs].filter(Boolean).join(" · ");

export const SHORTAGE_LABELS: Record<import("./types").ShortageReason, string> = {
  SUPPLIER: "Furnizuesi ngarkoi më pak", COUNT: "Gabim në numërim", UNRECORDED_SALE: "Shitje e paregjistruar",
  DAMAGED: "I dëmtuar / i prishur", OTHER: "Tjetër",
};
