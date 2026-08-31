import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json({ error: "No tienes permisos para registrar fotos" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/vehicles/${encodeURIComponent(id)}/photos`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
