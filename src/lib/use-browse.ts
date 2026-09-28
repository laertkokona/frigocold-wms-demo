"use client";
import { useCallback, useEffect, useState } from "react";
import type { BrowseKind } from "./server/browse";

export function useBrowse<T>(kind: BrowseKind, initialSort: string, initialDirection: "asc" | "desc" = "asc") {
  const [q, changeQ] = useState("");
  const [page, changePage] = useState(1);
  const [pageSize, changePageSize] = useState(25);
  const [sort, changeSort] = useState(initialSort);
  const [direction, changeDirection] = useState(initialDirection);
  const [filter, changeFilter] = useState("");
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ kind, q, page: String(page), pageSize: String(pageSize), sort, direction, filter });
      try {
        const response = await fetch(`/api/browse?${params}`, { signal: controller.signal, cache: "no-store" });
        if (response.status === 401) { window.location.assign("/login"); return; }
        if (!response.ok) throw new Error("Të dhënat nuk u ngarkuan");
        const data = await response.json() as { items: T[]; total: number };
        if (page > 1 && page > Math.max(1, Math.ceil(data.total / pageSize))) { changePage(Math.max(1, Math.ceil(data.total / pageSize))); return; }
        setItems(data.items); setTotal(data.total); setError(null);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Të dhënat nuk u ngarkuan");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, q ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [kind, q, page, pageSize, sort, direction, filter, revision]);
  const setQ = (value: string) => { changeQ(value); changePage(1); };
  const setFilter = (value: string) => { changeFilter(value); changePage(1); };
  const setSort = (value: string) => { changeSort(value); changePage(1); };
  const setPageSize = (value: number) => { changePageSize(value); changePage(1); };
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  return { items, total, loading, error, q, setQ, page, setPage: changePage, pageSize, setPageSize, sort, setSort, direction, setDirection: changeDirection, filter, setFilter, refresh };
}
