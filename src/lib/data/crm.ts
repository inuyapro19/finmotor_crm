/**
 * Acceso a datos del CRM. Todas las lecturas pasan por aquí para que las páginas no repitan
 * rutas del backend ni reglas de acote.
 *
 * Endpoints usados (los que el backend expone hoy):
 *   GET /backoffice/team              → miembros, equipos y leads comerciales
 *   GET /backoffice/vehicles          → publicaciones de la automotora
 *   GET /backoffice/analytics/stock   → resumen de inventario
 *   GET /backoffice/analytics/aging   → días publicado por unidad
 *
 * ACOTE POR AGENTE: lo aplica el **backend**. `resolve_backoffice_scope` marca
 * `portfolio_restricted` cuando el usuario no tiene rol administrativo en ninguna de sus
 * automotoras, y el repositorio filtra por `commercial_leads.assigned_to`. Es decir, un
 * agente ya no recibe los leads ajenos ni consultando el API directamente.
 *
 * `visibleLeads()` se conserva como red de seguridad de la interfaz (defensa en profundidad
 * y compatibilidad si el backend aún no informa el flag), pero **no es** la autorización.
 */
import { cache } from "react";
import { BackendError, backendJson, backendJsonOrNull } from "@/lib/api/client";
import { type CrmSession } from "@/lib/auth/session";
import {
  fromCrmLead,
  type BackendCrmLead,
  type BackendTeamMember,
  type BackendTeamResponse,
  type Lead,
  type LeadActivity,
  type LeadTask,
  type LeadVehicleInterest,
  type MyTask,
} from "@/lib/leads";

export type StockSummary = {
  published: number;
  reserved: number;
  sold: number;
  draft: number;
  total: number;
  inventoryValue: number;
  ownCount: number;
  ownValue: number;
  consignedCount: number;
  consignedValue: number;
  soldMonth: number;
  soldYear: number;
  transfersCompleted: number;
};

/** Item de `GET /backoffice/analytics/aging` (ya viene en camelCase desde el backend). */
export type AgingItem = {
  id: string;
  label: string;
  patent: string | null;
  status: string | null;
  price: number | null;
  daysPublished: number;
  isStale: boolean;
};

export type AgingResponse = {
  items: AgingItem[];
  buckets: { d0_15: number; d16_30: number; d31_60: number; d60_plus: number };
  avgDays: number;
  reserved: number;
};

export type VehicleRow = {
  id: string;
  stockNumber: number | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  status: string | null;
  patent: string | null;
  mileage: number | null;
  vehicleType: string | null;
  fuelType: string | null;
  transmission: string | null;
  vin: string | null;
  color: string | null;
  salePriority: boolean;
  enteredById: string | null;
  enteredByName: string | null;
  isVerified: boolean;
  createdAt: string | null;
  acquisitionKind: string | null;
  ownerName: string | null;
  acquisitionId: string | null;
  acquisitionStatus: string | null;
  purchasePrice: number | null;
  minPrice: number | null;
  commissionPct: number | null;
  receivedAt: string | null;
  exitedAt: string | null;
  inventoryLocation: string | null;
  locationId: string | null;
  lienStatus: string | null;
  contractIssuedAt: string | null;
  detailingStatus: string;
  photosStatus: string;
  parkingNumber: number | null;
  parkingCapacity: number;
};

export type VehicleDetail = {
  id: string;
  stockNumber: number | null;
  patent: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  status: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  transmission: string | null;
  vin: string | null;
  engine: string | null;
  color: string | null;
  doors: number | null;
  description: string | null;
  financingAvailable: boolean;
  /** La automotora la marcó como prioritaria para vender (señal de negocio para MIA, no de
   * calce con el comprador — ver vehicle-score.ts en frontend-web). */
  salePriority: boolean;
  photos: { id: string; url: string; position: number }[];
};

/* ── Equipo y leads ──────────────────────────────────────────────── */

const fetchTeam = cache(async function fetchTeam(): Promise<BackendTeamResponse | null> {
  return backendJsonOrNull<BackendTeamResponse>("/backoffice/team");
});

/**
 * Solicitudes de la automotora desde `GET /backoffice/leads`, que trae los campos del ciclo
 * de vida (contacto sin cuenta, `firstContactedAt`, `lostReason`) y ya aplica el acote por
 * organización y por agente.
 */
export const getLeads = cache(async function getLeads(session: CrmSession): Promise<Lead[]> {
  const data = await backendJsonOrNull<{ ok: boolean; leads: BackendCrmLead[] }>(
    "/backoffice/leads?limit=200",
  );
  const orgIds = new Set(session.dealerships.map((d) => d.id));
  return (data?.leads ?? [])
    .filter((l) => !l.sellerOrganizationId || orgIds.has(l.sellerOrganizationId))
    .map(fromCrmLead);
});

/** Solicitud de financiamiento enviada a la financiera desde el CRM. */
export type CreditRequest = {
  id: string;
  rut: string | null;
  amount: number | null;
  downPayment: number | null;
  termMonths: number | null;
  monthlyPayment: number | null;
  status: string | null;
  createdAt: string | null;
  /** false = la automotora todavía no tiene financiera asociada; lo ve el equipo Finmotor. */
  sentToFinancier: boolean;
  /** Cargados por `PATCH /leads/{id}/credit/{creditLeadId}` al transcribir la respuesta. */
  institutionName: string | null;
  approvedAmount: number | null;
};

/** Tasa y plazos con los que simula el mostrador. Vienen del backend, no se copian aquí. */
export type CreditTerms = { monthlyRate: number; terms: number[] };

/**
 * Términos del cobro, calculados por el servidor — que es además quien los valida al
 * registrar el pago. No deducir esto acá: cuando el frontend lo hacía por su cuenta
 * (`creditRequests.length > 0`, que cuenta las rechazadas) pedía el pie mientras el backend
 * esperaba el total, y el agente recibía un `amount_mismatch` sin explicación.
 */
