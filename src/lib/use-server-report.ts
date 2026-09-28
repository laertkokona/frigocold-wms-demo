"use client";
import { useEffect, useState } from "react";

export function useServerReport<T>(url: string, refreshMs = 60000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    const load = async () => {
      try {
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { window.location.assign("/login"); return; }
        if (!response.ok) throw new Error("Raporti nuk u ngarkua");
        setData(await response.json() as T); setError(null);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Raporti nuk u ngarkua"); }
    };
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, refreshMs);
    return () => { controller.abort(); window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [url, refreshMs, revision]);
  return { data, error, refresh: () => setRevision(n => n + 1) };
}
