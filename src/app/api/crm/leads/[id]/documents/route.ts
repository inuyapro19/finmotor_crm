import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";

/** Proxy autenticado para el paquete de seis documentos del cierre de venta. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format") === "html" ? "html" : "pdf";
  const upstream = await apiFetch(`/backoffice/leads/${id}/documents?format=${format}`, { auth: true });
  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    const messages: Record<string, string> = {
      sale_not_closed: "Primero debes cerrar la venta",
      pdf_render_failed: "No pudimos generar el PDF de venta",
    };
    return NextResponse.json(
      { error: messages[String(data?.detail)] || "No pudimos abrir los documentos de venta" },
      { status: upstream.status },
    );
  }
  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/pdf",
      "Content-Disposition": upstream.headers.get("content-disposition") || "inline",
    },
  });
}
