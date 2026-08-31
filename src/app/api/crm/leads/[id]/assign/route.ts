import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

/**
 * POST /api/crm/leads/{id}/assign — proxy autenticado a
 * `POST /backoffice/team/leads/{id}/assign`.
 *
 * Doble control: aquí se exige rol administrativo del CRM (admin/supervisor) y el backend
 * vuelve a verificar pertenencia del lead y rol en la organización. El primero es de
 * usabilidad; el que manda es el del backend.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Solo el administrador o el supervisor pueden reasignar solicitudes" },
      { status: 403 },
    );
  }

  const { id } = await params;
  let body: { assignedTo?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/team/leads/${id}/assign`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ assignedTo: body.assignedTo || null }),
  });
  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data?.detail || "No pudimos reasignar la solicitud" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, lead: data?.lead ?? null });
}
