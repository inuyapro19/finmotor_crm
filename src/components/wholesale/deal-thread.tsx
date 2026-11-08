"use client";

/**
 * Hilo de negociación mayorista. Lo usan las DOS partes con la misma pieza:
 *   - proveedor → `side="supplier"`,   BFF `/api/proveedor`
 *   - automotora → `side="dealership"`, BFF `/api/crm/wholesale`
 *
 * Muestra el historial y sólo las acciones que corresponden: responder cuando la oferta
 * vigente es de la otra parte, confirmar el cierre cuando hay trato, cancelar mientras siga
 * abierto. El backend valida todo igual; aquí sólo se evita ofrecer botones que fallarían.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { clsx } from "clsx";

import { CurrencyInput } from "@/components/ui/currency-input";
import { fieldInputClass } from "@/components/ui/form-dialog";
import { Pill } from "@/components/ui/primitives";
import { fmtCLP, fmtDateTime } from "@/lib/format";
import { DEAL_STATUS, eventLabel, type Side, type WholesaleDeal } from "@/lib/wholesale";
import { wholesaleRequest } from "@/lib/wholesale-upload";

export function DealThread({
  deal,
  side,
  apiBase,
  canAct,
  title,
}: {
  deal: WholesaleDeal;
  side: Side;
  apiBase: "/api/proveedor" | "/api/crm/wholesale";
  canAct: boolean;
  title?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [counter, setCounter] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [retailPrice, setRetailPrice] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [askCancel, setAskCancel] = useState(false);

  const status = DEAL_STATUS[deal.status];
  const myConfirmation = side === "supplier" ? deal.supplierConfirmedAt : deal.dealershipConfirmedAt;
  const theirConfirmation = side === "supplier" ? deal.dealershipConfirmedAt : deal.supplierConfirmedAt;
  const open = deal.status === "negotiating" || deal.status === "agreed";

  const run = async (key: string, path: string, body: unknown, success: string) => {
    setBusy(key);
    try {
      await wholesaleRequest(`${apiBase}/deals/${deal.id}/${path}`, "POST", body);
      toast.success(success);
      setCounter(null);
      setMessage("");
      setAskCancel(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos completar la operación.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {title && <p className="truncate text-sm font-semibold">{title}</p>}
          <Pill variant={status.variant}>{status.label}</Pill>
        </div>
        {deal.agreedAmount != null && (
          <p className="text-sm">
            Monto pactado <span className="font-semibold tabular-nums">{fmtCLP(deal.agreedAmount)}</span>
          </p>
        )}
      </div>

      {/* Historial */}
      <ol className="space-y-2 border-l border-[var(--border)] pl-4">
        {(deal.events ?? []).map((event, index) => (
          <li key={index} className="relative">
            <span
              aria-hidden
              className={clsx(
                "absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--card)]",
                event.side === side ? "bg-[var(--primary)]" : event.side === "system" ? "bg-[var(--fm-lime)]" : "bg-[var(--fm-navy)]",
              )}
            />
            <p className="text-sm">
              <span className="font-medium">{eventLabel(event, side)}</span>
              {event.amount != null && <span className="ml-1 tabular-nums">· {fmtCLP(event.amount)}</span>}
            </p>
            {event.message && <p className="text-xs text-[var(--muted-foreground)]">“{event.message}”</p>}
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {[event.actorName, fmtDateTime(event.createdAt)].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ol>

      {/* Responder a la oferta vigente de la otra parte */}
      {canAct && deal.awaitingMe && deal.pendingAmount != null && (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--primary)]/30 bg-[var(--accent)]/40 p-3">
          <p className="text-sm">
            {side === "supplier" ? "La automotora ofrece" : "El proveedor pide"}{" "}
            <span className="font-semibold tabular-nums">{fmtCLP(deal.pendingAmount)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!!busy}
              onClick={() => run("accept", "respond", { action: "accept", version: deal.version },
                "Oferta aceptada. Coordinen la transferencia fuera de Finmotor.")}
              className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy === "accept" && <Loader2 className="h-4 w-4 animate-spin" />}
              Aceptar {fmtCLP(deal.pendingAmount)}
            </button>
            <button
              disabled={!!busy}
              onClick={() => run("reject", "respond", { action: "reject", version: deal.version, message: message || undefined },
                "Oferta rechazada.")}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
            >
              Rechazar
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <CurrencyInput value={counter} onChange={setCounter} placeholder="Contraoferta" />
            <button
              disabled={!!busy || !counter}
              onClick={() => run("counter", "respond",
                { action: "counter", amount: counter, version: deal.version, message: message || undefined },
                "Contraoferta enviada.")}
              className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy === "counter" && <Loader2 className="h-4 w-4 animate-spin" />}
              Contraofertar
            </button>
          </div>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            placeholder="Mensaje opcional para la otra parte"
            className={clsx(fieldInputClass, "text-sm")}
          />
        </div>
      )}

      {deal.status === "negotiating" && !deal.awaitingMe && deal.pendingAmount != null && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Tu oferta de {fmtCLP(deal.pendingAmount)} está vigente. Te avisaremos cuando la otra parte responda.
        </p>
      )}

      {/* Cierre de dos firmas */}
      {deal.status === "agreed" && (
        <div className="space-y-3 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50/60 p-3 text-sm">
          <p className="font-medium">Transferencia y pago fuera de Finmotor</p>
          <ul className="space-y-1 text-xs">
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className={clsx("h-4 w-4", deal.supplierConfirmedAt ? "text-emerald-600" : "text-[var(--muted-foreground)]/40")} />
              Proveedor: pago recibido y transferencia firmada {deal.supplierConfirmedAt && `· ${fmtDateTime(deal.supplierConfirmedAt)}`}
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className={clsx("h-4 w-4", deal.dealershipConfirmedAt ? "text-emerald-600" : "text-[var(--muted-foreground)]/40")} />
              Automotora: vehículo recibido {deal.dealershipConfirmedAt && `· ${fmtDateTime(deal.dealershipConfirmedAt)}`}
            </li>
          </ul>
          {canAct && !myConfirmation && side === "supplier" && (
            <button
              disabled={!!busy}
              onClick={() => run("confirm", "confirm-transfer", { version: deal.version },
                theirConfirmation ? "Trato completado. La unidad pasó al stock de la automotora." : "Confirmación registrada.")}
              className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {busy === "confirm" && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar pago recibido y transferencia firmada
            </button>
          )}
          {canAct && !myConfirmation && side === "dealership" && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--muted-foreground)]">
                {deal.auctionId
                  ? "Con ambas confirmaciones, la unidad ingresa a tu stock pendiente de publicación. Define su precio de venta al público."
                  : "Al confirmar, la unidad se agrega a tu stock y queda publicada a nombre de tu automotora con este precio. Lo puedes editar después desde Stock de vehículos."}
              </p>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <CurrencyInput value={retailPrice} onChange={setRetailPrice} placeholder="Precio de venta al público" />
                <button
                  disabled={!!busy || !retailPrice}
                  onClick={() => run("confirm", "confirm-receipt", { retailPrice, version: deal.version },
                    theirConfirmation ? (deal.auctionId ? "Unidad agregada a tu stock, pendiente de publicación." : "Unidad agregada a tu stock y publicada.") : "Recepción confirmada. Falta la confirmación del proveedor.")}
                  className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {busy === "confirm" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Confirmar vehículo recibido
                </button>
              </div>
            </div>
          )}
          {myConfirmation && !theirConfirmation && (
            <p className="text-xs text-[var(--muted-foreground)]">Ya confirmaste. Falta la confirmación de la otra parte.</p>
          )}
        </div>
      )}

      {deal.status === "completed" && side === "dealership" && deal.vehicleId && (
        <Link href={`/vehiculos/editar/${deal.vehicleId}`} className="inline-block text-sm font-medium underline">
          Ver la unidad en tu stock
        </Link>
      )}
      {deal.cancelReason && deal.status === "cancelled" && (
        <p className="text-xs text-[var(--muted-foreground)]">Motivo: {deal.cancelReason}</p>
      )}

      {canAct && open && (!deal.auctionId || (side === "supplier" && !deal.supplierConfirmedAt && !deal.dealershipConfirmedAt)) && (
        askCancel ? (
          <div className="space-y-2">
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              maxLength={500}
              placeholder="Motivo (lo verá la otra parte)"
              className={clsx(fieldInputClass, "text-sm")}
            />
            <div className="flex gap-2">
              <button
                disabled={!!busy || (!!deal.auctionId && !cancelReason.trim())}
                onClick={() => run("cancel", "cancel", { reason: cancelReason || undefined },
                  deal.auctionId ? "Adjudicación cancelada. La unidad queda retirada." : deal.status === "agreed" ? "Trato cancelado. La unidad vuelve al marketplace." : "Negociación cancelada.")}
                className="rounded-[var(--radius-md)] bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                Confirmar cancelación
              </button>
              <button onClick={() => setAskCancel(false)} className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm">
                Volver
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAskCancel(true)} className="text-xs text-red-700 underline">
            {deal.status === "agreed" ? "Cancelar el trato" : "Cancelar la negociación"}
          </button>
        )
      )}
    </div>
  );
}