export type SaleTerms = {
  /** true = se cobra el pie; false = el total. */
  financed: boolean;
  /** Respuesta de la financiera ya transcrita: "approved" | "rejected" | null (sin respuesta). */
  financeStatus: string | null;
  amountDueClp: number;
};

export type LeadDetail = {
  lead: Lead;
  activities: LeadActivity[];
  tasks: LeadTask[];
  vehicleInterests: LeadVehicleInterest[];
  creditRequests: CreditRequest[];
  creditTerms: CreditTerms;
  sale: SaleTerms;
};

/** Detalle con bitácora, tareas, cotización y financiamiento, para la ficha. */
export async function getLeadDetail(leadId: string): Promise<LeadDetail | null> {
  const data = await backendJsonOrNull<{
    ok: boolean;
    lead: BackendCrmLead;
    activities: LeadActivity[];
    tasks: LeadTask[];
    vehicleInterests: LeadVehicleInterest[];
    creditRequests: CreditRequest[];
    creditTerms: CreditTerms;
    sale: SaleTerms;
  }>(`/backoffice/leads/${leadId}`);
  if (!data?.lead) return null;
  const lead = fromCrmLead(data.lead);
  return {
    lead,
    activities: data.activities ?? [],
    tasks: data.tasks ?? [],
    vehicleInterests: data.vehicleInterests ?? [],
    creditRequests: data.creditRequests ?? [],
    creditTerms: data.creditTerms ?? { monthlyRate: 0.021, terms: [12, 24, 36, 48] },
    // Respaldo sólo por si el backend es más viejo que este build: sin financiamiento y el
    // total a cobrar, que es la lectura conservadora (nunca cobrar de menos).
    sale: data.sale ?? {
      financed: false,
      financeStatus: lead.financeStatus ?? null,
      amountDueClp: Math.round(lead.quotedPrice ?? lead.vehiclePrice ?? 0),
    },
  };
}

/** "Mi día": tareas abiertas agrupadas, para el home del CRM (`GET /backoffice/leads/tasks/mine`). */
export async function getMyTasks(): Promise<{
  overdue: MyTask[];
  today: MyTask[];
  upcoming: MyTask[];
}> {
  const data = await backendJsonOrNull<{
    ok: boolean;
    overdue: MyTask[];
    today: MyTask[];
    upcoming: MyTask[];
  }>("/backoffice/leads/tasks/mine");
  return { overdue: data?.overdue ?? [], today: data?.today ?? [], upcoming: data?.upcoming ?? [] };
}

/**
 * Recorta la lista a la cartera del agente. El backend ya lo hace (`portfolio_restricted`);
 * esto sólo evita mostrar de más si un despliegue quedara desalineado.
 */
export function visibleLeads(leads: Lead[], session: CrmSession): Lead[] {
  if (!session.portfolioRestricted) return leads;
  return leads.filter((l) => l.assignedTo === session.userId);
}

export async function getTeamMembers(session: CrmSession): Promise<BackendTeamMember[]> {
  const data = await fetchTeam();
  const orgIds = new Set(session.dealerships.map((d) => d.id));
  return (data?.members ?? []).filter((m) => !m.organizationId || orgIds.has(m.organizationId));
}

