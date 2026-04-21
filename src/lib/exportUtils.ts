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
  
  // Use fallbacks for unset data to prevent crash or ugly filenames
  const safeOrderId = (orderId || 'UNSET')
    .trim()
    .replace(/[\\\/\s\?\*\:"\<\>\|]/g, '-') // Replace filename-unfriendly chars with dashes
    .toUpperCase();
    
  const safeSection = (sectionName || 'Untitled-Section')
    .trim()
    .replace(/[\\\/\s\?\*\:"\<\>\|]/g, '-') // Replace filename-unfriendly chars with dashes
    .replace(/-+/g, '-'); // Deduplicate dashes
    
  return `${date}-${safeOrderId}_${safeSection}_Data Table Export.xlsx`;
}
