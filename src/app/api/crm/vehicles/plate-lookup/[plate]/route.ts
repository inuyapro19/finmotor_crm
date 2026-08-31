import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";


export async function GET(_request: Request, { params }: { params: Promise<{ plate: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { plate } = await params;
  const normalized = plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!normalized) {
    return NextResponse.json({ error: "Ingresa una patente válida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/vehicles/plate/${encodeURIComponent(normalized)}`, { auth: true });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
