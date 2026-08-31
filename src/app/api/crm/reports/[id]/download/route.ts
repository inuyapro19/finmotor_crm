import { NextResponse } from "next/server";

import { apiFetch, BACKEND_API_URL } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const query = new URLSearchParams({ organizationId: session.dealership.id });
  const upstream = await apiFetch(
    `/backoffice/reports/${encodeURIComponent(id)}/download?${query.toString()}`,
    { auth: true },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: downloadError(data?.detail) },
      { status: upstream.status },
    );
  }

  if (typeof data?.downloadUrl !== "string") {
    return NextResponse.json({ error: "El archivo todavía no está disponible" }, { status: 502 });
  }
  let target: URL;
  try {
    target = new URL(data.downloadUrl, BACKEND_API_URL);
  } catch {
    return NextResponse.json({ error: "El enlace de descarga no es válido" }, { status: 502 });
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    return NextResponse.json({ error: "El enlace de descarga no es válido" }, { status: 502 });
  }
  return NextResponse.redirect(target, 307);
}

function downloadError(detail: unknown): string {
  const map: Record<string, string> = {
    report_not_found: "El informe no existe",
    report_not_generated: "El informe todavía no está generado",
    organization_out_of_scope: "Ese informe no pertenece a tu automotora",
    download_unavailable: "El archivo no está disponible en este momento",
  };
  return map[String(detail)] || "No pudimos descargar el informe";
}
