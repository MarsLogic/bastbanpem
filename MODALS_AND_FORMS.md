# Modal Dialogs and Forms - Detailed Reference

## Modal 1: modal-editdata (Edit Contract Data)
**Triggered From:** PAGE 3 Detail Edit - EDIT button
**Purpose:** Edit contract header information
**Form Fields:**
- Nomor (Contract Number) - text input
- Nomor Dipa (DIPA Number) - text input
- Kode Kegiatan/Output/Akun - text input
- Tanggal Kontrak (Contract Date) - date input
- Tanggal Dipa (DIPA Date) - date input
- Nilai Kontrak (Contract Value) - currency input
- File Kontrak - file upload
- File CPCL - file upload
- Vendor - text input
- Titik Bagi - dropdown
- Tipe Penerima - dropdown
- Apakah ongkir terpisah? - radio (Ya/Tidak)
- Apakah Swakelola? - radio (Ya/Tidak)

**Buttons:**
- Submit / Save
- Cancel

---

## Modal 2: modal-hapus (Delete Confirmation)
**Triggered From:** PAGE 3 Detail Edit - HAPUS SK button
**Purpose:** Confirm deletion of contract with password verification
**Content:**
- Heading: "Apakah Anda Yakin Untuk Menghapus Kontrak Ini?"
- Form Field: "Confirm Password" (password input)
- Hidden Field: Contract ID

**Buttons:**
- Tidak (Cancel)
- Ya (Confirm Delete)

---

## Modal 3: modal-importexcel (Import Distribution Points)
**Triggered From:** PAGE 3 Detail Edit - IMPORT TITIK BAGI button
**Purpose:** Import distribution points from Excel template
**Content:**
- Template Download Link: `/webfile/import_titik_distribusi/template_import_titik_distribusi.xlsx`
- File Upload: Select Excel file
- Preview Table: Shows data to be imported

**Template Columns:** (Expected)
- Provinsi (Province)
- Kota (City)
- Kecamatan (District)
- Desa (Village)
- Gapoktan (Farmer Group Code)
- Nilai (Value)
- Qty (Quantity)

**Buttons:**
- Upload / Import
- Cancel

---

## Modal 4: modal-addtitikbagi (Add Distribution Point)
**Triggered From:** PAGE 3 Detail Edit - TAMBAH TITIK DISTRIBUSI button
**Purpose:** Manually add a single distribution point
**Form Fields:**
- Provinsi - dropdown (selectable provinces)
- Kota - dropdown (updates based on Provinsi)
- Kecamatan - dropdown (updates based on Kota)
- Desa - dropdown (updates based on Kecamatan)
- Gapoktan - dropdown or searchable select
- Value / Amount - currency input (optional based on contract type)

**Buttons:**
- Simpan (Save)
- Batal (Cancel)

---

## Modal 5: modal-importtitikdistribusi (Import Multiple Distribution Points)
**Triggered From:** PAGE 3 Detail Edit - IMPORT TITIK DISTRIBUSI button
**Purpose:** Batch import distribution points for Uang contracts
**Content:**
- Multiple Template Options:
  - `/webfile/import_titik_distribusi/template_import_titik_distribusi_uang.xlsx`
  - `/webfile/tutorial/format_export_data.xlsx`
- File Upload: Select Excel file
- Mapping Options: (If needed) Map columns to fields

**Expected Template Columns:**
- Provinsi
- Kota
- Kecamatan
- Desa
- Gapoktan
- Nilai Pembagian (Distribution Value)

**Buttons:**
- Import / Upload
- Cancel

---

## Modal 6: File Upload Dari Penerima (Recipient File Upload)
**Triggered From:** PAGE 2 Tab 2 - Click on Penerima name in table row
**Purpose:** Show recipient-provided documentation files and allow downloads
**Modal Title:** "File Upload Dari Penerima"
**Content Sections:**

### File 1: Konfirmasi terima bantuan (Confirmation of Receipt)
- **Label:** File 1. Konfirmasi terima bantuan
- **Action:** Download link
- **Purpose:** Recipient confirms receiving the aid

### File 2: Sebelum menggunakan bantuan (Before Using Aid)
- **Label:** File 2. Sebelum menggunakan bantuan
- **Action:** Download link
- **Purpose:** Pre-usage documentation (e.g., photos, condition)

### File 3: Sesudah menggunakan bantuan (After Using Aid)
- **Label:** File 3. Sesudah menggunakan bantuan
- **Action:** Download link
- **Purpose:** Post-usage documentation (e.g., impact photos)

**Additional Info Displayed (Inferred):**
- Recipient NIK
- Recipient Name
- Status Badge: "Sudah Diterima" (green badge)
- KTP Photo (likely displayed)

**Buttons:**
- Tutup (Close)

---

