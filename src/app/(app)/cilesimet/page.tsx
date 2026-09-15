"use client";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell";
import { useStore } from "@/lib/store";

export default function Cilesimet() {
  const { thresholds, setThresholds, products, resetDemo } = useStore();
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
          <Button variant="entry" className="w-full" onClick={() => { setThresholds(t); toast.success("Cilësimet u ruajtën"); }}>Ruaj cilësimet</Button>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Demo</CardTitle><CardDescription>Të dhënat ruhen lokalisht në këtë shfletues</CardDescription></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Çdo hyrje, shitje, klient apo produkt që shton ruhet në shfletuesin tënd dhe mbetet pas rifreskimit. Për të kthyer demon në gjendjen fillestare:</p>
          <Button variant="outline" onClick={() => { resetDemo(); setT(useStore.getState().thresholds); toast("Të dhënat e demos u rikthyen"); }}><RotateCcw /> Rikthe të dhënat e demos</Button>
          <p className="pt-2">Përdoruesi: <span className="font-mono">menaxher</span> · Fjalëkalimi: <span className="font-mono">frigocold</span></p>
        </CardContent></Card>
      </div>
    </>
  );
}
