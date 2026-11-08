/**
 * "Antes del test drive": lo que el cliente debe tener ANTES de probar el vehículo — el informe
 * histórico y la evaluación financiera (cotización de crédito) de ESE vehículo — más el estado
 * del vehículo en parte de pago, si lo hay. Es un semáforo para el ejecutivo: si el test drive
 * está cerca y falta algo, aparece en ámbar.
 *
 * Solo lee: las acciones (pedir el informe, enviar la evaluación, evaluar el vehículo) viven en
 * las pestañas que ya existen; aquí se dice qué falta y dónde resolverlo.
 */
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Circle, Clock } from "lucide-react";

import { Panel } from "@/components/ui/primitives";
import type { Readiness } from "@/lib/data/crm";
import { fmtDateTime } from "@/lib/format";

type Tone = "ok" | "wait" | "warn" | "todo";

const TONE_ICON = { ok: CheckCircle2, wait: Clock, warn: AlertTriangle, todo: Circle } as const;
const TONE_CLASS: Record<Tone, string> = {
  ok: "text-[var(--success,#16a34a)]",
  wait: "text-[var(--muted-foreground)]",
  warn: "text-[var(--warning,#d97706)]",
  todo: "text-[var(--muted-foreground)]",
};

type Item = { key: string; label: string; detail: string; tone: Tone };

const TEST_DRIVE_LABEL: Record<string, string> = {
  not_scheduled: "Sin agendar",
  scheduled: "Agendado",
  completed: "Realizado",
  cancelled: "Cancelado",
  no_show: "El cliente no asistió",
};

export function LeadReadiness({ readiness }: { readiness: Readiness }) {
  const { testDrive, historyReport, creditQuote, tradeIn } = readiness;
  // Con el test drive agendado, lo que falta deja de ser "pendiente" y pasa a ser urgente.
  const upcoming = testDrive.status === "scheduled";

  const items: Item[] = [
    {
      key: "test-drive",
      label: "Test drive",
      detail:
        testDrive.status === "scheduled" && testDrive.scheduledAt
          ? `Agendado · ${fmtDateTime(testDrive.scheduledAt)}`
          : (TEST_DRIVE_LABEL[testDrive.status] ?? testDrive.status),
      tone: testDrive.status === "completed" || testDrive.status === "scheduled" ? "ok" : "todo",
    },
    {
      key: "history",
      label: "Informe histórico del vehículo",
      detail:
        historyReport.state === "issued"
          ? "Listo para enviar al cliente"
          : historyReport.state === "processing"
            ? "Generándose"
            : "Pendiente — pídelo en «Vehículos y cotización»",
      tone: historyReport.state === "issued" ? "ok" : historyReport.state === "processing" ? "wait" : upcoming ? "warn" : "todo",
    },
    {
      key: "credit",
      label: "Evaluación financiera",
      detail:
        creditQuote.state === "current"
          ? `Enviada${creditQuote.at ? ` · ${fmtDateTime(creditQuote.at)}` : ""}`
          : creditQuote.state === "stale"
            ? "Era de otro vehículo: recalcúlala y reenvíala en «Financiamiento»"
            : "Sin evaluación — envíala en «Financiamiento»",
      tone: creditQuote.state === "current" ? "ok" : upcoming ? "warn" : creditQuote.state === "stale" ? "warn" : "todo",
    },
  ];
  if (tradeIn.present) {
    items.push({
      key: "trade-in",
      label: "Vehículo en parte de pago",
      detail: tradeIn.status === "evaluated" ? "Evaluado presencialmente" : "Falta la evaluación presencial",
      tone: tradeIn.status === "evaluated" ? "ok" : "todo",
    });
  }

  return (
    <Panel title="Antes del test drive" subtitle="Lo que el cliente debe tener antes de probar el vehículo">
      <ul className="divide-y divide-[var(--border)]">
        {items.map((item) => {
          const Icon = TONE_ICON[item.tone];
          return (
            <li key={item.key} className="flex items-start gap-3 px-4 py-2.5">
              <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", TONE_CLASS[item.tone])} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className={clsx("text-xs", item.tone === "warn" ? "text-[var(--warning,#d97706)]" : "text-[var(--muted-foreground)]")}>
                  {item.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
