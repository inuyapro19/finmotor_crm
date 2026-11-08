"use client";

import { crmFetch } from "@/lib/api/crm-fetch";
import { compressImage } from "@/lib/photos/upload";
import { directUploadHeaders } from "@/lib/storage/direct-upload";

/**
 * Sube un archivo del proveedor al bucket PRIVADO (`vehicle-documents/wholesale/{user}/…`)
 * con PUT presignado y devuelve la key. El servidor fuerza bucket y scope; después la key se
 * registra en la ficha, y el backend verifica que sea una subida del propio usuario.
 */
export async function uploadPrivate(file: File, { image }: { image: boolean }): Promise<string> {
  const prepared = image ? await compressImage(file) : file;
  const extension = prepared.name.split(".").pop()?.toLowerCase() || (image ? "jpg" : "pdf");
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const sign = await crmFetch("/api/proveedor/storage/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, contentType: prepared.type }),
  });
  const signed = await sign.json().catch(() => ({}));
  if (!sign.ok || !signed?.url || !signed?.key) throw new Error(signed?.error || "No se pudo preparar la subida");
  const put = await fetch(signed.url, {
    method: "PUT",
    headers: directUploadHeaders(signed.url, prepared.type || "application/octet-stream"),
    body: prepared,
  }).catch(() => null);
  if (!put?.ok) throw new Error("No se pudo subir el archivo. Revisa tu conexión.");
  return String(signed.key);
}

/** POST/PATCH/PUT/DELETE JSON contra el BFF; lanza Error con el mensaje ya traducido. */
export async function wholesaleRequest<T = Record<string, unknown>>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE" | "GET",
  body?: unknown,
): Promise<T> {
  const response = await crmFetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string })?.error || "No pudimos completar la operación.");
  return data as T;
}
