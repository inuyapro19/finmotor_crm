import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";
import { vehicleError } from "../../vehicles/route";


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json(
      { error: "No tienes permisos para editar unidades" },
      { status: 403 },
    );
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const { id } = await params;

  const upstream = await apiFetch(`/backoffice/vehicle-intakes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: vehicleError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json(data);
}
