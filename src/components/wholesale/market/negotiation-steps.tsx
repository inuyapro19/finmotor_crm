/**
 * Cómo funciona la negociación mayorista, con el paso en que va la automotora resaltado.
 * Refleja las reglas del backend (`wholesale/domain/rules.py`): oferta ↔ contraoferta hasta
 * que una parte acepta; el trato reserva la unidad; pago y transferencia ocurren fuera de
 * Finmotor; con las dos confirmaciones la unidad entra al stock de la automotora.
 */
import { Check } from "lucide-react";

import type { WholesaleDeal } from "@/lib/wholesale";

const STEPS: [string, string][] = [
  ["Revisas la subasta", "Consulta el informe, el precio base, el incremento mínimo y la fecha de cierre."],
  ["Registras tu puja", "Compites con otras automotoras. Cada nueva puja debe superar la mayor por el incremento mínimo."],
  ["Adjudicación al cierre", "La mayor puja válida gana y la unidad queda reservada para la automotora adjudicada."],
  ["Pago y transferencia", "Pagas y firman la transferencia fuera de Finmotor. El proveedor confirma el pago recibido."],
  ["La unidad entra a tu stock", "Con ambas confirmaciones, ingresa al inventario de tu automotora pendiente de publicación al público."],
];

/** Índice del paso en curso (0..4); 5 = completado. */
export function currentStep(deal: WholesaleDeal | null): number {
  if (!deal || deal.status === "rejected" || deal.status === "cancelled") return 0;
  if (deal.status === "negotiating") return 1;
  if (deal.status === "agreed") return deal.supplierConfirmedAt ? 4 : 3;
  if (deal.status === "completed") return 5;
  return 0;
}

export function NegotiationSteps({ deal }: { deal: WholesaleDeal | null }) {
  const step = currentStep(deal);
  return (
    <ol className="space-y-0">
      {STEPS.map(([title, text], i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={title} className="relative flex gap-3 pb-4 last:pb-0">
            {i < STEPS.length - 1 && (
              <span className="absolute left-[13px] top-7 h-[calc(100%-20px)] w-px" style={{ background: done ? "var(--fm-green-600)" : "var(--fm-ink-200)" }} />
            )}
            <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={done ? { background: "var(--fm-green-600)", color: "#fff" }
                : active ? { background: "var(--fm-lime-500)", color: "var(--fm-navy)" }
                  : { background: "var(--fm-ink-100)", color: "var(--fm-ink-400)" }}>
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm font-semibold" style={{ color: active || done ? "var(--fm-teal-600)" : "var(--fm-ink-500)" }}>
                {title}
                {active && <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--fm-lime-50)", color: "var(--fm-green-600)" }}>Aquí vas</span>}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: "var(--fm-ink-500)" }}>{text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
