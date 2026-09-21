import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Download, FileSpreadsheet, Inbox } from "lucide-react";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { requireCrmSession } from "@/lib/auth/session";
import {
  getAssignableAgents,
  getLeadPage,
  getOrganizationLocations,
} from "@/lib/data/crm";
import { fmtCLP, fmtDate, fmtNumber } from "@/lib/format";
import { sourceLabel, STAGES, stageLabel, toStage } from "@/lib/leads";

const INPUT = "h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]";

type Params = {
  // Solicitudes / leads
  q?: string; stage?: string; assignedTo?: string; source?: string; locationId?: string;
  from?: string; to?: string; sort?: string; page?: string;
  // Compatibilidad con enlaces anteriores a la pestaña de ventas del ERP
  sq?: string; sKind?: string; sAgent?: string; sLocation?: string; sFrom?: string; sTo?: string; sPage?: string;
  tab?: string;
};

function href(params: Params, changes: Partial<Params>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  for (const [key, value] of Object.entries(changes)) {
    if (value) query.set(key, value);
    else query.delete(key);
  }
  return `/reportes?${query.toString()}`;
}

function leadsExportHref(params: Params) {
  const query = new URLSearchParams();
  const map: [keyof Params, string][] = [["q", "q"], ["stage", "stage"], ["assignedTo", "assignedTo"], ["source", "source"], ["locationId", "locationId"], ["from", "from"], ["to", "to"], ["sort", "sort"]];
  for (const [key, out] of map) { const value = params[key]; if (value) query.set(out, value); }
  return `/api/crm/leads/export?${query.toString()}`;
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = await requireCrmSession();
  if (params.tab === "ventas") {
    const query = new URLSearchParams({ tab: "ventas" });
    for (const key of ["sq", "sKind", "sAgent", "sLocation", "sFrom", "sTo", "sPage"] as const) {
      if (params[key]) query.set(key, params[key]);
    }
    redirect(`/historial-stock?${query.toString()}`);
  }
  const leadsPage = Math.max(1, Number(params.page) || 1);

  const [leads, agents, locations] = await Promise.all([
    getLeadPage(session, {
      page: leadsPage, pageSize: 20, q: params.q, stage: params.stage, assignedTo: params.assignedTo,
      source: params.source, locationId: params.locationId, dateFrom: params.from, dateTo: params.to,
      sort: (params.sort as "urgency" | "progress" | "value" | "recent" | undefined) ?? "recent",
    }),
    getAssignableAgents(session),
    getOrganizationLocations(session.dealership.id),
  ]);

  return (
    <>
      <PageHeader title="Reportes" subtitle="Exportaciones a Excel de solicitudes, filtradas por fecha." />

      <SolicitudesPanel params={params} leads={leads} agents={agents} locations={locations} />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]"><FileSpreadsheet className="h-3.5 w-3.5" />Cada exportación aplica los filtros vigentes de su sección y trae hasta el total del periodo, no sólo lo visible en pantalla.</p>
    </>
  );
}

function SolicitudesPanel({
  params,
  leads,
  agents,
  locations,
}: {
  params: Params;
  leads: Awaited<ReturnType<typeof getLeadPage>>;
  agents: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
  return (
      <Panel
        title="Solicitudes"
        subtitle={`${fmtNumber(leads.summary.scopeTotal)} solicitudes según los filtros`}
        action={<a href={leadsExportHref(params)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium hover:border-[var(--primary)]"><Download className="h-4 w-4 text-[var(--primary)]" />Exportar Excel</a>}
      >
        <form action="/reportes" className="grid gap-2 border-b border-[var(--border)] bg-[#f8f8f5] p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
          <input name="q" defaultValue={params.q} placeholder="Contacto, teléfono, vehículo o vendedor" className={`${INPUT} sm:col-span-2`} />
          <select name="stage" defaultValue={params.stage ?? ""} className={INPUT}>
            <option value="">Todas las etapas</option>
            {STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}
          </select>
          <select name="source" defaultValue={params.source ?? ""} className={INPUT}>
            <option value="">Todos los orígenes</option>
            {leads.facets.sources.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
          </select>
          <select name="assignedTo" defaultValue={params.assignedTo ?? ""} className={INPUT}>
            <option value="">Todos los vendedores</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <select name="locationId" defaultValue={params.locationId ?? ""} className={INPUT}>
            <option value="">Todas las sucursales</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
          <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-[var(--muted-foreground)]">Desde<input type="date" name="from" defaultValue={params.from} className={INPUT} /></label>
          <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-[var(--muted-foreground)]">Hasta<input type="date" name="to" defaultValue={params.to} className={INPUT} /></label>
          <select name="sort" defaultValue={params.sort ?? "recent"} className={INPUT}>
            <option value="recent">Orden: más recientes</option>
            <option value="urgency">Orden: urgencia</option>
            <option value="progress">Orden: avance</option>
            <option value="value">Orden: valor</option>
          </select>
          <div className="flex gap-2"><button className="h-10 flex-1 rounded-lg bg-[var(--fm-navy)] px-4 text-sm font-semibold text-white">Filtrar</button><Link href="/reportes" className="flex h-10 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-sm">Limpiar</Link></div>
        </form>

        {leads.leads.length === 0 ? (
          <EmptyState icon={<Inbox className="h-6 w-6" />} title="Sin solicitudes para estos filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead className="bg-[var(--muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Contacto</th><th className="px-3 py-3">Vehículo</th><th className="px-3 py-3">Etapa</th><th className="px-3 py-3">Origen</th><th className="px-3 py-3">Vendedor</th><th className="px-3 py-3 text-right">Cotización</th><th className="px-3 py-3">Creado</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">{leads.leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3"><p className="font-medium">{lead.contactName}</p><p className="text-[var(--muted-foreground)]">{lead.contactPhone ?? "—"}</p></td>
                  <td className="px-3 py-3">{lead.vehicleLabel}</td>
                  <td className="px-3 py-3"><Pill variant={lead.stage === "won" ? "success" : lead.stage === "lost" ? "danger" : "neutral"}>{stageLabel(toStage(lead.rawStage))}</Pill></td>
                  <td className="px-3 py-3">{sourceLabel(lead.source)}</td>
                  <td className="px-3 py-3">{lead.assignedToName ?? "Sin asignar"}</td>
                  <td className="px-3 py-3 text-right font-mono">{lead.quotedPrice ? fmtCLP(lead.quotedPrice) : "—"}</td>
                  <td className="px-3 py-3 text-[var(--muted-foreground)]">{fmtDate(lead.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {leads.pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs"><span>Página {leads.pagination.page} de {leads.pagination.totalPages}</span><div className="flex gap-2">{leads.pagination.page > 1 && <Link href={href(params, { page: String(leads.pagination.page - 1) })} className="flex items-center gap-1 rounded-lg border px-3 py-2"><ArrowLeft className="h-3.5 w-3.5" />Anterior</Link>}{leads.pagination.hasNext && <Link href={href(params, { page: String(leads.pagination.page + 1) })} className="flex items-center gap-1 rounded-lg border px-3 py-2">Siguiente<ArrowRight className="h-3.5 w-3.5" /></Link>}</div></div>}
      </Panel>
  );
}

export const dynamic = "force-dynamic";
