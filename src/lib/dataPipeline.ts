/**
 * dataPipeline.ts
 *
 * 4-stage data pipeline for contract file processing.
 *
 * Stage 1 — Ingest:     raw file bytes  → SourceRow[]   (source-specific adapters)
 * Stage 2 — Normalize:  SourceRow[]     → PipelineRow[] (per-field cleaners)
 * Stage 3 — FillDown:   propagate Provinsi/Kabupaten/Kecamatan/Desa down sparse rows
 * Stage 4 — Merge:      PDF primary rows merged with Excel financial rows (keyed on NIK)
 *
 * Single consumer interface: `runPipeline(source)` → PipelineResult
 */

import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import {
  CanonicalField,
  HEADER_ALIAS_MAP,
  headerToCanonical,
  normalizeJadwalTanam,
  normalizeNik,
  normalizeNumeric,
  normalizeString,
  normalizeSpesifikasi,
} from './pipelineSchema';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Raw field values straight from the source file — all strings, may be empty. */
export type RawFields = Partial<Record<CanonicalField, string>>;

/** One source row before normalization. */
export interface SourceRow {
  source: 'pdf' | 'excel';
  /** 0-based row index in the source document. */
  rowIndex: number;
  raw: RawFields;
  pageNumber?: number;
}

/** One fully-normalized row. Financial fields are numbers (0 when absent). */
export interface PipelineRow {
  rowId: string;
  source: 'pdf' | 'excel' | 'merged';
  pageNumber?: number;

  // Location (fill-down)
  provinsi:   string;
  kabupaten:  string;
  kecamatan:  string;
  desa:       string;

  // Identity
  group:      string;
  ketua:      string;
  nik:        string;
  phone:      string;

  // Farm data
  lokasiPertanaman: string;
  luasLahan:   number;
  titikKoordinat: string;
  qty:         number;
  spesifikasi: string;
  optDominan:  string;
  jadwalTanam: string;

  // Financials (Excel-sourced, default 0)
  unitPrice:   number;
  totalHarga:  number;
  ongkirUnit:  number;
  totalOngkir: number;
  totalValue:  number;
  bastValue:   number;

  // Document refs
  noBast:  string;
  noBatch: string;

  // Derived
  calculatedValue: number;
  gap:             number;
  isSynced:        boolean;
  isIncomplete:    boolean;

  // Duplicate flag set after dedup pass
  duplicateStatus: 'unique' | 'exact';
}

export interface PipelineResult {
  rows:               PipelineRow[];
  issues:             string[];
  totalTargetValue:   Decimal;
  totalCalculatedValue: Decimal;
  overallGap:         Decimal;
  discoveredHeaders:  string[];
}

// ─── Stage 1a: Excel ingestor ─────────────────────────────────────────────────

const IGNORED_SHEETS = new Set(['total','rekap','summary','sheet2','sheet3','form']);

/**
 * Parse an Excel ArrayBuffer into SourceRow[].
 * Uses pipelineSchema HEADER_ALIAS_MAP for column detection.
 */
