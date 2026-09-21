import { redirect } from "next/navigation";
import Link from "next/link";
import { backendJson } from "@/lib/api/client";
import type { SourcingOpportunity } from "@/lib/sourcing";

import { DealershipVehicleForm } from "@/components/vehicles/dealership-vehicle-form";
import { PageHeader } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getOrganizationLocations } from "@/lib/data/crm";


export default async function CreateVehiclePage({ searchParams }: { searchParams: Promise<{ sourcing?: string }> }) {
  const session = await requireCrmSession();
  if (!canWrite(session.role)) redirect("/vehiculos");
  const locations = await getOrganizationLocations(session.dealership.id);
  const { sourcing } = await searchParams;
  const opportunity = sourcing ? (await backendJson<{ opportunity: SourcingOpportunity }>(`/backoffice/sourcing/${encodeURIComponent(sourcing)}`)).opportunity : null;
  if (opportunity?.vehicleId) redirect(`/vehiculos/editar/${opportunity.vehicleId}`);
  if (opportunity && opportunity.stage !== "accepted") redirect(`/captacion/${opportunity.id}`);
  const acquisition = opportunity ? {
    ...opportunity.details, kind: opportunity.kind,
    minPrice: opportunity.kind === "trade_in" ? opportunity.details.tradeInValue : opportunity.details.minPrice,
  } : undefined;

  return (
    <>
      <PageHeader title="Ingresar vehículo" />
      {opportunity && <p className="mb-4 rounded-lg bg-[var(--accent)] p-4 text-sm">Recepción desde captación de {opportunity.details.ownerName}. Revisa la ficha, el precio de venta y la sucursal. <Link className="underline" href={`/captacion/${opportunity.id}`}>Ver acuerdo</Link></p>}
      <DealershipVehicleForm locations={locations} acquisition={acquisition} sourcingOpportunityId={opportunity?.id} />
    </>
  );
}
