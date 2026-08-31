import Link from "next/link";
import {
  AlarmClock,
  CalendarClock,
  Car,
  CircleDollarSign,
  Coins,
  FileClock,
  Inbox,
  PhoneCall,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  ReceiptText,
  BadgeDollarSign,
  RefreshCw,
} from "lucide-react";

import { requireCrmSession } from "@/lib/auth/session";
import {
  getAging,
  getLeads,
  getMyTasks,
  getPerformance,
  getPrepurchaseReports,
  getReports,
  getStockSummary,
  visibleLeads,
} from "@/lib/data/crm";
import { byUrgency, isOpen } from "@/lib/leads";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/ui/primitives";
import { LeadRow } from "@/components/leads/lead-row";
import { MyTasksPanel } from "@/components/tasks/my-tasks-panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { FunnelBars } from "@/components/dashboard/funnel-bars";
import { AgentBoard, responseLabel } from "@/components/dashboard/agent-board";
import { fmtCLP, fmtNumber } from "@/lib/format";

/**
 * "Mi día" — la pantalla con la que se abre el CRM.
 *
 * Tiene dos lecturas superpuestas y a propósito:
 *   - la LISTA DE TRABAJO (a quién llamar ahora), que es lo que el agente necesita;
 *   - los INDICADORES, que son lo que el dueño necesita para dirigir.
 *
 * Los mismos indicadores sirven a los dos porque el backend cambia su alcance según el rol:
 * el administrador los recibe de toda la automotora y con una fila por agente; el agente de
 * ventas los recibe calculados sólo sobre su cartera. Ver
 * `backoffice/analytics/performance`.
 */

