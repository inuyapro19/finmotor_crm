"use client";

/**
 * Vehículo que el cliente entrega en parte de pago. Se registra por patente (o ya llega del
 * formulario de evaluación financiera de la ficha) y se EVALÚA presencialmente: el valor que
 * se registra aquí pasa a ser el "parte de pago" de la cotización, del crédito y de la oferta
 * definitiva. Cambiar la patente invalida la evaluación anterior.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Car, Check, Download, FileSearch, Loader2, Pencil, PackageCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Pill } from "@/components/ui/primitives";
import type { TradeIn } from "@/lib/data/crm";
import { fmtCLP, fmtDateTime, fmtNumber, fmtPlate } from "@/lib/format";

const INPUT =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]";

export function TradeInPanel({
  leadId,
  tradeIn,
  canWrite,
  locked,
}: {
  leadId: string;
  tradeIn: TradeIn | null;
  canWrite: boolean;
  /** La venta ya está cobrada: el vehículo en parte de pago quedó congelado. */
  locked: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"save" | "evaluate" | "remove" | "receive" | null>(null);

  // ── Informe histórico (multas, encargos, prenda vigente) de la patente en parte de pago ──
  // Mismo mecanismo "sin pasarela" que el Kit de Compra Venta (Informe histórico): la orden nace
  // 'paid' y el scheduler SPLEC del SERVIDOR la genera sola en background (cada ~15s) — a
  // diferencia de una primera versión de esto que llamaba a SPLEC desde el propio POST y por eso
  // quedaba pegada si nadie volvía a pedirla. Acá el POST solo pide/consulta (rápido); el
  // polling del frontend usa backoff (5s → 30s tope) y se detiene solo tras ~12 intentos (~5 min)
  // para no quedar reintentando indefinidamente si el usuario deja la pestaña abierta — "Comprobar
  // de nuevo" retoma manualmente sin perder lo ya pedido.
  const POLL_DELAYS = [5000, 5000, 10000, 10000, 20000, 30000];
  const POLL_MAX_ATTEMPTS = 12;
  const [report, setReport] = useState(tradeIn?.report ?? null);
  const [reportBusy, setReportBusy] = useState(false);
  const [pollExhausted, setPollExhausted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttemptRef = useRef(0);

  useEffect(() => () => {
    if (pollRef.current) clearTimeout(pollRef.current);
  }, []);

  const requestReport = async () => {
    setReportBusy(true);
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}/trade-in/report`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos pedir el informe");
        return;
      }
      setReport(data.report ?? null);
      const status = data.report?.status;
      if (status === "queued" || status === "processing") {
        if (pollAttemptRef.current < POLL_MAX_ATTEMPTS) {
          const delay = POLL_DELAYS[Math.min(pollAttemptRef.current, POLL_DELAYS.length - 1)];
          pollAttemptRef.current += 1;
          pollRef.current = setTimeout(() => void requestReport(), delay);
        } else {
          setPollExhausted(true);
        }
      } else {
        pollAttemptRef.current = 0;
        setPollExhausted(false);
      }
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setReportBusy(false);
    }
  };

  const checkAgain = () => {
    pollAttemptRef.current = 0;
    setPollExhausted(false);
    void requestReport();
  };

  const [plate, setPlate] = useState(tradeIn?.plate ?? "");
  const [brand, setBrand] = useState(tradeIn?.brand ?? "");
  const [model, setModel] = useState(tradeIn?.model ?? "");
  const [year, setYear] = useState(tradeIn?.year ? String(tradeIn.year) : "");
  const [mileage, setMileage] = useState(tradeIn?.mileage ? String(tradeIn.mileage) : "");
  const [notes, setNotes] = useState(tradeIn?.notes ?? "");

  const [amount, setAmount] = useState<number | null>(tradeIn?.appraisedAmount ?? null);
  const [evalNotes, setEvalNotes] = useState(tradeIn?.evaluationNotes ?? "");

  const editable = canWrite && !locked;

  const call = async (
    kind: "save" | "evaluate" | "remove",
    url: string,
    init: RequestInit,
    success: string,
  ) => {
    setBusy(kind);
    try {
      const res = await crmFetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos guardar los cambios");
        return;
      }
      toast.success(success);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    if (!plate.trim()) return toast.error("Ingresa la patente del vehículo");
    void call(
      "save",
      `/api/crm/leads/${leadId}/trade-in`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate,
          brand: brand || null,
          model: model || null,
          year: year ? Number(year) : null,
          mileage: mileage ? Number(mileage.replace(/\D/g, "")) : null,
          notes: notes || null,
        }),
      },
      "Vehículo en parte de pago guardado",
    );
  };

  const evaluate = () => {
    if (!amount || amount <= 0) return toast.error("Ingresa el valor de la evaluación");
    void call(
      "evaluate",
      `/api/crm/leads/${leadId}/trade-in/evaluation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, notes: evalNotes || null }),
      },
      "Evaluación registrada: ya es el parte de pago de la cotización",
    );
  };

  const remove = () => void call("remove", `/api/crm/leads/${leadId}/trade-in`, { method: "DELETE" }, "Vehículo en parte de pago quitado");

  /** Deja lista la captación (etapa "accepted") y salta directo al intake real, que es lo que
   *  crea el vehículo en el stock y lo marca "recepcionado". */
  const receive = async () => {
    setBusy("receive");
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}/trade-in/receive`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos preparar la recepción del vehículo");
        return;
      }
      const opportunityId = data?.opportunity?.id;
      if (!opportunityId) {
        toast.error("No pudimos preparar la recepción del vehículo");
        return;
      }
      router.push(`/vehiculos/create?sourcing=${opportunityId}`);
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  // ── Sin vehículo registrado ────────────────────────────────────────────────
  if (!tradeIn && !editing) {
    return (
      <div className="flex flex-col items-start gap-2 p-4">
        <p className="text-sm text-[var(--muted-foreground)]">El cliente no entrega un vehículo en parte de pago.</p>
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs font-medium hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar vehículo en parte de pago
          </button>
        )}
      </div>
    );
  }

  // ── Formulario de datos del vehículo ───────────────────────────────────────
  if (editing) {
    return (
      <div className="space-y-2 p-4">
        <div className="grid grid-cols-2 gap-2">
          <input
            className={INPUT}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="Patente — ABCD12"
            aria-label="Patente"
          />
          <input className={INPUT} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Año" aria-label="Año" inputMode="numeric" />
          <input className={INPUT} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marca" aria-label="Marca" />
          <input className={INPUT} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelo" aria-label="Modelo" />
        </div>
        <input className={INPUT} value={mileage} onChange={(e) => setMileage(e.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="Kilometraje" aria-label="Kilometraje" inputMode="numeric" />
        <textarea
          className="min-h-16 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observaciones (estado, mantenciones, prendas…)"
          aria-label="Observaciones"
          maxLength={1000}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Guardar
          </button>
          <button type="button" onClick={() => setEditing(false)} className="px-2 text-xs text-[var(--muted-foreground)] hover:underline">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── Vehículo registrado ────────────────────────────────────────────────────
  const t = tradeIn!;
  const evaluated = t.status === "evaluated";
  const title = [t.brand, t.model, t.year].filter(Boolean).join(" ");
  const received = t.sourcing?.stage === "received";
  // "Aprobado" = la captación llegó a 'accepted' (términos y monto acordados): desde ahí el
  // vehículo YA cuenta como abono al cobrar, aunque todavía no entre físicamente al stock
  // ('received'). Ver `_approved_trade_in_amount` en el backend.
  const approved = received || t.sourcing?.stage === "accepted";
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--muted)]">
          <Car className="h-4 w-4 text-[var(--muted-foreground)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title || "Vehículo en parte de pago"}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {[fmtPlate(t.plate), t.mileage ? `${fmtNumber(t.mileage)} km` : null, t.source === "financing_form" ? "Lo indicó el cliente en la ficha" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {t.notes && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{t.notes}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Pill variant={evaluated ? "success" : "warn"}>{evaluated ? "Evaluado" : "Por evaluar"}</Pill>
          {t.sourcing && (
            <Pill variant={approved ? "success" : "warn"}>
              {received ? "En el stock" : approved ? "Aprobado" : "Pendiente de aprobación"}
            </Pill>
          )}
        </div>
      </div>

      {evaluated && !editable && (
        <p className="text-sm">
          Valor evaluado: <strong>{fmtCLP(t.appraisedAmount)}</strong>
          {t.evaluatedAt && <span className="text-xs text-[var(--muted-foreground)]"> · {fmtDateTime(t.evaluatedAt)}</span>}
        </p>
      )}

      {/* Informe histórico de la patente: multas, encargos, prenda vigente — antes de aceptar
          el vehículo en parte de pago. */}
      <div className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-sm">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
          <FileSearch className="h-4 w-4 shrink-0" />
          {!report && <span>Sin informe pedido — verifica multas, encargos o prenda vigente</span>}
          {report?.status === "failed" && <span className="text-[var(--danger,#dc2626)]">No pudimos generar el informe</span>}
          {(report?.status === "queued" || report?.status === "processing") && !pollExhausted && (
            <span>Generando informe histórico… puede tardar varios minutos</span>
          )}
          {(report?.status === "queued" || report?.status === "processing") && pollExhausted && (
            <span>Sigue generándose — puede tardar hasta una hora</span>
          )}
          {report?.status === "generated" && <span className="text-[var(--foreground)]">Informe histórico listo</span>}
        </div>
        {(!report || report.status === "failed") && editable && (
          <button
            type="button"
            onClick={() => void requestReport()}
            disabled={reportBusy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
          >
            {reportBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
            {report?.status === "failed" ? "Reintentar" : "Pedir informe"}
          </button>
        )}
        {(report?.status === "queued" || report?.status === "processing") && !pollExhausted && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--muted-foreground)]" />
        )}
        {(report?.status === "queued" || report?.status === "processing") && pollExhausted && editable && (
          <button
            type="button"
            onClick={checkAgain}
            disabled={reportBusy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
          >
            {reportBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Comprobar de nuevo
          </button>
        )}
        {report?.status === "generated" && (
          <a
            href={`/api/crm/reports/${report.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar
          </a>
        )}
      </div>

      {approved && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--accent)] p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-[var(--accent-foreground)]">
            <PackageCheck className="h-4 w-4" />
            {received
              ? `Recepcionado — abono de ${fmtCLP(t.appraisedAmount)} aplicado al pago`
              : `Aprobado — abono de ${fmtCLP(t.appraisedAmount)} ya se descuenta al cobrar`}
          </p>
          {!received && (
            <p className="mt-1 text-xs text-[var(--accent-foreground)]/80">
              Falta que entre físicamente al stock — usa &quot;Continuar recepción&quot; cuando el cliente lo entregue.
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
            {t.sourcing?.vehicleId && (
              <Link href={`/vehiculos/editar/${t.sourcing.vehicleId}`} className="text-[var(--primary)] underline">
                Ver en el stock
              </Link>
            )}
            {t.sourcing?.acquisitionId && (
              <a
                href={`/api/crm/acquisitions/${t.sourcing.acquisitionId}/contract`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] underline"
              >
                Contrato de permuta
              </a>
            )}
          </div>
        </div>
      )}

      {editable && evaluated && !received && (
        <button
          type="button"
          onClick={receive}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary)] disabled:opacity-60"
        >
          {busy === "receive" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
          {t.sourcing ? "Continuar recepción en el stock" : "Recepcionar vehículo en el stock"}
        </button>
      )}

      {editable && !received && (
        <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]/40 p-3">
          <p className="text-xs font-medium">{evaluated ? "Ajustar la evaluación presencial" : "Evaluación presencial"}</p>
          <CurrencyInput value={amount} onChange={setAmount} placeholder="Valor que le ofreces" />
          <textarea
            className="min-h-14 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]"
            value={evalNotes}
            onChange={(e) => setEvalNotes(e.target.value)}
            placeholder="Qué revisaste: estado, detalles, documentos"
            maxLength={1000}
          />
          <button
            type="button"
            onClick={evaluate}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy === "evaluate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {evaluated ? "Actualizar evaluación" : "Registrar evaluación"}
          </button>
          {evaluated && t.evaluatedAt && (
            <p className="text-[11px] text-[var(--muted-foreground)]">Última evaluación: {fmtDateTime(t.evaluatedAt)}</p>
          )}
        </div>
      )}

      {editable && !received && (
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--primary)]">
            <Pencil className="h-3 w-3" /> Editar datos
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--danger,#dc2626)] disabled:opacity-60"
          >
            {busy === "remove" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Quitar
          </button>
        </div>
      )}
    </div>
  );
}
