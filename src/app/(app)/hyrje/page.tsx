"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, ChevronRight, ClipboardList, Plus, Save, Search, Trash2, X, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shell";
import { ProductDialog, SupplierDialog } from "@/components/entity-dialogs";
import { remainingKg, useStore } from "@/lib/store";
import { IncompleteShipment } from "@/components/incomplete-shipment";
import { loadSpecLabel } from "@/lib/stock";
import type { DateMode, Draft, LoadType, LotAlloc, Product } from "@/lib/types";
import { cn, fmtDate, fmtKg, fmtLek, fmtNum, todayInTirane } from "@/lib/utils";

type Step = "product" | "form" | "review" | "done";
type CostUnit = "kg" | "ton";

interface Form {
  orderNr: string; supplierId: string; entryDate: string; loadType: LoadType;
  weighMode: "VARIABLE" | "FIXED"; fixedKg: string; origin: string; specs: string;
  countDoc: string; countActual: string; netKgDoc: string; netKgActual: string;
  lots: { lotNumber: string; qty: string }[];
  costUnit: CostUnit; costVal: string;
  dateMode: DateMode; prodFrom: string; prodTo: string; expFrom: string; expTo: string;
}
const emptyForm = (): Form => ({ orderNr: "", supplierId: "", entryDate: todayInTirane(), loadType: "CARTON", weighMode: "VARIABLE", fixedKg: "", origin: "", specs: "", countDoc: "", countActual: "", netKgDoc: "", netKgActual: "", lots: [{ lotNumber: "", qty: "" }], costUnit: "kg", costVal: "", dateMode: "FIXED", prodFrom: "", prodTo: "", expFrom: "", expTo: "" });

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
  const [prefilled, setPrefilled] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ count: number | null; kg: number; total: number | null } | null>(null);
  const requestId = useRef<string | null>(null);

  const unit = form.loadType === "CARTON" ? "kartona" : "paleta";
  const cntDoc = +form.countDoc || 0, cntAct = +form.countActual || 0, wDoc = +form.netKgDoc || 0, wAct = +form.netKgActual || 0;
  const perKg = form.costUnit === "kg" ? (+form.costVal || 0) : (+form.costVal || 0) / 1000;
  const total = form.costVal.trim() ? wAct * perKg : null;
  const lotSum = form.lots.reduce((a, l) => a + (+l.qty || 0), 0);
  const avg = cntAct > 0 ? wAct / cntAct : 0;
  const isFixed = form.loadType === "CARTON" && form.weighMode === "FIXED", fixedKg = isFixed ? +form.fixedKg || 0 : 0;
  const specOf = { loadType: form.loadType, fixedKg: fixedKg || undefined, origin: form.origin.trim() || undefined, specs: form.specs.trim() || undefined };
  const set = (patch: Partial<Form>) => { requestId.current = null; setForm(f => ({ ...f, ...patch })); };

  const filtered = useMemo(() => store.products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())), [q, store.products]);
  const stockOf = (p: Product) => store.shipments.filter(s => s.productId === p.id && remainingKg(s) > 0);

  const pick = (p: Product) => { requestId.current = null; setProduct(p); setForm(emptyForm()); setPrefilled(null); setDraftId(null); setStep("form"); };
  // /hyrje?product=<id> (from a category page) opens the load form for that category directly.
  const [autoPicked, setAutoPicked] = useState(false);
  useEffect(() => {
    if (autoPicked || !store.products.length) return;
    setAutoPicked(true);
    const id = new URLSearchParams(window.location.search).get("product");
    const p = id ? store.products.find(x => x.id === id) : undefined;
    if (p) pick(p);
  }, [store.products, autoPicked]);
  // Choosing a supplier copies the spec of this category's last load from that supplier (if the spec is still blank).
  const chooseSupplier = (supplierId: string) => {
    const last = product ? [...store.shipments].filter(x => x.productId === product.id && x.supplierId === supplierId).sort((a, b) => b.entryDate.localeCompare(a.entryDate))[0] : undefined;
    const blank = !form.fixedKg && !form.origin && !form.specs && form.weighMode === "VARIABLE" && form.loadType === "CARTON";
    if (last && blank) {
      set({ supplierId, loadType: last.loadType, weighMode: last.fixedKg ? "FIXED" : "VARIABLE", fixedKg: last.fixedKg ? String(last.fixedKg) : "", origin: last.origin ?? "", specs: last.specs ?? "" });
      setPrefilled(fmtDate(last.entryDate));
    } else { set({ supplierId }); setPrefilled(null); }
  };
  const resume = (d: Draft) => {
    requestId.current = null;
    const p = store.products.find(x => x.id === d.productId); if (!p) return;
    const x = d.data;
    setProduct(p); setDraftId(d.id);
    setForm({
      orderNr: x.orderNr ?? "", supplierId: x.supplierId ?? "", entryDate: x.entryDate ?? todayInTirane(), loadType: x.loadType ?? "CARTON",
      weighMode: x.fixedKg ? "FIXED" : "VARIABLE", fixedKg: x.fixedKg ? String(x.fixedKg) : "", origin: x.origin ?? "", specs: x.specs ?? "",
      countDoc: x.countDoc?.toString() ?? "", countActual: x.countActual?.toString() ?? "", netKgDoc: x.netKgDoc?.toString() ?? "", netKgActual: x.netKgActual?.toString() ?? "",
      lots: (x.lots?.length ? x.lots : [{ lotNumber: "", qty: 0 }]).map(l => ({ lotNumber: l.lotNumber, qty: l.qty ? String(l.qty) : "" })),
      costUnit: "kg", costVal: x.costPerKg?.toString() ?? "",
      dateMode: x.dateMode ?? "FIXED", prodFrom: x.prodFrom ?? "", prodTo: x.prodTo ?? "", expFrom: x.expFrom ?? "", expTo: x.expTo ?? "",
    });
    setStep("form"); toast("Drafti u rikthye — vazhdo aty ku e le");
  };
  const toDraftData = () => ({
    orderNr: form.orderNr.trim() || null, supplierId: form.supplierId || null, entryDate: form.entryDate, ...specOf,
    countDoc: form.countDoc.trim() ? cntDoc : null, countActual: form.countActual.trim() ? cntAct : null, netKgDoc: form.netKgDoc.trim() ? wDoc : null, netKgActual: wAct,
    lots: form.lots.filter(l => l.lotNumber).map(l => ({ lotNumber: l.lotNumber, qty: +l.qty || 0 })),
    costPerKg: form.costVal.trim() ? perKg : null, totalCost: total, dateMode: form.dateMode,
    prodFrom: form.prodFrom, prodTo: form.dateMode === "RANGE" && form.prodTo ? form.prodTo : undefined, expFrom: form.expFrom, expTo: form.dateMode === "RANGE" ? form.expTo : undefined,
  });
  const saveDraft = async () => { if (!product) return; try { const d = await store.saveDraft({ id: draftId ?? undefined, productId: product.id, data: toDraftData() }); setDraftId(d.id); toast.success("Drafti u ruajt"); setStep("product"); } catch (e) { toast.error(e instanceof Error ? e.message : "Drafti nuk u ruajt"); } };
  const hasCount = !!form.countActual.trim();
  const hasLots = form.lots.some(l => l.lotNumber.trim() || l.qty.trim());
  const optionalFieldsValid = (!hasCount || Number.isSafeInteger(cntAct) && cntAct > 0) && (!form.countDoc.trim() || Number.isSafeInteger(cntDoc) && Number(form.countDoc) >= 0) && (!form.netKgDoc.trim() || Number(form.netKgDoc) >= 0) && (!form.costVal.trim() || perKg > 0);
  const canReview = form.entryDate && wAct > 0 && form.expFrom && (form.dateMode !== "RANGE" || form.expTo && form.expTo >= form.expFrom) && optionalFieldsValid && (!isFixed || fixedKg > 0) && (!hasLots || hasCount && lotSum === cntAct && form.lots.every(l => l.lotNumber.trim() && Number.isSafeInteger(+l.qty) && +l.qty > 0));
  const finalize = async () => {
    if (!product) return;
    const lots: LotAlloc[] = form.lots.filter(l => l.lotNumber).map(l => ({ lotNumber: l.lotNumber, qty: +l.qty || 0 }));
    try {
      requestId.current ??= crypto.randomUUID();
      await store.addShipment({ productId: product.id, supplierId: form.supplierId || null, orderNr: form.orderNr.trim() || null, entryDate: form.entryDate, ...specOf, countDoc: form.countDoc.trim() ? cntDoc : null, countActual: form.countActual.trim() ? cntAct : null, netKgDoc: form.netKgDoc.trim() ? wDoc : null, netKgActual: wAct, lots, costPerKg: form.costVal.trim() ? perKg : null, totalCost: total, dateMode: form.dateMode, prodFrom: form.prodFrom, prodTo: form.dateMode === "RANGE" && form.prodTo ? form.prodTo : undefined, expFrom: form.expFrom, expTo: form.dateMode === "RANGE" ? form.expTo : undefined, draftId: draftId ?? undefined, requestId: requestId.current });
      requestId.current = null;
      setSaved({ count: hasCount ? cntAct : null, kg: wAct, total }); setStep("done"); toast.success("Dërgesa u regjistrua");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Dërgesa nuk u regjistrua"); }
  };
  const reset = () => { requestId.current = null; setPrefilled(null); setStep("product"); setProduct(null); setForm(emptyForm()); setDraftId(null); setSaved(null); };
  const supplier = store.suppliers.find(s => s.id === form.supplierId);

  return (
    <AnimatePresence mode="wait">
      {step === "product" && (
        <motion.div key="product" {...fade}>
          <PageHeader title="Hyrje e re" sub="Zgjidh kategorinë e produktit — ngarkesa regjistrohet nën të, me furnizuesin dhe specifikimet e veta" right={<Button asChild variant="outline"><Link href="/hyrje/kthim"><Undo2 /> Kthim nga klienti</Link></Button>} />
          {store.drafts.length > 0 && (
            <section className="mb-6" aria-label="Draft-e">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>Draft-e të papërfunduara</span><span className="text-warn">{store.drafts.length}</span></div>
              <div className="space-y-2">
                {store.drafts.map(d => { const p = store.products.find(x => x.id === d.productId); return (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3">
                    <button onClick={() => resume(d)} className="flex flex-1 items-center gap-3 text-left">
                      <Save className="h-4 w-4 shrink-0 text-warn" />
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-warn">Porosia {d.data.orderNr || "—"} · {p?.name}</div><div className="text-xs text-warn/80">{d.data.countActual ?? "sasi e panjohur"} {d.data.loadType === "PALLET" ? "paleta" : "kartona"} · {fmtNum(d.data.netKgActual ?? 0)} kg · ruajtur {new Date(d.savedAt).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}</div></div>
                    </button>
                    <Button variant="ghost" size="icon" aria-label="Fshi draftin" onClick={async () => { try { await store.deleteDraft(d.id); toast("Drafti u fshi"); } catch (e) { toast.error(e instanceof Error ? e.message : "Fshirja dështoi"); } }}><Trash2 className="h-4 w-4" /></Button>
                  </div>); })}
              </div>
            </section>
          )}
          <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Kërko kategorinë…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" /></div>
          <div className="space-y-2">
            {filtered.map(p => { const sh = stockOf(p); const kg = sh.reduce((a, s) => a + remainingKg(s), 0); return (
              <button key={p.id} onClick={() => pick(p)} className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-left transition-colors hover:border-entry/60">
                <div><div className="text-sm font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{sh.length} ngarkesa në stok · {fmtKg(kg, 0)}{sh.length ? ` · ${[...new Set(sh.map(x => store.suppliers.find(y => y.id === x.supplierId)?.name).filter(Boolean))].join(", ")}` : ""}</div></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>); })}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Asnjë kategori me këtë emër. Krijo një të re më poshtë.</p>}
          </div>
          <Button variant="outline" className="mt-3 w-full" onClick={() => setNewProd(true)}><Plus /> Kategori e re</Button>
          <ProductDialog open={newProd} onClose={() => setNewProd(false)} onSaved={p => pick(p)} />
        </motion.div>
      )}

      {step === "form" && product && (
        <motion.div key="form" {...fade}>
          <PageHeader title={`Ngarkesë e re — ${product.name}`} sub={draftId ? "Draft i rikthyer" : "Hapi 2 nga 3"} right={<Button variant="ghost" onClick={() => setStep("product")}><ArrowLeft /> Kategoritë</Button>} />
          <Banner className="mb-6"><ClipboardList className="mr-1 inline h-3.5 w-3.5" />Plotëso sipas fletë-ngarkesës dhe shkarkimit faktik. Fushat &quot;faktike&quot; plotësohen vetë — ndryshoji vetëm nëse ka mospërputhje.</Banner>

          <Section n={1} title="Të dhënat e porosisë">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Nr. i porosisë (opsionale)</Label><Input value={form.orderNr} onChange={e => set({ orderNr: e.target.value })} placeholder="p.sh. 4471" /><Hint>Disa produkte mund të ndajnë të njëjtin nr. porosie</Hint></div>
              <div><Label>Furnizuesi (opsional)</Label>
                <Select value={form.supplierId || "__unknown"} onValueChange={v => v === "__new" ? setNewSup(true) : chooseSupplier(v === "__unknown" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Zgjidh furnizuesin" /></SelectTrigger>
                  <SelectContent><SelectItem value="__unknown">Pa furnizues</SelectItem>{store.suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.country})</SelectItem>)}<SelectItem value="__new">+ Furnizues i ri…</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data e hyrjes <Req /></Label>
                <Input type="date" value={form.entryDate} onChange={e => set({ entryDate: e.target.value })} />
                <Hint>{form.entryDate === todayInTirane() ? <><CalendarCheck className="mr-1 inline h-3 w-3 text-entry" />Plotësohet me datën e sotme — ndryshoje nëse ngarkesa ka mbërritur më parë.</> : <span className="text-warn"><CalendarCheck className="mr-1 inline h-3 w-3" />Datë e ndryshuar manualisht ({fmtDate(form.entryDate)}) — sot është {fmtDate(todayInTirane())}.</span>}</Hint>
              </div>
            </div>
          </Section>

          <Section n={2} title="Forma e ngarkesës">
            <div className="max-w-sm"><Label>Si vjen ngarkesa?</Label><Segmented value={form.loadType} onChange={v => set({ loadType: v })} options={[{ value: "CARTON", label: "Kartona" }, { value: "PALLET", label: "Paleta" }]} /><Hint>{form.loadType === "CARTON" ? "Produkt i ndarë në kartona individuale" : "Produkt i pandashëm — vjen mbi paleta me peshë totale"}</Hint></div>
            {form.loadType === "CARTON" && <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><Label>Pesha e kartonave</Label><Segmented value={form.weighMode} onChange={v => set({ weighMode: v })} options={[{ value: "VARIABLE", label: "E ndryshme" }, { value: "FIXED", label: "Fikse" }]} /><Hint>{form.weighMode === "FIXED" ? "Çdo karton ka të njëjtën peshë — shitja bëhet me numër kartonash." : "Çdo karton ka peshë tjetër — shitja bëhet me peshat e kartonave ose me totalin nga fatura."}</Hint></div>
              {form.weighMode === "FIXED" && <div><Label>Kg për karton <Req /></Label><Input type="number" step="0.001" value={form.fixedKg} onChange={e => set({ fixedKg: e.target.value })} placeholder="p.sh. 10" />{fixedKg > 0 && cntAct > 0 && Math.abs(fixedKg * cntAct - wAct) > 0.01 && <Hint className="text-warn">{cntAct} × {fixedKg} kg = {fmtNum(fixedKg * cntAct, 2)} kg, ndërsa pesha neto është {fmtNum(wAct, 2)} kg.</Hint>}</div>}
            </div>}
            <DualField label={`Numri i ${unit} (opsional)`} doc={form.countDoc} act={form.countActual} onDoc={v => set({ countDoc: v, ...(v.trim() ? { countActual: v } : {}) })} onAct={v => set({ countActual: v })} diff={form.countDoc.trim() && form.countActual.trim() ? cntAct - cntDoc : null} fmt={d => `${d > 0 ? "+" : ""}${d}`} />
            <DualField label="Pesha neto totale (kg) — dokumenti opsional" doc={form.netKgDoc} act={form.netKgActual} onDoc={v => set({ netKgDoc: v, ...(v.trim() ? { netKgActual: v } : {}) })} onAct={v => set({ netKgActual: v })} diff={form.netKgDoc.trim() ? +(wAct - wDoc).toFixed(2) : null} fmt={d => `${d > 0 ? "+" : ""}${d.toFixed(2)} kg`} step="0.01" hint={avg > 0 ? `Mesatarisht ${avg.toFixed(2)} kg / ${form.loadType === "CARTON" ? "karton" : "paletë"}` : undefined} />
          </Section>

          <Section n={3} title="Specifikimet e ngarkesës">
            {prefilled && <Banner className="mb-3">U plotësuan nga ngarkesa e fundit e këtij furnizuesi ({prefilled}) — kontrolloji dhe ndrysho nëse kjo ngarkesë është ndryshe.</Banner>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Origjina</Label><Input value={form.origin} onChange={e => set({ origin: e.target.value })} placeholder="p.sh. Brazil" /></div>
              <div><Label>Specifikime</Label><Input value={form.specs} onChange={e => set({ specs: e.target.value })} placeholder="p.sh. Seara, IQF, 200–250 g copa" /><Hint>Marka, prerja, kalibri, paketimi — çdo gjë që e dallon këtë ngarkesë.</Hint></div>
            </div>
          </Section>

          <Section n={4} title="Lotet (opsionale)">
            {!hasCount && <Hint>Pa numër njësish, stoku ndiqet vetëm në kg. Plotëso sasinë faktike për të shtuar lote.</Hint>}
            {(hasCount || hasLots) && <>
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
            </>}
          </Section>

          <Section n={5} title="Kosto (opsionale)">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Njësia e kostos</Label><Segmented value={form.costUnit} onChange={v => set({ costUnit: v })} options={[{ value: "kg", label: "për kg" }, { value: "ton", label: "për ton" }]} /></div>
              <div><Label>Kosto totale {form.costUnit === "kg" ? "për kg" : "për ton"} (Lek)</Label><Input type="number" value={form.costVal} onChange={e => set({ costVal: e.target.value })} placeholder={form.costUnit === "kg" ? "p.sh. 340" : "p.sh. 340000"} /><Hint>Përfshin transportin, doganën etj. — dhënë nga financa. Lëre bosh kur kostoja nuk dihet; vlera e stokut dhe fitimi do të shënohen si të paplotë.</Hint></div>
            </div>
            <div className="mt-3 rounded-lg bg-secondary p-4">
              <Row k="Pesha neto faktike" v={fmtKg(wAct)} /><Row k="Kosto për kg" v={form.costVal.trim() ? fmtNum(perKg, 2) + " Lek" : "E panjohur"} />
              <div className="mt-2 flex items-center justify-between border-t pt-3"><span className="text-sm font-medium">Vlera totale e dërgesës</span><span className="text-xl font-semibold text-entry tabular">{fmtLek(total)}</span></div>
            </div>
          </Section>

          <Section n={6} title="Datat">
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
          {!canReview && <p className="mt-2 text-xs text-muted-foreground">Për të verifikuar duhen: data e hyrjes, pesha faktike pozitive dhe data e skadimit. Fushat opsionale duhet të jenë të vlefshme kur plotësohen{isFixed ? " dhe kg për karton" : ""}.</p>}
          <SupplierDialog open={newSup} onClose={() => setNewSup(false)} onSaved={s => chooseSupplier(s.id)} />
        </motion.div>
      )}

      {step === "review" && product && (
        <motion.div key="review" {...fade}>
          <PageHeader title="Verifiko dërgesën" sub="Hapi 3 nga 3" right={<Button variant="ghost" onClick={() => setStep("form")}><ArrowLeft /> Ndrysho</Button>} />
          <div className="mb-4 space-y-2"><IncompleteShipment shipment={{ supplierId: form.supplierId || null, orderNr: form.orderNr || null, countActual: hasCount ? cntAct : null, costPerKg: form.costVal.trim() ? perKg : null, lots: form.lots.filter(l => l.lotNumber.trim()).map(l => ({ lotNumber: l.lotNumber, qty: +l.qty })) }} />
            {hasCount && form.countDoc.trim() && cntDoc !== cntAct && <Banner tone="warn"><b>Mospërputhje sasie.</b> Dokumenti: {cntDoc} · Faktik: {cntAct} ({cntAct - cntDoc > 0 ? "+" : ""}{cntAct - cntDoc} {unit}). Do të regjistrohet me dërgesën.</Banner>}
            {form.netKgDoc.trim() && wDoc !== wAct && <Banner tone="warn"><b>Mospërputhje peshe.</b> Dokumenti: {fmtKg(wDoc)} · Faktike: {fmtKg(wAct)} ({wAct - wDoc > 0 ? "+" : ""}{(wAct - wDoc).toFixed(2)} kg).</Banner>}
            {hasLots && lotSum !== cntAct && <Banner tone="warn"><b>Lotet nuk përputhen.</b> Shuma e loteve: {lotSum} · Totali: {cntAct}.</Banner>}
          </div>
          <div className="grid gap-x-8 gap-y-1 rounded-lg border bg-card p-5 sm:grid-cols-2">
            <Row k="Produkti" v={product.name} /><Row k="Pesha neto" v={fmtKg(wAct)} />
            <Row k="Data e hyrjes" v={<span className={form.entryDate !== todayInTirane() ? "text-warn" : undefined}>{form.entryDate ? fmtDate(form.entryDate) : "—"}</span>} /><Row k="Lotet" v={form.lots.filter(l => l.lotNumber).map(l => `${l.lotNumber} (${l.qty || 0})`).join(", ") || "—"} />
            <Row k="Nr. porosie" v={form.orderNr || "—"} /><Row k="Kosto / kg" v={form.costVal.trim() ? fmtNum(perKg, 2) + " Lek" : "E panjohur"} />
            <Row k="Furnizuesi" v={supplier?.name ?? "—"} /><Row k="Vlera totale" v={<span className="text-entry">{fmtLek(total)}</span>} />
            <Row k="Specifikimet" v={loadSpecLabel(specOf)} /><Row k="Prodhimi" v={form.prodFrom ? fmtDate(form.prodFrom) + (form.dateMode === "RANGE" && form.prodTo ? ` – ${fmtDate(form.prodTo)}` : "") : "—"} />
            <Row k="Sasia" v={hasCount ? `${cntAct} ${unit}` : "E panjohur — vetëm kg"} /><Row k="Skadimi" v={form.expFrom ? fmtDate(form.expFrom) + (form.dateMode === "RANGE" ? " (më e hershmja)" : "") : "—"} />
          </div>
          <div className="mt-4 grid max-w-md grid-cols-2 gap-3"><Button variant="outline" size="lg" onClick={() => setStep("form")}>Kthehu & ndrysho</Button><Button variant="entry" size="lg" disabled={!canReview} onClick={finalize}><Check /> Ruaj dërgesën</Button></div>
        </motion.div>
      )}

      {step === "done" && product && saved && (
        <motion.div key="done" {...fade} className="mx-auto max-w-sm py-10 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-entry/40 bg-entry/15"><Check className="h-8 w-8 text-entry" /></motion.div>
          <h2 className="text-lg font-semibold">Dërgesa u regjistrua</h2>
          <p className="mb-5 text-sm text-muted-foreground">Porosia {form.orderNr || "—"} · {product.name}</p>
          <div className="rounded-lg border bg-card p-4 text-left"><Row k="Sasia" v={saved.count == null ? "E panjohur" : `${saved.count} ${unit}`} /><Row k="Pesha neto" v={fmtKg(saved.kg)} /><Row k="Vlera totale" v={<span className="text-entry">{fmtLek(saved.total)}</span>} /></div>
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

function DualField({ label, doc, act, onDoc, onAct, diff, fmt, step, hint }: { label: string; doc: string; act: string; onDoc: (v: string) => void; onAct: (v: string) => void; diff: number | null; fmt: (d: number) => string; step?: string; hint?: string }) {
  return (
    <div className="mt-4"><Label>{label}{label.startsWith("Pesha") && <Req />}</Label>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <div><p className="mb-1 text-[10px] text-muted-foreground">Sipas dokumentit</p><Input type="number" aria-label={`${label} — dokument`} step={step} value={doc} onChange={e => onDoc(e.target.value)} /></div>
        <div><p className="mb-1 text-[10px] text-muted-foreground">Faktik (i shkarkuar)</p><Input type="number" aria-label={`${label} — faktik`} step={step} value={act} onChange={e => onAct(e.target.value)} /></div>
        <Badge variant={diff === 0 ? "entry" : "warn"} className="mb-2.5">{diff == null ? "pa krahasim" : diff === 0 ? "përputhet" : fmt(diff)}</Badge>
      </div>
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}
