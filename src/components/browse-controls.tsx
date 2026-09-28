"use client";
import { Button } from "@/components/ui/button";

export function BrowseControls({ page, pageSize, total, loading, sort, direction, sorts, setPage, setPageSize, setSort, setDirection }: {
  page: number; pageSize: number; total: number; loading: boolean; sort: string; direction: "asc" | "desc";
  sorts: { value: string; label: string }[];
  setPage: (page: number) => void; setPageSize: (size: number) => void;
  setSort: (sort: string) => void; setDirection: (direction: "asc" | "desc") => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <div className="flex items-center gap-2">
      <label htmlFor="browse-sort">Rendit:</label>
      <select id="browse-sort" className="rounded-md border bg-background px-2 py-1.5" value={sort} onChange={e => setSort(e.target.value)}>{sorts.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
      <Button variant="outline" size="sm" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")} aria-label={direction === "asc" ? "Rend zbritës" : "Rend rritës"}>{direction === "asc" ? "↑" : "↓"}</Button>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{loading ? "Po ngarkohet…" : `${total} gjithsej`}</span>
      <label htmlFor="browse-size">Për faqe</label>
      <select id="browse-size" className="rounded-md border bg-background px-2 py-1.5" value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</select>
      <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Mbrapa</Button>
      <span>{page} / {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Para</Button>
    </div>
  </div>;
}
