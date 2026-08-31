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
import { Car, Check, Loader2, Pencil, Search, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import { fmtCLP, fmtPlate } from "@/lib/format";
import type { Lead } from "@/lib/leads";
import { CurrencyInput } from "@/components/ui/currency-input";

type StockItem = {
  id: string;
  label: string;
  year: number | null;
  patent: string | null;
  price: number | null;
  status: string | null;
};

export function QuoteCard({ lead, canWrite }: { lead: Lead; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
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
    return (
      <div className="p-4">
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
              {lead.vehicleId ? "Cotizar" : "Elegir unidad"}
            </button>
          )}
        </div>

        {(lead.quotedPrice !== null || lead.quotedDownPayment !== null || lead.tradeInAmount !== null) && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3 sm:grid-cols-4">
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
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4 p-4">
      <StockPicker
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
          setVehicle(item);
          // El precio de lista de la unidad recién elegida es el punto de partida natural.
          if (item?.price != null && (price === null || price === 0)) setPrice(item.price);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Labelled label="Precio conversado" hint={discount > 0 ? `${fmtCLP(discount)} bajo lista` : undefined}>
          <CurrencyInput value={price} onChange={setPrice} placeholder="0" />
        </Labelled>
        <Labelled label="Pie">
          <CurrencyInput value={down} onChange={setDown} placeholder="0" />
        </Labelled>
        <Labelled label="Parte de pago" hint="Auto que entrega">
          <CurrencyInput value={tradeIn} onChange={setTradeIn} placeholder="0" />
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
          disabled={saving || pending}
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

/**
 * Buscador del stock. Busca por patente, marca o modelo — que es como el agente identifica un
 * auto en el patio— contra el mismo endpoint que usa la pantalla de vehículos.
 */
function StockPicker({
  currentId,
  currentLabel,
  onPick,
}: {
  currentId: string | null;
  currentLabel: string | null;
  onPick: (item: StockItem | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const res = await crmFetch(`/api/crm/vehicles?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: StockItem[] };
      setResults(data.items ?? []);
      setOpen(true);
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos buscar las unidades");
      if (message) toast.error(message);
    } finally {
      setSearching(false);
    }
  }, []);

  // El rebote vive en el handler y no en un efecto: así el tecleo no encadena renders y la
  // lista se limpia en el mismo gesto en que el agente borra lo que escribió.
  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const needle = value.trim();
    if (needle.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => void search(needle), 300);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div>
      <label htmlFor="stock-search" className="mb-1.5 block text-xs font-medium">
        Unidad cotizada
      </label>

      {currentId && currentLabel ? (
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2.5">
          <Tag className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          <span className="min-w-0 flex-1 truncate text-sm">{currentLabel}</span>
          <button
            onClick={() => onPick(null)}
            aria-label="Quitar unidad"
            className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            id="stock-search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Patente, marca o modelo…"
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] py-2.5 pl-9 pr-9 text-sm outline-none focus:border-[var(--primary)]"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--muted-foreground)]" />
          )}

          {open && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_28px_rgba(7,29,86,0.12)]">
              {results.length === 0 ? (
                <li className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                  Sin unidades que coincidan con “{query}”.
                </li>
              ) : (
                results.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onPick(item);
                        setQuery("");
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--muted)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm">
                          {item.label}
                          {item.year ? ` ${item.year}` : ""}
                        </span>
                        <span className="block text-[11px] text-[var(--muted-foreground)]">
                          {item.patent ? fmtPlate(item.patent) : "Sin patente"}
                          {item.status ? ` · ${item.status.toLowerCase()}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-medium tabular-nums">
                        {fmtCLP(item.price)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
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
