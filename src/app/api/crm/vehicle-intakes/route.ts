import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";
import { vehicleError } from "../vehicles/route";
import { sourcingError } from "@/lib/sourcing";


export async function POST(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json(
      { error: "No tienes permisos para ingresar unidades" },
      { status: 403 },
    );
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const upstream = await apiFetch("/backoffice/vehicle-intakes", {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: String(data?.detail).startsWith("sourcing_") || data?.detail === "trade_in_amount_mismatch" ? sourcingError(data?.detail) : vehicleError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json(data);
}
