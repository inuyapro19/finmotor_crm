"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";

/** Abre el checkout de MercadoPago del pack. El saldo se acredita al volver con el pago aprobado. */
export function TokenPackButton({ packId, disabled }: { packId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  const buy = async () => {
    setLoading(true);
    try {
      const response = await crmFetch("/api/crm/report-tokens/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = (await response.json().catch(() => null)) as { checkoutUrl?: string; error?: string } | null;
      if (!response.ok || !data?.checkoutUrl) {
        toast.error(data?.error || "No pudimos abrir el pago");
        setLoading(false);
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con MercadoPago");
      if (message) toast.error(message);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={buy}
      disabled={disabled || loading}
      className="flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--fm-green-700)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {loading ? "Abriendo MercadoPago…" : "Comprar con MercadoPago"}
    </button>
  );
}
