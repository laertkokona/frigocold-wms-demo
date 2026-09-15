import type { Client, Product, Sale, Shipment, Supplier, Thresholds } from "./types";

export const products: Product[] = [
  { id: "p-lamb", name: "Kofshë qengji", weightType: "VARIABLE", origin: "Australi / Zelandë e Re" },
  { id: "p-drum", name: "Drumstick pule", weightType: "FIXED", fixedKg: 10, origin: "Spanjë" },
  { id: "p-legs", name: "Këmbë pule të plota", weightType: "FIXED", fixedKg: 15, origin: "SHBA" },
  { id: "p-pork", name: "Supë derri", weightType: "VARIABLE", origin: "Gjermani" },
  { id: "p-beef", name: "Viçi pa kockë — Forequarter", weightType: "VARIABLE", origin: "Paraguai" },
  { id: "p-carc", name: "Viçi gjysmë karkasë", weightType: "PALLET", origin: "Brazil" },
];

export const suppliers: Supplier[] = [
  { id: "s-victoria", name: "Frigorífico Victoria", country: "Paraguai" },
  { id: "s-aus", name: "AUS Meats Co.", country: "Australi" },
  { id: "s-uvesa", name: "Uvesa España", country: "Spanjë" },
  { id: "s-tyson", name: "Tyson Foods", country: "SHBA" },
  { id: "s-nz", name: "Silver Fern Farms", country: "Zelandë e Re" },
  { id: "s-de", name: "Westfleisch", country: "Gjermani" },
  { id: "s-minerva", name: "Minerva Foods", country: "Brazil" },
];

export const clients: Client[] = [
  { id: "c-albfresh", name: "Albfresh SHPK", city: "Tiranë", contact: "Arben Hoxha", phone: "+355 69 201 4411" },
  { id: "c-metro", name: "Metro Albania", city: "Tiranë", contact: "Elda Meta", phone: "+355 68 330 9012" },
  { id: "c-landi", name: "Landi i Zi", city: "Durrës", contact: "Genti Lika" },
  { id: "c-fresh", name: "FreshMart Tiranë", city: "Tiranë" },
  { id: "c-gjeli", name: "Gjeli i Artë", city: "Vlorë", contact: "Sokol Rama" },
  { id: "c-korca", name: "Mishtorja Korça", city: "Korçë" },
  { id: "c-vlora", name: "Vlora Fresh", city: "Vlorë" },
];

