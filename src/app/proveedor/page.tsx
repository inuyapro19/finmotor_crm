import Link from "next/link";
import { Car } from "lucide-react";

import { EmptyState, PageHeader, Pill, StatCard } from "@/components/ui/primitives";
import { backendJson } from "@/lib/api/client";
import { requireSupplierSession } from "@/lib/auth/supplier-session";
import { fmtCLP, fmtNumber, fmtPlate, timeAgo } from "@/lib/format";
import { ShareStockLink } from "@/components/wholesale/share-stock-link";
import { LISTING_STATUS, supplierSlug, vehicleTitle, type SupplierLocation, type WholesaleListing } from "@/lib/wholesale";

export default async function SupplierHome({ searchParams }: { searchParams: Promise<{ sucursal?: string }> }) {
  const session = await requireSupplierSession();
  const { sucursal } = await searchParams;
  const [{ locations }, all] = await Promise.all([
    backendJson<{ locations: SupplierLocation[] }>("/wholesale/supplier/locations").catch(() => ({ locations: [] as SupplierLocation[] })),
    backendJson<{ items: WholesaleListing[] }>("/wholesale/supplier/listings"),
  ]);
  const branch = locations.find((l) => l.id === sucursal) ?? null;
  // El filtro por sucursal se aplica sobre el listado completo (los contadores también).
  const items = branch ? all.items.filter((i) => i.locationId === branch.id) : all.items;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://crm.finmotor.cl").replace(/\/$/, "");
  // Enlace con el identificador corto del proveedor (mismo slug que entiende el backend).
  const shareUrl = `${appUrl}/mayorista?proveedor=${session.supplier.slug || supplierSlug(session.supplier.name)}`;
  const count = (status: string) => items.filter((i) => i.status === status).length;
  const awaiting = items.reduce((sum, i) => sum + (i.awaitingSupplier ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Mis vehículos"
        subtitle="Publicas en privado: sólo automotoras de la red Finmotor ven tus unidades y te ofertan."
        action={session.canWrite && (
          <Link href="/proveedor/vehiculos/nuevo" className="rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white">
            Publicar vehículo
          </Link>
        )}
      />
      <ShareStockLink url={shareUrl} supplierName={session.supplier.name} />
      {locations.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ id: "", name: "Todas las sucursales" }, ...locations.filter((l) => l.isActive || l.id === branch?.id)].map((l) => {
            const on = (branch?.id ?? "") === l.id;
            return (
              <Link key={l.id || "all"} href={l.id ? `/proveedor?sucursal=${l.id}` : "/proveedor"}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? "border-[var(--fm-navy)] bg-[var(--fm-navy)] text-white" : "border-[var(--border)] bg-[var(--card)]"}`}>
                {l.name}
              </Link>
            );
          })}
        </div>
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ofertas por responder" value={awaiting} tone={awaiting ? "alert" : "neutral"} />
        <StatCard label="Publicados" value={count("published")} />
        <StatCard label="Reservados" value={count("reserved")} hint="Trato aceptado, transferencia pendiente" />
        <StatCard label="Vendidos" value={count("sold")} />
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {items.length === 0 ? (
          <EmptyState icon={<Car className="h-8 w-8" />} title="Todavía no publicas vehículos"
            description="Crea la unidad, súmale fotos y el informe histórico, y publícala para las automotoras." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/proveedor/vehiculos/${item.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]/50">
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--muted)]">
                    {item.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{vehicleTitle(item)}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {[fmtPlate(item.plate), item.mileage != null ? `${fmtNumber(item.mileage)} km` : null, item.locationName, item.code,
                        `actualizado ${timeAgo(item.updatedAt)}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold tabular-nums">{fmtCLP(item.askingPrice)}</p>
                    {!!item.openDeals && <p className="text-[11px] text-[var(--muted-foreground)]">{item.openDeals} negociación(es)</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill variant={LISTING_STATUS[item.status].variant}>{LISTING_STATUS[item.status].label}</Pill>
                    {!!item.awaitingSupplier && <Pill variant="warn">{item.awaitingSupplier} por responder</Pill>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
