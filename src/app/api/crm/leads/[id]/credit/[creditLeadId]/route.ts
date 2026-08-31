import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

/**
 * PATCH /api/crm/leads/{id}/credit/{creditLeadId} — transcribe la respuesta de la financiera
 * (aprobado/rechazado). No hay portal para que ella misma lo marque: llega por teléfono o
 * correo y alguien que administra la cartera lo deja registrado — por eso el gate es
 * `canManageTeam` (admin/supervisor), no cualquier agente de mesón.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; creditLeadId: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Sólo un administrador o supervisor puede decidir un crédito" },
      { status: 403 },
    );
  }
  const { id, creditLeadId } = await params;

  let body: {
    status?: string;
    institutionName?: string;
    approvedAmount?: number;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/leads/${id}/credit/${creditLeadId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({
      status: body.status,
      institutionName: body.institutionName?.trim() || null,
      approvedAmount: body.approvedAmount ?? null,
      notes: body.notes?.trim() || null,
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      invalid_credit_status: "Esa decisión no existe",
      insufficient_credit_role: "No tienes permiso para decidir este crédito",
      credit_request_not_found: "Esa solicitud de financiamiento ya no existe",
      approval_terms_required: "Indica la financiera y el monto aprobado",
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
      lead_out_of_scope: "Esta solicitud no es de tu automotora",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos registrar la decisión" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({
    ok: true,
    lead: data?.lead ?? null,
    creditRequests: data?.creditRequests ?? [],
  });
}
