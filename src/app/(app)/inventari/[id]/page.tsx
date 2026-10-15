"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, PackageX, Scale, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { IncompleteShipment } from "@/components/incomplete-shipment";
import { ShipmentDetailsDialog } from "@/components/shipment-details-dialog";
import { SHORTAGE_LABELS, shipmentLabel } from "@/lib/stock";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShortageReason } from "@/lib/types";
import { cn, todayInTirane } from "@/lib/utils";
import { remainingCount, remainingKg, useStore } from "@/lib/store";
import { daysUntil, fmtDate, fmtKg, fmtLek, fmtNum, saleMethodShort } from "@/lib/utils";

export default function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const { shipments, products, suppliers, sales, clients, adjustments } = useStore();
  const [edit, setEdit] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [short, setShort] = useState(false);
  const [correct, setCorrect] = useState(false);
  const s = shipments.find(x => x.id === id);
  if (!s) return <p className="text-muted-foreground">Dërgesa nuk u gjet.</p>;
  const p = products.find(x => x.id === s.productId); const sup = suppliers.find(x => x.id === s.supplierId);
  const d = daysUntil(s.expFrom); const unit = s.loadType === "PALLET" ? "paleta" : "kartona";
  const out = sales.flatMap(sl => sl.lines.filter(l => l.shipmentId === s.id).map(l => ({ ...l, date: sl.date, clientId: sl.clientId, client: clients.find(c => c.id === sl.clientId)?.name ?? "—" }))).sort((a, b) => b.date.localeCompare(a.date));
  // Net of client returns: credit lines carry negative kg and value, so returned goods are not counted as sold.
  const netKg = out.reduce((a, l) => a + l.kg, 0);
  const revenue = out.reduce((a, l) => a + l.total, 0), soldCost = netKg === 0 ? 0 : s.costPerKg == null ? null : netKg * s.costPerKg;
  const shortages = adjustments.filter(a => a.shipmentId === s.id);
  const origin = s.returnOf ? shipments.find(x => x.id === s.returnOf!.shipmentId) : undefined;
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between border-b py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium tabular">{v}</span></div>;
  return (
    <>
      <PageHeader title={`${shipmentLabel(s)} · ${p?.name}`} sub={s.returnOf ? `Kthim nga ${clients.find(c => c.id === s.returnOf!.clientId)?.name ?? "klienti"} · ${fmtDate(s.entryDate)}` : `Porosia ${s.orderNr ?? "—"} · ${sup?.name ?? "Pa furnizues"}`} right={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEdit(true)}>Ndrysho të dhënat</Button>{!s.returnOf && <Button variant="outline" onClick={() => setCorrect(true)}><Scale /> Korrigjo kg</Button>}{remainingKg(s) > 0 && <Button variant="outline" onClick={() => setShort(true)}><PackageX /> Regjistro mungesë</Button>}{out.length === 0 && shortages.length === 0 && <Button variant="warn" onClick={() => setCancel(true)}><Trash2 /> Anulo ngarkesën</Button>}<Button asChild variant="ghost"><Link href={`/produktet/${s.productId}`}><ArrowLeft /> {p?.name ?? "Stoku"}</Link></Button></div>} />
      <div className="mb-4"><IncompleteShipment shipment={s} />{s.countActual == null && <p className="mt-2 text-sm text-muted-foreground">Stoku ndiqet vetëm në kg; numri i njësive nuk dihet.</p>}{s.costPerKg == null && <p className="mt-2 text-sm text-warn">Kostoja nuk dihet. Vlera e stokut dhe fitimi janë të paplotë.</p>}</div>
      {s.returnOf && <Banner className="mb-4"><Undo2 className="mr-1 inline h-3.5 w-3.5" /><b>Kthim nga {clients.find(c => c.id === s.returnOf!.clientId)?.name ?? "klienti"}</b> — shitur më {fmtDate(s.returnOf.saleDate)}{origin ? <> nga <Link className="underline" href={`/inventari/${origin.id}`}>{shipmentLabel(origin)}</Link></> : null}. Arsyeja: {s.returnOf.reason || "—"}. Kredituar {fmtNum(s.returnOf.pricePerKg)} Lek/kg.</Banner>}
      <ShortageDialog open={short} onClose={() => setShort(false)} shipmentId={s.id} remainingKg={remainingKg(s)} remainingCount={remainingCount(s)} unit={unit} minDate={s.entryDate} />
      <CorrectKgDialog open={correct} onClose={() => setCorrect(false)} shipmentId={s.id} netKgActual={s.netKgActual} netKgDoc={s.netKgDoc} leftKg={s.netKgActual - remainingKg(s)} />
      <ShipmentDetailsDialog shipment={s} open={edit} onClose={() => setEdit(false)} firstSaleDate={out.length ? out[out.length - 1].date : undefined} />
      <CancelShipmentDialog open={cancel} onClose={() => setCancel(false)} shipmentId={s.id} productId={s.productId} summary={`${p?.name ?? ""} · ${fmtKg(s.netKgActual, 2)} · hyri ${fmtDate(s.entryDate)}${sup ? ` · ${sup.name}` : ""}`} />
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
          {netKg < s.soldKg - 0.0005 && <Row k="Kthyer nga klientët" v={fmtKg(s.soldKg - netKg, 1)} />}
          {(s.adjustedKg ?? 0) > 0 && <Row k="Mungesa të regjistruara" v={<span className="text-warn">{fmtKg(s.adjustedKg ?? 0, 1)}{s.countActual != null && s.adjustedCount ? ` · ${s.adjustedCount} ${unit}` : ""}</span>} />}
          <Row k="Të ardhura nga ky lot" v={fmtLek(revenue)} /><Row k="Fitim bruto deri tani" v={<span className="text-entry">{fmtLek(soldCost == null ? null : revenue - soldCost)}</span>} />
          <Row k="Vlera e mbetur (kosto)" v={fmtLek(remainingKg(s) === 0 ? 0 : s.costPerKg == null ? null : remainingKg(s) * s.costPerKg)} />
        </CardContent></Card>
      </div>
      {shortages.length > 0 && <Card className="mt-4"><CardHeader><CardTitle>Mungesat e regjistruara</CardTitle></CardHeader><CardContent>
        {shortages.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 text-sm last:border-0"><div><div className="font-medium">{SHORTAGE_LABELS[a.reason]}</div><div className="text-xs text-muted-foreground">{fmtDate(a.date)}{a.note ? ` · ${a.note}` : ""}</div></div><div className="text-right tabular"><div className="text-warn">−{fmtKg(a.kg)}{a.qty ? ` · ${a.qty} ${unit}` : ""}</div><div className="text-xs text-muted-foreground">{s.costPerKg == null ? "kosto e panjohur" : `humbje ${fmtLek(a.kg * s.costPerKg)}`}</div></div></div>)}
      </CardContent></Card>}
      {!!s.corrections?.length && <Card className="mt-4"><CardHeader><CardTitle>Korrigjimet e kg</CardTitle></CardHeader><CardContent>
        {s.corrections.map((k, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 text-sm last:border-0"><div><div className="font-medium">{fmtNum(k.kgBefore, 3)} → {fmtNum(k.kgAfter, 3)} kg</div><div className="text-xs text-muted-foreground">{fmtDate(k.date)} · {k.note}{k.docKgAfter !== k.docKgBefore ? " · u korrigjua edhe pesha e dokumentit" : ""}</div></div><div className="text-right tabular">{k.kgAfter > k.kgBefore ? "+" : "−"}{fmtKg(Math.abs(k.kgAfter - k.kgBefore))}</div></div>)}
      </CardContent></Card>}
      <Card className="mt-4"><CardHeader><CardTitle>Historia e daljeve</CardTitle></CardHeader><CardContent>
        {out.length === 0 && <p className="text-sm text-muted-foreground">Asnjë shitje ende nga ky lot.</p>}
        {out.map((l, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 text-sm last:border-0"><div><div className="font-medium">{l.method === "RETURN" ? l.client : <Link className="hover:underline" href={`/klientet/${l.clientId}`}>{l.client}</Link>}</div><div className="text-xs text-muted-foreground">{fmtDate(l.date)} · {l.qty == null ? "sasi e panjohur" : `${l.qty} ${unit}`} · {saleMethodShort(l.method)}</div></div><div className="text-right tabular"><div>{fmtKg(l.kg)}</div><div className="text-xs text-muted-foreground">{fmtNum(l.pricePerKg)} Lek/kg · {fmtLek(l.total)}</div></div></div>)}
      </CardContent></Card>
    </>
  );
}

/** Removes a load entered by mistake (e.g. saved twice). Offered only while nothing has been sold from it; the server checks again. */
function CancelShipmentDialog({ open, onClose, shipmentId, productId, summary }: { open: boolean; onClose: () => void; shipmentId: string; productId: string; summary: string }) {
  const cancelShipment = useStore(st => st.cancelShipment);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try { router.replace(`/produktet/${productId}`); await cancelShipment(shipmentId); toast.success("Ngarkesa u anulua dhe u hoq nga stoku"); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Anulimi dështoi"); router.replace(`/inventari/${shipmentId}`); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={o => !o && !busy && onClose()}><DialogContent>
    <DialogTitle>Anulo këtë ngarkesë?</DialogTitle>
    <DialogDescription>Përdore vetëm për një ngarkesë të regjistruar gabimisht, p.sh. dy herë. Ngarkesa hiqet plotësisht nga stoku dhe nga raportet. Nuk mund të kthehet mbrapsht.</DialogDescription>
    <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">{summary}</p>
    <div className="mt-4 grid grid-cols-2 gap-3"><Button variant="outline" disabled={busy} onClick={onClose}>Mos e anulo</Button><Button variant="warn" disabled={busy} onClick={confirm}><Trash2 /> {busy ? "Po anulohet…" : "Po, anuloje"}</Button></div>
  </DialogContent></Dialog>;
}

/** Stock that is not physically there (short-loaded, miscounted, sale never recorded, spoiled) is written off
 *  with a reason and date. It leaves stock and is counted as a loss in Financa. */
function ShortageDialog({ open, onClose, shipmentId, remainingKg: maxKg, remainingCount: maxCount, unit, minDate }: { open: boolean; onClose: () => void; shipmentId: string; remainingKg: number; remainingCount: number | null; unit: string; minDate: string }) {
  const recordShortage = useStore(st => st.recordShortage);
  const [kg, setKg] = useState(""); const [qty, setQty] = useState(""); const [reason, setReason] = useState<ShortageReason>("COUNT");
  const [note, setNote] = useState(""); const [date, setDate] = useState(todayInTirane); const [busy, setBusy] = useState(false);
  const requestId = useRef<string | null>(null);
  useEffect(() => { if (open) { requestId.current = null; setKg(String(maxKg)); setQty(maxCount ? String(maxCount) : ""); setReason("COUNT"); setNote(""); setDate(todayInTirane()); } }, [open, maxKg, maxCount]);
  const today = todayInTirane(), nKg = Number(kg), nQty = qty.trim() ? Number(qty) : null;
  const err = !(nKg > 0) ? "Shkruaj kg-të që mungojnë" : nKg > maxKg + 0.0005 ? `Mbeten vetëm ${fmtKg(maxKg)}`
    : nQty != null && (!Number.isInteger(nQty) || nQty < 1 || maxCount == null || nQty > maxCount) ? (maxCount == null ? "Kjo ngarkesë nuk ka numër njësish" : `Numri duhet të jetë 1–${maxCount}`)
    : !date || date > today ? "Data nuk mund të jetë në të ardhmen" : date < minDate ? "Data nuk mund të jetë para hyrjes" : reason === "OTHER" && !note.trim() ? "Shkruaj arsyen" : "";
  const save = async () => {
    if (err || busy) return; setBusy(true);
    try { requestId.current ??= crypto.randomUUID(); await recordShortage(shipmentId, { kg: nKg, qty: nQty, reason, note: note.trim() || undefined, date, requestId: requestId.current }); requestId.current = null; toast.success("Mungesa u regjistrua"); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Regjistrimi dështoi"); }
    finally { setBusy(false); }
  };
  const all = Math.abs(nKg - maxKg) < 0.0005;
  return <Dialog open={open} onOpenChange={o => !o && !busy && onClose()}><DialogContent>
    <DialogTitle>Regjistro mungesë</DialogTitle>
    <DialogDescription>Për mall që nuk ndodhet fizikisht në frigorifer. Hiqet nga stoku dhe llogaritet si humbje te Financa. Regjistrimi mbetet në histori.</DialogDescription>
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Kg që mungojnë</Label><Input type="number" step="0.001" min="0.001" value={kg} onChange={e => { requestId.current = null; setKg(e.target.value); }} /><button type="button" className="mt-1 text-[11px] text-entry underline" onClick={() => { requestId.current = null; setKg(String(maxKg)); setQty(maxCount ? String(maxCount) : ""); }}>e gjithë mbetja ({fmtKg(maxKg)})</button></div>
        <div><Label>Numri i {unit === "paleta" ? "paletave" : "kartonave"} <span className="text-[10px] font-normal text-muted-foreground">(nëse dihet)</span></Label><Input type="number" step="1" min="1" disabled={maxCount == null} value={qty} onChange={e => { requestId.current = null; setQty(e.target.value); }} placeholder={maxCount == null ? "sasi e panjohur" : `maks. ${maxCount}`} /></div>
      </div>
      <div><Label>Arsyeja</Label>
        <div className="grid grid-cols-2 gap-1.5">{(Object.keys(SHORTAGE_LABELS) as ShortageReason[]).map(r => <button key={r} type="button" onClick={() => { requestId.current = null; setReason(r); }} className={cn("rounded-md border px-3 py-2 text-left text-xs", reason === r ? "border-warn bg-warn/10 font-medium text-warn" : "hover:bg-accent")}>{SHORTAGE_LABELS[r]}</button>)}</div>
        <Input className="mt-2" maxLength={300} value={note} onChange={e => { requestId.current = null; setNote(e.target.value); }} placeholder={reason === "OTHER" ? "Shkruaj arsyen" : "Shënim (opsional)"} /></div>
      <div><Label>Data</Label><Input type="date" value={date} min={minDate} max={today} onChange={e => { requestId.current = null; setDate(e.target.value); }} /></div>
      {all && !err && <p className="text-xs text-muted-foreground">Ngarkesa do të dalë nga stoku (0 kg mbetur).</p>}
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      <Button variant="warn" className="w-full" disabled={!!err || busy} onClick={save}><PackageX /> {busy ? "Po regjistrohet…" : "Regjistro mungesën"}</Button>
    </div>
  </DialogContent></Dialog>;
}

/** Corrects the received kilograms of a load entered wrongly (e.g. a typo, or a figure the accountant corrected).
 *  The load keeps its sales; the change is kept with a note under "Korrigjimet e kg" and in Lëvizjet. */
function CorrectKgDialog({ open, onClose, shipmentId, netKgActual, netKgDoc, leftKg }: { open: boolean; onClose: () => void; shipmentId: string; netKgActual: number; netKgDoc: number | null; leftKg: number }) {
  const correctShipmentKg = useStore(st => st.correctShipmentKg);
  const [kg, setKg] = useState(""); const [note, setNote] = useState(""); const [updateDoc, setUpdateDoc] = useState(false); const [busy, setBusy] = useState(false);
  // When the document weight was entered the same as the actual weight, it most likely holds the same mistake.
  useEffect(() => { if (open) { setKg(String(netKgActual)); setNote(""); setUpdateDoc(netKgDoc != null && Math.abs(netKgDoc - netKgActual) < 0.0005); } }, [open, netKgActual, netKgDoc]);
  const n = Number(kg), delta = Math.round((n - netKgActual) * 1000) / 1000, min = Math.max(0.001, Math.round(leftKg * 1000) / 1000);
  const err = !(n > 0) ? "Shkruaj kg-të e sakta" : delta === 0 ? "Shkruaj një vlerë të ndryshme nga ajo aktuale" : n < min - 0.0005 ? `Nga kjo ngarkesë kanë dalë tashmë ${fmtKg(leftKg)}; kg nuk mund të jenë më pak` : !note.trim() ? "Shkruaj arsyen e korrigjimit" : "";
  const save = async () => {
    if (err || busy) return; setBusy(true);
    try { await correctShipmentKg(shipmentId, { netKgActual: n, updateDoc, note: note.trim() }); toast.success("Kg-të e ngarkesës u korrigjuan"); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Korrigjimi dështoi"); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={o => !o && !busy && onClose()}><DialogContent>
    <DialogTitle>Korrigjo kg-të e hyrjes</DialogTitle>
    <DialogDescription>Për një ngarkesë të regjistruar me kg të gabuara. Shitjet nga kjo ngarkesë nuk ndryshojnë; ndryshon vetëm sa ka hyrë dhe sa mbetet. Korrigjimi ruhet në histori me arsyen. Për mall që mungon fizikisht përdor «Regjistro mungesë».</DialogDescription>
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Kg aktuale në sistem</Label><Input value={fmtNum(netKgActual, 3)} disabled /></div>
        <div><Label>Kg të sakta</Label><Input type="number" step="0.001" min={min} value={kg} onChange={e => setKg(e.target.value)} /></div>
      </div>
      {!err && <p className="text-sm">Ndryshimi: <b className={delta > 0 ? "text-entry" : "text-warn"}>{delta > 0 ? "+" : "−"}{fmtKg(Math.abs(delta))}</b> · mbetet në stok {fmtKg(n - leftKg)}</p>}
      {netKgDoc != null && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={updateDoc} onChange={e => setUpdateDoc(e.target.checked)} /><span>Korrigjo edhe peshën e dokumentit ({fmtNum(netKgDoc, 3)} kg)<span className="block text-xs text-muted-foreground">Lëre bosh nëse dokumenti i furnizuesit ishte i saktë dhe gabimi ishte vetëm te pesha faktike.</span></span></label>}
      <div><Label>Arsyeja</Label><Input maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="p.sh. sipas listës së kontabilistes" /></div>
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      <Button className="w-full" disabled={!!err || busy} onClick={save}><Scale /> {busy ? "Po ruhet…" : "Ruaj korrigjimin"}</Button>
    </div>
  </DialogContent></Dialog>;
}