/** Miembros a los que se puede asignar un lead: activos con rol de venta. */
export async function getAssignableAgents(
  session: CrmSession,
): Promise<{ id: string; name: string }[]> {
  const members = await getTeamMembers(session);
  const seen = new Map<string, string>();
  for (const m of members) {
    if (!m.userId || !m.isActive) continue;
    if (!["owner", "admin", "manager", "salesperson"].includes(String(m.role))) continue;
    if (!seen.has(m.userId)) seen.set(m.userId, m.name || m.email || "Sin nombre");
  }
  return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/* ── Organización ────────────────────────────────────────────────── */

/** Estado público de un canal. Las credenciales NUNCA viajan de vuelta desde el backend. */
export type OrganizationChannel = {
  channel: string;
  enabled: boolean;
  sellerIdentifier: string | null;
  autoPublish: boolean;
  hasCredentials: boolean;
  credentialKeys: string[];
};

export type Organization = {
  id: string;
  name: string | null;
  type: string | null;
  rut: string | null;
  legalName: string | null;
  address: string | null;
  commune: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  legalRepresentative: string | null;
  legalRepresentativeRut: string | null;
  powerDate: string | null;
  powerDocumentType: string | null;
  notaryOffice: string | null;
  notaryName: string | null;
  defaultCommissionPct: number | null;
  hasLogo: boolean;
  logoUpdatedAt: string | null;
  channels: OrganizationChannel[];
};

export type InventoryHistoryItem = {
  vehicleId: string;
  stockNumber: number | null;
  patent: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  vehicleStatus: string | null;
  acquisitionKind: string | null;
  receivedAt: string | null;
  exitedAt: string | null;
  exitReason: string | null;
  locationName: string | null;
  soldAt: string | null;
  purchaseId: string | null;
  purchasePrice: number | null;
  saleAmount: number | null;
  tradeInValue: number | null;
  minPrice: number | null;
  commissionPct: number | null;
  enteredById: string | null;
  enteredByName: string | null;
  salesAgentId: string | null;
  salesAgentName: string | null;
  outcome: "active" | "sold" | "exited";
  stockDays: number;
  estimatedMargin: number | null;
  eventAt: string | null;
};

export type InventoryHistoryResult = {
  items: InventoryHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: { active: number; sold: number; exited: number; salesAmount: number; estimatedMargin: number; avgStockDays: number };
  byAgent: { agentId: string | null; name: string; sold: number; amount: number; margin: number }[];
  byKind: { kind: string; total: number; active: number; sold: number; exited: number }[];
};

export type OrganizationLocation = {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  commune: string | null;
  isMain: boolean;
  isActive: boolean;
  parkingCapacity: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type VehiclePreparation = {
  acquisitionId: string;
  detailingStatus: "pending" | "completed";
  photosStatus: "pending" | "completed";
  photoCount: number;
  parkingNumber: number | null;
  parkingStatus: "assigned" | "waiting_preparation" | "not_configured" | "full" | "pending";
  parkingCapacity: number;
  freeSpots: number;
  readyAt: string | null;
};

export const getOrganization = cache(async function getOrganization(
  orgId: string,
): Promise<Organization | null> {
  const data = await backendJsonOrNull<{ ok: boolean; organization: Organization }>(
    `/backoffice/organizations/${orgId}`,
  );
  return data?.organization ?? null;
});

/** `priority` = Opportunity Priority Score del motor MIA-CRM (R-PRI-01): margen
 *  esperado por dia ajustado por vendedor, no antiguedad del lead. */
export type LeadListSort = "priority" | "urgency" | "progress" | "value" | "recent";
export type LeadListFilters = {
  page: number;
  pageSize: number;
  q?: string;
  stage?: string;
  assignedTo?: string;
  overdue?: boolean;
  source?: string;
  locationId?: string;
  /** Fecha de creación del lead, formato `YYYY-MM-DD` (inclusive). */
  dateFrom?: string;
  dateTo?: string;
  sort: LeadListSort;
};
export type LeadListResult = {
  leads: Lead[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number; hasNext: boolean };
  summary: { scopeTotal: number; valueInPlay: number; overdueCount: number; slaLateCount: number };
  facets: { byStage: Record<string, number>; sources: string[] };
  error: "forbidden" | "unavailable" | "unexpected" | null;
};

/** Bandeja paginada. A diferencia de `getLeads`, nunca convierte una caída en una lista vacía. */
export async function getLeadPage(
  session: CrmSession,
  filters: LeadListFilters,
): Promise<LeadListResult> {
  const params = new URLSearchParams({
    organizationId: session.dealership.id,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    sort: filters.sort,
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
  if (filters.overdue) params.set("overdue", "true");
  if (filters.source) params.set("source", filters.source);
  if (filters.locationId) params.set("locationId", filters.locationId);
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);

  const fallback: LeadListResult = {
    leads: [],
    pagination: { page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 0, hasNext: false },
    summary: { scopeTotal: 0, valueInPlay: 0, overdueCount: 0, slaLateCount: 0 },
    facets: { byStage: {}, sources: [] },
    error: null,
  };
  try {
    const data = await backendJson<{
      ok: boolean;
      leads: BackendCrmLead[];
      pagination: LeadListResult["pagination"];
      summary: LeadListResult["summary"];
      facets: LeadListResult["facets"];
    }>(`/backoffice/leads?${params.toString()}`);
    if (!data.ok) throw new BackendError(502, "invalid_lead_list_response");
    return {
      leads: (data.leads ?? []).map(fromCrmLead),
      pagination: data.pagination,
      summary: data.summary,
      facets: data.facets,
      error: null,
    };
  } catch (error) {
    return {
      ...fallback,
      error:
        error instanceof BackendError && error.status === 403
          ? "forbidden"
          : error instanceof BackendError && error.status === 503
            ? "unavailable"
            : "unexpected",
    };
  }
}

export const getOrganizationLocations = cache(async function getOrganizationLocations(
  orgId: string,
  includeInactive = false,
): Promise<OrganizationLocation[]> {
  const query = includeInactive ? "?include_inactive=true" : "";
  const data = await backendJsonOrNull<{ ok: boolean; locations: OrganizationLocation[] }>(
    `/backoffice/organizations/${orgId}/locations${query}`,
  );
  return data?.locations ?? [];
});

/* ── Informes históricos ─────────────────────────────────────────── */

export type ReportType = "standard" | "premium";

export type HistoricalReport = {
  id: string;
  batchId: string | null;
  organizationId: string;
  organizationName: string | null;
  plate: string;
  reportType: ReportType;
  tokenCost: number;
  status: string;
  billingStatus: string;
  requestedByName: string | null;
  createdAt: string | null;
  generatedAt: string | null;
  invoiceId: string | null;
};

export type ReportSummary = {
  queued: number;
  processing: number;
  generated: number;
  standard: number;
  premium: number;
  tokens: number;
  unbilled: number;
  invoiced: number;
};

export type ReportsResult = {
  reports: HistoricalReport[];
  summary: ReportSummary;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error: string | null;
};

const EMPTY_REPORT_SUMMARY: ReportSummary = {
  queued: 0,
  processing: 0,
  generated: 0,
  standard: 0,
  premium: 0,
  tokens: 0,
  unbilled: 0,
  invoiced: 0,
};

/** Historial de la automotora activa. La organización siempre viene de la sesión del servidor. */
export async function getReports(
  organizationId: string,
  opts: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    status?: string;
    billingStatus?: string;
    reportType?: ReportType;
    /** Sólo los informes que pidió esta persona (tarjeta "mío" del agente en el Dashboard). */
    requestedById?: string;
  } = {},
): Promise<ReportsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
  const params = new URLSearchParams({ organizationId, page: String(page), limit: String(limit) });
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  if (opts.status) params.set("status", opts.status);
  if (opts.billingStatus) params.set("billingStatus", opts.billingStatus);
  if (opts.reportType) params.set("reportType", opts.reportType);
  if (opts.requestedById) params.set("requestedById", opts.requestedById);

  try {
    const data = await backendJson<{
      ok: boolean;
      reports?: HistoricalReport[];
      summary?: Partial<ReportSummary>;
      pagination?: { page?: number; limit?: number; total?: number; totalPages?: number; pages?: number };
    }>(`/backoffice/reports?${params.toString()}`);
    if (!data.ok) throw new BackendError(502, "invalid_reports_response");
    const reports = data.reports ?? [];
    const pagination = data.pagination ?? {};
    const total = Number(pagination.total ?? reports.length);
    return {
      reports,
      summary: { ...EMPTY_REPORT_SUMMARY, ...(data.summary ?? {}) },
      pagination: {
        page: Number(pagination.page ?? page),
        limit: Number(pagination.limit ?? limit),
        total,
        totalPages: Math.max(
          1,
          Number(pagination.totalPages ?? pagination.pages ?? Math.ceil(total / limit)),
        ),
      },
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof BackendError && error.status === 503
        ? "El servicio de informes no está disponible en este momento."
        : error instanceof BackendError && error.status === 403
          ? "No tienes permiso para consultar los informes de esta automotora."
          : "No pudimos cargar los informes. Intenta nuevamente.";
    return {
      reports: [],
      summary: { ...EMPTY_REPORT_SUMMARY },
      pagination: { page, limit, total: 0, totalPages: 1 },
      error: message,
    };
  }
}

/* ── Informes de precompra / agenda técnica ─────────────────────── */

export type PrepurchaseReport = {
  id: string;
  status: string;
  priceClp: number;
  plate: string | null;
  vehicle: string;
  buyerName: string | null;
  buyerEmail: string | null;
  sellerName: string | null;
  dealershipName: string | null;
  commune: string | null;
  address: string | null;
  scheduledAt: string | null;
  visitStatus: string | null;
  paymentStatus: string | null;
  locationName: string | null;
  source: string;
  billingMode: string;
  createdAt: string | null;
  updatedAt: string | null;
  resultAvailable: boolean;
  resultFilename: string | null;
};

export type PrepurchaseReportSummary = {
  total: number;
  confirmed: number;
  scheduled: number;
  pendingFulfillment: number;
  issued: number;
  cancelled: number;
  confirmedAmountClp: number;
};

export type PrepurchaseReportsResult = {
  reports: PrepurchaseReport[];
  summary: PrepurchaseReportSummary;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error: string | null;
};

const EMPTY_PREPURCHASE_SUMMARY: PrepurchaseReportSummary = {
  total: 0,
  confirmed: 0,
  scheduled: 0,
  pendingFulfillment: 0,
  issued: 0,
  cancelled: 0,
  confirmedAmountClp: 0,
};

export async function getPrepurchaseReports(
  organizationId: string,
  opts: {
    page?: number;
    limit?: number;
    status?: string;
    visitStatus?: string;
    from?: string;
    to?: string;
  } = {},
): Promise<PrepurchaseReportsResult> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
  const params = new URLSearchParams({ organizationId, page: String(page), limit: String(limit) });
  if (opts.status) params.set("status", opts.status);
  if (opts.visitStatus) params.set("visitStatus", opts.visitStatus);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);

  try {
    const data = await backendJson<{
      ok: boolean;
      items?: PrepurchaseReport[];
      summary?: Partial<PrepurchaseReportSummary>;
      pagination?: { page?: number; limit?: number; total?: number; totalPages?: number; pages?: number };
    }>(`/backoffice/prepurchase-reports?${params.toString()}`);
    if (!data.ok) throw new BackendError(502, "invalid_prepurchase_reports_response");
    const reports = data.items ?? [];
    const pagination = data.pagination ?? {};
    const total = Number(pagination.total ?? reports.length);
    return {
      reports,
      summary: { ...EMPTY_PREPURCHASE_SUMMARY, ...(data.summary ?? {}) },
      pagination: {
        page: Number(pagination.page ?? page),
        limit: Number(pagination.limit ?? limit),
        total,
        totalPages: Math.max(
          1,
          Number(pagination.totalPages ?? pagination.pages ?? Math.ceil(total / limit)),
        ),
      },
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof BackendError && error.status === 503
        ? "El servicio de precompra no está disponible en este momento."
        : error instanceof BackendError && error.status === 403
          ? "No tienes permiso para consultar la agenda de esta automotora."
          : "No pudimos cargar la agenda de precompra. Intenta nuevamente.";
    return {
      reports: [],
      summary: { ...EMPTY_PREPURCHASE_SUMMARY },
      pagination: { page, limit, total: 0, totalPages: 1 },
      error: message,
    };
  }
}

/* ── Ingresos de vehículos (consignación / compra / permuta) ─────── */

export type Acquisition = {
  id: string;
  organizationId: string;
  vehicleId: string | null;
  kind: string;
  status: string;
  contractNumber: string;
  ownerName: string | null;
  ownerRut: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  ownerAddress: string | null;
  plate: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  engineNumber: string | null;
  color: string | null;
  mileage: number | null;
  minPrice: number | null;
  commissionPct: number | null;
  purchasePrice: number | null;
  startsAt: string | null;
  endsAt: string | null;
  freeOfEncumbrances: boolean | null;
  notes: string | null;
  contractIssuedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  receivedAt: string | null;
  exitedAt: string | null;
  inventoryLocation: string | null;
  locationId: string | null;
  lienStatus: string | null;
  lienHolder: string | null;
  intakeChecklist: Record<string, unknown>;
  intakeCheckedAt: string | null;
  intakeCheckedBy: string | null;
  lienNotes: string | null;
  exitReason: string | null;
};

export const getAcquisitions = cache(async function getAcquisitions(): Promise<Acquisition[]> {
  const data = await backendJsonOrNull<{ ok: boolean; acquisitions: Acquisition[] }>(
    "/backoffice/acquisitions?limit=200",
  );
  return data?.acquisitions ?? [];
});

/* ── Transferencias de ingreso (particular -> automotora) ────────── */

export type DealershipTransfer = {
  id: string;
  organizationId: string;
  organizationName: string | null;
  acquisitionId: string;
  leadId: string | null;
  leadName: string | null;
  locationId: string;
  locationName: string | null;
  status: string;
  provider: string | null;
  providerOrderId: string | null;
  seller: { type: string; name?: string; rut?: string };
  buyer: { type: string; companyName?: string; companyRut?: string };
  vehicle: { plate?: string; brand?: string; model?: string; year?: number };
  plate: string | null;
  vehicleLabel: string;
  vehicleValueClp: number;
  fiscalAppraisalClp: number | null;
  serviceFeeClp: number;
  billingStatus: string;
  billableAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DealershipTransferSummary = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  unbilledQuantity: number;
  unbilledAmountClp: number;
  totalAmountClp: number;
};

export async function getDealershipTransfers(
  organizationId: string,
  options: {
    page?: number;
    limit?: number;
    status?: string;
    from?: string;
    to?: string;
    /** Sólo transferencias de leads asignados a este agente (tarjeta "mío" del Dashboard). */
    assignedAgentId?: string;
  } = {},
) {
  const params = new URLSearchParams({
    organizationId,
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 25),
  });
  if (options.status) params.set("status", options.status);
  if (options.from) params.set("from", options.from);
  if (options.to) params.set("to", options.to);
  if (options.assignedAgentId) params.set("assignedAgentId", options.assignedAgentId);
  const data = await backendJsonOrNull<{
    ok: boolean;
    transfers: DealershipTransfer[];
    summary: DealershipTransferSummary;
    pagination: { page: number; limit: number; total: number; pages: number };
  }>(`/backoffice/dealership-transfers?${params.toString()}`);
  return data ?? {
    ok: false,
    transfers: [],
    summary: { total: 0, pending: 0, inProgress: 0, completed: 0, unbilledQuantity: 0, unbilledAmountClp: 0, totalAmountClp: 0 },
    pagination: { page: options.page ?? 1, limit: options.limit ?? 25, total: 0, pages: 1 },
  };
}

