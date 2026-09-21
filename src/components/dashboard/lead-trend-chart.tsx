"use client";

/**
 * Tendencia diaria de mis leads: nuevas solicitudes vs. cerradas ganadas, día a día. Dos
 * líneas sobre el mismo eje porque ambas son la misma unidad (conteo de solicitudes).
 */
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fmtNumber } from "@/lib/format";

function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }).replace(".", "");
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
  const leads = payload.find((p) => p.dataKey === "leads")?.value ?? 0;
  const won = payload.find((p) => p.dataKey === "won")?.value ?? 0;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-[var(--foreground)]">{label}</p>
      <p className="flex items-center gap-1.5 font-medium text-[var(--fm-navy)]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--fm-navy)]" />
        {fmtNumber(leads)} {leads === 1 ? "solicitud nueva" : "solicitudes nuevas"}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 font-medium text-[var(--primary)]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
        {fmtNumber(won)} {won === 1 ? "vendida" : "vendidas"}
      </p>
    </div>
  );
}

export function LeadTrendChart({ data }: { data: { day: string; leads: number; won: number }[] }) {
  if (data.length === 0 || data.every((d) => d.leads === 0 && d.won === 0)) {
    return (
      <p className="px-4 py-14 text-center text-xs text-[var(--muted-foreground)]">
        Todavía no hay movimiento de leads que graficar en este periodo.
      </p>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: dayLabel(d.day) }));

  return (
    <div className="h-72 w-full px-1 py-4 sm:px-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={26}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
          <Line
            type="monotone"
            dataKey="leads"
            name="Solicitudes nuevas"
            stroke="var(--fm-navy)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="won"
            name="Vendidas"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
