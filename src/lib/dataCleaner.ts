/**
 * dataCleaner.ts
 * Robust utilities for cleaning and formatting PDF-extracted data.
 */

/**
 * Standardizes Names to Title Case (excluding common abbreviations).
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  
  // List of abbreviations that should stay uppercase
  const PRESERVE = new Set(['PPK', 'NPWP', 'NIK', 'KTP', 'CV', 'PT', 'TBK', 'UD', 'PD', 'SPM', 'SK', 'IVA']);

  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      const upper = word.toUpperCase();
      if (PRESERVE.has(upper)) return upper;
      // Handle Parentheses: (PPK) -> (PPK)
      if (word.startsWith('(') && word.endsWith(')')) {
        const inner = word.slice(1, -1).toUpperCase();
        if (PRESERVE.has(inner)) return `(${inner})`;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Expands and standardizes address fragments like 'JL', 'No.', 'Nomor'.
 */
export function cleanAddress(str: string): string {
  if (!str) return '';

  let s = str.trim();

  // 1. Expand "Jalan / Jl / JL / jl." -> "Jl."
  // Handle cases like "JLharsono" or "jl.Haji" by ensuring a space follows
  s = s.replace(/\b(jalan|jl\.?|jl)\b/gi, 'Jl.');
  s = s.replace(/Jl\.(?=[^\s])/g, 'Jl. '); // Ensure space after Jl.
  
  // 2. Standardize "Nomor / No / NOMOR / no mor / nmr / no114" -> "No."
  // Catches: No. 3, no114, No.4, NO:4, No : 54, no,54, no-54, nomo54, nmr.32
  s = s.replace(/\b(nomor|nomo|nmr|nm|no)(?:\s*[:,\.-]?\s*|\s*)(?=\d)/gi, 'No. ');
  
  // Also catch "No." with no digits following (if it exists)
  s = s.replace(/\b(nomor|nomo|nmr|nm)\b/gi, 'No.');
  s = s.replace(/No\.(?=[^\s])/g, 'No. '); // Ensure space after No.

  // 3. Expand Regional Keywords with fuzzy support
  // Provinsi
  s = s.replace(/\b(provinsi|prov|insi|prv)\b(?:\s*:\s*)?/gi, 'Provinsi: ');
  // Kabupaten / Kota
  s = s.replace(/\b(kabupaten|kab|kab\.?)\b(?:\s*:\s*)?/gi, 'Kabupaten: ');
  s = s.replace(/\b(kota|kt)\b(?:\s*:\s*)?/gi, 'Kota: ');
  // Kecamatan
  s = s.replace(/\b(kecamatan|kec|kcmt|kc)\b(?:\s*:\s*)?/gi, 'Kecamatan: ');
  // Desa / Kelurahan
  s = s.replace(/\b(kelurahan|desa|kl|ds|kel)\b(?:\s*:\s*)?/gi, 'Desa: ');

  // 4. Standardize RT/RW and Blok
  // RT 04 / RW 08
  s = s.replace(/\bRT(?:\s*[:,\.-]?\s*|\s*)(\d+)\b/gi, 'RT. $1 ');
  s = s.replace(/\bRW(?:\s*[:,\.-]?\s*|\s*)(\d+)\b/gi, 'RW. $1 ');
  s = s.replace(/\b(blok|blk|block)(?:\s*[:,\.-]?\s*|\s*)(?=[A-Z\d])/gi, 'Blok ');
  
  // Clean up RT/RW joins like RT. 04/RW. 08
  s = s.replace(/RT\.\s*(\d+)\s*\/\s*RW\.\s*(\d+)/gi, 'RT. $1 / RW. $2');

  // 5. Fix double dots or weird punctuation often caused by PDF blobs
  s = s.replace(/\.{2,}/g, '.');
  s = s.replace(/(?<=\b[A-Z0-9])\s*,\s*(?=\b[A-Z0-9])/gi, ', '); // Spacing for commas

  // 4. Clean up excessive whitespace
  s = s.replace(/\s+/g, ' ');

  return toTitleCase(s);
}

/**
 * Strips portal-related tracking noise (orderKey, etc.) and GUIDs.
 */
