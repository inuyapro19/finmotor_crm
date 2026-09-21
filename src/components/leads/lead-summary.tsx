import { Banknote, CalendarClock, Car, Tag, User } from "lucide-react";
import { clsx } from "clsx";

import { fmtCLP, fmtDateTime } from "@/lib/format";
import { isActionOverdue, leadFinancingGap, leadValue, stageLabel, type Lead } from "@/lib/leads";
import type { SaleTerms } from "@/lib/data/crm";
import { LeadPipeline } from "@/components/leads/lead-pipeline";

/**
 * Resumen de estado, fijo arriba de la ficha: en qué etapa va la venta y los cuatro datos que
 * el agente necesita tener a la vista sea cual sea la pestaña que esté mirando.
 *
 * Va antes que las pestañas a propósito: la etapa no es "una sección más", es el marco que da
 * sentido a todo lo demás.
 */
export function LeadSummary({
  lead,
  sale,
  canWrite,
}: {
  lead: Lead;
  sale: SaleTerms;
  canWrite: boolean;
}) {
  const value = leadValue(lead);
  const gap = leadFinancingGap(lead);
  const overdue = isActionOverdue(lead);
  // "Por financiar" es el hueco de la COTIZACION, y se mostraba siempre -- incluso con el
  // credito ya rechazado, donde la venta pasó a ser al contado. Deciamos "por financiar
  // $10.500.000" arriba y "total a cobrar $14.000.000" abajo, en la misma pantalla.
  const showsFinancingGap = sale.financed && gap > 0 && value !== null;

  return (
    <section className="mb-4 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--border)] px-4 py-3">
        <p className="text-sm font-semibold">
          {stageLabel(lead.stage)}
          <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">
            {lead.stage === "won"
              ? "Venta cerrada"
              : lead.stage === "lost"
                ? lead.lostReason ?? "Solicitud perdida"
                : `Desde ${fmtDateTime(lead.stageChangedAt ?? lead.updatedAt)}`}
          </span>
        </p>
      </div>

      <LeadPipeline
        leadId={lead.id}
        currentStage={lead.stage}
        purchaseStatus={lead.purchaseStatus}
        canWrite={canWrite}
      />

      <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] border-t border-[var(--border)] sm:grid-cols-4 sm:divide-y-0">
        <Metric
          icon={Car}
          label="Unidad"
          value={lead.vehicleId ? lead.vehicleLabel : "Sin elegir"}
          hint={lead.vehiclePatent ?? (lead.vehicleId ? undefined : "Compara alternativas en Vehículos")}
        />
        <Metric
          icon={Tag}
          label="Valor"
          value={value !== null ? fmtCLP(value) : "Sin cotizar"}
          hint={
            lead.quotedPrice !== null
              ? "Precio conversado"
              : lead.vehiclePrice !== null
                ? "Precio de lista"
                : undefined
          }
        />
        <Metric
          icon={Banknote}
          label={showsFinancingGap ? "Por financiar" : "A cobrar"}
          value={
            showsFinancingGap
              ? fmtCLP(gap)
              : sale.amountDueClp > 0
                ? fmtCLP(sale.amountDueClp)
                : "—"
          }
          hint={
            showsFinancingGap
              ? lead.quotedDownPayment
                ? `Pie ${fmtCLP(lead.quotedDownPayment)}`
                : undefined
              : sale.financeStatus === "rejected"
                ? "Crédito rechazado: al contado"
                : undefined
          }
        />
        {/* El QUE arriba y el CUANDO de apoyo, igual que el panel "Próximo paso" de la
            pestaña Gestión: los dos salen de la misma tarea abierta más próxima. */}
        <Metric
          icon={CalendarClock}
          label="Próximo paso"
          value={lead.nextActionTitle ?? (lead.nextActionAt ? fmtDateTime(lead.nextActionAt) : "Sin agendar")}
          hint={
            lead.nextActionAt && lead.nextActionTitle
              ? `${fmtDateTime(lead.nextActionAt)}${overdue ? " · vencido" : ""}`
              : overdue
                ? "Vencido"
                : undefined
          }
          tone={overdue ? "alert" : "neutral"}
        />
      </dl>

      <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2.5">
        <User className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
        <p className="truncate text-xs text-[var(--muted-foreground)]">
          {lead.assignedToName ? (
            <>
              Responsable: <span className="text-[var(--foreground)]">{lead.assignedToName}</span>
            </>
          ) : (
            "Sin responsable asignado"
          )}
        </p>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "alert";
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </dt>
      <dd
        className={clsx(
          "mt-1 truncate text-sm font-medium tabular-nums",
          tone === "alert" && "text-red-600",
        )}
      >
        {value}
      </dd>
      {hint && (
        <p
          className={clsx(
            "mt-0.5 truncate text-[10px]",
            tone === "alert" ? "text-red-600" : "text-[var(--muted-foreground)]",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
