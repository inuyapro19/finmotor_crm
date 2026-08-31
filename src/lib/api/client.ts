/**
 * Cliente BFF del CRM de automotoras: puente entre los route handlers / server components
 * de Next.js y el backend FastAPI (`/api/v1`).
 *
 * Mismo CONTRATO que `frontend-backoffice/src/lib/api/client.ts` y que el BFF de
 * `frontend-web` (gate de aplicación `X-Finmotor-Service-Key`, cookies httpOnly de acceso
 * ~60 min + refresh ~30 días), pero con NOMBRES DE COOKIE PROPIOS (`fm-crm-access` /
 * `fm-crm-refresh`) a propósito: las tres apps corren sobre el mismo host `localhost` en
 * desarrollo (solo cambia el puerto, que las cookies HTTP no distinguen — RFC 6265), así
 * que compartir el nombre haría que loguearse en el CRM autenticara silenciosamente al
 * staff de una automotora como comprador en el marketplace público, y viceversa. En
 * producción los hosts ya difieren (`crm.finmotor.cl` vs `finmotor.cl`), pero el nombre
 * distinto es defensa en profundidad y evita esta clase de bug en cualquier entorno.
 *
 * El navegador NUNCA ve el token: las páginas son server components que llaman a
 * `backendJson`, y las mutaciones del cliente pasan por route handlers de `src/app/api`.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requiredServerEnv } from "@/lib/env";

export const BACKEND_API_URL = requiredServerEnv(
  "BACKEND_API_URL",
  process.env.BACKEND_API_URL,
  "http://localhost:8098",
);
const SERVICE_KEY = requiredServerEnv("FINMOTOR_SERVICE_KEY", process.env.FINMOTOR_SERVICE_KEY);

export const ACCESS_COOKIE = "fm-crm-access";
export const REFRESH_COOKIE = "fm-crm-refresh";

type ApiInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>;
  /** true = usa el Bearer de la cookie fm-crm-access; string = usa ese token. */
  auth?: boolean | string;
  /** true = llama con el secreto interno (X-Finmotor-Backend-Secret), sin usuario. */
  internal?: boolean;
};

export async function apiFetch(path: string, init: ApiInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "X-Finmotor-Service-Key": SERVICE_KEY,
    ...(init.headers || {}),
  };
  if (init.body && typeof init.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (init.internal) {
    headers["X-Finmotor-Backend-Secret"] = requiredServerEnv(
      "FINMOTOR_BACKEND_SECRET",
      process.env.FINMOTOR_BACKEND_SECRET,
    );
  } else {
    let token: string | null = null;
    if (init.auth === true) token = await getAccessToken();
    else if (typeof init.auth === "string") token = init.auth;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    return await fetch(`${BACKEND_API_URL}/api/v1${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    // Backend caído o inalcanzable: se normaliza a un 503 con cuerpo JSON para que los
    // route handlers y `backendJson` lo traten como cualquier otro error del backend en vez
    // de reventar la página con una excepción de red.
    return new Response(JSON.stringify({ detail: "backend_unreachable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

export function setSessionCookies(res: NextResponse, accessToken: string, refreshToken: string): void {
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
  res.cookies.set(ACCESS_COOKIE, accessToken, { ...base, maxAge: 60 * 60 });
  res.cookies.set(REFRESH_COOKIE, refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 });
}

export function clearSessionCookies(res: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  const base = { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: 0 };
  res.cookies.set(ACCESS_COOKIE, "", base);
  res.cookies.set(REFRESH_COOKIE, "", base);
}

export class BackendError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "BackendError";
  }
}

/** Llamada autenticada que devuelve el JSON parseado. Lanza `BackendError` si no es 2xx. */
export async function backendJson<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await apiFetch(path, { auth: true, ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // FastAPI devuelve `detail` como string en los errores de dominio, pero como LISTA de
    // objetos en los 422 de validación. Serializar sin distinguir produce "[object Object]"
    // y hace imposible diagnosticar el fallo.
    const raw = (data as { detail?: unknown })?.detail ?? (data as { error?: unknown })?.error;
    const detail =
      typeof raw === "string"
        ? raw
        : raw
          ? JSON.stringify(raw)
          : `backend_error_${res.status}`;
    throw new BackendError(res.status, detail);
  }
  return data as T;
}

/**
 * Igual que `backendJson` pero devuelve `null` (en vez de lanzar) ante 401/403/404 y ante
 * 503 (backend inalcanzable). Esto último hace que una caída del backend se traduzca en
 * "sin sesión" → redirección al login, en lugar de una pantalla de error.
 */
export async function backendJsonOrNull<T = unknown>(path: string, init: ApiInit = {}): Promise<T | null> {
  try {
    return await backendJson<T>(path, init);
  } catch (err) {
    if (err instanceof BackendError && [401, 403, 404, 503].includes(err.status)) return null;
    throw err;
  }
}
