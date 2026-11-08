import { redirect } from "next/navigation";
import { SupplierShell } from "@/components/wholesale/supplier-shell";
import { getSupplierSession } from "@/lib/auth/supplier-session";

/**
 * Guard del portal del proveedor mayorista. Sólo entran miembros activos de una organización
 * `wholesale_supplier` (lo resuelve `GET /wholesale/supplier/me`). Una automotora que llegue
 * aquí por error vuelve a su CRM.
 */
export default async function SupplierLayout({ children }: { children: React.ReactNode }) {
  const session = await getSupplierSession();
  if (!session) redirect("/");
  return (
    <SupplierShell
      supplierName={session.supplier.name}
      fullName={session.fullName}
      initials={session.initials}
      canWrite={session.canWrite}
    >
      {children}
    </SupplierShell>
  );
}
