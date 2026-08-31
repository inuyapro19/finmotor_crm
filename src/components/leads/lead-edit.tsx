"use client";

/**
 * Editar los datos del cliente y, para el administrador, eliminar la solicitud.
 *
 * Corregir el teléfono es lo más frecuente: se anota mal en el mostrador y sin eso el agente
 * no puede llamar. Eliminar es para duplicados y errores de carga; lo habitual cuando una
 * venta se cae es marcarla perdida con motivo, que conserva la información.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { DeleteButton, FormDialog, FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { Lead } from "@/lib/leads";

export function LeadEdit({ lead, canDelete }: { lead: Lead; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    contactName: lead.contactName === "Sin nombre" ? "" : lead.contactName,
    contactPhone: lead.contactPhone ?? "",
    contactEmail: lead.contactEmail ?? "",
    contactRut: lead.contactRut ?? "",
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!form.contactName.trim()) {
      toast.error("Falta el nombre del cliente");
      return;
    }
    if (!form.contactPhone.trim() && !form.contactEmail.trim()) {
      toast.error("Necesitas al menos un teléfono o un correo para poder contactarlo");
      return;
    }
    setSaving(true);
    try {
      const res = await crmFetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
          contactRut: form.contactRut.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos guardar los cambios");
        return;
      }
      toast.success("Datos actualizados");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    let res: Response;
    try {
      res = await crmFetch(`/api/crm/leads/${lead.id}`, { method: "DELETE" });
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
      throw error;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error || "No pudimos eliminar la solicitud";
      toast.error(message);
      throw new Error(message);
    }
    toast.success("Solicitud eliminada");
    router.push("/solicitudes");
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs"
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar
      </button>

      <FormDialog
        open={open}
        title="Datos del cliente"
        description="Corrige lo que se haya anotado mal."
        submitLabel="Guardar"
        saving={saving || pending}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      >
        <FormField label="Nombre" required>
          <input
            value={form.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            className={fieldInputClass}
          />
        </FormField>
        <FormField label="Teléfono" hint="Sin esto no puedes llamarlo.">
          <input
            type="tel"
            inputMode="tel"
            value={form.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            className={fieldInputClass}
          />
        </FormField>
        <FormField label="Correo">
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            className={fieldInputClass}
          />
        </FormField>
        <FormField label="RUT" hint="Útil si va a pedir financiamiento.">
          <input
            value={form.contactRut}
            onChange={(e) => update("contactRut", e.target.value)}
            className={fieldInputClass}
          />
        </FormField>

        {canDelete && (
          <div className="border-t border-[var(--border)] pt-3">
            <DeleteButton
              label="Eliminar solicitud"
              question="¿Eliminar esta solicitud y todo su historial? Si la venta se cayó, es mejor marcarla como perdida con el motivo: así queda el registro."
              onDelete={remove}
            />
          </div>
        )}
      </FormDialog>
    </>
  );
}
