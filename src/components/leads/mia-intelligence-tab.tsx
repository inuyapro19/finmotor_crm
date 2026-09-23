import { Panel, Pill, type PillVariant } from "@/components/ui/primitives";
import { fmtCLP, fmtDateTime } from "@/lib/format";
import { describeMilestone } from "@/lib/activity-vocabulary";
import type { ClosingScore, DecisionSignal, LeadIntelligence, OpportunityPriority } from "@/lib/data/mia-crm";
import { MarginCheckCalculator } from "./margin-check-calculator";
import { MiaRecommendations } from "./mia-recommendations";

/**
 * Pestaña "Inteligencia MIA" — lo que el motor mia_crm sabe de este lead, dicho para quien
 * vende autos y no para quien programó el motor.
 *
 * Regla de esta pantalla: **nada de vocabulario interno a la vista**. Los nombres de los
 * modelos del documento de diseño ("Modelo 03", "Closing Readiness Score") y los códigos de
 * regla ("R-CIE-02") viajan en el `title` del panel — siguen siendo rastreables al pasar el
 * mouse, sin ocupar la línea donde debería ir lo que el vendedor tiene que hacer.
 *
 * Módulo nuevo y aislado: si no hay nada calculado todavía para este lead (recién creado, o
 * el módulo caído), cada bloque se degrada solo en vez de romper la ficha completa.
 */
const CONFIDENCE_LABEL: Record<string, string> = {
  hecho: "Nos lo dijo",
  observacion: "Lo vimos",
  inferencia: "Lo deducimos",
  hipotesis: "Es una corazonada",
  regla_aprendida: "Aprendido de ventas anteriores",
};

const CONFIDENCE_VARIANT: Record<string, PillVariant> = {
  hecho: "success",
  regla_aprendida: "success",
  observacion: "info",
  inferencia: "warn",
  hipotesis: "neutral",
};

const VARIABLE_LABEL: Record<string, string> = {
  trigger: "Qué inició la búsqueda",
  proof: "Qué necesita ver para confiar",
  cuota: "Cuota / pie",
  precio: "Precio",
  confianza: "Confianza",
  barrier: "Barrera",
  motivation: "Motivación",
  priority: "Prioridad",
  trade_off: "Qué sacrificaría",
  trigger_to_close: "Qué lo haría comprar ahora",
  decision_maker: "Quién decide",
};

/** La pregunta concreta que el vendedor le tiene que hacer al cliente, por variable. */
const VARIABLE_QUESTION: Record<string, string> = {
  trigger: "Pregúntale por qué está buscando auto justo ahora.",
  proof: "Pregúntale qué necesita ver para decidirse.",
  cuota: "Pregúntale con qué pie y qué cuota se siente cómodo.",
  precio: "Pregúntale si el precio conversado le cierra.",
  confianza: "Pregúntale qué le genera dudas de la compra.",
  barrier: "Pregúntale qué lo está frenando.",
  motivation: "Pregúntale para qué va a usar el auto.",
  priority: "Pregúntale qué es lo que más le importa al elegir.",
  trade_off: "Pregúntale qué estaría dispuesto a resignar.",
  trigger_to_close: "Pregúntale qué necesitaría para cerrar hoy.",
  decision_maker: "Pregúntale si decide solo o lo conversa con alguien.",
};

/** Cada componente del score, con su etiqueta y si un número ALTO es bueno o malo. */
const CLOSING_COMPONENTS: { key: keyof ClosingScore; label: string; higherIsBetter: boolean }[] = [
  { key: "necesidad", label: "Necesidad", higherIsBetter: true },
  { key: "producto_definido", label: "Tiene claro qué auto quiere", higherIsBetter: true },
  { key: "confianza", label: "Confianza", higherIsBetter: true },
  { key: "precio_aceptado", label: "Acepta el precio", higherIsBetter: true },
  { key: "financiamiento", label: "Financiamiento resuelto", higherIsBetter: true },
  { key: "urgencia", label: "Urgencia", higherIsBetter: true },
  // Ojo: acá un número ALTO es MALO (entra invertido en el cálculo: 0,15 × (100 − valor)).
  // Sin esta distinción los siete chips se ven iguales y "Barrera 60" parece tan sano como
  // "Necesidad 60", cuando significa lo contrario.
  { key: "barrera_pendiente", label: "Barrera sin resolver", higherIsBetter: false },
];

/** Qué tan bien va un componente, ya normalizado a "mientras más alto, mejor". */
function componentHealth(value: number, higherIsBetter: boolean): number {
  return higherIsBetter ? value : 100 - value;
}

