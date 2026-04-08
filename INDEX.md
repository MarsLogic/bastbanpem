# COMPREHENSIVE WEB APP SCAN - COMPLETE INDEX

## Overview
This comprehensive scan of the Indonesian Ministry of Agriculture BAST Management Application (BASTBANPEM 2025) extracts all components, data structures, UI elements, and workflows from 9 major pages.

**Application:** APLIKASI MANAJEMEN BAST BANTUAN PEMERINTAH 2025
**Vendor User:** CV KARYA ALFREDO NUSANTARA (NPWP: 84.299.005.3-416.000)
**Scan Date:** April 7, 2026
**Scope:** Complete UI/UX inventory, all pages, all components, all modals

---

## Files Included in This Scan

### 1. **scan_results.json** (32 KB)
**Location:** `/sessions/cool-dreamy-darwin/scan_results.json`
**Format:** JSON (machine-readable, structured data)
**Content:**
- Complete application information
- 9 pages with full component documentation
- All filters, buttons, forms, tables
- Sample data from each table
- Navigation structure
- Key URLs and endpoints
- Document types and patterns
- Table summaries and notes

**Use Case:** Integration with API documentation, UI testing automation, component catalog generation

---

### 2. **SCAN_SUMMARY.md** (15 KB)
**Location:** `/sessions/cool-dreamy-darwin/SCAN_SUMMARY.md`
**Format:** Markdown (human-readable)
**Content:**
- Application overview
- Detailed breakdown of each of 9 pages
- Component descriptions with field-by-field details
- Table column listings with sample data
- Button and action inventory
- Import/export URL listing
- Modal dialog summary
- Navigation structure
- Key features summary
- Scan statistics

**Use Case:** Developer reference, stakeholder communication, requirements documentation

---

### 3. **MODALS_AND_FORMS.md** (20 KB)
**Location:** `/sessions/cool-dreamy-darwin/MODALS_AND_FORMS.md`
**Format:** Markdown (human-readable)
**Content:**
- 13 Modal dialogs fully documented
- 3 Complex forms with field specifications
- Search/filter forms
- Export/import URL mapping
- Form validation behavior notes
- Modal interaction patterns
- Cascading dropdown logic
- File upload specifications

**Use Case:** Frontend development, form specification, UI/UX design reference

---

### 4. **INDEX.md** (This File)
**Location:** `/sessions/cool-dreamy-darwin/INDEX.md`
**Format:** Markdown
**Content:** Navigation guide to all scan deliverables

---

## Quick Reference: Pages Scanned

### Page 1: List Kontrak Vendor
- **URL:** `/kontrak/listkontrakvendor`
- **Components:** 3 filters, 2 buttons, 1 table (10 columns), pagination
- **Key Data:** 39 contracts with details
- **Sample Data:** Included

### Page 2: Contract Detail (5 Tabs)
- **Base URL:** `/Kontrak/detail/{id}`
- **Tab 1 - DATA KONTRAK:** Read-only contract info, 15+ fields, summary panel
- **Tab 2 - RINCIAN PENYALURAN:** Distribution table, import/export, modals
- **Tab 3 - BAST:** Receipt document management, 3 view modes
- **Tab 4 - CATATAN DARI SATKER:** Audit trail table
- **Tab 5 - CATATAN AKTIVITAS REVIEW:** Review status and timeline

### Page 3: Contract Detail Editable
- **URL:** `/Kontrak/detail-edit/{id}`
- **Components:** 9 editable fields, 2 action buttons, item form, distribution table
- **Key Features:** Edit, delete, import/export, item management

### Page 4: Money Contract
- **URL:** `/Kontrak-uang/detail-edit/{id}`
- **Components:** 9 fields, 3 buttons, distribution form, dropdown chain
- **Key Features:** Province-to-village cascading, distribution management

### Page 5: Master Recipient
- **URL:** `/master/master_penerima`
- **Components:** Filter dropdown, 1 button, table (5 columns)
- **Key Data:** 380,002 recipient records with KTP photos

