import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useMemo } from 'react';
import localforage from 'localforage';

localforage.config({
  name: 'BASTAutomator',
  storeName: 'contracts_v2'
});

export interface ContractMetadata {
  nomorKontrak?: string;
  tanggalKontrak?: string;
  namaPemesan?: string;
  namaPpk?: string;
  npwpPemesan?: string;
  namaPenyedia?: string;
  npwpPenyedia?: string;
  namaProduk?: string;
  kuantitasProduk?: string;
  hargaSatuan?: string;
  totalPembayaran?: string;
  jumlahTahap?: string;
  nomorDipa?: string;
  kegiatanOutputAkun?: string;
  isOngkirTerpisah?: boolean;
  isSwakelola?: boolean;
  isMenggunakanTermin?: boolean;
  extractedAt?: string;
  sourceFile?: string;
}

export interface DeliveryBlock {
  // Identity
  namaPenerima?: string;
  noTelp?: string;
  permintaanTiba?: string;
  // Location
  namaPoktan?: string;
  alamatLengkap?: string;
  desa?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  kodePos?: string;
  catatanAlamat?: string;
  // Financials
  jumlah?: string;            // quantity as string e.g. "1.300,00"
  jumlahProduk?: number;      // legacy numeric form
  hargaProdukTotal?: string;
  ongkosKirim?: string;
  pageSource?: number;
  // Reconciliation link
  nama?: string;              // alias for reconciliation matching
}

export interface PortalMetadata {
  portalId: string;         // idkontrak from portal
  nomorDipa?: string;       // k_dipa
  kodeKegiatan?: string;    // k_kode_kegiatan
  kodeOutput?: string;      // k_kode_output
  kodeAkun?: string;        // k_kode_akun
  syncTimestamp: number;
  lastPortalStatus?: 'selesai' | 'proses' | 'draft';
}

export interface RecipientSyncState {
  isRegistered: boolean;    // Exists in master_penerima
  isLinkedToContract: boolean; // Exists in rpb for this contract
  portalQty?: number;
  portalValue?: number;
  mismatchFields?: string[]; // e.g., ['qty', 'name']
}

export interface RecipientProxyData {
  nik: string;
  name: string;
  relation: string; // e.g., 'Suami', 'Istri', 'Anak'
  ktpPath?: string;
}

export interface ExcelRow {
  id: string;
  rowId?: string; // Support for ReconciliationTab
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
  // Portal Sync State
  syncState?: RecipientSyncState;
  // Proxy Info
  proxy?: RecipientProxyData;
  // UI-only temporary fields
  isDuplicate?: boolean;
  isGlobalDouble?: boolean;
  otherContracts?: { id: string, name: string }[];
  // Audit / Legacy fields
  hasSJ?: boolean;
  hasPhoto?: boolean;
  hasKtp?: boolean;
  calculatedValue?: number;
  originalValues?: Record<string, any>;
  editedValues?: Record<string, any>;
}

export interface ContractData {
  id: string;
  name: string; 
  
  // PDF Data
  contractPdfPath: string | null;
  pdfBlob?: Blob | null;
  nomorKontrak: string;
  tanggalKontrak: string;
  contractYear?: number;
  namaPemesan?: string;
  namaPpk?: string;
  npwpPemesan?: string;
  namaPenyedia?: string;
  npwpPenyedia?: string;
  namaProduk?: string;
  kuantitasProduk?: string;
  hargaSatuan?: string;
  totalPembayaran?: string;
  jumlahTahap?: string;
  nomorDipa?: string;
  kegiatanOutputAkun?: string;

  isOngkirTerpisah?: boolean;
  isSwakelola?: boolean;
  isMenggunakanTermin?: boolean;

  deliveryBlocks?: DeliveryBlock[];
  
  // Portal Metadata
  portalMetadata?: PortalMetadata;
  
  // Expanded PDF Extraction
  sections?: Record<string, string>;
  tables?: any[];
  fullText?: string;
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
  metadata?: any;
}

interface ContractStore {
  contracts: ContractData[];
  createContract: (name: string, initialData?: any) => string;
  updateContract: (id: string, updates: Partial<ContractData>) => void;
  deleteContract: (id: string) => void;
  setContracts: (contracts: ContractData[]) => void;
}

// [UIUX-005] Custom storage adapter that strips Blobs before persistence
// Blobs are stored separately in IndexedDB via pdfStorage.ts
const createBlobSafeStorage = () => {
  const baseStorage = localforage;

  return {
    getItem: async (name: string) => {
      const item = await baseStorage.getItem(name);
      if (!item) return null;

      // Parse and strip pdfBlobs
      const parsed = typeof item === 'string' ? JSON.parse(item) : item;
      return {
        ...parsed,
        contracts: (parsed.contracts || []).map((c: any) => ({
          ...c,
          pdfBlob: null // PdfSyncModule will restore from IndexedDB
        }))
      };
    },
    setItem: async (name: string, value: any) => {
      // Strip Blobs from value before storing
      const cleaned = {
        ...value,
        contracts: (value.contracts || []).map((c: any) => ({
          ...c,
          pdfBlob: null // Don't persist Blobs in JSON storage
        }))
      };
      await baseStorage.setItem(name, JSON.stringify(cleaned));
    },
    removeItem: async (name: string) => {
      await baseStorage.removeItem(name);
    }
  };
};

export const useContractStore = create<ContractStore>()(
  persist(
    (set, get) => ({
      contracts: [],

      setContracts: (contracts) => set({ contracts }),

      createContract: (name, initialData) => {
        const id = crypto.randomUUID();
        const newContract: ContractData = {
          id,
          name,
          contractPdfPath: initialData?.master_pdf_path || null,
          nomorKontrak: initialData?.contract_no || '',
          tanggalKontrak: initialData?.contract_date || '',
          namaPemesan: initialData?.nama_pemesan || '',
          namaPenyedia: initialData?.nama_penyedia || '',
          namaProduk: initialData?.nama_produk || '',
          kuantitasProduk: initialData?.kuantitas_produk || '',
          totalPembayaran: initialData?.total_pembayaran || '',
          sections: {},
          fullText: '',
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
        set((state) => ({ contracts: [...state.contracts, newContract] }));
        return id;
      },

      updateContract: (id, updates) => {
        set((state) => ({
          contracts: state.contracts.map((c) =>
            c.id === id ? { ...c, ...updates, lastModified: Date.now() } : c
          ),
        }));
      },

      deleteContract: (id) => {
        set((state) => ({
          contracts: state.contracts.filter((c) => c.id !== id),
        }));
      },
    }),
    {
      name: 'bast-automator-storage',
      storage: createBlobSafeStorage()
    }
  )
);

// Legacy hook bridge to avoid breaking existing components
export function useContracts() {
  const contracts = useContractStore((state) => state.contracts);
  const createContract = useContractStore((state) => state.createContract);
  const updateContract = useContractStore((state) => state.updateContract);
  const deleteContract = useContractStore((state) => state.deleteContract);

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

  return { contracts, globalNIKRegistry, createContract, updateContract, deleteContract };
}
