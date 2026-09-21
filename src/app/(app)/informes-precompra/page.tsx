import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  Download,
  Search,
  Wrench,
} from "lucide-react";

import { ReportsStatusPoller } from "@/components/reports/reports-status-poller";
import { PrepurchaseVisitDialog } from "@/components/reports/prepurchase-visit-dialog";
import { PrepurchaseResultAction } from "@/components/reports/prepurchase-result-action";
import { EmptyState, Notice, PageHeader, Panel, Pill, StatCard } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getPrepurchaseReports, type PrepurchaseReport } from "@/lib/data/crm";
import { fmtCLP, fmtDateTime, fmtNumber, fmtPlate } from "@/lib/format";

const ORDER_STATUS = {
  pending_payment: "Pendiente de pago",
  checkout_initializing: "Iniciando pago",
  processing_payment: "Pago en proceso",
  paid: "Pagado",
  issued: "Informe entregado",
  failed: "Fallido",
} as const;

const VISIT_STATUS = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  reschedule_requested: "Por reagendar",
  completed: "Realizada",
  cancelled: "Cancelada",
} as const;

type Filters = {
  status?: string;
  visitStatus?: string;
  from?: string;
  to?: string;
};

function validOrderStatus(value: string | undefined) {
  return value && value in ORDER_STATUS ? value : undefined;
}

function validVisitStatus(value: string | undefined) {
  return value && value in VISIT_STATUS ? value : undefined;
}

function pageHref(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.visitStatus) params.set("visitStatus", filters.visitStatus);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(page));
  return `/informes-precompra?${params.toString()}`;
}

function orderVariant(status: string) {
  if (status === "issued") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "paid") return "info" as const;
  return "warn" as const;
}

function orderLabel(report: PrepurchaseReport) {
  if (report.source === "crm" && report.status === "paid") return "Confirmado · postpago";
  return ORDER_STATUS[report.status as keyof typeof ORDER_STATUS] ?? report.status;
}

function visitVariant(status: string | null) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "confirmed") return "info" as const;
  return "warn" as const;
}

function place(report: PrepurchaseReport) {
  const address = report.address?.trim();
  const commune = report.commune?.trim();
  const fullAddress = !address
    ? commune || "Por confirmar"
    : !commune || address.toLowerCase().includes(commune.toLowerCase())
      ? address
      : `${address}, ${commune}`;
  return report.locationName ? `${report.locationName} · ${fullAddress}` : fullAddress;
}