function ClosingScorePanel({ closing }: { closing: ClosingScore | null }) {
  if (!closing) {
    return (
      <Panel title="Qué tan cerca está de comprar" subtitle="Todavía sin datos">
        <p className="p-4 text-sm text-[var(--muted-foreground)]">
          Aún no hay actividad suficiente registrada con este cliente. Deja constancia de tus
          llamadas y visitas en Gestión y esto se completa solo.
        </p>
      </Panel>
    );
  }

  const components = CLOSING_COMPONENTS.map((c) => ({
    ...c,
    value: Number(closing[c.key] ?? 0),
    health: componentHealth(Number(closing[c.key] ?? 0), c.higherIsBetter),
  }));
  // El componente más débil es lo único accionable del panel: es donde el vendedor puede
  // mover la aguja hoy. Antes se perdía entre los otros seis, todos con el mismo peso visual.
  const weakest = components.reduce((worst, c) => (c.health < worst.health ? c : worst), components[0]);
  const score = Number(closing.score);

  return (
    <Panel
      title="Qué tan cerca está de comprar"
      subtitle={closing.closing_mode ? "Listo para cerrar" : "Todavía hay que despejar dudas"}
      titleAttr="Modelo 03 · Closing Readiness Score"
    >
      <div className="p-4">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{score.toFixed(0)}</span>
          <span className="text-sm text-[var(--muted-foreground)]">de 100</span>
        </div>
        <p className="mb-3 text-sm">
          {closing.closing_mode ? (
            <>Ya puedes ir al cierre.</>
          ) : (
            <>
              Lo que más lo está frenando es <strong>{weakest.label.toLowerCase()}</strong>. Resuelve eso
              antes de apurar el cierre.
            </>
          )}
        </p>
        <dl className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
          {components.map((c) => {
            const isWeakest = c.key === weakest.key;
            return (
              <div
                key={c.key}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${
                  isWeakest
                    ? "bg-amber-50 ring-1 ring-amber-300"
                    : c.health >= 70
                      ? "bg-[var(--muted)]"
                      : "bg-[var(--muted)]"
                }`}
              >
                <dt className={isWeakest ? "font-medium text-amber-900" : "text-[var(--muted-foreground)]"}>
                  {c.label}
                  {!c.higherIsBetter && (
                    <span className="ml-1 text-[10px] text-[var(--muted-foreground)]">(mientras menos, mejor)</span>
                  )}
                </dt>
                <dd className="flex shrink-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className={`inline-block h-1.5 w-8 rounded-full ${
                      c.health >= 70 ? "bg-emerald-500" : c.health >= 40 ? "bg-amber-400" : "bg-red-400"
                    }`}
                  />
                  <span className="font-semibold tabular-nums">{c.value}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </Panel>
  );
}

function DecisionSignalsPanel({
  signals,
  nextBestQuestion,
}: {
  signals: DecisionSignal[];
  nextBestQuestion: DecisionSignal | null;
}) {
  return (
    <Panel
      title="Lo que sabemos de este cliente"
      subtitle="Solo con evidencia real: nada inventado"
      titleAttr="Modelo 01 · Customer Decision Model"
    >
      {nextBestQuestion && (
        <div className="mx-4 mt-4 rounded-lg border border-[var(--primary)]/30 bg-[var(--accent)] p-3 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">
            Lo próximo que conviene preguntarle
          </p>
          <p className="mt-1 font-medium">
            {VARIABLE_QUESTION[nextBestQuestion.variable] ??
              `Confirma con él: ${VARIABLE_LABEL[nextBestQuestion.variable] ?? nextBestQuestion.variable}.`}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Es lo que más pesa para cerrar y todavía no te lo ha dicho él.
          </p>
        </div>
      )}
      {signals.length === 0 ? (
        <p className="p-4 text-sm text-[var(--muted-foreground)]">
          Todavía no sabemos nada de este cliente. Aparecerá acá a medida que registres tus
          conversaciones.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {signals.map((signal) => (
            <li key={signal.variable} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{VARIABLE_LABEL[signal.variable] ?? signal.variable}</p>
                {signal.evidence && (
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{signal.evidence}</p>
                )}
              </div>
              <Pill variant={CONFIDENCE_VARIANT[signal.confidence] ?? "neutral"}>
                {CONFIDENCE_LABEL[signal.confidence] ?? signal.confidence}
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function OpportunityPriorityPanel({ priority }: { priority: OpportunityPriority | null }) {
  if (!priority) {
    return (
      <Panel title="Cuánto te conviene priorizarlo" subtitle="Todavía sin datos">
        <p className="p-4 text-sm text-[var(--muted-foreground)]">
          Falta cotizar la unidad para poder estimar cuánto deja esta venta.
        </p>
      </Panel>
    );
  }
  const provisional = priority.confidence !== "validado";
  return (
    <Panel
      title="Cuánto te conviene priorizarlo"
      subtitle="Cuánto margen deja por cada día que sigue abierto"
      titleAttr="Opportunity Priority Score (OPS) · cruce de los modelos 01, 03 y 06"
    >
      <div className="p-4">
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{fmtCLP(priority.ops)}</span>
          <span className="text-sm text-[var(--muted-foreground)]">al día</span>
        </div>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          Compáralo con tus otros leads: el de arriba es al que más te rinde dedicarle la
          próxima hora.
        </p>
        {/* `p_cierre` es el mismo número del panel de al lado dividido por 100 (services.py),
            así que no se repite acá: verlo dos veces con nombres distintos hacía creer que
            eran dos mediciones que coincidían. */}
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-[var(--muted)] px-2 py-1.5">
            <dt className="text-[var(--muted-foreground)]">Si se cierra, dejaría</dt>
            <dd className="font-semibold tabular-nums">{fmtCLP(priority.margen_esperado)}</dd>
          </div>
          <div className="rounded-md bg-[var(--muted)] px-2 py-1.5">
            <dt className="text-[var(--muted-foreground)]">Ajuste por tu historial</dt>
            <dd className="font-semibold tabular-nums">
              ×{priority.factor_ajuste_vendedor}
              <span className="ml-1 font-normal text-[var(--muted-foreground)]">
                {Number(priority.factor_ajuste_vendedor) >= 1 ? "(cierras más que el promedio)" : "(bajo el promedio)"}
              </span>
            </dd>
          </div>
        </dl>
        {provisional && (
          <p className="mt-2 text-xs text-amber-700">
            El margen es estimado: falta cargar lo que costó la unidad para afinarlo.
          </p>
        )}
      </div>
    </Panel>
  );
}

function ProcessPathPanel({ processPath }: { processPath: LeadIntelligence["processPath"] }) {
  if (!processPath || processPath.timeline.length === 0) {
    return (
      <Panel title="Cómo viene avanzando" subtitle="Todavía sin actividad">
        <p className="p-4 text-sm text-[var(--muted-foreground)]">
          Aún no hay nada registrado con este cliente.
        </p>
      </Panel>
    );
  }
  return (
    <Panel
      title="Cómo viene avanzando"
      subtitle="El camino real, sin tocar la etapa del CRM"
      titleAttr="Modelo 02 · Ciclo de venta (minería de procesos, solo lectura)"
    >
      <div className="p-4">
        {processPath.matches_high_conversion_pattern && (
          <Pill variant="success" className="mb-3">
            Va por el camino que más ventas cierra
          </Pill>
        )}
        <ol className="space-y-2 border-l border-[var(--border)] pl-4">
          {processPath.timeline.map((event, index) => {
            // Mismo vocabulario que la pestaña Historial: sin esto salían los códigos de la
            // base ("system", "stage_change") y dos hitos distintos se veían idénticos.
            const milestone = describeMilestone(event);
            return (
              <li key={`${event.event}-${index}`} className="relative text-sm">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-[var(--primary)]" />
                <p className="font-medium">{milestone.label}</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {event.at ? fmtDateTime(event.at) : "sin fecha"}
                  {milestone.detail ? ` · ${milestone.detail}` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </Panel>
  );
}

export function MiaIntelligenceTab({
  leadId,
  vehiclePrice,
  intelligence,
  canWrite,
}: {
  leadId: string;
  vehiclePrice: number | null;
  intelligence: LeadIntelligence;
  canWrite: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <MiaRecommendations leadId={leadId} />
      <ClosingScorePanel closing={intelligence.closingScore} />
      <OpportunityPriorityPanel priority={intelligence.opportunityPriority} />
      <DecisionSignalsPanel signals={intelligence.signals} nextBestQuestion={intelligence.nextBestQuestion} />
      <ProcessPathPanel processPath={intelligence.processPath} />
      <Panel
        title="Hasta dónde puedes bajar el precio"
        subtitle="Cuánto margen resignas con cada descuento"
        titleAttr="Modelo 06 · Margin Awareness"
        className="lg:col-span-2"
      >
        <div className="p-4">
          <MarginCheckCalculator leadId={leadId} vehiclePrice={vehiclePrice} canWrite={canWrite} />
        </div>
      </Panel>
    </div>
  );
}
