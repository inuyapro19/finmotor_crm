import { PageHeader } from "@/components/ui/primitives";
import { SupplierTeamManager } from "@/components/wholesale/supplier-team";
import { backendJson } from "@/lib/api/client";
import { requireSupplierSession } from "@/lib/auth/supplier-session";
import type { SupplierTeam } from "@/lib/wholesale";

export default async function SupplierTeamPage() {
  const session = await requireSupplierSession();
  const team = await backendJson<SupplierTeam>("/wholesale/supplier/team");
  return (
    <>
      <PageHeader
        title="Equipo"
        subtitle="Tu equipo organizado por sucursal. Cada vendedor publica unidades y negocia con las automotoras."
      />
      <SupplierTeamManager team={team} myUserId={session.userId} />
    </>
  );
}
