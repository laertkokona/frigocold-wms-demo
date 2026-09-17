"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import type { Client, Supplier } from "@/lib/types";

/** Add or edit a client. Pass `client` to edit; omit to create. */
export function ClientDialog({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client?: Client; onSaved?: (c: Client) => void }) {
  const { addClient, updateClient } = useStore();
  const [f, setF] = useState({ name: "", city: "", contact: "", phone: "" });
  useEffect(() => { if (open) setF({ name: client?.name ?? "", city: client?.city ?? "", contact: client?.contact ?? "", phone: client?.phone ?? "" }); }, [open, client]);
  const save = () => {
    const data = { name: f.name.trim(), city: f.city.trim(), contact: f.contact.trim() || undefined, phone: f.phone.trim() || undefined };
    if (client) { updateClient(client.id, data); toast.success("Klienti u përditësua"); onSaved?.({ ...client, ...data }); }
    else { const c = addClient(data); toast.success("Klienti u shtua"); onSaved?.(c); }
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{client ? "Ndrysho klientin" : "Klient i ri"}</DialogTitle>
        <DialogDescription>{client ? "Përditëso të dhënat e kontaktit." : "Shtoje në listën e klientëve."}</DialogDescription>
        <div className="mt-4 space-y-3">
          <div><Label>Emri <span className="text-danger">*</span></Label><Input autoFocus value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="p.sh. Albfresh SHPK" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Qyteti</Label><Input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} placeholder="p.sh. Tiranë" /></div>
            <div><Label>Telefoni</Label><Input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="+355 …" inputMode="tel" /></div>
          </div>
          <div><Label>Personi i kontaktit</Label><Input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} /></div>
          <Button className="w-full" disabled={!f.name.trim()} onClick={save}>{client ? "Ruaj ndryshimet" : "Shto klientin"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Add or edit a supplier. Pass `supplier` to edit; omit to create. */
export function SupplierDialog({ open, onClose, supplier, onSaved }: { open: boolean; onClose: () => void; supplier?: Supplier; onSaved?: (s: Supplier) => void }) {
  const { addSupplier, updateSupplier } = useStore();
  const [f, setF] = useState({ name: "", country: "", contact: "", phone: "" });
  useEffect(() => { if (open) setF({ name: supplier?.name ?? "", country: supplier?.country ?? "", contact: supplier?.contact ?? "", phone: supplier?.phone ?? "" }); }, [open, supplier]);
  const save = () => {
    const data = { name: f.name.trim(), country: f.country.trim(), contact: f.contact.trim() || undefined, phone: f.phone.trim() || undefined };
    if (supplier) { updateSupplier(supplier.id, data); toast.success("Furnizuesi u përditësua"); onSaved?.({ ...supplier, ...data }); }
    else { const s = addSupplier(data); toast.success("Furnizuesi u shtua"); onSaved?.(s); }
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{supplier ? "Ndrysho furnizuesin" : "Furnizues i ri"}</DialogTitle>
        <DialogDescription>{supplier ? "Përditëso të dhënat e furnizuesit." : "Shtoje në listën e furnizuesve."}</DialogDescription>
        <div className="mt-4 space-y-3">
          <div><Label>Emri <span className="text-danger">*</span></Label><Input autoFocus value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="p.sh. Frigorífico Victoria" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Shteti</Label><Input value={f.country} onChange={e => setF({ ...f, country: e.target.value })} placeholder="p.sh. Paraguai" /></div>
            <div><Label>Telefoni</Label><Input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="+595 …" inputMode="tel" /></div>
          </div>
          <div><Label>Personi i kontaktit</Label><Input value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} /></div>
          <Button className="w-full" disabled={!f.name.trim()} onClick={save}>{supplier ? "Ruaj ndryshimet" : "Shto furnizuesin"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
