"use client";

/**
 * Campo de pesos chilenos. El agente escribe cifras con el cliente delante, así que el campo
 * formatea los miles a medida que teclea y acepta lo que sea que pegue (con puntos, con "$",
 * con espacios): lo que importa es el número, no que lo escriba bien.
 *
 * Se guarda como number | null — `null` es "no cotizado", distinto de cero.
 */
import { clsx } from "clsx";

export function CurrencyInput({
  value,
  onChange,
  placeholder,
  id,
  className,
  disabled,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  const display = value === null || Number.isNaN(value) ? "" : value.toLocaleString("es-CL");

  return (
    <div className={clsx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">
        $
      </span>
      <input
        id={id}
        // `inputMode="numeric"` abre el teclado numérico en el teléfono, que es donde el
        // agente cotiza; `type="text"` conserva los separadores de miles.
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? Number(digits) : null);
        }}
        placeholder={placeholder}
        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] py-2.5 pl-7 pr-3 text-sm tabular-nums outline-none focus:border-[var(--primary)] disabled:opacity-60"
      />
    </div>
  );
}
