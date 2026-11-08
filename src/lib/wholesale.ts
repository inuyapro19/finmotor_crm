/**
 * Marketplace mayorista — tipos y vocabulario compartidos por el portal del proveedor
 * (`/proveedor`) y el marketplace de la automotora (`/mayorista`).
 *
 * Módulo PURO (sin `next/headers`): lo importan server y client components por igual.
 * Las reglas reales (quién responde, qué se puede publicar) viven en el backend
 * (`app/modules/wholesale/domain/rules.py`); aquí sólo se reflejan en la interfaz.
 */

export type ListingStatus = "draft" | "published" | "reserved" | "sold" | "withdrawn";
export type DealStatus = "negotiating" | "agreed" | "completed" | "rejected" | "cancelled" | "lost";
export type Side = "dealership" | "supplier";
export type ReportTier = "standard" | "premium";

/** Informe histórico pagable con MercadoPago (precios del catálogo público del backend). */
export type ReportProduct = { reportType: ReportTier; code: string; name: string; description: string; priceClp: number };

/** Equipo y sucursales del proveedor (`/wholesale/supplier/team`, `/locations`). */
export type SupplierRole = "owner" | "admin" | "manager" | "salesperson" | "viewer";
export type SupplierMember = {
  id: string;
  userId: string;
  role: SupplierRole;
  status: string;
  locationId: string | null;
  locationName: string | null;
  email: string;
  name: string;
  phone: string | null;
  listingCount: number;
  createdAt: string | null;
};
export type SupplierLocation = {
  id: string;
  name: string;
  address: string | null;
  commune: string | null;
  isMain: boolean;
  isActive: boolean;
  memberCount: number;
  listingCount: number;
};
export type SupplierTeam = {
  members: SupplierMember[];
  locations: SupplierLocation[];
  myRole: SupplierRole;
  canManage: boolean;
  canGrantAdmin: boolean;
};

/** Roles del equipo del proveedor. Todos menos "Solo lectura" publican y negocian. */
export const SUPPLIER_ROLES: [SupplierRole, string, string][] = [
  ["owner", "Dueño", "Todo, incluido retirar personas del equipo"],
  ["admin", "Administrador", "Todo, incluido retirar personas del equipo"],
  ["manager", "Supervisor", "Publica, negocia y administra equipo y sucursales"],
  ["salesperson", "Vendedor", "Publica unidades y negocia con automotoras"],
  ["viewer", "Solo lectura", "Ve las unidades y negociaciones, sin cambiar nada"],
];
export const SUPPLIER_ROLE_LABEL = Object.fromEntries(SUPPLIER_ROLES.map(([v, l]) => [v, l])) as Record<SupplierRole, string>;

export const REPORT_TIER_LABEL: Record<ReportTier, string> = { standard: "Estándar", premium: "Premium" };

export type WholesaleListing = {
  myParticipation?: { highestAmount: number; bidCount: number } | null;
  auction?: {
    id: string;
    status: "open" | "awarded" | "completed" | "no_bids" | "cancelled";
    startingPrice: number;
    minIncrement: number;
    startsAt: string;
    endsAt: string;
    serverTime: string;
    highestAmount: number | null;
    nextMinimum: number;
    bidCount: number;
    isLeading: boolean;
  } | null;
  id: string;
  code: string;
  supplierOrgId: string;
  supplierName: string | null;
  status: ListingStatus;
  plate: string;
  brand: string;
  model: string;
  versionName: string | null;
  year: number;
  mileage: number | null;
  fuelType: string | null;
  transmission: string | null;
  vehicleType: string | null;
  color: string | null;
  vin: string | null;
  engineNumber: string | null;
  doors: number | null;
  askingPrice: number | null;
  description: string | null;
  locationCommune: string | null;
  locationRegion: string | null;
  locationId: string | null;
  locationName: string | null;
  photoCount: number;
  coverUrl: string | null;
  report: {
    kind: "attached" | "purchased" | null;
    state: "available" | "processing" | "pending_payment" | "failed" | null;
    tier: ReportTier | null;
    filename: string | null;
  };
  publishedAt: string | null;
  soldAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  photos?: { id: string; position: number; url: string | null }[];
  missingToPublish?: string[];
  openDeals?: number;
  awaitingSupplier?: number;
  myDeal?: { id: string; status: DealStatus; awaitingMe: boolean } | null;
};

