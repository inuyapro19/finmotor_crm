"use client";

/**
 * Filtro de fechas de los gráficos de ventas del Dashboard. Un solo control alimenta AMBOS
 * gráficos (mensual y diario): navega con `from`/`to` en la URL, el servidor vuelve a pedirle
 * al backend la serie para ese rango exacto y ambos gráficos quedan sincronizados entre sí.
 *
 * Los atajos (7/30/90 días, 12 meses) son los rangos que un dueño de automotora realmente
 * usa para revisar "cómo voy"; "Entre fechas" cubre el resto (cierre de mes, una campaña
 * puntual, etc.) con un calendario nativo — sin traer un date-picker aparte para esto.
 */
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { clsx } from "clsx";

const PRESETS = [
  { key: "7d", label: "7 días", days: 7 },
  { key: "30d", label: "30 días", days: 30 },
  { key: "90d", label: "90 días", days: 90 },
  { key: "12m", label: "12 meses", days: 365 },
] as const;

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return toIso(d);
}

function todayIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return toIso(d);
}

export function SalesDateFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const today = todayIso();
  const activePreset = to === today ? PRESETS.find((p) => from === daysAgoIso(p.days))?.key : undefined;

  const navigate = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams({ from: nextFrom, to: nextTo });
    router.push(`${pathname}?${params.toString()}`);
  };

  const applyPreset = (days: number) => {
    const nextFrom = daysAgoIso(days);
    setCustomFrom(nextFrom);
    setCustomTo(today);
    navigate(nextFrom, today);
  };

  const applyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    navigate(customFrom > customTo ? customTo : customFrom, customFrom > customTo ? customFrom : customTo);
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
      <span className="hidden items-center gap-1.5 text-[11px] font-medium text-[var(--muted-foreground)] sm:flex">
        <CalendarRange className="h-3.5 w-3.5" />
        Periodo
      </span>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => applyPreset(preset.days)}
            className={clsx(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              activePreset === preset.key
                ? "bg-[var(--fm-navy)] text-white"
                : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]/70",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-[var(--border)] sm:block" />

      <form onSubmit={applyCustom} className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          value={customFrom}
          max={customTo || today}
          onChange={(e) => setCustomFrom(e.target.value)}
          aria-label="Desde"
          className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none focus:border-[var(--primary)]"
        />
        <span className="text-xs text-[var(--muted-foreground)]">—</span>
        <input
          type="date"
          value={customTo}
          min={customFrom}
          max={today}
          onChange={(e) => setCustomTo(e.target.value)}
          aria-label="Hasta"
          className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none focus:border-[var(--primary)]"
        />
        <button
          type="submit"
          className="h-8 rounded-md bg-[var(--primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--fm-green-700)]"
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}
