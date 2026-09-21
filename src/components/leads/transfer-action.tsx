"use client";

/**
 * "Iniciar transferencia": dispara el trámite real (Nexocar) para la venta cerrada del lead.
 *
 * El gate visible acá es el del CRM (pago informado, y si es financiamiento, crédito
 * aprobado) — es lo que el usuario pidió: "el pago queda informado a menos que sea por
 * crédito, cuando el crédito se aprueba se habilita la transferencia". Si de todos modos
 * faltan requisitos propios de la transferencia real (contrato, cédulas, datos legales de la
 * automotora), el backend los devuelve recién al intentarlo y se listan acá — no se duplican
 * client-side porque pueden cambiar sin que este componente se entere.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat } from "lucide-react";
import { toast } from "sonner";

import { Notice, Pill } from "@/components/ui/primitives";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { TRANSFER_PHASE_HINT, transferStatus } from "@/lib/transfers";
import type { Lead } from "@/lib/leads";

/** Estados de `purchases` desde los que el backend del CRM acepta transferir. Debe ser el
 *  MISMO conjunto que `leads.py::_TRANSFER_READY_STATUSES`: tenía `COMPLETED` de más, así que
 *  el botón se habilitaba y el backend respondía "el pago todavía no está registrado". */
const READY_STATUSES = new Set(["PAYMENT_CONFIRMED", "CONTRACT_SIGNED", "TRANSFER_IN_PROGRESS"]);

const MISSING_LABELS: Record<string, string> = {
  contract_missing: "Falta generar el contrato de compraventa",
  // Los cinco del checklist de transferencia (`documents_service.ensure_document_checklist`).
  // Faltaban tres y salían como "Falta: document:vehicle_registration".
  "document:buyer_identity": "Falta la cédula del comprador",
  "document:sales_contract": "Falta el contrato de compraventa",
  "document:vehicle_registration": "Falta el padrón del vehículo",
  "document:annotations_certificate": "Falta el certificado de anotaciones vigentes",
  "document:unpaid_fines_certificate": "Falta el certificado de multas impagas",
  front_buyer_id_url: "Falta la cédula del comprador (frontal)",
  back_buyer_id_url: "Falta la cédula del comprador (reverso)",
  front_seller_id_url: "Falta la cédula del vendedor (frontal)",
  back_seller_id_url: "Falta la cédula del vendedor (reverso)",
  vehicle_plate_missing: "Falta la patente del vehículo",
  "legal_seller.company_name": "Falta la razón social de la automotora",
  "legal_seller.company_rut": "Falta el RUT de la automotora",
  "legal_seller.rep_name": "Falta el representante legal de la automotora",
  "legal_seller.power_document_url": "Falta el poder notarial de la automotora",
  purchase_not_ready: "La venta todavía no está lista para transferir",
  commercial_blocker_open: "Hay una revisión pendiente que bloquea la transferencia",
};

function missingLabel(code: string): string {
  return MISSING_LABELS[code] ?? `Falta: ${code}`;
}

export function TransferAction({ lead, canManageTransfers }: { lead: Lead; canManageTransfers: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  if (lead.transferStatus) {
    const state = transferStatus(lead.transferStatus);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Pill variant={state.variant}>{state.label}</Pill>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">{TRANSFER_PHASE_HINT[state.phase]}</p>
      </div>
    );
  }

  const saleClosed = Boolean(lead.purchaseId);
  const paymentDone = lead.purchaseStatus ? READY_STATUSES.has(lead.purchaseStatus) : false;
  const financing = lead.paymentMode === "financing";
  const creditOk = !financing || lead.financeStatus === "approved";
  const ready = saleClosed && paymentDone && creditOk;

  const start = async () => {
    setSending(true);
    try {
      const res = await crmFetch(`/api/crm/leads/${lead.id}/transfer`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos iniciar la transferencia");
        return;
      }
      setMissing([]);
      if (!data.ok) {
        if (data.reason === "requirements_missing" && Array.isArray(data.missing)) {
          setMissing(data.missing);
          toast.error("Faltan requisitos para transferir");
        } else if (data.reason === "credit_pending") {
          toast.error("El crédito todavía no está aprobado");
        } else if (data.reason === "credit_rejected") {
          // No es lo mismo que "pendiente": acá no hay nada que esperar.
          toast.error("La financiera rechazó el crédito y el pie ya está cobrado: falta resolver el saldo");
        } else if (data.reason === "sale_not_closed") {
          toast.error("Primero termina la cotización y registra el pago");
        } else {
          toast.error("El pago todavía no está registrado");
        }
        return;
      }
      toast.success("Transferencia iniciada");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSending(false);
    }
  };

  if (!canManageTransfers) {
    return (
      <p className="px-1 text-[11px] text-[var(--muted-foreground)]">
        Tu rol no tiene permiso para iniciar transferencias.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!ready && (
        <Notice tone="warn">
          {!saleClosed
            ? "Falta cotizar y cobrar antes de transferir."
            : financing && !creditOk
              ? "Falta que la financiera apruebe el crédito."
              : "Falta registrar el pago recibido."}
        </Notice>
      )}
      {missing.length > 0 && (
        <Notice tone="warn">
          <ul className="list-disc space-y-0.5 pl-4">
            {missing.map((code) => (
              <li key={code}>{missingLabel(code)}</li>
            ))}
          </ul>
        </Notice>
      )}
      <button
        onClick={start}
        disabled={sending || pending}
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {sending || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat className="h-4 w-4" />}
        Iniciar transferencia
      </button>
    </div>
  );
}
