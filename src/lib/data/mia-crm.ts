/**
 * Lecturas del módulo mia_crm (backend `/api/v1/mia-crm`) para la pestaña "Inteligencia
 * MIA" de la ficha del lead. Tolerante a fallos: el módulo es nuevo, así que si un
 * endpoint todavía no tiene nada calculado para este lead (o el módulo no responde), la
 * ficha del lead se sigue viendo normal -- esta pestaña solo se degrada.
 */
import { backendJsonOrNull } from "@/lib/api/client";

export type DecisionSignal = {
  variable: string;
  score: number;
  confidence: "hecho" | "observacion" | "inferencia" | "hipotesis" | "regla_aprendida";
  evidence: string | null;
  source: string;
};

export type ClosingScore = {
  necesidad: number;
  producto_definido: number;
  confianza: number;
  precio_aceptado: number;
  financiamiento: number;
  urgencia: number;
  barrera_pendiente: number;
  score: number;
  closing_mode: boolean;
  recommendation: string;
};

export type OpportunityPriority = {
  p_cierre: number;
  margen_esperado: number;
  tiempo_estimado_dias: number;
  factor_ajuste_vendedor: number;
  ops: number;
  confidence: "validado" | "provisional";
};

export type ProcessPathEvent = {
  event: string;
  at: string | null;
  detail: string | null;
  /** Metadata de la actividad de origen: lo que permite traducir un `system` al hito real. */
  metadata?: Record<string, unknown> | null;
};

export type ProcessPath = {
  timeline: ProcessPathEvent[];
  flags: { possible_redundant_contact_step: boolean; reached_visit_before_offer: boolean; reached_financing: boolean };
  matches_high_conversion_pattern: boolean;
  current_stage: string;
};

export type LeadIntelligence = {
  signals: DecisionSignal[];
  nextBestQuestion: DecisionSignal | null;
  closingScore: ClosingScore | null;
  opportunityPriority: OpportunityPriority | null;
  processPath: ProcessPath | null;
};

export type SellerCoaching = {
  dimension: string;
  score: number;
  sampleSize: number;
  action: string;
  confidence: string;
  evidence: string;
};

/**
 * La Inteligencia MIA es UNA pestaña de la ficha, no la ficha.
 *
 * `backendJsonOrNull` tolera 401/403/404/503 pero re-lanza cualquier otra cosa, y esta función
 * corre en el server component de la ficha: un 500 en cualquiera de los cuatro paneles se
 * llevaba por delante la página entera — el agente se quedaba sin el teléfono del cliente,
 * sin la bitácora y sin poder cobrar, por un panel de análisis.
 *
 * Cada panel se resuelve por separado y el que falle queda en su valor vacío. La pestaña
 * muestra su propio estado sin datos; el resto de la ficha sigue trabajando.
 */
async function panel<T>(request: Promise<T | null>, what: string): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    console.error(`[mia-crm] no pudimos cargar ${what}`, error);
    return null;
  }
}

export async function getLeadIntelligence(leadId: string): Promise<LeadIntelligence> {
  const [signalsRes, closingRes, opsRes, pathRes] = await Promise.all([
    panel(
      backendJsonOrNull<{ ok: boolean; signals: DecisionSignal[]; nextBestQuestion: DecisionSignal | null }>(
        `/mia-crm/leads/${leadId}/decision-signals`,
      ),
      "las señales de decisión",
    ),
    panel(
      backendJsonOrNull<{ ok: boolean; closingScore: ClosingScore }>(`/mia-crm/leads/${leadId}/closing-score`),
      "el score de cierre",
    ),
    panel(
      backendJsonOrNull<{ ok: boolean; opportunityPriority: OpportunityPriority }>(
        `/mia-crm/leads/${leadId}/opportunity-priority`,
      ),
      "la prioridad de la oportunidad",
    ),
    panel(
      backendJsonOrNull<{ ok: boolean } & ProcessPath>(`/mia-crm/leads/${leadId}/process-path`),
      "el recorrido del proceso",
    ),
  ]);

  return {
    signals: signalsRes?.signals ?? [],
    nextBestQuestion: signalsRes?.nextBestQuestion ?? null,
    closingScore: closingRes?.closingScore ?? null,
    opportunityPriority: opsRes?.opportunityPriority ?? null,
    processPath: pathRes ? { timeline: pathRes.timeline, flags: pathRes.flags, matches_high_conversion_pattern: pathRes.matches_high_conversion_pattern, current_stage: pathRes.current_stage } : null,
  };
}

/**
 * El foco de coaching del propio agente (Modelo 05, Parte 09).
 *
 * Va en su tablero y no en la ficha del lead a propósito: es un promedio de su historial,
 * y puesto junto a la siguiente acción de un cliente se leería como un reproche sobre esa
 * conversación. `null` cuando todavía no hay muestra suficiente para concluir nada.
 */
export async function getSellerCoaching(sellerId: string): Promise<SellerCoaching | null> {
  const response = await panel(
    backendJsonOrNull<{ ok: boolean; coaching: SellerCoaching | null }>(`/mia-crm/sellers/${sellerId}/score`),
    "el foco de coaching del agente",
  );
  return response?.coaching ?? null;
}
