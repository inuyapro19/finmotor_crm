import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";


export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const upstream = await apiFetch(
    `/backoffice/vehicles/${encodeURIComponent(id)}/preparation`,
    { auth: true },
  );
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
