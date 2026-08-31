import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

/** PATCH /api/crm/organizations/{id} — datos de la automotora (alimentan los contratos). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador o el supervisor pueden editar la automotora" },
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

  const upstream = await apiFetch(`/backoffice/organizations/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      insufficient_org_role: "No tienes permiso para editar esta automotora",
      organization_out_of_scope: "Esa automotora no es tuya",
      invalid_commission_pct: "La comisión debe estar entre 0 y 100",
      name_required: "El nombre no puede quedar vacío",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos guardar los cambios" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, organization: data?.organization ?? null });
}
