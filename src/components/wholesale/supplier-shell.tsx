"use client";

/**
 * Shell del portal del proveedor. Más simple que el del CRM a propósito: el proveedor hace
 * tres cosas (publicar, responder ofertas, confirmar cierres) y no necesita la navegación de
 * una automotora. Misma identidad visual: barra navy con logo lima.
 */
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { LogOut } from "lucide-react";

const NAV = [
  { href: "/proveedor", label: "Mis vehículos", write: false },
  { href: "/proveedor/vehiculos/nuevo", label: "Publicar vehículo", write: true },
  { href: "/proveedor/negociaciones", label: "Negociaciones", write: false },
  { href: "/proveedor/equipo", label: "Equipo", write: false },
  { href: "/proveedor/sucursales", label: "Sucursales", write: false },
];

export function SupplierShell({
  supplierName,
  fullName,
  initials,
  canWrite,
  children,
}: {
  supplierName: string;
  fullName: string;
  initials: string;
  canWrite: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const logout = async () => {
    const response = await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
    const data = (await response?.json().catch(() => null)) as { redirectTo?: string } | null;
    window.location.assign(data?.redirectTo ?? "/login");
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-[var(--fm-navy)] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/proveedor" className="flex items-center gap-2.5">
            <Image src="/assets/img/finmotor-logo-vector-lime.svg" alt="Finmotor" width={875} height={184}
              priority unoptimized className="h-[20px] w-auto" />
            <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fm-lime)]">
              Proveedores
            </span>
          </Link>
          <nav className="flex flex-1 gap-1">
            {NAV.filter((item) => canWrite || !item.write).map((item) => {
              const active = item.href === "/proveedor"
                ? pathname === "/proveedor" || (pathname.startsWith("/proveedor/vehiculos/") && !pathname.endsWith("/nuevo"))
                : pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className={clsx("rounded-lg px-3 py-1.5 text-[13px]",
                    active ? "bg-white/10 font-semibold text-white" : "text-white/60 hover:text-white")}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--fm-lime)]/15 text-[11px] font-bold text-[var(--fm-lime)]">
              {initials}
            </span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-[12px] font-semibold">{fullName}</span>
              <span className="block text-[10px] text-white/50">{supplierName}</span>
            </span>
            <button onClick={logout} title="Cerrar sesión" className="grid h-8 w-8 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
