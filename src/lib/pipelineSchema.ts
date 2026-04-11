/**
 * pipelineSchema.ts
 *
 * Single source of truth for the data pipeline:
 *   - CanonicalField union type
 *   - FIELD_ALIASES  — every real header variant mapped to canonical name
 *   - VALUE_NORMALIZERS — per-field cleaning functions
 *
 * Generated from scanning 88 PDFs + 87 Excel files in Project 2026.
 * Do NOT scatter field-mapping logic elsewhere; update here instead.
 */

// ─── Canonical field names ─────────────────────────────────────────────────────

export type CanonicalField =
  // Location hierarchy (fill-down)
  | 'provinsi' | 'kabupaten' | 'kecamatan' | 'desa'
  // Group & identity
  | 'group' | 'ketua' | 'nik' | 'phone'
  // Farm data
  | 'lokasiPertanaman' | 'luasLahan' | 'titikKoordinat'
  | 'qty' | 'spesifikasi' | 'optDominan' | 'jadwalTanam'
  // Financial (Excel-sourced, optional)
  | 'unitPrice' | 'totalHarga'
  | 'ongkirUnit' | 'totalOngkir'
  | 'totalValue' | 'bastValue'
  // Document refs
  | 'noBast' | 'noBatch';

// ─── Header aliases ────────────────────────────────────────────────────────────
// Key = squished lowercase (strip ALL whitespace + newlines, lowercase).
// Value = canonical field. First match wins when scanning left→right.
// Derived from frequency analysis of 126 unique headers across 87 Excel files.

