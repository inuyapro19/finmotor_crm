"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui/primitives";

type Recommendation = {
  id: string;
  payload: { summary?: string; evidence?: string; confidence?: string; pendingDelivery?: boolean };
};
const confidence: Record<string, string> = {
  hecho: "Hecho registrado", observacion: "Observación", inferencia: "Inferencia",
  hipotesis: "Hipótesis por comprobar", regla_aprendida: "Regla validada",
};

export function MiaRecommendations({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [status, setStatus] = useState("Cargando recomendaciones…");
  const [unavailable, setUnavailable] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const url = `/api/crm/leads/${encodeURIComponent(leadId)}/mia-recommendations`;

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        if (document.visibilityState === "visible") {
          const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
          if (!response.ok) throw new Error("unavailable");
          const data = await response.json();
          setItems(data.recommendations ?? []);
          setUnavailable(false);
          setStatus("Sin recomendaciones vigentes. MIA volverá a evaluar con nueva actividad.");
        }
      } catch {
        if (!controller.signal.aborted) {
          setUnavailable(true);
          setStatus("No se pudo actualizar MIA. Volveremos a intentarlo.");
        }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(load, 15000);
      }
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [url]);

  // One visible action at a time. Only acknowledge when the panel is actually in view.
  const current = items[0];
  useEffect(() => {
    if (!current?.payload.pendingDelivery || !panel.current) return;
    let sent = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || sent || document.visibilityState !== "visible") return;
      sent = true;
      void fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: current.id }),
      }).then((response) => { if (!response.ok) sent = false; }).catch(() => { sent = false; });
    }, { threshold: 0.5 });
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [current, url]);

  return <div ref={panel} className="lg:col-span-2">
    <Panel title="Siguiente acción sugerida" subtitle="Se actualiza con la actividad del cliente">
      <div className="space-y-2 p-4" aria-live="polite">
        {unavailable && current && <p role="status" className="text-sm text-amber-700">{status} La sugerencia puede estar desactualizada.</p>}
        {current ? <>
          <p className="font-medium">{current.payload.summary}</p>
          <p className="text-sm text-[var(--muted-foreground)]">{current.payload.evidence}</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {confidence[current.payload.confidence ?? ""] ?? "Evidencia por revisar"}. La decisión comercial es tuya.
          </p>
        </> : <p className="text-sm text-[var(--muted-foreground)]">{status}</p>}
      </div>
    </Panel>
  </div>;
}
