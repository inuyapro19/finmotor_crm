import { redirect } from "next/navigation";
import { CrmShell } from "@/components/layout/crm-shell";
import { getCrmSession } from "@/lib/auth/session";
import { getActivityFeed, getNotifications } from "@/lib/data/crm";

/**
 * Guard de todo el CRM. `getCrmSession()` devuelve null si no hay sesión **o** si el usuario
 * no pertenece a ninguna automotora activa — que es la regla de acceso de este frontend.
 *
 * La cabecera (avisos) y el panel de actividad se cargan aquí, en paralelo, para que el
 * primer render ya venga con datos; después ambos se refrescan solos desde el cliente.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCrmSession();
  if (!session) redirect("/login");

  const [notifications, activity] = await Promise.all([getNotifications(), getActivityFeed(30)]);

  return (
    <CrmShell
      user={{
        fullName: session.fullName,
        email: session.email,
        initials: session.initials,
        role: session.role,
        dealershipName: session.dealership.name,
        dealershipCount: session.dealerships.length,
        portfolioRestricted: session.portfolioRestricted,
      }}
      notifications={notifications}
      activity={activity}
    >
      {children}
    </CrmShell>
  );
}
