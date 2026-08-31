/**
 * Preferencia "panel de actividad abierto", persistida en el navegador.
 *
 * Es un store externo minúsculo en vez de `useState` + efecto a propósito: leer
 * `localStorage` durante el render rompería la hidratación (el servidor no lo tiene), y
 * leerlo en un efecto encadena un render extra en cada carga. `useSyncExternalStore` resuelve
 * las dos cosas: en el servidor devuelve `false`, y en el cliente el valor real.
 */
const KEY = "fm-crm-activity-rail";

let cached: boolean | null = null;
const listeners = new Set<() => void>();

export function subscribeRail(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRailSnapshot(): boolean {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(KEY) === "1";
    } catch {
      cached = false; // Modo privado o storage bloqueado: el panel arranca cerrado.
    }
  }
  return cached;
}

export function getRailServerSnapshot(): boolean {
  return false;
}

export function setRailOpen(open: boolean): void {
  cached = open;
  try {
    window.localStorage.setItem(KEY, open ? "1" : "0");
  } catch {
    // Sin persistencia: la preferencia dura lo que dure la pestaña.
  }
  for (const listener of listeners) listener();
}
