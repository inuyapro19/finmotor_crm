"use client";

/**
 * Ingreso de un vehículo a la automotora y emisión de su contrato.
 *
 * El formulario está ordenado como ocurre en el mostrador: primero quién entrega el auto,
 * después qué auto es, y al final qué se acordó. La modalidad va arriba porque cambia el
 * resto: en consignación se pide precio mínimo y comisión; en compra directa, el precio que
 * se le paga al dueño.
 *
 * El contrato se abre en una pestaña nueva: el agente lo imprime para firmarlo con el dueño
 * ahí mismo.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { DeleteButton, FormDialog, FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { Acquisition } from "@/lib/data/crm";

const KINDS = [
  {
    value: "consignment",
    label: "Consignación",
    hint: "El dueño conserva la propiedad y tú cobras comisión al vender.",
  },
  {
    value: "purchase",
    label: "Compra directa",
    hint: "La automotora compra el auto y pasa a ser suyo.",
  },
  {
    value: "trade_in",
    label: "Permuta",
    hint: "Entra como parte de pago de otro vehículo.",
  },
];

type FormState = {
  kind: string;
  ownerName: string;
  ownerRut: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerAddress: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  vin: string;
  engineNumber: string;
  color: string;
  mileage: string;
  minPrice: string;
  commissionPct: string;
  purchasePrice: string;
  startsAt: string;
  endsAt: string;
  freeOfEncumbrances: boolean;
  notes: string;
};

function toForm(a?: Acquisition, defaultCommission?: number | null): FormState {
  const iso = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : "");
  return {
    kind: a?.kind ?? "consignment",
    ownerName: a?.ownerName ?? "",
    ownerRut: a?.ownerRut ?? "",
    ownerPhone: a?.ownerPhone ?? "",
    ownerEmail: a?.ownerEmail ?? "",
    ownerAddress: a?.ownerAddress ?? "",
    plate: a?.plate ?? "",
    brand: a?.brand ?? "",
    model: a?.model ?? "",
    year: a?.year ? String(a.year) : "",
    vin: a?.vin ?? "",
    engineNumber: a?.engineNumber ?? "",
    color: a?.color ?? "",
    mileage: a?.mileage !== null && a?.mileage !== undefined ? String(a.mileage) : "",
    minPrice: a?.minPrice ? String(a.minPrice) : "",
    commissionPct:
      a?.commissionPct !== null && a?.commissionPct !== undefined
        ? String(a.commissionPct)
        : defaultCommission !== null && defaultCommission !== undefined
          ? String(defaultCommission)
          : "",
    purchasePrice: a?.purchasePrice ? String(a.purchasePrice) : "",
    startsAt: iso(a?.startsAt),
    endsAt: iso(a?.endsAt),
    freeOfEncumbrances: a?.freeOfEncumbrances ?? true,
    notes: a?.notes ?? "",
  };
}

export function AcquisitionActions({
  acquisition,
  defaultCommission,
  canDelete,
}: {
  acquisition?: Acquisition;
  defaultCommission?: number | null;
  canDelete: boolean;
}) {
  const router = useRouter();
  const isEdit = Boolean(acquisition);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(() => toForm(acquisition, defaultCommission));

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!form.ownerName.trim()) {
      toast.error("Falta el nombre de quien entrega el auto");
      return;
    }
    if (!form.plate.trim()) {
      toast.error("Falta la patente");
      return;
    }
    if (form.kind === "consignment" && !form.minPrice) {
      toast.error("Falta el precio mínimo autorizado: es la cláusula que protege al dueño");
      return;
    }
    if (form.kind === "purchase" && !form.purchasePrice) {
      toast.error("Falta el precio que le pagas al dueño");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        kind: form.kind,
        ownerName: form.ownerName.trim(),
        ownerRut: form.ownerRut.trim() || undefined,
        ownerPhone: form.ownerPhone.trim() || undefined,
        ownerEmail: form.ownerEmail.trim() || undefined,
        ownerAddress: form.ownerAddress.trim() || undefined,
        plate: form.plate.trim(),
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        year: form.year ? Number(form.year) : undefined,
        vin: form.vin.trim() || undefined,
        engineNumber: form.engineNumber.trim() || undefined,
        color: form.color.trim() || undefined,
        mileage: form.mileage ? Number(form.mileage) : undefined,
        minPrice: form.minPrice ? Number(form.minPrice) : undefined,
        commissionPct: form.commissionPct ? Number(form.commissionPct) : undefined,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
        startsAt: form.startsAt ? `${form.startsAt}T12:00:00Z` : undefined,
        endsAt: form.endsAt ? `${form.endsAt}T12:00:00Z` : undefined,
        freeOfEncumbrances: form.freeOfEncumbrances,
        notes: form.notes.trim() || undefined,
      };

      const res = await crmFetch(
        isEdit ? `/api/crm/acquisitions/${acquisition!.id}` : "/api/crm/acquisitions",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos guardar el ingreso");
        return;
      }
      toast.success(isEdit ? "Ingreso actualizado" : "Ingreso registrado. Ya puedes emitir el contrato.");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para guardar el ingreso");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    let res: Response;
    try {
      res = await crmFetch(`/api/crm/acquisitions/${acquisition!.id}`, { method: "DELETE" });
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para eliminar el ingreso");
      if (message) toast.error(message);
      throw error;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "No pudimos eliminar el ingreso");
      throw new Error(data?.error || "No pudimos eliminar el ingreso");
    }
    toast.success(
      data?.cancelled
        ? "El contrato ya estaba emitido: el ingreso quedó cancelado, no eliminado"
        : "Ingreso eliminado",
    );
    setOpen(false);
    startTransition(() => router.refresh());
  };

  const isConsignment = form.kind === "consignment";
  const isPurchase = form.kind === "purchase";

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => {
            setForm(toForm(acquisition, defaultCommission));
            setOpen(true);
          }}
          aria-label={`Editar ingreso de ${acquisition!.plate}`}
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
          Recibir vehículo
        </button>
      )}

      <FormDialog
        open={open}
        title={isEdit ? "Editar ingreso" : "Recibir un vehículo"}
        description="Con estos datos se emite el contrato que firmas con el dueño."
        submitLabel={isEdit ? "Guardar cambios" : "Registrar ingreso"}
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      >
        <FormField label="Modalidad" hint={KINDS.find((k) => k.value === form.kind)?.hint}>
          <select value={form.kind} onChange={(e) => update("kind", e.target.value)} className={fieldInputClass}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </FormField>

        <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Quién entrega el auto
        </p>
        <FormField label="Nombre" required>
          <input value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} className={fieldInputClass} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="RUT">
            <input value={form.ownerRut} onChange={(e) => update("ownerRut", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="Teléfono">
            <input type="tel" value={form.ownerPhone} onChange={(e) => update("ownerPhone", e.target.value)} className={fieldInputClass} />
          </FormField>
        </div>
        <FormField label="Domicilio" hint="Va en el contrato para individualizar a la parte.">
          <input value={form.ownerAddress} onChange={(e) => update("ownerAddress", e.target.value)} className={fieldInputClass} />
        </FormField>

        <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          El vehículo
        </p>
        <FormField label="Patente" required>
          <input
            value={form.plate}
            onChange={(e) => update("plate", e.target.value.toUpperCase())}
            className={`${fieldInputClass} font-mono uppercase`}
            placeholder="ABCD12"
          />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Marca">
            <input value={form.brand} onChange={(e) => update("brand", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="Modelo">
            <input value={form.model} onChange={(e) => update("model", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="Año">
            <input type="number" value={form.year} onChange={(e) => update("year", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="Color">
            <input value={form.color} onChange={(e) => update("color", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="N° de chasis (VIN)">
            <input value={form.vin} onChange={(e) => update("vin", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="N° de motor">
            <input value={form.engineNumber} onChange={(e) => update("engineNumber", e.target.value)} className={fieldInputClass} />
          </FormField>
        </div>
        <FormField label="Kilometraje al recibirlo" hint="Queda registrado en el contrato.">
          <input type="number" value={form.mileage} onChange={(e) => update("mileage", e.target.value)} className={fieldInputClass} />
        </FormField>

        <p className="pt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          Lo acordado
        </p>
        {isConsignment && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Precio mínimo (CLP)" required hint="Bajo este monto no puedes cerrar sin autorización.">
              <input type="number" value={form.minPrice} onChange={(e) => update("minPrice", e.target.value)} className={fieldInputClass} />
            </FormField>
            <FormField label="Comisión (%)">
              <input type="number" step="0.1" min={0} max={100} value={form.commissionPct} onChange={(e) => update("commissionPct", e.target.value)} className={fieldInputClass} />
            </FormField>
          </div>
        )}
        {isPurchase && (
          <FormField label="Precio que le pagas (CLP)" required>
            <input type="number" value={form.purchasePrice} onChange={(e) => update("purchasePrice", e.target.value)} className={fieldInputClass} />
          </FormField>
        )}
        {!isConsignment && !isPurchase && (
          <FormField label="Valor asignado (CLP)" hint="Se imputa como parte de pago del otro vehículo.">
            <input type="number" value={form.minPrice} onChange={(e) => update("minPrice", e.target.value)} className={fieldInputClass} />
          </FormField>
        )}

        {isConsignment && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Desde">
              <input type="date" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} className={fieldInputClass} />
            </FormField>
            <FormField label="Hasta">
              <input type="date" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} className={fieldInputClass} />
            </FormField>
          </div>
        )}

        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.freeOfEncumbrances}
            onChange={(e) => update("freeOfEncumbrances", e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            El dueño declara que el vehículo no tiene prenda ni gravamen.
            <span className="block text-[var(--muted-foreground)]">
              Si la tiene, desmarca: el contrato dirá que se obliga a alzarla antes de vender.
            </span>
          </span>
        </label>

        <FormField label="Observaciones">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            className={`${fieldInputClass} resize-none`}
            placeholder="Estado, mantenciones, juegos de llaves…"
          />
        </FormField>

        {isEdit && canDelete && (
          <div className="border-t border-[var(--border)] pt-3">
            <DeleteButton
              label="Eliminar ingreso"
              question="¿Eliminar este ingreso? Si el contrato ya se emitió, quedará cancelado en vez de borrarse."
              onDelete={remove}
            />
          </div>
        )}
      </FormDialog>
    </>
  );
}

/** Abre el contrato en una pestaña nueva, listo para imprimir y firmar. */
export function ContractLink({ acquisitionId, issued }: { acquisitionId: string; issued: boolean }) {
  return (
    <a
      href={`/api/crm/acquisitions/${acquisitionId}/contract`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs transition-colors hover:border-[var(--primary)]"
    >
      <FileText className="h-3.5 w-3.5" />
      {issued ? "Ver contrato" : "Emitir contrato"}
    </a>
  );
}
