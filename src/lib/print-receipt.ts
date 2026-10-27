"use client";
import { receiptHtml, type ReceiptCopy, type ReceiptData } from "./receipt";
import type { Client, Product, Sale, SaleLine, Shipment, Supplier } from "./types";

export type ReceiptContext = { clients: Client[]; products: Product[]; shipments: Shipment[]; suppliers: Supplier[] };

/** Which load a line came from, as the accountant knows it: supplier, the load's specs (brand, cut…) and its lots. */
export function loadDetail(shipmentId: string, { shipments, suppliers }: Pick<ReceiptContext, "shipments" | "suppliers">) {
  const s = shipments.find(x => x.id === shipmentId);
  if (!s) return "";
  return [suppliers.find(x => x.id === s.supplierId)?.name, s.specs, s.lots.length ? `Lot ${s.lots.map(l => l.lotNumber).join(", ")}` : null].filter(Boolean).join(" · ");
}

/** Builds the order sheet for a sale (or a sale about to be saved) from what the app already has loaded. */
export function receiptFor(sale: { date: string; clientId: string; lines: SaleLine[]; receiptNr?: number | null }, ctx: ReceiptContext): ReceiptData {
  const { clients, products } = ctx;
  const c = clients.find(x => x.id === sale.clientId);
  return {
    number: sale.receiptNr ?? null, date: sale.date,
    client: { name: c?.name ?? "—", city: c?.city || undefined, phone: c?.phone || undefined },
    lines: sale.lines.filter(l => l.method !== "RETURN").map(l => ({ cartons: l.qty, product: products.find(p => p.id === l.productId)?.name ?? "—", detail: loadDetail(l.shipmentId, ctx), kg: l.kg, pricePerKg: l.pricePerKg, value: l.total })),
  };
}

/** Opens the print window right away (browsers only allow it during the click), so it can be filled once the sale is saved. */
export function openReceiptWindow() {
  const win = window.open("", "_blank");
  win?.document.write("<p style=\"font-family:system-ui;padding:24px\">Po përgatitet fleta e porosisë…</p>");
  return win;
}

/** Writes the order sheet into the window and opens the print dialog (print it or save it as PDF).
 *  By default both copies: the accountant's (with the loads) and the client's (product names only). */
export function showReceipt(win: Window | null, data: ReceiptData, copies?: ReceiptCopy[]) {
  if (!win) return false;
  win.document.open(); win.document.write(receiptHtml(data, true, copies)); win.document.close();
  return true;
}

export const printSale = (sale: Sale, ctx: ReceiptContext, copies?: ReceiptCopy[]) => showReceipt(openReceiptWindow(), receiptFor(sale, ctx), copies);
