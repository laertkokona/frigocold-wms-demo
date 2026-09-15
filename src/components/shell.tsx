"use client";
import { useStore } from "@/lib/store";
import { Rail } from "./rail";
import { useEffect, useState } from "react";

export function Shell({ children }: { children: React.ReactNode }) {
  const hydrated = useStore(s => s.hydrated);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <>
      <Rail />
      <main className="min-h-screen pl-[72px] max-md:pb-16 max-md:pl-0">
        <div className="mx-auto max-w-6xl px-6 py-6 max-md:px-4">
          {mounted && hydrated ? children : <div className="h-40 animate-pulse rounded-lg bg-card" />}
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
