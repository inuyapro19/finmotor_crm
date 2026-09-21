"use client";
export default function SourcingError({ reset }: { reset: () => void }) {
  return <div role="alert" className="rounded-xl border border-[var(--border)] p-6">
    <p>No pudimos cargar las captaciones. Comprueba tu acceso e intenta nuevamente.</p>
    <button onClick={reset} className="mt-3 underline">Reintentar</button>
  </div>;
}
