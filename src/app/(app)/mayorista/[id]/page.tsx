import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Car, Cog, Fuel, Gauge, MapPin, type LucideIcon } from "lucide-react";

import { MarketActions } from "@/components/wholesale/market/market-actions";
import { MarketDetailTabs } from "@/components/wholesale/market/market-detail-tabs";
import { MarketGallery } from "@/components/wholesale/market/market-gallery";
import { BackendError, backendJson } from "@/lib/api/client";
import { canManageTeam, requireCrmSession } from "@/lib/auth/session";
import { fmtDate, fmtPlate } from "@/lib/format";
import {
  LISTING_STATUS, REPORT_TIER_LABEL, VEHICLE_TYPES, type WholesaleDeal, type WholesaleListing,
} from "@/lib/wholesale";

/**
 * Ficha de una unidad mayorista: COPIA de la ficha de frontend-web
 * (`frontend-web/src/app/vehiculos/[id]/page.tsx`): barra de ruta, galería, bloque de título
 * con precio y chips, pestañas y, a la derecha, el panel "Avanza con tu compra" (aquí, la
 * negociación con el proveedor).
 */
function formatPrice(price: number | null) {
  return "$" + new Intl.NumberFormat("es-CL").format(price ?? 0);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CL").format(n);
}

export default async function WholesaleListingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmSession();
  const { id } = await params;
  let data: { listing: WholesaleListing; deal: WholesaleDeal | null };
  try {
    data = await backendJson(`/wholesale/market/listings/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof BackendError && [403, 404, 422].includes(error.status)) notFound();
    throw error;
  }
  const { listing: vehicle, deal } = data;
  const transmission = vehicle.transmission === "Automatico" ? "Automático" : vehicle.transmission;
  const vehicleTypeLabel = VEHICLE_TYPES.find(([v]) => v === vehicle.vehicleType)?.[1] ?? null;
  const location = [vehicle.locationCommune, vehicle.locationRegion].filter(Boolean).join(", ");
  const reportLabel = `Informe histórico${vehicle.report.tier ? ` ${REPORT_TIER_LABEL[vehicle.report.tier]}` : ""}`;
  const modelLabel = [vehicle.model, vehicle.versionName].filter(Boolean).join(" ");

  const specs = [
    ["Marca", vehicle.brand],
    ["Modelo", modelLabel],
    ["Año", String(vehicle.year)],
    vehicle.mileage != null ? ["Kilometraje", `${formatNumber(vehicle.mileage)} km`] : null,
    vehicle.fuelType ? ["Combustible", vehicle.fuelType] : null,
    transmission ? ["Transmisión", transmission] : null,
    vehicleTypeLabel ? ["Carrocería", vehicleTypeLabel] : null,
    vehicle.color ? ["Color", vehicle.color] : null,
    vehicle.doors ? ["Puertas", String(vehicle.doors)] : null,
    vehicle.engineNumber ? ["Motor", vehicle.engineNumber] : null,
    vehicle.vin ? ["VIN", vehicle.vin] : null,
    location ? ["Ubicación", location] : null,
    ["Patente", fmtPlate(vehicle.plate)],
    ["Código", vehicle.code],
    vehicle.publishedAt ? ["Publicado", fmtDate(vehicle.publishedAt)] : null,
  ].filter(Boolean) as [string, string][];

  const quickChips = [
    vehicle.mileage != null ? { icon: Gauge, text: `${formatNumber(vehicle.mileage)} km` } : null,
    { icon: Calendar, text: String(vehicle.year) },
    vehicle.fuelType ? { icon: Fuel, text: vehicle.fuelType } : null,
    transmission ? { icon: Cog, text: transmission } : null,
    vehicleTypeLabel ? { icon: Car, text: vehicleTypeLabel } : null,
    vehicle.locationRegion ? { icon: MapPin, text: vehicle.locationRegion } : null,
  ].filter(Boolean) as { icon: LucideIcon; text: string }[];

  const supplierName = vehicle.supplierName ?? "Proveedor";
  const supplierInitials = supplierName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="-mx-4 -my-5 sm:-mx-6" style={{ background: "var(--fm-bg)" }}>
      {/* Breadcrumb bar */}
      <div style={{ borderBottom: "1px solid var(--fm-border)", background: "#fff" }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-2 text-sm" style={{ color: "var(--fm-ink-500)" }}>
            <Link href="/mayorista" className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--fm-teal-600)]">
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="max-sm:sr-only">Marketplace proveedores</span>
            </Link>
            <span className="max-sm:hidden">/</span>
            <span className="truncate" style={{ color: "var(--fm-teal-600)" }}>{vehicle.brand} {vehicle.model}</span>
          </div>
          {vehicle.status !== "published" && (
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--fm-ink-100)", color: "var(--fm-ink-700)" }}>
              {LISTING_STATUS[vehicle.status].label}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-8 sm:pt-8 lg:pb-20">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-7">
          {/* LEFT — gallery + info */}
          <div className="min-w-0">
            <MarketGallery photos={vehicle.photos ?? []} alt={`${vehicle.brand} ${vehicle.model}`} year={vehicle.year} badge={reportLabel} />

            {/* Title block */}
            <div className="mt-6 sm:mt-7">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--fm-ink-500)" }}>
                {vehicle.brand} · {vehicle.year}
              </p>
              <h1 className="font-display mt-2" style={{ fontSize: "clamp(28px, 5vw, 44px)", letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--fm-teal-600)" }}>
                {modelLabel}
              </h1>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="fm-num" style={{ fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--fm-teal-600)" }}>
                  {formatPrice(vehicle.auction?.highestAmount ?? vehicle.auction?.startingPrice ?? vehicle.askingPrice)}
                </span>
                <span className="text-sm" style={{ color: "var(--fm-ink-500)" }}>· Patente {fmtPlate(vehicle.plate)}</span>
              </div>

              {/* Quick chips */}
              <div className="mt-4 flex flex-wrap gap-2">
                {quickChips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                    style={{ background: "#f0f2f4", color: "var(--fm-teal-600)" }}>
                    <chip.icon className="h-3 w-3" />
                    {chip.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <MarketDetailTabs
              specs={specs}
              description={vehicle.description}
              listingId={vehicle.id}
              report={vehicle.report}
              reportLabel={reportLabel}
              supplier={{ name: supplierName, initials: supplierInitials, locationName: vehicle.locationName, location: location || null }}
            />
          </div>

          {/* RIGHT — sticky sidebar */}
          <div className="min-w-0">
            <div className="space-y-4 lg:sticky lg:top-24">
              <MarketActions
                listing={vehicle}
                deal={deal}
                canBuy={canManageTeam(session.role)}
                vehicleLabel={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
                reportLabel={reportLabel}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