export const HEADER_ALIAS_MAP: Record<string, CanonicalField> = {
  // ── provinsi (47x "Provinsi", 18x "Propinsi", 1x "insi", 1x "Provin si") ──
  'provinsi':             'provinsi',
  'propinsi':             'provinsi',
  'provin':               'provinsi',   // "Provin si" squished
  'insi':                 'provinsi',   // truncated merged cell
  'provinsijawatengah':   'provinsi',
  'provinsijawabarat':    'provinsi',
  'provinsilampung':      'provinsi',
  'provinsisumaterautara':'provinsi',

  // ── kabupaten (72x) ──
  'kabupaten':            'kabupaten',
  'kabupaten/kota':       'kabupaten',
  'kabupatenkota':        'kabupaten',
  'kabupaten/':           'kabupaten',
  'kabupa':               'kabupaten',  // truncated
  'pat':                  'kabupaten',  // very truncated fragment — low-confidence, rely on position

  // ── kecamatan (59x) ──
  'kecamatan':            'kecamatan',
  'kecamat':              'kecamatan',  // truncated
  'kecamatan,desa':       'kecamatan',  // merged col header — treat as kecamatan, desa gets fill-down

  // ── desa (60x) ──
  'desa':                 'desa',
  'kelurahan':            'desa',
  'desa/kelurahan':       'desa',
  'kel':                  'desa',

  // ── group (46x Poktan/Gapoktan/..., 17x Gapoktan/Poktan/BP/..., 1x Kelompok Tani) ──
  // Full variants
  'poktan/gapoktan/lmdh/koperasi/kth/bptph/brigadepangan':     'group',
  'poktan/gapoktan/lmdh/koperasi/kth/bptph/bbpptp/brigadepangan': 'group',
  'poktan/gapoktan/lmdh/koperasi/kth/bptph/bbpptp/brigadepangan/dinaspertanian': 'group',
  'poktan/gapoktan/lmdh/koperasi/kth/bptph/brigadepangan/dinaspertanian': 'group',
  'poktan/gapoktan/lmdh/koperasi':                             'group',
  'poktan/gapoktan/lmdh':                                      'group',
  'poktan/gapoktan':                                           'group',
  'gapoktan/poktan/bp/lmdh//koperasi/kth':                     'group',
  // Truncated / wrapped variants (partial lines from PDF header cell wrapping)
  'poktan/gapoktan/lmdh/ko':                                   'group',
  'poktan/gapoktan/lmdh/kopera':                               'group',
  'poktan/gapoktan/lmdh/koperasisi/kth/bptph/bbpptp/brigade':  'group',
  'si/kth/bptph/bbpptp/brigade':                               'group',
  'si/kth/bptph/brigadepangan':                                'group',
  // Short forms
  'kelompoktani':                                              'group',
  'poktan':                                                    'group',
  'gapoktan':                                                  'group',
  'kelompok':                                                  'group',

  // ── ketua (60x "Ketua", 20x "Penerima Barang", 2x "Nama Penerima Barang") ──
  'ketua':                'ketua',
  'penerimabarang':       'ketua',
  'namapenerima':         'ketua',
  'namapenerimab':        'ketua',
  'penerima':             'ketua',

  // ── nik (81x) ──
  'nik':                  'nik',
  'nonik':                'nik',
  'nomorktp':             'nik',
  'nomorinduk':           'nik',
  'nomorindukkepe':       'nik',

  // ── phone (63x "NO HP", 2x "No. HP Penerima", 1x "No HP") ──
  'nohp':                 'phone',
  'no.hp':                'phone',
  'no.hppenerima':        'phone',
  'nohppenerima':         'phone',
  'telepon':              'phone',
  'hp':                   'phone',
  'handphone':            'phone',
  'notelepon':            'phone',

  // ── lokasiPertanaman (31x "Lokasi Pertanaman*", 15x "Lokasi Pertanaman", 18x "Alamat") ──
  'lokasipertanaman*':    'lokasiPertanaman',
  'lokasipertanaman':     'lokasiPertanaman',
  'lokasi':               'lokasiPertanaman',
  'alamat':               'lokasiPertanaman',
  'alamatdinas/bptph':    'lokasiPertanaman',

  // ── luasLahan (61x "Luas Lahan (Ha)") ──
  'luaslahan(ha)':        'luasLahan',
  'luaslahan':            'luasLahan',
  'luas':                 'luasLahan',

  // ── titikKoordinat (46x) ──
  'titikkoordinat(1°1\'1\'\')': 'titikKoordinat',
  'titikkoordinat':       'titikKoordinat',
  'bujur(bt)':            'titikKoordinat',
  'lintang(ls)':          'titikKoordinat',

  // ── qty (30x "Pestisida (l atau kg)", 8x "Pestisida (200 ml)", 6x "Volume") ──
  'pestisida(latauk)':    'qty',
  'pestisida(lataukg)':   'qty',
  'pestisida(l\u00a0atauk)': 'qty',
  'pestisida(kg/l)':      'qty',
  'pestisida(200ml)':     'qty',
  'pestisida(pcs)':       'qty',
  'pestisida(sachet)':    'qty',
  'pestisida(latauk\u00a0ataubatang)': 'qty',
  'pestisida':            'qty',
  'volume':               'qty',
  'volume(lataukg)':      'qty',
  'vol(200ml':            'qty',
  'qty':                  'qty',
  'jumlahpestisida':      'qty',

  // ── spesifikasi (54x "Spesifikasi Bantuan", 18x "Saprodi") ──
  'spesifikasibantuan':   'spesifikasi',
  'spesifikasi':          'spesifikasi',
  'jenisbantuan':         'spesifikasi',
  'saprodi':              'spesifikasi',
  'merek':                'spesifikasi',
  'merk':                 'spesifikasi',
  'jenis':                'spesifikasi',
  'jenispestisida':       'spesifikasi',

  // ── optDominan (27x "OPT Dominan", 18x "OPT Dominan" w/space, 18x "OPT Konfirmasi") ──
  'optdominan':           'optDominan',
  'optkonfirmasi':        'optDominan',
  'jenisoptdominan':      'optDominan',
  'hama':                 'optDominan',

  // ── jadwalTanam (36x "Jadwal Tanam", 1x "Jadwal Tana") ──
  'jadwaltanam':          'jadwalTanam',
  'jadwaltana':           'jadwalTanam',
  'jadwal':               'jadwalTanam',
  'bulantanam':           'jadwalTanam',
  'tanam':                'jadwalTanam',

  // ── unitPrice (79x "Harga Barang satuan") ──
  'hargabarangsatuan':    'unitPrice',
  'hargasatuan':          'unitPrice',
  'hargaprodukinc':       'unitPrice',
  'hargaprodukexc':       'unitPrice',

  // ── totalHarga (79x) ──
  'jumlahtotalhargasatuan': 'totalHarga',
  'totalproduk':          'totalHarga',

  // ── ongkirUnit (79x "Ongkos Kirim satuan") ──
  'ongkoskirimsatuan':    'ongkirUnit',
  'ongkirsatuan':         'ongkirUnit',
  'ongkirexcppn':         'ongkirUnit',
  'ongkir':               'ongkirUnit',

  // ── totalOngkir (79x) ──
  'jumlahtotalongkoskirim': 'totalOngkir',
  'totalongkir':          'totalOngkir',

  // ── totalValue (79x) ──
  'jumlahtotalhargabarang+jmltotalongkir': 'totalValue',

  // ── bastValue (79x "Jumlah Nominal yang di tulis Di BAST Per titik Poktan") ──
  'jumlahnominalyangditulisdibastpertitikpoktan': 'bastValue',
  'jumlahnominalyang':    'bastValue',

  // ── noBast (16x "Nomor BAST", 7x "No. BAST") ──
  'nomorbast':            'noBast',
  'nomorbastb':           'noBast',
  'no.bast':              'noBast',
  'nobast':               'noBast',
  'no..bast':             'noBast',

  // ── noBatch (10x "Nomor Batch", 6x "No. Batch") ──
  'nomorbatch':           'noBatch',
  'no.batch':             'noBatch',
  'nobatch':              'noBatch',
};

