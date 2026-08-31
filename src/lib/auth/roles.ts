/**
 * Roles del CRM — helpers PUROS, sin dependencias de servidor.
 *
 * Vive separado de `session.ts` a propósito: ese módulo usa `next/headers` (cookies) y por
 * tanto no puede importarse desde un componente cliente. El shell y cualquier componente
 * "use client" importan desde aquí.
 */

/** Rol del negocio, tal como lo nombra la automotora. Deriva del rol técnico de la membresía. */
export type CrmRole = "admin" | "supervisor" | "agent" | "viewer";

/**
 * Traduce el rol técnico de `organization_members.role` al rol del negocio.
 *
 * owner/admin → Administrador · manager → Supervisor · salesperson y operadores → Agente ·
 * viewer → Sólo lectura. La lista cubre TODO el vocabulario cerrado del backend
 * (`routers/team.py::_ASSIGNABLE_ROLES`) a propósito: un rol que no está en esa lista es un
 * dato inesperado (typo, migración a medias, rol nuevo sin mapear todavía), y debe caer a
 * "viewer" — la variante que NO escribe — en vez de a "agent", que sí. Antes cualquier valor
 * no reconocido caía en "agent" por defecto: fail-open, no fail-closed.
 */
export function toCrmRole(memberRole: string): CrmRole {
  const role = (memberRole || "").toLowerCase();
  if (role === "owner" || role === "admin") return "admin";
  if (role === "manager") return "supervisor";
  if (role === "salesperson" || role === "finance_operator" || role === "transfer_operator") return "agent";
  if (role === "viewer") return "viewer";
  return "viewer";
}

export const CRM_ROLE_LABEL: Record<CrmRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  agent: "Agente de ventas",
  viewer: "Sólo lectura",
};

/** Puede administrar el equipo, reasignar leads y ver la cartera completa. */
export function canManageTeam(role: CrmRole): boolean {
  return role === "admin" || role === "supervisor";
}

/** Ve la cartera de toda la automotora. Un agente ve sólo lo suyo. */
export function canSeeAllLeads(role: CrmRole): boolean {
  return role === "admin" || role === "supervisor" || role === "viewer";
}

export function canWrite(role: CrmRole): boolean {
  return role !== "viewer";
}

/** Roles técnicos autorizados para iniciar y operar transferencias de dominio. */
export function canManageTransfers(memberRole: string): boolean {
  return ["owner", "admin", "manager", "transfer_operator"].includes(
    (memberRole || "").toLowerCase(),
  );
}

/**
 * Sólo el **administrador de la automotora** (`owner`/`admin`) puede ELIMINAR: unidades del
 * stock, solicitudes y miembros del equipo. El supervisor gestiona, edita y reasigna; borrar
 * es otra cosa y no se delega.
 *
 * Es una regla de interfaz: la autorización real la aplica el backend
 * (`only_dealership_admin_can_delete`). Aquí sólo se evita mostrar un botón que fallaría.
 */
export function isDealershipAdmin(role: CrmRole): boolean {
  return role === "admin";
}
