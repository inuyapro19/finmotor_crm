/**
 * Tendencia diaria de solicitudes y ventas, en SVG plano (sin librería de gráficos: son dos
 * series cortas y el CRM no necesita 40 kB de JavaScript para dibujar treinta barras).
 *
 * Cada día es una columna: la barra clara son las solicitudes que entraron, la oscura las
 * que se cerraron vendidas. Los días sin movimiento se dibujan igual —el backend rellena la
 * serie— para que el ritmo del mes se lea de un vistazo.
 */
import { fmtNumber } from "@/lib/format";

export function TrendChart({
  data,
  className,
}: {
  data: { day: string; leads: number; won: number }[];
  className?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">
        Todavía no hay movimiento que graficar.
      </p>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.leads));
  const totalLeads = data.reduce((sum, d) => sum + d.leads, 0);
  const totalWon = data.reduce((sum, d) => sum + d.won, 0);
  const gap = 2;
  const width = data.length * 10;
  const height = 64;

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-4 px-4 pt-3">
        <div className="flex gap-4">
          <Legend color="var(--primary)" opacity={0.25} label="Solicitudes" value={totalLeads} />
          <Legend color="var(--primary)" opacity={1} label="Vendidos" value={totalWon} />
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Solicitudes y ventas por día: ${totalLeads} solicitudes y ${totalWon} ventas en el periodo`}
        className="mt-2 h-20 w-full px-4"
      >
        {data.map((d, i) => {
          const x = i * 10;
          const leadsH = (d.leads / max) * height;
          const wonH = (d.won / max) * height;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={height - leadsH}
                width={10 - gap}
                height={leadsH}
                rx={1.5}
                fill="var(--primary)"
                opacity={0.22}
              />
              {d.won > 0 && (
                <rect
                  x={x}
                  y={height - wonH}
                  width={10 - gap}
                  height={wonH}
                  rx={1.5}
                  fill="var(--primary)"
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex justify-between px-4 pb-3 pt-1 text-[10px] text-[var(--muted-foreground)]">
        <span>{formatDay(data[0]?.day)}</span>
        <span>{formatDay(data[data.length - 1]?.day)}</span>
      </div>
    </div>
  );
}

function Legend({
  color,
  opacity,
  label,
  value,
}: {
  color: string;
  opacity: number;
  label: string;
  value: number;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-[3px]"
        style={{ background: color, opacity }}
      />
      <span className="text-[11px] text-[var(--muted-foreground)]">{label}</span>
      <span className="text-[11px] font-semibold tabular-nums">{fmtNumber(value)}</span>
    </span>
  );
}

function formatDay(day: string | undefined): string {
  if (!day) return "";
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}
