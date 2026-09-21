"use client";

import { useState } from "react";
import { Pill } from "@/components/ui/primitives";
import { fmtCLP } from "@/lib/format";

type MarginSnapshot = {
  precio_actual: number;
  precio_solicitado: number;
  margen_actual: number;
  margen_resultante: number;
  margen_resignado: number;
  delta_p_requerido: number | null;
  recommendation: string;
};

/** "El cliente pide $X de descuento, ¿lo aprobamos?" -- MIA nunca autoriza (R-MRG-01),
 * solo calcula el Δp mínimo que justificaría ceder ese margen, contra el costo REAL de
 * adquisición del vehículo. */
export function MarginCheckCalculator({
  leadId,
  vehiclePrice,
  canWrite,
}: {
  leadId: string;
  vehiclePrice: number | null;
  canWrite: boolean;
}) {
  const [requestedPrice, setRequestedPrice] = useState(vehiclePrice ? String(vehiclePrice) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarginSnapshot | null>(null);

  const check = async () => {
    const price = Number(requestedPrice);
    if (!price || price <= 0) {
      setError("Ingresa un precio válido");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/mia-crm-margin-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedPrice: price }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No se pudo calcular el margen.");
        return;
      }
      setResult(data.marginSnapshot as MarginSnapshot);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (!canWrite) {
    return <p className="text-sm text-[var(--muted-foreground)]">Tu cuenta es de solo lectura.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        Si el cliente pide un precio menor, calcula acá cuánto margen se resigna y qué tan segura tiene que estar la
        venta para que valga la pena ceder eso — MIA solo recomienda, la decisión de aprobar el descuento es tuya.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium">
          Precio que pide el cliente
          <input
            type="number"
            min={1}
            value={requestedPrice}
            onChange={(event) => setRequestedPrice(event.target.value)}
            className="mt-1 block w-48 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Calculando..." : "Calcular margen"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {result && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Margen actual" value={fmtCLP(result.margen_actual)} />
            <Metric label="Margen si se acepta" value={fmtCLP(result.margen_resultante)} />
            <Metric label="Margen resignado" value={fmtCLP(result.margen_resignado)} />
            <Metric
              label="Δp requerido"
              value={result.delta_p_requerido != null ? `${(result.delta_p_requerido * 100).toFixed(1)}%` : "—"}
            />
          </div>
          <div className="mt-3 flex items-start gap-2">
            <Pill variant={result.delta_p_requerido != null && result.delta_p_requerido < 0.3 ? "success" : "warn"}>
              {result.delta_p_requerido != null && result.delta_p_requerido < 0.3 ? "Umbral razonable" : "Umbral exigente"}
            </Pill>
            <p className="text-xs">{result.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
