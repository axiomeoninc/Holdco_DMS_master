/**
 * Client XLSX download helper. exceljs stays off the SSR graph — it is
 * loaded only when the user clicks export (dynamic import of the workbook writer).
 */

export type XlsxColWidth = { wch: number };

export type XlsxSheet = {
  name: string;
  rows: Record<string, unknown>[];
  columnWidths?: XlsxColWidth[];
};

export async function downloadXlsx(
  rows: object[],
  sheetName: string,
  filename: string,
  columnWidths?: XlsxColWidth[]
): Promise<void> {
  const { writeSheetsToArrayBuffer } = await import(
    "@/src/lib/export/xlsx-workbook"
  );
  const buffer = await writeSheetsToArrayBuffer([
    {
      name: sheetName,
      rows: rows as Record<string, unknown>[],
      columnWidths,
    },
  ]);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
