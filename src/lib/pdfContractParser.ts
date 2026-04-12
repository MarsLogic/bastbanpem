/**
 * pdfContractParser.ts
 *
 * Section-aware PDF metadata extraction logic ported from pdf_pattern_learner.py.
 * Splits page 1 into HEADER, PEMESAN, PENYEDIA, etc. using anchor detection.
 */

import { formatDataString } from './utils';

export interface ContractMetadata {
  nomorKontrak?: string;
  tanggalKontrak?: string;
  namaPemesan?: string;
  namaPenyedia?: string;
  namaProduk?: string;
  kuantitasProduk?: string;
  totalPembayaran?: string;
  jumlahTermin?: number;
  jumlahTahap?: number;
}

export interface DeliveryBlock {
  namaPenerima?: string;
  telepon?: string;
  permintaanTiba?: string;
  alamatLengkap?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  kodePos?: string;
  catatanAlamat?: string;
  jumlahProduk?: number;
  hargaProdukTotal?: string;
  ongkosKirim?: string;
}

export const SPECS_LABELS = [
  "Nama Pemegang Nomor Pendaftaran",
  "Nama / Merek Dagang",
  "Jenis Pestisida",
  "Nama dan Kadar Bahan Aktif",
  "Isi / Berat Bersih Barang",
  "Nama dan Alamat Produsen",
  "Petunjuk Penggunaan",
  "Label Nomor",
  "Masa Berlaku Ijin Edar",
  "Sertifikat TKDN"
];

/**
 * Split page 1 text into isolated named sections using anchor labels.
 */
export function splitPage1Sections(text: string): Record<string, string> {
  const anchors = [
    { key: 'HEADER', label: 'Surat Pesanan' },
    { key: 'PEMESAN', label: 'Pemesan' },
    { key: 'PAYMENT_SUMMARY', label: 'Informasi Pembayaran dan Pengiriman' },
    { key: 'PENYEDIA', label: 'Penyedia' },
    { key: 'RINGKASAN_PESANAN', label: 'Ringkasan Pesanan' },
    { key: 'RINGKASAN_PEMBAYARAN', label: 'Ringkasan Pembayaran' },
  ];

  const sections: Record<string, string> = {};
  const sorted = [...anchors].sort((a, b) => text.indexOf(a.label) - text.indexOf(b.label));

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const start = text.indexOf(current.label);
    if (start === -1) continue;

    const end = next ? text.indexOf(next.label) : text.length;
    sections[current.key] = text.substring(start, end === -1 ? text.length : end).trim();
  }

  return sections;
}

export function parseHeader(text: string): { nomorKontrak?: string; tanggalKontrak?: string } {
  const noMatch = text.match(/No\.\s*Surat\s*Pesanan\s*:\s*(EP-[A-Z0-9\-]+)/i);
  const tglMatch = text.match(/Tanggal\s*Surat\s*Pesanan\s*:\s*([\d]{1,2}\s+[a-zA-Z]+\s+\d{4}(?:,\s*\d{2}:\d{2}:\d{2}\s*WIB)?)/i);
  return {
    nomorKontrak: noMatch ? noMatch[1].trim() : undefined,
    tanggalKontrak: tglMatch ? tglMatch[1].trim() : undefined,
  };
}

export function parsePemesan(text: string): { namaPemesan?: string } {
  const match = text.match(/Pemesan\s+([A-Z\s]+?)(?:\s+Kementerian|\s+Nama Penanggung)/i);
  return {
    namaPemesan: match ? match[1].trim().toUpperCase() : undefined,
  };
}

export function parsePenyedia(text: string): { namaPenyedia?: string } {
  const match = text.match(/Penyedia\s+([A-Z\s]+?)\s+Nama Penanggung Jawab/i);
  return {
    namaPenyedia: match ? match[1].trim().toUpperCase() : undefined,
  };
}

export function parsePaymentSummary(text: string): { jumlahTermin?: number; jumlahTahap?: number } {
  const terminMatch = text.match(/Pembayaran\s*:\s*(\d+)\s*Termin/i);
  const tahapMatch = text.match(/Pengiriman\s*:\s*(\d+)\s*Tahap/i);
  return {
    jumlahTermin: terminMatch ? parseInt(terminMatch[1], 10) : undefined,
    jumlahTahap: tahapMatch ? parseInt(tahapMatch[1], 10) : undefined,
  };
}

