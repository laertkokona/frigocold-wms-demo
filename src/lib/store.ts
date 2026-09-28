"use client";
import { create } from "zustand";
import type { Client, Draft, Product, Sale, Shipment, Supplier, Thresholds } from "./types";

type Data = { products: Product[]; suppliers: Supplier[]; clients: Client[]; shipments: Shipment[]; drafts: Draft[]; sales: Sale[]; thresholds: Thresholds };
interface State extends Data {
  hydrated: boolean;
  error: string | null;
  load: () => Promise<void>;
  addProduct: (p: Omit<Product, "id">) => Promise<Product>;
  addSupplier: (s: Omit<Supplier, "id">) => Promise<Supplier>;
  addClient: (c: Omit<Client, "id">) => Promise<Client>;
  updateClient: (id: string, patch: Partial<Omit<Client, "id">>) => Promise<void>;
  updateSupplier: (id: string, patch: Partial<Omit<Supplier, "id">>) => Promise<void>;
  addShipment: (s: Omit<Shipment, "id" | "soldKg" | "soldCount"> & { entryDate?: string; draftId?: string; requestId: string }) => Promise<Shipment>;
  saveDraft: (d: Omit<Draft, "savedAt" | "id"> & { id?: string }) => Promise<Draft>;
  deleteDraft: (id: string) => Promise<void>;
  finalizeSale: (s: Omit<Sale, "id" | "date"> & { requestId: string; date?: string }) => Promise<Sale>;
  setThresholds: (t: Thresholds) => Promise<void>;
}

const empty: Data = { products: [], suppliers: [], clients: [], shipments: [], drafts: [], sales: [], thresholds: { expiryDays: 60, lowShipmentCount: 5, lowProductKg: {} } };

async function request(path: string, body?: unknown) {
  const response = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  if (response.status === 401) { window.location.assign("/login"); throw new Error("Session expired"); }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed");
  return result;
}

export const useStore = create<State>()((set) => {
  const command = async <T extends { id: string }>(type: string, data?: unknown, id?: string, requestId?: string): Promise<T> => {
    const payload = await request("/api/commands", { type, ...(data !== undefined ? { data } : {}), ...(id ? { id } : {}), ...(requestId ? { requestId } : {}) });
    set({ ...payload.state, error: null });
    const collection = ({ addProduct: "products", addSupplier: "suppliers", addClient: "clients", addShipment: "shipments", saveDraft: "drafts", finalizeSale: "sales" } as Record<string, keyof Data>)[type];
    return (collection ? payload.state[collection].find((x: { id: string }) => x.id === payload.result.id) : payload.result) ?? payload.result;
  };
  return {
    ...empty, hydrated: false, error: null,
    load: async () => { try { const data = await request("/api/state"); set({ ...data, hydrated: true, error: null }); } catch (e) { set({ hydrated: true, error: e instanceof Error ? e.message : "Could not load data" }); } },
    addProduct: data => command<Product>("addProduct", data),
    addSupplier: data => command<Supplier>("addSupplier", data),
    addClient: data => command<Client>("addClient", data),
    updateClient: async (id, data) => { await command("updateClient", data, id); },
    updateSupplier: async (id, data) => { await command("updateSupplier", data, id); },
    addShipment: ({ requestId, ...data }) => command<Shipment>("addShipment", data, undefined, requestId),
    saveDraft: data => command<Draft>("saveDraft", data),
    deleteDraft: async id => { await command("deleteDraft", undefined, id); },
    finalizeSale: data => command<Sale>("finalizeSale", { clientId: data.clientId, lines: data.lines, ...(data.date ? { date: data.date } : {}) }, undefined, data.requestId),
    setThresholds: async data => { await command("setThresholds", data); },
  };
});

export { remainingKg, remainingCount } from "./stock";
