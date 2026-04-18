/**
 * dataCleaner.ts
 * Robust utilities for cleaning and formatting PDF-extracted data.
 */

/**
 * Standardizes Names to Title Case (excluding common abbreviations).
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  
  // 1. Force standardization of PT. and CV. (Case-insensitive match, ensure dot and trailing space)
  // This handles variations like 'cv.', 'Cv', 'pt', 'PT.' and ensures they become 'CV. ' or 'PT. '
  let s = str.trim().replace(/\b(pt|cv)\b\.?\s*/gi, (match, prefix) => `${prefix.toUpperCase()}. `);

  // 2. List of abbreviations that should stay uppercase
  const PRESERVE = new Set(['PPK', 'NPWP', 'NIK', 'KTP', 'CV', 'PT', 'TBK', 'UD', 'PD', 'SPM', 'SK', 'IVA']);

  return s
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      const upper = word.toUpperCase();
      
      // Handle PT. and CV. (already standardized above, but keep uppercase here)
      if (upper === 'CV.' || upper === 'PT.') return upper;
      
      // Standard PRESERVE check
      if (PRESERVE.has(upper)) return upper;
      
      // Handle Parentheses: (PPK) -> (PPK)
      if (word.startsWith('(') && word.endsWith(')')) {
        const inner = word.slice(1, -1).toUpperCase();
        if (PRESERVE.has(inner)) return `(${inner})`;
      }
      
      const lowered = word.toLowerCase();
      return lowered.charAt(0).toUpperCase() + lowered.slice(1);
    })
    .join(' ')
    .trim();
}

/**
 * Expands and standardizes address fragments like 'JL', 'No.', 'Nomor'.
 * Vibranium-Grade: Handles extreme butchery and merged strings.
 * Refined: Removes redundant labels and fixes 'Jl. .' artifacts.
 */
export function cleanAddress(str: string): string {
  if (!str) return '';

  let s = str.trim();

  // 1. Expand "Jalan / Jl / jln / jlan" -> "Jl. "
  // Specifically handle the missing space artifact: "Jl.haji" -> "Jl. Haji"
  s = s.replace(/\b(jalan|jl\.?|jln|jlan)\s*[:,\.-]*\s*/gi, 'Jl. ');
  
  // 2. Standardize "Nomor / No / nmr / Nomer" -> "No. "
  s = s.replace(/\b(nomor|nomo|nmr|nomer|no\.?)\s*[:,\.-]*\s*(?=\d)/gi, 'No. ');
  s = s.replace(/\b(nomor|nomo|nmr|nomer)\b/gi, 'No. ');
  
  // 3. Normalize Regional Keywords (Strip the labels)
  s = s.replace(/\b(provinsi|prov|insi|prv)\b(?:\s*[:,\.-]?\s*|\s*)/gi, ' ');
  s = s.replace(/\b(kabupaten|kab|kab\.?)\b(?:\s*[:,\.-]?\s*|\s*)/gi, ' ');
  s = s.replace(/\b(kota|kt)\b(?:\s*[:,\.-]?\s*|\s*)/gi, ' ');
  s = s.replace(/\b(kecamatan|kec|kcmt|kc)\b(?:\s*[:,\.-]?\s*|\s*)/gi, ' ');
  s = s.replace(/\b(kelurahan|desa|kl|ds|kel)\b(?:\s*[:,\.-]?\s*|\s*)/gi, ' ');

  // 4. Remove special characters/hyphens in regional pairings (ciledug-tangerang -> ciledug tangerang)
  s = s.replace(/(?<=[a-z])[^a-z0-9\s.](?=[a-z])/gi, ' ');

  // 5. Standardize RT/RW (No dot, just spaces: "RT 02 / RW 10")
  // Handles: Rt02/rw10, rt:02, rw-10, RT.02
  
  // Force spaces between label and digits
  s = s.replace(/\bRT\s*[:,\.-]?\s*(\d+)\b/gi, 'RT $1 ');
  s = s.replace(/\bRW\s*[:,\.-]?\s*(\d+)\b/gi, 'RW $1 ');
  
  // Handle the slash join: "RT 02/RW 10" or "RT 02 / RW 10"
  s = s.replace(/RT\s*(\d+)\s*\/?\s*RW\s*(\d+)/gi, 'RT $1 / RW $2');

  // 6. Standardize Blok (Handles merges like BlokD121)
  s = s.replace(/\b(blok|blk|block)(?:\s*[:,\.-]?\s*|\s*)(?=[A-Z\d/])/gi, 'Blok ');

  // 7. Kodakpos (Postal Code) formatting
  s = s.replace(/\b(?:kodepos|zip|pos|postal)\s*:?\s*(\d{5})\b/gi, '$1');

  // 8. Final Spacing & Punctuation Polish
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s+\./g, '.'); // remove space before dot
  s = s.replace(/\.{2,}/g, '.'); // collapse double dots
  
  // Apply Title Case but RT/RW need to stay UPPERCASE (No dots)
  let result = toTitleCase(s.trim());
  result = result.replace(/\bRt\b/g, 'RT');
  result = result.replace(/\bRw\b/g, 'RW');

  return result;
}

