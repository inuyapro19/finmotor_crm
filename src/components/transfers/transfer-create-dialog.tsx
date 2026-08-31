"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Plus } from "lucide-react";
import { toast } from "sonner";

import { CurrencyInput } from "@/components/ui/currency-input";
import { FormDialog, FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { Acquisition } from "@/lib/data/crm";
import type { Lead } from "@/lib/leads";
import { fmtCLP } from "@/lib/format";


export function TransferCreateDialog({ acquisitions, leads }: { acquisitions: Acquisition[]; leads: Lead[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acquisitionId, setAcquisitionId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [vehicleValue, setVehicleValue] = useState<number | null>(null);
  const [fiscalAppraisal, setFiscalAppraisal] = useState<number | null>(null);

  const show = () => {
    if (acquisitions.length === 0) {
      toast.info("No hay ingresos elegibles. Registra primero una compra directa o permuta con sucursal asignada.");
      return;
    }
    setOpen(true);
  };

  const selectAcquisition = (id: string) => {
    setAcquisitionId(id);
    const acquisition = acquisitions.find((item) => item.id === id);
    setVehicleValue(acquisition?.purchasePrice ?? acquisition?.minPrice ?? null);
  };

  const submit = async () => {
    if (!acquisitionId || !vehicleValue) {
      toast.error("Selecciona un ingreso e indica el valor del vehículo");
      return;
    }
    setSaving(true);
    try {
      const response = await crmFetch("/api/crm/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acquisitionId,
          leadId: leadId || null,
          vehicleValueClp: vehicleValue,
          fiscalAppraisalClp: fiscalAppraisal,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos iniciar la transferencia");
        return;
      }
      toast.success("Transferencia registrada");
      setOpen(false);
      setAcquisitionId("");
      setLeadId("");
      setVehicleValue(null);
      setFiscalAppraisal(null);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para iniciar la transferencia");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-sm font-medium text-white"
      >
        <Plus className="h-4 w-4" />
        Nueva transferencia
      </button>
      <FormDialog
        open={open}
        title="Transferir a la automotora"
        description="Vendedor particular a comprador legal. No incluye impuesto ni pago online."
        submitLabel="Registrar transferencia"
        saving={saving}
        onClose={() => setOpen(false)}
        onSubmit={() => void submit()}
      >
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--muted)] p-3">
          <ArrowRightLeft className="h-5 w-5 text-[var(--primary)]" />
          <div><p className="text-xs font-medium">Servicio postpago</p><p className="text-sm font-semibold">{fmtCLP(49_990)} por transferencia</p></div>
        </div>
        <FormField label="Ingreso del vehículo" required>
          <select value={acquisitionId} onChange={(event) => selectAcquisition(event.target.value)} className={fieldInputClass}>
            <option value="">Seleccionar compra o permuta</option>
            {acquisitions.map((item) => (
              <option key={item.id} value={item.id}>{item.plate} · {item.ownerName} · {item.kind === "trade_in" ? "Permuta" : "Compra"}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Solicitud relacionada" hint="Opcional: úsala cuando el vehículo entra como parte de pago.">
          <select value={leadId} onChange={(event) => setLeadId(event.target.value)} className={fieldInputClass}>
            <option value="">Sin solicitud</option>
            {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.contactName} · {lead.vehicleLabel}</option>)}
          </select>
        </FormField>
        <FormField label="Valor de compraventa" required>
          <CurrencyInput value={vehicleValue} onChange={setVehicleValue} />
        </FormField>
        <FormField label="Tasación fiscal" hint="Opcional. Se conserva para el documento del proveedor.">
          <CurrencyInput value={fiscalAppraisal} onChange={setFiscalAppraisal} />
        </FormField>
        <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          Los datos del vendedor, la unidad y la sucursal se toman del ingreso. La automotora queda registrada como comprador legal con los datos de Perfil.
        </p>
      </FormDialog>
    </>
  );
}
