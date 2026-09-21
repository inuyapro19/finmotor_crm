import { redirect } from "next/navigation";

import { canManageTeam, requireCrmSession } from "@/lib/auth/session";
import { getOrganization } from "@/lib/data/crm";
import { Notice, PageHeader, Panel } from "@/components/ui/primitives";
import { OrganizationForm } from "@/components/organization/organization-form";
import { ChannelList } from "@/components/organization/channel-list";
import { OrganizationLogoUpload } from "@/components/organization/organization-logo-upload";

/**
 * Perfil de la automotora: los datos de la empresa y los canales donde publica.
 *
 * Los datos no son decorativos: alimentan el contrato de consignación (razón social, RUT,
 * representante legal, comisión por defecto). Hasta ahora no había forma de editarlos.
 */
export default async function ProfilePage() {
  const session = await requireCrmSession();
  if (!canManageTeam(session.role)) redirect("/");

  const organization = await getOrganization(session.dealership.id);
  if (!organization) {
    return (
      <Panel title="Perfil">
        <div className="p-4">
          <Notice tone="warn">No pudimos cargar los datos de tu automotora.</Notice>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title="Perfil de la automotora"
        subtitle="Datos de la empresa y canales donde publicas tu stock."
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Panel title="Identidad visual" subtitle="Marca que aparece en los documentos operativos">
            <div className="p-4">
              <OrganizationLogoUpload organization={organization} />
            </div>
          </Panel>

          <Panel title="Datos de la empresa" subtitle="Se usan en contratos y documentos">
            <div className="p-4">
              <OrganizationForm organization={organization} />
            </div>
          </Panel>
        </div>

        <Panel title="Canales de publicación" subtitle="Dónde se muestra tu stock">
          <ChannelList organizationId={organization.id} channels={organization.channels} />
        </Panel>
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
