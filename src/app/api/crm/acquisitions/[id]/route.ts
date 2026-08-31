import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, isDealershipAdmin, requireCrmApiSession } from "@/lib/auth/session";
import { acquisitionError } from "../route";

/** PATCH /api/crm/acquisitions/{id} — edita el acuerdo. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/acquisitions/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: acquisitionError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, acquisition: data?.acquisition ?? null });
}

/** DELETE /api/crm/acquisitions/{id} — exclusivo del administrador de la automotora. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isDealershipAdmin(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador de la automotora puede eliminar ingresos" },
      { status: 403 },
    );
  }
  const { id } = await params;

  const upstream = await apiFetch(`/backoffice/acquisitions/${id}`, { method: "DELETE", auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: acquisitionError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, cancelled: Boolean(data?.cancelled) });
}
