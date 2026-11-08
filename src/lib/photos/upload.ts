import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { directUploadHeaders } from "@/lib/storage/direct-upload";

const MAX_SIZE_MB = 5;
const COMPRESS_MAX_DIMENSION = 1920;
const COMPRESS_QUALITY = 0.82;
const COMPRESS_TRIGGER_BYTES = 800 * 1024;

export const PHOTO_MAX = 10;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

export function isValidPhoto(file: File): string | null {
  if (!PHOTO_ACCEPT.split(",").includes(file.type)) return "Formato no soportado (usa JPG, PNG o WebP)";
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `Supera ${MAX_SIZE_MB}MB`;
  return null;
}

export async function compressImage(file: File): Promise<File> {
  // Chileautos sólo acepta JPG/JPEG. Conservamos un JPEG pequeño tal cual; PNG/WebP y
  // fotografías grandes se normalizan a JPEG antes de guardarlas en el inventario.
  if (file.type === "image/jpeg" && file.size <= COMPRESS_TRIGGER_BYTES) return file;
  if (typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = Object.assign(document.createElement("canvas"), { width, height });
    const context = canvas.getContext("2d");
    if (!context) return file;
    // JPEG no admite transparencia. Fondo blanco evita que un PNG transparente quede negro.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", COMPRESS_QUALITY),
    );
    if (!blob) return file;
    if (file.type === "image/jpeg" && blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function uploadOne(file: File): Promise<{ url: string; storagePath: string } | { error: string }> {
  try {
    const compressed = await compressImage(file);
    const extension = compressed.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const signResponse = await crmFetch("/api/crm/storage/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket: "vehicle-photos",
        scope: "vehicle-photos",
        filename,
        contentType: compressed.type,
      }),
    });
    const sign = await signResponse.json().catch(() => ({}));
    if (!signResponse.ok || !sign?.url || !sign?.key) return { error: sign?.detail || "No se pudo firmar la subida" };

    const upload = await fetch(sign.url, {
      method: "PUT",
      headers: directUploadHeaders(sign.url, compressed.type),
      body: compressed,
    }).catch(() => null);
    if (!upload?.ok) return { error: upload ? `Storage HTTP ${upload.status}` : "Falló la conexión con storage" };
    return { url: String(sign.url).split("?")[0], storagePath: String(sign.key) };
  } catch (error) {
    const message = crmErrorMessage(error, "No se pudo completar la subida de la foto");
    if (!message) throw error;
    return { error: message };
  }
}

/** Orden natural por nombre (IMG_2 antes que IMG_10): respeta la secuencia de la cámara. */
export function sortFilesByName(files: File[]): File[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" }));
}

/**
 * Sube y registra las fotos EN ESE ORDEN. Devuelve el id de cada foto registrada en la misma
 * posición que su archivo (null si falló), para luego guardar el orden final completo.
 */
export async function uploadAndRegisterPhotos(
  vehicleId: string,
  files: File[],
  startPosition = 0,
): Promise<{ ids: (string | null)[]; registered: number; errors: string[] }> {
  const ids: (string | null)[] = [];
  const errors: string[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    ids.push(null);
    const result = await uploadOne(file);
    if ("error" in result) {
      errors.push(`${file.name}: ${result.error}`);
      continue;
    }
    let response: Response;
    try {
      response = await crmFetch(`/api/crm/vehicles/${encodeURIComponent(vehicleId)}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          storagePath: result.storagePath,
          position: startPosition + index,
        }),
      });
    } catch (error) {
      const message = crmErrorMessage(error, "No se pudo contactar el servidor para registrar la foto");
      if (!message) throw error;
      errors.push(`${file.name}: ${message}`);
      continue;
    }
    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.photo?.id) ids[index] = String(data.photo.id);
    else errors.push(`${file.name}: no se pudo registrar`);
  }
  return { ids, registered: ids.filter(Boolean).length, errors };
}

/** Guarda el orden final de TODAS las fotos del vehículo; la primera queda como portada. */
export async function saveVehiclePhotoOrder(vehicleId: string, photoIds: string[]): Promise<string | null> {
  const response = await crmFetch(`/api/crm/vehicles/${encodeURIComponent(vehicleId)}/photos/order`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoIds }),
  });
  if (response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data?.error || "No pudimos guardar el orden de las fotos";
}

/** Quita una foto ya guardada del vehículo. */
export async function deleteVehiclePhoto(vehicleId: string, photoId: string): Promise<boolean> {
  const response = await crmFetch(
    `/api/crm/vehicles/${encodeURIComponent(vehicleId)}/photos/${encodeURIComponent(photoId)}`,
    { method: "DELETE" },
  );
  return response.ok;
}
