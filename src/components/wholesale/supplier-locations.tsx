"use client";

/** Sucursales del proveedor: crear, editar y desactivar (dueño/administrador/supervisor). */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, MapPin, Plus } from "lucide-react";

import { FormDialog, FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { EmptyState, Pill } from "@/components/ui/primitives";
import type { SupplierLocation } from "@/lib/wholesale";
import { wholesaleRequest } from "@/lib/wholesale-upload";

type Draft = { id: string | null; name: string; address: string; commune: string };
const EMPTY: Draft = { id: null, name: "", address: "", commune: "" };

export function SupplierLocationsManager({ locations, canManage }: { locations: SupplierLocation[]; canManage: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft?.name.trim()) {
      toast.error("Ponle un nombre a la sucursal.");
      return;
    }
    setSaving(true);
    try {
      const body = { name: draft.name.trim(), address: draft.address.trim() || null, commune: draft.commune.trim() || null };
      if (draft.id) await wholesaleRequest(`/api/proveedor/locations/${draft.id}`, "PATCH", body);
      else await wholesaleRequest("/api/proveedor/locations", "POST", body);
      toast.success(draft.id ? "Sucursal actualizada." : "Sucursal creada.");
      setDraft(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar la sucursal.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (location: SupplierLocation) => {
    try {
      await wholesaleRequest(`/api/proveedor/locations/${location.id}`, "PATCH", { isActive: !location.isActive });
      toast.success(location.isActive ? "Sucursal desactivada." : "Sucursal reactivada.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar la sucursal.");
    }
  };

  return (
    <>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setDraft(EMPTY)}
            className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> Nueva sucursal
          </button>
        </div>
      )}
      {locations.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
          <EmptyState icon={<Building2 className="h-8 w-8" />} title="Todavía no tienes sucursales"
            description="Crea tus sucursales para organizar al equipo y saber desde dónde se vende cada unidad." />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <div key={location.id} className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 ${location.isActive ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{location.name}</p>
                <div className="flex gap-1">
                  {location.isMain && <Pill variant="info">Principal</Pill>}
                  {!location.isActive && <Pill variant="neutral">Inactiva</Pill>}
                </div>
              </div>
              {(location.address || location.commune) && (
                <p className="mt-1 flex items-start gap-1 text-xs text-[var(--muted-foreground)]">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />{[location.address, location.commune].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                {location.memberCount} persona(s) · {location.listingCount} unidad(es) activa(s)
              </p>
              {canManage && (
                <div className="mt-3 flex gap-3 text-xs">
                  <button className="underline" onClick={() => setDraft({ id: location.id, name: location.name, address: location.address ?? "", commune: location.commune ?? "" })}>
                    Editar
                  </button>
                  <button className="underline text-[var(--muted-foreground)]" onClick={() => toggle(location)}>
                    {location.isActive ? "Desactivar" : "Reactivar"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FormDialog open={draft !== null} title={draft?.id ? "Editar sucursal" : "Nueva sucursal"}
        description="La comuna se usa por defecto en las unidades publicadas desde esta sucursal."
        saving={saving} onClose={() => setDraft(null)} onSubmit={save}>
        {draft && (
          <div className="space-y-3">
            <FormField label="Nombre" required>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldInputClass} placeholder="Sucursal Maipú" />
            </FormField>
            <FormField label="Dirección">
              <input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className={fieldInputClass} />
            </FormField>
            <FormField label="Comuna">
              <input value={draft.commune} onChange={(e) => setDraft({ ...draft, commune: e.target.value })} className={fieldInputClass} />
            </FormField>
          </div>
        )}
      </FormDialog>
    </>
  );
}
