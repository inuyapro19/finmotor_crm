import {
  ArrowLeftRight,
  BadgeDollarSign,
  CalendarDays,
  Car,
  CarFront,
  CircleDollarSign,
  FileClock,
  Handshake,
  Landmark,
  SearchCheck,
} from "lucide-react";

import { DailySalesChart } from "@/components/dashboard/daily-sales-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { LeadFunnelChart } from "@/components/dashboard/lead-funnel-chart";
import { LeadTrendChart } from "@/components/dashboard/lead-trend-chart";
import { MonthlySalesChart } from "@/components/dashboard/monthly-sales-chart";
import { SalesDateFilter } from "@/components/dashboard/sales-date-filter";
import { Notice, PageHeader, Panel } from "@/components/ui/primitives";
import { requireCrmSession, type CrmSession } from "@/lib/auth/session";
import {
  getCreditLeadTotal,
  getDealershipTransfers,
  getInventoryHistory,
  getPerformance,
  getPrepurchaseReports,
  getReports,
  getSalesTimeseries,
} from "@/lib/data/crm";
import { fmtCLP, fmtDate, fmtNumber } from "@/lib/format";

//: Sobre este umbral de días, 365 barras diarias son una mancha ilegible — el gráfico diario
//: se apaga a favor de una nota, y el mensual (que sí escala bien) sigue mostrando el rango.
const MAX_DAILY_CHART_SPAN = 92;

