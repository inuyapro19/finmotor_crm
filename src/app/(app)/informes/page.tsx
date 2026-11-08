import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Coins,
  Download,
  FileClock,
  FilePlus2,
  Loader2,
  Search,
} from "lucide-react";

import { EmptyState, Notice, PageHeader, Panel, Pill, StatCard } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getReportWallet, getReports, type HistoricalReport, type ReportType } from "@/lib/data/crm";
import { fmtDateTime, fmtNumber, fmtPlate } from "@/lib/format";
import { ReportShareAction } from "@/components/reports/report-share-action";
import { ReportsStatusPoller } from "@/components/reports/reports-status-poller";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  queued: "En cola",
  processing: "Generando",
  generated: "Generado",
  completed: "Generado",
  failed: "Fallido",
};

const BILLING_LABEL: Record<string, string> = {
  unbilled: "No facturado",
  pending: "Pendiente de facturación",
  invoiced: "Facturado",
  // Los dos que faltaban del CHECK de la migracion 0035: se mostraban en crudo.
  not_billable: "No facturable",
  not_applicable: "Sin facturación",
  prepaid: "Pagado con tokens",
};

const TYPE_LABEL: Record<ReportType, string> = {
  standard: "Estándar",
  premium: "Premium",
};

type Filters = {
  stock?: string;
  status?: string;
  billingStatus?: string;
  reportType?: string;
  from?: string;
  to?: string;
};