export function parseRingkasanPesanan(text: string): { namaProduk?: string; kuantitasProduk?: string } {
  const match = text.match(/(?:PDN|Nama Produk)\s+(.+?)\s+([\d.,]+)\s*(?:liter|kg|gr|botol|Unit|btl|can|sachet|box)/i);
  return {
    namaProduk: match ? match[1].trim().toUpperCase() : undefined,
    kuantitasProduk: match ? match[2].trim() : undefined,
  };
}

export function parseRingkasanPembayaran(text: string): { totalPembayaran?: string } {
  const match = text.match(/Estimasi Total Pembayaran.*?(Rp\s*[\d.,]{5,})/i) || 
                text.match(/Total Pembayaran\s+(Rp\s*[\d.,]{5,})/i);
  return {
    totalPembayaran: match ? match[1].trim() : undefined,
  };
}

/**
 * Split address components from a raw string.
 */
function parseAddress(raw: string): Partial<DeliveryBlock> {
  const parts = raw.split(',').map(p => p.trim());
  const result: Partial<DeliveryBlock> = { alamatLengkap: raw.trim() };
  
  if (parts.length >= 2) {
    const kodeposMatch = parts[parts.length - 1].match(/\b(\d{5})\b/);
    if (kodeposMatch) {
      result.kodePos = kodeposMatch[1];
      if (parts.length >= 4) result.kecamatan = parts[parts.length - 4];
      if (parts.length >= 3) result.kabupaten = parts[parts.length - 3];
      if (parts.length >= 2) result.provinsi = parts[parts.length - 2];
    }
  }
  return result;
}

/**
 * Scan all pages for Pengiriman blocks.
 */
export function extractDeliveryBlocks(pages: string[]): DeliveryBlock[] {
  const blocks: DeliveryBlock[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    const pageNumber = i + 1;
    
    // Search for "Pengiriman Nama Penerima :" on this page
    // The blocks might span across pages, but typically the "Nama Penerima" anchor is on the start page.
    const rawBlocks = pageText.split(/Pengiriman\s+Nama Penerima\s*:/);
    
    for (const raw of rawBlocks.slice(1)) {
      const block = raw.trim();
      
      // Nama Penerima + phone
      const namaMatch = block.match(/^(.+?)\s*\((\d{8,15})\)/);
      const nama = namaMatch ? namaMatch[1].trim() : undefined;
      const telepon = namaMatch ? namaMatch[2] : undefined;

      // Permintaan Tiba
      const tibaMatch = block.match(/Permintaan Tiba\s*:\s*(.+?)(?:\s+Alamat Pengiriman|\s+Kurir)/);

      // Alamat Pengiriman
      const alamatMatch = block.match(/Alamat Pengiriman\s*:\s*(.+?)(?:\s+Catatan Alamat|\s+Kurir Pengiriman)/);
      const addrData = alamatMatch ? parseAddress(alamatMatch[1]) : {};

      // Catatan Alamat
      const catatanMatch = block.match(/Catatan Alamat Pengiriman\s*(.+?)(?:\s+Kurir Pengiriman)/);
      const catatan = catatanMatch ? catatanMatch[1].replace(/\s+/g, ' ').trim() : undefined;

      // Quantity
      const qtyMatch = block.match(/Harga Produk\s*\(\s*([\d.,]+)\s*\)/);
      const jumlahRaw = qtyMatch ? qtyMatch[1].replace(/\./g, '').replace(/,/g, '.') : undefined;
      const jumlah = jumlahRaw ? parseFloat(jumlahRaw) : undefined;

      // Harga & Ongkir
      const hargaMatch = block.match(/Harga Produk\s*\([\d.,]+\)\s*(Rp[\d.,]+)/);
      const ongkosMatch = block.match(/Ongkos Kirim\s*\([\d.,\s]+(?:kg|liter|gr)?\s*\)\s*(Rp[\d.,]+)/);

      if (nama) {
        blocks.push({
          namaPenerima: nama,
          telepon,
          permintaanTiba: tibaMatch ? tibaMatch[1].trim() : undefined,
          ...addrData,
          catatanAlamat: catatan,
          jumlahProduk: jumlah,
          hargaProdukTotal: hargaMatch ? hargaMatch[1] : undefined,
          ongkosKirim: ongkosMatch ? ongkosMatch[1] : undefined,
          pageSource: pageNumber
        } as any);
      }
    }
  }

  return blocks;
}

