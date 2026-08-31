"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Star, X } from "lucide-react";
import { toast } from "sonner";

import { PHOTO_ACCEPT, PHOTO_MAX, isValidPhoto } from "@/lib/photos/upload";


export function VehiclePhotoUpload({
  files,
  primaryIndex,
  existingUrls = [],
  onChange,
}: {
  files: File[];
  primaryIndex: number;
  existingUrls?: string[];
  onChange: (files: File[], primaryIndex: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const addFiles = (incoming: FileList | File[]) => {
    const remaining = PHOTO_MAX - existingUrls.length - files.length;
    if (remaining <= 0) {
      toast.error(`Puedes guardar hasta ${PHOTO_MAX} fotos por vehículo`);
      return;
    }
    const valid: File[] = [];
    for (const file of Array.from(incoming).slice(0, remaining)) {
      const error = isValidPhoto(file);
      if (error) toast.error(`${file.name}: ${error}`);
      else valid.push(file);
    }
    if (!valid.length) return;
    onChange([...files, ...valid], files.length === 0 ? 0 : primaryIndex);
  };

  const remove = (index: number) => {
    const next = files.filter((_, current) => current !== index);
    const nextPrimary = index === primaryIndex ? 0 : index < primaryIndex ? primaryIndex - 1 : primaryIndex;
    onChange(next, Math.min(nextPrimary, Math.max(0, next.length - 1)));
  };

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
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-[var(--radius)] border-2 border-dashed px-5 py-8 text-center transition-colors ${dragging ? "border-[var(--primary)] bg-[var(--accent)]" : "border-[var(--border)] bg-[var(--muted)]/30 hover:border-[var(--primary)]/60"}`}
      >
        <ImagePlus className="mx-auto h-7 w-7 text-[var(--muted-foreground)]" />
        <p className="mt-2 text-sm font-medium">Arrastra fotos o selecciónalas desde tu equipo</p>
        <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">JPG, PNG o WebP · Máximo 5MB · Hasta {PHOTO_MAX} fotos</p>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
        <span>{existingUrls.length + files.length} de {PHOTO_MAX} fotos</span>
        {files.length > 0 && <span>Selecciona la estrella para definir la portada</span>}
      </div>

      {(existingUrls.length > 0 || previews.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {existingUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto guardada ${index + 1}`} className="h-full w-full object-cover" />
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] text-white">Guardada</span>
            </div>
          ))}
          {previews.map((url, index) => (
            <div key={url} className={`group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] border-2 bg-[var(--muted)] ${index === primaryIndex ? "border-[var(--primary)]" : "border-[var(--border)]"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Nueva foto ${index + 1}`} className="h-full w-full object-cover" />
              {index === primaryIndex && <span className="absolute left-1.5 top-1.5 rounded bg-[var(--primary)] px-1.5 py-0.5 text-[9px] font-medium text-white">Portada</span>}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {index !== primaryIndex && <button type="button" onClick={() => onChange(files, index)} title="Usar como portada" className="grid h-8 w-8 place-items-center rounded-full bg-white text-[var(--fm-navy)]"><Star className="h-4 w-4" /></button>}
                <button type="button" onClick={() => remove(index)} title="Quitar foto" className="grid h-8 w-8 place-items-center rounded-full bg-red-600 text-white"><X className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
