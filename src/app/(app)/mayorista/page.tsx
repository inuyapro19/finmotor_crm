import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Building2, Handshake, Search, Sparkles, X } from "lucide-react";

import { AutoRefresh } from "@/components/wholesale/auto-refresh";
import { MarketCard } from "@/components/wholesale/market/market-card";
import {
  MarketActiveFilters, MarketFiltersSheet, MarketPagination, MarketToolbar,
} from "@/components/wholesale/market/market-filters";
import { backendJson } from "@/lib/api/client";
import { canManageTeam } from "@/lib/auth/roles";
import { requireCrmSession } from "@/lib/auth/session";
import { FILTER_KEYS, MARKET_SORTS, type WholesaleListing } from "@/lib/wholesale";

/**
 * Marketplace mayorista: COPIA de la página /vehiculos de frontend-web
 * (`frontend-web/src/app/vehiculos/page.tsx`): mismo encabezado editorial, atajos, barra
 * (Filtros · contador · orden · vista), chips activos, franja destacada, grilla y paginación.
 * Cambia sólo el contenido propio del canal mayorista. Todo se resuelve desde la URL.
 */
type Query = Partial<Record<(typeof FILTER_KEYS)[number] | "q" | "sort" | "page" | "view" | "proveedor", string>>;

const PAGE_SIZE = 24;

function numberParam(value: string | undefined, min: number, max: number): string | null {
  const n = Number((value ?? "").replace(/\D/g, ""));
  return value && Number.isFinite(n) && n >= min && n <= max ? String(n) : null;
}

