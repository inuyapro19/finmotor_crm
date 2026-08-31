import Link from "next/link";
import { ArrowLeft, ArrowRight, Car, CircleDollarSign, Clock3, Download, History, TrendingUp } from "lucide-react";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { requireCrmSession } from "@/lib/auth/session";
import { getAssignableAgents, getInventoryHistory, getOrganizationLocations } from "@/lib/data/crm";
import { fmtCLP, fmtDate, fmtPlate } from "@/lib/format";

const KIND_LABEL: Record<string, string> = {
  purchase: "Stock propio",
  consignment: "Consignado",
  trade_in: "Parte de pago",
  unregistered: "Sin registrar",
};
const OUTCOME_LABEL = { active: "En stock", sold: "Vendido", exited: "Salida sin venta" } as const;
const INPUT = "h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]";
const HEAD = "whitespace-nowrap border-b border-r border-[#203568] bg-[var(--fm-navy)] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-white";
const CELL = "whitespace-nowrap border-b border-r border-[var(--border)] px-3 py-2.5";

type Params = {
  q?: string; outcome?: string; acquisitionKind?: string; salesAgentId?: string; enteredById?: string;
  locationId?: string; from?: string; to?: string; sort?: string; direction?: string; page?: string;
};

function href(params: Params, changes: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (key !== "page" && value) query.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  return `/historial-stock?${query.toString()}`;
}

function exportHref(params: Params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (key !== "page" && value) query.set(key, value);
  return `/api/crm/inventory-history/export?${query.toString()}`;
}

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div>
        <span className="rounded-lg bg-[#eef1f8] p-2 text-[var(--fm-navy)]">{icon}</span>
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">{detail}</p>
    </div>
  );
}

