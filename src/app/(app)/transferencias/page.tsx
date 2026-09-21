import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowRightLeft, Search } from "lucide-react";

import { TransferCreateDialog } from "@/components/transfers/transfer-create-dialog";
import { TransferStatusAction } from "@/components/transfers/transfer-status-action";
import { EmptyState, Notice, PageHeader, Panel, Pill, StatCard } from "@/components/ui/primitives";
import { canManageTransfers, requireCrmSession } from "@/lib/auth/session";
import { getAcquisitions, getDealershipTransfers, getLeads, getOrganization } from "@/lib/data/crm";
import { fmtCLP, fmtDateTime, fmtNumber, fmtPlate } from "@/lib/format";
import { TRANSFER_STATUS, transferStatus } from "@/lib/transfers";

export default async function TransfersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const filters = await searchParams;
  const session = await requireCrmSession();
  const page = Math.max(1, Number(filters.page) || 1);
  const [result, allTransfers, acquisitions, leads, organization] = await Promise.all([
    getDealershipTransfers(session.dealership.id, { page, limit: 25, status: filters.status }),
    getDealershipTransfers(session.dealership.id, { page: 1, limit: 200 }),
    getAcquisitions(),
    getLeads(session),
    getOrganization(session.dealership.id),
  ]);
  const existing = new Set(allTransfers.transfers.map((transfer) => transfer.acquisitionId));
  const eligible = acquisitions.filter((item) => item.organizationId === session.dealership.id && ["purchase", "trade_in"].includes(item.kind) && item.status !== "cancelled" && !existing.has(item.id));
  const scopedLeads = leads.filter((lead) => lead.organizationId === session.dealership.id);
  const canOperate = canManageTransfers(session.dealership.memberRole);
  const buyerComplete = Boolean(organization?.rut && organization?.legalRepresentative && organization?.legalRepresentativeRut && organization?.address);

  return (
    <>
      <PageHeader
        title="Transferencias"
        subtitle="Ingreso de dominio desde un vendedor particular a la automotora."
        action={canOperate ? <TransferCreateDialog acquisitions={eligible} leads={scopedLeads} /> : undefined}
      />
      {!buyerComplete && canOperate && (
        <div className="mb-4"><Notice tone="warn">Completa los datos del comprador legal en <Link href="/perfil" className="font-semibold underline">Perfil</Link> antes de registrar una transferencia.</Notice></div>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Operaciones" value={fmtNumber(result.summary.total)} />
        <StatCard label="En proceso" value={fmtNumber(result.summary.inProgress + result.summary.pending)} />
        <StatCard label="Completadas" value={fmtNumber(result.summary.completed)} />
        <StatCard label="Postpago pendiente" value={fmtCLP(result.summary.unbilledAmountClp)} hint={`${fmtNumber(result.summary.unbilledQuantity)} usos`} tone={result.summary.unbilledQuantity > 0 ? "alert" : "neutral"} />
      </div>
      <Panel className="mb-4">
        <form action="/transferencias" className="flex flex-col gap-3 p-3 sm:flex-row">
          <select name="status" defaultValue={filters.status ?? ""} className="flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm">
            <option value="">Todos los estados</option>
            {Object.entries(TRANSFER_STATUS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-4 py-2.5 text-sm font-medium text-white"><Search className="h-4 w-4" />Filtrar</button>
        </form>
      </Panel>
      <Panel title="Operaciones de la automotora" subtitle={`${fmtNumber(result.pagination.total)} transferencias`}>
        {result.transfers.length === 0 ? (
          <EmptyState icon={<ArrowRightLeft className="h-6 w-6" />} title="No hay transferencias" description="Registra una desde un ingreso de compra directa o permuta." />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                <thead className="bg-[var(--muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Vehículo</th><th className="px-3 py-3">Vendedor</th><th className="px-3 py-3">Comprador</th><th className="px-3 py-3">Sucursal / lead</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3 text-right">Servicio</th><th className="px-3 py-3">Creada</th><th className="px-4 py-3" /></tr></thead>
                <tbody className="divide-y divide-[var(--border)]">{result.transfers.map((transfer) => (
                  <tr key={transfer.id}><td className="px-4 py-3"><p className="font-mono font-semibold">{fmtPlate(transfer.plate)}</p><p className="text-[var(--muted-foreground)]">{transfer.vehicleLabel || "Vehículo"} · {fmtCLP(transfer.vehicleValueClp)}</p></td><td className="px-3 py-3"><p className="font-medium">{transfer.seller.name || "—"}</p><p className="font-mono text-[var(--muted-foreground)]">{transfer.seller.rut || "—"}</p></td><td className="px-3 py-3"><p className="font-medium">{transfer.buyer.companyName || session.dealership.name}</p><p className="font-mono text-[var(--muted-foreground)]">{transfer.buyer.companyRut || "—"}</p></td><td className="px-3 py-3"><p>{transfer.locationName || "—"}</p><p className="text-[var(--muted-foreground)]">{transfer.leadName || "Sin solicitud"}</p></td><td className="px-3 py-3"><Pill variant={transferStatus(transfer.status).variant}>{transferStatus(transfer.status).label}</Pill></td><td className="px-3 py-3 text-right font-mono font-medium">{fmtCLP(transfer.serviceFeeClp)}</td><td className="px-3 py-3 text-[var(--muted-foreground)]">{fmtDateTime(transfer.createdAt)}</td><td className="px-4 py-3">{canOperate && <TransferStatusAction transferId={transfer.id} status={transfer.status} />}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <ul className="divide-y divide-[var(--border)] lg:hidden">{result.transfers.map((transfer) => (
              <li key={transfer.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold">{fmtPlate(transfer.plate)}</p><p className="text-xs text-[var(--muted-foreground)]">{transfer.vehicleLabel || "Vehículo"}</p></div><Pill variant={transferStatus(transfer.status).variant}>{transferStatus(transfer.status).label}</Pill></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-[10px] uppercase text-[var(--muted-foreground)]">Vendedor</p><p>{transfer.seller.name || "—"}</p></div><div><p className="text-[10px] uppercase text-[var(--muted-foreground)]">Sucursal</p><p>{transfer.locationName || "—"}</p></div><div><p className="text-[10px] uppercase text-[var(--muted-foreground)]">Valor vehículo</p><p>{fmtCLP(transfer.vehicleValueClp)}</p></div><div><p className="text-[10px] uppercase text-[var(--muted-foreground)]">Servicio</p><p className="font-semibold">{fmtCLP(transfer.serviceFeeClp)}</p></div></div>{canOperate && <TransferStatusAction transferId={transfer.id} status={transfer.status} />}</li>
            ))}</ul>
          </>
        )}
        {result.pagination.pages > 1 && <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs"><Link href={`/transferencias?status=${filters.status ?? ""}&page=${Math.max(1, page - 1)}`} className={page <= 1 ? "pointer-events-none opacity-40" : "flex items-center gap-1"}><ArrowLeft className="h-3.5 w-3.5" />Anterior</Link><span>Página {page} de {result.pagination.pages}</span><Link href={`/transferencias?status=${filters.status ?? ""}&page=${Math.min(result.pagination.pages, page + 1)}`} className={page >= result.pagination.pages ? "pointer-events-none opacity-40" : "flex items-center gap-1"}>Siguiente<ArrowRight className="h-3.5 w-3.5" /></Link></div>}
      </Panel>
    </>
  );
}

export const dynamic = "force-dynamic";
