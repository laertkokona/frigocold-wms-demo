import type { jsPDF } from "jspdf";
import { pdfText } from "./receipt";
import { fmtNum } from "./utils";

/** One pallet of a sale line weighed carton by carton: its number in the order and the carton weights on it. */
export interface PalletWeights { n: number; weights: number[] }

const COPIES = 2; // one for the client, one kept by Frigo Alba
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Weight list per pallet ("Paleta 1 = 45 arka") as an A4 PDF, two identical copies of every pallet: one goes to
 *  the client, one is kept. Deliberately shows only the product name, the pallet, the carton weights and the total —
 *  no supplier, lot, client or date. With `summary`, ends with a page listing every pallet and the grand total
 *  (also two copies). `decimals` is how the weights are written on the labels. */
export async function palletSheetPdf(product: string, pallets: PalletWeights[], decimals: number, summary = false): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({ title: pdfText(`Peshat - ${product}`) });
  const L = 15, W = 180, num = (n: number, d = decimals) => pdfText(fmtNum(n, d));
  let first = true;
  const page = () => { if (!first) doc.addPage(); first = false; doc.setTextColor(17); doc.setDrawColor(17); };

  const drawPallet = (p: PalletWeights) => {
    page();
    doc.setFont("helvetica", "bold"); doc.setFontSize(22);
    doc.text(doc.splitTextToSize(pdfText(product), W) as string[], L, 22);
    doc.setFontSize(18); doc.text(`Paleta ${p.n} = ${p.weights.length} arka`, L, 34);
    doc.setLineWidth(0.6); doc.line(L, 39, L + W, 39);
    // Weights in columns of 10 cartons (1–10, 11–20, …), 5 columns across; more than 50 cartons continue in a second
    // block of columns underneath (51–60, …). Rows only get smaller for very full pallets (over 100 cartons).
    const PER_COL = 10, COLS = 5, GAP = 8;
    const cols = Math.max(1, Math.ceil(p.weights.length / PER_COL)), blocks = Math.ceil(cols / COLS);
    const top = 47, bottom = 262, rowH = Math.min(9.5, (bottom - top - (blocks - 1) * GAP) / (blocks * PER_COL)), colW = W / COLS;
    const size = Math.max(8, Math.min(14, rowH * 1.5));
    p.weights.forEach((w, i) => {
      const col = Math.floor(i / PER_COL), block = Math.floor(col / COLS), c = col % COLS, r = i % PER_COL;
      const x = L + c * colW, y = top + block * (PER_COL * rowH + GAP) + r * rowH;
      doc.setFont("helvetica", "normal"); doc.setFontSize(size * 0.8); doc.setTextColor(90);
      doc.text(`${i + 1}.`, x + 9, y, { align: "right" });
      doc.setFontSize(size); doc.setTextColor(17);
      doc.text(num(w), x + colW - 6, y, { align: "right" });
    });
    doc.setLineWidth(0.15); doc.setDrawColor(170);
    for (let b = 0; b < blocks; b++) {
      const y0 = top + b * (PER_COL * rowH + GAP), inBlock = Math.min(COLS, cols - b * COLS);
      for (let c = 1; c < inBlock; c++) doc.line(L + c * colW, y0 - 5, L + c * colW, y0 + (PER_COL - 1) * rowH + 2);
    }
    const total = round(p.weights.reduce((a, b) => a + b, 0), decimals);
    doc.setDrawColor(17); doc.setLineWidth(0.6); doc.rect(L, 268, W, 14);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(`Totali: ${p.weights.length} arka`, L + 5, 277.5);
    doc.text(`${num(total)} kg`, L + W - 5, 277.5, { align: "right" });
  };

  for (const p of pallets) for (let k = 0; k < COPIES; k++) drawPallet(p);

  if (summary && pallets.length) {
    const all = pallets.flatMap(p => p.weights), totalKg = round(all.reduce((a, b) => a + b, 0), decimals);
    for (let k = 0; k < COPIES; k++) {
      page();
      doc.setFont("helvetica", "bold"); doc.setFontSize(22);
      doc.text(doc.splitTextToSize(pdfText(product), W) as string[], L, 22);
      doc.setFontSize(18); doc.text(`Gjithsej: ${pallets.length} paleta`, L, 34);
      doc.setLineWidth(0.6); doc.line(L, 39, L + W, 39);
      let y = 50;
      for (const p of pallets) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(15);
        doc.text(`Paleta ${p.n} = ${p.weights.length} arka`, L + 2, y);
        doc.text(`${num(round(p.weights.reduce((a, b) => a + b, 0), decimals))} kg`, L + W - 2, y, { align: "right" });
        doc.setDrawColor(200); doc.setLineWidth(0.15); doc.line(L, y + 3, L + W, y + 3);
        y += 10;
        if (y > 255 && p !== pallets[pallets.length - 1]) { page(); y = 25; }
      }
      doc.setDrawColor(17); doc.setLineWidth(0.6); doc.rect(L, y, W, 14);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16);
      doc.text(`Totali: ${all.length} arka`, L + 5, y + 9.5);
      doc.text(`${num(totalKg)} kg`, L + W - 5, y + 9.5, { align: "right" });
    }
  }
  return doc;
}
