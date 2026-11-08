import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const ERROR_MAP: Record<string, string> = {
  lead_out_of_scope: "Esta solicitud no pertenece a tu automotora",
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  insufficient_org_role: "Tu cuenta es de sólo lectura",
  quote_locked_by_purchase: "La venta ya está cobrada: no se puede modificar la captación",
  trade_in_not_evaluated: "Primero registra la evaluación presencial del vehículo",
  organization_required: "Tu cuenta no tiene una automotora asociada",
  contact_name_required: "Ingresa el nombre del cliente en el lead antes de recepcionar",
};

/** POST /api/crm/leads/{id}/trade-in/receive — deja lista la captación (accepted) del vehículo
 *  en parte de pago para que entre a `/vehiculos/create?sourcing={id}` y quede en el stock. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/trade-in/receive`, {
    method: "POST",
    auth: true,
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos preparar la recepción del vehículo" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, opportunity: data?.opportunity ?? null });
}