export type CreditLeadRow = {
  id: string;
  commercialLeadId: string | null;
  vehicleId: string | null;
  vehicleLabel: string | null;
  vehiclePatent: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  rut: string | null;
  requestedAmount: number | null;
  downPaymentAmount: number | null;
  termMonths: number | null;
  monthlyPayment: number | null;
  status: string;
  institutionName: string | null;
  approvedAmount: number | null;
  createdAt: string | null;
};

export async function getCreditLeads(options: { page?: number; limit?: number; status?: string } = {}): Promise<{
  items: CreditLeadRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (options.status) params.set("status", options.status);
  const data = await backendJsonOrNull<{
    ok: boolean;
    items: Record<string, unknown>[];
    total: number;
  }>(`/backoffice/credit-leads?${params.toString()}`);
  const items = (data?.items ?? []).map((row) => ({
    id: String(row.id),
    commercialLeadId: row.commercial_lead_id ? String(row.commercial_lead_id) : null,
    vehicleId: row.vehicle_id ? String(row.vehicle_id) : null,
    vehicleLabel: typeof row.vehicle_label === "string" ? row.vehicle_label : null,
    vehiclePatent: typeof row.vehicle_patent === "string" ? row.vehicle_patent : null,
    buyerName: typeof row.buyer_name === "string" ? row.buyer_name : null,
    buyerPhone: typeof row.buyer_phone === "string" ? row.buyer_phone : null,
    rut: typeof row.rut === "string" ? row.rut : null,
    requestedAmount: row.requested_amount == null ? null : Number(row.requested_amount),
    downPaymentAmount: row.down_payment_amount == null ? null : Number(row.down_payment_amount),
    termMonths: row.term_months == null ? null : Number(row.term_months),
    monthlyPayment: row.monthly_payment == null ? null : Number(row.monthly_payment),
    // `requested` desaparecio en la migracion 0051; un default asi disfrazaba de
    // "en evaluacion" a una fila cuyo estado no llego.
    status: typeof row.status === "string" ? row.status : "",
    institutionName: typeof row.institution_name === "string" ? row.institution_name : null,
    approvedAmount: row.approved_amount == null ? null : Number(row.approved_amount),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  }));
  const total = Number(data?.total ?? items.length);
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Total de solicitudes de crédito visibles para la automotora, opcionalmente acotado a un periodo. */
export const getCreditLeadTotal = cache(async function getCreditLeadTotal(
  opts: { from?: string; to?: string } = {},
): Promise<number> {
  const params = new URLSearchParams({ page: "1", limit: "1" });
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const data = await backendJsonOrNull<{ ok: boolean; total: number }>(
    `/backoffice/credit-leads?${params.toString()}`,
  );
  return Number(data?.total ?? 0);
});

/* ── Stock ───────────────────────────────────────────────────────── */

export const getStockSummary = cache(async function getStockSummary(): Promise<StockSummary | null> {
  const data = await backendJsonOrNull<{ ok: boolean; stock: StockSummary }>(
    "/backoffice/analytics/stock",
  );
  return data?.stock ?? null;
});

export const getAging = cache(async function getAging(): Promise<AgingResponse> {
  const data = await backendJsonOrNull<{ ok: boolean } & AgingResponse>(
    "/backoffice/analytics/aging?limit=500",
  );
  return {
    items: data?.items ?? [],
    buckets: data?.buckets ?? { d0_15: 0, d16_30: 0, d31_60: 0, d60_plus: 0 },
    avgDays: data?.avgDays ?? 0,
    reserved: data?.reserved ?? 0,
  };
});

type BackendVehicleRow = {
  id: string;
  stock_number: number | null;
  year: number | null;
  patent: string | null;
  price: number | string | null;
  mileage: number | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  transmission: string | null;
  vin: string | null;
  color: string | null;
  sale_priority: boolean | null;
  entered_by_id: string | null;
  entered_by_name: string | null;
  status: string | null;
  is_verified: boolean | null;
  created_at: string | null;
  brand_label: string | null;
  model_label: string | null;
  acquisition_kind: string | null;
  owner_name: string | null;
  acquisition_id: string | null;
  acquisition_status: string | null;
  purchase_price: number | string | null;
  min_price: number | string | null;
  commission_pct: number | string | null;
  received_at: string | null;
  exited_at: string | null;
  inventory_location: string | null;
  location_id: string | null;
  lien_status: string | null;
  contract_issued_at: string | null;
  detailing_status: string | null;
  photos_status: string | null;
  parking_number: number | null;
  parking_capacity: number | null;
};

/**
 * Inventario de la automotora. `q` va al backend, que ya busca por código de stock, marca,
 * modelo y patente (`routers/vehicles.py`, búsqueda tokenizada).
 */
export type VehicleSort = "stockNumber" | "createdAt" | "receivedAt" | "stockDays" | "price" | "brand" | "model" | "ownerName" | "enteredBy" | "year" | "mileage" | "status";
export type SortDirection = "asc" | "desc";

export type VehicleFilterOptions = {
  brands: { id: string; name: string }[];
  models: { id: string; name: string; brandId: string }[];
  years: number[];
  owners: string[];
};

export const getVehicleFilterOptions = cache(async function getVehicleFilterOptions(): Promise<VehicleFilterOptions> {
  const [inventory, brandsData, modelsData] = await Promise.all([
    backendJsonOrNull<{ ok: boolean; brands: string[]; models: string[]; years: number[]; owners: string[] }>("/backoffice/vehicles/filter-options"),
    backendJsonOrNull<{ ok: boolean; brands: { id: string; name: string }[] }>("/system/brands"),
    backendJsonOrNull<{ ok: boolean; models: { id: string; name: string; brand_id: string }[] }>("/system/models"),
  ]);
  const inventoryBrands = new Set((inventory?.brands ?? []).map((name) => name.trim().toLocaleLowerCase("es")));
  const inventoryModels = new Set((inventory?.models ?? []).map((name) => name.trim().toLocaleLowerCase("es")));
  const brands = (brandsData?.brands ?? []).filter((brand) => inventoryBrands.has(brand.name.trim().toLocaleLowerCase("es")));
  const brandIds = new Set(brands.map((brand) => brand.id));
  return {
    brands,
    models: (modelsData?.models ?? [])
      .filter((model) => brandIds.has(model.brand_id) && inventoryModels.has(model.name.trim().toLocaleLowerCase("es")))
      .map((model) => ({ id: model.id, name: model.name, brandId: model.brand_id })),
    years: inventory?.years ?? [],
    owners: inventory?.owners ?? [],
  };
});

export async function getVehicles(opts: {
  q?: string;
  patent?: string;
  brand?: string;
  model?: string;
  brandId?: string;
  modelId?: string;
  year?: number;
  status?: string;
  acquisitionKind?: string;
  ownerName?: string;
  lienStatus?: string;
  locationId?: string;
  enteredById?: string;
  minMileage?: number;
  maxMileage?: number;
  minPrice?: number;
  maxPrice?: number;
  minStockDays?: number;
  maxStockDays?: number;
  sort?: VehicleSort;
  direction?: SortDirection;
  page?: number;
  limit?: number;
} = {}): Promise<{
  items: VehicleRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (opts.q) params.set("q", opts.q);
  if (opts.patent) params.set("patent", opts.patent);
  if (opts.brand) params.set("brand", opts.brand);
  if (opts.model) params.set("model", opts.model);
  if (opts.brandId) params.set("brandId", opts.brandId);
  if (opts.modelId) params.set("modelId", opts.modelId);
  if (opts.year !== undefined) params.set("year", String(opts.year));
  if (opts.status) params.set("status", opts.status);
  if (opts.acquisitionKind) params.set("acquisitionKind", opts.acquisitionKind);
  if (opts.ownerName) params.set("ownerName", opts.ownerName);
  if (opts.lienStatus) params.set("lienStatus", opts.lienStatus);
  if (opts.locationId) params.set("locationId", opts.locationId);
  if (opts.enteredById) params.set("enteredById", opts.enteredById);
  if (opts.minMileage !== undefined) params.set("minMileage", String(opts.minMileage));
  if (opts.maxMileage !== undefined) params.set("maxMileage", String(opts.maxMileage));
  if (opts.minPrice !== undefined) params.set("minPrice", String(opts.minPrice));
  if (opts.maxPrice !== undefined) params.set("maxPrice", String(opts.maxPrice));
  if (opts.minStockDays !== undefined) params.set("minStockDays", String(opts.minStockDays));
  if (opts.maxStockDays !== undefined) params.set("maxStockDays", String(opts.maxStockDays));
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.direction) params.set("direction", opts.direction);

  const data = await backendJsonOrNull<{ ok: boolean; items: BackendVehicleRow[]; total: number }>(
    `/backoffice/vehicles?${params.toString()}`,
  );
  const items = (data?.items ?? []).map((r) => ({
    id: String(r.id),
    stockNumber: r.stock_number == null ? null : Number(r.stock_number),
    brand: r.brand_label,
    model: r.model_label,
    year: r.year,
    price: r.price === null || r.price === undefined ? null : Number(r.price),
    status: r.status,
    patent: r.patent,
    mileage: r.mileage,
    vehicleType: r.vehicle_type,
    fuelType: r.fuel_type,
    transmission: r.transmission,
    vin: r.vin,
    color: r.color,
    salePriority: Boolean(r.sale_priority),
    enteredById: r.entered_by_id,
    enteredByName: r.entered_by_name,
    isVerified: Boolean(r.is_verified),
    createdAt: r.created_at,
    acquisitionKind: r.acquisition_kind,
    ownerName: r.owner_name,
    acquisitionId: r.acquisition_id,
    acquisitionStatus: r.acquisition_status,
    purchasePrice: r.purchase_price == null ? null : Number(r.purchase_price),
    minPrice: r.min_price == null ? null : Number(r.min_price),
    commissionPct: r.commission_pct == null ? null : Number(r.commission_pct),
    receivedAt: r.received_at,
    exitedAt: r.exited_at,
    inventoryLocation: r.inventory_location,
    locationId: r.location_id,
    lienStatus: r.lien_status,
    contractIssuedAt: r.contract_issued_at,
    detailingStatus: r.detailing_status ?? "pending",
    photosStatus: r.photos_status ?? "pending",
    parkingNumber: r.parking_number == null ? null : Number(r.parking_number),
    parkingCapacity: Number(r.parking_capacity ?? 0),
  }));
  const total = data?.total ?? items.length;
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

type BackendVehicleDetail = {
  id: string;
  stock_number: number | null;
  patent: string | null;
  brand: string | null;
  model: string | null;
  brand_label: string | null;
  model_label: string | null;
  year: number | null;
  price: number | string | null;
  mileage: number | null;
  status: string | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  transmission: string | null;
  vin: string | null;
  engine: string | null;
  color: string | null;
  doors: number | null;
  description: string | null;
  financing_available: boolean | null;
  sale_priority: boolean | null;
};

export async function getVehicleDetail(vehicleId: string): Promise<{
  vehicle: VehicleDetail;
  acquisition: Acquisition | null;
} | null> {
  const [data, acquisitions] = await Promise.all([
    backendJsonOrNull<{
      ok: boolean;
      vehicle: BackendVehicleDetail;
      photos: { id: string; url: string; position: number }[];
    }>(
      `/backoffice/vehicles/${encodeURIComponent(vehicleId)}`,
    ),
    getAcquisitions(),
  ]);
  const v = data?.vehicle;
  if (!v) return null;
  return {
    vehicle: {
      id: String(v.id),
      stockNumber: v.stock_number == null ? null : Number(v.stock_number),
      patent: v.patent,
      brand: v.brand_label ?? v.brand,
      model: v.model_label ?? v.model,
      year: v.year,
      price: v.price == null ? null : Number(v.price),
      mileage: v.mileage,
      status: v.status,
      vehicleType: v.vehicle_type,
      fuelType: v.fuel_type,
      transmission: v.transmission,
      vin: v.vin,
      engine: v.engine,
      color: v.color,
      doors: v.doors,
      description: v.description,
      financingAvailable: Boolean(v.financing_available),
      salePriority: Boolean(v.sale_priority),
      photos: (data?.photos ?? []).map((photo) => ({
        id: String(photo.id),
        url: String(photo.url),
        position: Number(photo.position ?? 0),
      })),
    },
    acquisition: acquisitions.find((a) => a.vehicleId === String(v.id)) ?? null,
  };
}

export async function getVehiclePreparation(vehicleId: string): Promise<VehiclePreparation | null> {
  const data = await backendJsonOrNull<{ ok: boolean; preparation: VehiclePreparation }>(
    `/backoffice/vehicles/${encodeURIComponent(vehicleId)}/preparation`,
  );
  return data?.preparation ?? null;
}

export async function getInventoryHistory(opts: {
  q?: string;
  outcome?: string;
  acquisitionKind?: string;
  salesAgentId?: string;
  enteredById?: string;
  locationId?: string;
  from?: string;
  to?: string;
  sort?: string;
  direction?: string;
  page?: number;
  limit?: number;
} = {}): Promise<InventoryHistoryResult> {
  const params = new URLSearchParams({
    page: String(Math.max(1, opts.page ?? 1)),
    limit: String(Math.min(100, Math.max(1, opts.limit ?? 25))),
  });
  for (const [key, value] of Object.entries(opts)) {
    if (value !== undefined && value !== "" && key !== "page" && key !== "limit") params.set(key, String(value));
  }
  type RawItem = {
    vehicle_id: string; stock_number: number | null; patent: string | null; brand: string | null;
    model: string | null; year: number | null; vehicle_status: string | null; acquisition_kind: string | null;
    received_at: string | null; exited_at: string | null; exit_reason: string | null; location_name: string | null;
    sold_at: string | null; purchase_id: string | null; sale_amount: number | string | null;
    purchase_price: number | string | null;
    min_price: number | string | null;
    commission_pct: number | string | null;
    entered_by_id: string | null; entered_by_name: string | null; sales_agent_id: string | null;
    sales_agent_name: string | null; outcome: "active" | "sold" | "exited"; stock_days: number;
    estimated_margin: number | string | null; event_at: string | null;
  };
  const data = await backendJsonOrNull<{
    ok: boolean; items: RawItem[]; total: number; page: number; limit: number;
    summary: InventoryHistoryResult["summary"];
    byAgent: InventoryHistoryResult["byAgent"];
    byKind: InventoryHistoryResult["byKind"];
  }>(`/backoffice/inventory/history?${params.toString()}`);
  const page = data?.page ?? 1;
  const limit = data?.limit ?? 25;
  const total = data?.total ?? 0;
  return {
    items: (data?.items ?? []).map((row) => ({
      vehicleId: String(row.vehicle_id), stockNumber: row.stock_number, patent: row.patent,
      brand: row.brand, model: row.model, year: row.year, vehicleStatus: row.vehicle_status,
      acquisitionKind: row.acquisition_kind, receivedAt: row.received_at, exitedAt: row.exited_at,
      exitReason: row.exit_reason, locationName: row.location_name, soldAt: row.sold_at,
      purchaseId: row.purchase_id, saleAmount: row.sale_amount == null ? null : Number(row.sale_amount),
      // El mínimo de consignación y el valor de parte de pago no son precios de compra.
      purchasePrice: row.acquisition_kind === "purchase" && row.purchase_price != null ? Number(row.purchase_price) : null,
      tradeInValue: row.acquisition_kind === "trade_in" && row.min_price != null ? Number(row.min_price) : null,
      minPrice: row.acquisition_kind === "consignment" && row.min_price != null ? Number(row.min_price) : null,
      commissionPct: row.acquisition_kind === "consignment" && row.commission_pct != null ? Number(row.commission_pct) : null,
      enteredById: row.entered_by_id, enteredByName: row.entered_by_name,
      salesAgentId: row.sales_agent_id, salesAgentName: row.sales_agent_name, outcome: row.outcome,
      stockDays: Number(row.stock_days ?? 0),
      estimatedMargin: row.estimated_margin == null ? null : Number(row.estimated_margin),
      eventAt: row.event_at,
    })),
    total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)),
    summary: data?.summary ?? { active: 0, sold: 0, exited: 0, salesAmount: 0, estimatedMargin: 0, avgStockDays: 0 },
    byAgent: data?.byAgent ?? [],
    byKind: data?.byKind ?? [],
  };
}

