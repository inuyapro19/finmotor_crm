import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api/client";
import { requireCrmApiSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const FORWARDED_FILTERS = [
  "q", "patent", "brand", "model", "brandId", "modelId", "year", "status", "acquisitionKind", "kind",
  "ownerName", "lienStatus", "locationId", "enteredById", "minMileage", "maxMileage", "minPrice",
  "maxPrice", "minStockDays", "maxStockDays", "sort", "direction",
] as const;

const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Publicado",
  PUBLISHED_VERIFIED: "Publicado y verificado",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  DRAFT: "Borrador",
  PAUSED: "Pausado",
  ARCHIVED: "Archivado",
};
const KIND_LABEL: Record<string, string> = {
  purchase: "Stock propio",
  consignment: "Consignado",
  trade_in: "Parte de pago",
};
const LIEN_LABEL: Record<string, string> = {
  unknown: "Por verificar",
  clear: "Sin prenda",
  present: "Con prenda",
  pending_release: "Alzamiento pendiente",
};
const FILTER_LABEL: Record<string, string> = {
  q: "Búsqueda",
  patent: "Patente",
  brand: "Marca",
  model: "Modelo",
  brandId: "Marca",
  modelId: "Modelo",
  year: "Año",
  status: "Estado",
  acquisitionKind: "Procedencia",
  ownerName: "Consignante",
  lienStatus: "Situación legal",
  locationId: "Sucursal",
  enteredById: "Ingresado por",
  minMileage: "Km desde",
  maxMileage: "Km hasta",
  minPrice: "Precio desde",
  maxPrice: "Precio hasta",
  minStockDays: "Días desde",
  maxStockDays: "Días hasta",
};

type VehicleExportRow = {
  id: string;
  stock_number: number | null;
  patent: string | null;
  brand_label: string | null;
  model_label: string | null;
  year: number | null;
  mileage: number | null;
  vehicle_type: string | null;
  fuel_type: string | null;
  transmission: string | null;
  color: string | null;
  vin: string | null;
  entered_by_name: string | null;
  acquisition_kind: string | null;
  owner_name: string | null;
  lien_status: string | null;
  inventory_location: string | null;
  received_at: string | null;
  created_at: string | null;
  purchase_price: number | string | null;
  min_price: number | string | null;
  commission_pct: number | string | null;
  commission_amount: number | string | null;
  price: number | string | null;
  status: string | null;
};

function asNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stockDays(row: VehicleExportRow): number {
  const date = row.received_at ?? row.created_at;
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}

function margin(row: VehicleExportRow): number | null {
  const price = asNumber(row.price);
  if (price == null) return null;
  if (row.acquisition_kind === "purchase") {
    const cost = asNumber(row.purchase_price);
    return cost == null ? null : price - cost;
  }
  if (row.acquisition_kind === "consignment") {
    const fixed = asNumber(row.commission_amount);
    if (fixed != null) return fixed;
    const commission = asNumber(row.commission_pct);
    return commission == null ? null : Math.round(price * commission / 100);
  }
  if (row.acquisition_kind === "trade_in") {
    const minimum = asNumber(row.min_price);
    return minimum == null ? null : price - minimum;
  }
  return null;
}

async function fetchPage(params: URLSearchParams, page: number) {
  const query = new URLSearchParams(params);
  query.set("page", String(page));
  query.set("limit", "100");
  const response = await apiFetch(`/backoffice/vehicles?${query.toString()}`, { auth: true });
  if (!response.ok) throw new Error(`vehicles_export_${response.status}`);
  return response.json() as Promise<{ items?: VehicleExportRow[]; total?: number }>;
}

