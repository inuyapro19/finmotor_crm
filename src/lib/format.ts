/** Formateadores compartidos del CRM. Todo en es-CL. */

export function fmtCLP(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CL").format(n);
}

/** "hace 2 h", "hace 3 días". Para la antigüedad del lead, que es lo que apura al agente. */
export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

/** Minutos transcurridos desde una fecha. Devuelve null si la fecha no es válida. */
export function minutesSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 60000);
}

/** Patente chilena en formato legible: BBBB12 -> BB·BB·12 no; se muestra tal cual en mayúsculas. */
export function fmtPlate(value: string | null | undefined): string {
  const plate = (value || "").trim().toUpperCase();
  return plate || "—";
}

/** Teléfono chileno a formato marcable (+56...). Devuelve null si no hay dígitos suficientes. */
export function toDialable(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("56")) return `+${digits}`;
  if (digits.length === 9) return `+56${digits}`;
  if (digits.length === 8) return `+569${digits}`;
  return `+${digits}`;
}
