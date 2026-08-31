import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { getCrmSession } from "@/lib/auth/session";
import { fromBackendNotification } from "@/lib/data/crm";

/**
 * GET /api/notifications — campana del CRM.
 *
 * Proxy a `GET /notifications`, que devuelve SIEMPRE las del usuario autenticado (el
 * backend no acepta un `userId` por parámetro). El token vive en la cookie httpOnly, así
 * que el navegador nunca lo ve: por eso la campana pasa por aquí y no llama al backend.
 */
export async function GET() {
  const session = await getCrmSession();
  if (!session) return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });

  const upstream = await apiFetch("/notifications", { auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: "No pudimos cargar tus avisos" }, { status: upstream.status });
  }
  const notifications = (data?.notifications ?? []).map(fromBackendNotification);
  return NextResponse.json({ ok: true, notifications });
}
