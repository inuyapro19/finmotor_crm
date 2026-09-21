import { SourcingForm } from "@/components/acquisitions/sourcing-form";
import { PageHeader } from "@/components/ui/primitives";
import { backendJson } from "@/lib/api/client";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { SOURCING_STAGES, type SourcingOpportunity } from "@/lib/sourcing";
import { fmtDateTime } from "@/lib/format";

export default async function SourcingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmSession();
  const { id } = await params;
  const data = await backendJson<{ opportunity: SourcingOpportunity; events: { stage: keyof typeof SOURCING_STAGES; createdAt: string }[] }>(`/backoffice/sourcing/${encodeURIComponent(id)}`);
  return <><PageHeader title="Gestionar captación" />
    <SourcingForm key={`${id}-${data.opportunity.version}`} opportunity={data.opportunity} writable={canWrite(session.role)} />
    <div className="mx-auto mt-5 max-w-4xl rounded-xl border border-[var(--border)] p-5"><h2 className="mb-3 font-semibold">Historial de gestión</h2>
      <ol className="space-y-2 text-sm">{data.events.map((event, i) => <li key={i}>{fmtDateTime(event.createdAt)} · {SOURCING_STAGES[event.stage]}</li>)}</ol>
    </div>
  </>;
}
