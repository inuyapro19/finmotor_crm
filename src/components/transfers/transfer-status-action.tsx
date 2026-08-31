"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";

const NEXT: Record<string, { value: string; label: string }[]> = {
  PENDING: [{ value: "SUBMITTED", label: "Marcar enviada" }, { value: "CANCELLED", label: "Cancelar" }],
  SUBMITTED: [{ value: "BUYER_SIGNED", label: "Firmó comprador" }, { value: "SELLER_SIGNED", label: "Firmó vendedor" }, { value: "COMPLETED", label: "Completar" }, { value: "FAILED", label: "Marcar fallida" }],
  BUYER_SIGNED: [{ value: "SELLER_SIGNED", label: "Firmó vendedor" }, { value: "COMPLETED", label: "Completar" }],
  SELLER_SIGNED: [{ value: "BUYER_SIGNED", label: "Firmó comprador" }, { value: "COMPLETED", label: "Completar" }],
  FAILED: [{ value: "SUBMITTED", label: "Reintentar" }, { value: "CANCELLED", label: "Cancelar" }],
  EXPIRED: [{ value: "SUBMITTED", label: "Reintentar" }, { value: "CANCELLED", label: "Cancelar" }],
};

export function TransferStatusAction({ transferId, status }: { transferId: string; status: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const options = NEXT[status] ?? [];
  if (options.length === 0) return null;

  const update = async (next: string) => {
    if (!next) return;
    setSaving(true);
    try {
      const response = await crmFetch(`/api/crm/transfers/${transferId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos actualizar la transferencia");
        return;
      }
      toast.success("Estado actualizado");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para actualizar la transferencia");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return saving ? <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" /> : (
    <select aria-label="Actualizar estado" defaultValue="" onChange={(event) => void update(event.target.value)} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs">
      <option value="" disabled>Actualizar</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
