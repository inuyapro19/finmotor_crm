"use client";

/**
 * Buscador del stock. Busca por patente, marca o modelo — el backend ya tokeniza la consulta
 * e incluye `v.patent` en el match, así que escribir la patente encuentra la unidad exacta.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export function StockSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/vehiculos?q=${encodeURIComponent(q)}` : "/vehiculos");
  };

  const clear = () => {
    setValue("");
    router.push("/vehiculos");
  };

  return (
    <form onSubmit={submit} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Patente, marca o modelo"
        aria-label="Buscar en el stock"
        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] py-2.5 pl-9 pr-9 outline-none focus:border-[var(--primary)]"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Limpiar búsqueda"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--muted-foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
