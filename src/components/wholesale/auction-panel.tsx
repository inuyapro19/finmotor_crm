"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/ui/currency-input";
import { DealThread } from "@/components/wholesale/deal-thread";
import { QuickBid } from "@/components/wholesale/quick-bid";
import { fmtCLP, fmtDateTime } from "@/lib/format";
import { wholesaleRequest } from "@/lib/wholesale-upload";
import type { WholesaleDeal, WholesaleListing } from "@/lib/wholesale";

export function AuctionSummary({ listing }: { listing: WholesaleListing }) {
  const router = useRouter();
  const auction = listing.auction;
  const auctionStatus = auction?.status;
  useEffect(() => {
    if (!auctionStatus || !["open", "awarded"].includes(auctionStatus)) return;
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [auctionStatus, router]);
  if (!auction) return <p className="text-sm">Esta unidad todavía no tiene una subasta configurada.</p>;
  const expired = new Date(auction.serverTime) >= new Date(auction.endsAt);
  const labels = { open: expired ? "Cerrada · procesando adjudicación" : "Subasta abierta", awarded: "Subasta adjudicada", completed: "Compra completada", no_bids: "Finalizada sin pujas", cancelled: "Subasta cancelada" };
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      <p className="font-semibold">{labels[auction.status]}</p>
      <p>Precio base: {fmtCLP(auction.startingPrice)}</p>
      <p>Mayor puja: {auction.highestAmount == null ? "Sin pujas" : fmtCLP(auction.highestAmount)} · {auction.bidCount} pujas</p>
      <p>Incremento mínimo: {fmtCLP(auction.minIncrement)}</p>
      <p>Cierre: <time dateTime={auction.endsAt}>{fmtDateTime(auction.endsAt)}</time></p>
      {auction.status === "open" && !expired && <p>Próxima puja desde {fmtCLP(auction.nextMinimum)}</p>}
      {auction.isLeading && <p className="font-semibold text-emerald-700">Tu automotora tiene la mayor puja.</p>}
      {listing.myParticipation && !auction.isLeading && <p>Tu mayor puja: {fmtCLP(listing.myParticipation.highestAmount)}. Otra automotora tiene la mayor puja.</p>}
    </div>
  );
}

export function AuctionPanel({ listing, deal, canBuy }: {
  listing: WholesaleListing; deal: WholesaleDeal | null; canBuy: boolean;
}) {
  const router = useRouter();
  const auction = listing.auction;
  const [amount, setAmount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const request = useRef<{ amount: number; id: string } | null>(null);
  const canBid = canBuy && listing.status === "published" && auction?.status === "open"
    && new Date(auction.serverTime) < new Date(auction.endsAt);
  const value = amount ?? auction?.nextMinimum ?? 0;
  const bid = async () => {
    if (!canBid || !value || saving) return;
    if (!request.current || request.current.amount !== value) request.current = { amount: value, id: crypto.randomUUID() };
    setSaving(true);
    try {
      await wholesaleRequest(`/api/crm/wholesale/listings/${listing.id}/bids`, "POST", {
        amount: value, requestId: request.current.id,
      });
      request.current = null;
      setAmount(null);
      toast.success("Puja registrada. La adjudicación se realiza al cierre.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos registrar la puja.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-4 p-4">
      <AuctionSummary listing={listing} />
      {/* Puja en un clic (monto ya calculado + atajos) con unos segundos para cancelar. */}
      <QuickBid listing={listing} canBuy={canBuy} />
      {canBid && (
        <details className="rounded-xl border p-3" style={{ borderColor: "var(--fm-border)" }}>
          <summary className="cursor-pointer text-sm font-semibold">Pujar otro monto</summary>
          <div className="mt-3 space-y-3">
            <CurrencyInput value={value} onChange={setAmount} placeholder="Monto de tu puja" />
            <button type="button" onClick={bid} disabled={saving || value < (auction?.nextMinimum ?? 0)}
              className="w-full rounded-xl bg-[var(--primary)] px-4 py-3 font-semibold text-white disabled:opacity-50">
              {saving ? "Registrando…" : `Pujar ${fmtCLP(value)}`}
            </button>
          </div>
        </details>
      )}
      <p className="text-xs text-[var(--muted-foreground)]">Pago y transferencia fuera de Finmotor. Con ambas confirmaciones, la unidad ingresa al stock pendiente de publicación.</p>
      {deal && <DealThread deal={deal} side="dealership" apiBase="/api/crm/wholesale" canAct={canBuy} />}
    </div>
  );
}
