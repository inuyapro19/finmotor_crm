"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { Organization } from "@/lib/data/crm";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

export function OrganizationLogoUpload({ organization }: { organization: Organization }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [version, setVersion] = useState(organization.logoUpdatedAt ?? "initial");
  const [hasLogo, setHasLogo] = useState(organization.hasLogo);
  const [, startTransition] = useTransition();

  const upload = async (file: File) => {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error("Usa un archivo PNG, JPG o WebP");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("El logo no puede superar 2 MB");
      return;
    }
    const body = new FormData();
    body.set("file", file);
    setUploading(true);
    try {
      const response = await crmFetch(`/api/crm/organizations/${organization.id}`, {
        method: "PUT",
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos actualizar el logo");
        return;
      }
      setHasLogo(true);
      setVersion(data?.organization?.logoUpdatedAt || String(Date.now()));
      toast.success("Logo actualizado");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para subir el logo");
      if (message) toast.error(message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative grid h-24 w-40 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-3">
        {hasLogo ? (
          <Image
            key={version}
            src={`/api/crm/organizations/${organization.id}?v=${encodeURIComponent(version)}`}
            alt={`Logo de ${organization.name || "la automotora"}`}
            fill
            unoptimized
            className="object-contain p-3"
          />
        ) : (
          <Building2 className="h-8 w-8 text-[var(--muted-foreground)]" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">Logo de la automotora</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--muted-foreground)]">
          Se usa en fichas de inspección y documentos operativos de venta. Los contratos mantienen el logo de Finmotor.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          disabled={uploading}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs font-medium transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
          {uploading ? "Subiendo..." : hasLogo ? "Cambiar logo" : "Subir logo"}
        </button>
        <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">PNG, JPG o WebP. Máximo 2 MB.</p>
      </div>
    </div>
  );
}