/* ── Serie temporal de ventas (gráficos del Dashboard) ───────────── */

export type SalesTimeseriesPoint = { period: string; sold: number; salesAmount: number };

/** `GET /backoffice/inventory/sales-timeseries`: una sola llamada alimenta el gráfico
 * mensual (12 meses) y el de barras diarias del Dashboard, siempre con el mismo rango. */
export type SalesTimeseries = {
  from: string;
  to: string;
  daily: SalesTimeseriesPoint[];
  monthly: SalesTimeseriesPoint[];
};

export async function getSalesTimeseries(opts: { from?: string; to?: string } = {}): Promise<SalesTimeseries> {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const qs = params.toString();
  type RawPoint = { day?: string; month?: string; sold: number; salesAmount: number };
  const data = await backendJsonOrNull<{
    ok: boolean; from: string; to: string; daily: RawPoint[]; monthly: RawPoint[];
  }>(`/backoffice/inventory/sales-timeseries${qs ? `?${qs}` : ""}`);
  return {
    from: data?.from ?? opts.from ?? "",
    to: data?.to ?? opts.to ?? "",
    daily: (data?.daily ?? []).map((r) => ({ period: r.day ?? "", sold: r.sold, salesAmount: r.salesAmount })),
    monthly: (data?.monthly ?? []).map((r) => ({ period: r.month ?? "", sold: r.sold, salesAmount: r.salesAmount })),
  };
}

