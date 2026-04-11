import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import { HEADER_DICTIONARY, formatDataString, normalizeLabel } from './normalization';

export interface ExcelRow {
  nik: string;
  name: string;
  provinsi: string;
  kabupaten: string;
  kecamatan: string;
  village: string;
  group: string;
  jadwalTanam: string;
  qty: number;
  unitPrice: number;
  shipping: number;
  targetValue: number;
  calculatedValue: number;
  gap: number;
  isSynced: boolean;
  rowId: string;
  gridRowIndex: number;
  duplicateStatus?: 'exact' | 'partial' | 'unique';
  isExcluded?: boolean;
  originalValues: Record<string, any>;
  editedValues?: Record<string, any>;
  isIncomplete?: boolean;
  columnData: Record<string, any>; // Stores all original column data
}

export interface ParseResult {
  rows: ExcelRow[];
  totalTargetValue: Decimal;
  totalCalculatedValue: Decimal;
  overallGap: Decimal;
  discoveredHeaders: string[];
}

export interface ColMap {
  [key: string]: number;
}

export interface CleanedRow {
  originalRowIndex: number;
  data: any[];
}

export interface SheetMetadata {
  sheetName: string;
  grid: CleanedRow[];
  firstDataRowIdx: number;
  headers: string[];
  suggestedMap: ColMap;
  hasNikPattern: boolean;
}

export const PARSER_CONFIG = {
  HEADER_LOOKBACK_LIMIT: 3,
  MATCH_WEIGHTS: {
    EXACT: 50,
    BOUNDARY: 15,
    SUBSTRING: 5,
    LONG_HEADER_PENALTY: -10,
    LONG_HEADER_THRESHOLD: 40
  },
  IGNORED_SHEETS: ['total', 'rekap', 'summary', 'sheet2', 'sheet3', 'form']
};

export const parseJadwalTanam = (val: string, fallbackYear: string): { text: string, year: string } => {
    if (!val || typeof val !== 'string') return { text: val, year: fallbackYear };
    let finalYear = fallbackYear || "2025";
    const yearMatch = val.match(/\b(202\d)\b/);
    if (yearMatch) finalYear = yearMatch[1];
    let str = val.toLowerCase().replace(/[^\w\s\-]/g, ' ').replace(/\s*-\s*/g, '-');
    str = str.replace(/\bokmar\b/g, 'oktober-maret');
    return { text: formatDataString(str), year: finalYear };
};

export const ingestWorkbook = (buffer: ArrayBuffer): XLSX.WorkBook => {
  return XLSX.read(buffer, { type: 'array', cellStyles: true, cellDates: true, cellNF: true });
};