export function ingestExcel(buffer: ArrayBuffer, contractYear = '2025'): {
  rows: SourceRow[];
  discoveredHeaders: string[];
  issues: string[];
} {
  const issues: string[] = [];
  const allRows: SourceRow[] = [];
  const allHeaders: string[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: true });
  } catch (e: any) {
    return { rows: [], discoveredHeaders: [], issues: [`Excel read error: ${e.message}`] };
  }

  for (const sheetName of wb.SheetNames) {
    if (IGNORED_SHEETS.has(sheetName.toLowerCase().trim())) continue;

    const ws = wb.Sheets[sheetName];
    const raw2d = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

    // Find header row (first row with ≥2 recognised signals)
    const HEADER_SIGNALS = ['nik','nama','provinsi','prov','insi','kabupaten','kecamatan',
      'desa','poktan','gapoktan','ketua','pestisida','qty','lahan','tanam','jadwal'];
    let headerIdx = -1;
    for (let i = 0; i < Math.min(raw2d.length, 20); i++) {
      const squished = raw2d[i].map((c: any) => String(c ?? '').replace(/[\r\n\s]/g,'').toLowerCase()).join(' ');
      if (HEADER_SIGNALS.filter(s => squished.includes(s)).length >= 2) { headerIdx = i; break; }
    }
    if (headerIdx === -1) {
      issues.push(`Sheet "${sheetName}": no recognisable header row`);
      continue;
    }

    // Build column → canonical map
    const headerRow: any[] = raw2d[headerIdx];
    const colMap = new Map<number, CanonicalField>();
    headerRow.forEach((cell: any, idx: number) => {
      const label = String(cell ?? '').replace(/[\r\n]/g,' ').trim();
      const canon = headerToCanonical(label);
      if (canon && !colMap.has(idx)) colMap.set(idx, canon);
      if (label) allHeaders.push(label);
    });

    // Data rows (skip totals / fully-empty)
    const dataRows = raw2d.slice(headerIdx + 1).filter((r: any[]) => {
      const text = r.map((c:any) => String(c ?? '')).join('').toLowerCase();
      if (!text.trim()) return false;
      if (/\btotal\b/.test(text) && !/\d{10,}/.test(text)) return false;
      return true;
    });

    dataRows.forEach((row: any[], i: number) => {
      const rawFields: RawFields = {};
      colMap.forEach((canon, colIdx) => {
        const v = String(row[colIdx] ?? '').replace(/[\r\n]/g,' ').trim();
        if (v) rawFields[canon] = v;
      });
      allRows.push({ source: 'excel', rowIndex: headerIdx + 1 + i, raw: rawFields });
    });
  }

  return { rows: allRows, discoveredHeaders: [...new Set(allHeaders)], issues };
}

// ─── Stage 1b: PDF ingestor ───────────────────────────────────────────────────

/** pdfjs text item (subset of the full spec used here). */
interface PdfjsItem { str: string; transform: number[]; width: number; }

/**
 * Parse pdfjs page text items into Y-band row objects.
 * Items within ±8 px Y are merged into the same logical row.
 */
function groupIntoBandRows(items: PdfjsItem[]): { y: number; tokens: { x: number; str: string }[] }[] {
  const bands = new Map<number, { x: number; str: string }[]>();

  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    const x = Math.round(item.transform[4]);

    let bandY: number | null = null;
    for (const by of bands.keys()) {
      if (Math.abs(by - y) <= 8) { bandY = by; break; }
    }
    if (bandY === null) { bandY = y; bands.set(bandY, []); }
    bands.get(bandY)!.push({ x, str: item.str });
  }

  return [...bands.entries()]
    .map(([y, tokens]) => ({ y, tokens: tokens.sort((a, b) => a.x - b.x) }))
    .sort((a, b) => b.y - a.y); // PDF Y is bottom-up; descending = top-to-bottom
}

/** Join adjacent split-digit tokens to recover 16-digit NIK. */
function joinSplitNik(tokens: { x: number; str: string }[]): { x: number; str: string }[] {
  const result: { x: number; str: string }[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (i + 1 < tokens.length) {
      const joined = tokens[i].str + tokens[i + 1].str;
      if (/^\d+$/.test(tokens[i].str) && /^\d+$/.test(tokens[i + 1].str) &&
          joined.length === 16) {
        result.push({ x: tokens[i].x, str: joined });
        i += 2;
        continue;
      }
    }
    result.push(tokens[i]);
    i++;
  }
  return result;
}

