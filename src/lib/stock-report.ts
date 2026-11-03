import type { jsPDF } from "jspdf";
import { remainingCount, remainingKg } from "./stock";
import { pdfText } from "./receipt";
import { fmtDate, fmtNum, todayInTirane } from "./utils";
import type { Client, Product, Shipment, Supplier } from "./types";

export type StockReportContext = { shipments: Shipment[]; products: Product[]; suppliers: Supplier[]; clients: Client[] };

const num = (n: number, d: number) => pdfText(fmtNum(n, d));

/** One printed row per load still in stock: who it came from and what it cost. */
type LoadRow = { product: string; source: string; detail: string; cartons: number | null; kg: number; cost: number | null };

export function stockRows({ shipments, products, suppliers, clients }: StockReportContext): LoadRow[] {
  const pname = (id: string) => products.find(p => p.id === id)?.name ?? "—";
  return shipments
    .map(s => ({ s, kg: remainingKg(s) }))
    .filter(x => x.kg > 0)
    .map(({ s, kg }) => ({
      product: pname(s.productId),
      source: s.returnOf ? `Kthim ${clients.find(c => c.id === s.returnOf!.clientId)?.name ?? ""}`.trim() : suppliers.find(x => x.id === s.supplierId)?.name ?? "Pa furnizues",
      detail: [s.specs, s.lots.length ? `Lot ${s.lots.map(l => l.lotNumber).join(", ")}` : null, `hyrje ${fmtDate(s.entryDate)}`].filter(Boolean).join(" · "),
      cartons: remainingCount(s), kg, cost: s.costPerKg, exp: s.expFrom,
    }))
    .sort((a, b) => a.product.localeCompare(b.product, "sq") || a.exp.localeCompare(b.exp));
}

/** "Stoku aktual" as an A4 PDF in large print: every load in stock grouped by product, with cartons and kg left,
 *  its cost per kg and its value at cost; a subtotal per product with several loads, and the totals on top and at
 *  the end. Built from what the app has loaded, so it is the stock at the moment it is printed. */
