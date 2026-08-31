import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "No tienes permiso para compartir informes" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({ expiresInDays: 7 }));
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/reports/${id}/share-links`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = data?.detail === "report_not_generated"
      ? "El informe todavía no está disponible para compartir"
      : "No pudimos crear el enlace";
    return NextResponse.json({ error: message }, { status: upstream.status });
  }
  return NextResponse.json(data, { status: upstream.status });
}
