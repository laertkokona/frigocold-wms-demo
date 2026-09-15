"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, LineChart } from "@/components/ui/chart";
import { PageHeader } from "@/components/shell";
import { useStore } from "@/lib/store";
import {
  buildPeriod, capitalAtRisk, clientRows, headline, lotRows, monthlyEcon, priceDispersion, priceSeries,
  productRows, supplierRows, trailingMonths, type PeriodKey,
} from "@/lib/accounting";
import { cn, fmtDate, fmtKg, fmtLek, fmtNum } from "@/lib/utils";

export default function Kontabiliteti() {
  const { sales, shipments, products, clients, suppliers, thresholds } = useStore();
  const [pk, setPk] = useState<PeriodKey>("month");
  const p = useMemo(() => buildPeriod(pk), [pk]);
  const cur = useMemo(() => headline(sales, shipments, p.from, p.to), [sales, shipments, p]);
  const prev = useMemo(() => headline(sales, shipments, p.prevFrom, p.prevTo), [sales, shipments, p]);
  const months = useMemo(() => trailingMonths(8), []);
  const series = useMemo(() => monthlyEcon(sales, shipments, months), [sales, shipments, months]);
  const prods = useMemo(() => productRows(products, sales, shipments, p), [products, sales, shipments, p]);
  const clis = useMemo(() => clientRows(clients, sales, shipments, p), [clients, sales, shipments, p]);
  const sups = useMemo(() => supplierRows(suppliers, shipments, sales, p), [suppliers, shipments, sales, p]);
  const lots = useMemo(() => lotRows(shipments, products, suppliers, sales), [shipments, products, suppliers, sales]);
  const risk = useMemo(() => capitalAtRisk(shipments, thresholds), [shipments, thresholds]);

  const [priceProd, setPriceProd] = useState(products[0]?.id ?? "");
  const pSeries = useMemo(() => priceSeries(priceProd, sales, shipments, months), [priceProd, sales, shipments, months]);
  const disp = useMemo(() => priceDispersion(priceProd, clients, sales, p), [priceProd, clients, sales, p]);

  const maxRev = Math.max(1, ...series.map(s => s.revenue));
  const exportCsv = () => {
    const rows = [["Produkti", "Kg", "Të ardhura", "Kosto e mallit", "Fitim bruto", "Marzh %", "Çmim mes./kg", "Kosto mes./kg", "Diferenca/kg"],
      ...prods.map(r => [r.product.name, r.kg.toFixed(2), Math.round(r.revenue), Math.round(r.cogs), Math.round(r.profit), (r.margin * 100).toFixed(1), r.avgSell.toFixed(0), r.avgCost.toFixed(0), r.spread.toFixed(0)])];
    const csv = rows.map(r => r.map(x => `"${x}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `kontabiliteti-${p.label.replace(/\s/g, "-")}.csv`; a.click();
  };

  return (
    <>
      <PageHeader title="Kontabiliteti" sub={`${p.label} · krahasuar me ${p.prevLabel}`}
        right={<div className="flex flex-wrap items-center gap-2">
          <Segmented value={pk} onChange={setPk} className="w-[300px]" options={[{ value: "month", label: "Muaji" }, { value: "quarter", label: "Tremujori" }, { value: "year", label: "Viti" }, { value: "all", label: "Gjithçka" }]} />
          <Button variant="outline" onClick={exportCsv}><Download /> CSV</Button>
        </div>} />

      <Banner className="mb-5">
        <b>Fitim bruto, jo neto.</b> Këto shifra përfshijnë vetëm koston e mallit të shitur (kosto e lotit specifik). Shpenzimet operative — qira, paga, energji e frigoriferëve, transport i brendshëm — nuk janë në sistem ende, ndaj fitimi real është më i ulët. Gjithashtu, një shitje llogaritet e ardhur në momentin e regjistrimit, pavarësisht nëse klienti ka paguar.
      </Banner>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Të ardhura" value={fmtLek(cur.revenue)} delta={d(cur.revenue, prev.revenue)} hidePrev={pk === "all"} />
        <Kpi label="Kosto e mallit" value={fmtLek(cur.cogs)} delta={d(cur.cogs, prev.cogs)} invert hidePrev={pk === "all"} />
        <Kpi label="Fitim bruto" value={fmtLek(cur.profit)} delta={d(cur.profit, prev.profit)} tone="entry" hidePrev={pk === "all"} />
        <Kpi label="Marzh bruto" value={`${(cur.margin * 100).toFixed(1)}%`} sub={pk === "all" ? undefined : `${(prev.margin * 100).toFixed(1)}% më parë`} tone="entry" />
        <Kpi label="Blerje (dalje parash)" value={fmtLek(cur.purchaseSpend)} sub={`${cur.orders} porosi shitjeje`} />
        <Kpi label="Stok në magazinë (kosto)" value={fmtLek(cur.inventoryValue)} sub={risk.value > 0 ? `${fmtLek(risk.value)} në rrezik skadimi` : "pa rrezik skadimi"} tone={risk.value > 0 ? "warn" : undefined} />
      </div>

      <Tabs defaultValue="ov">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="ov">Përmbledhje</TabsTrigger><TabsTrigger value="prod">Produktet</TabsTrigger>
          <TabsTrigger value="price">Çmimet</TabsTrigger><TabsTrigger value="cli">Klientët</TabsTrigger>
          <TabsTrigger value="sup">Furnizuesit</TabsTrigger><TabsTrigger value="lot">Lotet</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="ov">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Të ardhura, kosto dhe fitim</CardTitle><CardDescription>8 muajt e fundit · Lek</CardDescription></CardHeader><CardContent>
              <div className="flex h-44 items-end gap-2">
                {series.map(s => (
                  <div key={s.m} className="flex flex-1 flex-col items-center gap-1" title={`${s.label}: të ardhura ${fmtLek(s.revenue)}, fitim ${fmtLek(s.profit)}`}>
                    <div className="relative flex h-36 w-full items-end justify-center">
                      <div className="w-full rounded-t-sm bg-exit/25" style={{ height: `${(s.revenue / maxRev) * 100}%` }} />
                      <div className="absolute bottom-0 w-full rounded-t-sm bg-entry" style={{ height: `${(Math.max(0, s.profit) / maxRev) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{s.label}</span>
                  </div>))}
              </div>
              <div className="mt-3 flex gap-4 border-t pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-exit/25" />Të ardhura</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-entry" />Fitim bruto</span>
              </div>
            </CardContent></Card>

            <Card><CardHeader><CardTitle>Marzhi bruto sipas muajve</CardTitle><CardDescription>Përqindje e të ardhurave</CardDescription></CardHeader><CardContent>
              <LineChart height={176} aLabel="Marzh bruto %" unit="%" data={series.map(s => ({ label: s.label, a: s.revenue ? +(s.margin * 100).toFixed(1) : null }))} />
            </CardContent></Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Kontributi në fitim</CardTitle><CardDescription>Cili produkt e sjell fitimin — {p.label}</CardDescription></CardHeader><CardContent>
              {prods.filter(r => r.profit > 0).slice(0, 6).map(r => (
                <div key={r.product.id} className="flex items-center gap-3 border-b py-2.5 text-sm last:border-0">
                  <span className="w-40 truncate">{r.product.name}</span>
                  <Bar value={r.profit} max={Math.max(1, prods[0]?.profit ?? 1)} tone="entry" />
                  <span className="w-28 text-right tabular">{fmtLek(r.profit)}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground tabular">{(r.profitShare * 100).toFixed(0)}%</span>
                </div>))}
              {!prods.some(r => r.profit > 0) && <Empty />}
            </CardContent></Card>

            <Card><CardHeader><CardTitle>Blerje vs shitje</CardTitle><CardDescription>Paraja që del për stok, kundrejt të ardhurave</CardDescription></CardHeader><CardContent>
              <div className="flex h-44 items-end gap-2">
                {series.map(s => { const m = Math.max(1, ...series.flatMap(x => [x.revenue, x.spend])); return (
                  <div key={s.m} className="flex flex-1 flex-col items-center gap-1" title={`${s.label}: blerje ${fmtLek(s.spend)}, shitje ${fmtLek(s.revenue)}`}>
                    <div className="flex h-36 w-full items-end justify-center gap-0.5">
                      <div className="w-1/2 rounded-t-sm bg-warn" style={{ height: `${(s.spend / m) * 100}%` }} />
                      <div className="w-1/2 rounded-t-sm bg-exit" style={{ height: `${(s.revenue / m) * 100}%` }} />
                    </div><span className="text-[10px] text-muted-foreground">{s.label}</span>
                  </div>); })}
              </div>
              <div className="mt-3 flex gap-4 border-t pt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-warn" />Blerje</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-exit" />Shitje</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Blerjet ndodhin në blloqe të mëdha (kontejnerë) ndërsa shitjet rrjedhin gradualisht — prandaj muaji me blerje të larta nuk do të thotë muaj i keq.</p>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* PRODUCTS */}
        <TabsContent value="prod">
          <Card><CardHeader><CardTitle>Ekonomia e produkteve</CardTitle><CardDescription>{p.label} · kosto sipas lotit specifik të shitur</CardDescription></CardHeader><CardContent className="px-0">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[11px] text-muted-foreground">
                <Th>Produkti</Th><Th right>Kg</Th><Th right>Të ardhura</Th><Th right>Kosto</Th><Th right>Fitim bruto</Th><Th right>Marzh</Th><Th right>Çmim/kg</Th><Th right>Kosto/kg</Th><Th right>Diferenca/kg</Th><Th right>Kg vs më parë</Th>
              </tr></thead>
              <tbody>{prods.map(r => (
                <tr key={r.product.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-2.5"><div className="font-medium">{r.product.name}</div><div className="text-[11px] text-muted-foreground">{(r.profitShare * 100).toFixed(0)}% e fitimit total</div></td>
                  <Td>{fmtNum(r.kg, 1)}</Td><Td>{fmtLek(r.revenue)}</Td><Td>{fmtLek(r.cogs)}</Td>
                  <Td className="text-entry">{fmtLek(r.profit)}</Td>
                  <Td><span className={cn(r.margin < 0.1 && r.kg > 0 && "text-warn")}>{r.kg ? (r.margin * 100).toFixed(1) + "%" : "—"}</span></Td>
                  <Td>{r.kg ? fmtNum(r.avgSell) : "—"}</Td><Td className="text-muted-foreground">{r.kg ? fmtNum(r.avgCost) : "—"}</Td>
                  <Td className="text-entry">{r.kg ? fmtNum(r.spread) : "—"}</Td>
                  <Td><Delta a={r.kg} b={r.prevKg} /></Td>
                </tr>))}</tbody>
              {prods.length > 0 && <tfoot><tr className="border-t-2 font-medium"><td className="px-4 py-2.5">Totali</td><Td>{fmtNum(cur.kg, 1)}</Td><Td>{fmtLek(cur.revenue)}</Td><Td>{fmtLek(cur.cogs)}</Td><Td className="text-entry">{fmtLek(cur.profit)}</Td><Td>{(cur.margin * 100).toFixed(1)}%</Td><Td colSpan={4} /></tr></tfoot>}
            </table></div>
            {!prods.length && <Empty />}
          </CardContent></Card>

          <Card className="mt-4"><CardHeader><CardTitle>Marzhi për produkt</CardTitle><CardDescription>Sa fiton për çdo kg të shitur</CardDescription></CardHeader><CardContent>
            {prods.filter(r => r.kg > 0).map(r => (
              <div key={r.product.id} className="flex items-center gap-3 border-b py-2.5 text-sm last:border-0">
                <span className="w-40 truncate">{r.product.name}</span>
                <div className="flex flex-1 items-center gap-2">
                  <Bar value={r.avgCost} max={Math.max(1, ...prods.map(x => x.avgSell))} tone="warn" className="max-w-[45%]" />
                  <Bar value={r.spread} max={Math.max(1, ...prods.map(x => x.avgSell))} tone="entry" className="max-w-[45%]" />
                </div>
                <span className="w-44 text-right text-xs tabular"><span className="text-muted-foreground">{fmtNum(r.avgCost)}</span> + <span className="text-entry">{fmtNum(r.spread)}</span> = {fmtNum(r.avgSell)} Lek</span>
              </div>))}
            {!prods.some(r => r.kg > 0) && <Empty />}
          </CardContent></Card>
        </TabsContent>

        {/* PRICES */}
        <TabsContent value="price">
          <div className="mb-4 max-w-xs">
            <Select value={priceProd} onValueChange={setPriceProd}><SelectTrigger><SelectValue placeholder="Zgjidh produktin" /></SelectTrigger>
              <SelectContent>{products.map(pr => <SelectItem key={pr.id} value={pr.id}>{pr.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <Card><CardHeader><CardTitle>Çmimi i shitjes kundrejt kostos</CardTitle><CardDescription>Mesatare për kg sipas muajve · hapësira mes vijave është marzhi</CardDescription></CardHeader><CardContent>
            <LineChart height={200} aLabel="Çmim shitjeje / kg" bLabel="Kosto / kg" unit=" Lek" data={pSeries.map(s => ({ label: s.label, a: s.sell, b: s.cost }))} />
            <p className="mt-3 text-xs text-muted-foreground">Nëse vija e kostos ngjitet më shpejt se ajo e shitjes, marzhi po ngushtohet edhe pse xhiroja duket e qëndrueshme.</p>
          </CardContent></Card>

          <Card className="mt-4"><CardHeader><CardTitle>Çmimi sipas klientit</CardTitle><CardDescription>Sa ka paguar secili për të njëjtin produkt — {p.label}</CardDescription></CardHeader><CardContent>
            {disp.rows.length > 1 && <Banner tone={disp.max - disp.min > disp.wAvg * 0.1 ? "warn" : "info"} className="mb-3">
              Diferenca mes çmimit më të lartë dhe më të ulët: <b>{fmtNum(disp.max - disp.min)} Lek/kg</b> ({(((disp.max - disp.min) / (disp.wAvg || 1)) * 100).toFixed(0)}% e mesatares). Mesatarja e ponderuar: {fmtNum(disp.wAvg)} Lek/kg.
            </Banner>}
            {disp.rows.map(r => (
              <div key={r.client.id} className="flex items-center gap-3 border-b py-2.5 text-sm last:border-0">
                <Link href={`/klientet/${r.client.id}`} className="w-40 truncate hover:underline">{r.client.name}</Link>
                <Bar value={r.avg} max={Math.max(1, disp.max)} tone={r.avg >= disp.wAvg ? "entry" : "warn"} />
                <span className="w-24 text-right tabular">{fmtNum(r.avg)} Lek/kg</span>
                <span className="w-20 text-right text-xs text-muted-foreground tabular">{fmtKg(r.kg, 0)}</span>
              </div>))}
            {!disp.rows.length && <Empty text="Ky produkt nuk është shitur në këtë periudhë." />}
          </CardContent></Card>
        </TabsContent>

        {/* CLIENTS */}
        <TabsContent value="cli">
          <Card><CardHeader><CardTitle>Përfitueshmëria e klientëve</CardTitle><CardDescription>{p.label} · vëllimi nuk do të thotë gjithmonë fitim</CardDescription></CardHeader><CardContent className="px-0">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[11px] text-muted-foreground"><Th>Klienti</Th><Th right>Porosi</Th><Th right>Kg</Th><Th right>Të ardhura</Th><Th right>Fitim bruto</Th><Th right>Marzh</Th><Th right>Çmim mes./kg</Th><Th right>% e fitimit</Th></tr></thead>
              <tbody>{clis.map(r => (
                <tr key={r.client.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-2.5"><Link href={`/klientet/${r.client.id}`} className="font-medium hover:underline">{r.client.name}</Link><div className="text-[11px] text-muted-foreground">{r.client.city}</div></td>
                  <Td>{r.orders}</Td><Td>{fmtNum(r.kg, 1)}</Td><Td>{fmtLek(r.revenue)}</Td>
                  <Td className="text-entry">{fmtLek(r.profit)}</Td>
                  <Td><span className={cn(r.margin < 0.1 && "text-warn")}>{(r.margin * 100).toFixed(1)}%</span></Td>
                  <Td>{fmtNum(r.avgPrice)}</Td><Td className="text-muted-foreground">{(r.profitShare * 100).toFixed(0)}%</Td>
                </tr>))}</tbody>
            </table></div>
            {!clis.length && <Empty />}
          </CardContent></Card>
          {clis.length > 1 && <Card className="mt-4"><CardHeader><CardTitle>Përqendrimi i fitimit</CardTitle><CardDescription>Sa varet fitimi nga pak klientë</CardDescription></CardHeader><CardContent>
            <div className="mb-3 flex h-7 overflow-hidden rounded-md text-[11px] font-medium">
              {clis.slice(0, 4).map((c, i) => <div key={c.client.id} className={cn("flex items-center justify-center truncate px-2 text-white", ["bg-exit", "bg-entry", "bg-warn", "bg-danger"][i])} style={{ width: `${Math.max(4, c.profitShare * 100)}%` }} title={`${c.client.name}: ${(c.profitShare * 100).toFixed(0)}%`}>{c.client.name.split(" ")[0]}</div>)}
              {clis.length > 4 && <div className="flex flex-1 items-center justify-center bg-secondary text-muted-foreground">të tjerë</div>}
            </div>
            <p className="text-xs text-muted-foreground">Dy klientët kryesorë sjellin <b>{((clis[0].profitShare + (clis[1]?.profitShare ?? 0)) * 100).toFixed(0)}%</b> të fitimit bruto në këtë periudhë.</p>
          </CardContent></Card>}
        </TabsContent>

        {/* SUPPLIERS */}
        <TabsContent value="sup">
          <Card><CardHeader><CardTitle>Ekonomia e furnizimit</CardTitle><CardDescription>Kosto e blerjes dhe marzhi i realizuar nga malli i tyre</CardDescription></CardHeader><CardContent className="px-0">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[11px] text-muted-foreground"><Th>Furnizuesi</Th><Th right>Dërgesa</Th><Th right>Kg blerë</Th><Th right>Shpenzim</Th><Th right>Kosto mes./kg</Th><Th right>Marzh i realizuar</Th><Th right>Mungesë peshe</Th></tr></thead>
              <tbody>{sups.map(r => (
                <tr key={r.supplier.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-2.5"><div className="font-medium">{r.supplier.name}</div><div className="text-[11px] text-muted-foreground">{r.supplier.country}</div></td>
                  <Td>{r.shipments}</Td><Td>{fmtNum(r.kgBought, 0)}</Td><Td>{fmtLek(r.spend)}</Td><Td>{r.kgBought ? fmtNum(r.avgCost) : "—"}</Td>
                  <Td>{r.realised.kg ? <span className="text-entry">{(r.realised.margin * 100).toFixed(1)}%</span> : <span className="text-muted-foreground">—</span>}</Td>
                  <Td>{r.shortfallKg > 0.01 ? <span className="text-warn">{fmtNum(r.shortfallKg, 1)} kg · {fmtLek(r.shortfallLek)}</span> : <span className="text-muted-foreground">—</span>}</Td>
                </tr>))}</tbody>
            </table></div>
            {!sups.length && <Empty />}
            <p className="px-4 pt-3 text-xs text-muted-foreground"><Info className="mr-1 inline h-3 w-3" />"Mungesë peshe" është diferenca mes peshës në dokument dhe asaj të shkarkuar faktikisht, e shprehur edhe në Lek — një mungesë e vogël por e përsëritur ka kosto reale.</p>
          </CardContent></Card>
        </TabsContent>

        {/* LOTS */}
        <TabsContent value="lot">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Kpi label="Kapital në stok" value={fmtLek(cur.inventoryValue)} sub={`${lots.filter(l => l.remainKg > 0).length} lote aktive`} />
            <Kpi label="Kapital në rrezik skadimi" value={fmtLek(risk.value)} sub={`${risk.lots} lote brenda ${thresholds.expiryDays} ditëve`} tone={risk.value > 0 ? "warn" : undefined} />
            <Kpi label="Fitim i realizuar (gjithçka)" value={fmtLek(lots.reduce((a, l) => a + l.realised, 0))} sub="nga lotet e shitura deri tani" tone="entry" />
          </div>
          <Card><CardHeader><CardTitle>Pasqyra e loteve</CardTitle><CardDescription>Çdo blerje si njësi më vete — a doli e mirë?</CardDescription></CardHeader><CardContent className="px-0">
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b text-left text-[11px] text-muted-foreground"><Th>Loti</Th><Th right>Investuar</Th><Th right>Shitur</Th><Th right>Të ardhura</Th><Th right>Fitim i realizuar</Th><Th right>Marzh</Th><Th right>Mbetur (kosto)</Th><Th right>Ditë në stok</Th></tr></thead>
              <tbody>{lots.map(l => (
                <tr key={l.shipment.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-2.5"><Link href={`/inventari/${l.shipment.id}`} className="font-medium hover:underline">Lot {l.shipment.lots.map(x => x.lotNumber).join(", ")}</Link>
                    <div className="text-[11px] text-muted-foreground">{l.product?.name} · {l.supplier?.name} · hyri {fmtDate(l.shipment.entryDate)}</div></td>
                  <Td>{fmtLek(l.invested)}</Td>
                  <Td><div>{(l.pctSold * 100).toFixed(0)}%</div><div className="text-[11px] text-muted-foreground">{fmtNum(l.soldKg, 0)} kg</div></Td>
                  <Td>{fmtLek(l.revenue)}</Td>
                  <Td className={l.realised > 0 ? "text-entry" : "text-muted-foreground"}>{l.soldKg ? fmtLek(l.realised) : "—"}</Td>
                  <Td>{l.soldKg ? (l.margin * 100).toFixed(1) + "%" : "—"}</Td>
                  <Td>{l.remainKg > 0 ? fmtLek(l.remainValue) : <span className="text-muted-foreground">shitur</span>}</Td>
                  <Td>{l.remainKg > 0 ? <span className={cn(l.expDays <= thresholds.expiryDays && "text-warn")}>{l.daysHeld}d{l.expDays <= thresholds.expiryDays ? ` · skadon ${l.expDays}d` : ""}</span> : <span className="text-muted-foreground">—</span>}</Td>
                </tr>))}</tbody>
            </table></div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

const d = (a: number, b: number) => (b ? (a - b) / b : a ? 1 : 0);
function Kpi({ label, value, sub, delta, tone, invert, hidePrev }: { label: string; value: string; sub?: React.ReactNode; delta?: number; tone?: "entry" | "warn"; invert?: boolean; hidePrev?: boolean }) {
  const good = delta === undefined ? true : invert ? delta <= 0 : delta >= 0;
  return (
    <div className="rounded-lg bg-card p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular", tone === "entry" && "text-entry", tone === "warn" && "text-warn")}>{value}</div>
      {delta !== undefined && !hidePrev ? (
        <div className={cn("mt-1 flex items-center gap-0.5 text-[11px]", good ? "text-entry" : "text-danger")}>
          {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(delta * 100).toFixed(0)}%
        </div>
      ) : sub ? <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
function Delta({ a, b }: { a: number; b: number }) {
  if (!a && !b) return <span className="text-muted-foreground">—</span>;
  const v = b ? (a - b) / b : 1; const up = v >= 0;
  return <span className={cn("inline-flex items-center gap-0.5 text-xs", up ? "text-entry" : "text-danger")}>{up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(v * 100).toFixed(0)}%</span>;
}
const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => <th className={cn("px-4 py-2 font-medium", right && "text-right")}>{children}</th>;
const Td = ({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) => <td colSpan={colSpan} className={cn("px-4 py-2.5 text-right tabular", className)}>{children}</td>;
const Empty = ({ text = "Nuk ka shitje në këtë periudhë." }: { text?: string }) => <p className="px-4 py-8 text-center text-sm text-muted-foreground">{text}</p>;
