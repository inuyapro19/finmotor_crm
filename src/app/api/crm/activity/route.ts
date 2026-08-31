import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";

/**
 * GET /api/crm/activity — bitácora reciente para el panel lateral de actividad.
 *
 * Proxy a `GET /backoffice/analytics/activity`, que acota por organización y, si quien
 * pregunta es un agente de ventas, a los leads que tiene asignados.
 */
export async function GET(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;

  const limit = new URL(request.url).searchParams.get("limit") ?? "25";
  const upstream = await apiFetch(
    `/backoffice/analytics/activity?limit=${encodeURIComponent(limit)}`,
    { auth: true },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: "No pudimos cargar la actividad" }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, items: data?.items ?? [] });
}