// Note: soldKg / soldCount are derived from `sales` by the store on load.
export const shipments: Shipment[] = [
  { id: "sh-36201", productId: "p-lamb", supplierId: "s-aus", orderNr: "4402", loadType: "CARTON", countDoc: 24, countActual: 24, netKgDoc: 432, netKgActual: 432, lots: [{ lotNumber: "36201", qty: 24 }], costPerKg: 410, totalCost: 177120, dateMode: "FIXED", prodFrom: "2025-01-14", expFrom: "2026-11-05", entryDate: "2026-03-02", soldKg: 0, soldCount: 0 },
  { id: "sh-48291", productId: "p-lamb", supplierId: "s-nz", orderNr: "4438", loadType: "CARTON", countDoc: 28, countActual: 28, netKgDoc: 560, netKgActual: 558.4, lots: [{ lotNumber: "48291", qty: 28 }], costPerKg: 395, totalCost: 220568, dateMode: "RANGE", prodFrom: "2026-03-10", prodTo: "2026-03-14", expFrom: "2027-09-10", expTo: "2027-09-14", entryDate: "2026-05-15", soldKg: 0, soldCount: 0 },
  { id: "sh-29113", productId: "p-drum", supplierId: "s-uvesa", orderNr: "4390", loadType: "CARTON", countDoc: 40, countActual: 40, netKgDoc: 400, netKgActual: 400, lots: [{ lotNumber: "29113", qty: 40 }], costPerKg: 285, totalCost: 114000, dateMode: "FIXED", prodFrom: "2025-08-20", expFrom: "2027-02-20", entryDate: "2026-02-11", soldKg: 0, soldCount: 0 },
  { id: "sh-77203", productId: "p-drum", supplierId: "s-uvesa", orderNr: "4461", loadType: "CARTON", countDoc: 120, countActual: 118, netKgDoc: 1200, netKgActual: 1180, lots: [{ lotNumber: "77203", qty: 80 }, { lotNumber: "77204", qty: 38 }], costPerKg: 290, totalCost: 342200, dateMode: "FIXED", prodFrom: "2026-03-05", expFrom: "2028-03-05", entryDate: "2026-05-23", soldKg: 0, soldCount: 0 },
  { id: "sh-tyson", productId: "p-legs", supplierId: "s-tyson", orderNr: "4455", loadType: "CARTON", countDoc: 30, countActual: 30, netKgDoc: 450, netKgActual: 450, lots: [{ lotNumber: "0506NVL20", qty: 30 }], costPerKg: 265, totalCost: 119250, dateMode: "FIXED", prodFrom: "2026-02-19", expFrom: "2028-02-19", entryDate: "2026-05-23", soldKg: 0, soldCount: 0 },
  { id: "sh-11042", productId: "p-pork", supplierId: "s-de", orderNr: "4421", loadType: "CARTON", countDoc: 20, countActual: 20, netKgDoc: 620, netKgActual: 618.5, lots: [{ lotNumber: "11042", qty: 20 }], costPerKg: 340, totalCost: 210290, dateMode: "FIXED", prodFrom: "2025-10-02", expFrom: "2027-04-02", entryDate: "2026-04-08", soldKg: 0, soldCount: 0 },
  { id: "sh-061125", productId: "p-beef", supplierId: "s-victoria", orderNr: "4471", loadType: "CARTON", countDoc: 300, countActual: 298, netKgDoc: 6120, netKgActual: 6081.6, lots: [{ lotNumber: "061125", qty: 298 }], costPerKg: 520, totalCost: 3162432, dateMode: "FIXED", prodFrom: "2025-11-06", expFrom: "2027-11-06", entryDate: "2026-09-04", soldKg: 0, soldCount: 0 },
  { id: "sh-vc880", productId: "p-carc", supplierId: "s-minerva", orderNr: "4468", loadType: "PALLET", countDoc: 12, countActual: 12, netKgDoc: 9600, netKgActual: 9584, lots: [{ lotNumber: "VC-880", qty: 12 }], costPerKg: 470, totalCost: 4504480, dateMode: "RANGE", prodFrom: "2026-05-02", prodTo: "2026-05-06", expFrom: "2027-11-02", expTo: "2027-11-06", entryDate: "2026-08-27", soldKg: 0, soldCount: 0 },
];

const v = (n: number, base: number, spread: number) => Array.from({ length: n }, (_, i) => +(base + ((i * 7919) % 100) / 100 * spread - spread / 2).toFixed(2));

