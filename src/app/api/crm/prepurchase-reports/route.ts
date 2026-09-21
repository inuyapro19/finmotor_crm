import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

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
  for (const key of ["status", "visitStatus", "from", "to"]) {
    const value = incoming.get(key)?.trim();
    if (value) params.set(key, value);
  }

  const upstream = await apiFetch(`/backoffice/prepurchase-reports?${params.toString()}`, {
    auth: true,
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || data?.ok === false) {
    return NextResponse.json(
      { error: upstream.status === 403 ? "No tienes acceso a esta agenda" : "No pudimos cargar la agenda" },
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

  const body = await request.json().catch(() => null) as {
    plate?: unknown;
    scheduledFor?: unknown;
    notes?: unknown;
    leadId?: unknown;
  } | null;
  const plate = typeof body?.plate === "string"
    ? body.plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
    : "";
  if (!plate) return NextResponse.json({ error: "Ingresa una patente válida" }, { status: 400 });
  if (typeof body?.scheduledFor !== "string" || !body.scheduledFor) {
    return NextResponse.json({ error: "Selecciona fecha y hora" }, { status: 400 });
  }

  const upstream = await apiFetch("/backoffice/prepurchase-reports", {
    method: "POST",
    auth: true,
    body: JSON.stringify({
      organizationId: session.dealership.id,
      plate,
      scheduledFor: body.scheduledFor,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      leadId: typeof body.leadId === "string" ? body.leadId : null,
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok || data?.ok === false) {
    const messages: Record<string, string> = {
      vehicle_not_found: "La patente no pertenece al inventario activo de esta automotora",
      vehicle_active_location_required: "El vehículo debe estar asignado a una sucursal activa",
      invalid_schedule: "La fecha y hora deben ser futuras",
      visit_slot_taken: "Ese vehículo ya tiene una visita en el horario seleccionado",
      insufficient_org_role: "No tienes permiso para agendar visitas",
      organization_out_of_scope: "No tienes acceso a esa automotora",
      lead_not_found: "La solicitud no pertenece a esta automotora",
      lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
    };
    return NextResponse.json(
      { error: messages[String(data?.detail)] || "No pudimos agendar la visita" },
      { status: upstream.ok ? 502 : upstream.status },
    );
  }
  return NextResponse.json(data, { status: 201 });
}
