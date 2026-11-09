import type { jsPDF } from "jspdf";

/** Chrome on Android has no PDF viewer of its own (a PDF goes to the tablet's PDF app, three more taps to print), and
 *  when the system is installed as an app a new print tab opens apart from it, where the system cannot fill it.
 *  So on Android everything is printed from the system's own page instead. */
export const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

const ROOT = "fc-print", STYLE = "fc-print-style";
let lastUrls: string[] = [];

/** Prints the given content from the current page: on paper only it shows (the app is hidden), on screen it is
 *  never visible, and Android's print screen opens straight away. Margins are zero, so the browser adds nothing
 *  around the sheet (no link, date or page numbers). `css` is scoped to the printed content. */
export async function printInPage(bodyHtml: string, css: string) {
  document.getElementById(ROOT)?.remove();
  document.getElementById(STYLE)?.remove();
  const style = document.createElement("style");
  style.id = STYLE;
  style.textContent = `
@media screen { #${ROOT} { display: none !important; } }
@media print {
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(#${ROOT}) { display: none !important; }
  #${ROOT} { display: block !important; color: #111; background: #fff; }
  ${css}
}`;
  const root = document.createElement("div");
  root.id = ROOT;
  root.innerHTML = bodyHtml;
  document.head.appendChild(style);
  document.body.appendChild(root);
  await Promise.all(Array.from(root.querySelectorAll("img")).map(img => img.decode().catch(() => undefined)));
  window.print();
}

/** On Android: draws each page of the PDF as an image (about 180 dpi on A4, sharp and light enough for a slow tablet)
 *  and prints them from the current page, one image per A4 sheet. */
export async function printPdfInPage(doc: jsPDF) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(doc.output("arraybuffer")) }).promise;
  const urls: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
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
  lastUrls.forEach(u => URL.revokeObjectURL(u));
  lastUrls = urls;
  await printInPage(urls.map(u => `<div class="fc-page"><img src="${u}" alt=""></div>`).join(""), `
  #${ROOT} .fc-page { width: 210mm; height: 296mm; overflow: hidden; break-after: page; page-break-after: always; }
  #${ROOT} .fc-page:last-child { break-after: auto; page-break-after: auto; }
  #${ROOT} .fc-page img { display: block; width: 100%; height: 100%; object-fit: contain; }`);
}
