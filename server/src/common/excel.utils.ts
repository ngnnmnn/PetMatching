import * as XLSX from 'xlsx';

export const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type ExcelCellValue = string | number | boolean | Date | null;

type ExcelColumn<Row> = {
  header: string;
  width: number;
  value: (row: Row, index: number) => ExcelCellValue;
  numberFormat?: string;
};

const HEADER_STYLE = {
  fill: { fgColor: { rgb: '166534' } },
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

const TITLE_STYLE = {
  fill: { fgColor: { rgb: 'DCFCE7' } },
  font: { bold: true, color: { rgb: '14532D' }, sz: 16 },
  alignment: { horizontal: 'left', vertical: 'center' },
};

export function getExcelCell(worksheet: XLSX.WorkSheet, address: string) {
  return worksheet[address] as XLSX.CellObject | undefined;
}

export function createWorkbook() {
  return XLSX.utils.book_new();
}

export function appendJsonSheet(
  workbook: XLSX.WorkBook,
  name: string,
  rows: Record<string, ExcelCellValue>[],
) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { cellDates: true });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.min(
      42,
      Math.max(
        header.length + 2,
        ...rows.map((row) => String(row[header] ?? '').length + 2),
      ),
    ),
  }));
  if (headers.length) {
    const lastColumn = XLSX.utils.encode_col(headers.length - 1);
    worksheet['!autofilter'] = {
      ref: `A1:${lastColumn}${Math.max(rows.length + 1, 1)}`,
    };
    headers.forEach((_, columnIndex) => {
      const cell = getExcelCell(
        worksheet,
        XLSX.utils.encode_cell({ r: 0, c: columnIndex }),
      );
      if (cell) cell.s = HEADER_STYLE;
    });
  }
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
  return worksheet;
}

export function appendTableSheet<Row>(
  workbook: XLSX.WorkBook,
  options: {
    name: string;
    title?: string;
    subtitle?: string;
    columns: ExcelColumn<Row>[];
    rows: Row[];
  },
) {
  const headingRows: ExcelCellValue[][] = [];
  if (options.title) headingRows.push([options.title]);
  if (options.subtitle) headingRows.push([options.subtitle]);
  if (headingRows.length) headingRows.push([]);

  const headerRowIndex = headingRows.length;
  const data = [
    ...headingRows,
    options.columns.map((column) => column.header),
    ...options.rows.map((row, index) =>
      options.columns.map((column) => column.value(row, index)),
    ),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data, { cellDates: true });
  const lastColumn = XLSX.utils.encode_col(options.columns.length - 1);
  const lastRow = Math.max(headerRowIndex + options.rows.length + 1, 1);

  worksheet['!cols'] = options.columns.map((column) => ({ wch: column.width }));
  worksheet['!autofilter'] = {
    ref: `A${headerRowIndex + 1}:${lastColumn}${lastRow}`,
  };
  worksheet['!rows'] = data.map((_, index) => ({
    hpt: index === 0 && options.title ? 26 : index === headerRowIndex ? 30 : 20,
  }));

  if (options.title) {
    worksheet['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: Math.max(options.columns.length - 1, 0) },
      },
    ];
    const titleCell = getExcelCell(worksheet, 'A1');
    if (titleCell) titleCell.s = TITLE_STYLE;
  }

  for (
    let columnIndex = 0;
    columnIndex < options.columns.length;
    columnIndex += 1
  ) {
    const headerCell = getExcelCell(
      worksheet,
      XLSX.utils.encode_cell({ r: headerRowIndex, c: columnIndex }),
    );
    if (headerCell) headerCell.s = HEADER_STYLE;

    const numberFormat = options.columns[columnIndex].numberFormat;
    if (!numberFormat) continue;
    for (
      let rowIndex = headerRowIndex + 1;
      rowIndex < data.length;
      rowIndex += 1
    ) {
      const cell = getExcelCell(
        worksheet,
        XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex }),
      );
      if (cell) cell.z = numberFormat;
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, options.name);
  return worksheet;
}

export function writeWorkbook(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    cellDates: true,
    cellStyles: true,
  }) as Buffer;
}
