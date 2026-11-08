"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, ImagePlus, Star, X } from "lucide-react";
import { toast } from "sonner";

import { PHOTO_ACCEPT, PHOTO_MAX, isValidPhoto, sortFilesByName } from "@/lib/photos/upload";

/** Foto ya guardada en el vehículo o archivo nuevo por subir. El orden de la lista es el orden final. */
export type PhotoItem =
  | { key: string; kind: "saved"; id: string; url: string }
  | { key: string; kind: "new"; file: File };

let newKeySeq = 0;

/**
 * Fotos del vehículo en UNA sola lista ordenada (guardadas + nuevas). La primera es la portada.
 * Se ordena arrastrando o con las flechas (útiles en el teléfono); la estrella lleva una foto al
 * primer lugar. Quitar una foto guardada se aplica al guardar la unidad.
 */
export function VehiclePhotoUpload({
  items,
  onChange,
}: {
  items: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const newFiles = useMemo(
    () => items.filter((item): item is Extract<PhotoItem, { kind: "new" }> => item.kind === "new"),
    [items],
  );
  const previews = useMemo(
    () => new Map(newFiles.map((item) => [item.key, URL.createObjectURL(item.file)])),
    [newFiles],
  );
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const addFiles = (incoming: FileList | File[]) => {
    const remaining = PHOTO_MAX - items.length;
    if (remaining <= 0) {
      toast.error(`Puedes guardar hasta ${PHOTO_MAX} fotos por vehículo`);
      return;
    }
    const valid: File[] = [];
    // Orden por nombre de archivo: respeta la secuencia de la cámara aunque el navegador las
    // entregue en otro orden. Después se reordenan a mano si hace falta.
    for (const file of sortFilesByName(Array.from(incoming)).slice(0, remaining)) {
      const error = isValidPhoto(file);
      if (error) toast.error(`${file.name}: ${error}`);
      else valid.push(file);
    }
    if (!valid.length) return;
    onChange([...items, ...valid.map((file) => ({ key: `new-${(newKeySeq += 1)}`, kind: "new" as const, file }))]);
  };

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const remove = (index: number) => onChange(items.filter((_, current) => current !== index));

  const src = (item: PhotoItem) => (item.kind === "saved" ? item.url : previews.get(item.key) ?? "");

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDraggingFiles(true);
        }}
        onDragLeave={() => setDraggingFiles(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDraggingFiles(false);
          if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-[var(--radius)] border-2 border-dashed px-5 py-8 text-center transition-colors ${draggingFiles ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--muted)]/30 hover:border-[var(--primary)]/60"}`}
      >
        <ImagePlus className="mx-auto h-7 w-7 text-[var(--muted-foreground)]" />
        <p className="mt-2 text-sm font-medium">Arrastra fotos o selecciónalas desde tu equipo</p>
        <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">JPG, PNG o WebP · Máximo 5MB · Hasta {PHOTO_MAX} fotos</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
        <span>{items.length} de {PHOTO_MAX} fotos</span>
        {items.length > 1 && <span>Arrastra las fotos o usa las flechas para ordenarlas. La primera es la portada.</span>}
      </div>

      {items.length > 0 && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => {
            const isCover = index === 0;
            return (
              <li
                key={item.key}
                draggable
                onDragStart={(event) => {
                  setDragKey(item.key);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item.key);
                }}
                onDragOver={(event) => {
                  if (!dragKey) return;
                  event.preventDefault();
                  setOverKey(item.key);
                }}
                onDrop={(event) => {
                  if (!dragKey) return;
                  event.preventDefault();
                  move(items.findIndex((current) => current.key === dragKey), index);
                  setDragKey(null);
                  setOverKey(null);
                }}
                onDragEnd={() => {
                  setDragKey(null);
                  setOverKey(null);
                }}
                className={`group relative aspect-[4/3] cursor-grab overflow-hidden rounded-[var(--radius-md)] border-2 bg-[var(--muted)] active:cursor-grabbing ${isCover ? "border-[var(--primary)]" : "border-[var(--border)]"} ${overKey === item.key && dragKey !== item.key ? "ring-2 ring-[var(--primary)] ring-offset-2" : ""} ${dragKey === item.key ? "opacity-40" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src(item)} alt={`Foto ${index + 1}`} draggable={false} className="h-full w-full object-cover" />
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1">
                  <span className="grid h-5 min-w-5 place-items-center rounded bg-black/65 px-1 text-[10px] font-semibold text-white">{index + 1}</span>
                  {isCover && <span className="rounded bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-medium text-white">Portada</span>}
                </span>
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] text-white">
                  {item.kind === "saved" ? "Guardada" : "Nueva"}
                </span>
                <GripVertical className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" aria-hidden />

                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0} title="Mover a la izquierda" aria-label="Mover a la izquierda"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--fm-navy)] disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {!isCover && (
                    <button type="button" onClick={() => move(index, 0)} title="Usar como portada" aria-label="Usar como portada"
                      className="grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--fm-navy)]">
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => move(index, index + 1)} disabled={index === items.length - 1} title="Mover a la derecha" aria-label="Mover a la derecha"
                    className="grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--fm-navy)] disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(index)} title="Quitar foto" aria-label="Quitar foto"
                    className="grid h-7 w-7 place-items-center rounded-full bg-red-600 text-white">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
