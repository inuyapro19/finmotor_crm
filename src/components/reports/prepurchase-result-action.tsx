"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { directUploadHeaders } from "@/lib/storage/direct-upload";


const MAX_RESULT_BYTES = 20 * 1024 * 1024;

export function PrepurchaseResultAction({ reportId, plate }: { reportId: string; plate: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  const upload = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("El resultado debe ser un archivo PDF");
      return;
    }
    if (file.size <= 0 || file.size > MAX_RESULT_BYTES) {
      toast.error("El PDF debe pesar menos de 20 MB");
      return;
    }
    setUploading(true);
    try {
      const signResponse = await crmFetch("/api/crm/storage/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "vehicle-certificates",
          scope: "prepurchase-results",
          filename: `${reportId}-${file.name}`,
          contentType: "application/pdf",
        }),
      });
      const signed = await signResponse.json().catch(() => ({}));
      if (!signResponse.ok || !signed?.url || !signed?.key) {
        toast.error(signed?.error || "No pudimos preparar la carga");
        return;
      }
      const putResponse = await fetch(signed.url, {
        method: "PUT",
        headers: directUploadHeaders(signed.url, "application/pdf"),
        body: file,
      });
      if (!putResponse.ok) {
        toast.error("No pudimos subir el PDF");
        return;
      }
      const response = await crmFetch(`/api/crm/prepurchase-reports/${reportId}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey: signed.key, filename: file.name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos registrar el resultado");
        return;
      }
      toast.success(`Resultado de ${plate || "la inspección"} cargado`);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos cargar el resultado");
      if (message) toast.error(message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 text-xs font-medium text-[var(--primary)] disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
        Cargar resultado
      </button>
    </>
  );
}
