import type { Shipment } from "./types";

export const remainingKg = (s: Shipment) => Math.max(0, +(s.netKgActual - s.soldKg).toFixed(3));
export const remainingCount = (s: Shipment) => Math.max(0, s.countActual - s.soldCount);
