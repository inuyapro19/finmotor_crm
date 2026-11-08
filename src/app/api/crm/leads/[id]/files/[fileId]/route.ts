import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";

const ERROR_MAP: Record<string, string> = {
  lead_out_of_scope: "Esta solicitud no pertenece a tu automotora",
  lead_not_assigned_to_you: "Esta solicitud está en la cartera de otro agente",
  insufficient_org_role: "Tu cuenta es de sólo lectura",
  document_not_found: "Ese documento ya no existe",
};

/** DELETE /api/crm/leads/{id}/files/{fileId} — elimina un documento de la carpeta del lead. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id, fileId } = await params;
  const upstream = await apiFetch(`/backoffice/leads/${id}/files/${fileId}`, { method: "DELETE", auth: true });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(
      { error: ERROR_MAP[String(data?.detail)] || "No pudimos eliminar el documento" },
      { status: upstream.status },
    );
  }
  return NextResponse.json({ ok: true });
}
