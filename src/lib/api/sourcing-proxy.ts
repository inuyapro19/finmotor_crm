import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";
import { sourcingError } from "@/lib/sourcing";

export async function sourcingProxy(request: Request, id?: string) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) return NextResponse.json({ error: "Tu cuenta es de solo lectura" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const upstream = await apiFetch(`/backoffice/sourcing${id ? `/${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PATCH" : "POST", auth: true, body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(upstream.ok ? data : { error: sourcingError(data.detail) }, { status: upstream.status });
}
