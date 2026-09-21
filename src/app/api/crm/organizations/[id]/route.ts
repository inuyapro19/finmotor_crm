import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canManageTeam, requireCrmApiSession } from "@/lib/auth/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/organizations/${id}/logo`, {
    auth: true,
  });
  if (!upstream.ok) {
    return NextResponse.json(
      { error: upstream.status === 404 ? "La automotora no tiene logo" : "No pudimos cargar el logo" },
      { status: upstream.status },
    );
  }
  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "image/png",
      "Cache-Control": upstream.headers.get("Cache-Control") || "private, max-age=300",
    },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json({ error: "No tienes permisos para cambiar el logo" }, { status: 403 });
  }
  const incoming = await request.formData().catch(() => null);
  const file = incoming?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecciona una imagen" }, { status: 400 });
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Usa un archivo PNG, JPG o WebP" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "El logo no puede superar 2 MB" }, { status: 413 });
  }
  const body = new FormData();
  body.set("file", file, file.name);
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/organizations/${id}/logo`, {
    method: "PUT",
    auth: true,
    body,
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const errors: Record<string, string> = {
      organization_logo_empty: "La imagen está vacía",
      organization_logo_too_large: "El logo no puede superar 2 MB",
      organization_logo_invalid_type: "Usa un archivo PNG, JPG o WebP",
      organization_logo_upload_failed: "No pudimos guardar el logo",
      insufficient_org_role: "No tienes permiso para cambiar el logo",
    };
    return NextResponse.json(
      { error: errors[String(data?.detail)] || "No pudimos actualizar el logo" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, organization: data?.organization ?? null });
}

/** PATCH /api/crm/organizations/{id} — datos de la automotora (alimentan los contratos). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!canManageTeam(session.role)) {
    return NextResponse.json(
      { error: "Sólo el administrador o el supervisor pueden editar la automotora" },
      { status: 403 },
    );
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const upstream = await apiFetch(`/backoffice/organizations/${id}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const map: Record<string, string> = {
      insufficient_org_role: "No tienes permiso para editar esta automotora",
      organization_out_of_scope: "Esa automotora no es tuya",
      invalid_commission_pct: "La comisión debe estar entre 0 y 100",
      name_required: "El nombre no puede quedar vacío",
    };
    return NextResponse.json(
      { error: map[String(data?.detail)] || "No pudimos guardar los cambios" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, organization: data?.organization ?? null });
}
