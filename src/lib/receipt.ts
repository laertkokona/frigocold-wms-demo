import { fmtDate, fmtNum } from "./utils";

/** One printed line of a "Fletë porosi": cartons (if known), product, kg, price per kg and value. */
export interface ReceiptLine { cartons: number | null; product: string; /** the load it came from: supplier · specs · lot */ detail?: string; kg: number; pricePerKg: number; value: number }
export interface ReceiptData { number?: number | null; date: string; client: { name: string; city?: string; phone?: string }; lines: ReceiptLine[] }

const esc = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
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

function sheetHtml(r: ReceiptData | null, copy: ReceiptCopy) {
  const lines = r?.lines ?? [];
  const rows = Math.max(ROWS, lines.length);
  const rowMm = Math.min(10, (ROWS * 10) / rows);
  const totalKg = lines.reduce((a, l) => a + l.kg, 0), totalValue = lines.reduce((a, l) => a + l.value, 0);
  const body = Array.from({ length: rows }, (_, i) => {
    const l = lines[i];
    const detail = copy === "accounting" && l?.detail ? `<div class="sub">${esc(l.detail)}</div>` : "";
    return `<tr style="height:${rowMm}mm"><td class="c">${l && l.cartons != null ? fmtNum(l.cartons) : ""}</td><td class="p">${l ? esc(l.product) + detail : ""}</td><td class="n">${l ? fmtNum(l.kg, 3) : ""}</td><td class="n">${l ? fmtNum(l.pricePerKg, 2) : ""}</td><td class="n">${l ? fmtNum(l.value, 2) : ""}</td></tr>`;
  }).join("");
  return `<div class="sheet">
<table class="head"><tr><td class="corner">${copy === "accounting" ? "KONTABILITETI" : ""}</td><td class="t">FLETË POROSI</td><td class="d">Nr. <span>${r?.number != null ? r.number : "&nbsp;"}</span><br>Datë: <span>${r ? fmtDate(r.date) : "&nbsp;"}</span></td></tr></table>
<table class="buyer"><tr><td class="k">BLERËSI</td><td>${r ? esc(r.client.name) + (r.client.city ? ` <span style="color:#555">· ${esc(r.client.city)}</span>` : "") : ""}</td></tr><tr><td class="k">Nr. Telefoni / NIPT</td><td>${r?.client.phone ? esc(r.client.phone) : ""}</td></tr></table>
<table class="items"><colgroup><col style="width:24mm"><col><col style="width:30mm"><col style="width:28mm"><col style="width:36mm"></colgroup>
<thead><tr><th>Nr. i arkave</th><th>Emërtimi i mallit</th><th>Sasia (kg)</th><th>Çmimi (Lek/kg)</th><th>Vlefta (Lek)</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td></td><td>TOTALI</td><td class="n">${r ? fmtNum(totalKg, 3) : ""}</td><td></td><td class="n">${r ? fmtNum(totalValue, 2) : ""}</td></tr></tfoot></table>
<div class="terms"><ul>${RECEIPT_TERMS.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
</div>`;
}

/** "Fletë porosi" (warehouse order sheet), filled from a sale: one A4 page per copy, by default the accountant's
 *  copy first and the client's second. Always 12 product rows like the paper form; more lines than that shrink the
 *  rows so each copy stays on one page. `autoPrint` opens the print dialog (print or save as PDF) on load. */
export function receiptHtml(r: ReceiptData | null, autoPrint = false, copies: ReceiptCopy[] = ["accounting", "client"]) {
  const title = r ? `Fletë porosi${r.number != null ? ` nr. ${r.number}` : ""} — ${r.client.name} — ${fmtDate(r.date)}` : "Fletë porosi";
  return `<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4 portrait;margin:12mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}
.sheet{width:186mm;height:271mm;display:flex;flex-direction:column;gap:5mm;overflow:hidden;break-after:page}
.sheet:last-child{break-after:auto}
table{border-collapse:collapse;width:100%}
td,th{border:1.2px solid #111;padding:0 2.5mm;font-size:11pt}
.head td{height:20mm}
.head .corner{width:52mm;text-align:center;font-weight:700;font-size:12pt;letter-spacing:.5px}
.head .t{text-align:center;font-weight:700;font-size:17pt;letter-spacing:.5px}
.head .d{width:52mm;font-weight:700;font-size:12pt;white-space:nowrap;line-height:2}
.head .d span{font-weight:400;border-bottom:1px solid #111;display:inline-block;min-width:30mm;padding:0 1mm}
.buyer td{height:11mm;font-size:11pt}
.buyer .k{width:52mm;font-weight:700}
.items th{height:12mm;font-size:10.5pt;background:#f2f2f2;line-height:1.15}
.items td.c{text-align:center}
.items td.p{line-height:1.15}
.items .sub{font-size:8.5pt;color:#333;max-height:2.3em;overflow:hidden}
.items td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.items tfoot td{height:12mm;font-weight:700;background:#f2f2f2}
.terms{border:1.2px solid #111;padding:3mm 4mm;font-size:9.5pt;line-height:1.35}
.terms ul{margin:0;padding-left:4mm}
.terms li{margin:0 0 1mm}
</style></head><body>${copies.map(c => sheetHtml(r, c)).join("\n")}${autoPrint ? "<script>window.onload=()=>window.print()</script>" : ""}</body></html>`;
}
