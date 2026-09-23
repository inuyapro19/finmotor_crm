import { Target } from "lucide-react";

import { Panel } from "@/components/ui/primitives";
import { getSellerCoaching } from "@/lib/data/mia-crm";

/**
 * El foco de coaching del agente (Modelo 05, Parte 09): la conducta medida más baja de su
 * historial, dicha como la acción que puede hacer distinto en la próxima conversación.
 *
 * Vive en su tablero y no en la ficha del lead: es un promedio de muchas oportunidades y,
 * puesto al lado de la siguiente acción de un cliente, se leería como un juicio sobre esa
 * conversación. Sin muestra suficiente el backend devuelve `null` y el panel no se dibuja
 * --un consejo sin evidencia es una opinión sobre una persona--.
 */
const DIMENSION_LABEL: Record<string, string> = {
  qualification_score: "Calificación",
  followup_score: "Seguimiento",
  margin_discipline_score: "Disciplina de margen",
  product_matching_score: "Calce de producto",
  closing_score: "Cierre",
  negotiation_score: "Negociación",
};

export async function SellerCoachingPanel({ sellerId }: { sellerId: string }) {
  const coaching = await getSellerCoaching(sellerId);
  if (!coaching) return null;

  const label = DIMENSION_LABEL[coaching.dimension] ?? "Tu gestión";

  return (
    <section aria-label="En qué enfocarte" className="mb-4">
      <Panel title="En qué enfocarte" subtitle="Lo que dicen tus últimas oportunidades">
        <div className="flex items-start gap-3 p-4">
          <Target className="mt-0.5 size-5 shrink-0 text-[var(--muted-foreground)]" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">{coaching.action}</p>
            <p className="text-sm text-[var(--muted-foreground)]">
              {label}: {Math.round(coaching.score)}/100 sobre {coaching.sampleSize}{" "}
              {coaching.sampleSize === 1 ? "oportunidad" : "oportunidades"}.
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Es una tendencia de tu historial, no una evaluación de la conversación que tienes abierta.
            </p>
          </div>
        </div>
      </Panel>
    </section>
  );
}
