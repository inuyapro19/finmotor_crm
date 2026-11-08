"use client";

/**
 * Pestañas de la ficha mayorista: COPIA de `VehicleDetailTabs` de frontend-web
 * (`frontend-web/src/components/vehicle/vehicle-detail-tabs.tsx`), mismo markup. Cambios del
 * canal: "Verificación" muestra el informe histórico de la unidad y "Vendedor" pasa a
 * "Proveedor" (con acceso a todo su stock).
 */
import { useState } from "react";
import Link from "next/link";
import { FileCheck2, MapPin } from "lucide-react";

import { ReportButton } from "@/components/wholesale/report-button";
import { supplierSlug, type WholesaleListing } from "@/lib/wholesale";

type Supplier = { name: string; initials: string; locationName?: string | null; location?: string | null };

type Props = {
  specs: [string, string][];
  description?: string | null;
  listingId: string;
  report: WholesaleListing["report"];
  reportLabel: string;
  supplier?: Supplier | null;
};

const TABS = [
  { key: "detalles", label: "Detalles" },
  { key: "informe", label: "Informe histórico" },
  { key: "descripcion", label: "Descripción" },
  { key: "proveedor", label: "Proveedor" },
];

export function MarketDetailTabs({ specs, description, listingId, report, reportLabel, supplier }: Props) {
  const [tab, setTab] = useState("detalles");

  return (
    <div className="mt-8">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto" style={{ borderBottom: "1px solid var(--fm-border)", scrollbarWidth: "none" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="shrink-0 px-3 py-3 text-sm font-medium transition-colors sm:px-4"
            style={{
              background: "transparent",
              border: 0,
              borderBottom: "2px solid",
              borderColor: tab === t.key ? "var(--fm-teal-600)" : "transparent",
              color: tab === t.key ? "var(--fm-teal-600)" : "var(--fm-ink-500)",
              marginBottom: -1,
              cursor: "pointer",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {/* Descripción → tabla de especificaciones */}
        {tab === "descripcion" && (
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--fm-ink-500)" }}>Especificaciones</p>
            {specs.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--fm-border)" }}>
                {specs.map(([key, val], i) => (
                  <div key={key} className="flex items-center justify-between px-5 py-3.5"
                    style={{ borderTop: i > 0 ? "1px solid var(--fm-border)" : "none", background: i % 2 === 0 ? "#fff" : "var(--fm-bg)" }}>
                    <span className="text-sm" style={{ color: "var(--fm-ink-500)" }}>{key}</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--fm-teal-600)" }}>{val}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--fm-ink-400)" }}>Sin especificaciones registradas.</p>
            )}
          </div>
        )}

        {/* Informe histórico (equivale a "Verificación" de la web) */}
        {tab === "informe" && (
          <div>
            <div className="mb-4 flex items-center gap-3 rounded-xl p-4" style={{ background: "var(--fm-green-50)" }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--fm-green-600)", color: "#fff" }}>
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--fm-green-700)" }}>{reportLabel}</p>
                <p className="text-xs" style={{ color: "var(--fm-ink-500)" }}>
                  {report.kind === "attached" ? "Adjuntado por el proveedor." : "Emitido por Finmotor para esta patente."} Revísalo antes de ofertar.
                </p>
              </div>
            </div>
            <ReportButton listingId={listingId} report={report} />
          </div>
        )}

        {/* Detalles → texto libre de la publicación */}
        {tab === "detalles" && (
          <div className="whitespace-pre-line text-sm leading-relaxed" style={{ color: "var(--fm-teal-600)" }}>
            {description || <span style={{ color: "var(--fm-ink-400)" }}>Sin descripción.</span>}
          </div>
        )}

        {/* Proveedor */}
        {tab === "proveedor" && (
          <div>
            {supplier ? (
              <div className="flex items-center gap-4 rounded-2xl border p-5" style={{ background: "#fff", borderColor: "var(--fm-border)" }}>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: "var(--fm-teal-600)" }}>
                  {supplier.initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold" style={{ color: "var(--fm-teal-600)" }}>{supplier.name}</h3>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--fm-teal-50)", color: "var(--fm-teal-600)" }}>
                      Proveedor mayorista
                    </span>
                  </div>
                  {(supplier.locationName || supplier.location) && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: "var(--fm-ink-500)" }}>
                      <MapPin className="h-3 w-3" />
                      {[supplier.locationName ? `Sucursal ${supplier.locationName}` : null, supplier.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/mayorista?proveedor=${supplierSlug(supplier.name)}`}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: "var(--fm-green-50)", color: "var(--fm-green-700)" }}>
                      Ver todo su stock →
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--fm-ink-400)" }}>Información del proveedor no disponible.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
