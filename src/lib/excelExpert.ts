import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { cleanValue } from './dataCleaner';

/**
 * [ELITE-EXPORT-ENGINE]
 * A professional, styled Excel export utility that enforces high-fidelity data healing,
 * dual-line headers, and Indonesian-localized financial formatting.
 */

export interface ExcelExportOptions {
  sheetName?: string;
  filename?: string;
  headerMeta?: Record<string, string>; // Canonical -> Original
  summaryRows?: Record<string, any>[]; // Explicit footer rows
  columnStyles?: Record<string, { alignment?: 'left' | 'right' | 'center', numFmt?: string }>;
}

/**
 * Expert Numeric Parser: Handles Indonesian formatting, Scientific Notation, and Currency.
 * [FORMAT-ID] "Rp 1.234.567,89" -> 1234567.89
 * [FORMAT-NEG] "- Rp 5.000" -> -5000
 */
const parseNumberID = (val: any): number => {
  if (typeof val === 'number') return val;
  let s = String(val ?? '').trim();
  if (!s || s === '—' || s === '-') return 0;
  
  // 0. Preliminary Cleaning: Strip "Rp" and whitespace
  s = s.replace(/Rp\.?\s*/gi, '');
  const isNegative = s.includes('-') || s.includes('(');
  s = s.replace(/[^\d,\.]/g, ''); // Keep only digits and decimal separators
  
  if (!s) return 0;

  // 1. Detect Indonesian / Continental Formatting (Dots as thousands, comma as decimal)
  // e.g., "7.429.298,50" -> "7429298.50"
  const hasComma = s.includes(',');
  const hasMultipleDots = (s.match(/\./g) || []).length > 1;
  const endsWithDotTwoDigits = /\.\d{2}$/.test(s); // Indicator of English decimal
  
  let cleaned = s;
  if ((hasComma || hasMultipleDots) && !endsWithDotTwoDigits) {
    cleaned = s.replace(/\./g, '').replace(/,/g, '.');
  } else if (hasComma && endsWithDotTwoDigits) {
    // Weird hybrid "1,234.56"
    cleaned = s.replace(/,/g, '');
  } else if (!hasComma && !hasMultipleDots && s.includes('.')) {
    // Could be "1.000" (ID) or "1.50" (ENG)
    // Heuristic: if it's 3 digits after the dot, it's likely a thousands separator
    if (s.split('.')[1].length === 3) cleaned = s.replace(/\./g, '');
  }

  const num = parseFloat(cleaned);
  let finalNum = isNaN(num) ? 0 : num;
  return isNegative ? -Math.abs(finalNum) : finalNum;
};

