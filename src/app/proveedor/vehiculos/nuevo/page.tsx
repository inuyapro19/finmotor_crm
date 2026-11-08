import { redirect } from "next/navigation";
import { Panel, PageHeader } from "@/components/ui/primitives";
import { ListingForm } from "@/components/wholesale/listing-form";
import { backendJson } from "@/lib/api/client";
import { requireSupplierSession } from "@/lib/auth/supplier-session";
import type { SupplierLocation } from "@/lib/wholesale";

export default async function NewSupplierListing() {
  const session = await requireSupplierSession();
  if (!session.canWrite) redirect("/proveedor");
  const { locations } = await backendJson<{ locations: SupplierLocation[] }>("/wholesale/supplier/locations")
    .catch(() => ({ locations: [] as SupplierLocation[] }));
  return (
    <>
      <PageHeader title="Publicar vehículo"
        subtitle="Paso 1 de 2: ingresa la patente y completamos los datos por ti. Después agregas fotos y el informe histórico." />
      <Panel>
        <div className="p-4">
          <ListingForm locations={locations} defaultLocationId={session.supplier.locationId} />
        </div>
      </Panel>
    </>
  );
}
