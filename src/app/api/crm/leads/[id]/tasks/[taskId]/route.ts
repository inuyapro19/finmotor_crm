import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const ERROR_MAP: Record<string, string> = {
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  task_not_found: "Esa tarea ya no existe",
  task_title_required: "Escribe qué hay que hacer",
  invalid_priority: "Esa prioridad no existe",
  invalid_task_status: "Ese estado no existe",
  cannot_assign_to_others: "No puedes asignar tareas a otro agente",
  assignee_not_in_organization: "Ese responsable no pertenece a la automotora",
};

/**
 * PATCH /api/crm/leads/{id}/tasks/{taskId} — completa, cancela, reagenda o reasigna una tarea.
 * Recalcula `nextActionAt` del lead en el mismo gesto.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id, taskId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/leads/${id}/tasks/${taskId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos actualizar la tarea" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, task: data?.task ?? null, lead: data?.lead ?? null });
}
