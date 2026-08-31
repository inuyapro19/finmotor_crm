import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, isDealershipAdmin, requireCrmApiSession } from "@/lib/auth/session";
import { vehicleError } from "../route";

/** GET /api/crm/vehicles/{id} — detalle acotado a la automotora activa. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/vehicles/${encodeURIComponent(id)}`, { auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: vehicleError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json(data);
}

/** PATCH /api/crm/vehicles/{id} — edita una unidad. */
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
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/vehicles/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: vehicleError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, vehicle: data?.vehicle ?? null });
}

/** DELETE /api/crm/vehicles/{id} — exclusivo del administrador de la automotora. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isDealershipAdmin(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador de la automotora puede eliminar unidades" },
      { status: 403 },
    );
  }
  const { id } = await params;

  const upstream = await apiFetch(`/backoffice/vehicles/${id}`, { method: "DELETE", auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: vehicleError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, archived: Boolean(data?.archived) });
}