export type DealEvent = {
  event: "offer" | "counter" | "accepted" | "rejected" | "cancelled" | "supplier_confirmed" | "dealership_confirmed" | "completed" | "lost";
  side: Side | "system";
  amount: number | null;
  message: string | null;
  actorName: string | null;
  createdAt: string;
};

export type WholesaleDeal = {
  auctionId?: string | null;
  id: string;
  listingId: string;
  dealershipOrgId: string;
  dealershipName: string | null;
  status: DealStatus;
  pendingAmount: number | null;
  pendingFrom: Side | null;
  awaitingMe: boolean;
  agreedAmount: number | null;
  agreedAt: string | null;
  supplierConfirmedAt: string | null;
  dealershipConfirmedAt: string | null;
  retailPrice: number | null;
  vehicleId: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  events?: DealEvent[];
  /** Sólo en los listados (tabla comercial). */
  offerCount?: number;
  firstOfferAmount?: number | null;
  lastEventAt?: string | null;
  listing?: {
    code: string;
    brand: string;
    model: string;
    versionName: string | null;
    year: number;
    plate: string;
    askingPrice: number | null;
    status: ListingStatus;
    supplierName: string | null;
    supplierSlug?: string | null;
    locationName?: string | null;
    coverUrl: string | null;
  };
};

export const LISTING_STATUS: Record<ListingStatus, { label: string; variant: "neutral" | "success" | "warn" | "danger" | "info" }> = {
  draft: { label: "Borrador", variant: "neutral" },
  published: { label: "Publicado", variant: "success" },
  reserved: { label: "Reservado", variant: "warn" },
  sold: { label: "Vendido", variant: "info" },
  withdrawn: { label: "Retirado", variant: "neutral" },
};

export const DEAL_STATUS: Record<DealStatus, { label: string; variant: "neutral" | "success" | "warn" | "danger" | "info" }> = {
  negotiating: { label: "En negociación", variant: "info" },
  agreed: { label: "Trato cerrado · transferencia pendiente", variant: "warn" },
  completed: { label: "Completado", variant: "success" },
  rejected: { label: "Rechazada", variant: "danger" },
  cancelled: { label: "Cancelada", variant: "neutral" },
  lost: { label: "Vendido a otra automotora", variant: "neutral" },
};

export const FUELS = ["Bencina", "Diesel", "Electrico", "Hibrido", "GLP"];
export const TRANSMISSIONS = ["Manual", "Automatico"];
export const VEHICLE_TYPES: [string, string][] = [
  ["car", "Auto"], ["suv", "SUV"], ["camioneta", "Camioneta"], ["pickup", "Pickup"],
  ["van", "Furgón"], ["moto", "Moto"], ["camion", "Camión"], ["bus", "Bus"], ["otro", "Otro"],
];

export const MISSING_LABEL: Record<string, string> = {
  photos: "al menos una foto",
  history_report: "el informe histórico (adjúntalo o cómpralo)",
};

/** Normaliza combustible/transmisión de la consulta por patente al vocabulario del formulario. */
export function normalizeFuel(value: string | null | undefined): string {
  const v = (value || "").toLowerCase();
  if (v.includes("gasol") || v.includes("benc")) return "Bencina";
  if (v.includes("dies") || v.includes("diés")) return "Diesel";
  if (v.includes("elect")) return "Electrico";
  if (v.includes("hibr") || v.includes("híbr")) return "Hibrido";
  if (v.includes("glp")) return "GLP";
  return FUELS.includes(value || "") ? (value as string) : "";
}

export function normalizeTransmission(value: string | null | undefined): string {
  const v = (value || "").toLowerCase();
  if (v.includes("auto")) return "Automatico";
  if (v.includes("manual") || v.includes("mecan")) return "Manual";
  return "";
}

