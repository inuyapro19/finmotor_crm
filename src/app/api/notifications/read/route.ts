import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { getCrmSession } from "@/lib/auth/session";

/**
 * POST /api/notifications/read — marca una notificación como leída, o todas si no viene id.
 *
 * Un solo handler para los dos gestos porque desde la campana son el mismo: "ya lo vi". El
 * backend, además, sólo deja marcar las del propio usuario (`mark_read` filtra por owner).
 */
export async function POST(request: Request) {
  const session = await getCrmSession();
  if (!session) return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });

  let body: { id?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const path = body.id ? `/notifications/${encodeURIComponent(body.id)}/read` : "/notifications/read-all";
  const upstream = await apiFetch(path, { method: "POST", auth: true });
  if (!upstream.ok) {
    return NextResponse.json({ error: "No pudimos marcar el aviso" }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true });
}
