"use client";

/**
 * La cotización: qué unidad se le está ofreciendo al cliente y en qué términos.
 *
 * Es la pieza que faltaba para que una solicitud sea una VENTA y no sólo un contacto. En una
 * automotora la conversación siempre termina en tres números —precio conversado, pie y cuánto
 * vale el auto que entrega— y hasta ahora esos números vivían en la libreta del vendedor.
 *
 * Dos casos igual de comunes, ambos cubiertos aquí:
 *   - el cliente preguntó por una publicación (llega con unidad) y se negocia el precio;
 *   - el cliente llegó al local sin pedir nada (venta de mostrador) y el agente le busca una
 *     unidad del stock por patente o modelo.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import {
  Car,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileClock,
  Images,
  Loader2,
  Pencil,
  Plus,
  Search,
  Share2,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { fmtCLP, fmtDateTime, fmtNumber, fmtPlate } from "@/lib/format";
import type { Lead, LeadVehicleInterest } from "@/lib/leads";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Pill } from "@/components/ui/primitives";
import { PrepurchaseVisitDialog } from "@/components/reports/prepurchase-visit-dialog";
import { ReportShareAction } from "@/components/reports/report-share-action";

type StockItem = {
  id: string;
  label: string;
  year: number | null;
  patent: string | null;
  price: number | null;
  mileage: number | null;
  status: string | null;
  stockNumber: number | null;
  vehicleType: string | null;
  fuelType: string | null;
  transmission: string | null;
  color: string | null;
  inventoryLocation: string | null;
  photosStatus: string | null;
  recentReport: { id: string; reportType: string | null; generatedAt: string | null } | null;
};

type VehicleDetail = StockItem & {
  vin: string | null;
  engine: string | null;
  doors: number | null;
  description: string | null;
  photos: { id: string; url: string; position: number }[];
};

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Publicado",
  PUBLISHED_VERIFIED: "Publicado y verificado",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  DRAFT: "Borrador",
  PAUSED: "Pausado",
};

function statusVariant(status: string | null) {
  if (status?.startsWith("PUBLISHED")) return "success" as const;
  if (status === "RESERVED") return "warn" as const;
  if (status === "SOLD") return "info" as const;
  return "neutral" as const;
}

export function QuoteCard({
  lead,
  vehicleInterests,
  canWrite,
}: {
  lead: Lead;
  vehicleInterests: LeadVehicleInterest[];
  canWrite: boolean;
}) {
  const router = useRouter();
  // La selección múltiple es el trabajo principal de esta pestaña, no una edición secundaria.
  const [editing, setEditing] = useState(canWrite);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  // Unidad elegida. `undefined` = no se tocó; `null` = se desvinculó a propósito.
  const [vehicle, setVehicle] = useState<StockItem | null | undefined>(undefined);
  const [price, setPrice] = useState<number | null>(lead.quotedPrice ?? lead.vehiclePrice);
  const [down, setDown] = useState<number | null>(lead.quotedDownPayment);
  const [tradeIn, setTradeIn] = useState<number | null>(lead.tradeInAmount);

  const currentVehicleId = vehicle === undefined ? lead.vehicleId : vehicle?.id ?? null;
  const listPrice = vehicle === undefined ? lead.vehiclePrice : vehicle?.price ?? null;
  const base = price ?? listPrice ?? 0;
  const toFinance = Math.max(base - (down ?? 0) - (tradeIn ?? 0), 0);
  const discount = listPrice !== null && price !== null ? listPrice - price : 0;
  // Existe la compra = ya se cobro: los montos son los del contrato, no una cotizacion.
  const saleClosed = Boolean(lead.purchaseId);

  const reset = () => {
    setVehicle(undefined);
    setPrice(lead.quotedPrice ?? lead.vehiclePrice);
    setDown(lead.quotedDownPayment);
    setTradeIn(lead.tradeInAmount);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        quotedPrice: price ?? 0,
        quotedDownPayment: down ?? 0,
        tradeInAmount: tradeIn ?? 0,
      };
      // Sólo se manda la unidad si cambió: "" desvincula en el backend.
      if (vehicle !== undefined) payload.vehicleId = vehicle?.id ?? "";

      const res = await crmFetch(`/api/crm/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos guardar la cotización");
        return;
      }
      toast.success("Cotización guardada");
      setEditing(false);
      setVehicle(undefined);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    const activeInterests = vehicleInterests.filter((interest) => interest.status !== "rejected");
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--muted)]">
            <Car className="h-5 w-5 text-[var(--muted-foreground)]" />
          </div>
          <div className="min-w-0 flex-1">
            {lead.vehicleId ? (
              <>
                <p className="truncate text-sm font-medium">
                  {lead.vehicleLabel}
                  {lead.vehicleYear ? ` ${lead.vehicleYear}` : ""}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted-foreground)]">
                  {lead.vehiclePatent && <span>{fmtPlate(lead.vehiclePatent)}</span>}
                  {lead.vehiclePrice !== null && <span>Lista {fmtCLP(lead.vehiclePrice)}</span>}
                  <Link href={`/vehiculos?q=${lead.vehiclePatent ?? ""}`} className="text-[var(--primary)]">
                    Ver en el stock
                  </Link>
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Sin unidad asignada</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Si el cliente llegó al local sin pedir un auto en particular, elige del stock
                  el que le estás mostrando.
                </p>
              </>
            )}
          </div>
          {canWrite && (
            <button
              onClick={() => setEditing(true)}
              disabled={pending}
              className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-2.5 py-1.5 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              Gestionar vehículos
            </button>
          )}
        </div>

        {activeInterests.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold">Vehículos considerados</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {activeInterests.length === 1
                    ? "Hay una alternativa registrada para este cliente."
                    : `Hay ${activeInterests.length} alternativas registradas para este cliente.`}
                </p>
              </div>
              <Pill>{activeInterests.length}</Pill>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeInterests.map((interest) => (
                <div
                  key={interest.id}
                  className={clsx(
                    "rounded-lg border bg-white px-3 py-2.5",
                    interest.status === "selected"
                      ? "border-[var(--primary)]/40 shadow-[inset_3px_0_var(--primary)]"
                      : "border-[var(--border)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {interest.label}{interest.year ? ` ${interest.year}` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                        {fmtPlate(interest.patent)} · {fmtCLP(interest.price)}
                      </p>
                    </div>
                    <Pill variant={interest.status === "selected" ? "success" : "neutral"}>
                      {interest.status === "selected" ? "Elegido" : "En evaluación"}
                    </Pill>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                    {interest.testDriveStatus === "completed"
                      ? `Test drive realizado${interest.testDriveCompletedAt ? ` · ${fmtDateTime(interest.testDriveCompletedAt)}` : ""}`
                      : interest.testDriveStatus === "scheduled"
                        ? `Test drive ${interest.testDriveScheduledAt ? fmtDateTime(interest.testDriveScheduledAt) : "agendado"}`
                        : "Sin test drive agendado"}
                  </p>
                  {interest.testDriveNotes && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-[var(--foreground)]">
                      {interest.testDriveNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(lead.quotedPrice !== null || lead.quotedDownPayment !== null || lead.tradeInAmount !== null) && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3 sm:grid-cols-4">
            <Figure label="Precio conversado" value={fmtCLP(lead.quotedPrice ?? lead.vehiclePrice)} />
            <Figure label="Pie" value={lead.quotedDownPayment ? fmtCLP(lead.quotedDownPayment) : "—"} />
            <Figure
              label="Parte de pago"
              value={lead.tradeInAmount ? fmtCLP(lead.tradeInAmount) : "—"}
            />
            <Figure
              label="Por financiar"
              value={fmtCLP(
                Math.max(
                  (lead.quotedPrice ?? lead.vehiclePrice ?? 0) -
                    (lead.quotedDownPayment ?? 0) -
                    (lead.tradeInAmount ?? 0),
                  0,
                ),
              )}
              strong
            />
          </dl>
        )}
        <Link href={`/captacion?lead=${lead.id}`} className="block text-xs text-[var(--primary)] underline">Ver captación del vehículo en parte de pago</Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-4">
      <StockPicker
        leadId={lead.id}
        initialInterests={vehicleInterests}
        currentId={currentVehicleId}
        currentLabel={
          vehicle === undefined
            ? lead.vehicleId
              ? `${lead.vehicleLabel}${lead.vehicleYear ? ` ${lead.vehicleYear}` : ""}`
              : null
            : vehicle
              ? `${vehicle.label}${vehicle.year ? ` ${vehicle.year}` : ""}`
              : null
        }
        onPick={(item) => {
          const changed = item?.id !== currentVehicleId;
          setVehicle(item);
          // El precio de lista de la unidad recién elegida es el punto de partida natural.
          // El pie y la parte de pago NO se tocan: el backend los conserva al cambiar de
          // vehículo (sólo topa el pie si excede el precio de la nueva unidad) y perderlos acá
          // significaría re-cobrar o re-evaluar algo que el cliente ya entregó.
          if (changed) {
            setPrice(item?.price ?? null);
          }
        }}
      />

      {/* Con el pago ya registrado los montos quedan fijados: son los que usan el contrato de
          compraventa y la transferencia. El backend los rechaza igual; avisarlo acá evita que
          alguien tipee un precio nuevo y recién al guardar descubra que no se puede. */}
      {saleClosed && (
        <p className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          El pago ya está registrado, así que el precio quedó fijado: es el que va en el contrato
          y en la transferencia. Si hay que renegociar, marca la oportunidad como perdida —eso
          anula la venta y devuelve el auto a la vitrina— y parte una nueva.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Labelled label="Precio conversado" hint={discount > 0 ? `${fmtCLP(discount)} bajo lista` : undefined}>
          <CurrencyInput value={price} onChange={setPrice} placeholder="0" disabled={saleClosed} />
        </Labelled>
        <Labelled label="Pie">
          <CurrencyInput value={down} onChange={setDown} placeholder="0" disabled={saleClosed} />
        </Labelled>
        <Labelled label="Parte de pago" hint="Auto que entrega">
          <CurrencyInput value={tradeIn} onChange={setTradeIn} placeholder="0" disabled={saleClosed} />
          <Link href={`/captacion?lead=${lead.id}`} className="mt-2 block text-xs text-[var(--primary)] underline">Gestionar vehículo en captación</Link>
        </Labelled>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2.5">
        <span className="text-xs font-medium text-[var(--accent-foreground)]">Queda por financiar</span>
        <span className="text-base font-semibold tabular-nums text-[var(--accent-foreground)]">
          {fmtCLP(toFinance)}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving || pending || saleClosed}
          className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 sm:flex-none sm:py-2"
        >
          {saving || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Guardar cotización
        </button>
        <button
          onClick={reset}
          className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 text-sm sm:py-2"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Inventario comercial para comparar, revisar y elegir una unidad sin salir del lead. */
function StockPicker({
  leadId,
  initialInterests,
  currentId,
  currentLabel,
  onPick,
}: {
  leadId: string;
  initialInterests: LeadVehicleInterest[];
  currentId: string | null;
  currentLabel: string | null;
  onPick: (item: StockItem | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [interests, setInterests] = useState(initialInterests);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [gallery, setGallery] = useState<VehicleDetail | null>(null);
  const [galleryLoadingId, setGalleryLoadingId] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [updatingVehicleId, setUpdatingVehicleId] = useState<string | null>(null);
  const [reportLoadingId, setReportLoadingId] = useState<string | null>(null);
  const [testDriveDialog, setTestDriveDialog] = useState<{
    interest: LeadVehicleInterest;
    mode: "schedule" | "result";
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchSequence = useRef(0);

  const search = useCallback(async (q: string, nextStatus: string) => {
    const sequence = ++searchSequence.current;
    setSearching(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (nextStatus) params.set("status", nextStatus);
      const res = await crmFetch(`/api/crm/vehicles?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("stock_search_failed");
      const data = (await res.json()) as { items?: StockItem[]; total?: number };
      if (sequence !== searchSequence.current) return;
      setResults(data.items ?? []);
      setTotal(data.total ?? data.items?.length ?? 0);
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos buscar las unidades");
      if (message) toast.error(message);
    } finally {
      if (sequence === searchSequence.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const initialSearch = setTimeout(() => void search("", ""), 0);
    return () => clearTimeout(initialSearch);
  }, [search]);

  // El rebote vive en el handler y no en un efecto: así el tecleo no encadena renders y la
  // lista se limpia en el mismo gesto en que el agente borra lo que escribió.
  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void search(value, status), 300);
  };

  const onStatusChange = (value: string) => {
    setStatus(value);
    if (timer.current) clearTimeout(timer.current);
    void search(query, value);
  };

  const openGallery = async (item: Pick<StockItem, "id" | "label"> & Partial<StockItem>) => {
    setGalleryLoadingId(item.id);
    try {
      const res = await crmFetch(`/api/crm/vehicles/${encodeURIComponent(item.id)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.vehicle) {
        toast.error(data?.error || "No pudimos cargar la ficha del vehículo");
        return;
      }
      const raw = data.vehicle as Record<string, unknown>;
      const photos = ((data.photos ?? []) as { id: string; url: string; position: number }[])
        .map((photo) => ({
          id: String(photo.id),
          url: String(photo.url),
          position: Number(photo.position ?? 0),
        }))
        .sort((a, b) => a.position - b.position);
      setGallery({
        id: String(raw.id),
        label:
          [raw.brand_label ?? raw.brand, raw.model_label ?? raw.model].filter(Boolean).join(" ") ||
          item.label,
        year: raw.year == null ? item.year ?? null : Number(raw.year),
        patent: typeof raw.patent === "string" ? raw.patent : item.patent ?? null,
        price: raw.price == null ? item.price ?? null : Number(raw.price),
        mileage: raw.mileage == null ? item.mileage ?? null : Number(raw.mileage),
        status: typeof raw.status === "string" ? raw.status : item.status ?? null,
        stockNumber: raw.stock_number == null ? item.stockNumber ?? null : Number(raw.stock_number),
        vehicleType: typeof raw.vehicle_type === "string" ? raw.vehicle_type : item.vehicleType ?? null,
        fuelType: typeof raw.fuel_type === "string" ? raw.fuel_type : item.fuelType ?? null,
        transmission:
          typeof raw.transmission === "string" ? raw.transmission : item.transmission ?? null,
        color: typeof raw.color === "string" ? raw.color : item.color ?? null,
        inventoryLocation: item.inventoryLocation ?? null,
        photosStatus: photos.length ? "completed" : "pending",
        recentReport: item.recentReport ?? null,
        vin: typeof raw.vin === "string" ? raw.vin : null,
        engine: typeof raw.engine === "string" ? raw.engine : null,
        doors: raw.doors == null ? null : Number(raw.doors),
        description: typeof raw.description === "string" ? raw.description : null,
        photos,
      });
      setActivePhoto(0);
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos cargar la ficha del vehículo");
      if (message) toast.error(message);
    } finally {
      setGalleryLoadingId(null);
    }
  };

  const addInterest = async (item: StockItem) => {
    setUpdatingVehicleId(item.id);
    try {
      const response = await crmFetch(`/api/crm/leads/${leadId}/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId: item.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.vehicleInterest) {
        toast.error(data?.error || "No pudimos agregar la unidad");
        return;
      }
      const added = data.vehicleInterest as LeadVehicleInterest;
      setInterests((current) => {
        const exists = current.some((interest) => interest.vehicleId === added.vehicleId);
        return exists
          ? current.map((interest) => (interest.vehicleId === added.vehicleId ? added : interest))
          : [...current, added];
      });
      toast.success("Unidad agregada para evaluar");
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos agregar la unidad");
      if (message) toast.error(message);
    } finally {
      setUpdatingVehicleId(null);
    }
  };

  const updateInterest = async (
    vehicleId: string,
    payload: Record<string, unknown>,
  ): Promise<LeadVehicleInterest | null> => {
    setUpdatingVehicleId(vehicleId);
    try {
      const response = await crmFetch(`/api/crm/leads/${leadId}/vehicles/${vehicleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.vehicleInterest) {
        toast.error(data?.error || "No pudimos actualizar la unidad");
        return null;
      }
      const updated = data.vehicleInterest as LeadVehicleInterest;
      setInterests((current) =>
        current.map((interest) => {
          if (interest.vehicleId === updated.vehicleId) return updated;
          if (updated.status === "selected" && interest.status === "selected") {
            return { ...interest, status: "candidate" };
          }
          return interest;
        }),
      );
      return updated;
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos actualizar la unidad");
      if (message) toast.error(message);
      return null;
    } finally {
      setUpdatingVehicleId(null);
    }
  };

  const requestHistoryReport = async (item: StockItem) => {
    setReportLoadingId(item.id);
    try {
      const response = await crmFetch(`/api/crm/leads/${leadId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: "standard", vehicleId: item.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.report) {
        toast.error(data?.error || "No pudimos solicitar el informe");
        return;
      }
      if (data.report.status === "generated") {
        setResults((current) =>
          current.map((vehicle) =>
            vehicle.id === item.id
              ? {
                  ...vehicle,
                  recentReport: {
                    id: String(data.report.id),
                    reportType: data.report.reportType ?? "standard",
                    generatedAt: data.report.generatedAt ?? null,
                  },
                }
              : vehicle,
          ),
        );
        toast.success(data.reused ? "Usamos el informe reciente de esta patente" : "Informe disponible");
      } else {
        toast.success("Informe solicitado; aparecerá en Informes cuando esté listo");
      }
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos solicitar el informe");
      if (message) toast.error(message);
    } finally {
      setReportLoadingId(null);
    }
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const selectedResult = results.find((item) => item.id === currentId);
  const activeInterests = interests.filter((interest) => interest.status !== "rejected");
  const focusInventory = () => {
    searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchInputRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium">Selección múltiple de vehículos</p>
          <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
            Agrega todas las alternativas que revisará el cliente y elige una sólo al decidir.
          </p>
        </div>
        {currentId && currentLabel && (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--primary)]/25 bg-[var(--accent)] px-3 py-2">
            <Tag className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Venta final
            </span>
            <span className="max-w-64 truncate text-xs font-semibold">{currentLabel}</span>
            <button
              type="button"
              onClick={() =>
                void openGallery(selectedResult ?? { id: currentId, label: currentLabel })
              }
              disabled={galleryLoadingId === currentId}
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-[var(--primary)] hover:bg-white/60 disabled:opacity-60"
            >
              {galleryLoadingId === currentId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Images className="h-3.5 w-3.5" />
              )}
              Ficha y fotos
            </button>
            <button
              type="button"
              onClick={() => onPick(null)}
              aria-label="Quitar unidad"
              className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {activeInterests.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]/20 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">Vehículos considerados</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Puedes agregar varias alternativas. Sólo la marcada como venta final continúa al cierre.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Pill>{activeInterests.length}</Pill>
              <button
                type="button"
                onClick={focusInventory}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--primary)]/30 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--primary)] hover:border-[var(--primary)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar otro vehículo
              </button>
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {activeInterests.map((interest) => {
              const busy = updatingVehicleId === interest.vehicleId;
              const driveLabel = {
                not_scheduled: "Sin test drive",
                scheduled: "Test drive agendado",
                completed: "Test drive realizado",
                cancelled: "Test drive cancelado",
                no_show: "Cliente no asistió",
              }[interest.testDriveStatus];
              return (
                <div
                  key={interest.id}
                  className={clsx(
                    "rounded-lg border bg-white p-3",
                    interest.status === "selected"
                      ? "border-[var(--primary)]/40 shadow-[inset_3px_0_var(--primary)]"
                      : "border-[var(--border)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {interest.label}{interest.year ? ` ${interest.year}` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                        {fmtPlate(interest.patent)} · {fmtCLP(interest.price)}
                      </p>
                    </div>
                    <Pill variant={interest.status === "selected" ? "success" : "neutral"}>
                      {interest.status === "selected" ? "Venta final" : "Alternativa"}
                    </Pill>
                  </div>
                  <div className="mt-2 rounded-md bg-[var(--muted)]/45 px-2.5 py-2 text-[11px]">
                    <p className="font-medium">{driveLabel}</p>
                    {interest.testDriveStatus === "completed" && interest.testDriveCompletedAt ? (
                      <p className="mt-0.5 text-[var(--muted-foreground)]">
                        Realizado {fmtDateTime(interest.testDriveCompletedAt)}
                      </p>
                    ) : interest.testDriveScheduledAt ? (
                      <p className="mt-0.5 text-[var(--muted-foreground)]">
                        Agendado {fmtDateTime(interest.testDriveScheduledAt)}
                      </p>
                    ) : null}
                    {interest.testDriveNotes && (
                      <p className="mt-1 whitespace-pre-line text-[var(--muted-foreground)]">
                        {interest.testDriveNotes}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {interest.status !== "selected" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          const updated = await updateInterest(interest.vehicleId, { status: "selected" });
                          if (!updated) return;
                          onPick(stockFromInterest(updated, results));
                          toast.success("Unidad elegida para continuar la compra");
                        }}
                        className="rounded-md bg-[var(--primary)] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                      >
                        Elegir para venta final
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setTestDriveDialog({ interest, mode: "schedule" })}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-60"
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      Agendar test drive
                    </button>
                    {interest.testDriveStatus === "scheduled" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setTestDriveDialog({ interest, mode: "result" })}
                        className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-60"
                      >
                        Registrar resultado
                      </button>
                    )}
                    {interest.status !== "selected" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void updateInterest(interest.vehicleId, { status: "rejected" })}
                        className="rounded-md px-2 py-1.5 text-[11px] text-[var(--muted-foreground)] hover:text-red-600 disabled:opacity-60"
                      >
                        Descartar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            ref={searchInputRef}
            id="stock-search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar por patente, marca, modelo o código…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] py-2.5 pl-9 pr-9 text-sm outline-none focus:border-[var(--primary)]"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--muted-foreground)]" />
          )}

        </div>
        <select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        >
          <option value="">Todos los estados</option>
          <option value="PUBLISHED_ALL">Publicados</option>
          <option value="RESERVED">Reservados</option>
          <option value="DRAFT">Borradores</option>
          <option value="PAUSED">Pausados</option>
          <option value="SOLD">Vendidos</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[var(--fm-navy)] text-white">
                <th className="w-32 px-3 py-2.5 text-center font-semibold">Agregar al lead</th>
                <th className="px-3 py-2.5 font-semibold">Unidad</th>
                <th className="px-3 py-2.5 font-semibold">Patente</th>
                <th className="px-3 py-2.5 text-center font-semibold">Año</th>
                <th className="px-3 py-2.5 text-right font-semibold">Kilometraje</th>
                <th className="px-3 py-2.5 font-semibold">Especificación</th>
                <th className="px-3 py-2.5 font-semibold">Sucursal</th>
                <th className="px-3 py-2.5 text-right font-semibold">Precio</th>
                <th className="px-3 py-2.5 font-semibold">Estado</th>
                <th className="min-w-80 px-3 py-2.5 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!searching && results.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                    No hay unidades que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                results.map((item, index) => {
                  const selected = currentId === item.id;
                  const interest = interests.find((entry) => entry.vehicleId === item.id);
                  const added = interest && interest.status !== "rejected";
                  return (
                    <tr
                      key={item.id}
                      aria-selected={selected}
                      className={clsx(
                        "transition-colors hover:bg-[var(--accent)]",
                        selected ? "bg-[var(--accent)]" : index % 2 ? "bg-[var(--muted)]/20" : "bg-white",
                      )}
                    >
                      <td className="border-t border-[var(--border)] px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => void addInterest(item)}
                          disabled={Boolean(added) || updatingVehicleId === item.id}
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold disabled:opacity-70",
                            added
                              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                              : "border border-[var(--border)] bg-white text-[var(--primary)] hover:border-[var(--primary)]",
                          )}
                        >
                          {updatingVehicleId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : added ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                          {added ? "En la lista" : "Agregar alternativa"}
                        </button>
                      </td>
                      <td className="border-t border-[var(--border)] px-3 py-2.5">
                        <span className="block font-semibold">{item.label}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {item.stockNumber == null ? "Sin código" : `STK-${String(item.stockNumber).padStart(6, "0")}`}
                        </span>
                      </td>
                      <td className="border-t border-[var(--border)] px-3 py-2.5 font-mono font-semibold">
                        {fmtPlate(item.patent)}
                      </td>
                      <td className="border-t border-[var(--border)] px-3 py-2.5 text-center tabular-nums">
                        {item.year ?? "—"}
                      </td>
                      <td className="border-t border-[var(--border)] px-3 py-2.5 text-right tabular-nums">
                        {item.mileage == null ? "—" : `${fmtNumber(item.mileage)} km`}
                      </td>
                      <td className="border-t border-[var(--border)] px-3 py-2.5">
                        <span className="block">{item.fuelType || "Sin combustible"}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">
                          {[item.transmission, item.color].filter(Boolean).join(" · ") || "Sin especificar"}
                        </span>
                      </td>
                      <td className="max-w-40 truncate border-t border-[var(--border)] px-3 py-2.5" title={item.inventoryLocation ?? undefined}>
                        {item.inventoryLocation || "Sin ubicación"}
                      </td>
                      <td className="border-t border-[var(--border)] px-3 py-2.5 text-right font-semibold tabular-nums">
                        {fmtCLP(item.price)}
                      </td>
                      <td className="border-t border-[var(--border)] px-3 py-2.5">
                        <Pill variant={statusVariant(item.status)}>
                          {STATUS_LABEL[item.status ?? ""] ?? item.status ?? "Sin estado"}
                        </Pill>
                      </td>
                      <td className="border-t border-[var(--border)] px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void openGallery(item)}
                            disabled={galleryLoadingId === item.id}
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 font-medium text-[var(--primary)] hover:border-[var(--primary)] disabled:opacity-60"
                          >
                            {galleryLoadingId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Images className="h-3.5 w-3.5" />
                            )}
                            Fotos
                          </button>
                          {item.recentReport ? (
                            <>
                              <ReportShareAction reportId={item.recentReport.id} plate={item.patent ?? ""} compact />
                              <a
                                href={`/api/crm/reports/${encodeURIComponent(item.recentReport.id)}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Descargar informe histórico reciente"
                                aria-label={`Descargar informe histórico de ${fmtPlate(item.patent)}`}
                                className="inline-flex rounded-md border border-[var(--border)] bg-white p-2 text-[var(--primary)] hover:border-[var(--primary)]"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void requestHistoryReport(item)}
                              disabled={!item.patent || reportLoadingId === item.id}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 py-1.5 font-medium text-[var(--primary)] hover:border-[var(--primary)] disabled:opacity-50"
                            >
                              {reportLoadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileClock className="h-3.5 w-3.5" />}
                              Informe
                            </button>
                          )}
                          {item.patent && <PrepurchaseVisitDialog initialPlate={item.patent} leadId={leadId} compact />}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
          <span>{searching ? "Buscando unidades…" : `${results.length} de ${total} unidades`}</span>
          {total > results.length && <span>Refina la búsqueda para ver más resultados</span>}
        </div>
      </div>

      {gallery && (
        <VehicleGallery
          vehicle={gallery}
          activePhoto={activePhoto}
          onPhotoChange={setActivePhoto}
          onClose={() => setGallery(null)}
        />
      )}
      {testDriveDialog && (
        <TestDriveDialog
          interest={testDriveDialog.interest}
          mode={testDriveDialog.mode}
          saving={updatingVehicleId === testDriveDialog.interest.vehicleId}
          onClose={() => setTestDriveDialog(null)}
          onSubmit={async (payload) => {
            const updated = await updateInterest(testDriveDialog.interest.vehicleId, payload);
            if (!updated) return;
            setTestDriveDialog(null);
            toast.success(
              testDriveDialog.mode === "schedule"
                ? "Test drive agendado y registrado en la bitácora"
                : "Resultado del test drive registrado",
            );
          }}
        />
      )}
    </div>
  );
}

function stockFromInterest(interest: LeadVehicleInterest, results: StockItem[]): StockItem {
  return results.find((item) => item.id === interest.vehicleId) ?? {
    id: interest.vehicleId,
    label: interest.label,
    year: interest.year,
    patent: interest.patent,
    price: interest.price,
    mileage: interest.mileage,
    status: interest.vehicleStatus,
    stockNumber: interest.stockNumber,
    vehicleType: null,
    fuelType: null,
    transmission: null,
    color: null,
    inventoryLocation: interest.inventoryLocation,
    photosStatus: null,
    recentReport: null,
  };
}

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function defaultTestDriveDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(11, 0, 0, 0);
  return localDateTime(date);
}

function TestDriveDialog({
  interest,
  mode,
  saving,
  onClose,
  onSubmit,
}: {
  interest: LeadVehicleInterest;
  mode: "schedule" | "result";
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [scheduledAt, setScheduledAt] = useState(
    interest.testDriveScheduledAt
      ? localDateTime(new Date(interest.testDriveScheduledAt))
      : defaultTestDriveDate(),
  );
  const [notes, setNotes] = useState(interest.testDriveNotes ?? "");

  const submit = async () => {
    if (mode === "schedule") {
      const date = new Date(scheduledAt);
      if (!scheduledAt || Number.isNaN(date.getTime()) || date <= new Date()) {
        toast.error("Selecciona una fecha y hora futuras");
        return;
      }
      await onSubmit({
        testDriveStatus: "scheduled",
        testDriveScheduledAt: date.toISOString(),
        testDriveNotes: notes.trim() || null,
      });
      return;
    }
    if (!notes.trim()) {
      toast.error("Escribe cómo resultó el test drive y qué observó el cliente");
      return;
    }
    await onSubmit({ testDriveStatus: "completed", testDriveNotes: notes.trim() });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={mode === "schedule" ? "Agendar test drive" : "Registrar test drive"} className="w-full max-w-md rounded-t-2xl bg-[var(--card)] p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">
              {mode === "schedule" ? "Agendar test drive" : "Resultado del test drive"}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              {interest.label}{interest.year ? ` ${interest.year}` : ""} · {fmtPlate(interest.patent)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          {mode === "schedule" && (
            <label className="block text-xs font-medium">
              Fecha y hora
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" />
            </label>
          )}
          <label className="block text-xs font-medium">
            {mode === "schedule" ? "Indicaciones u observaciones" : "Resultado y observaciones del cliente"}
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} className="mt-1.5 min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" placeholder={mode === "schedule" ? "Ej.: cliente quiere probarlo en carretera" : "Ej.: le gustó el manejo, pero quiere comparar espacio interior"} />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "schedule" ? "Guardar agenda" : "Guardar resultado"}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function VehicleGallery({
  vehicle,
  activePhoto,
  onPhotoChange,
  onClose,
}: {
  vehicle: VehicleDetail;
  activePhoto: number;
  onPhotoChange: (index: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && vehicle.photos.length) {
        onPhotoChange((activePhoto - 1 + vehicle.photos.length) % vehicle.photos.length);
      }
      if (event.key === "ArrowRight" && vehicle.photos.length) {
        onPhotoChange((activePhoto + 1) % vehicle.photos.length);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activePhoto, onClose, onPhotoChange, vehicle.photos.length]);

  const share = async () => {
    const text = vehicleShareText(vehicle);
    try {
      if (navigator.share) {
        await navigator.share({ title: vehicle.label, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Ficha copiada para compartir");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("No pudimos compartir la ficha");
    }
  };

  const currentPhoto = vehicle.photos[activePhoto];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={`Ficha de ${vehicle.label}`} className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-[var(--card)] shadow-2xl sm:rounded-2xl lg:flex-row">
        <div className="min-h-0 bg-[#081638] lg:w-[62%]">
          <div className="relative flex aspect-[4/3] max-h-[68dvh] items-center justify-center overflow-hidden lg:aspect-auto lg:h-full lg:min-h-[560px]">
            {currentPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentPhoto.url} alt={`${vehicle.label}, foto ${activePhoto + 1}`} className="h-full w-full object-contain" />
            ) : (
              <div className="text-center text-white/60">
                <Images className="mx-auto h-10 w-10" />
                <p className="mt-2 text-sm">Esta unidad todavía no tiene fotos.</p>
              </div>
            )}
            {vehicle.photos.length > 1 && (
              <>
                <button type="button" onClick={() => onPhotoChange((activePhoto - 1 + vehicle.photos.length) % vehicle.photos.length)} aria-label="Foto anterior" className="absolute left-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => onPhotoChange((activePhoto + 1) % vehicle.photos.length)} aria-label="Foto siguiente" className="absolute right-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
            {vehicle.photos.length > 0 && <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white">{activePhoto + 1} / {vehicle.photos.length}</span>}
          </div>
          {vehicle.photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-3">
              {vehicle.photos.map((photo, index) => (
                <button key={photo.id} type="button" onClick={() => onPhotoChange(index)} className={clsx("h-14 w-20 shrink-0 overflow-hidden rounded-md border-2", index === activePhoto ? "border-[var(--fm-lime)]" : "border-transparent opacity-65 hover:opacity-100")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={`Miniatura ${index + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--primary)]">Ficha comercial</p>
              <h3 className="mt-1 text-xl font-semibold">{vehicle.label}{vehicle.year ? ` ${vehicle.year}` : ""}</h3>
              <p className="mt-1 font-mono text-sm text-[var(--muted-foreground)]">{fmtPlate(vehicle.patent)}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar galería" className="rounded-lg border border-[var(--border)] p-2"><X className="h-4 w-4" /></button>
          </div>

          <p className="mt-5 text-2xl font-semibold tabular-nums text-[var(--fm-navy)]">{fmtCLP(vehicle.price)}</p>
          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-[var(--border)] py-5 text-sm">
            <GalleryDatum label="Código de stock" value={vehicle.stockNumber == null ? "—" : `STK-${String(vehicle.stockNumber).padStart(6, "0")}`} />
            <GalleryDatum label="Kilometraje" value={vehicle.mileage == null ? "—" : `${fmtNumber(vehicle.mileage)} km`} />
            <GalleryDatum label="Estado" value={STATUS_LABEL[vehicle.status ?? ""] ?? vehicle.status ?? "—"} />
            <GalleryDatum label="Sucursal" value={vehicle.inventoryLocation || "—"} />
            <GalleryDatum label="Tipo" value={vehicle.vehicleType || "—"} />
            <GalleryDatum label="Combustible" value={vehicle.fuelType || "—"} />
            <GalleryDatum label="Transmisión" value={vehicle.transmission || "—"} />
            <GalleryDatum label="Color" value={vehicle.color || "—"} />
            <GalleryDatum label="Motor" value={vehicle.engine || "—"} />
            <GalleryDatum label="Puertas" value={vehicle.doors == null ? "—" : String(vehicle.doors)} />
            <GalleryDatum label="VIN / Chasis" value={vehicle.vin || "—"} wide />
          </dl>
          {vehicle.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--muted-foreground)]">{vehicle.description}</p>}

          <button type="button" onClick={() => void share()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">
            <Share2 className="h-4 w-4" />
            Compartir ficha completa
          </button>
        </div>
      </div>
    </div>
  );
}

function GalleryDatum({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[11px] text-[var(--muted-foreground)]">{label}</dt>
      <dd className="mt-0.5 break-words font-medium">{value}</dd>
    </div>
  );
}

function vehicleShareText(vehicle: VehicleDetail): string {
  return [
    `${vehicle.label}${vehicle.year ? ` ${vehicle.year}` : ""}`,
    `Código de stock: ${vehicle.stockNumber == null ? "—" : `STK-${String(vehicle.stockNumber).padStart(6, "0")}`}`,
    `Precio: ${fmtCLP(vehicle.price)}`,
    `Patente: ${fmtPlate(vehicle.patent)}`,
    `Kilometraje: ${vehicle.mileage == null ? "—" : `${fmtNumber(vehicle.mileage)} km`}`,
    `Estado: ${STATUS_LABEL[vehicle.status ?? ""] ?? vehicle.status ?? "—"}`,
    `Sucursal: ${vehicle.inventoryLocation || "—"}`,
    `Tipo: ${vehicle.vehicleType || "—"}`,
    `Combustible: ${vehicle.fuelType || "—"}`,
    `Transmisión: ${vehicle.transmission || "—"}`,
    `Color: ${vehicle.color || "—"}`,
    `Motor: ${vehicle.engine || "—"}`,
    `Puertas: ${vehicle.doors ?? "—"}`,
    `VIN / Chasis: ${vehicle.vin || "—"}`,
    vehicle.description ? `Descripción: ${vehicle.description}` : null,
    vehicle.photos.length ? `Fotos:\n${vehicle.photos.map((photo) => photo.url).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function Labelled({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">{hint}</span>}
    </label>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--muted-foreground)]">{label}</dt>
      <dd className={clsx("mt-0.5 text-sm tabular-nums", strong && "font-semibold text-[var(--primary)]")}>
        {value}
      </dd>
    </div>
  );
}
