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
