import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import {
  CRM_ROLE_LABEL,
  canManageTeam,
  isDealershipAdmin,
  requireCrmSession,
  toCrmRole,
} from "@/lib/auth/session";
import { getLeads, getTeamMembers } from "@/lib/data/crm";
import { fmtDate } from "@/lib/format";
import { isOpen } from "@/lib/leads";
import { EmptyState, Notice, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { MemberActions, NewMember } from "@/components/team/member-actions";

/**
 * Equipo de la automotora. Sólo administrador y supervisor.
 *
 * Muestra la carga de trabajo real por agente —solicitudes abiertas y sin contactar— porque
 * es lo que un supervisor necesita para repartir: no el organigrama, sino quién está tapado.
 */
export default async function TeamPage() {
  const session = await requireCrmSession();
  if (!canManageTeam(session.role)) redirect("/");

  const [members, leads] = await Promise.all([getTeamMembers(session), getLeads(session)]);

  const workload = new Map<string, { open: number; uncontacted: number }>();
  for (const lead of leads) {
    if (!lead.assignedTo) continue;
    const current = workload.get(lead.assignedTo) ?? { open: 0, uncontacted: 0 };
    if (isOpen(lead)) current.open += 1;
    if (lead.stage === "new") current.uncontacted += 1;
    workload.set(lead.assignedTo, current);
  }

  const unassigned = leads.filter((l) => !l.assignedTo && isOpen(l)).length;
  const active = members.filter((m) => m.isActive);

  return (
    <>
      <PageHeader
        title="Equipo"
        subtitle={`${active.length} ${active.length === 1 ? "persona activa" : "personas activas"} en ${session.dealership.name}`}
        action={<NewMember />}
      />

      {unassigned > 0 && (
        <div className="mb-4">
          <Notice tone="warn">
            Hay {unassigned} {unassigned === 1 ? "solicitud abierta" : "solicitudes abiertas"} sin
            responsable. Asígnalas desde la ficha de cada una para que alguien las llame.
          </Notice>
        </div>
      )}

      <Panel title="Personas" subtitle="Carga de trabajo actual">
        {members.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Sin miembros visibles"
            description="Los agentes que se sumen a tu automotora aparecerán aquí."
          />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {members.map((m) => {
              const load = (m.userId && workload.get(m.userId)) || { open: 0, uncontacted: 0 };
              const role = toCrmRole(String(m.role ?? ""));
              return (
                <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-xs font-semibold text-[var(--muted-foreground)]">
                    {(m.name || m.email || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{m.name || "Sin nombre"}</p>
                      <Pill>{CRM_ROLE_LABEL[role]}</Pill>
                      {!m.isActive && <Pill variant="danger">Inactivo</Pill>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                      {m.email ?? "Sin correo"} · desde {fmtDate(m.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{load.open}</p>
                      <p className="text-[10px] text-[var(--muted-foreground)]">
                        abiertas
                        {load.uncontacted > 0 && ` · ${load.uncontacted} sin llamar`}
                      </p>
                    </div>
                    <MemberActions
                      memberId={m.id}
                      name={m.name || m.email || "Sin nombre"}
                      role={String(m.role ?? "salesperson")}
                      isSelf={m.userId === session.userId}
                      canDelete={isDealershipAdmin(session.role)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <p className="mt-3 text-[11px] text-[var(--muted-foreground)]">
        Retirar a alguien del equipo le quita el acceso pero conserva su historial, y deja sus
        solicitudes abiertas sin responsable para que las repartas.
      </p>
    </>
  );
}

export const dynamic = "force-dynamic";
