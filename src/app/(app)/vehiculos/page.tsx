import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Boxes,
  Car,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Pencil,
  Plus,
  Star,
  Store,
} from "lucide-react";

import { InventoryFilters } from "@/components/stock/inventory-filters";
import { ScrollSyncedTable } from "@/components/stock/scroll-synced-table";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import {
  getAging,
  getAssignableAgents,
  getOrganizationLocations,
  getStockSummary,
  getVehicleFilterOptions,
  getVehicles,
  type SortDirection,
  type VehicleRow,
  type VehicleSort,
} from "@/lib/data/crm";
import { fmtCLP, fmtDate, fmtNumber, fmtPlate } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Publicado",
  PUBLISHED_VERIFIED: "Publicado y verificado",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  DRAFT: "Borrador",
  PAUSED: "Pausado",
  ARCHIVED: "Archivado",
};
const KIND_LABEL: Record<string, string> = {
  purchase: "Stock propio",
  consignment: "Consignado",
  trade_in: "Parte de pago",
};
const LIEN_LABEL: Record<string, string> = {
  unknown: "Por verificar",
  clear: "Sin prenda",
  present: "Con prenda",
  pending_release: "Alzamiento pendiente",
};
const SORT_LABEL: Record<VehicleSort, string> = {
  stockNumber: "Código de stock",
  createdAt: "Última creación",
  receivedAt: "Fecha de ingreso",
  stockDays: "Días en stock",
  price: "Precio de venta",
  brand: "Marca",
  model: "Modelo",
  ownerName: "Consignante",
  enteredBy: "Ingresado por",
  year: "Año",
  mileage: "Kilometraje",
  status: "Estado",
};
const SORT_VALUES = Object.keys(SORT_LABEL) as VehicleSort[];
const GRID_HEAD = "whitespace-nowrap border-b border-r border-[#203568] bg-[var(--fm-navy)] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white";
const GRID_CELL = "whitespace-nowrap border-b border-r border-[var(--border)] px-3 py-2.5 align-middle";

type VehicleSearchParams = {
  q?: string;
  patent?: string;
  brand?: string;
  model?: string;
  brandId?: string;
  modelId?: string;
  year?: string;
  status?: string;
  kind?: string;
  ownerName?: string;
  lienStatus?: string;
  locationId?: string;
  enteredById?: string;
  minMileage?: string;
  maxMileage?: string;
  minPrice?: string;
  maxPrice?: string;
  minStockDays?: string;
  maxStockDays?: string;
  sort?: string;
  direction?: string;
  page?: string;
};

function statusVariant(status: string | null) {
  if (status?.startsWith("PUBLISHED")) return "success" as const;
  if (status === "RESERVED") return "warn" as const;
  if (status === "SOLD") return "info" as const;
  return "neutral" as const;
}

function stockCode(value: number | null) {
  return value == null ? "—" : `STK-${String(value).padStart(6, "0")}`;
}

function daysInStock(vehicle: VehicleRow): number {
  const value = vehicle.receivedAt ?? vehicle.createdAt;
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function estimatedMargin(vehicle: VehicleRow): number | null {
  if (vehicle.price == null) return null;
  if (vehicle.acquisitionKind === "purchase" && vehicle.purchasePrice != null) return vehicle.price - vehicle.purchasePrice;
  if (vehicle.acquisitionKind === "consignment" && vehicle.commissionPct != null) return Math.round(vehicle.price * vehicle.commissionPct / 100);
  if (vehicle.acquisitionKind === "trade_in" && vehicle.minPrice != null) return vehicle.price - vehicle.minPrice;
  return null;
}

function nonNegativeNumber(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function nonNegativeInteger(value?: string): number | undefined {
  const parsed = nonNegativeNumber(value);
  return parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined;
}

function queryHref(params: VehicleSearchParams, changes: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  const result = query.toString();
  return `/vehiculos${result ? `?${result}` : ""}`;
}

function pageHref(params: VehicleSearchParams, page: number) {
  return queryHref(params, { page: String(page) });
}

/** URL absoluta de la ficha pública en el marketplace de frontend-web (mismo id que usa el CRM). */
function marketplaceHref(vehicleId: string) {
  const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:3000";
  return new URL(`/vehiculos/${vehicleId}`, webAppUrl).toString();
}

function exportHref(params: VehicleSearchParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && value) query.set(key, value);
  }
  return `/api/crm/vehicles/export?${query.toString()}`;
}

