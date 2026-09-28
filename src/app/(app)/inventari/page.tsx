"use client";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shell";
import { BrowseControls } from "@/components/browse-controls";
import { useBrowse } from "@/lib/use-browse";
import { daysUntil, fmtDate, fmtKg, fmtLek, fmtMonth, cn } from "@/lib/utils";

type Row = { id: string; product: string; supplier: string; orderNr: string; loadType: "CARTON" | "PALLET"; countActual: number; remaining_count: number; remaining_kg: number; costPerKg: number; entry_date: string; expiry: string; lots: string };

export default function Inventari() {
  const list = useBrowse<Row>("inventory", "expiry");
  return <>
    <PageHeader title="Stoku" sub={`${list.total} dërgesa aktive`} />
    <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Kërko produkt, lot, furnizues ose porosi…" value={list.q} onChange={e => list.setQ(e.target.value)} className="pl-9" /></div>
    {list.error && <p role="alert" className="mb-3 text-sm text-danger">{list.error} <button className="underline" onClick={list.refresh}>Provo sërish</button></p>}
    <div className="space-y-1.5">
      {list.items.map(s => { const days = daysUntil(s.expiry); return <Link key={s.id} href={`/inventari/${s.id}`} className={cn("flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent/40", days < 90 && "border-danger/40")}>
        <div><div className="font-medium">{s.product} · Lot {s.lots} · {s.supplier}</div><div className="text-xs text-muted-foreground">Porosia {s.orderNr} · hyri {fmtDate(s.entry_date)} · {s.remaining_count} / {s.countActual} {s.loadType === "PALLET" ? "paleta" : "kartona"}</div></div>
        <div className="flex items-center gap-3"><div className="text-right tabular"><div className="font-medium">{fmtKg(s.remaining_kg, 1)}</div><div className="text-xs text-muted-foreground">{fmtLek(s.remaining_kg * s.costPerKg)}</div></div><Badge variant={days < 60 ? "danger" : days < 180 ? "warn" : "entry"}>{days < 0 ? "skaduar" : `${fmtMonth(s.expiry)} · ${days}d`}</Badge><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
      </Link>; })}
      {!list.loading && !list.items.length && <p className="py-10 text-center text-sm text-muted-foreground">Asnjë dërgesë aktive nuk përputhet.</p>}
    </div>
    <BrowseControls {...list} sorts={[{ value: "expiry", label: "Skadimi" }, { value: "product", label: "Produkti" }, { value: "kg", label: "Kg në stok" }, { value: "entry", label: "Data e hyrjes" }]} />
  </>;
}
