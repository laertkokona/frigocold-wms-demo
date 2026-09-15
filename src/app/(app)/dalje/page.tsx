"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Delete, Equal, FileText, Keyboard, Layers, Plus, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shell";
import { remainingCount, remainingKg, useStore } from "@/lib/store";
import { fefoOrder } from "@/lib/calc";
import type { Product, SaleLine, SaleMethod, Shipment } from "@/lib/types";
import { cn, daysUntil, fmtDate, fmtKg, fmtLek, fmtMonth, fmtNum } from "@/lib/utils";

type Step = "order" | "product" | "shipment" | "method" | "fixed" | "format" | "keypad" | "pallet" | "price" | "client" | "done";
const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } };
const FORMATS = [{ i: 2, d: 2, ex: "24.55", type: "2455" }, { i: 2, d: 3, ex: "19.877", type: "19877" }, { i: 2, d: 1, ex: "20.4", type: "204" }, { i: 3, d: 2, ex: "118.40", type: "11840" }];

export default function DaljePage() {
  const store = useStore();
  const [step, setStep] = useState<Step>("order");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [ship, setShip] = useState<Shipment | null>(null);
  const [method, setMethod] = useState<SaleMethod>("VARIABLE");
  const [fixedKg, setFixedKg] = useState(""); const [fixedN, setFixedN] = useState("");
  const [fmt, setFmt] = useState({ i: 2, d: 2 }); const [buf, setBuf] = useState(""); const [weights, setWeights] = useState<number[]>([]);
  const [pallets, setPallets] = useState<string[]>(["", "", ""]);
  const [price, setPrice] = useState("");
  const [clientId, setClientId] = useState("");
  const [lineKg, setLineKg] = useState(0); const [lineQty, setLineQty] = useState(0);
  const [doneSale, setDoneSale] = useState<{ id: string; totalKg: number; totalValue: number } | null>(null);

  const totalKg = lines.reduce((a, l) => a + l.kg, 0), totalVal = lines.reduce((a, l) => a + l.total, 0);
  const pname = (id: string) => store.products.find(p => p.id === id)?.name ?? id;
  const lotOf = (s: Shipment) => s.lots.map(l => l.lotNumber).join(", ");

  // fast keypad
  const need = fmt.i + fmt.d;
  const commit = (b = buf) => { if (!b) return; const p = b.padStart(need, "0"); setWeights(w => [...w, parseFloat(p.slice(0, fmt.i) + "." + p.slice(fmt.i))]); setBuf(""); };
  const press = (d: string) => { if (buf.length >= need) return; const nb = buf + d; setBuf(nb); if (nb.length === need) setTimeout(() => commit(nb), 110); };
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => { gridRef.current && (gridRef.current.scrollTop = gridRef.current.scrollHeight); }, [weights]);
  useEffect(() => {
    if (step !== "keypad") return;
    const h = (e: KeyboardEvent) => { if (e.key >= "0" && e.key <= "9") { e.preventDefault(); press(e.key); } else if (e.key === "Backspace") { e.preventDefault(); setBuf(b => b.slice(0, -1)); } else if (e.key === "Enter") { e.preventDefault(); commit(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, buf, fmt]);
  const wSum = weights.reduce((a, b) => a + b, 0);

  const openPrice = (kg: number, qty: number) => { setLineKg(kg); setLineQty(qty); setPrice(""); setStep("price"); };
  const addLine = () => {
    if (!product || !ship) return; const p = +price || 0;
    setLines(ls => [...ls, { productId: product.id, shipmentId: ship.id, method, qty: lineQty, kg: +lineKg.toFixed(2), pricePerKg: p, total: lineKg * p, weights: method === "VARIABLE" ? weights : method === "PALLET" ? pallets.map(Number) : undefined, fixedKg: method === "FIXED" ? +fixedKg : undefined }]);
    toast.success(`${product.name} u shtua në porosi`); setStep("order");
  };
  const finalize = () => {
    const s = store.finalizeSale({ clientId, lines, totalKg: +totalKg.toFixed(2), totalValue: totalVal });
    setDoneSale({ id: s.id, totalKg: s.totalKg, totalValue: s.totalValue }); setStep("done"); toast.success("Porosia u finalizua");
  };
  const reset = () => { setLines([]); setProduct(null); setShip(null); setWeights([]); setBuf(""); setClientId(""); setDoneSale(null); setStep("order"); };
  const printWeights = () => {
    const w = method === "PALLET" ? pallets.map(Number) : weights; const win = window.open("", "_blank"); if (!win) return;
    win.document.write(`<html><head><title>Peshat — ${product?.name}</title><style>body{font-family:system-ui;padding:32px;color:#111}h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:0 0 16px;font-size:13px}table{border-collapse:collapse;width:100%;max-width:420px}td{padding:6px 10px;border-bottom:1px solid #ddd;font-size:14px}td:last-child{text-align:right;font-variant-numeric:tabular-nums}tr.t td{font-weight:700;border-top:2px solid #111;border-bottom:0}</style></head><body><h1>${product?.name}</h1><p>Lot ${ship ? lotOf(ship) : ""} · ${fmtDate("2026-09-15")} · FrigoCold WMS</p><table>${w.map((x, i) => `<tr><td>#${i + 1}</td><td>${x.toFixed(2)} kg</td></tr>`).join("")}<tr class="t"><td>Totali (${w.length})</td><td>${w.reduce((a, b) => a + b, 0).toFixed(2)} kg</td></tr></table><script>window.print()</script></body></html>`);
    win.document.close();
  };
  const fefo = useMemo(() => product ? fefoOrder(store.shipments, product.id) : [], [product, store.shipments]);
  const fefoFirst = fefo[0];

  return (
    <AnimatePresence mode="wait">
      {step === "order" && (
        <motion.div key="order" {...fade}>
          <PageHeader title="Porosi shitjeje" sub={lines.length ? `${lines.length} produkte · ${fmtKg(totalKg)}` : "Shto produktet një nga një. Klienti zgjidhet në fund."} />
          <div className="space-y-2">
            {lines.map((l, i) => { const s = store.shipments.find(x => x.id === l.shipmentId); return (
              <div key={i} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">{pname(l.productId)}</div><div className="text-xs text-muted-foreground">Lot {s ? lotOf(s) : "—"} · {l.qty} {l.method === "PALLET" ? "paleta" : "kartona"} · {l.method === "FIXED" ? `Peshë fikse (${l.fixedKg} kg × ${l.qty})` : l.method === "VARIABLE" ? `Peshë e ndryshme (${l.qty} futur)` : `Paleta (${l.qty})`}</div></div><Button variant="ghost" size="icon" aria-label="Hiq" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><X /></Button></div>
                <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-sm tabular"><KV k="Pesha" v={fmtKg(l.kg)} /><KV k="Çmimi/kg" v={fmtNum(l.pricePerKg) + " Lek"} /><KV k="Vlera" v={<span className="text-exit">{fmtLek(l.total)}</span>} /></div>
              </div>); })}
          </div>
          <Button variant="exit" size="lg" className="mt-3 w-full" onClick={() => setStep("product")}><Plus /> Shto produkt në porosi</Button>
          {lines.length > 0 && (<>
            <div className="mt-4 rounded-lg bg-exit/10 p-4 text-sm text-exit"><div className="flex justify-between py-1"><span>Produkte</span><span>{lines.length}</span></div><div className="flex justify-between py-1"><span>Pesha totale</span><span className="tabular">{fmtKg(totalKg)}</span></div><div className="mt-1 flex items-center justify-between border-t border-exit/30 pt-3"><span className="font-medium">Vlera totale e porosisë</span><span className="text-xl font-semibold tabular">{fmtLek(totalVal)}</span></div></div>
            <Button variant="exit" size="lg" className="mt-3 w-full" onClick={() => setStep("client")}><UserCheck /> Vazhdo te klienti</Button>
          </>)}
        </motion.div>
      )}

      {step === "product" && (
        <motion.div key="product" {...fade}>
          <PageHeader title="Zgjidh produktin" right={<Button variant="ghost" onClick={() => setStep("order")}><ArrowLeft /> Porosia</Button>} />
          <div className="space-y-2">
            {store.products.map(p => { const sh = store.shipments.filter(s => s.productId === p.id && remainingKg(s) > 0); const kg = sh.reduce((a, s) => a + remainingKg(s), 0); if (!sh.length) return null; return (
              <button key={p.id} onClick={() => { setProduct(p); setStep("shipment"); }} className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-left transition-colors hover:border-exit/60">
                <div><div className="text-sm font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{sh.length} dërgesa · {fmtKg(kg, 0)}{p.fixedKg ? ` · ${p.fixedKg} kg/karton` : ""}</div></div>
                <div className="flex items-center gap-2"><Badge variant={p.weightType === "PALLET" ? "warn" : p.weightType === "FIXED" ? "entry" : "exit"}>{p.weightType === "PALLET" ? "paleta" : p.weightType === "FIXED" ? "peshë fikse" : "peshë variabile"}</Badge><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
              </button>); })}
          </div>
        </motion.div>
      )}

      {step === "shipment" && product && (
        <motion.div key="shipment" {...fade}>
          <PageHeader title={`Nga cila dërgesë? — ${product.name}`} right={<Button variant="ghost" onClick={() => setStep("product")}><ArrowLeft /></Button>} />
          <Banner tone="warn" className="mb-4">Rendi FEFO — dërgesa me skadim më të afërt duhet shitur e para. Rekomandimi nuk është detyrim.</Banner>
          <div className="space-y-2">
            {fefo.map((s, i) => { const d = daysUntil(s.expFrom); const sup = store.suppliers.find(x => x.id === s.supplierId); return (
              <button key={s.id} onClick={() => { setShip(s); setMethod(product.weightType === "PALLET" ? "PALLET" : product.weightType === "FIXED" ? "FIXED" : "VARIABLE"); setStep("method"); }} className={cn("flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-left transition-colors hover:border-exit/60", i === 0 && "border-danger/40")}>
                <div><div className="text-sm font-medium">Lot {lotOf(s)} · {sup?.name}</div><div className="text-xs text-muted-foreground">Porosia {s.orderNr} · {remainingCount(s)} {s.loadType === "PALLET" ? "paleta" : "kartona"} · {fmtKg(remainingKg(s), 1)} · skadon {fmtMonth(s.expFrom)}</div></div>
                {i === 0 ? <Badge variant="solid">shit i pari · {d} ditë</Badge> : <Badge variant="entry">{fmtMonth(s.expFrom)}</Badge>}
              </button>); })}
          </div>
        </motion.div>
      )}

      {step === "method" && product && ship && (
        <motion.div key="method" {...fade}>
          <PageHeader title="Si do të llogaritet pesha?" right={<Button variant="ghost" onClick={() => setStep("shipment")}><ArrowLeft /></Button>} />
          <Banner className="mb-4">{product.weightType === "FIXED" ? `${product.name} ka peshë fikse (${product.fixedKg} kg/karton) — rekomandohet metoda e shpejtë.` : product.weightType === "PALLET" ? "Ky produkt vjen mbi paleta." : `${product.name} ka peshë të ndryshme për karton — shkruaj secilën peshë.`}</Banner>
          <div className="max-w-xl space-y-3">
            {product.weightType !== "PALLET" && <MethodCard icon={Equal} title="Peshë fikse për karton" desc="Të gjithë kartonët kanë të njëjtën peshë. Fut peshën një herë dhe numrin e kartonave — sistemi shumëzon." rec={product.weightType === "FIXED"} onClick={() => { setMethod("FIXED"); setFixedKg(String(product.fixedKg ?? "")); setFixedN(String(Math.min(40, remainingCount(ship)))); setStep("fixed"); }} />}
            {product.weightType !== "PALLET" && <MethodCard icon={Keyboard} title="Peshë e ndryshme për karton" desc="Çdo karton ka peshë tjetër. Shkruaj peshat me tastierë të shpejtë — sistemi i mbledh vetë." rec={product.weightType === "VARIABLE"} onClick={() => { setMethod("VARIABLE"); setWeights([]); setBuf(""); setStep("format"); }} />}
            {product.weightType === "PALLET" && <MethodCard icon={Layers} title="Paleta" desc="Fut peshën e secilës paletë veç e veç." rec onClick={() => { setMethod("PALLET"); setPallets(["", "", ""]); setStep("pallet"); }} />}
          </div>
        </motion.div>
      )}

      {step === "fixed" && product && ship && (() => { const w = +fixedKg || 0, n = +fixedN || 0, over = n > remainingCount(ship); return (
        <motion.div key="fixed" {...fade}>
          <PageHeader title={`Peshë fikse — ${product.name}`} right={<Button variant="ghost" onClick={() => setStep("method")}><ArrowLeft /></Button>} />
          <div className="max-w-md rounded-lg border bg-card p-5">
            <div className="grid grid-cols-2 gap-3"><div><Label>Pesha për karton (kg)</Label><Input type="number" step="0.01" value={fixedKg} onChange={e => setFixedKg(e.target.value)} className="h-14 text-center text-xl font-semibold" /></div><div><Label>Numri i kartonave</Label><Input type="number" value={fixedN} onChange={e => setFixedN(e.target.value)} className="h-14 text-center text-xl font-semibold" /></div></div>
            <div className="mt-3 flex flex-wrap gap-2">{[...new Set([10, 20, 40, remainingCount(ship)])].filter(x => x > 0 && x <= remainingCount(ship)).map(x => <Button key={x} size="sm" variant="outline" onClick={() => setFixedN(String(x))}>{x} kartona</Button>)}</div>
            <div className="mt-4 flex items-center justify-center gap-4 rounded-md bg-secondary p-4 tabular"><Big v={w.toFixed(2)} l="kg / karton" /><span className="text-muted-foreground">×</span><Big v={String(n)} l="kartona" /><span className="text-muted-foreground">=</span><Big v={(w * n).toFixed(2)} l="kg total" accent /></div>
            <div className={cn("mt-3 flex justify-between rounded-md px-3 py-2 text-xs", over ? "bg-warn/10 text-warn" : "bg-entry/10 text-entry")}><span>{over ? "Më shumë se stoku i lotit!" : "Në stok te ky lot"}</span><span>{n} / {remainingCount(ship)}</span></div>
            <Button variant="exit" size="lg" className="mt-4 w-full" disabled={!w || !n} onClick={() => openPrice(w * n, n)}>Vazhdo te çmimi <ArrowRight /></Button>
          </div>
        </motion.div>); })()}

      {step === "format" && product && (
        <motion.div key="format" {...fade}>
          <PageHeader title="Formati i peshave" sub="Si janë shkruar peshat në etiketa?" right={<Button variant="ghost" onClick={() => setStep("method")}><ArrowLeft /></Button>} />
          <Banner className="mb-4">Shkruan vetëm shifrat — presja vendoset vetë dhe pesha regjistrohet automatikisht kur mbushen shifrat.</Banner>
          <div className="grid max-w-md grid-cols-2 gap-3">
            {FORMATS.map(f => <button key={f.ex} onClick={() => { setFmt({ i: f.i, d: f.d }); setStep("keypad"); }} className="rounded-lg border bg-card p-4 text-center transition-colors hover:border-exit"><div className="font-mono text-lg font-semibold">{"x".repeat(f.i)}.{"x".repeat(f.d)}</div><div className="mt-1 text-xs text-muted-foreground">p.sh. {f.ex}</div><div className="text-[11px] text-muted-foreground/70">shkruaj {f.type}</div></button>)}
          </div>
        </motion.div>
      )}

      {step === "keypad" && product && ship && (
        <motion.div key="keypad" {...fade}>
          <PageHeader title={`Peshat — ${product.name}`} sub={`Lot ${lotOf(ship)}`} right={<div className="flex items-center gap-2"><Badge variant="exit" className="font-mono">{"x".repeat(fmt.i)}.{"x".repeat(fmt.d)}</Badge><Button variant="ghost" onClick={() => setStep("format")}><ArrowLeft /></Button></div>} />
          <div className="grid gap-5 md:grid-cols-[1fr_300px]">
            <div>
              <div className="mb-3 rounded-lg bg-secondary p-5 text-center">
                <div className="font-mono text-4xl font-semibold tracking-wider tabular" aria-live="polite">{Array.from({ length: need }).map((_, i) => <span key={i}>{i === fmt.i && <span className="opacity-40">.</span>}<span className={i < buf.length ? "" : "text-border"}>{i < buf.length ? buf[i] : "_"}</span></span>)}</div>
                <p className="mt-1.5 text-xs text-muted-foreground">Shkruaj {need} shifra — regjistrohet vetë · tastiera fizike funksionon</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["1","2","3","4","5","6","7","8","9"].map(k => <Key key={k} onClick={() => press(k)}>{k}</Key>)}
                <Key onClick={() => setBuf(b => b.slice(0, -1))} className="text-danger" aria-label="Fshi"><Delete className="mx-auto h-5 w-5" /></Key>
                <Key onClick={() => press("0")}>0</Key>
                <Key onClick={() => commit()} className="bg-exit text-exit-foreground text-sm hover:bg-exit/90">SHTO</Key>
              </div>
            </div>
            <div>
              <div className="rounded-lg bg-secondary p-3">
                <div className="mb-2 flex justify-between text-xs"><span className="font-medium">Peshat</span><span className="text-muted-foreground">{weights.length} futur</span></div>
                <div ref={gridRef} className="scroll-thin grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto">{weights.map((w, i) => <button key={i} onClick={() => setWeights(ws => ws.filter((_, j) => j !== i))} className="group rounded-md border bg-card px-1 py-1.5 text-center font-mono text-xs tabular hover:border-danger" title="Hiq"><span className="block text-[9px] text-muted-foreground group-hover:text-danger">#{i + 1}</span>{w.toFixed(fmt.d)}</button>)}</div>
                {weights.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Asnjë peshë ende. Fillo të shkruash.</p>}
                <div className="mt-3 border-t pt-3 tabular"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Kartona</span><span>{weights.length}</span></div><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Totali</span><span className="text-2xl font-semibold text-exit">{wSum.toFixed(2)}</span></div></div>
                <div className={cn("mt-2 flex justify-between rounded-md px-3 py-2 text-xs", weights.length > remainingCount(ship) ? "bg-warn/10 text-warn" : "bg-entry/10 text-entry")}><span>{weights.length > remainingCount(ship) ? "Më shumë se stoku!" : "Në stok te ky lot"}</span><span>{weights.length} / {remainingCount(ship)}</span></div>
              </div>
              <Button variant="outline" size="sm" className="mt-2 w-full" disabled={!weights.length} onClick={printWeights}><FileText /> Gjenero PDF me peshat</Button>
              <Button variant="exit" size="lg" className="mt-2 w-full" disabled={!weights.length} onClick={() => openPrice(wSum, weights.length)}>Përfundo peshat <ArrowRight /></Button>
            </div>
          </div>
        </motion.div>
      )}

      {step === "pallet" && product && ship && (() => { const sum = pallets.reduce((a, p) => a + (+p || 0), 0); return (
        <motion.div key="pallet" {...fade}>
          <PageHeader title={`Paletat — ${product.name}`} right={<Button variant="ghost" onClick={() => setStep("method")}><ArrowLeft /></Button>} />
          <div className="max-w-md">
            <div className="mb-3 flex items-center gap-3"><Label className="mb-0">Numri i paletave</Label><Input type="number" className="w-24" value={pallets.length} onChange={e => { const n = Math.max(1, Math.min(40, +e.target.value || 1)); setPallets(p => Array.from({ length: n }, (_, i) => p[i] ?? "")); }} /></div>
            <div className="space-y-2">{pallets.map((p, i) => <div key={i} className="grid grid-cols-[40px_1fr_30px] items-center gap-2"><span className="text-center text-xs text-muted-foreground">#{i + 1}</span><Input type="number" step="0.01" placeholder="kg" value={p} onChange={e => setPallets(ps => ps.map((x, j) => j === i ? e.target.value : x))} /><span className="text-xs text-muted-foreground">kg</span></div>)}</div>
            <div className="mt-4 flex items-center justify-between rounded-md bg-secondary px-4 py-3"><span className="text-sm">Pesha totale</span><span className="text-2xl font-semibold tabular">{sum.toFixed(2)} kg</span></div>
            <Button variant="outline" size="sm" className="mt-2 w-full" disabled={!sum} onClick={printWeights}><FileText /> Gjenero PDF me peshat</Button>
            <Button variant="exit" size="lg" className="mt-2 w-full" disabled={!sum} onClick={() => openPrice(sum, pallets.filter(p => +p > 0).length)}>Vazhdo te çmimi <ArrowRight /></Button>
          </div>
        </motion.div>); })()}

      {step === "price" && product && ship && (() => { const p = +price || 0; return (
        <motion.div key="price" {...fade}>
          <PageHeader title={`Çmimi — ${product.name}`} right={<Button variant="ghost" onClick={() => setStep("method")}><ArrowLeft /></Button>} />
          <div className="max-w-md">
            <div className="rounded-lg border bg-card p-4 text-sm"><KV k="Dërgesa" v={`Lot ${lotOf(ship)}`} row /><KV k="Sasia" v={`${lineQty} ${method === "PALLET" ? "paleta" : "kartona"}`} row /><KV k="Metoda" v={method === "FIXED" ? `Peshë fikse (${fixedKg} kg × ${lineQty})` : method === "VARIABLE" ? `Peshë e ndryshme (${lineQty} futur)` : `Paleta (${lineQty})`} row /><KV k="Pesha" v={<span className="text-exit">{fmtKg(lineKg)}</span>} row /><KV k="Kosto / kg" v={fmtNum(ship.costPerKg) + " Lek"} row /></div>
            <Label className="mt-4">Çmimi i shitjes për kg (Lek)</Label><Input type="number" autoFocus value={price} onChange={e => setPrice(e.target.value)} className="h-14 text-xl font-semibold" placeholder="p.sh. 480" />
            <div className="mt-3 rounded-lg bg-exit/10 p-4 text-sm text-exit tabular"><div className="flex justify-between"><span>{fmtKg(lineKg)}</span><span>× {fmtNum(p)} Lek</span></div><div className="mt-1 flex items-center justify-between border-t border-exit/30 pt-3"><span className="font-medium">Vlera e produktit</span><span className="text-xl font-semibold">{fmtLek(lineKg * p)}</span></div>{p > 0 && <div className="mt-1 text-xs opacity-80">Marzhi: {fmtLek(lineKg * (p - ship.costPerKg))} ({(((p - ship.costPerKg) / p) * 100).toFixed(1)}%)</div>}</div>
            <Button variant="exit" size="lg" className="mt-3 w-full" disabled={!p} onClick={addLine}><Plus /> Shto në porosi</Button>
          </div>
        </motion.div>); })()}

      {step === "client" && (
        <motion.div key="client" {...fade}>
          <PageHeader title="Klienti" sub="Zgjidh klientin për të finalizuar porosinë" right={<Button variant="ghost" onClick={() => setStep("order")}><ArrowLeft /></Button>} />
          <div className="max-w-md">
            <Label>Klienti</Label>
            <Select value={clientId} onValueChange={setClientId}><SelectTrigger><SelectValue placeholder="Zgjidh klientin" /></SelectTrigger><SelectContent>{store.clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.city}</SelectItem>)}</SelectContent></Select>
            <div className="mt-4 rounded-lg bg-exit/10 p-4 text-sm text-exit tabular"><div className="flex justify-between py-1"><span>Produkte</span><span>{lines.length}</span></div><div className="flex justify-between py-1"><span>Pesha totale</span><span>{fmtKg(totalKg)}</span></div><div className="mt-1 flex items-center justify-between border-t border-exit/30 pt-3"><span className="font-medium">Vlera totale</span><span className="text-xl font-semibold">{fmtLek(totalVal)}</span></div></div>
            <Button variant="exit" size="lg" className="mt-3 w-full" disabled={!clientId} onClick={finalize}><Check /> Finalizo porosinë</Button>
          </div>
        </motion.div>
      )}

      {step === "done" && doneSale && (
        <motion.div key="done" {...fade} className="mx-auto max-w-md py-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-entry/40 bg-entry/15"><Check className="h-8 w-8 text-entry" /></motion.div>
          <h2 className="text-lg font-semibold">Porosia u finalizua</h2>
          <p className="mb-5 text-sm text-muted-foreground">Klienti: {store.clients.find(c => c.id === clientId)?.name} · {fmtDate("2026-09-15")}</p>
          <div className="rounded-lg border bg-card p-4 text-left text-sm">{lines.map((l, i) => <div key={i} className="flex justify-between border-b py-2 last:border-0"><span>{pname(l.productId)} <span className="text-muted-foreground">({fmtKg(l.kg)})</span></span><span className="tabular">{fmtLek(l.total)}</span></div>)}<div className="mt-2 flex justify-between border-t pt-3 font-medium"><span>Totali</span><span className="text-exit tabular">{fmtLek(doneSale.totalValue)}</span></div></div>
          <p className="mt-3 text-xs text-muted-foreground">Stoku u përditësua — kg u hoqën nga dërgesat përkatëse dhe lëvizjet u regjistruan.</p>
          <Button variant="exit" size="lg" className="mt-4 w-full" onClick={reset}>Porosi e re</Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MethodCard({ icon: Icon, title, desc, rec, onClick }: { icon: React.ElementType; title: string; desc: string; rec?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={cn("flex w-full items-start gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:border-exit", rec && "border-entry/50 bg-entry/5")}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary"><Icon className="h-5 w-5" /></div><div><div className="flex items-center gap-2 text-sm font-medium">{title}{rec && <Badge variant="entry">rekomanduar</Badge>}</div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p></div></button>;
}
const Key = ({ children, onClick, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" onClick={onClick} className={cn("h-16 select-none rounded-md border bg-card text-2xl font-medium transition-transform active:scale-95 hover:bg-accent", className)} {...rest}>{children}</button>;
const Big = ({ v, l, accent }: { v: string; l: string; accent?: boolean }) => <div className="text-center"><div className={cn("text-xl font-semibold", accent && "text-2xl text-exit")}>{v}</div><div className="text-[10px] text-muted-foreground">{l}</div></div>;
const KV = ({ k, v, row }: { k: string; v: React.ReactNode; row?: boolean }) => row ? <div className="flex justify-between border-b py-2 last:border-0"><span className="text-muted-foreground">{k}</span><span className="font-medium tabular">{v}</span></div> : <div><div className="text-[10px] text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>;
