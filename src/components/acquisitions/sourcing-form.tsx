"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { crmFetch, crmErrorMessage } from "@/lib/api/crm-fetch";
import { SOURCING_CHANNELS, SOURCING_KINDS, SOURCING_STAGES, type SourcingDetails, type SourcingOpportunity } from "@/lib/sourcing";

const buttonClass = "rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50";
export function SourcingForm({ opportunity, initialDetails, relatedLeadId, writable = true }: {
  opportunity?: SourcingOpportunity; initialDetails?: SourcingDetails; relatedLeadId?: string; writable?: boolean;
}) {
  const router = useRouter();
  const [details, setDetails] = useState<SourcingDetails>(opportunity?.details ?? initialDetails ?? {});
  const [kind, setKind] = useState(opportunity?.kind ?? (relatedLeadId ? "trade_in" : "purchase"));
  const [channel, setChannel] = useState(opportunity?.channel ?? "whatsapp");
  const [stage, setStage] = useState(opportunity?.stage ?? "contact");
  const [leadId, setLeadId] = useState(opportunity?.relatedLeadId ?? relatedLeadId ?? "");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const closed = !writable || opportunity?.stage === "received" || opportunity?.stage === "cancelled";
  const stages = Object.keys(SOURCING_STAGES) as (keyof typeof SOURCING_STAGES)[];
  const currentIndex = stages.indexOf(opportunity?.stage ?? "contact");
  const availableStages = opportunity
    ? stages.filter((s, i) => s === opportunity.stage || (!closed && s !== "received" && (s === "cancelled" || Math.abs(i - currentIndex) <= 1)))
    : ["contact"] as const;
  const change = (key: keyof SourcingDetails, value: string | number | null) => setDetails(d => ({ ...d, [key]: value }));
  const field = (key: keyof SourcingDetails, label: string, type = "text", required = false) => (
    <FormField label={label} required={required}>
      <input className={fieldInputClass} type={type} required={required} value={details[key] ?? ""}
        min={type === "number" ? (key === "year" ? 1900 : 0) : undefined}
        max={key === "commissionPct" ? 100 : key === "year" ? 2100 : undefined}
        step={key === "commissionPct" ? "0.1" : undefined}
        onChange={e => change(key, e.target.value === "" ? null : type === "number" ? Number(e.target.value) : e.target.value)} />
    </FormField>
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || closed) return;
    busy.current = true; setSaving(true);
    try {
      const response = await crmFetch(`/api/crm/sourcing${opportunity ? `/${opportunity.id}` : ""}`, {
        method: opportunity ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, kind, stage, details, relatedLeadId: kind === "trade_in" ? leadId || null : null, version: opportunity?.version }),
      });
      const data = await response.json();
      if (!response.ok) { toast.error(data.error); return; }
      toast.success("Captación guardada");
      router.push(`/captacion/${data.opportunity.id}`);
      router.refresh();
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos guardar la captación. Conservamos los datos del formulario.");
      if (message) toast.error(message);
    } finally { busy.current = false; setSaving(false); }
  }
  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <p className="text-sm text-[var(--muted-foreground)]">Registra el contacto y completa la tasación durante la negociación. El vehículo entra al stock al confirmar su recepción.</p>
      <fieldset disabled={closed || saving} className="space-y-5 disabled:opacity-75">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Canal de captación"><select className={fieldInputClass} value={channel} onChange={e => setChannel(e.target.value as typeof channel)}>{Object.entries(SOURCING_CHANNELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FormField>
          <FormField label="Modalidad de ingreso"><select className={fieldInputClass} value={kind} onChange={e => setKind(e.target.value as typeof kind)}>{Object.entries(SOURCING_KINDS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FormField>
          <FormField label="Etapa de gestión"><select className={fieldInputClass} value={stage} onChange={e => setStage(e.target.value as typeof stage)}>{availableStages.map(v => <option key={v} value={v}>{SOURCING_STAGES[v]}</option>)}</select></FormField>
        </div>
        <h2 className="font-semibold">Contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("ownerName", "Nombre de quien ofrece el vehículo", "text", true)}
          {field("ownerRut", "RUT")}{field("ownerPhone", "Teléfono", "tel")}{field("ownerEmail", "Correo", "email")}
        </div>
        {field("ownerAddress", "Domicilio")}
        <h2 className="font-semibold">Vehículo ofrecido</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("plate", "Patente")}{field("brand", "Marca")}{field("model", "Modelo")}
          {field("year", "Año", "number")}{field("mileage", "Kilometraje", "number")}
        </div>
        <h2 className="font-semibold">Tasación y acuerdo</h2>
        {kind === "purchase" && field("purchasePrice", "Precio de compra (CLP)", "number")}
        {kind === "consignment" && <div className="grid gap-4 sm:grid-cols-2">
          {field("minPrice", "Mínimo de venta autorizado (CLP)", "number")}{field("commissionPct", "Comisión (%)", "number")}
          {field("startsAt", "Vigencia desde", "date")}{field("endsAt", "Vigencia hasta", "date")}
        </div>}
        {kind === "trade_in" && <div className="space-y-4">
          {field("tradeInValue", "Valor de recepción (CLP)", "number")}
          <FormField label="Solicitud de venta vinculada" hint="Abre Captación desde la cotización para vincularla automáticamente, o pega aquí su identificador o enlace.">
            <input className={fieldInputClass} value={leadId} onChange={e => setLeadId(e.target.value.trim().split("/solicitudes/").pop()?.split(/[?#]/)[0] ?? "")} />
          </FormField>
          <p className="text-xs text-[var(--muted-foreground)]">El valor de recepción debe coincidir con la parte de pago guardada en la cotización antes de aceptar el acuerdo.</p>
        </div>}
        <FormField label="Evaluación, tasación y observaciones"><textarea className={fieldInputClass} rows={4} value={details.notes ?? ""} onChange={e => change("notes", e.target.value)} /></FormField>
        {!closed && <button className={buttonClass} disabled={saving}>{saving ? "Guardando…" : "Guardar captación"}</button>}
      </fieldset>
      <div className="flex flex-wrap items-center gap-4 border-t border-[var(--border)] pt-4 text-sm">
        <Link href="/captacion" className="underline">Volver a captaciones</Link>
        {opportunity?.relatedLeadId && <Link href={`/solicitudes/${opportunity.relatedLeadId}`} className="underline">Ver venta y cotización vinculada</Link>}
        {opportunity?.stage === "accepted" && writable && <Link className={buttonClass} href={`/vehiculos/create?sourcing=${opportunity.id}`}>Preparar recepción en ERP</Link>}
        {opportunity?.vehicleId && <Link className={buttonClass} href={`/vehiculos/editar/${opportunity.vehicleId}`}>Ver vehículo recibido en stock</Link>}
      </div>
    </form>
  );
}
