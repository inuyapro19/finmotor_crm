import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";

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

async function compressImage(file: File): Promise<File> {
  if (file.size <= COMPRESS_TRIGGER_BYTES || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = Object.assign(document.createElement("canvas"), { width, height });
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const outputType = file.type === "image/png" ? "image/png" : "image/webp";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, COMPRESS_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.${outputType === "image/png" ? "png" : "webp"}`, { type: outputType });
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
      headers: { "Content-Type": compressed.type },
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

export async function uploadAndRegisterPhotos(
  vehicleId: string,
  files: File[],
  primaryIndex: number,
  startPosition = 0,
): Promise<{ registered: number; errors: string[] }> {
  const ordered = [...files.keys()]
    .sort((a, b) => (a === primaryIndex ? -1 : b === primaryIndex ? 1 : a - b))
    .map((index) => files[index]);
  let registered = 0;
  const errors: string[] = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const result = await uploadOne(ordered[index]);
    if ("error" in result) {
      errors.push(`${ordered[index].name}: ${result.error}`);
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
      errors.push(`${ordered[index].name}: ${message}`);
      continue;
    }
    if (response?.ok) registered += 1;
    else errors.push(`${ordered[index].name}: no se pudo registrar`);
  }
  return { registered, errors };
}
