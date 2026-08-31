import { redirect } from "next/navigation";

import { DealershipVehicleForm } from "@/components/vehicles/dealership-vehicle-form";
import { PageHeader } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getOrganizationLocations } from "@/lib/data/crm";


export default async function CreateVehiclePage() {
  const session = await requireCrmSession();
  if (!canWrite(session.role)) redirect("/vehiculos");
  const locations = await getOrganizationLocations(session.dealership.id);

  return (
    <>
      <PageHeader title="Ingresar vehículo" />
      <DealershipVehicleForm locations={locations} />
    </>
  );
}
