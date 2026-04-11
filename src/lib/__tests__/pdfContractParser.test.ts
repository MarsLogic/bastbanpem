import { describe, it, expect } from 'vitest';
import { extractContractMetadata, splitPage1Sections } from '../pdfContractParser';

describe('pdfContractParser', () => {
  const samplePage1 = `
    Surat Pesanan No. Surat Pesanan : EP-01K7N8N66XF1P31F35YXJJ1RFG
    Tanggal Surat Pesanan : 22 Okt 2025
    Pemesan DIREKTORAT JENDERAL PRASARANA DAN SARANA PERTANIAN Nama Penanggung Jawab : HANDI ARIEF
    Informasi Pembayaran dan Pengiriman Pembayaran : 1 Termin Pengiriman : 2 Tahap
    Penyedia KARYA ALFREDO NUSANTARA UMKK Nama Penanggung Jawab : ferdy nurmansyah
    Ringkasan Pesanan PDN INSEKTISIDA VISTA 400 SL 11.538,00 liter
    Ringkasan Pembayaran Estimasi Total Pembayaran Rp922.174.200,00
  `;

  it('splits sections correctly', () => {
    const sections = splitPage1Sections(samplePage1);
    expect(sections.HEADER).toContain('EP-01K7N8N66');
    expect(sections.PEMESAN).toContain('DIREKTORAT JENDERAL');
    expect(sections.PENYEDIA).toContain('KARYA ALFREDO');
  });

  it('extracts full metadata', () => {
    const metadata = extractContractMetadata(samplePage1);
    expect(metadata.nomorKontrak).toBe('EP-01K7N8N66XF1P31F35YXJJ1RFG');
    expect(metadata.namaPemesan).toBe('DIREKTORAT JENDERAL PRASARANA DAN SARANA PERTANIAN');
    expect(metadata.namaPenyedia).toBe('KARYA ALFREDO NUSANTARA UMKK');
    expect(metadata.namaProduk).toBe('INSEKTISIDA VISTA 400 SL');
    expect(metadata.kuantitasProduk).toBe('11.538,00');
    expect(metadata.totalPembayaran).toBe('Rp922.174.200,00');
    expect(metadata.jumlahTermin).toBe(1);
    expect(metadata.jumlahTahap).toBe(2);
  });

  describe('parseSpecsTable', () => {
    const sampleSpecs = `
      Lampiran 1.   SPESIFIKASI TEKNIS PESTISIDA
      Spesifikasi   Keterangan
      Nama Pemegang Nomor Pendaftaran   PT SARI KRESNA KIMIA
      Nama / Merek Dagang   Vista 400 SL
      Jenis Pestisida   Insektisida
      Nama dan Kadar Bahan Aktif   Dimehipo 400 g/l
      Isi / Berat Bersih Barang   1000 ml Nama dan Alamat Produsen   PT SARI KRESNA KIMIA
      Petunjuk Penggunaan   Label Nomor   RI. 01010120042166
      Masa Berlaku Ijin Edar   26 September 2029 Sertifikat TKDN   14481/SJ-IND.8/E-TKDN/9/2025
    `;

    it('extracts specs rows correctly', () => {
      const rows = import('../pdfContractParser').then(m => {
        const result = m.parseSpecsTable(sampleSpecs);
        expect(result.length).toBeGreaterThan(5);
        expect(result.find(r => r.item === 'Nama / Merek Dagang')?.spec).toBe('Vista 400 SL');
        expect(result.find(r => r.item === 'Jenis Pestisida')?.spec).toBe('Insektisida');
        expect(result.find(r => r.item === 'Isi / Berat Bersih Barang')?.spec).toBe('1000 ml');
      });
    });
  });
});
