import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";


const messages: Record<string, string> = {
  vehicle_photos_required: "Sube al menos una foto antes de marcar las fotos como listas",
  vehicle_acquisition_required: "La unidad no tiene un ingreso de inventario asociado",
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; step: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "No tienes permisos para actualizar la preparación" }, { status: 403 });
  }
  const { id, step } = await params;
  if (step !== "detailing" && step !== "photos") {
    return NextResponse.json({ error: "Etapa de preparación inválida" }, { status: 400 });
  }
  const upstream = await apiFetch(
    `/backoffice/vehicles/${encodeURIComponent(id)}/preparation/${step}`,
    { method: "POST", auth: true },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: messages[String(data?.detail)] || "No pudimos actualizar la preparación" },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data);
}