export async function GET(request: Request) {
  const auth = await requireCrmApiSession();
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const url = new URL(request.url);
  const params = new URLSearchParams();
  for (const key of FORWARDED_FILTERS) {
    const sourceKey = key === "acquisitionKind" ? "kind" : key;
    const value = url.searchParams.get(sourceKey)?.trim();
    if (value && key !== "kind") params.set(key, value);
  }

  try {
    const first = await fetchPage(params, 1);
    const total = Math.max(0, Number(first.total) || 0);
    const rows = [...(first.items ?? [])];
    const totalPages = Math.ceil(total / 100);
    for (let page = 2; page <= totalPages; page += 1) {
      const next = await fetchPage(params, page);
      rows.push(...(next.items ?? []));
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Finmotor CRM";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = "Stock de vehículos";
    workbook.title = `Stock ${session.dealership.name}`;

    const sheet = workbook.addWorksheet("Stock vehículos", {
      views: [{ state: "frozen", xSplit: 1, ySplit: 4 }],
      properties: { defaultRowHeight: 19 },
    });
    sheet.mergeCells("A1:W1");
    sheet.getCell("A1").value = `STOCK DE VEHÍCULOS · ${session.dealership.name.toUpperCase()}`;
    sheet.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF071D56" } };
    sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
    sheet.getRow(1).height = 34;

    sheet.mergeCells("A2:W2");
    const filterText = [...params.entries()]
      .filter(([key]) => !["sort", "direction"].includes(key))
      .map(([key, value]) => `${FILTER_LABEL[key] ?? key}: ${STATUS_LABEL[value] ?? KIND_LABEL[value] ?? LIEN_LABEL[value] ?? value}`)
      .join("  ·  ");
    sheet.getCell("A2").value = `Generado ${new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeStyle: "short", timeZone: "America/Santiago" }).format(new Date())}${filterText ? `  |  ${filterText}` : "  |  Inventario completo"}`;
    sheet.getCell("A2").font = { name: "Aptos", size: 9, color: { argb: "FF5A6070" } };
    sheet.getCell("A2").alignment = { vertical: "middle" };
    sheet.getRow(2).height = 24;

    const columns = [
      "Código stock", "Patente", "Marca", "Modelo", "Año", "Kilometraje", "Tipo",
      "Combustible", "Transmisión", "Color", "VIN / Chasis", "Procedencia",
      "Consignante / entrega", "Situación legal", "Sucursal", "Fecha de ingreso",
      "Días en stock", "Costo / mínimo", "Precio venta", "Margen estimado", "Ingresado por",
      "Estado", "ID interno",
    ];
    const tableRows = rows.map((row) => {
      const cost = row.acquisition_kind === "purchase" ? asNumber(row.purchase_price) : asNumber(row.min_price);
      const receivedAt = row.received_at ?? row.created_at;
      return [
        row.stock_number == null ? "" : `STK-${String(row.stock_number).padStart(6, "0")}`,
        row.patent ?? "",
        row.brand_label ?? "",
        row.model_label ?? "",
        row.year,
        row.mileage,
        row.vehicle_type ?? "",
        row.fuel_type ?? "",
        row.transmission ?? "",
        row.color ?? "",
        row.vin ?? "",
        KIND_LABEL[row.acquisition_kind ?? ""] ?? "Sin registrar",
        row.owner_name ?? "",
        LIEN_LABEL[row.lien_status ?? "unknown"] ?? row.lien_status ?? "Por verificar",
        row.inventory_location ?? "Sin ubicación",
        receivedAt ? new Date(receivedAt) : null,
        stockDays(row),
        cost,
        asNumber(row.price),
        margin(row),
        row.entered_by_name ?? "Sin registrar",
        STATUS_LABEL[row.status ?? ""] ?? row.status ?? "",
        row.id,
      ];
    });
    sheet.addTable({
      name: "InventarioStock",
      ref: "A4",
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: columns.map((name) => ({ name, filterButton: true })),
      rows: tableRows,
    });

    const widths = [17, 14, 18, 22, 9, 15, 14, 14, 15, 14, 22, 18, 26, 22, 22, 17, 15, 18, 18, 18, 22, 23, 12];
    widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.getColumn(5).numFmt = "0";
    sheet.getColumn(6).numFmt = "#,##0\" km\"";
    sheet.getColumn(16).numFmt = "dd-mm-yyyy";
    sheet.getColumn(17).numFmt = "0";
    [18, 19, 20].forEach((column) => { sheet.getColumn(column).numFmt = "$#,##0;[Red]-$#,##0"; });
    sheet.getColumn(23).hidden = true;
    for (let rowNumber = 5; rowNumber < 5 + tableRows.length; rowNumber += 1) {
      sheet.getRow(rowNumber).alignment = { vertical: "middle" };
      sheet.getCell(rowNumber, 1).font = { name: "Aptos", bold: true, color: { argb: "FF387D09" } };
      sheet.getCell(rowNumber, 2).font = { name: "Aptos", bold: true, color: { argb: "FF071D56" } };
      const age = Number(sheet.getCell(rowNumber, 17).value) || 0;
      if (age > 60) sheet.getCell(rowNumber, 17).font = { bold: true, color: { argb: "FFB42318" } };
      else if (age > 30) sheet.getCell(rowNumber, 17).font = { bold: true, color: { argb: "FFB54708" } };
    }

    const summary = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
    summary.getColumn("A").width = 30;
    summary.getColumn("B").width = 22;
    summary.mergeCells("A1:D1");
    summary.getCell("A1").value = "RESUMEN DE INVENTARIO";
    summary.getCell("A1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
    summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF071D56" } };
    summary.getRow(1).height = 34;
    const metrics: Array<[string, ExcelJS.CellFormulaValue | number]> = [
      ["Unidades exportadas", { formula: "SUBTOTAL(103,InventarioStock[Patente])", result: rows.length }],
      ["Valor de venta", { formula: "SUBTOTAL(109,InventarioStock[Precio venta])", result: rows.reduce((sum, row) => sum + (asNumber(row.price) ?? 0), 0) }],
      ["Costo / mínimo", { formula: "SUBTOTAL(109,InventarioStock[Costo / mínimo])", result: rows.reduce((sum, row) => sum + (row.acquisition_kind === "purchase" ? (asNumber(row.purchase_price) ?? 0) : (asNumber(row.min_price) ?? 0)), 0) }],
      ["Margen estimado", { formula: "SUBTOTAL(109,InventarioStock[Margen estimado])", result: rows.reduce((sum, row) => sum + (margin(row) ?? 0), 0) }],
      ["Publicados", { formula: "COUNTIF(InventarioStock[Estado],\"Publicado*\")", result: rows.filter((row) => row.status?.startsWith("PUBLISHED")).length }],
      ["Reservados", { formula: "COUNTIF(InventarioStock[Estado],\"Reservado\")", result: rows.filter((row) => row.status === "RESERVED").length }],
      ["Sobre 60 días", { formula: "COUNTIF(InventarioStock[Días en stock],\">60\")", result: rows.filter((row) => stockDays(row) > 60).length }],
    ];
    metrics.forEach(([label, value], index) => {
      const row = index + 3;
      summary.getCell(row, 1).value = label;
      summary.getCell(row, 2).value = value;
      summary.getCell(row, 1).font = { bold: true, color: { argb: "FF5A6070" } };
      summary.getCell(row, 2).font = { size: 14, bold: true, color: { argb: "FF071D56" } };
      summary.getRow(row).height = 25;
    });
    [4, 5, 6].forEach((row) => { summary.getCell(row, 2).numFmt = "$#,##0;[Red]-$#,##0"; });
    summary.getCell("A12").value = "La tabla de la hoja “Stock vehículos” incluye filtros de Excel en cada columna. Los indicadores con SUBTOTAL se recalculan al filtrar filas.";
    summary.mergeCells("A12:D13");
    summary.getCell("A12").alignment = { wrapText: true, vertical: "top" };
    summary.getCell("A12").font = { italic: true, size: 10, color: { argb: "FF5A6070" } };

    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="stock-vehiculos-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No pudimos generar el archivo Excel" }, { status: 502 });
  }
}
