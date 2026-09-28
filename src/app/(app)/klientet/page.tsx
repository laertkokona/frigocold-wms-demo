"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shell";
import { BrowseControls } from "@/components/browse-controls";
import { ClientDialog } from "@/components/entity-dialogs";
import { useBrowse } from "@/lib/use-browse";
import type { Client } from "@/lib/types";
import { fmtDate, fmtKg, fmtLek } from "@/lib/utils";

type Row = Client & { orders: number; kg: number; value: number; last: string | null };

export default function Klientet() {
  const list = useBrowse<Row>("clients", "value", "desc");
  const [dialog, setDialog] = useState<{ open: boolean; client?: Client }>({ open: false });
  return <>
    <PageHeader title="Klientët" sub={`${list.total} klientë`} right={<Button variant="outline" onClick={() => setDialog({ open: true })}><Plus /> Klient i ri</Button>} />
    <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Kërko klientin…" value={list.q} onChange={e => list.setQ(e.target.value)} className="pl-9" /></div>
    {list.error && <p role="alert" className="mb-3 text-sm text-danger">{list.error} <button className="underline" onClick={list.refresh}>Provo sërish</button></p>}
    <div className="space-y-1.5">
      {list.items.map(c => <div key={c.id} className="flex items-center gap-2 rounded-lg border bg-card pr-2 text-sm transition-colors hover:bg-accent/40">
        <Link href={`/klientet/${c.id}`} className="flex flex-1 items-center justify-between px-4 py-3">
          <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.city}{c.phone ? ` · ${c.phone}` : ""} · {c.orders} porosi{c.last ? ` · e fundit ${fmtDate(c.last)}` : ""}</div></div>
          <div className="flex items-center gap-3"><div className="text-right tabular"><div className="font-medium">{fmtLek(c.value)}</div><div className="text-xs text-muted-foreground">{fmtKg(c.kg, 0)}</div></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
        </Link>
        <Button variant="ghost" size="icon" aria-label={`Ndrysho ${c.name}`} onClick={() => setDialog({ open: true, client: c })}><Pencil className="h-4 w-4" /></Button>
      </div>)}
      {!list.loading && !list.items.length && <p className="py-10 text-center text-sm text-muted-foreground">Asnjë klient nuk përputhet.</p>}
    </div>
    <BrowseControls {...list} sorts={[{ value: "value", label: "Vlera" }, { value: "name", label: "Emri" }, { value: "orders", label: "Porositë" }, { value: "kg", label: "Kg" }, { value: "last", label: "Porosia e fundit" }]} />
    <ClientDialog compact open={dialog.open} client={dialog.client} onClose={() => setDialog({ open: false })} onSaved={list.refresh} />
  </>;
}
