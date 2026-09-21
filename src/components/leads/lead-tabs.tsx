"use client";

/**
 * Pestañas de la ficha. La solicitud tiene cuatro cosas distintas —gestionar, cotizar,
 * financiar y consultar el historial— y apilarlas obligaba a bajar por una pantalla larga
 * para llegar a lo de siempre.
 *
 * El contenido llega renderizado desde el servidor y se monta completo: cambiar de pestaña
 * es sólo mostrar y ocultar, sin ida al servidor ni volver a pedir datos. A cambio, el
 * contenido oculto sigue en el DOM — a esta escala (cuatro paneles) es el intercambio
 * correcto, y es lo que hace que moverse entre pestañas se sienta instantáneo con el cliente
 * enfrente.
 */
import { useState } from "react";
import { clsx } from "clsx";

export type LeadTab = {
  key: string;
  label: string;
  /** Dato al canto del rótulo: el monto cotizado, cuántas solicitudes, cuántos registros. */
  badge?: string;
  content: React.ReactNode;
};

export function LeadTabs({ tabs, initialKey }: { tabs: LeadTab[]; initialKey?: string }) {
  const [active, setActive] = useState(
    () => tabs.find((tab) => tab.key === initialKey)?.key ?? tabs[0]?.key,
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Secciones de la solicitud"
        className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border)] px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.key}`}
              id={`tab-${tab.key}`}
              onClick={() => setActive(tab.key)}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm transition-colors",
                selected
                  ? "border-[var(--primary)] bg-[var(--accent)] font-semibold text-[var(--primary)]"
                  : "border-transparent font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {tab.label}
              {tab.badge && (
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                    selected
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--muted)] text-[var(--muted-foreground)]",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`panel-${tab.key}`}
          aria-labelledby={`tab-${tab.key}`}
          hidden={tab.key !== active}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
