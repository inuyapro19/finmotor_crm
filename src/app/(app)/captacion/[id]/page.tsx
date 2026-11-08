import { SourcingForm } from "@/components/acquisitions/sourcing-form";
import { PageHeader } from "@/components/ui/primitives";
import { backendJson } from "@/lib/api/client";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { stageLabel, type SourcingOpportunity, type SourcingSale, type SOURCING_STAGES } from "@/lib/sourcing";
import { fmtDateTime } from "@/lib/format";
import { Download, FileText } from "lucide-react";

// Informes que el propietario adjuntó en /consignar; el backend entrega URL firmada (bucket privado).
type OwnerReport = { type: string | null; label: string | null; filename: string | null; size: number | null; url: string | null };

function fmtSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function SourcingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmSession();
  const { id } = await params;
  const data = await backendJson<{ opportunity: SourcingOpportunity; sale?: SourcingSale | null; events: { stage: keyof typeof SOURCING_STAGES; createdAt: string; actorName?: string | null }[]; reports?: OwnerReport[] }>(`/backoffice/sourcing/${encodeURIComponent(id)}`);
  const reports = data.reports ?? [];
  return <><PageHeader title="Gestionar captación" />
    <SourcingForm key={`${id}-${data.opportunity.version}`} opportunity={data.opportunity} sale={data.sale} writable={canWrite(session.role)} />
    {reports.length > 0 && <div className="mx-auto mt-5 max-w-4xl rounded-xl border border-[var(--border)] p-5"><h2 className="mb-1 font-semibold">Informes del propietario</h2>
      <p className="mb-3 text-sm text-[var(--muted-foreground)]">Adjuntados por el propietario en su solicitud. El enlace de descarga vence en 1 hora; recarga la página para renovarlo.</p>
      <ul className="space-y-2 text-sm">{reports.map((report, i) => <li key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] p-3">
        <FileText size={18} className="shrink-0" />
        <span className="min-w-0 flex-1"><span className="block font-medium">{report.label ?? "Informe"}</span><span className="block truncate text-[var(--muted-foreground)]">{report.filename}{report.size ? ` · ${fmtSize(report.size)}` : ""}</span></span>
        {report.url
          ? <a href={report.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium hover:bg-[var(--muted)]"><Download size={16} /> Descargar</a>
          : <span className="text-[var(--muted-foreground)]">No disponible</span>}
      </li>)}</ul>
    </div>}
    <div className="mx-auto mt-5 max-w-4xl rounded-xl border border-[var(--border)] p-5"><h2 className="mb-3 font-semibold">Historial de gestión</h2>
      <ol className="space-y-2 text-sm">{data.events.map((event, i) => <li key={i}>{fmtDateTime(event.createdAt)} · {stageLabel(event.stage, data.opportunity.kind)}{event.actorName ? ` · ${event.actorName}` : ""}</li>)}</ol>
    </div>
  </>;
}
