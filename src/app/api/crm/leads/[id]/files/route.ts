import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const ERROR_MAP: Record<string, string> = {
  lead_out_of_scope: "Esta solicitud no pertenece a tu automotora",
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  insufficient_org_role: "Tu cuenta es de sólo lectura",
  invalid_document_type: "Ese tipo de documento no existe",
  unsupported_file_type: "Usa un PDF o una imagen JPG, PNG o WebP",
  empty_file: "El archivo está vacío",
  file_too_large: "El archivo no puede superar 15 MB",
  storage_unavailable: "No pudimos guardar el archivo. Inténtalo de nuevo",
  document_not_found: "Ese documento ya no existe",
};

/** GET /api/crm/leads/{id}/files — carpeta del lead con URLs firmadas frescas. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/files`, { auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos cargar los documentos" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, catalog: data?.catalog ?? [], documents: data?.documents ?? [] });
}

/** POST /api/crm/leads/{id}/files — sube un documento (multipart: file + documentType + notes?). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const incoming = await request.formData().catch(() => null);
  const file = incoming?.get("file");
  const documentType = String(incoming?.get("documentType") ?? "");
  if (!(file instanceof File) || !documentType) {
    return NextResponse.json({ error: "Elige el documento y el tipo" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: ERROR_MAP.unsupported_file_type }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: ERROR_MAP.file_too_large }, { status: 413 });
  }

  const body = new FormData();
  body.set("file", file, file.name);
  body.set("documentType", documentType);
  const notes = String(incoming?.get("notes") ?? "").trim();
  if (notes) body.set("notes", notes);

  const { id } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/files`, { method: "POST", auth: true, body });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos subir el documento" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true, document: data?.document ?? null }, { status: 201 });
}