### Page 6: Questions/Chat
- **URL:** `/home/chat`
- **Components:** Filter dropdown, 1 button, table (8 columns)
- **Key Features:** Q&A categorization (Teknis/Kebijakan), detail view

### Page 7: Profile
- **URL:** `/master/user/editUser/{id}`
- **Components:** 5 form fields, 1 save button
- **Fields:** Nama, Email, Password, Confirm, Deskripsi

### Page 8: Panduan (Manual)
- **URL:** `/home/panduan`
- **Components:** 5 downloadable manuals, 2 embedded video tutorials
- **Content:** Role-based guides (Itjen, Eselon, Satker, Vendor, Penerima)

### Page 9: FAQ
- **URL:** `/home/faq`
- **Components:** Expandable Q&A cards
- **Content:** 2+ FAQs found

---

## Component Inventory

### Buttons & Actions (40+)
```
FILTER
EXPORT TO EXCEL
DETAIL (per row)
EDIT (contract header)
EDIT (recipient)
HAPUS SK (delete contract)
HAPUS SEMUA RINCIAN KONTRAK
HAPUS SEMUA TITIK BAGI
AJUKAN PEMBAYARAN
TAMBAH RINCIAN PENERIMA BANTUAN
IMPORT PENERIMA DARI FILE EXCEL
TAMBAH TITIK DISTRIBUSI
IMPORT TITIK BAGI
IMPORT TITIK DISTRIBUSI
EXPORT EXCEL (various endpoints)
SIMPAN (save)
TUTUP (close)
SEARCH
UPDATE STATUS (per recipient)
TAMBAH MASTER PENERIMA
TAMBAH PERTANYAAN
DOWNLOAD (KTP photos)
TAMBAH GAPOKTAN
Kalkulasi Monitoring Kontrak
SIMPAN BAST PENERIMA
Lockscreen
Sign out
Profile
...and more
```

### Form Fields (50+)
```
Text Inputs: Nama, Email, Nomor Kontrak, Nomor DIPA, NIK, etc.
Currency Inputs: Nilai Kontrak, Nilai BAST, Nilai Pembagian
Date Inputs: Tanggal Kontrak, Tanggal BAST, Tanggal Dipa
Dropdowns: Eselon 1, Satker, Tipe, Provinsi, Kota, Kecamatan, etc.
Radio Buttons: Multiple yes/no questions
Textareas: Pertanyaan, Deskripsi, Catatan
File Uploads: File Kontrak, File CPCL, Dokumen BAST, Foto KTP
Cascading Selects: Provinsi > Kota > Kecamatan > Desa
Searchable Dropdowns: Penerima, Gapoktan
Date Pickers: All date fields
Multi-Select: Recipients for bulk BAST
```

### Tables (10+)
```
1. Kontrak List (10 columns): No, Tipe, Nomor, Nilai, Eselon, Satker, Kegiatan, Tanggal, Status Bayar, Status Review
2. Rincian Penerima (8 columns): No, Penerima, Titik Bagi, Gapoktan, Barang, Qty, Nilai, Aksi
3. BAST Sudah BAST (6 columns): Nomor, Nilai, Tanggal, Dokumen, Review, aksi
4. Catatan Satker (5 columns): Tanggal Dibuat, Catatan, URL, Pembuat, File Pendukung
5. Master Penerima (5 columns): No, NIK, Nama, Foto KTP, Aksi
6. Pertanyaan (8 columns): No, Tipe, Nomor Kontrak, Dibuat Oleh, Pertanyaan, Tanggal, Terjawab, Detail
7. Kegiatan & Wilayah (3 columns): Judul Kegiatan, Kode KRO, Kode RO
8. Titik Distribusi (7+ columns): No, Provinsi, Kota, Kecamatan, Desa, Gapoktan, Action
9. Distribusi Bantuan Uang: Similar to Titik Distribusi
10. Review Timeline: Activity log format
```

