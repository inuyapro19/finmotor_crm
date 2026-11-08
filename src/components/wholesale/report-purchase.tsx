"use client";

/**
 * Compra del informe histórico de la unidad con MercadoPago: el proveedor elige Estándar o
 * Premium (mismos productos y precios que la ficha pública de finmotor.cl), paga en
 * MercadoPago y vuelve a esta página. Al volver se verifica el pago con la API de MercadoPago
 * (vía backend) para no esperar al webhook.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Lock } from "lucide-react";

import { fmtCLP } from "@/lib/format";
import { REPORT_TIER_LABEL, type ReportProduct, type ReportTier, type WholesaleListing } from "@/lib/wholesale";
import { wholesaleRequest } from "@/lib/wholesale-upload";

export function ReportPurchase({
  listing,
  products,
  disabled,
}: {
  listing: WholesaleListing;
  products: ReportProduct[];
  disabled?: boolean;
}) {
  const pendingTier = listing.report.state === "pending_payment" ? listing.report.tier : null;
  const [tier, setTier] = useState<ReportTier>(pendingTier ?? "standard");
  const [paying, setPaying] = useState(false);
  const base = `/api/proveedor/listings/${listing.id}`;

  const pay = async () => {
    setPaying(true);
    try {
      const data = await wholesaleRequest<{ redirectUrl: string | null }>(`${base}/report/checkout`, "POST", {
        reportType: tier,
      });
      if (!data.redirectUrl) throw new Error("MercadoPago no devolvió el enlace de pago. Intenta de nuevo.");
      window.location.assign(data.redirectUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos iniciar el pago.");
      setPaying(false);
    }
  };

  if (!products.length) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de informe">
        {products.map((product) => {
          const active = tier === product.reportType;
          return (
            <button
              key={product.reportType}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled || paying}
              onClick={() => setTier(product.reportType)}
              className={`rounded-[var(--radius-md)] border-2 p-3 text-left transition-colors disabled:opacity-60 ${
                active ? "border-[var(--fm-green)] bg-[var(--fm-green)]/5" : "border-[var(--border)] hover:border-[var(--fm-navy)]/30"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Informe {REPORT_TIER_LABEL[product.reportType]}</span>
                {active && <Check className="h-4 w-4 text-[var(--fm-green)]" />}
              </span>
              <span className="mt-1 block text-lg font-semibold tabular-nums text-[var(--fm-navy)]">{fmtCLP(product.priceClp)}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-[var(--muted-foreground)]">{product.description}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={pay}
        disabled={disabled || paying}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#009ee3] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {pendingTier === tier ? "Retomar pago en MercadoPago" : "Pagar con MercadoPago"} ·{" "}
        {fmtCLP(products.find((p) => p.reportType === tier)?.priceClp ?? 0)}
      </button>
      <p className="text-[11px] text-[var(--muted-foreground)]">
        Pagas en MercadoPago y vuelves aquí. El informe se genera por la patente {listing.plate} y queda adjunto a la unidad;
        también te llega por correo.
      </p>
    </div>
  );
}

/** Vuelta desde MercadoPago (montado siempre en la página de la unidad, haya o no formulario). */
export function ReportPaymentReturn({ listingId }: { listingId: string }) {
  const router = useRouter();
  const verified = useRef(false);
  const base = `/api/proveedor/listings/${listingId}`;

  // ?pago=ok&payment_id=… → confirmar con el backend y limpiar la URL.
  useEffect(() => {
    if (verified.current) return;
    verified.current = true;
    const params = new URLSearchParams(window.location.search);
    const result = params.get("pago");
    if (!result) return;
    const paymentId = params.get("payment_id") || params.get("collection_id");
    window.history.replaceState(null, "", window.location.pathname);
    if (result === "cancelado") {
      toast.info("Pago cancelado. Puedes intentarlo de nuevo cuando quieras.");
      return;
    }
    if (!paymentId || !/^\d+$/.test(paymentId)) {
      toast.info("Estamos confirmando tu pago. El informe aparecerá en unos minutos.");
      router.refresh();
      return;
    }
    wholesaleRequest<{ confirmed: boolean }>(`${base}/report/verify-payment`, "POST", { paymentId })
      .then((data) => {
        if (data.confirmed) toast.success("Pago confirmado. Estamos generando el informe histórico.");
        else toast.info("MercadoPago aún no confirma el pago. Te avisaremos por correo.");
      })
      .catch(() => toast.info("Estamos confirmando tu pago. El informe aparecerá en unos minutos."))
      .finally(() => router.refresh());
  }, [base, router]);

  return null;
}
