"use client";
import Link from "next/link";
import { Box, Package, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell";
import { BrowseControls } from "@/components/browse-controls";
import { useBrowse } from "@/lib/use-browse";
import { cn, fmtKg, fmtLek } from "@/lib/utils";

type Hit = { id: string; type: "ship" | "prod" | "cli"; title: string; sub: string; amount: number; date: string | null };
const labels = { ship: "Dërgesë", prod: "Produkt", cli: "Klient" };

export default function Kerko() {
  const list = useBrowse<Hit>("search", "date", "desc");
  return <>
    <PageHeader title="Kërko" sub="Lot, nr. porosie, datë, produkt ose klient" />
    <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus placeholder="p.sh. 061125, 4471, Albfresh…" value={list.q} onChange={e => list.setQ(e.target.value)} className="h-12 pl-9 text-base" /></div>
    <div className="mb-4 flex gap-2">{([ ["", "Të gjitha"], ["ship", "Dërgesa"], ["prod", "Produkte"], ["cli", "Klientë"] ] as const).map(([key, label]) => <button key={key} onClick={() => list.setFilter(key)} className={cn("rounded-full border px-3 py-1.5 text-xs", list.filter === key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}</div>
    {list.error && <p role="alert" className="mb-3 text-sm text-danger">{list.error} <button className="underline" onClick={list.refresh}>Provo sërish</button></p>}
    <div className="space-y-1.5">
      {list.items.map(h => <Link key={`${h.type}:${h.id}`} href={h.type === "ship" ? `/inventari/${h.id}` : h.type === "cli" ? `/klientet/${h.id}` : "/inventari"} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm hover:bg-accent/40">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">{h.type === "ship" ? <Package className="h-4 w-4" /> : h.type === "prod" ? <Box className="h-4 w-4" /> : <Users className="h-4 w-4" />}</span>
        <div className="min-w-0 flex-1"><div className="truncate font-medium">{h.title}</div><div className="truncate text-xs text-muted-foreground">{h.sub}</div></div>
        <div className="text-right"><div className="tabular">{h.type === "cli" ? fmtLek(h.amount) : fmtKg(h.amount, 0)}</div><Badge variant="outline" className="mt-0.5">{labels[h.type]}</Badge></div>
      </Link>)}
      {list.q && !list.loading && !list.items.length && <p className="py-10 text-center text-sm text-muted-foreground">Asnjë rezultat për &ldquo;{list.q}&rdquo;.</p>}
      {!list.q && <p className="py-10 text-center text-sm text-muted-foreground">Shkruaj për të kërkuar në të gjitha të dhënat.</p>}
    </div>
    {list.q && <BrowseControls {...list} sorts={[{ value: "date", label: "Data" }, { value: "title", label: "Emri" }]} />}
  </>;
}
