import { redirect } from "next/navigation";

import { LeadsBoard, leadListHref, type LeadBoardFilters } from "@/components/leads/leads-board";
import { NewLead } from "@/components/leads/new-lead";
import { PageHeader } from "@/components/ui/primitives";
import { requireCrmSession } from "@/lib/auth/session";
import {
  getAssignableAgents,
  getLeadPage,
  getOrganizationLocations,
  type LeadListSort,
} from "@/lib/data/crm";
import { STAGES, type LeadStage } from "@/lib/leads";

type RawSearchParams = Partial<Record<
  "q" | "estado" | "responsable" | "atraso" | "origen" | "sucursal" | "orden" | "page",
  string | string[]
>>;

const SORTS: LeadListSort[] = ["urgency", "progress", "value", "recent"];
const STAGE_KEYS = new Set<LeadStage>(STAGES.map((stage) => stage.key));

function scalar(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function cleanText(value: string | undefined, maxLength: number): string | undefined {
  const cleaned = value?.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function cleanIdentifier(value: string | undefined): string | undefined {
  const cleaned = cleanText(value, 80);
  return cleaned && /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : undefined;
}

function positivePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const session = await requireCrmSession();
  const [agents, locations] = await Promise.all([
    getAssignableAgents(session),
    getOrganizationLocations(session.dealership.id),
  ]);

  const rawStage = scalar(raw.estado);
  const rawSort = scalar(raw.orden);
  const rawAssignee = cleanIdentifier(scalar(raw.responsable));
  const rawLocation = cleanIdentifier(scalar(raw.sucursal));
  const filters: LeadBoardFilters = {
    q: cleanText(scalar(raw.q), 120),
    estado: STAGE_KEYS.has(rawStage as LeadStage) ? rawStage as LeadStage : undefined,
    responsable: !session.portfolioRestricted && agents.some((agent) => agent.id === rawAssignee)
      ? rawAssignee
      : undefined,
    atraso: ["1", "true"].includes(scalar(raw.atraso) ?? "") ? "1" : undefined,
    origen: cleanIdentifier(scalar(raw.origen)),
    sucursal: locations.some((location) => location.id === rawLocation) ? rawLocation : undefined,
    orden: SORTS.includes(rawSort as LeadListSort) ? rawSort as LeadListSort : "urgency",
    page: positivePage(scalar(raw.page)),
  };

  const result = await getLeadPage(session, {
    page: filters.page,
    pageSize: 50,
    q: filters.q,
    stage: filters.estado,
    assignedTo: filters.responsable,
    overdue: filters.atraso === "1",
    source: filters.origen,
    locationId: filters.sucursal,
    sort: filters.orden,
  });

  if (!result.error && result.pagination.totalPages > 0 && filters.page > result.pagination.totalPages) {
    redirect(leadListHref(filters, { page: result.pagination.totalPages }));
  }

  return (
    <>
      <PageHeader
        title="Leads y oportunidades"
        subtitle={subtitle({
          error: result.error,
          total: result.summary.scopeTotal,
          uncontacted: result.facets.byStage.new ?? 0,
          overdue: result.summary.overdueCount,
          dealership: session.dealership.name,
          onlyMine: session.portfolioRestricted,
        })}
        action={<NewLead />}
      />

      <LeadsBoard
        result={result}
        filters={filters}
        agents={agents}
        locations={locations}
        currentUserId={session.userId}
        showAssignee={!session.portfolioRestricted}
        dealershipName={session.dealership.name}
        portfolioRestricted={session.portfolioRestricted}
      />
    </>
  );
}

function subtitle({
  error,
  total,
  uncontacted,
  overdue,
  dealership,
  onlyMine,
}: {
  error: "forbidden" | "unavailable" | "unexpected" | null;
  total: number;
  uncontacted: number;
  overdue: number;
  dealership: string;
  onlyMine: boolean;
}): string {
  if (error) return "No pudimos actualizar la bandeja en este momento.";
  if (total === 0) {
    return onlyMine ? "Todavía no tienes solicitudes asignadas." : `Sin solicitudes en ${dealership}.`;
  }
  const scope = onlyMine ? "en tu cartera" : `en ${dealership}`;
  const parts = [`${total} ${total === 1 ? "solicitud" : "solicitudes"} ${scope}`];
  if (uncontacted > 0) parts.push(`${uncontacted} sin contactar`);
  if (overdue > 0) parts.push(`${overdue} con compromiso vencido`);
  return `${parts.join(" · ")}.`;
}

export const dynamic = "force-dynamic";
