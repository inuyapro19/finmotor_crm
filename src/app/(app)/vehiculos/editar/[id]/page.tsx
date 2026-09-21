import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { backendJson } from "@/lib/api/client";
import type { SourcingOpportunity } from "@/lib/sourcing";

import { DealershipVehicleForm } from "@/components/vehicles/dealership-vehicle-form";
import { PageHeader } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getOrganizationLocations, getVehicleDetail, getVehiclePreparation } from "@/lib/data/crm";


export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmSession();
  if (!canWrite(session.role)) redirect("/vehiculos");
  const { id } = await params;
  const [detail, locations, preparation, sourcing] = await Promise.all([
    getVehicleDetail(id),
    getOrganizationLocations(session.dealership.id, true),
    getVehiclePreparation(id),
    backendJson<{ items: SourcingOpportunity[] }>(`/backoffice/sourcing?vehicleId=${encodeURIComponent(id)}`),
  ]);
  if (!detail) notFound();

  return (
    <>
      <PageHeader
        title={`Editar ${detail.vehicle.patent || "vehículo"}`}
        subtitle={detail.vehicle.stockNumber == null ? undefined : `Código de stock STK-${String(detail.vehicle.stockNumber).padStart(6, "0")}`}
      />
      {sourcing.items[0] && <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-[var(--accent)] p-4 text-sm"><Link className="underline" href={`/captacion/${sourcing.items[0].id}`}>Ver captación y acuerdo de origen</Link>{sourcing.items[0].relatedLeadId && <Link className="underline" href={`/solicitudes/${sourcing.items[0].relatedLeadId}`}>Ver venta vinculada a la parte de pago</Link>}</div>}
      <DealershipVehicleForm vehicle={detail.vehicle} acquisition={detail.acquisition} locations={locations} preparation={preparation} />
    </>
  );
}
