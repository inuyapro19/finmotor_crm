import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

/**
 * POST /api/crm/leads/{id}/activities — registra el resultado de un contacto.
 * Puede avanzar la etapa en el mismo gesto: llamar y mover a "contactado" es una sola acción
 * para el agente, no dos.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/leads/${id}/activities`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
      invalid_activity_type: "Ese tipo de registro no existe",
      invalid_stage: "Esa etapa no existe",
      lead_stage_cannot_move_backwards: "La gestión no puede devolver la solicitud a una etapa anterior",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos guardar el registro" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, activity: data?.activity ?? null, lead: data?.lead ?? null });
}
