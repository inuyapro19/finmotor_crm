"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, MapPin } from "lucide-react";
import { toast } from "sonner";

import { FormDialog, FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { fmtCLP } from "@/lib/format";

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function defaultSchedule() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setHours(10, 0, 0, 0);
  return localDateTime(value);
}

export function PrepurchaseVisitDialog({
  initialPlate = "",
  leadId,
  compact = false,
}: {
  initialPlate?: string;
  leadId?: string;
  compact?: boolean;
} = {}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plate, setPlate] = useState(initialPlate);
  const [scheduledFor, setScheduledFor] = useState("");
  const [notes, setNotes] = useState("");

  const show = () => {
    setPlate(initialPlate);
    if (!scheduledFor) setScheduledFor(defaultSchedule());
    setOpen(true);
  };

  const submit = async () => {
    const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const date = new Date(scheduledFor);
    if (!normalizedPlate) {
      toast.error("Ingresa una patente válida");
      return;
    }
    if (!scheduledFor || Number.isNaN(date.getTime()) || date <= new Date()) {
      toast.error("Selecciona una fecha y hora futuras");
      return;
    }

    setSaving(true);
    try {
      const response = await crmFetch("/api/crm/prepurchase-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: normalizedPlate,
          scheduledFor: date.toISOString(),
          notes: notes.trim() || null,
          leadId: leadId ?? null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos agendar la visita");
        return;
      }
      const branch = data?.visit?.location?.name;
      toast.success(branch ? `Visita agendada en ${branch}` : "Visita de precompra agendada");
      setOpen(false);
      setPlate(initialPlate);
      setScheduledFor("");
      setNotes("");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para agendar la visita");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          show();
        }}
        className={compact
          ? "inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-[11px] font-medium text-[var(--primary)]"
          : "flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-white"}
      >
        <CalendarPlus className="h-4 w-4" />
        {compact ? "Precompra" : "Agendar visita"}
      </button>

      <FormDialog
        open={open}
        title="Agendar informe de precompra"
        description="La unidad debe estar en una sucursal activa de la automotora."
        submitLabel="Agendar visita"
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={() => void submit()}
      >
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--muted)] p-3">
          <MapPin className="h-5 w-5 shrink-0 text-[var(--primary)]" />
          <div>
            <p className="text-xs font-medium">Servicio postpago</p>
            <p className="text-sm font-semibold">{fmtCLP(49_990)} por inspección</p>
          </div>
        </div>

        <FormField
          label="Patente"
          required
          hint="Se validará que pertenezca al inventario y tenga una sucursal activa."
        >
          <input
            value={plate}
            onChange={(event) => setPlate(event.target.value.toUpperCase())}
            className={`${fieldInputClass} font-mono uppercase`}
            placeholder="ABCD12"
            maxLength={10}
            autoFocus
          />
        </FormField>
        <FormField label="Fecha y hora" required>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
            className={fieldInputClass}
          />
        </FormField>
        <FormField label="Indicaciones" hint="Opcional. Se entregan al equipo que realizará la inspección.">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={`${fieldInputClass} min-h-24 resize-y`}
            maxLength={1000}
            placeholder="Ej.: revisar ruido en tren delantero"
          />
        </FormField>
        <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          La sucursal y su dirección se toman automáticamente del ingreso vigente del vehículo.
        </p>
      </FormDialog>
    </>
  );
}