const PERIODS = [7, 30, 90];

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias } = await searchParams;
  const days = PERIODS.includes(Number(dias)) ? Number(dias) : 30;

  const session = await requireCrmSession();
  const now = new Date();
  const monthFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const monthTo = now.toISOString().slice(0, 10);
  const [allLeads, stock, aging, perf, monthlyReports, monthlyPrepurchase, myTasks] = await Promise.all([
    getLeads(session),
    getStockSummary(),
    getAging(),
    getPerformance(days),
    getReports(session.dealership.id, { page: 1, limit: 1, from: monthFrom, to: monthTo }),
    getPrepurchaseReports(session.dealership.id, { page: 1, limit: 1, from: monthFrom, to: monthTo }),
    getMyTasks(),
  ]);

  const leads = visibleLeads(allLeads, session);
  const uncontacted = leads.filter((l) => l.stage === "new").sort(byUrgency);
  const open = leads.filter((l) => isOpen(l) && l.stage !== "new").sort(byUrgency);
  const t = perf.totals;
  const late = t.slaLate;
  const mine = perf.portfolioRestricted;
  const scopeLabel = mine ? "tu cartera" : "toda la automotora";
  const periodLabel = days === 7 ? "los últimos 7 días" : days === 90 ? "los últimos 90 días" : "los últimos 30 días";

  return (
    <>
      <PageHeader
        title={`Hola, ${session.firstName?.trim() || "bienvenido"}`}
        subtitle={`Esto es lo que tienes hoy en ${scopeLabel}.`}
        action={<PeriodPicker current={days} />}
      />

      {/* ── Indicadores ─────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Sin contactar"
          value={t.uncontacted}
          hint={late > 0 ? `${late} pasaron la hora` : "Al día"}
          icon={PhoneCall}
          tone={late > 0 ? "alert" : "neutral"}
          href="/solicitudes?estado=new"
        />
        <KpiCard
          label="En gestión"
          value={t.openLeads}
          hint="Solicitudes abiertas ahora"
          icon={Inbox}
          href="/solicitudes"
        />
        <KpiCard
          label="Compromisos vencidos"
          value={t.overdueActions}
          hint={t.overdueActions > 0 ? "Prometiste volver a llamar" : "Nada pendiente"}
          icon={AlarmClock}
          tone={t.overdueActions > 0 ? "warn" : "neutral"}
          href="/solicitudes"
        />
        <KpiCard
          label="1ª respuesta"
          value={responseLabel(t.avgFirstResponseMin)}
          hint="Promedio desde que entra la solicitud"
          icon={Timer}
          tone={
            t.avgFirstResponseMin === null
              ? "neutral"
              : t.avgFirstResponseMin <= 15
                ? "good"
                : t.avgFirstResponseMin <= 60
                  ? "warn"
                  : "alert"
          }
        />
        <KpiCard
          label="Solicitudes nuevas"
          value={t.newLeads}
          hint={`Entraron en ${periodLabel}`}
          icon={TrendingUp}
        />
        <KpiCard
          label="Vendidos"
          value={t.won}
          hint={`${t.lost} perdidos en el periodo`}
          icon={Trophy}
          tone={t.won > 0 ? "good" : "neutral"}
        />
        <KpiCard
          label="Conversión"
          value={`${fmtNumber(t.conversion)}%`}
          hint="De las solicitudes que se cerraron"
          icon={Target}
        />
        <KpiCard
          label="Vendido en el periodo"
          value={fmtCLP(t.revenue)}
          hint={`${t.activities} gestiones registradas`}
          icon={CircleDollarSign}
        />
      </div>

      <Panel
        className="mb-4"
        title="Informes y servicios del mes"
        subtitle="Uso y agenda acumulados de toda la automotora durante el mes actual"
        action={
          <div className="flex gap-3">
            <Link href="/informes" className="text-xs font-medium text-[var(--primary)]">
              Histórico
            </Link>
            <Link href="/informes-precompra" className="text-xs font-medium text-[var(--primary)]">
              Precompra
            </Link>
          </div>
        }
      >
        <div className="space-y-3 p-4">
          {monthlyReports.error && <Notice tone="warn">{monthlyReports.error}</Notice>}
          {monthlyPrepurchase.error && <Notice tone="warn">{monthlyPrepurchase.error}</Notice>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Informes históricos"
              value={fmtNumber(monthlyReports.summary.standard + monthlyReports.summary.premium)}
              hint={`${fmtNumber(monthlyReports.summary.generated)} generados`}
              icon={FileClock}
              href="/informes"
            />
            <KpiCard
              label="Informes de precompra"
              value={fmtNumber(monthlyPrepurchase.summary.confirmed)}
              hint={`${fmtNumber(monthlyPrepurchase.summary.scheduled)} agendados · ${fmtCLP(monthlyPrepurchase.summary.confirmedAmountClp)}`}
              icon={CalendarClock}
              href="/informes-precompra"
            />
            <KpiCard
              label="Tokens usados"
              value={fmtNumber(monthlyReports.summary.tokens)}
              hint={`${fmtNumber(monthlyReports.summary.standard)} estándar · ${fmtNumber(monthlyReports.summary.premium)} premium`}
              icon={Coins}
              href="/informes"
            />
            <KpiCard
              label="No facturados"
              value={fmtNumber(monthlyReports.summary.unbilled)}
              hint={`${fmtNumber(monthlyReports.summary.invoiced)} facturados`}
              icon={ReceiptText}
              tone={monthlyReports.summary.unbilled > 0 ? "warn" : "neutral"}
              href="/informes?billingStatus=unbilled"
            />
          </div>
        </div>
      </Panel>

      {/* ── Tus tareas ──────────────────────────────────────────── */}
      <Panel
        className="mb-4"
        title="Tus tareas"
        subtitle={
          session.portfolioRestricted
            ? "Lo que agendaste en tus leads: atrasadas, de hoy y próximas"
            : "Toda la automotora: atrasadas, de hoy y próximas"
        }
      >
        <MyTasksPanel overdue={myTasks.overdue} today={myTasks.today} upcoming={myTasks.upcoming} />
      </Panel>

      {/* ── Trabajo del día ─────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Llamar ahora"
          subtitle="Solicitudes que nadie ha contactado todavía"
          action={
            <Link href="/solicitudes?estado=new" className="text-xs font-medium text-[var(--primary)]">
              Ver todas
            </Link>
          }
        >
          {uncontacted.length === 0 ? (
            <EmptyState
              icon={<PhoneCall className="h-6 w-6" />}
              title="No hay solicitudes pendientes"
              description="Cuando un cliente deje sus datos en una de tus publicaciones, aparecerá aquí para que lo llames."
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {uncontacted.slice(0, 6).map((lead) => (
                <LeadRow key={lead.id} lead={lead} showAssignee={!session.portfolioRestricted} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="En gestión"
          subtitle="Clientes con los que ya hablaste"
          action={
            <Link href="/solicitudes" className="text-xs font-medium text-[var(--primary)]">
              Ver todas
            </Link>
          }
        >
          {open.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="Nada en gestión"
              description="Los clientes que ya contactaste van quedando aquí con su etapa."
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {open.slice(0, 6).map((lead) => (
                <LeadRow key={lead.id} lead={lead} showAssignee={!session.portfolioRestricted} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Ritmo y embudo ──────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Ritmo del periodo"
          subtitle={`Solicitudes que entran y ventas que se cierran en ${periodLabel}`}
        >
          <TrendChart data={perf.trend} />
        </Panel>

        <Panel title="Embudo" subtitle="Dónde están hoy tus clientes">
          <FunnelBars funnel={perf.funnel} />
        </Panel>
      </div>

      {/* ── Rendimiento por agente ──────────────────────────────── */}
      <Panel
        className="mt-4"
        title={mine ? "Tu rendimiento" : "Rendimiento del equipo"}
        subtitle={
          mine
            ? `Tus números en ${periodLabel}`
            : `Un vendedor por fila, en ${periodLabel}. Lo abierto se mide ahora; lo cerrado, en el periodo.`
        }
        action={
          !mine ? (
            <Link href="/equipo" className="text-xs font-medium text-[var(--primary)]">
              Gestionar equipo
            </Link>
          ) : undefined
        }
      >
        {perf.agents.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Sin solicitudes asignadas"
            description="Cuando las solicitudes tengan un responsable, aquí se compara el rendimiento de cada vendedor."
          />
        ) : (
          <AgentBoard agents={perf.agents} />
        )}
      </Panel>

      {/* ── Inventario ──────────────────────────────────────────── */}
      <Panel
        className="mt-4"
        title="Inventario"
        subtitle="Lo que tienes en el patio y cuánto lleva publicado"
        action={
          <Link href="/vehiculos" className="text-xs font-medium text-[var(--primary)]">
            Ver stock
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
          <KpiCard
            label="Vendidos este mes"
            value={stock?.soldMonth ?? 0}
            hint={`${stock?.soldYear ?? 0} acumulados este año`}
            icon={Trophy}
            tone={(stock?.soldMonth ?? 0) > 0 ? "good" : "neutral"}
          />
          <KpiCard
            label="Stock propio"
            value={stock?.ownCount ?? 0}
            hint={fmtCLP(stock?.ownValue ?? 0)}
            icon={BadgeDollarSign}
          />
          <KpiCard
            label="Consignados"
            value={stock?.consignedCount ?? 0}
            hint={fmtCLP(stock?.consignedValue ?? 0)}
            icon={Car}
          />
          <KpiCard
            label="Transferencias"
            value={stock?.transfersCompleted ?? 0}
            hint="Operaciones completadas"
            icon={RefreshCw}
          />
          <KpiCard
            label="Rotación"
            value={`${aging.avgDays} días`}
            hint="Promedio publicado"
            icon={CalendarClock}
          />
          <KpiCard
            label="Sobre 60 días"
            value={aging.buckets.d60_plus}
            hint={aging.buckets.d60_plus > 0 ? "Unidades que no se mueven" : "Nada estancado"}
            icon={AlarmClock}
            tone={aging.buckets.d60_plus > 0 ? "warn" : "neutral"}
          />
        </div>
      </Panel>
    </>
  );
}

/** Ventana de tiempo de los indicadores. Cambia la URL para que el estado sea compartible. */
function PeriodPicker({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-0.5">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={p === 30 ? "/" : `/?dias=${p}`}
          className={
            p === current
              ? "rounded-[calc(var(--radius)-4px)] bg-[var(--fm-navy)] px-2.5 py-1 text-[11px] font-semibold text-white"
              : "rounded-[calc(var(--radius)-4px)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)]"
          }
        >
          {p} días
        </Link>
      ))}
    </div>
  );
}
