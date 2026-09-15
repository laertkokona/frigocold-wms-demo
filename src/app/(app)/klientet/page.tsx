"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shell";
import { useStore } from "@/lib/store";
import { clientStats } from "@/lib/calc";
import { fmtDate, fmtKg, fmtLek } from "@/lib/utils";
import { toast } from "sonner";

export default function Klientet() {
  const { clients, sales, addClient } = useStore();
  const cs = clientStats(clients, sales).sort((a, b) => b.valueAll - a.valueAll);
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [city, setCity] = useState(""); const [contact, setContact] = useState("");
  return (
    <>
      <PageHeader title="Klientët" sub={`${clients.length} klientë`} right={<Button variant="outline" onClick={() => setOpen(true)}><Plus /> Klient i ri</Button>} />
      <div className="space-y-1.5">
        {cs.map(c => <Link key={c.client.id} href={`/klientet/${c.client.id}`} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent/40"><div><div className="font-medium">{c.client.name}</div><div className="text-xs text-muted-foreground">{c.client.city} · {c.orders} porosi{c.last ? ` · e fundit ${fmtDate(c.last)}` : ""}</div></div><div className="flex items-center gap-3"><div className="text-right tabular"><div className="font-medium">{fmtLek(c.valueAll)}</div><div className="text-xs text-muted-foreground">{fmtKg(c.kgAll, 0)}</div></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></div></Link>)}
      </div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Klient i ri</DialogTitle><DialogDescription>Shtoje në listën e klientëve.</DialogDescription>
        <div className="mt-4 space-y-3"><div><Label>Emri</Label><Input value={name} onChange={e => setName(e.target.value)} /></div><div><Label>Qyteti</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div><div><Label>Personi i kontaktit</Label><Input value={contact} onChange={e => setContact(e.target.value)} /></div>
          <Button className="w-full" disabled={!name.trim()} onClick={() => { addClient({ name: name.trim(), city, contact: contact || undefined }); setOpen(false); setName(""); setCity(""); setContact(""); toast.success("Klienti u shtua"); }}>Shto klientin</Button></div>
      </DialogContent></Dialog>
    </>
  );
}
