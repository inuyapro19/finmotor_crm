"use client";

import Link from "next/link";
import { useDeferredValue, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

import type { OrganizationLocation, SortDirection, VehicleFilterOptions, VehicleSort } from "@/lib/data/crm";

type Option = { value: string; label: string };

type InventoryFilterValues = {
  q?: string;
  patent?: string;
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
};

const FIELD_CLASS = "h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function SearchableSelect({
  name,
  label,
  value: initialValue,
  options,
  allLabel = "Todos",
  clearNames = [],
}: {
  name: string;
  label: string;
  value?: string;
  options: Option[];
  allLabel?: string;
  clearNames?: string[];
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const selected = options.find((option) => option.value === value);
  const visibleOptions = deferredQuery
    ? options.filter((option) => normalize(option.label).includes(normalize(deferredQuery)))
    : options;
  const hiddenRef = useRef<HTMLInputElement>(null);

  // Aplica el filtro de inmediato (como un <select> nativo), en vez de dejar el valor
  // elegido "guardado" a la espera de que la persona note y presione "Aplicar" aparte.
  // Escribe el value directo en el DOM antes de requestSubmit: el estado de React todavía
  // no se re-renderizó en este mismo tick, así que leer el input via ref evita mandar el
  // valor anterior.
  const choose = (nextValue: string) => {
    setValue(nextValue);
    setOpen(false);
    setQuery("");
    if (hiddenRef.current) {
      hiddenRef.current.value = nextValue;
      for (const name of clearNames) {
        const field = hiddenRef.current.form?.elements.namedItem(name);
        if (field instanceof HTMLInputElement) field.value = "";
      }
      hiddenRef.current.form?.requestSubmit();
    }
  };

  return (
    <label className="block min-w-0 text-xs font-medium text-[var(--muted-foreground)]">
      <span className="mb-1.5 block">{label}</span>
      <span
        className="relative block"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <input ref={hiddenRef} type="hidden" name={name} value={value} />
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((current) => !current)}
          className={`${FIELD_CLASS} flex items-center justify-between gap-2 text-left font-normal text-[var(--foreground)]`}
        >
          <span className="truncate">{selected?.label ?? allLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
        </button>
        {open && (
          <span className="absolute left-0 top-full z-50 mt-1 block w-full min-w-[220px] rounded-lg border border-[var(--border)] bg-white p-1.5 shadow-[0_14px_35px_rgba(7,29,86,0.16)]">
            <span className="relative mb-1 block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Buscar ${label.toLowerCase()}`}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--muted)]/40 pl-8 pr-2 text-sm font-normal text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              />
            </span>
            <span role="listbox" className="block max-h-52 overflow-y-auto">
              {!deferredQuery && (
                <button type="button" onClick={() => choose("")} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm font-normal text-[var(--foreground)] hover:bg-[var(--muted)]">
                  {allLabel}{value === "" && <Check className="h-3.5 w-3.5 text-[var(--primary)]" />}
                </button>
              )}
              {visibleOptions.map((option) => (
                <button key={option.value} type="button" role="option" aria-selected={value === option.value} onClick={() => choose(option.value)} className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm font-normal text-[var(--foreground)] hover:bg-[var(--muted)]">
                  <span className="truncate">{option.label}</span>{value === option.value && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />}
                </button>
              ))}
              {visibleOptions.length === 0 && <span className="block px-2.5 py-3 text-center text-xs font-normal text-[var(--muted-foreground)]">Sin coincidencias</span>}
            </span>
          </span>
        )}
      </span>
    </label>
  );
}

