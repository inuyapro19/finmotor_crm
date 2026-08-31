import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const REPORT_TYPES = new Set(["standard", "premium"]);

export async function GET(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const incoming = new URL(request.url).searchParams;
  const params = new URLSearchParams({
    organizationId: session.dealership.id,
    page: incoming.get("page") || "1",
    limit: incoming.get("limit") || "25",
  });
  for (const key of ["from", "to", "status", "billingStatus", "reportType"]) {
    const value = incoming.get(key)?.trim();
    if (value) params.set(key, value);
  }

  const upstream = await apiFetch(`/backoffice/reports?${params.toString()}`, { auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || data?.ok === false) {
    return NextResponse.json(
      { error: reportError(data?.detail) },
      { status: upstream.ok ? 502 : upstream.status },
    );
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }

  let body: { reportType?: unknown; plates?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const reportType = String(body.reportType ?? "");
  if (!REPORT_TYPES.has(reportType)) {
    return NextResponse.json({ error: "Selecciona un tipo de informe válido" }, { status: 400 });
  }
  if (!Array.isArray(body.plates)) {
    return NextResponse.json({ error: "Ingresa al menos una patente" }, { status: 400 });
  }
  const plates = Array.from(
    new Set(
      body.plates
        .filter((plate): plate is string => typeof plate === "string")
        .map((plate) => plate.toUpperCase().replace(/[^A-Z0-9]/g, ""))
        .filter(Boolean),
    ),
  );
  if (plates.length === 0 || plates.length > 200) {
    return NextResponse.json(
      { error: plates.length > 200 ? "Puedes solicitar hasta 200 patentes por lote" : "Ingresa al menos una patente" },
      { status: 400 },
    );
  }

  const upstream = await apiFetch("/backoffice/reports/batches", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ organizationId: session.dealership.id, reportType, plates }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || data?.ok === false) {
    return NextResponse.json(
      { error: reportError(data?.detail) },
      { status: upstream.ok ? 502 : upstream.status },
    );
  }
  return NextResponse.json({ ok: true, batch: data?.batch ?? null, reports: data?.reports ?? [] });
}

function reportError(detail: unknown): string {
  const map: Record<string, string> = {
    organization_required: "No pudimos identificar la automotora activa",
    organization_out_of_scope: "No tienes acceso a esa automotora",
    invalid_report_type: "El tipo de informe no es válido",
    plates_required: "Ingresa al menos una patente",
    too_many_plates: "Puedes solicitar hasta 200 patentes por lote",
    insufficient_tokens: "La automotora no tiene tokens suficientes para este lote",
    report_pricing_not_configured: "Finmotor todavía no configura la tarifa de informes de esta automotora",
    plates_must_contain_1_to_200_unique_values: "Ingresa entre 1 y 200 patentes válidas",
  };
  return map[String(detail)] || "No pudimos procesar la solicitud de informes";
}
