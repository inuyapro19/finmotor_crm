"use client";

/**
 * Embudo de mis leads: cuántas solicitudes hay hoy en cada etapa. Barras horizontales porque
 * las etiquetas de etapa ("Documentos y cierre") no caben legibles como ticks verticales.
 */
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { STAGES, type LeadStage } from "@/lib/leads";
import { fmtNumber } from "@/lib/format";

const STAGE_COLOR: Record<LeadStage, string> = {
  new: "var(--fm-navy)",
  contacted: "var(--fm-navy)",
  visit: "var(--fm-navy)",
  quoted: "var(--fm-navy)",
  financing: "var(--fm-navy)",
  documents: "var(--fm-navy)",
  won: "var(--primary)",
  lost: "#c2c7d6",
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: { stage: LeadStage; count: number } }[];
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  const stage = STAGES.find((s) => s.key === point.stage);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-[var(--foreground)]">{stage?.label ?? point.stage}</p>
      <p className="text-[var(--muted-foreground)]">
        {fmtNumber(point.count)} {point.count === 1 ? "solicitud" : "solicitudes"}
      </p>
    </div>
  );
}

export function LeadFunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  const chartData = STAGES.map((stage) => ({
    stage: stage.key,
    label: stage.short,
    count: data.find((d) => d.stage === stage.key)?.count ?? 0,
  }));

  if (chartData.every((d) => d.count === 0)) {
    return (
      <p className="px-4 py-14 text-center text-xs text-[var(--muted-foreground)]">
        Todavía no tienes solicitudes en este periodo.
      </p>
    );
  }

  return (
    <div className="h-72 w-full px-1 py-4 sm:px-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={110}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          <Bar dataKey="count" radius={[0, 5, 5, 0]} barSize={18}>
            {chartData.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_COLOR[entry.stage as LeadStage]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
