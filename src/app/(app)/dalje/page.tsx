"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Delete, Equal, FileText, Keyboard, Layers, Plus, Printer, Receipt, UserCheck, X } from "lucide-react";
import { openReceiptWindow, receiptFor, printSale, showReceipt } from "@/lib/print-receipt";
import { Button } from "@/components/ui/button";
import { DecimalInput, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/shell";
import { SearchBox, matches } from "@/components/search-box";
import { remainingCount, remainingKg, useStore } from "@/lib/store";
import { fefoOrder } from "@/lib/calc";
import { loadSpecLabel, loadWeightType, shipmentLabel } from "@/lib/stock";
import type { Product, Sale, SaleLine, SaleMethod, Shipment } from "@/lib/types";
import { cn, daysUntil, fmtDate, fmtKg, fmtLek, fmtMonth, fmtNum, saleMethodLabel, todayInTirane } from "@/lib/utils";

type Step = "order" | "product" | "shipment" | "method" | "fixed" | "format" | "keypad" | "pallet" | "total" | "price" | "client" | "done";
const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.18 } };
const FORMATS = [{ i: 2, d: 2, ex: "24.55", type: "2455" }, { i: 2, d: 3, ex: "19.877", type: "19877" }, { i: 2, d: 1, ex: "20.4", type: "204" }, { i: 3, d: 2, ex: "118.40", type: "11840" }];
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export default function DaljePage() {
  const store = useStore();
  const [step, setStep] = useState<Step>("order");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [ship, setShip] = useState<Shipment | null>(null);
  const [qProduct, setQProduct] = useState(""); const [qShip, setQShip] = useState(""); const [qClient, setQClient] = useState("");
  const [method, setMethod] = useState<SaleMethod>("VARIABLE");
  const [fixedKg, setFixedKg] = useState(""); const [fixedN, setFixedN] = useState("");
  const [fmt, setFmt] = useState({ i: 2, d: 2 }); const [buf, setBuf] = useState(""); const [weights, setWeights] = useState<number[]>([]);
  const [pallets, setPallets] = useState<string[]>(["", "", ""]);
  // The pallet count is typed freely (it may be empty while editing); the weight rows follow it once it is a valid number.
  const [palletN, setPalletN] = useState("3");
  const [totN, setTotN] = useState(""); const [totKg, setTotKg] = useState("");
  const [price, setPrice] = useState("");
  const [clientId, setClientId] = useState(""); const [saleDate, setSaleDate] = useState(todayInTirane);
  const [lineKg, setLineKg] = useState(0); const [lineQty, setLineQty] = useState<number | null>(null);
  const [doneSale, setDoneSale] = useState<Sale | null>(null);
  const [saving, setSaving] = useState(false);
  const requestId = useRef<string | null>(null);

  const totalKg = lines.reduce((a, l) => a + l.kg, 0), totalVal = lines.reduce((a, l) => a + l.total, 0);
  const pname = (id: string) => store.products.find(p => p.id === id)?.name ?? id;
  const lotOf = (s: Shipment) => s.lots.map(l => l.lotNumber).join(", ") || "pa lot";
  const unitOf = (s?: Shipment | null) => s?.loadType === "PALLET" ? "paleta" : "kartona";

  // fast keypad
  const need = fmt.i + fmt.d;
  const commit = (b = buf) => { if (!b) return; const p = b.padStart(need, "0"); setWeights(w => [...w, parseFloat(p.slice(0, fmt.i) + "." + p.slice(fmt.i))]); setBuf(""); };
  const press = (d: string) => { if (buf.length >= need) return; const nb = buf + d; setBuf(nb); if (nb.length === need) setTimeout(() => commit(nb), 110); };
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (gridRef.current) gridRef.current.scrollTop = gridRef.current.scrollHeight; }, [weights]);
  useEffect(() => {
    if (step !== "keypad") return;
    const h = (e: KeyboardEvent) => { if (e.key >= "0" && e.key <= "9") { e.preventDefault(); press(e.key); } else if (e.key === "Backspace") { e.preventDefault(); setBuf(b => b.slice(0, -1)); } else if (e.key === "Enter") { e.preventDefault(); commit(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, buf, fmt]);
  const wSum = weights.reduce((a, b) => a + b, 0);

  const openPrice = (kg: number, qty: number | null) => { setLineKg(kg); setLineQty(qty); setPrice(""); setStep("price"); };
  const addLine = () => {
    if (!product || !ship) return; const p = +price || 0;
    requestId.current = null;
    setLines(ls => [...ls, { productId: product.id, shipmentId: ship.id, method, qty: lineQty, kg: +lineKg.toFixed(3), pricePerKg: p, total: lineKg * p, weights: method === "VARIABLE" ? weights : method === "PALLET" ? pallets.map(Number).filter(n => n > 0) : undefined, fixedKg: method === "FIXED" ? +fixedKg : undefined }]);
    toast.success(`${product.name} u shtua në porosi`); setStep("order");
  };
  /** Saves the sale; with `print`, also prints its order sheet ("Fletë porosi"), which gets its number when the sale is saved. */
  const finalize = async (print = false) => {
    if (saving) return;
    // The print window must be opened during the click itself, or the browser blocks it; it is filled once the sale is saved.
    const win = print ? openReceiptWindow() : null;
    setSaving(true);
    try {
      requestId.current ??= crypto.randomUUID();
      const s = await store.finalizeSale({ clientId, lines, totalKg: +totalKg.toFixed(2), totalValue: totalVal, requestId: requestId.current, date: saleDate });
      requestId.current = null;
      setDoneSale(s); setStep("done"); toast.success("Porosia u finalizua");
      if (print && !showReceipt(win, receiptFor(s, store.clients, store.products))) toast("Shfletuesi bllokoi dritaren e printimit. Shtyp «Printo faturën» më poshtë.");
    } catch (e) { win?.close(); toast.error(e instanceof Error ? e.message : "Porosia nuk u finalizua"); }
    finally { setSaving(false); }
  };
  const reset = () => { requestId.current = null; setLines([]); setProduct(null); setShip(null); setWeights([]); setBuf(""); setClientId(""); setSaleDate(todayInTirane()); setDoneSale(null); setStep("order"); };
  const printWeights = () => {
    const w = method === "PALLET" ? pallets.map(Number).filter(n => n > 0) : weights; const win = window.open("", "_blank"); if (!win) return;
    win.document.write(`<html><head><title>Peshat — ${escapeHtml(product?.name ?? "")}</title><style>body{font-family:system-ui;padding:32px;color:#111}h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:0 0 16px;font-size:13px}table{border-collapse:collapse;width:100%;max-width:420px}td{padding:6px 10px;border-bottom:1px solid #ddd;font-size:14px}td:last-child{text-align:right;font-variant-numeric:tabular-nums}tr.t td{font-weight:700;border-top:2px solid #111;border-bottom:0}</style></head><body><h1>${escapeHtml(product?.name ?? "")}</h1><p>Lot ${escapeHtml(ship ? lotOf(ship) : "")} · ${fmtDate(todayInTirane())} · FrigoCold WMS</p><table>${w.map((x, i) => `<tr><td>#${i + 1}</td><td>${fmtNum(x, 3)} kg</td></tr>`).join("")}<tr class="t"><td>Totali (${w.length})</td><td>${fmtNum(w.reduce((a, b) => a + b, 0), 3)} kg</td></tr></table><script>window.print()</script></body></html>`);
    win.document.close();
  };
  const today = todayInTirane();
  const minDate = lines.reduce((m, l) => { const e = store.shipments.find(x => x.id === l.shipmentId)?.entryDate ?? ""; return e > m ? e : m; }, "");
  const dateErr = !saleDate ? "Zgjidh datën e shitjes" : saleDate > today ? "Data nuk mund të jetë në të ardhmen" : minDate && saleDate < minDate ? `Data nuk mund të jetë para hyrjes së mallit (${fmtDate(minDate)})` : "";
  const fefo = useMemo(() => product ? fefoOrder(store.shipments, product.id) : [], [product, store.shipments]);

  return (
    <AnimatePresence mode="wait">
      {step === "order" && (
        <motion.div key="order" {...fade}>
          <PageHeader title="Porosi shitjeje" sub={lines.length ? `${lines.length} produkte · ${fmtKg(totalKg)}` : "Shto produktet një nga një. Klienti zgjidhet në fund."} />
          <div className="space-y-2">
            {lines.map((l, i) => { const s = store.shipments.find(x => x.id === l.shipmentId); return (
              <div key={i} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium">{pname(l.productId)}</div><div className="text-xs text-muted-foreground">Lot {s ? lotOf(s) : "—"} · {l.qty == null ? "sasi e panjohur" : `${l.qty} ${unitOf(s)}`} · {saleMethodLabel(l, unitOf(s))}</div></div><Button variant="ghost" size="icon" aria-label="Hiq" onClick={() => { requestId.current = null; setLines(ls => ls.filter((_, j) => j !== i)); }}><X /></Button></div>
                <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-sm tabular"><KV k="Pesha" v={fmtKg(l.kg)} /><KV k="Çmimi/kg" v={fmtNum(l.pricePerKg, 2) + " Lek"} /><KV k="Vlera" v={<span className="text-exit">{fmtLek(l.total)}</span>} /></div>
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
          <SearchBox value={qProduct} onChange={setQProduct} placeholder="Kërko produktin…" autoFocus />
          <div className="space-y-2">
            {store.products.filter(p => matches(qProduct, p.name)).map(p => { const sh = store.shipments.filter(s => s.productId === p.id && remainingKg(s) > 0); const kg = sh.reduce((a, s) => a + remainingKg(s), 0); if (!sh.length) return null; return (
              <button key={p.id} onClick={() => { setProduct(p); setQShip(""); setStep("shipment"); }} className="flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-left transition-colors hover:border-exit/60">
                <div><div className="text-sm font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{sh.length} ngarkesa · {fmtKg(kg, 0)}</div></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>); })}
            {!store.products.some(p => matches(qProduct, p.name) && store.shipments.some(s => s.productId === p.id && remainingKg(s) > 0)) && <p className="py-8 text-center text-sm text-muted-foreground">Asnjë produkt në stok nuk përputhet me kërkimin.</p>}
          </div>
        </motion.div>
      )}

      {step === "shipment" && product && (
        <motion.div key="shipment" {...fade}>
          <PageHeader title={`Nga cila dërgesë? — ${product.name}`} right={<Button variant="ghost" onClick={() => setStep("product")}><ArrowLeft /></Button>} />
          <Banner tone="warn" className="mb-4">Rendi FEFO — dërgesa me skadim më të afërt duhet shitur e para. Rekomandimi nuk është detyrim.</Banner>
          {fefo.length > 4 && <SearchBox value={qShip} onChange={setQShip} placeholder="Kërko lot, furnizues, origjinë, porosi…" />}
          <div className="space-y-2">
            {fefo.map((s, i) => { const d = daysUntil(s.expFrom); const sup = store.suppliers.find(x => x.id === s.supplierId); if (!matches(qShip, shipmentLabel(s), sup?.name, s.orderNr, s.origin, s.specs)) return null; return (
              <button key={s.id} onClick={() => { setShip(s); setMethod(loadWeightType(s)); setTotN(""); setTotKg(""); setStep("method"); }} className={cn("flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3.5 text-left transition-colors hover:border-exit/60", i === 0 && "border-danger/40")}>
                <div><div className="text-sm font-medium">{shipmentLabel(s)} · {sup?.name ?? "Pa furnizues"}</div><div className="text-xs text-muted-foreground">{loadSpecLabel(s)}</div><div className="text-xs text-muted-foreground">Porosia {s.orderNr ?? "—"} · {remainingCount(s) ?? "sasi e panjohur"} {s.loadType === "PALLET" ? "paleta" : "kartona"} · {fmtKg(remainingKg(s), 1)} · skadon {fmtMonth(s.expFrom)}</div></div>
                {i === 0 ? <Badge variant="solid">shit i pari · {d} ditë</Badge> : <Badge variant="entry">{fmtMonth(s.expFrom)}</Badge>}
              </button>); })}
          </div>
        </motion.div>
      )}

      {step === "method" && product && ship && (() => { const wt = loadWeightType(ship); return (
        <motion.div key="method" {...fade}>
          <PageHeader title="Si do të llogaritet pesha?" right={<Button variant="ghost" onClick={() => setStep("shipment")}><ArrowLeft /></Button>} />
          <Banner className="mb-4">{wt === "FIXED" ? `Kjo ngarkesë ka peshë fikse (${ship.fixedKg} kg/karton).` : wt === "PALLET" ? "Kjo ngarkesë vjen mbi paleta." : "Kjo ngarkesë ka peshë të ndryshme për karton."} Zgjidh si do ta regjistrosh këtë shitje: {wt === "PALLET" ? "peshën e secilës paletë" : "peshën e secilit karton"} ose vetëm numrin dhe peshën totale.{ship.countActual == null ? ` Numri i ${wt === "PALLET" ? "paletave" : "kartonave"} në këtë ngarkesë nuk dihet, ndaj kontrollohen vetëm kg.` : ""}</Banner>
          <div className="max-w-xl space-y-3">
            {wt !== "PALLET" && <MethodCard icon={Equal} title="Peshë fikse për karton" desc="Të gjithë kartonët kanë të njëjtën peshë. Fut peshën një herë dhe numrin e kartonave — sistemi shumëzon." rec={wt === "FIXED"} onClick={() => { setMethod("FIXED"); setFixedKg(String(ship.fixedKg ?? "")); const rc = remainingCount(ship); setFixedN(rc == null ? "" : String(Math.min(40, rc))); setStep("fixed"); }} />}
            {wt !== "PALLET" && <MethodCard icon={Keyboard} title="Peshë e ndryshme për karton" desc="Çdo karton ka peshë tjetër. Shkruaj peshat me tastierë të shpejtë — sistemi i mbledh vetë." rec={wt === "VARIABLE"} onClick={() => { setMethod("VARIABLE"); setWeights([]); setBuf(""); setStep("format"); }} />}
            {wt === "PALLET" && <MethodCard icon={Layers} title="Peshë për secilën paletë" desc="Fut peshën e secilës paletë veç e veç." rec onClick={() => { setMethod("PALLET"); setPallets(["", "", ""]); setPalletN("3"); setStep("pallet"); }} />}
            <MethodCard icon={Receipt} title="Vetëm numri dhe pesha totale" desc={wt === "PALLET" ? "Fut numrin e paletave dhe peshën totale (p.sh. nga fatura) — pa peshat e secilës paletë." : "Fut numrin e kartonave dhe peshën totale (p.sh. nga fatura) — pa peshat e secilit karton."} onClick={() => { setMethod("TOTAL"); setTotN(""); setTotKg(""); setStep("total"); }} />
          </div>
        </motion.div>
      ); })()}

      {step === "fixed" && product && ship && (() => { const w = +fixedKg || 0, n = +fixedN || 0, rc = remainingCount(ship), over = rc == null ? w * n > remainingKg(ship) + 0.0005 : n > rc; return (
        <motion.div key="fixed" {...fade}>
          <PageHeader title={`Peshë fikse — ${product.name}`} right={<Button variant="ghost" onClick={() => setStep("method")}><ArrowLeft /></Button>} />
          <div className="max-w-md rounded-lg border bg-card p-5">
            <div className="grid grid-cols-2 gap-3"><div><Label>Pesha për karton (kg)</Label><DecimalInput value={fixedKg} onChange={e => setFixedKg(e.target.value)} className="h-14 text-center text-xl font-semibold" /></div><div><Label>Numri i kartonave</Label><Input type="number" value={fixedN} onChange={e => setFixedN(e.target.value)} className="h-14 text-center text-xl font-semibold" /></div></div>
            <div className="mt-3 flex flex-wrap gap-2">{[...new Set([10, 20, 40, ...(rc == null ? [] : [rc])])].filter(x => x > 0 && (rc == null || x <= rc)).map(x => <Button key={x} size="sm" variant="outline" onClick={() => setFixedN(String(x))}>{x} kartona</Button>)}</div>
            <div className="mt-4 flex items-center justify-center gap-4 rounded-md bg-secondary p-4 tabular"><Big v={fmtNum(w, 3)} l="kg / karton" /><span className="text-muted-foreground">×</span><Big v={String(n)} l="kartona" /><span className="text-muted-foreground">=</span><Big v={fmtNum(w * n, 3)} l="kg total" accent /></div>
            <div className={cn("mt-3 flex justify-between rounded-md px-3 py-2 text-xs", over ? "bg-warn/10 text-warn" : "bg-entry/10 text-entry")}><span>{over ? "Më shumë se stoku i lotit!" : rc == null ? "Kg në stok te ky lot" : "Në stok te ky lot"}</span><span className="tabular">{rc == null ? `${fmtNum(w * n, 3)} / ${fmtNum(remainingKg(ship), 3)} kg` : `${n} / ${rc}`}</span></div>
            <Button variant="exit" size="lg" className="mt-4 w-full" disabled={!w || !n || over} onClick={() => openPrice(w * n, n)}>Vazhdo te çmimi <ArrowRight /></Button>
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
                <div ref={gridRef} className="scroll-thin grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto">{weights.map((w, i) => <button key={i} onClick={() => setWeights(ws => ws.filter((_, j) => j !== i))} className="group rounded-md border bg-card px-1 py-1.5 text-center font-mono text-xs tabular hover:border-danger" title="Hiq"><span className="block text-[9px] text-muted-foreground group-hover:text-danger">#{i + 1}</span>{fmtNum(w, fmt.d)}</button>)}</div>
                {weights.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Asnjë peshë ende. Fillo të shkruash.</p>}
                <div className="mt-3 border-t pt-3 tabular"><div className="flex justify-between text-xs"><span className="text-muted-foreground">Kartona</span><span>{weights.length}</span></div><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Totali</span><span className="text-2xl font-semibold text-exit">{fmtNum(wSum, 3)}</span></div></div>
                {(() => { const rc = remainingCount(ship), over = rc == null ? wSum > remainingKg(ship) + 0.0005 : weights.length > rc; return <div className={cn("mt-2 flex justify-between rounded-md px-3 py-2 text-xs", over ? "bg-warn/10 text-warn" : "bg-entry/10 text-entry")}><span>{over ? "Më shumë se stoku!" : rc == null ? "Kg në stok te ky lot" : "Në stok te ky lot"}</span><span className="tabular">{rc == null ? `${fmtNum(wSum, 3)} / ${fmtNum(remainingKg(ship), 3)} kg` : `${weights.length} / ${rc}`}</span></div>; })()}
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
            <div className="mb-3 flex items-center gap-3"><Label className="mb-0">Numri i paletave</Label><Input type="number" inputMode="numeric" className="w-24" value={palletN} onChange={e => { const v = e.target.value.replace(/\D/g, ""); setPalletN(v); const n = Math.min(40, parseInt(v, 10)); if (n >= 1) setPallets(p => Array.from({ length: n }, (_, i) => p[i] ?? "")); }} onBlur={() => { if (!(parseInt(palletN, 10) >= 1)) setPalletN(String(pallets.length)); else if (parseInt(palletN, 10) > 40) setPalletN("40"); }} /></div>
            <div className="space-y-2">{pallets.map((p, i) => <div key={i} className="grid grid-cols-[40px_1fr_30px] items-center gap-2"><span className="text-center text-xs text-muted-foreground">#{i + 1}</span><DecimalInput placeholder="kg" value={p} onChange={e => setPallets(ps => ps.map((x, j) => j === i ? e.target.value : x))} /><span className="text-xs text-muted-foreground">kg</span></div>)}</div>
            <div className="mt-4 flex items-center justify-between rounded-md bg-secondary px-4 py-3"><span className="text-sm">Pesha totale</span><span className="text-2xl font-semibold tabular">{fmtNum(sum, 3)} kg</span></div>
            <div className={cn("mt-2 flex justify-between rounded-md px-3 py-2 text-xs", sum > remainingKg(ship) + 0.0005 ? "bg-warn/10 text-warn" : "bg-entry/10 text-entry")}><span>{sum > remainingKg(ship) + 0.0005 ? "Më shumë kg se stoku i lotit!" : "Kg në stok te ky lot"}</span><span className="tabular">{fmtNum(sum, 3)} / {fmtNum(remainingKg(ship), 3)} kg</span></div>
            <Button variant="outline" size="sm" className="mt-2 w-full" disabled={!sum} onClick={printWeights}><FileText /> Gjenero PDF me peshat</Button>
            <Button variant="exit" size="lg" className="mt-2 w-full" disabled={!sum || sum > remainingKg(ship) + 0.0005} onClick={() => openPrice(sum, pallets.filter(p => +p > 0).length)}>Vazhdo te çmimi <ArrowRight /></Button>
          </div>
        </motion.div>); })()}

      {step === "total" && product && ship && (() => {
        const n = Number(totN), kg = Number(totKg), unit = unitOf(ship);
        const countKnown = ship.countActual != null;
        const validN = !countKnown && !totN.trim() || Number.isSafeInteger(n) && n > 0;
        const validKg = /^(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(totKg) && Number.isFinite(kg) && kg > 0;
        const overN = countKnown && n > (remainingCount(ship) ?? 0), overKg = kg > remainingKg(ship);
        return (
        <motion.div key="total" {...fade}>
          <PageHeader title={`Numri dhe pesha totale — ${product.name}`} sub={shipmentLabel(ship)} right={<Button variant="ghost" onClick={() => setStep("method")}><ArrowLeft /></Button>} />
          <div className="max-w-md rounded-lg border bg-card p-5">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Numri i {unit === "paleta" ? "paletave" : "kartonave"}{!countKnown && " (opsional)"}</Label><Input type="number" inputMode="numeric" step="1" min="1" autoFocus value={totN} onChange={e => setTotN(e.target.value)} className="h-14 text-center text-xl font-semibold" placeholder="0" /></div>
              <div><Label>Pesha totale (kg)</Label><DecimalInput value={totKg} onChange={e => setTotKg(e.target.value)} className="h-14 text-center text-xl font-semibold" placeholder="0.000" /></div>
            </div>
            {totN && !validN && <p className="mt-2 text-xs text-danger">Numri duhet të jetë një numër i plotë pozitiv.</p>}
            {totKg && !validKg && <p className="mt-2 text-xs text-danger">Pesha duhet të jetë pozitive, me maksimum 3 shifra pas presjes.</p>}
            <div className="mt-4 flex items-center justify-center gap-4 rounded-md bg-secondary p-4 tabular"><Big v={Number.isFinite(kg) ? fmtNum(kg, 3) : "—"} l="kg total" accent /><span className="text-muted-foreground">÷</span><Big v={totN.trim() ? String(n) : "—"} l={unit} /><span className="text-muted-foreground">=</span><Big v={n > 0 && validN && Number.isFinite(kg) ? fmtNum(kg / n, 2) : "—"} l={unit === "paleta" ? "kg / paletë (mes.)" : "kg / karton (mes.)"} /></div>
            {countKnown && <div className={cn("mt-3 flex justify-between rounded-md px-3 py-2 text-xs", overN ? "bg-warn/10 text-warn" : "bg-entry/10 text-entry")}><span>{overN ? `Më shumë ${unit} se stoku i lotit!` : `${unit === "paleta" ? "Paleta" : "Kartona"} në stok te ky lot`}</span><span>{n} / {(remainingCount(ship) ?? 0)}</span></div>}
            <div className={cn("mt-1.5 flex justify-between rounded-md px-3 py-2 text-xs", overKg ? "bg-warn/10 text-warn" : "bg-entry/10 text-entry")}><span>{overKg ? "Më shumë kg se stoku i lotit!" : "Kg në stok te ky lot"}</span><span className="tabular">{Number.isFinite(kg) ? fmtNum(kg, 3) : "—"} / {fmtNum(remainingKg(ship), 3)}</span></div>
            <p className="mt-3 text-xs text-muted-foreground">Shkruaj shifrat siç janë në faturë. Stoku zbritet me peshën totale; peshat e secilit {unit === "paleta" ? "paletë" : "karton"} nuk ruhen.</p>
            <Button variant="exit" size="lg" className="mt-4 w-full" disabled={!validN || !validKg || overN || overKg} onClick={() => openPrice(kg, totN.trim() ? n : null)}>Vazhdo te çmimi <ArrowRight /></Button>
          </div>
        </motion.div>); })()}

      {step === "price" && product && ship && (() => { const p = +price || 0; return (
        <motion.div key="price" {...fade}>
          <PageHeader title={`Çmimi — ${product.name}`} right={<Button variant="ghost" onClick={() => setStep(method === "TOTAL" ? "total" : method === "FIXED" ? "fixed" : method === "PALLET" ? "pallet" : "keypad")}><ArrowLeft /></Button>} />
          <div className="max-w-md">
            <div className="rounded-lg border bg-card p-4 text-sm"><KV k="Dërgesa" v={`Lot ${lotOf(ship)}`} row /><KV k="Sasia" v={lineQty == null ? "E panjohur" : `${lineQty} ${unitOf(ship)}`} row /><KV k="Metoda" v={saleMethodLabel({ method, qty: lineQty, kg: lineKg, fixedKg: +fixedKg }, unitOf(ship))} row /><KV k="Pesha" v={<span className="text-exit">{fmtKg(lineKg)}</span>} row /><KV k="Kosto / kg" v={fmtNum(ship.costPerKg, 2) + " Lek"} row /></div>
            {ship.costPerKg == null && <p className="mt-2 text-sm text-warn">Kostoja nuk dihet; fitimi dhe marzhi nuk mund të llogariten.</p>}<Label className="mt-4">Çmimi i shitjes për kg (Lek)</Label><DecimalInput autoFocus value={price} onChange={e => setPrice(e.target.value)} className="h-14 text-xl font-semibold" placeholder="p.sh. 480" />
            <div className="mt-3 rounded-lg bg-exit/10 p-4 text-sm text-exit tabular"><div className="flex justify-between"><span>{fmtKg(lineKg)}</span><span>× {fmtNum(p)} Lek</span></div><div className="mt-1 flex items-center justify-between border-t border-exit/30 pt-3"><span className="font-medium">Vlera e produktit</span><span className="text-xl font-semibold">{fmtLek(lineKg * p)}</span></div>{p > 0 && ship.costPerKg != null && <div className="mt-1 text-xs opacity-80">Marzhi: {fmtLek(lineKg * (p - ship.costPerKg))} ({(((p - ship.costPerKg) / p) * 100).toFixed(1)}%)</div>}</div>
            <Button variant="exit" size="lg" className="mt-3 w-full" disabled={!p} onClick={addLine}><Plus /> Shto në porosi</Button>
          </div>
        </motion.div>); })()}

      {step === "client" && (
        <motion.div key="client" {...fade}>
          <PageHeader title="Klienti" sub="Zgjidh klientin për të finalizuar porosinë" right={<Button variant="ghost" onClick={() => setStep("order")}><ArrowLeft /></Button>} />
          <div className="max-w-md">
            <Label>Klienti</Label>
            <SearchBox value={qClient} onChange={setQClient} placeholder="Kërko klientin (emri, qyteti)…" autoFocus={!clientId} />
            <div className="scroll-thin max-h-64 space-y-1 overflow-y-auto rounded-md border p-1" role="listbox" aria-label="Klientët">
              {store.clients.filter(c => matches(qClient, c.name, c.city, c.contact)).map(c => (
                <button key={c.id} type="button" role="option" aria-selected={clientId === c.id} onClick={() => { requestId.current = null; setClientId(c.id); }}
                  className={cn("flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-accent", clientId === c.id && "bg-exit/15 font-medium text-exit")}>
                  <span>{c.name}</span><span className="text-xs text-muted-foreground">{c.city}</span>
                </button>))}
              {!store.clients.some(c => matches(qClient, c.name, c.city, c.contact)) && <p className="px-3 py-4 text-center text-xs text-muted-foreground">Asnjë klient nuk përputhet.</p>}
            </div>
            <Label className="mt-4">Data e shitjes</Label>
            <div className="flex gap-2"><Input type="date" value={saleDate} max={today} min={minDate || undefined} onChange={e => { requestId.current = null; setSaleDate(e.target.value); }} className="flex-1" />{saleDate !== today && <Button variant="outline" onClick={() => { requestId.current = null; setSaleDate(today); }}>Sot</Button>}</div>
            {dateErr ? <p className="mt-1.5 text-xs text-danger">{dateErr}</p> : saleDate !== today ? <p className="mt-1.5 text-xs text-warn">Shitje e mëparshme — do të regjistrohet më {fmtDate(saleDate)} (llogaritet në atë ditë e muaj te Financa).</p> : <p className="mt-1.5 text-xs text-muted-foreground">Sot. Ndryshoje nëse po regjistron një faturë të një dite tjetër.</p>}
            <div className="mt-4 rounded-lg bg-exit/10 p-4 text-sm text-exit tabular"><div className="flex justify-between py-1"><span>Produkte</span><span>{lines.length}</span></div><div className="flex justify-between py-1"><span>Pesha totale</span><span>{fmtKg(totalKg)}</span></div><div className="mt-1 flex items-center justify-between border-t border-exit/30 pt-3"><span className="font-medium">Vlera totale</span><span className="text-xl font-semibold">{fmtLek(totalVal)}</span></div></div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" disabled={!clientId || !!dateErr || saving} onClick={() => finalize(true)}><Printer /> Printo faturën</Button>
              <Button variant="exit" size="lg" disabled={!clientId || !!dateErr || saving} onClick={() => finalize()}><Check /> {saving ? "Po ruhet…" : "Finalizo porosinë"}</Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">«Printo faturën» e ruan porosinë dhe hap fletën e porosisë me numrin e saj për ta printuar ose ruajtur si PDF.</p>
          </div>
        </motion.div>
      )}

      {step === "done" && doneSale && (
        <motion.div key="done" {...fade} className="mx-auto max-w-md py-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-entry/40 bg-entry/15"><Check className="h-8 w-8 text-entry" /></motion.div>
          <h2 className="text-lg font-semibold">Porosia u finalizua{doneSale.receiptNr != null ? ` · Fletë porosi nr. ${doneSale.receiptNr}` : ""}</h2>
          <p className="mb-5 text-sm text-muted-foreground">Klienti: {store.clients.find(c => c.id === clientId)?.name} · {fmtDate(saleDate)}</p>
          <div className="rounded-lg border bg-card p-4 text-left text-sm">{lines.map((l, i) => <div key={i} className="flex justify-between border-b py-2 last:border-0"><span>{pname(l.productId)} <span className="text-muted-foreground">({fmtKg(l.kg)})</span></span><span className="tabular">{fmtLek(l.total)}</span></div>)}<div className="mt-2 flex justify-between border-t pt-3 font-medium"><span>Totali</span><span className="text-exit tabular">{fmtLek(doneSale.totalValue)}</span></div></div>
          <p className="mt-3 text-xs text-muted-foreground">Stoku u përditësua — kg u hoqën nga dërgesat përkatëse dhe lëvizjet u regjistruan.</p>
          <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" size="lg" onClick={() => { if (!printSale(doneSale, store.clients, store.products)) toast.error("Shfletuesi bllokoi dritaren e printimit. Lejo dritaret pop-up për këtë faqe."); }}><Printer /> Printo faturën</Button><Button variant="exit" size="lg" onClick={reset}>Porosi e re</Button></div>
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