function normalized(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function statusVariant(status: string) {
  const value = normalized(status);
  if (value === "generated" || value === "completed") return "success" as const;
  if (value === "failed") return "danger" as const;
  if (value === "processing") return "info" as const;
  return "warn" as const;
}

function billingVariant(status: string) {
  const value = normalized(status);
  if (value === "invoiced") return "info" as const;
  if (value === "unbilled") return "warn" as const;
  if (value === "prepaid") return "success" as const;
  return "neutral" as const;
}

function stockFilter(value: string | undefined): "in" | "out" | undefined {
  return value === "in" || value === "out" ? value : undefined;
}

function stockCode(value: number | null) {
  return value == null ? null : `STK-${String(value).padStart(6, "0")}`;
}

/** Patente del informe vs stock: unidad vigente, unidad ya vendida o consulta externa. */
function StockBadge({ stock }: { stock: HistoricalReport["stock"] }) {
  if (!stock) return <Pill variant="neutral">Fuera del stock</Pill>;
  const sold = stock.status === "SOLD";
  const code = stockCode(stock.stockNumber);
  return (
    <Link
      href={`/vehiculos/editar/${encodeURIComponent(stock.vehicleId)}`}
      title={sold ? "Unidad del stock ya vendida" : "Ver la unidad en el stock"}
      className="inline-flex flex-col items-start gap-0.5 hover:opacity-80"
    >
      <Pill variant={sold ? "info" : "success"}>{sold ? "Del stock · vendido" : "En stock"}</Pill>
      {code && <span className="font-mono text-[10px] text-[var(--muted-foreground)]">{code}</span>}
    </Link>
  );
}

function reportType(value: string | undefined): ReportType | undefined {
  return value === "standard" || value === "premium" ? value : undefined;
}

function pageHref(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.stock) params.set("stock", filters.stock);
  if (filters.status) params.set("status", filters.status);
  if (filters.billingStatus) params.set("billingStatus", filters.billingStatus);
  if (filters.reportType) params.set("reportType", filters.reportType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(page));
  return `/informes?${params.toString()}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Filters & { page?: string }>;
}) {
  const filters = await searchParams;
  const session = await requireCrmSession();
  const page = Math.max(1, Number(filters.page) || 1);
  const walletPromise = getReportWallet(session.dealership.id);
  const result = await getReports(session.dealership.id, {
    page,
    limit: 25,
    from: filters.from,
    to: filters.to,
    status: filters.status,
    billingStatus: filters.billingStatus,
    reportType: reportType(filters.reportType),
    stock: stockFilter(filters.stock),
  });
  const summary = result.summary;
  const wallet = await walletPromise;
  const prepaid = wallet?.billingMode === "prepaid";
  const hasProcessingReports = result.reports.some((report) =>
    ["queued", "processing"].includes(normalized(report.status)),
  );

  return (
    <>
      <ReportsStatusPoller active={hasProcessingReports} />
      <PageHeader
        title="Informes históricos"
        subtitle="Historial de solicitudes de toda la automotora."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {wallet?.enabled && (
              <Link
                href="/informes/tokens"
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm font-medium"
              >
                <Coins className="h-4 w-4" />
                {fmtNumber(wallet.balance)} {wallet.balance === 1 ? "token" : "tokens"} · Comprar tokens
              </Link>
            )}
            {canWrite(session.role) && (
              <Link
                href="/informes/create"
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-white"
              >
                <FilePlus2 className="h-4 w-4" />
                Solicitar lote
              </Link>
            )}
          </div>
        }
      />

      {result.error ? (
        <div className="mb-4">
          <Notice tone="warn">{result.error}</Notice>
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Generados" value={fmtNumber(summary.generated)} />
          <StatCard
            label="Del stock / fuera del stock"
            value={`${fmtNumber(summary.inStock)} / ${fmtNumber(summary.outOfStock)}`}
            hint="Patentes que coinciden con tu stock"
          />
          <StatCard label="Estándar" value={fmtNumber(summary.standard)} hint="1 token por informe" />
          <StatCard label="Premium" value={fmtNumber(summary.premium)} hint="2 tokens por informe" />
          <StatCard label="Tokens usados" value={fmtNumber(summary.tokens)} />
          {prepaid ? (
            <StatCard
              label="Saldo de tokens"
              value={fmtNumber(wallet?.balance ?? 0)}
              hint="Recarga en Comprar tokens"
              href="/informes/tokens"
              tone={(wallet?.balance ?? 0) === 0 ? "alert" : "neutral"}
            />
          ) : (
            <StatCard
              label="No facturados / facturados"
              value={`${fmtNumber(summary.unbilled)} / ${fmtNumber(summary.invoiced)}`}
              tone={summary.unbilled > 0 ? "alert" : "neutral"}
            />
          )}
        </div>
      )}

      <Panel className="mb-4">
        <form action="/informes" className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_155px_155px_auto]">
          <select
            name="stock"
            defaultValue={filters.stock ?? ""}
            aria-label="Stock"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"
          >
            <option value="">Stock y externas</option>
            <option value="in">Del stock</option>
            <option value="out">Fuera del stock</option>
          </select>
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            aria-label="Estado operativo"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="queued">En cola</option>
            <option value="processing">Generando</option>
            <option value="generated">Generado</option>
            <option value="failed">Fallido</option>
          </select>
          <select
            name="billingStatus"
            defaultValue={filters.billingStatus ?? ""}
            aria-label="Estado de facturación"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"
          >
            <option value="">Toda facturación</option>
            <option value="unbilled">No facturado</option>
            <option value="invoiced">Facturado</option>
            <option value="prepaid">Pagado con tokens</option>
          </select>
          <select
            name="reportType"
            defaultValue={filters.reportType ?? ""}
            aria-label="Tipo de informe"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="standard">Estándar</option>
            <option value="premium">Premium</option>
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
        title="Historial de la organización"
        subtitle={`${fmtNumber(result.pagination.total)} ${result.pagination.total === 1 ? "informe" : "informes"}`}
      >
        {result.reports.length === 0 ? (
          <EmptyState
            icon={<FileClock className="h-6 w-6" />}
            title={result.error ? "Historial no disponible" : "No encontramos informes"}
            description={
              result.error
                ? "Vuelve a intentarlo en unos minutos."
                : "Prueba cambiando los filtros o solicita un nuevo lote de informes."
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1260px] border-collapse text-left text-xs">
                <thead className="bg-[var(--muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3">Patente</th>
                    <th className="px-3 py-3">Stock</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Facturación</th>
                    <th className="px-3 py-3 text-right">Tokens</th>
                    <th className="px-3 py-3">Solicitado por</th>
                    <th className="px-3 py-3">Generado</th>
                    <th className="px-3 py-3">Factura</th>
                    <th className="px-4 py-3"><span className="sr-only">Descarga</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {result.reports.map((report) => (
                    <ReportTableRow key={report.id} report={report} />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] lg:hidden">
              {result.reports.map((report) => (
                <ReportCard key={report.id} report={report} />
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

function ReportTableRow({ report }: { report: HistoricalReport }) {
  const status = normalized(report.status);
  const billing = normalized(report.billingStatus);
  const downloadable = status === "generated" || status === "completed";
  return (
    <tr className="transition-colors hover:bg-[var(--muted)]/30">
      <td className="px-4 py-3 font-mono text-sm font-semibold">{fmtPlate(report.plate)}</td>
      <td className="px-3 py-3"><StockBadge stock={report.stock} /></td>
      <td className="px-3 py-3 font-medium">{TYPE_LABEL[report.reportType] ?? report.reportType}</td>
      <td className="px-3 py-3"><Pill variant={statusVariant(status)}>{status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}{STATUS_LABEL[status] ?? report.status}</Pill></td>
      <td className="px-3 py-3"><Pill variant={billingVariant(billing)}>{BILLING_LABEL[billing] ?? report.billingStatus}</Pill></td>
      <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtNumber(report.tokenCost)}</td>
      <td className="max-w-[180px] truncate px-3 py-3">{report.requestedByName || "—"}</td>
      <td className="px-3 py-3">{fmtDateTime(report.generatedAt)}</td>
      <td className="px-3 py-3">{report.invoiceId ? `#${report.invoiceId}` : "Sin asociar"}</td>
      <td className="px-4 py-3 text-right">
        {downloadable && (
          <div className="flex justify-end gap-1"><ReportShareAction reportId={report.id} plate={report.plate} /><a
            href={`/api/crm/reports/${encodeURIComponent(report.id)}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 font-medium text-[var(--primary)] hover:border-[var(--primary)]"
          >
            <Download className="h-3.5 w-3.5" />Descargar
          </a></div>
        )}
      </td>
    </tr>
  );
}

function ReportCard({ report }: { report: HistoricalReport }) {
  const status = normalized(report.status);
  const billing = normalized(report.billingStatus);
  const downloadable = status === "generated" || status === "completed";
  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-base font-semibold">{fmtPlate(report.plate)}</p>
          <p className="mt-0.5 text-xs font-medium text-[var(--muted-foreground)]">
            {TYPE_LABEL[report.reportType] ?? report.reportType} · {fmtNumber(report.tokenCost)} {report.tokenCost === 1 ? "token" : "tokens"}
          </p>
        </div>
        {downloadable && (
          <div className="flex gap-1"><ReportShareAction reportId={report.id} plate={report.plate} compact /><a
            href={`/api/crm/reports/${encodeURIComponent(report.id)}/download`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Descargar informe de ${report.plate}`}
            className="rounded-[var(--radius-md)] border border-[var(--border)] p-2.5 text-[var(--primary)]"
          >
            <Download className="h-4 w-4" />
          </a></div>
        )}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <StockBadge stock={report.stock} />
        <Pill variant={statusVariant(status)}>{status === "processing" && <Loader2 className="h-3 w-3 animate-spin" />}{STATUS_LABEL[status] ?? report.status}</Pill>
        <Pill variant={billingVariant(billing)}>{BILLING_LABEL[billing] ?? report.billingStatus}</Pill>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-[var(--radius-md)] bg-[var(--muted)]/45 p-3 text-xs">
        <div>
          <dt className="text-[10px] text-[var(--muted-foreground)]">Solicitado por</dt>
          <dd className="mt-0.5 font-medium">{report.requestedByName || "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-[var(--muted-foreground)]">Generado</dt>
          <dd className="mt-0.5 font-medium">{fmtDateTime(report.generatedAt)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] text-[var(--muted-foreground)]">Factura asociada</dt>
          <dd className="mt-0.5 break-all font-medium">{report.invoiceId ? `#${report.invoiceId}` : "Sin asociar"}</dd>
        </div>
      </dl>
    </li>
  );
}

export const dynamic = "force-dynamic";
