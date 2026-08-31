"use client";

/**
 * Menú de la cuenta, en la esquina de la cabecera. Reemplaza al bloque de usuario que vivía
 * al pie de la barra lateral: cerrar sesión no es un destino de navegación y no debía
 * competir visualmente con los módulos del CRM.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ArrowRightLeft, Building2, CalendarCheck2, ChevronDown, FileClock, FilePlus2, LogOut, MapPin, Store, Users } from "lucide-react";

import { CRM_ROLE_LABEL, canManageTeam, canWrite, isDealershipAdmin, type CrmRole } from "@/lib/auth/roles";

export type UserMenuUser = {
  fullName: string;
  email: string | null;
  initials: string;
  role: CrmRole;
  dealershipName: string;
  dealershipCount: number;
};

export function UserMenu({ user, className }: { user: UserMenuUser; className?: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const logout = async () => {
    const response = await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { redirectTo?: string } | null;
    const webOrigin = window.location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://finmotor.cl";
    window.location.assign(data?.redirectTo ?? `${webOrigin}/api/auth/signout`);
  };

  return (
    <div ref={boxRef} className={clsx("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Tu cuenta"
        className={clsx(
          "flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors sm:pr-2",
          open ? "bg-[var(--muted)]" : "hover:bg-[var(--muted)]",
        )}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--fm-navy)] text-[11px] font-semibold text-[var(--fm-lime)]">
          {user.initials}
        </span>
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-[10rem] truncate text-[12px] font-semibold">
            {user.fullName}
          </span>
          <span className="block text-[10px] text-[var(--muted-foreground)]">
            {CRM_ROLE_LABEL[user.role]}
          </span>
        </span>
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-[0_12px_32px_rgba(7,29,86,0.14)]">
          <div className="border-b border-[var(--border)] px-3.5 py-3">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            {user.email && (
              <p className="truncate text-[11px] text-[var(--muted-foreground)]">{user.email}</p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{user.dealershipName}</span>
            </p>
            {user.dealershipCount > 1 && (
              <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                {user.dealershipCount} automotoras asociadas a tu cuenta
              </p>
            )}
          </div>

          <div className="border-b border-[var(--border)] py-1 lg:hidden">
            <MenuLink href="/informes" icon={FileClock} label="Informe histórico" onNavigate={() => setOpen(false)} />
            <MenuLink href="/informes-precompra" icon={CalendarCheck2} label="Informe de precompra" onNavigate={() => setOpen(false)} />
            <MenuLink href="/transferencias" icon={ArrowRightLeft} label="Transferencias" onNavigate={() => setOpen(false)} />
            {canWrite(user.role) && (
              <MenuLink href="/informes/create" icon={FilePlus2} label="Solicitar informes" onNavigate={() => setOpen(false)} />
            )}
          </div>

          {canManageTeam(user.role) && (
            <div className="border-b border-[var(--border)] py-1">
              <MenuLink href="/perfil" icon={Store} label="Perfil de la automotora" onNavigate={() => setOpen(false)} />
              <MenuLink href="/equipo" icon={Users} label="Equipo" onNavigate={() => setOpen(false)} />
              {isDealershipAdmin(user.role) && (
                <MenuLink href="/sucursales" icon={MapPin} label="Sucursales" onNavigate={() => setOpen(false)} />
              )}
            </div>
          )}

          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-[var(--muted)]"
    >
      <Icon className="h-4 w-4 text-[var(--muted-foreground)]" />
      {label}
    </Link>
  );
}
