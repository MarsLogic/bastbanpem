import { describe, it, expect } from 'vitest';
import { headerToCanonical, normalizeNik, normalizeNumeric, normalizeString } from '../pipelineSchema';

describe('pipelineSchema', () => {
  describe('headerToCanonical', () => {
    it('matches exact aliases', () => {
      expect(headerToCanonical('Provinsi')).toBe('provinsi');
      expect(headerToCanonical('NIK')).toBe('nik');
    });

    it('matches truncated wrapped aliases', () => {
      // "Poktan/Gapoktan/LMDH/Kopera" is a prefix of the full alias
      expect(headerToCanonical('Poktan/Gapoktan/LMDH/Kopera')).toBe('group');
    });

    it('matches aliases that are prefixes of the header', () => {
      // "Jadwal Tanam" starts with "Jadwal"
      expect(headerToCanonical('Jadwal Tanam')).toBe('jadwalTanam');
    });
  });

  describe('normalizers', () => {
    it('normalizes NIK', () => {
      expect(normalizeNik("'3204152100852210\r\n")).toBe('3204152100852210');
    });

    it('normalizes Numeric', () => {
      expect(normalizeNumeric('Rp 1.500,50')).toBe(1500.5);
    });

    it('normalizes Strings with acronyms', () => {
      expect(normalizeString('cv karya alfredo')).toBe('CV Karya Alfredo');
    });
  });
});
