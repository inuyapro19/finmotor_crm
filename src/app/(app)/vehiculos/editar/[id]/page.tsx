import { notFound, redirect } from "next/navigation";

import { DealershipVehicleForm } from "@/components/vehicles/dealership-vehicle-form";
import { PageHeader } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getOrganizationLocations, getVehicleDetail, getVehiclePreparation } from "@/lib/data/crm";


export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmSession();
  if (!canWrite(session.role)) redirect("/vehiculos");
  const { id } = await params;
  const [detail, locations, preparation] = await Promise.all([
    getVehicleDetail(id),
    getOrganizationLocations(session.dealership.id, true),
    getVehiclePreparation(id),
  ]);
  if (!detail) notFound();

  return (
    <>
      <PageHeader
        title={`Editar ${detail.vehicle.patent || "vehículo"}`}
        subtitle={detail.vehicle.stockNumber == null ? undefined : `Código de stock STK-${String(detail.vehicle.stockNumber).padStart(6, "0")}`}
      />
      <DealershipVehicleForm vehicle={detail.vehicle} acquisition={detail.acquisition} locations={locations} preparation={preparation} />
    </>
  );
}
