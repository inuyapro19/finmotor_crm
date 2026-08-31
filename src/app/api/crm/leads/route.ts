import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

/**
 * POST /api/crm/leads — alta manual de una solicitud (walk-in o llamada entrante).
 * Proxy a `POST /backoffice/leads`, que aplica el acote real por organización y agente.
 */
export async function POST(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch("/backoffice/leads", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ organizationId: session.dealership.id, ...(body as object) }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: message(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, lead: data?.lead ?? null });
}

/** Traduce los códigos del backend a algo que el agente entienda. */
function message(detail: unknown): string {
  const map: Record<string, string> = {
    contact_name_required: "Falta el nombre del cliente",
    contact_phone_or_email_required: "Necesitas al menos un teléfono o un correo para poder contactarlo",
    organization_required: "Indica a qué automotora pertenece la solicitud",
    organization_out_of_scope: "Esa automotora no es tuya",
    vehicle_not_found: "El vehículo no existe",
    vehicle_out_of_scope: "Ese vehículo no es de tu automotora",
    assignee_not_in_organization: "La persona asignada no pertenece a tu automotora",
    cannot_assign_to_others: "Sólo un supervisor puede asignar solicitudes a otra persona",
    invalid_stage: "Esa etapa no existe",
  };
  return map[String(detail)] || "No pudimos guardar la solicitud";
}
