/**
 * Headers del PUT directo del navegador a la URL firmada que entrega el backend.
 *
 * El backend firma contra MinIO/S3 (local y VPS) o contra Azure Blob (preproducción en Azure),
 * según su STORAGE_BACKEND. Azure Blob exige `x-ms-blob-type: BlockBlob` en el PUT con SAS
 * (sin él responde 400); S3/MinIO no lo necesita, así que solo se agrega para Blob.
 */
export function isAzureBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.core.windows.net");
  } catch {
    return false;
  }
}

export function directUploadHeaders(url: string, contentType: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (isAzureBlobUrl(url)) headers["x-ms-blob-type"] = "BlockBlob";
  return headers;
}
