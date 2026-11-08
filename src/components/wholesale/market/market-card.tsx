/**
 * Tarjeta del marketplace mayorista: COPIA de `VehicleCard` de frontend-web
 * (`frontend-web/src/components/vehicles/vehicle-card.tsx`), mismo markup y clases. Cambia
 * sólo lo propio del canal: el badge "Verificado" pasa a "Con informe" (toda unidad publicada
 * lo trae), "Con financiamiento" pasa al estado de TU negociación y el precio es el pedido
 * por el proveedor. Si cambia la tarjeta de la web, hay que replicar el cambio aquí.
 */
import Link from "next/link";
import { ArrowRight, Calendar, Car, Cog, FileCheck2, Fuel, Gauge, MapPin, MessageSquareMore } from "lucide-react";

import { QuickBid } from "@/components/wholesale/quick-bid";
import { DEAL_STATUS, REPORT_TIER_LABEL, VEHICLE_TYPES, type WholesaleListing } from "@/lib/wholesale";

const FALLBACK = "/vehicle-fallback-card.svg";

function formatPrice(price: number | null) {
  return "$" + new Intl.NumberFormat("es-CL").format(price ?? 0);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-CL").format(n);
}

function safeImageUrl(url: string | null | undefined) {
  const value = String(url ?? "").trim();
  return value.startsWith("http://") || value.startsWith("https://") ? value : FALLBACK;
}

function dealLabel(item: WholesaleListing): string | null {
  if (item.auction) {
    const labels = { open: "Subasta abierta", awarded: "Adjudicada", completed: "Completada", no_bids: "Sin pujas", cancelled: "Cancelada" };
    return labels[item.auction.status];
  }
  if (!item.myDeal) return null;
  return item.myDeal.awaitingMe ? "Te respondieron" : DEAL_STATUS[item.myDeal.status].label;
}

