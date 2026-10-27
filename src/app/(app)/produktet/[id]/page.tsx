"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { ProductDialog } from "@/components/entity-dialogs";
import { remainingCount, remainingKg, useStore } from "@/lib/store";
import { IncompleteShipment } from "@/components/incomplete-shipment";
import { inventoryCosts, sumCosts } from "@/lib/costs";
import { loadSpecLabel } from "@/lib/stock";
import { daysUntil, fmtDate, fmtKg, fmtLek, fmtMonth, fmtNum } from "@/lib/utils";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { products, shipments, suppliers } = useStore();
  const [edit, setEdit] = useState(false);
  const p = products.find(x => x.id === id); if (!p) return <p className="text-muted-foreground">Kategoria nuk u gjet.</p>;
  const loads = shipments.filter(s => s.productId === p.id).sort((a, b) => (remainingKg(b) > 0 ? 1 : 0) - (remainingKg(a) > 0 ? 1 : 0) || a.expFrom.localeCompare(b.expFrom));
  const active = loads.filter(s => remainingKg(s) > 0);
  const stockKg = active.reduce((a, s) => a + remainingKg(s), 0), stockVal = inventoryCosts(active).value;
  const boughtKg = loads.reduce((a, s) => a + s.netKgActual, 0), spend = sumCosts(loads.map(s => s.totalCost));
  return <>
    <PageHeader title={p.name} sub="Të gjitha ngarkesat e kësaj kategorie, nga çdo furnizues"
      right={<div className="flex gap-2"><Button asChild variant="entry"><Link href={`/hyrje?product=${p.id}`}><PackagePlus /> Ngarkesë e re</Link></Button><Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Riemërto</Button><Button asChild variant="ghost"><Link href="/produktet"><ArrowLeft /></Link></Button></div>} />
    <ProductDialog open={edit} product={p} onClose={() => setEdit(false)} />
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[["Në stok", fmtKg(stockKg, 0)], ["Vlera e stokut (kosto)", fmtLek(stockVal)], ["Ngarkesa aktive", `${active.length} / ${loads.length}`], ["Kosto mes. / kg (gjithsej)", boughtKg && spend != null ? fmtNum(spend / boughtKg) + " Lek" : "—"]].map(([k, v]) =>
        <div key={k} className="rounded-lg bg-card p-4"><div className="text-[11px] text-muted-foreground">{k}</div><div className="mt-1 text-lg font-semibold tabular">{v}</div></div>)}
    </div>
    <Card><CardHeader><CardTitle>Ngarkesat</CardTitle></CardHeader><CardContent className="space-y-1.5">
      {loads.map(s => { const rem = remainingKg(s), d = daysUntil(s.expFrom), unit = s.loadType === "PALLET" ? "paleta" : "kartona"; return (
        <Link key={s.id} href={`/inventari/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-sm hover:bg-accent/40">
          <div><div className="font-medium">{suppliers.find(x => x.id === s.supplierId)?.name ?? "—"} · {s.lots.length ? `Lot ${s.lots.map(l => l.lotNumber).join(", ")}` : "Pa lot"}<IncompleteShipment shipment={s} /></div>
            <div className="text-xs text-muted-foreground">{loadSpecLabel(s)}</div>
            <div className="text-xs text-muted-foreground">Porosia {s.orderNr ?? "—"} · hyri {fmtDate(s.entryDate)} · {s.countActual == null ? "sasi e panjohur" : `${remainingCount(s)} / ${s.countActual} ${unit}`} · {fmtNum(s.costPerKg, 2)} Lek/kg</div></div>
          <div className="flex items-center gap-3"><span className="text-right tabular">{rem > 0 ? fmtKg(rem, 0) : <span className="text-xs text-muted-foreground">shitur</span>}</span>{rem > 0 && <Badge variant={d < 60 ? "danger" : d < 180 ? "warn" : "entry"}>{d < 0 ? "skaduar" : fmtMonth(s.expFrom)}</Badge>}</div>
        </Link>); })}
      {!loads.length && <p className="text-sm text-muted-foreground">Asnjë ngarkesë ende. Shtyp &quot;Ngarkesë e re&quot; për të regjistruar të parën.</p>}
    </CardContent></Card>
  </>;
}
