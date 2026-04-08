import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';

export interface ExcelRow {
  nik: string;
  name: string;
  village: string;
  group: string;
  qty: number;
  unitPrice: number;
  shipping: number;
  targetValue: number;
  calculatedValue: number;
  gap: number;
  isSynced: boolean;
  rowId: string;
}

export interface ParseResult {
  rows: ExcelRow[];
  totalTargetValue: Decimal;
  totalCalculatedValue: Decimal;
  overallGap: Decimal;
}

/**
 * Normalizes merged cells by filling empty cells with the value from the start of the merge range.
 * This ensures that flattened headers or rows correctly reference the intended data.
 */
const normalizeSheet = (sheet: XLSX.WorkSheet) => {
  if (!sheet['!merges']) return;

  sheet['!merges'].forEach((merge) => {
    const start = merge.s;
    const end = merge.e;
    const firstCellRef = XLSX.utils.encode_cell(start);
    const firstCellValue = sheet[firstCellRef];

    if (!firstCellValue) return;

    for (let R = start.r; R <= end.r; ++R) {
      for (let C = start.c; C <= end.c; ++C) {
        if (R === start.r && C === start.c) continue;
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!sheet[cellRef]) {
          sheet[cellRef] = { ...firstCellValue };
        }
      }
    }
  });
};

export const parseExcelFile = (data: ArrayBuffer): ParseResult => {
  let workbook;
  try {
    workbook = XLSX.read(data, { type: 'array' });
  } catch (e) {
    throw new Error('File Excel rusak atau tidak dapat dibaca oleh library.');
  }

  // Smart Discovery: Try to find a sheet that actually has data we need
  let worksheet: XLSX.WorkSheet | null = null;
  let selectedSheetName = '';

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    const dataPreview = XLSX.utils.sheet_to_json<any>(ws, { header: 'A', range: 0, defval: null }).slice(0, 50);
    const hasNikCol = dataPreview.some(row => /^\d{16}$/.test(String(row['H'] || '')));
    
    if (hasNikCol) {
      worksheet = ws;
      selectedSheetName = name;
      break;
    }
  }

  if (!worksheet) {
    // Fallback to first sheet if no NIK pattern found
    worksheet = workbook.Sheets[workbook.SheetNames[0]];
    selectedSheetName = workbook.SheetNames[0];
  }

  // Apply merge normalization
  normalizeSheet(worksheet);

  // Map by column letters
  const rawRows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 'A', defval: null });
  
  const processedRows: ExcelRow[] = [];
  let totalTargetValue = new Decimal(0);
  let totalCalculatedValue = new Decimal(0);

  rawRows.forEach((row, index) => {
    const nik = String(row['H'] || '').trim();
    if (/^\d{16}$/.test(nik)) {
      try {
        const qty = new Decimal(row['L'] || 0);
        const unitPrice = new Decimal(row['S'] || 0);
        const shipping = new Decimal(row['U'] || 0);
        const targetValue = new Decimal(row['X'] || 0);

        const calculatedValue = qty.times(unitPrice).plus(shipping);
        const gap = calculatedValue.minus(targetValue);
        const isSynced = gap.abs().lessThan(0.01);

        processedRows.push({
          nik,
          name: String(row['G'] || '').trim(),
          village: String(row['E'] || '').trim(),
          group: String(row['F'] || '').trim(),
          qty: qty.toNumber(),
          unitPrice: unitPrice.toNumber(),
          shipping: shipping.toNumber(),
          targetValue: targetValue.toNumber(),
          calculatedValue: calculatedValue.toNumber(),
          gap: gap.toNumber(),
          isSynced,
          rowId: `row-${index}-${nik}`
        });
        totalTargetValue = totalTargetValue.plus(targetValue);
        totalCalculatedValue = totalCalculatedValue.plus(calculatedValue);
      } catch (err) {
        console.warn(`Skipping invalid row ${index} in sheet ${selectedSheetName}`);
      }
    }
  });

  if (processedRows.length === 0) {
    throw new Error(`Tidak ditemukan data NIK 16-digit di sheet "${selectedSheetName}". Pastikan NIK ada di Kolom H.`);
  }

  return {
    rows: processedRows,
    totalTargetValue,
    totalCalculatedValue,
    overallGap: totalCalculatedValue.minus(totalTargetValue)
  };
};

/**
 * Magic Balancer Logic: Adjusts the largest row to match the target sum if the gap is small.
 */
export const applyMagicBalance = (rows: ExcelRow[], targetTotal: Decimal): ExcelRow[] => {
  const currentTotal = rows.reduce((acc, row) => acc.plus(row.calculatedValue), new Decimal(0));
  const diff = targetTotal.minus(currentTotal);

  if (diff.isZero()) return rows;

  // Find the row with the largest value to absorb the difference
  let largestRowIndex = 0;
  let largestValue = new Decimal(-1);

  rows.forEach((row, idx) => {
    const val = new Decimal(row.calculatedValue);
    if (val.gt(largestValue)) {
      largestValue = val;
      largestRowIndex = idx;
    }
  });

  const newRows = [...rows];
  const targetRow = { ...newRows[largestRowIndex] };
  
  // Adjust shipping or unit price? Shipping is usually better for small rounding errors
  const newShipping = new Decimal(targetRow.shipping).plus(diff);
  targetRow.shipping = newShipping.toNumber();
  targetRow.calculatedValue = new Decimal(targetRow.qty).times(targetRow.unitPrice).plus(targetRow.shipping).toNumber();
  targetRow.gap = new Decimal(targetRow.calculatedValue).minus(targetRow.targetValue).toNumber();
  targetRow.isSynced = targetRow.gap === 0;

  newRows[largestRowIndex] = targetRow;
  return newRows;
};

/**
 * Exports processed data to the BASTBANPEM import format.
 */
export const exportToBastFormat = (rows: ExcelRow[]) => {
  const data = rows.map((row, index) => ({
    'No': index + 1,
    'Penerima': `${row.nik} - ${row.name}`,
    'Titik Bagi': row.village,
    'Gapoktan': row.group,
    'Barang/Item': 'Bantuan Utama', // Default or could be dynamic
    'Qty': row.qty,
    'Nilai': row.calculatedValue
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Penerima');

  // Convert to binary array for download
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Rincian_Penerima_Import.xlsx');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
