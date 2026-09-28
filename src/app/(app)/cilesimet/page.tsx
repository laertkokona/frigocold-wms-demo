"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { useStore } from "@/lib/store";

export default function Cilesimet() {
  const { thresholds, setThresholds, products } = useStore();
  const [t, setT] = useState(thresholds);
  return (
    <>
      <PageHeader title="Cilësimet" sub="Pragjet e alarmeve dhe të dhënat e demos" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Alarmet</CardTitle><CardDescription>Kur të njoftohet magazina</CardDescription></CardHeader><CardContent className="space-y-3">
          <div><Label>Ditë para skadimit</Label><Input type="number" value={t.expiryDays} onChange={e => setT({ ...t, expiryDays: +e.target.value })} /></div>
          <div><Label>Kartona minimum për lot</Label><Input type="number" value={t.lowShipmentCount} onChange={e => setT({ ...t, lowShipmentCount: +e.target.value })} /></div>
          <div className="pt-2 text-xs text-muted-foreground">Kg minimum për produkt (bosh = pa alarm)</div>
          {products.map(p => <div key={p.id} className="flex items-center gap-3"><span className="flex-1 text-sm">{p.name}</span><Input type="number" className="w-28" value={t.lowProductKg[p.id] ?? ""} onChange={e => setT({ ...t, lowProductKg: { ...t.lowProductKg, [p.id]: +e.target.value } })} /></div>)}
          <Button variant="entry" className="w-full" onClick={async () => { try { await setThresholds(t); toast.success("Cilësimet u ruajtën"); } catch (e) { toast.error(e instanceof Error ? e.message : "Cilësimet nuk u ruajtën"); } }}>Ruaj cilësimet</Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Të dhënat</CardTitle><CardDescription>Ruhen në bazën e të dhënave</CardDescription></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Hyrjet, shitjet, klientët dhe produktet ruhen në server dhe janë të përbashkëta për përdoruesit e autorizuar.</p>
        </CardContent></Card>
      </div>
    </>
  );
}
