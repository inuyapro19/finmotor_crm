import Link from "next/link";
import { backendJson } from "@/lib/api/client";
import { requireCrmSession } from "@/lib/auth/session";
import { requireDemoFrontend, type DemoStatus } from "@/lib/demo";
import { fmtCLP, fmtNumber } from "@/lib/format";
import { ResetDemoPanel } from "@/components/demo/reset-panel";

type Vehicle = { id: string; brand: string; model: string; year: number; price: number; mileage: number; vehicle_photos?: { url: string }[] };

export default async function DemoMarketplace({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  requireDemoFrontend();
  const session = await requireCrmSession();
  const { q = "" } = await searchParams;
  const [status, catalogue] = await Promise.all([
    backendJson<DemoStatus>("/demo/status"),
    backendJson<{ vehicles: Vehicle[]; total: number }>(`/vehicles?limit=60&q=${encodeURIComponent(q)}`),
  ]);
  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-amber-700">Marketplace privado de pruebas</p>
      <h1 className="text-3xl font-bold">{session.dealership.name}</h1>
      <p className="mt-2 text-sm">Prueba el catálogo, las ofertas y el stock. Todos los registros pertenecen al entorno DEMO.</p>
    </div>
    <nav className="flex flex-wrap gap-4 text-sm font-semibold underline">
      <Link href="/vehiculos">Subir y administrar stock</Link><Link href="/mayorista">Subastas de prueba</Link>
      <Link href="/mayorista/pujas">Mis pujas</Link><Link href="/">Abrir CRM</Link>
    </nav>
    <ResetDemoPanel generation={status.generation} canReset={status.canReset} />
    <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Buscar marca, modelo o patente" className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2" />
      <button className="rounded-lg bg-[var(--primary)] px-4 text-white">Buscar</button></form>
    <p className="text-sm">{catalogue.total} vehículos visibles en este catálogo demo.</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{catalogue.vehicles.map((vehicle) => <Link key={vehicle.id} href={`/demo/marketplace/${vehicle.id}`} className="overflow-hidden rounded-xl border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={vehicle.vehicle_photos?.[0]?.url || "/vehicle-fallback-card.svg"} alt={`${vehicle.brand} ${vehicle.model}`} className="aspect-[16/10] w-full object-cover" />
      <div className="space-y-2 p-4"><h2 className="text-lg font-semibold">{vehicle.brand} {vehicle.model}</h2>
        <p className="text-sm">{vehicle.year} · {fmtNumber(vehicle.mileage)} km</p><p className="text-xl font-bold">{fmtCLP(vehicle.price)}</p></div>
    </Link>)}</div>
  </div>;
}
