/**
 * Sesión del portal del PROVEEDOR MAYORISTA (`/proveedor`).
 *
 * El proveedor comparte login y cookies con el CRM, pero NO es una automotora: no pasa
 * `require_backoffice_access` y por eso no tiene `CrmSession`. Su identidad la entrega
 * `GET /wholesale/supplier/me` (guard `require_wholesale_supplier_access`), que exige una
 * membresía activa en una organización `type = 'wholesale_supplier'`.
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { BackendError, backendJson, backendJsonOrNull } from "@/lib/api/client";

export type Supplier = {
  id: string;
  name: string;
  rut: string | null;
  role: string;
  canWrite: boolean;
  /** owner/admin/manager: administra equipo y sucursales. */
  canManage: boolean;
  /** Identificador del enlace compartido /mayorista?proveedor=<slug>. */
  slug?: string | null;
  locationId: string | null;
  locationName: string | null;
};

export type SupplierSession = {
  userId: string;
  email: string | null;
  fullName: string;
  initials: string;
  supplier: Supplier;
  suppliers: Supplier[];
  canWrite: boolean;
  canManage: boolean;
};

type SupplierMe = {
  userId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  suppliers: Supplier[];
};

function build(me: SupplierMe | null | undefined): SupplierSession | null {
  if (!me?.userId || !me.suppliers?.length) return null;
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ").trim() || me.email || "Usuario";
  const initials = ((me.firstName?.[0] || me.email?.[0] || "P") + (me.lastName?.[0] || "")).toUpperCase();
  const active = me.suppliers[0];
  return {
    userId: me.userId,
    email: me.email,
    fullName: name,
    initials,
    supplier: active,
    suppliers: me.suppliers,
    canWrite: active.canWrite,
    canManage: Boolean(active.canManage),
  };
}

export const getSupplierSession = cache(async (): Promise<SupplierSession | null> => {
  return build(await backendJsonOrNull<SupplierMe>("/wholesale/supplier/me"));
});

export async function requireSupplierSession(): Promise<SupplierSession> {
  const session = await getSupplierSession();
  if (!session) redirect("/login");
  return session;
}

export type SupplierApiSessionResult =
  | { ok: true; session: SupplierSession }
  | { ok: false; response: NextResponse };

/** Guard para route handlers: responde JSON, nunca redirige un `fetch` al HTML del login. */
export async function requireSupplierApiSession(): Promise<SupplierApiSessionResult> {
  try {
    const session = build(await backendJson<SupplierMe>("/wholesale/supplier/me"));
    if (session) return { ok: true, session };
    return fail(403, "SUPPLIER_ACCESS_DENIED", "Tu cuenta no pertenece a un proveedor.");
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    if (status === 401) return fail(401, "SESSION_EXPIRED", "Tu sesión expiró. Vuelve a iniciar sesión.");
    if (status === 403) return fail(403, "SUPPLIER_ACCESS_DENIED", "Tu cuenta no pertenece a un proveedor.");
    return fail(503, "CRM_BACKEND_UNAVAILABLE", "No pudimos conectar con Finmotor. Inténtalo nuevamente.");
  }
}

function fail(status: number, code: string, error: string): SupplierApiSessionResult {
  return {
    ok: false,
    response: NextResponse.json({ ok: false, code, error }, { status, headers: { "Cache-Control": "no-store" } }),
  };
}