## Modal 7: TAMBAH RINCIAN PENERIMA BANTUAN (Add Recipient Distribution)
**Triggered From:** PAGE 2 Tab 2 - TAMBAH RINCIAN PENERIMA BANTUAN button
**Purpose:** Add a new recipient for distribution
**Form Fields:**
- Penerima (Recipient) - autocomplete/searchable dropdown (from Master Penerima)
- Titik Bagi (Distribution Point) - dropdown
- Gapoktan (Farmer Group) - dropdown
- Barang (Item/Good) - dropdown (if contract is Barang type)
- Qty (Quantity) - number input
- Nilai (Value) - currency input (auto-calculated based on Qty)

**Buttons:**
- Simpan (Save)
- Batal (Cancel)

---

## Modal 8: IMPORT PENERIMA DARI FILE EXCEL (Import Recipients from Excel)
**Triggered From:** PAGE 2 Tab 2 - IMPORT PENERIMA DARI FILE EXCEL button
**Purpose:** Bulk import recipients from Excel
**Content:**
- Template Download: `/kontrak/exportpenyaluran/{id}` (pre-filled with contract data)
- File Upload: Select Excel file with recipients
- Option to: Update existing / Add new recipients

**Template Columns:** (Pre-filled template contains)
- No (Row number)
- Penerima (Recipient NIK/Name)
- Titik Bagi (Distribution Point)
- Gapoktan (Farmer Group)
- Barang/Item (Product)
- Qty (Quantity)
- Nilai (Value)

**Buttons:**
- Import / Upload
- Cancel

---

## Modal 9: UPDATE STATUS (Per-Recipient Status Update)
**Triggered From:** PAGE 2 Tab 2 - UPDATE STATUS button (per row)
**Purpose:** Change recipient distribution status
**Form Content:**
- Current Status Display: e.g., "Sudah Diterima"
- Status Options (Dropdown/Radio):
  - Sudah Diterima (Received)
  - Belum Diterima (Not Received)
  - Other status options (to be confirmed)
- Optional: Date field for status change
- Optional: Notes field for status comment

**Buttons:**
- Simpan (Save)
- Batal (Cancel)

---

## Modal 10: TAMBAH MASTER PENERIMA (Add Recipient Master)
**Triggered From:** PAGE 5 - TAMBAH MASTER PENERIMA button
**Purpose:** Add new recipient to system master list
**Form Fields:**
- NIK (National ID Number) - text input (required, unique)
- Nama (Name) - text input (required)
- Foto KTP (KTP Photo) - file upload (image)
  - Accepted formats: JPG, PNG
  - Size limit: (to be confirmed)

**Buttons:**
- Simpan (Save)
- Batal (Cancel)

---

## Modal 11: EDIT Master Penerima
**Triggered From:** PAGE 5 - EDIT button (per row)
**Purpose:** Edit recipient master data
**Form Fields:**
- NIK (National ID Number) - text input (disabled for edit)
- Nama (Name) - text input (editable)
- Foto KTP (KTP Photo) - file upload (replace existing image)
  - Shows current photo
  - Option to upload new one

**Buttons:**
- Update / Simpan (Save)
- Cancel / Batal

---

## Modal 12: TAMBAH PERTANYAAN (Add Question)
**Triggered From:** PAGE 6 Chat - TAMBAH PERTANYAAN button
**Purpose:** Create new Q&A for contract clarification
**Form Fields:**
- Tipe (Question Type) - dropdown
  - Option 1: Teknis (Technical)
  - Option 2: Kebijakan (Policy)
- Nomor Kontrak (Contract Number) - text input / autocomplete
- Pertanyaan (Question) - textarea
  - Placeholder: (to be confirmed)
  - Character limit: (to be confirmed)

**Buttons:**
- Submit / Kirim (Send)
- Cancel / Batal

---

## Modal 13: SIMPAN BAST PENERIMA (Save BAST for Recipient)
**Triggered From:** PAGE 2 Tab 3 - SIMPAN BAST PENERIMA button
**Purpose:** Create and save BAST (Receipt) document for recipients
**Form Fields:**
- Nomor BAST - text input (auto-generated or manual)
- Nilai BAST - currency input
- Tanggal BAST - date input
- Penerima BAST - dropdown/multi-select
  - Shows: "3203190101900019 - Dede" format
  - Searchable list of recipients
- Dokumen BAST - file upload
  - Accepted: PDF, images
  - Size limit: (to be confirmed)

**Buttons:**
- Simpan (Save)
- Close / Batal (Cancel)

---

## Form 1: Add Item Barang (PAGE 3 Detail Edit)
**Section:** Detail Nilai & Volume Barang
**Purpose:** Add individual item/product to contract
**Form Fields:**
1. **Nama Barang** (Product Name)
   - Type: text input
   - Placeholder: "Masukan Nama bar"
   - Required: Yes

2. **Merk** (Brand)
   - Type: text input
   - Placeholder: "Masukan Merk"
   - Required: No

3. **Spesifikasi** (Specification)
   - Type: text input / textarea
   - Placeholder: "Masukan Spesifikasi"
   - Required: No

