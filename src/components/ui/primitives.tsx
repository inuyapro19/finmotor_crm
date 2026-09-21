/**
 * Primitivas de interfaz del CRM.
 *
 * Se mantienen deliberadamente pequeñas y sin dependencias de Radix: el CRM es móvil primero
 * y su superficie visual es acotada (tarjetas, listas, píldoras). Cuando se cree el workspace
 * del monorepo, esto se funde con `@finmotor/ui` junto a los componentes del backoffice.
 */
import Link from "next/link";
import { clsx } from "clsx";

/* ── Cabecera de página ──────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Panel ───────────────────────────────────────────────────────── */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  titleAttr,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * Tooltip del titulo. Sirve para dejar rastreable la referencia interna (el modelo del
   * documento de diseno, el codigo de regla) sin escribirsela en la cara a quien usa el CRM.
   */
  titleAttr?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-[0_1px_2px_rgba(7,29,86,0.04)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-sm font-semibold" title={titleAttr}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="truncate text-xs text-[var(--muted-foreground)]">{subtitle}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ── Píldora de estado ───────────────────────────────────────────── */

export type PillVariant = "neutral" | "success" | "warn" | "danger" | "info";

const PILL_STYLES: Record<PillVariant, string> = {
  neutral: "bg-[var(--muted)] text-[var(--muted-foreground)]",
  success: "bg-[var(--accent)] text-[var(--accent-foreground)]",
  warn: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-[#e7edff] text-[var(--fm-navy)]",
};

export function Pill({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: PillVariant;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-5",
        PILL_STYLES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Tarjeta de indicador ────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "neutral" | "alert";
}) {
  const body = (
    <div
      className={clsx(
        "flex h-full flex-col justify-between rounded-[var(--radius)] border bg-[var(--card)] p-4 transition-colors",
        tone === "alert"
          ? "border-amber-300 bg-amber-50/60"
          : "border-[var(--border)] hover:border-[var(--primary)]/40",
      )}
    >
      <p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{hint}</p>}
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

/* ── Estado vacío ────────────────────────────────────────────────── */

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-[var(--muted-foreground)]">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">{description}</p>
      )}
    </div>
  );
}

/* ── Aviso ───────────────────────────────────────────────────────── */

export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn";
}) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius)] border px-4 py-3 text-xs leading-relaxed",
        tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]",
      )}
    >
      {children}
    </div>
  );
}
