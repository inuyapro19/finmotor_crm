import Link from "next/link";
import { ArrowLeft, Coins } from "lucide-react";

import { TokenPackButton } from "@/components/reports/token-pack-button";
import { TokenPurchaseReturn } from "@/components/reports/token-purchase-return";
import { EmptyState, Notice, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getReportWallet, type ReportTokenMovement, type ReportTokenPurchase } from "@/lib/data/crm";
import { fmtCLP, fmtDateTime, fmtNumber, fmtPlate } from "@/lib/format";

const MOVEMENT_LABEL: Record<ReportTokenMovement["reason"], string> = {
  welcome_bonus: "Bono de bienvenida",
  purchase: "Recarga",
  report_consumed: "Informe generado",
  report_refund: "Devolución por informe fallido",
  adjustment: "Ajuste de Finmotor",
};

const PURCHASE_STATUS: Record<ReportTokenPurchase["status"], { label: string; variant: "success" | "warn" | "danger" }> = {
  paid: { label: "Pagado", variant: "success" },
  pending: { label: "En proceso", variant: "warn" },
  failed: { label: "No completado", variant: "danger" },
};

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function ReportTokensPage({
  searchParams,
}: {
  searchParams: Promise<{ compra?: string; payment_id?: string; pago?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireCrmSession();
  const wallet = await getReportWallet(session.dealership.id);
  const writable = canWrite(session.role);
  const returning = sp.compra && UUID_RE.test(sp.compra) ? sp.compra : null;
  const mpPaymentId = sp.payment_id && /^\d{1,40}$/.test(sp.payment_id) ? sp.payment_id : null;
  const returningPurchase = returning ? wallet?.purchases.find((p) => p.id === returning) : undefined;

  return (
    <>
      <PageHeader
        title="Tokens de informes"
        subtitle="Cada informe estándar usa 1 token y cada premium 2. Recarga tu saldo con MercadoPago."
        action={
          <Link
            href="/informes"
            className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver a informes
          </Link>
        }
      />

      {returning && (
        <div className="mb-4">
          <TokenPurchaseReturn
            key={returning}
            purchaseId={returning}
            mpPaymentId={mpPaymentId}
            failed={sp.pago === "fallido" || sp.status === "rejected"}
            initialStatus={returningPurchase?.status ?? null}
          />
        </div>
      )}

      {!wallet ? (
        <Notice tone="warn">No pudimos cargar tu saldo de tokens. Vuelve a intentarlo en unos minutos.</Notice>
      ) : !wallet.enabled ? (
        <Notice>Tu automotora aún no tiene cuenta de tokens. Escríbenos y la activamos.</Notice>
      ) : (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,320px)_1fr]">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]">
                <Coins className="h-4 w-4" /> Saldo disponible
              </p>
              <p className="mt-2 text-4xl font-semibold tabular-nums">
                {fmtNumber(wallet.balance)}{" "}
                <span className="text-base font-medium">{wallet.balance === 1 ? "token" : "tokens"}</span>
              </p>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Alcanza para {fmtNumber(wallet.balance)} estándar o {fmtNumber(Math.floor(wallet.balance / 2))} premium.
              </p>
              {wallet.plan && (
                <p className="mt-3 text-xs">
                  Plan: <strong>{wallet.plan.name}</strong>
                </p>
              )}
            </div>
            <div className="self-center">
              {wallet.billingMode === "postpaid" ? (
                <Notice>
                  Tu automotora tiene facturación mensual. Los tokens de tu saldo se usan primero y, cuando se acaban,
                  los informes se siguen facturando a fin de mes como siempre.
                </Notice>
              ) : (
                <Notice>
                  Para generar informes necesitas saldo. Si un informe falla, te devolvemos sus tokens automáticamente.
                </Notice>
              )}
            </div>
          </div>

          <Panel
            title="Recarga tu saldo"
            subtitle={wallet.plan ? `Packs de tu ${wallet.plan.name}` : undefined}
            className="mb-5"
          >
            {wallet.packs.length === 0 ? (
              <EmptyState
                icon={<Coins className="h-6 w-6" />}
                title="Aún no hay packs disponibles"
                description="Finmotor está preparando los packs de tu plan. Escríbenos si necesitas recargar ahora."
              />
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {wallet.packs.map((pack) => (
                  <div key={pack.id} className="flex flex-col rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                    <p className="text-sm font-semibold">{pack.name}</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums">
                      {fmtNumber(pack.tokens)} <span className="text-sm font-medium">tokens</span>
                    </p>
                    <p className="mt-1 text-lg font-semibold">{fmtCLP(pack.priceClp)}</p>
                    <p className="mb-4 text-xs text-[var(--muted-foreground)]">{fmtCLP(pack.pricePerTokenClp)} por token</p>
                    <div className="mt-auto">
                      <TokenPackButton packId={pack.id} disabled={!writable} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!writable && (
              <div className="px-4 pb-4">
                <Notice tone="warn">
                  Tu cuenta es de sólo lectura: pide a un administrador de la automotora que haga la recarga.
                </Notice>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Compras" subtitle="Últimas 20 recargas">
              {wallet.purchases.length === 0 ? (
                <p className="p-4 text-sm text-[var(--muted-foreground)]">Todavía no has comprado tokens.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {wallet.purchases.map((purchase) => (
                    <li key={purchase.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {purchase.packName} · {fmtCLP(purchase.priceClp)}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {fmtDateTime(purchase.paidAt ?? purchase.createdAt)}
                          {purchase.requestedByName ? ` · ${purchase.requestedByName}` : ""}
                        </p>
                      </div>
                      <Pill variant={PURCHASE_STATUS[purchase.status].variant}>
                        {PURCHASE_STATUS[purchase.status].label}
                      </Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Movimientos" subtitle="Últimos 30">
              {wallet.movements.length === 0 ? (
                <p className="p-4 text-sm text-[var(--muted-foreground)]">Sin movimientos.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {wallet.movements.map((movement) => (
                    <li key={movement.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {MOVEMENT_LABEL[movement.reason]}
                          {movement.plate ? ` · ${fmtPlate(movement.plate)}` : ""}
                        </p>
                        <p className="truncate text-xs text-[var(--muted-foreground)]">
                          {fmtDateTime(movement.createdAt)}
                          {movement.note && movement.reason !== "welcome_bonus" ? ` · ${movement.note}` : ""}
                        </p>
                      </div>
                      <span className={`font-semibold tabular-nums ${movement.delta > 0 ? "text-[var(--primary)]" : ""}`}>
                        {movement.delta > 0 ? "+" : ""}
                        {fmtNumber(movement.delta)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

export const dynamic = "force-dynamic";
