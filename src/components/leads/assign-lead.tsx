"use client";

/**
 * Reasignar una solicitud a otro agente. Es la única mutación de leads que el backend
 * soporta hoy (`POST /backoffice/team/leads/{id}/assign`), y sólo la ven administrador y
 * supervisor. El backend exige además rol administrativo en la organización del lead.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";

export function AssignLead({
  leadId,
  currentAssignee,
  agents,
}: {
  leadId: string;
  currentAssignee: string | null;
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentAssignee ?? "");
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const save = async (assignedTo: string, previousValue: string) => {
    setSaving(true);
    try {
      const res = await crmFetch(`/api/crm/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: assignedTo || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "No pudimos reasignar la solicitud");
        setValue(previousValue);
        return;
      }
      toast.success(assignedTo ? "Solicitud reasignada" : "Solicitud sin asignar");
      startTransition(() => router.refresh());
    } catch (error) {
      setValue(previousValue);
      const message = crmErrorMessage(error, "No pudimos conectar con el servidor");
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex items-center gap-2 text-xs">
      <UserCheck className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
      <select
        value={value}
        disabled={saving || pending}
        onChange={(e) => {
          const previousValue = value;
          setValue(e.target.value);
          save(e.target.value, previousValue);
        }}
        className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 disabled:opacity-60"
      >
        <option value="">Sin asignar</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {(saving || pending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
    </label>
  );
}
