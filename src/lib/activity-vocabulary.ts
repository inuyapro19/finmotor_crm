/**
 * Vocabulario unico de la bitacora: como se llama cada hito del lead de cara al vendedor.
 *
 * Vive aparte porque lo usan DOS pantallas -- la pestana Historial y el "Como viene
 * avanzando" de Inteligencia MIA. Cuando cada una traducia por su lado, la segunda mostraba
 * los codigos crudos de la base ("system", "stage_change") y dos hitos distintos se veian
 * como dos filas identicas que decian "system".
 */
import { Banknote, CalendarClock, Car, CheckCircle2, Clock, FileCheck2, FileText, MessageSquare, Phone, PhoneOff, StickyNote, Tag, TrendingUp, UserCog } from "lucide-react";

import { creditStatusLabel } from "@/lib/credit";
import { fmtCLP, fmtDateTime } from "@/lib/format";

export type ActivityLike = {
  activityType: string;
  metadata?: Record<string, unknown> | null;
};

export type ActivityDescription = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  detail?: string;
};

const ACTIVITY_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  call: { label: "Llamada", icon: Phone },
  no_answer: { label: "No contestó", icon: PhoneOff },
  whatsapp: { label: "WhatsApp", icon: MessageSquare },
  message_sent: { label: "Mensaje enviado", icon: MessageSquare },
  email: { label: "Correo", icon: MessageSquare },
  visit: { label: "Visita", icon: Clock },
  meeting: { label: "Reunión", icon: Clock },
  note: { label: "Nota", icon: StickyNote },
  stage_change: { label: "Cambio de etapa", icon: TrendingUp },
  assignment: { label: "Reasignación", icon: UserCog },
  system: { label: "Sistema", icon: Clock },
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "efectivo",
  transfer: "transferencia",
  card: "tarjeta",
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Texto de la entrada. Los hitos del negocio (cotización, envío a la financiera) viajan como
 * actividades `system` con metadata; sin traducirlos, la bitácora diría sólo "Sistema".
 */
