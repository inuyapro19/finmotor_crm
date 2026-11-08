import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";

/** ¿El enlace sigue vigente? Proxy a FastAPI `POST /auth/password-reset/verify` (no lo consume). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token || "").trim();
  if (!token) return NextResponse.json({ ok: true, valid: false });

  const upstream = await apiFetch("/auth/password-reset/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return NextResponse.json({ ok: true, valid: false });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
