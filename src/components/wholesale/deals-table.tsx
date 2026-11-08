"use client";

/**
 * Tabla comercial de negociaciones mayoristas. La usan las dos partes:
 *   - automotora (`side="dealership"`, /mayorista/tratos): contraparte = proveedor.
 *   - proveedor  (`side="supplier"`, /proveedor/negociaciones): contraparte = automotora, + sucursal.
 *
 * Indicadores, filtros (búsqueda, estado, contraparte, sucursal, período), orden por columna y
 * exportación a CSV. Los filtros viven en la URL para poder compartir o volver a la vista.
 * Todo se calcula en el cliente sobre las negociaciones del usuario (el backend devuelve ≤500).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search, X } from "lucide-react";

import { EmptyState, Pill, StatCard } from "@/components/ui/primitives";
import { fmtCLP, fmtDateTime, fmtPlate, timeAgo } from "@/lib/format";
import { DEAL_STATUS, vehicleTitle, type DealStatus, type Side, type WholesaleDeal } from "@/lib/wholesale";

const GRID_HEAD = "whitespace-nowrap border-b border-r border-[#203568] bg-[var(--fm-navy)] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white";
const GRID_CELL = "whitespace-nowrap border-b border-r border-[var(--border)] px-3 py-2.5 align-middle";
const control = "h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-sm";

type SortKey = "updated" | "asking" | "current" | "diff" | "offers" | "unit" | "party";

const STATUS_FILTERS: [string, string][] = [
  ["", "Todos los estados"],
  ["action", "Requieren mi acción"],
  ["negotiating", "En negociación"],
  ["agreed", "Trato cerrado"],
  ["completed", "Completados"],
  ["closed", "Rechazadas o canceladas"],
  ["lost", "Vendidas a otra automotora"],
];
const PERIODS: [string, string][] = [["", "Todo el período"], ["7", "Últimos 7 días"], ["30", "Últimos 30 días"], ["90", "Últimos 90 días"]];

/** Monto vigente: pactado si hay trato; si no, la última oferta sobre la mesa. */
function currentAmount(d: WholesaleDeal): number | null {
  return d.agreedAmount ?? d.pendingAmount ?? null;
}

function diffPct(d: WholesaleDeal): number | null {
  const asking = d.listing?.askingPrice;
  const current = currentAmount(d);
  if (!asking || current == null) return null;
  return ((current - asking) / asking) * 100;
}

/** ¿Le toca actuar a quien mira? Responder una oferta o confirmar su parte del cierre. */
function needsAction(d: WholesaleDeal, side: Side): boolean {
  if (d.awaitingMe) return true;
  if (d.status !== "agreed") return false;
  return side === "dealership" ? !d.dealershipConfirmedAt : !d.supplierConfirmedAt;
}

function party(d: WholesaleDeal, side: Side): string {
  return (side === "dealership" ? d.listing?.supplierName : d.dealershipName) ?? "—";
}

function lastMove(d: WholesaleDeal, side: Side): string {
  if (d.agreedAmount != null) return "Pactado";
  if (!d.pendingFrom) return "—";
  return d.pendingFrom === side ? "Tu oferta" : side === "dealership" ? "Pide el proveedor" : "Ofrece la automotora";
}

