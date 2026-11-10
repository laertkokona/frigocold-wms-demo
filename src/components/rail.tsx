"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Boxes, Calculator, LayoutDashboard, LogOut, Menu, PackageMinus, PackagePlus, Search, Settings, Snowflake, Truck, Users, Warehouse, ListOrdered, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerReport } from "@/lib/use-server-report";

const items = [
  { href: "/dashboard", label: "Paneli", icon: LayoutDashboard },
  { href: "/hyrje", label: "Hyrje", icon: PackagePlus, tone: "entry" },
  { href: "/dalje", label: "Dalje", icon: PackageMinus, tone: "exit" },
  { href: "/produktet", label: "Produktet", icon: Boxes },
  { href: "/inventari", label: "Stoku", icon: Warehouse },
  { href: "/kontabiliteti", label: "Financa", icon: Calculator },
  { href: "/klientet", label: "Klientët", icon: Users },
  { href: "/furnizuesit", label: "Furnizues", icon: Truck },
  { href: "/levizjet", label: "Lëvizjet", icon: ListOrdered },
  { href: "/kerko", label: "Kërko", icon: Search },
  { href: "/alarmet", label: "Alarme", icon: Bell },
] as const;

/** On phones the bottom bar keeps the four most used sections; everything else, Cilësime and Dil included, is under "Më shumë". */
const PHONE_BAR = new Set<string>(["/dashboard", "/hyrje", "/dalje", "/inventari"]);

export function Rail() {
  const path = usePathname(); const router = useRouter();
  const nav = useServerReport<{ alerts: number; drafts: number }>("/api/nav", 30000);
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); };
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  useEffect(() => {
    if (!more) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setMore(false); };
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [more]);
  const alerts = nav.data?.alerts ?? 0;
  const moreItems = items.filter(it => !PHONE_BAR.has(it.href));
  const moreActive = moreItems.some(it => path === it.href || path.startsWith(it.href + "/")) || path.startsWith("/cilesimet");
  return (<>
    {/* Side rail on tablets and computers; it scrolls when the screen is too short (e.g. a phone held sideways). On phones it becomes the bottom bar. */}
    <nav className="scroll-thin fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col items-center overflow-y-auto overflow-x-hidden border-r bg-card py-4 max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-16 max-md:w-full max-md:flex-row max-md:justify-around max-md:overflow-visible max-md:border-r-0 max-md:border-t max-md:py-0" aria-label="Navigimi kryesor">
      <Link href="/dashboard" className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-foreground max-md:hidden" aria-label="FrigoCold"><Snowflake className="h-5 w-5" /></Link>
      {items.map(it => {
        const active = path === it.href || path.startsWith(it.href + "/");
        const badge = it.href === "/alarmet" ? nav.data?.alerts ?? 0 : it.href === "/hyrje" ? nav.data?.drafts ?? 0 : 0;
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
            className={cn("relative mb-1 flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:mb-0 max-md:h-14",
              active && "tone" in it && it.tone === "entry" && "bg-entry/15 text-entry",
              active && "tone" in it && it.tone === "exit" && "bg-exit/15 text-exit",
              active && !("tone" in it) && "bg-accent text-accent-foreground",
              !PHONE_BAR.has(it.href) && "max-md:hidden")}>
            <it.icon className="h-5 w-5" /><span className="text-[9px] leading-none">{it.label}</span>
            {badge > 0 && <span className={cn("absolute right-1 top-1 min-w-[16px] rounded-full px-1 text-center text-[9px] font-semibold leading-4 text-white", it.href === "/alarmet" ? "bg-danger" : "bg-warn")}>{badge}</span>}
          </Link>
        );
      })}
      <button onClick={() => setMore(m => !m)} aria-expanded={more} aria-label="Më shumë" className={cn("relative flex h-14 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden", (more || moreActive) && "bg-accent text-accent-foreground")}>
        {more ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}<span className="text-[9px] leading-none">Më shumë</span>
        {alerts > 0 && !more && <span className="absolute right-0 top-1 min-w-[16px] rounded-full bg-danger px-1 text-center text-[9px] font-semibold leading-4 text-white">{alerts}</span>}
      </button>
      <div className="mt-auto flex shrink-0 flex-col items-center gap-1 pt-2 max-md:hidden">
        <Link href="/cilesimet" className={cn("flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground", path.startsWith("/cilesimet") && "bg-accent text-accent-foreground")}><Settings className="h-5 w-5" /><span className="text-[9px]">Cilësime</span></Link>
        <button onClick={logout} className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Dil"><LogOut className="h-5 w-5" /><span className="text-[9px]">Dil</span></button>
      </div>
    </nav>
    {more && <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMore(false)}>
      <div className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-label="Më shumë" onClick={e => e.stopPropagation()} className="absolute inset-x-0 bottom-16 rounded-t-2xl border-t bg-card p-3 pb-4 shadow-lg">
        <div className="grid grid-cols-4 gap-2">
          {moreItems.map(it => {
            const active = path === it.href || path.startsWith(it.href + "/"), badge = it.href === "/alarmet" ? alerts : 0;
            return <Link key={it.href} href={it.href} className={cn("relative flex h-16 flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground", active && "bg-accent text-accent-foreground")}>
              <it.icon className="h-5 w-5" /><span className="text-[11px] leading-none">{it.label}</span>
              {badge > 0 && <span className="absolute right-2 top-1.5 min-w-[16px] rounded-full bg-danger px-1 text-center text-[9px] font-semibold leading-4 text-white">{badge}</span>}
            </Link>;
          })}
          <Link href="/cilesimet" className={cn("flex h-16 flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground", path.startsWith("/cilesimet") && "bg-accent text-accent-foreground")}><Settings className="h-5 w-5" /><span className="text-[11px] leading-none">Cilësime</span></Link>
          <button onClick={logout} className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg text-danger hover:bg-accent"><LogOut className="h-5 w-5" /><span className="text-[11px] leading-none">Dil</span></button>
        </div>
      </div>
    </div>}
  </>);
}
