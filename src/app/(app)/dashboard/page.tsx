"use client";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Crown, PackageMinus, PackagePlus, TrendingUp, UserX, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/shell";
import { useServerReport } from "@/lib/use-server-report";
import type { DashboardData } from "@/lib/server/dashboard";
import { cn, daysUntil, fmtDate, fmtKg, fmtLek, fmtNum, todayInTirane } from "@/lib/utils";

export default function Dashboard() {
  const report = useServerReport<DashboardData>("/api/dashboard");
  if (!report.data) return <div className="rounded-lg border p-6">{report.error ? <>Raporti nuk u ngarkua. <button className="underline" onClick={report.refresh}>Provo sërish</button></> : "Po ngarkohet…"}</div>;
  const { alerts, stock, fl, cs, pp, churn, churnCount, turnover, fastest, slowest, mostProfitable, expiring, supplierPerformance, clientCount, activeClientCount, totalKg, totalVal, riskKg, riskVal, expiryBuckets, profitMonth, concentration: conc } = report.data;
  const cur = fl[fl.length - 1], prev = fl[fl.length - 2];
  const maxFlow = Math.max(...fl.map(f => Math.max(f.inKg, f.outKg)), 1);
  const revenueMonth = cur.revenue;

  return (
    <>
      <PageHeader title="Paneli kryesor" sub={`${fmtDate(todayInTirane())} · Frigo ALBA, Kashar`} right={<div className="flex gap-2"><Button asChild variant="entry"><Link href="/hyrje"><PackagePlus /> Hyrje e re</Link></Button><Button asChild variant="exit"><Link href="/dalje"><PackageMinus /> Porosi shitjeje</Link></Button></div>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Stoku total" value={fmtKg(totalKg, 0)} sub={`vlerë kostoje ${fmtLek(totalVal)}`} />
        <Stat label="Të ardhura këtë muaj" value={fmtLek(revenueMonth)} sub={<Delta a={cur.revenue} b={prev.revenue} />} />
        <Stat label="Fitimi bruto këtë muaj" value={fmtLek(profitMonth)} sub={revenueMonth ? `marzh ${((profitMonth / revenueMonth) * 100).toFixed(1)}%` : "—"} tone="entry" />
        <Stat label="Rrezik skadimi" value={fmtKg(riskKg, 0)} sub={`${fmtLek(riskVal)} kosto e ekspozuar`} tone={riskKg > 0 ? "danger" : undefined} />
      </div>

      <Tabs defaultValue="ov">
        <TabsList className="max-w-full overflow-x-auto"><TabsTrigger value="ov">Përmbledhje</TabsTrigger><TabsTrigger value="inv">Inventari</TabsTrigger><TabsTrigger value="cli">Klientët</TabsTrigger><TabsTrigger value="sup">Furnizuesit</TabsTrigger><TabsTrigger value="tr">Tendencat</TabsTrigger></TabsList>

        <TabsContent value="ov">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Lëvizja — hyrje vs dalje</CardTitle><CardDescription>Kg në 6 muajt e fundit</CardDescription></CardHeader><CardContent>
              <div className="flex h-36 items-end gap-3">{fl.map(f => <div key={f.m} className="flex flex-1 flex-col items-center gap-1.5"><div className="flex h-28 w-full items-end justify-center gap-1"><div className="w-3 rounded-t-sm bg-entry" style={{ height: `${(f.inKg / maxFlow) * 100}%` }} title={`Hyrje ${fmtKg(f.inKg, 0)}`} /><div className="w-3 rounded-t-sm bg-exit" style={{ height: `${(f.outKg / maxFlow) * 100}%` }} title={`Dalje ${fmtKg(f.outKg, 0)}`} /></div><span className="text-[10px] text-muted-foreground">{f.label}</span></div>)}</div>
              <div className="mt-3 flex gap-4 border-t pt-3 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-entry" />Hyrje</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-exit" />Dalje</span></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Lëvizësit kryesorë</CardTitle><CardDescription>Këtë muaj</CardDescription></CardHeader><CardContent className="text-sm">
              <Mover icon={Crown} label="Klienti kryesor" sub={cs[0]?.client.name ?? "—"} val={fmtLek(cs[0]?.valCur ?? 0)} />
              <Mover icon={TrendingUp} label="Produkti më fitimprurës" sub={mostProfitable?.product.name ?? "—"} val={fmtLek(mostProfitable?.profit ?? 0)} />
              <Mover icon={Zap} label="Lëvizja më e shpejtë" sub={`${fastest?.product.name ?? "—"} · ${fastest?.days ?? "—"} ditë në stok`} val="i shpejtë" /><Mover icon={Zap} label="Lëvizja më e ngadaltë" sub={`${slowest?.product.name ?? "—"} · ${slowest?.days ?? "—"} ditë në stok`} val={<span className="text-warn">i ngadaltë</span>} />
            </CardContent></Card>
          </div>
          <Card className="mt-4"><CardHeader><CardTitle>Çfarë kërkon vëmendje</CardTitle><CardDescription>Përfundime automatike nga të dhënat</CardDescription></CardHeader><CardContent className="space-y-2">
            {alerts.slice(0, 3).map((a, i) => <Banner key={i} tone={a.level}><b>{a.title}.</b> {a.detail}</Banner>)}
            {churn.slice(0, 2).map(c => <Banner key={c.client.id} tone="warn"><b>{c.client.name}</b> — asnjë porosi për {c.daysSince} ditë ({c.orders} porosi historikisht). Vlen një telefonatë.</Banner>)}
            {cs[1] && cs[1].delta > 0.2 && <Banner><b>{cs[1].client.name}</b> u rrit {(cs[1].delta * 100).toFixed(0)}% këtë muaj. Tendencë pozitive — vlen të forcohet marrëdhënia.</Banner>}
            {alerts.length === 0 && churn.length === 0 && <p className="text-sm text-muted-foreground">Gjithçka brenda normave.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="inv">
          <Card><CardHeader><CardTitle>Mosha e stokut — rrezik skadimi</CardTitle><CardDescription>Sa kg skadon brenda secilës dritare kohore</CardDescription></CardHeader><CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["< 60 ditë", "danger"], ["60–180 ditë", "warn"], ["180–365 ditë", "entry"], ["> 365 ditë", ""]].map(([l, t], i) => <div key={l} className={cn("rounded-lg p-4 text-center", t === "danger" && "bg-danger/10 text-danger", t === "warn" && "bg-warn/10 text-warn", t === "entry" && "bg-entry/10 text-entry", t === "" && "bg-secondary text-muted-foreground")}><div className="text-xl font-semibold tabular">{fmtKg(expiryBuckets[i], 0)}</div><div className="text-[11px]">{l}</div></div>)}
            </div>
          </CardContent></Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Ditë në stok (turnover)</CardTitle><CardDescription>Sa shpejt lëviz çdo produkt — më pak = më mirë</CardDescription></CardHeader><CardContent className="space-y-2">
              {turnover.map(({ product, days }) => { const d = days; const w = d === null ? 0 : Math.min(100, d / 2); return <div key={product.id} className="flex items-center gap-3 text-sm"><span className="w-40 truncate">{product.name}</span><div className="h-4 flex-1 overflow-hidden rounded bg-secondary"><div className={cn("flex h-full items-center pl-2 text-[10px] font-medium text-white", d === null ? "bg-border" : d < 30 ? "bg-entry" : d < 90 ? "bg-warn" : "bg-danger")} style={{ width: `${Math.max(w, 12)}%` }}>{d === null ? "pa shitje" : `${d}d`}</div></div></div>; })}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Rreziku i skadimit sipas lotit</CardTitle><CardDescription>Renditur nga më urgjenti</CardDescription></CardHeader><CardContent>
              {expiring.map(s => { const d = daysUntil(s.expFrom); return <Link href={`/inventari/${s.id}`} key={s.id} className="flex items-center justify-between border-b py-2.5 text-sm last:border-0 hover:bg-accent/40"><div><div className="font-medium">Lot {s.lot} · {s.product} <Badge variant={d < 60 ? "danger" : d < 180 ? "warn" : "entry"} className="ml-1">{d < 0 ? "skaduar" : `${d} ditë`}</Badge></div><div className="text-xs text-muted-foreground">{s.supplier} · {s.remainingCount} {s.loadType === "PALLET" ? "paleta" : "kartona"}</div></div><span className="tabular">{fmtKg(s.remainingKg, 0)}</span></Link>; })}
            </CardContent></Card>
          </div>
          <Card className="mt-4"><CardHeader><CardTitle>Stoku sipas produktit</CardTitle><CardDescription>Kg dhe vlera me kosto</CardDescription></CardHeader><CardContent className="space-y-2">
            {stock.map(s => <div key={s.product.id} className="flex items-center gap-3 text-sm"><span className="w-44 truncate">{s.product.name}</span><div className="h-2 flex-1 rounded bg-secondary"><div className="h-full rounded bg-entry" style={{ width: `${(s.kg / Math.max(1, stock[0].kg)) * 100}%` }} /></div><span className="w-24 text-right tabular">{fmtKg(s.kg, 0)}</span><span className="w-32 text-right text-xs text-muted-foreground tabular">{fmtLek(s.value)}</span></div>)}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cli">
          <div className="mb-4 grid gap-3 sm:grid-cols-3"><Stat label="Klientë aktivë" value={String(activeClientCount)} sub={`${clientCount} gjithsej`} /><Stat label="Përqendrimi (top 2)" value={`${(conc * 100).toFixed(0)}%`} sub="e vlerës këtë muaj" /><Stat label="Në rrezik largimi" value={String(churnCount)} sub="pa porosi 30+ ditë" tone={churnCount ? "warn" : undefined} /></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Renditja & tendenca</CardTitle><CardDescription>Vlera këtë muaj, ndryshimi vs muaji i kaluar (kg)</CardDescription></CardHeader><CardContent>
              {cs.filter(c => c.orders > 0).map((c, i) => <Link href={`/klientet/${c.client.id}`} key={c.client.id} className="flex items-center gap-3 border-b py-2.5 text-sm last:border-0 hover:bg-accent/40"><span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium", i < 2 ? "bg-entry/15 text-entry" : "bg-secondary text-muted-foreground")}>{i + 1}</span><div className="flex-1"><div className="font-medium">{c.client.name}</div><div className="text-xs text-muted-foreground">{c.orders} porosi · {c.client.city}</div></div><div className="text-right tabular"><div>{fmtLek(c.valCur)}</div><Delta a={c.kgCur} b={c.kgPrev} small /></div></Link>)}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Rrezik largimi (churn)</CardTitle><CardDescription>Klientë që kanë rënë në aktivitet</CardDescription></CardHeader><CardContent className="space-y-2">
              {churn.map(c => <Banner key={c.client.id} tone="warn"><UserX className="mr-1 inline h-3.5 w-3.5" /><b>{c.client.name}</b> — porosia e fundit {c.last ? fmtDate(c.last) : "—"}, {c.daysSince} ditë më parë. {c.orders} porosi historikisht, {fmtKg(c.kgAll, 0)}.</Banner>)}
              {!churn.length && <p className="text-sm text-muted-foreground">Asnjë klient në rrezik.</p>}
              <div className="mt-4 text-sm"><div className="mb-2 font-medium">Përqendrimi i vlerës</div><div className="flex h-7 overflow-hidden rounded-md text-[11px] font-medium">{cs.filter(c => c.valCur > 0).slice(0, 3).map((c, i) => <div key={c.client.id} className={cn("flex items-center justify-center truncate px-2 text-white", ["bg-exit", "bg-entry", "bg-warn"][i])} style={{ width: `${(c.valCur / Math.max(1, cs.reduce((a, x) => a + x.valCur, 0))) * 100}%` }}>{c.client.name.split(" ")[0]}</div>)}<div className="flex flex-1 items-center justify-center bg-secondary text-muted-foreground">të tjerë</div></div></div>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="sup">
          <Card><CardHeader><CardTitle>Performanca e furnizuesve</CardTitle><CardDescription>Kosto mesatare, jetëgjatësi në mbërritje, mospërputhje dokument–faktik</CardDescription></CardHeader><CardContent>
              {supplierPerformance.map(sp => (
              <div key={sp.id} className="flex flex-wrap items-center gap-3 border-b py-3 text-sm last:border-0"><div className="min-w-48 flex-1"><div className="font-medium">{sp.name} <span className="text-xs text-muted-foreground">({sp.country})</span></div><div className="text-xs text-muted-foreground">{sp.count} dërgesa · {fmtKg(sp.kg, 0)} importuar</div></div><KV k="Kosto mes. / kg" v={fmtNum(sp.cost, 0) + " Lek"} /><KV k="Jetëgjatësi në mbërritje" v={<span className={cn(sp.life < 6 && "text-warn")}>{sp.life} muaj</span>} /><KV k="Mospërputhje" v={<span className={cn(sp.discPct > 0.5 && "text-warn")}>{sp.discPct.toFixed(2)}%</span>} /></div>))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tr">
          <Card><CardHeader><CardTitle>Fitimi dhe marzhi sipas produktit</CardTitle><CardDescription>Të ardhura, kosto e mallit të shitur, fitim bruto — gjithë periudha</CardDescription></CardHeader><CardContent>
            {pp.filter(p => p.kg > 0).map(p => <div key={p.product.id} className="flex flex-wrap items-center gap-3 border-b py-3 text-sm last:border-0"><div className="min-w-44 flex-1"><div className="font-medium">{p.product.name}</div><div className="text-xs text-muted-foreground">{fmtKg(p.kg, 0)} shitur</div></div><KV k="Të ardhura" v={fmtLek(p.revenue)} /><KV k="Fitim bruto" v={<span className="text-entry">{fmtLek(p.profit)}</span>} /><KV k="Marzh" v={`${(p.margin * 100).toFixed(1)}%`} /><KV k="Kg vs muaji i kaluar" v={<Delta a={p.kgCur} b={p.kgPrev} small />} /></div>)}
          </CardContent></Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Të ardhura mujore</CardTitle><CardDescription>Lek, 6 muajt e fundit</CardDescription></CardHeader><CardContent><div className="flex h-32 items-end gap-2">{fl.map(f => <div key={f.m} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-sm bg-exit" style={{ height: `${(f.revenue / Math.max(1, ...fl.map(x => x.revenue))) * 100}%`, minHeight: 2 }} title={fmtLek(f.revenue)} /><span className="text-[10px] text-muted-foreground">{f.label}</span></div>)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle>Bilanci hyrje vs dalje</CardTitle><CardDescription>Këtë muaj</CardDescription></CardHeader><CardContent className="text-center"><div className={cn("text-3xl font-semibold tabular", cur.inKg - cur.outKg >= 0 ? "text-entry" : "text-warn")}>{cur.inKg - cur.outKg >= 0 ? "+" : ""}{fmtKg(cur.inKg - cur.outKg, 0)}</div><p className="mt-1 text-xs text-muted-foreground">{fmtKg(cur.inKg, 0)} hyrje − {fmtKg(cur.outKg, 0)} dalje</p><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-md bg-secondary p-3"><div className="text-[10px] text-muted-foreground">Kosto blerjesh</div><div className="font-medium tabular">{fmtLek(cur.cost)}</div></div><div className="rounded-md bg-secondary p-3"><div className="text-[10px] text-muted-foreground">Të ardhura</div><div className="font-medium tabular">{fmtLek(cur.revenue)}</div></div></div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "entry" | "danger" | "warn" }) {
  return <div className="rounded-lg bg-card p-4"><div className="text-[11px] text-muted-foreground">{label}</div><div className={cn("mt-1 text-xl font-semibold tabular", tone === "entry" && "text-entry", tone === "danger" && "text-danger", tone === "warn" && "text-warn")}>{value}</div>{sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}</div>;
}
function Delta({ a, b, small }: { a: number; b: number; small?: boolean }) {
  if (!b && !a) return <span className="text-muted-foreground">—</span>;
  const d = b ? (a - b) / b : 1; const up = d >= 0;
  return <span className={cn("inline-flex items-center gap-0.5", up ? "text-entry" : "text-danger", small && "text-xs")}>{up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(d * 100).toFixed(0)}% vs muaji i kaluar</span>;
}
function Mover({ icon: Icon, label, sub, val }: { icon: React.ElementType; label: string; sub: string; val: React.ReactNode }) {
  return <div className="flex items-center gap-3 border-b py-2.5 last:border-0"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary"><Icon className="h-3.5 w-3.5" /></span><div className="flex-1"><div className="font-medium">{label}</div><div className="text-xs text-muted-foreground">{sub}</div></div><span className="tabular">{val}</span></div>;
}
function KV({ k, v }: { k: string; v: React.ReactNode }) { return <div className="min-w-28"><div className="text-[10px] text-muted-foreground">{k}</div><div className="font-medium tabular">{v}</div></div>; }
