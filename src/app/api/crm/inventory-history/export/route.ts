import { commissionLabel } from "@/lib/commission";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { requireCrmApiSession } from "@/lib/auth/session";
import { getInventoryHistory, type InventoryHistoryItem } from "@/lib/data/crm";

export const runtime = "nodejs";

const KIND: Record<string, string> = { purchase: "Stock propio", consignment: "Consignado", trade_in: "Parte de pago" };
const OUTCOME: Record<string, string> = { active: "En stock", sold: "Vendido", exited: "Salida sin venta" };

export async function GET(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const query = new URL(request.url).searchParams;
  const filters = {
    q: query.get("q") ?? undefined,
    outcome: query.get("outcome") ?? undefined,
    acquisitionKind: query.get("acquisitionKind") ?? undefined,
    salesAgentId: query.get("salesAgentId") ?? undefined,
    enteredById: query.get("enteredById") ?? undefined,
    locationId: query.get("locationId") ?? undefined,
    from: query.get("from") ?? undefined,
    to: query.get("to") ?? undefined,
    sort: query.get("sort") ?? "eventAt",
    direction: query.get("direction") ?? "desc",
  };
  try {
    const first = await getInventoryHistory({ ...filters, page: 1, limit: 100 });
    const items: InventoryHistoryItem[] = [...first.items];
    for (let page = 2; page <= first.totalPages; page += 1) {
      const next = await getInventoryHistory({ ...filters, page, limit: 100 });
      items.push(...next.items);
    }
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Finmotor CRM";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Historial stock", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
    sheet.mergeCells("A1:S1");
    sheet.getCell("A1").value = `HISTORIAL DE STOCK Y VENTAS · ${session.dealership.name.toUpperCase()}`;
    sheet.getCell("A1").font = { size: 17, bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF071D56" } };
    sheet.getRow(1).height = 32;
    sheet.mergeCells("A2:S2");
    sheet.getCell("A2").value = `Generado ${new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date())}`;
    sheet.getCell("A2").font = { size: 9, color: { argb: "FF5A6070" } };
    const columns = ["Código", "Patente", "Vehículo", "Tipo stock", "Resultado", "Ingreso", "Venta", "Salida física", "Días stock", "Sucursal", "Ingresado por", "Vendido por", "Precio de compra", "Valor de recepción", "Mínimo autorizado", "Comisión acordada", "Precio de venta", "Margen estimado", "Motivo salida"];
    const rows = items.map((item) => [
      item.stockNumber == null ? "" : `STK-${String(item.stockNumber).padStart(6, "0")}`,
      item.patent ?? "", [item.brand, item.model, item.year].filter(Boolean).join(" "),
      KIND[item.acquisitionKind ?? ""] ?? "Sin registrar", OUTCOME[item.outcome] ?? item.outcome,
      item.receivedAt ? new Date(item.receivedAt) : null, item.soldAt ? new Date(item.soldAt) : null,
      item.exitedAt ? new Date(item.exitedAt) : null, item.stockDays, item.locationName ?? "",
      item.enteredByName ?? "", item.salesAgentName ?? "Sin asignar",
      item.purchasePrice, item.tradeInValue, item.minPrice, commissionLabel(item),
      item.outcome === "sold" ? item.saleAmount : null,
      item.outcome === "sold" ? item.estimatedMargin : null, item.exitReason ?? "",
    ]);
    sheet.addTable({ name: "HistorialInventario", ref: "A4", headerRow: true, style: { theme: "TableStyleMedium2", showRowStripes: true }, columns: columns.map((name) => ({ name, filterButton: true })), rows });
    items.forEach((item, index) => {
      if (item.outcome === "sold" && item.saleAmount != null && !item.purchaseId) {
        sheet.getCell(index + 5, 17).note = "Precio publicado de referencia: no hay una compra completada asociada que confirme el precio de cierre.";
      }
    });
    [17, 14, 30, 18, 18, 14, 14, 16, 14, 22, 22, 22, 20, 20, 20, 15, 20, 18, 24].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    [6, 7, 8].forEach((column) => { sheet.getColumn(column).numFmt = "dd-mm-yyyy"; });
    [13, 14, 15, 17, 18].forEach((column) => { sheet.getColumn(column).numFmt = "$#,##0;[Red]-$#,##0"; });

    const summary = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
    summary.getColumn("A").width = 28; summary.getColumn("B").width = 20;
    summary.addRows([
      ["RESUMEN", ""], ["", ""], ["En stock", first.summary.active], ["Vendidos", first.summary.sold],
      ["Salidas sin venta", first.summary.exited], ["Total ventas", first.summary.salesAmount],
      ["Margen estimado", first.summary.estimatedMargin], ["Rotación promedio", first.summary.avgStockDays],
    ]);
    summary.mergeCells("A1:B1"); summary.getCell("A1").font = { size: 17, bold: true, color: { argb: "FFFFFFFF" } };
    summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF071D56" } };
    [6, 7].forEach((row) => { summary.getCell(row, 2).numFmt = "$#,##0"; });
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="historial-stock-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No pudimos exportar el historial" }, { status: 502 });
  }
}
