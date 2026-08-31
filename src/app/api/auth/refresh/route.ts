import { NextResponse } from "next/server";

import {
  apiFetch,
  clearSessionCookies,
  getRefreshToken,
  setSessionCookies,
} from "@/lib/api/client";

/** Renueva la sesión para una ficha abierta sin recargar ni perder formularios en curso. */
export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return expiredResponse();

  const upstream = await apiFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  const data = await upstream.json().catch(() => ({}));

  if (upstream.status === 503) {
    return NextResponse.json(
      { ok: false, code: "CRM_BACKEND_UNAVAILABLE", error: "No pudimos conectar con Finmotor." },
      { status: 503 },
    );
  }
  if (!upstream.ok || !data?.accessToken || !data?.refreshToken) return expiredResponse();

  const response = NextResponse.json({ ok: true });
  setSessionCookies(response, data.accessToken, data.refreshToken);
  return response;
}

function expiredResponse(): NextResponse {
  const response = NextResponse.json(
    { ok: false, code: "SESSION_EXPIRED", error: "Tu sesión expiró. Vuelve a iniciar sesión." },
    { status: 401 },
  );
  clearSessionCookies(response);
  return response;
}
