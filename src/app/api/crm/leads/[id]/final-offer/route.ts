import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const ERROR_MAP: Record<string, string> = {
  lead_out_of_scope: "Esta solicitud no pertenece a tu automotora",
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  insufficient_org_role: "Tu cuenta es de sólo lectura",
  quote_locked_by_purchase: "La venta ya está cobrada: la oferta no se puede cambiar",
  vehicle_required: "Elige el vehículo con el que sigue el cliente",
  price_required: "El vehículo no tiene precio: define el precio en la cotización",
  trade_in_not_evaluated: "Primero registra la evaluación presencial del vehículo en parte de pago",
  invalid_term: "Ese plazo no está disponible",
  term_required: "Elige el plazo del financiamiento",
};

/** POST /api/crm/leads/{id}/final-offer — emite o ajusta la oferta definitiva (y se la envía al cliente). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { termMonths?: number };
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/final-offer`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ termMonths: body.termMonths ?? null }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos emitir la oferta" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, finalOffer: data?.finalOffer ?? null });
}
