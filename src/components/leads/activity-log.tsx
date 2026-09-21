import { Clock } from "lucide-react";

import { fmtDateTime } from "@/lib/format";
import { describeActivity } from "@/lib/activity-vocabulary";
import { stageLabel, toStage, type LeadActivity } from "@/lib/leads";

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
        const meta = describeActivity(activity);
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
