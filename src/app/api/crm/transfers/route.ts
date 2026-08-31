import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";
import { canManageTransfers } from "@/lib/auth/roles";


export async function POST(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTransfers(session.dealership.memberRole)) {
    return NextResponse.json({ error: "No tienes permiso para iniciar transferencias" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const upstream = await apiFetch("/backoffice/dealership-transfers", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ ...body, organizationId: session.dealership.id }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: message(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json(data, { status: upstream.status });
}

function message(detail: unknown): string {
  const code = typeof detail === "object" && detail ? String((detail as { code?: unknown }).code) : String(detail);
  const messages: Record<string, string> = {
    legal_buyer_incomplete: "Completa en Perfil la razón social, RUT, representante legal y domicilio de la automotora",
    acquisition_does_not_transfer_ownership: "Sólo las compras directas y permutas transfieren el dominio a la automotora",
    active_location_required: "El ingreso necesita una sucursal activa",
    seller_identity_incomplete: "Completa el nombre y RUT del vendedor en el ingreso del vehículo",
    acquisition_transfer_already_exists: "Ese ingreso ya tiene una transferencia",
    acquisition_not_found: "No encontramos el ingreso seleccionado",
    lead_not_found: "La solicitud seleccionada no pertenece a esta automotora",
  };
  return messages[code] || "No pudimos iniciar la transferencia";
}
