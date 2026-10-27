"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DecimalInput, Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { Shipment } from "@/lib/types";
import { todayInTirane } from "@/lib/utils";

/** firstSaleDate: earliest sale from this load — the entry date cannot be moved after it. */
export function ShipmentDetailsDialog({ shipment, open, onClose, firstSaleDate }: { shipment: Shipment; open: boolean; onClose: () => void; firstSaleDate?: string }) {
  const { suppliers, updateShipmentDetails } = useStore();
  const [entryDate, setEntryDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [orderNr, setOrderNr] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const { id, supplierId: originalSupplier, orderNr: originalOrder, costPerKg: originalCost, entryDate: originalEntry } = shipment;
  useEffect(() => {
    if (!open) return;
    setSupplierId(originalSupplier ?? ""); setOrderNr(originalOrder ?? ""); setCost(originalCost?.toString() ?? ""); setEntryDate(originalEntry);
  }, [open, id, originalSupplier, originalOrder, originalCost, originalEntry]);
  const validCost = !cost.trim() || Number.isFinite(Number(cost)) && Number(cost) > 0;
  const maxEntry = firstSaleDate && firstSaleDate < todayInTirane() ? firstSaleDate : todayInTirane();
  const dateError = !entryDate ? "Zgjidh datën e hyrjes" : entryDate > todayInTirane() ? "Data nuk mund të jetë në të ardhmen" : firstSaleDate && entryDate > firstSaleDate ? "Data nuk mund të jetë pas shitjes së parë nga kjo ngarkesë" : "";
  const save = async () => {
    if (saving || !validCost || dateError) return;
    setSaving(true);
    try {
      await updateShipmentDetails(shipment.id, { supplierId: supplierId || null, orderNr: orderNr.trim() || null, costPerKg: cost.trim() ? Number(cost) : null, ...(entryDate !== originalEntry ? { entryDate } : {}) });
      toast.success("Të dhënat u përditësuan"); onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Ruajtja dështoi"); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={value => !value && !saving && onClose()}><DialogContent>
    <DialogTitle>Plotëso të dhënat e ngarkesës</DialogTitle>
    <DialogDescription>Kostoja përditëson vlerën e stokut dhe fitimin e shitjeve të kësaj ngarkese. Fushat mund të mbeten bosh kur nuk njihen.</DialogDescription>
    <div className="mt-4 space-y-4">
      <div><Label htmlFor="shipment-entry">Data e hyrjes</Label><Input id="shipment-entry" type="date" max={maxEntry} value={entryDate} onChange={event => setEntryDate(event.target.value)} />{dateError ? <p role="alert" className="mt-1 text-xs text-danger">{dateError}</p> : entryDate !== originalEntry && <p className="mt-1 text-xs text-warn">Ngarkesa do të llogaritet si e hyrë më këtë datë.</p>}</div>
      <div><Label>Furnizuesi (opsional)</Label><Select value={supplierId || "__unknown"} onValueChange={value => setSupplierId(value === "__unknown" ? "" : value)}><SelectTrigger aria-label="Furnizuesi"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__unknown">Pa furnizues</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="shipment-order">Nr. i porosisë (opsional)</Label><Input id="shipment-order" maxLength={100} value={orderNr} onChange={event => setOrderNr(event.target.value)} /></div>
      <div><Label htmlFor="shipment-cost">Kosto / kg në Lek (opsionale)</Label><DecimalInput id="shipment-cost" value={cost} onChange={event => setCost(event.target.value)} placeholder="E panjohur" />{!validCost && <p role="alert" className="mt-1 text-xs text-danger">Kostoja duhet të jetë pozitive ose bosh.</p>}</div>
      <Button className="w-full" disabled={saving || !validCost || !!dateError} onClick={save}>{saving ? "Po ruhet…" : "Ruaj të dhënat"}</Button>
    </div>
  </DialogContent></Dialog>;
}
