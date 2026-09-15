"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { useStore } from "@/lib/store";
import { fmtDate, fmtKg, fmtLek, fmtNum } from "@/lib/utils";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { clients, sales, products, shipments } = useStore();
  const c = clients.find(x => x.id === id); if (!c) return <p className="text-muted-foreground">Klienti nuk u gjet.</p>;
  const mine = sales.filter(s => s.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const total = mine.reduce((a, s) => a + s.totalValue, 0), kg = mine.reduce((a, s) => a + s.totalKg, 0);
  const profit = mine.flatMap(s => s.lines).reduce((a, l) => a + l.kg * (l.pricePerKg - (shipments.find(x => x.id === l.shipmentId)?.costPerKg ?? 0)), 0);
  return (
    <>
      <PageHeader title={c.name} sub={`${c.city}${c.contact ? ` · ${c.contact}` : ""}${c.phone ? ` · ${c.phone}` : ""}`} right={<Button asChild variant="ghost"><Link href="/klientet"><ArrowLeft /> Klientët</Link></Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">{[["Porosi", String(mine.length)], ["Kg gjithsej", fmtKg(kg, 0)], ["Të ardhura", fmtLek(total)], ["Fitim bruto", fmtLek(profit)]].map(([k, v]) => <div key={k} className="rounded-lg bg-card p-4"><div className="text-[11px] text-muted-foreground">{k}</div><div className="mt-1 text-lg font-semibold tabular">{v}</div></div>)}</div>
      <Card><CardHeader><CardTitle>Historia e porosive</CardTitle></CardHeader><CardContent className="space-y-3">
        {mine.map(s => <div key={s.id} className="rounded-md border p-3 text-sm"><div className="mb-2 flex justify-between"><span className="font-medium">{fmtDate(s.date)}</span><span className="tabular text-exit">{fmtLek(s.totalValue)}</span></div>{s.lines.map((l, i) => <div key={i} className="flex justify-between py-1 text-xs text-muted-foreground"><span>{products.find(p => p.id === l.productId)?.name} · Lot {shipments.find(x => x.id === l.shipmentId)?.lots[0]?.lotNumber} · {l.qty} {l.method === "PALLET" ? "paleta" : "kartona"}</span><span className="tabular">{fmtKg(l.kg)} × {fmtNum(l.pricePerKg)}</span></div>)}</div>)}
        {!mine.length && <p className="text-sm text-muted-foreground">Ky klient nuk ka porosi ende.</p>}
      </CardContent></Card>
    </>
  );
}
