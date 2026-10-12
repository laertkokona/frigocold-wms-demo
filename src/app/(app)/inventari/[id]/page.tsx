"use client";
import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { IncompleteShipment } from "@/components/incomplete-shipment";
import { ShipmentDetailsDialog } from "@/components/shipment-details-dialog";
import { shipmentLabel } from "@/lib/stock";
import { remainingCount, remainingKg, useStore } from "@/lib/store";
import { daysUntil, fmtDate, fmtKg, fmtLek, fmtNum, saleMethodShort } from "@/lib/utils";

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { shipments, products, suppliers, sales, clients } = useStore();
  const [edit, setEdit] = useState(false);
  const s = shipments.find(x => x.id === id);
  if (!s) return <p className="text-muted-foreground">Dërgesa nuk u gjet.</p>;
  const p = products.find(x => x.id === s.productId); const sup = suppliers.find(x => x.id === s.supplierId);
  const d = daysUntil(s.expFrom); const unit = s.loadType === "PALLET" ? "paleta" : "kartona";
  const out = sales.flatMap(sl => sl.lines.filter(l => l.shipmentId === s.id).map(l => ({ ...l, date: sl.date, client: clients.find(c => c.id === sl.clientId)?.name ?? "—" }))).sort((a, b) => b.date.localeCompare(a.date));
  const revenue = out.reduce((a, l) => a + l.total, 0), soldCost = s.soldKg === 0 ? 0 : s.costPerKg == null ? null : s.soldKg * s.costPerKg;
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between border-b py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium tabular">{v}</span></div>;
  return (
    <>
      <PageHeader title={`${shipmentLabel(s)} · ${p?.name}`} sub={`Porosia ${s.orderNr ?? "—"} · ${sup?.name ?? "Pa furnizues"}`} right={<div className="flex gap-2"><Button variant="outline" onClick={() => setEdit(true)}>Plotëso të dhënat</Button><Button asChild variant="ghost"><Link href={`/produktet/${s.productId}`}><ArrowLeft /> {p?.name ?? "Stoku"}</Link></Button></div>} />
      <div className="mb-4"><IncompleteShipment shipment={s} />{s.countActual == null && <p className="mt-2 text-sm text-muted-foreground">Stoku ndiqet vetëm në kg; numri i njësive nuk dihet.</p>}{s.costPerKg == null && <p className="mt-2 text-sm text-warn">Kostoja nuk dihet. Vlera e stokut dhe fitimi janë të paplotë.</p>}</div>
      <ShipmentDetailsDialog shipment={s} open={edit} onClose={() => setEdit(false)} />
      {d <= 90 && remainingKg(s) > 0 && <Banner tone={d <= 30 ? "danger" : "warn"} className="mb-4">{d < 0 ? "Ky lot ka skaduar." : `Skadon për ${d} ditë`} — {fmtKg(remainingKg(s), 1)} mbeten. Shit i pari.</Banner>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Të dhënat e dërgesës</CardTitle></CardHeader><CardContent>
          <Row k="Data e hyrjes" v={fmtDate(s.entryDate)} /><Row k="Pesha" v={s.loadType === "PALLET" ? "Paleta" : s.fixedKg ? `Kartona me peshë fikse ${s.fixedKg} kg` : "Kartona me peshë të ndryshme"} />
          {s.origin && <Row k="Origjina" v={s.origin} />}{s.specs && <Row k="Specifikime" v={s.specs} />}
          <Row k="Sasia (dokument / faktik)" v={<span>{s.countDoc ?? "—"} / {s.countActual ?? "e panjohur"} {unit}{s.countDoc != null && s.countActual != null && s.countDoc !== s.countActual && <Badge variant="warn" className="ml-2">{s.countActual - s.countDoc > 0 ? "+" : ""}{s.countActual - s.countDoc}</Badge>}</span>} />
          <Row k="Pesha (dokument / faktike)" v={<span>{fmtNum(s.netKgDoc, 1)} / {fmtNum(s.netKgActual, 1)} kg{s.netKgDoc != null && s.netKgDoc !== s.netKgActual && <Badge variant="warn" className="ml-2">{(s.netKgActual - s.netKgDoc).toFixed(1)} kg</Badge>}</span>} />
          <Row k="Lotet" v={s.lots.map(l => `${l.lotNumber} (${l.qty})`).join(", ")} />
          <Row k="Prodhimi" v={!s.prodFrom ? "—" : s.dateMode === "RANGE" && s.prodTo ? `${fmtDate(s.prodFrom)} – ${fmtDate(s.prodTo)}` : fmtDate(s.prodFrom)} />
          <Row k="Skadimi" v={s.dateMode === "RANGE" && s.expTo ? `${fmtDate(s.expFrom)} – ${fmtDate(s.expTo)} (më e hershmja vlen)` : fmtDate(s.expFrom)} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Stoku dhe vlera</CardTitle></CardHeader><CardContent>
          <Row k="Kosto / kg" v={fmtNum(s.costPerKg) + " Lek"} /><Row k="Vlera totale e dërgesës" v={fmtLek(s.totalCost)} />
          <Row k="Mbetur" v={<span className="text-entry">{fmtKg(remainingKg(s), 1)} · {remainingCount(s) == null ? "sasi e panjohur" : `${remainingCount(s)} ${unit}`}</span>} />
          <Row k="Shitur" v={`${fmtKg(s.soldKg, 1)}${s.countActual == null ? "" : ` · ${s.soldCount} ${unit}`}`} />
          <Row k="Të ardhura nga ky lot" v={fmtLek(revenue)} /><Row k="Fitim bruto deri tani" v={<span className="text-entry">{fmtLek(soldCost == null ? null : revenue - soldCost)}</span>} />
          <Row k="Vlera e mbetur (kosto)" v={fmtLek(remainingKg(s) === 0 ? 0 : s.costPerKg == null ? null : remainingKg(s) * s.costPerKg)} />
        </CardContent></Card>
      </div>
      <Card className="mt-4"><CardHeader><CardTitle>Historia e daljeve</CardTitle></CardHeader><CardContent>
        {out.length === 0 && <p className="text-sm text-muted-foreground">Asnjë shitje ende nga ky lot.</p>}
        {out.map((l, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 text-sm last:border-0"><div><div className="font-medium">{l.client}</div><div className="text-xs text-muted-foreground">{fmtDate(l.date)} · {l.qty == null ? "sasi e panjohur" : `${l.qty} ${unit}`} · {saleMethodShort(l.method)}</div></div><div className="text-right tabular"><div>{fmtKg(l.kg)}</div><div className="text-xs text-muted-foreground">{fmtNum(l.pricePerKg)} Lek/kg · {fmtLek(l.total)}</div></div></div>)}
      </CardContent></Card>
    </>
  );
}