/** Assign each token to a column band by nearest X midpoint. */
function assignTokensToColumns(
  tokens: { x: number; str: string }[],
  colBands: { canon: CanonicalField; xMin: number; xMax: number }[]
): RawFields {
  const buckets = new Map<CanonicalField, string[]>();

  for (const tok of tokens) {
    // Find the best column for this token
    let best: CanonicalField | null = null;
    let bestDist = Infinity;
    for (const band of colBands) {
      if (tok.x >= band.xMin && tok.x <= band.xMax) { best = band.canon; break; }
      // Allow tokens slightly outside the band boundary
      const mid = (band.xMin + band.xMax) / 2;
      const dist = Math.abs(tok.x - mid);
      if (dist < bestDist) { bestDist = dist; best = band.canon; }
    }
    if (best) {
      if (!buckets.has(best)) buckets.set(best, []);
      buckets.get(best)!.push(tok.str);
    }
  }

  const raw: RawFields = {};
  buckets.forEach((strs, canon) => { raw[canon] = strs.join(' ').trim(); });
  return raw;
}

/**
 * Build column band definitions from accumulated header row tokens.
 *
 * Handles two PDF quirks:
 * 1. Wrapped cell text: same X position emits two tokens (e.g. "Poktan/Gapoktan/LMDH/Kopera" +
 *    "si/KTH/BPTPH/Brigade" both at x=86). Concatenated before matching.
 * 2. Split word: single word rendered as two tokens at adjacent X (e.g. "Kecamat"@x6 + "an"@x14).
 *    Tokens within 15px X of each other are merged.
 */
function buildColBands(
  headerTokens: { x: number; str: string }[]
): { canon: CanonicalField; xMin: number; xMax: number }[] {
  // Group tokens by X cluster (within 15px = same column header)
  const clusters: { x: number; strs: string[] }[] = [];
  for (const tok of [...headerTokens].sort((a, b) => a.x - b.x)) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(tok.x - last.x) <= 15) {
      last.strs.push(tok.str);
    } else {
      clusters.push({ x: tok.x, strs: [tok.str] });
    }
  }

  const mapped: { x: number; canon: CanonicalField }[] = [];
  for (const cluster of clusters) {
    // Try concatenated first, then each token individually
    const concat = cluster.strs.join('');
    const canon = headerToCanonical(concat) ??
                  cluster.strs.reduce<CanonicalField | null>((found, s) => found ?? headerToCanonical(s), null);
    if (canon) mapped.push({ x: cluster.x, canon });
  }

  mapped.sort((a, b) => a.x - b.x);

  // Deduplicate: keep first (leftmost) occurrence of each canonical field
  const seen = new Set<CanonicalField>();
  const unique = mapped.filter(m => { if (seen.has(m.canon)) return false; seen.add(m.canon); return true; });

  // Assign X ranges: each band ends where the next starts
  return unique.map((m, i) => ({
    canon:  m.canon,
    xMin:   i === 0 ? 0 : m.x - 5,
    xMax:   i + 1 < unique.length ? unique[i + 1].x - 1 : 9999,
  }));
}

/**
 * Ingest a PDF document instance (already loaded pdfjs doc).
 * Returns SourceRow[] from the Titik Bagi distribution table.
 */
