"use client";

/**
 * El compromiso con el cliente, ahora como tarea real: "llamar el jueves" con título,
 * responsable y prioridad — no sólo una fecha suelta.
 *
 * Reemplaza al antiguo `NextAction` (que sólo agendaba `nextActionAt`, un campo del lead sin
 * dueño ni historial). `Lead.nextActionAt` sigue existiendo pero ahora es un resumen calculado
 * por el backend desde la tarea abierta más próxima — aquí sólo se listan y gestionan tareas.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { fmtDateTime } from "@/lib/format";
import { isOverdue, type LeadTask } from "@/lib/leads";

/** Tareas rápidas del mostrador (plan L1.3): las que más se repiten en una automotora. */
const QUICK_TITLES = ["Llamar", "Enviar antecedentes", "Confirmar visita", "Pedir decisión"];

/** Atajos de fecha pensados para el mostrador, no para una agenda. */
const DUE_SHORTCUTS: { label: string; build: () => Date }[] = [
  { label: "En 2 horas", build: () => new Date(Date.now() + 2 * 3600_000) },
  {
    label: "Mañana 10:00",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
      return d;
    },
  },
  {
    label: "En 3 días",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(10, 0, 0, 0);
      return d;
    },
  },
];

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function LeadTasks({
  leadId,
  tasks,
  canWrite,
}: {
  leadId: string;
  tasks: LeadTask[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const open = tasks.filter((t) => t.status === "open");
  const closed = tasks.filter((t) => t.status !== "open").slice(0, 5);

  const createTask = async (taskTitle: string, dueAt: Date | null) => {
    const trimmed = taskTitle.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, dueAt: dueAt ? dueAt.toISOString() : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos crear la tarea");
        return;
      }
      toast.success("Tarea agregada");
      setTitle("");
      setDue("");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (taskId: string, status: "done" | "cancelled") => {
    setBusyId(taskId);
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos actualizar la tarea");
        return;
      }
      toast.success(status === "done" ? "Tarea completada" : "Tarea cancelada");
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3 p-4">
      {open.length === 0 && (
        <p className="text-xs text-[var(--muted-foreground)]">
          Sin próxima acción. {canWrite && "Agenda una para no perder el hilo con este cliente."}
        </p>
      )}

      {open.length > 0 && (
        <ul className="space-y-2">
          {open.map((task) => {
            const overdue = isOverdue(task.dueAt);
            return (
              <li
                key={task.id}
                className={clsx(
                  "flex items-start justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2.5",
                  overdue ? "border-red-300 bg-red-50" : "border-[var(--border)] bg-[var(--muted)]/40",
                )}
              >
                <div className="min-w-0">
                  <p className={clsx("flex items-center gap-1.5 text-sm font-medium", overdue && "text-red-700")}>
                    {task.priority > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />}
                    {task.title}
                  </p>
                  <p className={clsx("mt-0.5 flex items-center gap-1 text-[11px]", overdue ? "text-red-700" : "text-[var(--muted-foreground)]")}>
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    {task.dueAt ? fmtDateTime(task.dueAt) : "Sin fecha"}
                    {task.assignedToName ? ` · ${task.assignedToName}` : ""}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setStatus(task.id, "done")}
                      disabled={busyId === task.id || pending}
                      title="Marcar hecha"
                      className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs disabled:opacity-50"
                    >
                      {busyId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setStatus(task.id, "cancelled")}
                      disabled={busyId === task.id || pending}
                      title="Cancelar"
                      className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-xs disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TITLES.map((label) => (
              <button
                key={label}
                onClick={() => createTask(label, DUE_SHORTCUTS[0].build())}
                disabled={creating}
                className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-[11px] font-medium transition-colors hover:border-[var(--primary)] disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
            <input
              type="datetime-local"
              value={due}
              min={toLocalInput(new Date())}
              onChange={(e) => setDue(e.target.value)}
              className="min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
            />
            <button
              onClick={() => createTask(title, due ? new Date(due) : null)}
              disabled={creating || !title.trim()}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-40"
            >
              Agregar
            </button>
          </div>
        </>
      )}

      {closed.length > 0 && (
        <details className="pt-1">
          <summary className="cursor-pointer text-[11px] text-[var(--muted-foreground)]">
            Tareas resueltas ({closed.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {closed.map((task) => (
              <li key={task.id} className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                <span className={clsx(task.status === "cancelled" && "line-through")}>{task.title}</span>
                <span>{task.status === "done" ? "Hecha" : "Cancelada"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
