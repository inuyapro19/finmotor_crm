/**
 * Rendimiento por agente. Es la vista del dueño/supervisor: una fila por vendedor con los
 * mismos indicadores que la automotora, para poder compararlos entre sí.
 *
 * Lo que se muestra NO lo decide este componente: el backend entrega todas las filas al
 * administrador y sólo la propia al agente de ventas (`analytics/performance`). Aquí sólo
 * cambia la forma de presentarlo.
 *
 * En móvil la tabla se vuelve una lista de tarjetas: el agente revisa esto en el teléfono y
 * una tabla de ocho columnas ahí no se lee.
 */
import { clsx } from "clsx";
import { Trophy } from "lucide-react";

import { fmtCLP, fmtNumber } from "@/lib/format";
import { Pill } from "@/components/ui/primitives";
import type { AgentPerformance } from "@/lib/data/crm";

export function responseLabel(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

/** Bueno bajo 15 min, aceptable bajo una hora: es el SLA que usa el semáforo de solicitudes. */
function responseTone(minutes: number | null): string {
  if (minutes === null) return "text-[var(--muted-foreground)]";
  if (minutes <= 15) return "text-[var(--primary)]";
  if (minutes <= 60) return "text-amber-700";
  return "text-red-600";
}

export function AgentBoard({ agents }: { agents: AgentPerformance[] }) {
  const topSeller = agents.reduce<AgentPerformance | null>(
    (best, a) => (a.won > 0 && (!best || a.won > best.won) ? a : best),
    null,
  );

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              <th className="px-4 py-2.5 font-medium">Agente</th>
              <th className="px-3 py-2.5 text-right font-medium">Abiertos</th>
              <th className="px-3 py-2.5 text-right font-medium">Sin contactar</th>
              <th className="px-3 py-2.5 text-right font-medium">Nuevos</th>
              <th className="px-3 py-2.5 text-right font-medium">Vendidos</th>
              <th className="px-3 py-2.5 text-right font-medium">Conversión</th>
              <th className="px-3 py-2.5 text-right font-medium">1ª respuesta</th>
              <th className="px-4 py-2.5 text-right font-medium">Vendido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {agents.map((a) => (
              <tr key={a.userId} className="transition-colors hover:bg-[var(--muted)]/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-[10px] font-semibold">
                      {initials(a.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{a.name}</span>
                      {topSeller?.userId === a.userId && (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--primary)]">
                          <Trophy className="h-3 w-3" />
                          Más ventas del periodo
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{a.openLeads}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className={clsx(a.slaLate > 0 && "font-semibold text-red-600")}>
                    {a.uncontacted}
                  </span>
                  {a.slaLate > 0 && (
                    <span className="ml-1 text-[10px] text-red-600">({a.slaLate} atrasadas)</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{a.newLeads}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{a.won}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{fmtNumber(a.conversion)}%</td>
                <td className={clsx("px-3 py-2.5 text-right tabular-nums", responseTone(a.avgFirstResponseMin))}>
                  {responseLabel(a.avgFirstResponseMin)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtCLP(a.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil */}
      <ul className="divide-y divide-[var(--border)] md:hidden">
        {agents.map((a) => (
          <li key={a.userId} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-[11px] font-semibold">
                  {initials(a.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{a.name}</span>
                  <span className="block text-[11px] text-[var(--muted-foreground)]">
                    {a.openLeads} abiertos · {fmtNumber(a.conversion)}% conversión
                  </span>
                </span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold leading-none tabular-nums">{a.won}</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">vendidos</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.slaLate > 0 && <Pill variant="danger">{a.slaLate} atrasadas</Pill>}
              <Pill variant="neutral">1ª respuesta {responseLabel(a.avgFirstResponseMin)}</Pill>
              <Pill variant="info">{fmtCLP(a.revenue)}</Pill>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
