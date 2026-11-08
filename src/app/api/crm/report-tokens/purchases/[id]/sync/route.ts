import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";
import { tokenPurchaseError } from "@/lib/report-tokens-errors";

/** Vuelta del checkout: el backend consulta el pago a MercadoPago (no confía en la URL). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { mpPaymentId?: unknown } | null;
  const mpPaymentId = typeof body?.mpPaymentId === "string" ? body.mpPaymentId : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{1,40}$/.test(mpPaymentId)) {
    return NextResponse.json({ error: "Datos de pago inválidos" }, { status: 400 });
  }
  const upstream = await apiFetch(
    `/backoffice/report-tokens/organizations/${encodeURIComponent(auth.session.dealership.id)}/purchases/${id}/sync`,
    { method: "POST", auth: true, body: JSON.stringify({ mpPaymentId }) },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: tokenPurchaseError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, purchase: data.purchase });
}
