/**
 * Vocabulario de estado de una transferencia (`transfer_orders.status`).
 *
 * Fuente única para la tabla de Transferencias, el paso "Transferencia" de la pestaña Cierre
 * y el aviso de la ficha del lead — que hasta ahora mostraba el valor crudo del backend
 * ("Transferencia iniciada — estado SUBMITTED") y daba por "En curso" cualquier estado,
 * incluidos los tres que ya terminaron.
 *
 * `PENDING` es el default de la columna en la base; hoy `start_transfer` siempre escribe un
 * estado explícito, así que una orden en PENDING significa que se creó la fila y el trámite
 * todavía no salió.
 */
import type { PillVariant } from "@/components/ui/primitives";

export type TransferPhase = "pending" | "running" | "done" | "failed";

export const TRANSFER_STATUS: Record<
  string,
  { label: string; variant: PillVariant; phase: TransferPhase }
> = {
  PENDING: { label: "Pendiente", variant: "neutral", phase: "pending" },
  SUBMITTED: { label: "Enviada al registro", variant: "info", phase: "running" },
  BUYER_SIGNED: { label: "Firmó el comprador", variant: "info", phase: "running" },
  SELLER_SIGNED: { label: "Firmó el vendedor", variant: "info", phase: "running" },
  COMPLETED: { label: "Inscrita", variant: "success", phase: "done" },
  FAILED: { label: "Fallida", variant: "danger", phase: "failed" },
  EXPIRED: { label: "Vencida", variant: "danger", phase: "failed" },
  CANCELLED: { label: "Cancelada", variant: "danger", phase: "failed" },
};

export function transferStatus(status: string | null | undefined): {
  label: string;
  variant: PillVariant;
  phase: TransferPhase;
} {
  const key = String(status ?? "").trim().toUpperCase();
  return TRANSFER_STATUS[key] ?? { label: key || "Sin estado", variant: "neutral", phase: "pending" };
}

/**
 * Qué hacer según en qué quedó el trámite. Una transferencia fallida o vencida no es el final
 * del camino: se reintenta desde la pestaña Transferencias.
 */
export const TRANSFER_PHASE_HINT: Record<TransferPhase, string> = {
  pending: "La orden está creada y el trámite todavía no sale.",
  running: "El trámite está en curso en el registro civil.",
  done: "El vehículo quedó inscrito a nombre del comprador.",
  failed: "El trámite no llegó a término. Puedes reintentarlo desde Transferencias.",
};
