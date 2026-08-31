"use client";

/**
 * Acciones de contacto de la ficha. Son las únicas dos cosas que el agente hace de verdad
 * al recibir una solicitud: llamar o escribir por WhatsApp. Ambas salen del CRM hacia el
 * teléfono, que es donde ocurre la venta.
 *
 * Tamaño según el dispositivo, no según el ancho disponible: en el teléfono los dos botones
 * ocupan la fila (se tocan con el pulgar, a veces con el cliente al lado), y en escritorio se
 * quedan del ancho de su texto — estirar un botón a media pantalla no lo hace más importante,
 * sólo más ruidoso. El teléfono y el correo van como texto copiable, que es un gesto
 * secundario.
 */
import { Copy, Mail, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { toDialable } from "@/lib/format";

export function ContactActions({
  phone,
  email,
  contactName,
  vehicleLabel,
}: {
  phone: string | null;
  email: string | null;
  contactName: string;
  vehicleLabel: string;
}) {
  const dialable = toDialable(phone);
  const greeting = `Hola ${contactName.split(" ")[0]}, te escribo de la automotora por tu consulta del ${vehicleLabel}.`;
  const whatsapp = dialable
    ? `https://wa.me/${dialable.replace("+", "")}?text=${encodeURIComponent(greeting)}`
    : null;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No pudimos copiar");
    }
  };

  if (!dialable && !email) {
    return (
      <p className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Esta solicitud no trae teléfono ni correo. Pídele a tu administrador que revise el
        formulario de contacto de la publicación.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dialable && (
        <a
          href={`tel:${dialable}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:flex-none sm:py-2"
        >
          <Phone className="h-4 w-4" />
          Llamar
        </a>
      )}
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium transition-colors hover:border-[var(--primary)] sm:flex-none sm:py-2"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}?subject=${encodeURIComponent(`Consulta por ${vehicleLabel}`)}`}
          className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium transition-colors hover:border-[var(--primary)] sm:flex-none sm:py-2"
        >
          <Mail className="h-4 w-4" />
          Correo
        </a>
      )}
      {dialable && (
        <button
          onClick={() => copy(dialable, "Teléfono")}
          title="Copiar teléfono"
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <Copy className="h-3 w-3 shrink-0" />
          {dialable}
        </button>
      )}
      {email && (
        <button
          onClick={() => copy(email, "Correo")}
          title="Copiar correo"
          className="flex min-w-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <Copy className="h-3 w-3 shrink-0" />
          <span className="truncate">{email}</span>
        </button>
      )}
    </div>
  );
}
