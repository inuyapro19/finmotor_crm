"use client";

/**
 * Filtros del marketplace mayorista: COPIA de los componentes del marketplace de frontend-web
 * (`filters-sheet.tsx`, `vehicle-filters.tsx`, `vehicle-toolbar.tsx`, `active-filters.tsx`,
 * `pagination.tsx`), mismo markup y comportamiento (cada cambio se aplica al instante en la
 * URL; precio/año/km con debounce). Diferencias del canal: marca y región son textos (no hay
 * taxonomía con ids), no hay modelo/comuna ni "solo verificados" (toda unidad trae informe), y
 * todo navega a /mayorista conservando `proveedor` (enlace compartido).
 */
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Car, DollarSign, LayoutGrid, List, MapPin, SlidersHorizontal, X } from "lucide-react";

import { FILTER_KEYS, FUELS, MARKET_SORTS, TRANSMISSIONS } from "@/lib/wholesale";

const BASE = "/mayorista";

const BODY_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "car", label: "Auto" },
  { value: "suv", label: "SUV" },
  { value: "camioneta", label: "Camioneta" },
  { value: "pickup", label: "Pickup" },
  { value: "moto", label: "Moto" },
  { value: "van", label: "Van" },
  { value: "otro", label: "Otro" },
];
const BODY_LABELS: Record<string, string> = Object.fromEntries(BODY_TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

const selectClass =
  "flex h-10 w-full rounded-xl border px-3 py-2 text-sm transition-colors outline-none focus:border-[var(--fm-green-600)]";
const selectStyle = { borderColor: "var(--fm-border)", background: "var(--fm-bg)", color: "var(--fm-teal-600)" } as React.CSSProperties;
const inputClass = "h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-[var(--fm-green-600)]";
const inputStyle = { borderColor: "var(--fm-border)", background: "var(--fm-bg)", color: "var(--fm-teal-600)" } as React.CSSProperties;

function useMarketNavigation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const push = useCallback(
    (sp: URLSearchParams, scroll = false) => {
      const qs = sp.toString();
      router.push(qs ? `${BASE}?${qs}` : BASE, { scroll });
    },
    [router],
  );
  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "") sp.delete(key);
        else sp.set(key, value);
      }
      sp.delete("page");
      push(sp);
    },
    [searchParams, push],
  );
  /** Limpia filtros conservando el proveedor del enlace compartido. */
  const clearAll = useCallback(() => {
    const sp = new URLSearchParams();
    const proveedor = searchParams.get("proveedor");
    if (proveedor) sp.set("proveedor", proveedor);
    push(sp);
  }, [searchParams, push]);
  return { searchParams, updateParams, clearAll, push };
}

function useDebouncedCallback<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  }, [fn]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useCallback((...args: T) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(...args), delay);
  }, [delay]);
}

