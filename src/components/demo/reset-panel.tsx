"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function ResetDemoPanel({ generation, canReset }: { generation: number; canReset: boolean }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/demo/reset", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, generation }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail === "demo_generation_conflict"
        ? "Otra persona ya reinició la demo. Recarga la página antes de volver a hacerlo."
        : "No se pudo reiniciar. Revisa tus permisos y el estado de la demo.");
      toast.success("Demo restaurada: 12 vehículos y 3 subastas. Se conservaron las cuentas de acceso.");
      setConfirmation("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo reiniciar la demo.");
    } finally {
      setBusy(false);
    }
  };
  return <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5">
    <h2 className="text-lg font-semibold">Reset de demo</h2>
    <p className="text-sm">Escenario #{generation}. Se borrarán las pruebas de stock, ofertas, ventas, subastas, documentos y actividad de toda esta demo. Se conservarán las cuentas, sus claves y los catálogos base.</p>
    {canReset ? <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Escribe RESET DEMO para confirmar
        <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} autoComplete="off"
          className="mt-1 block rounded-lg border border-amber-300 bg-white px-3 py-2" />
      </label>
      <button type="button" onClick={reset} disabled={busy || confirmation !== "RESET DEMO"}
        className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-40">
        {busy ? "Restaurando…" : "Restaurar escenario demo"}
      </button>
    </div> : <p className="text-sm">El reset lo realiza un administrador de la automotora DEMO principal.</p>}
  </section>;
}
