import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const ERROR_MAP: Record<string, string> = {
  lead_out_of_scope: "Esta solicitud no pertenece a tu automotora",
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  insufficient_org_role: "Tu cuenta es de sólo lectura",
  quote_locked_by_purchase: "La venta ya está cobrada: no se puede cambiar el vehículo en parte de pago",
  invalid_plate: "Ingresa una patente válida",
  trade_in_not_found: "Este cliente no tiene vehículo en parte de pago",
  trade_in_already_received: "El vehículo ya fue recepcionado en el stock: no se puede modificar desde acá",
};

async function guard() {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return { response: auth.response };
  if (!canWrite(auth.session.role)) {
    return { response: NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 }) };
  }
  return { response: null };
}

/** PUT /api/crm/leads/{id}/trade-in — registra o corrige el vehículo en parte de pago. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard();
  if (denied.response) return denied.response;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/trade-in`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos guardar el vehículo en parte de pago" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, tradeIn: data?.tradeIn ?? null });
}

/** DELETE /api/crm/leads/{id}/trade-in — el cliente ya no entrega vehículo. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guard();
  if (denied.response) return denied.response;
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/trade-in`, { method: "DELETE", auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos quitar el vehículo en parte de pago" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true });
}
