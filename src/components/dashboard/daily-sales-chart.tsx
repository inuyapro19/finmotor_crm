"use client";

/**
 * Barras de ventas diarias (monto) para el rango elegido en el filtro del Dashboard. Sólo
 * tiene sentido como barras cuando el rango es corto (7/30/90 días): con 365 puntos las
 * barras se vuelven una mancha ilegible, así que la página decide arriba cuándo mostrarlo.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { SalesTimeseriesPoint } from "@/lib/data/crm";
import { fmtCLP, fmtNumber } from "@/lib/format";

function dayLabel(period: string): string {
  const d = new Date(`${period}T00:00:00`);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }).replace(".", "");
}

function compactCLP(value: number): string {
  if (value >= 1_000_000) return `$${fmtNumber(Math.round(value / 1_000_000))}M`;
  if (value >= 1_000) return `$${fmtNumber(Math.round(value / 1_000))}K`;
  return fmtNumber(value);
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: SalesTimeseriesPoint }[];
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const d = new Date(`${point.period}T00:00:00`);
  const title = Number.isNaN(d.getTime())
    ? point.period
    : d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold capitalize text-[var(--foreground)]">{title}</p>
      <p className="font-medium text-[var(--primary)]">{fmtCLP(point.salesAmount)}</p>
      <p className="text-[var(--muted-foreground)]">
        {fmtNumber(point.sold)} {point.sold === 1 ? "auto vendido" : "autos vendidos"}
      </p>
    </div>
  );
}

export function DailySalesChart({ data }: { data: SalesTimeseriesPoint[] }) {
  if (data.length === 0 || data.every((d) => d.sold === 0)) {
    return (
      <p className="px-4 py-14 text-center text-xs text-[var(--muted-foreground)]">
        Todavía no hay ventas cerradas en este periodo.
      </p>
    );
  }

  return (
    <div className="h-64 w-full px-1 py-4 sm:px-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="dailySalesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--fm-lime)" stopOpacity={0.95} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="period"
            tickFormatter={dayLabel}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={compactCLP}
            width={44}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          <Bar dataKey="salesAmount" name="Ventas" fill="url(#dailySalesFill)" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
