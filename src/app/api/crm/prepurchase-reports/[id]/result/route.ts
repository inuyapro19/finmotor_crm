import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { canWrite, requireCrmApiSession } from "@/lib/auth/session";


export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  if (!canWrite(auth.session.role)) {
    return NextResponse.json({ error: "Tu cuenta es de sólo lectura" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const upstream = await apiFetch(
    `/backoffice/prepurchase-reports/${encodeURIComponent(id)}/result`,
    { method: "POST", auth: true, body: JSON.stringify(body) },
  );
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const messages: Record<string, string> = {
      prepurchase_report_not_found: "La solicitud de precompra no existe",
      prepurchase_report_without_organization: "No pudimos identificar la automotora de la solicitud",
      storage_key_not_owned: "El archivo no pertenece a tu sesión",
      result_file_not_uploaded: "La carga del archivo no se completó",
      organization_out_of_scope: "La solicitud no pertenece a tu automotora",
    };
    return NextResponse.json(
      { error: messages[String(data?.detail)] || "No pudimos guardar el resultado" },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data);
}