/* ── Rendimiento comercial (KPIs) ────────────────────────────────── */

/**
 * KPIs de `GET /backoffice/analytics/performance`.
 *
 * El backend decide QUÉ entra en el cálculo según el rol: el administrador recibe los
 * números de toda la automotora más una fila por agente; el agente de ventas recibe los
 * mismos indicadores calculados sólo sobre su cartera y una única fila (la suya).
 * `portfolioRestricted` sirve para titular la pantalla, no para filtrar.
 */
export type AgentPerformance = {
  userId: string;
  name: string;
  email: string | null;
  openLeads: number;
  uncontacted: number;
  slaLate: number;
  newLeads: number;
  won: number;
  lost: number;
  conversion: number;
  avgFirstResponseMin: number | null;
  revenue: number;
  lastMoveAt: string | null;
};

export type Performance = {
  from: string;
  to: string;
  portfolioRestricted: boolean;
  totals: {
    openLeads: number;
    uncontacted: number;
    slaLate: number;
    overdueActions: number;
    newLeads: number;
    won: number;
    lost: number;
    conversion: number;
    avgFirstResponseMin: number | null;
    revenue: number;
    activities: number;
  };
  funnel: { stage: string; count: number }[];
  trend: { day: string; leads: number; won: number }[];
  agents: AgentPerformance[];
};

