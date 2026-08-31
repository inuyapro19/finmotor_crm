/**
 * Dominio de leads del CRM.
 *
 * Fuente actual: `GET /backoffice/team` → `leads` (tabla `commercial_leads`), que es lo único
 * que el backend expone hoy. Ese endpoint entrega el comprador como perfil (`buyerName`,
 * `buyerEmail`) porque el modelo vigente asume un comprador con cuenta.
 *
 * El CRM apunta al modelo contrario —el cliente **no entra al sistema**, deja sus datos y el
 * agente lo llama— así que aquí se normaliza a un `Lead` con datos de contacto sueltos
 * (`contactName` / `contactPhone` / `contactEmail`). Cuando el backend sume las columnas
 * `contact_*` a `commercial_leads`, sólo cambia `normalizeLead`: el resto de la UI ya las usa.
 */
import { minutesSince } from "@/lib/format";

export type LeadStage =
  | "new"
  | "contacted"
  | "visit"
  | "quoted"
  | "financing"
  | "documents"
  | "won"
  | "lost";

export type Lead = {
  id: string;
  stage: LeadStage;
  /** Etapa cruda del backend, por si no mapea a ninguna conocida. */
  rawStage: string;
  priority: number;
  source: string | null;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactRut: string | null;
  vehicleId: string | null;
  vehicleLabel: string;
  vehicleYear: number | null;
  vehiclePatent: string | null;
  /** Precio de lista de la unidad. Sirve para ver cuánto se está descontando al cotizar. */
  vehiclePrice: number | null;
  vehicleStatus: string | null;
  vehicleLocationId: string | null;
  vehicleLocationName: string | null;
  /** Términos negociados. `null` = todavía no se cotiza (distinto de cotizar en cero). */
  quotedPrice: number | null;
  quotedDownPayment: number | null;
  /** Valor asignado al auto que el cliente entrega en parte de pago. */
  tradeInAmount: number | null;
  organizationId: string | null;
  organizationName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  /** Momento del primer contacto efectivo. Es el SLA real, no una estimación. */
  firstContactedAt: string | null;
  /** Cuándo entró en la etapa actual. Distinto de `updatedAt`, que cambia con cualquier edición. */
  stageChangedAt: string | null;
  nextActionAt: string | null;
  lostReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /**
   * Venta cerrada detrás del lead (pestaña "Cierre"). `null` = todavía no se cerró — recién se
   * crea al registrar el primer pago o al intentar la transferencia. `purchaseStatus` sigue el
   * vocabulario de `purchases.status` (`CUSTOMER_CONFIRMED_PURCHASE`, `PAYMENT_CONFIRMED`, …).
   */
  purchaseId: string | null;
  purchaseStatus: string | null;
  paymentMode: "cash" | "financing" | null;
  financeStatus: "approved" | "rejected" | null;
  transferStatus: string | null;
};

/** Entrada de la bitácora del lead (`lead_activities`). */
export type LeadActivity = {
  id: string;
  activityType: string;
  notes: string | null;
  metadata: Record<string, unknown>;
  actorName: string | null;
  createdAt: string | null;
};

/**
 * Próxima acción trazable (`lead_tasks`). Reemplaza el antiguo `nextActionAt` suelto: ahora
 * puede haber varias, con responsable y prioridad, y `Lead.nextActionAt` es sólo el resumen
 * calculado de la más próxima entre las abiertas.
 */
export type LeadTask = {
  id: string;
  leadId: string;
  title: string;
  dueAt: string | null;
  status: "open" | "done" | "cancelled";
  priority: number;
  assignedTo: string | null;
  assignedToName: string | null;
  completedAt: string | null;
  createdAt: string | null;
};

/** Tarea de `GET /leads/tasks/mine` ("Mi día"): trae quién es el cliente, para no reabrir el lead sólo para saberlo. */
export type MyTask = LeadTask & {
  leadContactName: string | null;
  leadStage: string | null;
};

/** Respuesta de `GET /backoffice/leads` y `/leads/{id}` (ya en camelCase). */
export type BackendCrmLead = {
  id: string;
  stage: string | null;
  priority: number | null;
  source: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactRut: string | null;
  vehicleId: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehiclePatent: string | null;
  vehiclePrice: number | null;
  vehicleStatus: string | null;
  vehicleLocationId?: string | null;
  vehicleLocationName?: string | null;
  quotedPrice: number | null;
  quotedDownPayment: number | null;
  tradeInAmount: number | null;
  sellerOrganizationId: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  firstContactedAt: string | null;
  stageChangedAt: string | null;
  nextActionAt: string | null;
  lostReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  purchaseId?: string | null;
  purchaseStatus?: string | null;
  paymentMode?: string | null;
  financeStatus?: string | null;
  transferStatus?: string | null;
};

