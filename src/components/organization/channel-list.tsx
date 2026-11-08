"use client";

/**
 * Canales de publicación de la automotora.
 *
 * La conexión habilita el worker de publicación. Con publicación automática activa, cada
 * unidad que pase a estado Publicado se sincroniza con el canal configurado.
 *
 * Las credenciales viajan al backend y no vuelven nunca: sólo se muestra si el canal ya tiene
 * credenciales cargadas.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { OrganizationChannel } from "@/lib/data/crm";

const CHANNEL_META: Record<
  string,
  { label: string; detail: string; identifierLabel: string; available: boolean }
> = {
  finmotor: {
    label: "Finmotor",
    detail: "Tu stock siempre está publicado en el marketplace.",
    identifierLabel: "",
    available: true,
  },
  chileautos: {
    label: "Chileautos",
    detail: "API de Integración de Inventario. Necesitas tu identificador de vendedor y las credenciales que entrega Chileautos.",
    identifierLabel: "Seller identifier",
    available: true,
  },
  mercadolibre: {
    label: "MercadoLibre",
    detail: "Publicación por API. Requiere conectar tu cuenta de vendedor.",
    identifierLabel: "ID de vendedor",
    available: true,
  },
  meta: {
    label: "Facebook e Instagram",
    detail: "Catálogo de Meta para mostrar tu stock y usarlo en campañas.",
    identifierLabel: "ID del catálogo",
    available: true,
  },
  web_propia: {
    label: "Tu sitio web",
    detail: "Entrega tu stock como feed para publicarlo en tu propia página.",
    identifierLabel: "Identificador",
    available: true,
  },
};

export function ChannelList({
  organizationId,
  channels,
}: {
  organizationId: string;
  channels: OrganizationChannel[];
}) {
  return (
    <ul className="divide-y divide-[var(--border)]">
      {channels.map((channel) => (
        <ChannelRow key={channel.channel} organizationId={organizationId} channel={channel} />
      ))}
    </ul>
  );
}

function ChannelRow({
  organizationId,
  channel,
}: {
  organizationId: string;
  channel: OrganizationChannel;
}) {
  const router = useRouter();
  const meta = CHANNEL_META[channel.channel] ?? {
    label: channel.channel,
    detail: "",
    identifierLabel: "Identificador",
    available: true,
  };
  const isFinmotor = channel.channel === "finmotor";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [sellerIdentifier, setSellerIdentifier] = useState(channel.sellerIdentifier ?? "");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [autoPublish, setAutoPublish] = useState(channel.autoPublish);

  const save = async (enabled: boolean) => {
    setSaving(true);
    try {
      const credentials: Record<string, string> = {};
      if (clientId.trim()) credentials.clientId = clientId.trim();
      if (clientSecret.trim()) credentials.clientSecret = clientSecret.trim();

      const res = await crmFetch(`/api/crm/organizations/${organizationId}/channels/${channel.channel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          sellerIdentifier: sellerIdentifier.trim() || null,
          autoPublish,
          credentials: Object.keys(credentials).length ? credentials : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "No pudimos guardar el canal");
        return;
      }
      toast.success(enabled ? `${meta.label} conectado` : `${meta.label} desconectado`);
      setClientSecret("");
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor para guardar el canal");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            channel.enabled || isFinmotor
              ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
              : "bg-[var(--muted)] text-[var(--muted-foreground)]",
          )}
        >
          {channel.enabled || isFinmotor ? <Check className="h-4 w-4" /> : <Plug className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{meta.label}</p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{meta.detail}</p>
          {channel.enabled && channel.sellerIdentifier && (
            <p className="mt-1 font-mono text-[11px] text-[var(--muted-foreground)]">
              {channel.sellerIdentifier}
              {channel.hasCredentials ? " · credenciales cargadas" : " · sin credenciales"}
            </p>
          )}
        </div>
        {!isFinmotor && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-1.5 text-xs"
          >
            {channel.enabled ? "Editar" : "Conectar"}
          </button>
        )}
      </div>

      {open && !isFinmotor && (
        <div className="mt-3 space-y-3 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">{meta.identifierLabel}</span>
            <input
              value={sellerIdentifier}
              onChange={(e) => setSellerIdentifier(e.target.value)}
              className={inputClass}
              placeholder="El que te entrega el canal"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Client ID</span>
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Client secret</span>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className={inputClass}
                placeholder={channel.hasCredentials ? "Guardado — escribe para reemplazar" : ""}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              className="h-4 w-4"
            />
            Publicar automáticamente cada auto nuevo
          </label>

          <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            Con publicación automática, las unidades en estado Publicado se enviarán a este
            canal. La patente y las fotos deben cumplir los requisitos del proveedor.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-3.5 py-2 text-xs font-medium text-white disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Guardar conexión
            </button>
            {channel.enabled && (
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="rounded-[var(--radius-md)] border border-[var(--border)] px-3.5 py-2 text-xs"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--primary)]";
