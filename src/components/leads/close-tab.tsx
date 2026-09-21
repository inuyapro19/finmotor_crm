/**
 * Pestaña "Cierre": todo lo que hace falta para vender de mostrador sin salir de la ficha,
 * en el orden real en que ocurre — Crédito (si aplica) → Pago → Transferencia → Documentos.
 * Informes queda aparte porque es opcional y no bloquea nada del cierre.
 *
 * Server component: sólo arma el layout con los datos ya cargados por la página; cada bloque
 * es un client component chico con su propio fetch (mismo molde que Cotización/Financiamiento).
 */
import type { ReactNode } from "react";
import { Files } from "lucide-react";
import { Panel, Pill, type PillVariant } from "@/components/ui/primitives";
import { CreditDecision } from "@/components/leads/credit-decision";
import { PaymentForm } from "@/components/leads/payment-form";
import { ReportActions } from "@/components/leads/report-actions";
import { TransferAction } from "@/components/leads/transfer-action";
import { fmtCLP } from "@/lib/format";
import { transferStatus } from "@/lib/transfers";
import type { CreditRequest, SaleTerms } from "@/lib/data/crm";
import type { Lead } from "@/lib/leads";

const PAYMENT_DONE_STATUSES = new Set(["PAYMENT_CONFIRMED", "CONTRACT_SIGNED", "TRANSFER_IN_PROGRESS", "COMPLETED"]);
/** Un credito `disbursed` (cursado) ya fue aprobado Y desembolsado: tratarlo como pendiente
 *  pedia transcribir de nuevo una decision que la financiera ya tomo. */
const CREDIT_DECIDED = new Set(["approved", "disbursed", "rejected", "rejected_pretriage"]);
const CREDIT_APPROVED = new Set(["approved", "disbursed"]);

function Step({
  number,
  title,
  subtitle,
  status,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  status: { label: string; variant: PillVariant };
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(7,29,86,0.04)]">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--fm-navy)] text-[11px] font-semibold text-white">
            {number}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            {subtitle && <p className="truncate text-xs text-[var(--muted-foreground)]">{subtitle}</p>}
          </div>
        </div>
        <Pill variant={status.variant}>{status.label}</Pill>
      </header>
      {children}
    </section>
  );
}

export function CloseTab({
  lead,
  creditRequests,
  sale,
  canWrite,
  canManageTeam,
  canManageTransfers,
}: {
  lead: Lead;
  creditRequests: CreditRequest[];
  sale: SaleTerms;
  canWrite: boolean;
  canManageTeam: boolean;
  canManageTransfers: boolean;
}) {
  // Si la venta se cobra financiada (pie) o al contado (total) lo decide el SERVIDOR, que es
  // el mismo que después valida el monto. Deducirlo acá de `creditRequests.length` contaba
  // las solicitudes rechazadas y pedía el pie de una venta que ya era al contado.
  const financed = sale.financed;
  // El paso de crédito se muestra si hubo financiamiento en algún momento — incluso si la
  // venta volvió a contado tras un rechazo: esconderlo dejaría al agente sin saber por qué.
  const hasCreditHistory = creditRequests.length > 0;
  const pendingRequest = creditRequests.find((r) => !CREDIT_DECIDED.has(String(r.status)));
  const approvedRequest = creditRequests.find((r) => CREDIT_APPROVED.has(String(r.status)));
  const paymentDone = lead.purchaseStatus ? PAYMENT_DONE_STATUSES.has(lead.purchaseStatus) : false;

  let step = 0;

  return (
    <div className="space-y-4">
      {hasCreditHistory && (
        <Step
          number={++step}
          title="Crédito"
          subtitle="Respuesta de la financiera"
          status={
            sale.financeStatus === "approved"
              ? { label: "Aprobado", variant: "success" }
              : sale.financeStatus === "rejected"
                ? { label: "Rechazado", variant: "danger" }
                : { label: "Pendiente", variant: "warn" }
          }
        >
          {sale.financeStatus === "approved" ? (
            <p className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
              {approvedRequest?.institutionName ? `${approvedRequest.institutionName} · ` : ""}
              {fmtCLP(approvedRequest?.approvedAmount ?? approvedRequest?.amount ?? 0)} aprobados. Sigue con el pie y la
              transferencia.
            </p>
          ) : sale.financeStatus === "rejected" ? (
            <p className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
              La financiera rechazó la solicitud.{" "}
              {financed
                ? "El pie ya está cobrado, así que la transferencia queda detenida hasta resolver el saldo. Envía una nueva solicitud desde la pestaña Financiamiento."
                : "La venta sigue en pie al contado: el monto a cobrar pasó a ser el total. Si el cliente prefiere reintentar, envía una nueva solicitud desde la pestaña Financiamiento."}
            </p>
          ) : pendingRequest ? (
            <CreditDecision leadId={lead.id} requests={creditRequests} canManageTeam={canManageTeam} />
          ) : (
            <p className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
              Esta venta es con financiamiento pero aún no se envió a evaluación. Hazlo desde la pestaña Financiamiento.
            </p>
          )}
        </Step>
      )}

      <Step
        number={++step}
        title="Pago"
        subtitle={financed ? "Pie a cobrar en el mostrador" : "Total a cobrar en el mostrador"}
        status={paymentDone ? { label: "Cobrado", variant: "success" } : { label: "Pendiente", variant: "neutral" }}
      >
        <PaymentForm lead={lead} sale={sale} canWrite={canWrite} />
      </Step>

      <Step
        number={++step}
        title="Transferencia"
        subtitle="Contrato, cédulas y registro vía Nexocar"
        status={
          lead.transferStatus
            ? transferStatus(lead.transferStatus)
            : { label: "Pendiente", variant: "neutral" }
        }
      >
        <div className="p-4">
          <TransferAction lead={lead} canManageTransfers={canManageTransfers} />
        </div>
      </Step>

      <Step
        number={++step}
        title="Documentos de venta"
        subtitle="Paquete de seis documentos listo para imprimir"
        status={lead.purchaseId ? { label: "Disponible", variant: "success" } : { label: "Pendiente", variant: "neutral" }}
      >
        {lead.purchaseId ? (
          <div className="p-4">
            <a
              href={`/api/crm/leads/${lead.id}/documents`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-4 py-2.5 text-sm font-medium text-white"
            >
              <Files className="h-4 w-4" />
              Abrir e imprimir documentos
            </a>
          </div>
        ) : (
          <p className="px-4 py-3 text-xs text-[var(--muted-foreground)]">Se habilitan cuando quede registrado el pago.</p>
        )}
      </Step>

      <Panel title="Informes" subtitle="Para la unidad cotizada, sin pasarela — opcional, no bloquea el cierre">
        <ReportActions leadId={lead.id} hasVehicle={Boolean(lead.vehicleId)} canWrite={canWrite} />
      </Panel>
    </div>
  );
}
