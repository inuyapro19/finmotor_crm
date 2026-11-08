import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

/** DELETE /api/crm/vehicles/{id}/photos/{photoId} — quita una foto guardada. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canManageTeam(auth.session.role)) {
    return NextResponse.json({ error: "No tienes permisos para quitar fotos" }, { status: 403 });
  }
  const { id, photoId } = await params;
  const upstream = await apiFetch(
    `/backoffice/vehicles/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE", auth: true },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: "No pudimos quitar la foto" }, { status: upstream.status });
  }
  return NextResponse.json(data);
}
