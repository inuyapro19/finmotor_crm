import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/api/client";
import { wholesaleError } from "@/lib/wholesale";

/** Segmentos permitidos en la ruta reenviada: ids, códigos y verbos. Nada de `..` ni `/`. */
const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Reenvía la petición del navegador al backend bajo `base` (`/wholesale/supplier` o
 * `/wholesale/market`) con el Bearer de la cookie. La autorización real la aplica FastAPI;
 * aquí sólo se valida la forma de la ruta y se traduce el `detail` a un mensaje.
 */
export async function forwardWholesale(request: Request, base: string, path: string[]): Promise<Response> {
  if (!path.length || !path.every((segment) => SEGMENT.test(segment))) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }
  const search = new URL(request.url).search;
  const method = request.method.toUpperCase();
  let body: string | undefined;
  if (method !== "GET" && method !== "DELETE") {
    const parsed = await request.json().catch(() => ({}));
    body = JSON.stringify(parsed ?? {});
  }
  const upstream = await apiFetch(`${base}/${path.join("/")}${search}`, { method, auth: true, body });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const detail = (data as { detail?: unknown })?.detail;
    return NextResponse.json(
      { error: wholesaleError(detail), detail: typeof detail === "string" ? detail : undefined },
      { status: upstream.status },
    );
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
