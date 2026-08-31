import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { isDealershipAdmin, requireCrmApiSession } from "@/lib/auth/session";

/**
 * DELETE /api/crm/team/members/{id} — retira a una persona del equipo.
 * Exclusivo del administrador de la automotora. No borra el perfil: quita el acceso y deja
 * sus leads abiertos sin responsable para repartirlos.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isDealershipAdmin(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador de la automotora puede retirar personas del equipo" },
      { status: 403 },
    );
  }
  const { id } = await params;

  const upstream = await apiFetch(`/backoffice/team/members/${id}`, { method: "DELETE", auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      only_dealership_admin_can_delete: "Sólo el administrador de la automotora puede retirar personas",
      cannot_remove_yourself: "No puedes retirarte a ti mismo",
      member_out_of_scope: "Esa persona no es de tu automotora",
      member_not_found: "Esa persona ya no está en el equipo",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos retirar a la persona" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, unassignedLeads: data?.unassignedLeads ?? 0 });
}
