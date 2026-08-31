"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileCheck2, Gauge, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Notice, Panel } from "@/components/ui/primitives";
import { crmErrorMessage, crmFetch } from "@/lib/api/crm-fetch";
import type { ReportType } from "@/lib/data/crm";

const TOKEN_COST: Record<ReportType, number> = { standard: 1, premium: 2 };

function parsePlates(value: string) {
  const candidates = value.split(/\r?\n|[,;\t]+/);
  const normalized = candidates
    .map((plate) => plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);
  const plates = Array.from(new Set(normalized));
  return { plates, duplicates: normalized.length - plates.length };
}

export function ReportBatchForm({
  dealershipName,
  canRequest,
}: {
  dealershipName: string;
  canRequest: boolean;
}) {
  const [rawPlates, setRawPlates] = useState("");
  const [reportType, setReportType] = useState<ReportType>("standard");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    requested: number;
    created: number;
    batchId: string | null;
  } | null>(null);
  const { plates, duplicates } = parsePlates(rawPlates);
  const overLimit = plates.length > 200;
  const expectedTokens = plates.length * TOKEN_COST[reportType];

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (plates.length === 0) {
      toast.error("Ingresa al menos una patente");
      return;
    }
    if (overLimit) {
      toast.error("Puedes solicitar hasta 200 patentes por lote");
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const response = await crmFetch("/api/crm/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, plates }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        batch?: { id?: string } | null;
        reports?: unknown[];
      } | null;
      if (!response.ok || !data?.ok) {
        toast.error(data?.error || "No pudimos crear el lote de informes");
        return;
      }

      const created = Array.isArray(data.reports) ? data.reports.length : 0;
      setResult({
        requested: plates.length,
        created,
        batchId: data.batch?.id ? String(data.batch.id) : null,
      });
      if (created < plates.length) {
        toast.warning(`Se recibieron ${created} de ${plates.length} informes. Revisa el historial.`);
      } else {
        toast.success("Lote de informes solicitado");
      }
      setRawPlates("");
    } catch (error) {
      const message = crmErrorMessage(error, "No pudimos conectar con el servicio de informes");
      if (message) toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel title="Patentes del lote" subtitle="Una patente por línea, máximo 200">
        <form onSubmit={submit} className="space-y-5 p-4 sm:p-5">
          {!canRequest && (
            <Notice tone="warn">
              Tu cuenta es de sólo lectura. Puedes consultar el historial, pero no solicitar nuevos informes.
            </Notice>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Pega las patentes</span>
            <textarea
              value={rawPlates}
              onChange={(event) => {
                setRawPlates(event.target.value);
                setResult(null);
              }}
              rows={12}
              spellCheck={false}
              placeholder={"ABCD12\nEFGH34\nIJKL56"}
              className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-3 font-mono text-sm uppercase outline-none transition-colors placeholder:normal-case placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]"
              aria-describedby="plate-count"
              disabled={!canRequest || submitting}
            />
          </label>

          <div id="plate-count" className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className={overLimit ? "font-semibold text-red-700" : "text-[var(--muted-foreground)]"}>
              {plates.length} {plates.length === 1 ? "patente única" : "patentes únicas"} de 200
            </span>
            {duplicates > 0 && (
              <span className="rounded-full bg-[var(--muted)] px-2 py-1 text-[var(--muted-foreground)]">
                {duplicates} {duplicates === 1 ? "duplicada eliminada" : "duplicadas eliminadas"}
              </span>
            )}
          </div>

          {plates.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--muted)]/35 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Patentes normalizadas
              </p>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {plates.slice(0, 40).map((plate) => (
                  <span key={plate} className="rounded-md bg-[var(--card)] px-2 py-1 font-mono text-xs font-semibold">
                    {plate}
                  </span>
                ))}
                {plates.length > 40 && (
                  <span className="px-2 py-1 text-xs text-[var(--muted-foreground)]">
                    +{plates.length - 40} más
                  </span>
                )}
              </div>
            </div>
          )}

          <fieldset>
            <legend className="mb-2 text-xs font-medium">Tipo para todo el lote</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReportTypeOption
                type="standard"
                selected={reportType === "standard"}
                onSelect={setReportType}
                disabled={!canRequest || submitting}
                label="Estándar"
                description="1 token por informe"
              />
              <ReportTypeOption
                type="premium"
                selected={reportType === "premium"}
                onSelect={setReportType}
                disabled={!canRequest || submitting}
                label="Premium"
                description="2 tokens por informe"
              />
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={!canRequest || submitting || plates.length === 0 || overLimit}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
            {submitting ? "Enviando lote..." : `Solicitar ${plates.length || 0} informes`}
          </button>
        </form>
      </Panel>

      <div className="space-y-4">
        <Panel title="Resumen de consumo" subtitle={dealershipName}>
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--muted-foreground)]">Informes</span>
              <strong className="tabular-nums">{plates.length}</strong>
            </div>
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 text-sm">
              <span className="text-[var(--muted-foreground)]">Consumo unitario</span>
              <strong>{TOKEN_COST[reportType]} {TOKEN_COST[reportType] === 1 ? "token" : "tokens"}</strong>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--fm-navy)] p-4 text-white">
              <div className="flex items-center gap-2 text-xs text-white/65">
                <Gauge className="h-4 w-4 text-[var(--fm-lime)]" />
                Consumo esperado del lote
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {expectedTokens} <span className="text-base font-medium">tokens</span>
              </p>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
              El valor monetario no se calcula aquí. La tarifa contractual se aplica al momento de facturar.
            </p>
          </div>
        </Panel>

        {result && (
          <Notice tone={result.created < result.requested ? "warn" : "info"}>
            <div className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {result.created} de {result.requested} informes recibidos
                </p>
                {result.batchId && <p className="mt-0.5">Lote {result.batchId}</p>}
                <Link href="/informes" className="mt-2 inline-block font-semibold text-[var(--primary)]">
                  Ver estado en el historial
                </Link>
              </div>
            </div>
          </Notice>
        )}
      </div>
    </div>
  );
}

function ReportTypeOption({
  type,
  selected,
  onSelect,
  disabled,
  label,
  description,
}: {
  type: ReportType;
  selected: boolean;
  onSelect: (type: ReportType) => void;
  disabled: boolean;
  label: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border p-3 transition-colors ${
        selected ? "border-[var(--primary)] bg-[var(--accent)]/60" : "border-[var(--border)]"
      } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-[var(--primary)]/50"}`}
    >
      <input
        type="radio"
        name="reportType"
        value={type}
        checked={selected}
        onChange={() => onSelect(type)}
        disabled={disabled}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-[var(--muted-foreground)]">{description}</span>
      </span>
    </label>
  );
}
