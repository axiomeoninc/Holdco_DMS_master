/**
 * exceljs workbook writer. Import from server routes or via dynamic import
 * inside a click handler — never statically from a "use client" module.
 */

import ExcelJS from "exceljs";

export type XlsxColWidth = { wch: number };

export type XlsxSheet = {
  name: string;
  rows: Record<string, unknown>[];
  columnWidths?: XlsxColWidth[];
};

function cellValue(value: unknown): ExcelJS.CellValue {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

function applyColumnWidths(
  ws: ExcelJS.Worksheet,
  widths: XlsxColWidth[] | undefined
): void {
  if (!widths) return;
  widths.forEach((width, index) => {
    ws.getColumn(index + 1).width = width.wch;
  });
}

export async function writeSheetsToArrayBuffer(
  sheets: XlsxSheet[]
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
    const first = sheet.rows[0];
    if (first) {
      const headers = Object.keys(first);
      worksheet.addRow(headers);
      for (const row of sheet.rows) {
        worksheet.addRow(headers.map((key) => cellValue(row[key])));
      }
    }
    applyColumnWidths(worksheet, sheet.columnWidths);
  }
  const raw = await workbook.xlsx.writeBuffer();
  return raw as ArrayBuffer;
}

export async function sheetsToXlsxBuffer(sheets: XlsxSheet[]): Promise<Buffer> {
  return Buffer.from(await writeSheetsToArrayBuffer(sheets));
}
