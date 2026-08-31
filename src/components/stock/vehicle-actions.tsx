"use client";

/**
 * Alta, edición y baja de una unidad del inventario.
 *
 * La patente encabeza el formulario porque es la identidad de la unidad: es lo que busca el
 * agente, lo que evita duplicados y lo que exige Chileautos para publicar.
 *
 * Eliminar sólo aparece para el administrador de la automotora. Si la unidad ya tiene
 * ofertas o compras, el backend la archiva en vez de borrarla y se avisa.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { DeleteButton, FormDialog, FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { VehicleRow } from "@/lib/data/crm";

const STATUSES = [
  { value: "DRAFT", label: "Borrador (no visible)" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "RESERVED", label: "Reservado" },
  { value: "SOLD", label: "Vendido" },
];

const TRANSMISSIONS = [
  { value: "", label: "Sin especificar" },
  { value: "automatic", label: "Automática" },
  { value: "manual", label: "Mecánica" },
];

const FUELS = [
  { value: "", label: "Sin especificar" },
  { value: "gasoline", label: "Bencina" },
  { value: "diesel", label: "Diésel" },
  { value: "hybrid", label: "Híbrido" },
  { value: "electric", label: "Eléctrico" },
];

type FormState = {
  patent: string;
  brand: string;
  model: string;
  year: string;
  price: string;
  mileage: string;
  color: string;
  transmission: string;
  fuelType: string;
  status: string;
  description: string;
};

function toForm(vehicle?: VehicleRow): FormState {
  return {
    patent: vehicle?.patent ?? "",
    brand: vehicle?.brand ?? "",
    model: vehicle?.model ?? "",
    year: vehicle?.year ? String(vehicle.year) : "",
    price: vehicle?.price ? String(vehicle.price) : "",
    mileage: vehicle?.mileage !== null && vehicle?.mileage !== undefined ? String(vehicle.mileage) : "",
    color: "",
    transmission: "",
    fuelType: "",
    status: vehicle?.status ?? "DRAFT",
    description: "",
  };
}

export function VehicleActions({
  vehicle,
  canDelete,
}: {
  /** Sin vehículo el componente es el botón de alta. */
  vehicle?: VehicleRow;
  canDelete: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(vehicle);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => toForm(vehicle));

  const update = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!form.patent.trim()) {
      toast.error("La patente es obligatoria: identifica la unidad");
      return;
    }
    if (!isEdit && (!form.brand.trim() || !form.model.trim() || !form.year || !form.price)) {
      toast.error("Marca, modelo, año y precio son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        patent: form.patent.trim(),
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        year: form.year ? Number(form.year) : undefined,
        price: form.price ? Number(form.price) : undefined,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        color: form.color.trim() || undefined,
        transmission: form.transmission || undefined,
        fuelType: form.fuelType || undefined,
        status: form.status || undefined,
        description: form.description.trim() || undefined,
      };

      const res = await crmFetch(isEdit ? `/api/crm/vehicles/${vehicle!.id}` : "/api/crm/vehicles", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos guardar la unidad");
        return;
      }
      toast.success(isEdit ? "Unidad actualizada" : "Unidad agregada");
      if (!isEdit) setForm(toForm());
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para guardar la unidad");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    let res: Response;
    try {
      res = await crmFetch(`/api/crm/vehicles/${vehicle!.id}`, { method: "DELETE" });
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para eliminar la unidad");
      if (message) toast.error(message);
      throw error;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "No pudimos eliminar la unidad");
      throw new Error(data?.error || "No pudimos eliminar la unidad");
    }
    toast.success(
      data?.archived
        ? "La unidad tenía ofertas o ventas: quedó archivada en vez de eliminada"
        : "Unidad eliminada",
    );
    setOpen(false);
    startTransition(() => router.refresh());
  };

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => {
            setForm(toForm(vehicle));
            setOpen(true);
          }}
          aria-label={`Editar ${vehicle!.patent ?? "unidad"}`}
          className="rounded-[var(--radius-md)] border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--foreground)]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Agregar unidad
        </button>
      )}

      <FormDialog
        open={open}
        title={isEdit ? "Editar unidad" : "Agregar unidad"}
        description={
          isEdit
            ? "Los cambios se ven de inmediato en tu stock."
            : "La unidad entra como borrador: publícala cuando esté lista."
        }
        submitLabel={isEdit ? "Guardar cambios" : "Agregar"}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      >
        <FormField label="Patente" required hint="Identifica la unidad. No puede repetirse con otra activa.">
          <input
            value={form.patent}
            onChange={(e) => update("patent", e.target.value.toUpperCase())}
            className={`${fieldInputClass} font-mono uppercase`}
            placeholder="ABCD12"
            autoFocus={!isEdit}
          />
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Marca" required={!isEdit}>
            <input value={form.brand} onChange={(e) => update("brand", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="Modelo" required={!isEdit}>
            <input value={form.model} onChange={(e) => update("model", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="Año" required={!isEdit}>
            <input
              type="number"
              inputMode="numeric"
              value={form.year}
              onChange={(e) => update("year", e.target.value)}
              className={fieldInputClass}
              placeholder="2021"
            />
          </FormField>
          <FormField label="Precio (CLP)" required={!isEdit}>
            <input
              type="number"
              inputMode="numeric"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              className={fieldInputClass}
              placeholder="9990000"
            />
          </FormField>
          <FormField label="Kilometraje">
            <input
              type="number"
              inputMode="numeric"
              value={form.mileage}
              onChange={(e) => update("mileage", e.target.value)}
              className={fieldInputClass}
            />
          </FormField>
          <FormField label="Color">
            <input value={form.color} onChange={(e) => update("color", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="Transmisión">
            <select
              value={form.transmission}
              onChange={(e) => update("transmission", e.target.value)}
              className={fieldInputClass}
            >
              {TRANSMISSIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Combustible">
            <select
              value={form.fuelType}
              onChange={(e) => update("fuelType", e.target.value)}
              className={fieldInputClass}
            >
              {FUELS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Estado">
          <select value={form.status} onChange={(e) => update("status", e.target.value)} className={fieldInputClass}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Descripción">
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className={`${fieldInputClass} resize-none`}
            placeholder="Mantenciones al día, dueño único…"
          />
        </FormField>

        {isEdit && canDelete && (
          <div className="border-t border-[var(--border)] pt-3">
            <DeleteButton
              label="Eliminar unidad"
              question={`¿Eliminar ${vehicle!.patent ?? "esta unidad"} del stock? Si tiene ofertas o ventas, se archivará en lugar de borrarse.`}
              onDelete={remove}
            />
          </div>
        )}
      </FormDialog>
    </>
  );
}
