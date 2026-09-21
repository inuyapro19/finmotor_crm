import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { backendJson } from "@/lib/api/client";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { SOURCING_CHANNELS, SOURCING_KINDS, SOURCING_STAGES, type SourcingOpportunity } from "@/lib/sourcing";
import { fmtCLP } from "@/lib/format";

export default async function SourcingPage({ searchParams }: { searchParams: Promise<{ page?: string; lead?: string }> }) {
  const session = await requireCrmSession();
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const params = new URLSearchParams({ page: String(page) });
  if (query.lead) params.set("relatedLeadId", query.lead);
  const data = await backendJson<{ items: SourcingOpportunity[]; total: number; limit: number }>(`/backoffice/sourcing?${params}`);
  const pageHref = (p: number) => `/captacion?${new URLSearchParams({ page: String(p), ...(query.lead ? { lead: query.lead } : {}) })}`;
  return <>
    <PageHeader title="Captación de vehículos" />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">Contacto → Evaluación → Tasación → Negociación → Acuerdo aceptado → Recepción en ERP</p>
      {canWrite(session.role) && <Link className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white" href={`/captacion/nueva${query.lead ? `?lead=${encodeURIComponent(query.lead)}` : ""}`}>Nueva captación</Link>}
    </div>
    {query.lead && <p className="mb-4 text-sm">Captaciones de la venta seleccionada. <Link className="underline" href="/captacion">Ver todas</Link></p>}
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--fm-navy)] text-white"><tr>{["Contacto / vehículo", "Canal", "Modalidad", "Etapa", "Valor acordado", ""].map((l, i) => <th key={i} className="whitespace-nowrap px-4 py-3">{l}</th>)}</tr></thead>
        <tbody>{data.items.map(item => <tr key={item.id} className="border-t border-[var(--border)]">
          <td className="px-4 py-4"><Link className="font-semibold underline" href={`/captacion/${item.id}`}>{item.details.ownerName}</Link><p className="text-xs text-[var(--muted-foreground)]">{[item.details.plate, item.details.brand, item.details.model, item.details.year].filter(Boolean).join(" · ") || "Vehículo por identificar"}</p></td>
          <td className="px-4 py-4">{SOURCING_CHANNELS[item.channel]}</td><td className="px-4 py-4">{SOURCING_KINDS[item.kind]}</td><td className="px-4 py-4">{SOURCING_STAGES[item.stage]}</td>
          <td className="whitespace-nowrap px-4 py-4">{fmtCLP(item.kind === "purchase" ? item.details.purchasePrice : item.kind === "trade_in" ? item.details.tradeInValue : item.details.minPrice)}<p className="text-xs text-[var(--muted-foreground)]">{item.kind === "purchase" ? "Precio de compra" : item.kind === "trade_in" ? "Valor de recepción" : `Mínimo autorizado · Comisión ${item.details.commissionPct ?? "—"}%`}</p></td>
          <td className="px-4 py-4">{item.vehicleId && <Link className="underline" href={`/vehiculos/editar/${item.vehicleId}`}>Ver stock</Link>}</td>
        </tr>)}</tbody>
      </table>
      {!data.items.length && <p className="p-8 text-center text-sm text-[var(--muted-foreground)]">Todavía no hay captaciones. Registra un contacto para comenzar su evaluación.</p>}
    </div>
    <div className="mt-4 flex justify-between text-sm"><span>{data.total} captaciones</span><div className="flex gap-4">{page > 1 && <Link href={pageHref(page - 1)}>Anterior</Link>}{page * data.limit < data.total && <Link href={pageHref(page + 1)}>Siguiente</Link>}</div></div>
  </>;
}
