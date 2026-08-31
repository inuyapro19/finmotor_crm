import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";

/** Proxy autenticado para la ficha de inspeccion generada por el backend. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "html" ? "html" : "pdf";
  const upstream = await apiFetch(`/backoffice/acquisitions/${id}/inspection?format=${format}`, {
    auth: true,
  });
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    const message = data?.detail === "pdf_render_failed"
      ? "No pudimos generar el PDF de inspeccion"
      : "No pudimos abrir la inspeccion";
    return NextResponse.json({ error: message }, { status: upstream.status });
  }
  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/pdf",
      "Content-Disposition": upstream.headers.get("content-disposition") || "inline",
    },
  });
}
