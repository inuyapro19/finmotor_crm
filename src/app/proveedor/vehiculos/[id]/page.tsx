import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { DealThread } from "@/components/wholesale/deal-thread";
import { ListingForm } from "@/components/wholesale/listing-form";
import { SupplierListingManager } from "@/components/wholesale/supplier-listing-manager";
import { BackendError, backendJson } from "@/lib/api/client";
import { requireSupplierSession } from "@/lib/auth/supplier-session";
import { fmtPlate } from "@/lib/format";
import {
  LISTING_STATUS, vehicleTitle, type ReportProduct, type SupplierLocation, type WholesaleDeal, type WholesaleListing,
} from "@/lib/wholesale";

export default async function SupplierListingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSupplierSession();
  const { id } = await params;
  let data: { listing: WholesaleListing; deals: WholesaleDeal[] };
  try {
    data = await backendJson(`/wholesale/supplier/listings/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof BackendError && [403, 404, 422].includes(error.status)) notFound();
    throw error;
  }
  const { listing, deals } = data;
  const reportProducts = await backendJson<{ products: ReportProduct[] }>("/wholesale/supplier/report-products")
    .then((r) => r.products)
    .catch(() => [] as ReportProduct[]);
  const { locations } = await backendJson<{ locations: SupplierLocation[] }>("/wholesale/supplier/locations")
    .catch(() => ({ locations: [] as SupplierLocation[] }));
  const status = LISTING_STATUS[listing.status];
  const editable = session.canWrite && ["draft", "withdrawn"].includes(listing.status) && !listing.auction;
  // Primero lo que exige acción: ofertas por responder y tratos por confirmar.
  const ordered = [...deals].sort((a, b) => Number(b.awaitingMe || b.status === "agreed") - Number(a.awaitingMe || a.status === "agreed"));

  return (
    <>
      <Link href="/proveedor" className="mb-2 inline-block text-xs text-[var(--muted-foreground)] underline">← Mis vehículos</Link>
      <PageHeader
        title={vehicleTitle(listing)}
        subtitle={`${fmtPlate(listing.plate)} · ${listing.code}`}
        action={<Pill variant={status.variant}>{status.label}</Pill>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <SupplierListingManager listing={listing} canWrite={session.canWrite} reportProducts={reportProducts} />
          <Panel title="Datos de la unidad">
            <div className="p-4"><ListingForm listing={listing} disabled={!editable} locations={locations} /></div>
          </Panel>
        </div>
        <Panel title="Adjudicación y entrega" subtitle="La subasta se adjudica automáticamente a la mayor puja válida al cierre.">
          {ordered.length === 0 ? (
            <EmptyState title="Sin adjudicación todavía"
              description={listing.auction ? "Revisa las pujas y el cierre en el panel Subasta." : "Configura y abre la subasta para recibir pujas."} />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {ordered.map((deal) => (
                <div key={deal.id} className="p-4">
                  <DealThread deal={deal} side="supplier" apiBase="/api/proveedor" canAct={session.canWrite}
                    title={deal.dealershipName ?? "Automotora"} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
