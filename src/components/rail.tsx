"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Calculator, LayoutDashboard, LogOut, PackageMinus, PackagePlus, Search, Settings, Snowflake, Users, Warehouse, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { computeAlerts } from "@/lib/calc";

const items = [
  { href: "/dashboard", label: "Paneli", icon: LayoutDashboard },
  { href: "/hyrje", label: "Hyrje", icon: PackagePlus, tone: "entry" },
  { href: "/dalje", label: "Dalje", icon: PackageMinus, tone: "exit" },
  { href: "/inventari", label: "Stoku", icon: Warehouse },
  { href: "/kontabiliteti", label: "Financa", icon: Calculator },
  { href: "/klientet", label: "Klientët", icon: Users },
  { href: "/levizjet", label: "Lëvizjet", icon: ListOrdered },
  { href: "/kerko", label: "Kërko", icon: Search },
  { href: "/alarmet", label: "Alarme", icon: Bell },
] as const;

export function Rail() {
  const path = usePathname(); const router = useRouter();
  const { shipments, products, thresholds, drafts } = useStore();
  const alerts = computeAlerts(shipments, products, thresholds);
  const logout = () => { document.cookie = "fc_session=; path=/; max-age=0"; router.replace("/login"); };
  return (
    <nav className="fixed inset-y-0 left-0 z-40 flex w-[72px] flex-col items-center border-r bg-card py-4 max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-16 max-md:w-full max-md:flex-row max-md:justify-around max-md:border-r-0 max-md:border-t max-md:py-0" aria-label="Navigimi kryesor">
      <Link href="/dashboard" className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-entry text-entry-foreground max-md:hidden" aria-label="FrigoCold"><Snowflake className="h-5 w-5" /></Link>
      {items.map(it => {
        const active = path === it.href || path.startsWith(it.href + "/");
        const badge = it.href === "/alarmet" ? alerts.length : it.href === "/hyrje" ? drafts.length : 0;
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
            className={cn("relative mb-1 flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:mb-0 max-md:h-14",
              active && "tone" in it && it.tone === "entry" && "bg-entry/15 text-entry",
              active && "tone" in it && it.tone === "exit" && "bg-exit/15 text-exit",
              active && !("tone" in it) && "bg-accent text-foreground")}>
            <it.icon className="h-5 w-5" /><span className="text-[9px] leading-none">{it.label}</span>
            {badge > 0 && <span className={cn("absolute right-1 top-1 min-w-[16px] rounded-full px-1 text-center text-[9px] font-semibold leading-4 text-white", it.href === "/alarmet" ? "bg-danger" : "bg-warn")}>{badge}</span>}
          </Link>
        );
      })}
      <div className="mt-auto flex flex-col items-center gap-1 max-md:hidden">
        <Link href="/cilesimet" className={cn("flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground", path.startsWith("/cilesimet") && "bg-accent text-foreground")}><Settings className="h-5 w-5" /><span className="text-[9px]">Cilësime</span></Link>
        <button onClick={logout} className="flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Dil"><LogOut className="h-5 w-5" /><span className="text-[9px]">Dil</span></button>
      </div>
    </nav>
  );
}
