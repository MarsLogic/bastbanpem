/**
 * learn-contracts.mjs
 *
 * Scans all PDF and Excel contract samples under a given directory.
 * Reports structure, headers, column patterns, and data quality issues
 * across all files — used to build the canonical field schema for dataPipeline.ts.
 *
 * Usage:
 *   node scripts/learn-contracts.mjs "C:/Users/Wyx/Desktop/Project 2026"
 *   node scripts/learn-contracts.mjs "C:/Users/Wyx/Desktop/Project 2026" --json
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename, dirname, relative } from 'path';
import XLSXModule from 'xlsx';
// xlsx has a default export in ESM context; named readFile lives on it
const XLSX = XLSXModule.default ?? XLSXModule;
// ─── DOMMatrix polyfill — must be set BEFORE pdfjs loads (hence dynamic import) ──
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0;
      this.m11=1;this.m12=0;this.m13=0;this.m14=0;
      this.m21=0;this.m22=1;this.m23=0;this.m24=0;
      this.m31=0;this.m32=0;this.m33=1;this.m34=0;
      this.m41=0;this.m42=0;this.m43=0;this.m44=1;
      this.is2D=true;this.isIdentity=true;
    }
    translate(){ return new globalThis.DOMMatrix(); }
    scale(){ return new globalThis.DOMMatrix(); }
    multiply(){ return new globalThis.DOMMatrix(); }
    inverse(){ return new globalThis.DOMMatrix(); }
    transformPoint(p){ return p || {x:0,y:0,z:0,w:1}; }
  };
}
if (typeof globalThis.DOMPoint === 'undefined') {
  globalThis.DOMPoint = class DOMPoint {
    constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w;}
    static fromPoint(p){ return new globalThis.DOMPoint(p.x,p.y,p.z,p.w); }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D { constructor(){} };
}

// Dynamic import ensures polyfill is in place before pdfjs module evaluates
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const ROOT = process.argv[2] || 'C:/Users/Wyx/Desktop/Project 2026';
const JSON_MODE = process.argv.includes('--json');
const OUT_FILE = 'scripts/learn-contracts-report.json';

// ─── PDF worker ────────────────────────────────────────────────────────────────
// Point to the bundled worker so Node.js doesn't need a browser environment
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
const require = createRequire(import.meta.url);
const workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, exts) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, exts));
    else if (exts.includes(extname(entry.name).toLowerCase())) results.push(full);
  }
  return results;
}

function squish(s) {
  return String(s || '').replace(/[\r\n\s]/g, '').toLowerCase();
}

function cleanCell(v) {
  return String(v ?? '').replace(/[\r\n]/g, ' ').trim();
}

// Detect if a row is a subtotal/total row (not a data row)
function isTotalRow(row) {
  const joined = row.map(cleanCell).join(' ').toLowerCase();
  return /\btotal\b/.test(joined) && !row.some(v => /\d{10,}/.test(String(v)));
}

// Detect the header row in a 2D array (returns index or -1)
function findHeaderRow(rows) {
  const HEADER_SIGNALS = ['nik','nama','provinsi','prov','insi','kabupaten','kecamatan',
    'desa','poktan','gapoktan','ketua','pestisida','qty','lahan','tanam','jadwal'];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const text = rows[i].map(c => squish(c)).join(' ');
    const hits = HEADER_SIGNALS.filter(s => text.includes(s));
    if (hits.length >= 2) return i;
  }
  return -1;
}

// Map a single raw header to a canonical field name guess
const ALIAS_MAP = {
  provinsi:  ['provinsi','prov','insi','propinsi'],
  kabupaten: ['kabupaten','kab ','kabupatenkota','kabkota'],
  kecamatan: ['kecamatan','kec ','kecama'],
  desa:      ['desa','kelurahan'],
  group:     ['poktan','gapoktan','kelompok','lmdh','brigade','bptph','koperasi','kwt','kth'],
  ketua:     ['ketua','penerima','namapenerima'],
  nik:       ['nik','nomorktp','nomorinduk'],
  phone:     ['nohp','hp','telepon','handphone'],
  luasLahan: ['luaslahan','luas','hektar'],
  qty:       ['pestisida','jumlah','qty','latauk','litekataukg','volume'],
  spesifikasi:['spesifikasi','jenisbantuan'],
  optDominan:['optdominan','opt','hama'],
  jadwalTanam:['jadwaltanam','jadwal','tanam','jadwaltana','bulantanam'],
  unitPrice: ['hargabarangsatuan','hargasatuan','unitprice','harga'],
  totalHarga:['jumlahtotalhargasatuan','totalharga'],
  ongkirUnit:['ongkoskirimsatuan','ongkirsatuan','ongkir'],
  totalOngkir:['jumlahtotalongkoskirim','totalongkir'],
  bastValue: ['jumlahnominalyang','nilbast','nominalbast'],
};

function guessCanonical(header) {
  const s = squish(header);
  for (const [canon, aliases] of Object.entries(ALIAS_MAP)) {
    if (aliases.some(a => s.includes(a))) return canon;
  }
  return null;
}

// ─── Excel Analyser ───────────────────────────────────────────────────────────

function analyseExcel(filePath) {
  const result = {
    file: relative(ROOT, filePath),
    type: 'excel',
    sheets: [],
    issues: [],
  };

  let wb;
  try {
    wb = XLSX.readFile(filePath, { cellDates: true, cellNF: true });
  } catch (e) {
    result.issues.push(`READ ERROR: ${e.message}`);
    return result;
  }

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const headerIdx = findHeaderRow(raw);
    if (headerIdx === -1) {
      result.sheets.push({ name: sheetName, note: 'no header row detected', rowCount: raw.length });
      continue;
    }

    const headerRow = raw[headerIdx];
    const dataRows = raw.slice(headerIdx + 1).filter(r =>
      r.some(c => c !== '') && !isTotalRow(r)
    );

    // Column map
    const colMap = {};
    const rawHeaders = [];
    headerRow.forEach((h, i) => {
      if (!h) return;
      const label = cleanCell(h);
      const canon = guessCanonical(label);
      rawHeaders.push({ col: i, label, canon: canon || '?' });
      if (canon) colMap[canon] = i;
    });

    // Sample NIK patterns
    const nikSamples = [];
    if (colMap.nik !== undefined) {
      dataRows.slice(0, 5).forEach(r => {
        const v = cleanCell(r[colMap.nik]);
        if (v) nikSamples.push(v);
      });
    }

    // Sample jadwalTanam patterns
    const jadwalSamples = [];
    if (colMap.jadwalTanam !== undefined) {
      const seen = new Set();
      dataRows.forEach(r => {
        const v = cleanCell(r[colMap.jadwalTanam]);
        if (v && !seen.has(v)) { seen.add(v); jadwalSamples.push(v); }
      });
    }

    // Sample location fill-down check: how many rows have empty provinsi?
    let emptyProv = 0, emptyKab = 0;
    if (colMap.provinsi !== undefined) {
      dataRows.forEach(r => { if (!cleanCell(r[colMap.provinsi])) emptyProv++; });
    }
    if (colMap.kabupaten !== undefined) {
      dataRows.forEach(r => { if (!cleanCell(r[colMap.kabupaten])) emptyKab++; });
    }

    // Financial columns present?
    const hasFinancials = !!(colMap.unitPrice || colMap.totalHarga || colMap.ongkirUnit || colMap.bastValue);

    const sheetInfo = {
      name: sheetName,
      headerRowIdx: headerIdx,
      dataRowCount: dataRows.length,
      columns: rawHeaders,
      canonicalCoverage: Object.keys(colMap),
      hasFinancials,
      nikSamples,
      jadwalSamples: jadwalSamples.slice(0, 8),
      fillDown: { emptyProv, emptyKab, totalRows: dataRows.length },
    };

    // Flag issues
    if (!colMap.nik) result.issues.push(`Sheet "${sheetName}": NIK column not found`);
    if (!colMap.ketua && !colMap.group) result.issues.push(`Sheet "${sheetName}": No group/ketua column`);
    if (emptyProv === dataRows.length && dataRows.length > 0)
      result.issues.push(`Sheet "${sheetName}": Provinsi always empty (merged cell / fill-down needed)`);

    result.sheets.push(sheetInfo);
  }

  return result;
}

// ─── PDF Analyser ─────────────────────────────────────────────────────────────

async function analysePdf(filePath) {
  const result = {
    file: relative(ROOT, filePath),
    type: 'pdf',
    pageCount: 0,
    contractMeta: {},
    titikBagi: { found: false, headerRow: [], sampleRows: [], dataRowCount: 0, issues: [] },
    rawHeaderVariants: [],
    issues: [],
  };

  let doc;
  try {
    const data = new Uint8Array(readFileSync(filePath));
    doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  } catch (e) {
    result.issues.push(`PDF LOAD ERROR: ${e.message}`);
    return result;
  }

  result.pageCount = doc.numPages;

  // Extract text page by page
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines = [];
    let lastY = null;
    let lineBuffer = [];
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (lineBuffer.length) lines.push(lineBuffer.join(' ').trim());
        lineBuffer = [];
      }
      lineBuffer.push(item.str);
      lastY = y;
    }
    if (lineBuffer.length) lines.push(lineBuffer.join(' ').trim());
    pages.push(lines.filter(l => l.length > 0));
  }

  // ── Contract metadata (page 1) ────────────────────────────────────────────
  const page1 = pages[0] || [];
  const metaPatterns = [
    { key: 'nomorKontrak',  re: /(?:nomor|no\.?)\s*(?:surat\s*)?(?:pesanan|kontrak|sp)[\s:]*([A-Z0-9\-\/]+)/i },
    { key: 'tanggalKontrak',re: /(?:tanggal|tgl)[\s:]*(\d{1,2}[\s\-\/]\w+[\s\-\/]\d{4})/i },
    { key: 'namaPenyedia',  re: /(?:penyedia|vendor|supplier|nama\s+perusahaan)[\s:]*([^\n]+)/i },
    { key: 'namaBarang',    re: /(?:nama\s+(?:barang|produk)|komoditas)[\s:]*([^\n]+)/i },
    { key: 'totalVolume',   re: /(?:total|jumlah)\s+(?:volume|pesanan|kebutuhan)[\s:]*([0-9,.\s]+(?:liter|kg|l)?)/i },
    { key: 'nilaiKontrak',  re: /(?:nilai|harga|total\s+nilai|total\s+pembayaran)[\s:]*(?:rp\.?\s*)?([\d.,]+)/i },
  ];

  const fullPage1 = page1.join(' ');
  for (const { key, re } of metaPatterns) {
    const m = fullPage1.match(re);
    if (m) result.contractMeta[key] = m[1].trim();
  }

  // Try to get EP number from filename
  const epMatch = basename(filePath).match(/EP-([A-Z0-9]+)/i);
  if (epMatch) result.contractMeta.epId = epMatch[1];

  // ── Find Titik Bagi table ─────────────────────────────────────────────────
  // Look for the table header (NIK + Poktan + location keywords)
  const TABLE_SIGNALS = ['nik','poktan','kecamatan','kabupaten','luas lahan','pestisida','jadwal'];
  let tableStartPage = -1;
  let tableHeaderLines = [];

  for (let p = 0; p < pages.length; p++) {
    const text = pages[p].join(' ').toLowerCase();
    const hits = TABLE_SIGNALS.filter(s => text.includes(s));
    if (hits.length >= 4) {
      tableStartPage = p;
      // Find the actual header line(s)
      for (const line of pages[p]) {
        const l = line.toLowerCase();
        if (TABLE_SIGNALS.some(s => l.includes(s))) {
          tableHeaderLines.push(line);
        }
      }
      break;
    }
  }

  if (tableStartPage === -1) {
    result.titikBagi.issues.push('Titik Bagi table not found in PDF');
    return result;
  }

  result.titikBagi.found = true;
  result.titikBagi.tableStartPage = tableStartPage + 1;
  result.titikBagi.headerRow = tableHeaderLines.slice(0, 3);

  // ── Collect all text lines from table pages ───────────────────────────────
  // Scan all pages from table start, collect NIK-bearing rows
  // NIK is 16 digits — sometimes pdfjs splits into two tokens on one line
  // Match: exactly 16 digits, OR 12-15 digits followed by space and 1-4 digits (split token)
  const NIK_RE = /\b(\d{16}|\d{12,15}\s+\d{1,4})\b/;
  const dataLines = [];
  let dataRowCount = 0;

  for (let p = tableStartPage; p < pages.length; p++) {
    for (const line of pages[p]) {
      if (NIK_RE.test(line)) {
        dataRowCount++;
        dataLines.push(line);
      }
    }
  }

  result.titikBagi.dataRowCount = dataRowCount;
  result.titikBagi.sampleRows = dataLines.slice(0, 5);

  // ── Collect unique column header variants ─────────────────────────────────
  // Gather all lines from the first table page that look like headers
  const headerVariants = new Set();
  for (const line of pages[tableStartPage]) {
    const l = line.toLowerCase();
    if (TABLE_SIGNALS.some(s => l.includes(s))) {
      headerVariants.add(line.trim());
    }
  }
  result.rawHeaderVariants = [...headerVariants];

  // ── Detect jadwalTanam variants in this PDF ───────────────────────────────
  // Only match lines that look like a schedule cell: short, starts/ends with month word
  // Exclude lines that contain NIK-like digits or long text (names, addresses)
  const MONTH_FULL = /^[\s\-]*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|sep|okt|nov|des)[\w\s\-]*(\d{4})?[\s\-]*$/i;
  const jadwalSeen = new Set();
  for (let p = tableStartPage; p < pages.length; p++) {
    for (const line of pages[p]) {
      const trimmed = line.trim();
      // Skip NIK lines, skip long lines (>30 chars likely a name/address)
      if (/\d{10,}/.test(trimmed)) continue;
      if (trimmed.length > 35) continue;
      if (MONTH_FULL.test(trimmed)) jadwalSeen.add(trimmed);
    }
  }
  result.titikBagi.jadwalVariants = [...jadwalSeen].slice(0, 30);

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nScanning: ${ROOT}\n${'─'.repeat(60)}`);

  const pdfFiles  = walkDir(ROOT, ['.pdf']);
  const xlsxFiles = walkDir(ROOT, ['.xlsx', '.xls']);

  console.log(`Found ${pdfFiles.length} PDFs, ${xlsxFiles.length} Excel files\n`);

  const report = {
    scannedAt: new Date().toISOString(),
    root: ROOT,
    summary: { pdfs: pdfFiles.length, excels: xlsxFiles.length },
    pdfs: [],
    excels: [],
    aggregates: {},
  };

  // ── Analyse PDFs ──────────────────────────────────────────────────────────
  console.log('Analysing PDFs...');
  for (const f of pdfFiles) {
    process.stdout.write(`  ${basename(f)} ... `);
    const r = await analysePdf(f);
    report.pdfs.push(r);
    const flag = r.issues.length ? `⚠  ${r.issues[0]}` :
                 r.titikBagi.found ? `✓  ${r.titikBagi.dataRowCount} recipients, page ${r.titikBagi.tableStartPage}` :
                 '✗  no Titik Bagi table';
    console.log(flag);
  }

  // ── Analyse Excel files ───────────────────────────────────────────────────
  console.log('\nAnalysing Excel files...');
  for (const f of xlsxFiles) {
    process.stdout.write(`  ${basename(f)} ... `);
    const r = analyseExcel(f);
    report.excels.push(r);
    const mainSheet = r.sheets[0];
    if (!mainSheet) { console.log('⚠  no sheets'); continue; }
    const flag = r.issues.length ? `⚠  ${r.issues[0]}` :
      mainSheet.canonicalCoverage
        ? `✓  ${mainSheet.dataRowCount} rows | cols: ${mainSheet.canonicalCoverage.join(', ')}`
        : `⚠  ${mainSheet.note || 'no header detected'} (${mainSheet.rowCount} raw rows)`;
    console.log(flag);
  }

  // ── Aggregates ────────────────────────────────────────────────────────────
  // Collect all unique jadwal variants across all sources
  const allJadwal = new Set();
  report.pdfs.forEach(p => (p.titikBagi.jadwalVariants || []).forEach(v => allJadwal.add(v)));
  report.excels.forEach(e =>
    e.sheets.forEach(s => (s.jadwalSamples || []).forEach(v => allJadwal.add(v)))
  );

  // Collect all raw Excel header labels seen
  const allHeaders = new Map(); // label → count
  report.excels.forEach(e =>
    e.sheets.forEach(s =>
      (s.columns || []).forEach(c => {
        allHeaders.set(c.label, (allHeaders.get(c.label) || 0) + 1);
      })
    )
  );

  // Collect NIK format patterns
  const nikPatterns = new Map();
  report.excels.forEach(e =>
    e.sheets.forEach(s =>
      (s.nikSamples || []).forEach(n => {
        const key = n.includes('\r') || n.includes('\n') ? 'multiline' :
                    /\D/.test(n) ? 'has-non-digit' : `${n.replace(/\D/g,'').length}-digits`;
        nikPatterns.set(key, (nikPatterns.get(key) || 0) + 1);
      })
    )
  );

  // PDFs with/without Titik Bagi
  const titikBagiFound  = report.pdfs.filter(p => p.titikBagi.found).length;
  const titikBagiFailed = report.pdfs.filter(p => !p.titikBagi.found && !p.issues.length).length;

  report.aggregates = {
    jadwalTanamVariants: [...allJadwal].sort(),
    headerLabelsFrequency: Object.fromEntries([...allHeaders.entries()].sort((a,b) => b[1]-a[1])),
    nikFormatPatterns: Object.fromEntries(nikPatterns),
    titikBagi: { found: titikBagiFound, notFound: titikBagiFailed, errors: report.pdfs.filter(p=>p.issues.length).length },
    excelFinancialSheets: report.excels.filter(e => e.sheets.some(s => s.hasFinancials)).length,
  };

  // ── Output ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('AGGREGATES');
  console.log('═'.repeat(60));
  console.log(`\nPDF Titik Bagi: ${titikBagiFound} found / ${report.pdfs.length} total`);
  console.log(`Excel with financials: ${report.aggregates.excelFinancialSheets} / ${report.excels.length}`);

  console.log('\nNIK format patterns:');
  for (const [k,v] of Object.entries(report.aggregates.nikFormatPatterns)) {
    console.log(`  ${k}: ${v} occurrences`);
  }

  console.log('\nJadwal Tanam variants found across all files:');
  report.aggregates.jadwalTanamVariants.forEach(v => console.log(`  "${v}"`));

  console.log('\nTop 30 Excel header labels (by frequency):');
  Object.entries(report.aggregates.headerLabelsFrequency)
    .slice(0, 30)
    .forEach(([k,v]) => console.log(`  [${v}x] ${k}`));

  // PDFs where Titik Bagi was not found
  const missing = report.pdfs.filter(p => !p.titikBagi.found);
  if (missing.length) {
    console.log(`\nPDFs without Titik Bagi (${missing.length}):`);
    missing.forEach(p => console.log(`  ${p.file}  ${p.issues[0] || ''}`));
  }

  if (JSON_MODE || true) {
    writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
    console.log(`\nFull report → ${OUT_FILE}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
