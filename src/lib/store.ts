"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as seed from "./mock-data";
import type { Client, Draft, Product, Sale, Shipment, Supplier, Thresholds } from "./types";
import { TODAY, uid } from "./utils";

interface State {
  products: Product[]; suppliers: Supplier[]; clients: Client[];
  shipments: Shipment[]; drafts: Draft[]; sales: Sale[]; thresholds: Thresholds;
  hydrated: boolean;
  addProduct: (p: Omit<Product, "id">) => Product;
  addSupplier: (s: Omit<Supplier, "id">) => Supplier;
  addClient: (c: Omit<Client, "id">) => Client;
  addShipment: (s: Omit<Shipment, "id" | "soldKg" | "soldCount"> & { entryDate?: string }) => Shipment;
  saveDraft: (d: Omit<Draft, "savedAt" | "id"> & { id?: string }) => Draft;
  deleteDraft: (id: string) => void;
  finalizeSale: (s: Omit<Sale, "id" | "date">) => Sale;
  setThresholds: (t: Thresholds) => void;
  resetDemo: () => void;
}

function applySales(shipments: Shipment[], sales: Sale[]): Shipment[] {
  const sold: Record<string, { kg: number; n: number }> = {};
  for (const s of sales) for (const l of s.lines) {
    sold[l.shipmentId] = sold[l.shipmentId] ?? { kg: 0, n: 0 };
    sold[l.shipmentId].kg += l.kg; sold[l.shipmentId].n += l.qty;
  }
  return shipments.map(sh => ({ ...sh, soldKg: +(sold[sh.id]?.kg ?? 0).toFixed(2), soldCount: sold[sh.id]?.n ?? 0 }));
}

const initial = () => ({
  products: seed.products, suppliers: seed.suppliers, clients: seed.clients,
  shipments: applySales(seed.shipments, seed.sales), drafts: [] as Draft[], sales: seed.sales, thresholds: seed.thresholds,
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(), hydrated: false,
      addProduct: (p) => { const np = { ...p, id: "p-" + uid() }; set(s => ({ products: [...s.products, np] })); return np; },
      addSupplier: (sp) => { const ns = { ...sp, id: "s-" + uid() }; set(s => ({ suppliers: [...s.suppliers, ns] })); return ns; },
      addClient: (c) => { const nc = { ...c, id: "c-" + uid() }; set(s => ({ clients: [...s.clients, nc] })); return nc; },
      addShipment: (sh) => { const ns: Shipment = { ...sh, id: "sh-" + uid(), entryDate: sh.entryDate || TODAY, soldKg: 0, soldCount: 0 }; set(s => ({ shipments: [...s.shipments, ns] })); return ns; },
      saveDraft: (d) => {
        const id = d.id ?? "d-" + uid();
        const nd: Draft = { id, productId: d.productId, data: d.data, savedAt: new Date().toISOString() };
        set(s => ({ drafts: s.drafts.some(x => x.id === id) ? s.drafts.map(x => x.id === id ? nd : x) : [...s.drafts, nd] }));
        return nd;
      },
      deleteDraft: (id) => set(s => ({ drafts: s.drafts.filter(d => d.id !== id) })),
      finalizeSale: (sale) => {
        const ns: Sale = { ...sale, id: "sl-" + uid(), date: TODAY };
        const sales = [...get().sales, ns];
        set(s => ({ sales, shipments: applySales(s.shipments, sales) }));
        return ns;
      },
      setThresholds: (t) => set({ thresholds: t }),
      resetDemo: () => set({ ...initial() }),
    }),
    {
      name: "frigocold-demo-v1",
      partialize: (s) => ({ products: s.products, suppliers: s.suppliers, clients: s.clients, shipments: s.shipments, drafts: s.drafts, sales: s.sales, thresholds: s.thresholds }),
      onRehydrateStorage: () => (state) => { state && (state.hydrated = true); },
    }
  )
);

export const remainingKg = (s: Shipment) => Math.max(0, +(s.netKgActual - s.soldKg).toFixed(2));
export const remainingCount = (s: Shipment) => Math.max(0, s.countActual - s.soldCount);
