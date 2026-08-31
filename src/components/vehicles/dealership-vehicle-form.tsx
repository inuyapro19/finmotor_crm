"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Building2, Car, ClipboardCheck, FileText, KeyRound, Loader2, MapPin, PackageCheck, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { FormField, fieldInputClass } from "@/components/ui/form-dialog";
import { Notice, Panel } from "@/components/ui/primitives";
import { VehiclePhotoUpload } from "@/components/vehicles/vehicle-photo-upload";
import { VehiclePreparationCard } from "@/components/vehicles/vehicle-preparation-card";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { Acquisition, OrganizationLocation, VehicleDetail, VehiclePreparation } from "@/lib/data/crm";
import { uploadAndRegisterPhotos } from "@/lib/photos/upload";


const KINDS = [
  { value: "purchase", label: "Stock propio", hint: "La automotora compra el vehículo al particular." },
  { value: "consignment", label: "Consignación", hint: "El particular conserva el dominio y la automotora cobra comisión." },
  { value: "trade_in", label: "Parte de pago", hint: "El vehículo se recibe como parte de pago de otra operación." },
];

const STATUSES = [
  { value: "DRAFT", label: "Borrador" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "RESERVED", label: "Reservado" },
  { value: "PAUSED", label: "Pausado" },
  { value: "SOLD", label: "Vendido" },
];

const VEHICLE_TYPES = [
  ["car", "Auto"], ["suv", "SUV"], ["camioneta", "Camioneta"], ["pickup", "Pickup"],
  ["van", "Furgón"], ["moto", "Moto"], ["camion", "Camión"], ["bus", "Bus"], ["otro", "Otro"],
];
const FUELS = ["Bencina", "Diesel", "Electrico", "Hibrido", "GLP"];
const TRANSMISSIONS = ["Manual", "Automatico"];
const LIEN_STATUSES = [
  ["unknown", "Por verificar"],
  ["clear", "Sin prenda ni gravamen"],
  ["present", "Con prenda vigente"],
  ["pending_release", "Alzamiento pendiente"],
];

type FormTab = "vehicle" | "intake" | "reception" | "legal";
const RECEPTION_TAB_VISIBLE: boolean = false;
const ALL_FORM_TABS = [
  { id: "vehicle" as const, label: "Vehículo", shortLabel: "Auto", Icon: Car },
  { id: "intake" as const, label: "Ingreso y venta", shortLabel: "Ingreso", Icon: FileText },
  { id: "reception" as const, label: "Recepción", shortLabel: "Check", Icon: ClipboardCheck },
  { id: "legal" as const, label: "Legal y notas", shortLabel: "Legal", Icon: ShieldCheck },
];
const FORM_TABS = ALL_FORM_TABS.filter((tab) => RECEPTION_TAB_VISIBLE || tab.id !== "reception");

type CheckStatus = "not_checked" | "ok" | "observe";
type IntakeChecklist = {
  checks: Record<string, CheckStatus>;
  items: Record<string, boolean>;
  fuelLevel: string;
  keysCount: string;
  damageNotes: string;
  notes: string;
  completed: boolean;
};

const VEHICLE_CHECKS = [
  ["bodywork", "Carrocería y abolladuras"],
  ["paint", "Pintura y rayas"],
  ["glass", "Vidrios y espejos"],
  ["tires", "Neumáticos y llantas"],
  ["lights", "Luces exteriores"],
  ["interior", "Interior y tapiz"],
  ["dashboard", "Tablero e instrumentos"],
  ["airConditioning", "Aire acondicionado"],
  ["engineStart", "Encendido y motor"],
  ["warningLights", "Testigos de alerta"],
] as const;
const RECEIVED_ITEMS = [
  ["registrationCertificate", "Padrón / certificado de inscripción"],
  ["circulationPermit", "Permiso de circulación"],
  ["technicalReview", "Revisión técnica"],
  ["emissionsCertificate", "Certificado de gases"],
  ["mandatoryInsurance", "SOAP vigente"],
  ["ownerManual", "Manual del vehículo"],
  ["maintenanceBook", "Libro de mantenciones"],
  ["spareWheel", "Rueda de repuesto"],
  ["jack", "Gata"],
  ["wheelWrench", "Llave de rueda"],
  ["safetyKit", "Kit de seguridad"],
  ["radioAccessories", "Accesorios de radio / pantalla"],
] as const;
const CHECK_OPTIONS: { value: CheckStatus; label: string }[] = [
  { value: "not_checked", label: "Pendiente" },
  { value: "ok", label: "Conforme" },
  { value: "observe", label: "Observar" },
];

