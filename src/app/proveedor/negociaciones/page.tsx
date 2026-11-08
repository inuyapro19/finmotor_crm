import { Suspense } from "react";

import { PageHeader } from "@/components/ui/primitives";
import { DealsTable } from "@/components/wholesale/deals-table";
import { backendJson } from "@/lib/api/client";
import { requireSupplierSession } from "@/lib/auth/supplier-session";
import type { WholesaleDeal } from "@/lib/wholesale";

/** Tabla comercial del proveedor: negociaciones de todas sus unidades, filtrables por automotora y sucursal. */
export default async function SupplierDealsPage() {
  await requireSupplierSession();
  const { items } = await backendJson<{ items: WholesaleDeal[] }>("/wholesale/supplier/deals");
  return (
    <>
      <PageHeader title="Negociaciones"
        subtitle="Ofertas de automotoras sobre tus unidades. Responde las marcadas y confirma el pago y la transferencia al cerrar." />
      <Suspense>
        <DealsTable deals={items} side="supplier" />
      </Suspense>
    </>
  );
}
