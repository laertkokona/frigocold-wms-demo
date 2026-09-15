export type WeightType = "VARIABLE" | "FIXED" | "PALLET";
export type LoadType = "CARTON" | "PALLET";
export type DateMode = "FIXED" | "RANGE";
export type SaleMethod = "FIXED" | "VARIABLE" | "PALLET";

export interface Product { id: string; name: string; weightType: WeightType; fixedKg?: number; origin?: string; }
export interface Supplier { id: string; name: string; country: string; }
export interface Client { id: string; name: string; city: string; contact?: string; phone?: string; }
export interface LotAlloc { lotNumber: string; qty: number; }

export interface Shipment {
  id: string;
  productId: string;
  supplierId: string;
  orderNr: string;
  loadType: LoadType;
  countDoc: number;
  countActual: number;
  netKgDoc: number;
  netKgActual: number;
  lots: LotAlloc[];
  costPerKg: number;      // Lek, canonical
  totalCost: number;      // Lek
  dateMode: DateMode;
  prodFrom: string;       // ISO
  prodTo?: string;
  expFrom: string;        // ISO — earliest expiry drives alerts/FEFO
  expTo?: string;
  entryDate: string;      // ISO — prefilled with today, editable by the user
  soldKg: number;
  soldCount: number;
}

export interface Draft {
  id: string;
  savedAt: string;
  productId: string;
  data: Partial<Omit<Shipment, "id" | "soldKg" | "soldCount">>;
}

export interface SaleLine {
  productId: string;
  shipmentId: string;
  method: SaleMethod;
  qty: number;
  kg: number;
  pricePerKg: number;
  total: number;
  weights?: number[];
  fixedKg?: number;
}
export interface Sale { id: string; clientId: string; date: string; lines: SaleLine[]; totalKg: number; totalValue: number; }

export interface Thresholds { expiryDays: number; lowShipmentCount: number; lowProductKg: Record<string, number>; }
