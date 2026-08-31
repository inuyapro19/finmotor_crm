"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { OrganizationLocation } from "@/lib/data/crm";


type Draft = { name: string; address: string; commune: string; isMain: boolean; parkingCapacity: string };
const EMPTY: Draft = { name: "", address: "", commune: "", isMain: false, parkingCapacity: "0" };

export function LocationList({
  organizationId,
  locations,
  canManage,
}: {
  organizationId: string;
  locations: OrganizationLocation[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [, refresh] = useTransition();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  const beginEdit = (location: OrganizationLocation) => {
    setEditing(location.id);
    setDraft({
      name: location.name,
      address: location.address ?? "",
      commune: location.commune ?? "",
      isMain: location.isMain,
      parkingCapacity: String(location.parkingCapacity),
    });
  };

  const mutate = async (locationId: string, body: Record<string, unknown>, method = "PATCH") => {
    setSaving(true);
    try {
      const response = await crmFetch(
        `/api/crm/organizations/${organizationId}/locations/${locationId}`,
        { method, headers: { "Content-Type": "application/json" }, body: method === "DELETE" ? undefined : JSON.stringify(body) },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos actualizar la sucursal");
        return false;
      }
      refresh(() => router.refresh());
      return true;
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para actualizar la sucursal");
      if (message) toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.address.trim()) {
      toast.error("Completa nombre y dirección");
      return;
    }
    setSaving(true);
    try {
      const isNew = editing === "new";
      const response = await crmFetch(
        isNew
          ? `/api/crm/organizations/${organizationId}/locations`
          : `/api/crm/organizations/${organizationId}/locations/${editing}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name.trim(),
            address: draft.address.trim(),
            commune: draft.commune.trim() || null,
            isMain: draft.isMain,
            parkingCapacity: Number(draft.parkingCapacity || 0),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos guardar la sucursal");
        return;
      }
      toast.success(isNew ? "Sucursal creada" : "Sucursal actualizada");
      setEditing(null);
      setDraft(EMPTY);
      refresh(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para guardar la sucursal");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {locations.map((location) => (
          <div key={location.id} className={`rounded-[var(--radius-md)] border p-3 ${location.isActive ? "border-[var(--border)]" : "border-dashed border-[var(--border)] opacity-65"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--muted)]"><Building2 className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5"><p className="font-medium">{location.name}</p>{location.isMain && <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--primary)]">Principal</span>}{!location.isActive && <span className="text-[10px] text-[var(--muted-foreground)]">Inactiva</span>}</div>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{[location.address, location.commune].filter(Boolean).join(", ") || "Sin dirección"}</p>
                  <p className="mt-1 text-[11px] font-medium text-[var(--fm-navy)]">{location.parkingCapacity > 0 ? `${location.parkingCapacity} estacionamientos` : "Estacionamientos no configurados"}</p>
                </div>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-1">
                  {!location.isMain && location.isActive && <button type="button" title="Marcar principal" onClick={() => void mutate(location.id, { isMain: true })} disabled={saving} className="rounded-md border border-[var(--border)] p-2"><Star className="h-3.5 w-3.5" /></button>}
                  {!location.isActive && <button type="button" onClick={() => void mutate(location.id, { isActive: true })} disabled={saving} className="rounded-md border border-[var(--border)] px-2 text-xs">Activar</button>}
                  <button type="button" title="Editar" onClick={() => beginEdit(location)} className="rounded-md border border-[var(--border)] p-2"><Pencil className="h-3.5 w-3.5" /></button>
                  {!location.isMain && location.isActive && <button type="button" title="Desactivar" onClick={() => void mutate(location.id, {}, "DELETE")} disabled={saving} className="rounded-md border border-[var(--border)] p-2 text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && editing === null && (
        <button type="button" onClick={() => { setEditing("new"); setDraft(EMPTY); }} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm font-medium"><Plus className="h-4 w-4" />Nueva sucursal</button>
      )}

      {canManage && editing !== null && (
        <form onSubmit={submit} className="space-y-3 rounded-[var(--radius-md)] border border-[var(--primary)]/30 bg-[var(--accent)]/30 p-3">
          <p className="text-sm font-semibold">{editing === "new" ? "Nueva sucursal" : "Editar sucursal"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre"><input value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} className={inputClass} placeholder="Sucursal Centro" /></Field>
            <Field label="Comuna"><input value={draft.commune} onChange={(e) => setDraft((current) => ({ ...current, commune: e.target.value }))} className={inputClass} /></Field>
            <div className="sm:col-span-2"><Field label="Dirección"><input value={draft.address} onChange={(e) => setDraft((current) => ({ ...current, address: e.target.value }))} className={inputClass} /></Field></div>
            <Field label="Cantidad de estacionamientos"><input type="number" min={0} max={500} value={draft.parkingCapacity} onChange={(e) => setDraft((current) => ({ ...current, parkingCapacity: e.target.value }))} className={inputClass} /></Field>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.isMain} onChange={(e) => setDraft((current) => ({ ...current, isMain: e.target.checked }))} />Sucursal principal</label>
          <div className="flex gap-2"><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</button><button type="button" onClick={() => setEditing(null)} className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm">Cancelar</button></div>
        </form>
      )}
    </div>
  );
}

const inputClass = "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 outline-none focus:border-[var(--primary)]";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium">{label}</span>{children}</label>;
}
