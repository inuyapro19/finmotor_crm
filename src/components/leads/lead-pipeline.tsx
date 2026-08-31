"use client";

/**
 * Pipeline de la venta. Es la única forma de mover la etapa: antes convivían un selector de
 * etapas y los botones de gestión, y el agente no sabía cuál era el que "contaba".
 *
 * Se lee como un camino: lo recorrido queda marcado, lo que sigue se toca para avanzar. El
 * cierre (vendida / perdida) va aparte y en otro color, porque son decisiones distintas:
 * avanzar es rutina, cerrar es definitivo y una de las dos pide motivo.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, Loader2, Trophy, X } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { STAGES, type LeadStage } from "@/lib/leads";

/** Etapas del camino, sin los cierres. */
const PATH = STAGES.filter((s) => s.key !== "won" && s.key !== "lost");
const CLOSED_PURCHASE_STATUSES = new Set([
  "PAYMENT_CONFIRMED",
  "CONTRACT_SIGNED",
  "TRANSFER_IN_PROGRESS",
  "COMPLETED",
]);

export function LeadPipeline({
  leadId,
  currentStage,
  purchaseStatus,
  canWrite,
}: {
  leadId: string;
  currentStage: LeadStage;
  purchaseStatus: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [askingLost, setAskingLost] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [askingReopen, setAskingReopen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const currentIndex = PATH.findIndex((s) => s.key === currentStage);
  const closed = currentStage === "won" || currentStage === "lost";
  const canMarkWon = Boolean(purchaseStatus && CLOSED_PURCHASE_STATUSES.has(purchaseStatus));
  const completedSale = currentStage === "won" && purchaseStatus === "COMPLETED";
  const reopenTarget: LeadStage = currentStage === "won" ? "documents" : "contacted";

  const move = async (stage: LeadStage, extra?: Record<string, unknown>) => {
    if (stage === currentStage) return;
    setBusy(stage);
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos mover la solicitud");
        return;
      }
      toast.success(stage === "won" ? "¡Venta cerrada!" : "Etapa actualizada");
      setAskingLost(false);
      setLostReason("");
      setAskingReopen(false);
      setReopenReason("");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4">
      <ol className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PATH.map((stage, index) => {
          const done = !closed && index < currentIndex;
          const active = stage.key === currentStage;
          const canAdvance = canWrite && !closed && index > currentIndex;
          return (
            <li key={stage.key} className="min-w-0 flex-1">
              <button
                onClick={() => canAdvance && move(stage.key)}
                disabled={!canAdvance || busy !== null || pending}
                title={done ? `${stage.label} (etapa completada)` : stage.label}
                className={clsx(
                  "group w-full text-left disabled:cursor-default",
                  canAdvance && "cursor-pointer",
                )}
              >
                <span
                  className={clsx(
                    "block h-1.5 rounded-full transition-colors",
                    active
                      ? "bg-[var(--primary)]"
                      : done
                        ? "bg-[var(--primary)]/45"
                        : clsx("bg-[var(--muted)]", canAdvance && "group-hover:bg-[var(--primary)]/25"),
                  )}
                />
                <span
                  className={clsx(
                    "mt-1.5 block truncate text-[10px] leading-tight",
                    active
                      ? "font-semibold text-[var(--foreground)]"
                      : "text-[var(--muted-foreground)]",
                  )}
                >
                  {stage.short}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {closed ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            {currentStage === "won" ? (
              <>
                <Trophy className="h-4 w-4 text-[var(--primary)]" />
                Venta cerrada
              </>
            ) : (
              <>
                <X className="h-4 w-4 text-[var(--muted-foreground)]" />
                Solicitud perdida
              </>
            )}
          </span>
          {canWrite && !completedSale && (
            <button
              onClick={() => setAskingReopen(true)}
              disabled={busy !== null || pending}
              className="text-xs font-medium text-[var(--primary)] disabled:opacity-50"
            >
              Reabrir
            </button>
          )}
        </div>
      ) : (
        canWrite && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => move("won")}
              disabled={busy !== null || pending || !canMarkWon}
              title={canMarkWon ? "Cerrar la oportunidad como vendida" : "Primero registra el pago"}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy === "won" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Marcar vendida
            </button>
            <button
              onClick={() => setAskingLost(true)}
              disabled={busy !== null || pending}
              className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Perdida
            </button>
          </div>
        )
      )}

      {!closed && canWrite && !canMarkWon && (
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          Para marcarla vendida, primero registra el pago en la pestaña Cierre.
        </p>
      )}

      {askingLost && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-3">
          <label htmlFor="lost-reason" className="mb-1.5 block text-xs font-medium text-amber-900">
            ¿Por qué se perdió?
          </label>
          <input
            id="lost-reason"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Compró en otra automotora, no calificó al crédito…"
            className="w-full rounded-[var(--radius-md)] border border-amber-300 bg-white px-3 py-2 text-sm outline-none"
          />
          <p className="mt-1.5 text-[11px] text-amber-800">
            El motivo es lo que después dice dónde se están cayendo las ventas.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => move("lost", { lostReason: lostReason.trim() || null })}
              disabled={busy !== null || pending || !lostReason.trim()}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-amber-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy === "lost" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Marcar perdida
            </button>
            <button
              onClick={() => setAskingLost(false)}
              className="rounded-[var(--radius-md)] border border-amber-300 px-3 py-2 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {askingReopen && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]/30 p-3">
          <label htmlFor="reopen-reason" className="mb-1.5 block text-xs font-medium">
            ¿Por qué se reabre?
          </label>
          <input
            id="reopen-reason"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder={currentStage === "won" ? "Falta corregir documentación…" : "El cliente retomó la compra…"}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
            {currentStage === "won"
              ? "Volverá a Documentos y cierre; la compra y el pago no se eliminan."
              : "Volverá a Contactado para retomar el seguimiento."}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => move(reopenTarget, { reopenReason: reopenReason.trim() })}
              disabled={busy !== null || pending || !reopenReason.trim()}
              className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              {busy === reopenTarget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirmar reapertura
            </button>
            <button
              onClick={() => {
                setAskingReopen(false);
                setReopenReason("");
              }}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
