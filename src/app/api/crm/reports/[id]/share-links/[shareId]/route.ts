import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";


export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "No tienes permiso para revocar enlaces" }, { status: 403 });
  }
  const { id, shareId } = await params;
  const upstream = await apiFetch(`/backoffice/reports/${id}/share-links/${shareId}`, {
    method: "DELETE",
    auth: true,
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(
    upstream.ok ? data : { error: "No pudimos revocar el enlace" },
    { status: upstream.status },
  );
}
