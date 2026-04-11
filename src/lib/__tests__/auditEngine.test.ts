import { describe, it, expect } from 'vitest';
import { calculateNameSimilarity, performReconciliation } from '../auditEngine';

describe('auditEngine', () => {
  describe('calculateNameSimilarity', () => {
    it('should identify identical names as 100%', () => {
      expect(calculateNameSimilarity('KLP TANI MAJU', 'KLP TANI MAJU')).toBe(100);
    });

    it('should handle common abbreviations', () => {
      // Both have "MAJU" after normalization
      expect(calculateNameSimilarity('KLP TANI MAJU', 'POKTAN MAJU')).toBe(100);
    });

    it('should handle partial matches', () => {
      const score = calculateNameSimilarity('KLP TANI MAJU JAYA', 'KLP TANI MAJU');
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThan(100);
    });
  });

  describe('performReconciliation', () => {
    const mockPdfBlocks = [
      { nama: 'POKTAN BERKAH', kuantitas: '1.000', pageSource: 5 },
      { nama: 'KLP TANI MULYA', kuantitas: '500', pageSource: 6 }
    ];

    const mockExcelRows = [
      { nama: 'KLP TANI BERKAH', qty: 1000 },
      { nama: 'POKTAN MULYA', qty: 500 }
    ];

    it('should reconcile matching data with high score', () => {
      const result = performReconciliation(mockPdfBlocks, mockExcelRows);
      expect(result.isMatched).toBe(true);
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect quantity mismatches', () => {
      const mismatchedExcel = [
        { nama: 'KLP TANI BERKAH', qty: 999 },
        { nama: 'POKTAN MULYA', qty: 500 }
      ];
      const result = performReconciliation(mockPdfBlocks, mismatchedExcel);
      expect(result.isMatched).toBe(false);
      expect(result.issues.some(i => i.type === 'QUANTITY_MISMATCH')).toBe(true);
    });

    it('should detect missing recipients', () => {
      const incompleteExcel = [
        { nama: 'POKTAN MULYA', qty: 500 }
      ];
      const result = performReconciliation(mockPdfBlocks, incompleteExcel);
      expect(result.issues.some(i => i.type === 'MISSING_DATA')).toBe(true);
    });
  });
});
