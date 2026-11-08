import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

/**
 * POST /api/crm/leads/{id}/payment — "pago informado": el agente ya recibió el dinero
 * (efectivo/transferencia/tarjeta en el mostrador) y lo deja registrado, sin pasarela.
 *
 * Si el lead todavía no tiene una venta cerrada, el backend la crea en el mismo gesto
 * (`_close_sale`) — el agente no tiene que acordarse de un paso previo.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;

  let body: { amount?: number; method?: string; reference?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/leads/${id}/payment`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({
      amount: body.amount,
      method: body.method,
      reference: body.reference?.trim() || null,
      notes: body.notes?.trim() || null,
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      invalid_payment_method: "Elige un medio de pago válido",
      quote_incomplete: "Falta terminar la cotización (unidad y precio) antes de cobrar",
      vehicle_missing_seller: "Esa unidad no tiene un vendedor asociado",
      nothing_to_charge: "No hay nada que cobrar con la cotización actual",
      amount_mismatch: "El monto no coincide con lo cotizado — revísalo",
      credit_not_approved: "La financiera todavía no aprueba el crédito: no se puede cobrar el pie hasta entonces",
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
      lead_out_of_scope: "Esta solicitud no es de tu automotora",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos registrar el pago" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, lead: data?.lead ?? null });
}
