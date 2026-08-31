"use client";

/**
 * Decisión de la financiera, transcrita a mano. No hay portal para que ella misma la marque —
 * llama o escribe, y quien administra la cartera (no cualquier vendedor de mesón, por eso el
 * gate es `canManageTeam`) la deja registrada acá. Aprobar habilita "Iniciar transferencia".
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { fmtCLP } from "@/lib/format";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { CreditRequest } from "@/lib/data/crm";

export function CreditDecision({
  leadId,
  requests,
  canManageTeam,
}: {
  leadId: string;
  requests: CreditRequest[];
  canManageTeam: boolean;
}) {
  const router = useRouter();
  const [transitionPending, startTransition] = useTransition();
  const [approving, setApproving] = useState(false);
  const [institution, setInstitution] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [sending, setSending] = useState<"approved" | "rejected" | null>(null);

  const pending = requests.find((r) => !["approved", "rejected"].includes(String(r.status)));
  if (!pending) return null;

  const decide = async (status: "approved" | "rejected") => {
    if (status === "approved" && (!institution.trim() || !amount)) {
      setApproving(true);
      return;
    }
    setSending(status);
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}/credit/${pending.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          institutionName: status === "approved" ? institution.trim() : null,
          approvedAmount: status === "approved" ? amount : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos registrar la decisión");
        return;
      }
      toast.success(status === "approved" ? "Crédito aprobado" : "Crédito rechazado");
      setApproving(false);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSending(null);
    }
  };

  if (!canManageTeam) {
    return (
      <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">
        Hay un caso en evaluación ({fmtCLP(pending.amount)}). Sólo un administrador o supervisor
        puede transcribir la respuesta de la financiera.
      </p>
    );
  }

  return (
    <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
      <p className="text-xs text-[var(--muted-foreground)]">
        ¿Qué respondió la financiera sobre {fmtCLP(pending.amount)}?
      </p>

      {approving && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Financiera"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <CurrencyInput value={amount} onChange={setAmount} placeholder="Monto aprobado" />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => decide("approved")}
          disabled={sending !== null || transitionPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {sending === "approved" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {approving ? "Confirmar aprobado" : "Marcar aprobado"}
        </button>
        <button
          onClick={() => decide("rejected")}
          disabled={sending !== null || transitionPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-50"
        >
          {sending === "rejected" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Marcar rechazado
        </button>
      </div>
    </div>
  );
}
