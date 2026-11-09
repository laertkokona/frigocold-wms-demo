import type { jsPDF } from "jspdf";

/** Chrome on Android has no PDF viewer of its own: a PDF goes to the tablet's PDF app, and printing takes three more taps there. */
export const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** On Android: draws each page of the PDF as an image on a plain page in the window opened for printing and opens
 *  Android's print screen straight away, so printing is one tap on Print. The page has no margins, so the browser
 *  adds nothing around the sheet (no link, date or page numbers), and every image is exactly one A4 page. */
export async function printPdfAsPages(win: Window, doc: jsPDF, title: string) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(doc.output("arraybuffer")) }).promise;
  const urls: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      // About 180 dpi on A4: sharp text when printed, and light enough for a slow tablet.
      const viewport = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error("No image"))), "image/png"));
      urls.push(URL.createObjectURL(blob));
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }
  window.setTimeout(() => urls.forEach(u => URL.revokeObjectURL(u)), 10 * 60 * 1000);
  const d = win.document;
  d.open();
  d.write(`<!doctype html><html lang="sq"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>
@page { size: A4 portrait; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.page { width: 210mm; height: 296mm; overflow: hidden; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.page img { display: block; width: 100%; height: 100%; object-fit: contain; }
.bar { display: none; }
@media screen {
  body { background: #6b6b6b; padding: 12px; font-family: system-ui, sans-serif; }
  .bar { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; }
  .bar button { font: inherit; font-size: 16px; padding: 12px 20px; border: 0; border-radius: 10px; background: #972e2b; color: #fff; }
  .bar button.alt { background: #fff; color: #111; }
  .page { width: auto; height: auto; max-width: 820px; margin: 0 auto 12px; box-shadow: 0 2px 8px rgba(0,0,0,.35); }
  .page img { height: auto; }
}
</style></head><body><div class="bar"><button onclick="print()">Printo sërish</button><button class="alt" onclick="close()">Mbyll</button></div>${urls.map(u => `<div class="page"><img src="${u}" alt=""></div>`).join("")}</body></html>`);
  d.close();
  await Promise.all(Array.from(d.images).map(img => img.decode().catch(() => undefined)));
  win.focus();
  win.print();
}
