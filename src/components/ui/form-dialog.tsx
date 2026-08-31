"use client";

/**
 * Primitivas compartidas de "agregar / editar / eliminar".
 *
 * Existen para que las tres vistas del CRM —solicitudes, stock y equipo— se comporten igual:
 * el mismo diálogo, los mismos campos, el mismo botón destructivo con confirmación. Un agente
 * que aprendió a cargar una unidad ya sabe invitar a un compañero.
 *
 * En móvil el diálogo sube desde abajo y ocupa el ancho completo; en escritorio se centra.
 */
import { useEffect, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { clsx } from "clsx";

/* ── Diálogo de formulario ───────────────────────────────────────── */

export function FormDialog({
  open,
  title,
  description,
  submitLabel = "Guardar",
  saving = false,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  submitLabel?: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  // Escape cierra: es lo que espera cualquiera que use un diálogo.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--card)] p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{description}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-3"
        >
          {children}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-md)] border border-[var(--border)] px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Campo de formulario ─────────────────────────────────────────── */

export const fieldInputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 outline-none focus:border-[var(--primary)]";

export function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">
        {label}
        {required && <span className="text-[var(--primary)]"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--muted-foreground)]">{hint}</span>}
    </label>
  );
}

/* ── Eliminar con confirmación ───────────────────────────────────── */

/**
 * Botón destructivo en dos pasos. No usa `confirm()` del navegador: bloquea el hilo, se ve
 * distinto en cada sistema y en móvil es fácil de tocar por accidente.
 *
 * Se renderiza SOLO cuando quien mira es administrador de la automotora — la autorización de
 * verdad la aplica el backend.
 */
export function DeleteButton({
  label = "Eliminar",
  confirmLabel = "Confirmar",
  question,
  onDelete,
  compact = false,
}: {
  label?: string;
  confirmLabel?: string;
  question: string;
  onDelete: () => Promise<void>;
  compact?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await onDelete();
      setAsking(false);
    } catch {
      // El formulario que ejecuta la operación muestra el error; aquí sólo se conserva la
      // confirmación abierta para que el usuario pueda reintentar.
    } finally {
      setBusy(false);
    }
  };

  if (!asking) {
    return (
      <button
        onClick={() => setAsking(true)}
        className={clsx(
          "flex items-center gap-1.5 rounded-[var(--radius-md)] border border-red-200 text-red-600 transition-colors hover:bg-red-50",
          compact ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-xs",
        )}
      >
        <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-3">
      <p className="text-xs text-red-800">{question}</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={run}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-red-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {confirmLabel}
        </button>
        <button
          onClick={() => setAsking(false)}
          disabled={busy}
          className="rounded-[var(--radius-md)] border border-red-200 bg-white px-3 py-2 text-xs"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
