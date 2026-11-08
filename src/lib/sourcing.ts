import type { Acquisition } from "@/lib/data/crm";

export const SOURCING_STAGES = {
  contact: "Contacto", evaluation: "Evaluación", appraisal: "Tasación",
  negotiation: "Negociación", accepted: "Acuerdo aceptado", received: "Recibido en ERP", cancelled: "Cancelado",
};
export const SOURCING_CHANNELS = {
  whatsapp: "WhatsApp", web: "Web", referral: "Referido", walk_in: "Visita al local", phone: "Teléfono", other: "Otro",
};
export const SOURCING_KINDS = { purchase: "Compra directa", consignment: "Consignación", trade_in: "Parte de pago" };
/** Qué significa cada modalidad para el resto del CRM: solo la parte de pago es una venta. */
export const SOURCING_KIND_FLOW = {
  purchase: "Seguimiento de entrada: test drive e inspección para determinar la condición, tasación y compra. No genera lead.",
  consignment: "Seguimiento de entrada: evaluación, condiciones de consignación y recepción. No genera lead.",
  trade_in: "Es una venta: se abre (o vincula) un lead para el auto que compra. Al aceptar el acuerdo, el valor de recepción se abona a esa compra.",
};
export const VEHICLE_CONDITIONS = { excellent: "Excelente", good: "Buena", fair: "Regular", poor: "Mala" };
export const SALE_URGENCY = { fast: "Quiere venderlo rápido", flexible: "Tiene tiempo para venderlo" };
/** Etiqueta de la etapa según la modalidad (en compra directa la evaluación es el test drive). */
export function stageLabel(stage: keyof typeof SOURCING_STAGES, kind?: keyof typeof SOURCING_KINDS) {
  if (stage === "evaluation" && kind === "purchase") return "Evaluación (test drive e inspección)";
  if (stage === "accepted" && kind === "trade_in") return "Acuerdo aceptado (abonado a la venta)";
  return SOURCING_STAGES[stage];
}
export type SourcingTargetVehicle = { id: string; plate?: string | null; brand?: string | null; model?: string | null; year?: number | null; price?: number | null };
export type SourcingReportRef = { type?: string | null; label?: string | null; filename?: string | null; size?: number | null };
export type SourcingDetails = Pick<Partial<Acquisition>,
  "ownerName" | "ownerRut" | "ownerPhone" | "ownerEmail" | "ownerAddress" | "plate" | "brand" | "model" |
  "year" | "mileage" | "purchasePrice" | "minPrice" | "commissionPct" | "commissionAmount" | "startsAt" | "endsAt" | "notes"
> & {
  tradeInValue?: number | null; requestedPrice?: number | null;
  testDriveAt?: string | null; testDriveDone?: boolean | null;
  vehicleCondition?: keyof typeof VEHICLE_CONDITIONS | null; inspectionNotes?: string | null;
  // Llegan del formulario público; el servidor los conserva y no acepta cambios del CRM.
  consent?: { accepted: boolean; acceptedAt: string; channel: string; text: string } | null;
  saleUrgency?: keyof typeof SALE_URGENCY | null;
  reports?: SourcingReportRef[] | null;
  targetVehicle?: SourcingTargetVehicle | null;
};
/** Venta (lead) vinculada a una parte de pago, tal como la resume GET /sourcing/{id}. */
export type SourcingSale = {
  id: string; stage: string | null; contactName: string | null; vehicleId: string | null;
  tradeInAmount: number | null; tradeInStatus: "pending_evaluation" | "evaluated" | null; abonoApplied: boolean;
};
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
    ambiguous_commission: "Selecciona porcentaje o monto fijo, solo una modalidad de comisión.",
    consignment_terms_required: "Completa comisión y vigencia de la consignación.",
    invalid_consignment_dates: "La fecha de término debe ser posterior al inicio.",
    invalid_sourcing_transition: "Avanza una etapa a la vez. La recepción se confirma desde el ERP.",
    trade_in_lead_required: "Vincula la solicitud de venta antes de aceptar la parte de pago.",
    trade_in_plate_mismatch: "La patente no coincide con el auto en parte de pago registrado en la venta. Corrige una de las dos.",
    purchase_evaluation_required: "Registra el test drive y la condición del vehículo antes de pasar a tasación.",
    invalid_plate: "La patente no tiene un formato chileno válido.",
    trade_in_amount_mismatch: "El valor de recepción no coincide con la parte de pago ya tasada en la venta. Revisa ambos importes.",
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
