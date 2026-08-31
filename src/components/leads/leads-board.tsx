import Link from "next/link";
import { clsx } from "clsx";
import { ArrowLeft, ArrowRight, CircleAlert, Inbox, Search, X } from "lucide-react";

import { LeadExecutiveCard, LeadExecutiveRow } from "@/components/leads/lead-executive-row";
import { EmptyState } from "@/components/ui/primitives";
import type {
  LeadListResult,
  LeadListSort,
  OrganizationLocation,
} from "@/lib/data/crm";
import { fmtCLP } from "@/lib/format";
import { sourceLabel, STAGES, type LeadStage } from "@/lib/leads";

export type LeadBoardFilters = {
  q?: string;
  estado?: LeadStage;
  responsable?: string;
  atraso?: "1";
  origen?: string;
  sucursal?: string;
  orden: LeadListSort;
  page: number;
};

const SORTS: { key: LeadListSort; label: string }[] = [
  { key: "urgency", label: "Urgencia" },
  { key: "progress", label: "Avance" },
  { key: "value", label: "Monto" },
  { key: "recent", label: "Más reciente" },
];
const INPUT = "h-10 min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]";

export function leadListHref(
  filters: LeadBoardFilters,
  changes: Partial<Record<keyof LeadBoardFilters, string | number | undefined>> = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== "page" && value) query.set(key, String(value));
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value) query.set(key, String(value));
    else query.delete(key);
  }
  const value = query.toString();
  return `/solicitudes${value ? `?${value}` : ""}`;
}

