"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Notice } from "@/components/ui/primitives";
import { crmFetch } from "@/lib/api/crm-fetch";

type Outcome = "checking" | "paid" | "pending" | "failed";

/**
 * Vuelta desde MercadoPago (`?compra=…&payment_id=…`). Pide al backend que consulte el pago a
 * MercadoPago — por si el webhook aún no llegó — y refresca el saldo. Nunca acredita por la URL.
 */
export function TokenPurchaseReturn({
  purchaseId,
  mpPaymentId,
  failed,
  initialStatus,
}: {
  purchaseId: string;
  mpPaymentId: string | null;
  failed: boolean;
  initialStatus: "pending" | "paid" | "failed" | null;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [outcome, setOutcome] = useState<Outcome>(() => {
    if (initialStatus === "paid") return "paid";
    if (failed || initialStatus === "failed") return "failed";
    return mpPaymentId ? "checking" : "pending";
  });

  useEffect(() => {
    if (started.current || outcome !== "checking" || !mpPaymentId) return;
    started.current = true;
    void (async () => {
      try {
        const response = await crmFetch(`/api/crm/report-tokens/purchases/${purchaseId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mpPaymentId }),
        });
        const data = (await response.json().catch(() => null)) as { purchase?: { status?: string } } | null;
        const status = data?.purchase?.status;
        setOutcome(status === "paid" ? "paid" : status === "failed" ? "failed" : "pending");
      } catch {
        setOutcome("pending");
      }
      router.refresh();
    })();
  }, [mpPaymentId, outcome, purchaseId, router]);

  if (outcome === "checking") return <Notice>Confirmando tu pago con MercadoPago…</Notice>;
  if (outcome === "paid") return <Notice>¡Listo! Tu pago fue aprobado y los tokens ya están en tu saldo.</Notice>;
  if (outcome === "failed") {
    return <Notice tone="warn">El pago no se completó y no se descontó nada. Puedes intentarlo nuevamente.</Notice>;
  }
  return (
    <Notice tone="warn">
      Tu pago está en proceso. Apenas MercadoPago lo apruebe, los tokens se suman solos a tu saldo.
    </Notice>
  );
}
