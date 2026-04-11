/**
 * test-pdf-extraction.mjs
 *
 * Validates the Y-band + X-column PDF extraction logic against a real PDF.
 * Prints: header detection, column bands, first N rows with field assignments.
 *
 * Usage:
 *   node scripts/test-pdf-extraction.mjs "<path-to-pdf>" [--rows=20]
 */

import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

// ── DOMMatrix polyfill (must be before pdfjs load) ────────────────────────────
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

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc =
  pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

// ── Args ──────────────────────────────────────────────────────────────────────
const pdfPath = process.argv[2];
const maxRows = parseInt((process.argv.find(a => a.startsWith('--rows=')) || '--rows=15').split('=')[1]);

if (!pdfPath) {
  console.error('Usage: node scripts/test-pdf-extraction.mjs "<path>" [--rows=N]');
  process.exit(1);
}

// ── Header alias map (mirrors pipelineSchema.ts) ──────────────────────────────
const ALIAS_MAP = {
  'provinsi':'provinsi','propinsi':'provinsi','insi':'provinsi','provin':'provinsi',
  'kabupaten':'kabupaten','kabupatenkota':'kabupaten','kabupaten/kota':'kabupaten','kabupa':'kabupaten',
  'kecamatan':'kecamatan','kecamat':'kecamatan',
  'desa':'desa','kelurahan':'desa','desa/kelurahan':'desa',
  // group — full + truncated/wrapped variants
  'poktan/gapoktan/lmdh/koperasi/kth/bptph/brigadepangan':'group',
  'poktan/gapoktan/lmdh/koperasi/kth/bptph/bbpptp/brigadepangan':'group',
  'poktan/gapoktan/lmdh/koperasi':'group','poktan/gapoktan/lmdh':'group',
  'poktan/gapoktan/lmdh/kopera':'group','poktan/gapoktan/lmdh/ko':'group',
  'poktan/gapoktan':'group','poktan':'group','gapoktan':'group',
  'kelompoktani':'group','kelompok':'group',
  'si/kth/bptph/bbpptp/brigade':'group','si/kth/bptph/brigadepangan':'group',
  'ketua':'ketua','penerimabarang':'ketua','namapenerima':'ketua','penerima':'ketua',
  'nik':'nik','nonik':'nik','nomorktp':'nik',
  'nohp':'phone','no.hp':'phone','telepon':'phone','hp':'phone','handphone':'phone',
  'lokasipertanaman*':'lokasiPertanaman','lokasipertanaman':'lokasiPertanaman',
  'lokasi':'lokasiPertanaman','alamat':'lokasiPertanaman','pertanaman*':'lokasiPertanaman',
  'luaslahan(ha)':'luasLahan','luaslahan':'luasLahan','luas':'luasLahan',
  'titikkoordinat':'titikKoordinat',
  'pestisida(latauk)':'qty','pestisida(lataukg)':'qty','pestisida':'qty','volume':'qty','qty':'qty',
  'spesifikasibantuan':'spesifikasi','spesifikasi':'spesifikasi','jenisbantuan':'spesifikasi','saprodi':'spesifikasi',
  'optdominan':'optDominan','optkonfirmasi':'optDominan','hama':'optDominan',
  'jadwaltanam':'jadwalTanam','jadwaltana':'jadwalTanam','jadwal':'jadwalTanam','bulantanam':'jadwalTanam',
  'hargabarangsatuan':'unitPrice','hargasatuan':'unitPrice',
  'jumlahtotalhargasatuan':'totalHarga',
  'ongkoskirimsatuan':'ongkirUnit','ongkir':'ongkirUnit',
  'jumlahtotalongkoskirim':'totalOngkir',
  'jumlahnominalyangditulisdibastpertitikpoktan':'bastValue',
};

function squish(s) { return String(s||'').replace(/[\r\n\s]/g,'').toLowerCase(); }

function headerToCanonical(raw) {
  const key = squish(raw);
  if (ALIAS_MAP[key]) return ALIAS_MAP[key];
  // Prefix match: this key is a prefix of a known alias
  for (const [alias, canon] of Object.entries(ALIAS_MAP)) {
    if (alias.startsWith(key) && key.length >= 6) return canon;
  }
  // Known alias is a prefix of this key
  for (const [alias, canon] of Object.entries(ALIAS_MAP)) {
    if (key.startsWith(alias) && alias.length >= 4) return canon;
  }
  return null;
}

