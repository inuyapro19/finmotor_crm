import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";
import { acquisitionError } from "../../route";

/**
 * GET /api/crm/acquisitions/{id}/contract — devuelve el PDF del contrato.
 *
 * Se hace de proxy en vez de enlazar al backend directamente porque el navegador no lleva el
 * token: la sesión vive en una cookie httpOnly de este dominio.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "html" ? "html" : "pdf";

  const upstream = await apiFetch(`/backoffice/acquisitions/${id}/contract?format=${format}`, {
    auth: true,
  });

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json({ error: acquisitionError(data?.detail) }, { status: upstream.status });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/pdf",
      "Content-Disposition": upstream.headers.get("content-disposition") || "inline",
    },
  });
}
