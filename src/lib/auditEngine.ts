/**
 * auditEngine.ts
 *
 * Core logic for reconciling PDF delivery blocks against Excel distribution rows.
 */

import Decimal from 'decimal.js';

export interface AuditIssue {
  type: 'QUANTITY_MISMATCH' | 'NAME_FUZZY_MATCH' | 'MISSING_DATA' | 'ROUNDING_ERROR';
  severity: 'high' | 'medium' | 'low';
  message: string;
  pdfValue: string;
  excelValue: string;
  pageSource?: number;
}

export interface ReconciliationResult {
  isMatched: boolean;
  score: number; // 0-100
  issues: AuditIssue[];
  appliedBalance?: boolean;
}

/**
 * Simple token-based fuzzy matching for Indonesian recipient names.
 * Handles common abbreviations like KLP, POKTAN, GAPOKTAN.
 */
export function calculateNameSimilarity(pdfName: string, excelName: string): number {
  const normalize = (s: string) => s.toUpperCase()
    .replace(/\b(KLP|POKTAN|GAPOKTAN|KELOMPOK|TANI)\b/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
    .sort();

  const pdfTokens = normalize(pdfName);
  const excelTokens = normalize(excelName);

  if (pdfTokens.length === 0 || excelTokens.length === 0) return 0;

  const intersection = pdfTokens.filter(t => excelTokens.includes(t));
  const union = Array.from(new Set([...pdfTokens, ...excelTokens]));

  return (intersection.length / union.length) * 100;
}

export function performReconciliation(pdfBlocks: any[], excelRows: any[]): ReconciliationResult {
  const issues: AuditIssue[] = [];
  let totalScore = 0;

  // 1. Group Excel rows by recipient (simplified for this audit)
  // In reality, one PDF block might correspond to multiple Excel rows if split by stage
  const excelTotalQty = excelRows.reduce((acc, row) => acc.plus(new Decimal(row.qty || 0)), new Decimal(0));
  const pdfTotalQty = pdfBlocks.reduce((acc, block) => {
    const qty = parseFloat(block.kuantitas.replace(/\./g, '').replace(/,/g, '.')) || 0;
    return acc.plus(new Decimal(qty));
  }, new Decimal(0));

  if (!excelTotalQty.equals(pdfTotalQty)) {
    issues.push({
      type: 'QUANTITY_MISMATCH',
      severity: 'high',
      message: `Total quantity mismatch: PDF ${pdfTotalQty.toString()} vs Excel ${excelTotalQty.toString()}`,
      pdfValue: pdfTotalQty.toString(),
      excelValue: excelTotalQty.toString()
    });
  }

  // 2. Block-by-block comparison (Naive 1:1 mapping for now)
  // Future: Implement more complex bipartite matching
  pdfBlocks.forEach((block, idx) => {
    const pdfName = block.nama;
    const pdfQty = parseFloat(block.kuantitas.replace(/\./g, '').replace(/,/g, '.')) || 0;

    // Find best match in Excel
    let bestMatch: any = null;
    let maxSimilarity = -1;

    excelRows.forEach(row => {
      const sim = calculateNameSimilarity(pdfName, row.nama || '');
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        bestMatch = row;
      }
    });

    if (maxSimilarity < 60) {
      issues.push({
        type: 'MISSING_DATA',
        severity: 'high',
        message: `Recipient "${pdfName}" not found in Excel (Best match: ${maxSimilarity.toFixed(1)}%)`,
        pdfValue: pdfName,
        excelValue: bestMatch?.nama || 'N/A',
        pageSource: block.pageSource
      });
    } else if (maxSimilarity < 95) {
      issues.push({
        type: 'NAME_FUZZY_MATCH',
        severity: 'low',
        message: `Fuzzy match for "${pdfName}"`,
        pdfValue: pdfName,
        excelValue: bestMatch.nama,
        pageSource: block.pageSource
      });
    }

    if (bestMatch && Math.abs(pdfQty - (bestMatch.qty || 0)) > 0.01) {
      issues.push({
        type: 'QUANTITY_MISMATCH',
        severity: 'medium',
        message: `Quantity mismatch for ${pdfName}`,
        pdfValue: pdfQty.toString(),
        excelValue: (bestMatch.qty || 0).toString(),
        pageSource: block.pageSource
      });
    }
  });

  return {
    isMatched: issues.length === 0,
    score: Math.max(0, 100 - (issues.length * 10)),
    issues
  };
}