// ─── Canonical header labels (for display) ────────────────────────────────────

export const CANONICAL_LABELS: Record<CanonicalField, string> = {
  provinsi:         'Provinsi',
  kabupaten:        'Kabupaten',
  kecamatan:        'Kecamatan',
  desa:             'Desa',
  group:            'Poktan / Gapoktan',
  ketua:            'Ketua',
  nik:              'NIK',
  phone:            'No. HP',
  lokasiPertanaman: 'Lokasi Pertanaman',
  luasLahan:        'Luas Lahan (Ha)',
  titikKoordinat:   'Titik Koordinat',
  qty:              'Pestisida (L/Kg)',
  spesifikasi:      'Spesifikasi Bantuan',
  optDominan:       'OPT Dominan',
  jadwalTanam:      'Jadwal Tanam',
  unitPrice:        'Harga Satuan',
  totalHarga:       'Total Harga',
  ongkirUnit:       'Ongkir / Unit',
  totalOngkir:      'Total Ongkir',
  totalValue:       'Total Nilai',
  bastValue:        'Nilai BAST',
  noBast:           'No. BAST',
  noBatch:          'No. Batch',
};

// ─── Month normalization table ─────────────────────────────────────────────────
// Covers every abbreviation / truncation / misspelling found across 87+ files.
// Key = 3-char lowercase prefix (or full word if ambiguous).

export const MONTH_NORMALIZE: Record<string, string> = {
  jan: 'Januari',
  feb: 'Februari',
  mar: 'Maret',
  apr: 'April',
  mei: 'Mei',
  may: 'Mei',
  jun: 'Juni',
  jul: 'Juli',
  agu: 'Agustus',
  agt: 'Agustus',
  aug: 'Agustus',
  sep: 'September',
  okt: 'Oktober',
  oct: 'Oktober',
  nov: 'November',
  nop: 'November',    // "Nopember" variant
  des: 'Desember',
  dec: 'Desember',
};

// Separator variants found: " - ", "-", "/", " s/d ", " sd ", " dan "
// All normalized to "-" in the canonical form: "Oktober-November 2025"

// Special compound
export const COMPOUND_MONTH_ALIASES: Record<string, string> = {
  okmar:  'Oktober-Maret',
  oktobermareet: 'Oktober-Maret',
};

// Excel date serial base (Windows 1900 system)
const EXCEL_EPOCH = new Date(1899, 11, 30);

/**
 * Normalize a jadwalTanam raw cell value.
 * Returns canonical form: "Oktober 2025" | "Oktober-November 2025" | raw if unrecognized.
 * ctx.contractYear used when no year is present in the cell.
 */
export function normalizeJadwalTanam(raw: string, contractYear = '2025'): string {
  if (!raw) return '';
  const trimmed = raw.replace(/[\r\n]/g, ' ').trim();

  // Excel date serial number
  const serial = Number(trimmed);
  if (!isNaN(serial) && serial > 40000 && serial < 55000) {
    const d = new Date(EXCEL_EPOCH.getTime() + serial * 86400000);
    const monthIdx = d.getMonth();
    const yr = String(d.getFullYear());
    const monthName = Object.values(MONTH_NORMALIZE)[monthIdx * 2] ?? '';
    return monthName ? `${monthName} ${yr}` : trimmed;
  }

  // JS Date string (e.g. "Sun Aug 31 2025 23:59:48 GMT+0700")
  if (/^\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const monthKey = trimmed.slice(4, 7).toLowerCase();
      const yr = String(d.getFullYear());
      return `${MONTH_NORMALIZE[monthKey] ?? ''} ${yr}`.trim();
    }
  }

  // Garbage / non-schedule values
  if (/^[-–—\s]+$/.test(trimmed)) return '';
  if (/non kehut/i.test(trimmed)) return '';
  if (/^tikus$/i.test(trimmed)) return '';

  // Detect year (2024–2027)
  const yearMatch = trimmed.match(/\b(202[4-7])\b/);
  const year = yearMatch ? yearMatch[1] : contractYear;

  // Normalize separators: " - ", " s/d ", " sd ", " / ", " dan " → "-"
  let s = trimmed
    .replace(/\s*s\/d\s*/gi, '-')
    .replace(/\s*sd\s*/gi, '-')
    .replace(/\s*dan\s*/gi, '-')
    .replace(/\s*\/\s*/g, '-')
    .replace(/\s*–\s*/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\b202[4-7]\b/g, '')  // strip year, re-add at end
    .replace(/\s+/g, ' ')
    .trim();

  // Check compound aliases
  const compoundKey = s.toLowerCase().replace(/[^a-z]/g, '');
  if (COMPOUND_MONTH_ALIASES[compoundKey]) {
    return `${COMPOUND_MONTH_ALIASES[compoundKey]} ${year}`;
  }

  // Split on "-" and normalize each part
  const parts = s.split('-').map(p => p.trim()).filter(Boolean);
  const normalized = parts.map(part => {
    const key = part.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
    return MONTH_NORMALIZE[key] ?? part;
  });

  if (normalized.length === 0) return trimmed;
  return normalized.join('-') + (year ? ` ${year}` : '');
}

