import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { isDealershipAdmin, requireCrmApiSession } from "@/lib/auth/session";


export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/organizations/${id}/locations?include_inactive=true`, {
    auth: true,
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isDealershipAdmin(session.role)) {
    return NextResponse.json({ error: "Sólo el administrador puede crear sucursales" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/organizations/${id}/locations`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = data?.detail === "location_name_already_exists"
      ? "Ya existe una sucursal activa con ese nombre"
      : "No pudimos crear la sucursal";
    return NextResponse.json({ error: message }, { status: upstream.status });
  }
  return NextResponse.json(data, { status: upstream.status });
}
