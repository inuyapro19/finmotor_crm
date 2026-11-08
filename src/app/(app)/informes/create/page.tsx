import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ReportBatchForm } from "@/components/reports/report-batch-form";
import { PageHeader } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getReportWallet } from "@/lib/data/crm";

export default async function CreateReportsPage() {
  const session = await requireCrmSession();
  const wallet = await getReportWallet(session.dealership.id);

  return (
    <>
      <PageHeader
        title="Solicitar informes"
        subtitle="Carga hasta 200 patentes y genera un solo tipo de informe para todo el lote."
        action={
          <Link
            href="/informes"
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al historial
          </Link>
        }
      />
      <ReportBatchForm
        dealershipName={session.dealership.name}
        canRequest={canWrite(session.role)}
        tokenBalance={wallet?.enabled ? wallet.balance : null}
        prepaid={wallet?.billingMode === "prepaid"}
      />
    </>
  );
}

export const dynamic = "force-dynamic";
