"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "@/components/shell";
import { useStore } from "@/lib/store";
import { fmtDate, fmtLek, fmtNum } from "@/lib/utils";

type Row = { date: string; type: "IN" | "OUT"; product: string; lot: string; party: string; qty: number; kg: number; value: number; method: string };

export default function Levizjet() {
  const { shipments, sales, products, suppliers, clients } = useStore();
  const [type, setType] = useState<"ALL" | "IN" | "OUT">("ALL"); const [q, setQ] = useState("");
  const rows = useMemo<Row[]>(() => {
    const ins: Row[] = shipments.map(s => ({ date: s.entryDate, type: "IN", product: products.find(p => p.id === s.productId)?.name ?? "", lot: s.lots.map(l => l.lotNumber).join(", "), party: suppliers.find(x => x.id === s.supplierId)?.name ?? "", qty: s.countActual, kg: s.netKgActual, value: s.totalCost, method: `Porosia ${s.orderNr}` }));
    const outs: Row[] = sales.flatMap(sl => sl.lines.map(l => { const sh = shipments.find(x => x.id === l.shipmentId); return { date: sl.date, type: "OUT" as const, product: products.find(p => p.id === l.productId)?.name ?? "", lot: sh?.lots.map(x => x.lotNumber).join(", ") ?? "", party: clients.find(c => c.id === sl.clientId)?.name ?? "", qty: l.qty, kg: l.kg, value: l.total, method: l.method === "FIXED" ? "peshë fikse" : l.method === "VARIABLE" ? "peshë e ndryshme" : "paleta" }; }));
    return [...ins, ...outs].filter(r => type === "ALL" || r.type === type).filter(r => !q || [r.product, r.lot, r.party, r.method].join(" ").toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));
  }, [shipments, sales, products, suppliers, clients, type, q]);
  const exportCsv = () => {
    const csv = ["Data,Lloji,Produkti,Lot,Pala,Sasia,Kg,Vlera (Lek),Shënim", ...rows.map(r => [fmtDate(r.date), r.type === "IN" ? "HYRJE" : "DALJE", r.product, r.lot, r.party, r.qty, r.kg.toFixed(2), Math.round(r.value), r.method].map(x => `"${x}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); a.download = "levizjet-frigocold.csv"; a.click();
  };
  return (
    <>
      <PageHeader title="Lëvizjet" sub="Regjistri i plotë i hyrjeve dhe daljeve" right={<Button variant="outline" onClick={exportCsv}><Download /> Eksporto CSV</Button>} />
      <div className="mb-4 flex flex-wrap gap-3"><Segmented value={type} onChange={setType} options={[{ value: "ALL", label: "Të gjitha" }, { value: "IN", label: "Hyrje" }, { value: "OUT", label: "Dalje" }]} className="w-72" /><Input placeholder="Kërko produkt, lot, klient…" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" /></div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm"><thead><tr className="border-b bg-card text-left text-[11px] text-muted-foreground"><th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Lloji</th><th className="px-3 py-2 font-medium">Produkti · lot</th><th className="px-3 py-2 font-medium">Furnizuesi / klienti</th><th className="px-3 py-2 text-right font-medium">Sasia</th><th className="px-3 py-2 text-right font-medium">Kg</th><th className="px-3 py-2 text-right font-medium">Vlera</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-0 hover:bg-accent/30"><td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(r.date)}</td><td className="px-3 py-2"><Badge variant={r.type === "IN" ? "entry" : "exit"}>{r.type === "IN" ? "HYRJE" : "DALJE"}</Badge></td><td className="px-3 py-2"><div>{r.product}</div><div className="text-xs text-muted-foreground">Lot {r.lot} · {r.method}</div></td><td className="px-3 py-2 text-muted-foreground">{r.party}</td><td className="px-3 py-2 text-right tabular">{r.qty}</td><td className="px-3 py-2 text-right tabular">{fmtNum(r.kg, 2)}</td><td className="px-3 py-2 text-right tabular">{fmtLek(r.value)}</td></tr>)}</tbody></table>
        {!rows.length && <p className="p-6 text-center text-sm text-muted-foreground">Asnjë lëvizje me këto filtra.</p>}
      </div>
    </>
  );
}