export async function stockReportPdf(ctx: StockReportContext): Promise<jsPDF> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const today = fmtDate(todayInTirane());
  doc.setProperties({ title: `Stoku aktual - ${today}` });
  const L = 12, W = 186, LOAD_W = 80;
  const rows = stockRows(ctx);
  const value = (r: LoadRow) => (r.cost == null ? 0 : r.kg * r.cost);
  const totalKg = rows.reduce((a, r) => a + r.kg, 0), totalValue = rows.reduce((a, r) => a + value(r), 0);
  const costedKg = rows.reduce((a, r) => a + (r.cost == null ? 0 : r.kg), 0);
  const noCost = rows.filter(r => r.cost == null).length;
  const groups = new Map<string, LoadRow[]>();
  for (const r of rows) groups.set(r.product, [...(groups.get(r.product) ?? []), r]);

  // Title and totals
  doc.setTextColor(17); doc.setDrawColor(17);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("Stoku aktual - FrigoCold", L, 20);
  doc.setFont("helvetica", "normal"); doc.setFontSize(12.5);
  doc.text(pdfText(`Gjendja më ${today} · ${groups.size} produkte · ${rows.length} ngarkesa`), L, 27);
  doc.setLineWidth(0.5); doc.rect(L, 31, W, 12);
  doc.setFontSize(13); doc.text("Totali kg:", L + 4, 39); doc.text(pdfText("Vlera me kosto:"), L + 92, 39);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(`${num(totalKg, 2)} kg`, L + 27, 39); doc.text(`${num(totalValue, 0)} Lek`, L + 129, 39);
  let startY = 49;
  if (noCost) { doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.text(pdfText(`${noCost} ngarkesa pa kosto - nuk hyjnë te vlera.`), L, 49); startY = 53; }

  type Cell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  type Kind = "product" | "load" | "sum";
  const body: Cell[][] = [], kinds: Kind[] = [], loads: (LoadRow | null)[] = [];
  const push = (kind: Kind, cells: Cell[], load: LoadRow | null = null) => { body.push(cells); kinds.push(kind); loads.push(load); };
  for (const [product, rs] of groups) {
    push("product", [{ content: pdfText(product), colSpan: 5 }]);
    for (const r of rs) push("load", ["", r.cartons == null ? "-" : num(r.cartons, 0), num(r.kg, 2), r.cost == null ? "-" : num(r.cost, 2), r.cost == null ? "-" : num(value(r), 0)], r);
    if (rs.length > 1) {
      const kg = rs.reduce((a, r) => a + r.kg, 0), val = rs.reduce((a, r) => a + value(r), 0), ckg = rs.reduce((a, r) => a + (r.cost == null ? 0 : r.kg), 0);
      push("sum", [pdfText(`Gjithsej ${product}`), "", num(kg, 2), ckg ? num(val / ckg, 2) : "-", num(val, 0)]);
    }
  }

  autoTable(doc, {
    startY, margin: { left: L, right: L, top: 14, bottom: 16 }, theme: "plain", tableWidth: W,
    head: [["Ngarkesa", "Kartona", "Kg", "Kosto Lek/kg", "Vlera Lek"]],
    body,
    foot: [["TOTALI", "", num(totalKg, 2), costedKg ? num(totalValue / costedKg, 2) : "-", num(totalValue, 0)]],
    showHead: "everyPage", showFoot: "lastPage",
    styles: { font: "helvetica", fontSize: 13, textColor: 17, cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 }, valign: "top", lineColor: 170, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: 233, fontStyle: "bold", fontSize: 11.5, halign: "right", valign: "middle", lineColor: 17, lineWidth: { bottom: 0.6 } },
    footStyles: { fontStyle: "bold", fontSize: 14, halign: "right", lineColor: 17, lineWidth: { top: 0.8 } },
    columnStyles: { 0: { cellWidth: LOAD_W, halign: "left" }, 1: { cellWidth: 21, halign: "right" }, 2: { cellWidth: 30, halign: "right" }, 3: { cellWidth: 23, halign: "right", fontStyle: "bold" }, 4: { cellWidth: 32, halign: "right" } },
    didParseCell: c => {
      if (c.column.index === 0) c.cell.styles.halign = "left";
      if (c.section !== "body") return;
      const kind = kinds[c.row.index];
      if (kind === "product") Object.assign(c.cell.styles, { fontSize: 15, fontStyle: "bold", cellPadding: { top: 4, bottom: 1.8, left: 2, right: 2 }, lineColor: 17, lineWidth: { bottom: 0.5 } });
      if (kind === "sum") Object.assign(c.cell.styles, { fontStyle: "bold", fillColor: 242, lineColor: 17, lineWidth: { bottom: 0.5 } });
      const load = loads[c.row.index];
      if (kind === "load" && c.column.index === 0 && load) {
        // Supplier in bold with the load's specs, lots and entry date underneath in smaller type, drawn in didDrawCell.
        doc.setFont("helvetica", "bold"); doc.setFontSize(13);
        const src = doc.splitTextToSize(pdfText(load.source), LOAD_W - 4) as string[];
        doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
        const det = doc.splitTextToSize(pdfText(load.detail), LOAD_W - 4) as string[];
        c.cell.text = [];
        c.cell.styles.minCellHeight = 3.6 + src.length * 5.6 + det.length * 4.4;
        (c.cell as unknown as { lines: [string[], string[]] }).lines = [src, det];
      }
    },
    didDrawCell: c => {
      const lines = (c.cell as unknown as { lines?: [string[], string[]] }).lines;
      if (c.section !== "body" || c.column.index !== 0 || !lines) return;
      let y = c.cell.y + 1.8 + 4.4;
      doc.setTextColor(17); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      for (const l of lines[0]) { doc.text(l, c.cell.x + 2, y); y += 5.6; }
      doc.setTextColor(60); doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); y -= 1.2;
      for (const l of lines[1]) { doc.text(l, c.cell.x + 2, y); y += 4.4; }
      doc.setTextColor(17); doc.setFontSize(13);
    },
    didDrawPage: () => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(60);
      doc.text(`Faqe ${doc.getCurrentPageInfo().pageNumber} / {total}`, L + W / 2, 289, { align: "center" });
      doc.setTextColor(17);
    },
  });
  doc.putTotalPages("{total}");
  return doc;
}
