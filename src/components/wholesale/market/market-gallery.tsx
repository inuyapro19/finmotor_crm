"use client";

/**
 * Galería de la ficha mayorista: COPIA de `VehicleGallery` de frontend-web
 * (`frontend-web/src/components/vehicles/vehicle-gallery.tsx`), mismo markup y comportamiento
 * (miniaturas, flechas, teclado ←/→, precarga de vecinas). Usa <img> porque las fotos del
 * mayorista son URLs firmadas del bucket privado (no pasan por el optimizador de next/image).
 */
import { useCallback, useEffect, useState } from "react";
import { Car, ChevronLeft, ChevronRight, FileCheck2 } from "lucide-react";

type Photo = { id?: string | number; url: string | null };

type Props = {
  photos: Photo[];
  alt: string;
  year: number | string;
  /** Badge superior (en la web: "Vehículo verificado"; aquí: el informe histórico). */
  badge?: string | null;
};

export function MarketGallery({ photos: rawPhotos, alt, year, badge }: Props) {
  const photos = rawPhotos.filter((p): p is { id?: string | number; url: string } => Boolean(p.url));
  const [active, setActive] = useState(0);
  const total = photos.length;

  const withNeighbors = useCallback(
    (prev: Set<number>, i: number) => {
      const next = new Set(prev);
      next.add(i);
      if (total > 1) {
        next.add((i + 1) % total);
        next.add((i - 1 + total) % total);
      }
      return next;
    },
    [total],
  );
  const [mounted, setMounted] = useState<Set<number>>(() => withNeighbors(new Set(), 0));

  const select = useCallback(
    (i: number) => {
      setActive(i);
      setMounted((prev) => withNeighbors(prev, i));
    },
    [withNeighbors],
  );

  const go = useCallback(
    (dir: 1 | -1) => {
      if (total) select((active + dir + total) % total);
    },
    [active, select, total],
  );

  useEffect(() => {
    if (total <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, total]);

  const current = photos[active];

  return (
    <div>
      {/* Foto principal */}
      <div className="group relative overflow-hidden rounded-2xl" style={{ background: "var(--fm-teal-600)", height: "clamp(220px, 50vw, 460px)" }}>
        {current?.url ? (
          photos.map((photo, i) =>
            mounted.has(i) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id ?? i}
                src={photo.url}
                alt={i === active ? `${alt} — foto ${i + 1}` : ""}
                aria-hidden={i !== active}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${i === active ? "opacity-100" : "opacity-0"}`}
              />
            ) : null,
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2.5 text-center">
            <Car className="h-12 w-12" style={{ color: "rgba(255,255,255,0.55)" }} />
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>Fotos en preparación</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>El proveedor aún no sube fotos de esta unidad</p>
          </div>
        )}

        {/* Badges superiores */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          {badge && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.95)", color: "var(--fm-green-700)" }}>
              <FileCheck2 className="h-3 w-3" /> {badge}
            </span>
          )}
          <span className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", color: "#fff" }}>
            {year}
          </span>
        </div>

        {/* Flechas de navegación */}
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              style={{ background: "rgba(255,255,255,0.92)", color: "var(--fm-teal-600)" }}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Foto siguiente"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              style={{ background: "rgba(255,255,255,0.92)", color: "var(--fm-teal-600)" }}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Contador */}
        {total > 0 && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", color: "#fff" }}>
            {active + 1} / {total}
          </div>
        )}
      </div>

      {/* Miniaturas */}
      {total > 1 && (
        <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8">
          {photos.map((photo, i) => {
            const isActive = i === active;
            return (
              <button key={photo.id ?? i} type="button" onClick={() => select(i)} aria-label={`Ver foto ${i + 1}`} aria-current={isActive}
                className="relative overflow-hidden rounded-lg transition-all"
                style={{
                  height: "clamp(48px, 8vw, 64px)",
                  background: "var(--fm-teal-600)",
                  outline: isActive ? "2px solid var(--fm-teal-600)" : "none",
                  outlineOffset: 2,
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Foto ${i + 1}`} loading="lazy"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity ${isActive ? "opacity-100" : "opacity-70 hover:opacity-100"}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
