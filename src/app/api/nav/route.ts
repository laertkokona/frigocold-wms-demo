import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/session";
import { getDb } from "@/lib/server/db";
import { daysUntil } from "@/lib/utils";

type Balance = { product_id: string; load_type: string; exp_from: string; kg: unknown; qty: unknown };

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const [drafts, settings, balances] = await Promise.all([
    db.draft.count(),
    db.settings.findUnique({ where: { id: 1 } }),
    db.$queryRaw<Balance[]>`SELECT sh.product_id, sh.load_type, sh.exp_from,
      COALESCE(SUM(m.kg), 0) AS kg, COALESCE(SUM(m.qty), 0) AS qty
      FROM shipments sh LEFT JOIN movements m ON m.shipment_id = sh.id GROUP BY sh.id`,
  ]);
  const expiryDays = settings?.expiryDays ?? 60;
  const lowShipmentCount = settings?.lowShipmentCount ?? 5;
  const lowProductKg = (settings?.lowProductKg ?? {}) as Record<string, number>;
  const byProduct = new Map<string, number>();
  let alerts = 0;
  for (const row of balances) {
    const kg = Number(row.kg), qty = Number(row.qty);
    if (kg <= 0) continue;
    byProduct.set(row.product_id, (byProduct.get(row.product_id) ?? 0) + kg);
    if (daysUntil(row.exp_from) <= expiryDays) alerts++;
    if (row.load_type === "CARTON" && qty > 0 && qty <= lowShipmentCount) alerts++;
  }
  for (const [id, minimum] of Object.entries(lowProductKg)) if (minimum > 0 && (byProduct.get(id) ?? 0) < minimum) alerts++;
  return NextResponse.json({ alerts, drafts }, { headers: { "Cache-Control": "no-store" } });
}
