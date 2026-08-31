/**
 * Tarjeta de indicador del tablero. Más rica que `StatCard`: admite ícono, tono semántico y
 * una nota al pie con la comparación.
 *
 * Regla de tono: sólo se pinta de ámbar/rojo lo que EXIGE una acción hoy (leads atrasados,
 * compromisos vencidos). Si todo se pinta, nada destaca.
 */
import Link from "next/link";
import { clsx } from "clsx";

export type KpiTone = "neutral" | "good" | "warn" | "alert";

const TONES: Record<KpiTone, { card: string; icon: string; value: string }> = {
  neutral: {
    card: "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/35",
    icon: "bg-[var(--muted)] text-[var(--muted-foreground)]",
    value: "text-[var(--foreground)]",
  },
  good: {
    card: "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/35",
    icon: "bg-[var(--accent)] text-[var(--accent-foreground)]",
    value: "text-[var(--primary)]",
  },
  warn: {
    card: "border-amber-300 bg-amber-50/70 hover:border-amber-400",
    icon: "bg-amber-100 text-amber-800",
    value: "text-amber-900",
  },
  alert: {
    card: "border-red-300 bg-red-50/70 hover:border-red-400",
    icon: "bg-red-100 text-red-700",
    value: "text-red-700",
  },
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: KpiTone;
  href?: string;
}) {
  const t = TONES[tone];
  const body = (
    <div className={clsx("flex h-full flex-col rounded-[var(--radius)] border p-4 transition-colors", t.card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
          {label}
        </p>
        {Icon && (
          <span className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-lg", t.icon)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className={clsx("mt-2 text-[26px] font-semibold leading-none tabular-nums tracking-tight", t.value)}>
        {value}
      </p>
      {hint && <p className="mt-auto pt-2 text-[11px] text-[var(--muted-foreground)]">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
