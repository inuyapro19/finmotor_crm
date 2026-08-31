import { NextResponse } from "next/server";
import { apiFetch, clearSessionCookies, getRefreshToken } from "@/lib/api/client";

/** Revoca la sesión CRM y entrega el logout encadenado de frontend-web. */
export async function POST() {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    await apiFetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  const webAppUrl = process.env.WEB_APP_URL ?? "http://localhost:3000";
  const res = NextResponse.json({
    ok: true,
    redirectTo: new URL("/api/auth/signout", webAppUrl).toString(),
  });
  clearSessionCookies(res);
  return res;
}
