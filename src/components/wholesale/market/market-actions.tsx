"use client";

/**
 * Panel lateral de la ficha mayorista: COPIA del armazón de `PurchaseActions` de frontend-web
 * (`frontend-web/src/components/vehicles/purchase-actions.tsx`): encabezado oscuro "Avanza con
 * tu compra", card destacada con número + precio + CTA, filas en acordeón y pie de confianza.
 * El contenido es el del canal mayorista: negociar con el proveedor (oferta, contraoferta y
 * cierre), el informe histórico y cómo funciona la negociación.
 */
import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, FileText, Handshake, ListChecks, Lock, ShieldCheck } from "lucide-react";

import { AuctionPanel as MarketOfferPanel } from "@/components/wholesale/auction-panel";
import { NegotiationSteps } from "@/components/wholesale/market/negotiation-steps";
import { ReportButton } from "@/components/wholesale/report-button";
import { DEAL_STATUS, type WholesaleDeal, type WholesaleListing } from "@/lib/wholesale";

function formatCLP(value: number | null) {
  return "$" + new Intl.NumberFormat("es-CL").format(value ?? 0);
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="absolute -left-2 -top-2 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] font-extrabold leading-none"
      style={{ background: "var(--fm-lime-500)", color: "var(--fm-teal-600)", boxShadow: "0 0 0 2px #fff" }}>
      {n}
    </span>
  );
}

type Key = "negociar" | "informe" | "pasos";

export function MarketActions({
  listing,
  deal,
  canBuy,
  vehicleLabel,
  reportLabel,
}: {
  listing: WholesaleListing;
  deal: WholesaleDeal | null;
  canBuy: boolean;
  vehicleLabel: string;
  reportLabel: string;
}) {
  const [open, setOpen] = useState<Key | null>(deal ? "negociar" : null);
  const dealStatus = deal ? (deal.awaitingMe ? "Te respondieron" : DEAL_STATUS[deal.status].label) : null;

  const rows: { key: Exclude<Key, "negociar">; icon: typeof FileText; title: string; blurb: string }[] = [
    { key: "informe", icon: FileText, title: reportLabel, blurb: "Antecedentes del vehículo en un PDF. Revísalo antes de ofertar." },
    { key: "pasos", icon: ListChecks, title: "Cómo funciona la subasta", blurb: "De la puja a la unidad en tu stock, en 5 pasos." },
  ];

  return (
    <div id="oferta" className="overflow-hidden rounded-[22px] bg-white"
      style={{ border: "1px solid var(--fm-border)", boxShadow: "0 18px 48px -28px rgba(7,29,86,0.35)", scrollMarginTop: "90px" }}>
      {/* Header oscuro */}
      <div className="px-6 py-5 text-white" style={{ background: "var(--fm-teal-600)" }}>
        <span className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <ShieldCheck className="h-5 w-5" style={{ color: "#B3FF00" }} /> Avanza con tu compra
        </span>
        <p className="mt-2 text-sm leading-snug" style={{ color: "rgba(255,255,255,0.72)" }}>
          Participa en la subasta de este <span className="font-semibold text-white">{vehicleLabel}</span>. La mayor puja válida gana al cierre.
        </p>
        <div className="mt-4">
          <button type="button" onClick={() => setOpen("negociar")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-[15px] font-bold transition-transform hover:-translate-y-0.5"
            style={{ color: "var(--fm-teal-600)" }}>
            <Handshake className="h-4 w-4" /> {deal ? "Ver mi compra" : "Ver subasta y pujar"}
          </button>
        </div>
      </div>

      <div className="space-y-2.5 p-5">
        {/* 1 · Negociar: card destacada con precio + CTA (estilo del informe histórico de la web) */}
        <div className="relative rounded-[18px] p-5" style={{ border: "1px solid var(--fm-border)", background: "var(--fm-bg)" }}>
          <span className="absolute -top-2.5 left-5 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide text-[var(--fm-navy)]"
            style={{ background: "var(--fm-lime-500)" }}>
            {dealStatus ? dealStatus.toUpperCase() : "★ PRECIO PARA AUTOMOTORAS"}
          </span>
          <div className="flex items-start gap-3.5">
            <span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--fm-teal-600)", color: "#fff" }}>
              <StepBadge n={1} />
              <Handshake className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-[17px] font-extrabold tracking-tight" style={{ color: "var(--fm-teal-600)" }}>Subasta para automotoras</span>
              <p className="mt-1 text-sm leading-snug text-slate-500">Pujas ascendentes hasta el cierre. La adjudicación reserva la unidad al ganador.</p>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Precio base</p>
              <p className="whitespace-nowrap text-[22px] font-extrabold leading-none tracking-tight" style={{ color: "var(--fm-teal-600)" }}>
                {formatCLP(listing.askingPrice)}
              </p>
            </div>
            {deal?.pendingAmount != null && deal.status === "negotiating" && (
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Oferta vigente</p>
                <p className="whitespace-nowrap text-base font-extrabold" style={{ color: "var(--fm-green-700)" }}>{formatCLP(deal.pendingAmount)}</p>
              </div>
            )}
          </div>
          {open === "negociar" ? (
            <div className="-mx-5 mt-4 border-t border-slate-100">
              <MarketOfferPanel listing={listing} deal={deal} canBuy={canBuy} />
            </div>
          ) : (
            <button type="button" onClick={() => setOpen("negociar")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[13px] px-4 py-3.5 text-[15px] font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--fm-green-600)", color: "#fff" }}>
              {deal ? "Ver compra" : "Ver subasta"} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 2-3 · Filas en acordeón */}
        {rows.map((row, idx) => {
          const isOpen = open === row.key;
          return (
            <div key={row.key} className="overflow-hidden rounded-[14px] transition-colors"
              style={{ border: `1px solid ${isOpen ? "var(--fm-teal-600)" : "var(--fm-border)"}`, background: "#fff" }}>
              <button type="button" onClick={() => setOpen(isOpen ? null : row.key)} aria-expanded={isOpen}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left hover:bg-[var(--fm-bg)]">
                <span className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--fm-teal-50)", color: "var(--fm-teal-600)" }}>
                  <StepBadge n={idx + 2} />
                  <row.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold" style={{ color: "var(--fm-teal-600)" }}>{row.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{row.blurb}</span>
                </span>
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3.5">
                  {row.key === "informe" ? (
                    <ReportButton listingId={listing.id} report={listing.report} />
                  ) : (
                    <NegotiationSteps deal={deal} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer de confianza */}
      <div className="flex items-center gap-2.5 border-t px-6 py-4 text-[13px] font-medium"
        style={{ background: "var(--fm-bg)", borderColor: "var(--fm-border)", color: "var(--fm-ink-500)" }}>
        <Lock className="h-4 w-4 shrink-0" style={{ color: "var(--fm-teal-600)" }} />
        Pago y transferencia fuera de Finmotor · La unidad entra a tu stock
      </div>
    </div>
  );
}