// ─────────────────────────────────────────────────────────────── FiltersSheet + VehicleFilters
export function MarketFiltersSheet({ brands, regions, totalCount }: { brands: string[]; regions: string[]; totalCount: number }) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const activeCount = ["q", ...FILTER_KEYS].filter((k) => searchParams.get(k)).length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors hover:border-[var(--fm-teal-300)] hover:bg-[var(--fm-teal-50)]"
        style={{ borderColor: "var(--fm-border)", background: "#fff", color: "var(--fm-teal-600)", cursor: "pointer" }}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filtros
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: "var(--fm-teal-600)" }}>
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Cerrar filtros" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />
          <aside role="dialog" aria-label="Filtros de búsqueda" className="absolute inset-y-0 left-0 w-[88%] shadow-2xl sm:max-w-md">
            <MarketFilters brands={brands} regions={regions} totalCount={totalCount} onClose={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

function MarketFilters({ brands, regions, totalCount, onClose }: { brands: string[]; regions: string[]; totalCount: number; onClose?: () => void }) {
  const { searchParams, updateParams, clearAll } = useMarketNavigation();

  // Estado local de los inputs con debounce; se re-sincroniza cuando la URL cambia desde afuera.
  const fromUrl = useCallback((k: string) => searchParams.get(k) || "", [searchParams]);
  const [local, setLocal] = useState(() => ({
    minPrice: fromUrl("minPrice"), maxPrice: fromUrl("maxPrice"),
    minYear: fromUrl("minYear"), maxYear: fromUrl("maxYear"), maxMileage: fromUrl("maxMileage"),
  }));
  const urlKey = searchParams.toString();
  const [syncedKey, setSyncedKey] = useState(urlKey);
  if (syncedKey !== urlKey) {
    setSyncedKey(urlKey);
    setLocal({
      minPrice: fromUrl("minPrice"), maxPrice: fromUrl("maxPrice"),
      minYear: fromUrl("minYear"), maxYear: fromUrl("maxYear"), maxMileage: fromUrl("maxMileage"),
    });
  }
  const debouncedUpdate = useDebouncedCallback((patch: Record<string, string | undefined>) => updateParams(patch), 500);
  const setNumber = (key: keyof typeof local) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    setLocal((l) => ({ ...l, [key]: value }));
    debouncedUpdate({ [key]: value || undefined });
  };

  const currentBrand = fromUrl("brand");
  const currentVehicleType = fromUrl("vehicleType");
  const currentFuelType = fromUrl("fuelType");
  const currentTransmission = fromUrl("transmission");
  const currentRegion = fromUrl("region");
  const hasAnyFilter = ["q", ...FILTER_KEYS].some((k) => searchParams.get(k));

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--fm-border)", background: "var(--fm-bg)" }}>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--fm-teal-600)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--fm-teal-600)" }}>Filtros</p>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "var(--fm-teal-50)", color: "var(--fm-teal-600)" }}>
            {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hasAnyFilter && (
            <button onClick={clearAll} className="text-xs font-medium transition-colors"
              style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--fm-ink-500)" }}>
              Limpiar
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Cerrar filtros"
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--fm-ink-100)]"
              style={{ border: 0, cursor: "pointer", color: "var(--fm-ink-500)" }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo scrollable */}
      <div className="flex-1 overflow-y-auto">
        {hasAnyFilter && (
          <div className="flex flex-wrap gap-1.5 border-b px-5 py-3" style={{ borderColor: "var(--fm-border)" }}>
            {searchParams.get("q") && <Chip onClick={() => updateParams({ q: undefined })}>&ldquo;{searchParams.get("q")}&rdquo;</Chip>}
            {currentBrand && <Chip onClick={() => updateParams({ brand: undefined })}>{currentBrand}</Chip>}
            {currentVehicleType && <Chip onClick={() => updateParams({ vehicleType: undefined })}>{BODY_LABELS[currentVehicleType] || "Tipo"}</Chip>}
            {currentFuelType && <Chip onClick={() => updateParams({ fuelType: undefined })}>{currentFuelType}</Chip>}
          </div>
        )}

        <div className="divide-y" style={{ borderColor: "var(--fm-border)" }}>
          <FilterSection label="Vehículo" icon={<Car className="h-3.5 w-3.5" />}>
            <select value={currentBrand} onChange={(e) => updateParams({ brand: e.target.value || undefined })}
              className={selectClass} style={selectStyle}>
              <option value="">Marca</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </FilterSection>

          <FilterSection label="Carrocería">
            <div className="grid grid-cols-2 gap-1.5">
              {BODY_TYPE_OPTIONS.map((t) => (
                <button key={t.value} onClick={() => updateParams({ vehicleType: t.value || undefined })}
                  className="rounded-lg py-2 text-xs font-medium transition-all"
                  style={{
                    border: "1px solid",
                    borderColor: currentVehicleType === t.value ? "var(--fm-teal-600)" : "var(--fm-border)",
                    background: currentVehicleType === t.value ? "var(--fm-teal-600)" : "#fff",
                    color: currentVehicleType === t.value ? "#fff" : "var(--fm-teal-600)",
                    cursor: "pointer",
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </FilterSection>

          <FilterSection label="Mecánica">
            <div className="grid grid-cols-2 gap-2">
              <select value={currentFuelType} onChange={(e) => updateParams({ fuelType: e.target.value || undefined })}
                className={selectClass} style={selectStyle}>
                <option value="">Combustible</option>
                {FUELS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <select value={currentTransmission} onChange={(e) => updateParams({ transmission: e.target.value || undefined })}
                className={selectClass} style={selectStyle}>
                <option value="">Transmisión</option>
                {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </FilterSection>

          <FilterSection label="Precio (CLP)" icon={<DollarSign className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-2 gap-2">
              <input inputMode="numeric" value={local.minPrice} onChange={setNumber("minPrice")} placeholder="Mínimo" className={inputClass} style={inputStyle} />
              <input inputMode="numeric" value={local.maxPrice} onChange={setNumber("maxPrice")} placeholder="Máximo" className={inputClass} style={inputStyle} />
            </div>
          </FilterSection>

          <FilterSection label="Año y Kilometraje" icon={<Calendar className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-2 gap-2">
              <input inputMode="numeric" maxLength={4} value={local.minYear} onChange={setNumber("minYear")} placeholder="Desde" className={inputClass} style={inputStyle} />
              <input inputMode="numeric" maxLength={4} value={local.maxYear} onChange={setNumber("maxYear")} placeholder="Hasta" className={inputClass} style={inputStyle} />
            </div>
            <input inputMode="numeric" value={local.maxMileage} onChange={setNumber("maxMileage")} placeholder="Km máximo"
              className={`${inputClass} mt-2`} style={inputStyle} />
          </FilterSection>

          <FilterSection label="Ubicación" icon={<MapPin className="h-3.5 w-3.5" />}>
            <select value={currentRegion} onChange={(e) => updateParams({ region: e.target.value || undefined })}
              className={selectClass} style={selectStyle}>
              <option value="">Región</option>
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </FilterSection>
        </div>
      </div>

      {onClose && (
        <div className="border-t p-4" style={{ borderColor: "var(--fm-border)" }}>
          <button onClick={onClose} className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--fm-green-600)", border: 0, cursor: "pointer" }}>
            Ver {totalCount} {totalCount === 1 ? "resultado" : "resultados"}
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
      style={{ background: "var(--fm-teal-50)", color: "var(--fm-teal-600)", border: 0, cursor: "pointer" }}>
      {children}
      <X className="h-3 w-3" />
    </button>
  );
}

function FilterSection({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--fm-ink-400)" }}>
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── VehicleToolbar
export function MarketToolbar({ total, showing, leading }: { total: number; showing: number; leading?: ReactNode }) {
  const { searchParams, updateParams } = useMarketNavigation();
  const currentSort = searchParams.get("sort") || "recent";
  const currentView = searchParams.get("view") || "grid";

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {leading}
        <p className="text-sm" style={{ color: "var(--fm-ink-500)" }}>
          Mostrando{" "}
          <span className="font-semibold" style={{ color: "var(--fm-teal-600)" }}>{showing}</span>{" "}
          de{" "}
          <span className="font-semibold" style={{ color: "var(--fm-teal-600)" }}>{total}</span>{" "}
          vehículos
        </p>
      </div>
      <div className="flex items-center gap-2">
        <select value={currentSort} onChange={(e) => updateParams({ sort: e.target.value === "recent" ? undefined : e.target.value })}
          className="h-9 rounded-xl border px-3 text-sm font-medium focus:outline-none"
          style={{ borderColor: "var(--fm-border)", background: "#fff", color: "var(--fm-teal-600)", minWidth: 200 }}>
          {MARKET_SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border" style={{ borderColor: "var(--fm-border)" }}>
          <button onClick={() => updateParams({ view: undefined })} aria-label="Cuadrícula"
            className="flex h-9 w-9 items-center justify-center transition-colors"
            style={{ background: currentView === "grid" ? "var(--fm-teal-600)" : "#fff", color: currentView === "grid" ? "#fff" : "var(--fm-ink-500)", border: 0, cursor: "pointer" }}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => updateParams({ view: "list" })} aria-label="Lista"
            className="flex h-9 w-9 items-center justify-center transition-colors"
            style={{ background: currentView === "list" ? "var(--fm-teal-600)" : "#fff", color: currentView === "list" ? "#fff" : "var(--fm-ink-500)", border: 0, cursor: "pointer", borderLeft: "1px solid var(--fm-border)" }}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── ActiveFilters
function clp(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toLocaleString("es-CL")}` : value;
}

export function MarketActiveFilters() {
  const { searchParams, updateParams, clearAll } = useMarketNavigation();
  const get = (k: string) => searchParams.get(k) || "";
  const remove = (...keys: string[]) => updateParams(Object.fromEntries(keys.map((k) => [k, undefined])));
  const chips: { label: string; onRemove: () => void }[] = [];

  if (get("q")) chips.push({ label: `“${get("q")}”`, onRemove: () => remove("q") });
  if (get("brand")) chips.push({ label: get("brand"), onRemove: () => remove("brand") });
  if (get("vehicleType")) chips.push({ label: BODY_LABELS[get("vehicleType")] || get("vehicleType"), onRemove: () => remove("vehicleType") });
  if (get("fuelType")) chips.push({ label: get("fuelType"), onRemove: () => remove("fuelType") });
  if (get("transmission")) chips.push({ label: get("transmission"), onRemove: () => remove("transmission") });
  if (get("region")) chips.push({ label: get("region"), onRemove: () => remove("region") });
  if (get("minPrice")) chips.push({ label: `Desde ${clp(get("minPrice"))}`, onRemove: () => remove("minPrice") });
  if (get("maxPrice")) chips.push({ label: `Hasta ${clp(get("maxPrice"))}`, onRemove: () => remove("maxPrice") });
  if (get("minYear")) chips.push({ label: `Desde ${get("minYear")}`, onRemove: () => remove("minYear") });
  if (get("maxYear")) chips.push({ label: `Hasta ${get("maxYear")}`, onRemove: () => remove("maxYear") });
  if (get("maxMileage")) chips.push({ label: `Máx ${Number(get("maxMileage")).toLocaleString("es-CL")} km`, onRemove: () => remove("maxMileage") });

  if (chips.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <button key={`${chip.label}-${i}`} onClick={chip.onRemove}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80"
          style={{ background: "var(--fm-teal-50)", color: "var(--fm-teal-600)", border: "1px solid var(--fm-teal-100)", cursor: "pointer" }}>
          {chip.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button onClick={clearAll} className="text-xs font-medium underline-offset-2 hover:underline"
        style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--fm-ink-500)" }}>
        Limpiar todo
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────── Pagination
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function MarketPagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const { searchParams, push } = useMarketNavigation();
  if (totalPages <= 1) return null;
  const navigateToPage = (page: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (page <= 1) sp.delete("page");
    else sp.set("page", String(page));
    push(sp, true);
  };
  const ghost = "inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50";
  return (
    <div className="mt-10 flex items-center justify-center gap-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <button className={ghost} disabled={currentPage <= 1} onClick={() => navigateToPage(currentPage - 1)}>
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Anterior</span>
      </button>
      <div className="flex items-center gap-1">
        {getPageNumbers(currentPage, totalPages).map((p, i) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${i}`} className="px-2 text-sm text-gray-400">...</span>
          ) : (
            <button key={p} onClick={() => navigateToPage(p)} disabled={p === currentPage}
              className={`flex h-9 min-w-[36px] items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === currentPage ? "bg-[var(--fm-teal-600)] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
              }`}>
              {p}
            </button>
          ),
        )}
      </div>
      <button className={ghost} disabled={currentPage >= totalPages} onClick={() => navigateToPage(currentPage + 1)}>
        <span className="hidden sm:inline">Siguiente</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
