import type { Acquisition } from "@/lib/data/crm";

export const SOURCING_STAGES = {
  contact: "Contacto", evaluation: "Evaluación", appraisal: "Tasación",
  negotiation: "Negociación", accepted: "Acuerdo aceptado", received: "Recibido en ERP", cancelled: "Cancelado",
};
export const SOURCING_CHANNELS = {
  whatsapp: "WhatsApp", web: "Web", referral: "Referido", walk_in: "Visita al local", phone: "Teléfono", other: "Otro",
};
export const SOURCING_KINDS = { purchase: "Compra directa", consignment: "Consignación", trade_in: "Parte de pago" };
export type SourcingDetails = Pick<Partial<Acquisition>,
  "ownerName" | "ownerRut" | "ownerPhone" | "ownerEmail" | "ownerAddress" | "plate" | "brand" | "model" |
  "year" | "mileage" | "purchasePrice" | "minPrice" | "commissionPct" | "startsAt" | "endsAt" | "notes"
> & { tradeInValue?: number | null };
export type SourcingOpportunity = {
  id: string; organizationId: string;
  channel: keyof typeof SOURCING_CHANNELS; kind: keyof typeof SOURCING_KINDS; stage: keyof typeof SOURCING_STAGES;
  details: SourcingDetails; relatedLeadId: string | null; vehicleId: string | null;
  acquisitionId: string | null; version: number; createdAt: string; updatedAt: string;
};

export function sourcingError(detail: unknown) {
  if (Array.isArray(detail)) return "Revisa los datos: nombre obligatorio, importes positivos y fechas válidas.";
  const messages: Record<string, string> = {
    sourcing_not_found: "La captación no existe.",
    sourcing_out_of_scope: "No tienes acceso a esta captación.",
    sourcing_closed: "La captación está cerrada y conserva los datos del acuerdo.",
    sourcing_version_conflict: "Otra persona modificó la captación. Recarga antes de guardar.",
    sourcing_vehicle_required: "Completa patente, marca, modelo y año antes de aceptar el acuerdo.",
    sourcing_amount_required: "Completa el valor acordado antes de aceptar.",
    consignment_terms_required: "Completa comisión y vigencia de la consignación.",
    invalid_consignment_dates: "La fecha de término debe ser posterior al inicio.",
    invalid_sourcing_transition: "Avanza una etapa a la vez. La recepción se confirma desde el ERP.",
    trade_in_lead_required: "Vincula la solicitud de venta antes de aceptar la parte de pago.",
    trade_in_amount_mismatch: "El valor de recepción no coincide con la parte de pago guardada en la cotización. Revisa ambos importes.",
    trade_in_already_linked: "Esta venta ya tiene una captación de parte de pago. Ábrela desde la cotización.",
    lead_not_found: "La solicitud de venta no existe.",
    lead_out_of_scope: "La solicitud de venta pertenece a otra automotora.",
    lead_not_assigned_to_you: "La solicitud de venta no está asignada a tu cartera.",
    sourcing_already_received: "Esta captación ya fue recibida. Abre su ficha de stock desde Captación de vehículos.",
    sourcing_not_accepted: "Primero debes aceptar el acuerdo de captación.",
    sourcing_terms_changed: "Los datos de recepción difieren del acuerdo. Actualiza primero la captación.",
  };
  return messages[String(detail)] ?? "No pudimos guardar la captación. Intenta nuevamente.";
}
