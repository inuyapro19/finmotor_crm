import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

/**
 * GET /api/crm/vehicles?q= — buscador del stock para elegir la unidad que se está cotizando.
 *
 * Cualquier agente puede buscar (necesita la unidad para cotizar); el backend ya acota el
 * resultado a las unidades de su automotora. Devuelve los datos comerciales necesarios para
 * comparar unidades sin abandonar la cotización.
 */
export async function GET(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const params = new URLSearchParams({ page: "1", limit: "50" });
  const q = url.searchParams.get("q")?.trim();
  if (q) params.set("q", q);
  const status = url.searchParams.get("status")?.trim();
  if (status) params.set("status", status);

  const upstream = await apiFetch(`/backoffice/vehicles?${params.toString()}`, { auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: "No pudimos buscar en tu stock" }, { status: upstream.status });
  }

  type Row = {
    id: string;
    year: number | null;
    patent: string | null;
    price: number | string | null;
    mileage: number | null;
    status: string | null;
    stock_number: number | null;
    brand_label: string | null;
    model_label: string | null;
    vehicle_type: string | null;
    fuel_type: string | null;
    transmission: string | null;
    color: string | null;
    inventory_location: string | null;
    photos_status: string | null;
    recent_report_id: string | null;
    recent_report_type: string | null;
    recent_report_generated_at: string | null;
  };
  const items = (data?.items ?? []).map((r: Row) => ({
    id: String(r.id),
    label: [r.brand_label, r.model_label].filter(Boolean).join(" ") || "Unidad sin marca",
    year: r.year,
    patent: r.patent,
    price: r.price === null || r.price === undefined ? null : Number(r.price),
    mileage: r.mileage,
    status: r.status,
    stockNumber: r.stock_number,
    vehicleType: r.vehicle_type,
    fuelType: r.fuel_type,
    transmission: r.transmission,
    color: r.color,
    inventoryLocation: r.inventory_location,
    photosStatus: r.photos_status,
    recentReport: r.recent_report_id
      ? {
          id: String(r.recent_report_id),
          reportType: r.recent_report_type,
          generatedAt: r.recent_report_generated_at,
        }
      : null,
  }));
  return NextResponse.json({ ok: true, items, total: Number(data?.total ?? items.length) });
}

/** POST /api/crm/vehicles — da de alta una unidad en el inventario. */
export async function POST(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canWrite(session.role)) {
    return NextResponse.json(
      { error: "No tienes permisos para cargar unidades" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch("/backoffice/vehicles", {
    method: "POST",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json({ error: vehicleError(data?.detail) }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true, vehicle: data?.vehicle ?? null });
}

export function vehicleError(detail: unknown): string {
  const map: Record<string, string> = {
    patent_required: "La patente es obligatoria: identifica la unidad y sin ella no se puede publicar",
    patent_already_used: "Ya tienes otra unidad activa con esa patente",
    missing_required_field: "Faltan datos: marca, modelo, año y precio son obligatorios",
    only_dealership_admin_can_delete: "Sólo el administrador de la automotora puede eliminar unidades",
    out_of_scope: "Esa unidad no es de tu automotora",
    vehicle_not_found: "La unidad no existe",
    owner_name_required: "Falta identificar a quien entrega el vehículo",
    min_price_required: "Falta el precio mínimo autorizado por el dueño",
    purchase_price_required: "Falta el precio pagado al dueño",
    trade_in_value_required: "Falta el valor asignado al vehículo recibido en parte de pago",
    invalid_lien_status: "El estado de la prenda no es válido",
    invalid_commission_amount: "El monto fijo debe estar expresado en pesos chilenos enteros y ser mayor o igual a cero",
    ambiguous_commission: "Selecciona porcentaje o monto fijo, solo una modalidad de comisión",
    invalid_commission_pct: "La comisión debe ser un porcentaje entre 0 y 100",
    inventory_write_forbidden: "No tienes permisos para administrar el inventario",
    location_required: "Crea y selecciona una sucursal para ubicar el vehículo",
    invalid_location: "La sucursal no existe, está inactiva o pertenece a otra automotora",
  };
  return map[String(detail)] || "No pudimos guardar la unidad";
}
