"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { Shipment } from "@/lib/types";

export function ShipmentDetailsDialog({ shipment, open, onClose }: { shipment: Shipment; open: boolean; onClose: () => void }) {
  const { suppliers, updateShipmentDetails } = useStore();
  const [supplierId, setSupplierId] = useState("");
  const [orderNr, setOrderNr] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const { id, supplierId: originalSupplier, orderNr: originalOrder, costPerKg: originalCost } = shipment;
  useEffect(() => {
    if (!open) return;
    setSupplierId(originalSupplier ?? ""); setOrderNr(originalOrder ?? ""); setCost(originalCost?.toString() ?? "");
  }, [open, id, originalSupplier, originalOrder, originalCost]);
  const validCost = !cost.trim() || Number.isFinite(Number(cost)) && Number(cost) > 0;
  const save = async () => {
    if (saving || !validCost) return;
    setSaving(true);
    try {
      await updateShipmentDetails(shipment.id, { supplierId: supplierId || null, orderNr: orderNr.trim() || null, costPerKg: cost.trim() ? Number(cost) : null });
      toast.success("Të dhënat u përditësuan"); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ruajtja dështoi"); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={value => !value && !saving && onClose()}><DialogContent>
    <DialogTitle>Plotëso të dhënat e ngarkesës</DialogTitle>
    <DialogDescription>Kostoja përditëson vlerën e stokut dhe fitimin e shitjeve të kësaj ngarkese. Fushat mund të mbeten bosh kur nuk njihen.</DialogDescription>
    <div className="mt-4 space-y-4">
      <div><Label>Furnizuesi (opsional)</Label><Select value={supplierId || "__unknown"} onValueChange={value => setSupplierId(value === "__unknown" ? "" : value)}><SelectTrigger aria-label="Furnizuesi"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__unknown">Pa furnizues</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="shipment-order">Nr. i porosisë (opsional)</Label><Input id="shipment-order" maxLength={100} value={orderNr} onChange={event => setOrderNr(event.target.value)} /></div>
      <div><Label htmlFor="shipment-cost">Kosto / kg në Lek (opsionale)</Label><Input id="shipment-cost" type="number" step="0.0001" min="0.0001" value={cost} onChange={event => setCost(event.target.value)} placeholder="E panjohur" />{!validCost && <p role="alert" className="mt-1 text-xs text-danger">Kostoja duhet të jetë pozitive ose bosh.</p>}</div>
      <Button className="w-full" disabled={saving || !validCost} onClick={save}>{saving ? "Po ruhet…" : "Ruaj të dhënat"}</Button>
    </div>
  </DialogContent></Dialog>;
}
