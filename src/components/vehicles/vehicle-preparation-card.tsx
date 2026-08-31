"use client";

import { useState } from "react";
import { Camera, Check, Loader2, Sparkles, SquareParking } from "lucide-react";
import { toast } from "sonner";

import { Panel, Pill } from "@/components/ui/primitives";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { VehiclePreparation } from "@/lib/data/crm";


const parkingMessage: Record<VehiclePreparation["parkingStatus"], string> = {
  assigned: "Puesto asignado",
  waiting_preparation: "Completa detailing y fotos",
  not_configured: "La sucursal no tiene puestos configurados",
  full: "No hay puestos disponibles",
  pending: "Asignación pendiente",
};

export function VehiclePreparationCard({
  vehicleId,
  initial,
}: {
  vehicleId: string;
  initial: VehiclePreparation;
}) {
  const [preparation, setPreparation] = useState(initial);
  const [saving, setSaving] = useState<"detailing" | "photos" | null>(null);

  const complete = async (step: "detailing" | "photos") => {
    setSaving(step);
    try {
      const response = await crmFetch(`/api/crm/vehicles/${vehicleId}/preparation/${step}`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.preparation) {
        toast.error(data?.error || "No pudimos actualizar la preparación");
        return;
      }
      setPreparation(data.preparation);
      toast.success(step === "detailing" ? "Detailing marcado como terminado" : "Fotos marcadas como listas");
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para actualizar la preparación");
      if (message) toast.error(message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Panel title="Preparación y estacionamiento">
      <div className="space-y-3 p-4 text-xs">
        <PreparationStep
          icon={<Sparkles className="h-4 w-4" />}
          label="Detailing"
          completed={preparation.detailingStatus === "completed"}
          loading={saving === "detailing"}
          disabled={saving !== null}
          onComplete={() => void complete("detailing")}
        />
        <PreparationStep
          icon={<Camera className="h-4 w-4" />}
          label={`Fotos (${preparation.photoCount})`}
          completed={preparation.photosStatus === "completed"}
          loading={saving === "photos"}
          disabled={saving !== null || preparation.photoCount === 0}
          onComplete={() => void complete("photos")}
        />
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium"><SquareParking className="h-4 w-4" />Estacionamiento</span>
            {preparation.parkingNumber == null ? (
              <Pill variant={preparation.parkingStatus === "full" || preparation.parkingStatus === "not_configured" ? "warn" : "neutral"}>Sin asignar</Pill>
            ) : (
              <span className="font-mono text-base font-bold text-[var(--fm-navy)]">E-{String(preparation.parkingNumber).padStart(3, "0")}</span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">{parkingMessage[preparation.parkingStatus]}</p>
        </div>
      </div>
    </Panel>
  );
}

function PreparationStep({
  icon,
  label,
  completed,
  loading,
  disabled,
  onComplete,
}: {
  icon: React.ReactNode;
  label: string;
  completed: boolean;
  loading: boolean;
  disabled: boolean;
  onComplete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
      <span className="flex items-center gap-2 font-medium">{icon}{label}</span>
      {completed ? (
        <Pill variant="success"><Check className="h-3 w-3" />Completado</Pill>
      ) : (
        <button type="button" onClick={onComplete} disabled={disabled} className="rounded-md bg-[var(--primary)] px-2.5 py-1.5 text-[11px] font-medium text-white disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Marcar listo"}
        </button>
      )}
    </div>
  );
}
