import { fmtDate, fmtNum } from "./utils";
import type { jsPDF } from "jspdf";

/** One printed line of a "Fletë porosi": cartons (if known), product, kg, price per kg and value. */
export interface ReceiptLine { cartons: number | null; product: string; /** the load it came from: supplier · specs · lot */ detail?: string; kg: number; pricePerKg: number; value: number }
export interface ReceiptData { number?: number | null; date: string; client: { name: string; city?: string; phone?: string }; lines: ReceiptLine[] }

const ROWS = 12;

/** The fixed terms printed at the bottom of every order sheet, as on the paper form. */
export const RECEIPT_TERMS = [
  "Kjo fletë porosi lëshohet në çastin e marrjes së porosisë. Kjo fletë porosi nuk përbën detyrim për t’u paguar. Detyrimi për t’u paguar lind në çastin kur fletë porosia shoqërohet gjithmonë me faturë ose kupon tatimor.",
  "Garancia fillon në datën e shënuar në faturë.",
  "Garancia për produktet refurbished, përveç fotokopjeve, është 12 muaj nga data e faturës.",
  "Garancia për fotokopjet jepet në numër kopjesh në varësi të modelit të pajisjes. Numri i kopjeve në garanci paraqitet në dokumenta të veçanta nga kjo.",
  "Garancia përfshin vetëm riparimin ose ndërrimin, si rezultat i mosfunksionimit të pajisjeve ose pjesëve përbërëse të tyre.",
  "Nuk përfshihen në garanci çdo defekt që shkaktohet nga dëmtime të jashtme, si thyerja, djegia, anomalitë e rrjetit elektrik, ose dëmtime të tjera që nuk vijnë nga përdorimi normal i pajisjes.",
];

/** Which copy: the accountant's shows the load each line came from (supplier · specs · lot) and "KONTABILITETI"
 *  in the top-left box; the client's shows only the product name, so the client never sees the supplier. */
export type ReceiptCopy = "accounting" | "client";

/** Text for the PDF's built-in fonts (Latin-1): the locale's thin spaces become plain spaces and typographic
 *  quotes and dashes their plain forms, so every character prints (ë, ç and · are already Latin-1). */
export const pdfText = (s: string) => s.replace(/[\u00a0\u202f\u2009]/g, " ").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\x00-\xff]/g, "?");
const num = (n: number, d: number) => pdfText(fmtNum(n, d));

/** "Fletë porosi" (warehouse order sheet) as a real A4 PDF, one page per copy — by default the accountant's copy
 *  first and the client's second. A PDF prints exactly as drawn: phones and browsers add no link, date or page
 *  numbers and no extra blank pages, which they do when printing a web page. Always 12 product rows like the paper
 *  form; more lines shrink the rows so each copy stays on one page. */