/** Identificador corto del proveedor para su enlace (/mayorista?proveedor=<slug>). Igual que el backend. */
export function supplierSlug(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function vehicleTitle(v: { brand: string; model: string; versionName?: string | null; year: number }): string {
  return [v.brand, v.model, v.versionName, v.year].filter(Boolean).join(" ");
}

/** Texto para un evento del hilo, desde el punto de vista de quien mira. */
export function eventLabel(event: DealEvent, viewer: Side): string {
  const mine = event.side === viewer;
  const who = event.side === "system" ? "Finmotor" : mine ? "Tú" : event.side === "supplier" ? "Proveedor" : "Automotora";
  switch (event.event) {
    case "offer": return `${who}: oferta`;
    case "counter": return `${who}: contraoferta`;
    case "accepted": return `${who}: aceptó`;
    case "rejected": return `${who}: rechazó`;
    case "cancelled": return `${who}: canceló`;
    case "supplier_confirmed": return `${who}: confirmó pago y transferencia`;
    case "dealership_confirmed": return `${who}: confirmó la recepción`;
    case "completed": return "Trato completado · unidad en el stock de la automotora";
    case "lost": return "La unidad se vendió a otra automotora";
  }
}

const ERRORS: Record<string, string> = {
  listing_not_found: "La unidad no existe o ya no está disponible.",
  listing_out_of_scope: "Esta unidad no pertenece a tu cuenta.",
  listing_locked: "La unidad está reservada o vendida: ya no se puede editar.",
  listing_not_publishable: "Esta unidad no se puede publicar en su estado actual.",
  listing_not_withdrawable: "Sólo se retira una unidad publicada.",
  listing_not_deletable: "Sólo se elimina un borrador sin negociaciones. Retírala en su lugar.",
  listing_photos_required: "Agrega al menos una foto antes de publicar.",
  listing_history_report_required: "Adjunta o compra el informe histórico antes de publicar.",
  listing_version_conflict: "Alguien más editó esta unidad. Recarga la página.",
  listing_not_available: "La unidad ya no está disponible: otra automotora la reservó o el proveedor la retiró.",
  plate_already_listed: "Ya tienes otra unidad activa con esta patente.",
  plate_locked_by_report: "La patente no se puede cambiar porque el informe histórico es de la patente original.",
  invalid_plate: "La patente no es válida.",
  supplier_read_only: "Tu cuenta del proveedor es de sólo lectura.",
  supplier_required: "Tu cuenta no está asociada a un proveedor.",
  forbidden_upload_key: "El archivo no corresponde a una subida tuya.",
  upload_not_found: "No encontramos el archivo subido. Intenta de nuevo.",
  storage_unavailable: "El almacenamiento no respondió. Intenta en unos minutos.",
  too_many_photos: "Alcanzaste el máximo de 20 fotos.",
  photo_not_found: "La foto ya no existe.",
  report_must_be_pdf: "El informe debe ser un PDF.",
  supplier_admin_required: "Sólo un dueño, administrador o supervisor del proveedor puede administrar el equipo.",
  supplier_owner_required: "Sólo el dueño o un administrador puede retirar personas del equipo.",
  cannot_grant_admin_role: "Sólo el dueño o un administrador puede asignar o quitar ese rol.",
  member_already_exists: "Esa persona ya es parte del equipo.",
  member_not_found: "Esa persona ya no está en el equipo.",
  last_owner: "El proveedor debe tener al menos un dueño.",
  cannot_remove_self: "No puedes retirarte a ti mismo del equipo.",
  invalid_report_type: "Elige el informe Estándar o Premium.",
  report_provider_unavailable: "El servicio de informes no está disponible en este momento. Intenta en unos minutos.",
  provider_unavailable: "MercadoPago no está disponible en este momento. Intenta en unos minutos.",
  order_not_payable: "Este pago ya se está procesando. Recarga la página en unos segundos.",
  vehicle_not_found: "No encontramos datos registrales para esta patente.",
  simplecar_patentes_no_credits: "La consulta por patente está temporalmente sin saldo. Completa los datos a mano.",
  report_pricing_not_configured: "Tu tarifa de informes aún no está configurada. Escríbenos y la activamos.",
  report_already_purchased: "Ya compraste el informe de esta unidad.",
  report_processing: "El informe se está generando. Vuelve en unos minutos.",
  report_not_available: "Esta unidad no tiene informe disponible.",
  deal_not_found: "La negociación no existe.",
  deal_out_of_scope: "Esta negociación no es de tu automotora.",
  deal_not_negotiable: "Esta negociación ya no admite ofertas.",
  deal_version_conflict: "La negociación cambió mientras respondías. Recarga la página.",
  deal_not_cancellable: "Esta negociación ya terminó.",
  deal_not_agreed: "Primero debe haber un trato aceptado.",
  deal_already_confirmed: "Ya confirmaste este paso.",
  awaiting_other_party: "Tu oferta está vigente: espera la respuesta de la otra parte.",
  no_pending_offer: "No hay una oferta vigente que responder.",
  counter_equals_offer: "La contraoferta es igual a la oferta: acéptala en su lugar.",
  invalid_amount: "El monto no es válido.",
  amount_required: "Indica un monto.",
  invalid_location: "La sucursal elegida no es válida.",
  patent_already_in_stock: "Ya tienes una unidad activa con esta patente en tu stock.",
  wholesale_buyer_role_required: "Sólo un administrador o supervisor de la automotora puede ofertar y cerrar compras mayoristas.",
  dealership_required: "Necesitas pertenecer a una automotora para ofertar.",
  auction_terms_required: "Define la fecha de cierre y el incremento mínimo antes de publicar.",
  invalid_auction_end: "El cierre debe ser futuro y dentro de los próximos 30 días.",
  auction_already_exists: "Esta unidad ya tiene una subasta. Crea una nueva ficha para una nueva convocatoria.",
  legacy_deals_require_resolution: "Esta ficha tiene negociaciones anteriores. Conserva su historial y crea una nueva ficha cuando la unidad esté liberada.",
  auction_required: "Esta unidad todavía no tiene una subasta configurada.",
  use_auction_bids: "El marketplace ahora funciona con pujas. Recarga la ficha de la subasta.",
  auction_closed: "La subasta ya cerró y no admite nuevas pujas.",
  auction_not_started: "La subasta todavía no comenzó.",
  auction_has_bids: "Una subasta con pujas no se puede retirar antes del cierre.",
  bid_too_low: "Otra puja cambió el mínimo o el monto es insuficiente. Revisa el mínimo actualizado.",
  bid_request_conflict: "Este intento ya se usó con otro monto. Recarga y envía una nueva puja.",
  bid_integer_required: "La puja debe ser un monto entero en pesos chilenos.",
  self_bid_forbidden: "Los miembros del proveedor no pueden pujar por sus propias unidades.",
  auction_negotiation_forbidden: "La subasta se adjudica automáticamente al cierre, sin contraofertas.",
  auction_cancellation_supplier_required: "La cancelación de una adjudicación la debe gestionar el proveedor.",
  auction_cancel_reason_required: "Indica el motivo para cancelar la adjudicación.",
  auction_delivery_already_confirmed: "Ya hay una confirmación de entrega. La adjudicación requiere revisión operativa.",
};

export function wholesaleError(detail: unknown, fallback = "No pudimos completar la operación."): string {
  if (typeof detail === "string" && ERRORS[detail]) return ERRORS[detail];
  return fallback;
}

/** Orden y filtros del marketplace mayorista (/mayorista). Viven aquí para que los use el servidor. */
export const MARKET_SORTS: [string, string][] = [
  ["recent", "Más recientes"],
  ["price_asc", "Precio: menor a mayor"],
  ["price_desc", "Precio: mayor a menor"],
  ["year_desc", "Año: más nuevo"],
  ["mileage_asc", "Km: menor a mayor"],
];

// Parámetros que controla el drawer de filtros (el resto — q, sort, view — se conserva al aplicar).
export const FILTER_KEYS = [
  "brand", "vehicleType", "fuelType", "transmission", "minPrice", "maxPrice",
  "minYear", "maxYear", "maxMileage", "region",
] as const;
