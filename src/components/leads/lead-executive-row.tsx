import Link from "next/link";
import { clsx } from "clsx";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Globe2,
  MessageCircle,
  Phone,
  Sparkles,
  Store,
  UserPlus,
  Users,
} from "lucide-react";

import { Pill } from "@/components/ui/primitives";
import { fmtCLP, fmtDateTime, timeAgo } from "@/lib/format";
import {
  SALES_PATH,
  SLA_LABEL,
  isActionOverdue,
  leadValue,
  slaLevel,
  sourceLabel,
  stageLabel,
  stageStep,
  type Lead,
  type LeadStage,
} from "@/lib/leads";


const SLA_VARIANT = { ok: "success", warn: "warn", late: "danger" } as const;

const SOURCE_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  whatsapp: { icon: MessageCircle, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  platform: { icon: Globe2, tone: "border-blue-200 bg-blue-50 text-blue-800" },
  web: { icon: Globe2, tone: "border-blue-200 bg-blue-50 text-blue-800" },
  mia: { icon: Sparkles, tone: "border-violet-200 bg-violet-50 text-violet-800" },
  phone: { icon: Phone, tone: "border-sky-200 bg-sky-50 text-sky-800" },
  walk_in: { icon: Store, tone: "border-amber-200 bg-amber-50 text-amber-900" },
  referral: { icon: Users, tone: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800" },
  portal: { icon: ExternalLink, tone: "border-indigo-200 bg-indigo-50 text-indigo-800" },
  chileautos: { icon: ExternalLink, tone: "border-orange-200 bg-orange-50 text-orange-900" },
  mercadolibre: { icon: ExternalLink, tone: "border-yellow-300 bg-yellow-50 text-yellow-900" },
  meta: { icon: ExternalLink, tone: "border-blue-200 bg-blue-50 text-blue-800" },
  manual: { icon: UserPlus, tone: "border-slate-200 bg-slate-50 text-slate-700" },
};

/**
 * OPS del motor MIA-CRM: margen esperado por dia. Es el numero que explica por que este
 * lead esta donde esta en la cola (R-PRI-01) -- ordenar sin mostrarlo dejaria al vendedor
 * obedeciendo un orden que no puede cuestionar.
 *
 * Un OPS `provisional` descansa en un margen estimado, no en el costo real de adquisicion:
 * se marca distinto para no darle la misma certeza que a uno validado (R-PRI-02).
 */
function OpportunityScore({ lead }: { lead: Lead }) {
  if (lead.opportunityScore === null) return null;
  const provisional = lead.opportunityConfidence === "provisional";
  return (
    <span
      title={
        provisional
          ? "Prioridad MIA estimada: el margen no viene del costo real de adquisicion"
          : "Prioridad MIA: margen esperado por dia, con costo real de adquisicion"
      }
      className={clsx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        provisional
          ? "bg-amber-50 text-amber-700"
          : "bg-[var(--fm-lime)]/20 text-[var(--fm-navy)]",
      )}
    >
      <Sparkles className="h-3 w-3" />
      {fmtCLP(lead.opportunityScore)}/dia
      {provisional && <span className="font-normal">est.</span>}
    </span>
  );
}


