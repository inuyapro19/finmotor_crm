import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canManageTransfers, requireCrmApiSession } from "@/lib/auth/session";

/**
 * POST /api/crm/leads/{id}/transfer — dispara la transferencia real (Nexocar) de la venta
 * cerrada del lead. El backend aplica su propio gate (pago informado / crédito aprobado) antes
 * de intentarlo, y devuelve `ok:false` con el motivo si todavía no corresponde — no es un
 * error de red, así que se responde 200 igual y el motivo lo interpreta la UI.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTransfers(session.dealership.memberRole)) {
    return NextResponse.json(
      { error: "Tu rol no tiene permiso para iniciar transferencias" },
      { status: 403 },
    );
  }
  const { id } = await params;

  const upstream = await apiFetch(`/backoffice/leads/${id}/transfer`, { method: "POST", auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      insufficient_transfer_role: "No tienes permiso para iniciar transferencias",
      purchase_not_found: "No encontramos la venta cerrada de esta solicitud",
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
      lead_out_of_scope: "Esta solicitud no es de tu automotora",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos iniciar la transferencia" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({
    ok: Boolean(data?.ok),
    reason: data?.reason ?? null,
    missing: data?.missing ?? [],
    transfer: data?.transfer ?? null,
    lead: data?.lead ?? null,
  });
}
