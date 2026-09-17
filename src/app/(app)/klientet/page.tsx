"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shell";
import { ClientDialog } from "@/components/entity-dialogs";
import { useStore } from "@/lib/store";
import { clientStats } from "@/lib/calc";
import type { Client } from "@/lib/types";
import { fmtDate, fmtKg, fmtLek } from "@/lib/utils";

export default function Klientet() {
  const { clients, sales } = useStore();
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; client?: Client }>({ open: false });
  const cs = clientStats(clients, sales).sort((a, b) => b.valueAll - a.valueAll)
    .filter(c => !q || [c.client.name, c.client.city, c.client.contact].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader title="Klientët" sub={`${clients.length} klientë`} right={<Button variant="outline" onClick={() => setDialog({ open: true })}><Plus /> Klient i ri</Button>} />
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Kërko klientin…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" /></div>
      <div className="space-y-1.5">
        {cs.map(c => (
          <div key={c.client.id} className="flex items-center gap-2 rounded-lg border bg-card pr-2 text-sm transition-colors hover:bg-accent/40">
            <Link href={`/klientet/${c.client.id}`} className="flex flex-1 items-center justify-between px-4 py-3">
              <div><div className="font-medium">{c.client.name}</div><div className="text-xs text-muted-foreground">{c.client.city}{c.client.phone ? ` · ${c.client.phone}` : ""} · {c.orders} porosi{c.last ? ` · e fundit ${fmtDate(c.last)}` : ""}</div></div>
              <div className="flex items-center gap-3"><div className="text-right tabular"><div className="font-medium">{fmtLek(c.valueAll)}</div><div className="text-xs text-muted-foreground">{fmtKg(c.kgAll, 0)}</div></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></div>
            </Link>
            <Button variant="ghost" size="icon" aria-label={`Ndrysho ${c.client.name}`} onClick={() => setDialog({ open: true, client: c.client })}><Pencil className="h-4 w-4" /></Button>
          </div>
        ))}
        {!cs.length && <p className="py-10 text-center text-sm text-muted-foreground">Asnjë klient nuk përputhet.</p>}
      </div>
      <ClientDialog open={dialog.open} client={dialog.client} onClose={() => setDialog({ open: false })} />
    </>
  );
}
