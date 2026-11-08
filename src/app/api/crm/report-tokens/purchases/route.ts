import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";
import { tokenPurchaseError } from "@/lib/report-tokens-errors";

/** Abre el checkout de MercadoPago para un pack del plan de la automotora. El precio lo fija
 *  el backend desde el pack; el saldo se acredita solo cuando MercadoPago confirma el pago. */
export async function POST(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { packId?: unknown } | null;
  const packId = typeof body?.packId === "string" ? body.packId : "";
  if (!/^[0-9a-f-]{36}$/i.test(packId)) {
    return NextResponse.json({ error: "Elige un pack válido" }, { status: 400 });
  }
  const upstream = await apiFetch(
    `/backoffice/report-tokens/organizations/${encodeURIComponent(auth.session.dealership.id)}/purchases`,
    { method: "POST", auth: true, body: JSON.stringify({ packId }) },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || !data?.checkoutUrl) {
    return NextResponse.json({ error: tokenPurchaseError(data?.detail) }, { status: upstream.ok ? 502 : upstream.status });
  }
  return NextResponse.json({ ok: true, purchaseId: data.purchaseId, checkoutUrl: data.checkoutUrl });
}