function emptyChecklist(): IntakeChecklist {
  return {
    checks: Object.fromEntries(VEHICLE_CHECKS.map(([key]) => [key, "not_checked"])) as Record<string, CheckStatus>,
    items: Object.fromEntries(RECEIVED_ITEMS.map(([key]) => [key, false])),
    fuelLevel: "unknown",
    keysCount: "1",
    damageNotes: "",
    notes: "",
    completed: false,
  };
}

function checklistState(value: Record<string, unknown> | undefined): IntakeChecklist {
  const base = emptyChecklist();
  const checks = value?.checks && typeof value.checks === "object" ? value.checks as Record<string, CheckStatus> : {};
  const items = value?.items && typeof value.items === "object" ? value.items as Record<string, boolean> : {};
  return {
    checks: { ...base.checks, ...checks },
    items: { ...base.items, ...items },
    fuelLevel: typeof value?.fuelLevel === "string" ? value.fuelLevel : base.fuelLevel,
    keysCount: value?.keysCount == null ? base.keysCount : String(value.keysCount),
    damageNotes: typeof value?.damageNotes === "string" ? value.damageNotes : "",
    notes: typeof value?.notes === "string" ? value.notes : "",
    completed: value?.completed === true,
  };
}

type FormState = {
  patent: string;
  brand: string;
  model: string;
  year: string;
  vehicleType: string;
  fuelType: string;
  transmission: string;
  vin: string;
  engine: string;
  color: string;
  doors: string;
  mileage: string;
  salePrice: string;
  status: string;
  description: string;
  kind: string;
  ownerName: string;
  ownerRut: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerAddress: string;
  purchasePrice: string;
  minPrice: string;
  commissionPct: string;
  startsAt: string;
  endsAt: string;
  receivedAt: string;
  exitedAt: string;
  locationId: string;
  lienStatus: string;
  lienHolder: string;
  lienNotes: string;
  notes: string;
  intakeChecklist: IntakeChecklist;
};

const dateOnly = (value: string | null | undefined) => value ? String(value).slice(0, 10) : "";
const today = () => new Date().toISOString().slice(0, 10);

function normalizeTransmission(value: string | null | undefined) {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("auto")) return "Automatico";
  if (normalized.includes("manual") || normalized.includes("mecan")) return "Manual";
  return value || "";
}

function normalizeFuel(value: string | null | undefined) {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("gasol") || normalized.includes("benc")) return "Bencina";
  if (normalized.includes("dies") || normalized.includes("diés")) return "Diesel";
  if (normalized.includes("elect")) return "Electrico";
  if (normalized.includes("hibr") || normalized.includes("híbr")) return "Hibrido";
  if (normalized.includes("glp")) return "GLP";
  return value || "";
}

function initialState(
  vehicle?: VehicleDetail,
  acquisition?: Acquisition | null,
  locations: OrganizationLocation[] = [],
): FormState {
  const defaultLocation = locations.find((location) => location.isMain && location.isActive)
    ?? locations.find((location) => location.isActive);
  return {
    patent: vehicle?.patent ?? acquisition?.plate ?? "",
    brand: vehicle?.brand ?? acquisition?.brand ?? "",
    model: vehicle?.model ?? acquisition?.model ?? "",
    year: vehicle?.year ? String(vehicle.year) : acquisition?.year ? String(acquisition.year) : "",
    vehicleType: vehicle?.vehicleType ?? "car",
    fuelType: normalizeFuel(vehicle?.fuelType),
    transmission: normalizeTransmission(vehicle?.transmission),
    vin: vehicle?.vin ?? acquisition?.vin ?? "",
    engine: vehicle?.engine ?? acquisition?.engineNumber ?? "",
    color: vehicle?.color ?? acquisition?.color ?? "",
    doors: vehicle?.doors ? String(vehicle.doors) : "4",
    mileage: vehicle?.mileage != null ? String(vehicle.mileage) : acquisition?.mileage != null ? String(acquisition.mileage) : "",
    salePrice: vehicle?.price != null ? String(vehicle.price) : "",
    status: vehicle?.status ?? "DRAFT",
    description: vehicle?.description ?? "",
    kind: acquisition?.kind ?? "purchase",
    ownerName: acquisition?.ownerName ?? "",
    ownerRut: acquisition?.ownerRut ?? "",
    ownerPhone: acquisition?.ownerPhone ?? "",
    ownerEmail: acquisition?.ownerEmail ?? "",
    ownerAddress: acquisition?.ownerAddress ?? "",
    purchasePrice: acquisition?.purchasePrice != null ? String(acquisition.purchasePrice) : "",
    minPrice: acquisition?.minPrice != null ? String(acquisition.minPrice) : "",
    commissionPct: acquisition?.commissionPct != null ? String(acquisition.commissionPct) : "",
    startsAt: dateOnly(acquisition?.startsAt),
    endsAt: dateOnly(acquisition?.endsAt),
    receivedAt: dateOnly(acquisition?.receivedAt) || today(),
    exitedAt: dateOnly(acquisition?.exitedAt),
    locationId: acquisition?.locationId ?? defaultLocation?.id ?? "",
    lienStatus: acquisition?.lienStatus ?? (acquisition?.freeOfEncumbrances ? "clear" : "unknown"),
    lienHolder: acquisition?.lienHolder ?? "",
    lienNotes: acquisition?.lienNotes ?? "",
    notes: acquisition?.notes ?? "",
    intakeChecklist: checklistState(acquisition?.intakeChecklist),
  };
}