export async function ingestPdf(
  doc: any,          // pdfjs PDFDocumentProxy
  contractYear = '2025'
): Promise<{ rows: SourceRow[]; issues: string[] }> {
  const issues: string[] = [];
  const TABLE_SIGNALS = ['nik','poktan','kecamatan','kabupaten','luaslahan','pestisida','jadwal'];

  // ── Find the page containing the Titik Bagi table ─────────────────────────
  let tablePageNum = -1;
  let tablePageItems: PdfjsItem[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfjsItem[] = content.items as PdfjsItem[];
    const flat = items.map(i => i.str.toLowerCase()).join(' ');
    const hits = TABLE_SIGNALS.filter(s => flat.includes(s));
    if (hits.length >= 4) {
      tablePageNum = p;
      tablePageItems = items;
      break;
    }
  }

  if (tablePageNum === -1) {
    issues.push('Titik Bagi table not found in PDF');
    return { rows: [], issues };
  }

  // ── Build header row bands from the first table page ─────────────────────
  const tableRows = groupIntoBandRows(tablePageItems);

  // Header rows are those whose combined text contains multiple TABLE_SIGNALS
  let colBands: { canon: CanonicalField; xMin: number; xMax: number }[] = [];
  const headerRowTokens: { x: number; str: string }[] = [];

  for (const row of tableRows) {
    const rowText = row.tokens.map(t => t.str.toLowerCase()).join(' ');
    const hits = TABLE_SIGNALS.filter(s => rowText.includes(s));
    if (hits.length >= 2) {
      // Multi-line header: accumulate tokens from all header rows
      headerRowTokens.push(...row.tokens);
    }
  }

  if (headerRowTokens.length > 0) {
    colBands = buildColBands(headerRowTokens);
  }

  if (colBands.length < 3) {
    issues.push(`Table page ${tablePageNum}: could only map ${colBands.length} column(s) from header`);
    // Fall back to NIK-only extraction
  }

  // ── Extract data rows from all pages from tablePageNum onward ────────────
  const allRows: SourceRow[] = [];
  const NIK_RE = /\b\d{16}\b/;

  for (let p = tablePageNum; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfjsItem[] = content.items as PdfjsItem[];
    const bandRows = groupIntoBandRows(items);

    for (const row of bandRows) {
      const tokens = joinSplitNik(row.tokens);
      const rowText = tokens.map(t => t.str).join(' ');

      // Only process rows that contain a NIK
      if (!NIK_RE.test(rowText)) continue;

      let rawFields: RawFields;
      if (colBands.length >= 3) {
        rawFields = assignTokensToColumns(tokens, colBands);
      } else {
        // Fallback: extract NIK only
        const nikMatch = rowText.match(/\b(\d{16})\b/);
        rawFields = { nik: nikMatch ? nikMatch[1] : '' };
      }

      allRows.push({ source: 'pdf', rowIndex: allRows.length, raw: rawFields, pageNumber: p });
    }
  }

  if (allRows.length === 0) {
    issues.push(`No recipient rows extracted from PDF (${doc.numPages} pages, table on page ${tablePageNum})`);
  }

  return { rows: allRows, issues };
}

// ─── Stage 2: Normalize ───────────────────────────────────────────────────────

function str(v: string | undefined): string {
  return normalizeString(v ?? '');
}

function num(v: string | undefined): number {
  return normalizeNumeric(v ?? '');
}

/** Normalize a single SourceRow into a PipelineRow (financials default to 0). */
function normalizeRow(src: SourceRow, idx: number, contractYear: string): PipelineRow {
  const r = src.raw;
  const nik = normalizeNik(r.nik ?? '');
  const qty = num(r.qty);
  const unitPrice = num(r.unitPrice);
  const ongkirUnit = num(r.ongkirUnit);
  const totalHarga = num(r.totalHarga);
  const totalOngkir = num(r.totalOngkir);
  const totalValue = num(r.totalValue);
  const bastValue = num(r.bastValue);

  const calculatedValue = new Decimal(unitPrice).plus(ongkirUnit).times(qty).toNumber();
  const targetValue = bastValue || totalValue || totalHarga;
  const gap = new Decimal(calculatedValue).minus(targetValue).toNumber();

  return {
    rowId:      `${src.source}-${idx}-${nik || Math.random().toString(36).slice(2)}`,
    source:     src.source,
    provinsi:   str(r.provinsi),
    kabupaten:  str(r.kabupaten),
    kecamatan:  str(r.kecamatan),
    desa:       str(r.desa),
    group:      str(r.group),
    ketua:      str(r.ketua),
    nik,
    phone:      str(r.phone),
    lokasiPertanaman: str(r.lokasiPertanaman),
    luasLahan:  num(r.luasLahan),
    titikKoordinat: str(r.titikKoordinat),
    qty,
    spesifikasi: normalizeSpesifikasi(r.spesifikasi ?? ''),
    optDominan:  str(r.optDominan),
    jadwalTanam: normalizeJadwalTanam(r.jadwalTanam ?? '', contractYear),
    unitPrice,
    totalHarga,
    ongkirUnit,
    totalOngkir,
    totalValue,
    bastValue,
    noBast:  str(r.noBast),
    noBatch: str(r.noBatch),
    calculatedValue,
    gap,
    isSynced:     Math.abs(gap) < 1 && !!nik,
    isIncomplete: !nik || qty === 0,
    duplicateStatus: 'unique',
    pageNumber: src.pageNumber,
  };
}

