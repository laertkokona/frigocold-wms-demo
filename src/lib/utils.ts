import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const fmtKg = (n: number, d?: number) => { const digits = d ?? (Math.abs(Math.round(n * 1000)) % 10 ? 3 : 2); return n.toLocaleString("sq-AL", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + " kg"; };
export const fmtLek = (n: number) => Math.round(n).toLocaleString("sq-AL") + " Lek";
export const fmtNum = (n: number, d = 0) => n.toLocaleString("sq-AL", { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
export const fmtMonth = (iso: string) => { const d = new Date(iso); return `${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
export const todayInTirane = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
export const daysUntil = (iso: string) => Math.round((new Date(iso).getTime() - new Date(todayInTirane()).getTime()) / 86400000);
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Short label for how a sale line's weight was recorded. `unit` = "kartona" | "paleta". */
export function saleMethodLabel(l: { method: string; qty: number; kg: number; fixedKg?: number }, unit: string) {
  if (l.method === "FIXED") return `Peshë fikse (${l.fixedKg} kg × ${l.qty})`;
  if (l.method === "VARIABLE") return `Peshë e ndryshme (${l.qty} futur)`;
  if (l.method === "TOTAL") return `Totali nga fatura (mes. ${l.qty ? (l.kg / l.qty).toFixed(2) : "0"} kg/${unit === "paleta" ? "paletë" : "karton"})`;
  return `Paleta (${l.qty})`;
}
export const saleMethodShort = (m: string) => m === "FIXED" ? "peshë fikse" : m === "VARIABLE" ? "peshë e ndryshme" : m === "TOTAL" ? "totali nga fatura" : "paleta";
