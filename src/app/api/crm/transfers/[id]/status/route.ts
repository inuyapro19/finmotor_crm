import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";
import { canManageTransfers } from "@/lib/auth/roles";


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTransfers(session.dealership.memberRole)) {
    return NextResponse.json({ error: "No tienes permiso para operar transferencias" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/dealership-transfers/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const error = data?.detail === "invalid_transfer_transition"
      ? "Ese cambio de estado no es válido"
      : "No pudimos actualizar la transferencia";
    return NextResponse.json({ error }, { status: upstream.status });
  }
  return NextResponse.json(data);
}
