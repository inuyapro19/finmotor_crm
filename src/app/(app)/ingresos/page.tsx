import { redirect } from "next/navigation";


/** Los ingresos ahora forman parte del recurso único Vehículos. */
export default function LegacyAcquisitionsPage() {
  redirect("/vehiculos");
}