const asNumber = (value: string) => value === "" ? undefined : Number(value);
const asDate = (value: string) => value ? `${value}T12:00:00Z` : undefined;

export function DealershipVehicleForm({
  vehicle,
  acquisition,
  locations,
  preparation,
}: {
  vehicle?: VehicleDetail;
  acquisition?: Acquisition | null;
  locations: OrganizationLocation[];
  preparation?: VehiclePreparation | null;
}) {
  const router = useRouter();
  const editing = Boolean(vehicle);
  const [form, setForm] = useState<FormState>(() => initialState(vehicle, acquisition, locations));
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<FormTab>("vehicle");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [primaryPhotoIndex, setPrimaryPhotoIndex] = useState(0);

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateCheck = (key: string, value: CheckStatus) => {
    setForm((current) => ({
      ...current,
      intakeChecklist: {
        ...current.intakeChecklist,
        checks: { ...current.intakeChecklist.checks, [key]: value },
      },
    }));
  };

  const updateReceivedItem = (key: string, value: boolean) => {
    setForm((current) => ({
      ...current,
      intakeChecklist: {
        ...current.intakeChecklist,
        items: { ...current.intakeChecklist.items, [key]: value },
      },
    }));
  };

  const updateChecklist = <K extends keyof IntakeChecklist>(field: K, value: IntakeChecklist[K]) => {
    setForm((current) => ({
      ...current,
      intakeChecklist: { ...current.intakeChecklist, [field]: value },
    }));
  };

  const lookupPlate = async () => {
    const plate = form.patent.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (plate.length < 5) {
      toast.error("Ingresa una patente chilena válida");
      return;
    }
    setLookingUp(true);
    setLookupDone(false);
    try {
      const response = await crmFetch(`/api/crm/vehicles/plate-lookup/${encodeURIComponent(plate)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.status === 402 || data?.detail === "simplecar_patentes_no_credits") {
        toast.error("La consulta registral está temporalmente sin saldo. Puedes completar los datos manualmente.");
        return;
      }
      if (!response.ok || data?.status !== "success" || !data?.vehicle) {
        toast.info("No encontramos datos registrales. Puedes completar la ficha manualmente.");
        return;
      }
      const result = data.vehicle as Record<string, string | number | null>;
      setForm((current) => ({
        ...current,
        patent: plate,
        brand: String(result.brand ?? current.brand),
        model: String(result.model ?? current.model),
        year: result.year ? String(result.year) : current.year,
        vehicleType: String(result.vehicle_type ?? current.vehicleType),
        fuelType: normalizeFuel(result.fuel_type ? String(result.fuel_type) : current.fuelType),
        transmission: normalizeTransmission(result.transmission ? String(result.transmission) : current.transmission),
        vin: String(result.vin ?? current.vin),
        engine: String(result.engine ?? current.engine),
        color: String(result.color ?? current.color),
        doors: result.doors ? String(result.doors) : current.doors,
        mileage: result.mileage != null ? String(result.mileage) : current.mileage,
      }));
      setLookupDone(true);
      toast.success("Datos técnicos cargados desde la patente");
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos consultar la patente. Intenta nuevamente.");
      if (message) toast.error(message);
    } finally {
      setLookingUp(false);
    }
  };

  const submit = async () => {
    if (!form.patent || !form.brand.trim() || !form.model.trim() || !form.year || !form.salePrice) {
      setActiveTab(!form.patent || !form.brand.trim() || !form.model.trim() || !form.year ? "vehicle" : "intake");
      toast.error("Completa patente, marca, modelo, año y precio de venta");
      return;
    }
    if (!form.ownerName.trim()) {
      setActiveTab("intake");
      toast.error("Identifica a la persona que entrega el vehículo");
      return;
    }
    if (!form.receivedAt || !form.locationId) {
      setActiveTab("intake");
      toast.error("Registra la fecha de ingreso y selecciona una sucursal");
      return;
    }
    if (form.kind === "purchase" && !form.purchasePrice) {
      setActiveTab("intake");
      toast.error("Ingresa el precio pagado al particular");
      return;
    }
    if (form.kind === "consignment" && (!form.minPrice || !form.commissionPct)) {
      setActiveTab("intake");
      toast.error("Ingresa el precio mínimo y la comisión de consignación");
      return;
    }
    if (form.kind === "trade_in" && !form.minPrice) {
      setActiveTab("intake");
      toast.error("Ingresa el valor asignado al vehículo recibido en parte de pago");
      return;
    }
    if (RECEPTION_TAB_VISIBLE && form.intakeChecklist.completed && VEHICLE_CHECKS.some(([key]) => form.intakeChecklist.checks[key] === "not_checked")) {
      setActiveTab("reception");
      toast.error("Completa todos los puntos del chequeo antes de marcar la recepción como realizada");
      return;
    }

    const checklistPayload = {
      ...form.intakeChecklist,
      keysCount: Number(form.intakeChecklist.keysCount || 0),
    };
    const checklistChanged = !editing
      || JSON.stringify(checklistPayload) !== JSON.stringify({
        ...checklistState(acquisition?.intakeChecklist),
        keysCount: Number(checklistState(acquisition?.intakeChecklist).keysCount || 0),
      });
    const payload = {
      vehicle: {
        patent: form.patent,
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        price: Number(form.salePrice),
        mileage: asNumber(form.mileage),
        vehicleType: form.vehicleType,
        fuelType: form.fuelType || undefined,
        transmission: form.transmission || undefined,
        vin: form.vin.trim() || undefined,
        engine: form.engine.trim() || undefined,
        color: form.color.trim() || undefined,
        doors: asNumber(form.doors),
        description: form.description.trim() || undefined,
        status: form.status,
      },
      acquisition: {
        kind: form.kind,
        ownerName: form.ownerName.trim(),
        ownerRut: form.ownerRut.trim() || undefined,
        ownerPhone: form.ownerPhone.trim() || undefined,
        ownerEmail: form.ownerEmail.trim() || undefined,
        ownerAddress: form.ownerAddress.trim() || undefined,
        plate: form.patent,
        brand: form.brand.trim(),
        model: form.model.trim(),
        year: Number(form.year),
        vin: form.vin.trim() || undefined,
        engineNumber: form.engine.trim() || undefined,
        color: form.color.trim() || undefined,
        mileage: asNumber(form.mileage),
        purchasePrice: asNumber(form.purchasePrice),
        minPrice: asNumber(form.minPrice),
        commissionPct: asNumber(form.commissionPct),
        startsAt: asDate(form.startsAt),
        endsAt: asDate(form.endsAt),
        receivedAt: asDate(form.receivedAt),
        exitedAt: asDate(form.exitedAt),
        locationId: form.locationId,
        lienStatus: form.lienStatus,
        lienHolder: form.lienHolder.trim() || undefined,
        lienNotes: form.lienNotes.trim() || undefined,
        freeOfEncumbrances: form.lienStatus === "clear",
        notes: form.notes.trim() || undefined,
        intakeChecklist: checklistChanged ? checklistPayload : undefined,
        status: acquisition?.status ?? "received",
      },
    };

    setSaving(true);
    try {
      const response = await crmFetch(
        editing ? `/api/crm/vehicle-intakes/${vehicle!.id}` : "/api/crm/vehicle-intakes",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error || "No pudimos guardar la unidad");
        return;
      }
      const savedVehicleId = String(data?.vehicle?.id || vehicle?.id || "");
      if (photoFiles.length > 0 && savedVehicleId) {
        toast.message(`Subiendo ${photoFiles.length} ${photoFiles.length === 1 ? "foto" : "fotos"}...`);
        const existingPositions = vehicle?.photos.map((photo) => photo.position) ?? [];
        const startPosition = existingPositions.length
          ? Math.min(...existingPositions) - photoFiles.length
          : 0;
        const upload = await uploadAndRegisterPhotos(
          savedVehicleId,
          photoFiles,
          primaryPhotoIndex,
          startPosition,
        );
        if (upload.errors.length > 0) {
          toast.warning(`${upload.registered} fotos guardadas. ${upload.errors.length} no pudieron subirse.`);
        } else {
          toast.success(`${upload.registered} ${upload.registered === 1 ? "foto guardada" : "fotos guardadas"}`);
        }
      }
      const stockNumber = Number(data?.vehicle?.stock_number);
      const stockCode = Number.isInteger(stockNumber) && stockNumber > 0
        ? `STK-${String(stockNumber).padStart(6, "0")}`
        : null;
      toast.success(editing ? "Unidad actualizada" : stockCode ? `Vehículo ingresado como ${stockCode}` : "Vehículo ingresado al inventario");
      const savedAcquisitionId = String(data?.acquisition?.id || acquisition?.id || "");
      if (!editing && savedAcquisitionId) {
        window.open(`/api/crm/acquisitions/${savedAcquisitionId}/inspection`, "_blank", "noopener,noreferrer");
      }
      router.push("/vehiculos");
      router.refresh();
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para guardar la unidad");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const isConsignment = form.kind === "consignment";
  const isPurchase = form.kind === "purchase";
  const hasLien = form.lienStatus === "present" || form.lienStatus === "pending_release";
  const activeIndex = FORM_TABS.findIndex((tab) => tab.id === activeTab);

  const advance = () => {
    if (activeTab === "vehicle" && (!form.patent || !form.brand.trim() || !form.model.trim() || !form.year)) {
      toast.error("Completa patente, marca, modelo y año para continuar");
      return;
    }
    if (activeTab === "intake") {
      if (!form.ownerName.trim()) {
        toast.error("Identifica a la persona que entrega el vehículo");
        return;
      }
      if (isPurchase && !form.purchasePrice) {
        toast.error("Ingresa el precio pagado al particular");
        return;
      }
      if (isConsignment && (!form.minPrice || !form.commissionPct)) {
        toast.error("Ingresa el precio mínimo y la comisión");
        return;
      }
      if (form.kind === "trade_in" && !form.minPrice) {
        toast.error("Ingresa el valor asignado al vehículo");
        return;
      }
      if (!form.receivedAt || !form.locationId || !form.salePrice) {
        toast.error("Completa fecha de ingreso, sucursal y precio de venta");
        return;
      }
    }
    if (activeTab === "reception" && form.intakeChecklist.completed && VEHICLE_CHECKS.some(([key]) => form.intakeChecklist.checks[key] === "not_checked")) {
      toast.error("Quedan puntos pendientes en el chequeo de recepción");
      return;
    }
    const next = FORM_TABS[activeIndex + 1];
    if (next) setActiveTab(next.id);
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-4">
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium">
          <span>Paso {activeIndex + 1} de {FORM_TABS.length}</span>
          <span className="text-[var(--muted-foreground)]">{Math.round(((activeIndex + 1) / FORM_TABS.length) * 100)}%</span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]" role="progressbar" aria-label="Progreso del ingreso" aria-valuemin={1} aria-valuemax={FORM_TABS.length} aria-valuenow={activeIndex + 1}>
          <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300" style={{ width: `${((activeIndex + 1) / FORM_TABS.length) * 100}%` }} />
        </div>
        <div className="overflow-x-auto">
          <div role="tablist" aria-label="Secciones del vehículo" className="grid min-w-[500px] grid-cols-4 gap-1">
          {FORM_TABS.map((tab, index) => {
            const active = tab.id === activeTab;
            const completed = index < activeIndex;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`vehicle-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-3 py-2.5 text-xs font-medium transition-colors ${active ? "bg-[var(--fm-navy)] text-white" : completed ? "bg-[var(--accent)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"}`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${active ? "bg-white/15" : completed ? "bg-[var(--primary)] text-white" : "bg-[var(--muted)]"}`}>{index + 1}</span>
                <tab.Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div id={`vehicle-tab-${activeTab}`} role="tabpanel" className="space-y-4">
          {activeTab === "vehicle" && <Panel title="Identificación del vehículo">
            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <FormField label="Patente" required hint={lookupDone ? "Datos registrales cargados correctamente." : "Una unidad activa por patente."}>
                  <input
                    value={form.patent}
                    onChange={(event) => { update("patent", event.target.value.toUpperCase()); setLookupDone(false); }}
                    className={`${fieldInputClass} font-mono uppercase tracking-wider`}
                    placeholder="ABCD12"
                    disabled={lookingUp}
                    autoFocus={!editing}
                  />
                </FormField>
                <button
                  type="button"
                  onClick={lookupPlate}
                  disabled={lookingUp || !form.patent}
                  className="flex h-[42px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--fm-navy)] px-4 text-sm font-medium text-white disabled:opacity-60"
                >
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {lookingUp ? "Consultando..." : "Consultar"}
                </button>
              </div>
              {lookingUp && <p role="status" className="text-xs text-[var(--muted-foreground)]">SimpleCar suele responder entre 1 y 2 segundos.</p>}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Marca" required><input value={form.brand} onChange={(e) => update("brand", e.target.value)} className={fieldInputClass} /></FormField>
                <FormField label="Modelo" required><input value={form.model} onChange={(e) => update("model", e.target.value)} className={fieldInputClass} /></FormField>
                <FormField label="Año" required><input type="number" value={form.year} onChange={(e) => update("year", e.target.value)} className={fieldInputClass} /></FormField>
                <FormField label="Tipo"><select value={form.vehicleType} onChange={(e) => update("vehicleType", e.target.value)} className={fieldInputClass}>{VEHICLE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
                <FormField label="Combustible"><select value={form.fuelType} onChange={(e) => update("fuelType", e.target.value)} className={fieldInputClass}><option value="">Sin especificar</option>{FUELS.map((value) => <option key={value}>{value}</option>)}</select></FormField>
                <FormField label="Transmisión"><select value={form.transmission} onChange={(e) => update("transmission", e.target.value)} className={fieldInputClass}><option value="">Sin especificar</option>{TRANSMISSIONS.map((value) => <option key={value}>{value}</option>)}</select></FormField>
                <FormField label="VIN / chasis"><input value={form.vin} onChange={(e) => update("vin", e.target.value.toUpperCase())} className={fieldInputClass} /></FormField>
                <FormField label="N° de motor"><input value={form.engine} onChange={(e) => update("engine", e.target.value.toUpperCase())} className={fieldInputClass} /></FormField>
                <FormField label="Color"><input value={form.color} onChange={(e) => update("color", e.target.value)} className={fieldInputClass} /></FormField>
                <FormField label="Puertas"><input type="number" min={1} max={8} value={form.doors} onChange={(e) => update("doors", e.target.value)} className={fieldInputClass} /></FormField>
                <FormField label="Kilometraje"><input type="number" min={0} value={form.mileage} onChange={(e) => update("mileage", e.target.value)} className={fieldInputClass} /></FormField>
              </div>
            </div>
          </Panel>}

          {activeTab === "vehicle" && <Panel title="Fotos del vehículo">
            <div className="p-4">
              <VehiclePhotoUpload
                files={photoFiles}
                primaryIndex={primaryPhotoIndex}
                existingUrls={vehicle?.photos.map((photo) => photo.url) ?? []}
                onChange={(files, primaryIndex) => {
                  setPhotoFiles(files);
                  setPrimaryPhotoIndex(primaryIndex);
                }}
              />
            </div>
          </Panel>}

          {activeTab === "intake" && <Panel title="Forma de ingreso">
            <div className="space-y-4 p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {KINDS.map((kind) => (
                  <button
                    key={kind.value}
                    type="button"
                    onClick={() => update("kind", kind.value)}
                    className={`rounded-[var(--radius-md)] border p-3 text-left transition-colors ${form.kind === kind.value ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)]"}`}
                  >
                    <span className="block text-sm font-semibold">{kind.label}</span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-[var(--muted-foreground)]">{kind.hint}</span>
                  </button>
                ))}
              </div>

              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"><FileText className="h-3.5 w-3.5" /> Particular que entrega el vehículo</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Nombre completo" required><input value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} className={fieldInputClass} /></FormField>
                <FormField label="RUT"><input value={form.ownerRut} onChange={(e) => update("ownerRut", e.target.value)} className={fieldInputClass} /></FormField>
                <FormField label="Teléfono"><input type="tel" value={form.ownerPhone} onChange={(e) => update("ownerPhone", e.target.value)} className={fieldInputClass} /></FormField>
                <FormField label="Correo"><input type="email" value={form.ownerEmail} onChange={(e) => update("ownerEmail", e.target.value)} className={fieldInputClass} /></FormField>
              </div>
              <FormField label="Domicilio"><input value={form.ownerAddress} onChange={(e) => update("ownerAddress", e.target.value)} className={fieldInputClass} /></FormField>

              <div className="grid gap-3 sm:grid-cols-2">
                {isPurchase && <FormField label="Precio de compra (CLP)" required><input type="number" min={0} value={form.purchasePrice} onChange={(e) => update("purchasePrice", e.target.value)} className={fieldInputClass} /></FormField>}
                {isConsignment && <FormField label="Precio mínimo autorizado" required><input type="number" min={0} value={form.minPrice} onChange={(e) => update("minPrice", e.target.value)} className={fieldInputClass} /></FormField>}
                {isConsignment && <FormField label="Comisión automotora (%)" required><input type="number" min={0} max={100} step="0.1" value={form.commissionPct} onChange={(e) => update("commissionPct", e.target.value)} className={fieldInputClass} /></FormField>}
                {form.kind === "trade_in" && <FormField label="Valor asignado (CLP)" required><input type="number" min={0} value={form.minPrice} onChange={(e) => update("minPrice", e.target.value)} className={fieldInputClass} /></FormField>}
                {isConsignment && <FormField label="Inicio del mandato"><input type="date" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} className={fieldInputClass} /></FormField>}
                {isConsignment && <FormField label="Vencimiento del mandato"><input type="date" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} className={fieldInputClass} /></FormField>}
              </div>
            </div>
          </Panel>}

          {activeTab === "intake" && <Panel title="Inventario y condiciones de venta">
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <FormField label="Fecha de ingreso" required><input type="date" value={form.receivedAt} onChange={(e) => update("receivedAt", e.target.value)} className={fieldInputClass} /></FormField>
              {editing && <FormField label="Fecha de salida"><input type="date" value={form.exitedAt} onChange={(e) => update("exitedAt", e.target.value)} className={fieldInputClass} /></FormField>}
              <div className="sm:col-span-2">
                <FormField label="Sucursal / ubicación" required hint="Lugar físico donde queda la unidad.">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" />
                    <select value={form.locationId} onChange={(e) => update("locationId", e.target.value)} className={`${fieldInputClass} pl-9`}>
                      <option value="">Selecciona una sucursal</option>
                      {locations
                        .filter((location) => location.isActive || location.id === acquisition?.locationId)
                        .map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}{location.commune ? ` · ${location.commune}` : ""}{!location.isActive ? " · Inactiva" : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                </FormField>
                {locations.every((location) => !location.isActive) && (
                  <Notice tone="warn"><Link href="/perfil">Crea una sucursal activa en Configuración antes de ingresar el vehículo.</Link></Notice>
                )}
              </div>
              <FormField label="Precio de venta (CLP)" required><input type="number" min={1} value={form.salePrice} onChange={(e) => update("salePrice", e.target.value)} className={fieldInputClass} /></FormField>
              <FormField label="Estado"><select value={form.status} onChange={(e) => update("status", e.target.value)} className={fieldInputClass}>{STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></FormField>
            </div>
          </Panel>}

          {activeTab === "reception" && <>
            <Panel title="Chequeo al recibir" subtitle="Registra el estado observado antes de dejar la unidad en el patio">
              <div className="divide-y divide-[var(--border)]">
                {VEHICLE_CHECKS.map(([key, label]) => (
                  <div key={key} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(180px,1fr)_minmax(300px,1.4fr)] sm:items-center">
                    <span className="text-xs font-medium">{label}</span>
                    <div className="grid grid-cols-3 gap-1">
                      {CHECK_OPTIONS.map((option) => {
                        const selected = form.intakeChecklist.checks[key] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateCheck(key, option.value)}
                            className={`rounded-md border px-2 py-2 text-[11px] font-medium transition ${selected ? option.value === "ok" ? "border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)]" : option.value === "observe" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-[var(--fm-navy)] bg-[#eef1f8] text-[var(--fm-navy)]" : "border-[var(--border)] bg-white text-[var(--muted-foreground)]"}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Datos de recepción">
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Nivel de combustible">
                  <select value={form.intakeChecklist.fuelLevel} onChange={(event) => updateChecklist("fuelLevel", event.target.value)} className={fieldInputClass}>
                    <option value="unknown">No revisado</option><option value="empty">Vacío / reserva</option><option value="quarter">1/4</option><option value="half">1/2</option><option value="three_quarters">3/4</option><option value="full">Lleno</option>
                  </select>
                </FormField>
                <FormField label="Cantidad de llaves" hint="Incluye llave principal y copias.">
                  <div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--muted-foreground)]" /><input type="number" min={0} max={10} value={form.intakeChecklist.keysCount} onChange={(event) => updateChecklist("keysCount", event.target.value)} className={`${fieldInputClass} pl-9`} /></div>
                </FormField>
                <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 sm:mt-[22px] ${form.intakeChecklist.completed ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-white"}`}>
                  <input type="checkbox" checked={form.intakeChecklist.completed} onChange={(event) => updateChecklist("completed", event.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                  <span><span className="block text-xs font-semibold">Chequeo completado</span><span className="text-[10px] text-[var(--muted-foreground)]">Confirma que se revisó junto a quien entrega.</span></span>
                </label>
                <div className="sm:col-span-2 lg:col-span-3"><FormField label="Daños, faltantes o detalles visibles"><textarea rows={3} value={form.intakeChecklist.damageNotes} onChange={(event) => updateChecklist("damageNotes", event.target.value)} className={`${fieldInputClass} resize-none`} placeholder="Ej. raya en puerta derecha, neumático trasero con desgaste, testigo de motor encendido..." /></FormField></div>
              </div>
            </Panel>

            <Panel title="Elementos y documentos recibidos" subtitle="Marca sólo lo que queda físicamente en poder de la automotora">
              <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {RECEIVED_ITEMS.map(([key, label]) => (
                  <label key={key} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${form.intakeChecklist.items[key] ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-white hover:bg-[var(--muted)]/30"}`}>
                    <input type="checkbox" checked={Boolean(form.intakeChecklist.items[key])} onChange={(event) => updateReceivedItem(key, event.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
                    <PackageCheck className={`h-4 w-4 shrink-0 ${form.intakeChecklist.items[key] ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
                    <span className="text-xs font-medium leading-snug">{label}</span>
                  </label>
                ))}
                <div className="sm:col-span-2 lg:col-span-3"><FormField label="Otros elementos o aclaraciones"><textarea rows={2} value={form.intakeChecklist.notes} onChange={(event) => updateChecklist("notes", event.target.value)} className={`${fieldInputClass} resize-none`} placeholder="Ej. barras de techo, cargador eléctrico, control de alarma, silla infantil..." /></FormField></div>
              </div>
            </Panel>
            <Notice><span className="flex gap-2"><ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" />Este checklist pertenece al expediente interno de recepción de la automotora y registra quién realizó la última revisión.</span></Notice>
          </>}

          {activeTab === "legal" && <>
            <Panel title="Situación legal">
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <FormField label="Prenda o gravamen" required><select value={form.lienStatus} onChange={(e) => update("lienStatus", e.target.value)} className={fieldInputClass}>{LIEN_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
                {hasLien && <FormField label="Acreedor prendario"><input value={form.lienHolder} onChange={(e) => update("lienHolder", e.target.value)} className={fieldInputClass} /></FormField>}
                {hasLien && <div className="sm:col-span-2"><FormField label="Condiciones de alzamiento"><textarea rows={2} value={form.lienNotes} onChange={(e) => update("lienNotes", e.target.value)} className={`${fieldInputClass} resize-none`} /></FormField></div>}
              </div>
            </Panel>
            <Panel title="Notas internas">
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <FormField label="Descripción para publicación"><textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} className={`${fieldInputClass} resize-none`} /></FormField>
                <FormField label="Observaciones de recepción"><textarea rows={5} value={form.notes} onChange={(e) => update("notes", e.target.value)} className={`${fieldInputClass} resize-none`} placeholder="Llaves, documentos, daños visibles..." /></FormField>
              </div>
            </Panel>
            <Notice><span className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Este ingreso pertenece únicamente a la automotora activa. No modifica los flujos de vendedores particulares ni compradores.</span></Notice>
          </>}
        </div>

        <aside className="space-y-4">
          {vehicle && preparation && <VehiclePreparationCard vehicleId={vehicle.id} initial={preparation} />}
          <Panel title="Resumen de la unidad">
            <div className="space-y-4 p-4 text-xs">
              <div><p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">Vehículo</p><p className="mt-1 font-mono text-base font-semibold">{form.patent || "Sin patente"}</p><p className="mt-0.5 text-sm">{[form.brand, form.model, form.year].filter(Boolean).join(" ") || "Datos pendientes"}</p></div>
              <div className="grid grid-cols-2 gap-3 border-y border-[var(--border)] py-3"><div><p className="text-[10px] text-[var(--muted-foreground)]">Procedencia</p><p className="mt-0.5 font-medium">{KINDS.find((kind) => kind.value === form.kind)?.label}</p></div><div><p className="text-[10px] text-[var(--muted-foreground)]">Estado</p><p className="mt-0.5 font-medium">{STATUSES.find((status) => status.value === form.status)?.label}</p></div></div>
              <div><p className="text-[10px] text-[var(--muted-foreground)]">Recepción</p><p className={`mt-0.5 font-medium ${form.intakeChecklist.completed ? "text-[var(--primary)]" : "text-amber-700"}`}>{form.intakeChecklist.completed ? "Chequeo completado" : `${Object.values(form.intakeChecklist.checks).filter((value) => value === "not_checked").length} puntos pendientes`}</p></div>
              <div><p className="text-[10px] text-[var(--muted-foreground)]">Ubicación</p><p className="mt-0.5 font-medium">{locations.find((location) => location.id === form.locationId)?.name || "Pendiente"}</p></div>
              <ol className="space-y-2 border-t border-[var(--border)] pt-3">
                {FORM_TABS.map((tab, index) => <li key={tab.id} className={`flex items-center gap-2 ${tab.id === activeTab ? "font-medium text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${tab.id === activeTab ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`}>{index + 1}</span>{tab.label}</li>)}
              </ol>
            </div>
          </Panel>
        </aside>
      </div>

      <div className="sticky bottom-[65px] z-20 flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg lg:bottom-3">
        <Link href="/vehiculos" className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--muted-foreground)]"><ArrowLeft className="h-4 w-4" />Cancelar</Link>
        <div className="flex gap-2">
          {activeIndex > 0 && <button type="button" onClick={() => setActiveTab(FORM_TABS[activeIndex - 1].id)} className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 text-sm">Atrás</button>}
          {activeIndex < FORM_TABS.length - 1 ? (
            <button type="button" onClick={advance} className="rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white">Continuar</button>
          ) : (
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Building2 className="h-4 w-4" /> : <Car className="h-4 w-4" />}
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Ingresar al inventario"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
