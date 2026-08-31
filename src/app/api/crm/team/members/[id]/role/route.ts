import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

/** PATCH /api/crm/team/members/{id}/role — cambia el rol de un miembro. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador o el supervisor pueden cambiar roles" },
      { status: 403 },
    );
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/team/members/${id}/role`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      invalid_role: "Ese rol no existe",
      cannot_grant_admin_role: "Sólo el dueño puede nombrar administradores",
      cannot_demote_yourself: "No puedes quitarte a ti mismo el rol de administrador",
      insufficient_org_role: "No tienes permiso para cambiar roles",
      member_out_of_scope: "Esa persona no es de tu automotora",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos cambiar el rol" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, member: data?.member ?? null });
}
