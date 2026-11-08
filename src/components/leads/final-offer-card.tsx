"use client";

/**
 * Oferta definitiva: el precio del vehículo elegido, menos el pie y el vehículo en parte de pago
 * YA evaluado, y el financiamiento que resulta. Se calcula en el servidor con lo cotizado; aquí
 * solo se muestra la vista previa (misma fórmula) y se elige el plazo. Emitirla la guarda como
 * versión y se la envía al cliente por correo; volver a emitirla la ajusta.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { Pill } from "@/components/ui/primitives";
import type { CreditTerms, FinalOffer, TradeIn } from "@/lib/data/crm";
import { fmtCLP, fmtDateTime } from "@/lib/format";
import { leadValue, type Lead } from "@/lib/leads";

function monthly(amount: number, term: number, rate: number): number {
  if (amount <= 0 || term <= 0) return 0;
  return Math.round((amount * rate) / (1 - (1 + rate) ** -term));
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className={strong ? "font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}

export function FinalOfferCard({
  lead,
  tradeIn,
  finalOffer,
  creditTerms,
  canWrite,
}: {
  lead: Lead;
  tradeIn: TradeIn | null;
  finalOffer: FinalOffer | null;
  creditTerms: CreditTerms;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [term, setTerm] = useState<number>(finalOffer?.termMonths ?? creditTerms.terms[1] ?? creditTerms.terms[0]);

  const price = leadValue(lead) ?? 0;
  const down = lead.quotedDownPayment ?? 0;
  const tradeEvaluated = tradeIn?.status === "evaluated";
  const tradeAmount = tradeEvaluated ? (tradeIn?.appraisedAmount ?? 0) : 0;
  const financed = Math.max(price - down - tradeAmount, 0);
  const quota = financed > 0 ? monthly(financed, term, creditTerms.monthlyRate) : 0;

  const blocked = !lead.vehicleId
    ? "Elige el vehículo con el que sigue el cliente."
    : price <= 0
      ? "El vehículo no tiene precio: defínelo en la cotización."
      : tradeIn && !tradeEvaluated
        ? "Falta la evaluación presencial del vehículo en parte de pago."
        : null;
  const saleClosed = Boolean(lead.purchaseId);

  const issue = async () => {
    setSending(true);
    try {
      const res = await crmFetch(`/api/crm/leads/${lead.id}/final-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termMonths: financed > 0 ? term : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos emitir la oferta");
        return;
      }
      toast.success(finalOffer ? "Oferta ajustada y enviada al cliente" : "Oferta emitida y enviada al cliente");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <dl className="divide-y divide-[var(--border)]">
        <Row label={lead.vehicleLabel ?? "Vehículo"} value={fmtCLP(price)} />
        {tradeIn && <Row label={`Parte de pago${tradeEvaluated ? "" : " (sin evaluar)"}`} value={tradeEvaluated ? `− ${fmtCLP(tradeAmount)}` : "—"} />}
        <Row label="Pie" value={down ? `− ${fmtCLP(down)}` : "—"} />
        <Row label="A financiar" value={fmtCLP(financed)} strong />
      </dl>

      {financed > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="offer-term" className="text-xs text-[var(--muted-foreground)]">
            Plazo
          </label>
          <select
            id="offer-term"
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            disabled={!canWrite || saleClosed || sending}
            className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 text-sm"
          >
            {creditTerms.terms.map((t) => (
              <option key={t} value={t}>
                {t} meses
              </option>
            ))}
          </select>
          <span className="text-sm">
            Cuota estimada <strong>{fmtCLP(quota)}</strong>
          </span>
        </div>
      )}

      {blocked && <p className="text-xs text-[var(--warning,#d97706)]">{blocked}</p>}

      {canWrite && !saleClosed && (
        <button
          type="button"
          onClick={issue}
          disabled={sending || blocked !== null}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {finalOffer ? "Ajustar y reenviar oferta" : "Emitir oferta y enviar al cliente"}
        </button>
      )}

      {finalOffer && (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--muted)]/50 px-3 py-2 text-xs">
          <FileCheck2 className="h-4 w-4 shrink-0 text-[var(--success,#16a34a)]" />
          <span className="min-w-0 flex-1">
            Oferta v{finalOffer.version} emitida {fmtDateTime(finalOffer.issuedAt)}: {fmtCLP(finalOffer.price)}
            {finalOffer.financedAmount > 0
              ? ` · financia ${fmtCLP(finalOffer.financedAmount)}${finalOffer.monthlyPayment ? ` en ${finalOffer.termMonths} cuotas de ${fmtCLP(finalOffer.monthlyPayment)}` : ""}`
              : " · sin financiamiento"}
          </span>
          <Pill variant="success">Enviada</Pill>
        </div>
      )}
    </div>
  );
}
