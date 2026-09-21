/**
 * Vocabulario de estado de una solicitud de financiamiento (`credit_leads.status`).
 *
 * Fuente única para las tres pantallas que lo muestran: la tabla de Créditos, la pestaña
 * Financiamiento de la ficha y la bitácora del lead. Antes cada una tenía su copia, y la de
 * la tabla se quedó en el vocabulario ANTERIOR a la migración 0051 (`requested` /
 * `proposals_ready`): mostraba "evaluating" y "preapproved" en inglés y en crudo, el filtro
 * "En evaluación" buscaba un valor que ya no existe —cero resultados, sin error— y el
 * contador de la cabecera marcaba 0 con cinco solicitudes en evaluación.
 *
 * Los `variant` reproducen exactamente los tonos que ya usaba la ficha, para que un mismo
 * estado se vea igual en los dos lugares.
 */
import type { PillVariant } from "@/components/ui/primitives";

export const CREDIT_STATUS: Record<string, { label: string; variant: PillVariant }> = {
  /** Solicitud de un vendedor particular esperando el pre-triaje interno. */
  pending_review: { label: "En revisión", variant: "warn" },
  evaluating: { label: "En evaluación", variant: "info" },
  preapproved: { label: "Preaprobado", variant: "info" },
  approved: { label: "Aprobado", variant: "success" },
  /** Terminal: la financiera desembolsó. */
  disbursed: { label: "Cursado", variant: "success" },
  rejected: { label: "Rechazado", variant: "danger" },
  rejected_pretriage: { label: "Rechazado en revisión", variant: "danger" },
  expired: { label: "Vencido", variant: "neutral" },
};

/** Nunca deja al usuario mirando el valor crudo del backend. */
export function creditStatus(status: string | null | undefined): { label: string; variant: PillVariant } {
  const key = String(status ?? "").trim().toLowerCase();
  return CREDIT_STATUS[key] ?? { label: key || "Sin estado", variant: "neutral" };
}

export function creditStatusLabel(status: string | null | undefined): string {
  return creditStatus(status).label;
}

/**
 * Los que todavía esperan respuesta de la financiera. La respuesta es externa y manual: la
 * automotora sólo transcribe el resultado cuando llega, así que "en evaluación" incluye lo
 * preaprobado y lo que aún está en pre-triaje.
 */
export const CREDIT_OPEN_STATUSES = ["pending_review", "evaluating", "preapproved"] as const;
