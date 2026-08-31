import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

/** POST /api/crm/acquisitions — registra el ingreso de un vehículo a la automotora. */
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

  const upstream = await apiFetch("/backoffice/acquisitions", {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: acquisitionError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, acquisition: data?.acquisition ?? null });
}

export function acquisitionError(detail: unknown): string {
  const map: Record<string, string> = {
    owner_name_required: "Falta el nombre de quien entrega el auto",
    plate_required: "Falta la patente del vehículo",
    min_price_required: "Falta el precio mínimo autorizado por el dueño",
    purchase_price_required: "Falta el precio que le pagas al dueño",
    invalid_kind: "Esa modalidad no existe",
    invalid_status: "Ese estado no existe",
    acquisition_out_of_scope: "Ese ingreso no es de tu automotora",
    acquisition_not_found: "El ingreso ya no existe",
    only_dealership_admin_can_delete: "Sólo el administrador de la automotora puede eliminar ingresos",
    organization_profile_incomplete:
      "Completa el perfil de tu automotora (razón social y representante legal) antes de emitir contratos",
    pdf_render_failed: "No pudimos generar el PDF del contrato",
  };
  return map[String(detail)] || "No pudimos guardar el ingreso";
}
