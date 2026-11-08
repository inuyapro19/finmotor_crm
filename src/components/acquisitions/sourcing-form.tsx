"use client";

import { CommissionInput } from "@/components/acquisitions/commission-input";
import type { CommissionType } from "@/lib/commission";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { crmFetch, crmErrorMessage } from "@/lib/api/crm-fetch";
import { fmtCLP, fmtDateTime } from "@/lib/format";
import {
  SALE_URGENCY, SOURCING_CHANNELS, SOURCING_KIND_FLOW, SOURCING_KINDS, SOURCING_STAGES, VEHICLE_CONDITIONS,
  stageLabel, type SourcingDetails, type SourcingOpportunity, type SourcingSale,
} from "@/lib/sourcing";

const buttonClass = "rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50";
type SourcingEditableKey = Exclude<keyof SourcingDetails, "consent" | "saleUrgency" | "reports" | "targetVehicle" | "testDriveDone" | "vehicleCondition">;

/** ISO del backend <-> valor de un input datetime-local (hora local del navegador). */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function SourcingForm({ opportunity, initialDetails, relatedLeadId, sale, writable = true }: {
  opportunity?: SourcingOpportunity; initialDetails?: SourcingDetails; relatedLeadId?: string;
  sale?: SourcingSale | null; writable?: boolean;
}) {
  const router = useRouter();
  const [details, setDetails] = useState<SourcingDetails>(opportunity?.details ?? initialDetails ?? {});
  const [commissionType, setCommissionType] = useState<CommissionType>(details.commissionAmount != null ? "fixed" : "percentage");
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
  const change = (key: keyof SourcingDetails, value: string | number | boolean | null) => setDetails(d => ({ ...d, [key]: value }));
  const field = (key: SourcingEditableKey, label: string, type = "text", required = false) => (
    <FormField label={label} required={required}>
      <input className={fieldInputClass} type={type} required={required} value={(details[key] as string | number | null | undefined) ?? ""}
        min={type === "number" ? (key === "year" ? 1900 : 0) : undefined}
        max={key === "commissionPct" ? 100 : key === "year" ? 2100 : undefined}
        step={key === "commissionPct" ? "0.1" : undefined}
        onChange={e => change(key, e.target.value === "" ? null : type === "number" ? Number(e.target.value) : e.target.value)} />
    </FormField>
  );
  const target = details.targetVehicle;
  const hasPublicData = Boolean(details.saleUrgency || target || details.consent);

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
      toast.success(kind === "trade_in" && !opportunity?.relatedLeadId && data.opportunity.relatedLeadId
        ? "Captación guardada. Se abrió la venta del cliente."
        : "Captación guardada");
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
          <FormField label="Etapa de gestión"><select className={fieldInputClass} value={stage} onChange={e => setStage(e.target.value as typeof stage)}>{availableStages.map(v => <option key={v} value={v}>{stageLabel(v, kind)}</option>)}</select></FormField>
        </div>
        <p className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm">{SOURCING_KIND_FLOW[kind]}</p>

        {hasPublicData && <div className="space-y-2 rounded-lg border border-[var(--border)] p-4 text-sm">
          <h2 className="font-semibold">Solicitud del propietario</h2>
          {details.saleUrgency && <p>{SALE_URGENCY[details.saleUrgency]}</p>}
          {target && <p>Auto que quiere comprar: <span className="font-medium">{[target.brand, target.model, target.year].filter(Boolean).join(" ")}{target.plate ? ` (${target.plate})` : ""}</span>{target.price ? ` · ${fmtCLP(target.price)}` : ""}</p>}
          {details.consent && <p className="text-[var(--muted-foreground)]">{details.consent.accepted ? "Aceptó" : "No aceptó"} términos y política de privacidad · {fmtDateTime(details.consent.acceptedAt)}</p>}
        </div>}

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
          {field("requestedPrice", "Precio esperado por el propietario (CLP)", "number")}
        </div>

        <h2 className="font-semibold">Evaluación del vehículo{kind === "purchase" && <span className="ml-2 text-xs font-normal text-[var(--muted-foreground)]">Obligatoria antes de tasar</span>}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Test drive agendado">
            <input className={fieldInputClass} type="datetime-local" value={toLocalInput(details.testDriveAt)}
              onChange={e => change("testDriveAt", e.target.value ? new Date(e.target.value).toISOString() : null)} />
          </FormField>
          <FormField label="Test drive realizado">
            <select className={fieldInputClass} value={details.testDriveDone ? "yes" : "no"} onChange={e => change("testDriveDone", e.target.value === "yes")}>
              <option value="no">Pendiente</option><option value="yes">Realizado</option>
            </select>
          </FormField>
          <FormField label="Condición del vehículo" required={kind === "purchase"}>
            <select className={fieldInputClass} value={details.vehicleCondition ?? ""} onChange={e => change("vehicleCondition", e.target.value || null)}>
              <option value="">Sin evaluar</option>
              {Object.entries(VEHICLE_CONDITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Resultado de la inspección"><textarea className={fieldInputClass} rows={3} value={details.inspectionNotes ?? ""} onChange={e => change("inspectionNotes", e.target.value || null)} /></FormField>

        <h2 className="font-semibold">Tasación y acuerdo</h2>
        {kind === "purchase" && field("purchasePrice", "Precio de compra (CLP)", "number")}
        {kind === "consignment" && <div className="grid gap-4 sm:grid-cols-2">
          {field("minPrice", "Mínimo de venta autorizado (CLP)", "number")}<CommissionInput type={commissionType} value={String((commissionType === "fixed" ? details.commissionAmount : details.commissionPct) ?? "")}
            onTypeChange={(type) => { setCommissionType(type); setDetails((current) => ({ ...current, commissionPct: null, commissionAmount: null })); }}
            onChange={(value) => setDetails((current) => ({ ...current, commissionPct: commissionType === "percentage" && value !== "" ? Number(value) : null, commissionAmount: commissionType === "fixed" && value !== "" ? Number(value) : null }))} />
          {field("startsAt", "Vigencia desde", "date")}{field("endsAt", "Vigencia hasta", "date")}
        </div>}
        {kind === "trade_in" && <div className="space-y-4">
          {field("tradeInValue", "Valor de recepción (CLP)", "number")}
          {sale ? <div className="rounded-lg border border-[var(--border)] p-4 text-sm">
            <p className="font-medium">Venta vinculada: {sale.contactName ?? "Cliente"}</p>
            <p className="text-[var(--muted-foreground)]">
              {sale.tradeInAmount != null
                ? `Parte de pago tasada en la venta: ${fmtCLP(sale.tradeInAmount)}${sale.abonoApplied ? " · abonada a la compra" : " · se abona al aceptar este acuerdo"}`
                : "La venta aún no tiene la parte de pago tasada: al aceptar este acuerdo, el valor de recepción se abona a la compra."}
            </p>
          </div> : !leadId && <p className="text-sm text-[var(--muted-foreground)]">Al guardar se abre una venta (lead) para este cliente, con su auto como parte de pago.</p>}
          <FormField label="Solicitud de venta vinculada" hint="Se completa sola al guardar. Si el cliente ya tiene una venta abierta, pega aquí su identificador o enlace antes de guardar.">
            <input className={fieldInputClass} value={leadId} disabled={Boolean(opportunity?.relatedLeadId)} onChange={e => setLeadId(e.target.value.trim().split("/solicitudes/").pop()?.split(/[?#]/)[0] ?? "")} />
          </FormField>
        </div>}
        <FormField label="Observaciones"><textarea className={fieldInputClass} rows={4} value={details.notes ?? ""} onChange={e => change("notes", e.target.value)} /></FormField>
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
