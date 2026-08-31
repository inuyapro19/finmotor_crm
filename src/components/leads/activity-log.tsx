import { Banknote, Clock, MessageSquare, Phone, PhoneOff, StickyNote, Tag, TrendingUp, UserCog } from "lucide-react";

import { fmtCLP, fmtDateTime } from "@/lib/format";
import { stageLabel, toStage, type LeadActivity } from "@/lib/leads";

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

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Texto de la entrada. Los hitos del negocio (cotización, envío a la financiera) viajan como
 * actividades `system` con metadata; sin traducirlos, la bitácora diría sólo "Sistema".
 */
function describe(activity: LeadActivity): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  detail?: string;
} {
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
  return base;
}

/** Bitácora del lead: qué se hizo, cuándo y quién. Es la memoria de la automotora. */
export function ActivityLog({
  activities,
  createdAt,
  sourceLabel,
}: {
  activities: LeadActivity[];
  createdAt: string | null;
  sourceLabel: string;
}) {
  return (
    <ol className="space-y-3">
      {activities.map((activity) => {
        const meta = describe(activity);
        const from = activity.metadata?.["from"];
        const to = activity.metadata?.["to"];
        return (
          <li key={activity.id} className="flex items-start gap-2.5">
            <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
              <meta.icon className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                {meta.label}
                {meta.detail && <span className="text-[var(--muted-foreground)]"> · {meta.detail}</span>}
                {activity.activityType === "stage_change" && typeof to === "string" && (
                  <span className="text-[var(--muted-foreground)]">
                    {" "}
                    · {typeof from === "string" ? `${stageLabel(toStage(from))} → ` : ""}
                    {stageLabel(toStage(to))}
                  </span>
                )}
              </p>
              {activity.notes && (
                <p className="mt-0.5 whitespace-pre-line text-xs text-[var(--muted-foreground)]">
                  {activity.notes}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                {fmtDateTime(activity.createdAt)}
                {activity.actorName ? ` · ${activity.actorName}` : ""}
              </p>
            </div>
          </li>
        );
      })}

      <li className="flex items-start gap-2.5">
        <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]">
          <Clock className="h-3 w-3" />
        </div>
        <div>
          <p className="text-sm">Solicitud recibida</p>
          <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
            {fmtDateTime(createdAt)} · {sourceLabel}
          </p>
        </div>
      </li>
    </ol>
  );
}