export function fromCrmLead(raw: BackendCrmLead): Lead {
  const brand = raw.vehicleBrand?.trim() || "";
  const model = raw.vehicleModel?.trim() || "";
  return {
    id: raw.id,
    stage: toStage(raw.stage),
    rawStage: raw.stage || "new",
    priority: Number(raw.priority ?? 0),
    source: raw.source,
    contactName: raw.contactName?.trim() || "Sin nombre",
    contactPhone: raw.contactPhone?.trim() || null,
    contactEmail: raw.contactEmail?.trim() || null,
    contactRut: raw.contactRut?.trim() || null,
    vehicleId: raw.vehicleId,
    vehicleLabel: [brand, model].filter(Boolean).join(" ") || "Sin vehículo",
    vehicleYear: raw.vehicleYear,
    vehiclePatent: raw.vehiclePatent,
    vehiclePrice: raw.vehiclePrice ?? null,
    vehicleStatus: raw.vehicleStatus ?? null,
    vehicleLocationId: raw.vehicleLocationId ?? null,
    vehicleLocationName: raw.vehicleLocationName ?? null,
    quotedPrice: raw.quotedPrice ?? null,
    quotedDownPayment: raw.quotedDownPayment ?? null,
    tradeInAmount: raw.tradeInAmount ?? null,
    organizationId: raw.sellerOrganizationId,
    organizationName: null,
    assignedTo: raw.assignedTo,
    assignedToName: raw.assignedToName?.trim() || null,
    firstContactedAt: raw.firstContactedAt,
    stageChangedAt: raw.stageChangedAt ?? null,
    nextActionAt: raw.nextActionAt,
    lostReason: raw.lostReason,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    purchaseId: raw.purchaseId ?? null,
    purchaseStatus: raw.purchaseStatus ?? null,
    paymentMode: (raw.paymentMode as Lead["paymentMode"]) ?? null,
    financeStatus: (raw.financeStatus as Lead["financeStatus"]) ?? null,
    transferStatus: raw.transferStatus ?? null,
  };
}

