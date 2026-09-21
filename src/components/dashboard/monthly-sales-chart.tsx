"use client";

/**
 * Ventas y unidades vendidas por mes. Barras = autos vendidos (conteo, eje izquierdo);
 * línea = monto vendido (CLP, eje derecho) — dos escalas porque son magnitudes muy distintas
 * y aplastar una contra la otra las vuelve ilegibles.
 */
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SalesTimeseriesPoint } from "@/lib/data/crm";
import { fmtCLP, fmtNumber } from "@/lib/format";

function monthLabel(period: string): string {
  const d = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return period;
  const label = d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function compactCLP(value: number): string {
  if (value >= 1_000_000) return `$${fmtNumber(Math.round(value / 1_000_000))}M`;
  if (value >= 1_000) return `$${fmtNumber(Math.round(value / 1_000))}K`;
  return fmtCLP(value);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const sold = payload.find((p) => p.dataKey === "sold")?.value ?? 0;
  const amount = payload.find((p) => p.dataKey === "salesAmount")?.value ?? 0;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-[var(--foreground)]">{label}</p>
      <p className="flex items-center gap-1.5 font-medium text-[var(--fm-navy)]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--fm-navy)]" />
        {fmtNumber(sold)} {sold === 1 ? "auto vendido" : "autos vendidos"}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 font-medium text-[var(--primary)]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
        {fmtCLP(amount)}
      </p>
    </div>
  );
}

export function MonthlySalesChart({ data }: { data: SalesTimeseriesPoint[] }) {
  if (data.length === 0 || data.every((d) => d.sold === 0)) {
    return (
      <p className="px-4 py-14 text-center text-xs text-[var(--muted-foreground)]">
        Todavía no hay ventas cerradas en este periodo.
      </p>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: monthLabel(d.period) }));

  return (
    <div className="h-72 w-full px-1 py-4 sm:px-3">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="count"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={30}
          />
          <YAxis
            yAxisId="amount"
            orientation="right"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={compactCLP}
            width={52}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
          <Bar
            yAxisId="count"
            dataKey="sold"
            name="Autos vendidos"
            fill="var(--fm-navy)"
            radius={[5, 5, 0, 0]}
            barSize={20}
          />
          <Line
            yAxisId="amount"
            type="monotone"
            dataKey="salesAmount"
            name="Monto vendido"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
