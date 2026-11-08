"use client";

/**
 * Carpeta de documentos del cliente: el ejecutivo sube aquí el carnet, las liquidaciones, la
 * cartola, el comprobante de domicilio, el padrón… en vez de tenerlos en el WhatsApp o el
 * correo de cada agente. Se ordena en subcarpetas (Identidad, Renta y finanzas, Domicilio…) y
 * cada tipo de documento muestra qué falta y qué ya está subido.
 *
 * El servidor decide a qué subcarpeta va cada tipo (llega en `catalog`); aquí sólo se pinta.
 * Las URL de descarga son firmadas y de corta vida: se regeneran con cada carga de la ficha.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ExternalLink, FileText, FolderOpen, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { fmtDateTime } from "@/lib/format";
import type { LeadFile, LeadFileFolder } from "@/lib/data/lead-files";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_BYTES = 15 * 1024 * 1024;

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeadDocuments({
  leadId,
  catalog,
  documents,
  canWrite,
}: {
  leadId: string;
  catalog: LeadFileFolder[];
  documents: LeadFile[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byType = new Map<string, LeadFile[]>();
  for (const doc of documents) {
    byType.set(doc.documentType, [...(byType.get(doc.documentType) ?? []), doc]);
  }

  const pick = (type: string) => {
    setPendingType(type);
    inputRef.current?.click();
  };

  const upload = async (file: File, type: string) => {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("Usa un PDF o una imagen JPG, PNG o WebP");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("El archivo no puede superar 15 MB");
      return;
    }
    const body = new FormData();
    body.set("file", file);
    body.set("documentType", type);
    setUploadingType(type);
    try {
      const response = await crmFetch(`/api/crm/leads/${leadId}/files`, { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos subir el documento");
        return;
      }
      toast.success("Documento guardado en la carpeta");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para subir el documento");
      if (message) toast.error(message);
    } finally {
      setUploadingType(null);
      setPendingType(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (doc: LeadFile) => {
    setDeletingId(doc.id);
    try {
      const response = await crmFetch(`/api/crm/leads/${leadId}/files/${doc.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos eliminar el documento");
        return;
      }
      toast.success("Documento eliminado");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && pendingType) void upload(file, pendingType);
        }}
      />

      <p className="text-xs text-[var(--muted-foreground)]">
        Guarda aquí los documentos del cliente. PDF o imagen (JPG, PNG, WebP), hasta 15 MB cada uno. Son
        privados: sólo los ve tu automotora.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {catalog.map((folder) => {
          const count = folder.types.reduce((sum, t) => sum + (byType.get(t.value)?.length ?? 0), 0);
          return (
            <section
              key={folder.key}
              className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)]"
            >
              <header className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--muted)]/40 px-4 py-2.5">
                <FolderOpen className="h-4 w-4 text-[var(--primary)]" />
                <h3 className="text-sm font-semibold">{folder.label}</h3>
                <span className="ml-auto rounded-full bg-[var(--muted)] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[var(--muted-foreground)]">
                  {count} {count === 1 ? "archivo" : "archivos"}
                </span>
              </header>

              <ul className="divide-y divide-[var(--border)]">
                {folder.types.map((type) => {
                  const docs = byType.get(type.value) ?? [];
                  const busy = uploadingType === type.value;
                  return (
                    <li key={type.value} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={clsx(
                            "h-2 w-2 shrink-0 rounded-full",
                            docs.length ? "bg-[var(--success,#16a34a)]" : "bg-[var(--border)]",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 text-sm">{type.label}</span>
                        {!docs.length && (
                          <span className="text-[11px] text-[var(--muted-foreground)]">Pendiente</span>
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            disabled={busy || uploadingType !== null}
                            onClick={() => pick(type.value)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                            {busy ? "Subiendo…" : "Subir"}
                          </button>
                        )}
                      </div>

                      {docs.length > 0 && (
                        <ul className="mt-2 space-y-1.5 pl-4">
                          {docs.map((doc) => {
                            const isImage = doc.mimeType?.startsWith("image/");
                            const Icon = isImage ? ImageIcon : FileText;
                            return (
                              <li
                                key={doc.id}
                                className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--muted)]/40 px-2.5 py-1.5"
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
                                <div className="min-w-0 flex-1">
                                  {doc.url ? (
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium hover:text-[var(--primary)] hover:underline"
                                    >
                                      <span className="truncate">{doc.fileName}</span>
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="truncate text-xs font-medium">{doc.fileName}</span>
                                  )}
                                  <p className="truncate text-[10px] text-[var(--muted-foreground)]">
                                    {[fmtSize(doc.sizeBytes), fmtDateTime(doc.createdAt), doc.uploadedByName]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                </div>
                                {canWrite &&
                                  (confirmId === doc.id ? (
                                    <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
                                      <button
                                        type="button"
                                        disabled={deletingId === doc.id}
                                        onClick={() => void remove(doc)}
                                        className="font-semibold text-[var(--danger,#dc2626)] hover:underline disabled:opacity-60"
                                      >
                                        {deletingId === doc.id ? "Eliminando…" : "Eliminar"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmId(null)}
                                        className="text-[var(--muted-foreground)] hover:underline"
                                      >
                                        Cancelar
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmId(doc.id)}
                                      aria-label={`Eliminar ${doc.fileName}`}
                                      className="shrink-0 rounded p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--danger,#dc2626)]"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  ))}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
