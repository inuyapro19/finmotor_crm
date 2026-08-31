"use client";

import Image from "next/image";
import { useState } from "react";
import { Copy, Loader2, QrCode, Share2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";

type ShareLink = { id: string; url: string; qrDataUri: string | null; expiresAt: string };

export function ReportShareAction({ reportId, plate, compact = false }: { reportId: string; plate: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState<ShareLink | null>(null);

  const create = async () => {
    setLoading(true);
    try {
      const response = await crmFetch(`/api/crm/reports/${reportId}/share-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInDays: 7 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.shareLink) {
        toast.error(data?.error || "No pudimos crear el enlace");
        return;
      }
      setShare(data.shareLink);
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para crear el enlace");
      if (message) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const revoke = async () => {
    if (!share) return;
    try {
      const response = await crmFetch(`/api/crm/reports/${reportId}/share-links/${share.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("No pudimos revocar el enlace");
        return;
      }
      setShare(null);
      toast.success("Enlace revocado");
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para revocar el enlace");
      if (message) toast.error(message);
    }
  };

  return (
    <>
      <button type="button" onClick={() => void create()} disabled={loading} aria-label={`Compartir informe de ${plate}`} className={compact ? "rounded-[var(--radius-md)] border border-[var(--border)] p-2.5 text-[var(--primary)]" : "inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-2 font-medium text-[var(--primary)] hover:border-[var(--primary)]"}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}{!compact && "Compartir"}
      </button>
      {share && (
        <div role="dialog" aria-modal="true" aria-label="Compartir informe" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShare(null); }}>
          <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Compartir informe {plate}</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">El enlace descarga el PDF y vence en 7 días.</p></div><button type="button" onClick={() => setShare(null)} aria-label="Cerrar"><X className="h-5 w-5" /></button></div>
            <div className="mt-4 grid place-items-center rounded-[var(--radius-md)] bg-white p-4">{share.qrDataUri ? <Image src={share.qrDataUri} alt="QR para descargar informe" width={190} height={190} unoptimized /> : <QrCode className="h-28 w-28 text-[var(--muted-foreground)]" />}</div>
            <div className="mt-3 flex gap-2"><input readOnly value={share.url} className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs" /><button type="button" onClick={() => void navigator.clipboard.writeText(share.url).then(() => toast.success("Enlace copiado"))} className="rounded-[var(--radius-md)] bg-[var(--primary)] px-3 text-white"><Copy className="h-4 w-4" /></button></div>
            <button type="button" onClick={() => void revoke()} className="mt-4 flex items-center gap-1.5 text-xs font-medium text-red-600"><Trash2 className="h-3.5 w-3.5" />Revocar enlace</button>
          </div>
        </div>
      )}
    </>
  );
}