function SummaryCard({ icon, label, value, detail, alert = false }: { icon: React.ReactNode; label: string; value: string | number; detail: string; alert?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(7,29,86,0.03)] ${alert ? "border-amber-300" : "border-[var(--border)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</p>
        </div>
        <span className={`rounded-lg p-2 ${alert ? "bg-amber-100 text-amber-700" : "bg-[#eef1f8] text-[var(--fm-navy)]"}`}>{icon}</span>
      </div>
      <p className="mt-2 truncate text-[11px] text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

function SortableHead({ column, label, sort, direction, filters, className = "" }: { column: VehicleSort; label: string; sort: VehicleSort; direction: SortDirection; filters: VehicleSearchParams; className?: string }) {
  const active = sort === column;
  const nextDirection: SortDirection = active && direction === "asc" ? "desc" : "asc";
  return (
    <th className={`${GRID_HEAD} ${className}`}>
      <Link href={queryHref(filters, { sort: column, direction: nextDirection })} className="flex items-center gap-1.5 hover:text-[var(--fm-lime)]">
        {label}{active ? direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
      </Link>
    </th>
  );
}

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<VehicleSearchParams> }) {
  const filters = await searchParams;
  const session = await requireCrmSession();
  const canEdit = canWrite(session.role);
  const page = Math.max(1, Number(filters.page) || 1);
  const sort = SORT_VALUES.includes(filters.sort as VehicleSort) ? filters.sort as VehicleSort : "createdAt";
  const direction: SortDirection = filters.direction === "asc" ? "asc" : "desc";
  const minPrice = nonNegativeNumber(filters.minPrice);
  const maxPrice = nonNegativeNumber(filters.maxPrice);
  const year = nonNegativeInteger(filters.year);
  const minMileage = nonNegativeInteger(filters.minMileage);
  const maxMileage = nonNegativeInteger(filters.maxMileage);
  const minStockDays = nonNegativeInteger(filters.minStockDays);
  const maxStockDays = nonNegativeInteger(filters.maxStockDays);
  const navigationFilters = { ...filters, sort, direction };
  const filterCount = [filters.q, filters.patent, filters.brandId, filters.modelId, year, filters.status, filters.kind, filters.ownerName, filters.lienStatus, filters.locationId, filters.enteredById, minMileage, maxMileage, minPrice, maxPrice, minStockDays, maxStockDays]
    .filter((value) => value !== undefined && value !== "").length;

  const [summary, aging, vehicles, locations, filterOptions, entrants] = await Promise.all([
    getStockSummary(),
    getAging(),
    getVehicles({
      q: filters.q,
      patent: filters.patent,
      brand: filters.brand,
      model: filters.model,
      brandId: filters.brandId,
      modelId: filters.modelId,
      year,
      status: filters.status,
      acquisitionKind: filters.kind,
      ownerName: filters.ownerName,
      lienStatus: filters.lienStatus,
      locationId: filters.locationId,
      enteredById: filters.enteredById,
      minMileage,
      maxMileage,
      minPrice,
      maxPrice,
      minStockDays,
      maxStockDays,
      sort,
      direction,
      page,
      limit: 50,
    }),
    getOrganizationLocations(session.dealership.id),
    getVehicleFilterOptions(),
    getAssignableAgents(session),
  ]);
  if (page > vehicles.totalPages) redirect(pageHref(navigationFilters, vehicles.totalPages));
  const pageValue = vehicles.items.reduce((total, vehicle) => total + (vehicle.price ?? 0), 0);
  const staleCount = aging.buckets.d60_plus;

  return (
    <>
      <PageHeader
        title="Stock de vehículos"
        subtitle="Control operativo por unidad y sucursal"
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <a href={exportHref(navigationFilters)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3.5 text-sm font-medium transition hover:border-[var(--primary)]">
              <Download className="h-4 w-4 text-[var(--primary)]" />Exportar Excel
            </a>
            {canEdit && <Link href="/vehiculos/create" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-3.5 text-sm font-semibold text-white transition hover:bg-[var(--fm-green-700)]"><Plus className="h-4 w-4" />Ingresar vehículo</Link>}
          </div>
        )}
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <SummaryCard icon={<Boxes className="h-4 w-4" />} label="Unidades" value={summary?.total ?? vehicles.total} detail={`${summary?.published ?? 0} publicadas · ${summary?.reserved ?? 0} reservadas`} />
        <SummaryCard icon={<CircleDollarSign className="h-4 w-4" />} label="Valor inventario" value={fmtCLP(summary?.inventoryValue ?? 0)} detail="Precio de venta acumulado" />
        <SummaryCard icon={<Store className="h-4 w-4" />} label="Stock propio" value={summary?.ownCount ?? 0} detail={fmtCLP(summary?.ownValue ?? 0)} />
        <SummaryCard icon={<Car className="h-4 w-4" />} label="Consignados" value={summary?.consignedCount ?? 0} detail={fmtCLP(summary?.consignedValue ?? 0)} />
        <SummaryCard icon={<Clock3 className="h-4 w-4" />} label="Rotación promedio" value={`${aging.avgDays} días`} detail={staleCount ? `${staleCount} unidades sobre 60 días` : "Sin unidades estancadas"} alert={staleCount > 0} />
      </div>

      <Panel className="overflow-visible">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            <h2 className="text-sm font-semibold">Inventario general</h2>
            <p className="text-xs text-[var(--muted-foreground)]">{vehicles.total} {vehicles.total === 1 ? "unidad encontrada" : "unidades encontradas"}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Link href="/vehiculos" className={`rounded-md px-2.5 py-1.5 font-medium ${!filters.status && !filters.minStockDays ? "bg-[var(--fm-navy)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>Todo</Link>
            <Link href={queryHref(filters, { status: "PUBLISHED_ALL", minStockDays: undefined, page: undefined })} className={`rounded-md px-2.5 py-1.5 font-medium ${filters.status === "PUBLISHED_ALL" ? "bg-[var(--fm-navy)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>Publicados</Link>
            <Link href={queryHref(filters, { status: "RESERVED", minStockDays: undefined, page: undefined })} className={`rounded-md px-2.5 py-1.5 font-medium ${filters.status === "RESERVED" ? "bg-[var(--fm-navy)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>Reservados</Link>
            <Link href={queryHref(filters, { status: undefined, minStockDays: "61", page: undefined })} className={`rounded-md px-2.5 py-1.5 font-medium ${filters.minStockDays === "61" && !filters.status ? "bg-amber-100 text-amber-800" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>+60 días</Link>
          </div>
        </div>

        <InventoryFilters key={JSON.stringify(filters)} values={filters} options={filterOptions} locations={locations} entrants={entrants} sort={sort} direction={direction} sortLabels={SORT_LABEL} filterCount={filterCount} />

        <ScrollSyncedTable
          maxHeightClass="max-h-[62vh]"
          footer={
            <div className="flex flex-col gap-3 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[var(--muted-foreground)]">
                <span className="inline-flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" />Mostrando <strong className="text-[var(--foreground)]">{vehicles.items.length}</strong> de {vehicles.total}</span>
                <span>Valor en esta página: <strong className="text-[var(--foreground)]">{fmtCLP(pageValue)}</strong></span>
                <span>Página {vehicles.page} de {vehicles.totalPages}</span>
              </div>
              {vehicles.totalPages > 1 && (
                <div className="flex gap-2">
                  {vehicles.page > 1 && <Link href={pageHref(navigationFilters, vehicles.page - 1)} className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-medium"><ArrowLeft className="h-3.5 w-3.5" />Anterior</Link>}
                  {vehicles.page < vehicles.totalPages && <Link href={pageHref(navigationFilters, vehicles.page + 1)} className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-medium">Siguiente<ArrowRight className="h-3.5 w-3.5" /></Link>}
                </div>
              )}
            </div>
          }
        >
          <table className="min-w-[2960px] border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20">
              <tr>
                {/* Identidad: fija (código/patente) + marca/modelo/año. */}
                <SortableHead column="stockNumber" label="Código" sort={sort} direction={direction} filters={navigationFilters} className="sticky left-0 z-30 w-[112px] min-w-[112px]" />
                <th className={`${GRID_HEAD} sticky left-[112px] z-30 w-[118px] min-w-[118px]`}>Patente</th>
                <SortableHead column="brand" label="Marca" sort={sort} direction={direction} filters={navigationFilters} className="w-[135px] min-w-[135px]" />
                <SortableHead column="model" label="Modelo" sort={sort} direction={direction} filters={navigationFilters} className="w-[165px] min-w-[165px]" />
                <SortableHead column="year" label="Año" sort={sort} direction={direction} filters={navigationFilters} className="w-[75px] min-w-[75px]" />
                {/* Comercial: lo que se escanea primero (precio, disponibilidad, rentabilidad). */}
                <SortableHead column="price" label="Precio venta" sort={sort} direction={direction} filters={navigationFilters} className="w-[140px] min-w-[140px] text-right" />
                <SortableHead column="status" label="Estado" sort={sort} direction={direction} filters={navigationFilters} className="w-[165px] min-w-[165px]" />
                <th className={`${GRID_HEAD} w-[135px] min-w-[135px] text-right`}>Costo / mínimo</th>
                <th className={`${GRID_HEAD} w-[140px] min-w-[140px] text-right`}>Margen est.</th>
                {/* Condición y rotación. */}
                <SortableHead column="mileage" label="Kilometraje" sort={sort} direction={direction} filters={navigationFilters} className="w-[125px] min-w-[125px]" />
                <SortableHead column="stockDays" label="Días stock" sort={sort} direction={direction} filters={navigationFilters} className="w-[105px] min-w-[105px]" />
                {/* Especificaciones técnicas. */}
                <th className={`${GRID_HEAD} w-[105px] min-w-[105px]`}>Tipo</th>
                <th className={`${GRID_HEAD} w-[110px] min-w-[110px]`}>Combustible</th>
                <th className={`${GRID_HEAD} w-[115px] min-w-[115px]`}>Transmisión</th>
                <th className={`${GRID_HEAD} w-[105px] min-w-[105px]`}>Color</th>
                {/* Procedencia y logística. */}
                <th className={`${GRID_HEAD} w-[140px] min-w-[140px]`}>Procedencia</th>
                <th className={`${GRID_HEAD} w-[135px] min-w-[135px]`}>Situación legal</th>
                <th className={`${GRID_HEAD} w-[150px] min-w-[150px]`}>Sucursal</th>
                <th className={`${GRID_HEAD} w-[175px] min-w-[175px]`}>Consignante / entrega</th>
                <th className={`${GRID_HEAD} w-[105px] min-w-[105px]`}>Estac.</th>
                {/* Administrativo / referencia: lo que casi nunca se necesita al escanear. */}
                <SortableHead column="receivedAt" label="Ingreso" sort={sort} direction={direction} filters={navigationFilters} className="w-[105px] min-w-[105px]" />
                <SortableHead column="enteredBy" label="Ingresado por" sort={sort} direction={direction} filters={navigationFilters} className="w-[155px] min-w-[155px]" />
                <th className={`${GRID_HEAD} w-[155px] min-w-[155px]`}>VIN / Chasis</th>
                <th className={`${GRID_HEAD} sticky right-0 z-30 w-[164px] min-w-[164px] text-center`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.items.length === 0 ? (
                <tr><td colSpan={24} className="border-b border-[var(--border)] bg-white"><EmptyState icon={<Car className="h-6 w-6" />} title="No hay unidades para esta vista" description="Cambia los filtros o ingresa un nuevo vehículo al stock." /></td></tr>
              ) : vehicles.items.map((vehicle, index) => {
                const margin = estimatedMargin(vehicle);
                const base = vehicle.acquisitionKind === "purchase" ? vehicle.purchasePrice : vehicle.minPrice;
                const stockDays = daysInStock(vehicle);
                return (
                  <tr key={vehicle.id} className={`${index % 2 ? "bg-[#fbfbf9]" : "bg-white"} transition-colors hover:bg-[#eef4e9]`}>
                    <td className={`${GRID_CELL} sticky left-0 z-10 bg-inherit font-mono text-[11px] font-bold text-[var(--primary)]`}>{stockCode(vehicle.stockNumber)}</td>
                    <td className={`${GRID_CELL} sticky left-[112px] z-10 bg-inherit font-mono text-sm font-bold tracking-wide`}>
                      <span className="inline-flex items-center gap-1">
                        {fmtPlate(vehicle.patent)}
                        {vehicle.salePriority && (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Prioridad de venta" />
                        )}
                      </span>
                    </td>
                    <td className={`${GRID_CELL} font-semibold`}>{vehicle.brand || "—"}</td>
                    <td className={GRID_CELL}>{vehicle.model || "—"}</td>
                    <td className={`${GRID_CELL} text-center tabular-nums`}>{vehicle.year ?? "—"}</td>
                    <td className={`${GRID_CELL} text-right font-bold tabular-nums`}>{fmtCLP(vehicle.price)}</td>
                    <td className={GRID_CELL}><Pill variant={statusVariant(vehicle.status)}>{STATUS_LABEL[vehicle.status ?? ""] ?? vehicle.status ?? "—"}</Pill></td>
                    <td className={`${GRID_CELL} text-right font-medium tabular-nums`}>{fmtCLP(base)}</td>
                    <td className={`${GRID_CELL} text-right font-semibold tabular-nums ${margin != null && margin < 0 ? "text-red-600" : "text-[var(--primary)]"}`}>{fmtCLP(margin)}</td>
                    <td className={`${GRID_CELL} text-right tabular-nums`}>{vehicle.mileage == null ? "—" : `${fmtNumber(vehicle.mileage)} km`}</td>
                    <td className={`${GRID_CELL} text-right tabular-nums`}><span className={`inline-flex min-w-10 justify-center rounded px-2 py-1 font-semibold ${stockDays > 60 ? "bg-red-50 text-red-700" : stockDays > 30 ? "bg-amber-50 text-amber-700" : "bg-[var(--muted)] text-[var(--foreground)]"}`}>{stockDays}</span></td>
                    <td className={GRID_CELL}>{vehicle.vehicleType || "—"}</td>
                    <td className={GRID_CELL}>{vehicle.fuelType || "—"}</td>
                    <td className={GRID_CELL}>{vehicle.transmission || "—"}</td>
                    <td className={GRID_CELL}>{vehicle.color || "—"}</td>
                    <td className={GRID_CELL}><Pill variant={vehicle.acquisitionKind === "consignment" ? "warn" : "neutral"}>{KIND_LABEL[vehicle.acquisitionKind ?? ""] ?? "Sin registrar"}</Pill></td>
                    <td className={GRID_CELL}>{LIEN_LABEL[vehicle.lienStatus ?? "unknown"]}</td>
                    <td className={`${GRID_CELL} max-w-[150px] overflow-hidden text-ellipsis`} title={vehicle.inventoryLocation ?? undefined}>{vehicle.inventoryLocation || "Sin ubicación"}</td>
                    <td className={`${GRID_CELL} max-w-[175px] overflow-hidden text-ellipsis font-medium`} title={vehicle.ownerName ?? undefined}>{vehicle.ownerName || "Sin registrar"}</td>
                    <td className={`${GRID_CELL} text-center font-mono font-bold text-[var(--fm-navy)]`} title={vehicle.parkingNumber == null ? `Detailing: ${vehicle.detailingStatus} · Fotos: ${vehicle.photosStatus}` : undefined}>{vehicle.parkingNumber != null ? `E-${String(vehicle.parkingNumber).padStart(3, "0")}` : vehicle.detailingStatus !== "completed" || vehicle.photosStatus !== "completed" ? "Pendiente" : vehicle.parkingCapacity === 0 ? "No config." : "Sin cupo"}</td>
                    <td className={GRID_CELL}>{fmtDate(vehicle.receivedAt ?? vehicle.createdAt)}</td>
                    <td className={`${GRID_CELL} font-medium`}>{vehicle.enteredByName || "Sin registrar"}</td>
                    <td className={`${GRID_CELL} max-w-[155px] overflow-hidden text-ellipsis font-mono`} title={vehicle.vin ?? undefined}>{vehicle.vin || "—"}</td>
                    <td className={`${GRID_CELL} sticky right-0 z-10 bg-inherit`}>
                      <div className="flex justify-center gap-1">
                        <a href={marketplaceHref(vehicle.id)} target="_blank" rel="noopener noreferrer" aria-label={`Ver ficha de ${vehicle.patent} en el marketplace`} title="Ver ficha en el marketplace" className="inline-flex rounded-md border border-[var(--border)] bg-white p-2 hover:border-[var(--primary)]"><ExternalLink className="h-3.5 w-3.5" /></a>
                        {vehicle.acquisitionId && <a href={`/api/crm/acquisitions/${vehicle.acquisitionId}/contract`} target="_blank" rel="noopener noreferrer" aria-label={`Contrato ${vehicle.patent}`} title="Ver contrato" className="inline-flex rounded-md border border-[var(--border)] bg-white p-2 hover:border-[var(--primary)]"><FileText className="h-3.5 w-3.5" /></a>}
                        {vehicle.acquisitionId && <a href={`/api/crm/acquisitions/${vehicle.acquisitionId}/inspection`} target="_blank" rel="noopener noreferrer" aria-label={`Inspección ${vehicle.patent}`} title="Imprimir inspección" className="inline-flex rounded-md border border-[var(--border)] bg-white p-2 hover:border-[var(--primary)]"><ClipboardCheck className="h-3.5 w-3.5" /></a>}
                        {canEdit && <Link href={`/vehiculos/editar/${vehicle.id}`} aria-label={`Editar ${vehicle.patent}`} title="Editar vehículo" className="inline-flex rounded-md border border-[var(--border)] bg-white p-2 hover:border-[var(--primary)]"><Pencil className="h-3.5 w-3.5" /></Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollSyncedTable>
      </Panel>
    </>
  );
}

export const dynamic = "force-dynamic";
