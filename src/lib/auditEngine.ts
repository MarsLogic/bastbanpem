/**
 * auditEngine.ts
 *
 * Core logic for reconciling PDF delivery blocks against Excel distribution rows.
 */

import Decimal from 'decimal.js';
import { ExcelRow, DeliveryBlock } from './contractStore';

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
}

/**
 * Simple token-based fuzzy matching for Indonesian recipient names.
 */
export function calculateNameSimilarity(pdfName: string, excelName: string): number {
  const normalize = (s: string) => (s || "").toUpperCase()
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

export function performReconciliation(pdfBlocks: DeliveryBlock[], excelRows: ExcelRow[]): ReconciliationResult {
  const issues: AuditIssue[] = [];

  // 1. Total Quantity Check
  const excelTotalQty = excelRows.reduce((acc, row) => acc.plus(new Decimal(row.financials.qty || 0)), new Decimal(0));
  const pdfTotalQty = pdfBlocks.reduce((acc, block) => acc.plus(new Decimal(block.jumlahProduk || 0)), new Decimal(0));

  if (!excelTotalQty.equals(pdfTotalQty)) {
    issues.push({
      type: 'QUANTITY_MISMATCH',
      severity: 'high',
      message: `Total quantity mismatch: PDF ${pdfTotalQty.toString()} vs Excel ${excelTotalQty.toString()}`,
      pdfValue: pdfTotalQty.toString(),
      excelValue: excelTotalQty.toString()
    });
  }

  // 2. Block-by-block comparison
  pdfBlocks.forEach((block) => {
    const pdfName = block.namaPenerima || '';
    const pdfQty = block.jumlahProduk || 0;

    let bestMatch: ExcelRow | null = null;
    let maxSimilarity = -1;

    excelRows.forEach(row => {
      const sim = calculateNameSimilarity(pdfName, row.name || '');
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        bestMatch = row;
      }
    });

    if (maxSimilarity < 60) {
      issues.push({
        type: 'MISSING_DATA',
        severity: 'high',
        message: `Recipient "${pdfName}" not found in Excel`,
        pdfValue: pdfName,
        excelValue: bestMatch?.name || 'N/A',
        pageSource: (block as any).pageSource
      });
    } else {
        if (bestMatch && Math.abs(pdfQty - (bestMatch.financials.qty || 0)) > 0.01) {
            issues.push({
                type: 'QUANTITY_MISMATCH',
                severity: 'medium',
                message: `Quantity mismatch for ${pdfName}`,
                pdfValue: pdfQty.toString(),
                excelValue: (bestMatch.financials.qty || 0).toString(),
                pageSource: (block as any).pageSource
            });
        }
        if (maxSimilarity < 95) {
            issues.push({
                type: 'NAME_FUZZY_MATCH',
                severity: 'low',
                message: `Fuzzy match for "${pdfName}" (${maxSimilarity.toFixed(0)}%)`,
                pdfValue: pdfName,
                excelValue: bestMatch?.name || '',
                pageSource: (block as any).pageSource
            });
        }
    }
  });

  return {
    isMatched: issues.length === 0,
    score: Math.max(0, 100 - (issues.length * 5)),
    issues
  };
}
