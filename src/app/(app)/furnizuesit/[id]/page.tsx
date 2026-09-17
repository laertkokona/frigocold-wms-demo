"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { SupplierDialog } from "@/components/entity-dialogs";
import { remainingCount, remainingKg, useStore } from "@/lib/store";
import { daysUntil, fmtDate, fmtKg, fmtLek, fmtMonth, fmtNum } from "@/lib/utils";

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const { suppliers, shipments, products, sales } = useStore();
  const [edit, setEdit] = useState(false);
  const sp = suppliers.find(x => x.id === id); if (!sp) return <p className="text-muted-foreground">Furnizuesi nuk u gjet.</p>;
  const mine = shipments.filter(s => s.supplierId === sp.id).sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  const kg = mine.reduce((a, s) => a + s.netKgActual, 0), spend = mine.reduce((a, s) => a + s.totalCost, 0);
  const ids = new Set(mine.map(s => s.id));
  const lines = sales.flatMap(s => s.lines).filter(l => ids.has(l.shipmentId));
  const revenue = lines.reduce((a, l) => a + l.total, 0), cogs = lines.reduce((a, l) => a + l.kg * (shipments.find(x => x.id === l.shipmentId)?.costPerKg ?? 0), 0);
  const shortKg = mine.reduce((a, s) => a + (s.netKgDoc - s.netKgActual), 0);
  return (
    <>
      <PageHeader title={sp.name} sub={`${sp.country}${sp.contact ? ` · ${sp.contact}` : ""}${sp.phone ? ` · ${sp.phone}` : ""}`}
        right={<div className="flex gap-2"><Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Ndrysho</Button><Button asChild variant="ghost"><Link href="/furnizuesit"><ArrowLeft /> Furnizuesit</Link></Button></div>} />
      <SupplierDialog open={edit} supplier={sp} onClose={() => setEdit(false)} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[["Dërgesa", String(mine.length)], ["Kg blerë", fmtKg(kg, 0)], ["Shpenzim total", fmtLek(spend)], ["Kosto mes. / kg", kg ? fmtNum(spend / kg) + " Lek" : "—"], ["Marzh i realizuar", revenue ? ((revenue - cogs) / revenue * 100).toFixed(1) + "%" : "—"]].map(([k, v]) =>
          <div key={k} className="rounded-lg bg-card p-4"><div className="text-[11px] text-muted-foreground">{k}</div><div className="mt-1 text-lg font-semibold tabular">{v}</div></div>)}
      </div>
      {shortKg > 0.01 && <p className="mb-4 text-xs text-warn">Mungesë peshe kumulative (dokument − faktik): {fmtNum(shortKg, 1)} kg</p>}
      <Card><CardHeader><CardTitle>Dërgesat</CardTitle></CardHeader><CardContent className="space-y-1.5">
        {mine.map(s => { const d = daysUntil(s.expFrom), rem = remainingKg(s); return (
          <Link key={s.id} href={`/inventari/${s.id}`} className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm hover:bg-accent/40">
            <div><div className="font-medium">Lot {s.lots.map(l => l.lotNumber).join(", ")} · {products.find(p => p.id === s.productId)?.name}</div><div className="text-xs text-muted-foreground">Porosia {s.orderNr} · hyri {fmtDate(s.entryDate)} · {s.countActual} {s.loadType === "PALLET" ? "paleta" : "kartona"} · {fmtKg(s.netKgActual, 0)} · {fmtNum(s.costPerKg)} Lek/kg</div></div>
            <div className="flex items-center gap-3"><span className="text-right tabular text-xs text-muted-foreground">{rem > 0 ? `${fmtKg(rem, 0)} mbetur` : "shitur"}</span>{rem > 0 && <Badge variant={d < 60 ? "danger" : d < 180 ? "warn" : "entry"}>{fmtMonth(s.expFrom)}</Badge>}<span className="tabular font-medium">{fmtLek(s.totalCost)}</span></div>
          </Link>); })}
        {!mine.length && <p className="text-sm text-muted-foreground">Asnjë dërgesë nga ky furnizues ende.</p>}
      </CardContent></Card>
    </>
  );
}
