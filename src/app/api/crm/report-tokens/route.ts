import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";

/** Saldo de tokens, packs del plan y movimientos de la automotora activa. */
export async function GET() {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const upstream = await apiFetch(
    `/backoffice/report-tokens/organizations/${encodeURIComponent(auth.session.dealership.id)}`,
    { auth: true },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: "No pudimos cargar tu saldo de tokens" }, { status: upstream.status });
  }
  return NextResponse.json(data);
}
