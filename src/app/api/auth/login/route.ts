import { NextResponse } from "next/server";
import { apiFetch, setSessionCookies } from "@/lib/api/client";
import { DEALERSHIP_TYPE } from "@/lib/auth/session";

/**
 * POST /api/auth/login — inicia sesión contra FastAPI y, ANTES de dejar cookies, verifica
 * que la cuenta pertenezca a una automotora.
 *
 * El backend (`require_backoffice_access`) también deja pasar al superadmin de Finmotor y a
 * la financiera matriz; ellos tienen su consola en admin.finmotor.cl. Este panel es sólo
 * para automotoras, así que se exige una membresía **activa** en una organización
 * `type = 'dealership'`. Si no la hay, no se setea sesión.
 */
type ScopeMembership = {
  isActive?: boolean;
  organization?: { id?: string; type?: string | null } | null;
};

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  const password = body.password || "";
  if (!email || !password) {
    return NextResponse.json({ error: "Ingresa tu correo y tu contraseña" }, { status: 400 });
  }

  const upstream = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await upstream.json().catch(() => ({}));

  if (upstream.status === 503) {
    return NextResponse.json(
      { error: "No pudimos conectar con Finmotor. Inténtalo en unos minutos." },
      { status: 503 },
    );
  }

  // Contraseña temporal de una invitación: el backend no abre sesión y entrega un token de un
  // solo uso (15 min) para crear la definitiva en /restablecer-clave.
  if (upstream.status === 403 && data?.detail === "password_change_required" && data?.resetToken) {
    return NextResponse.json(
      { passwordChangeRequired: true, resetToken: data.resetToken },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  // Automotora auto-registrada en finmotor.cl que aún no confirma su correo.
  if (upstream.status === 403 && data?.detail === "email_not_verified") {
    return NextResponse.json(
      {
        error:
          "Confirma tu correo para entrar: te enviamos un enlace al registrar tu automotora. Si no lo encuentras, pide uno nuevo en finmotor.cl/login.",
      },
      { status: 403 },
    );
  }
  if (data?.detail === "temp_password_expired") {
    return NextResponse.json(
      {
        error:
          "Tu contraseña temporal caducó. Usa «¿Olvidaste tu contraseña?» o pide a tu administrador que te invite de nuevo.",
      },
      { status: 401 },
    );
  }

  if (!upstream.ok || !data?.accessToken || !data?.refreshToken) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: upstream.status || 401 },
    );
  }

  const scopeRes = await apiFetch("/backoffice/scope", { auth: data.accessToken });
  let hasDealership = false;
  if (scopeRes.ok) {
    const scopeData = await scopeRes.json().catch(() => ({}));
    const memberships: ScopeMembership[] = scopeData?.scope?.memberships ?? [];
    hasDealership = memberships.some(
      (m) => m.isActive && m.organization?.type === DEALERSHIP_TYPE && m.organization?.id,
    );
  }

  // Proveedor mayorista: no es automotora, pero opera su portal en /proveedor de este CRM.
  let home = process.env.FINMOTOR_DEMO_MODE === "true" ? "/demo/marketplace" : "/";
  if (!hasDealership) {
    const supplierRes = await apiFetch("/wholesale/supplier/me", { auth: data.accessToken });
    const supplierData = supplierRes.ok ? await supplierRes.json().catch(() => ({})) : {};
    if (!(supplierData?.suppliers?.length > 0)) {
      return NextResponse.json(
        {
          error:
            "Este panel es exclusivo para automotoras y proveedores Finmotor. Si eres del equipo Finmotor, ingresa por admin.finmotor.cl.",
        },
        { status: 403 },
      );
    }
    home = "/proveedor";
  }

  const res = NextResponse.json({ ok: true, home });
  setSessionCookies(res, data.accessToken, data.refreshToken);
  return res;
}