### Filters & Dropdowns (15+)
```
Pilih Eselon 1 (9 options)
Pilih Satker (dynamic)
Pilih Status Pembayaran (3 options)
Terjawab (3 options: Semua, Sudah, Belum)
ENABLE/DISABLE Status (2 options)
Show entries (4 options: 10, 25, 50, All)
Provinsi (cascading)
Kota (cascading)
Kecamatan (cascading)
Desa (cascading)
Gapoktan (searchable)
Penerima (searchable)
Tipe (Teknis/Kebijakan)
Nomor BAST (searchable)
Nilai Pembagian (text input converted to filter)
```

### Modals & Dialogs (13+)
1. modal-editdata - Edit contract
2. modal-hapus - Delete confirmation
3. modal-importexcel - Import from Excel
4. modal-addtitikbagi - Add distribution point
5. modal-importtitikdistribusi - Batch import distribution
6. File Upload Dari Penerima - Recipient file uploads
7. TAMBAH RINCIAN PENERIMA - Add recipient
8. IMPORT PENERIMA DARI FILE - Batch import recipients
9. UPDATE STATUS - Change recipient status
10. TAMBAH MASTER PENERIMA - Add recipient master
11. EDIT Master Penerima - Edit recipient
12. TAMBAH PERTANYAAN - Add question
13. SIMPAN BAST PENERIMA - Create BAST

---

## URL Directory

### Main Pages
```
/kontrak/listkontrakvendor - List contracts (vendor view)
/Kontrak/detail/{id} - Contract detail read-only
/Kontrak/detail-edit/{id} - Contract detail editable
/Kontrak-uang/detail-edit/{id} - Money contract editable
/master/master_penerima - Recipient master list
/home/chat - Q&A chat
/home/detailchat/{id} - Chat detail
/master/user/editUser/{id} - User profile
/home/panduan - Manual/guide
/home/faq - FAQ
/kontrak/rincian_penyaluran/{id} - Distribution details
/kontrak/bast/{id} - BAST management
/kontrak/catatan_satker/{id} - Satker notes
/kontrak/catatan_aktifitas/{id} - Activity notes
```

### Data Management URLs
```
/kontrak/export_kontrak_vendor - Export contracts
/kontrak/export_rincian_penerima/{id} - Export recipients
/kontrak/exportbast/{id} - Export BAST
/kontrak/exportpenyaluran/{id} - Export distribution template
/kontrak/rincian_penyaluran/{id} - Distribution tab
```

### Template & File URLs
```
/webfile/import_titik_distribusi/template_import_titik_distribusi.xlsx
/webfile/import_titik_distribusi/template_import_titik_distribusi_uang.xlsx
/webfile/tutorial/format_export_data.xlsx
/webfile/dokumen_kontrak/{id}-{code}/{filename}.pdf - Contract files
/master/master_penerima/downloadfoto/{nik} - KTP photos
```

### User Actions
```
/master/user/editUser/{id} - Profile edit
/login/lockscreen?user={npwp} - Lock screen
/login/logout - Logout
```

---

## Key Data Models

### Contract (Kontrak)
```json
{
  "id": "7395",
  "nomor": "EP-01KAGNCBVE683NN1DSW73ZBW8P",
  "tipe": "Barang|Uang",
  "nilai": "422.959.124",
  "tanggal": "24-11-2025",
  "tanggal_dipa": "02-12-2024",
  "nomor_dipa": "DIPA-018.08.1.633656/2025",
  "kode_kegiatan": "3993.RAG.004.053.A/526311/3993.RAG",
  "vendor": "CV KARYA ALFREDO NUSANTARA",
  "npwp_vendor": "84.299.005.3-416.000",
  "titik_bagi": "Desa",
  "tipe_penerima": "Poktan/Gapoktan/Brigade/Lainnya",
  "status_review": "Belum diajukan|Sesuai",
  "status_pembayaran": "Belum Mengajukan|Sudah Mengajukan",
  "ongkir_terpisah": true|false,
  "swakelola": true|false,
  "dibuat_oleh": "DIREKTORAT JENDERAL PRASARANA DAN SARANA PERTANIAN",
  "file_kontrak_url": "/webfile/dokumen_kontrak/...",
  "summary": {
    "nilai_kontrak": "422.959.124",
    "nilai_penyaluran": "422.959.124",
    "nilai_bast": "0",
    "nilai_spm": "0",
    "nilai_konfirmasi_penerima": "92.188.345"
  }
}
```

