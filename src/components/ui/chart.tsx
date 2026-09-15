"use client";
import { cn } from "@/lib/utils";

interface Pt { label: string; a: number | null; b?: number | null }

/** Two-series line chart (e.g. selling price vs cost per kg). Nulls create gaps. */
export function LineChart({ data, aLabel, bLabel, unit = "", height = 180, className }: { data: Pt[]; aLabel: string; bLabel?: string; unit?: string; height?: number; className?: string }) {
  const vals = data.flatMap(d => [d.a, d.b]).filter((v): v is number => v != null && isFinite(v));
  if (!vals.length) return <div className={cn("grid place-items-center text-sm text-muted-foreground", className)} style={{ height }}>Nuk ka të dhëna për këtë periudhë.</div>;
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min) * 0.15 || Math.max(1, max * 0.1);
  const lo = Math.max(0, min - pad), hi = max + pad;
  const W = 100, H = 100;
  const x = (i: number) => data.length > 1 ? (i / (data.length - 1)) * W : W / 2;
  const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * H;
  const path = (key: "a" | "b") => {
    let d = "", pen = false;
    data.forEach((pt, i) => { const v = pt[key]; if (v == null || !isFinite(v)) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i)} ${y(v)} `; pen = true; });
    return d.trim();
  };
  const fmt = (v: number) => Math.round(v).toLocaleString("sq-AL");
  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-exit" />{aLabel}</span>
        {bLabel && <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded bg-warn" />{bLabel}</span>}
      </div>
      <div className="relative" style={{ height }}>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between text-[10px] text-muted-foreground">
          <span>{fmt(hi)}{unit}</span><span>{fmt((hi + lo) / 2)}{unit}</span><span>{fmt(lo)}{unit}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full pl-12" role="img" aria-label={`${aLabel}${bLabel ? " dhe " + bLabel : ""} sipas muajve`}>
          {[0, 50, 100].map(g => <line key={g} x1="0" x2={W} y1={g} y2={g} stroke="currentColor" strokeWidth="0.3" className="text-border" vectorEffect="non-scaling-stroke" />)}
          {bLabel && <path d={path("b")} fill="none" stroke="hsl(var(--warn))" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
          <path d={path("a")} fill="none" stroke="hsl(var(--exit))" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((pt, i) => pt.a != null && isFinite(pt.a) ? <circle key={i} cx={x(i)} cy={y(pt.a)} r="1.6" fill="hsl(var(--exit))" vectorEffect="non-scaling-stroke" /> : null)}
        </svg>
      </div>
      <div className="flex pl-12 text-[10px] text-muted-foreground">{data.map((d, i) => <span key={i} className="flex-1 text-center">{d.label}</span>)}</div>
    </div>
  );
}

/** Horizontal proportion bar. */
export function Bar({ value, max, tone = "exit", className }: { value: number; max: number; tone?: "exit" | "entry" | "warn" | "danger"; className?: string }) {
  return <div className={cn("h-2 flex-1 overflow-hidden rounded bg-secondary", className)}><div className={cn("h-full rounded", tone === "exit" && "bg-exit", tone === "entry" && "bg-entry", tone === "warn" && "bg-warn", tone === "danger" && "bg-danger")} style={{ width: `${Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))}%` }} /></div>;
}
