import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, isDealershipAdmin, requireCrmApiSession } from "@/lib/auth/session";

/** PATCH /api/crm/leads/{id} — avanza la etapa, agenda la próxima acción o marca perdido. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const upstream = await apiFetch(`/backoffice/leads/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
      lead_out_of_scope: "Esta solicitud no es de tu automotora",
      invalid_stage: "Esa etapa no existe",
      lead_stage_cannot_move_backwards: "La etapa no puede retroceder; registra una nota si cambió la situación",
      contact_phone_or_email_required: "Necesitas al menos un teléfono o un correo para poder contactarlo",
      lost_reason_required: "Indica por qué se perdió la oportunidad",
      reopen_reason_required: "Indica por qué se reabre la oportunidad",
      invalid_reopen_stage: "La etapa elegida no corresponde a esta reapertura",
      lead_sale_not_closed: "Registra el pago antes de marcar la venta como cerrada",
      completed_sale_cannot_reopen: "Una venta completada requiere un proceso formal de reversa",
      lead_already_closed: "La oportunidad ya está cerrada",
      completed_sale_cannot_be_lost: "El auto ya se transfirió: esta venta no se puede dar por perdida",
      vehicle_locked_by_purchase: "La venta ya está cerrada: no se puede cambiar la unidad",
      quote_locked_by_purchase:
        "El pago ya está registrado y el precio quedó fijado. Para renegociar, marca la oportunidad como perdida y parte una nueva.",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos actualizar la solicitud" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, lead: data?.lead ?? null });
}

/** DELETE /api/crm/leads/{id} — exclusivo del administrador de la automotora. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isDealershipAdmin(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador de la automotora puede eliminar solicitudes" },
      { status: 403 },
    );
  }
  const { id } = await params;

  const upstream = await apiFetch(`/backoffice/leads/${id}`, { method: "DELETE", auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      only_dealership_admin_can_delete: "Sólo el administrador de la automotora puede eliminar solicitudes",
      lead_linked_to_sourcing: "Esta venta está vinculada a una captación. Conserva la solicitud para mantener su trazabilidad.",
      lead_out_of_scope: "Esta solicitud no es de tu automotora",
      lead_not_found: "La solicitud ya no existe",
      lead_has_a_sale:
        "Esta solicitud tiene una venta detrás. Si no se concretó, márcala como perdida: eso anula la venta y devuelve el auto a la vitrina.",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos eliminar la solicitud" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true });
}
