import Link from "next/link";
import { ArrowLeft, ArrowRight, Landmark } from "lucide-react";

import { EmptyState, PageHeader, Panel, Pill, StatCard } from "@/components/ui/primitives";
import { CREDIT_OPEN_STATUSES, creditStatus } from "@/lib/credit";
import { getCreditLeads } from "@/lib/data/crm";
import { fmtCLP, fmtDateTime, fmtNumber, fmtPlate } from "@/lib/format";

function pageHref(status: string | undefined, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (status) params.set("status", status);
  return `/creditos?${params.toString()}`;
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const filters = await searchParams;
  const page = Math.max(1, Number(filters.page) || 1);
  const result = await getCreditLeads({ page, limit: 25, status: filters.status });
  const approved = result.items.filter((item) => ["approved", "disbursed"].includes(item.status)).length;
  const pending = result.items.filter((item) =>
    (CREDIT_OPEN_STATUSES as readonly string[]).includes(item.status),
  ).length;
  const requestedAmount = result.items.reduce((total, item) => total + (item.requestedAmount ?? 0), 0);

  return (
    <>
      <PageHeader title="Créditos" subtitle="Seguimiento de simulaciones enviadas a evaluación desde los leads." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Solicitudes" value={fmtNumber(result.total)} />
        {/* Los dos cuentan sobre la pagina que se esta viendo, no sobre el total: se dice. */}
        <StatCard label="Esperando respuesta en esta página" value={fmtNumber(pending)} />
        <StatCard label="Aprobadas o cursadas en esta página" value={fmtNumber(approved)} />
        <StatCard label="Monto solicitado" value={fmtCLP(requestedAmount)} />
      </div>
      <Panel className="mb-4">
        <form action="/creditos" className="flex flex-wrap gap-2 p-3">
          <select name="status" defaultValue={filters.status ?? ""} className="min-w-52 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 text-sm">
            <option value="">Todos los estados</option>
            <option value="evaluating">En evaluación</option>
            <option value="preapproved">Preaprobados</option>
            <option value="approved">Aprobados</option>
            <option value="disbursed">Cursados</option>
            <option value="rejected">Rechazados</option>
          </select>
          <button className="rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-4 py-2.5 text-sm font-medium text-white">Filtrar</button>
        </form>
      </Panel>
      <Panel title="Solicitudes de financiamiento" subtitle={`${fmtNumber(result.total)} registros`}>
        {result.items.length === 0 ? (
          <EmptyState icon={<Landmark className="h-6 w-6" />} title="No hay créditos para esta vista" description="Las simulaciones aparecen aquí cuando se envían a evaluación desde un lead." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
              <thead className="bg-[var(--muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                <tr><th className="px-4 py-3">Cliente</th><th className="px-3 py-3">Vehículo</th><th className="px-3 py-3">Solicitud</th><th className="px-3 py-3">Pie</th><th className="px-3 py-3">Plazo / cuota</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Financiera</th><th className="px-3 py-3">Fecha</th><th className="px-4 py-3">Lead</th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {result.items.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--muted)]/30">
                    <td className="px-4 py-3"><p className="font-semibold">{item.buyerName || "Cliente sin nombre"}</p><p className="text-[var(--muted-foreground)]">{item.rut || item.buyerPhone || "Sin identificación"}</p></td>
                    <td className="px-3 py-3"><p className="font-medium">{item.vehicleLabel || "Vehículo"}</p><p className="font-mono text-[var(--muted-foreground)]">{fmtPlate(item.vehiclePatent)}</p></td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmtCLP(item.requestedAmount)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtCLP(item.downPaymentAmount)}</td>
                    <td className="px-3 py-3"><p>{item.termMonths ? `${item.termMonths} meses` : "—"}</p><p className="text-[var(--muted-foreground)]">{item.monthlyPayment ? fmtCLP(item.monthlyPayment) : "Sin cuota"}</p></td>
                    <td className="px-3 py-3"><Pill variant={creditStatus(item.status).variant}>{creditStatus(item.status).label}</Pill></td>
                    <td className="px-3 py-3">{item.institutionName || "Por asignar"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-[var(--muted-foreground)]">{fmtDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3">{item.commercialLeadId ? <Link href={`/solicitudes/${item.commercialLeadId}?tab=financiamiento`} className="font-semibold text-[var(--primary)]">Abrir simulación</Link> : <span className="text-[var(--muted-foreground)]">Sin lead CRM</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs"><span className="text-[var(--muted-foreground)]">Página {result.page} de {result.totalPages}</span><div className="flex gap-2">{result.page > 1 && <Link href={pageHref(filters.status, result.page - 1)} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-2"><ArrowLeft className="h-3.5 w-3.5" />Anterior</Link>}{result.page < result.totalPages && <Link href={pageHref(filters.status, result.page + 1)} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-2">Siguiente<ArrowRight className="h-3.5 w-3.5" /></Link>}</div></div>
        )}
      </Panel>
    </>
  );
}

export const dynamic = "force-dynamic";