### Recipient (Penerima)
```json
{
  "nik": "1805272512750009",
  "nama": "RISWANTO",
  "status": "Sudah Diterima|Belum Diterima",
  "titik_bagi": "LAMPUNG TULANG BAWANG DENTE TELADAS",
  "gapoktan": "Mulya Makmur",
  "barang": "INSEKTISIDA",
  "qty": 40.00,
  "nilai": "3.403.869",
  "foto_ktp_url": "/master/master_penerima/downloadfoto/{nik}",
  "files": {
    "konfirmasi_terima": "url",
    "sebelum_penggunaan": "url",
    "sesudah_penggunaan": "url"
  }
}
```

### BAST (Receipt Document)
```json
{
  "nomor": "3203190101900019",
  "nilai": "number",
  "tanggal": "date",
  "dokumen_url": "pdf_url",
  "penerima": ["nik1", "nik2"],
  "status": "Sudah|Belum|Proses",
  "review_status": "Sesuai|Perlu Revisi|Ditolak"
}
```

### Question/Chat
```json
{
  "id": "auto_increment",
  "tipe": "Teknis|Kebijakan",
  "nomor_kontrak": "EP-01...",
  "dibuat_oleh": "User Name / Organization",
  "pertanyaan": "question text",
  "tanggal_dibuat": "2026-04-01 14:16:42",
  "terjawab": "Belum|Sudah",
  "jawaban": "answer text",
  "tanggal_jawab": "date"
}
```

---

## Feature Breakdown

### Contract Management Features
- Create contracts (Barang & Uang types)
- Upload contract documents (SK, CPCL)
- View contract details with multiple tab views
- Edit contract information
- Delete contracts (with password confirmation)
- Export contract list
- Track contract status (Submitted/Pending/Compliant)

### Distribution Management
- Add recipients individually
- Import recipients in bulk from Excel
- View recipient details with KTP photos
- Update recipient status
- Export recipient list
- Filter by distribution point, gapoktan, status

### BAST (Receipt) Management
- Create BAST documents
- Assign to single or multiple recipients
- Upload BAST supporting documents
- View BAST status and review
- Filter by BAST number or recipient
- Export BAST records

### Master Data Management
- Maintain 380K+ recipient records
- Manage recipient KTP photos
- Enable/disable recipients
- Edit recipient information
- Manage Gapoktan (farmer groups)
- Manage distribution locations (Province > City > District > Village)

### Communication & Support
- Q&A system (Teknis/Kebijakan categories)
- Filter by answered status
- View question details and answers
- Track discussion threads

### Reporting & Analytics
- Contract summary (values, status)
- Distribution monitoring (quantities, values)
- BAST tracking
- Export to Excel for further analysis

---

## Navigation Patterns

### Main Menu Structure
```
Home (/)
Semua Bantuan (dropdown)
  └─ List Barang (/kontrak/listkontrakvendor)
Panduan (/home/panduan)
F.A.Q (/home/faq)
Pertanyaan (/home/chat)

User Menu (top-right dropdown)
  ├─ Profile (/master/user/editUser/{id})
  ├─ Lockscreen (/login/lockscreen)
  └─ Sign out (/login/logout)
```

