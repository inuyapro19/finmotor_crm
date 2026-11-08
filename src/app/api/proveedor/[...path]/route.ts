import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { forwardWholesale } from "@/lib/api/wholesale-proxy";
import { requireSupplierApiSession } from "@/lib/auth/supplier-session";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * BFF del portal del proveedor: `/api/proveedor/*` → `/wholesale/supplier/*`.
 *
 * Excepciones:
 * - `storage/sign` firma la subida directa a MinIO forzando el bucket PRIVADO y el scope
 *   `wholesale`, para que el navegador no pueda elegir dónde escribe.
 * - `plate/{patente}` consulta los datos técnicos por patente para autollenar la ficha.
 */
async function handle(request: Request, { params }: Ctx) {
  const auth = await requireSupplierApiSession();
  if (!auth.ok) return auth.response;
  const { path } = await params;
  const writes = request.method !== "GET";
  if (writes && !auth.session.canWrite) {
    return NextResponse.json({ error: "Tu cuenta del proveedor es de sólo lectura." }, { status: 403 });
  }

  // Autollenado por patente (mismo servicio que el stock de la automotora y /publicar).
  if (path.length === 2 && path[0] === "plate" && request.method === "GET") {
    const plate = path[1].replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (plate.length < 5 || plate.length > 8) {
      return NextResponse.json({ error: "Ingresa una patente válida." }, { status: 400 });
    }
    const upstream = await apiFetch(`/vehicles/plate/${encodeURIComponent(plate)}`, { auth: true });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  if (path.join("/") === "storage/sign") {
    const body = (await request.json().catch(() => null)) as { filename?: string; contentType?: string } | null;
    if (!body?.filename) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    const upstream = await apiFetch("/storage/uploads/sign", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        bucket: "vehicle-documents",
        scope: "wholesale",
        filename: body.filename,
        contentType: body.contentType,
      }),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  return forwardWholesale(request, "/wholesale/supplier", path);
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
