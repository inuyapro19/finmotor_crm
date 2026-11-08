"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

import type { WholesaleListing } from "@/lib/wholesale";
import { wholesaleRequest } from "@/lib/wholesale-upload";

/** Abre el informe histórico de la unidad con una URL firmada de 15 minutos. */
export function ReportButton({ listingId, report }: { listingId: string; report: WholesaleListing["report"] }) {
  const [busy, setBusy] = useState(false);
  if (report.state === "processing") {
    return <span className="text-xs text-[var(--muted-foreground)]">Informe histórico generándose…</span>;
  }
  if (report.state !== "available") return null;
  const open = async () => {
    setBusy(true);
    try {
      const data = await wholesaleRequest<{ downloadUrl: string }>(
        `/api/crm/wholesale/listings/${listingId}/report/download`, "GET",
      );
      window.open(data.downloadUrl, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos abrir el informe.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={open} disabled={busy}
      className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      Ver informe histórico
    </button>
  );
}
