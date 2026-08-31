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

  if (!upstream.ok || !data?.accessToken || !data?.refreshToken) {
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: upstream.status || 401 },
    );
  }

  const scopeRes = await apiFetch("/backoffice/scope", { auth: data.accessToken });
  if (!scopeRes.ok) {
    return NextResponse.json(
      { error: "Tu cuenta no tiene acceso al CRM. Pídele a tu administrador que te invite." },
      { status: 403 },
    );
  }

  const scopeData = await scopeRes.json().catch(() => ({}));
  const memberships: ScopeMembership[] = scopeData?.scope?.memberships ?? [];
  const hasDealership = memberships.some(
    (m) => m.isActive && m.organization?.type === DEALERSHIP_TYPE && m.organization?.id,
  );

  if (!hasDealership) {
    return NextResponse.json(
      {
        error:
          "Este panel es exclusivo para automotoras. Si eres del equipo Finmotor, ingresa por admin.finmotor.cl.",
      },
      { status: 403 },
    );
  }

  const res = NextResponse.json({ ok: true });
  setSessionCookies(res, data.accessToken, data.refreshToken);
  return res;
}