const EMPTY_PERFORMANCE: Performance = {
  from: "",
  to: "",
  portfolioRestricted: true,
  totals: {
    openLeads: 0,
    uncontacted: 0,
    slaLate: 0,
    overdueActions: 0,
    newLeads: 0,
    won: 0,
    lost: 0,
    conversion: 0,
    avgFirstResponseMin: null,
    revenue: 0,
    activities: 0,
  },
  funnel: [],
  trend: [],
  agents: [],
};

export const getPerformance = cache(async function getPerformance(
  opts: { from?: string; to?: string } = {},
): Promise<Performance> {
  const params = new URLSearchParams();
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const qs = params.toString();
  const data = await backendJsonOrNull<{ ok: boolean } & Performance>(
    `/backoffice/analytics/performance${qs ? `?${qs}` : ""}`,
  );
  if (!data) return { ...EMPTY_PERFORMANCE, from: opts.from ?? "", to: opts.to ?? "" };
  return {
    from: data.from ?? opts.from ?? "",
    to: data.to ?? opts.to ?? "",
    portfolioRestricted: Boolean(data.portfolioRestricted),
    totals: { ...EMPTY_PERFORMANCE.totals, ...(data.totals ?? {}) },
    funnel: data.funnel ?? [],
    trend: data.trend ?? [],
    agents: data.agents ?? [],
  };
});

