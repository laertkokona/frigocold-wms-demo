"use client";
import { useStore } from "@/lib/store";
import { Rail } from "./rail";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const compactPages = new Set(["/dashboard", "/kontabiliteti", "/kerko", "/levizjet", "/inventari", "/klientet", "/furnizuesit"]);

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const compact = compactPages.has(pathname);
  const hydrated = useStore(s => s.hydrated);
  const error = useStore(s => s.error);
  const load = useStore(s => s.load);
  const [mounted, setMounted] = useState(false);
  const [readyPath, setReadyPath] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (compact) return;
    let active = true;
    void load().then(() => { if (active) setReadyPath(pathname); });
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [load, compact, pathname]);
  return (
    <>
      <Rail />
      <main className="min-h-screen pl-[72px] max-md:pb-16 max-md:pl-0">
        <div className="mx-auto max-w-6xl px-6 py-6 max-md:px-4">
          {mounted && (compact || (hydrated && readyPath === pathname)) ? (!compact && error ? <div role="alert" className="rounded-lg border p-6">Të dhënat nuk u ngarkuan: {error}. <button className="underline" onClick={() => void load()}>Provo sërish</button></div> : children) : <div className="h-40 animate-pulse rounded-lg bg-card" />}
        </div>
      </main>
    </>
  );
}

export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold tracking-tight">{title}</h1>{sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}</div>
      {right}
    </div>
  );
}
