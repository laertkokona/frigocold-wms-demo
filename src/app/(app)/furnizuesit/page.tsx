"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shell";
import { SupplierDialog } from "@/components/entity-dialogs";
import { remainingKg, useStore } from "@/lib/store";
import type { Supplier } from "@/lib/types";
import { fmtDate, fmtKg, fmtLek } from "@/lib/utils";

export default function Furnizuesit() {
  const { suppliers, shipments } = useStore();
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; supplier?: Supplier }>({ open: false });
  const rows = suppliers.map(sp => {
    const sh = shipments.filter(s => s.supplierId === sp.id);
    return { sp, n: sh.length, kg: sh.reduce((a, s) => a + s.netKgActual, 0), spend: sh.reduce((a, s) => a + s.totalCost, 0), inStock: sh.reduce((a, s) => a + remainingKg(s), 0), last: sh.map(s => s.entryDate).sort().at(-1) };
  }).sort((a, b) => b.spend - a.spend)
    .filter(r => !q || [r.sp.name, r.sp.country, r.sp.contact].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Furnizuesit" sub={`${suppliers.length} furnizues`} right={<Button variant="outline" onClick={() => setDialog({ open: true })}><Plus /> Furnizues i ri</Button>} />
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Kërko furnizuesin…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" /></div>
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.sp.id} className="flex items-center gap-2 rounded-lg border bg-card pr-2 text-sm transition-colors hover:bg-accent/40">
            <Link href={`/furnizuesit/${r.sp.id}`} className="flex flex-1 items-center justify-between px-4 py-3">
              <div><div className="font-medium">{r.sp.name}</div><div className="text-xs text-muted-foreground">{r.sp.country}{r.sp.contact ? ` · ${r.sp.contact}` : ""}{r.sp.phone ? ` · ${r.sp.phone}` : ""} · {r.n} dërgesa{r.last ? ` · e fundit ${fmtDate(r.last)}` : ""}</div></div>
              <div className="flex items-center gap-3"><div className="text-right tabular"><div className="font-medium">{fmtLek(r.spend)}</div><div className="text-xs text-muted-foreground">{fmtKg(r.kg, 0)} blerë · {fmtKg(r.inStock, 0)} në stok</div></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
            </Link>
            <Button variant="ghost" size="icon" aria-label={`Ndrysho ${r.sp.name}`} onClick={() => setDialog({ open: true, supplier: r.sp })}><Pencil className="h-4 w-4" /></Button>
          </div>
        ))}
        {!rows.length && <p className="py-10 text-center text-sm text-muted-foreground">Asnjë furnizues nuk përputhet.</p>}
      </div>
      <SupplierDialog open={dialog.open} supplier={dialog.supplier} onClose={() => setDialog({ open: false })} />
    </>
  );
}
