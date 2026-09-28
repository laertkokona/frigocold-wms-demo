"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shell";
import { BrowseControls } from "@/components/browse-controls";
import { SupplierDialog } from "@/components/entity-dialogs";
import { useBrowse } from "@/lib/use-browse";
import type { Supplier } from "@/lib/types";
import { fmtDate, fmtKg, fmtLek } from "@/lib/utils";

type Row = Supplier & { shipments: number; kg: number; spend: number; stock: number; last: string | null };

export default function Furnizuesit() {
  const list = useBrowse<Row>("suppliers", "spend", "desc");
  const [dialog, setDialog] = useState<{ open: boolean; supplier?: Supplier }>({ open: false });
  return <>
    <PageHeader title="Furnizuesit" sub={`${list.total} furnizues`} right={<Button variant="outline" onClick={() => setDialog({ open: true })}><Plus /> Furnizues i ri</Button>} />
    <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Kërko furnizuesin…" value={list.q} onChange={e => list.setQ(e.target.value)} className="pl-9" /></div>
    {list.error && <p role="alert" className="mb-3 text-sm text-danger">{list.error} <button className="underline" onClick={list.refresh}>Provo sërish</button></p>}
    <div className="space-y-1.5">
      {list.items.map(r => <div key={r.id} className="flex items-center gap-2 rounded-lg border bg-card pr-2 text-sm transition-colors hover:bg-accent/40">
        <Link href={`/furnizuesit/${r.id}`} className="flex flex-1 items-center justify-between px-4 py-3">
          <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.country}{r.contact ? ` · ${r.contact}` : ""}{r.phone ? ` · ${r.phone}` : ""} · {r.shipments} dërgesa{r.last ? ` · e fundit ${fmtDate(r.last)}` : ""}</div></div>
          <div className="flex items-center gap-3"><div className="text-right tabular"><div className="font-medium">{fmtLek(r.spend)}</div><div className="text-xs text-muted-foreground">{fmtKg(r.kg, 0)} blerë · {fmtKg(r.stock, 0)} në stok</div></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
        </Link>
        <Button variant="ghost" size="icon" aria-label={`Ndrysho ${r.name}`} onClick={() => setDialog({ open: true, supplier: r })}><Pencil className="h-4 w-4" /></Button>
      </div>)}
      {!list.loading && !list.items.length && <p className="py-10 text-center text-sm text-muted-foreground">Asnjë furnizues nuk përputhet.</p>}
    </div>
    <BrowseControls {...list} sorts={[{ value: "spend", label: "Shpenzimi" }, { value: "name", label: "Emri" }, { value: "shipments", label: "Dërgesat" }, { value: "kg", label: "Kg" }, { value: "stock", label: "Stoku" }, { value: "last", label: "Dërgesa e fundit" }]} />
    <SupplierDialog compact open={dialog.open} supplier={dialog.supplier} onClose={() => setDialog({ open: false })} onSaved={list.refresh} />
  </>;
}