/* ── Bitácora reciente (panel de actividad) ──────────────────────── */

export type ActivityItem = {
  id: string;
  leadId: string;
  activityType: string;
  notes: string | null;
  stage: string | null;
  contactName: string;
  vehicleLabel: string | null;
  actorName: string;
  createdAt: string | null;
};

export const getActivityFeed = cache(async function getActivityFeed(
  limit = 25,
): Promise<ActivityItem[]> {
  const data = await backendJsonOrNull<{ ok: boolean; items: ActivityItem[] }>(
    `/backoffice/analytics/activity?limit=${limit}`,
  );
  return data?.items ?? [];
});

/* ── Notificaciones ──────────────────────────────────────────────── */

/** Fila de `GET /notifications` (el backend devuelve la tabla tal cual, en snake_case). */
type BackendNotification = {
  id: string;
  type: string | null;
  title: string | null;
  message: string | null;
  read_at: string | null;
  created_at: string | null;
  metadata: Record<string, unknown> | null;
};

export type Notification = {
  id: string;
  type: string | null;
  title: string;
  message: string | null;
  readAt: string | null;
  createdAt: string | null;
  /** Ruta interna a la que lleva la notificación, si el metadata la trae. */
  href: string | null;
};

function notificationHref(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const leadId = meta.leadId ?? meta.lead_id;
  if (typeof leadId === "string") return `/solicitudes/${leadId}`;
  const vehicleId = meta.vehicleId ?? meta.vehicle_id;
  if (typeof vehicleId === "string") return `/vehiculos`;
  return null;
}

export function fromBackendNotification(raw: BackendNotification): Notification {
  return {
    id: String(raw.id),
    type: raw.type,
    title: raw.title?.trim() || "Novedad",
    message: raw.message,
    readAt: raw.read_at,
    createdAt: raw.created_at,
    href: notificationHref(raw.metadata),
  };
}

export const getNotifications = cache(async function getNotifications(): Promise<Notification[]> {
  const data = await backendJsonOrNull<{ ok: boolean; notifications: BackendNotification[] }>(
    "/notifications",
  );
  return (data?.notifications ?? []).map(fromBackendNotification);
});
