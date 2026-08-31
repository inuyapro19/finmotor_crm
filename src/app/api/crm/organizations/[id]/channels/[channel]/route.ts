import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

/**
 * PUT /api/crm/organizations/{id}/channels/{channel} — conecta un canal de publicación.
 * Las credenciales viajan al backend y nunca vuelven: la respuesta sólo dice si el canal
 * quedó conectado.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; channel: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador o el supervisor pueden conectar canales" },
      { status: 403 },
    );
  }
  const { id, channel } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/organizations/${id}/channels/${channel}`, {
    method: "PUT",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      unknown_channel: "Ese canal no está disponible",
      seller_identifier_required: "Necesitas el identificador de vendedor del canal para activarlo",
      insufficient_org_role: "No tienes permiso para conectar canales",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos guardar el canal" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, channel: data?.channel ?? null });
}
