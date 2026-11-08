import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { passwordResetErrorMessage } from "@/lib/password-reset";

/**
 * Fija la contraseña con el token del enlace (invitación, primer ingreso o recuperación).
 * Proxy a FastAPI `POST /auth/password-reset/confirm`: un solo uso, cierra todas las sesiones
 * y avisa por correo. Devuelve el correo de la cuenta para entrar directo con la clave nueva.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string; newPassword?: string };
  const token = String(body.token || "").trim();
  const newPassword = String(body.newPassword || "");
  if (!token || !newPassword) {
    return NextResponse.json({ error: passwordResetErrorMessage("invalid_reset_token") }, { status: 400 });
  }

  const upstream = await apiFetch("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({ token, newPassword, app: "crm" }),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: passwordResetErrorMessage(data?.detail), code: data?.detail ?? null },
      { status: upstream.status === 422 ? 422 : 400 },
    );
  }
  return NextResponse.json(
    { ok: true, email: data?.email ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
