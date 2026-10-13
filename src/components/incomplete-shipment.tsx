import { Badge } from "@/components/ui/badge";
import { incompleteReasons } from "@/lib/stock";
import type { Shipment } from "@/lib/types";

export function IncompleteShipment({ shipment }: { shipment: Pick<Shipment, "supplierId" | "orderNr" | "countActual" | "costPerKg" | "lots" | "returnOf"> }) {
  const reasons = incompleteReasons(shipment);
  return reasons.length ? <Badge variant="warn" title={`Mungojnë: ${reasons.join(", ")}`} className="ml-2">Të dhëna të paplota</Badge> : null;
}
