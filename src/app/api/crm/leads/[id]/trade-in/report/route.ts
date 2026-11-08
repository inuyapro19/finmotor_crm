import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const ERROR_MAP: Record<string, string> = {
  lead_out_of_scope: "Esta solicitud no pertenece a tu automotora",
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  insufficient_org_role: "Tu cuenta es de sólo lectura",
  trade_in_not_found: "Primero registra el vehículo en parte de pago",
  report_pricing_not_configured: "Tu automotora no tiene tarifas de informes configuradas — habla con Finmotor",
  insufficient_report_tokens: "No te quedan tokens para informes. Recarga en Informes → Comprar tokens.",
};

/**
 * POST /api/crm/leads/{id}/trade-in/report — pide el informe histórico de la patente en parte
 * de pago (mismo mecanismo "sin pasarela" que el Kit de Compra Venta). El mismo endpoint sirve
 * para pedirlo la primera vez y para el polling mientras el scheduler SPLEC del servidor lo
 * genera en background; para descargar se usa `/api/crm/reports/{id}/download`.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/trade-in/report`, {
    method: "POST",
    auth: true,
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos pedir el informe" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, report: data?.report ?? null });
}
