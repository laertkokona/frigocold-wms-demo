export type WeightType = "VARIABLE" | "FIXED" | "PALLET";
export type LoadType = "CARTON" | "PALLET";
export type DateMode = "FIXED" | "RANGE";
/** RETURN only appears on synthetic credit lines built from client returns (negative kg and value). */
export type SaleMethod = "FIXED" | "VARIABLE" | "PALLET" | "TOTAL" | "RETURN";

/** A product category (e.g. "Kofshë pule"). Weight spec lives on each load (Shipment). weightType/fixedKg/origin are legacy defaults. */
export interface Product { id: string; name: string; weightType?: WeightType; fixedKg?: number; origin?: string; }
export interface Supplier { id: string; name: string; country: string; contact?: string; phone?: string; }
export interface Client { id: string; name: string; city: string; contact?: string; phone?: string; }
export interface LotAlloc { lotNumber: string; qty: number; }

export interface Shipment {
  id: string;
  productId: string;
  supplierId: string | null;
  orderNr: string | null;
  loadType: LoadType;
  countDoc: number | null;
  countActual: number | null;
  netKgDoc: number | null;
  netKgActual: number;
  lots: LotAlloc[];
  costPerKg: number | null; // Unknown purchase cost is never treated as zero.
  totalCost: number | null;
  dateMode: DateMode;
  prodFrom: string;       // ISO
  prodTo?: string;
  expFrom: string;        // ISO — earliest expiry drives alerts/FEFO
  expTo?: string;
  entryDate: string;      // ISO — prefilled with today, editable by the user
  fixedKg?: number;       // set → cartons all weigh this much; unset carton load → variable weights
  origin?: string;        // country / plant of this load
  specs?: string;         // free text: brand, cut, calibre, packaging…
  soldKg: number;
  soldCount: number;
  adjustedKg?: number;    // recorded shortages (kg written off)
  adjustedCount?: number;
  /** Set when this load is goods a client returned: the sale line it came from and the credit given. */
  returnOf?: { lineId: string; saleId: string; clientId: string; shipmentId: string; saleDate: string; reason: string; pricePerKg: number };
}

export type ShortageReason = "SUPPLIER" | "COUNT" | "UNRECORDED_SALE" | "DAMAGED" | "OTHER";
export interface StockAdjustment { id: string; shipmentId: string; kg: number; qty: number | null; reason: ShortageReason; note?: string; date: string; }

export interface Draft {
  id: string;
  savedAt: string;
  productId: string;
  data: Partial<Omit<Shipment, "id" | "soldKg" | "soldCount" | "adjustedKg" | "adjustedCount" | "returnOf">>;
}

export interface SaleLine {
  lineId?: string;
  productId: string;
  shipmentId: string;
  method: SaleMethod;
  qty: number | null;
  kg: number;
  pricePerKg: number;
  total: number;
  weights?: number[];
  fixedKg?: number;
}
/** isReturn: a client credit built from a return (negative kg and value), not an order. */
export interface Sale { id: string; clientId: string; date: string; lines: SaleLine[]; totalKg: number; totalValue: number; isReturn?: boolean; }

export interface Thresholds { expiryDays: number; lowShipmentCount: number; lowProductKg: Record<string, number>; }