// ── Core extraction logic (mirrors dataPipeline.ts) ───────────────────────────

function groupIntoBandRows(items) {
  const bands = new Map();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5]);
    const x = Math.round(item.transform[4]);
    let bandY = null;
    for (const by of bands.keys()) {
      if (Math.abs(by - y) <= 8) { bandY = by; break; }
    }
    if (bandY === null) { bandY = y; bands.set(bandY, []); }
    bands.get(bandY).push({ x, str: item.str });
  }
  return [...bands.entries()]
    .map(([y, tokens]) => ({ y, tokens: tokens.sort((a,b) => a.x - b.x) }))
    .sort((a,b) => b.y - a.y);
}

function joinSplitNik(tokens) {
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    if (i + 1 < tokens.length) {
      const joined = tokens[i].str + tokens[i+1].str;
      if (/^\d+$/.test(tokens[i].str) && /^\d+$/.test(tokens[i+1].str) && joined.length === 16) {
        result.push({ x: tokens[i].x, str: joined });
        i += 2; continue;
      }
    }
    result.push(tokens[i]);
    i++;
  }
  return result;
}

function buildColBands(headerTokens) {
  // Cluster tokens within 15px X (handles wrapped cells and split words)
  const clusters = [];
  for (const tok of [...headerTokens].sort((a,b) => a.x - b.x)) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(tok.x - last.x) <= 15) {
      last.strs.push(tok.str);
    } else {
      clusters.push({ x: tok.x, strs: [tok.str] });
    }
  }

  const mapped = [];
  for (const cluster of clusters) {
    const concat = cluster.strs.join('');
    const canon = headerToCanonical(concat) ??
                  cluster.strs.reduce((found, s) => found ?? headerToCanonical(s), null);
    if (canon) mapped.push({ x: cluster.x, canon });
  }

  mapped.sort((a,b) => a.x - b.x);
  const seen = new Set();
  const unique = mapped.filter(m => { if (seen.has(m.canon)) return false; seen.add(m.canon); return true; });
  return unique.map((m, i) => ({
    canon:  m.canon,
    xMin:   i === 0 ? 0 : m.x - 5,
    xMax:   i + 1 < unique.length ? unique[i+1].x - 1 : 9999,
    xRef:   m.x,
  }));
}

function assignTokensToColumns(tokens, colBands) {
  const buckets = new Map();
  for (const tok of tokens) {
    let best = null;
    let bestDist = Infinity;
    for (const band of colBands) {
      if (tok.x >= band.xMin && tok.x <= band.xMax) { best = band.canon; break; }
      const mid = (band.xMin + band.xMax) / 2;
      const dist = Math.abs(tok.x - mid);
      if (dist < bestDist) { bestDist = dist; best = band.canon; }
    }
    if (best) {
      if (!buckets.has(best)) buckets.set(best, []);
      buckets.get(best).push(tok.str);
    }
  }
  const raw = {};
  buckets.forEach((strs, canon) => { raw[canon] = strs.join(' ').trim(); });
  return fixupFields(raw);
}

/**
 * Semantic post-assignment validation.
 * When a field's value doesn't match its expected pattern, relocate it
 * to the correct field. Handles column-shift in PDFs where header label
 * X positions don't match data token X positions.
 */