// ─── Stage 3: Fill-down ───────────────────────────────────────────────────────

const FILL_DOWN_FIELDS: (keyof PipelineRow)[] = ['provinsi','kabupaten','kecamatan','desa','group','ketua','luasLahan'];

/**
 * For rows where a location field is empty, inherit from the previous non-empty row.
 * Mutates rows in place.
 */
function applyFillDown(rows: PipelineRow[]): void {
  const last: Partial<Record<keyof PipelineRow, any>> = {};
  for (const row of rows) {
    for (const field of FILL_DOWN_FIELDS) {
      const v = row[field];
      if (v && v !== 0) {
        last[field] = v;
      } else if (last[field]) {
        (row as any)[field] = last[field];
      }
    }
  }
}

// ─── Stage 4: Merge ───────────────────────────────────────────────────────────

const FINANCIAL_FIELDS: (keyof PipelineRow)[] = [
  'unitPrice','totalHarga','ongkirUnit','totalOngkir','totalValue','bastValue',
  'calculatedValue','gap','isSynced',
];

/**
 * Merge PDF rows (identity + farm) with Excel rows (financials) keyed on NIK.
 * - PDF row is primary for all non-financial fields.
 * - Excel row supplies financial fields when present.
 * - Rows with no matching counterpart are kept as-is.
 */
export function mergeByNik(pdfRows: PipelineRow[], excelRows: PipelineRow[]): PipelineRow[] {
  const excelByNik = new Map<string, PipelineRow>();
  for (const row of excelRows) {
    if (row.nik) excelByNik.set(row.nik, row);
  }

  const merged: PipelineRow[] = [];
  const matchedNiks = new Set<string>();

  for (const pdfRow of pdfRows) {
    const excel = pdfRow.nik ? excelByNik.get(pdfRow.nik) : undefined;
    if (excel) {
      matchedNiks.add(pdfRow.nik);
      const mergedRow: PipelineRow = { ...pdfRow, source: 'merged' };
      for (const f of FINANCIAL_FIELDS) {
        (mergedRow as any)[f] = (excel as any)[f];
      }
      // Fill empty identity fields from Excel if PDF didn't extract them
      if (!mergedRow.ketua && excel.ketua) mergedRow.ketua = excel.ketua;
      if (!mergedRow.group && excel.group) mergedRow.group = excel.group;
      if (!mergedRow.phone && excel.phone) mergedRow.phone = excel.phone;
      if (!mergedRow.jadwalTanam && excel.jadwalTanam) mergedRow.jadwalTanam = excel.jadwalTanam;
      merged.push(mergedRow);
    } else {
      merged.push(pdfRow);
    }
  }

  // Append unmatched Excel rows (PDF not available for them)
  for (const excelRow of excelRows) {
    if (excelRow.nik && !matchedNiks.has(excelRow.nik)) {
      merged.push({ ...excelRow, source: 'excel' });
    }
  }

  return merged;
}

// ─── Dedup pass ───────────────────────────────────────────────────────────────

function markDuplicates(rows: PipelineRow[]): void {
  const registry = new Map<string, string[]>();
  rows.forEach(row => {
    const key = `${row.nik}|${row.ketua}|${row.qty}`;
    const list = registry.get(key) || [];
    list.push(row.rowId);
    registry.set(key, list);
  });
  rows.forEach(row => {
    const key = `${row.nik}|${row.ketua}|${row.qty}`;
    row.duplicateStatus = (registry.get(key)?.length ?? 1) > 1 ? 'exact' : 'unique';
  });
}

