# Indonesian Ministry of Agriculture Web App - Comprehensive Scan Summary

## Application Overview
- **Name**: APLIKASI MANAJEMEN BAST BANTUAN PEMERINTAH 2025
- **URL**: https://bastbanpem.pertanian.go.id
- **Current User**: CV KARYA ALFREDO NUSANTARA (Vendor, NPWP: 84.299.005.3-416.000)
- **Version**: 1.0.0
- **Copyright**: Biro Keuangan dan Perlengkapan Kementerian Pertanian

## Pages Scanned

### PAGE 1: List Kontrak Vendor (`/kontrak/listkontrakvendor`)
**Components Extracted:**
- 3 Filter Dropdowns:
  - Pilih Eselon 1 (9 options: HORTI, BUN, TP, PKH, PSP, BRMP, BPSDMP, SEKJEN, LIP)
  - Pilih Satker (dynamic based on Eselon selection)
  - Pilih Status Pembayaran (3 options)
- 2 Action Buttons:
  - FILTER button (applies filters)
  - EXPORT TO EXCEL button
- Table with 10 columns and 39 total contract entries
- Pagination with configurable entries (10, 25, 50, All)
- Search functionality

**Table Columns:**
1. No
2. Tipe (Contract Type: Barang/Uang)
3. Nomor Kontrak (Contract Number)
4. Nilai kontrak (Contract Value)
5. Eselon1 (Ministry Level 1)
6. Satker (Organization Unit)
7. Kode Kegiatan / Output / Akun (Activity/Output/Account Code)
8. Tanggal Kontrak (Contract Date)
9. Status Pembayaran (Payment Status)
10. Status Review (Review Status)

---

### PAGE 2: Detail Contract - 5 Tabs (`/Kontrak/detail/{id}` - Example: ID 7395)

#### Tab 1: DATA KONTRAK (Read-Only)
**Content Extracted:**
- Contract Header: Number, Status Review badge
- Data Fields (15+ fields):
  - Tanggal Kontrak, Nilai Kontrak, Nomor DIPA
  - Kegiatan/Output/Akun, Titik Bagi, Tipe Penerima
  - Jenis Kontrak, Vendor, NPWP Vendor
  - File Kontrak (downloadable PDF)
  - Dibuat Oleh, Ongkir Setting, Swakelola Setting
- Summary Panel (4 summary values):
  - Nilai Kontrak, Nilai Penyaluran
  - Nilai Bast, Nilai SPM, Nilai Konfirmasi Penerima
- Kegiatan & Wilayah Section (Activity/Region table)

#### Tab 2: RINCIAN PENYALURAN (Distribution Details)
**Content Extracted:**
- Left Sidebar (Contract Info Panel - 12+ fields)
- 4 Main Action Buttons:
  - AJUKAN PEMBAYARAN (green)
  - Kalkulasi Monitoring Kontrak (link)
  - TAMBAH RINCIAN PENERIMA BANTUAN (green)
  - IMPORT PENERIMA DARI FILE EXCEL (green)
- Additional Actions: EXPORT EXCEL, HAPUS SEMUA RINCIAN KONTRAK

**Distribution Recipients Table:**
- 8 Columns: No, Penerima (NIK+Nama), Titik Bagi, Gapoktan, Barang, Qty, Nilai, Aksi
- Row Status Badges: "Sudah Diterima" (green)
- Per-Row Action: UPDATE STATUS button
- Recipient Click Action: Opens "File Upload Dari Penerima" modal with 3 file download options

**Import Section:**
- 2 Tabs: "Import Excel" and "Data Import Excel"
- Template Download URL: `/kontrak/exportpenyaluran/{id}`

#### Tab 3: BAST (Berita Acara Serah Terima)
**Content Extracted:**
- "TAMBAH BAST" Section with form:
  - Radio: "Apakah BAST digunakan lebih dari satu penerima?"
  - Text Fields: Nomor BAST, Nilai BAST
  - Date Field: Tanggal BAST
  - Dropdown: Penerima BAST
  - File Upload: Dokumen BAST
  - Submit Button: SIMPAN

- "BAST PENERIMA BANTUAN" Section with 3 View Tabs:
  - Tab 1: PENERIMA BELUM BAST (Recipients without BAST)
  - Tab 2: PENERIMA SUDAH BAST (Recipients with BAST)
    - Table columns: Nomor, Nilai, Tanggal, Dokumen, Review, aksi
  - Tab 3: PENERIMA UNTUK BANYAK BAST (Multiple recipients per BAST)