export function cleanPortalNoise(str: string): string {
  if (!str) return '';
  
  // Remove query-string like noise
  let s = str.replace(/[&?](?:orderKey|productId|itemKey|orderId|snapshot-product|token)=[^&\s]+/gi, '');
  
  // Remove GUIDs (common in portal exports)
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '');
  
  // Remove short hashes (8-12 chars hex) if they look like standalone noise
  // Note: Only if they aren't part of a larger word
  s = s.replace(/\b[a-f0-9]{8,12}\b/gi, (match) => {
    // If it's pure numbers, keep it. If it contains letters a-f, it's likely a hash.
    return /[a-f]/.test(match.toLowerCase()) ? '' : match;
  });

  return s.trim().replace(/\s+/g, ' ');
}

/**
 * Standardizes NPWP formatting (XX.XXX.XXX.X-XXX.XXX).
 */
export function formatNPWP(str: string): string {
  if (!str) return '';
  const digits = str.replace(/\D/g, '');
  if (digits.length === 15) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 9)}-${digits.slice(9, 12)}.${digits.slice(12, 15)}`;
  }
  return str; // Return as-is if not 15 digits
}

/**
 * Strips redundant regional prefixes like "Kabupaten", "Kecamatan", etc.
 */
export function stripRegionalPrefix(str: string, type?: string): string {
  if (!str || str === '—') return str;
  
  // Pattern to catch prefix + optional colon/space
  // e.g. "Kabupaten: Labuhan Batu" or "Kabupaten Labuhan Batu"
  const patterns = [
    /^\s*(kabupaten|kab\.?)\s*:?\s+/i,
    /^\s*(kecamatan|kec\.?)\s*:?\s+/i,
    /^\s*(provinsi|prov\.?)\s*:?\s+/i,
    /^\s*(desa|kelurahan|kel\.?)\s*:?\s+/i,
    /^\s*(kota|kt\.?)\s*:?\s+/i,
  ];

  let cleaned = str;
  patterns.forEach(p => { cleaned = cleaned.replace(p, ''); });
  
  return cleaned.trim();
}

/**
 * Orchestrates cleaning based on the field type/label.
 */
export function cleanValue(
  val: string, 
  label?: string, 
  resolver?: (raw: string) => any
): string {
  if (!val || val === '—' || val === 'UNKNOWN') return val;

  const key = label?.toLowerCase() || '';
  let cleaned = val;

  // 1. Initial portal noise reduction
  cleaned = cleanPortalNoise(cleaned);

  // 2. Specific field formatting
  if (key.includes('nama') || key.includes('penanggung') || key.includes('jabatan') || key.includes('divisi')) {
    cleaned = toTitleCase(cleaned);
  } else if (key.includes('alamat')) {
    cleaned = cleanAddress(cleaned);
    
    // Deep Regional Cleaning if resolver is provided
    if (resolver) {
      const match = resolver(cleaned);
      if (match) {
        // Build a cleaned address tail
        const parts = [
          match.desa && `Desa: ${toTitleCase(match.desa)}`,
          match.kecamatan && `Kecamatan: ${toTitleCase(match.kecamatan)}`,
          match.kabupaten && `Kabupaten: ${toTitleCase(match.kabupaten)}`,
          match.provinsi && `Provinsi: ${toTitleCase(match.provinsi)}`,
        ].filter(Boolean);
        
        // If we found a good match, we try to append/patch it
        // This is a heuristic: we replace the the existing regional markers
        // with the standardized ones from our master data.
        if (parts.length > 0) {
           const tail = parts.join(', ');
           // Find the first occurrence of a regional marker and replace from there
           const markers = ['Desa:', 'Kecamatan:', 'Kabupaten:', 'Kota:', 'Provinsi:'];
           let firstIdx = -1;
           for (const m of markers) {
             const idx = cleaned.indexOf(m);
             if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) firstIdx = idx;
           }
           
           if (firstIdx !== -1) {
             cleaned = cleaned.slice(0, firstIdx) + tail;
           } else {
             // If no clear markers, check if any of the found names exist in the string and standardize them
             cleaned += ', ' + tail;
           }
        }
      }
    }
  } else if (key.includes('npwp')) {
    cleaned = formatNPWP(cleaned);
  } else if (key.includes('telepon') || key.includes('hp')) {
    cleaned = cleaned.replace(/\s/g, ''); // Collapse phone spaces
  }

  // 3. Strip redundant regional prefixes for location fields
  if (key.includes('provinsi') || key.includes('kabupaten') || key.includes('kecamatan') || key.includes('desa')) {
    cleaned = stripRegionalPrefix(cleaned, key);
  }

  // 4. Final polish
  return cleaned.trim().replace(/\s+/g, ' ');
}
