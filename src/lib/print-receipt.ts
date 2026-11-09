"use client";
import { receiptPdf, type ReceiptCopy, type ReceiptData } from "./receipt";
import { fmtDate } from "./utils";
import type { jsPDF } from "jspdf";
import { isAndroid, printPdfInPage } from "./print-android";
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

/** Opens the print window right away (browsers only allow it during the click), so it can be filled once the sale is saved.
 *  Not on Android, where printing happens from the system's own page (see print-android.ts). */
export function openReceiptWindow(message = "Po përgatitet fleta e porosisë…") {
  if (isAndroid()) return null;
  const win = window.open("", "_blank");
  win?.document.write(`<p style="font-family:system-ui;padding:24px">${message}</p>`);
  return win;
}

/** Shows a PDF in the window opened for it, ready to print or save (the computer's PDF viewer opens the print
 *  dialog by itself). On Android tablets and phones the pages go straight to Android's print screen instead,
 *  printed from the system's own page.
 *  If the window was blocked, the PDF is downloaded instead. */
export async function showPdf(win: Window | null, make: () => Promise<jsPDF>, filename: string) {
  try {
    const doc = await make();
    if (isAndroid()) {
      try { await printPdfInPage(doc); return true; }
      catch { /* Fall back to downloading the PDF itself. */ }
    }
    doc.autoPrint();
    const url = URL.createObjectURL(doc.output("blob"));
    window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    if (win && !win.closed) { win.location.href = url; return true; }
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    return true;
  } catch {
    win?.close();
    return false;
  }
}

/** The order sheet as a PDF: by default both copies, the accountant's (with the loads) and the client's (product names only). */
export const showReceipt = (win: Window | null, data: ReceiptData, copies?: ReceiptCopy[]) =>
  showPdf(win, () => receiptPdf(data, copies), `Flete-porosi${data.number != null ? `-${data.number}` : ""}-${fmtDate(data.date).replaceAll("/", "-")}.pdf`);

export const printSale = (sale: Sale, ctx: ReceiptContext, copies?: ReceiptCopy[]) => showReceipt(openReceiptWindow(), receiptFor(sale, ctx), copies);
