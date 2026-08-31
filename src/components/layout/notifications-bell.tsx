"use client";

/**
 * Campana del CRM. Lee `GET /api/notifications` (proxy BFF de `/notifications`, que ya
 * devuelve sólo las del usuario autenticado) y refresca sola cada minuto: el agente deja el
 * CRM abierto todo el día y no va a recargar la página para enterarse de una solicitud nueva.
 *
 * El primer render usa las notificaciones que trajo el servidor, así que no hay parpadeo de
 * "cargando" al entrar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Bell, Check } from "lucide-react";

import { timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/data/crm";

const REFRESH_MS = 60_000;

export function NotificationsBell({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>(initial);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.readAt);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: Notification[] };
      setItems(data.notifications ?? []);
    } catch {
      // Sin conexión: se conserva lo último que vimos en vez de vaciar la campana.
    }
  }, []);

  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Cerrar al hacer clic fuera o con Escape: el panel tapa contenido y el agente trabaja rápido.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (id?: string) => {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (!id || n.id === id ? { ...n, readAt: n.readAt ?? now } : n)),
    );
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    }).catch(() => {});
    router.refresh();
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread.length ? `${unread.length} avisos sin leer` : "Avisos"}
        aria-expanded={open}
        className={clsx(
          "relative grid h-9 w-9 place-items-center rounded-lg border transition-colors",
          open
            ? "border-[var(--primary)]/30 bg-[var(--accent)] text-[var(--accent-foreground)]"
            : "border-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        )}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread.length > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#d92d20] px-1 text-[9px] font-bold leading-none text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-[0_12px_32px_rgba(7,29,86,0.14)]">
          <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
            <p className="text-sm font-semibold">Avisos</p>
            {unread.length > 0 && (
              <button
                onClick={() => markRead()}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--primary)] hover:underline"
              >
                <Check className="h-3 w-3" />
                Marcar todo como visto
              </button>
            )}
          </header>

          {items.length === 0 ? (
            <p className="px-3.5 py-8 text-center text-xs text-[var(--muted-foreground)]">
              Sin avisos por ahora. Aquí llegan las solicitudes nuevas y los cambios de tus ventas.
            </p>
          ) : (
            <ul className="max-h-[22rem] divide-y divide-[var(--border)] overflow-y-auto">
              {items.slice(0, 20).map((n) => {
                const body = (
                  <div className="flex items-start gap-2">
                    <span
                      className={clsx(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        n.readAt ? "bg-transparent" : "bg-[var(--primary)]",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={clsx(
                          "truncate text-[13px]",
                          n.readAt ? "font-normal" : "font-semibold",
                        )}
                      >
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                          {n.message}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id} className="transition-colors hover:bg-[var(--muted)]/60">
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => {
                          setOpen(false);
                          if (!n.readAt) void markRead(n.id);
                        }}
                        className="block px-3.5 py-2.5"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        onClick={() => !n.readAt && markRead(n.id)}
                        className="block w-full px-3.5 py-2.5 text-left"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
