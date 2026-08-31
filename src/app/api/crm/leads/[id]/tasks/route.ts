import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const ERROR_MAP: Record<string, string> = {
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  task_title_required: "Escribe qué hay que hacer",
  invalid_priority: "Esa prioridad no existe",
  cannot_assign_to_others: "No puedes asignar tareas a otro agente",
  assignee_not_in_organization: "Ese responsable no pertenece a la automotora",
};

/** GET /api/crm/leads/{id}/tasks — tareas del lead (abiertas primero, luego cerradas recientes). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const upstream = await apiFetch(`/backoffice/leads/${id}/tasks`, { auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos cargar las tareas" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, tasks: data?.tasks ?? [] });
}

/** POST /api/crm/leads/{id}/tasks — crea una próxima acción (título, fecha, responsable, prioridad). */
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

  const upstream = await apiFetch(`/backoffice/leads/${id}/tasks`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos crear la tarea" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, task: data?.task ?? null, lead: data?.lead ?? null });
}