/**
 * High-level assembler for contract metadata.
 */
export function extractContractMetadata(page1Text: string): ContractMetadata {
  const sections = splitPage1Sections(page1Text);
  return {
    ...parseHeader(sections.HEADER || ''),
    ...parsePemesan(sections.PEMESAN || ''),
    ...parsePenyedia(sections.PENYEDIA || ''),
    ...parsePaymentSummary(sections.PAYMENT_SUMMARY || ''),
    ...parseRingkasanPesanan(sections.RINGKASAN_PESANAN || ''),
    ...parseRingkasanPembayaran(sections.RINGKASAN_PEMBAYARAN || ''),
  };
}

/**
 * Extract structured technical specs from the Lampiran 1 section.
 */
export function parseSpecsTable(text: string): { index: string, item: string, spec: string }[] {
  const rows: { index: string, item: string, spec: string }[] = [];
  const cleanText = text.replace(/Lampiran 1\.\s+SPESIFIKASI TEKNIS\s+PESTISIDA/i, '').trim();
  
  for (let i = 0; i < SPECS_LABELS.length; i++) {
    const label = SPECS_LABELS[i];
    const nextLabel = SPECS_LABELS[i + 1];
    
    const start = cleanText.indexOf(label);
    if (start === -1) continue;
    
    const valueStart = start + label.length;
    const valueEnd = nextLabel ? cleanText.indexOf(nextLabel) : cleanText.length;
    
    let spec = cleanText.substring(valueStart, valueEnd === -1 ? cleanText.length : valueEnd).trim();
    
    // Clean up "Keterangan" artifact if it appears at the start of the first value
    if (i === 0 && spec.startsWith('Keterangan')) {
      spec = spec.replace(/^Keterangan\s+/, '').trim();
    }
    
    // Remove leading punctuation common in these PDFs
    spec = spec.replace(/^[\s:]+/, '').trim();

    rows.push({
      index: (rows.length + 1).toString(),
      item: label,
      spec
    });
  }
  
  return rows;
}

/**
 * Locate the SPESIFIKASI TEKNIS section in the full text of the document.
 */
export function findSpecsSection(allPagesText: string): string {
  const anchor = "Lampiran 1. SPESIFIKASI TEKNIS";
  const start = allPagesText.indexOf(anchor);
  if (start === -1) return "";
  
  const nextAnchor = allPagesText.indexOf("Lampiran 2.", start + anchor.length);
  const titikBagiAnchor = allPagesText.indexOf("Titik Bagi", start + anchor.length);
  
  let end = allPagesText.length;
  if (nextAnchor !== -1 && titikBagiAnchor !== -1) end = Math.min(nextAnchor, titikBagiAnchor);
  else if (nextAnchor !== -1) end = nextAnchor;
  else if (titikBagiAnchor !== -1) end = titikBagiAnchor;
  
  return allPagesText.substring(start, end).trim();
}

/**
 * Find the page ranges for specific sections.
 */
export function findSectionPageRange(pages: string[], anchor: string): [number, number] | null {
  let startPage = -1;
  let endPage = -1;

  for (let i = 0; i < pages.length; i++) {
    if (pages[i].includes(anchor)) {
      startPage = i + 1;
      break;
    }
  }

  if (startPage === -1) return null;

  // Find the next section start or end of document
  const nextAnchors = ["Lampiran 2.", "Titik Bagi", "SSKK", "SYARAT-SYARAT KHUSUS KONTRAK"];
  for (let i = startPage; i < pages.length; i++) {
    if (nextAnchors.some(a => pages[i].includes(a) && a !== anchor)) {
      endPage = i; // Next page starts new section, so this is the end
      break;
    }
  }

  if (endPage === -1) endPage = pages.length;

  return [startPage, endPage];
}
