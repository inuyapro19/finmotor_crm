import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/ui/primitives";
import { DealsTable } from "@/components/wholesale/deals-table";
import { backendJson } from "@/lib/api/client";
import { requireCrmSession } from "@/lib/auth/session";
import type { WholesaleDeal } from "@/lib/wholesale";

/** Tabla comercial de la automotora: todas sus negociaciones mayoristas, filtrables por proveedor. */
export default async function WholesaleDealsPage() {
  await requireCrmSession();
  const { items } = await backendJson<{ items: WholesaleDeal[] }>("/wholesale/market/deals");
  return (
    <>
      <Link href="/mayorista" className="mb-2 inline-block text-xs text-[var(--muted-foreground)] underline">← Marketplace proveedores</Link>
      <PageHeader title="Compras adjudicadas y tratos anteriores"
        subtitle="Gestiona el pago y la recepción de tus adjudicaciones. Las operaciones anteriores conservan su historial." />
      <Suspense>
        <DealsTable deals={items} side="dealership" />
      </Suspense>
    </>
  );
}