export const sales: Sale[] = [
  { id: "sl-1", clientId: "c-albfresh", date: "2026-04-12", lines: [{ productId: "p-lamb", shipmentId: "sh-36201", method: "VARIABLE", qty: 8, kg: 144.6, pricePerKg: 560, total: 80976, weights: v(8, 18.07, 2) }], totalKg: 144.6, totalValue: 80976 },
  { id: "sl-2", clientId: "c-metro", date: "2026-05-04", lines: [{ productId: "p-drum", shipmentId: "sh-29113", method: "FIXED", qty: 20, kg: 200, pricePerKg: 380, total: 76000, fixedKg: 10 }], totalKg: 200, totalValue: 76000 },
  { id: "sl-3", clientId: "c-landi", date: "2026-05-22", lines: [{ productId: "p-pork", shipmentId: "sh-11042", method: "VARIABLE", qty: 5, kg: 152.3, pricePerKg: 450, total: 68535, weights: v(5, 30.46, 2) }], totalKg: 152.3, totalValue: 68535 },
  { id: "sl-4", clientId: "c-albfresh", date: "2026-06-09", lines: [{ productId: "p-drum", shipmentId: "sh-29113", method: "FIXED", qty: 16, kg: 160, pricePerKg: 385, total: 61600, fixedKg: 10 }, { productId: "p-legs", shipmentId: "sh-tyson", method: "FIXED", qty: 10, kg: 150, pricePerKg: 360, total: 54000, fixedKg: 15 }], totalKg: 310, totalValue: 115600 },
  { id: "sl-5", clientId: "c-gjeli", date: "2026-06-28", lines: [{ productId: "p-lamb", shipmentId: "sh-36201", method: "VARIABLE", qty: 4, kg: 71.8, pricePerKg: 570, total: 40926, weights: v(4, 17.95, 2) }], totalKg: 71.8, totalValue: 40926 },
  { id: "sl-6", clientId: "c-metro", date: "2026-07-15", lines: [{ productId: "p-drum", shipmentId: "sh-77203", method: "FIXED", qty: 30, kg: 300, pricePerKg: 390, total: 117000, fixedKg: 10 }], totalKg: 300, totalValue: 117000 },
  { id: "sl-7", clientId: "c-fresh", date: "2026-08-03", lines: [{ productId: "p-pork", shipmentId: "sh-11042", method: "VARIABLE", qty: 5, kg: 156.2, pricePerKg: 455, total: 71071, weights: v(5, 31.24, 2) }], totalKg: 156.2, totalValue: 71071 },
  { id: "sl-8", clientId: "c-albfresh", date: "2026-08-19", lines: [{ productId: "p-legs", shipmentId: "sh-tyson", method: "FIXED", qty: 8, kg: 120, pricePerKg: 365, total: 43800, fixedKg: 15 }, { productId: "p-drum", shipmentId: "sh-77203", method: "FIXED", qty: 20, kg: 200, pricePerKg: 390, total: 78000, fixedKg: 10 }], totalKg: 320, totalValue: 121800 },
  { id: "sl-9", clientId: "c-metro", date: "2026-09-02", lines: [{ productId: "p-carc", shipmentId: "sh-vc880", method: "PALLET", qty: 3, kg: 2398.4, pricePerKg: 610, total: 1463024, weights: [812.4, 795.6, 790.4] }], totalKg: 2398.4, totalValue: 1463024 },
  { id: "sl-10", clientId: "c-landi", date: "2026-09-09", lines: [{ productId: "p-beef", shipmentId: "sh-061125", method: "VARIABLE", qty: 12, kg: 243.6, pricePerKg: 680, total: 165648, weights: v(12, 20.3, 2) }], totalKg: 243.6, totalValue: 165648 },
  { id: "sl-11", clientId: "c-albfresh", date: "2026-09-12", lines: [{ productId: "p-lamb", shipmentId: "sh-36201", method: "VARIABLE", qty: 4, kg: 72.1, pricePerKg: 575, total: 41457.5, weights: v(4, 18.02, 2) }, { productId: "p-beef", shipmentId: "sh-061125", method: "VARIABLE", qty: 20, kg: 406.2, pricePerKg: 690, total: 280278, weights: v(20, 20.31, 2) }], totalKg: 478.3, totalValue: 321735.5 },
  { id: "sl-12", clientId: "c-vlora", date: "2026-09-14", lines: [{ productId: "p-drum", shipmentId: "sh-77203", method: "FIXED", qty: 14, kg: 140, pricePerKg: 395, total: 55300, fixedKg: 10 }], totalKg: 140, totalValue: 55300 },
];

export const thresholds: Thresholds = { expiryDays: 60, lowShipmentCount: 5, lowProductKg: { "p-pork": 400, "p-lamb": 300 } };