export function describeActivity(activity: ActivityLike): ActivityDescription {
  const base = ACTIVITY_META[activity.activityType] ?? ACTIVITY_META.system;
  if (activity.activityType === "assignment") {
    const meta = activity.metadata ?? {};
    const fromName = typeof meta["fromName"] === "string" ? meta["fromName"] : null;
    const toName = typeof meta["toName"] === "string" ? meta["toName"] : null;
    const detail = toName
      ? fromName
        ? `${fromName} → ${toName}`
        : `Asignada a ${toName}`
      : "Sin responsable";
    return { label: base.label, icon: base.icon, detail };
  }
  // El cierre automatico de la venta llega como `stage_change` (porque LO ES) pero con su
  // propio `event` en la metadata: sin resolverlo antes del corte de abajo diria solo
  // "Cambio de etapa", perdiendo que no lo movio una persona sino la transferencia.
  if ((activity.metadata ?? {})["event"] === "sale_completed") {
    return { label: "Venta cerrada: la transferencia se completó", icon: CheckCircle2 };
  }
  if (activity.activityType !== "system") return base;

  const meta = activity.metadata ?? {};
  if (meta["event"] === "quote_updated") {
    const price = num(meta["quotedPrice"]);
    const down = num(meta["downPayment"]);
    const parts = [
      price !== null ? `precio ${fmtCLP(price)}` : null,
      down ? `pie ${fmtCLP(down)}` : null,
    ].filter(Boolean);
    return { label: "Cotización actualizada", icon: Tag, detail: parts.join(" · ") || undefined };
  }
  if (meta["event"] === "credit_requested") {
    const amount = num(meta["amount"]);
    const term = num(meta["termMonths"]);
    const quota = num(meta["monthlyPayment"]);
    const parts = [
      amount !== null ? fmtCLP(amount) : null,
      term ? `${term} meses` : null,
      quota ? `cuota ${fmtCLP(quota)}` : null,
    ].filter(Boolean);
    return {
      label: "Financiamiento enviado a evaluación",
      icon: Banknote,
      detail: parts.join(" · ") || undefined,
    };
  }
  if (meta["event"] === "document_uploaded" || meta["event"] === "document_removed") {
    const fileName = typeof meta["fileName"] === "string" ? meta["fileName"] : undefined;
    return {
      label: meta["event"] === "document_uploaded" ? "Documento subido a la carpeta" : "Documento eliminado de la carpeta",
      icon: FileText,
      detail: fileName,
    };
  }
  if (meta["event"] === "vehicle_changed") {
    const listPrice = num(meta["listPrice"]);
    return {
      label: "El cliente avanza con otro vehículo",
      icon: Car,
      detail: [meta["vehicleLabel"], typeof meta["plate"] === "string" ? meta["plate"] : null, listPrice ? `lista ${fmtCLP(listPrice)}` : null]
        .filter(Boolean)
        .join(" · ") || undefined,
    };
  }
  if (meta["event"] === "trade_in_updated" || meta["event"] === "trade_in_removed") {
    const removed = meta["event"] === "trade_in_removed";
    return {
      label: removed ? "Vehículo en parte de pago quitado" : "Vehículo en parte de pago registrado",
      icon: Car,
      detail: [meta["vehicleLabel"], typeof meta["plate"] === "string" ? meta["plate"] : null].filter(Boolean).join(" · ") || undefined,
    };
  }
  if (meta["event"] === "trade_in_evaluated") {
    const amount = num(meta["amount"]);
    return {
      label: "Parte de pago evaluado presencialmente",
      icon: CheckCircle2,
      detail: [typeof meta["plate"] === "string" ? meta["plate"] : null, amount ? fmtCLP(amount) : null].filter(Boolean).join(" · ") || undefined,
    };
  }
  if (meta["event"] === "final_offer_issued") {
    const financed = num(meta["financedAmount"]);
    const version = num(meta["version"]);
    return {
      label: version && version > 1 ? `Oferta definitiva ajustada (v${version})` : "Oferta definitiva emitida",
      icon: FileCheck2,
      detail: [num(meta["price"]) ? fmtCLP(num(meta["price"]) as number) : null, financed ? `financia ${fmtCLP(financed)}` : "sin financiamiento"]
        .filter(Boolean)
        .join(" · "),
    };
  }
  if (meta["event"] === "core_solicitud_created") {
    const folio = num(meta["folio"]);
    return {
      label: "Evaluación enviada a Finmotor Core",
      icon: Banknote,
      detail: [folio ? `folio ${folio}` : null, typeof meta["estado"] === "string" ? meta["estado"] : null].filter(Boolean).join(" · ") || undefined,
    };
  }
  if (meta["event"] === "core_estado_changed") {
    const folio = num(meta["folio"]);
    const to = typeof meta["to"] === "string" ? meta["to"] : "";
    return {
      label: `Finmotor Core: solicitud ${to || "actualizada"}`,
      icon: to === "rechazada" ? Clock : CheckCircle2,
      detail: folio ? `folio ${folio}` : undefined,
    };
  }
  if (meta["event"] === "financial_documents_expired") {
    const count = num(meta["count"]);
    return {
      label: "Documentos financieros eliminados por política de privacidad",
      icon: FileText,
      detail: count ? `${count} ${count === 1 ? "archivo" : "archivos"} · sin actividad por más de un mes` : undefined,
    };
  }
  const vehicleLabel = typeof meta["vehicleLabel"] === "string" ? meta["vehicleLabel"] : null;
  const plate = typeof meta["plate"] === "string" ? meta["plate"] : null;
  const vehicleDetail = [vehicleLabel, plate].filter(Boolean).join(" · ") || undefined;
  if (meta["event"] === "lead_vehicle_added") {
    return { label: "Unidad agregada para evaluar", icon: Car, detail: vehicleDetail };
  }
  if (meta["event"] === "lead_vehicle_selected") {
    return { label: "Unidad elegida para continuar", icon: CheckCircle2, detail: vehicleDetail };
  }
  if (meta["event"] === "test_drive_scheduled") {
    const scheduledAt = typeof meta["scheduledAt"] === "string" ? fmtDateTime(meta["scheduledAt"]) : null;
    return {
      label: "Test drive agendado",
      icon: CalendarClock,
      detail: [vehicleDetail, scheduledAt].filter(Boolean).join(" · ") || undefined,
    };
  }
  if (meta["event"] === "test_drive_completed") {
    return { label: "Test drive realizado", icon: CheckCircle2, detail: vehicleDetail };
  }
  if (meta["event"] === "test_drive_cancelled" || meta["event"] === "test_drive_no_show") {
    return {
      label: meta["event"] === "test_drive_no_show" ? "Cliente no asistió al test drive" : "Test drive cancelado",
      icon: CalendarClock,
      detail: vehicleDetail,
    };
  }
  if (meta["event"] === "report_requested" || meta["event"] === "report_reused") {
    return {
      label: meta["event"] === "report_reused" ? "Informe histórico reciente reutilizado" : "Informe histórico solicitado",
      icon: Tag,
      detail: plate || undefined,
    };
  }
  if (meta["event"] === "prepurchase_scheduled") {
    const scheduledAt = typeof meta["scheduledAt"] === "string" ? fmtDateTime(meta["scheduledAt"]) : null;
    return {
      label: "Informe de precompra agendado",
      icon: CalendarClock,
      detail: [plate, scheduledAt].filter(Boolean).join(" · ") || undefined,
    };
  }
  if (meta["event"] === "prepurchase_completed") {
    return { label: "Informe de precompra entregado", icon: CheckCircle2, detail: plate || undefined };
  }
  if (meta["event"] === "financing_requested_from_vehicle") {
    return { label: "Financiamiento pedido desde la ficha del auto", icon: Banknote };
  }
  if (meta["event"] === "credit_approved" || meta["event"] === "credit_rejected") {
    const approved = meta["event"] === "credit_approved";
    const institution = typeof meta["institutionName"] === "string" ? meta["institutionName"] : null;
    const amount = num(meta["approvedAmount"]);
    return {
      label: approved ? "La financiera aprobó el crédito" : "La financiera rechazó el crédito",
      icon: Banknote,
      detail: approved
        ? [institution, amount !== null ? fmtCLP(amount) : null].filter(Boolean).join(" · ") || undefined
        : undefined,
    };
  }
  if (meta["event"] === "credit_disbursed") {
    return { label: "El crédito fue cursado", icon: CheckCircle2, detail: typeof meta["institutionName"] === "string" ? meta["institutionName"] : undefined };
  }
  if (meta["event"] === "payment_reported") {
    const amount = num(meta["amount"]);
    const method = typeof meta["method"] === "string" ? PAYMENT_METHOD_LABEL[meta["method"]] : null;
    return {
      label: "Pago recibido en el mostrador",
      icon: Banknote,
      detail: [amount !== null ? fmtCLP(amount) : null, method].filter(Boolean).join(" · ") || undefined,
    };
  }
  if (meta["event"] === "sale_cancelled") {
    return { label: "Venta anulada y auto devuelto a la vitrina", icon: Car };
  }
  if (meta["event"] === "transfer_started") {
    return { label: "Transferencia iniciada", icon: CheckCircle2 };
  }
  if (meta["event"] === "inbound_transfer_created") {
    return { label: "Transferencia de ingreso creada", icon: CheckCircle2 };
  }
  if (meta["event"] === "task_created" || meta["event"] === "task_done" || meta["event"] === "task_cancelled") {
    const title = typeof meta["title"] === "string" ? meta["title"] : undefined;
    const label =
      meta["event"] === "task_created"
        ? "Tarea agendada"
        : meta["event"] === "task_done"
          ? "Tarea completada"
          : "Tarea cancelada";
    return { label, icon: CalendarClock, detail: title };
  }
  if (meta["event"] === "seller_visit_scheduled") {
    const scheduledAt = typeof meta["scheduledAt"] === "string" ? fmtDateTime(meta["scheduledAt"]) : null;
    return {
      label: "Visita con el vendedor agendada",
      icon: CalendarClock,
      detail: [plate, scheduledAt].filter(Boolean).join(" · ") || undefined,
    };
  }
  return base;
}