4. **Apakah barang ini perlu running test?**
   - Type: radio buttons
   - Options: [Tidak (No)] [Ya (Yes)]
   - Default: Tidak

5. **Apakah memerlukan sertifikasi benih?**
   - Type: radio buttons
   - Options: [Tidak (No)] [Ya (Yes)]
   - Default: Tidak

6. **Apakah memerlukan uji lab?**
   - Type: radio buttons
   - Options: [Tidak (No)] [Ya (Yes)]
   - Default: Tidak

7. **Apakah memerlukan surat kesehatan hewan?**
   - Type: radio buttons
   - Options: [Tidak (No)] [Ya (Yes)]
   - Default: Tidak

**Sample Data Displayed:**
```
INSEKTISIDA, Merek : VISTA 400SL (Dimehipo: 400 g/l)
```

**Button:**
- Simpan (Save)

---

## Form 2: Add Distribution (Money Contract - PAGE 4)
**Section:** Detail Distribusi Bantuan Uang
**Purpose:** Add distribution entry for Kontrak Uang
**Form Fields:**
1. **Provinsi** (Province) - dropdown
2. **Kota** (City) - dependent dropdown
3. **Kecamatan** (District) - dependent dropdown
4. **Desa** (Village) - dependent dropdown
5. **Gapoktan** (Farmer Group) - dropdown / searchable
6. **Nilai Pembagian** (Distribution Value) - currency input

**Dependencies:**
- Kota updates when Provinsi changes
- Kecamatan updates when Kota changes
- Desa updates when Kecamatan changes

**Button:**
- TAMBAH (Add)

---

## Form 3: Add Gapoktan (Money Contract - PAGE 4)
**Section:** Detail Distribusi Bantuan Uang
**Triggered From:** TAMBAH GAPOKTAN button
**Purpose:** Add new Gapoktan (Farmer Group) option to system
**Form Fields:**
- Gapoktan Name - text input
- Gapoktan Code - text input (if applicable)
- Location (Desa/Village) - dropdown

**Button:**
- Simpan (Save)

---

## Search Form: BAST Search (PAGE 2 Tab 3)
**Section:** BAST Penerima Bantuan
**Purpose:** Filter BAST records by criteria
**Form Fields:**
1. **Pilih Nomor BAST** (Select BAST Number)
   - Type: dropdown
   - Content: List of BAST numbers

2. **Nama Penerima** (Recipient Name)
   - Type: text input
   - Placeholder: "Penerima"

3. **Nama Desa** (Village Name)
   - Type: text input
   - Placeholder: "Desa"

**Button:**
- SEARCH (blue button)

---

## Search/Filter Features Summary

| Page | Search Type | Trigger | Fields |
|------|------------|---------|--------|
| PAGE 1 | Table Search | Search box | Text search across all columns |
| PAGE 1 | Filter | FILTER button | Eselon 1, Satker, Status Pembayaran |
| PAGE 5 | Enable/Disable | Dropdown | Status filter (ENABLE/DISABLE) |
| PAGE 6 | Terjawab Filter | Dropdown | All/Answered/Unanswered |
| PAGE 2 Tab 3 | BAST Filter | SEARCH button | Nomor BAST, Nama Penerima, Nama Desa |

---

## Export/Import URL Mapping

| Action | Page | URL | Format |
|--------|------|-----|--------|
| Export Kontrak | PAGE 1 | /kontrak/export_kontrak_vendor | Excel |
| Export Rincian Penerima | PAGE 2 Tab 2 | /kontrak/export_rincian_penerima/{id} | Excel |
| Export BAST | PAGE 2 Tab 3 | /kontrak/exportbast/{id} | Excel |
| Template Distribusi | PAGE 2 Tab 2 | /kontrak/exportpenyaluran/{id} | Excel (pre-filled) |
| Template Titik Distribusi | PAGE 3 | /webfile/import_titik_distribusi/template_import_titik_distribusi.xlsx | Excel |
| Template Titik Uang | PAGE 4 | /webfile/import_titik_distribusi/template_import_titik_distribusi_uang.xlsx | Excel |
| Format Export Data | PAGE 3/4 | /webfile/tutorial/format_export_data.xlsx | Excel |

---

## Form Validation & Behavior Notes

1. **Cascading Dropdowns:** Kota/Kecamatan/Desa follow dependent dropdown pattern
2. **Currency Fields:** Auto-format with thousands separator
3. **Date Fields:** Likely use date picker (not confirmed visually)
4. **Radio Buttons:** Single selection required for most questions
5. **File Uploads:** Support image and PDF formats
6. **Search:** Real-time filtering on table data
7. **Required Fields:** Marked appropriately (confirmed for some)

---

## Modal Interaction Patterns

- **Overlay/Backdrop:** Click outside or close button dismisses modal
- **Form Validation:** Appears inline or on submit (to be confirmed)
- **Success Messages:** Likely toast notification on successful action
- **Error Handling:** Error messages displayed below fields or in modal header

