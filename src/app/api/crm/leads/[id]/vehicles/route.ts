import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const upstream = await apiFetch(`/backoffice/leads/${encodeURIComponent(id)}/vehicles`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const messages: Record<string, string> = {
      vehicle_out_of_scope: "Esa unidad no pertenece a tu automotora",
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
    };
    return NextResponse.json(
      { error: messages[String(data?.detail)] || "No pudimos agregar la unidad" },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data, { status: 201 });
}
