"use client";

import { useId } from "react";
import { FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { commissionError, type CommissionType } from "@/lib/commission";

export function CommissionInput({ type, value, onTypeChange, onChange, required = false }: {
  type: CommissionType; value: string; onTypeChange: (type: CommissionType) => void;
  onChange: (value: string) => void; required?: boolean;
}) {
  const id = useId();
  const error = commissionError(type, value);
  return <div className="space-y-3">
    <FormField label="Cómo se cobra la comisión">
      <select aria-label="Cómo se cobra la comisión" value={type} onChange={(e) => onTypeChange(e.target.value as CommissionType)} className={fieldInputClass}>
        <option value="percentage">Porcentaje sobre la venta (%)</option>
        <option value="fixed">Monto fijo en pesos (CLP)</option>
      </select>
    </FormField>
    <FormField label={type === "fixed" ? "Comisión fija (CLP)" : "Comisión sobre el precio final (%)"} required={required} hint={type === "fixed" ? "Ejemplo: 300000 significa $300.000 de comisión, independiente del precio de venta." : "Ejemplo: 5 significa el 5% del precio final de venta."}>
      <input aria-label={type === "fixed" ? "Comisión fija (CLP)" : "Comisión sobre el precio final (%)"} aria-invalid={Boolean(error)} aria-describedby={error ? id : undefined}
        type="number" min={0} max={type === "percentage" ? 100 : 99999999999999} step={type === "percentage" ? "0.01" : "1"}
        required={required} placeholder={type === "fixed" ? "Ej.: 300000" : "Ej.: 5"} value={value} onChange={(e) => onChange(e.target.value)} className={fieldInputClass} />
      {error && <p id={id} role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
    </FormField>
  </div>;
}
