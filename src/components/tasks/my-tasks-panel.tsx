"use client";

/**
 * "Mi día", con tareas de verdad: atrasadas, de hoy y próximas — no sólo leads sin contactar.
 * Cada tarea viene de `lead_tasks` (ver `LeadTasks` en la ficha) y se puede completar desde
 * acá mismo, sin entrar al lead, para que "Mi día" sea de verdad la lista de trabajo del agente.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { AlarmClock, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { fmtDateTime } from "@/lib/format";
import { stageLabel, toStage, type MyTask } from "@/lib/leads";
import { EmptyState } from "@/components/ui/primitives";

const MAX_PER_GROUP = 6;

function TaskRow({ task, onDone, busy }: { task: MyTask; onDone: (id: string) => void; busy: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Link href={`/solicitudes/${task.leadId}?tab=gestion`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
          {task.leadContactName ?? "Sin nombre"}
          {task.leadStage ? ` · ${stageLabel(toStage(task.leadStage))}` : ""}
          {task.dueAt ? ` · ${fmtDateTime(task.dueAt)}` : ""}
        </p>
      </Link>
      <button
        onClick={() => onDone(task.id)}
        disabled={busy}
        title="Marcar hecha"
        className="flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </button>
    </li>
  );
}

function TaskGroup({
  title,
  tone,
  tasks,
  onDone,
  busyId,
}: {
  title: string;
  tone: "danger" | "default";
  tasks: MyTask[];
  onDone: (id: string) => void;
  busyId: string | null;
}) {
  return (
    <div>
      <p
        className={clsx(
          "px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide",
          tone === "danger" ? "text-red-700" : "text-[var(--muted-foreground)]",
        )}
      >
        {title} ({tasks.length})
      </p>
      {tasks.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-[var(--muted-foreground)]">Nada aquí.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {tasks.slice(0, MAX_PER_GROUP).map((task) => (
            <TaskRow key={task.id} task={task} onDone={onDone} busy={busyId === task.id} />
          ))}
        </ul>
      )}
      {tasks.length > MAX_PER_GROUP && (
        <p className="px-4 pb-2 pt-1 text-[11px] text-[var(--muted-foreground)]">
          +{tasks.length - MAX_PER_GROUP} más
        </p>
      )}
    </div>
  );
}

export function MyTasksPanel({
  overdue,
  today,
  upcoming,
}: {
  overdue: MyTask[];
  today: MyTask[];
  upcoming: MyTask[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const total = overdue.length + today.length + upcoming.length;

  const complete = async (task: MyTask) => {
    setBusyId(task.id);
    try {
      const res = await crmFetch(`/api/crm/leads/${task.leadId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos completar la tarea");
        return;
      }
      toast.success("Tarea completada");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const onDone = (id: string) => {
    const task = [...overdue, ...today, ...upcoming].find((t) => t.id === id);
    if (task) complete(task);
  };

  if (total === 0) {
    return (
      <EmptyState
        icon={<AlarmClock className="h-6 w-6" />}
        title="Sin tareas pendientes"
        description="Cuando agendes un próximo paso en un lead (llamar, enviar antecedentes, confirmar visita…), aparece acá."
      />
    );
  }

  return (
    <div className={clsx("divide-y divide-[var(--border)]", pending && "opacity-60")}>
      <TaskGroup title="Atrasadas" tone="danger" tasks={overdue} onDone={onDone} busyId={busyId} />
      <TaskGroup title="Hoy" tone="default" tasks={today} onDone={onDone} busyId={busyId} />
      <TaskGroup title="Próximas" tone="default" tasks={upcoming} onDone={onDone} busyId={busyId} />
    </div>
  );
}
