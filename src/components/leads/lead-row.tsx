import Link from "next/link";
import { CalendarClock, Car, ChevronRight } from "lucide-react";
import { clsx } from "clsx";

import { fmtCLP, fmtDateTime, timeAgo } from "@/lib/format";
import {
  SLA_LABEL,
  isActionOverdue,
  leadValue,
  slaLevel,
  sourceLabel,
  stageLabel,
  type Lead,
} from "@/lib/leads";
import { Pill } from "@/components/ui/primitives";

const SLA_VARIANT = { ok: "success", warn: "warn", late: "danger" } as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Fila de solicitud. Muestra lo justo para decidir a quién llamar primero: quién es, qué auto
 * mira, por cuánto va la conversación, si le quedaste mal con un compromiso y hace cuánto
 * llegó. Cualquier dato de más obliga a leer en vez de barrer la lista con la vista.
 */
export function LeadRow({ lead, showAssignee = false }: { lead: Lead; showAssignee?: boolean }) {
  const sla = slaLevel(lead);
  const overdue = isActionOverdue(lead);
  const value = leadValue(lead);

  return (
    <li>
      <Link
        href={`/solicitudes/${lead.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--muted)]/40"
      >
        <span
          className={clsx(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
            lead.stage === "new"
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-[var(--muted)] text-[var(--muted-foreground)]",
          )}
        >
          {initials(lead.contactName)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium">{lead.contactName}</p>
            {sla && <Pill variant={SLA_VARIANT[sla]}>{SLA_LABEL[sla]}</Pill>}
            {overdue && <Pill variant="danger">Vencido</Pill>}
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--muted-foreground)]">
            <Car className="h-3 w-3 shrink-0" />
            {lead.vehicleLabel}
            {lead.vehicleYear ? ` ${lead.vehicleYear}` : ""}
            {lead.vehiclePatent ? ` · ${lead.vehiclePatent}` : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-[var(--muted-foreground)]">
            {stageLabel(lead.stage)} · {sourceLabel(lead.source)} · {timeAgo(lead.createdAt)}
            {showAssignee && ` · ${lead.assignedToName ?? "sin asignar"}`}
            {lead.nextActionAt && !overdue && (
              <>
                {" · "}
                <CalendarClock className="h-3 w-3 shrink-0" />
                {fmtDateTime(lead.nextActionAt)}
              </>
            )}
          </p>
        </div>

        {value !== null && (
          <span className="hidden shrink-0 text-right text-xs font-medium tabular-nums sm:block">
            {fmtCLP(value)}
            {lead.quotedPrice !== null && (
              <span className="block text-[10px] font-normal text-[var(--muted-foreground)]">
                cotizado
              </span>
            )}
          </span>
        )}

        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
      </Link>
    </li>
  );
}
