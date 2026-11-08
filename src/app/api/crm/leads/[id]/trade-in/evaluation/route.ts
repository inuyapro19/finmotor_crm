import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const ERROR_MAP: Record<string, string> = {
  lead_out_of_scope: "Esta solicitud no pertenece a tu automotora",
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  insufficient_org_role: "Tu cuenta es de sólo lectura",
  quote_locked_by_purchase: "La venta ya está cobrada: no se puede cambiar la evaluación",
  trade_in_not_found: "Primero registra el vehículo en parte de pago",
  trade_in_already_received: "El vehículo ya fue recepcionado en el stock: no se puede modificar desde acá",
};

/** POST /api/crm/leads/{id}/trade-in/evaluation — evaluación presencial del vehículo en parte de pago. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || !(Number(body.amount) > 0)) {
    return NextResponse.json({ error: "Ingresa el valor de la evaluación" }, { status: 400 });
  }
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/trade-in/evaluation`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos guardar la evaluación" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, tradeIn: data?.tradeIn ?? null });
}
