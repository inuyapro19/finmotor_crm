"use client";

/**
 * Ficha de la unidad del proveedor (alta y edición). Es un formulario corto a propósito: el
 * comprador es una automotora que va a revisar el auto y el informe, no un particular al que
 * haya que convencer. Lo imprescindible es patente, marca/modelo/año y precio.
 *
 * Con la patente se completan solos los datos técnicos (misma consulta registral que el stock
 * de la automotora): el proveedor sólo revisa, pone precio y kilometraje.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Search } from "lucide-react";

import { CurrencyInput } from "@/components/ui/currency-input";
import { FormField, fieldInputClass } from "@/components/ui/form-dialog";
import {
  FUELS, TRANSMISSIONS, VEHICLE_TYPES, normalizeFuel, normalizeTransmission, wholesaleError, type SupplierLocation, type WholesaleListing,
} from "@/lib/wholesale";
import { wholesaleRequest } from "@/lib/wholesale-upload";

type Form = {
  plate: string;
  brand: string;
  model: string;
  versionName: string;
  year: string;
  mileage: string;
  fuelType: string;
  transmission: string;
  vehicleType: string;
  color: string;
  vin: string;
  engineNumber: string;
  doors: string;
  askingPrice: number | null;
  description: string;
  locationCommune: string;
  locationRegion: string;
  locationId: string;
};

function initial(listing?: WholesaleListing, defaultLocationId?: string | null): Form {
  return {
    plate: listing?.plate ?? "",
    brand: listing?.brand ?? "",
    model: listing?.model ?? "",
    versionName: listing?.versionName ?? "",
    year: listing?.year ? String(listing.year) : "",
    mileage: listing?.mileage != null ? String(listing.mileage) : "",
    fuelType: listing?.fuelType ?? "",
    transmission: listing?.transmission ?? "",
    vehicleType: listing?.vehicleType ?? "",
    color: listing?.color ?? "",
    vin: listing?.vin ?? "",
    engineNumber: listing?.engineNumber ?? "",
    doors: listing?.doors != null ? String(listing.doors) : "",
    askingPrice: listing?.askingPrice ?? null,
    description: listing?.description ?? "",
    locationCommune: listing?.locationCommune ?? "",
    locationRegion: listing?.locationRegion ?? "",
    locationId: listing ? listing.locationId ?? "" : defaultLocationId ?? "",
  };
}

const text = (value: string) => value.trim() || null;
const int = (value: string) => (value.trim() ? Number(value.replace(/\D/g, "")) : null);

export function ListingForm({
  listing,
  disabled,
  locations = [],
  defaultLocationId,
}: {
  listing?: WholesaleListing;
  disabled?: boolean;
  locations?: SupplierLocation[];
  defaultLocationId?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => initial(listing, defaultLocationId));
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookedUpPlate, setLookedUpPlate] = useState<string | null>(null);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const lookupPlate = async () => {
    const plate = form.plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (plate.length < 5 || plate.length > 8) {
      toast.error("Ingresa una patente chilena válida (ej. ABCD12).");
      return;
    }
    setLookingUp(true);
    try {
      const response = await fetch(`/api/proveedor/plate/${encodeURIComponent(plate)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(wholesaleError(data?.detail ?? data?.error, "No pudimos consultar la patente. Completa los datos a mano."));
        return;
      }
      const v = data?.status === "success" ? (data.vehicle as Record<string, string | number | null> | undefined) : undefined;
      if (!v || !v.brand) {
        toast.info("No encontramos datos registrales para esta patente. Completa la ficha a mano.");
        return;
      }
      const str = (value: unknown, fallback: string) => (value != null && String(value).trim() ? String(value).trim() : fallback);
      setForm((f) => ({
        ...f,
        plate,
        brand: str(v.brand, f.brand),
        model: str(v.model, f.model),
        year: str(v.year, f.year),
        vehicleType: VEHICLE_TYPES.some(([t]) => t === v.vehicle_type) ? String(v.vehicle_type) : f.vehicleType,
        fuelType: normalizeFuel(v.fuel_type as string | null) || f.fuelType,
        transmission: normalizeTransmission(v.transmission as string | null) || f.transmission,
        color: str(v.color, f.color),
        doors: str(v.doors, f.doors),
        vin: str(v.vin, f.vin).toUpperCase(),
        engineNumber: str(v.engine, f.engineNumber).toUpperCase(),
        mileage: str(v.mileage, f.mileage),
      }));
      setLookedUpPlate(plate);
      toast.success("Datos del vehículo cargados desde la patente. Revisa y completa el precio.");
    } catch {
      toast.error("No pudimos consultar la patente. Completa los datos a mano.");
    } finally {
      setLookingUp(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const year = int(form.year);
    if (!form.plate.trim() || !form.brand.trim() || !form.model.trim() || !year || !form.askingPrice) {
      toast.error("Completa patente, marca, modelo, año y precio.");
      return;
    }
    const payload = {
      plate: form.plate.trim(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      versionName: text(form.versionName),
      year,
      mileage: int(form.mileage),
      fuelType: form.fuelType || null,
      transmission: form.transmission || null,
      vehicleType: form.vehicleType || null,
      color: text(form.color),
      vin: text(form.vin),
      engineNumber: text(form.engineNumber),
      doors: int(form.doors),
      askingPrice: form.askingPrice,
      description: text(form.description),
      locationCommune: text(form.locationCommune),
      locationRegion: text(form.locationRegion),
      locationId: form.locationId || null,
    };
    setSaving(true);
    try {
      if (listing) {
        await wholesaleRequest(`/api/proveedor/listings/${listing.id}`, "PATCH", { ...payload, version: listing.version });
        toast.success("Cambios guardados.");
        router.refresh();
      } else {
        const data = await wholesaleRequest<{ listing: WholesaleListing }>("/api/proveedor/listings", "POST", payload);
        toast.success("Unidad creada. Ahora agrega fotos y el informe histórico.");
        router.push(`/proveedor/vehiculos/${data.listing.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar la unidad.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={disabled || saving} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Patente" required
            hint={listing?.report.kind === "purchased" ? "El informe comprado es de esta patente: no se puede cambiar."
              : "Con la patente completamos marca, modelo, año y los datos técnicos por ti."}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={form.plate} onChange={(e) => { set("plate", e.target.value.toUpperCase()); setLookedUpPlate(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void lookupPlate(); } }}
                maxLength={10} className={`${fieldInputClass} font-mono tracking-widest sm:max-w-[220px]`} placeholder="ABCD12" />
              <button type="button" onClick={lookupPlate} disabled={lookingUp || disabled || saving}
                className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Completar datos con la patente
              </button>
              {lookedUpPlate && lookedUpPlate === form.plate.replace(/[^A-Za-z0-9]/g, "") && (
                <span className="flex items-center gap-1 text-xs font-medium text-[var(--fm-green)]">
                  <CheckCircle2 className="h-4 w-4" /> Datos cargados
                </span>
              )}
            </div>
          </FormField>
        </div>
        <FormField label="Marca" required>
          <input value={form.brand} onChange={(e) => set("brand", e.target.value)} className={fieldInputClass} />
        </FormField>
        <FormField label="Modelo" required>
          <input value={form.model} onChange={(e) => set("model", e.target.value)} className={fieldInputClass} />
        </FormField>
        <FormField label="Versión">
          <input value={form.versionName} onChange={(e) => set("versionName", e.target.value)} className={fieldInputClass}
            placeholder="2.0 LE 4x2" />
        </FormField>
        <FormField label="Año" required>
          <input value={form.year} onChange={(e) => set("year", e.target.value)} inputMode="numeric" maxLength={4}
            className={fieldInputClass} />
        </FormField>
        <FormField label="Kilometraje">
          <input value={form.mileage} onChange={(e) => set("mileage", e.target.value)} inputMode="numeric"
            className={fieldInputClass} />
        </FormField>
        <FormField label="Precio para automotoras" required hint="Las automotoras pueden ofertar por debajo; tú decides.">
          <CurrencyInput value={form.askingPrice} onChange={(v) => set("askingPrice", v)} />
        </FormField>
        <FormField label="Combustible">
          <select value={form.fuelType} onChange={(e) => set("fuelType", e.target.value)} className={fieldInputClass}>
            <option value="">Sin especificar</option>
            {FUELS.map((v) => <option key={v}>{v}</option>)}
          </select>
        </FormField>
        <FormField label="Transmisión">
          <select value={form.transmission} onChange={(e) => set("transmission", e.target.value)} className={fieldInputClass}>
            <option value="">Sin especificar</option>
            {TRANSMISSIONS.map((v) => <option key={v} value={v}>{v === "Automatico" ? "Automática" : v}</option>)}
          </select>
        </FormField>
        <FormField label="Carrocería">
          <select value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)} className={fieldInputClass}>
            <option value="">Sin especificar</option>
            {VEHICLE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </FormField>
        <FormField label="Color">
          <input value={form.color} onChange={(e) => set("color", e.target.value)} className={fieldInputClass} />
        </FormField>
        <FormField label="Puertas">
          <input value={form.doors} onChange={(e) => set("doors", e.target.value)} inputMode="numeric" maxLength={1}
            className={fieldInputClass} />
        </FormField>
        <FormField label="VIN">
          <input value={form.vin} onChange={(e) => set("vin", e.target.value.toUpperCase())} className={fieldInputClass} />
        </FormField>
        <FormField label="N° de motor">
          <input value={form.engineNumber} onChange={(e) => set("engineNumber", e.target.value.toUpperCase())}
            className={fieldInputClass} />
        </FormField>
        <FormField label="Sucursal" hint={locations.length ? "Desde dónde se vende. Si no pones comuna, usamos la de la sucursal." : "Crea sucursales en el menú Sucursales."}>
          <select value={form.locationId} onChange={(e) => {
              const loc = locations.find((l) => l.id === e.target.value);
              setForm((f) => ({ ...f, locationId: e.target.value, locationCommune: f.locationCommune || loc?.commune || "" }));
            }} className={fieldInputClass}>
            <option value="">Sin sucursal</option>
            {locations.filter((l) => l.isActive || l.id === form.locationId).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </FormField>
        <FormField label="Comuna donde está el auto">
          <input value={form.locationCommune} onChange={(e) => set("locationCommune", e.target.value)} className={fieldInputClass} />
        </FormField>
        <FormField label="Región">
          <input value={form.locationRegion} onChange={(e) => set("locationRegion", e.target.value)} className={fieldInputClass} />
        </FormField>
        <div className="sm:col-span-2 lg:col-span-3">
          <FormField label="Descripción" hint="Estado, mantenciones, detalles que la automotora debe saber antes de ofertar.">
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4}
              maxLength={5000} className={fieldInputClass} />
          </FormField>
        </div>
      </fieldset>
      {!disabled && (
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {listing ? "Guardar cambios" : "Crear unidad"}
        </button>
      )}
    </form>
  );
}
