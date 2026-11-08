import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Landmark, Repeat, Stethoscope, User } from "lucide-react";

import { canManageTeam, canManageTransfers, canWrite, isDealershipAdmin, requireCrmSession } from "@/lib/auth/session";
import { getAssignableAgents, getLeadDetail } from "@/lib/data/crm";
import { getLeadIntelligence } from "@/lib/data/mia-crm";
import { getLeadFiles } from "@/lib/data/lead-files";
import { fmtCLP, fmtDateTime, timeAgo } from "@/lib/format";
import { SLA_LABEL, isActionOverdue, leadValue, slaLevel, sourceLabel } from "@/lib/leads";
import { Panel, Pill } from "@/components/ui/primitives";
import { ContactActions } from "@/components/leads/contact-actions";
import { AssignLead } from "@/components/leads/assign-lead";
import { LeadActions } from "@/components/leads/lead-actions";
import { ActivityLog } from "@/components/leads/activity-log";
import { LeadEdit } from "@/components/leads/lead-edit";
import { LeadSummary } from "@/components/leads/lead-summary";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { QuoteCard } from "@/components/leads/quote-card";
import { CreditPanel } from "@/components/leads/credit-panel";
import { LeadTasks } from "@/components/leads/lead-tasks";
import { LeadDocuments } from "@/components/leads/lead-documents";
import { LeadReadiness } from "@/components/leads/lead-readiness";
import { TradeInPanel } from "@/components/leads/trade-in-panel";
import { FinalOfferCard } from "@/components/leads/final-offer-card";
import { CloseTab } from "@/components/leads/close-tab";
import { MiaIntelligenceTab } from "@/components/leads/mia-intelligence-tab";

const SLA_VARIANT = { ok: "success", warn: "warn", late: "danger" } as const;

/**
 * Ficha de la solicitud.
 *
 * Tres capas, de arriba abajo: QUIÉN es y cómo se le contacta, EN QUÉ VA la venta (el resumen
 * de etapa, siempre visible), y en pestañas lo que se hace con ella. Antes todo iba apilado y
 * cotizar quedaba a media pantalla de distancia de lo que el agente estaba mirando.
 *
 * `?tab=` deja abrir la ficha directamente en una sección — útil para volver a lo mismo
 * después de guardar, y para mandarle a un colega el enlace de la cotización.
 */