/**
 * Hitos que el motor MIA-CRM reconstruye y que NO son actividades de la bitacora: el alta del
 * lead, la visita agendada y el envio a la financiera los arma `reconstruct_process_path`
 * cruzando otras tablas, asi que no tienen fila en `lead_activities` que traducir.
 */
const ENGINE_MILESTONES: Record<string, ActivityDescription> = {
  lead_created: { label: "Entró la solicitud", icon: StickyNote },
  visit_scheduled: { label: "Visita agendada", icon: CalendarClock },
  financing_requested: { label: "Financiamiento enviado a la financiera", icon: Banknote },
};

const VISIT_STATUS_LABEL: Record<string, string> = {
  scheduled: "agendada",
  confirmed: "confirmada",
  completed: "realizada",
  cancelled: "cancelada",
  no_show: "el cliente no llegó",
};

/** El mismo vocabulario de `lib/credit`, en minúscula porque aquí va dentro de una frase. */
function creditStatusPhrase(status: string): string {
  return creditStatusLabel(status).toLowerCase();
}

/** Un hito del "Como viene avanzando", ya en castellano. */
export function describeMilestone(event: {
  event: string;
  detail?: string | null;
  metadata?: Record<string, unknown> | null;
}): ActivityDescription {
  const meta = event.metadata ?? {};
  const milestone = ENGINE_MILESTONES[event.event];
  if (milestone) {
    const visitStatus = typeof meta["visitStatus"] === "string" ? VISIT_STATUS_LABEL[meta["visitStatus"]] : null;
    const credit = typeof meta["creditStatus"] === "string" ? creditStatusPhrase(meta["creditStatus"]) : null;
    return { ...milestone, detail: visitStatus ?? credit ?? event.detail ?? undefined };
  }
  const described = describeActivity({ activityType: event.event, metadata: meta });
  return { ...described, detail: described.detail ?? event.detail ?? undefined };
}
