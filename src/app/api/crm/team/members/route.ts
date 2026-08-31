import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

/** POST /api/crm/team/members — invita a un agente. El backend le manda el correo de acceso. */
export async function POST(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador o el supervisor pueden invitar personas" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch("/backoffice/team/members", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ organizationId: session.dealership.id, ...body }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      email_required: "Falta el correo",
      role_required: "Falta el rol",
      invalid_role: "Ese rol no existe",
      cannot_grant_admin_role: "Sólo el dueño puede nombrar administradores",
      insufficient_org_role: "No tienes permiso para invitar personas",
      organization_out_of_scope: "Esa automotora no es tuya",
      temporary_password_too_short: "La contraseña temporal es muy corta",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos crear la cuenta" },
      { status: upstream.status },
    );
  }
  // `tempPassword` sólo viene cuando la persona no tenía cuenta; se muestra una vez para que
  // el administrador se la pueda dictar si el correo no llega.
  return NextResponse.json({ ok: true, member: data?.member ?? null, tempPassword: data?.tempPassword ?? null });
}
