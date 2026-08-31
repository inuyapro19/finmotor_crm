import { redirect } from "next/navigation";


/** Compatibilidad para enlaces antiguos del CRM. */
export default function LegacyStockPage() {
  redirect("/vehiculos");
}