export function LeadsBoard({
  result,
  filters,
  agents,
  locations,
  currentUserId,
  showAssignee,
  dealershipName,
  portfolioRestricted,
}: {
  result: LeadListResult;
  filters: LeadBoardFilters;
  agents: { id: string; name: string }[];
  locations: OrganizationLocation[];
  currentUserId: string;
  showAssignee: boolean;
  dealershipName: string;
  portfolioRestricted: boolean;
}) {
  const { leads, pagination, summary, facets, error } = result;
  const sourceOptions = Array.from(new Set([
    ...facets.sources,
    ...(filters.origen ? [filters.origen] : []),
  ])).sort((a, b) => sourceLabel(a).localeCompare(sourceLabel(b), "es"));
  const stageTotal = Object.values(facets.byStage).reduce((total, count) => total + count, 0);
  const hasFilters = Boolean(
    filters.q || filters.estado || filters.responsable || filters.atraso || filters.origen || filters.sucursal,
  );

  return (
    <div className="space-y-3">
      <form action="/solicitudes" method="get" className="space-y-2">
        {filters.estado && <input type="hidden" name="estado" value={filters.estado} />}
        {filters.atraso && <input type="hidden" name="atraso" value={filters.atraso} />}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Buscar por nombre, teléfono, patente…"
              className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] pl-9 pr-9 text-sm outline-none focus:border-[var(--primary)]"
            />
            {filters.q && (
              <Link
                href={leadListHref(filters, { q: undefined })}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="h-4 w-4" />
              </Link>
            )}
          </div>
          <button className="h-10 rounded-lg bg-[var(--fm-navy)] px-4 text-sm font-semibold text-white">
            Buscar
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {showAssignee && (
            <select name="responsable" defaultValue={filters.responsable ?? ""} className={INPUT} aria-label="Responsable">
              <option value="">Todos los responsables</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
            </select>
          )}
          <select name="origen" defaultValue={filters.origen ?? ""} className={INPUT} aria-label="Origen">
            <option value="">Todos los orígenes</option>
            {sourceOptions.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
          </select>
          <select name="sucursal" defaultValue={filters.sucursal ?? ""} className={INPUT} aria-label="Sucursal">
            <option value="">Todas las sucursales</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
          <select name="orden" defaultValue={filters.orden} className={INPUT} aria-label="Orden">
            {SORTS.map((sort) => <option key={sort.key} value={sort.key}>Orden: {sort.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button className="h-10 flex-1 rounded-lg border border-[var(--border)] bg-white px-4 text-sm font-semibold hover:border-[var(--primary)]">
              Aplicar
            </button>
            {(hasFilters || filters.orden !== "urgency") && (
              <Link href="/solicitudes" className="flex h-10 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-sm">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <QuickChip
          href={leadListHref(filters, { estado: filters.estado === "new" ? undefined : "new" })}
          label="Sin contactar"
          count={facets.byStage.new ?? 0}
          active={filters.estado === "new"}
          tone="alert"
        />
        <QuickChip
          href={leadListHref(filters, { atraso: filters.atraso ? undefined : "1" })}
          label="Compromiso vencido"
          count={summary.overdueCount}
          active={filters.atraso === "1"}
          tone="alert"
        />
        {showAssignee && (
          <QuickChip
            href={leadListHref(filters, { responsable: filters.responsable === currentUserId ? undefined : currentUserId })}
            label="Mías"
            active={filters.responsable === currentUserId}
          />
        )}
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2">
          <StageChip
            href={leadListHref(filters, { estado: undefined })}
            label="Todas"
            count={stageTotal || summary.scopeTotal}
            active={!filters.estado}
          />
          {STAGES.map((stage) => (
            <StageChip
              key={stage.key}
              href={leadListHref(filters, { estado: filters.estado === stage.key ? undefined : stage.key })}
              label={stage.short}
              count={facets.byStage[stage.key] ?? 0}
              active={filters.estado === stage.key}
            />
          ))}
        </div>
      </div>

      {!error && summary.scopeTotal > 0 && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
          <p className="text-xs text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">{pagination.total}</span>{" "}
            {pagination.total === 1 ? "solicitud" : "solicitudes"}
            {summary.slaLateCount > 0 && <span className="text-red-600"> · {summary.slaLateCount} fuera de plazo</span>}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            En juego <span className="font-semibold tabular-nums text-[var(--foreground)]">{fmtCLP(summary.valueInPlay)}</span>
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {error ? (
          <LeadListError error={error} retryHref={leadListHref(filters, { page: filters.page })} />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title={summary.scopeTotal === 0 ? "Sin solicitudes" : "Nada con esos filtros"}
            description={summary.scopeTotal === 0
              ? portfolioRestricted
                ? "Cuando te asignen una solicitud, aparecerá aquí para que puedas gestionarla."
                : `Las solicitudes de ${dealershipName} aparecerán aquí cuando un cliente deje sus datos o registres una atención en el local.`
              : "La cartera sí tiene solicitudes. Prueba quitando algún filtro o cambiando la búsqueda."}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className={clsx("w-full border-collapse text-left", showAssignee ? "min-w-[1320px]" : "min-w-[1160px]")}>
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[#f3f5fa] text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                    <th className="w-[220px] px-4 py-3">Lead / cliente</th>
                    <th className="w-[145px] px-3 py-3">Canal</th>
                    <th className="w-[165px] px-3 py-3">Contacto</th>
                    <th className="w-[220px] px-3 py-3">Vehículo / negocio</th>
                    <th className="w-[210px] px-3 py-3">Avance comercial</th>
                    <th className="w-[180px] px-3 py-3">Próximo paso</th>
                    {showAssignee && <th className="w-[145px] px-3 py-3">Ejecutivo</th>}
                    <th className="w-[52px] px-3 py-3"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => <LeadExecutiveRow key={lead.id} lead={lead} showAssignee={showAssignee} />)}
                </tbody>
              </table>
            </div>
            <div className="md:hidden">
              {leads.map((lead) => <LeadExecutiveCard key={lead.id} lead={lead} showAssignee={showAssignee} />)}
            </div>
          </>
        )}

        {!error && pagination.total > 0 && (
          <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[var(--muted-foreground)]">
              Mostrando <strong className="text-[var(--foreground)]">{leads.length}</strong> de {pagination.total} · Página {pagination.page} de {pagination.totalPages}
            </p>
            {pagination.totalPages > 1 && (
              <div className="flex gap-2">
                {pagination.page > 1 && (
                  <Link href={leadListHref(filters, { page: pagination.page - 1 })} className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-medium">
                    <ArrowLeft className="h-3.5 w-3.5" />Anterior
                  </Link>
                )}
                {pagination.hasNext && (
                  <Link href={leadListHref(filters, { page: pagination.page + 1 })} className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-medium">
                    Siguiente<ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LeadListError({ error, retryHref }: { error: NonNullable<LeadListResult["error"]>; retryHref: string }) {
  const copy = {
    forbidden: {
      title: "No tienes acceso a esta bandeja",
      description: "Tu sesión no tiene permiso para consultar las solicitudes de esta automotora.",
    },
    unavailable: {
      title: "La bandeja no está disponible temporalmente",
      description: "El servicio de solicitudes no respondió. Intenta nuevamente en unos momentos.",
    },
    unexpected: {
      title: "No pudimos cargar la bandeja",
      description: "Ocurrió un problema inesperado al consultar las solicitudes.",
    },
  }[error];

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <CircleAlert className="mb-3 h-6 w-6 text-amber-600" />
      <p className="text-sm font-medium">{copy.title}</p>
      <p className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">{copy.description}</p>
      <a href={retryHref} className="mt-4 rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--primary)]">
        Reintentar
      </a>
    </div>
  );
}

function StageChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[var(--primary)]/40",
      )}
    >
      {label}
      <span className={clsx("tabular-nums", active ? "text-white/70" : "text-[var(--muted-foreground)]/70")}>{count}</span>
    </Link>
  );
}

function QuickChip({
  href,
  label,
  count,
  active,
  tone = "neutral",
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  tone?: "neutral" | "alert";
}) {
  if (count === 0 && !active) return null;
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? tone === "alert"
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-[var(--primary)] bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]",
      )}
    >
      {label}
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </Link>
  );
}
