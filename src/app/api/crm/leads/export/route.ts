import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { requireCrmApiSession } from "@/lib/auth/session";
import { getLeadPage, type LeadListFilters, type LeadListSort } from "@/lib/data/crm";
import { sourceLabel, stageLabel, toStage } from "@/lib/leads";

export const runtime = "nodejs";

const PAYMENT_MODE_LABEL: Record<string, string> = { cash: "Contado", financing: "Financiamiento" };
const FINANCE_STATUS_LABEL: Record<string, string> = { approved: "Aprobado", rejected: "Rechazado" };

export async function GET(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const query = new URL(request.url).searchParams;

  const filters: Omit<LeadListFilters, "page" | "pageSize"> = {
    q: query.get("q")?.trim() || undefined,
    stage: query.get("stage")?.trim() || undefined,
    assignedTo: query.get("assignedTo")?.trim() || undefined,
    overdue: query.get("overdue") === "true",
    source: query.get("source")?.trim() || undefined,
    locationId: query.get("locationId")?.trim() || undefined,
    dateFrom: query.get("from")?.trim() || undefined,
    dateTo: query.get("to")?.trim() || undefined,
    sort: (query.get("sort") as LeadListSort | null) ?? "recent",
  };

  try {
    const first = await getLeadPage(session, { ...filters, page: 1, pageSize: 200 });
    if (first.error) throw new Error(`leads_export_${first.error}`);
    const leads = [...first.leads];
    for (let page = 2; page <= first.pagination.totalPages; page += 1) {
      const next = await getLeadPage(session, { ...filters, page, pageSize: 200 });
      leads.push(...next.leads);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Finmotor CRM";
    workbook.created = new Date();
    workbook.subject = "Solicitudes / leads";
    workbook.title = `Solicitudes ${session.dealership.name}`;

    const sheet = workbook.addWorksheet("Solicitudes", { views: [{ state: "frozen", xSplit: 1, ySplit: 4 }] });
    sheet.mergeCells("A1:S1");
    sheet.getCell("A1").value = `SOLICITUDES / LEADS · ${session.dealership.name.toUpperCase()}`;
    sheet.getCell("A1").font = { size: 17, bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF071D56" } };
    sheet.getRow(1).height = 32;
    sheet.mergeCells("A2:S2");
    const range = filters.dateFrom || filters.dateTo
      ? `Periodo: ${filters.dateFrom ?? "inicio"} a ${filters.dateTo ?? "hoy"}`
      : "Periodo: histórico completo";
    sheet.getCell("A2").value = `Generado ${new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date())}  |  ${range}`;
    sheet.getCell("A2").font = { size: 9, color: { argb: "FF5A6070" } };

    const columns = [
      "Contacto", "Teléfono", "Email", "Vehículo", "Año", "Precio lista", "Etapa", "Origen",
      "Vendedor asignado", "Sucursal", "Cotización", "Pie cotizado", "Parte de pago",
      "Primer contacto", "Próxima acción", "Motivo pérdida", "Forma de pago", "Financiamiento",
      "Transferencia", "Creado",
    ];
    const rows = leads.map((lead) => [
      lead.contactName, lead.contactPhone ?? "", lead.contactEmail ?? "",
      lead.vehicleLabel, lead.vehicleYear, lead.vehiclePrice,
      stageLabel(toStage(lead.rawStage)), sourceLabel(lead.source),
      lead.assignedToName ?? "Sin asignar", lead.vehicleLocationName ?? "",
      lead.quotedPrice, lead.quotedDownPayment, lead.tradeInAmount,
      lead.firstContactedAt ? new Date(lead.firstContactedAt) : null,
      lead.nextActionAt ? new Date(lead.nextActionAt) : null,
      lead.lostReason ?? "",
      lead.paymentMode ? PAYMENT_MODE_LABEL[lead.paymentMode] ?? lead.paymentMode : "",
      lead.financeStatus ? FINANCE_STATUS_LABEL[lead.financeStatus] ?? lead.financeStatus : "",
      lead.transferStatus ?? "",
      lead.createdAt ? new Date(lead.createdAt) : null,
    ]);
    sheet.addTable({ name: "Solicitudes", ref: "A4", headerRow: true, style: { theme: "TableStyleMedium2", showRowStripes: true }, columns: columns.map((name) => ({ name, filterButton: true })), rows });
    [22, 15, 24, 26, 8, 14, 18, 16, 20, 18, 14, 14, 14, 16, 16, 22, 16, 14, 16, 16].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    [6, 11, 12, 13].forEach((column) => { sheet.getColumn(column).numFmt = "$#,##0;[Red]-$#,##0"; });
    [14, 15, 20].forEach((column) => { sheet.getColumn(column).numFmt = "dd-mm-yyyy hh:mm"; });

    const summary = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
    summary.getColumn("A").width = 28;
    summary.getColumn("B").width = 20;
    const byStageRows = Object.entries(first.facets.byStage).map(([stage, count]) => [stageLabel(toStage(stage)), count]);
    summary.addRows([
      ["RESUMEN", ""], ["", ""],
      ["Solicitudes exportadas", leads.length],
      ["Valor en juego (abiertas)", first.summary.valueInPlay],
      ["Compromisos vencidos", first.summary.overdueCount],
      ["", ""], ["Por etapa", ""],
      ...byStageRows,
    ]);
    summary.mergeCells("A1:B1");
    summary.getCell("A1").font = { size: 17, bold: true, color: { argb: "FFFFFFFF" } };
    summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF071D56" } };
    summary.getCell("B4").numFmt = "$#,##0";

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="solicitudes-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No pudimos exportar las solicitudes" }, { status: 502 });
  }
}
