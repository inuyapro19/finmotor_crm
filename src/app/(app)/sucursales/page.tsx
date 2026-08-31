import { redirect } from "next/navigation";

import { isDealershipAdmin, requireCrmSession } from "@/lib/auth/session";
import { getOrganizationLocations } from "@/lib/data/crm";
import { LocationList } from "@/components/organization/location-list";
import { PageHeader, Panel } from "@/components/ui/primitives";

/** Administración de sucursales, reservada al administrador de la automotora. */
export default async function BranchesPage() {
  const session = await requireCrmSession();
  if (!isDealershipAdmin(session.role)) redirect("/");

  const locations = await getOrganizationLocations(session.dealership.id, true);

  return (
    <>
      <PageHeader
        title="Sucursales"
        subtitle={`Administra las ubicaciones de ${session.dealership.name}.`}
      />

      <Panel
        title="Sucursales de la automotora"
        subtitle="Se seleccionan al ingresar cada vehículo"
        className="max-w-3xl"
      >
        <div className="p-4">
          <LocationList
            organizationId={session.dealership.id}
            locations={locations}
            canManage
          />
        </div>
      </Panel>
    </>
  );
}

export const dynamic = "force-dynamic";