/**
 * Strips portal-related tracking noise (orderKey, etc.) and GUIDs.
 */
export function cleanPortalNoise(str: string): string {
  if (!str) return '';
  
  // CRITICAL: If it looks like a URL, do NOT strip noise, as it breaks the link.
  if (/^(?:https?:\/\/|\/\/)/i.test(str)) return str;
  
  // Remove query-string like noise for non-URL fields
  let s = str.replace(/[&?](?:orderKey|productId|itemKey|orderId|snapshot-product|token)=[^&\s]+/gi, '');
  
  // Remove GUIDs (common in portal exports)
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '');
  
  // Remove short hashes (8-12 chars hex) if they look like standalone noise
  s = s.replace(/\b[a-f0-9]{8,12}\b/gi, (match) => {
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
 * Robust Indonesian Phone Formatting with Self-Healing.
 * Detects mangled or truncated numbers (e.g. 53... instead of 853...) and restores them.
 */
export function formatPhone(raw: string): string {
  if (!raw || raw === '—') return '—';
  
  // 1. Remove non-digits
  let clean = raw.replace(/\D/g, '');
  
  // 2. Handle 6262 prefixing bug (Double standardizing)
  if (clean.startsWith('6262')) {
    clean = clean.substring(2);
  }
  
  // 3. Strip 62 or 0 prefix to get raw sequence
  if (clean.startsWith('62')) clean = clean.substring(2);
  if (clean.startsWith('0')) clean = clean.substring(1);

  // 4. SELF-HEALING: Detect common truncated prefixes (e.g. 53... instead of 853...)
  // In previous versions, numbers were truncated to 10 digits, losing the leading '8'.
  // Mobile prefixes: 81x, 82x, 83x, 85x, 87x, 88x, 89x.
  // Truncated: 1x, 2x, 3x, 5x, 7x, 8x, 9x
  const mobileTruncatedPrefixes = ['1', '2', '3', '5', '7', '8', '9'];
  if (clean.length === 10 && mobileTruncatedPrefixes.includes(clean[0])) {
    // If it starts with '8' and is 10 digits, it's already a valid sequence (e.g. 812...)
    // But if it starts with 1, 2, 3, 5, 7, 9, it needs the '8' restored.
    if (clean[0] !== '8') {
      clean = '8' + clean;
    }
  }
  
  // 5. Format based on sequence
  // Mobile: starts with 8
  if (clean.startsWith('8')) {
    return `0${clean}`;
  }
  
  // Landline (Regional): 2 to 3 digit area code
  if (clean.startsWith('2') || clean.startsWith('3')) {
    const area = clean.substring(0, 2);
    const rest = clean.substring(2);
    return `(0${area}) ${rest}`;
  }

  return `0${clean}`; // Fallback prefix
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
 * Standardizes regional names to match master data labels.
 * Handles common OCR artifacts, space missing, and broken letters.
 */
export function standardizeRegionalName(str: string): string {
  if (!str || str === '—') return str;

  // 1. Initial cleaning of common OCR junk characters
  let s = str.replace(/[^\w\s-]/g, '').trim();
  
  // 2. Normalize whitespace
  s = s.replace(/\s+/g, ' ');

  // 3. Common Dictionary Snaps (Case Insensitive)
  const MAP: Record<string, string> = {
    'labuhanbatu': 'Labuhan Batu',
    'labuhanbatu utara': 'Labuhan Batu Utara',
    'labuhanbatu selatan': 'Labuhan Batu Selatan',
    'tanahbumbu': 'Tanah Bumbu',
    'tanah bumbu': 'Tanah Bumbu',
    'tanah laut': 'Tanah Laut',
    'tanahlaut': 'Tanah Laut',
    'barito utara': 'Barito Utara',
    'baritoutara': 'Barito Utara',
    'barito kuala': 'Barito Kuala',
    'baritokuala': 'Barito Kuala',
    'barito selatan': 'Barito Selatan',
    'baritoselatan': 'Barito Selatan',
    'barito timur': 'Barito Timur',
    'baritotimur': 'Barito Timur',
    'tanjung jabung timur': 'Tanjung Jabung Timur',
    'tanjungjabung timur': 'Tanjung Jabung Timur',
    'tanjung jabung barat': 'Tanjung Jabung Barat',
    'tanjungjabung barat': 'Tanjung Jabung Barat'
  };

  const lowered = s.toLowerCase();
  if (MAP[lowered]) return MAP[lowered];

  // 4. Fuzzy join/split for common patterns
  // e.g. "Labuhanbatu" -> "Labuhan Batu" (Search for CamelCase or missing spaces)
  // This is a heuristic: if a word is very long and matchable by master data, 
  // we rely on triangulation later, but we Title Case it here for a clean start.
  
  return toTitleCase(s);
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
  if (key.includes('alamat')) {
    cleaned = cleanAddress(cleaned);
    
    // Deep Regional Cleaning if resolver is provided
    if (resolver) {
      const match = resolver(cleaned);
      if (match) {
        // Build a cleaned address tail
        const cLower = cleaned.toLowerCase();
        
        const parts = [
          match.desa && !cLower.includes(match.desa.toLowerCase()) && toTitleCase(match.desa),
          match.kecamatan && !cLower.includes(match.kecamatan.toLowerCase()) && toTitleCase(match.kecamatan),
          match.kabupaten && !cLower.includes(match.kabupaten.toLowerCase()) && toTitleCase(match.kabupaten),
          match.provinsi && !cLower.includes(match.provinsi.toLowerCase()) && toTitleCase(match.provinsi),
        ].filter((p): p is string => !!p);
        
        if (parts.length > 0) {
           cleaned += ', ' + parts.join(', ');
        }
      }
    }
  } else if (key.includes('nama') || key.includes('penerima') || key.includes('penanggung') || key.includes('jabatan') || key.includes('divisi') || key.includes('penyedia')) {
    cleaned = toTitleCase(cleaned);
  } else if (key.includes('email') || key.includes('website') || key.includes('mail')) {
    cleaned = cleaned.toLowerCase();
  } else if (key.includes('npwp')) {
    cleaned = formatNPWP(cleaned);
  } else if (key.includes('telepon') || key.includes('hp')) {
    cleaned = formatPhone(cleaned);
  }

  // 3. Strip redundant regional prefixes and standardize
  if (key.includes('provinsi') || key.includes('kabupaten') || key.includes('kecamatan') || key.includes('desa')) {
    cleaned = stripRegionalPrefix(cleaned, key);
    cleaned = standardizeRegionalName(cleaned);
  }

  // 4. Final polish
  return cleaned.trim().replace(/\s+/g, ' ');
}
