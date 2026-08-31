"use client";

/**
 * Datos de la automotora. No es una ficha decorativa: razón social, RUT, domicilio y
 * representante legal son exactamente los campos que necesita el contrato de consignación
 * para individualizar a la parte vendedora.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { Organization } from "@/lib/data/crm";

export function OrganizationForm({ organization }: { organization: Organization }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: organization.name ?? "",
    legalName: organization.legalName ?? "",
    rut: organization.rut ?? "",
    address: organization.address ?? "",
    commune: organization.commune ?? "",
    phone: organization.phone ?? "",
    email: organization.email ?? "",
    website: organization.website ?? "",
    legalRepresentative: organization.legalRepresentative ?? "",
    legalRepresentativeRut: organization.legalRepresentativeRut ?? "",
    powerDate: organization.powerDate ?? "",
    powerDocumentType: organization.powerDocumentType ?? "",
    notaryOffice: organization.notaryOffice ?? "",
    notaryName: organization.notaryName ?? "",
    defaultCommissionPct:
      organization.defaultCommissionPct !== null && organization.defaultCommissionPct !== undefined
        ? String(organization.defaultCommissionPct)
        : "",
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const commission = form.defaultCommissionPct.trim();
    if (commission && (Number.isNaN(Number(commission)) || Number(commission) < 0 || Number(commission) > 100)) {
      toast.error("La comisión debe ser un número entre 0 y 100");
      return;
    }

    setSaving(true);
    try {
      const res = await crmFetch(`/api/crm/organizations/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          legalName: form.legalName.trim(),
          rut: form.rut.trim(),
          address: form.address.trim(),
          commune: form.commune.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          website: form.website.trim(),
          legalRepresentative: form.legalRepresentative.trim(),
          legalRepresentativeRut: form.legalRepresentativeRut.trim(),
          powerDate: form.powerDate.trim(),
          powerDocumentType: form.powerDocumentType.trim(),
          notaryOffice: form.notaryOffice.trim(),
          notaryName: form.notaryName.trim(),
          defaultCommissionPct: commission ? Number(commission) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos guardar los cambios");
        return;
      }
      toast.success("Datos guardados");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para guardar los cambios");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre comercial">
          <input value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Razón social">
          <input
            value={form.legalName}
            onChange={(e) => update("legalName", e.target.value)}
            className={inputClass}
            placeholder="Demo Motors SpA"
          />
        </Field>
        <Field label="RUT de la empresa">
          <input
            value={form.rut}
            onChange={(e) => update("rut", e.target.value)}
            className={inputClass}
            placeholder="76.123.456-7"
          />
        </Field>
        <Field label="Teléfono">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Domicilio legal">
          <input value={form.address} onChange={(e) => update("address", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Comuna">
          <input value={form.commune} onChange={(e) => update("commune", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Correo">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Sitio web">
          <input
            value={form.website}
            onChange={(e) => update("website", e.target.value)}
            className={inputClass}
            placeholder="https://"
          />
        </Field>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
        <p className="mb-2 text-xs font-medium">Para los contratos</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Representante legal">
            <input
              value={form.legalRepresentative}
              onChange={(e) => update("legalRepresentative", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="RUT del representante">
            <input
              value={form.legalRepresentativeRut}
              onChange={(e) => update("legalRepresentativeRut", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Fecha del poder">
            <input type="date" value={form.powerDate} onChange={(e) => update("powerDate", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Tipo de poder">
            <input value={form.powerDocumentType} onChange={(e) => update("powerDocumentType", e.target.value)} className={inputClass} placeholder="Escritura pública" />
          </Field>
          <Field label="Notaría">
            <input value={form.notaryOffice} onChange={(e) => update("notaryOffice", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Nombre del notario">
            <input value={form.notaryName} onChange={(e) => update("notaryName", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Comisión de consignación (%)">
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.defaultCommissionPct}
              onChange={(e) => update("defaultCommissionPct", e.target.value)}
              className={inputClass}
              placeholder="8.5"
            />
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          El poder y la notaría individualizan al comprador legal ante el proveedor de transferencias.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 outline-none focus:border-[var(--primary)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
