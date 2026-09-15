"use client";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shell";
import { Banner } from "@/components/ui/banner";
import { useStore } from "@/lib/store";
import { computeAlerts } from "@/lib/calc";

export default function Alarmet() {
  const { shipments, products, thresholds } = useStore();
  const alerts = computeAlerts(shipments, products, thresholds);
  return (
    <>
      <PageHeader title="Alarmet" sub={`${alerts.length} aktive · pragjet ndryshohen te Cilësimet`} />
      {!alerts.length && <div className="flex items-center gap-3 rounded-lg border bg-card p-6 text-sm"><CheckCircle2 className="h-5 w-5 text-entry" />Gjithë stoku është brenda normave.</div>}
      <div className="space-y-2">{alerts.map((a, i) => <Link key={i} href={a.href} className="block"><Banner tone={a.level}><b>{a.title}.</b> {a.detail}</Banner></Link>)}</div>
    </>
  );
}
