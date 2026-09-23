import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const response = await apiFetch(`/mia-crm/leads/${encodeURIComponent(id)}/recommendations`, { auth: true });
  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.recommendationId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.recommendationId)) {
    return NextResponse.json({ error: "Recomendación inválida" }, { status: 400 });
  }
  const response = await apiFetch(`/mia-crm/leads/${encodeURIComponent(id)}/recommendations/${body.recommendationId}/seen`, {
    auth: true, method: "POST",
  });
  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
