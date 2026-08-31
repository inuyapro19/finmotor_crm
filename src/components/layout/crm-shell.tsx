"use client";

/**
 * Shell del CRM. Móvil primero: en el teléfono la navegación es una barra inferior de 3
 * destinos (el agente trabaja en el patio, con el cliente al lado); en escritorio se
 * convierte en una barra lateral. La navegación se recorta según el rol del negocio.
 *
 * En escritorio los destinos NO van en una lista plana: se agrupan por el momento del
 * trabajo (Operación → Inventario → Administración) con un rótulo por grupo, para que el
 * agente ubique dónde está trabajando sin releer todos los ítems cada vez.
 *
 * Tres zonas fijas, cada una con un trabajo distinto:
 *   barra lateral → a dónde voy          (navy, jerarquía de módulos)
 *   cabecera      → dónde estoy y quién soy (título de sección, avisos, cuenta)
 *   panel derecho → qué está pasando      (bitácora del local, bajo demanda)
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Activity, ArrowLeftRight, ArrowRightLeft, Building2, CalendarCheck2, Car, FileClock, History, Inbox, LayoutGrid, Store, Users } from "lucide-react";

import { CRM_ROLE_LABEL, canManageTeam, isDealershipAdmin, type CrmRole } from "@/lib/auth/roles";
import {
  getRailServerSnapshot,
  getRailSnapshot,
  setRailOpen,
  subscribeRail,
} from "@/lib/ui/rail-preference";
import type { ActivityItem, Notification } from "@/lib/data/crm";
import { ActivityRail } from "@/components/layout/activity-rail";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Destinos que caben en la barra inferior del teléfono (el resto vive en el menú de cuenta). */
const MOBILE_HREFS = ["/", "/solicitudes", "/vehiculos"];
/** A dónde manda el botón de intercambio al entrar a cada espacio de trabajo. */
const CRM_HOME = "/";
const ERP_HOME = "/vehiculos";

/**
 * Espacio CRM: leads desde el primer contacto hasta la venta. Es lo único que calza con la
 * definición de CRM — captar, gestionar y convertir, con seguimiento y métricas comerciales.
 */
function crmGroups(): NavGroup[] {
  return [
    {
      label: "Operación",
      items: [
        { href: "/", label: "Mi día", icon: LayoutGrid },
        { href: "/solicitudes", label: "Solicitudes", icon: Inbox },
        { href: "/informes", label: "Informe histórico", icon: FileClock },
        { href: "/informes-precompra", label: "Informe de precompra", icon: CalendarCheck2 },
        { href: "/transferencias", label: "Transferencias", icon: ArrowRightLeft },
      ],
    },
  ];
}

/**
 * Espacio ERP: inventario y administración de la automotora. Vive en la MISMA app (mismo
 * dominio, misma sesión) — el botón de la cabecera intercambia qué grupo se ve en la barra
 * lateral, no navega a otro producto ni a la consola del superadmin.
 */
