"use client";
import { receiptHtml, type ReceiptData } from "./receipt";
import type { Client, Product, Sale, SaleLine } from "./types";

/** Builds the order sheet for a sale (or a sale about to be saved) from what the app already has loaded. */
export function receiptFor(sale: { date: string; clientId: string; lines: SaleLine[]; receiptNr?: number | null }, clients: Client[], products: Product[]): ReceiptData {
  const c = clients.find(x => x.id === sale.clientId);
  return {
    number: sale.receiptNr ?? null, date: sale.date,
    client: { name: c?.name ?? "—", city: c?.city || undefined, phone: c?.phone || undefined },
    lines: sale.lines.filter(l => l.method !== "RETURN").map(l => ({ cartons: l.qty, product: products.find(p => p.id === l.productId)?.name ?? "—", kg: l.kg, pricePerKg: l.pricePerKg, value: l.total })),
  };
}

/** Opens the print window right away (browsers only allow it during the click), so it can be filled once the sale is saved. */
export function openReceiptWindow() {
  const win = window.open("", "_blank");
  win?.document.write("<p style=\"font-family:system-ui;padding:24px\">Po përgatitet fleta e porosisë…</p>");
  return win;
}

/** Writes the order sheet into the window and opens the print dialog (print it or save it as PDF). */
export function showReceipt(win: Window | null, data: ReceiptData) {
  if (!win) return false;
  win.document.open(); win.document.write(receiptHtml(data, true)); win.document.close();
  return true;
}

export const printSale = (sale: Sale, clients: Client[], products: Product[]) => showReceipt(openReceiptWindow(), receiptFor(sale, clients, products));