export function LeadExecutiveRow({ lead, showAssignee }: { lead: Lead; showAssignee: boolean }) {
  const value = leadValue(lead);
  const contacted = Boolean(lead.firstContactedAt) || !["new", "lost"].includes(lead.stage);
  const overdue = isActionOverdue(lead);
  const sla = slaLevel(lead);

  return (
    <tr className="group border-b border-[var(--border)] bg-white align-middle transition-colors last:border-b-0 hover:bg-[#f8faff]">
      <td className="px-4 py-3.5">
        <Link href={`/solicitudes/${lead.id}`} className="block min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--fm-navy)]">{lead.contactName}</span>
            {lead.priority > 0 && <Pill variant="warn">Prioridad</Pill>}
          </div>
          <div className="mt-1"><OpportunityScore lead={lead} /></div>
          <p className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">
            {lead.contactPhone || lead.contactEmail || "Sin teléfono ni correo"}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">Ingresó {timeAgo(lead.createdAt)}</p>
        </Link>
      </td>
      <td className="px-3 py-3.5"><SourceBadge source={lead.source} /></td>
      <td className="px-3 py-3.5">
        <div className={clsx("flex items-center gap-1.5 text-xs font-semibold", contacted ? "text-emerald-700" : "text-red-700")}>
          {contacted ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
          {contacted ? "Contactado" : "Sin contactar"}
        </div>
        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
          {contacted
            ? lead.firstContactedAt ? timeAgo(lead.firstContactedAt) : "Gestión registrada"
            : sla ? <Pill variant={SLA_VARIANT[sla]}>{SLA_LABEL[sla]}</Pill> : "Respuesta pendiente"}
        </p>
      </td>
      <td className="px-3 py-3.5">
        <p className="max-w-[210px] truncate text-xs font-semibold">{lead.vehicleLabel}{lead.vehicleYear ? ` ${lead.vehicleYear}` : ""}</p>
        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{lead.vehiclePatent || "Sin patente"}</p>
        {value !== null && <p className="mt-0.5 text-xs font-semibold tabular-nums text-[var(--fm-navy)]">{fmtCLP(value)}</p>}
      </td>
      <td className="px-3 py-3.5"><StageProgress stage={lead.stage} /></td>
      <td className="px-3 py-3.5"><NextAction lead={lead} overdue={overdue} /></td>
      {showAssignee && (
        <td className="px-3 py-3.5">
          <p className="max-w-[140px] truncate text-xs font-medium">{lead.assignedToName || "Sin asignar"}</p>
        </td>
      )}
      <td className="px-3 py-3.5 text-right">
        <Link href={`/solicitudes/${lead.id}`} aria-label={`Abrir lead de ${lead.contactName}`} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition group-hover:border-[var(--primary)] group-hover:text-[var(--primary)]">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

export function LeadExecutiveCard({ lead, showAssignee }: { lead: Lead; showAssignee: boolean }) {
  const contacted = Boolean(lead.firstContactedAt) || !["new", "lost"].includes(lead.stage);
  const overdue = isActionOverdue(lead);
  const value = leadValue(lead);
  return (
    <Link href={`/solicitudes/${lead.id}`} className="block space-y-3 border-b border-[var(--border)] p-4 last:border-b-0 active:bg-[var(--muted)]/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--fm-navy)]">{lead.contactName}</p>
          <p className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">{lead.contactPhone || lead.contactEmail || "Sin datos de contacto"}</p>
        </div>
        <SourceBadge source={lead.source} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className={clsx("flex items-center gap-1.5 text-xs font-semibold", contacted ? "text-emerald-700" : "text-red-700")}>
          {contacted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}
          {contacted ? "Contactado" : "Sin contactar"}
        </span>
        <span className="truncate text-right text-xs font-medium">{lead.vehicleLabel}</span>
      </div>
      <StageProgress stage={lead.stage} />
      <div className="flex items-end justify-between gap-3 border-t border-[var(--border)] pt-2.5">
        <NextAction lead={lead} overdue={overdue} />
        <div className="shrink-0 text-right">
          {value !== null && <p className="text-xs font-semibold tabular-nums">{fmtCLP(value)}</p>}
          {showAssignee && <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{lead.assignedToName || "Sin asignar"}</p>}
        </div>
      </div>
    </Link>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  const key = source?.toLowerCase() || "manual";
  const meta = SOURCE_STYLE[key] || SOURCE_STYLE.portal;
  const Icon = meta.icon;
  return (
    <span className={clsx("inline-flex max-w-[150px] items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide", meta.tone)}>
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{sourceLabel(source)}</span>
    </span>
  );
}

/**
 * El mismo camino que muestra el stepper de la ficha, con el mismo denominador. Antes esta
 * tabla tenía su propia lista con `won` adentro: decía "Paso 4 de 7" para un lead que al
 * abrirlo aparecía 4 de 6, y pintaba las seis barras en rojo cuando se perdía — como si el
 * cliente hubiera recorrido todo el camino antes de caerse.
 */
function StageProgress({ stage }: { stage: LeadStage }) {
  const step = stageStep(stage);
  const closed = step === null;
  const won = stage === "won";
  return (
    <div className="min-w-[170px]">
      <div className="flex items-center justify-between gap-2">
        <span className={clsx("text-xs font-semibold", stage === "lost" ? "text-red-700" : won ? "text-emerald-700" : "text-[var(--fm-navy)]")}>{stageLabel(stage)}</span>
        <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          {step ? `Paso ${step.index + 1} de ${step.total}` : won ? "Cerrada" : "Sin cerrar"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1">
        {SALES_PATH.map((item, itemIndex) => (
          <span
            key={item.key}
            className={clsx(
              "h-1 rounded-full",
              won
                ? "bg-emerald-500"
                : closed
                  ? "bg-[var(--border)]"
                  : itemIndex <= step.index
                    ? "bg-[var(--primary)]"
                    : "bg-[var(--border)]",
            )}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * La columna se llama "Próximo paso" y decía la hora, nunca el paso: todo lead agendado
 * aparecía como "Gestión agendada" y había que abrirlo para saber qué se prometió — que es
 * justo lo que el panel "Próximo paso" de la ficha muestra desde la misma tarea.
 */
function NextAction({ lead, overdue }: { lead: Lead; overdue: boolean }) {
  if (lead.stage === "won") return <p className="text-xs font-semibold text-emerald-700">Venta cerrada</p>;
  if (lead.stage === "lost") return <p className="max-w-[170px] truncate text-xs font-medium text-red-700">{lead.lostReason || "Oportunidad perdida"}</p>;
  if (!lead.nextActionAt) return <p className="text-xs font-medium text-amber-700">Sin próxima gestión</p>;
  return (
    <div className={clsx("flex items-start gap-1.5", overdue ? "text-red-700" : "text-[var(--foreground)]")}>
      <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <p className="max-w-[150px] truncate text-xs font-semibold" title={lead.nextActionTitle ?? undefined}>
          {lead.nextActionTitle ?? (overdue ? "Compromiso vencido" : "Gestión agendada")}
        </p>
        <p className="mt-0.5 text-[10px]">
          {fmtDateTime(lead.nextActionAt)}
          {lead.nextActionTitle && overdue ? " · vencido" : ""}
        </p>
      </div>
    </div>
  );
}
