import { notFound, redirect } from "next/navigation";
import { SourcingForm } from "@/components/acquisitions/sourcing-form";
import { PageHeader } from "@/components/ui/primitives";
import { canWrite, requireCrmSession } from "@/lib/auth/session";
import { getLeadDetail } from "@/lib/data/crm";

export default async function NewSourcingPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  const session = await requireCrmSession();
  if (!canWrite(session.role)) redirect("/captacion");
  const { lead: leadId } = await searchParams;
  const result = leadId ? await getLeadDetail(leadId) : null;
  if (leadId && !result) notFound();
  const lead = result?.lead;
  return <><PageHeader title="Nueva captación" /><SourcingForm relatedLeadId={leadId} initialDetails={lead ? {
    ownerName: lead.contactName, ownerRut: lead.contactRut, ownerPhone: lead.contactPhone,
    ownerEmail: lead.contactEmail, tradeInValue: lead.tradeInAmount,
  } : undefined} /></>;
}