function fixupFields(raw) {
  const NIK_RE = /^\d{16}$/;
  const PHONE_RE = /^0\d[\d\s\-]{8,14}$/;
  const NUMERIC_RE = /^\d+([.,]\d+)?$/;
  const COORD_RE = /[°º'"]/;
  const MONTH_RE = /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)/i;
  const SPESIFIKASI_RE = /(insektisida|fungisida|rodentisida|moluskisida|saprodi)/i;

  // Build ordered list of fields as they appeared in the column map
  const fields = { ...raw };

  // --- NIK recovery: search all text fields for a 16-digit number ---
  const NIK_PATTERN = /\b\d{16}\b/;
  if (!NIK_RE.test((fields.nik || '').replace(/\D/g,''))) {
    // NIK is wrong — find it elsewhere
    for (const f of ['ketua','group','desa','phone','kecamatan']) {
      if (fields[f] && NIK_PATTERN.test(fields[f].replace(/\s/g,''))) {
        const m = (fields[f].replace(/\s/g,'')).match(NIK_PATTERN);
        if (m) {
          // Extract NIK, leave the remainder in original field
          fields.nik = m[0];
          fields[f] = fields[f].replace(/\s*\d{16}\s*/, ' ').trim();
          break;
        }
      }
    }
  }

  // --- Phone recovery: find phone number in fields that shouldn't have one ---
  const PHONE_PATTERN = /\b0\d[\d\s\-]{8,14}/;
  if (!PHONE_RE.test((fields.phone || '').replace(/[\s\-]/g,''))) {
    for (const f of ['nik','ketua','group','desa','kecamatan']) {
      if (fields[f] && PHONE_PATTERN.test(fields[f])) {
        const m = fields[f].match(PHONE_PATTERN);
        if (m) {
          fields.phone = m[0].trim();
          fields[f] = fields[f].replace(PHONE_PATTERN, ' ').trim();
          break;
        }
      }
    }
  }

  // --- Spesifikasi recovery: fixed vocabulary ---
  if (!SPESIFIKASI_RE.test(fields.spesifikasi || '')) {
    for (const f of ['optDominan','qty','jadwalTanam']) {
      if (fields[f] && SPESIFIKASI_RE.test(fields[f])) {
        const m = fields[f].match(SPESIFIKASI_RE);
        if (m) {
          fields.spesifikasi = m[0];
          fields[f] = fields[f].replace(SPESIFIKASI_RE, ' ').trim();
          break;
        }
      }
    }
  }

  // --- JadwalTanam recovery: find month+year pattern ---
  if (!MONTH_RE.test(fields.jadwalTanam || '')) {
    for (const f of ['optDominan','titikKoordinat','qty','spesifikasi']) {
      if (fields[f] && MONTH_RE.test(fields[f])) {
        const m = fields[f].match(new RegExp(MONTH_RE.source + '[\\w\\s\\-]*\\d{4}', 'i'));
        const match = m ? m[0] : fields[f].match(MONTH_RE)?.[0];
        if (match) {
          fields.jadwalTanam = match.trim();
          fields[f] = fields[f].replace(match, ' ').trim();
          break;
        }
      }
    }
  }

  // --- TitikKoordinat: move coordinate strings out of jadwalTanam ---
  if (COORD_RE.test(fields.jadwalTanam || '')) {
    fields.titikKoordinat = (fields.titikKoordinat || '') + ' ' + fields.jadwalTanam;
    fields.titikKoordinat = fields.titikKoordinat.trim();
    fields.jadwalTanam = '';
  }
  if (fields.optDominan && COORD_RE.test(fields.optDominan)) {
    fields.titikKoordinat = (fields.titikKoordinat || '') + ' ' + fields.optDominan;
    fields.titikKoordinat = fields.titikKoordinat.trim();
    fields.optDominan = '';
  }

  // --- Qty: strip non-numeric trailing text ---
  if (fields.qty) {
    const numMatch = fields.qty.match(/^[\d.,]+/);
    if (numMatch) fields.qty = numMatch[0];
  }

  // --- LuasLahan: strip non-numeric trailing text ---
  if (fields.luasLahan) {
    const numMatch = fields.luasLahan.match(/^[\d.,]+/);
    if (numMatch) fields.luasLahan = numMatch[0];
  }

  // Clean up empty strings
  for (const k of Object.keys(fields)) {
    if (fields[k] === '' || fields[k] === '-') delete fields[k];
  }

  return fields;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABLE_SIGNALS = ['nik','poktan','kecamatan','kabupaten','luaslahan','pestisida','jadwal'];

async function run() {
  console.log(`\nPDF: ${pdfPath}\n${'─'.repeat(70)}`);

  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  console.log(`Pages: ${doc.numPages}`);

  // ── Find table page ──
  let tablePageNum = -1;
  let tablePageItems = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items;
    const flat = items.map(i => squish(i.str)).join(' ');
    const hits = TABLE_SIGNALS.filter(s => flat.includes(s));
    if (hits.length >= 4) {
      tablePageNum = p;
      tablePageItems = items;
      console.log(`\nTitik Bagi table: page ${p} (signals: ${hits.join(', ')})`);
      break;
    }
  }
  if (tablePageNum === -1) { console.log('\n✗ No Titik Bagi table found'); return; }

  // ── Detect header rows ──
  const pageRows = groupIntoBandRows(tablePageItems);
  const headerTokens = [];
  const headerRowsSeen = [];

  for (const row of pageRows) {
    const rowText = row.tokens.map(t => squish(t.str)).join(' ');
    const hits = TABLE_SIGNALS.filter(s => rowText.includes(s));
    if (hits.length >= 2) {
      headerTokens.push(...row.tokens);
      headerRowsSeen.push({ y: row.y, hits: hits.join('+'), tokens: row.tokens.map(t => `"${t.str}"@x${t.x}`) });
    }
  }

  console.log(`\nHeader rows detected: ${headerRowsSeen.length}`);
  for (const hr of headerRowsSeen) {
    console.log(`  y=${hr.y} [${hr.hits}]: ${hr.tokens.slice(0,10).join('  ')}`);
  }

  // ── Build column bands ──
  const colBands = buildColBands(headerTokens);
  console.log(`\nColumn bands (${colBands.length}):`);
  const pad = (s, n) => String(s).padEnd(n);
  for (const b of colBands) {
    console.log(`  ${pad(b.canon, 20)} x:[${b.xMin}–${b.xMax}]  (header token @x${b.xRef})`);
  }

  if (colBands.length < 3) {
    console.log('\n⚠  Too few columns detected — check header row recognition above');
  }

  // ── Extract data rows ──
  const NIK_RE = /\b\d{16}\b/;
  const allRows = [];

  for (let p = tablePageNum; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const bandRows = groupIntoBandRows(content.items);

    for (const row of bandRows) {
      const tokens = joinSplitNik(row.tokens);
      const rowText = tokens.map(t => t.str).join(' ');
      if (!NIK_RE.test(rowText)) continue;
      const fields = assignTokensToColumns(tokens, colBands);
      allRows.push({ y: row.y, page: p, fields });
    }
  }

  console.log(`\nData rows found: ${allRows.length}`);
  console.log(`\nFirst ${Math.min(maxRows, allRows.length)} rows:\n${'─'.repeat(70)}`);

  // Determine which fields are populated across all rows
  const fieldCounts = new Map();
  for (const r of allRows) {
    for (const [k, v] of Object.entries(r.fields)) {
      if (v) fieldCounts.set(k, (fieldCounts.get(k) || 0) + 1);
    }
  }

  // Print header
  const activeCols = [...fieldCounts.entries()]
    .sort((a,b) => colBands.findIndex(c=>c.canon===a[0]) - colBands.findIndex(c=>c.canon===b[0]))
    .map(([k]) => k);

  console.log('POPULATED FIELDS:', activeCols.join(' | '));
  console.log('COVERAGE (rows with value / total):');
  for (const col of activeCols) {
    const pct = Math.round((fieldCounts.get(col) || 0) / allRows.length * 100);
    console.log(`  ${pad(col, 20)} ${fieldCounts.get(col) || 0}/${allRows.length}  (${pct}%)`);
  }

  console.log('\nSample rows:');
  for (const r of allRows.slice(0, maxRows)) {
    console.log(`\n  p${r.page} y=${r.y}`);
    for (const col of activeCols) {
      const v = r.fields[col] || '';
      if (v) console.log(`    ${pad(col, 20)} ${v.slice(0, 60)}`);
    }
  }

  // ── Check for fill-down columns (empty in most rows) ──
  const fillDownCandidates = activeCols.filter(col => {
    const pct = (fieldCounts.get(col) || 0) / allRows.length;
    return pct < 0.5;
  });
  if (fillDownCandidates.length) {
    console.log(`\n⚠  Fill-down needed (< 50% rows have value): ${fillDownCandidates.join(', ')}`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
