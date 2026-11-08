"use client";

/**
 * Equipo del proveedor, agrupado por sucursal. Todos menos "Solo lectura" publican unidades
 * y negocian con las automotoras; dueño/administrador/supervisor además invitan, cambian el
 * rol o la sucursal y (sólo dueño/administrador) retiran personas. El backend valida todo
 * igual (`wholesale/api/supplier_team_router.py`).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, UserPlus } from "lucide-react";

import { DeleteButton, FormDialog, FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { EmptyState, Panel, Pill } from "@/components/ui/primitives";
import {
  SUPPLIER_ROLES, SUPPLIER_ROLE_LABEL, type SupplierLocation, type SupplierMember, type SupplierRole, type SupplierTeam,
} from "@/lib/wholesale";
import { wholesaleRequest } from "@/lib/wholesale-upload";

const NO_BRANCH = "__none__";

export function SupplierTeamManager({ team, myUserId }: { team: SupplierTeam; myUserId: string }) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", phone: "", role: "salesperson" as SupplierRole, locationId: "" });
  const activeLocations = team.locations.filter((l) => l.isActive);
  const assignable = SUPPLIER_ROLES.filter(([role]) => team.canGrantAdmin || !["owner", "admin"].includes(role));

  const groups: { location: SupplierLocation | null; members: SupplierMember[] }[] = [
    ...team.locations.map((location) => ({ location, members: team.members.filter((m) => m.locationId === location.id) })),
    { location: null, members: team.members.filter((m) => !m.locationId) },
  ].filter((g) => g.members.length > 0 || (g.location?.isActive ?? false));

  const call = async (fn: () => Promise<unknown>, success: string) => {
    try {
      await fn();
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos completar la operación.");
      throw error;
    }
  };

  const invite = async () => {
    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Completa correo, nombre y apellido.");
      return;
    }
    setSaving(true);
    try {
      const data = await wholesaleRequest<{ invited: boolean }>("/api/proveedor/team/members", "POST", {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        locationId: form.locationId || undefined,
      });
      toast.success(data.invited ? "Invitación enviada: le llega un correo para crear su contraseña." : "Agregado al equipo.");
      setInviting(false);
      setForm({ email: "", firstName: "", lastName: "", phone: "", role: "salesperson", locationId: "" });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos invitar a la persona.");
    } finally {
      setSaving(false);
    }
  };

  const update = (member: SupplierMember, body: Record<string, unknown>, success: string) =>
    call(() => wholesaleRequest(`/api/proveedor/team/members/${member.id}`, "PATCH", body), success).catch(() => undefined);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted-foreground)]">
          {team.members.length} persona(s) · {team.locations.filter((l) => l.isActive).length} sucursal(es) activa(s)
        </p>
        {team.canManage && (
          <button onClick={() => setInviting(true)}
            className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">
            <UserPlus className="h-4 w-4" /> Invitar persona
          </button>
        )}
      </div>

      <div className="space-y-4">
        {groups.map(({ location, members }) => (
          <Panel key={location?.id ?? NO_BRANCH}
            title={location ? location.name : "Sin sucursal asignada"}
            subtitle={location ? [location.address, location.commune].filter(Boolean).join(", ") || undefined
              : "Asígnales una sucursal para organizar el equipo."}
            action={location && !location.isActive ? <Pill variant="neutral">Inactiva</Pill> : location?.isMain ? <Pill variant="info">Principal</Pill> : undefined}>
            {members.length === 0 ? (
              <EmptyState icon={<Building2 className="h-6 w-6" />} title="Nadie en esta sucursal" description="Invita a alguien o mueve a una persona del equipo." />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {members.map((member) => {
                  const me = member.userId === myUserId;
                  const elevated = ["owner", "admin"].includes(member.role);
                  // Rol y retiro: nunca sobre uno mismo. Sucursal: también la propia.
                  const canEdit = team.canManage && !me && (team.canGrantAdmin || !elevated);
                  const canMove = team.canManage && (me || canEdit);
                  return (
                    <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--fm-navy)] text-xs font-semibold text-white">
                        {member.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{member.name}{me && <span className="ml-1.5 text-xs font-normal text-[var(--muted-foreground)]">(tú)</span>}</p>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
                          {[member.email, member.phone, `${member.listingCount} unidad(es) activa(s)`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {canMove ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {canEdit ? (
                            <select value={member.role} aria-label="Rol"
                              onChange={(e) => update(member, { role: e.target.value }, "Rol actualizado.")}
                              className={`${fieldInputClass} h-9 w-auto py-1 text-xs`}>
                              {(elevated ? SUPPLIER_ROLES : assignable).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                            </select>
                          ) : (
                            <Pill variant="info">{SUPPLIER_ROLE_LABEL[member.role] ?? member.role}</Pill>
                          )}
                          <select value={member.locationId ?? NO_BRANCH} aria-label="Sucursal"
                            onChange={(e) => update(member,
                              e.target.value === NO_BRANCH ? { clearLocation: true } : { locationId: e.target.value },
                              "Sucursal actualizada.")}
                            className={`${fieldInputClass} h-9 w-auto py-1 text-xs`}>
                            <option value={NO_BRANCH}>Sin sucursal</option>
                            {activeLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                          {canEdit && team.canGrantAdmin && (
                            <DeleteButton compact label="Retirar" confirmLabel="Retirar"
                              question={`¿Retirar a ${member.name} del equipo? Pierde el acceso al portal; sus unidades y negociaciones se conservan.`}
                              onDelete={() => call(() => wholesaleRequest(`/api/proveedor/team/members/${member.id}`, "DELETE"), "Persona retirada del equipo.")} />
                          )}
                        </div>
                      ) : (
                        <Pill variant={member.role === "viewer" ? "neutral" : "info"}>{SUPPLIER_ROLE_LABEL[member.role] ?? member.role}</Pill>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        ))}
      </div>

      <div className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="mb-2 text-sm font-semibold">Qué puede hacer cada rol</p>
        <ul className="grid gap-1.5 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
          {SUPPLIER_ROLES.map(([value, label, hint]) => (
            <li key={value}><span className="font-medium text-[var(--foreground)]">{label}:</span> {hint}.</li>
          ))}
        </ul>
      </div>

      <FormDialog open={inviting} title="Invitar persona al equipo"
        description="Le llega un correo con un enlace para crear su contraseña y entrar al portal."
        submitLabel="Enviar invitación" saving={saving} onClose={() => setInviting(false)} onSubmit={invite}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Nombre" required>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={fieldInputClass} />
            </FormField>
            <FormField label="Apellido" required>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={fieldInputClass} />
            </FormField>
          </div>
          <FormField label="Correo" required>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldInputClass} />
          </FormField>
          <FormField label="Teléfono">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldInputClass} placeholder="+56 9 1234 5678" />
          </FormField>
          <FormField label="Rol" hint={SUPPLIER_ROLES.find(([r]) => r === form.role)?.[2]}>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as SupplierRole })} className={fieldInputClass}>
              {assignable.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
          <FormField label="Sucursal">
            <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} className={fieldInputClass}>
              <option value="">Sin sucursal</option>
              {activeLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FormField>
        </div>
      </FormDialog>
    </>
  );
}
