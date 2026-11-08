import { NextResponse, type NextRequest } from "next/server";
import { requiredServerEnv } from "@/lib/env";

/**
 * Middleware del CRM (en Next.js 16 el archivo se llama `proxy.ts`, no `middleware.ts`).
 *
 * Renueva la sesión ANTES de renderizar. El access token dura ~60 min; sin esto, un agente
 * que deja el CRM abierto media jornada es expulsado al login en medio de una llamada —y las
 * páginas, que se renderizan en paralelo con el layout, revientan al quedarse sin sesión.
 *
 * `POST /auth/refresh` del backend **rota** el refresh token (revoca el usado y emite uno
 * nuevo). Por eso sólo se refresca en peticiones de navegación de documento: si se hiciera en
 * cada asset paralelo, dos refrescos simultáneos competirían y uno invalidaría al otro.
 */
// Nombres propios del CRM (no "fm-access"/"fm-refresh"): evita que la sesión colisione con
// frontend-web/frontend-backoffice en localhost, donde el puerto no aísla cookies (ver
// el comentario en src/lib/api/client.ts).
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";

/** Margen para renovar antes de que el token expire de verdad. */
const EXPIRY_SKEW_SECONDS = 60;

const BACKEND_API_URL = requiredServerEnv(
  "BACKEND_API_URL",
  process.env.BACKEND_API_URL,
  "http://localhost:8098",
);
const SERVICE_KEY = requiredServerEnv("FINMOTOR_SERVICE_KEY", process.env.FINMOTOR_SERVICE_KEY);

/**
 * Lee `exp` del JWT sin verificar la firma — la verificación real ocurre en FastAPI; aquí
 * sólo se decide si conviene renovar. Devuelve `true` si falta poco o ya expiró.
 */
function needsRefresh(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const part = token.split(".")[1];
    if (!part) return true;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 - EXPIRY_SKEW_SECONDS * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function setSessionCookies(res: NextResponse, accessToken: string, refreshToken: string): void {
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...base, maxAge: 60 * 60 });
  res.cookies.set(REFRESH_COOKIE, refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login y recuperación de contraseña son pantallas sin sesión: no tiene sentido renovar allí.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/recuperar-clave") ||
    pathname.startsWith("/restablecer-clave") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  // Enlace compartido del marketplace mayorista (p. ej. /mayorista?proveedor=…) abierto sin
  // sesión: al login con returnTo, para volver al mismo stock filtrado después de entrar.
  if (
    !access && !refresh && pathname.startsWith("/mayorista") && request.method === "GET" &&
    request.headers.get("sec-fetch-dest") === "document"
  ) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  if (!needsRefresh(access)) return NextResponse.next();

  // Sin refresh no hay nada que renovar: que el guard del layout mande al login.
  if (!refresh) return NextResponse.next();

  // Solo una navegacion GET real puede rotar el token. RSC/fetch usan dest=empty y nunca
  // deben competir con la carga del documento.
  if (
    request.method !== "GET" ||
    request.headers.get("sec-fetch-mode") !== "navigate" ||
    request.headers.get("sec-fetch-dest") !== "document"
  ) {
    return NextResponse.next();
  }

  try {
    const upstream = await fetch(`${BACKEND_API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Finmotor-Service-Key": SERVICE_KEY,
      },
      body: JSON.stringify({ refreshToken: refresh }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      // Refresh inválido o revocado: se limpian las cookies para que el guard redirija al
      // login en vez de reintentar en cada navegación.
      const res = NextResponse.next();
      res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
      res.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    const data = (await upstream.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken || !data.refreshToken) return NextResponse.next();

    // La request en curso debe ver YA el token nuevo: se reescriben las cookies de entrada
    // además de las de salida, o esta misma navegación se renderizaría sin sesión.
    const headers = new Headers(request.headers);
    const jar = request.cookies;
    jar.set(ACCESS_COOKIE, data.accessToken);
    jar.set(REFRESH_COOKIE, data.refreshToken);
    headers.set("cookie", jar.toString());

    const res = NextResponse.next({ request: { headers } });
    setSessionCookies(res, data.accessToken, data.refreshToken);
    return res;
  } catch {
    // El backend no responde: no se toca la sesión, el guard decidirá.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
