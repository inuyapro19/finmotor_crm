"use client";

/**
 * Alta, cambio de rol y baja de personas del equipo.
 *
 * Invitar crea la cuenta del agente y el backend le envía el correo de acceso; si no llega,
 * se muestra la contraseña temporal una sola vez para poder dictarla.
 *
 * Retirar a alguien es exclusivo del administrador de la automotora, **no borra su perfil** y
 * deja sus leads abiertos sin responsable para que el supervisor los reparta — el aviso lo
 * dice antes de confirmar.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { DeleteButton, FormDialog, FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { CRM_ROLE_LABEL, toCrmRole } from "@/lib/auth/roles";

/** Roles que la automotora reparte a diario. Los operativos se dejan fuera del selector. */
const ROLES = [
  { value: "salesperson", label: "Agente de ventas", hint: "Ve y trabaja sólo su cartera" },
  { value: "manager", label: "Supervisor", hint: "Ve todo el equipo, reasigna y edita" },
  { value: "admin", label: "Administrador", hint: "Todo, incluido eliminar" },
  { value: "viewer", label: "Sólo lectura", hint: "Consulta sin modificar" },
];

export function NewMember() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    rut: "",
    role: "salesperson",
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    if (!form.email.trim()) {
      toast.error("Falta el correo");
      return;
    }
    setSaving(true);
    try {
      const res = await crmFetch("/api/crm/team/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          phone: form.phone.trim() || null,
          rut: form.rut.trim() || null,
          role: form.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos crear la cuenta");
        return;
      }
      toast.success("Cuenta creada. Le enviamos el acceso por correo.");
      if (data?.tempPassword) {
        setTempPassword(String(data.tempPassword));
      } else {
        setOpen(false);
      }
      setForm({ firstName: "", lastName: "", email: "", phone: "", rut: "", role: "salesperson" });
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para crear la cuenta");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setTempPassword(null);
          setOpen(true);
        }}
        className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-white"
      >
        <UserPlus className="h-4 w-4" />
        Invitar persona
      </button>

      <FormDialog
        open={open && !tempPassword}
        title="Invitar a alguien al equipo"
        description="Le creamos su cuenta y le mandamos el acceso por correo."
        submitLabel="Crear cuenta"
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nombre">
            <input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="Apellido">
            <input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={fieldInputClass} />
          </FormField>
        </div>

        <FormField label="Correo" required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={fieldInputClass}
            placeholder="agente@tuautomotora.cl"
          />
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Teléfono">
            <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} className={fieldInputClass} />
          </FormField>
          <FormField label="RUT">
            <input value={form.rut} onChange={(e) => update("rut", e.target.value)} className={fieldInputClass} />
          </FormField>
        </div>

        <FormField label="Rol" hint={ROLES.find((r) => r.value === form.role)?.hint}>
          <select value={form.role} onChange={(e) => update("role", e.target.value)} className={fieldInputClass}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </FormField>
      </FormDialog>

      {/* La contraseña temporal se muestra UNA vez: después ya no se puede recuperar. */}
      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--card)] p-5">
            <h2 className="text-base font-semibold">Cuenta creada</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Le enviamos el acceso por correo. Si no le llega, dictale esta contraseña
              temporal — no la vas a poder ver de nuevo.
            </p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(tempPassword);
                  toast.success("Contraseña copiada");
                } catch {
                  toast.error("No pudimos copiar");
                }
              }}
              className="mt-3 flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2.5 font-mono text-sm"
            >
              {tempPassword}
              <Copy className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            </button>
            <button
              onClick={() => {
                setTempPassword(null);
                setOpen(false);
              }}
              className="mt-3 w-full rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function MemberActions({
  memberId,
  name,
  role,
  isSelf,
  canDelete,
}: {
  memberId: string;
  name: string;
  role: string;
  isSelf: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nextRole, setNextRole] = useState(role);
  const [, startTransition] = useTransition();

  const submit = async () => {
    if (nextRole === role) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await crmFetch(`/api/crm/team/members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos cambiar el rol");
        return;
      }
      toast.success(`${name} ahora es ${CRM_ROLE_LABEL[toCrmRole(nextRole)]}`);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para cambiar el rol");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    let res: Response;
    try {
      res = await crmFetch(`/api/crm/team/members/${memberId}`, { method: "DELETE" });
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para retirar a la persona");
      if (message) toast.error(message);
      throw error;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "No pudimos retirar a la persona");
      throw new Error(data?.error || "No pudimos retirar a la persona");
    }
    const freed = Number(data?.unassignedLeads ?? 0);
    toast.success(
      freed > 0
        ? `${name} salió del equipo. ${freed} ${freed === 1 ? "solicitud quedó" : "solicitudes quedaron"} sin responsable.`
        : `${name} salió del equipo`,
    );
    setOpen(false);
    startTransition(() => router.refresh());
  };

  return (
    <>
      <button
        onClick={() => {
          setNextRole(role);
          setOpen(true);
        }}
        aria-label={`Editar ${name}`}
        className="rounded-[var(--radius-md)] border border-[var(--border)] p-1.5 text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--foreground)]"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <FormDialog
        open={open}
        title={name}
        description="Cambia su rol o retírala del equipo."
        submitLabel="Guardar rol"
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={submit}
      >
        <FormField label="Rol" hint={ROLES.find((r) => r.value === nextRole)?.hint}>
          <select value={nextRole} onChange={(e) => setNextRole(e.target.value)} className={fieldInputClass}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
            {/* Roles operativos que existen pero no se reparten desde aquí. */}
            {!ROLES.some((r) => r.value === role) && <option value={role}>{CRM_ROLE_LABEL[toCrmRole(role)]}</option>}
          </select>
        </FormField>

        {canDelete && !isSelf && (
          <div className="border-t border-[var(--border)] pt-3">
            <DeleteButton
              label="Retirar del equipo"
              confirmLabel="Retirar"
              question={`¿Retirar a ${name}? Pierde el acceso al CRM y sus solicitudes abiertas quedan sin responsable para que las repartas. Su historial se conserva.`}
              onDelete={remove}
            />
          </div>
        )}
        {isSelf && (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Es tu propia cuenta: no puedes retirarte ni quitarte el rol de administrador.
          </p>
        )}
      </FormDialog>
    </>
  );
}
