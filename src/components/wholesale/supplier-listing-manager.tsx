"use client";

/**
 * Lo que convierte un borrador en una unidad publicable para automotoras: fotos, informe
 * histórico (adjunto o comprado) y el botón de publicar/retirar. Todo vive en el bucket
 * privado; las automotoras lo ven con URLs firmadas de corta vida.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, ImagePlus, Loader2, X } from "lucide-react";

import { Notice, Panel, Pill } from "@/components/ui/primitives";
import { PHOTO_ACCEPT, isValidPhoto } from "@/lib/photos/upload";
import { MISSING_LABEL, REPORT_TIER_LABEL, type ReportProduct, type WholesaleListing } from "@/lib/wholesale";
import { ReportPaymentReturn, ReportPurchase } from "@/components/wholesale/report-purchase";
import { uploadPrivate, wholesaleRequest } from "@/lib/wholesale-upload";
import { AuctionSummary } from "@/components/wholesale/auction-panel";
import { CurrencyInput } from "@/components/ui/currency-input";
import { fieldInputClass } from "@/components/ui/form-dialog";

const MAX_PDF_MB = 15;

export function SupplierListingManager({
  listing,
  canWrite,
  reportProducts,
}: {
  listing: WholesaleListing;
  canWrite: boolean;
  reportProducts: ReportProduct[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState("");
  const [increment, setIncrement] = useState<number | null>(100000);
  const photoInput = useRef<HTMLInputElement>(null);
  const reportInput = useRef<HTMLInputElement>(null);
  const editable = canWrite && ["draft", "withdrawn"].includes(listing.status) && !listing.auction;
  const canPublish = !listing.auction && ["draft", "withdrawn", "published"].includes(listing.status);
  const base = `/api/proveedor/listings/${listing.id}`;

  const act = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos completar la operación.");
    } finally {
      setBusy(null);
    }
  };

  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const invalid = list.map(isValidPhoto).find(Boolean);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    void act("photos", async () => {
      for (const file of list) {
        const key = await uploadPrivate(file, { image: true });
        await wholesaleRequest(`${base}/photos`, "POST", { storageKey: key });
      }
    }, list.length > 1 ? `${list.length} fotos agregadas.` : "Foto agregada.");
  };

  const attachReport = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("El informe debe ser un PDF.");
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      toast.error(`El PDF supera ${MAX_PDF_MB} MB.`);
      return;
    }
    void act("report", async () => {
      const key = await uploadPrivate(file, { image: false });
      await wholesaleRequest(`${base}/report`, "POST", { storageKey: key, filename: file.name });
    }, "Informe adjuntado.");
  };

  const openReport = () => act("download", async () => {
    const data = await wholesaleRequest<{ downloadUrl: string }>(`${base}/report/download`, "GET");
    window.open(data.downloadUrl, "_blank", "noopener");
  });

  const photos = listing.photos ?? [];
  const report = listing.report;
  const missing = listing.missingToPublish ?? [];

  return (
    <div className="space-y-4">
      <Panel
        title="Fotos"
        subtitle={`${photos.length} de 20 · la primera es la portada`}
        action={editable && (
          <button onClick={() => photoInput.current?.click()} disabled={!!busy}
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs font-medium disabled:opacity-60">
            {busy === "photos" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Agregar fotos
          </button>
        )}
      >
        <input ref={photoInput} type="file" accept={PHOTO_ACCEPT} multiple hidden
          onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className="group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]">
              {photo.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
              )}
              {index === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-medium text-white">Portada</span>}
              {editable && (
                <button
                  onClick={() => act("photo-" + photo.id, () => wholesaleRequest(`${base}/photos/${photo.id}`, "DELETE"), "Foto eliminada.")}
                  disabled={!!busy}
                  title="Quitar foto"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-red-600 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {!photos.length && <p className="col-span-full py-6 text-center text-sm text-[var(--muted-foreground)]">Todavía no hay fotos.</p>}
        </div>
      </Panel>

      <ReportPaymentReturn listingId={listing.id} />
      <Panel title="Informe histórico" subtitle="Obligatorio para publicar: la automotora lo revisa antes de ofertar.">
        <div className="space-y-3 p-4">
          {report.kind ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span>
                {report.kind === "attached"
                  ? report.filename || "Informe adjunto"
                  : `Informe ${REPORT_TIER_LABEL[report.tier ?? "standard"]} de Finmotor`}
              </span>
              {report.state === "available" && <Pill variant="success">Disponible</Pill>}
              {report.state === "processing" && <Pill variant="warn">Generándose</Pill>}
              {report.state === "pending_payment" && <Pill variant="warn">Pago pendiente</Pill>}
              {report.state === "failed" && <Pill variant="danger">No se pudo generar</Pill>}
              {report.state === "available" && (
                <button onClick={openReport} disabled={!!busy} className="text-xs underline">Ver informe</button>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">Sin informe. Cómpralo por la patente o adjunta el tuyo en PDF.</p>
          )}
          {editable && !(report.kind === "purchased" && (report.state === "available" || report.state === "processing")) && (
            <ReportPurchase listing={listing} products={reportProducts} disabled={!!busy} />
          )}
          {editable && (
            <div className="flex flex-wrap items-center gap-2">
              {report.kind !== "purchased" && <span className="text-xs text-[var(--muted-foreground)]">¿Ya tienes el informe?</span>}
              <input ref={reportInput} type="file" accept="application/pdf,.pdf" hidden
                onChange={(e) => { attachReport(e.target.files?.[0]); e.target.value = ""; }} />
              <button onClick={() => reportInput.current?.click()} disabled={!!busy}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-60">
                {busy === "report" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {report.kind === "attached" ? "Reemplazar PDF" : "Adjuntar PDF"}
              </button>
            </div>
          )}
        </div>
      </Panel>

      {canWrite && (
        <Panel title="Subasta">
          <div className="space-y-3 p-4">
            <AuctionSummary listing={listing} />
            {canPublish && <div className="space-y-2">
              <label className="block text-sm">Fecha y hora de cierre (tu hora local)
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldInputClass} />
              </label>
              <label className="block text-sm">Incremento mínimo de puja (CLP)
                <CurrencyInput value={increment} onChange={setIncrement} />
              </label>
              <p className="text-xs">El precio pedido de la ficha será el precio base. La subasta comienza al publicarla y puede durar hasta 30 días. Las condiciones quedan fijas.</p>
            </div>}
            {(listing.status === "draft" || listing.status === "withdrawn") && missing.length > 0 && (
              <Notice tone="warn">Para publicar falta {missing.map((m) => MISSING_LABEL[m] ?? m).join(" y ")}.</Notice>
            )}
            {listing.status === "reserved" && (
              <Notice>Una automotora aceptó el trato. La unidad no se puede editar mientras se completa la transferencia.</Notice>
            )}
            {listing.status === "sold" && <Notice>Vendida. La unidad ya está en el stock de la automotora.</Notice>}
            <div className="flex flex-wrap gap-2">
              {canPublish && (
                <button
                  onClick={() => act("publish", () => wholesaleRequest(`${base}/publish`, "POST", {
                    endsAt: new Date(endsAt).toISOString(), minIncrement: increment,
                  }), "Subasta abierta. Las automotoras ya pueden pujar.")}
                  disabled={!!busy || missing.length > 0 || !endsAt || !increment}
                  className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {busy === "publish" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Abrir subasta para automotoras
                </button>
              )}
              {listing.status === "published" && (!listing.auction || (listing.auction.status === "open" && listing.auction.bidCount === 0)) && (
                <button
                  onClick={() => act("withdraw", () => wholesaleRequest(`${base}/withdraw`, "POST"), "Unidad retirada del marketplace.")}
                  disabled={!!busy}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
                >
                  Retirar del marketplace
                </button>
              )}
              {listing.status === "draft" && (
                <button
                  onClick={() => act("delete", async () => {
                    await wholesaleRequest(base, "DELETE");
                    router.push("/proveedor");
                  }, "Borrador eliminado.")}
                  disabled={!!busy}
                  className="rounded-[var(--radius-md)] px-4 py-2 text-sm text-red-700 underline disabled:opacity-60"
                >
                  Eliminar borrador
                </button>
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
