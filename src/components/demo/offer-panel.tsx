"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";

export function DemoOfferPanel({ vehicleId, price, disabledReason }: { vehicleId: string; price: number; disabledReason?: string }) {
  const [amount, setAmount] = useState<number | null>(price);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/demo/offers", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, amount, message: "Oferta de prueba en entorno DEMO privado." }) });
      const result = await response.json();
      if (!response.ok) {
        const errors: Record<string, string> = {
          cannot_offer_own_vehicle: "Usa la cuenta compradora para ofertar por este vehículo.",
          vehicle_not_sellable: "Este vehículo ya no está disponible para recibir ofertas.",
          invalid_offer_amounts: "Revisa el monto de la oferta.",
        };
        throw new Error(errors[String(result.detail)] || "No se pudo registrar la oferta.");
      }
      toast.success("Oferta demo registrada. El vendedor puede gestionarla desde su CRM.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la oferta.");
    } finally {
      setBusy(false);
    }
  };
  return <section className="space-y-3 rounded-xl border p-5">
    <h2 className="text-lg font-semibold">Probar una oferta</h2>
    <p className="text-sm">Usa la cuenta compradora para ofertar por el stock de la automotora DEMO. Se aplican las reglas del marketplace, incluyendo la prohibición de ofertar por un vehículo propio.</p>
    {disabledReason && <p className="text-sm font-semibold">{disabledReason}</p>}
    <CurrencyInput value={amount} onChange={setAmount} />
    <button type="button" onClick={submit} disabled={busy || !amount || !!disabledReason} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-white disabled:opacity-50">
      {busy ? "Registrando…" : "Enviar oferta de prueba"}
    </button>
  </section>;
}