export default async function PrepurchaseReportsPage({
  searchParams,
}: {
  searchParams: Promise<Filters & { page?: string }>;
}) {
  const filters = await searchParams;
  const session = await requireCrmSession();
  const page = Math.max(1, Number(filters.page) || 1);
  const result = await getPrepurchaseReports(session.dealership.id, {
    page,
    limit: 25,
    status: validOrderStatus(filters.status),
    visitStatus: validVisitStatus(filters.visitStatus),
    from: filters.from,
    to: filters.to,
  });
  const summary = result.summary;
  const writable = canWrite(session.role);
  const isUpdating = result.reports.some((report) =>
    ["checkout_initializing", "processing_payment"].includes(report.status),
  );

  return (
    <>
      <ReportsStatusPoller active={isUpdating} />
      <PageHeader
        title="Informe de precompra"
        subtitle="Agenda y control de las inspecciones técnicas solicitadas para tus vehículos."
        action={writable ? <PrepurchaseVisitDialog /> : undefined}
      />

      {result.error ? (
        <div className="mb-4">
          <Notice tone="warn">{result.error}</Notice>
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Solicitudes" value={fmtNumber(summary.total)} />
          <StatCard label="Servicios confirmados" value={fmtNumber(summary.confirmed)} hint="Pago confirmado" />
          <StatCard label="Agendadas" value={fmtNumber(summary.scheduled)} hint="Con fecha activa" />
          <StatCard
            label="Por entregar / entregadas"
            value={`${fmtNumber(summary.pendingFulfillment)} / ${fmtNumber(summary.issued)}`}
            tone={summary.pendingFulfillment > 0 ? "alert" : "neutral"}
          />
          <StatCard
            label="Monto confirmado"
            value={fmtCLP(summary.confirmedAmountClp)}
            hint={`${fmtNumber(summary.confirmed)} servicios contabilizados`}
          />
        </div>
      )}

      <Panel className="mb-4">
        <form
          action="/informes-precompra"
          className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_155px_155px_auto]"
        >
          <select
            name="status"
            defaultValue={validOrderStatus(filters.status) ?? ""}
            aria-label="Estado del servicio"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"
          >
            <option value="">Todos los servicios</option>
            {Object.entries(ORDER_STATUS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            name="visitStatus"
            defaultValue={validVisitStatus(filters.visitStatus) ?? ""}
            aria-label="Estado de la visita"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"
          >
            <option value="">Todas las visitas</option>
            {Object.entries(VISIT_STATUS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Desde
            <input
              type="date"
              name="from"
              defaultValue={filters.from}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm font-normal text-[var(--foreground)]"
            />
          </label>
          <label className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Hasta
            <input
              type="date"
              name="to"
              defaultValue={filters.to}
              className="mt-1 block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm font-normal text-[var(--foreground)]"
            />
          </label>
          <button className="flex items-center justify-center gap-1.5 self-end rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-4 py-2.5 text-sm font-medium text-white">
            <Search className="h-4 w-4" />
            Filtrar
          </button>
        </form>
      </Panel>

      <Panel
        title="Agenda de inspecciones"
        subtitle={`${fmtNumber(result.pagination.total)} ${result.pagination.total === 1 ? "servicio" : "servicios"}`}
      >
        {result.reports.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck2 className="h-6 w-6" />}
            title={result.error ? "Agenda no disponible" : "No hay inspecciones"}
            description={
              result.error
                ? "Vuelve a intentarlo en unos minutos."
                : "No encontramos informes de precompra para los filtros seleccionados."
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                <thead className="bg-[var(--muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3">Agenda</th>
                    <th className="px-3 py-3">Vehículo</th>
                    <th className="px-3 py-3">Solicitante</th>
                    <th className="px-3 py-3">Lugar</th>
                    <th className="px-3 py-3">Visita</th>
                    <th className="px-3 py-3">Servicio</th>
                    <th className="px-3 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Solicitado</th>
                    <th className="px-4 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {result.reports.map((report) => (
                    <tr key={report.id} className="transition-colors hover:bg-[var(--muted)]/30">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{fmtDateTime(report.scheduledAt)}</td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-sm font-semibold">{fmtPlate(report.plate)}</p>
                        <p className="text-[var(--muted-foreground)]">{report.vehicle || "Vehículo"}</p>
                      </td>
                      <td className="max-w-[180px] px-3 py-3">
                        <p className="truncate font-medium">{report.buyerName || "—"}</p>
                        <p className="truncate text-[var(--muted-foreground)]">{report.buyerEmail || "Sin correo"}</p>
                      </td>
                      <td className="max-w-[220px] px-3 py-3"><p className="line-clamp-2">{place(report)}</p></td>
                      <td className="px-3 py-3">
                        <Pill variant={visitVariant(report.visitStatus)}>
                          {report.visitStatus ? VISIT_STATUS[report.visitStatus as keyof typeof VISIT_STATUS] ?? report.visitStatus : "Sin agenda"}
                        </Pill>
                      </td>
                      <td className="px-3 py-3">
                        <Pill variant={orderVariant(report.status)}>
                          {orderLabel(report)}
                        </Pill>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtCLP(report.priceClp)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--muted-foreground)]">{fmtDateTime(report.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {report.resultAvailable ? (
                          <a href={`/api/crm/reports/${encodeURIComponent(report.id)}/download`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 font-medium text-[var(--primary)]"><Download className="h-3.5 w-3.5" />Descargar</a>
                        ) : writable && report.status === "paid" ? (
                          <PrepurchaseResultAction reportId={report.id} plate={report.plate} />
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] lg:hidden">
              {result.reports.map((report) => (
                <li key={report.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-base font-semibold">{fmtPlate(report.plate)}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{report.vehicle || "Vehículo"}</p>
                    </div>
                    <Pill variant={orderVariant(report.status)}>
                      {orderLabel(report)}
                    </Pill>
                  </div>
                  <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--muted)]/50 p-3">
                    <CalendarCheck2 className="h-4 w-4 shrink-0 text-[var(--primary)]" />
                    <div>
                      <p className="text-sm font-semibold">{fmtDateTime(report.scheduledAt)}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{place(report)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>{report.buyerName || report.buyerEmail || "Comprador sin identificar"}</span>
                    <span className="font-semibold">{fmtCLP(report.priceClp)}</span>
                  </div>
                  <Pill variant={visitVariant(report.visitStatus)}>
                    <Wrench className="h-3 w-3" />
                    {report.visitStatus ? VISIT_STATUS[report.visitStatus as keyof typeof VISIT_STATUS] ?? report.visitStatus : "Sin agenda"}
                  </Pill>
                  {report.resultAvailable ? (
                    <a href={`/api/crm/reports/${encodeURIComponent(report.id)}/download`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 text-xs font-medium text-[var(--primary)]"><Download className="h-3.5 w-3.5" />Descargar resultado</a>
                  ) : writable && report.status === "paid" ? (
                    <PrepurchaseResultAction reportId={report.id} plate={report.plate} />
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}

        {result.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs">
            <span className="text-[var(--muted-foreground)]">
              Página {result.pagination.page} de {result.pagination.totalPages}
            </span>
            <div className="flex gap-2">
              {result.pagination.page > 1 && (
                <Link
                  href={pageHref(filters, result.pagination.page - 1)}
                  className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />Anterior
                </Link>
              )}
              {result.pagination.page < result.pagination.totalPages && (
                <Link
                  href={pageHref(filters, result.pagination.page + 1)}
                  className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2"
                >
                  Siguiente<ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

export const dynamic = "force-dynamic";
