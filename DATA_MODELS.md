# DATA_MODELS.md - TypeScript Schema Definitions

These interfaces serve as the contract between our Excel Parser, the Visual Slicer, and the Injection Bridge.

```typescript
/**
 * Global application state representing a single BAST package.
 */
export interface Contract {
  id: string;                // Internal UUID
  spkNumber: string;         // Official SPK Number
  totalValue: number;        // Total contract value (Decimal.js formatted)
  totalQuantity: number;     // Total expected recipients
  contractYear: number;      // e.g. 2025
  recipients: Recipient[];   // Array of all beneficiaries
  isLocked: boolean;         // Prevents editing after injection starts
  globalConfig: GlobalConfig; // Phase 4: Global assets
}

/**
 * Global settings that apply across all rows if 'useGlobal' is true.
 */
export interface GlobalConfig {
  uji_lab_file?: string;        // Absolute path to global Lab PDF
  sertifikasi_lab_file?: string; // Absolute path to global cert PDF
  transport_invoice_file?: string; // Absolute path to global invoice
  nomor_sertifikat: string;
  tanggal_sertifikat: string;
  lembaga_penguji: string;
}

/**
 * A single recipient/beneficiary record.
 */
export interface Recipient {
  id: string;                // Row ID from Excel
  nik: string;               // 16-digit ID number
  name: string;              // Full name (Uppercase normalized)
  quantity: number;          // Quantity of items received
  unitValue: number;         // Value per unit
  totalValue: number;        // quantity * unitValue
  
  // File Status Links
  status: {
    hasBastFile: boolean;    // Green if bound to a FileAsset
    hasKtpFile: boolean;     // Green if bound to a FileAsset
    isVerified: boolean;     // Manually verified by human eye
    isReady: boolean;        // Phase 4: Full readiness check
  };
  
  // Phase 4 inheritance flags
  useGlobal: {
    ujiLab: boolean;
    sertifikasiLab: boolean;
    transportInvoice: boolean;
  };

  linkedAssets: FileAsset[]; // References to local files (priority over global)
}

/**
 * Metadata for local files associated with a recipient.
 */
export interface FileAsset {
  uid: string;               // Unique ID
  fileName: string;          // Original filename or generated name
  localPath: string;         // Absolute path on user's machine (handled by Tauri)
  assetType: 'PDF' | 'JPG';  // File format
  purpose: 'BAST' | 'KTP' | 'SURAT_JALAN' | 'PHOTO' | 'UJI_LAB' | 'SERTIFIKASI' | 'INVOICE';
  pageNumber?: number;       // If it was a page from a larger PDF
  cropCoordinates?: {        // For JPG crops
    x: number;
    y: number;
    w: number;
    h: number;
  };
}
```

## Accuracy Principles
1. **Normalization**: All strings (Name, NIK) must be trimmed and converted to Uppercase during parsing.
2. **Precision**: All `number` types in the code must be handled via `Decimal.js` before UI display to ensure `Selisih: 0.00`.