function SortHead({ k, label, className, active, dir, onSort }: {
  k: SortKey; label: string; className: string; active: boolean; dir: "asc" | "desc"; onSort: (k: SortKey) => void;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`${GRID_HEAD} ${className}`}>
      <button type="button" className="flex items-center gap-1.5 uppercase hover:text-[var(--fm-lime)]" onClick={() => onSort(k)}>
        {label} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

export function DealsTable({ deals, side }: { deals: WholesaleDeal[]; side: Side }) {
  // Hora de referencia del filtro de período, fijada al montar (mantiene puro el cálculo).
  const [now] = useState(() => Date.now());
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("estado") ?? "";
  const partyFilter = params.get(side === "dealership" ? "proveedor" : "automotora") ?? "";
  const location = params.get("sucursal") ?? "";
  const period = params.get("periodo") ?? "";
  const sort = (params.get("orden") as SortKey) || "updated";
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const partyLabel = side === "dealership" ? "Proveedor" : "Automotora";
  const partyParam = side === "dealership" ? "proveedor" : "automotora";

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const parties = useMemo(() => [...new Set(deals.map((d) => party(d, side)).filter((p) => p !== "—"))].sort(), [deals, side]);
  const locations = useMemo(
    () => [...new Set(deals.map((d) => d.listing?.locationName).filter((l): l is string => Boolean(l)))].sort(),
    [deals],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const since = period ? now - Number(period) * 86_400_000 : null;
    const rows = deals.filter((d) => {
      if (term) {
        const hay = [d.listing?.brand, d.listing?.model, d.listing?.versionName, d.listing?.plate, d.listing?.code, party(d, side)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status === "action" && !needsAction(d, side)) return false;
      if (status === "closed" && !["rejected", "cancelled"].includes(d.status)) return false;
      if (["negotiating", "agreed", "completed", "lost"].includes(status) && d.status !== status) return false;
      if (partyFilter && party(d, side) !== partyFilter) return false;
      if (location && d.listing?.locationName !== location) return false;
      if (since && new Date(d.updatedAt).getTime() < since) return false;
      return true;
    });
    const value = (d: WholesaleDeal): number | string => {
      switch (sort) {
        case "asking": return d.listing?.askingPrice ?? -1;
        case "current": return currentAmount(d) ?? -1;
        case "diff": return diffPct(d) ?? -999;
        case "offers": return d.offerCount ?? 0;
        case "unit": return d.listing ? vehicleTitle(d.listing).toLowerCase() : "";
        case "party": return party(d, side).toLowerCase();
        default: return new Date(d.lastEventAt ?? d.updatedAt).getTime();
      }
    };
    return rows.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === "asc" ? cmp : -cmp;
    });
  }, [deals, q, status, partyFilter, location, period, sort, dir, side, now]);

  const kpis = useMemo(() => {
    const agreedValue = deals
      .filter((d) => d.status === "agreed" || d.status === "completed")
      .reduce((sum, d) => sum + (d.agreedAmount ?? 0), 0);
    return {
      action: deals.filter((d) => needsAction(d, side)).length,
      negotiating: deals.filter((d) => d.status === "negotiating").length,
      agreed: deals.filter((d) => d.status === "agreed").length,
      completed: deals.filter((d) => d.status === "completed").length,
      agreedValue,
    };
  }, [deals, side]);

  const exportCsv = () => {
    const header = ["Código", "Unidad", "Patente", partyLabel, ...(side === "supplier" ? ["Sucursal"] : []), "Precio pedido",
      "Primera oferta", "Monto vigente", "Último movimiento", "Dif. vs pedido %", "Ofertas", "Estado", "Actualizado"];
    const rows = filtered.map((d) => [
      d.listing?.code ?? "", d.listing ? vehicleTitle(d.listing) : "", d.listing?.plate ?? "", party(d, side),
      ...(side === "supplier" ? [d.listing?.locationName ?? ""] : []),
      d.listing?.askingPrice ?? "", d.firstOfferAmount ?? "", currentAmount(d) ?? "", lastMove(d, side),
      diffPct(d)?.toFixed(1) ?? "", d.offerCount ?? 0, DEAL_STATUS[d.status].label, d.updatedAt,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `negociaciones-mayoristas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onSort = (k: SortKey) => {
    const active = sort === k;
    setParam({ orden: k === "updated" && active && dir === "asc" ? null : k, dir: active && dir === "desc" ? "asc" : null });
  };
  const head = (k: SortKey, label: string, className = "") => (
    <SortHead k={k} label={label} className={className} active={sort === k} dir={dir} onSort={onSort} />
  );

  const anyFilter = Boolean(q || status || partyFilter || location || period);
  const detailHref = (d: WholesaleDeal) => (side === "dealership" ? `/mayorista/${d.listingId}` : `/proveedor/vehiculos/${d.listingId}`);

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <button type="button" className="text-left" onClick={() => setParam({ estado: status === "action" ? null : "action" })}>
          <StatCard label="Requieren tu acción" value={kpis.action} tone={kpis.action ? "alert" : "neutral"} hint="Responder o confirmar" />
        </button>
        <button type="button" className="text-left" onClick={() => setParam({ estado: status === "negotiating" ? null : "negotiating" })}>
          <StatCard label="En negociación" value={kpis.negotiating} />
        </button>
        <button type="button" className="text-left" onClick={() => setParam({ estado: status === "agreed" ? null : "agreed" })}>
          <StatCard label="Trato cerrado" value={kpis.agreed} hint="Pago y transferencia pendientes" />
        </button>
        <button type="button" className="text-left" onClick={() => setParam({ estado: status === "completed" ? null : "completed" })}>
          <StatCard label="Completados" value={kpis.completed} />
        </button>
        <StatCard label="Monto pactado" value={fmtCLP(kpis.agreedValue)} hint="Tratos cerrados y completados" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className={`${control} flex min-w-[220px] flex-1 items-center gap-2 sm:max-w-sm`}>
          <Search className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          <input defaultValue={q} key={q} placeholder={`Marca, modelo, patente, código o ${partyLabel.toLowerCase()}`}
            onKeyDown={(e) => { if (e.key === "Enter") setParam({ q: (e.target as HTMLInputElement).value.trim() || null }); }}
            onBlur={(e) => e.target.value.trim() !== q && setParam({ q: e.target.value.trim() || null })}
            className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <select value={status} onChange={(e) => setParam({ estado: e.target.value || null })} className={control} aria-label="Estado">
          {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={partyFilter} onChange={(e) => setParam({ [partyParam]: e.target.value || null })} className={control} aria-label={partyLabel}>
          <option value="">{side === "dealership" ? "Todos los proveedores" : "Todas las automotoras"}</option>
          {parties.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {side === "supplier" && locations.length > 0 && (
          <select value={location} onChange={(e) => setParam({ sucursal: e.target.value || null })} className={control} aria-label="Sucursal">
            <option value="">Todas las sucursales</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <select value={period} onChange={(e) => setParam({ periodo: e.target.value || null })} className={control} aria-label="Período">
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {anyFilter && (
          <button type="button" onClick={() => router.replace(pathname, { scroll: false })}
            className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] px-2 text-xs font-medium text-[var(--muted-foreground)] hover:underline">
            <X className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--muted-foreground)]">{filtered.length} de {deals.length}</span>
        <button type="button" onClick={exportCsv} disabled={!filtered.length}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]">
        {deals.length === 0 ? (
          <EmptyState title={side === "dealership" ? "Aún no negocias unidades mayoristas" : "Aún no recibes ofertas"}
            description={side === "dealership" ? "Explora el marketplace y oferta por las unidades que te interesen."
              : "Publica unidades y comparte tu stock con automotoras para recibir ofertas."} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Ninguna negociación con esos filtros" description="Prueba con otros filtros o límpialos." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-xs">
              <thead>
                <tr>
                  {head("unit", "Unidad", "min-w-[260px]")}
                  {head("party", partyLabel, "min-w-[160px]")}
                  {side === "supplier" && <th className={GRID_HEAD}>Sucursal</th>}
                  {head("asking", "Precio pedido", "text-right")}
                  <th className={`${GRID_HEAD} text-right`}>1ª oferta</th>
                  {head("current", "Monto vigente", "text-right")}
                  {head("diff", "Dif. vs pedido", "text-right")}
                  {head("offers", "Ofertas", "text-center")}
                  <th className={GRID_HEAD}>Estado</th>
                  {head("updated", "Último movimiento")}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => {
                  const status = DEAL_STATUS[d.status as DealStatus];
                  const diff = diffPct(d);
                  const action = needsAction(d, side);
                  const href = detailHref(d);
                  return (
                    <tr key={d.id} onClick={() => router.push(href)}
                      className={`cursor-pointer transition-colors hover:bg-[var(--fm-lime)]/10 ${i % 2 ? "bg-[var(--muted)]/30" : "bg-[var(--card)]"} ${action ? "shadow-[inset_3px_0_0_#d97706]" : ""}`}>
                      <td className={GRID_CELL}>
                        <Link href={href} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2.5">
                          <span className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--muted)]">
                            {d.listing?.coverUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={d.listing.coverUrl} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[200px] truncate text-sm font-semibold">{d.listing ? vehicleTitle(d.listing) : "Unidad"}</span>
                            <span className="block font-mono text-[11px] text-[var(--muted-foreground)]">
                              {[d.listing && fmtPlate(d.listing.plate), d.listing?.code].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className={`${GRID_CELL} font-medium`}>
                        {side === "dealership" && d.listing?.supplierSlug ? (
                          <Link href={`/mayorista?proveedor=${d.listing.supplierSlug}`} onClick={(e) => e.stopPropagation()}
                            className="hover:underline" title="Ver todo su stock">
                            {party(d, side)}
                          </Link>
                        ) : party(d, side)}
                      </td>
                      {side === "supplier" && <td className={GRID_CELL}>{d.listing?.locationName ?? "—"}</td>}
                      <td className={`${GRID_CELL} text-right tabular-nums`}>{fmtCLP(d.listing?.askingPrice ?? null)}</td>
                      <td className={`${GRID_CELL} text-right tabular-nums text-[var(--muted-foreground)]`}>
                        {d.firstOfferAmount != null ? fmtCLP(d.firstOfferAmount) : "—"}
                      </td>
                      <td className={`${GRID_CELL} text-right`}>
                        <span className="block font-bold tabular-nums">{currentAmount(d) != null ? fmtCLP(currentAmount(d)) : "—"}</span>
                        <span className="block text-[10px] text-[var(--muted-foreground)]">{lastMove(d, side)}</span>
                      </td>
                      <td className={`${GRID_CELL} text-right tabular-nums font-semibold ${diff == null ? "" : diff < 0 ? "text-red-600" : "text-[var(--fm-green)]"}`}>
                        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`}
                      </td>
                      <td className={`${GRID_CELL} text-center tabular-nums`}>{d.offerCount ?? 0}</td>
                      <td className={GRID_CELL}>
                        <div className="flex flex-col items-start gap-1">
                          <Pill variant={status.variant}>{status.label}</Pill>
                          {d.awaitingMe && <Pill variant="warn">Por responder</Pill>}
                          {!d.awaitingMe && action && <Pill variant="warn">Confirma tu parte</Pill>}
                        </div>
                      </td>
                      <td className={GRID_CELL} title={fmtDateTime(d.lastEventAt ?? d.updatedAt)}>
                        {timeAgo(d.lastEventAt ?? d.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
