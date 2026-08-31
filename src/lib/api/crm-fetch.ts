"use client";

import { toast } from "sonner";

type CrmFetchCode = "SESSION_EXPIRED" | "CRM_BACKEND_UNAVAILABLE";

export class CrmFetchError extends Error {
  constructor(
    message: string,
    readonly code: CrmFetchCode,
  ) {
    super(message);
    this.name = "CrmFetchError";
  }
}

let refreshPromise: Promise<Response> | null = null;

/** Fetch autenticado del navegador: renueva una vez y sólo repite operaciones rechazadas con 401. */
export async function crmFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (!isSessionResponse(response)) return response;

  const refresh = await refreshOnce();
  if (refresh.ok) {
    const retried = await fetch(input, init);
    if (!isSessionResponse(retried)) return retried;
  } else if (refresh.status === 503) {
    throw new CrmFetchError(
      "No pudimos conectar con Finmotor. Inténtalo nuevamente.",
      "CRM_BACKEND_UNAVAILABLE",
    );
  }

  showExpiredSession();
  throw new CrmFetchError(
    "Tu sesión expiró. Vuelve a iniciar sesión; conservamos lo que preparaste.",
    "SESSION_EXPIRED",
  );
}

/** Evita un segundo toast cuando `crmFetch` ya mostró el reingreso por sesión expirada. */
export function crmErrorMessage(error: unknown, fallback: string): string | null {
  if (error instanceof CrmFetchError) {
    return error.code === "SESSION_EXPIRED" ? null : error.message;
  }
  return fallback;
}

function isSessionResponse(response: Response): boolean {
  if (response.status === 401) return true;
  if (response.redirected && new URL(response.url).pathname.startsWith("/login")) return true;
  return response.headers.get("content-type")?.includes("text/html") === true;
}

function refreshOnce(): Promise<Response> {
  if (!refreshPromise) {
    const refresh = () => fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
    // El backend rota el refresh token. El lock evita que dos pestañas intenten usar el mismo
    // token a la vez; la segunda tomará la cookie nueva cuando le llegue su turno.
    const locks = navigator.locks as unknown as {
      request(name: string, callback: () => Promise<Response>): Promise<Response>;
    };
    const request: Promise<Response> = "locks" in navigator
      ? locks.request("finmotor-crm-session-refresh", refresh)
      : refresh();
    const pending = request.finally(() => {
      refreshPromise = null;
    });
    refreshPromise = pending;
    return pending;
  }
  return refreshPromise;
}

function showExpiredSession(): void {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  toast.error("Tu sesión expiró. Conservamos lo que preparaste.", {
    id: "crm-session-expired",
    duration: Infinity,
    action: {
      label: "Iniciar sesión",
      onClick: () => window.location.assign(new URL(loginUrl, window.location.origin)),
    },
  });
}
