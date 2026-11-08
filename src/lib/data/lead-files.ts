import { backendJsonOrNull } from "@/lib/api/client";

/** Carpeta de documentos de un lead (`GET /backoffice/leads/{id}/files`). */
export type LeadFileType = { value: string; label: string };

export type LeadFileFolder = { key: string; label: string; types: LeadFileType[] };

export type LeadFile = {
  id: string;
  folder: string;
  documentType: string;
  typeLabel: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  notes: string | null;
  uploadedByName: string | null;
  createdAt: string;
  /** URL firmada de corta vida: no guardarla, se regenera en cada carga. */
  url: string | null;
};

export type LeadFiles = { catalog: LeadFileFolder[]; documents: LeadFile[] };

export async function getLeadFiles(leadId: string): Promise<LeadFiles> {
  const data = await backendJsonOrNull<{ ok: boolean; catalog: LeadFileFolder[]; documents: LeadFile[] }>(
    `/backoffice/leads/${leadId}/files`,
  );
  return { catalog: data?.catalog ?? [], documents: data?.documents ?? [] };
}
