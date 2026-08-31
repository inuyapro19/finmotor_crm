import { NextRequest, NextResponse } from "next/server";
import { apiFetch, setSessionCookies } from "@/lib/api/client";

function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?sso=invalid", request.url), 303);
  }

  const upstream = await apiFetch("/auth/sso/exchange", {
    method: "POST",
    body: JSON.stringify({ handoffCode: code }),
  });
  const data = (await upstream.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    returnTo?: string;
  };
  if (!upstream.ok || !data.accessToken || !data.refreshToken) {
    return NextResponse.redirect(new URL("/login?sso=failed", request.url), 303);
  }

  const response = NextResponse.redirect(
    new URL(
      safeReturnTo(data.returnTo),
      process.env.APP_URL ?? request.nextUrl.origin,
    ),
    303,
  );
  setSessionCookies(response, data.accessToken, data.refreshToken);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
