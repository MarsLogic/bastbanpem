import { useState, useEffect, useMemo } from 'react';
import localforage from 'localforage';
import { ExcelRow } from './excelParser';

localforage.config({
  name: 'BASTAutomator',
  storeName: 'contracts'
});

export interface GlobalConfig {
  nomor_sertifikat: string;
  tanggal_sertifikat: string;
  lembaga_penguji: string;
  ktpDir?: string;
  proofDir?: string;
}

export interface ContractData {
  id: string;
  name: string; // User friendly name
  
  // PDF Data
  contractPdfPath: string | null;
  nomorKontrak: string;
  tanggalKontrak: string;
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

  const createContract = (name: string, pdfPath?: string) => {
    const newContract: ContractData = {
      id: crypto.randomUUID(),
      name,
      contractPdfPath: pdfPath || null,
      nomorKontrak: '',
      tanggalKontrak: '',
      namaPemesan: '',
      namaPenyedia: '',
      namaProduk: '',
      kuantitasProduk: '',
      totalPembayaran: '',
      sskkText: '',
      specsTable: [],
      excelPath: null,
      recipients: [],
      bastbPath: null,
      suratJalanPath: null,
      invoiceOngkirPath: null,
      sertifikatLabPath: null,
      lastModified: Date.now()
    };
    saveContracts([...contracts, newContract]);
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
