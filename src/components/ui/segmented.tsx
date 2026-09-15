"use client";
import { cn } from "@/lib/utils";
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cn("flex rounded-md border bg-secondary p-1", className)} role="radiogroup">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("flex-1 rounded-sm px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === o.value ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
