import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { isDealershipAdmin, requireCrmApiSession } from "@/lib/auth/session";


const errors: Record<string, string> = {
  location_name_already_exists: "Ya existe una sucursal activa con ese nombre",
  main_location_cannot_be_deactivated: "Primero marca otra sucursal como principal",
  main_location_cannot_be_deleted: "Primero marca otra sucursal como principal",
  location_not_found: "La sucursal ya no existe",
  parking_capacity_has_occupied_spots: "No puedes reducir la capacidad porque hay vehículos ocupando esos puestos",
  location_has_parked_vehicles: "Mueve los vehículos estacionados antes de desactivar la sucursal",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; locationId: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isDealershipAdmin(session.role)) {
    return NextResponse.json({ error: "Sólo el administrador puede editar sucursales" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const { id, locationId } = await params;
  const upstream = await apiFetch(`/backoffice/organizations/${id}/locations/${locationId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: errors[String(data?.detail)] || "No pudimos actualizar la sucursal" },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; locationId: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isDealershipAdmin(session.role)) {
    return NextResponse.json({ error: "Sólo el administrador puede desactivar sucursales" }, { status: 403 });
  }
  const { id, locationId } = await params;
  const upstream = await apiFetch(`/backoffice/organizations/${id}/locations/${locationId}`, {
    method: "DELETE",
    auth: true,
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: errors[String(data?.detail)] || "No pudimos desactivar la sucursal" },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data);
}