export default async function InventoryHistoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const filters = await searchParams;
  const session = await requireCrmSession();
  const page = Math.max(1, Number(filters.page) || 1);
  const [history, agents, locations] = await Promise.all([
    getInventoryHistory({
      q: filters.q, outcome: filters.outcome, acquisitionKind: filters.acquisitionKind,
      salesAgentId: filters.salesAgentId, enteredById: filters.enteredById, locationId: filters.locationId,
      from: filters.from, to: filters.to, sort: filters.sort ?? "eventAt",
      direction: filters.direction ?? "desc", page, limit: 25,
    }),
    getAssignableAgents(session),
    getOrganizationLocations(session.dealership.id, true),
  ]);

  return (
    <>
      <PageHeader title="Historial de stock y ventas" subtitle="Entradas, ventas y salidas físicas por unidad" action={<div className="flex gap-2"><a href={exportHref(filters)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium"><Download className="h-4 w-4 text-[var(--primary)]" />Exportar Excel</a><Link href="/vehiculos" className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium">Ver stock actual</Link></div>} />

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Metric label="En stock" value={history.summary.active} detail="Unidades todavía activas" icon={<Car className="h-4 w-4" />} />
        <Metric label="Vendidos" value={history.summary.sold} detail="Ventas cerradas" icon={<TrendingUp className="h-4 w-4" />} />
        <Metric label="Salidas" value={history.summary.exited} detail="Salidas sin venta asociada" icon={<History className="h-4 w-4" />} />
        <Metric label="Monto vendido" value={fmtCLP(history.summary.salesAmount)} detail={`Margen estimado ${fmtCLP(history.summary.estimatedMargin)}`} icon={<CircleDollarSign className="h-4 w-4" />} />
        <Metric label="Rotación" value={`${history.summary.avgStockDays} días`} detail="Promedio según filtros" icon={<Clock3 className="h-4 w-4" />} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Ventas por vendedor" subtitle="Atribución congelada al cierre de la venta">
          {history.byAgent.length ? <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-[var(--muted)]/60 text-left"><th className="px-3 py-2.5">Vendedor</th><th className="px-3 py-2.5 text-right">Vendidos</th><th className="px-3 py-2.5 text-right">Monto</th><th className="px-3 py-2.5 text-right">Margen est.</th></tr></thead><tbody>{history.byAgent.map((agent) => <tr key={agent.agentId ?? "none"} className="border-t border-[var(--border)]"><td className="px-3 py-2.5 font-medium">{agent.name}</td><td className="px-3 py-2.5 text-right font-semibold">{agent.sold}</td><td className="px-3 py-2.5 text-right">{fmtCLP(agent.amount)}</td><td className="px-3 py-2.5 text-right text-[var(--primary)]">{fmtCLP(agent.margin)}</td></tr>)}</tbody></table></div> : <EmptyState title="Todavía no hay ventas cerradas" />}
        </Panel>
        <Panel title="Movimiento por tipo de stock" subtitle="Situación de cada procedencia">
          <div className="grid gap-2 p-3 sm:grid-cols-3 xl:grid-cols-1">{history.byKind.map((kind) => <div key={kind.kind} className="rounded-lg border border-[var(--border)] bg-[#fbfbf9] p-3"><div className="flex justify-between"><strong className="text-xs">{KIND_LABEL[kind.kind] ?? kind.kind}</strong><span className="text-sm font-semibold">{kind.total}</span></div><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{kind.active} en stock · {kind.sold} vendidos · {kind.exited} salidas</p></div>)}</div>
        </Panel>
      </div>

      <Panel title="Detalle por unidad" subtitle={`${history.total} movimientos según los filtros`}>
        <form action="/historial-stock" className="grid gap-2 border-b border-[var(--border)] bg-[#f8f8f5] p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
          <input name="q" defaultValue={filters.q} placeholder="Código, patente, vehículo o agente" className={`${INPUT} sm:col-span-2`} />
          <select name="outcome" defaultValue={filters.outcome ?? ""} className={INPUT}><option value="">Todos los movimientos</option><option value="active">En stock</option><option value="sold">Vendidos</option><option value="exited">Salida sin venta</option></select>
          <select name="acquisitionKind" defaultValue={filters.acquisitionKind ?? ""} className={INPUT}><option value="">Todo tipo de stock</option><option value="purchase">Stock propio</option><option value="consignment">Consignado</option><option value="trade_in">Parte de pago</option></select>
          <select name="salesAgentId" defaultValue={filters.salesAgentId ?? ""} className={INPUT}><option value="">Todos los vendedores</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select>
          <select name="enteredById" defaultValue={filters.enteredById ?? ""} className={INPUT}><option value="">Ingresado por cualquiera</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select>
          <select name="locationId" defaultValue={filters.locationId ?? ""} className={INPUT}><option value="">Todas las sucursales</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
          <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-[var(--muted-foreground)]">Desde<input type="date" name="from" defaultValue={filters.from} className={INPUT} /></label>
          <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-[var(--muted-foreground)]">Hasta<input type="date" name="to" defaultValue={filters.to} className={INPUT} /></label>
          <select name="sort" defaultValue={filters.sort ?? "eventAt"} className={INPUT}><option value="eventAt">Orden: fecha</option><option value="stockDays">Orden: días stock</option><option value="amount">Orden: monto</option><option value="margin">Orden: margen</option><option value="stockNumber">Orden: código</option></select>
          <select name="direction" defaultValue={filters.direction ?? "desc"} className={INPUT}><option value="desc">Descendente</option><option value="asc">Ascendente</option></select>
          <div className="flex gap-2"><button className="h-10 flex-1 rounded-lg bg-[var(--fm-navy)] px-4 text-sm font-semibold text-white">Aplicar</button><Link href="/historial-stock" className="flex h-10 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-sm">Limpiar</Link></div>
        </form>

        <div className="max-h-[62vh] overflow-auto">
          <table className="min-w-[1960px] border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-20"><tr><th className={`${HEAD} sticky left-0 z-30`}>Código</th><th className={HEAD}>Patente</th><th className={HEAD}>Vehículo</th><th className={HEAD}>Tipo stock</th><th className={HEAD}>Resultado</th><th className={HEAD}>Ingreso</th><th className={HEAD}>Venta</th><th className={HEAD}>Salida física</th><th className={HEAD}>Días stock</th><th className={HEAD}>Sucursal</th><th className={HEAD}>Ingresado por</th><th className={HEAD}>Vendido por</th><th className={`${HEAD} text-right`}>Monto</th><th className={`${HEAD} text-right`}>Margen est.</th><th className={HEAD}>Motivo salida</th></tr></thead>
            <tbody>{history.items.length ? history.items.map((item, index) => <tr key={item.vehicleId} className={`${index % 2 ? "bg-[#fbfbf9]" : "bg-white"} hover:bg-[#eef4e9]`}><td className={`${CELL} sticky left-0 bg-inherit font-mono font-bold text-[var(--primary)]`}>{item.stockNumber == null ? "—" : `STK-${String(item.stockNumber).padStart(6, "0")}`}</td><td className={`${CELL} font-mono font-bold`}>{fmtPlate(item.patent)}</td><td className={`${CELL} font-medium`}>{[item.brand, item.model, item.year].filter(Boolean).join(" ") || "—"}</td><td className={CELL}>{KIND_LABEL[item.acquisitionKind ?? "unregistered"] ?? item.acquisitionKind}</td><td className={CELL}><Pill variant={item.outcome === "sold" ? "success" : item.outcome === "exited" ? "warn" : "neutral"}>{OUTCOME_LABEL[item.outcome]}</Pill></td><td className={CELL}>{fmtDate(item.receivedAt)}</td><td className={CELL}>{item.soldAt ? fmtDate(item.soldAt) : "—"}</td><td className={CELL}>{item.exitedAt ? fmtDate(item.exitedAt) : "—"}</td><td className={`${CELL} text-right font-semibold`}>{item.stockDays}</td><td className={CELL}>{item.locationName || "—"}</td><td className={CELL}>{item.enteredByName || "—"}</td><td className={`${CELL} font-medium`}>{item.salesAgentName || "Sin asignar"}</td><td className={`${CELL} text-right font-semibold`}>{item.outcome === "sold" ? fmtCLP(item.saleAmount) : "—"}</td><td className={`${CELL} text-right font-semibold text-[var(--primary)]`}>{item.outcome === "sold" ? fmtCLP(item.estimatedMargin) : "—"}</td><td className={CELL}>{item.exitReason || "—"}</td></tr>) : <tr><td colSpan={15}><EmptyState icon={<History className="h-6 w-6" />} title="No hay movimientos para estos filtros" /></td></tr>}</tbody>
          </table>
        </div>
        {history.totalPages > 1 && <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs"><span>Página {history.page} de {history.totalPages}</span><div className="flex gap-2">{history.page > 1 && <Link href={href(filters, { page: String(history.page - 1) })} className="flex items-center gap-1 rounded-lg border px-3 py-2"><ArrowLeft className="h-3.5 w-3.5" />Anterior</Link>}{history.page < history.totalPages && <Link href={href(filters, { page: String(history.page + 1) })} className="flex items-center gap-1 rounded-lg border px-3 py-2">Siguiente<ArrowRight className="h-3.5 w-3.5" /></Link>}</div></div>}
      </Panel>
    </>
  );
}

export const dynamic = "force-dynamic";