export function InventoryFilters({
  values,
  options,
  locations,
  entrants,
  sort,
  direction,
  sortLabels,
  filterCount,
}: {
  values: InventoryFilterValues;
  options: VehicleFilterOptions;
  locations: OrganizationLocation[];
  entrants: { id: string; name: string }[];
  sort: VehicleSort;
  direction: SortDirection;
  sortLabels: Record<VehicleSort, string>;
  filterCount: number;
}) {
  const asOptions = (items: string[]): Option[] => items.map((item) => ({ value: item, label: item }));
  const brandNames = new Map(options.brands.map((brand) => [brand.id, brand.name]));
  const visibleModels = values.brandId
    ? options.models.filter((model) => model.brandId === values.brandId)
    : options.models;

  return (
    <form action="/vehiculos" className="border-b border-[var(--border)]">
      <div className="flex flex-col gap-2 p-3 sm:p-4 xl:flex-row xl:items-center">
        <label className="relative min-w-0 flex-1 xl:max-w-lg">
          <span className="sr-only">Buscar vehículo</span>
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" />
          <input name="q" defaultValue={values.q} placeholder="Buscar código, patente, marca o modelo" className="h-10 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10" />
        </label>
        <span className="inline-flex h-10 items-center justify-center rounded-lg bg-[#eef1f8] px-3 text-xs font-semibold text-[var(--fm-navy)]">{filterCount ? `${filterCount} filtros activos` : "Filtros visibles"}</span>
        <select name="sort" defaultValue={sort} aria-label="Ordenar inventario" className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]">
          {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>Ordenar por: {label}</option>)}
        </select>
        <select name="direction" defaultValue={direction} aria-label="Dirección del orden" className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]">
          <option value="desc">Mayor a menor</option>
          <option value="asc">Menor a mayor</option>
        </select>
        {(filterCount > 0 || sort !== "createdAt" || direction !== "desc") && <Link href="/vehiculos" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)]"><X className="h-3.5 w-3.5" />Limpiar</Link>}
        <button className="h-10 rounded-lg bg-[var(--fm-navy)] px-5 text-sm font-semibold text-white transition hover:bg-[#102b70]">Aplicar</button>
      </div>

      <div className="grid gap-3 border-t border-[var(--border)] bg-[#f8f8f5] p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4 2xl:grid-cols-6">
          <SearchableSelect name="brandId" label="Marca" value={values.brandId} options={options.brands.map((brand) => ({ value: brand.id, label: brand.name }))} allLabel="Todas las marcas" clearNames={["modelId"]} />
          <SearchableSelect name="modelId" label="Modelo" value={values.modelId} options={visibleModels.map((model) => ({ value: model.id, label: `${model.name} · ${brandNames.get(model.brandId) ?? "Sin marca"}` }))} allLabel="Todos los modelos" />
          <SearchableSelect name="year" label="Año" value={values.year} options={options.years.map((year) => ({ value: String(year), label: String(year) }))} allLabel="Todos los años" />
          <SearchableSelect name="locationId" label="Sucursal" value={values.locationId} options={locations.filter((location) => location.isActive).map((location) => ({ value: location.id, label: location.name }))} allLabel="Todas las sucursales" />
          <SearchableSelect name="enteredById" label="Ingresado por" value={values.enteredById} options={entrants.map((entrant) => ({ value: entrant.id, label: entrant.name }))} allLabel="Todo el equipo" />
          <SearchableSelect name="status" label="Estado" value={values.status} options={[
            { value: "PUBLISHED_ALL", label: "Todos los publicados" }, { value: "PUBLISHED", label: "Publicado" }, { value: "PUBLISHED_VERIFIED", label: "Publicado y verificado" }, { value: "RESERVED", label: "Reservado" }, { value: "DRAFT", label: "Borrador" }, { value: "PAUSED", label: "Pausado" }, { value: "SOLD", label: "Vendido" },
          ]} allLabel="Todos los estados" />
          <SearchableSelect name="kind" label="Procedencia" value={values.kind} options={[
            { value: "purchase", label: "Stock propio" }, { value: "consignment", label: "Consignado" }, { value: "trade_in", label: "Parte de pago" },
          ]} allLabel="Todas" />
          <SearchableSelect name="ownerName" label="Consignante / entrega" value={values.ownerName} options={asOptions(options.owners)} allLabel="Todas las personas" />
          <SearchableSelect name="lienStatus" label="Situación legal" value={values.lienStatus} options={[
            { value: "unknown", label: "Por verificar" }, { value: "clear", label: "Sin prenda" }, { value: "present", label: "Con prenda" }, { value: "pending_release", label: "Alzamiento pendiente" },
          ]} allLabel="Todas" />
          <label className="block text-xs font-medium text-[var(--muted-foreground)]"><span className="mb-1.5 block">Patente</span><input name="patent" defaultValue={values.patent} placeholder="Ej. ABCD12" className={FIELD_CLASS} /></label>
          <RangeFields label="Kilometraje" minName="minMileage" maxName="maxMileage" minValue={values.minMileage} maxValue={values.maxMileage} step="1000" />
          <RangeFields label="Precio de venta" minName="minPrice" maxName="maxPrice" minValue={values.minPrice} maxValue={values.maxPrice} step="100000" />
          <RangeFields label="Días en stock" minName="minStockDays" maxName="maxStockDays" minValue={values.minStockDays} maxValue={values.maxStockDays} />
      </div>
    </form>
  );
}

function RangeFields({ label, minName, maxName, minValue, maxValue, step = "1" }: { label: string; minName: string; maxName: string; minValue?: string; maxValue?: string; step?: string }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-[var(--muted-foreground)]">{label}</legend>
      <div className="grid grid-cols-2 gap-1.5">
        <input type="number" min="0" step={step} name={minName} defaultValue={minValue} placeholder="Desde" aria-label={`${label} desde`} className={FIELD_CLASS} />
        <input type="number" min="0" step={step} name={maxName} defaultValue={maxValue} placeholder="Hasta" aria-label={`${label} hasta`} className={FIELD_CLASS} />
      </div>
    </fieldset>
  );
}
