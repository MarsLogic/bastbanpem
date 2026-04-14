/**
 * auditEngine.ts
 *
 * Core logic for reconciling PDF delivery blocks against Excel distribution rows,
 * and local data against Government Portal records.
 */

import Decimal from 'decimal.js';
import { ExcelRow, DeliveryBlock, ContractData } from './contractStore';

export interface AuditIssue {
  type: 'QUANTITY_MISMATCH' | 'NAME_FUZZY_MATCH' | 'MISSING_DATA' | 'ROUNDING_ERROR' | 'METADATA_MISMATCH';
  severity: 'high' | 'medium' | 'low';
  message: string;
  pdfValue?: string;
  excelValue?: string;
  portalValue?: string;
  localValue?: string;
  pageSource?: number;
}

export interface ReconciliationResult {
  isMatched: boolean;
  score: number; // 0-100
  issues: AuditIssue[];
}

export interface PortalRecipientData {
  pn_nik: string;
  penerima: string;
  pn_qty_disalurkan: number;
  pn_nilai_disalurkan: number;
}

export interface PortalContractData {
  idkontrak: string;
  k_kontrak_nomor: string;
  k_kontrak_tgl: string;
  k_kontrak_nilai: number;
  recipients: PortalRecipientData[];
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

/**
 * Reconcile PDF blocks against Excel rows.
 */
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

/**
 * Reconcile Local Data against Portal Records.
 */
export function performPortalReconciliation(local: ContractData, portal: PortalContractData): ReconciliationResult {
  const issues: AuditIssue[] = [];

  // 1. Metadata Check
  if (local.nomorKontrak !== portal.k_kontrak_nomor) {
    issues.push({
      type: 'METADATA_MISMATCH',
      severity: 'high',
      message: `Contract Number mismatch: Local ${local.nomorKontrak} vs Portal ${portal.k_kontrak_nomor}`,
      localValue: local.nomorKontrak,
      portalValue: portal.k_kontrak_nomor
    });
  }

  const localTotalValue = new Decimal(local.totalPembayaran?.replace(/[^0-9]/g, '') || '0');
  const portalTotalValue = new Decimal(portal.k_kontrak_nilai);

  if (!localTotalValue.equals(portalTotalValue)) {
    issues.push({
      type: 'METADATA_MISMATCH',
      severity: 'medium',
      message: `Total Value mismatch: Local ${localTotalValue.toString()} vs Portal ${portalTotalValue.toString()}`,
      localValue: localTotalValue.toString(),
      portalValue: portalTotalValue.toString()
    });
  }

  // 2. Recipient Reconciliation (NIK based)
  const portalNikMap = new Map<string, PortalRecipientData>();
  portal.recipients.forEach(r => portalNikMap.set(r.pn_nik, r));

  local.recipients.forEach(row => {
    const portalData = portalNikMap.get(row.nik);
    
    if (!portalData) {
      issues.push({
        type: 'MISSING_DATA',
        severity: 'high',
        message: `Recipient "${row.name}" (NIK: ${row.nik}) missing on Portal`,
        localValue: row.nik,
        portalValue: 'NOT_FOUND'
      });
    } else {
      // Check Qty
      if (Math.abs(row.financials.qty - portalData.pn_qty_disalurkan) > 0.01) {
        issues.push({
          type: 'QUANTITY_MISMATCH',
          severity: 'medium',
          message: `Qty mismatch for ${row.name} on Portal`,
          localValue: row.financials.qty.toString(),
          portalValue: portalData.pn_qty_disalurkan.toString()
        });
      }
    }
  });

  // Check for recipients on portal but NOT in local
  const localNikSet = new Set(local.recipients.map(r => r.nik));
  portal.recipients.forEach(pr => {
    if (!localNikSet.has(pr.pn_nik)) {
      issues.push({
        type: 'MISSING_DATA',
        severity: 'medium',
        message: `Portal recipient "${pr.penerima}" (NIK: ${pr.pn_nik}) not found in Local Excel`,
        localValue: 'NOT_FOUND',
        portalValue: pr.pn_nik
      });
    }
  });

  return {
    isMatched: issues.length === 0,
    score: Math.max(0, 100 - (issues.length * 5)),
    issues
  };
}