function erpGroups(role: CrmRole): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Inventario",
      items: [
        { href: "/vehiculos", label: "Vehículos", icon: Car },
        { href: "/historial-stock", label: "Historial de stock", icon: History },
      ],
    },
  ];
  if (canManageTeam(role)) {
    groups.push({
      label: "Administración",
      items: [
        { href: "/equipo", label: "Equipo", icon: Users },
        ...(isDealershipAdmin(role)
          ? [{ href: "/sucursales", label: "Sucursales", icon: Building2 }]
          : []),
        { href: "/perfil", label: "Perfil", icon: Store },
      ],
    });
  }
  return groups;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function CrmShell({
  user,
  notifications,
  activity,
  children,
}: {
  user: {
    fullName: string;
    email: string | null;
    initials: string;
    role: CrmRole;
    dealershipName: string;
    dealershipCount: number;
    portfolioRestricted: boolean;
  };
  notifications: Notification[];
  activity: ActivityItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const crmNav = useMemo(() => crmGroups(), []);
  const erpNav = useMemo(() => erpGroups(user.role), [user.role]);
  // El espacio activo lo decide la ruta actual, no una preferencia guardada aparte: si alguien
  // entra directo a /vehiculos (link, favorito, "atrás"), la barra lateral ya muestra Inventario
  // en vez de quedar desincronizada con la página que se está viendo.
  const inErp = useMemo(
    () => erpNav.some((group) => group.items.some((item) => isActive(pathname, item.href))),
    [erpNav, pathname],
  );
  const groups = inErp ? erpNav : crmNav;
  const flatNav = useMemo(() => [...crmNav, ...erpNav].flatMap((group) => group.items), [crmNav, erpNav]);
  const bottomNav = useMemo(
    () => flatNav.filter((item) => MOBILE_HREFS.includes(item.href)),
    [flatNav],
  );
  const current = useMemo(
    () => flatNav.find((item) => isActive(pathname, item.href)),
    [flatNav, pathname],
  );

  // El panel de actividad es una preferencia, no un estado de página: si el dueño lo dejó
  // abierto, lo encuentra abierto mañana.
  const railOpen = useSyncExternalStore(subscribeRail, getRailSnapshot, getRailServerSnapshot);
  const toggleRail = useCallback(() => setRailOpen(!railOpen), [railOpen]);
  const closeRail = useCallback(() => setRailOpen(false), []);

  const scopeLabel = user.portfolioRestricted ? "Tu cartera" : "Todo el equipo";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* ── Barra lateral (escritorio) ─────────────────────────── */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-[var(--fm-navy)] lg:flex">
        {/* Marca: la versión lima del logo es la que corresponde sobre el azul marino (la
            verde se apaga contra ese fondo). El wordmark ya dice "Finmotor", así que sólo
            se le suma el distintivo del producto. */}
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <Image
            src="/assets/img/finmotor-logo-vector-lime.svg"
            alt="Finmotor"
            width={875}
            height={184}
            priority
            // El optimizador de Next rechaza SVG salvo con `dangerouslyAllowSVG`, que
            // habilitaría SVG arbitrarios de cualquier origen permitido. Un vectorial no
            // gana nada al optimizarse: se sirve tal cual.
            unoptimized
            className="h-[22px] w-auto"
          />
          <span className="rounded-md border border-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/55">
            {inErp ? "ERP" : "CRM"}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group, index) => (
            <div key={group.label} className={clsx(index > 0 && "mt-6")}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors",
                        active
                          ? "bg-white/10 font-semibold text-white"
                          : "font-medium text-white/55 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      {/* Marca de página activa: una barra lima, no un bloque de color */}
                      <span
                        aria-hidden
                        className={clsx(
                          "absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--fm-lime)] transition-opacity",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <item.icon
                        className={clsx(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active
                            ? "text-[var(--fm-lime)]"
                            : "text-white/40 group-hover:text-white/80",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Automotora activa: cierra la barra con el contexto, no con la cuenta (esa vive
            en la cabecera, donde el usuario la busca). */}
        <div className="mt-auto p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 py-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--fm-lime)]/15 text-[10px] font-bold uppercase text-[var(--fm-lime)]">
              {user.dealershipName.trim().charAt(0) || "A"}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[12px] font-semibold text-white">
                {user.dealershipName}
              </span>
              <span className="block truncate text-[10px] text-white/40">
                {CRM_ROLE_LABEL[user.role]}
              </span>
            </span>
          </div>
        </div>
      </aside>

      {/* ── Contenido ──────────────────────────────────────────── */}
      <div className={clsx("flex min-w-0 flex-col transition-[padding]", railOpen && "xl:pr-80")}>
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--card)]/95 px-4 py-2.5 backdrop-blur sm:px-6">
          {/* Marca sólo en móvil: en escritorio ya está en la barra lateral. Aquí el fondo
              es claro, así que va la versión verde del logo. */}
          <Image
            src="/assets/img/finmotor-logo-vector.svg"
            alt="Finmotor"
            width={875}
            height={184}
            priority
            unoptimized
            className="h-[18px] w-auto shrink-0 lg:hidden"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">
              {current?.label ?? "Finmotor CRM"}
            </p>
            <p className="truncate text-[11px] text-[var(--muted-foreground)]">
              {user.dealershipName}
            </p>
          </div>

          {/* Intercambia qué grupo muestra la barra lateral (CRM ↔ ERP), en la misma app y
              sesión — ya no navega a un dominio ni una consola distinta. */}
          <Link
            href={inErp ? CRM_HOME : ERP_HOME}
            className="hidden items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:text-[var(--foreground)] sm:flex"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {inErp ? "CRM" : "ERP"}
          </Link>

          <button
            onClick={toggleRail}
            aria-label="Actividad del equipo"
            aria-expanded={railOpen}
            className={clsx(
              "grid h-9 w-9 place-items-center rounded-lg border transition-colors",
              railOpen
                ? "border-[var(--primary)]/30 bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Activity className="h-[18px] w-[18px]" />
          </button>

          <NotificationsBell initial={notifications} />

          <span aria-hidden className="mx-0.5 h-6 w-px bg-[var(--border)]" />

          <UserMenu user={user} />
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 pb-24 sm:px-6 lg:pb-10">{children}</main>

        {/* Navegación inferior (móvil) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-[var(--border)] bg-[var(--card)] lg:hidden"
          style={{ gridTemplateColumns: `repeat(${bottomNav.length}, minmax(0, 1fr))` }}
        >
          {bottomNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors",
                  active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <ActivityRail
        initial={activity}
        open={railOpen}
        onClose={closeRail}
        scopeLabel={scopeLabel}
      />
    </div>
  );
}
