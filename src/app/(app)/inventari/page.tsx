"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell";
import { remainingCount, remainingKg, useStore } from "@/lib/store";
import { daysUntil, fmtKg, fmtLek, fmtMonth, fmtDate, cn } from "@/lib/utils";

export default function Inventari() {
  const { products, shipments, suppliers } = useStore();
  return (
    <>
      <PageHeader title="Stoku" sub="Të gjitha dërgesat aktive, sipas produktit" />
      <div className="space-y-6">
        {products.map(p => {
          const sh = shipments.filter(s => s.productId === p.id && remainingKg(s) > 0).sort((a, b) => a.expFrom.localeCompare(b.expFrom));
          if (!sh.length) return null;
          const kg = sh.reduce((a, s) => a + remainingKg(s), 0);
          return (
            <section key={p.id}>
              <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-medium">{p.name}</h2><span className="text-sm text-muted-foreground tabular">{fmtKg(kg, 0)} · {sh.length} dërgesa</span></div>
              <div className="space-y-1.5">
                {sh.map((s, i) => { const d = daysUntil(s.expFrom); return (
                  <Link key={s.id} href={`/inventari/${s.id}`} className={cn("flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent/40", i === 0 && d < 90 && "border-danger/40")}>
                    <div><div className="font-medium">Lot {s.lots.map(l => l.lotNumber).join(", ")} · {suppliers.find(x => x.id === s.supplierId)?.name}</div><div className="text-xs text-muted-foreground">Porosia {s.orderNr} · hyri {fmtDate(s.entryDate)} · {remainingCount(s)} / {s.countActual} {s.loadType === "PALLET" ? "paleta" : "kartona"}</div></div>
                    <div className="flex items-center gap-3"><div className="text-right tabular"><div className="font-medium">{fmtKg(remainingKg(s), 1)}</div><div className="text-xs text-muted-foreground">{fmtLek(remainingKg(s) * s.costPerKg)}</div></div><Badge variant={d < 60 ? "danger" : d < 180 ? "warn" : "entry"}>{d < 0 ? "skaduar" : `${fmtMonth(s.expFrom)} · ${d}d`}</Badge><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
                  </Link>); })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
