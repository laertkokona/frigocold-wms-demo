"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/shell";
import { ProductDialog } from "@/components/entity-dialogs";
import { remainingKg, useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { fmtKg } from "@/lib/utils";

export default function Produktet() {
  const { products, shipments, suppliers } = useStore();
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; product?: Product }>({ open: false });
  const rows = useMemo(() => products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).map(p => {
    const loads = shipments.filter(s => s.productId === p.id);
    const active = loads.filter(s => remainingKg(s) > 0);
    const sups = [...new Set(active.map(s => s.supplierId))].map(id => suppliers.find(x => x.id === id)?.name).filter(Boolean);
    return { p, loads: loads.length, active: active.length, kg: active.reduce((a, s) => a + remainingKg(s), 0), sups };
  }).sort((a, b) => b.kg - a.kg || a.p.name.localeCompare(b.p.name)), [products, shipments, suppliers, q]);
  return <>
    <PageHeader title="Produktet" sub={`${products.length} kategori`} right={<Button variant="outline" onClick={() => setDialog({ open: true })}><Plus /> Kategori e re</Button>} />
    {products.length === 0 && <Banner className="mb-4">Fillo duke krijuar kategoritë (p.sh. &quot;Kofshë pule&quot;, &quot;Viçi pa kockë&quot;). Pastaj te Hyrje regjistro çdo ngarkesë nën kategorinë e saj, me furnizuesin dhe specifikimet e veta.</Banner>}
    <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Kërko kategorinë…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" /></div>
    <div className="space-y-1.5">
      {rows.map(r => <div key={r.p.id} className="flex items-center gap-2 rounded-lg border bg-card pr-2 text-sm transition-colors hover:bg-accent/40">
        <Link href={`/produktet/${r.p.id}`} className="flex flex-1 items-center justify-between px-4 py-3">
          <div><div className="font-medium">{r.p.name}</div><div className="text-xs text-muted-foreground">{r.active} ngarkesa në stok{r.loads > r.active ? ` · ${r.loads - r.active} të shitura` : ""}{r.sups.length ? ` · ${r.sups.join(", ")}` : ""}</div></div>
          <div className="flex items-center gap-3"><span className="font-medium tabular">{fmtKg(r.kg, 0)}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
        </Link>
        <Button variant="ghost" size="icon" aria-label={`Riemërto ${r.p.name}`} onClick={() => setDialog({ open: true, product: r.p })}><Pencil className="h-4 w-4" /></Button>
      </div>)}
      {products.length > 0 && !rows.length && <p className="py-10 text-center text-sm text-muted-foreground">Asnjë kategori nuk përputhet.</p>}
    </div>
    <ProductDialog open={dialog.open} product={dialog.product} onClose={() => setDialog({ open: false })} />
  </>;
}
