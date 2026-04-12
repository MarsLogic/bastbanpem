import { useState, useEffect, useMemo } from 'react';
import localforage from 'localforage';

localforage.config({
  name: 'BASTAutomator',
  storeName: 'contracts'
});

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
  pageSource?: number;
}

export interface ExcelRow {
  id: string;
  nik: string;
  name: string;
  location: {
    provinsi: string;
    kabupaten: string;
    kecamatan: string;
    desa: string;
  };
  financials: {
    qty: number;
    unit_price: number;
    shipping: number;
    target_value: number;
    calculated_value: number;
    gap: number;
  };
  jadwal_tanam: string;
  group: string;
  is_synced: boolean;
  is_excluded: boolean;
  page_source: number;
  column_data: Record<string, any>;
  original_row: Record<string, any>;
  // UI-only temporary fields
  isDuplicate?: boolean;
  isGlobalDouble?: boolean;
  otherContracts?: { id: string, name: string }[];
}

export interface GlobalConfig {
  nomor_sertifikat: string;
  tanggal_sertifikat: string;
  lembaga_penguji: string;
  ktpDir?: string;
  proofDir?: string;
}

export interface ContractData {
  id: string;
  name: string; 
  
  // PDF Data
  contractPdfPath: string | null;
  nomorKontrak: string;
  tanggalKontrak: string;
  contractYear?: number;
  namaPemesan?: string;
  namaPenyedia?: string;
  namaProduk?: string;
  kuantitasProduk?: string;
  totalPembayaran?: string;

  deliveryBlocks?: any[];
  
  // Expanded PDF Extraction
  sskkText?: string;
  sskkPageRange?: [number, number];
  specsTable?: any[];
  specsPageRange?: [number, number];

  // Folders and Bindings
  ktpDir?: string;
  proofDir?: string;
  ktpBindings?: Record<string, string>;   // imageName -> recipientNik
  proofBindings?: Record<string, string>; // imageName -> recipientNik

  // Excel Data
  excelPath: string | null;
  recipients: ExcelRow[];
  
  // Global Attachments
  bastbPath: string | null;
  suratJalanPath: string | null;
  invoiceOngkirPath: string | null;
  sertifikatLabPath: string | null;
  
  lastModified: number;
}

const STORAGE_KEY = 'bast-automator-contracts';

export function useContracts() {
  const [contracts, setContracts] = useState<ContractData[]>([]);

  useEffect(() => {
    localforage.getItem<ContractData[]>(STORAGE_KEY).then(data => {
      if (data) {
        setContracts(data);
      }
    }).catch(e => {
        console.error("Failed to parse contracts from local storage", e);
    });
  }, []);

  const globalNIKRegistry = useMemo(() => {
    const map = new Map<string, { id: string, name: string }[]>();
    contracts.forEach(c => {
      c.recipients.forEach(r => {
        if (!r.nik) return;
        const existing = map.get(r.nik) || [];
        if (!existing.find(e => e.id === c.id)) {
          existing.push({ id: c.id, name: c.name });
          map.set(r.nik, existing);
        }
      });
    });
    return map;
  }, [contracts]);

  const saveContracts = (newContracts: ContractData[]) => {
    setContracts(newContracts);
    localforage.setItem(STORAGE_KEY, newContracts).catch(e => console.error("Failed to save to localforage", e));
  };

  const createContract = (name: string, initialData?: any) => {
    const newContract: ContractData = {
      id: crypto.randomUUID(),
      name,
      contractPdfPath: initialData?.master_pdf_path || null,
      nomorKontrak: initialData?.contract_no || '',
      tanggalKontrak: initialData?.contract_date || '',
      namaPemesan: initialData?.nama_pemesan || '',
      namaPenyedia: initialData?.nama_penyedia || '',
      namaProduk: initialData?.nama_produk || '',
      kuantitasProduk: initialData?.kuantitas_produk || '',
      totalPembayaran: initialData?.total_pembayaran || '',
      sskkText: '',
      specsTable: [],
      excelPath: null,
      recipients: initialData?.rows || [],
      bastbPath: null,
      suratJalanPath: null,
      invoiceOngkirPath: null,
      sertifikatLabPath: null,
      lastModified: Date.now()
    };
    const updated = [...contracts, newContract];
    saveContracts(updated);
    return newContract.id;
  };

  const updateContract = (id: string, updates: Partial<ContractData>) => {
    saveContracts(contracts.map(c => 
      c.id === id ? { ...c, ...updates, lastModified: Date.now() } : c
    ));
  };

  const deleteContract = (id: string) => {
    saveContracts(contracts.filter(c => c.id !== id));
  };

  return { contracts, globalNIKRegistry, createContract, updateContract, deleteContract };
}
