"use client";

/**
 * Registro de la gestión: qué pasó en el último contacto.
 *
 * El principio es que registrar cueste menos que anotar en un cuaderno. Por eso los
 * resultados frecuentes son botones de un toque y la nota es opcional. Un CRM que exige
 * llenar un formulario después de cada llamada se abandona en una semana.
 *
 * La ETAPA no se toca aquí —eso vive en el pipeline— salvo cuando el resultado la implica:
 * si hablaste con el cliente, quedó contactado; si agendó visita, está en visita. Es la
 * diferencia entre un CRM que se mantiene solo y uno que hay que ir a actualizar aparte.
 */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, Loader2, MessageSquare, PhoneOff } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { LeadStage } from "@/lib/leads";

const QUICK_RESULTS: {
  key: string;
  label: string;
  activityType: string;
  stage?: LeadStage;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "answered", label: "Hablé con él", activityType: "call", stage: "contacted", icon: Check },
  { key: "no_answer", label: "No contestó", activityType: "no_answer", icon: PhoneOff },
  { key: "whatsapp", label: "Le escribí", activityType: "message_sent", icon: MessageSquare },
  { key: "visit", label: "Viene a verlo", activityType: "visit", stage: "visit", icon: CalendarCheck },
];

export function LeadActions({
  leadId,
  currentStage,
}: {
  leadId: string;
  currentStage: LeadStage;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const noteStorageKey = `crm-lead-note:${leadId}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNote(sessionStorage.getItem(noteStorageKey) ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [noteStorageKey]);

  const register = async (payload: Record<string, unknown>, okMessage: string) => {
    const res = await crmFetch(`/api/crm/leads/${leadId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "No pudimos guardar");
      return false;
    }
    toast.success(okMessage);
    setNote("");
    sessionStorage.removeItem(noteStorageKey);
    startTransition(() => router.refresh());
    return true;
  };

  const registerResult = async (result: (typeof QUICK_RESULTS)[number]) => {
    setBusy(result.key);
    try {
      const openStages: LeadStage[] = ["new", "contacted", "visit", "quoted", "financing", "documents"];
      const currentIndex = openStages.indexOf(currentStage);
      const targetIndex = result.stage ? openStages.indexOf(result.stage) : -1;
      const impliedStage = targetIndex > currentIndex && currentIndex >= 0 ? result.stage : undefined;
      await register(
        {
          activityType: result.activityType,
          notes: note.trim() || null,
          // El resultado puede avanzar el embudo, pero nunca devolverlo a una etapa anterior.
          stage: impliedStage,
        },
        "Registrado",
      );
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setBusy("note");
    try {
      await register({ activityType: "note", notes: note.trim() }, "Nota guardada");
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="note" className="mb-1.5 block text-xs font-medium">
          ¿Qué pasó?
        </label>
        <textarea
          id="note"
          rows={2}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (e.target.value) sessionStorage.setItem(noteStorageKey, e.target.value);
            else sessionStorage.removeItem(noteStorageKey);
          }}
          placeholder="Opcional: quedó de venir el sábado, pidió el informe…"
          className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_RESULTS.map((result) => (
          <button
            key={result.key}
            onClick={() => registerResult(result)}
            disabled={busy !== null || pending}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium transition-colors hover:border-[var(--primary)] disabled:opacity-50"
          >
            {busy === result.key ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <result.icon className="h-3.5 w-3.5" />
            )}
            {result.label}
          </button>
        ))}
        <button
          onClick={saveNote}
          disabled={busy !== null || pending || !note.trim()}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] disabled:opacity-40"
        >
          Sólo anotar
        </button>
      </div>
    </div>
  );
}
