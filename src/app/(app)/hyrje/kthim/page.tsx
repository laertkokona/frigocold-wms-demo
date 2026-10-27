"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronRight, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecimalInput, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banner } from "@/components/ui/banner";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "@/components/shell";
import { SearchBox, matches } from "@/components/search-box";
import { useStore } from "@/lib/store";
import { loadSpecLabel, shipmentLabel } from "@/lib/stock";
import { cn, fmtDate, fmtKg, fmtLek, fmtNum, todayInTirane } from "@/lib/utils";

type Step = "client" | "line" | "form" | "done";
const REASONS = [
  { value: "Produkt i dëmtuar / cilësi e dobët", label: "I dëmtuar / cilësi" },
  { value: "Gabim në porosi", label: "Gabim në porosi" },
  { value: "Tepricë / klienti nuk e deshi", label: "Tepricë" },
  { value: "Tjetër", label: "Tjetër" },
];
const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } };

/** A client sends goods back: pick the sale they came from; product, lot, dates, specs and cost are copied
 *  onto a new load marked as a return, and the client is credited for the returned kilograms. */
export default function KthimPage() {
  const store = useStore();
  const [step, setStep] = useState<Step>("client");
  const [clientId, setClientId] = useState("");
  const [lineId, setLineId] = useState("");
  const [qClient, setQClient] = useState(""); const [qLine, setQLine] = useState("");
  const [kg, setKg] = useState(""); const [qty, setQty] = useState(""); const [price, setPrice] = useState("");
  const [reason, setReason] = useState(REASONS[0].value); const [note, setNote] = useState("");
  const [date, setDate] = useState(todayInTirane);
  const [saving, setSaving] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const today = todayInTirane();

  // Every sold line with what has already come back from it.
  const lines = useMemo(() => store.sales.filter(s => !s.isReturn).flatMap(s => s.lines.filter(l => l.lineId).map(l => {
    const returned = store.shipments.filter(x => x.returnOf?.lineId === l.lineId);
    const backKg = returned.reduce((n, x) => n + x.netKgActual, 0), backQty = returned.reduce((n, x) => n + (x.countActual ?? 0), 0);
    return { ...l, saleId: s.id, date: s.date, clientId: s.clientId, backKg, backQty, maxKg: +(l.kg - backKg).toFixed(3), maxQty: l.qty == null ? null : l.qty - backQty };
  })).sort((a, b) => b.date.localeCompare(a.date)), [store.sales, store.shipments]);
  const clients = useMemo(() => store.clients.map(c => ({ c, last: lines.find(l => l.clientId === c.id)?.date })).filter(x => x.last).sort((a, b) => b.last!.localeCompare(a.last!)), [store.clients, lines]);
  const pname = (id: string) => store.products.find(p => p.id === id)?.name ?? "—";
  const line = lines.find(l => l.lineId === lineId);
  const original = line ? store.shipments.find(s => s.id === line.shipmentId) : undefined;
  const client = store.clients.find(c => c.id === clientId);
  const unit = original?.loadType === "PALLET" ? "paleta" : "kartona";

  const nKg = Number(kg), nQty = qty.trim() ? Number(qty) : null, nPrice = Number(price);
  const err = !line ? "" : !(nKg > 0) ? "Shkruaj kg-të e kthyera" : nKg > line.maxKg + 0.0005 ? `Maksimumi që mund të kthehet nga kjo shitje: ${fmtKg(line.maxKg)}`
    : nQty != null && (!Number.isInteger(nQty) || nQty < 1) ? `Numri i ${unit === "paleta" ? "paletave" : "kartonave"} duhet të jetë numër i plotë pozitiv`
    : nQty != null && line.maxQty != null && nQty > line.maxQty ? `Maksimumi: ${line.maxQty} ${unit}` : !(nPrice >= 0) || price.trim() === "" ? "Shkruaj çmimin e kreditimit"
    : !date || date > today ? "Data nuk mund të jetë në të ardhmen" : date < line.date ? "Data nuk mund të jetë para shitjes" : reason === "Tjetër" && !note.trim() ? "Shkruaj arsyen" : "";

  const pickLine = (id: string) => {
    const l = lines.find(x => x.lineId === id); if (!l) return;
    requestId.current = null; setLineId(id); setKg(String(l.maxKg)); setQty(""); setPrice(String(l.pricePerKg)); setReason(REASONS[0].value); setNote(""); setDate(today); setStep("form");
  };
  const save = async () => {
    if (!line || err || saving) return;
    setSaving(true);
    try {
      requestId.current ??= crypto.randomUUID();
      const text = [reason === "Tjetër" ? "" : reason, note.trim()].filter(Boolean).join(" — ");
      const created = await store.addReturn({ saleLineId: line.lineId!, kg: nKg, qty: nQty, pricePerKg: nPrice, reason: text, entryDate: date, requestId: requestId.current });
      requestId.current = null; setDoneId(created.id); setStep("done"); toast.success("Kthimi u regjistrua");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Kthimi nuk u regjistrua"); }
    finally { setSaving(false); }
  };

  return (
    <AnimatePresence mode="wait">
      {step === "client" && (
        <motion.div key="client" {...fade}>
          <PageHeader title="Kthim nga klienti" sub="Zgjidh klientin që e ktheu mallin" right={<Button asChild variant="ghost"><Link href="/hyrje"><ArrowLeft /> Hyrje</Link></Button>} />
          <SearchBox value={qClient} onChange={setQClient} placeholder="Kërko klientin…" autoFocus />
          <div className="space-y-1.5">
            {clients.filter(x => matches(qClient, x.c.name, x.c.city)).map(({ c, last }) => (
              <button key={c.id} onClick={() => { setClientId(c.id); setQLine(""); setStep("line"); }} className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left text-sm hover:border-entry/60">
                <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.city} · shitja e fundit {fmtDate(last!)}</div></div><ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>))}
            {!clients.length && <p className="py-8 text-center text-sm text-muted-foreground">Asnjë shitje e regjistruar ende.</p>}
          </div>
        </motion.div>
      )}

      {step === "line" && client && (
        <motion.div key="line" {...fade}>
          <PageHeader title={`Çfarë ktheu ${client.name}?`} sub="Zgjidh produktin nga shitja ku u dërgua" right={<Button variant="ghost" onClick={() => setStep("client")}><ArrowLeft /></Button>} />
          <SearchBox value={qLine} onChange={setQLine} placeholder="Kërko produktin ose lotin…" autoFocus />
          <div className="space-y-1.5">
            {lines.filter(l => l.clientId === client.id).filter(l => { const s = store.shipments.find(x => x.id === l.shipmentId); return matches(qLine, pname(l.productId), s ? shipmentLabel(s) : ""); }).map(l => {
              const s = store.shipments.find(x => x.id === l.shipmentId); const full = l.maxKg <= 0;
              return (
                <button key={l.lineId} disabled={full} onClick={() => pickLine(l.lineId!)} className={cn("flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left text-sm hover:border-entry/60", full && "cursor-not-allowed opacity-50")}>
                  <div><div className="font-medium">{pname(l.productId)} · {s ? shipmentLabel(s) : "—"}</div>
                    <div className="text-xs text-muted-foreground">Shitur {fmtDate(l.date)} · {fmtKg(l.kg)}{l.qty != null ? ` · ${l.qty} ${s?.loadType === "PALLET" ? "paleta" : "kartona"}` : ""} · {fmtNum(l.pricePerKg, 2)} Lek/kg{l.backKg > 0 ? ` · kthyer tashmë ${fmtKg(l.backKg)}` : ""}</div></div>
                  {full ? <span className="text-xs text-muted-foreground">kthyer plotësisht</span> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>); })}
          </div>
        </motion.div>
      )}

      {step === "form" && line && client && (
        <motion.div key="form" {...fade}>
          <PageHeader title={`Kthim — ${pname(line.productId)}`} sub={`${client.name} · shitur ${fmtDate(line.date)}`} right={<Button variant="ghost" onClick={() => setStep("line")}><ArrowLeft /></Button>} />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 text-sm">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Plotësohen automatikisht nga ngarkesa e shitur</div>
              {original ? <>
                <Row k="Ngarkesa" v={<Link className="underline" href={`/inventari/${original.id}`}>{shipmentLabel(original)}</Link>} />
                <Row k="Specifikimet" v={loadSpecLabel(original) || "—"} />
                <Row k="Prodhimi" v={original.prodFrom ? fmtDate(original.prodFrom) + (original.prodTo ? ` – ${fmtDate(original.prodTo)}` : "") : "—"} />
                <Row k="Skadimi" v={fmtDate(original.expFrom) + (original.expTo ? ` – ${fmtDate(original.expTo)}` : "")} />
                <Row k="Kosto / kg" v={original.costPerKg == null ? "e panjohur" : `${fmtNum(original.costPerKg, 2)} Lek`} />
                <Row k="Shitur në këtë rresht" v={`${fmtKg(line.kg)}${line.qty != null ? ` · ${line.qty} ${unit}` : ""} · ${fmtNum(line.pricePerKg, 2)} Lek/kg`} />
                {line.backKg > 0 && <Row k="Kthyer më parë" v={fmtKg(line.backKg)} />}
              </> : <p className="text-muted-foreground">Ngarkesa origjinale nuk u gjet.</p>}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kg të kthyera <span className="text-danger">*</span></Label><DecimalInput value={kg} onChange={e => { requestId.current = null; setKg(e.target.value); }} className="h-12 text-lg font-semibold" /><p className="mt-1 text-[11px] text-muted-foreground">maks. {fmtKg(line.maxKg)}</p></div>
                <div><Label>Numri i {unit === "paleta" ? "paletave" : "kartonave"} <span className="text-[10px] font-normal text-muted-foreground">(nëse dihet)</span></Label><Input type="number" inputMode="numeric" step="1" min="1" value={qty} onChange={e => { requestId.current = null; setQty(e.target.value); }} className="h-12 text-lg font-semibold" />{line.maxQty != null && <p className="mt-1 text-[11px] text-muted-foreground">maks. {line.maxQty}</p>}</div>
              </div>
              <div><Label>Arsyeja</Label><Segmented value={reason} onChange={v => { requestId.current = null; setReason(v); }} options={REASONS} />
                <Input className="mt-2" value={note} onChange={e => { requestId.current = null; setNote(e.target.value); }} placeholder={reason === "Tjetër" ? "Shkruaj arsyen" : "Shënim (opsional), p.sh. kartonë të shkrirë"} maxLength={150} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kreditimi për klientin (Lek/kg)</Label><DecimalInput value={price} onChange={e => { requestId.current = null; setPrice(e.target.value); }} /><p className="mt-1 text-[11px] text-muted-foreground">Çmimi i shitjes: {fmtNum(line.pricePerKg, 2)} Lek/kg</p></div>
                <div><Label>Data e kthimit</Label><Input type="date" value={date} min={line.date} max={today} onChange={e => { requestId.current = null; setDate(e.target.value); }} /></div>
              </div>
              <div className="rounded-lg bg-entry/10 p-4 text-sm text-entry tabular">
                <div className="flex justify-between"><span>Hyn në stok si ngarkesë &quot;kthim&quot;</span><span>{nKg > 0 ? fmtKg(nKg) : "—"}</span></div>
                <div className="mt-1 flex justify-between border-t border-entry/30 pt-2 font-medium"><span>Kredit për {client.name}</span><span>{nKg > 0 && nPrice >= 0 ? fmtLek(nKg * nPrice) : "—"}</span></div>
                <p className="mt-2 text-xs opacity-80">Të ardhurat dhe fitimi i kësaj shitjeje ulen me këtë kredit në datën e kthimit.</p>
              </div>
              {err ? <p className="text-xs text-danger">{err}</p> : null}
              <Button variant="entry" size="lg" className="w-full" disabled={!!err || saving} onClick={save}><Undo2 /> {saving ? "Po regjistrohet…" : "Regjistro kthimin"}</Button>
            </div>
          </div>
        </motion.div>
      )}

      {step === "done" && (
        <motion.div key="done" {...fade} className="mx-auto max-w-sm py-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-entry/40 bg-entry/15"><Check className="h-8 w-8 text-entry" /></div>
          <h2 className="text-lg font-semibold">Kthimi u regjistrua</h2>
          <p className="mb-5 text-sm text-muted-foreground">{line ? `${pname(line.productId)} · ${fmtKg(nKg)}` : ""} hyri në stok si ngarkesë &quot;kthim&quot;.</p>
          <Banner className="mb-4 text-left">Nëse malli është i prishur dhe nuk do të shitet, hape ngarkesën dhe regjistroje si mungesë (&quot;I dëmtuar / i prishur&quot;).</Banner>
          <div className="grid gap-2">{doneId && <Button asChild variant="outline"><Link href={`/inventari/${doneId}`}>Hap ngarkesën e kthimit</Link></Button>}<Button variant="entry" onClick={() => { setStep("client"); setLineId(""); setDoneId(null); }}>Kthim tjetër</Button></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-3 border-b py-2 last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