export const exportStyledExcel = async (
  data: Record<string, any>[],
  headers: string[],
  options: ExcelExportOptions = {}
) => {
  const { 
    sheetName = 'Data Export', 
    filename = `export_${new Date().toISOString().split('T')[0]}.xlsx`,
    headerMeta = {},
    summaryRows = [],
    columnStyles = {}
  } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 2 }] // Freeze both header rows
  });

  // 1. Define Columns
  const columnDefs = headers.map(h => {
    const maxValLen = [...data, ...summaryRows].reduce((acc, row) => {
      const val = String(row[h] ?? '');
      return Math.max(acc, val.length);
    }, Math.max(h.length, (headerMeta[h] ?? '').length));

    return {
      header: h.replace(/_/g, ' ').toUpperCase(),
      key: h,
      width: Math.min(Math.max(maxValLen + 6, 15), 60),
    };
  });

  worksheet.columns = columnDefs;

  // 2. Build Dual-Line Header Styling
  const row1 = worksheet.getRow(1);
  const row2 = worksheet.addRow(headers.map(h => headerMeta[h] ? `(${headerMeta[h]})` : ''));

  row1.height = 36;
  row1.font = { name: 'Inter', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  row1.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  row2.height = 24;
  row2.font = { name: 'Inter', size: 8, italic: true, color: { argb: 'FFCBD5E1' } };
  row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  row2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  // 3. Populate Data Rows
  data.forEach((row, index) => {
    const rowValues: any = {};
    headers.forEach(h => {
      const rawVal = row[h];
      const hUpper = h.toUpperCase();
      
      const isIdentity = hUpper.includes('NIK') || hUpper === 'ID' || hUpper.includes('KTP') || 
                         hUpper.includes('HP') || hUpper.includes('TELEPON') || hUpper.includes('MOBILE') ||
                         hUpper.includes('SOURCE') || hUpper.includes('VA') || hUpper.includes('IDX') ||
                         hUpper.includes('ACCOUNT');
                         
      const isPrice = hUpper.includes('HARGA') || hUpper.includes('NOMINAL') || hUpper.includes('TOTAL') || 
                      hUpper.includes('PRICE') || hUpper.includes('VALUE') || hUpper.includes('ONGKOS') || 
                      hUpper.includes('KIRIM') || hUpper.includes('BIAYA') || hUpper.includes('TAX') ||
                      hUpper.includes('DPP') || hUpper.includes('PPN') || hUpper.includes('GROSS');
                      
      const isVolume = hUpper.includes('QTY') || hUpper.includes('VOLUME') || hUpper.includes('JUMLAH') || 
                       hUpper.includes('UNIT') || hUpper.includes('LUAS') || hUpper.includes('LAHAN') ||
                       hUpper.includes('PESTISIDA') || hUpper.includes('BENIH') || hUpper.includes('BIBIT') ||
                       hUpper.includes('(HA)') || hUpper.includes('(KG)') || hUpper.includes('(L)');

      const strVal = String(rawVal ?? '').trim();
      const isLikelyNumeric = strVal.length > 0 && 
                              strVal.length < 15 && 
                              /^-?\s*(Rp\.?\s*)?\d+([.,]\d+)*$/.test(strVal) &&
                              !isIdentity && 
                              !hUpper.includes('JADWAL') && 
                              !hUpper.includes('TANAM');

      if (isIdentity) {
        const digitsOnly = strVal.replace(/\D/g, '');
        rowValues[h] = digitsOnly.length > 0 ? { formula: `="${digitsOnly}"`, result: digitsOnly } : '';
      } else if (isPrice || isVolume || isLikelyNumeric) {
        rowValues[h] = parseNumberID(rawVal);
      } else {
        rowValues[h] = cleanValue(strVal, h);
      }
    });

    const newRow = worksheet.addRow(rowValues);
    newRow.height = 20;

    newRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      const hUpper = header.toUpperCase();
      const isNumeric = typeof cell.value === 'number';
      const colStyle = columnStyles[header];

      cell.font = { name: 'Inter', size: 9, color: { argb: 'FF1E293B' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (index % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }

      if (isNumeric) {
        // [FORMAT-LOGIC] Indices and IDs should be integers; Price/Volume should have decimals
        const isIntegerColumn = hUpper === '#' || hUpper === 'NO' || hUpper === 'NO.' || 
                               hUpper === 'NOMOR' || hUpper === 'ID' || hUpper === 'IDX';
        
        cell.alignment = { horizontal: colStyle?.alignment || (isIntegerColumn ? 'center' : 'right'), vertical: 'middle' };
        cell.numFmt = colStyle?.numFmt || (isIntegerColumn ? '0' : '#,##0.00');
      } else {
        cell.alignment = { horizontal: colStyle?.alignment || 'left', vertical: 'middle' };
        if (hUpper.includes('NIK') || hUpper.includes('HP')) {
           cell.numFmt = '@';
        }
      }
    });
  });

  // 4. Populate Summary Rows (Footer)
  summaryRows.forEach((row) => {
    const rowValues: any = {};
    headers.forEach(h => {
      const val = row[h];
      const hUpper = h.toUpperCase();
      const isNumericInput = typeof val === 'number' || (typeof val === 'string' && /^-?\d+([.,]\d+)*$/.test(val.replace(/Rp\.?\s*/gi, '')));
      
      if (isNumericInput) {
        rowValues[h] = parseNumberID(val);
      } else {
        rowValues[h] = val;
      }
    });

    const summaryRow = worksheet.addRow(rowValues);
    summaryRow.height = 24;
    summaryRow.font = { name: 'Inter', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    
    summaryRow.eachCell((cell, colNumber) => {
      const isNumeric = typeof cell.value === 'number';
      const header = headers[colNumber - 1];
      const hUpper = header.toUpperCase();
      const colStyle = columnStyles[header];

      const isIntegerColumn = hUpper === '#' || hUpper === 'NO' || hUpper === 'NO.' || 
                             hUpper === 'NOMOR' || hUpper === 'ID' || hUpper === 'IDX';

      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Light slate background
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (isNumeric) {
        cell.alignment = { horizontal: colStyle?.alignment || (isIntegerColumn ? 'center' : 'right'), vertical: 'middle' };
        cell.numFmt = colStyle?.numFmt || (isIntegerColumn ? '0' : '#,##0.00');
      } else {
        cell.alignment = { horizontal: colStyle?.alignment || 'left', vertical: 'middle' };
      }
    });
  });

  // 5. Finalize
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: data.length + 2, column: headers.length }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
};
