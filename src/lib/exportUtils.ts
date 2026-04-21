/**
 * exportUtils.ts
 * 
 * Shared utilities for standardized Excel exports.
 */

/**
 * Generates a standardized filename for Excel exports.
 * Format: [YYYY-MM-DD]-[OrderId]_[SectionName]_Data Table Export.xlsx
 * 
 * @param orderId - The contract or order ID (e.g. EP-01K7...)
 * @param sectionName - The name of the section being exported
 * @returns Formatted filename string
 */
export function generateExportFilename(orderId?: string | null, sectionName?: string | null): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Use fallbacks for unset data
  // [CLEANUP] Fallback changed from UNSET to "Excel File Upload" per user request
  const safeOrderId = (orderId || 'Excel File Upload')
    .trim()
    .replace(/[\\\/\s\?\*\:"\<\>\|]/g, '-') // Replace filename-unfriendly chars with dashes
    .replace(/-+/g, '-') // Deduplicate dashes
    .toUpperCase();
    
  const safeSection = (sectionName || 'Untitled-Section')
    .trim()
    .replace(/[\\\/\s\?\*\:"\<\>\|]/g, '-') // Replace filename-unfriendly chars with dashes
    .replace(/-+/g, '-'); // Deduplicate dashes
    
  return `${date}-${safeOrderId}_${safeSection}_Data Table Export.xlsx`;
}

/**
 * Standardizes the "Row 2" technical names (headerMeta).
 * Maps clean display names to the original technical column names from the template.
 * 
 * @param headers - Array of display header names
 * @returns Record mapping display name -> technical name
 */
export function getStandardHeaderMeta(headers: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  
  const mapping: Record<string, string> = {
    'PROVINSI': 'insu',
    'KABUPATEN': 'kabupaten',
    'KECAMATAN': 'kecamatan',
    'DESA': 'desa',
    'DESA/KEL': 'desa',
    'POKTAN/GAPOKTAN/LMDH/KOPERASI/KELOMPOK LAINNYA/BRIGADE PANGAN': 'nama_poktan_gapoktan_lmdh_koperasi_kelompok_lainnya_brigade_pangan',
    'POKTAN/GROUP': 'nama_poktan_gapoktan_lmdh_koperasi_kelompok_lainnya_brigade_pangan',
    'KETUA': 'ketua',
    'PENERIMA': 'ketua',
    'NIK': 'nik',
    'NO HP': 'no_hp',
    'NOMOR TELEPON': 'no_hp',
    'LOKASI PERTANAMAN': 'lokasi_pertanaman',
    'LUAS LAHAN': 'luas_lahan_ha',
    'QTY': 'pestisida_atau_benih_kg',
    'JUMLAH': 'pestisida_atau_benih_kg',
    'SPESIFIKASI': 'spesifikasi_bantuan',
    'DPP (EXCL. TAX)': 'dpp_excl_tax',
    'PPN (TAX)': 'ppn_tax',
    'TOTAL (INCL. TAX)': 'total_incl_tax'
  };

  headers.forEach(h => {
    const upper = h.trim().toUpperCase();
    if (mapping[upper]) {
      meta[h] = mapping[upper];
    } else {
      // Fallback: slugify the header
      meta[h] = h.toLowerCase().trim().replace(/[\s\W]+/g, '_');
    }
  });

  return meta;
}
