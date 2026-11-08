import { fmtCLP } from "@/lib/format";

export type CommissionType = "percentage" | "fixed";
type Commission = { commissionPct?: number | null; commissionAmount?: number | null };

export function commissionError(type: CommissionType, value: string): string | null {
  if (value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return "La comisión debe ser un valor mayor o igual a cero";
  if (type === "percentage" && number > 100) return "El porcentaje debe estar entre 0 y 100. Para ingresar pesos, selecciona Monto fijo (CLP).";
  if (type === "fixed" && (!Number.isInteger(number) || number > 99999999999999)) return "Ingresa el monto fijo en pesos chilenos enteros";
  return null;
}

export function commissionLabel(value: Commission): string {
  if (value.commissionAmount != null) return `${fmtCLP(value.commissionAmount)} fijos`;
  return value.commissionPct != null ? `${value.commissionPct.toLocaleString("es-CL")}% sobre la venta` : "Sin acordar";
}

export function commissionValue(value: Commission, salePrice: number): number | null {
  if (value.commissionAmount != null) return value.commissionAmount;
  return value.commissionPct != null ? Math.round(salePrice * value.commissionPct / 100) : null;
}
