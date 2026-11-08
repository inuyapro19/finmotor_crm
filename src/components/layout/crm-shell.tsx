"use client";

/**
 * Shell del CRM. Móvil primero: en el teléfono la navegación es una barra inferior de 3
 * destinos (el agente trabaja en el patio, con el cliente al lado); en escritorio se
 * convierte en una barra lateral. La navegación se recorta según el rol del negocio.
 *
 * En escritorio los destinos NO van en una lista plana: se agrupan por el momento del
 * trabajo (Dashboard suelto arriba, luego ERP → CRM → Kit de compra venta → Administración)
 * con un rótulo por grupo, para que el agente ubique dónde está trabajando sin releer todos
 * los ítems cada vez. Todos los grupos conviven en la misma barra lateral, siempre visibles:
 * no hay un botón que cambie de "espacio", solo la separación por rótulo.
 *
 * Tres zonas fijas, cada una con un trabajo distinto:
 *   barra lateral → a dónde voy          (navy, jerarquía de módulos)
 *   cabecera      → dónde estoy y quién soy (título de sección, avisos, cuenta)
 *   panel derecho → qué está pasando      (bitácora del local, bajo demanda)
 */
import { useMemo, useCallback, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Activity, ArrowRightLeft, BarChart3, Building2, Car, FileClock, History, Inbox, Landmark, LayoutGrid, Store, Users, Warehouse, Wrench } from "lucide-react";

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
const MOBILE_HREFS = ["/solicitudes", "/", "/reportes"];

/** Dashboard va suelto, antes de cualquier grupo — es el único ítem sin rótulo encima. */
const DASHBOARD_ITEM: NavItem = { href: "/", label: "Dashboard", icon: LayoutGrid };

/**
 * Resto de la navegación, siempre visible junta y en este orden: ERP → CRM → Kit de compra
 * venta → Administración (esta última solo si el rol puede gestionar equipo).
 */
function navGroups(role: CrmRole): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "ERP",
      items: [
        { href: "/vehiculos", label: "Stock de vehículos", icon: Car },
        { href: "/historial-stock", label: "Historial de stock", icon: History },
        { href: "/mayorista", label: "Marketplace proveedores", icon: Warehouse },
      ],
    },
    {
      label: "CRM",
      items: [
        { href: "/solicitudes", label: "Canales de entrada", icon: Inbox },
        { href: "/captacion", label: "Captación de vehículos", icon: Car },
        { href: "/reportes", label: "Reportes", icon: BarChart3 },
      ],
    },
    {
      label: "Kit de compra venta",
      items: [
        { href: "/informes", label: "Informe histórico", icon: FileClock },
        { href: "/informes-precompra", label: "Informe precompra", icon: Wrench },
        { href: "/creditos", label: "Créditos", icon: Landmark },
        { href: "/transferencias", label: "Transferencias", icon: ArrowRightLeft },
      ],
    },
  ];
  if (canManageTeam(role)) {
    groups.push({
      label: "Administración",
      items: [
        ...(isDealershipAdmin(role)
          ? [{ href: "/sucursales", label: "Sucursales", icon: Building2 }]
          : []),
        { href: "/equipo", label: "Equipo", icon: Users },
        { href: "/perfil", label: "Mi perfil", icon: Store },
      ],
    });
  }
  return groups;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
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
          active ? "text-[var(--fm-lime)]" : "text-white/40 group-hover:text-white/80",
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
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
  const groups = useMemo(() => navGroups(user.role), [user.role]);
  const flatNav = useMemo(
    () => [DASHBOARD_ITEM, ...groups.flatMap((group) => group.items)],
    [groups],
  );
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
            verde se apaga contra ese fondo). */}
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
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {/* Dashboard va suelto, fuera de todo grupo: sin rótulo encima, primero en la barra. */}
          <div className="space-y-1 pb-6">
            <NavLink item={DASHBOARD_ITEM} active={isActive(pathname, DASHBOARD_ITEM.href)} />
          </div>

          {groups.map((group, index) => (
            <div key={group.label} className={clsx(index > 0 && "mt-6")}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fm-lime)]">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
                ))}
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
          </div>

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
