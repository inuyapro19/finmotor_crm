import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";

/**
 * POST /api/crm/leads/{id}/mia-crm-margin-check — Margin Awareness (Modelo 06).
 *
 * El vendedor pregunta "¿puedo bajar el precio a $X?" y el módulo mia_crm calcula el Δp
 * (aumento mínimo de probabilidad de cierre que justificaría el descuento) contra el costo
 * REAL de adquisición del vehículo -- nunca aprueba nada, solo recomienda (R-MRG-01).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: { requestedPrice?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  if (typeof body.requestedPrice !== "number" || body.requestedPrice <= 0) {
    return NextResponse.json({ error: "Ingresa un precio válido" }, { status: 400 });
  }

  const upstream = await apiFetch(`/mia-crm/leads/${id}/margin-check`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ requestedPrice: body.requestedPrice }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const detail = (data as { detail?: string })?.detail;
    return NextResponse.json(
      { error: detail === "no_cost_basis" ? "Este vehículo no tiene costo de adquisición registrado -- no se puede calcular el margen." : detail || "No se pudo calcular el margen." },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data);
}