//: Rango por defecto cuando el Dashboard se abre sin filtro: mismo criterio que usa el
//: backend para `/inventory/sales-timeseries` sin `from`/`to` (últimos 12 meses). Se resuelve
//: aquí, ANTES del Promise.all, para que TODAS las tarjetas de KPI usen el mismo rango que
//: los gráficos — no sólo los que ya traían filtro propio.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanIsoDate(value: string | undefined): string | undefined {
  return value && ISO_DATE.test(value) ? value : undefined;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(raw: { from?: string; to?: string }): { from: string; to: string } {
  const to = cleanIsoDate(raw.to) ?? isoDate(new Date());
  const from = cleanIsoDate(raw.from) ?? isoDate(new Date(Date.now() - 365 * 86_400_000));
  return { from, to };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const rawParams = await searchParams;
  const { from, to } = defaultRange(rawParams);
  const session = await requireCrmSession();
  const periodHint = `Del ${fmtDate(from)} al ${fmtDate(to)}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          session.portfolioRestricted
            ? `Tus resultados en ${session.dealership.name} · ${periodHint}`
            : `Principales KPIs de ${session.dealership.name} · ${periodHint}`
        }
      />

      <SalesDateFilter from={from} to={to} />

      {session.portfolioRestricted ? (
        <AgentDashboard session={session} from={from} to={to} periodHint={periodHint} />
      ) : (
        <DealershipDashboard session={session} from={from} to={to} periodHint={periodHint} />
      )}
    </>
  );
}

/** Vista del dueño/administrador: KPIs de TODA la automotora + ventas en el tiempo. */
async function DealershipDashboard({
  session,
  from,
  to,
  periodHint,
}: {
  session: CrmSession;
  from: string;
  to: string;
  periodHint: string;
}) {
  const organizationId = session.dealership.id;

  // Un solo rango, pasado a TODAS las fuentes: cada tarjeta de KPI y ambos gráficos
  // responden al mismo filtro de fecha, calculados por el backend (nada se recorta en el
  // cliente).
  const [history, reports, prepurchaseReports, transfers, creditTotal, sales] = await Promise.all([
    getInventoryHistory({ page: 1, limit: 1, from, to }),
    getReports(organizationId, { page: 1, limit: 1, from, to }),
    getPrepurchaseReports(organizationId, { page: 1, limit: 1, from, to }),
    getDealershipTransfers(organizationId, { page: 1, limit: 1, from, to }),
    getCreditLeadTotal({ from, to }),
    getSalesTimeseries({ from, to }),
  ]);

  const daySpan = Math.round(
    (new Date(`${sales.to}T00:00:00`).getTime() - new Date(`${sales.from}T00:00:00`).getTime()) / 86_400_000,
  );
  const dailyChartFits = daySpan <= MAX_DAILY_CHART_SPAN;

  const own = history.byKind.find((k) => k.kind === "purchase");
  const consigned = history.byKind.find((k) => k.kind === "consignment");

  return (
    <>
      {(reports.error || prepurchaseReports.error) && (
        <div className="mb-4 space-y-2">
          {reports.error && <Notice tone="warn">{reports.error}</Notice>}
          {prepurchaseReports.error && <Notice tone="warn">{prepurchaseReports.error}</Notice>}
        </div>
      )}

      <section aria-label="Principales KPIs" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiCard
          label="Unidades activas"
          value={fmtNumber(history.summary.active)}
          hint={periodHint}
          icon={CarFront}
          href="/vehiculos"
        />
        <KpiCard
          label="Autos consignados"
          value={fmtNumber(consigned?.total ?? 0)}
          hint={`${fmtNumber(consigned?.sold ?? 0)} vendidos en el periodo`}
          icon={Handshake}
          href="/vehiculos?kind=consignment"
        />
        <KpiCard
          label="Autos propios"
          value={fmtNumber(own?.total ?? 0)}
          hint={`${fmtNumber(own?.sold ?? 0)} vendidos en el periodo`}
          icon={BadgeDollarSign}
          href="/vehiculos?kind=purchase"
        />
        <KpiCard
          label="Días promedio en inventario"
          value={`${fmtNumber(history.summary.avgStockDays)} días`}
          hint={periodHint}
          icon={CalendarDays}
          href="/historial-stock"
        />
        <KpiCard
          label="Autos vendidos"
          value={fmtNumber(history.summary.sold)}
          hint={periodHint}
          icon={Car}
          tone={history.summary.sold > 0 ? "good" : "neutral"}
          href={`/historial-stock?outcome=sold&from=${from}&to=${to}`}
        />
        <KpiCard
          label="Ventas totales"
          value={fmtCLP(history.summary.salesAmount)}
          hint={periodHint}
          icon={CircleDollarSign}
          tone={history.summary.salesAmount > 0 ? "good" : "neutral"}
          href={`/historial-stock?outcome=sold&from=${from}&to=${to}`}
        />
        <KpiCard
          label="Total de informes históricos"
          value={fmtNumber(reports.pagination.total)}
          hint={periodHint}
          icon={FileClock}
          href="/informes"
        />
        <KpiCard
          label="Total de informes precompra"
          value={fmtNumber(prepurchaseReports.summary.total)}
          hint={periodHint}
          icon={SearchCheck}
          href="/informes-precompra"
        />
        <KpiCard
          label="Total de transferencias"
          value={fmtNumber(transfers.summary.total)}
          hint={`${fmtNumber(transfers.summary.completed)} completadas en el periodo`}
          icon={ArrowLeftRight}
          href="/transferencias"
        />
        <KpiCard
          label="Total de créditos"
          value={fmtNumber(creditTotal)}
          hint={periodHint}
          icon={Landmark}
          href="/creditos"
        />
      </section>

      <section aria-label="Ventas en el tiempo" className="mt-5">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Panel title="Ventas y unidades vendidas por mes" subtitle={periodHint}>
            <MonthlySalesChart data={sales.monthly} />
          </Panel>

          <Panel
            title="Ventas diarias"
            subtitle={
              dailyChartFits
                ? periodHint
                : "Elige un rango de hasta 90 días para ver el detalle por día"
            }
          >
            {dailyChartFits ? (
              <DailySalesChart data={sales.daily} />
            ) : (
              <p className="px-4 py-14 text-center text-xs text-[var(--muted-foreground)]">
                El rango elegido tiene {fmtNumber(daySpan)} días: usa &ldquo;7 días&rdquo;, &ldquo;30
                días&rdquo; o &ldquo;90 días&rdquo; arriba, o un rango personalizado más corto, para
                ver el detalle diario. El gráfico mensual de la izquierda sí cubre todo el periodo.
              </p>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}

/**
 * Vista del agente de ventas: sólo SU cartera. Las 5 tarjetas responden "cuánto hice yo" (no
 * el total de la automotora), y los dos gráficos son de gestión de leads — el trabajo diario
 * de un agente, no las ventas globales del local.
 */
async function AgentDashboard({
  session,
  from,
  to,
  periodHint,
}: {
  session: CrmSession;
  from: string;
  to: string;
  periodHint: string;
}) {
  const organizationId = session.dealership.id;
  const userId = session.userId;

  const [consignedHistory, soldHistory, creditTotal, reports, transfers, performance] = await Promise.all([
    getInventoryHistory({ enteredById: userId, acquisitionKind: "consignment", from, to, page: 1, limit: 1 }),
    getInventoryHistory({ salesAgentId: userId, outcome: "sold", from, to, page: 1, limit: 1 }),
    getCreditLeadTotal({ from, to }),
    getReports(organizationId, { requestedById: userId, from, to, page: 1, limit: 1 }),
    getDealershipTransfers(organizationId, { assignedAgentId: userId, from, to, page: 1, limit: 1 }),
    getPerformance({ from, to }),
  ]);

  const consignedTotal = consignedHistory.summary.active + consignedHistory.summary.sold + consignedHistory.summary.exited;

  return (
    <>
      {reports.error && (
        <div className="mb-4">
          <Notice tone="warn">{reports.error}</Notice>
        </div>
      )}

      <section aria-label="Mis KPIs" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <KpiCard
          label="Autos que consigné"
          value={fmtNumber(consignedTotal)}
          hint={periodHint}
          icon={Handshake}
          href="/vehiculos?kind=consignment"
        />
        <KpiCard
          label="Autos que vendí"
          value={fmtNumber(soldHistory.summary.sold)}
          hint={fmtCLP(soldHistory.summary.salesAmount)}
          icon={Car}
          tone={soldHistory.summary.sold > 0 ? "good" : "neutral"}
          href={`/historial-stock?outcome=sold&salesAgentId=${userId}&from=${from}&to=${to}`}
        />
        <KpiCard
          label="Créditos que gestioné"
          value={fmtNumber(creditTotal)}
          hint={periodHint}
          icon={Landmark}
          href="/creditos"
        />
        <KpiCard
          label="Informes históricos"
          value={fmtNumber(reports.pagination.total)}
          hint={periodHint}
          icon={FileClock}
          href="/informes"
        />
        <KpiCard
          label="Transferencias"
          value={fmtNumber(transfers.summary.total)}
          hint={`${fmtNumber(transfers.summary.completed)} completadas en el periodo`}
          icon={ArrowLeftRight}
          href="/transferencias"
        />
      </section>

      <section aria-label="Gestión de mis leads" className="mt-5">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Panel title="Embudo de mis leads" subtitle={periodHint}>
            <LeadFunnelChart data={performance.funnel} />
          </Panel>

          <Panel title="Mis solicitudes vs. ventas por día" subtitle={periodHint}>
            <LeadTrendChart data={performance.trend} />
          </Panel>
        </div>
      </section>
    </>
  );
}
