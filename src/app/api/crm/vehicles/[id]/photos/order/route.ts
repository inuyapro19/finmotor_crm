import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

/** PUT /api/crm/vehicles/{id}/photos/order — orden final de las fotos; la primera es la portada. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canManageTeam(auth.session.role)) {
    return NextResponse.json({ error: "No tienes permisos para ordenar las fotos" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.photoIds)) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/vehicles/${encodeURIComponent(id)}/photos/order`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify({ photoIds: body.photoIds }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const error = data?.detail === "photo_order_mismatch"
      ? "Las fotos cambiaron mientras ordenabas. Recarga la página e inténtalo de nuevo."
      : "No pudimos guardar el orden de las fotos";
    return NextResponse.json({ error }, { status: upstream.status });
  }
  return NextResponse.json(data);
}