export function MarketCard({ item, listView = false, canBuy = false }: { item: WholesaleListing; listView?: boolean; canBuy?: boolean }) {
  const brandName = item.brand;
  const modelName = [item.model, item.versionName].filter(Boolean).join(" ");
  const imageUrl = safeImageUrl(item.coverUrl);
  const transmission = item.transmission === "Automatico" ? "Automático" : item.transmission;
  const vehicleTypeLabel = VEHICLE_TYPES.find(([v]) => v === item.vehicleType)?.[1] ?? null;
  const locationText = [item.locationCommune, item.locationRegion].filter(Boolean).join(", ");
  const primaryLocation = item.locationCommune ?? item.locationRegion ?? null;
  const secondaryLocation = item.locationCommune && item.locationRegion ? item.locationRegion : null;
  const reportLabel = item.report.tier ? `Informe ${REPORT_TIER_LABEL[item.report.tier]}` : "Con informe";
  const deal = dealLabel(item);
  const href = `/mayorista/${item.id}`;

  if (listView) {
    return (
      <Link href={href} className="group block">
        <div className="fm-card flex transition-all duration-200 hover:-translate-y-px" style={{ boxShadow: "var(--fm-sh-xs)" }}>
          <div className="relative w-48 shrink-0 overflow-hidden" style={{ background: "var(--fm-ink-100)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`${brandName} ${modelName}`}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
              <span className="fm-badge text-[10px] font-semibold shadow-sm" style={{ background: "var(--fm-green-600)", color: "var(--fm-white)" }}>
                <FileCheck2 className="h-2.5 w-2.5" /> {reportLabel}
              </span>
              {deal && (
                <span className="fm-badge text-[10px] font-semibold shadow-sm" style={{ background: "var(--fm-lime-500)", color: "var(--fm-navy)" }}>
                  <MessageSquareMore className="h-2.5 w-2.5" /> {deal}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-between p-4">
            <div>
              <p className="fm-eyebrow text-[11px]">{brandName}</p>
              <h3 className="fm-display text-base font-bold" style={{ color: "var(--fm-teal-600)" }}>{modelName}</h3>
              <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: "var(--fm-ink-500)" }}>
                {item.mileage != null && (
                  <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{formatNumber(item.mileage)} km</span>
                )}
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{item.year}</span>
                {item.fuelType && <span className="flex items-center gap-1"><Fuel className="h-3 w-3" />{item.fuelType}</span>}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--fm-border)" }}>
              <div>
                <p className="fm-display fm-num text-lg font-semibold" style={{ letterSpacing: "-0.01em", color: "var(--fm-teal-600)" }}>
                  {formatPrice(item.auction?.highestAmount ?? item.auction?.startingPrice ?? item.askingPrice)}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: "var(--fm-lime-50)", color: "var(--fm-green-700)" }}>
                  {item.supplierName ?? "Proveedor"}
                </span>
              </div>
              {item.auction?.status === "open" ? (
                <div className="w-56 shrink-0"><QuickBid listing={item} canBuy={canBuy} compact /></div>
              ) : locationText && (
                <p className="flex items-center gap-1 text-xs" style={{ color: "var(--fm-ink-400)" }}>
                  <MapPin className="h-3 w-3" />
                  {locationText}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} className="group block">
      <div className="fm-card flex h-full flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ boxShadow: "var(--fm-sh-xs)" }}>
        {/* Image */}
        <div className="relative aspect-[16/10] overflow-hidden" style={{ background: "var(--fm-ink-100)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`${brandName} ${modelName}`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          {/* Top-left badge */}
          <div className="absolute left-3 top-3">
            <span className="fm-badge text-[11px] font-semibold shadow-sm" style={{ background: "var(--fm-green-600)", color: "var(--fm-white)" }}>
              <FileCheck2 className="h-3 w-3" />
              {reportLabel}
            </span>
          </div>
          {/* Top-right badges (apiladas) */}
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            {deal && (
              <span className="fm-badge text-[11px] font-semibold shadow-sm" style={{ background: "var(--fm-lime-500)", color: "var(--fm-navy)" }}>
                <MessageSquareMore className="h-3 w-3" />
                {deal}
              </span>
            )}
            <span className="fm-badge text-[11px] font-semibold shadow-sm" style={{ background: "var(--fm-white)", color: "var(--fm-ink-700)" }}>
              Usado
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-5">
          <p className="fm-eyebrow text-[11px]" style={{ color: "var(--fm-ink-400)" }}>{brandName}</p>
          <h3 className="fm-display text-lg font-bold leading-snug" style={{ color: "var(--fm-teal-600)" }}>{modelName}</h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--fm-ink-400)" }}>
            {item.year}
            {item.color ? ` · ${item.color}` : ""}
          </p>

          {/* Ubicación */}
          {primaryLocation && (
            <div className="mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2" style={{ background: "var(--fm-lime-50)" }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--fm-green-600)" }}>
                <MapPin className="h-3 w-3" style={{ color: "var(--fm-white)" }} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold" style={{ color: "var(--fm-ink-700)" }}>
                  Disponible en {primaryLocation}
                </p>
                {secondaryLocation && (
                  <p className="truncate text-[11px]" style={{ color: "var(--fm-ink-400)" }}>{secondaryLocation}</p>
                )}
              </div>
            </div>
          )}

          {/* Precio */}
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              {item.auction && (
                <span className="block text-[10px]" style={{ color: "var(--fm-ink-400)" }}>
                  {item.auction.highestAmount == null ? "Precio base" : "Puja actual"}
                </span>
              )}
              <p className="fm-display fm-num text-xl font-bold" style={{ letterSpacing: "-0.01em", color: "var(--fm-teal-600)" }}>
                {formatPrice(item.auction?.highestAmount ?? item.auction?.startingPrice ?? item.askingPrice)}
              </p>
            </div>
            <p className="min-w-0 shrink text-right">
              <span className="block text-[10px]" style={{ color: "var(--fm-ink-400)" }}>proveedor</span>
              <span className="block truncate text-xs font-bold" style={{ color: "var(--fm-green-700)" }}>
                {item.supplierName ?? "—"}
              </span>
            </p>
          </div>

          {/* Specs */}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 text-xs" style={{ borderColor: "var(--fm-border)", color: "var(--fm-ink-500)" }}>
            {item.mileage != null && (
              <span className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" style={{ color: "var(--fm-ink-400)" }} />
                {formatNumber(item.mileage)} km
              </span>
            )}
            {transmission && (
              <span className="flex items-center gap-1.5">
                <Cog className="h-3.5 w-3.5" style={{ color: "var(--fm-ink-400)" }} />
                {transmission}
              </span>
            )}
            {item.fuelType && (
              <span className="flex items-center gap-1.5">
                <Fuel className="h-3.5 w-3.5" style={{ color: "var(--fm-ink-400)" }} />
                {item.fuelType}
              </span>
            )}
            {vehicleTypeLabel && (
              <span className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5" style={{ color: "var(--fm-ink-400)" }} />
                {vehicleTypeLabel}
              </span>
            )}
          </div>

          {/* CTA: puja en un clic (si hay subasta abierta) + la tarjeta sigue siendo el link a la ficha. */}
          <div className="mt-auto space-y-2 pt-4">
            {item.auction?.status === "open" && <QuickBid listing={item} canBuy={canBuy} compact />}
            <span className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--fm-border)] px-4 py-2 text-xs font-semibold text-[var(--fm-navy)] transition-colors duration-200 group-hover:border-[var(--fm-navy)] group-hover:bg-[var(--fm-navy)] group-hover:text-white">
              Ver ficha
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
