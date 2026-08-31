/**
 * Embudo del pipeline. Las etapas abiertas muestran cuántos clientes hay AHORA en cada una;
 * "Vendido" y "Perdido" muestran los cierres del periodo (así lo entrega el backend).
 *
 * Barra horizontal en vez de gráfico de embudo clásico: en un CRM lo que importa es
 * comparar etapas de un vistazo y poder tocar la etapa para ir a filtrar, no la figura.
 */
import Link from "next/link";
import { clsx } from "clsx";

import { stageLabel, type LeadStage } from "@/lib/leads";

const CLOSED: LeadStage[] = ["won", "lost"];

export function FunnelBars({ funnel }: { funnel: { stage: string; count: number }[] }) {
  const rows = funnel.filter((f) => !CLOSED.includes(f.stage as LeadStage));
  const closed = funnel.filter((f) => CLOSED.includes(f.stage as LeadStage));
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="space-y-2.5 p-4">
      {rows.map((row) => (
        <Link
          key={row.stage}
          href={`/solicitudes?estado=${row.stage}`}
          className="group grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3"
        >
          <span className="truncate text-[12px] text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
            {stageLabel(row.stage as LeadStage)}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-[var(--muted)]">
            <span
              className="block h-full rounded-full bg-[var(--primary)]/70 transition-all group-hover:bg-[var(--primary)]"
              style={{ width: `${Math.max(row.count ? 4 : 0, (row.count / max) * 100)}%` }}
            />
          </span>
          <span className="text-right text-[13px] font-semibold tabular-nums">{row.count}</span>
        </Link>
      ))}

      {closed.length > 0 && (
        <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
          {closed.map((row) => (
            <div
              key={row.stage}
              className={clsx(
                "flex-1 rounded-[var(--radius)] px-3 py-2",
                row.stage === "won"
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]",
              )}
            >
              <p className="text-[11px]">{stageLabel(row.stage as LeadStage)} en el periodo</p>
              <p className="text-lg font-semibold tabular-nums">{row.count}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
