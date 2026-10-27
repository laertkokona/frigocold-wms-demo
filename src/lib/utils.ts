import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

/** Kilograms with up to 3 decimals and no trailing zeros (23.876, 23.87, 23.8, 23); `d = 0` rounds to whole kg for summaries. */
export const fmtKg = (n: number, d?: number) => n.toLocaleString("sq-AL", { minimumFractionDigits: 0, maximumFractionDigits: d === 0 ? 0 : 3 }) + " kg";
export const fmtLek = (n: number | null | undefined) => n == null ? "—" : Math.round(n).toLocaleString("sq-AL") + " Lek";
/** A number with at most `d` decimals and no trailing zeros: fmtNum(23.8, 3) → "23.8", fmtNum(23.876, 3) → "23.876". */
export const fmtNum = (n: number | null | undefined, d = 0) => n == null ? "—" : n.toLocaleString("sq-AL", { minimumFractionDigits: 0, maximumFractionDigits: d });
export const fmtPercent = (n: number | null | undefined, d = 1) => n == null ? "—" : `${(n * 100).toFixed(d)}%`;
export const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
export const fmtMonth = (iso: string) => { const d = new Date(iso); return `${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; };
export const todayInTirane = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Tirane" });
export const daysUntil = (iso: string) => Math.round((new Date(iso).getTime() - new Date(todayInTirane()).getTime()) / 86400000);
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Short label for how a sale line's weight was recorded. `unit` = "kartona" | "paleta". */
export function saleMethodLabel(l: { method: string; qty: number | null; kg: number; fixedKg?: number }, unit: string) {
  if (l.method === "RETURN") return "Kthim nga klienti (kredit)";
  if (l.method === "FIXED") return `Peshë fikse (${l.fixedKg} kg × ${l.qty})`;
  if (l.method === "VARIABLE") return `Peshë e ndryshme (${l.qty} futur)`;
  if (l.method === "TOTAL") return l.qty == null ? "Pesha totale (kg)" : `Pesha totale (mes. ${fmtNum(l.kg / l.qty, 2)} kg/${unit === "paleta" ? "paletë" : "karton"})`;
  return `Paleta (${l.qty})`;
}
export const saleMethodShort = (m: string) => m === "RETURN" ? "kthim (kredit)" : m === "FIXED" ? "peshë fikse" : m === "VARIABLE" ? "peshë e ndryshme" : m === "TOTAL" ? "peshë totale" : "paleta";
