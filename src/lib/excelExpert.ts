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
}

/**
 * Expert Numeric Parser: Handles Indonesian formatting and Scientific Notation.
 * [FORMAT-ID] "1.234.567,89" -> 1234567.89
 * [FORMAT-ENG] "1,234,567.89" -> 1234567.89
 * [FORMAT-SCI] "1.023e+7" -> 10230000
 */
const parseNumberID = (val: any): number => {
  if (typeof val === 'number') return val;
  const s = String(val ?? '').trim();
  if (!s || s === '—' || s === '-') return 0;
  
  // 1. Detect Scientific Notation or Standard English Decimal (Single dot, no spaces)
  if (/^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(s)) {
    return parseFloat(s);
  }
  
  // 2. Detect Indonesian Formatting (Dots as thousands, comma as decimal)
  // e.g., "7.429.298,50" -> "7429298.50"
  // Note: Only strip dots if there is a comma or multiple dots (indicators of ID fmt)
  const hasComma = s.includes(',');
  const hasMultipleDots = (s.match(/\./g) || []).length > 1;
  
  if (hasComma || hasMultipleDots) {
    const cleaned = s.replace(/\./g, '').replace(/,/g, '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  
  // 3. Last resort fallback
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
};

export const exportStyledExcel = async (
  data: Record<string, any>[],
  headers: string[],
  options: ExcelExportOptions = {}
) => {
  const { 
    sheetName = 'Recipient List', 
    filename = `export_${new Date().toISOString().split('T')[0]}.xlsx`,
    headerMeta = {}
  } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 2 }] // Freeze both header rows
  });

  // 1. Define Columns
  const columnDefs = headers.map(h => {
    const maxValLen = data.reduce((acc, row) => {
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

  // 3. Populate Data
  data.forEach((row, index) => {
    const rowValues: any = {};
    headers.forEach(h => {
      const rawVal = row[h];
      const hUpper = h.toUpperCase();
      
      const isIdentity = hUpper.includes('NIK') || hUpper === 'ID' || hUpper.includes('KTP') || 
                         hUpper.includes('HP') || hUpper.includes('TELEPON') || hUpper.includes('MOBILE') ||
                         hUpper.includes('SOURCE') || hUpper.includes('VA') || hUpper.includes('IDX');
                         
      const isPrice = hUpper.includes('HARGA') || hUpper.includes('NOMINAL') || hUpper.includes('TOTAL') || 
                      hUpper.includes('PRICE') || hUpper.includes('VALUE') || hUpper.includes('ONGKOS') || 
                      hUpper.includes('KIRIM') || hUpper.includes('BIAYA');
                      
      const isVolume = hUpper.includes('QTY') || hUpper.includes('VOLUME') || hUpper.includes('JUMLAH') || 
                       hUpper.includes('UNIT') || hUpper.includes('LUAS') || hUpper.includes('LAHAN') ||
                       hUpper.includes('PESTISIDA') || hUpper.includes('BENIH') || hUpper.includes('BIBIT') ||
                       hUpper.includes('(HA)') || hUpper.includes('(KG)') || hUpper.includes('(L)');

      const strVal = String(rawVal ?? '').trim();
      const isLikelyNumeric = strVal.length > 0 && 
                              strVal.length < 15 && // 15+ digits triggers scientific notation truncation in Excel
                              /^-?\d+([.,]\d+)*$/.test(strVal) &&
                              !isIdentity && 
                              !hUpper.includes('JADWAL') && 
                              !hUpper.includes('TANAM');

      if (isIdentity) {
        // [IDENTITY-SECURE] Force plain continuous string (NO SPACES)
        const digitsOnly = strVal.replace(/\D/g, '');
        // Use formula "="..."" to suppress the green triangle warning for numbers stored as text
        rowValues[h] = { formula: `="${digitsOnly}"`, result: digitsOnly };
      } else if (isPrice || isVolume || isLikelyNumeric) {
        rowValues[h] = parseNumberID(rawVal);
      } else {
        rowValues[h] = cleanValue(strVal, h);
      }
    });

    const newRow = worksheet.addRow(rowValues);
    newRow.height = 20;

    // 4. Cell Styling & Alignment
    newRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      const hUpper = header.toUpperCase();
      const isNumeric = typeof cell.value === 'number';

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
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        if (hUpper.includes('NIK') || hUpper.includes('HP')) {
           cell.numFmt = '@'; // Force text format
        }
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
