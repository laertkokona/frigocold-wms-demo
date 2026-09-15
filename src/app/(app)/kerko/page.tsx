"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Box, Package, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell";
import { remainingKg, useStore } from "@/lib/store";
import { cn, fmtDate, fmtKg, fmtLek } from "@/lib/utils";

type Hit = { type: "Dërgesë" | "Produkt" | "Klient"; title: string; sub: string; meta: string; href: string };
export default function Kerko() {
  const { shipments, products, clients, suppliers, sales } = useStore();
  const [q, setQ] = useState(""); const [f, setF] = useState<"all" | "ship" | "prod" | "cli">("all");
  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase(); if (!s) return [];
    const H: Hit[] = [];
    for (const sh of shipments) { const p = products.find(x => x.id === sh.productId); const sup = suppliers.find(x => x.id === sh.supplierId); const hay = [sh.orderNr, ...sh.lots.map(l => l.lotNumber), p?.name, sup?.name, fmtDate(sh.entryDate)].join(" ").toLowerCase(); if (hay.includes(s)) H.push({ type: "Dërgesë", title: `Lot ${sh.lots.map(l => l.lotNumber).join(", ")} · ${p?.name}`, sub: `Porosia ${sh.orderNr} · ${sup?.name} · hyri ${fmtDate(sh.entryDate)}`, meta: fmtKg(remainingKg(sh), 0) + " mbetur", href: `/inventari/${sh.id}` }); }
    for (const p of products) if (p.name.toLowerCase().includes(s)) { const kg = shipments.filter(x => x.productId === p.id).reduce((a, x) => a + remainingKg(x), 0); H.push({ type: "Produkt", title: p.name, sub: p.origin ?? "", meta: fmtKg(kg, 0), href: "/inventari" }); }
    for (const c of clients) if ([c.name, c.city, c.contact].join(" ").toLowerCase().includes(s)) { const v = sales.filter(x => x.clientId === c.id).reduce((a, x) => a + x.totalValue, 0); H.push({ type: "Klient", title: c.name, sub: c.city, meta: fmtLek(v), href: `/klientet/${c.id}` }); }
    return H.filter(h => f === "all" || (f === "ship" && h.type === "Dërgesë") || (f === "prod" && h.type === "Produkt") || (f === "cli" && h.type === "Klient"));
  }, [q, f, shipments, products, clients, suppliers, sales]);
  const Icon = ({ t }: { t: Hit["type"] }) => t === "Dërgesë" ? <Package className="h-4 w-4" /> : t === "Produkt" ? <Box className="h-4 w-4" /> : <Users className="h-4 w-4" />;
  return (
    <>
      <PageHeader title="Kërko" sub="Lot, nr. porosie, datë, produkt ose klient" />
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus placeholder="p.sh. 061125, 4471, Albfresh…" value={q} onChange={e => setQ(e.target.value)} className="h-12 pl-9 text-base" /></div>
      <div className="mb-4 flex gap-2">{([["all", "Të gjitha"], ["ship", "Dërgesa"], ["prod", "Produkte"], ["cli", "Klientë"]] as const).map(([k, l]) => <button key={k} onClick={() => setF(k)} className={cn("rounded-full border px-3 py-1.5 text-xs", f === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}</div>
      <div className="space-y-1.5">
        {hits.map((h, i) => <Link key={i} href={h.href} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm hover:bg-accent/40"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary"><Icon t={h.type} /></span><div className="min-w-0 flex-1"><div className="truncate font-medium">{h.title}</div><div className="truncate text-xs text-muted-foreground">{h.sub}</div></div><div className="text-right"><div className="tabular">{h.meta}</div><Badge variant="outline" className="mt-0.5">{h.type}</Badge></div></Link>)}
        {q && !hits.length && <p className="py-10 text-center text-sm text-muted-foreground">Asnjë rezultat për &ldquo;{q}&rdquo;.</p>}
        {!q && <p className="py-10 text-center text-sm text-muted-foreground">Shkruaj për të kërkuar në të gjitha të dhënat.</p>}
      </div>
    </>
  );
}
