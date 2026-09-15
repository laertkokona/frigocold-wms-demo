"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { remainingCount, remainingKg, useStore } from "@/lib/store";
import { daysUntil, fmtDate, fmtKg, fmtLek, fmtNum } from "@/lib/utils";

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { shipments, products, suppliers, sales, clients } = useStore();
  const s = shipments.find(x => x.id === id);
  if (!s) return <p className="text-muted-foreground">Dërgesa nuk u gjet.</p>;
  const p = products.find(x => x.id === s.productId); const sup = suppliers.find(x => x.id === s.supplierId);
  const d = daysUntil(s.expFrom); const unit = s.loadType === "PALLET" ? "paleta" : "kartona";
  const out = sales.flatMap(sl => sl.lines.filter(l => l.shipmentId === s.id).map(l => ({ ...l, date: sl.date, client: clients.find(c => c.id === sl.clientId)?.name ?? "—" })));
  const revenue = out.reduce((a, l) => a + l.total, 0), soldCost = s.soldKg * s.costPerKg;
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between border-b py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium tabular">{v}</span></div>;
  return (
    <>
      <PageHeader title={`Lot ${s.lots.map(l => l.lotNumber).join(", ")} · ${p?.name}`} sub={`Porosia ${s.orderNr} · ${sup?.name} (${sup?.country})`} right={<Button asChild variant="ghost"><Link href="/inventari"><ArrowLeft /> Stoku</Link></Button>} />
      {d <= 90 && remainingKg(s) > 0 && <Banner tone={d <= 30 ? "danger" : "warn"} className="mb-4">{d < 0 ? "Ky lot ka skaduar." : `Skadon për ${d} ditë`} — {fmtKg(remainingKg(s), 1)} mbeten. Shit i pari.</Banner>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Të dhënat e dërgesës</CardTitle></CardHeader><CardContent>
          <Row k="Data e hyrjes" v={fmtDate(s.entryDate)} /><Row k="Forma" v={s.loadType === "PALLET" ? "Paleta" : "Kartona"} />
          <Row k="Sasia (dokument / faktik)" v={<span>{s.countDoc} / {s.countActual} {unit}{s.countDoc !== s.countActual && <Badge variant="warn" className="ml-2">{s.countActual - s.countDoc > 0 ? "+" : ""}{s.countActual - s.countDoc}</Badge>}</span>} />
          <Row k="Pesha (dokument / faktike)" v={<span>{fmtNum(s.netKgDoc, 1)} / {fmtNum(s.netKgActual, 1)} kg{s.netKgDoc !== s.netKgActual && <Badge variant="warn" className="ml-2">{(s.netKgActual - s.netKgDoc).toFixed(1)} kg</Badge>}</span>} />
          <Row k="Lotet" v={s.lots.map(l => `${l.lotNumber} (${l.qty})`).join(", ")} />
          <Row k="Prodhimi" v={s.dateMode === "RANGE" && s.prodTo ? `${fmtDate(s.prodFrom)} – ${fmtDate(s.prodTo)}` : fmtDate(s.prodFrom)} />
          <Row k="Skadimi" v={s.dateMode === "RANGE" && s.expTo ? `${fmtDate(s.expFrom)} – ${fmtDate(s.expTo)} (më e hershmja vlen)` : fmtDate(s.expFrom)} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Stoku dhe vlera</CardTitle></CardHeader><CardContent>
          <Row k="Kosto / kg" v={fmtNum(s.costPerKg) + " Lek"} /><Row k="Vlera totale e dërgesës" v={fmtLek(s.totalCost)} />
          <Row k="Mbetur" v={<span className="text-entry">{fmtKg(remainingKg(s), 1)} · {remainingCount(s)} {unit}</span>} />
          <Row k="Shitur" v={`${fmtKg(s.soldKg, 1)} · ${s.soldCount} ${unit}`} />
          <Row k="Të ardhura nga ky lot" v={fmtLek(revenue)} /><Row k="Fitim bruto deri tani" v={<span className="text-entry">{fmtLek(revenue - soldCost)}</span>} />
          <Row k="Vlera e mbetur (kosto)" v={fmtLek(remainingKg(s) * s.costPerKg)} />
        </CardContent></Card>
      </div>
      <Card className="mt-4"><CardHeader><CardTitle>Historia e daljeve</CardTitle></CardHeader><CardContent>
        {out.length === 0 && <p className="text-sm text-muted-foreground">Asnjë shitje ende nga ky lot.</p>}
        {out.map((l, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 text-sm last:border-0"><div><div className="font-medium">{l.client}</div><div className="text-xs text-muted-foreground">{fmtDate(l.date)} · {l.qty} {unit} · {l.method === "FIXED" ? "peshë fikse" : l.method === "VARIABLE" ? "peshë e ndryshme" : "paleta"}</div></div><div className="text-right tabular"><div>{fmtKg(l.kg)}</div><div className="text-xs text-muted-foreground">{fmtNum(l.pricePerKg)} Lek/kg · {fmtLek(l.total)}</div></div></div>)}
      </CardContent></Card>
    </>
  );
}
