"use client";

/**
 * "Pago informado": el agente ya cobró en el mostrador (efectivo, transferencia o tarjeta) y
 * lo deja registrado, sin pasarela. El monto no se escribe libre — se muestra lo que
 * corresponde según la cotización (el total si es contado, el pie si hay financiamiento) y el
 * backend lo valida contra eso: acá no se "cobra" un monto distinto al conversado con el
 * cliente.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { fmtCLP } from "@/lib/format";
import type { SaleTerms } from "@/lib/data/crm";
import type { Lead } from "@/lib/leads";

const METHODS: { key: string; label: string }[] = [
  { key: "cash", label: "Efectivo" },
  { key: "transfer", label: "Transferencia" },
  { key: "card", label: "Tarjeta" },
];

const PAYMENT_DONE_STATUSES = new Set(["PAYMENT_CONFIRMED", "CONTRACT_SIGNED", "TRANSFER_IN_PROGRESS", "COMPLETED"]);

export function PaymentForm({
  lead,
  sale,
  canWrite,
}: {
  lead: Lead;
  sale: SaleTerms;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [sending, setSending] = useState(false);

  // Monto y modalidad los define el servidor, que es el mismo que los valida al recibir el
  // POST. Calcularlos acá fue el origen de un `amount_mismatch` sin explicación: el frontend
  // contaba las solicitudes de crédito rechazadas y pedía el pie de una venta al contado.
  const financed = sale.financed;
  const expected = sale.amountDueClp;
  const alreadyPaid = lead.purchaseStatus ? PAYMENT_DONE_STATUSES.has(lead.purchaseStatus) : false;

  if (alreadyPaid) {
    return (
      <div className="flex items-center gap-2 px-4 py-4 text-sm text-[var(--primary)]">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Pago registrado{financed ? " (pie)" : ""}.
      </div>
    );
  }

  if (!financed && expected <= 0) {
    return (
      <p className="px-4 py-4 text-xs text-[var(--muted-foreground)]">
        Falta terminar la cotización (unidad y precio) antes de poder cobrar.
      </p>
    );
  }

  const send = async () => {
    setSending(true);
    try {
      const res = await crmFetch(`/api/crm/leads/${lead.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: expected, method, reference: reference.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos registrar el pago");
        return;
      }
      toast.success("Pago registrado");
      window.open(`/api/crm/leads/${lead.id}/documents`, "_blank", "noopener,noreferrer");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const noDownPayment = financed && expected <= 0;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-baseline justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--muted)]/40 px-3 py-2.5">
        <span className="text-xs text-[var(--muted-foreground)]">
          {noDownPayment ? "Venta 100% financiada" : financed ? "Pie a cobrar" : "Total a cobrar"}
        </span>
        <span className="text-lg font-semibold tabular-nums">{fmtCLP(expected)}</span>
      </div>

      {canWrite && (
        <>
          {!noDownPayment && (
            <>
              <div>
                <span className="mb-1.5 block text-xs font-medium">Medio de pago</span>
                <div className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMethod(m.key)}
                      className={
                        m.key === method
                          ? "rounded-full bg-[var(--fm-navy)] px-3 py-1.5 text-xs font-medium text-white"
                          : "rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:border-[var(--primary)]"
                      }
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Referencia (opcional)</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="N° de operación, últimos 4 dígitos…"
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
                />
              </label>
            </>
          )}

          <button
            onClick={send}
            disabled={sending || pending}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {sending || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {noDownPayment ? "Confirmar venta" : "Registrar pago recibido"}
          </button>
          <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            {noDownPayment
              ? "Sin pie: sólo confirma la venta para que quede lista en cuanto se apruebe el crédito."
              : "Queda informado: no pasa por pasarela, es lo que cobraste en el mostrador."}
          </p>
        </>
      )}
    </div>
  );
}
