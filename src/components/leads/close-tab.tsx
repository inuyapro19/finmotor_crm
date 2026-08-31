/**
 * Pestaña "Cierre": todo lo que hace falta para vender de mostrador sin salir de la ficha —
 * pedir informes, cobrar (queda informado, sin pasarela) y, cuando corresponde, transferir.
 *
 * Server component: sólo arma el layout con los datos ya cargados por la página; cada bloque
 * es un client component chico con su propio fetch (mismo molde que Cotización/Financiamiento).
 */
import { Panel } from "@/components/ui/primitives";
import { Files } from "lucide-react";
import { CreditDecision } from "@/components/leads/credit-decision";
import { PaymentForm } from "@/components/leads/payment-form";
import { ReportActions } from "@/components/leads/report-actions";
import { TransferAction } from "@/components/leads/transfer-action";
import type { CreditRequest } from "@/lib/data/crm";
import type { Lead } from "@/lib/leads";

export function CloseTab({
  lead,
  creditRequests,
  canWrite,
  canManageTeam,
  canManageTransfers,
}: {
  lead: Lead;
  creditRequests: CreditRequest[];
  canWrite: boolean;
  canManageTeam: boolean;
  canManageTransfers: boolean;
}) {
  const hasFinancingRequest = creditRequests.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Informes" subtitle="Para la unidad cotizada, sin pasarela" className="lg:col-span-2">
        <ReportActions leadId={lead.id} hasVehicle={Boolean(lead.vehicleId)} canWrite={canWrite} />
      </Panel>

      <Panel title="Pago" subtitle="Lo que cobraste en el mostrador">
        <PaymentForm lead={lead} hasFinancingRequest={hasFinancingRequest} canWrite={canWrite} />
        {hasFinancingRequest && (
          <CreditDecision leadId={lead.id} requests={creditRequests} canManageTeam={canManageTeam} />
        )}
      </Panel>

      <Panel title="Transferencia" subtitle="Contrato, cédulas y registro vía Nexocar">
        <div className="p-4">
          <TransferAction lead={lead} canManageTransfers={canManageTransfers} />
        </div>
      </Panel>

      {lead.purchaseId && (
        <Panel title="Documentos de venta" subtitle="Paquete de seis documentos listo para imprimir" className="lg:col-span-2">
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
        </Panel>
      )}
    </div>
  );
}
