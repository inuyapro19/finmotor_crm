/**
 * Sesión del CRM: identidad, automotora activa y rol del negocio.
 *
 * REGLA DE ACCESO (la razón de existir de este frontend): al CRM entran **sólo automotoras**.
 * No basta con que el backend acepte la sesión — `require_backoffice_access` también deja
 * pasar al superadmin de Finmotor y a la financiera matriz, que tienen su propia consola en
 * `admin.finmotor.cl`. Aquí se exige, además, **al menos una membresía activa en una
 * organización `type = 'dealership'`**. Sin eso no hay CRM que mostrar.
 *
 * El backend entrega todo lo necesario en `GET /backoffice/scope` (ver
 * `app/modules/backoffice/application/scope.py::build_scope_payload`).
 */
import { cache } from "react";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { BackendError, backendJson, backendJsonOrNull } from "@/lib/api/client";
import { canSeeAllLeads, toCrmRole, type CrmRole } from "@/lib/auth/roles";

// Reexportados por comodidad para los server components; los componentes cliente deben
// importarlos desde `@/lib/auth/roles` (este módulo usa `next/headers`).
export {
  toCrmRole,
  CRM_ROLE_LABEL,
  canManageTeam,
  canManageTransfers,
  canSeeAllLeads,
  canWrite,
  isDealershipAdmin,
} from "@/lib/auth/roles";
export type { CrmRole } from "@/lib/auth/roles";

export const DEALERSHIP_TYPE = "dealership";

export type Dealership = {
  id: string;
  name: string;
  /** Rol técnico crudo de `organization_members.role`. */
  memberRole: string;
  role: CrmRole;
};

export type CrmSession = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  initials: string;
  /** Automotora activa (la primera membresía dealership activa). */
  dealership: Dealership;
  /** Todas las automotoras del usuario — un dueño puede tener más de un local. */
  dealerships: Dealership[];
  role: CrmRole;
  /** El usuario es además superadmin de plataforma. Se registra, pero NO da acceso por sí solo. */
  isPlatformAdmin: boolean;
  scopedSellerIds: string[];
  /**
   * El backend sólo le entrega los leads asignados a él (agente de ventas). Es la regla
   * REAL de autorización, resuelta en `resolve_backoffice_scope`; aquí se usa sólo para los
   * textos y los filtros de la interfaz.
   */
  portfolioRestricted: boolean;
};

type BackendMembership = {
  id: string;
  role: string;
  isActive: boolean;
  organization: { id: string; name: string | null; type: string | null } | null;
};

type BackendScope = {
  userId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  isSuperAdmin: boolean;
  profile: string;
  memberships: BackendMembership[];
  scopedOrgIds: string[];
  scopedSellerIds: string[];
  portfolioRestricted?: boolean;
};

function buildName(first: string | null, last: string | null, email: string | null): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email || "Usuario";
}

function buildInitials(first: string | null, last: string | null, email: string | null): string {
  const a = first?.trim()?.[0] || email?.trim()?.[0] || "A";
  const b = last?.trim()?.[0] || "";
  return (a + b).toUpperCase();
}

/**
 * Sesión del CRM, o `null` si no hay sesión **o** el usuario no pertenece a ninguna
 * automotora. Cacheada por request (`react.cache`) para no repetir la llamada al backend
 * entre el layout y las páginas.
 */
export const getCrmSession = cache(_getCrmSession);

/**
 * Sesión garantizada para páginas del grupo `(app)`: si no hay, redirige al login.
 *
 * NO basta con el guard del layout. En el App Router el layout y la página se renderizan
 * **en paralelo**, así que el `redirect()` del layout no evita que la página ejecute su
 * propio código. Escribir `(await getCrmSession())!` en las páginas hacía que, con la sesión
 * expirada, la página reventara con un TypeError antes de que el redirect surtiera efecto.
 * `redirect()` lanza, por lo que TypeScript estrecha el tipo y aquí no hace falta ningún `!`.
 */
export async function requireCrmSession(): Promise<CrmSession> {
  const session = await getCrmSession();
  if (!session) redirect("/login");
  return session;
}

export type CrmApiSessionResult =
  | { ok: true; session: CrmSession }
  | { ok: false; response: NextResponse };

/** Guard para route handlers: una API nunca debe redirigir `fetch` al HTML del login. */
export async function requireCrmApiSession(): Promise<CrmApiSessionResult> {
  let data: { ok: boolean; scope: BackendScope };
  try {
    data = await backendJson<{ ok: boolean; scope: BackendScope }>("/backoffice/scope");
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 503;
    if (status === 401) {
      return apiSessionError(401, "SESSION_EXPIRED", "Tu sesión expiró. Vuelve a iniciar sesión.");
    }
    if (status === 403) {
      return apiSessionError(403, "CRM_ACCESS_DENIED", "Tu cuenta no tiene acceso al CRM.");
    }
    return apiSessionError(
      status === 503 ? 503 : 502,
      "CRM_BACKEND_UNAVAILABLE",
      "No pudimos conectar con Finmotor. Inténtalo nuevamente.",
    );
  }

  const session = buildCrmSession(data.scope);
  if (!session) {
    return apiSessionError(403, "CRM_ACCESS_DENIED", "Tu cuenta no tiene acceso al CRM.");
  }
  return { ok: true, session };
}

function apiSessionError(status: number, code: string, error: string): CrmApiSessionResult {
  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, code, error },
      { status, headers: { "Cache-Control": "no-store" } },
    ),
  };
}

async function _getCrmSession(): Promise<CrmSession | null> {
  const data = await backendJsonOrNull<{ ok: boolean; scope: BackendScope }>("/backoffice/scope");
  return buildCrmSession(data?.scope);
}

function buildCrmSession(scope: BackendScope | undefined): CrmSession | null {
  if (!scope?.userId) return null;

  const dealerships: Dealership[] = (scope.memberships || [])
    .filter((m) => m.isActive && m.organization?.type === DEALERSHIP_TYPE && m.organization?.id)
    .map((m) => ({
      id: m.organization!.id,
      name: m.organization!.name || "Automotora",
      memberRole: m.role,
      role: toCrmRole(m.role),
    }));

  // Guard: sin automotora no hay acceso, aunque el backend haya aceptado la sesión.
  if (dealerships.length === 0) return null;

  const active = dealerships[0];
  return {
    userId: scope.userId,
    email: scope.email,
    firstName: scope.firstName,
    lastName: scope.lastName,
    fullName: buildName(scope.firstName, scope.lastName, scope.email),
    initials: buildInitials(scope.firstName, scope.lastName, scope.email),
    dealership: active,
    dealerships,
    role: active.role,
    isPlatformAdmin: Boolean(scope.isSuperAdmin),
    scopedSellerIds: scope.scopedSellerIds || [],
    // Si un backend antiguo no lo informa, se deduce del rol para no abrir por defecto.
    portfolioRestricted:
      scope.portfolioRestricted ?? !canSeeAllLeads(active.role),
  };
}