// ─── NIK normalizer ────────────────────────────────────────────────────────────

/**
 * Clean a NIK value to 16 digits.
 * Handles: embedded \r\n, leading apostrophe (Excel text prefix), spaces.
 */
export function normalizeNik(raw: string): string {
  // Strip Excel text-prefix apostrophe, newlines, spaces, non-digit chars
  return String(raw ?? '')
    .replace(/^'+/, '')        // leading apostrophe(s)
    .replace(/[\r\n\s]/g, '')  // whitespace/newlines
    .replace(/\D/g, '')        // non-digits
    .slice(0, 16);
}

// ─── Numeric normalizer ────────────────────────────────────────────────────────

/**
 * Parse a numeric cell (currency, quantity, area).
 * Strips Rp / IDR prefix, thousand-separator dots, keeps decimal comma→dot.
 */
export function normalizeNumeric(raw: string | number): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  const s = String(raw ?? '')
    .replace(/[\r\n]/g, '')
    .replace(/rp\.?\s*/gi, '')
    .replace(/idr\.?\s*/gi, '')
    .replace(/\./g, '')        // strip thousand separators (Indonesian: 1.000.000)
    .replace(',', '.')         // decimal comma → dot
    .replace(/[^\d.]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ─── String normalizer ─────────────────────────────────────────────────────────

const ACRONYMS = new Set(['pt','cv','bp','tbk','lmdh','kwt','ud','pd','nik','hp','bast','bastb','bptph','wbc','opt','kth']);
const LOWERCASE_WORDS = new Set(['di','ke','dan','dan','untuk','atau']);

/**
 * Title-case a name/group string. Preserves acronyms uppercase.
 */
export function normalizeString(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/[\r\n]/g, ' ')
    .trim()
    .replace(/Ko\s+Perasi/gi, 'Koperasi')
    .split(/(\s+)/)
    .map(word => {
      if (!word.trim()) return word;
      const lower = word.toLowerCase();
      if (ACRONYMS.has(lower)) return word.toUpperCase();
      if (LOWERCASE_WORDS.has(lower)) return lower;
      if (/^\d/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

// ─── Header → canonical field mapper ──────────────────────────────────────────

/**
 * Given a raw header string, return the canonical field name or null.
 * 1. Exact squished-key lookup in HEADER_ALIAS_MAP
 * 2. Prefix match: any alias that starts with the squished key (handles truncated wrapped cells)
 * 3. Contains match: squished key contains a short unambiguous alias
 */
export function headerToCanonical(raw: string): CanonicalField | null {
  if (!raw) return null;
  const key = String(raw).replace(/[\r\n\s]/g, '').toLowerCase();
  if (!key) return null;

  // 1. Exact match
  if (HEADER_ALIAS_MAP[key]) return HEADER_ALIAS_MAP[key];

  // 2. Prefix match (this header text is a prefix of a known alias key)
  //    e.g. "poktan/gapoktan/lmdh/kopera" is a prefix of the full variant
  for (const [alias, canon] of Object.entries(HEADER_ALIAS_MAP)) {
    if (alias.startsWith(key) && key.length >= 6) return canon;
  }

  // 3. Known alias is a prefix of this key (e.g. "jadwaltanam" starts with "jadwal")
  for (const [alias, canon] of Object.entries(HEADER_ALIAS_MAP)) {
    if (key.startsWith(alias) && alias.length >= 4) return canon;
  }

  return null;
}

// ─── Spesifikasi normalizer ────────────────────────────────────────────────────
// Real values found: "Insektisida", "Moluskisida", "Fungisida", "Rodentisida"
// Typos found: "Imsektisida", "Insekstisida", "Fungsisida", "Rodenti sida"

const SPESIFIKASI_MAP: Record<string, string> = {
  insektisida:  'Insektisida',
  imsektisida:  'Insektisida',
  insekstisida: 'Insektisida',
  insektis:     'Insektisida',
  moluskisida:  'Moluskisida',
  moluskis:     'Moluskisida',
  fungisida:    'Fungisida',
  fungsisida:   'Fungisida',
  rodentisida:  'Rodentisida',
};

export function normalizeSpesifikasi(raw: string): string {
  const key = String(raw ?? '').toLowerCase().replace(/[\r\n\s]/g, '');
  return SPESIFIKASI_MAP[key] ?? normalizeString(raw);
}
