"use client";

/**
 * Panel lateral de actividad: la bitácora del local en vivo (`lead_activities`).
 *
 * Es el equivalente al pizarrón del patio — quién llamó a quién y cómo quedó. El
 * administrador ve al equipo completo; el agente de ventas, sólo su cartera (lo acota el
 * backend, no este componente).
 *
 * En escritorio queda anclado a la derecha y empuja el contenido; bajo `xl` se comporta como
 * cajón con velo, porque a ese ancho robaría la pantalla al trabajo.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  Activity,
  ArrowRightLeft,
  CalendarClock,
  Mail,
  MessageCircle,
  PhoneCall,
  PhoneMissed,
  Sparkles,
  StickyNote,
  Users,
  X,
} from "lucide-react";

import { crmFetch } from "@/lib/api/crm-fetch";
import { timeAgo } from "@/lib/format";
import type { ActivityItem } from "@/lib/data/crm";

const REFRESH_MS = 60_000;

const ACTIVITY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; tone: string }
> = {
  call: { icon: PhoneCall, label: "Llamada", tone: "bg-[var(--accent)] text-[var(--accent-foreground)]" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", tone: "bg-[var(--accent)] text-[var(--accent-foreground)]" },
  message_sent: { icon: MessageCircle, label: "Mensaje enviado", tone: "bg-[var(--accent)] text-[var(--accent-foreground)]" },
  email: { icon: Mail, label: "Correo", tone: "bg-[#e7edff] text-[var(--fm-navy)]" },
  visit: { icon: CalendarClock, label: "Visita", tone: "bg-[#e7edff] text-[var(--fm-navy)]" },
  meeting: { icon: Users, label: "Reunión", tone: "bg-[#e7edff] text-[var(--fm-navy)]" },
  note: { icon: StickyNote, label: "Nota", tone: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
  no_answer: { icon: PhoneMissed, label: "No contestó", tone: "bg-amber-100 text-amber-800" },
  stage_change: { icon: ArrowRightLeft, label: "Cambio de etapa", tone: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
  system: { icon: Sparkles, label: "Automático", tone: "bg-[var(--muted)] text-[var(--muted-foreground)]" },
};

function meta(type: string) {
  return ACTIVITY_META[type] ?? ACTIVITY_META.system;
}

/** "Hoy" / "Ayer" / "12 de marzo": el agente piensa el día, no la fecha. */
function dayLabel(value: string | null): string {
  if (!value) return "Sin fecha";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
}

export function ActivityRail({
  initial,
  open,
  onClose,
  scopeLabel,
}: {
  initial: ActivityItem[];
  open: boolean;
  onClose: () => void;
  scopeLabel: string;
}) {
  const [items, setItems] = useState<ActivityItem[]>(initial);

  const load = useCallback(async () => {
    try {
      const res = await crmFetch("/api/crm/activity?limit=30", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: ActivityItem[] };
      setItems(data.items ?? []);
    } catch {
      // Sin conexión: se mantiene lo último cargado.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    // El primer refresco se agenda (no se llama en el cuerpo del efecto) para no encadenar
    // un render con el que acaba de abrir el panel; el contenido inicial ya vino del server.
    const first = setTimeout(load, 250);
    const id = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Agrupación por día, preservando el orden (el backend ya entrega descendente).
  const groups: { day: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const day = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }

  return (
    <>
      {open && (
        <button
          aria-label="Cerrar actividad"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[var(--fm-navy)]/25 xl:hidden"
        />
      )}

      <aside
        aria-hidden={!open}
        className={clsx(
          "fixed right-0 top-0 z-40 flex h-dvh w-[min(20rem,88vw)] flex-col border-l border-[var(--border)] bg-[var(--card)] transition-transform duration-200",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Activity className="h-4 w-4 text-[var(--primary)]" />
              Actividad
            </p>
            <p className="truncate text-[11px] text-[var(--muted-foreground)]">{scopeLabel}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar panel de actividad"
            className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs leading-relaxed text-[var(--muted-foreground)]">
              Todavía no hay movimientos. Cada llamada, WhatsApp o nota que registres en una
              solicitud aparece aquí.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.day}>
                <p className="sticky top-0 z-10 bg-[var(--card)] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                  {group.day}
                </p>
                <ul>
                  {group.items.map((item) => {
                    const m = meta(item.activityType);
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/solicitudes/${item.leadId}`}
                          className="flex gap-2.5 px-4 py-2.5 transition-colors hover:bg-[var(--muted)]/60"
                        >
                          <span
                            className={clsx(
                              "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full",
                              m.tone,
                            )}
                          >
                            <m.icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">{item.contactName}</p>
                            <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                              {m.label}
                              {item.vehicleLabel ? ` · ${item.vehicleLabel}` : ""}
                            </p>
                            {item.notes && (
                              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                                {item.notes}
                              </p>
                            )}
                            <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                              {item.actorName} · {timeAgo(item.createdAt)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
