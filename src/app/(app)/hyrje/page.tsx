"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, ChevronRight, ClipboardList, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shell";
import { remainingKg, useStore } from "@/lib/store";
import type { DateMode, Draft, LoadType, LotAlloc, Product, WeightType } from "@/lib/types";
import { cn, fmtDate, fmtKg, fmtLek, fmtNum, TODAY } from "@/lib/utils";

type Step = "product" | "form" | "review" | "done";
type CostUnit = "kg" | "ton";

interface Form {
  orderNr: string; supplierId: string; loadType: LoadType;
  countDoc: string; countActual: string; netKgDoc: string; netKgActual: string;
  lots: { lotNumber: string; qty: string }[];
  costUnit: CostUnit; costVal: string;
  dateMode: DateMode; prodFrom: string; prodTo: string; expFrom: string; expTo: string;
}
const emptyForm = (): Form => ({ orderNr: "", supplierId: "", loadType: "CARTON", countDoc: "", countActual: "", netKgDoc: "", netKgActual: "", lots: [{ lotNumber: "", qty: "" }], costUnit: "kg", costVal: "", dateMode: "FIXED", prodFrom: "", prodTo: "", expFrom: "", expTo: "" });

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } };

export default function HyrjePage() {
  const store = useStore();
  const [step, setStep] = useState<Step>("product");
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [draftId, setDraftId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [newProd, setNewProd] = useState(false);
  const [newSup, setNewSup] = useState(false);
  const [saved, setSaved] = useState<{ count: number; kg: number; total: number } | null>(null);

  const unit = form.loadType === "CARTON" ? "kartona" : "paleta";
  const cntDoc = +form.countDoc || 0, cntAct = +form.countActual || 0, wDoc = +form.netKgDoc || 0, wAct = +form.netKgActual || 0;
  const perKg = form.costUnit === "kg" ? (+form.costVal || 0) : (+form.costVal || 0) / 1000;
  const total = wAct * perKg;
  const lotSum = form.lots.reduce((a, l) => a + (+l.qty || 0), 0);
  const avg = cntAct > 0 ? wAct / cntAct : 0;
  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));

  const filtered = useMemo(() => store.products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())), [q, store.products]);
  const stockOf = (p: Product) => store.shipments.filter(s => s.productId === p.id && remainingKg(s) > 0);

  const pick = (p: Product) => { setProduct(p); setForm(emptyForm()); setDraftId(null); setStep("form"); };
  const resume = (d: Draft) => {
    const p = store.products.find(x => x.id === d.productId); if (!p) return;
    const x = d.data;
    setProduct(p); setDraftId(d.id);
    setForm({
      orderNr: x.orderNr ?? "", supplierId: x.supplierId ?? "", loadType: x.loadType ?? "CARTON",
      countDoc: x.countDoc?.toString() ?? "", countActual: x.countActual?.toString() ?? "", netKgDoc: x.netKgDoc?.toString() ?? "", netKgActual: x.netKgActual?.toString() ?? "",
      lots: (x.lots?.length ? x.lots : [{ lotNumber: "", qty: 0 }]).map(l => ({ lotNumber: l.lotNumber, qty: l.qty ? String(l.qty) : "" })),
      costUnit: "kg", costVal: x.costPerKg?.toString() ?? "",
      dateMode: x.dateMode ?? "FIXED", prodFrom: x.prodFrom ?? "", prodTo: x.prodTo ?? "", expFrom: x.expFrom ?? "", expTo: x.expTo ?? "",
    });
    setStep("form"); toast("Drafti u rikthye — vazhdo aty ku e le");
  };
  const toDraftData = () => ({
    orderNr: form.orderNr, supplierId: form.supplierId, loadType: form.loadType,
    countDoc: cntDoc, countActual: cntAct, netKgDoc: wDoc, netKgActual: wAct,
    lots: form.lots.filter(l => l.lotNumber).map(l => ({ lotNumber: l.lotNumber, qty: +l.qty || 0 })),
    costPerKg: perKg, totalCost: total, dateMode: form.dateMode,
    prodFrom: form.prodFrom, prodTo: form.dateMode === "RANGE" ? form.prodTo : undefined, expFrom: form.expFrom, expTo: form.dateMode === "RANGE" ? form.expTo : undefined,
  });
  const saveDraft = () => { if (!product) return; const d = store.saveDraft({ id: draftId ?? undefined, productId: product.id, data: toDraftData() }); setDraftId(d.id); toast.success("Drafti u ruajt"); setStep("product"); };
  const canReview = form.orderNr && form.supplierId && cntAct > 0 && wAct > 0 && perKg > 0 && form.expFrom;
  const finalize = () => {
    if (!product) return;
    const lots: LotAlloc[] = form.lots.filter(l => l.lotNumber).map(l => ({ lotNumber: l.lotNumber, qty: +l.qty || 0 }));
    store.addShipment({ productId: product.id, supplierId: form.supplierId, orderNr: form.orderNr, loadType: form.loadType, countDoc: cntDoc, countActual: cntAct, netKgDoc: wDoc, netKgActual: wAct, lots, costPerKg: perKg, totalCost: total, dateMode: form.dateMode, prodFrom: form.prodFrom, prodTo: form.dateMode === "RANGE" ? form.prodTo : undefined, expFrom: form.expFrom, expTo: form.dateMode === "RANGE" ? form.expTo : undefined });
    if (draftId) store.deleteDraft(draftId);
    setSaved({ count: cntAct, kg: wAct, total }); setStep("done"); toast.success("Dërgesa u regjistrua");
  };
  const reset = () => { setStep("product"); setProduct(null); setForm(emptyForm()); setDraftId(null); setSaved(null); };
  const supplier = store.suppliers.find(s => s.id === form.supplierId);

  return (
    <AnimatePresence mode="wait">
      {step === "product" && (
        <motion.div key="product" {...fade}>
          <PageHeader title="Hyrje e re" sub="Zgjidh produktin që po pranohet" />
          {store.drafts.length > 0 && (
            <section className="mb-6" aria-label="Draft-e">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>Draft-e të papërfunduara</span><span className="text-warn">{store.drafts.length}</span></div>
              <div className="space-y-2">
                {store.drafts.map(d => { const p = store.products.find(x => x.id === d.productId); return (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3">
                    <button onClick={() => resume(d)} className="flex flex-1 items-center gap-3 text-left">
                      <Save className="h-4 w-4 shrink-0 text-warn" />
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-warn">Porosia {d.data.orderNr || "—"} · {p?.name}</div><div className="text-xs text-warn/80">{d.data.countActual ?? 0} {d.data.loadType === "PALLET" ? "paleta" : "kartona"} · {fmtNum(d.data.netKgActual ?? 0)} kg · ruajtur {new Date(d.savedAt).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}</div></div>
                    </button>
                    <Button variant="ghost" size="icon" aria-label="Fshi draftin" onClick={() => { store.deleteDraft(d.id); toast("Drafti u fshi"); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>); })}
              </div>
            </section>
          )}
          <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Kërko produktin…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" /></div>
          <div className="space-y-2">
            {filtered.map(p => { const sh = stockOf(p); const kg = sh.reduce((a, s) => a + remainingKg(s), 0); return (
              <button key={p.id} onClick={() => pick(p)} className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-left transition-colors hover:border-entry/60">
                <div><div className="text-sm font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{sh.length} dërgesa aktive · {fmtKg(kg, 0)}</div></div>
                <div className="flex items-center gap-2"><Badge variant={p.weightType === "PALLET" ? "warn" : p.weightType === "FIXED" ? "entry" : "exit"}>{p.weightType === "PALLET" ? "paleta" : p.weightType === "FIXED" ? `fikse ${p.fixedKg} kg` : "variabile"}</Badge><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
              </button>); })}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Asnjë produkt me këtë emër. Krijo një të ri më poshtë.</p>}
          </div>
          <Button variant="outline" className="mt-3 w-full" onClick={() => setNewProd(true)}><Plus /> Produkt i ri</Button>
          <NewProductDialog open={newProd} onClose={() => setNewProd(false)} onCreate={p => { setNewProd(false); pick(p); }} />
        </motion.div>
      )}

      {step === "form" && product && (
        <motion.div key="form" {...fade}>
          <PageHeader title={`Dërgesë e re — ${product.name}`} sub={draftId ? "Draft i rikthyer" : "Hapi 2 nga 3"} right={<Button variant="ghost" onClick={() => setStep("product")}><ArrowLeft /> Produktet</Button>} />
          <Banner className="mb-6"><ClipboardList className="mr-1 inline h-3.5 w-3.5" />Plotëso sipas fletë-ngarkesës dhe shkarkimit faktik. Fushat "faktike" plotësohen vetë — ndryshoji vetëm nëse ka mospërputhje.</Banner>

          <Section n={1} title="Të dhënat e porosisë">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Nr. i porosisë <Req /></Label><Input value={form.orderNr} onChange={e => set({ orderNr: e.target.value })} placeholder="p.sh. 4471" /><Hint>Disa produkte mund të ndajnë të njëjtin nr. porosie</Hint></div>
              <div><Label>Furnizuesi <Req /></Label>
                <Select value={form.supplierId} onValueChange={v => v === "__new" ? setNewSup(true) : set({ supplierId: v })}>
                  <SelectTrigger><SelectValue placeholder="Zgjidh furnizuesin" /></SelectTrigger>
                  <SelectContent>{store.suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.country})</SelectItem>)}<SelectItem value="__new">+ Furnizues i ri…</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Data e hyrjes</Label><div className="flex h-11 items-center gap-2 rounded-md bg-secondary px-3 text-sm text-muted-foreground"><CalendarCheck className="h-4 w-4 text-entry" />{fmtDate(TODAY)} · regjistrohet automatikisht</div></div>
            </div>
          </Section>

          <Section n={2} title="Forma e ngarkesës">
            <div className="max-w-sm"><Label>Si vjen ngarkesa?</Label><Segmented value={form.loadType} onChange={v => set({ loadType: v })} options={[{ value: "CARTON", label: "Kartona" }, { value: "PALLET", label: "Paleta" }]} /><Hint>{form.loadType === "CARTON" ? "Produkt i ndarë në kartona individuale" : "Produkt i pandashëm — vjen mbi paleta me peshë totale"}</Hint></div>
            <DualField label={`Numri i ${unit}`} doc={form.countDoc} act={form.countActual} onDoc={v => set({ countDoc: v, countActual: v })} onAct={v => set({ countActual: v })} diff={cntAct - cntDoc} fmt={d => `${d > 0 ? "+" : ""}${d}`} />
            <DualField label="Pesha neto totale (kg)" doc={form.netKgDoc} act={form.netKgActual} onDoc={v => set({ netKgDoc: v, netKgActual: v })} onAct={v => set({ netKgActual: v })} diff={+(wAct - wDoc).toFixed(2)} fmt={d => `${d > 0 ? "+" : ""}${d.toFixed(2)} kg`} step="0.01" hint={avg > 0 ? `Mesatarisht ${avg.toFixed(2)} kg / ${form.loadType === "CARTON" ? "karton" : "paletë"}` : undefined} />
          </Section>

          <Section n={3} title="Lotet">
            <Hint className="mb-3">Nëse ngarkesa vjen nga disa lote, shto secilin me sasinë përkatëse të {unit}.</Hint>
            <div className="space-y-2">
              {form.lots.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_44px] gap-2">
                  <Input placeholder="Nr. i lotit" value={l.lotNumber} onChange={e => set({ lots: form.lots.map((x, j) => j === i ? { ...x, lotNumber: e.target.value } : x) })} />
                  <Input type="number" placeholder="Sasia" value={l.qty} onChange={e => set({ lots: form.lots.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) })} />
                  <Button variant="outline" size="icon" aria-label="Hiq lotin" disabled={form.lots.length <= 1} onClick={() => set({ lots: form.lots.filter((_, j) => j !== i) })}><X /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => set({ lots: [...form.lots, { lotNumber: "", qty: "" }] })}><Plus /> Shto lot</Button>
            {cntAct > 0 && <div className={cn("mt-3 flex items-center justify-between rounded-md px-3 py-2 text-xs", lotSum === cntAct ? "bg-entry/10 text-entry" : "bg-warn/10 text-warn")}><span>Shuma e loteve</span><span className="tabular">{lotSum} / {cntAct} {unit}</span></div>}
          </Section>

          <Section n={4} title="Kosto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Njësia e kostos</Label><Segmented value={form.costUnit} onChange={v => set({ costUnit: v })} options={[{ value: "kg", label: "për kg" }, { value: "ton", label: "për ton" }]} /></div>
              <div><Label>Kosto totale {form.costUnit === "kg" ? "për kg" : "për ton"} (Lek) <Req /></Label><Input type="number" value={form.costVal} onChange={e => set({ costVal: e.target.value })} placeholder={form.costUnit === "kg" ? "p.sh. 340" : "p.sh. 340000"} /><Hint>Përfshin transportin, doganën etj. — dhënë nga financa</Hint></div>
            </div>
            <div className="mt-3 rounded-lg bg-secondary p-4">
              <Row k="Pesha neto faktike" v={fmtKg(wAct)} /><Row k="Kosto për kg" v={fmtNum(perKg, 2) + " Lek"} />
              <div className="mt-2 flex items-center justify-between border-t pt-3"><span className="text-sm font-medium">Vlera totale e dërgesës</span><span className="text-xl font-semibold text-entry tabular">{fmtLek(total)}</span></div>
            </div>
          </Section>

          <Section n={5} title="Datat">
            <div className="max-w-sm"><Label>Lloji i datave</Label><Segmented value={form.dateMode} onChange={v => set({ dateMode: v })} options={[{ value: "FIXED", label: "Data fikse" }, { value: "RANGE", label: "Interval datash" }]} /></div>
            {form.dateMode === "FIXED" ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2"><div><Label>Data e prodhimit</Label><Input type="date" value={form.prodFrom} onChange={e => set({ prodFrom: e.target.value })} /></div><div><Label>Data e skadimit <Req /></Label><Input type="date" value={form.expFrom} onChange={e => set({ expFrom: e.target.value })} /></div></div>
            ) : (
              <div className="mt-3 space-y-3">
                <div><Label>Prodhimi — nga / deri</Label><div className="grid grid-cols-2 gap-2"><Input type="date" value={form.prodFrom} onChange={e => set({ prodFrom: e.target.value })} /><Input type="date" value={form.prodTo} onChange={e => set({ prodTo: e.target.value })} /></div></div>
                <div><Label>Skadimi — nga / deri <Req /></Label><div className="grid grid-cols-2 gap-2"><Input type="date" value={form.expFrom} onChange={e => set({ expFrom: e.target.value })} /><Input type="date" value={form.expTo} onChange={e => set({ expTo: e.target.value })} /></div></div>
                <Banner tone="warn">Alarmet dhe rendi i shitjes (FEFO) bazohen te data <b>më e hershme</b>{form.expFrom ? `: ${fmtDate(form.expFrom)}` : ""}.</Banner>
              </div>
            )}
          </Section>

          <div className="mt-2 grid max-w-md grid-cols-2 gap-3">
            <Button variant="warn" size="lg" onClick={saveDraft}><Save /> Ruaj si draft</Button>
            <Button variant="entry" size="lg" disabled={!canReview} onClick={() => setStep("review")}>Verifiko <ArrowRight /></Button>
          </div>
          {!canReview && <p className="mt-2 text-xs text-muted-foreground">Për të verifikuar duhen: nr. porosie, furnizuesi, sasia dhe pesha faktike, kostoja dhe data e skadimit.</p>}
          <NewSupplierDialog open={newSup} onClose={() => setNewSup(false)} onCreate={s => { setNewSup(false); set({ supplierId: s.id }); }} />
        </motion.div>
      )}

      {step === "review" && product && (
        <motion.div key="review" {...fade}>
          <PageHeader title="Verifiko dërgesën" sub="Hapi 3 nga 3" right={<Button variant="ghost" onClick={() => setStep("form")}><ArrowLeft /> Ndrysho</Button>} />
          <div className="mb-4 space-y-2">
            {cntDoc !== cntAct && <Banner tone="warn"><b>Mospërputhje sasie.</b> Dokumenti: {cntDoc} · Faktik: {cntAct} ({cntAct - cntDoc > 0 ? "+" : ""}{cntAct - cntDoc} {unit}). Do të regjistrohet me dërgesën.</Banner>}
            {wDoc !== wAct && <Banner tone="warn"><b>Mospërputhje peshe.</b> Dokumenti: {fmtKg(wDoc)} · Faktike: {fmtKg(wAct)} ({wAct - wDoc > 0 ? "+" : ""}{(wAct - wDoc).toFixed(2)} kg).</Banner>}
            {lotSum !== cntAct && <Banner tone="warn"><b>Lotet nuk përputhen.</b> Shuma e loteve: {lotSum} · Totali: {cntAct}.</Banner>}
          </div>
          <div className="grid gap-x-8 gap-y-1 rounded-lg border bg-card p-5 sm:grid-cols-2">
            <Row k="Produkti" v={product.name} /><Row k="Pesha neto" v={fmtKg(wAct)} />
            <Row k="Nr. porosie" v={form.orderNr} /><Row k="Lotet" v={form.lots.filter(l => l.lotNumber).map(l => `${l.lotNumber} (${l.qty || 0})`).join(", ") || "—"} />
            <Row k="Furnizuesi" v={supplier?.name ?? "—"} /><Row k="Kosto / kg" v={fmtNum(perKg, 2) + " Lek"} />
            <Row k="Forma" v={form.loadType === "CARTON" ? "Kartona" : "Paleta"} /><Row k="Vlera totale" v={<span className="text-entry">{fmtLek(total)}</span>} />
            <Row k="Sasia" v={`${cntAct} ${unit}`} /><Row k="Skadimi" v={form.expFrom ? fmtDate(form.expFrom) + (form.dateMode === "RANGE" ? " (më e hershmja)" : "") : "—"} />
          </div>
          <div className="mt-4 grid max-w-md grid-cols-2 gap-3"><Button variant="outline" size="lg" onClick={() => setStep("form")}>Kthehu & ndrysho</Button><Button variant="entry" size="lg" onClick={finalize}><Check /> Ruaj dërgesën</Button></div>
        </motion.div>
      )}

      {step === "done" && product && saved && (
        <motion.div key="done" {...fade} className="mx-auto max-w-sm py-10 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-entry/40 bg-entry/15"><Check className="h-8 w-8 text-entry" /></motion.div>
          <h2 className="text-lg font-semibold">Dërgesa u regjistrua</h2>
          <p className="mb-5 text-sm text-muted-foreground">Porosia {form.orderNr} · {product.name}</p>
          <div className="rounded-lg border bg-card p-4 text-left"><Row k="Sasia" v={`${saved.count} ${unit}`} /><Row k="Pesha neto" v={fmtKg(saved.kg)} /><Row k="Vlera totale" v={<span className="text-entry">{fmtLek(saved.total)}</span>} /></div>
          <Button variant="entry" size="lg" className="mt-4 w-full" onClick={reset}>Regjistro dërgesë tjetër</Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return <section className="mb-7"><div className="mb-3 flex items-center gap-2 border-b pb-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">{n}</span><h2 className="text-sm font-medium">{title}</h2></div>{children}</section>;
}
const Req = () => <span className="text-danger">*</span>;
const Hint = ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={cn("mt-1 text-[11px] text-muted-foreground", className)}>{children}</p>;
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex items-center justify-between border-b py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium tabular">{v}</span></div>;

function DualField({ label, doc, act, onDoc, onAct, diff, fmt, step, hint }: { label: string; doc: string; act: string; onDoc: (v: string) => void; onAct: (v: string) => void; diff: number; fmt: (d: number) => string; step?: string; hint?: string }) {
  return (
    <div className="mt-4"><Label>{label} <Req /></Label>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <div><p className="mb-1 text-[10px] text-muted-foreground">Sipas dokumentit</p><Input type="number" step={step} value={doc} onChange={e => onDoc(e.target.value)} /></div>
        <div><p className="mb-1 text-[10px] text-muted-foreground">Faktik (i shkarkuar)</p><Input type="number" step={step} value={act} onChange={e => onAct(e.target.value)} /></div>
        <Badge variant={diff === 0 ? "entry" : "warn"} className="mb-2.5">{diff === 0 ? "përputhet" : fmt(diff)}</Badge>
      </div>
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

function NewProductDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (p: Product) => void }) {
  const add = useStore(s => s.addProduct);
  const [name, setName] = useState(""); const [origin, setOrigin] = useState(""); const [wt, setWt] = useState<WeightType>("VARIABLE"); const [fixed, setFixed] = useState("");
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent><DialogTitle>Produkt i ri</DialogTitle><DialogDescription>Krijo një kategori të re produkti për magazinën.</DialogDescription>
        <div className="mt-4 space-y-3">
          <div><Label>Emri i produktit</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="p.sh. Krahë pule të ngrirë" /></div>
          <div><Label>Origjina (opsionale)</Label><Input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="p.sh. Brazil" /></div>
          <div><Label>Lloji i peshës</Label><Segmented value={wt} onChange={setWt} options={[{ value: "VARIABLE", label: "Variabile" }, { value: "FIXED", label: "Fikse" }, { value: "PALLET", label: "Paleta" }]} /></div>
          {wt === "FIXED" && <div><Label>Pesha fikse për karton (kg)</Label><Input type="number" value={fixed} onChange={e => setFixed(e.target.value)} placeholder="p.sh. 10" /></div>}
          <Button variant="entry" className="w-full" disabled={!name.trim()} onClick={() => onCreate(add({ name: name.trim(), origin: origin || undefined, weightType: wt, fixedKg: wt === "FIXED" ? +fixed || undefined : undefined }))}>Krijo & vazhdo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function NewSupplierDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (s: { id: string }) => void }) {
  const add = useStore(s => s.addSupplier);
  const [name, setName] = useState(""); const [country, setCountry] = useState("");
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent><DialogTitle>Furnizues i ri</DialogTitle><DialogDescription>Shtoje në listën e furnizuesve.</DialogDescription>
        <div className="mt-4 space-y-3">
          <div><Label>Emri</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Shteti</Label><Input value={country} onChange={e => setCountry(e.target.value)} /></div>
          <Button variant="entry" className="w-full" disabled={!name.trim()} onClick={() => onCreate(add({ name: name.trim(), country }))}>Shto furnizuesin</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