export default async function WholesaleMarketPage({ searchParams }: { searchParams: Promise<Query> }) {
  const session = await requireCrmSession();
  const canBuy = canManageTeam(session.role);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sort = MARKET_SORTS.some(([value]) => value === params.sort) ? params.sort! : "recent";

  const qs = new URLSearchParams({ page: String(page), sort, limit: String(PAGE_SIZE) });
  if (params.q?.trim()) qs.set("q", params.q.trim().slice(0, 100));
  // Enlace compartido por un proveedor: /mayorista?proveedor=<nombre> muestra sólo su stock.
  const supplier = params.proveedor?.trim().slice(0, 200) || null;
  if (supplier) qs.set("supplier", supplier);
  for (const key of ["brand", "vehicleType", "fuelType", "transmission", "region"] as const) {
    if (params[key]?.trim()) qs.set(key, params[key]!.trim().slice(0, 80));
  }
  // Los numéricos se envían sólo si son válidos: un año a medio escribir no debe romper la página.
  const numeric: [keyof Query, number, number][] = [
    ["minYear", 1950, 2100], ["maxYear", 1950, 2100], ["minPrice", 1, 10 ** 10], ["maxPrice", 1, 10 ** 10], ["maxMileage", 0, 10 ** 7],
  ];
  for (const [key, min, max] of numeric) {
    const value = numberParam(params[key], min, max);
    if (value) qs.set(key, value);
  }

  const data = await backendJson<{ items: WholesaleListing[]; total: number; limit: number; brands: string[]; regions?: string[] }>(
    `/wholesale/market/listings?${qs}`,
  );
  const total = data.total;
  const totalPages = Math.max(1, Math.ceil(total / data.limit));
  const hasAnyFilter = ["q", ...FILTER_KEYS].some((k) => params[k as keyof Query]);
  const withSupplier = (extra: string) => {
    const sp = new URLSearchParams(extra);
    if (supplier) sp.set("proveedor", supplier);
    const s = sp.toString();
    return s ? `/mayorista?${s}` : "/mayorista";
  };

  return (
    <div className="-mx-4 -my-5 sm:-mx-6" style={{ background: "var(--fm-bg)" }}>
      {/* ── Header editorial ── */}
      <section style={{ padding: "48px 0 32px", borderBottom: "1px solid var(--fm-border)", background: "#fff" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--fm-ink-500)" }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fm-ink-500)" }}>
                Marketplace proveedores
              </p>
              <h1 className="font-display" style={{ fontSize: "clamp(30px, 7vw, 52px)", margin: "8px 0 0", letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--fm-teal-600)" }}>
                <span>Encuentra</span> tu próximo auto
              </h1>
              <p style={{ fontSize: 14, color: "var(--fm-ink-500)", margin: "10px 0 0", maxWidth: 480 }}>
                {params.q
                  ? `Resultados para "${params.q}"`
                  : "Usados de proveedores verificados, sólo para automotoras. Cada unidad trae su informe histórico."}
              </p>
            </div>
            {/* Search */}
            <div className="flex min-w-0 flex-col gap-2 sm:items-end">
              <div className="flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 sm:w-auto sm:min-w-[320px]"
                style={{ background: "var(--fm-ink-100)", border: "1px solid var(--fm-border)" }}>
                <Search className="h-4 w-4 shrink-0" style={{ color: "var(--fm-ink-400)" }} />
                <form method="GET" action="/mayorista" className="flex min-w-0 flex-1 items-center gap-2">
                  {supplier && <input type="hidden" name="proveedor" value={supplier} />}
                  <input name="q" defaultValue={params.q || ""} placeholder="Marca, modelo o patente…"
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" style={{ height: 36, color: "var(--fm-teal-600)" }} />
                  <button type="submit" className="rounded-full px-4 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--fm-green-600)" }}>
                    Buscar
                  </button>
                </form>
              </div>
              <Link href="/mayorista/tratos" className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--fm-teal-600)" }}>
                <Handshake className="h-4 w-4" /> Compras adjudicadas y tratos anteriores
              </Link>
              <Link href="/mayorista/pujas" className="text-sm font-semibold underline">Mis pujas</Link>
            </div>
          </div>
          {/* Quick chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { label: "SUV", param: "vehicleType", value: "suv" },
              { label: "Hatchback", param: "vehicleType", value: "car" },
              { label: "Bajo kilometraje", param: "maxMileage", value: "50000" },
              { label: "Bencina", param: "fuelType", value: "Bencina" },
              { label: "Automático", param: "transmission", value: "Automatico" },
            ].map((c) => (
              <Link key={c.label} href={withSupplier(`${c.param}=${c.value}`)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-[var(--fm-teal-300)] hover:bg-[var(--fm-teal-50)]"
                style={{ borderColor: "var(--fm-border)", background: "#fff", color: "var(--fm-teal-600)" }}>
                {c.label}
              </Link>
            ))}
            {hasAnyFilter && (
              <Link href={withSupplier("")} className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium"
                style={{ borderColor: "var(--fm-border)", background: "#fff", color: "var(--fm-ink-500)" }}>
                <X className="h-3 w-3" /> Limpiar filtros
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {supplier && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4"
            style={{ background: "var(--fm-lime-50)", border: "1px solid var(--fm-lime-500)" }}>
            <p className="flex items-center gap-2 text-sm" style={{ color: "var(--fm-teal-600)" }}>
              <Building2 className="h-4 w-4" /> Estás viendo sólo el stock de{" "}
              <strong>{data.items[0]?.supplierName ?? supplier}</strong>
            </p>
            <Link href="/mayorista" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold"
              style={{ color: "var(--fm-teal-600)" }}>
              <X className="h-3 w-3" /> Ver todos los proveedores
            </Link>
          </div>
        )}

        {/* Barra de control: botón Filtros (drawer) + contador + orden + vista */}
        <Suspense>
          <MarketToolbar total={total} showing={data.items.length}
            leading={<MarketFiltersSheet brands={data.brands} regions={data.regions ?? []} totalCount={total} />} />
        </Suspense>
        {/* Filtros activos (los controles viven en el drawer, así que se ven aquí) */}
        <Suspense>
          <MarketActiveFilters />
        </Suspense>

        {data.items.length > 0 ? (
          <>
            {/* Featured strip */}
            <div className="mb-5 flex items-center justify-between rounded-2xl px-5 py-4"
              style={{ background: "linear-gradient(95deg, var(--fm-teal-600) 0%, var(--fm-teal-500) 100%)", color: "white" }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(182,232,74,0.2)", color: "var(--fm-lime-500)" }}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Negocia directo con el proveedor</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                    Oferta, contraoferta y, al cerrar, la unidad entra a tu stock publicada a nombre de tu automotora.
                  </p>
                </div>
              </div>
              <Link href="/mayorista/tratos" className="hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}>
                Mis negociaciones →
              </Link>
            </div>

            <div className={params.view === "list" ? "flex flex-col gap-4" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
              {data.items.map((item) => <MarketCard key={item.id} item={item} listView={params.view === "list"} canBuy={canBuy} />)}
            </div>

            <Suspense>
              <MarketPagination currentPage={page} totalPages={totalPages} />
            </Suspense>
            {/* Montos y "vas ganando / te superaron" al día mientras hay subastas abiertas. */}
            <AutoRefresh seconds={15} />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed p-16 text-center" style={{ borderColor: "var(--fm-border)", background: "#fff" }}>
            <h3 className="font-display text-xl font-bold" style={{ color: "var(--fm-teal-600)" }}>Aún no encontramos autos con esos filtros</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--fm-ink-500)" }}>Prueba ampliando la búsqueda o quitando algún filtro.</p>
            <Link href={withSupplier("")} className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium"
              style={{ borderColor: "var(--fm-ink-300)", color: "var(--fm-teal-600)" }}>
              Limpiar filtros
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