export const extractSheetMetadata = (wb: XLSX.WorkBook, sheetName: string): SheetMetadata => {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet ${sheetName} not found.`);
  const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  
  const headers: string[] = [];
  let firstDataRowIdx = 0;
  
  // Advanced header detection
  for (let i = 0; i < Math.min(rawData.length, 25); i++) {
     const row = rawData[i];
     if (row.some(c => {
         const s = String(c).toLowerCase();
         return s.includes('nik') || s.includes('nama') || s.includes('insi') || s.includes('kabupaten');
     })) {
        headers.push(...row.map(c => normalizeLabel(String(c || '').trim())));
        firstDataRowIdx = i + 1;
        break;
     }
  }

  const suggestedMap: ColMap = {};
  headers.forEach((h, idx) => {
     const clean = h.toLowerCase();
     if (clean.includes('nik')) suggestedMap.nik = idx;
     else if (clean.includes('nama') || clean.includes('penerima') || clean.includes('ketua')) suggestedMap.name = idx;
     else if (clean.includes('provinsi') || clean === 'insi') suggestedMap.provinsi = idx;
     else if (clean.includes('kabupaten')) suggestedMap.kabupaten = idx;
     else if (clean.includes('kecamatan')) suggestedMap.kecamatan = idx;
     else if (clean.includes('desa') || clean.includes('kelurahan')) suggestedMap.village = idx;
     else if (clean.includes('qty') || clean.includes('jumlah') || clean.includes('liter')) suggestedMap.qty = idx;
     else if (clean.includes('harga') || clean.includes('unit')) suggestedMap.unitPrice = idx;
     else if (clean.includes('ongkir') || clean.includes('kirim')) suggestedMap.shipping = idx;
     else if (clean.includes('target') || clean.includes('pagu') || clean.includes('jumlah total harga')) suggestedMap.targetValue = idx;
     else if (clean.includes('kelompok') || clean.includes('poktan')) suggestedMap.group = idx;
     else if (clean.includes('tanam') || clean.includes('jadwal')) suggestedMap.jadwalTanam = idx;
  });

  return {
    sheetName,
    grid: rawData.map((data, i) => ({ originalRowIndex: i, data })),
    firstDataRowIdx,
    headers,
    suggestedMap,
    hasNikPattern: suggestedMap.nik !== -1
  };
};

export const processMappedData = (metadata: SheetMetadata, colMap: ColMap, resolveLocation?: Function): ParseResult => {
  const processedRows: ExcelRow[] = [];
  let totalTargetValue = new Decimal(0);
  let totalCalculatedValue = new Decimal(0);

  const activeGrid = metadata.grid;
  // Fill down state
  const state = { prov: '', kab: '', kec: '', desa: '', group: '', lastNik: '', lastName: '', year: '2025' };

  for (let idx = metadata.firstDataRowIdx; idx < activeGrid.length; idx++) {
    const gridItem = activeGrid[idx];
    const rawRow = gridItem.data;
    if (!rawRow || rawRow.length === 0) continue;
    
    // Fill-down Logic
    const getVal = (idx: number) => String(rawRow[idx] || '').trim();
    if (colMap.provinsi !== -1) { const v = getVal(colMap.provinsi); if (v) state.prov = v; }
    if (colMap.kabupaten !== -1) { const v = getVal(colMap.kabupaten); if (v) state.kab = v; }
    if (colMap.kecamatan !== -1) { const v = getVal(colMap.kecamatan); if (v) state.kec = v; }
    if (colMap.village !== -1) { const v = getVal(colMap.village); if (v) state.desa = v; }
    if (colMap.group !== -1) { const v = getVal(colMap.group); if (v) state.group = v; }

    // Cleaning & Extraction
    let nik = String(rawRow[colMap.nik] || '').replace(/\D/g, '');
    if (!nik && state.lastNik) nik = state.lastNik; // Sub-row inherit
    else if (nik) state.lastNik = nik;

    let name = formatDataString(getVal(colMap.name));
    if (!name && state.lastName) name = state.lastName;
    else if (name) state.lastName = name;

    if (!nik && !name) continue; // Skip truly empty lines (totals/footer)

    // Location Auto-Fix via Official DB
    let prov = state.prov, kab = state.kab, kec = state.kec, desa = state.desa;
    if (resolveLocation) {
        const resolved = resolveLocation({ provinsi: prov, kabupaten: kab, kecamatan: kec, desa });
        if (resolved) {
            prov = resolved.provinsi;
            kab = resolved.kabupaten;
            kec = resolved.kecamatan;
            desa = resolved.desa;
        }
    }

    const getNum = (colIdx: number) => {
        if (colIdx === -1 || colIdx === undefined) return new Decimal(0);
        const val = rawRow[colIdx];
        if (val == null || val === '') return new Decimal(0);
        if (typeof val === 'number') return isNaN(val) ? new Decimal(0) : new Decimal(val);
        const str = String(val).replace(/rp|idr/gi, '').replace(/[^\d.]/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? new Decimal(0) : new Decimal(num);
    };

    const qty = getNum(colMap.qty);
    const unitPrice = getNum(colMap.unitPrice);
    const shipping = getNum(colMap.shipping);
    const targetValue = getNum(colMap.targetValue);
    
    const calculatedValue = unitPrice.plus(shipping).times(qty);
    const gap = calculatedValue.minus(targetValue);

    const columnData: Record<string, any> = {};
    metadata.headers.forEach((h, i) => { columnData[h] = rawRow[i]; });

    const rowData: ExcelRow = {
        rowId: `row-${gridItem.originalRowIndex}-${nik || Math.random()}`,
        gridRowIndex: gridItem.originalRowIndex,
        nik, name, provinsi: prov, kabupaten: kab, kecamatan: kec, village: desa, group: state.group,
        jadwalTanam: parseJadwalTanam(getVal(colMap.jadwalTanam), state.year).text,
        qty: qty.toNumber(), unitPrice: unitPrice.toNumber(), shipping: shipping.toNumber(), 
        targetValue: targetValue.toNumber(), calculatedValue: calculatedValue.toNumber(),
        gap: gap.toNumber(), isSynced: gap.abs().lt(1) && !!nik,
        isIncomplete: !nik || qty.isZero(),
        originalValues: {} as any, 
        columnData
    };
    // Deep clone original values for true reset capability
    rowData.originalValues = JSON.parse(JSON.stringify(rowData));
    processedRows.push(rowData);

    totalTargetValue = totalTargetValue.plus(targetValue);
    totalCalculatedValue = totalCalculatedValue.plus(calculatedValue);
  }

  // Duplicate Detection (100% Match)
  const exactRegistry = new Map<string, string[]>();
  processedRows.forEach(row => {
      const hash = JSON.stringify(row.columnData);
      const list = exactRegistry.get(hash) || [];
      list.push(row.rowId);
      exactRegistry.set(hash, list);
  });

  processedRows.forEach(row => {
      const hash = JSON.stringify(row.columnData);
      const list = exactRegistry.get(hash) || [];
      if (list.length > 1) row.duplicateStatus = 'exact';
      else row.duplicateStatus = 'unique';
  });

  return { 
    rows: processedRows, 
    totalTargetValue, 
    totalCalculatedValue, 
    overallGap: totalCalculatedValue.minus(totalTargetValue),
    discoveredHeaders: metadata.headers
  };
};

export const applyMagicBalance = (rows: ExcelRow[], targetTotal: Decimal): ExcelRow[] => {
  if (!rows || rows.length === 0) return rows;
  const currentTotal = rows.reduce((acc, row) => acc.plus(row.calculatedValue), new Decimal(0));
  const diff = targetTotal.minus(currentTotal);
  if (diff.isZero()) return rows;
  let targetIdx = -1, maxPrio = -1;
  rows.forEach((r, i) => { if (!r.isExcluded && r.qty > 0 && r.calculatedValue > maxPrio) { maxPrio = r.calculatedValue; targetIdx = i; } });
  if (targetIdx === -1) return rows;
  const newRows = [...rows];
  const row = { ...newRows[targetIdx] };
  row.shipping = new Decimal(row.shipping).plus(diff.div(row.qty)).toNumber();
  row.calculatedValue = new Decimal(row.unitPrice).plus(row.shipping).times(row.qty).toNumber();
  row.gap = new Decimal(row.calculatedValue).minus(row.targetValue).toNumber();
  newRows[targetIdx] = row;
  return newRows;
};

