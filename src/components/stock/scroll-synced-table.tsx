"use client";

/**
 * La tabla de stock es ancha (24 columnas, `min-w-[2960px]`) y alta (hasta 50 filas): antes
 * tenía SU PROPIO scroll horizontal pegado al borde inferior de un bloque `max-h-[*vh]`, que
 * en pantallas normales queda fuera de la vista inicial — para alcanzarlo había que bajar
 * primero el scroll del navegador. Acá se agrega una barra horizontal "proxy", sincronizada
 * con el scroll real de la tabla, dentro de un pie `sticky` pegado al borde inferior del
 * viewport: queda alcanzable de inmediato, sin scrollear el navegador primero. La paginación
 * vive en el mismo pie, así resuelve el mismo problema ("queda muy abajo").
 */
import { useEffect, useRef } from "react";

export function ScrollSyncedTable({
  children,
  footer,
  maxHeightClass = "max-h-[62vh]",
}: {
  /** La tabla real (server-rendered), sin envoltorio de scroll propio. */
  children: React.ReactNode;
  /** Contenido del pie flotante, junto a la barra de scroll (normalmente la paginación). */
  footer: React.ReactNode;
  maxHeightClass?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const proxyRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const proxyEl = proxyRef.current;
    const spacerEl = spacerRef.current;
    if (!scrollEl || !proxyEl || !spacerEl) return;

    const syncSpacerWidth = () => {
      spacerEl.style.width = `${scrollEl.scrollWidth}px`;
    };
    syncSpacerWidth();

    // Evita el eco infinito: mover uno programáticamente dispara el "scroll" del otro.
    let syncingFromTable = false;
    let syncingFromProxy = false;

    const onTableScroll = () => {
      if (syncingFromProxy) return;
      syncingFromTable = true;
      proxyEl.scrollLeft = scrollEl.scrollLeft;
      syncingFromTable = false;
    };
    const onProxyScroll = () => {
      if (syncingFromTable) return;
      syncingFromProxy = true;
      scrollEl.scrollLeft = proxyEl.scrollLeft;
      syncingFromProxy = false;
    };

    scrollEl.addEventListener("scroll", onTableScroll, { passive: true });
    proxyEl.addEventListener("scroll", onProxyScroll, { passive: true });

    // El ancho real de la tabla puede cambiar (filtros, hidratación, resize) — se
    // re-mide el spacer para que el proxy siempre tenga el mismo rango de scroll.
    const resizeObserver = new ResizeObserver(syncSpacerWidth);
    resizeObserver.observe(scrollEl);
    if (scrollEl.firstElementChild) resizeObserver.observe(scrollEl.firstElementChild);

    return () => {
      scrollEl.removeEventListener("scroll", onTableScroll);
      proxyEl.removeEventListener("scroll", onProxyScroll);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={scrollRef} className={`${maxHeightClass} overflow-auto border-b border-[var(--border)]`}>
        {children}
      </div>

      <div className="sticky bottom-16 z-20 border-b border-[var(--border)] bg-[var(--card)] shadow-[0_-2px_6px_rgba(7,29,86,0.06)] lg:bottom-0">
        <div ref={proxyRef} className="overflow-x-auto overflow-y-hidden" style={{ height: 14 }} aria-hidden>
          <div ref={spacerRef} style={{ height: 1 }} />
        </div>
        {footer}
      </div>
    </>
  );
}
