"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel, Timer, Trophy, TrendingUp, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { fmtCLP } from "@/lib/format";
import { wholesaleRequest } from "@/lib/wholesale-upload";
import type { WholesaleListing } from "@/lib/wholesale";

/** Segundos en que la puja queda en espera antes de enviarse (la puja es vinculante). */
const UNDO_SECONDS = 3;

function remainingLabel(ms: number): string {
  if (ms <= 0) return "Cerrada";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Reloj de cierre sincronizado con la hora del servidor (no con el reloj del equipo). */
function useRemaining(endsAt: string, serverTime: string): number {
  const offset = useRef(new Date(serverTime).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset.current);
  useEffect(() => {
    offset.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return new Date(endsAt).getTime() - now;
}

/**
 * Puja en un clic: el monto ya viene calculado (mínimo siguiente) y hay atajos de incremento.
 * Como la puja no se puede retirar, se envía tras unos segundos con opción de cancelar.
 * Se usa en la tarjeta del marketplace (`compact`) y en la ficha.
 */
export function QuickBid({ listing, canBuy, compact = false }: {
  listing: WholesaleListing; canBuy: boolean; compact?: boolean;
}) {
  const router = useRouter();
  const auction = listing.auction;
  const remaining = useRemaining(auction?.endsAt ?? new Date().toISOString(), auction?.serverTime ?? new Date().toISOString());
  const [pending, setPending] = useState<{ amount: number; left: number } | null>(null);
  const [sending, setSending] = useState(false);
  const timer = useRef<number | null>(null);
  const requestId = useRef<{ amount: number; id: string } | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  if (!auction || auction.status !== "open") return null;
  const open = remaining > 0;
  const outbid = !auction.isLeading && !!listing.myParticipation;
  const canBid = canBuy && listing.status === "published" && open;

  const send = async (amount: number) => {
    if (!requestId.current || requestId.current.amount !== amount) {
      requestId.current = { amount, id: crypto.randomUUID() };
    }
    setSending(true);
    try {
      await wholesaleRequest(`/api/crm/wholesale/listings/${listing.id}/bids`, "POST", {
        amount, requestId: requestId.current.id,
      });
      requestId.current = null;
      toast.success(`Puja de ${fmtCLP(amount)} registrada. Vas ganando.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos registrar la puja.");
    } finally {
      setSending(false);
      router.refresh();
    }
  };

  const start = (amount: number) => {
    if (!canBid || pending || sending) return;
    setPending({ amount, left: UNDO_SECONDS });
    timer.current = window.setInterval(() => {
      setPending((current) => {
        if (!current) return null;
        if (current.left <= 1) {
          if (timer.current) window.clearInterval(timer.current);
          timer.current = null;
          void send(current.amount);
          return null;
        }
        return { ...current, left: current.left - 1 };
      });
    }, 1000);
  };

  const cancel = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setPending(null);
    toast("Puja cancelada. No se envió nada.");
  };

  // Dentro de la tarjeta (que es un <Link>), los clics de la puja no deben navegar.
  const stop = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const next = auction.nextMinimum;
  const shortcuts = [1, 3].map((steps) => next + steps * auction.minIncrement);

  return (
    <div onClick={stop} className={compact ? "space-y-2" : "space-y-3"} aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: remaining < 3600_000 ? "#b91c1c" : "var(--fm-ink-500)" }}>
          <Timer className="h-3.5 w-3.5" /> {open ? `Cierra en ${remainingLabel(remaining)}` : "Cerrada · adjudicando"}
        </span>
        {auction.isLeading && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={{ background: "#dcfce7", color: "#166534" }}>
            <Trophy className="h-3 w-3" /> Vas ganando
          </span>
        )}
        {outbid && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold" style={{ background: "#fee2e2", color: "#991b1b" }}>
            <TrendingUp className="h-3 w-3" /> Te superaron
          </span>
        )}
        {!auction.isLeading && !outbid && (
          <span style={{ color: "var(--fm-ink-400)" }}>{auction.bidCount} {auction.bidCount === 1 ? "puja" : "pujas"}</span>
        )}
      </div>

      {canBid && (pending ? (
        <button type="button" onClick={cancel}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold"
          style={{ borderColor: "var(--fm-teal-600)", color: "var(--fm-teal-600)", background: "#fff" }}>
          <Undo2 className="h-4 w-4" /> Enviando {fmtCLP(pending.amount)} en {pending.left}s · Cancelar
        </button>
      ) : (
        <>
          <button type="button" onClick={() => start(next)} disabled={sending || auction.isLeading}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--fm-green-600)" }}>
            <Gavel className="h-4 w-4" />
            {sending ? "Registrando…" : auction.isLeading ? "Tu puja es la más alta" : `Pujar ${fmtCLP(next)}`}
          </button>
          {!auction.isLeading && (
            <div className="grid grid-cols-2 gap-2">
              {shortcuts.map((amount) => (
                <button key={amount} type="button" onClick={() => start(amount)} disabled={sending}
                  className="rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: "var(--fm-border)", color: "var(--fm-teal-600)", background: "#fff" }}>
                  {fmtCLP(amount)}
                </button>
              ))}
            </div>
          )}
        </>
      ))}
      {!compact && canBid && (
        <p className="text-xs" style={{ color: "var(--fm-ink-500)" }}>
          La puja es vinculante: tienes {UNDO_SECONDS} segundos para cancelarla antes de que se envíe. Gana la mayor puja al cierre.
        </p>
      )}
      {!canBuy && !compact && (
        <p className="text-xs">Solo dueños, administradores y supervisores de la automotora pueden pujar.</p>
      )}
    </div>
  );
}
