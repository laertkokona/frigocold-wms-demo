import { cn } from "@/lib/utils";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
export function Banner({ tone = "info", children, className }: { tone?: "info" | "warn" | "danger"; children: React.ReactNode; className?: string }) {
  const Icon = tone === "danger" ? OctagonAlert : tone === "warn" ? AlertTriangle : Info;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-md border-l-2 px-3.5 py-3 text-sm",
      tone === "info" && "border-exit bg-exit/10 text-exit", tone === "warn" && "border-warn bg-warn/10 text-warn", tone === "danger" && "border-danger bg-danger/10 text-danger", className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" /><div className="leading-relaxed">{children}</div>
    </div>
  );
}
