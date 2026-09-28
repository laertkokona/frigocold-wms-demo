"use client";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { PageHeader } from "@/components/shell";
import { BrowseControls } from "@/components/browse-controls";
import { useBrowse } from "@/lib/use-browse";
import { fmtDate, fmtLek, fmtNum } from "@/lib/utils";

type Row = { id: string; date: string; type: "IN" | "OUT"; product: string; lot: string; party: string; qty: number; kg: number; value: number; method: string };
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""').replace(/^[=+@-]/, "'$&")}"`;

export default function Levizjet() {
  const list = useBrowse<Row>("movements", "date", "desc");
  const exportPage = () => {
    const csv = ["Data,Lloji,Produkti,Lot,Pala,Sasia,Kg,Vlera (Lek),Shënim", ...list.items.map(r => [fmtDate(r.date), r.type === "IN" ? "HYRJE" : "DALJE", r.product, r.lot, r.party, r.qty, r.kg.toFixed(3), Math.round(r.value), r.method].map(csvCell).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `levizjet-frigocold-faqe-${list.page}.csv`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <PageHeader title="Lëvizjet" sub="Regjistri i hyrjeve dhe daljeve" right={<Button variant="outline" disabled={!list.items.length} onClick={exportPage}><Download /> Eksporto faqen CSV</Button>} />
    <div className="mb-4 flex flex-wrap gap-3"><Segmented value={list.filter || "ALL"} onChange={list.setFilter} options={[{ value: "ALL", label: "Të gjitha" }, { value: "IN", label: "Hyrje" }, { value: "OUT", label: "Dalje" }]} className="w-72" /><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Kërko produkt, lot, klient…" value={list.q} onChange={e => list.setQ(e.target.value)} className="max-w-xs pl-9" /></div></div>
    {list.error && <p role="alert" className="mb-3 text-sm text-danger">{list.error} <button className="underline" onClick={list.refresh}>Provo sërish</button></p>}
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr className="border-b bg-card text-left text-[11px] text-muted-foreground"><th className="px-3 py-2 font-medium">Data</th><th className="px-3 py-2 font-medium">Lloji</th><th className="px-3 py-2 font-medium">Produkti · lot</th><th className="px-3 py-2 font-medium">Furnizuesi / klienti</th><th className="px-3 py-2 text-right font-medium">Sasia</th><th className="px-3 py-2 text-right font-medium">Kg</th><th className="px-3 py-2 text-right font-medium">Vlera</th></tr></thead>
      <tbody>{list.items.map(r => <tr key={r.id} className="border-b last:border-0 hover:bg-accent/30"><td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fmtDate(r.date)}</td><td className="px-3 py-2"><Badge variant={r.type === "IN" ? "entry" : "exit"}>{r.type === "IN" ? "HYRJE" : "DALJE"}</Badge></td><td className="px-3 py-2"><div>{r.product}</div><div className="text-xs text-muted-foreground">Lot {r.lot} · {r.method}</div></td><td className="px-3 py-2 text-muted-foreground">{r.party}</td><td className="px-3 py-2 text-right tabular">{r.qty}</td><td className="px-3 py-2 text-right tabular">{fmtNum(r.kg, 3)}</td><td className="px-3 py-2 text-right tabular">{fmtLek(r.value)}</td></tr>)}</tbody></table>
      {!list.loading && !list.items.length && <p className="p-6 text-center text-sm text-muted-foreground">Asnjë lëvizje me këto filtra.</p>}
    </div>
    <BrowseControls {...list} sorts={[{ value: "date", label: "Data" }, { value: "kg", label: "Kg" }, { value: "value", label: "Vlera" }]} />
  </>;
}
