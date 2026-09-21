import { IntakeValue } from "@/components/stock/intake-value";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Download, TrendingUp } from "lucide-react";

import { EmptyState, Panel } from "@/components/ui/primitives";
import type { getInventoryHistory } from "@/lib/data/crm";
import { fmtCLP, fmtDateTime, fmtNumber, fmtPlate } from "@/lib/format";

const INPUT = "h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-sm outline-none focus:border-[var(--primary)]";
const KIND_LABEL: Record<string, string> = { purchase: "Stock propio", consignment: "Consignado", trade_in: "Parte de pago" };

export type ClosedSalesParams = {
  sq?: string; sKind?: string; sAgent?: string; sLocation?: string;
  sFrom?: string; sTo?: string; sPage?: string; tab?: string;
};

function salesHref(params: ClosedSalesParams, changes: Partial<ClosedSalesParams>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...changes })) {
    if (value) query.set(key, value);
  }
  return `/historial-stock?${query.toString()}`;
}

function salesExportHref(params: ClosedSalesParams) {
  const query = new URLSearchParams({ outcome: "sold" });
  const map: [keyof ClosedSalesParams, string][] = [["sq", "q"], ["sKind", "acquisitionKind"], ["sAgent", "salesAgentId"], ["sLocation", "locationId"], ["sFrom", "from"], ["sTo", "to"]];
  for (const [key, out] of map) { const value = params[key]; if (value) query.set(out, value); }
  return `/api/crm/inventory-history/export?${query.toString()}`;
}

export function ClosedSalesPanel({
  params,
  sales,
  agents,
  locations,
}: {
  params: ClosedSalesParams;
  sales: Awaited<ReturnType<typeof getInventoryHistory>>;
  agents: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
  return (
      <Panel
        title="Ventas cerradas"
        subtitle={`${fmtNumber(sales.total)} ventas según los filtros · Total ventas: ${fmtCLP(sales.summary.salesAmount)}`}
        action={<a href={salesExportHref(params)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium hover:border-[var(--primary)]"><Download className="h-4 w-4 text-[var(--primary)]" />Exportar Excel</a>}
      >
        <form action="/historial-stock" className="grid gap-2 border-b border-[var(--border)] bg-[#f8f8f5] p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
          <input type="hidden" name="tab" value="ventas" />
          <input name="sq" defaultValue={params.sq} placeholder="Código, patente, vehículo o vendedor" className={`${INPUT} sm:col-span-2`} />
          <select name="sKind" defaultValue={params.sKind ?? ""} className={INPUT}>
            <option value="">Todo tipo de stock</option>
            <option value="purchase">Stock propio</option>
            <option value="consignment">Consignado</option>
            <option value="trade_in">Parte de pago</option>
          </select>
          <select name="sAgent" defaultValue={params.sAgent ?? ""} className={INPUT}>
            <option value="">Todos los vendedores</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <select name="sLocation" defaultValue={params.sLocation ?? ""} className={INPUT}>
            <option value="">Todas las sucursales</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
          <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-[var(--muted-foreground)]">Desde<input type="date" name="sFrom" defaultValue={params.sFrom} className={INPUT} /></label>
          <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-[var(--muted-foreground)]">Hasta<input type="date" name="sTo" defaultValue={params.sTo} className={INPUT} /></label>
          <div className="flex gap-2 sm:col-span-2"><button className="h-10 flex-1 rounded-lg bg-[var(--fm-navy)] px-4 text-sm font-semibold text-white">Filtrar</button><Link href={salesHref(params, { tab: "ventas", sq: undefined, sKind: undefined, sAgent: undefined, sLocation: undefined, sFrom: undefined, sTo: undefined, sPage: undefined })} className="flex h-10 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-sm">Limpiar</Link></div>
        </form>

        {sales.items.length === 0 ? (
          <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="Sin ventas cerradas para estos filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
              <thead className="bg-[var(--muted)]/60 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]"><tr><th className="px-4 py-3">Código</th><th className="px-3 py-3">Vehículo</th><th className="px-3 py-3">Tipo stock</th><th className="px-3 py-3">Vendedor</th><th className="px-3 py-3">Sucursal</th><th className="px-3 py-3 text-right">Valor de ingreso</th><th className="px-3 py-3 text-right">Precio de venta</th><th className="px-3 py-3">Fecha venta</th></tr></thead>
              <tbody className="divide-y divide-[var(--border)]">{sales.items.map((item) => (
                <tr key={item.vehicleId}>
                  <td className="px-4 py-3 font-mono font-semibold">{item.stockNumber == null ? "—" : `STK-${String(item.stockNumber).padStart(6, "0")}`}</td>
                  <td className="px-3 py-3"><p className="font-medium">{[item.brand, item.model, item.year].filter(Boolean).join(" ")}</p><p className="text-[var(--muted-foreground)]">{fmtPlate(item.patent)}</p></td>
                  <td className="px-3 py-3">{KIND_LABEL[item.acquisitionKind ?? ""] ?? "Sin registrar"}</td>
                  <td className="px-3 py-3">{item.salesAgentName ?? "Sin asignar"}</td>
                  <td className="px-3 py-3">{item.locationName ?? "—"}</td>
                  <td className="px-3 py-3 text-right font-mono font-semibold"><IntakeValue item={item} /></td>
                  <td className="px-3 py-3 text-right font-mono font-semibold">{fmtCLP(item.saleAmount)}{item.saleAmount != null && !item.purchaseId && <span className="block font-sans text-[10px] font-normal text-[var(--muted-foreground)]">Precio publicado de referencia</span>}</td>
                  <td className="px-3 py-3 text-[var(--muted-foreground)]">{fmtDateTime(item.soldAt)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {sales.totalPages > 1 && <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-xs"><span>Página {sales.page} de {sales.totalPages}</span><div className="flex gap-2">{sales.page > 1 && <Link href={salesHref(params, { tab: "ventas", sPage: String(sales.page - 1) })} className="flex items-center gap-1 rounded-lg border px-3 py-2"><ArrowLeft className="h-3.5 w-3.5" />Anterior</Link>}{sales.page < sales.totalPages && <Link href={salesHref(params, { tab: "ventas", sPage: String(sales.page + 1) })} className="flex items-center gap-1 rounded-lg border px-3 py-2">Siguiente<ArrowRight className="h-3.5 w-3.5" /></Link>}</div></div>}
      </Panel>
  );
}

