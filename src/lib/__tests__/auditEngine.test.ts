import { describe, it, expect } from 'vitest';
import { calculateNameSimilarity, performReconciliation } from '../auditEngine';
import { ExcelRow } from '../contractStore';
import { DeliveryBlock } from '../pdfContractParser';

describe('auditEngine', () => {
  describe('calculateNameSimilarity', () => {
    it('should identify identical names as 100%', () => {
      expect(calculateNameSimilarity('KLP TANI MAJU', 'KLP TANI MAJU')).toBe(100);
    });

    it('should handle common abbreviations', () => {
      expect(calculateNameSimilarity('KLP TANI MAJU', 'POKTAN MAJU')).toBe(100);
    });
  });

  describe('performReconciliation', () => {
    const mockPdfBlocks: DeliveryBlock[] = [
      { namaPenerima: 'POKTAN BERKAH', jumlahProduk: 1000, pageSource: 5 } as any,
      { namaPenerima: 'KLP TANI MULYA', jumlahProduk: 500, pageSource: 6 } as any
    ];

    const mockExcelRows: ExcelRow[] = [
      { 
        id: '1', name: 'KLP TANI BERKAH', financials: { qty: 1000 } 
      } as any,
      { 
        id: '2', name: 'POKTAN MULYA', financials: { qty: 500 } 
      } as any
    ];

    it('should reconcile matching data with high score', () => {
      const result = performReconciliation(mockPdfBlocks, mockExcelRows);
      expect(result.isMatched).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should detect quantity mismatches', () => {
      const mismatchedExcel: ExcelRow[] = [
        { id: '1', name: 'KLP TANI BERKAH', financials: { qty: 999 } } as any,
        { id: '2', name: 'POKTAN MULYA', financials: { qty: 500 } } as any
      ];
      const result = performReconciliation(mockPdfBlocks, mismatchedExcel);
      expect(result.isMatched).toBe(false);
      expect(result.issues.some(i => i.type === 'QUANTITY_MISMATCH')).toBe(true);
    });
  });
});
