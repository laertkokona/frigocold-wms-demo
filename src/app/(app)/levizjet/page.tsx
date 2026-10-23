"use client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "@/components/shell";
import { BrowseControls } from "@/components/browse-controls";
import { useBrowse } from "@/lib/use-browse";
import { cn, fmtDate, fmtLek, fmtNum } from "@/lib/utils";

type Type = "IN" | "OUT" | "RET" | "ADJ" | "ANUL" | "KOR";
type Line = { id: string; sid: string; product: string; lot: string; qty: number | null; kg: number; price: number | null; value: number | null; method: string };
/** One row per order: a sale with all its lines, a truck from a supplier with all its loads, a return, a shortage or a correction. */
type Row = { id: string; date: string; type: Type; party: string | null; items: number; qty: number | null; kg: number; value: number | null; products: string; ref: string | null; method: string; lines: Line[] };
const TYPE_LABEL = { IN: "HYRJE", OUT: "DALJE", RET: "KTHIM", ADJ: "MUNGESË", ANUL: "SHITJE E ANULUAR", KOR: "KORRIGJIM KG" } as const;
const TYPE_BADGE = { IN: "entry", OUT: "exit", RET: "entry", ADJ: "warn", ANUL: "outline", KOR: "default" } as const;
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""').replace(/^[=+@-]/, "'$&")}"`;

/** What the row is, in one line: who it was with and what it contained. */
function summary(r: Row) {
  const many = r.items > 1;
  if (r.type === "OUT" || r.type === "ANUL") return { title: r.party ?? "—", sub: `${many ? `${r.items} artikuj: ` : ""}${r.products}${r.type === "ANUL" ? ` · ${r.method}` : ""}` };
  if (r.type === "IN") return { title: r.party ?? "Pa furnizues", sub: `${r.ref ? `Porosia ${r.ref} · ` : ""}${many ? `${r.items} ngarkesa: ` : ""}${r.products}` };
  if (r.type === "RET") return { title: r.party ?? "—", sub: `${r.products} · ${r.method}` };
  return { title: r.products, sub: r.method };
}

export default function Levizjet() {
  const list = useBrowse<Row>("movements", "date", "desc");
  const [open, setOpen] = useState<string | null>(null);
  const exportPage = () => {
    const csv = ["Data,Lloji,Pala,Porosia,Produkti,Lot,Sasia,Kg,Çmimi/kg,Vlera (Lek),Shënim", ...list.items.flatMap(r => r.lines.map(l => [fmtDate(r.date), TYPE_LABEL[r.type], r.party ?? "", r.ref ?? "", l.product, l.lot, l.qty ?? "", Number(l.kg).toFixed(3), l.price == null ? "" : Number(l.price).toFixed(2), l.value == null ? "" : Math.round(l.value), l.method].map(csvCell).join(",")))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `levizjet-frigocold-faqe-${list.page}.csv`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <PageHeader title="Lëvizjet" sub="Çdo porosi, hyrje, kthim, mungesë dhe korrigjim — kliko një rresht për detajet" right={<Button variant="outline" disabled={!list.items.length} onClick={exportPage}><Download /> Eksporto faqen CSV</Button>} />
    <div className="mb-4 flex flex-wrap gap-3"><div className="max-w-full overflow-x-auto"><Segmented value={list.filter || "ALL"} onChange={list.setFilter} options={[{ value: "ALL", label: "Të gjitha" }, { value: "IN", label: "Hyrje" }, { value: "OUT", label: "Dalje" }, { value: "RET", label: "Kthime" }, { value: "ADJ", label: "Mungesa" }, { value: "ANUL", label: "Anuluar" }, { value: "KOR", label: "Korrigjime" }]} className="w-max min-w-full [&_button]:whitespace-nowrap" /></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Kërko klient, produkt, lot, porosi…" value={list.q} onChange={e => list.setQ(e.target.value)} className="max-w-xs pl-9" /></div></div>
    {list.error && <p role="alert" className="mb-3 text-sm text-danger">{list.error} <button className="underline" onClick={list.refresh}>Provo sërish</button></p>}
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="border-b bg-card text-left text-[11px] text-muted-foreground"><th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Lloji</th><th className="px-3 py-2 font-medium">Klienti / furnizuesi · përmbajtja</th><th className="px-3 py-2 text-right font-medium">Sasia</th><th className="px-3 py-2 text-right font-medium">Kg</th><th className="px-3 py-2 text-right font-medium">Vlera</th></tr></thead>
      <tbody>{list.items.map(r => { const isOpen = open === r.id, s = summary(r), struck = r.type === "ANUL"; return <Fragment key={r.id}>
        <tr className={cn("cursor-pointer border-b hover:bg-accent/30", isOpen && "bg-accent/20")} onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
          <td className="whitespace-nowrap px-3 py-2 text-muted-foreground"><span className="inline-flex items-center gap-1.5">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{fmtDate(r.date)}</span></td>
          <td className="px-3 py-2"><Badge variant={TYPE_BADGE[r.type]}>{TYPE_LABEL[r.type]}</Badge></td>
          <td className="px-3 py-2"><div className="font-medium">{s.title}</div><div className="max-w-md truncate text-xs text-muted-foreground" title={s.sub}>{s.sub}</div></td>
          <td className="px-3 py-2 text-right tabular">{r.qty ?? "—"}</td>
          <td className={cn("px-3 py-2 text-right tabular", struck && "text-muted-foreground line-through")}>{r.type === "KOR" && r.kg > 0 ? "+" : ""}{fmtNum(r.kg, 2)}</td>
          <td className="px-3 py-2 text-right tabular">{fmtLek(r.value)}</td>
        </tr>
        {isOpen && <tr className="border-b bg-secondary/30"><td colSpan={6} className="px-3 py-3">
          <table className="w-full text-xs"><thead><tr className="text-left text-[10px] text-muted-foreground"><th className="py-1 pl-6 font-medium">Produkti · lot</th><th className="py-1 font-medium">Mënyra / shënim</th><th className="py-1 text-right font-medium">Sasia</th><th className="py-1 text-right font-medium">Kg</th><th className="py-1 text-right font-medium">{r.type === "OUT" || r.type === "ANUL" ? "Çmimi/kg" : "Kosto/kg"}</th><th className="py-1 text-right font-medium">Vlera</th></tr></thead>
            <tbody>{r.lines.map(l => <tr key={l.id} className="border-t border-border/50">
              <td className="py-1.5 pl-6"><Link href={`/inventari/${l.sid}`} className="font-medium hover:underline" onClick={e => e.stopPropagation()}>{l.product}</Link>{l.lot ? <span className="text-muted-foreground"> · Lot {l.lot}</span> : null}</td>
              <td className="py-1.5 text-muted-foreground">{l.method}</td>
              <td className="py-1.5 text-right tabular">{l.qty ?? "—"}</td>
              <td className="py-1.5 text-right tabular">{fmtNum(Number(l.kg), 2)}</td>
              <td className="py-1.5 text-right tabular">{l.price == null ? "—" : fmtNum(Number(l.price), 2)}</td>
              <td className="py-1.5 text-right tabular">{fmtLek(l.value == null ? null : Number(l.value))}</td>
            </tr>)}</tbody>
            {r.lines.length > 1 && <tfoot><tr className="border-t font-medium"><td className="py-1.5 pl-6" colSpan={2}>Gjithsej</td><td className="py-1.5 text-right tabular">{r.qty ?? "—"}</td><td className="py-1.5 text-right tabular">{fmtNum(r.kg, 2)}</td><td /><td className="py-1.5 text-right tabular">{fmtLek(r.value)}</td></tr></tfoot>}
          </table>
        </td></tr>}
      </Fragment>; })}</tbody></table>
      {!list.loading && !list.items.length && <p className="p-6 text-center text-sm text-muted-foreground">Asnjë lëvizje me këto filtra.</p>}
    </div>
    <BrowseControls {...list} sorts={[{ value: "date", label: "Data" }, { value: "kg", label: "Kg" }, { value: "value", label: "Vlera" }]} />
  </>;
}
