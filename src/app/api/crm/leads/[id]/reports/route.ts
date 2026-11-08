import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

/**
 * POST /api/crm/leads/{id}/reports — pide el informe histórico de la unidad cotizada.
 *
 * Mismo camino "sin pasarela" que ya usa el lote de patentes (`/informes`): la orden queda
 * `paid` de entrada y se factura postpago a la automotora — nada que cobrarle al cliente acá.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;

  let body: { reportType?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const upstream = await apiFetch(`/backoffice/leads/${id}/reports`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ reportType: body.reportType === "premium" ? "premium" : "standard" }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      vehicle_required: "Elige primero la unidad que le estás cotizando",
      vehicle_plate_missing: "Esa unidad no tiene patente registrada",
      report_pricing_not_configured: "Tu automotora todavía no tiene tarifas de informes configuradas — pídeselo a Finmotor",
      insufficient_report_tokens: "No te quedan tokens para informes. Recarga en Informes → Comprar tokens.",
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
      lead_out_of_scope: "Esta solicitud no es de tu automotora",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos pedir el informe" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, report: data?.report ?? null, lead: data?.lead ?? null });
}
