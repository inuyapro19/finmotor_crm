import Link from "next/link";
import { notFound } from "next/navigation";
import { backendJson, BackendError } from "@/lib/api/client";
import { requireCrmSession } from "@/lib/auth/session";
import { requireDemoFrontend } from "@/lib/demo";
import { fmtCLP, fmtNumber } from "@/lib/format";
import { DemoOfferPanel } from "@/components/demo/offer-panel";

type Detail = { vehicle: { id: string; seller_id: string; status: string; brand: string; model: string; year: number; price: number; mileage: number; patent: string; description: string }; photos: { url: string }[] };

export default async function DemoVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  requireDemoFrontend();
  const session = await requireCrmSession();
  await backendJson("/demo/status");
  const { id } = await params;
  let data: Detail;
  try { data = await backendJson<Detail>(`/vehicles/${encodeURIComponent(id)}`); }
  catch (error) { if (error instanceof BackendError && error.status === 404) notFound(); throw error; }
  const { vehicle } = data;
  return <div className="space-y-5">
    <Link href="/demo/marketplace" className="text-sm underline">Volver al marketplace demo</Link>
    <h1 className="text-3xl font-bold">{vehicle.brand} {vehicle.model}</h1>
    <div className="grid gap-6 lg:grid-cols-2"><div className="space-y-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.photos[0]?.url || "/vehicle-fallback-card.svg"} alt={`${vehicle.brand} ${vehicle.model}`} className="aspect-[16/10] w-full rounded-xl object-cover" />
      <p>{vehicle.year} · {fmtNumber(vehicle.mileage)} km · {vehicle.patent}</p>
      <p className="text-2xl font-bold">{fmtCLP(vehicle.price)}</p><p>{vehicle.description}</p>
    </div><DemoOfferPanel vehicleId={vehicle.id} price={vehicle.price} disabledReason={
      vehicle.seller_id === session.userId ? "Este es tu stock. Para probar una oferta, ingresa con la cuenta compradora."
        : !["PUBLISHED", "PUBLISHED_VERIFIED"].includes(vehicle.status) ? "Este vehículo no está disponible para ofertar." : undefined
    } /></div>
  </div>;
}
