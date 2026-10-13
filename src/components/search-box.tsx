"use client";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Search field used above pickers. Matching is case- and accent-insensitive (ë = e, ç = c). */
export function SearchBox({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }) {
  return (
    <div className="relative mb-3">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="pl-9 pr-9" aria-label={placeholder} />
      {value && <button type="button" onClick={() => onChange("")} aria-label="Pastro kërkimin" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
    </div>
  );
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** True when every word of the query appears somewhere in the given texts. */
export function matches(query: string, ...texts: (string | null | undefined)[]) {
  const hay = fold(texts.filter(Boolean).join(" "));
  return fold(query).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}
