import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; vehicleId: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id, vehicleId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const upstream = await apiFetch(
    `/backoffice/leads/${encodeURIComponent(id)}/vehicles/${encodeURIComponent(vehicleId)}`,
    { method: "PATCH", auth: true, body: JSON.stringify(body) },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const messages: Record<string, string> = {
      lead_vehicle_not_found: "Esa unidad no está entre las consideradas",
      invalid_vehicle_interest_status: "La decisión sobre la unidad no es válida",
      invalid_test_drive_status: "El estado del test drive no es válido",
      invalid_test_drive_schedule: "Selecciona una fecha y hora futuras",
      test_drive_notes_required: "Registra cómo resultó el test drive",
      vehicle_locked_by_purchase: "La unidad no se puede cambiar porque la compra ya está iniciada",
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
    };
    return NextResponse.json(
      { error: messages[String(data?.detail)] || "No pudimos actualizar la unidad" },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data);
}
