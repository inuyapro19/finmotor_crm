"use client";

/**
 * Alta manual de una solicitud: el cliente que llegó al local o llamó por teléfono.
 *
 * Es el caso más frecuente de una automotora chilena y hasta ahora no había forma de
 * registrarlo. Se pide lo mínimo —nombre y una vía de contacto— porque el agente lo llena
 * con el cliente delante.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";

const SOURCES = [
  { value: "walk_in", label: "Llegó al local" },
  { value: "phone", label: "Llamada entrante" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "referral", label: "Referido" },
  { value: "manual", label: "Otro" },
];

export function NewLead() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    contactRut: "",
    source: "walk_in",
    note: "",
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contactName.trim()) {
      toast.error("Falta el nombre del cliente");
      return;
    }
    if (!form.contactPhone.trim() && !form.contactEmail.trim()) {
      toast.error("Necesitas un teléfono o un correo para poder contactarlo");
      return;
    }

    setSaving(true);
    try {
      const res = await crmFetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactRut: form.contactRut.trim() || null,
          source: form.source,
          note: form.note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos crear la solicitud");
        return;
      }
      toast.success("Solicitud creada");
      setForm({ contactName: "", contactPhone: "", contactEmail: "", contactRut: "", source: "walk_in", note: "" });
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={pending}
        className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-white"
      >
        <Plus className="h-4 w-4" />
        Nueva solicitud
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--card)] p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Nueva solicitud</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Para el cliente que llegó al local o llamó.
            </p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Nombre" required>
            <input
              value={form.contactName}
              onChange={(e) => update("contactName", e.target.value)}
              autoFocus
              className={inputClass}
              placeholder="Rodrigo Soto"
            />
          </Field>

          <Field label="Teléfono">
            <input
              type="tel"
              inputMode="tel"
              value={form.contactPhone}
              onChange={(e) => update("contactPhone", e.target.value)}
              className={inputClass}
              placeholder="+56 9 8765 4321"
            />
          </Field>

          <Field label="Correo">
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              className={inputClass}
              placeholder="opcional"
            />
          </Field>

          <Field label="RUT">
            <input
              value={form.contactRut}
              onChange={(e) => update("contactRut", e.target.value)}
              className={inputClass}
              placeholder="opcional — útil si va a pedir financiamiento"
            />
          </Field>

          <Field label="¿Cómo llegó?">
            <select
              value={form.source}
              onChange={(e) => update("source", e.target.value)}
              className={inputClass}
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nota">
            <textarea
              rows={2}
              value={form.note}
              onChange={(e) => update("note", e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="Qué auto busca, presupuesto, si necesita financiamiento…"
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || pending}
              className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear solicitud
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 outline-none focus:border-[var(--primary)]";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">
        {label}
        {required && <span className="text-[var(--primary)]"> *</span>}
      </span>
      {children}
    </label>
  );
}