export async function receiptPdf(r: ReceiptData, copies: ReceiptCopy[] = ["accounting", "client"]): Promise<jsPDF> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  // The sheet's number stays in the system (Lëvizjet, search) but is not printed: the accountant doesn't want it on the sheet.
  const title = `Fletë porosi - ${r.client.name} - ${fmtDate(r.date)}`;
  doc.setProperties({ title: pdfText(title) });
  const L = 12, W = 186, LW = 0.3;
  const rows = Math.max(ROWS, r.lines.length), rowH = Math.min(8.5, (ROWS * 8.5) / rows);
  const totalKg = r.lines.reduce((a, l) => a + l.kg, 0), totalValue = r.lines.reduce((a, l) => a + l.value, 0);
  copies.forEach((copy, page) => {
    if (page > 0) doc.addPage();
    doc.setDrawColor(17); doc.setLineWidth(LW); doc.setTextColor(17);
    // Header: [KONTABILITETI | FLETË POROSI | Datë]
    let y = 12;
    const h = 17;
    doc.rect(L, y, 52, h); doc.rect(L + 52, y, W - 104, h); doc.rect(L + W - 52, y, 52, h);
    doc.setFont("helvetica", "bold");
    if (copy === "accounting") { doc.setFontSize(11); doc.text("KONTABILITETI", L + 26, y + h / 2 + 1.5, { align: "center" }); }
    doc.setFontSize(16); doc.text(pdfText("FLETË POROSI"), L + W / 2, y + h / 2 + 2, { align: "center" });
    doc.setFontSize(10.5);
    doc.text(pdfText("Datë:"), L + W - 49, y + h / 2 + 1.5);
    doc.setFont("helvetica", "normal");
    doc.text(fmtDate(r.date), L + W - 36, y + h / 2 + 1.5);
    doc.setLineWidth(0.2); doc.line(L + W - 37, y + h / 2 + 2.5, L + W - 4, y + h / 2 + 2.5); doc.setLineWidth(LW);
    // Buyer
    y += h + 4;
    const buyer: [string, string][] = [[pdfText("BLERËSI"), pdfText(r.client.name + (r.client.city ? ` · ${r.client.city}` : ""))], ["Nr. Telefoni / NIPT", pdfText(r.client.phone ?? "")]];
    buyer.forEach(([k, v], i) => {
      const yy = y + i * 9;
      doc.rect(L, yy, 52, 9); doc.rect(L + 52, yy, W - 52, 9);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(k, L + 2.5, yy + 5.8);
      doc.setFont("helvetica", "normal"); doc.text(v, L + 54.5, yy + 5.8, { maxWidth: W - 57 });
    });
    y += 18 + 4;
    // Items
    const body = Array.from({ length: rows }, (_, i) => {
      const l = r.lines[i];
      return l ? [l.cartons != null ? num(l.cartons, 0) : "", pdfText(l.product), num(l.kg, 3), num(l.pricePerKg, 2), num(l.value, 2)] : ["", "", "", "", ""];
    });
    autoTable(doc, {
      startY: y, margin: { left: L, right: L }, theme: "grid", tableWidth: W,
      head: [["Nr. i arkave", pdfText("Emërtimi i mallit"), "Sasia (kg)", pdfText("Çmimi (Lek/kg)"), "Vlefta (Lek)"]],
      body,
      foot: [["", "TOTALI", num(totalKg, 3), "", num(totalValue, 2)]],
      showHead: "firstPage", showFoot: "lastPage",
      styles: { font: "helvetica", fontSize: 10, textColor: 17, lineColor: 17, lineWidth: LW, cellPadding: { top: 1, bottom: 1, left: 2, right: 2 }, minCellHeight: rowH, valign: "middle", overflow: "ellipsize" },
      headStyles: { fillColor: 242, textColor: 17, fontStyle: "bold", halign: "center", fontSize: 9.5, minCellHeight: 10 },
      footStyles: { fillColor: 242, textColor: 17, fontStyle: "bold", minCellHeight: 9 },
      columnStyles: { 0: { cellWidth: 24, halign: "center" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 30, halign: "right" }, 3: { cellWidth: 28, halign: "right" }, 4: { cellWidth: 36, halign: "right" } },
      didParseCell: c => {
        if (c.section === "foot" && c.column.index >= 2) c.cell.styles.halign = "right";
        // A line with its load underneath needs room for both, even when many lines make the rows smaller.
        if (copy === "accounting" && c.section === "body" && r.lines[c.row.index]?.detail) { c.cell.styles.minCellHeight = Math.max(rowH, 8.5); if (c.column.index === 1) c.cell.styles.valign = "top"; }
      },
      didDrawCell: c => {
        const detail = r.lines[c.row.index]?.detail;
        if (copy !== "accounting" || c.section !== "body" || c.column.index !== 1 || !detail) return;
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(70);
        doc.text(doc.splitTextToSize(pdfText(detail), c.cell.width - 4)[0] ?? "", c.cell.x + 2, c.cell.y + c.cell.height - 1.6);
        doc.setFontSize(10); doc.setTextColor(17);
      },
    });
    // Terms
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const lines = RECEIPT_TERMS.map(t => doc.splitTextToSize(pdfText(t), W - 12) as string[]);
    const lh = 3.6, boxH = 5 + lines.reduce((a, ls) => a + ls.length * lh + 0.8, 0);
    doc.rect(L, y, W, boxH);
    let ty = y + 5;
    for (const ls of lines) { doc.circle(L + 3.2, ty - 1, 0.45, "F"); doc.text(ls, L + 6, ty); ty += ls.length * lh + 0.8; }
  });
  return doc;
}
