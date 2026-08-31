"use client";

/**
 * Financiamiento: simular la cuota con el cliente delante y mandar el caso a evaluación.
 *
 * En una automotora chilena esto es la mitad de la venta y hasta ahora el agente lo hacía por
 * WhatsApp con la ejecutiva de la financiera. Aquí la simulación usa la MISMA tasa y fórmula
 * que el simulador público (las entrega el backend, no se copian), así que la cuota que el
 * cliente vio en la ficha del auto es la que le repite el vendedor en el mostrador.
 *
 * Lo enviado no es lo simulado en el navegador: el backend recalcula el monto desde la
 * cotización guardada. Aquí sólo se decide el pie y el plazo.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Banknote, Building2, CheckCircle2, Clock, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { fmtCLP, fmtDateTime } from "@/lib/format";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { CreditRequest, CreditTerms } from "@/lib/data/crm";
import type { Lead } from "@/lib/leads";
import { CurrencyInput } from "@/components/ui/currency-input";

/** Estados con los que vuelve la financiera (`credit_leads.status`). */
const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  requested: { label: "En evaluación", tone: "bg-[#e7edff] text-[var(--fm-navy)]" },
  in_review: { label: "En evaluación", tone: "bg-[#e7edff] text-[var(--fm-navy)]" },
  approved: { label: "Aprobado", tone: "bg-[var(--accent)] text-[var(--accent-foreground)]" },
  rejected: { label: "Rechazado", tone: "bg-red-100 text-red-700" },
  expired: { label: "Vencido", tone: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
};

function statusOf(status: string | null) {
  return STATUS_LABEL[String(status ?? "").toLowerCase()] ?? {
    label: status ?? "Enviada",
    tone: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  };
}

/** Cuota con la fórmula del simulador público. La tasa la manda el servidor. */
function monthlyPayment(amount: number, term: number, rate: number): number {
  if (amount <= 0 || term <= 0) return 0;
  return Math.round((amount * rate) / (1 - (1 + rate) ** -term));
}

export function CreditPanel({
  lead,
  terms,
  requests,
  canWrite,
}: {
  lead: Lead;
  terms: CreditTerms;
  requests: CreditRequest[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState<number>(terms.terms.includes(36) ? 36 : terms.terms[0] ?? 36);
  const [down, setDown] = useState<number | null>(lead.quotedDownPayment);
  const [rut, setRut] = useState(lead.contactRut ?? "");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const price = lead.quotedPrice ?? lead.vehiclePrice ?? 0;
  const tradeIn = lead.tradeInAmount ?? 0;
  const amount = Math.max(price - (down ?? 0) - tradeIn, 0);
  const quota = monthlyPayment(amount, term, terms.monthlyRate);
  const ratePct = (terms.monthlyRate * 100).toLocaleString("es-CL", { maximumFractionDigits: 2 });

  const missingVehicle = !lead.vehicleId;
  const missingPrice = price <= 0;

  const send = async () => {
    setSending(true);
    try {
      const res = await crmFetch(`/api/crm/leads/${lead.id}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termMonths: term,
          downPayment: down ?? 0,
          rut: rut.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos enviar la solicitud");
        return;
      }
      toast.success(
        data?.creditRequest?.sentToFinancier
          ? "Solicitud enviada a la financiera"
          : "Solicitud enviada al equipo Finmotor",
      );
      setNotes("");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="divide-y divide-[var(--border)]">
      <div className="max-w-xl space-y-4 p-4">
        {missingVehicle || missingPrice ? (
          <p className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
            {missingVehicle
              ? "Elige primero la unidad que le estás cotizando: la financiera evalúa sobre un auto concreto."
              : "Falta el precio conversado para poder simular la cuota."}
          </p>
        ) : null}

        <div>
          <span className="mb-1.5 block text-xs font-medium">Plazo</span>
          <div className="flex flex-wrap gap-1.5">
            {terms.terms.map((t) => (
              <button
                key={t}
                onClick={() => setTerm(t)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  t === term
                    ? "bg-[var(--fm-navy)] text-white"
                    : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)] hover:border-[var(--primary)]",
                )}
              >
                {t} meses
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Pie</span>
          <CurrencyInput value={down} onChange={setDown} placeholder="0" />
        </label>

        {/* Resultado de la simulación: lo que el agente le dice al cliente en voz alta. */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-[var(--muted-foreground)]">Cuota mensual estimada</span>
            <span className="text-2xl font-semibold tabular-nums text-[var(--primary)]">
              {fmtCLP(quota)}
            </span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--border)] pt-2 text-[11px]">
            <Row label="Monto a financiar" value={fmtCLP(amount)} />
            <Row label="Plazo" value={`${term} meses`} />
            <Row label="Precio" value={fmtCLP(price)} />
            {tradeIn > 0 && <Row label="Parte de pago" value={fmtCLP(tradeIn)} />}
          </dl>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
            Referencial, con tasa {ratePct}% mensual. La cuota definitiva la fija la financiera
            tras evaluar al cliente.
          </p>
        </div>

        {canWrite && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">
                RUT del cliente
                {!lead.contactRut && <span className="text-[var(--primary)]"> *</span>}
              </span>
              <input
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12.345.678-9"
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
              />
              <span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">
                Sin RUT la financiera no puede evaluar. Queda guardado en la solicitud.
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Nota para la financiera</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional: renta, antigüedad laboral, si ya tiene otro crédito…"
                className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
            </label>

            <button
              onClick={send}
              disabled={sending || pending || missingVehicle || amount <= 0 || !rut.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {sending || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar a evaluación
            </button>
            <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              Se envía a la financiera asociada a tu automotora y al equipo Finmotor, con el
              RUT, el vehículo y los términos simulados. La solicitud pasa a “En financiamiento”.
            </p>
          </>
        )}
      </div>

      {requests.length > 0 && (
        <div>
          <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
            Solicitudes enviadas
          </p>
          <ul className="divide-y divide-[var(--border)]">
            {requests.map((request) => {
              const status = statusOf(request.status);
              return (
                <li key={request.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--muted)]">
                    <Banknote className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">{fmtCLP(request.amount)}</span>
                      <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-medium", status.tone)}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                      {request.termMonths ? `${request.termMonths} meses` : "Sin plazo"}
                      {request.monthlyPayment ? ` · cuota ${fmtCLP(request.monthlyPayment)}` : ""}
                      {request.downPayment ? ` · pie ${fmtCLP(request.downPayment)}` : ""}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                      {request.sentToFinancier ? (
                        <>
                          <Building2 className="h-3 w-3" />
                          Enviada a la financiera
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" />
                          En Finmotor: tu automotora aún no tiene financiera asociada
                        </>
                      )}
                      <span>· {fmtDateTime(request.createdAt)}</span>
                    </p>
                  </div>
                  {request.status === "approved" && (
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  );
}
