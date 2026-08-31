"use client";

/**
 * Informes para la unidad cotizada, desde la misma ficha.
 *
 * El histórico es automático: la orden queda pagada de entrada (se factura postpago a la
 * automotora, igual que el lote de patentes de `/informes`) y el sistema la genera solo — no
 * hay nada más que hacer acá. El de precompra sigue siendo manual (visita técnica a
 * coordinar), así que el botón sólo deja la constancia en la bitácora del lead en vez de
 * perderse en un chat de WhatsApp aparte.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";

export function ReportActions({
  leadId,
  hasVehicle,
  canWrite,
}: {
  leadId: string;
  hasVehicle: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState<"history" | "inspection" | null>(null);

  const requestHistory = async () => {
    setLoading("history");
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: "standard" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos pedir el informe");
        return;
      }
      toast.success("Informe histórico pedido — se genera solo, revísalo en Informes");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const requestInspection = async () => {
    setLoading("inspection");
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: "note",
          notes: "Informe de precompra pedido: coordinar la visita técnica con el cliente por WhatsApp o correo.",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos dejar el registro");
        return;
      }
      toast.success("Anotado — coordina la visita con el cliente");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <ul className="divide-y divide-[var(--border)]">
      <li className="flex items-start gap-3 px-4 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Informe histórico</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Anotaciones, encargo por robo, historial de la patente. Se genera automático.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={requestHistory}
            disabled={!hasVehicle || loading !== null || pending}
            className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1.5 text-xs disabled:opacity-50"
          >
            {loading === "history" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Pedir
          </button>
        )}
      </li>
      <li className="flex items-start gap-3 px-4 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Informe de precompra</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Revisión técnica en terreno. Se coordina por WhatsApp o correo con el cliente.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={requestInspection}
            disabled={!hasVehicle || loading !== null || pending}
            className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1.5 text-xs disabled:opacity-50"
          >
            {loading === "inspection" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Pedir
          </button>
        )}
      </li>
      {!hasVehicle && (
        <li className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">
          Elige primero la unidad cotizada.
        </li>
      )}
    </ul>
  );
}