// ─── Pipeline totals ──────────────────────────────────────────────────────────

function computeTotals(rows: PipelineRow[]) {
  let totalTargetValue = new Decimal(0);
  let totalCalculatedValue = new Decimal(0);
  for (const row of rows) {
    const target = row.bastValue || row.totalValue || row.totalHarga;
    totalTargetValue = totalTargetValue.plus(target);
    totalCalculatedValue = totalCalculatedValue.plus(row.calculatedValue);
  }
  return {
    totalTargetValue,
    totalCalculatedValue,
    overallGap: totalCalculatedValue.minus(totalTargetValue),
  };
}

// ─── Main pipeline entry points ───────────────────────────────────────────────

/** Run from Excel buffer only. */
export function runExcelPipeline(
  buffer: ArrayBuffer,
  contractYear = '2025'
): PipelineResult {
  const { rows: srcRows, discoveredHeaders, issues } = ingestExcel(buffer, contractYear);
  const normalized = srcRows.map((s, i) => normalizeRow(s, i, contractYear));
  applyFillDown(normalized);
  markDuplicates(normalized);
  const totals = computeTotals(normalized);
  return { rows: normalized, issues, discoveredHeaders, ...totals };
}

/** Run from PDF doc only (pdfjs PDFDocumentProxy). */
export async function runPdfPipeline(
  doc: any,
  contractYear = '2025'
): Promise<PipelineResult> {
  const { rows: srcRows, issues } = await ingestPdf(doc, contractYear);
  const normalized = srcRows.map((s, i) => normalizeRow(s, i, contractYear));
  applyFillDown(normalized);
  markDuplicates(normalized);
  const totals = computeTotals(normalized);
  return { rows: normalized, issues, discoveredHeaders: [], ...totals };
}

/** Run merged pipeline: PDF primary, Excel financial layer. */
export async function runMergedPipeline(
  pdfDoc: any,
  excelBuffer: ArrayBuffer,
  contractYear = '2025'
): Promise<PipelineResult> {
  const [pdfResult, excelIngest] = await Promise.all([
    ingestPdf(pdfDoc, contractYear),
    Promise.resolve(ingestExcel(excelBuffer, contractYear)),
  ]);

  const pdfNorm = pdfResult.rows.map((s, i) => normalizeRow(s, i, contractYear));
  const excelNorm = excelIngest.rows.map((s, i) => normalizeRow(s, i, contractYear));

  applyFillDown(pdfNorm);
  applyFillDown(excelNorm);

  const merged = mergeByNik(pdfNorm, excelNorm);
  markDuplicates(merged);

  const totals = computeTotals(merged);
  const issues = [...pdfResult.issues, ...excelIngest.issues];

  return {
    rows: merged,
    issues,
    discoveredHeaders: excelIngest.discoveredHeaders,
    ...totals,
  };
}

// ─── Compat adapter: PipelineRow → ExcelRow ───────────────────────────────────
// Allows gradual migration — callers expecting ExcelRow can use this shim.

import { ExcelRow } from './excelParser';

export function toExcelRow(row: PipelineRow): ExcelRow {
  return {
    rowId:          row.rowId,
    gridRowIndex:   0,
    nik:            row.nik,
    name:           row.ketua,
    provinsi:       row.provinsi,
    kabupaten:      row.kabupaten,
    kecamatan:      row.kecamatan,
    village:        row.desa,
    group:          row.group,
    jadwalTanam:    row.jadwalTanam,
    qty:            row.qty,
    unitPrice:      row.unitPrice,
    shipping:       row.ongkirUnit,
    targetValue:    row.bastValue || row.totalValue || row.totalHarga,
    calculatedValue: row.calculatedValue,
    gap:            row.gap,
    isSynced:       row.isSynced,
    isIncomplete:   row.isIncomplete,
    duplicateStatus: row.duplicateStatus,
    originalValues: {} as any,
    columnData:     {},
  };
}
