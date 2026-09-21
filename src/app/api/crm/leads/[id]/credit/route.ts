import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

/**
 * POST /api/crm/leads/{id}/credit — envía el financiamiento a evaluación.
 *
 * Sólo viajan el plazo, el pie negociado, el RUT y una nota: el monto a financiar y la cuota
 * los calcula el backend desde la cotización guardada. Es deliberado — el importe de un
 * crédito no se acepta desde el navegador.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;

  let body: { termMonths?: number; downPayment?: number; rut?: string; contactEmail?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/leads/${id}/credit`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({
      termMonths: body.termMonths,
      downPayment: body.downPayment ?? null,
      rut: body.rut?.trim() || null,
      contactEmail: body.contactEmail?.trim() || null,
      notes: body.notes?.trim() || null,
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      vehicle_required: "Primero elige la unidad que le estás cotizando",
      contact_rut_required: "Falta el RUT del cliente: la financiera lo necesita para evaluar",
      invalid_term: "Ese plazo no está disponible",
      invalid_down_payment: "El pie no puede ser negativo",
      nothing_to_finance: "Con ese pie no queda nada por financiar",
      vehicle_out_of_scope: "Esa unidad no es de tu automotora",
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
      lead_out_of_scope: "Esta solicitud no es de tu automotora",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos enviar la solicitud" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({
    ok: true,
    creditRequest: data?.creditRequest ?? null,
    lead: data?.lead ?? null,
  });
}
