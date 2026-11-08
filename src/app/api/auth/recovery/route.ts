import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";

/**
 * "Olvidé mi contraseña" del CRM: proxy a FastAPI `POST /auth/password-reset/request` con
 * `app: "crm"`, para que el enlace del correo apunte a `/restablecer-clave` de este panel.
 * El backend responde igual exista o no la cuenta y limita los envíos por cuenta.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Ingresa tu correo" }, { status: 400 });
  }

  const upstream = await apiFetch("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email, app: "crm" }),
  });
  if (upstream.status >= 500) {
    return NextResponse.json(
      { error: "No pudimos enviar el correo en este momento. Inténtalo en unos minutos." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