/** Respuesta cruda de `GET /backoffice/team`. */
export type BackendLead = {
  id: string;
  vehicleId: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  buyerId: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  sellerOrganizationId: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  source: string | null;
  stage: string | null;
  priority: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BackendTeamMember = {
  id: string;
  organizationId: string | null;
  organizationName: string | null;
  userId: string | null;
  role: string | null;
  status: string | null;
  isActive: boolean;
  name: string | null;
  email: string | null;
  createdAt: string | null;
};

export type BackendTeamResponse = {
  ok: boolean;
  members: BackendTeamMember[];
  teams: { id: string; name: string | null; organizationId: string | null; managerId: string | null; isActive: boolean; memberCount: number; createdAt: string | null }[];
  leads: BackendLead[];
};

/**
 * Etapas del pipeline, en el vocabulario del rubro y en español.
 * `match` lista los valores crudos que el backend puede traer para esa etapa — el esquema
 * actual usa `new` por defecto y el legacy de Supabase traía LEAD_ACTIVE/OFFER_RECEIVED/etc.
 */
export const STAGES: { key: LeadStage; label: string; short: string; match: string[] }[] = [
  { key: "new", label: "Sin contactar", short: "Nuevo", match: ["new", "lead_active", "open"] },
  { key: "contacted", label: "Contactado", short: "Contactado", match: ["contacted", "in_contact", "working"] },
  { key: "visit", label: "Visita agendada", short: "Visita", match: ["visit", "visit_scheduled", "scheduled", "test_drive"] },
  { key: "quoted", label: "Cotizado", short: "Cotizado", match: ["quoted", "offer_received", "negotiation", "offer_accepted"] },
  { key: "financing", label: "En financiamiento", short: "Crédito", match: ["financing", "credit", "credit_review"] },
  { key: "documents", label: "Documentos y cierre", short: "Cierre", match: ["documents", "payment_in_progress", "closing"] },
  { key: "won", label: "Vendido", short: "Vendido", match: ["won", "completed", "sold"] },
  { key: "lost", label: "Perdido", short: "Perdido", match: ["lost", "cancelled", "rejected"] },
];

const STAGE_BY_RAW = new Map<string, LeadStage>(
  STAGES.flatMap((s) => s.match.map((raw) => [raw, s.key] as [string, LeadStage])),
);

export function toStage(raw: string | null | undefined): LeadStage {
  return STAGE_BY_RAW.get((raw || "").toLowerCase()) ?? "new";
}

export function stageLabel(stage: LeadStage): string {
  return STAGES.find((s) => s.key === stage)?.label ?? stage;
}

/** Etapas que siguen abiertas (el agente todavía tiene algo que hacer). */
export const OPEN_STAGES: LeadStage[] = ["new", "contacted", "visit", "quoted", "financing", "documents"];

export function isOpen(lead: Lead): boolean {
  return OPEN_STAGES.includes(lead.stage);
}

/** Normaliza el lead que entrega `GET /backoffice/team` (formato heredado). */
export function normalizeLead(raw: BackendLead): Lead {
  const brand = raw.vehicleBrand?.trim() || "";
  const model = raw.vehicleModel?.trim() || "";
  const vehicleLabel = [brand, model].filter(Boolean).join(" ") || "Sin vehículo";
  return {
    id: raw.id,
    stage: toStage(raw.stage),
    rawStage: raw.stage || "new",
    priority: Number(raw.priority ?? 0),
    source: raw.source,
    // Preferimos los campos de contacto sueltos (el cliente de automotora no tiene cuenta) y
    // caemos al perfil del comprador cuando el lead sí vino de un usuario registrado.
    contactName: raw.contactName?.trim() || raw.buyerName?.trim() || "Sin nombre",
    contactPhone: raw.contactPhone?.trim() || raw.buyerPhone?.trim() || null,
    contactEmail: raw.contactEmail?.trim() || raw.buyerEmail?.trim() || null,
    contactRut: null,
    vehicleId: raw.vehicleId,
    vehicleLabel,
    vehicleYear: raw.vehicleYear,
    vehiclePatent: null,
    vehiclePrice: null,
    vehicleStatus: null,
    vehicleLocationId: null,
    vehicleLocationName: null,
    quotedPrice: null,
    quotedDownPayment: null,
    tradeInAmount: null,
    organizationId: raw.sellerOrganizationId,
    organizationName: null,
    assignedTo: raw.assignedTo,
    assignedToName: raw.assignedToName?.trim() || null,
    firstContactedAt: null,
    stageChangedAt: null,
    nextActionAt: null,
    lostReason: null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    purchaseId: null,
    purchaseStatus: null,
    paymentMode: null,
    financeStatus: null,
    transferStatus: null,
  };
}

/**
 * Semáforo de SLA de primer contacto. Es el KPI que más mueve la conversión en venta de
 * usados: un lead sin contactar se enfría en minutos, no en días.
 */
export type SlaLevel = "ok" | "warn" | "late";

export function slaLevel(lead: Lead): SlaLevel | null {
  // Ya hubo contacto efectivo: el SLA de primera respuesta dejó de correr.
  if (lead.firstContactedAt) return null;
  if (lead.stage !== "new") return null;
  const mins = minutesSince(lead.createdAt);
  if (mins === null) return null;
  if (mins <= 15) return "ok";
  if (mins <= 60) return "warn";
  return "late";
}

export const SLA_LABEL: Record<SlaLevel, string> = {
  ok: "A tiempo",
  warn: "Por vencer",
  late: "Atrasado",
};

/** Ordena por urgencia: primero lo no contactado y más antiguo, después por prioridad. */
export function byUrgency(a: Lead, b: Lead): number {
  const aNew = a.stage === "new" ? 0 : 1;
  const bNew = b.stage === "new" ? 0 : 1;
  if (aNew !== bNew) return aNew - bNew;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return at - bt;
}

export const SOURCE_LABEL: Record<string, string> = {
  finmotor: "Finmotor",
  platform: "Ficha del vehículo",
  web: "Sitio web",
  mia: "MIA",
  whatsapp: "WhatsApp",
  phone: "Llamada entrante",
  walk_in: "Visita al local",
  referral: "Referido",
  portal: "Portal externo",
  chileautos: "Chileautos",
  mercadolibre: "Mercado Libre",
  meta: "Meta Ads",
  facebook: "Facebook",
  instagram: "Instagram",
  manual: "Carga manual",
};

export function sourceLabel(source: string | null): string {
  if (!source) return "Sin origen";
  return SOURCE_LABEL[source.toLowerCase()] ?? source;
}

/**
 * Valor de la solicitud para el embudo: lo cotizado si el agente ya negoció, y si no el
 * precio de lista de la unidad. Sin esto, un pipeline no se puede leer en pesos.
 */
export function leadValue(lead: Lead): number | null {
  return lead.quotedPrice ?? lead.vehiclePrice ?? null;
}

/** Monto que quedaría por financiar con lo cotizado hasta ahora. */
export function leadFinancingGap(lead: Lead): number {
  const price = leadValue(lead) ?? 0;
  return Math.max(price - (lead.quotedDownPayment ?? 0) - (lead.tradeInAmount ?? 0), 0);
}

/**
 * True si el instante ya pasó. Vive aquí, y no dentro de los componentes, porque depende del
 * reloj: leerlo durante el render de un componente es impuro (y ESLint lo bloquea). Aislado
 * como regla de dominio, el peor caso es que el "vencido" aparezca en el siguiente render,
 * que es exactamente lo que se quiere.
 */
export function isOverdue(at: string | null | undefined): boolean {
  if (!at) return false;
  const time = new Date(at).getTime();
  return Number.isFinite(time) && time < Date.now();
}

/** True si el compromiso agendado con el cliente ya venció y la venta sigue abierta. */
export function isActionOverdue(lead: Lead): boolean {
  if (lead.stage === "won" || lead.stage === "lost") return false;
  return isOverdue(lead.nextActionAt);
}