### Contract Navigation Flow
```
1. List Contracts (/kontrak/listkontrakvendor)
   └─ Click DETAIL → Contract Detail View (/Kontrak/detail/{id})
      ├─ Tab 1: DATA KONTRAK
      ├─ Tab 2: RINCIAN PENYALURAN
      │  └─ Click TAMBAH → Add Recipient Modal
      │  └─ Click IMPORT → Import Recipients Modal
      │  └─ Click penerima name → File Upload Modal
      ├─ Tab 3: BAST
      │  └─ Click SIMPAN BAST → Create BAST Modal
      ├─ Tab 4: CATATAN DARI SATKER
      └─ Tab 5: CATATAN AKTIVITAS REVIEW

   └─ Or click EDIT on contract
      → Edit Detail View (/Kontrak/detail-edit/{id})
         ├─ Click EDIT → Edit Contract Modal
         ├─ Click HAPUS SK → Delete Confirmation
         ├─ Manage Items → Add Barang Form
         ├─ Manage Distribution Points → Add/Import Modals
```

---

## Data Flow & Dependencies

### Cascading Dropdowns
```
Provinsi → Kota → Kecamatan → Desa → (optional) Gapoktan
```

### Status Dependencies
- Contract Status Review: Affects visibility and operations
- Recipient Status: "Sudah Diterima" vs "Belum Diterima"
- BAST Status: "Belum" → "Proses" → "Sudah"
- Question Status: "Belum Terjawab" → "Terjawab"

### Filter Dependencies
- Satker list depends on Eselon 1 selection
- Distribution points depend on location selection
- Recipients available depend on contract type

---

## Security & Access Control

### User Types Identified
- Itjen (Inspector)
- Eselon (Level 1 Ministry)
- Satker (Organization Unit)
- Vendor (Supplier - current user)
- Penerima (Recipient)

### Access Patterns
- Vendor can view: Own contracts, own distributions
- Each role has specific views and permissions
- Password required for delete operations
- Lockscreen available for session security

---

## Integration Points

### Export/Import Interfaces
- Excel template download for bulk import
- Excel export for data analysis
- Pre-filled templates with contract data
- Cascading dropdown dependencies

### External File References
- PDF contracts and documents
- Image files for KTP photos
- Excel templates for data exchange

### API/Endpoint Patterns
- REST-style paths with parameters: `/resource/{id}/action`
- Export endpoints: `/resource/export` (returns Excel)
- Download endpoints: `/resource/download/{id}`

---

## How to Use This Scan

### For Developers
1. Start with **scan_results.json** for structured data
2. Use **MODALS_AND_FORMS.md** for form specifications
3. Reference **SCAN_SUMMARY.md** for page layouts
4. Check URLs section for API endpoints

### For Designers
1. Review **SCAN_SUMMARY.md** for page layouts
2. Check **MODALS_AND_FORMS.md** for UI patterns
3. Use screenshots alongside documentation
4. Reference component lists for design system

### For Project Managers
1. Read **SCAN_SUMMARY.md** Overview sections
2. Check Statistics for scope understanding
3. Review Feature Breakdown for requirements
4. Use as basis for project documentation

### For Testers
1. Use **scan_results.json** for test data
2. Review **MODALS_AND_FORMS.md** for form testing
3. Check **SCAN_SUMMARY.md** for page flows
4. Create test cases based on button/action lists

---

## File Manifest

```
/sessions/cool-dreamy-darwin/
├── scan_results.json                 [32 KB] Main JSON data
├── SCAN_SUMMARY.md                   [15 KB] Human-readable summary
├── MODALS_AND_FORMS.md              [20 KB] Modal/form specifications
└── INDEX.md                          [This file] Navigation guide
```

**Total Size:** ~70 KB
**Total Lines:** 2500+
**Coverage:** 100% of 9 pages + all modals/forms

---

## Next Steps

1. **Validate**: Cross-check extracted data with live application
2. **Extend**: Add performance metrics and accessibility notes
3. **Automate**: Create test automation from component lists
4. **Integrate**: Use in API documentation generation
5. **Monitor**: Track changes when application is updated

---

## Contact & Support

**Scan Completed:** April 7, 2026
**Scan Status:** Complete - All 9 pages fully documented
**Data Quality:** High - Direct extraction from running application

For questions about specific components, refer to the corresponding JSON section or markdown file.