- Search/Filter Section:
  - Dropdown: Pilih Nomor BAST
  - Text Inputs: Nama Penerima, Nama Desa
  - Button: SEARCH

- Action Button: SIMPAN BAST PENERIMA
- Export: EXPORT EXCEL button (URL: `/kontrak/exportbast/{id}`)

#### Tab 4: CATATAN DARI SATKER (Notes from Organization Unit)
**Content Extracted:**
- Audit Trail Table with 5 columns:
  - Tanggal Dibuat (Creation Date)
  - Catatan (Notes)
  - URL Catatan (Note URL)
  - Pembuat (Creator)
  - File Pendukung (Supporting Files)

#### Tab 5: CATATAN AKTIVITAS REVIEW (Review Activity Notes)
**Content Extracted:**
- Status Display: Hasil Review section
- 4 Review Sub-Tabs:
  - Kontrak (Contract Review)
  - Rincian Penyaluran (Distribution Review)
  - BAST (BAST Review)
  - SPM (Payment Request Review)
- Timeline Review section showing review process chronology

---

### PAGE 3: Detail Contract - Editable (`/Kontrak/detail-edit/{id}` - Example: ID 7375)

**Header Section - Contract Data Fields (9 fields):**
- Nomor, Nomor Dipa, Kode Kegiatan/Output/Akun
- Tanggal Kontrak, Tanggal Dipa
- Nilai Kontrak, File Kontrak, File CPCL
- Vendor, Titik Bagi, Tipe Penerima
- Questions: Ongkir terpisah?, Swakelola?, Pembelian langsung?

**Action Buttons:**
- EDIT (opens modal-editdata)
- HAPUS SK (delete with confirmation)

**Detail Nilai & Volume Barang Section:**
- Form: Tambah Item Barang
  - Fields: Nama Barang, Merk, Spesifikasi
  - Radios (6): Running test, Sertifikasi benih, Uji lab, Surat kesehatan hewan
  - Button: Simpan

- Buttons for Distribution Points:
  - IMPORT TITIK BAGI (template: template_import_titik_distribusi.xlsx)
  - EXPORT TITIK BAGI
  - TAMBAH TITIK DISTRIBUSI (opens modal-addtitikbagi)
  - IMPORT TITIK DISTRIBUSI (opens modal-importtitikdistribusi)
  - HAPUS SEMUA TITIK BAGI

- Titik Distribusi Table:
  - Columns: No, Provinsi, Kota, Kecamatan, Desa, Gapoktan, Action

---

### PAGE 4: Kontrak Uang (Money Contract) - Editable (`/Kontrak-uang/detail-edit/{id}` - Example: ID 7915)

**DATA KONTRAK UANG Section:**
- Fields (9): Nomor SK, Nomor Dipa, Kode Kegiatan, Tanggal SK, Tanggal Dipa, Tanggal Penyelesaian, Periode, Nilai SK
- Downloads: File SK, File CPCL
- Question: Apakah SK ini HOK?
- Buttons: EDIT, HAPUS SK

**Detail Distribusi Bantuan Uang Section:**
- Dropdowns (6): Provinsi, Kota, Kecamatan, Desa, Gapoktan, Nilai Pembagian
- Buttons: TAMBAH, TAMBAH GAPOKTAN, IMPORT DISTRIBUSI BANTUAN UANG
- Distribution Table with columns: No, Provinsi, Kota, Kecamatan, Desa, Gapoktan, Nilai Pembagian, Action

---

### PAGE 5: Master Penerima (Master Recipient) (`/master/master_penerima`)

**Filter Dropdown:**
- ENABLE/DISABLE status selector

**Action Button:**
- TAMBAH MASTER PENERIMA (Add new recipient)

**Table (5 columns):**
- No, NIK Penerima, Nama, Foto KTP, Aksi
- Row Actions:
  - DOWNLOAD (KTP photo)
  - EDIT (opens edit modal with: NIK, Nama, Foto KTP upload)
- Pagination: 380,002 total entries
- Entries per page configurable

---

### PAGE 6: Pertanyaan / Chat (`/home/chat`)

**Filter:**
- Dropdown: Terjawab (All, Answered, Unanswered)

**Action Button:**
- TAMBAH PERTANYAAN (Add question)
  - Modal fields: Tipe (Teknis/Kebijakan), Nomor Kontrak, Pertanyaan (textarea)

