"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Ban, Pencil, Printer } from "lucide-react";
import { printSale } from "@/lib/print-receipt";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Sale } from "@/lib/types";
import { ClientDialog } from "@/components/entity-dialogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { costOf } from "@/lib/accounting";
import { sumCosts } from "@/lib/costs";
import { useStore } from "@/lib/store";
import { fmtDate, fmtKg, fmtLek, fmtNum } from "@/lib/utils";
import { shipmentLabel } from "@/lib/stock";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { clients, sales, products, shipments } = useStore();
  const [edit, setEdit] = useState(false);
  const [cancelling, setCancelling] = useState<Sale | null>(null);
  const c = clients.find(x => x.id === id); if (!c) return <p className="text-muted-foreground">Klienti nuk u gjet.</p>;
  const mine = sales.filter(s => s.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date));
  const total = mine.reduce((a, s) => a + s.totalValue, 0), kg = mine.reduce((a, s) => a + s.totalKg, 0);
  const cogs = sumCosts(mine.flatMap(s => s.lines).map(l => costOf(l, shipments)));
  const profit = cogs == null ? null : total - cogs;
  return (
    <>
      <PageHeader title={c.name} sub={`${c.city}${c.contact ? ` · ${c.contact}` : ""}${c.phone ? ` · ${c.phone}` : ""}`} right={<div className="flex gap-2"><Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Ndrysho</Button><Button asChild variant="ghost"><Link href="/klientet"><ArrowLeft /> Klientët</Link></Button></div>} />
      <ClientDialog open={edit} client={c} onClose={() => setEdit(false)} />
      <CancelSaleDialog sale={cancelling} clientName={c.name} onClose={() => setCancelling(null)} />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">{[["Porosi", String(mine.filter(s => !s.isReturn).length)], ["Kg gjithsej", fmtKg(kg, 0)], ["Të ardhura", fmtLek(total)], ["Fitim bruto", fmtLek(profit)]].map(([k, v]) => <div key={k} className="rounded-lg bg-card p-4"><div className="text-[11px] text-muted-foreground">{k}</div><div className="mt-1 text-lg font-semibold tabular">{v}</div></div>)}</div>
      <Card><CardHeader><CardTitle>Historia e porosive</CardTitle></CardHeader><CardContent className="space-y-3">
        {mine.map(s => <div key={s.id} className="rounded-md border p-3 text-sm"><div className="mb-2 flex justify-between"><span className="font-medium">{fmtDate(s.date)}{s.receiptNr != null && <span className="ml-2 text-xs font-normal text-muted-foreground">Fletë porosi nr. {s.receiptNr}</span>}{s.isReturn && <span className="ml-2 rounded bg-entry/15 px-1.5 py-0.5 text-[10px] text-entry">KTHIM · kredit</span>}</span><span className="flex items-center gap-3"><span className={s.isReturn ? "tabular text-entry" : "tabular text-exit"}>{fmtLek(s.totalValue)}</span>{!s.isReturn && <button type="button" onClick={() => { if (!printSale(s, clients, products)) toast.error("Shfletuesi bllokoi dritaren e printimit. Lejo dritaret pop-up për këtë faqe."); }} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"><Printer className="h-3 w-3" /> Fatura</button>}{!s.isReturn && (shipments.some(sh => sh.returnOf?.saleId === s.id) ? <span className="text-[11px] text-muted-foreground" title="Anulo kthimet e kësaj shitjeje më parë">ka kthime</span> : <button type="button" onClick={() => setCancelling(s)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-warn"><Ban className="h-3 w-3" /> Anulo</button>)}</span></div>{s.lines.map((l, i) => <div key={i} className="flex justify-between py-1 text-xs text-muted-foreground"><span>{products.find(p => p.id === l.productId)?.name} · {(() => { const sh = shipments.find(x => x.id === l.shipmentId); return sh ? shipmentLabel(sh) : "—"; })()} · {l.qty == null ? "sasi e panjohur" : `${Math.abs(l.qty)} ${shipments.find(x => x.id === l.shipmentId)?.loadType === "PALLET" ? "paleta" : "kartona"}`}</span><span className="tabular">{fmtKg(l.kg)} × {fmtNum(l.pricePerKg, 2)}</span></div>)}</div>)}
        {!mine.length && <p className="text-sm text-muted-foreground">Ky klient nuk ka porosi ende.</p>}
      </CardContent></Card>
    </>
  );
}

/** Cancels a sale recorded by mistake. Its kilograms go back to the loads they came from; the sale is kept in the
 *  history (Lëvizjet → Anuluar) and the correct sale is entered again in Dalje with the original date. */
function CancelSaleDialog({ sale, clientName, onClose }: { sale: Sale | null; clientName: string; onClose: () => void }) {
  const cancelSale = useStore(st => st.cancelSale);
  const { products, shipments } = useStore();
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const close = () => { if (!busy) { setReason(""); onClose(); } };
  const confirm = async () => {
    if (!sale || !reason.trim() || busy) return; setBusy(true);
    try { await cancelSale(sale.id, reason.trim()); toast.success("Shitja u anulua dhe mallrat u kthyen në stok. Regjistroje sërish te Dalje me datën e saj."); setReason(""); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Anulimi dështoi"); }
    finally { setBusy(false); }
  };
  return <Dialog open={!!sale} onOpenChange={o => !o && close()}><DialogContent>
    <DialogTitle>Anulo këtë shitje?</DialogTitle>
    <DialogDescription>Përdore për një shitje të regjistruar gabim (ngarkesë, klient, sasi ose çmim i gabuar). Kg-të kthehen në ngarkesat nga ku dolën dhe shitja hiqet nga raportet. Shitja mbetet në histori si e anuluar. Pastaj regjistro shitjen e saktë te Dalje me të njëjtën datë.</DialogDescription>
    {sale && <div className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm"><div className="mb-1 flex justify-between font-medium"><span>{clientName} · {fmtDate(sale.date)}</span><span className="tabular">{fmtLek(sale.totalValue)}</span></div>
      {sale.lines.map((l, i) => { const sh = shipments.find(x => x.id === l.shipmentId); return <div key={i} className="flex justify-between text-xs text-muted-foreground"><span>{products.find(p => p.id === l.productId)?.name} · {sh ? shipmentLabel(sh) : "—"}</span><span className="tabular">{fmtKg(l.kg)} × {fmtNum(l.pricePerKg, 2)}</span></div>; })}</div>}
    <div className="mt-3"><Label>Arsyeja e anulimit</Label><Input maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="p.sh. Lardello u regjistrua nga ngarkesa e gabuar" /></div>
    <div className="mt-4 grid grid-cols-2 gap-3"><Button variant="outline" disabled={busy} onClick={close}>Mos e anulo</Button><Button variant="warn" disabled={busy || !reason.trim()} onClick={confirm}><Ban /> {busy ? "Po anulohet…" : "Po, anuloje"}</Button></div>
  </DialogContent></Dialog>;
}
