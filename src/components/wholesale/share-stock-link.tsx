"use client";

/** Enlace para compartir el stock del proveedor con automotoras: abre /mayorista filtrado por su nombre. */
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Share2 } from "lucide-react";

export function ShareStockLink({ url, supplierName }: { url: string; supplierName: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No pudimos copiar. Selecciona el enlace y cópialo a mano.");
    }
  };
  return (
    <div className="mb-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold"><Share2 className="h-4 w-4" /> Comparte tu stock con automotoras</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Abre el marketplace mayorista mostrando sólo las unidades publicadas de {supplierName}. Es privado: la automotora debe
            iniciar sesión en el CRM para verlo.
          </p>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-3 py-2 text-xs font-medium text-white">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copiado" : "Copiar enlace"}
        </button>
      </div>
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace para compartir"
        className="mt-3 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 font-mono text-xs" />
    </div>
  );
}