**Table (8 columns):**
- No, Tipe, Nomor Kontrak, Dibuat Oleh, Pertanyaan, Dibuat tanggal, Terjawab, # (Detail)
- Row Action: DETAIL button opens `/home/detailchat/{id}`

---

### PAGE 7: Profile (`/master/user/editUser/{id}`)

**Form Fields:**
1. Nama (text input) - required
2. Email (email input) - required
3. Password (password input)
4. Confirm Password (password input)
5. Deskripsi (textarea)

**Button:** SAVE (submit)

---

### PAGE 8: Panduan (Manual/Guide) (`/home/panduan`)

**Download Section - Manual Books:**
- Role Itjen (download link)
- Role Eselon (download link)
- Role Satker (download link)
- Role Vendor (download link)
- Role Penerima (download link)

**Tutorial Videos Section:**
- Kontrak Barang: Tutorial Pembuatan Kontrak Barang (embedded video)
- Kontrak Uang: Tutorial Pembuatan Kontrak Uang (embedded video)

---

### PAGE 9: FAQ (`/home/faq`)

**Frequently Asked Questions:**
- Expandable Q&A cards
- At least 2 FAQs found:
  1. "Bagaimana cara berkomunikasi jika terdapat kendala?"
  2. "Bagaimana Jika Desa atau Kecamatan tidak ada dalam pilihan?"

---

## Navigation Structure

### Main Menu
- Home
- Semua Bantuan
  - List Barang
- Panduan
- F.A.Q
- Pertanyaan

### User Menu (Top Right)
- Profile
- Lockscreen
- Sign out

---

## Key URLs Extracted

```
/kontrak/listkontrakvendor - List contracts
/Kontrak/detail/{id} - Read-only contract detail
/Kontrak/detail-edit/{id} - Editable contract detail
/kontrak/rincian_penyaluran/{id} - Distribution details
/kontrak/bast/{id} - BAST management
/kontrak/catatan_satker/{id} - Notes from Satker
/kontrak/catatan_aktifitas/{id} - Activity notes
/Kontrak-uang/detail-edit/{id} - Money contract edit
/master/master_penerima - Recipient master list
/home/chat - Questions/Chat
/home/detailchat/{id} - Chat detail
/master/user/editUser/{id} - Profile
/home/panduan - Manual/Guide
/home/faq - FAQ
```

## Export/Import URLs

```
/kontrak/export_kontrak_vendor - Export list contracts
/kontrak/export_rincian_penerima/{id} - Export recipients
/kontrak/exportbast/{id} - Export BAST
/kontrak/exportpenyaluran/{id} - Export distribution template
/webfile/import_titik_distribusi/template_import_titik_distribusi.xlsx
/webfile/import_titik_distribusi/template_import_titik_distribusi_uang.xlsx
/webfile/tutorial/format_export_data.xlsx
```

---

## Modals/Popups Found

1. **modal-editdata** - Edit contract information
2. **modal-hapus** - Delete confirmation with password prompt
3. **modal-importexcel** - Import data from Excel files
4. **modal-addtitikbagi** - Add distribution point
5. **modal-importtitikdistribusi** - Import multiple distribution points
6. **File Upload Dari Penerima** - Recipient file uploads (3 files)

---

## Key Features Summary

**Contract Management:**
- Create, read, update contracts (Barang/Uang types)
- Contract document uploads (SK, CPCL)
- Status tracking (Submitted, Pending, Compliant)

**Distribution Management:**
- Add/import recipients
- Track distribution status ("Sudah Diterima"/"Belum Diterima")
- View recipient KTP photos
- Update recipient status

**BAST (Receipt) Management:**
- Create BAST documents
- Assign to single/multiple recipients
- Track BAST status

**Communication:**
- Q&A system with Teknis/Kebijakan categorization
- Audit trail for satker notes
- Review activity timeline

**Data Management:**
- 380,000+ recipient master records
- Excel import/export capabilities
- Pagination and search on all tables

---

## Scan Statistics

- **Total Pages Scanned**: 9
- **Total Tables Identified**: 10+
- **Total Modals Found**: 6
- **Total Form Fields**: 50+
- **Total Buttons/Actions**: 40+
- **Contract Types**: 2 (Barang, Uang)
- **Total Entries Accessible**: 39 contracts (vendor view), 380,002 recipients (system-wide)

---

## Output File
**Location**: `/sessions/cool-dreamy-darwin/scan_results.json`
**Size**: 32 KB
**Format**: JSON
**Lines**: 1008
