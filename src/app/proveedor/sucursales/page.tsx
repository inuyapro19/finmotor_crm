import { PageHeader } from "@/components/ui/primitives";
import { SupplierLocationsManager } from "@/components/wholesale/supplier-locations";
import { backendJson } from "@/lib/api/client";
import { requireSupplierSession } from "@/lib/auth/supplier-session";
import type { SupplierLocation } from "@/lib/wholesale";

export default async function SupplierLocationsPage() {
  await requireSupplierSession();
  const data = await backendJson<{ locations: SupplierLocation[]; canManage: boolean }>("/wholesale/supplier/locations");
  return (
    <>
      <PageHeader
        title="Sucursales"
        subtitle="Desde dónde vendes. Cada persona del equipo y cada unidad pertenece a una sucursal."
      />
      <SupplierLocationsManager locations={data.locations} canManage={data.canManage} />
    </>
  );
}