export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await requireCrmSession();
  // El backend ya resuelve el acote (organización + agente): si no es visible, 404/403
  // y aquí llega como null.
  const detail = await getLeadDetail(id);
  if (!detail) notFound();
  const { lead, activities, tasks, vehicleInterests, creditRequests, creditTerms, sale, tradeIn, readiness, finalOffer } = detail;

  const managesTeam = canManageTeam(session.role);
  const managesTransfers = canManageTransfers(session.dealership.memberRole);
  const agents = managesTeam ? await getAssignableAgents(session) : [];
  const sla = slaLevel(lead);
  const editable = canWrite(session.role);
  const value = leadValue(lead);
  const overdue = isActionOverdue(lead);
  const [intelligence, files] = await Promise.all([getLeadIntelligence(lead.id), getLeadFiles(lead.id)]);

  return (
    <>
      <Link
        href="/solicitudes"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Solicitudes
      </Link>

      {/* ── Quién es ─────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{lead.contactName}</h1>
          {sla && <Pill variant={SLA_VARIANT[sla]}>{SLA_LABEL[sla]}</Pill>}
          {overdue && <Pill variant="danger">Compromiso vencido</Pill>}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--muted-foreground)]">
            {sourceLabel(lead.source)} · llegó {timeAgo(lead.createdAt)}
          </p>
          <LeadEdit lead={lead} canDelete={isDealershipAdmin(session.role)} />
        </div>
      </div>

      {/* Sin tarjeta alrededor: son acciones, no una sección de contenido. */}
      <div className="mb-4">
        <ContactActions
          phone={lead.contactPhone}
          email={lead.contactEmail}
          contactName={lead.contactName}
          vehicleLabel={lead.vehicleLabel}
        />
      </div>

      {/* ── En qué va la venta ───────────────────────────────────── */}
      <LeadSummary lead={lead} sale={sale} canWrite={editable} />

      {/* ── Qué se hace con ella ─────────────────────────────────── */}
      <LeadTabs
        initialKey={tab}
        tabs={[
          {
            key: "gestion",
            label: "Gestión",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  {readiness && <LeadReadiness readiness={readiness} />}
                  <Panel title="Registrar gestión" subtitle="Después de llamar, deja constancia acá">
                    <div className="p-4">
                      <LeadActions leadId={lead.id} currentStage={lead.stage} />
                    </div>
                  </Panel>

                  <Panel title="Próximo paso" subtitle="Lo que le prometiste al cliente">
                    <LeadTasks leadId={lead.id} tasks={tasks} canWrite={editable} />
                  </Panel>
                </div>

                <div className="space-y-4">
                  <Panel title="Datos del cliente">
                    <dl className="divide-y divide-[var(--border)] text-sm">
                      <Field label="Nombre" value={lead.contactName} />
                      <Field label="Teléfono" value={lead.contactPhone ?? "No entregado"} />
                      <Field label="Correo" value={lead.contactEmail ?? "No entregado"} />
                      <Field label="RUT" value={lead.contactRut ?? "No entregado"} />
                      <Field label="Origen" value={sourceLabel(lead.source)} />
                      <Field label="Recibida" value={fmtDateTime(lead.createdAt)} />
                      <Field
                        label="Primer contacto"
                        value={
                          lead.firstContactedAt
                            ? fmtDateTime(lead.firstContactedAt)
                            : "Todavía sin contactar"
                        }
                      />
                      {lead.lostReason && <Field label="Motivo de pérdida" value={lead.lostReason} />}
                      <Field label="Última actualización" value={fmtDateTime(lead.updatedAt)} />
                    </dl>
                  </Panel>

                  <Panel title="Responsable">
                    <div className="space-y-3 p-4">
                      <p className="flex items-center gap-2 text-sm">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--muted)]">
                          <User className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                        </span>
                        {lead.assignedToName ?? (
                          <span className="text-[var(--muted-foreground)]">Sin asignar</span>
                        )}
                      </p>
                      {canManageTeam(session.role) && agents.length > 0 && (
                        <AssignLead
                          leadId={lead.id}
                          currentAssignee={lead.assignedTo}
                          agents={agents}
                        />
                      )}
                      {session.portfolioRestricted && (
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          Esta solicitud está en tu cartera. Si necesitas pasarla a otro agente,
                          pídeselo a tu supervisor.
                        </p>
                      )}
                    </div>
                  </Panel>
                </div>
              </div>
            ),
          },
          {
            key: "cotizacion",
            label: "Vehículos y cotización",
            badge:
              vehicleInterests.filter((item) => item.status !== "rejected").length > 1
                ? `${vehicleInterests.filter((item) => item.status !== "rejected").length} unidades`
                : value !== null
                  ? fmtCLP(value)
                  : undefined,
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Selección de vehículos y términos"
                  subtitle="Compara varias alternativas, registra sus pruebas y define la unidad final"
                  className="lg:col-span-2"
                >
                  <QuoteCard lead={lead} vehicleInterests={vehicleInterests} canWrite={editable} />
                </Panel>

                <Panel
                  title="Vehículo en parte de pago"
                  subtitle="Se evalúa presencialmente; su valor entra en la cotización y en la oferta definitiva"
                >
                  <TradeInPanel
                    key={`${tradeIn?.id ?? "none"}-${tradeIn?.status ?? ""}-${tradeIn?.appraisedAmount ?? ""}`}
                    leadId={lead.id}
                    tradeIn={tradeIn}
                    canWrite={editable}
                    locked={Boolean(lead.purchaseId)}
                  />
                </Panel>

                <Panel title="Oferta definitiva" subtitle="Con el vehículo elegido y la evaluación de la parte de pago">
                  <FinalOfferCard
                    key={finalOffer?.version ?? 0}
                    lead={lead}
                    tradeIn={tradeIn}
                    finalOffer={finalOffer}
                    creditTerms={creditTerms}
                    canWrite={editable}
                  />
                </Panel>

                <Panel title="Servicios que puedes ofrecerle" className="lg:col-span-2">
                  <ul className="divide-y divide-[var(--border)] sm:grid sm:grid-cols-2 sm:divide-y-0">
                    <ServiceRow
                      icon={<FileText className="h-4 w-4" />}
                      name="Informe histórico"
                      price="Desde $5.900"
                      detail="Anotaciones, encargo por robo, historial de la patente."
                    />
                    <ServiceRow
                      icon={<Stethoscope className="h-4 w-4" />}
                      name="Informe de precompra"
                      price="$49.990"
                      detail="Revisión técnica en terreno, con agenda de inspección."
                    />
                    <ServiceRow
                      icon={<Repeat className="h-4 w-4" />}
                      name="Transferencia"
                      price="$49.990 + impuesto"
                      detail="Trámite completo, desde el contrato hasta la inscripción."
                    />
                    <ServiceRow
                      icon={<Landmark className="h-4 w-4" />}
                      name="Financiamiento"
                      price="Ya disponible"
                      detail="Simúlalo y envíalo a evaluación en la pestaña Financiamiento."
                    />
                  </ul>
                  <div className="border-t border-[var(--border)] px-4 py-3">
                    <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                      Pídelos y cóbralos desde la pestaña <strong>Cierre</strong> — esta lista es
                      sólo para ofrecerlos con el precio a la vista.
                    </p>
                  </div>
                </Panel>
              </div>
            ),
          },
          {
            key: "documentos",
            label: "Documentos",
            badge: files.documents.length > 0 ? String(files.documents.length) : undefined,
            content: (
              <LeadDocuments
                leadId={lead.id}
                catalog={files.catalog}
                documents={files.documents}
                canWrite={editable}
              />
            ),
          },
          {
            key: "mia",
            label: "Inteligencia MIA",
            content: (
              <MiaIntelligenceTab
                leadId={lead.id}
                vehiclePrice={lead.vehiclePrice}
                intelligence={intelligence}
                canWrite={editable}
              />
            ),
          },
          {
            key: "cierre",
            label: "Cierre",
            badge: lead.purchaseId ? "Venta cerrada" : undefined,
            content: (
              <CloseTab
                lead={lead}
                creditRequests={creditRequests}
                sale={sale}
                canWrite={editable}
                canManageTeam={managesTeam}
                canManageTransfers={managesTransfers}
              />
            ),
          },
          {
            key: "financiamiento",
            label: "Financiamiento",
            badge: creditRequests.length > 0 ? String(creditRequests.length) : undefined,
            content: (
              <Panel title="Simulación y envío" subtitle="La cuota que le dices al cliente y el caso que evalúa la financiera">
                <CreditPanel
                  lead={lead}
                  terms={creditTerms}
                  requests={creditRequests}
                  canWrite={editable}
                />
              </Panel>
            ),
          },
          {
            key: "historial",
            label: "Historial",
            badge: activities.length > 0 ? String(activities.length) : undefined,
            content: (
              <Panel title="Todo lo que pasó con esta solicitud">
                <div className="p-4">
                  <ActivityLog
                    activities={activities}
                    createdAt={lead.createdAt}
                    sourceLabel={sourceLabel(lead.source)}
                  />
                </div>
              </Panel>
            ),
          },
        ]}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-xs text-[var(--muted-foreground)]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm">{value}</dd>
    </div>
  );
}

function ServiceRow({
  icon,
  name,
  price,
  detail,
}: {
  icon: React.ReactNode;
  name: string;
  price: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <span className="shrink-0 text-xs text-[var(--muted-foreground)]">{price}</span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{detail}</p>
      </div>
    </li>
  );
}

export const dynamic = "force-dynamic";
