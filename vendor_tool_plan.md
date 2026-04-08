# BASTBANPEM Vendor Data Management Tool — Plan
**Purpose:** Help CV KARYA ALFREDO NUSANTARA (and similar vendors) organize, prepare, and submit all required data and files to BASTBANPEM website for payment claims.

---

## The Core Problem

A vendor manages 39+ contracts. Each contract has dozens of recipients (penerima). For each recipient row they must upload:
- DO / Surat Jalan (1 PDF per delivery batch)
- Invoice Ongkir (1 PDF)
- Dokumen Uji Lab (1 PDF per barang type)
- Nomor Sertifikat + Tanggal + Lembaga Penguji (text data)
- Sertifikasi Lab (optional PDF)
- Foto Bukti Terima 1–5 (photos, often taken on-site with phone)
- Nomor Rangka (serial numbers for machinery)
- BAST document (PDF per BAST group)

Plus for Penerima Bantuan (separate login per NIK):
- Foto konfirmasi terima (mobile photo via Open Camera app)
- Status penerimaan

Files arrive scattered: photos from field teams via WhatsApp, lab docs from suppliers by email, DO from logistics, BAST from admin. The vendor needs to match all of these to the right contract → right recipient → right field before uploading.

---

## What Data the Tool Must Organize

### Level 1: Contract
| Field | Source | Format |
|---|---|---|
| Nomor Kontrak | BASTBANPEM / SPK document | Text |
| Nilai Kontrak | SPK | Currency |
| Tanggal Kontrak | SPK | Date |
| Eselon / Satker | BASTBANPEM | Text |
| Nama Barang | Contract | Text |
| Total Qty | Contract | Number |

### Level 2: Per Recipient Row (Rincian Penyaluran Import)
Matches BASTBANPEM import template columns exactly:

| Column | Format | Source |
|---|---|---|
| NIK Penerima | 16-digit number | CPCL spreadsheet |
| Nama | Text | CPCL spreadsheet |
| Titik Bagi | Text (Provinsi/Kab/Kec/Desa) | CPCL spreadsheet |
| Gapoktan | Text | CPCL spreadsheet |
| Barang | Text | Contract |
| Qty | Decimal | CPCL spreadsheet |
| Nilai | Currency (auto: Qty × harga satuan) | Calculated |

### Level 3: Per Row — Files for DO & Bukti Terima Upload
| File/Field | Required? | Format | Source |
|---|---|---|---|
| DO / Surat Jalan | ✅ REQUIRED | PDF / Image | Logistics team |
| Invoice Ongkir | ✅ REQUIRED | PDF | Logistics/transporter |
| Dokumen Uji Lab | ✅ REQUIRED | PDF | Lab/supplier |
| Nomor Sertifikat Uji Lab | ✅ REQUIRED | Text (e.g. 065/KOMERS/I/2026) | Lab certificate |
| Tanggal Sertifikat Uji Lab | ✅ REQUIRED | Date | Lab certificate |
| Lembaga Penguji | ✅ REQUIRED | Text | Lab certificate |
| Sertifikasi Lab | Optional | PDF | Supplier |
| Foto Bukti Terima 1 | ✅ REQUIRED | JPG/PNG | Field officer |
| Foto Bukti Terima 2–5 | Optional | JPG/PNG | Field officer |
| Nomor Rangka | If machinery | Text list | Delivery notes |

### Level 4: BAST Document
| Field | Format | Source |
|---|---|---|
| Nomor BAST | Text | Admin/vendor |
| Nilai BAST | Currency | Calculated from recipients |
| Tanggal BAST | Date | Field/admin |
| Dokumen BAST (PDF) | PDF | Admin |
| Penerima assigned | NIK list | From rincian |

### Level 5: Penerima Bantuan (separate NIK login)
| Item | Format | Notes |
|---|---|---|
| NIK | 16-digit | Their own login credential |
| Foto Bukti Terima | JPG/PNG | Taken with Open Camera app |
| Status Penerimaan | Selection | Must be confirmed by penerima |

### Level 6: Titik Distribusi Import (Excel template)
Columns for `template_import_titik_distribusi.xlsx`:
| # | Column | Format |
|---|---|---|
| 1 | No | Number |
| 2 | Provinsi | Text (e.g. PROV. D.K.I. JAKARTA) |
| 3 | Kabupaten | Text |
| 4 | Kecamatan | Text |
| 5 | Desa | Text |
| 6 | Poktan/Dinas/Gapoktan/Brigade | Text |
| 7 | Nama Barang | Text |
| 8 | Total Qty | Number |
| 9 | total Nilai | Number |
| 10 | Apakah barang ini memerlukan dokumen karantina? | Ya / Tidak |

### Vendor's Own CPCL Spreadsheet (KAN_Vista example)
Columns in vendor's internal planning file (source of truth for import):
No, Provinsi, Kabupaten, Kecamatan, Desa, Poktan/Gapoktan/LMDH/Koperasi/KTH/BPTPH/Brigade Pangan, Ketua, **NIK**, NO HP, Lokasi Pertanaman, Luas Lahan (Ha), Pestisida (l/kg), Spesifikasi Bantuan, OPT Dominan, Jadwal Tanam, Bujur (BT), Lintang (LU/LS), [multiple internal calc columns], Harga Barang satuan, Jumlah Total Harga Satuan, Ongkos Kirim satuan, Jumlah Total Ongkos Kirim, Jumlah total Harga+Ongkir, **Jumlah Nominal BAST per titik Poktan**

---

## Proposed Tool Architecture

### Option A — Excel-Based Organizer (Quickest to build)
A master Excel workbook with:
- **Sheet 1: Contracts** — list all contracts, status tracking
- **Sheet 2: Rincian per contract** — auto-generates import-ready template from CPCL data (NIK, Nama, Titik Bagi, Barang, Qty, Nilai)
- **Sheet 3: File Checklist** — per NIK row: checkbox for DO, Invoice, Uji Lab, Foto 1–5, BAST — with file path reference
- **Sheet 4: BAST Summary** — group recipients by BAST, calculate Nilai BAST
- **Sheet 5: Lab Docs Tracker** — Nomor Sertifikat, Tanggal, Lembaga per barang type

**Pros:** No dev needed, vendor already uses Excel  
**Cons:** Files still scattered, no automation

### Option B — Web App / Desktop Tool (Recommended)
A local web app (or simple desktop app) with:

**Module 1: Contract Dashboard**
- List all contracts from CPCL/SPK
- Traffic-light status: files complete / incomplete / uploaded

**Module 2: File Organizer per NIK**
- Upload/drag-drop for each required file per recipient
- Auto-rename files to standard format: `{NIK}_{NamaBarang}_{DocType}.pdf`
- Link Foto Bukti Terima photos to right NIK (vendor scans WhatsApp folder, app matches by phone number → NIK lookup)

**Module 3: Import Template Generator**
- Reads vendor's CPCL Excel → outputs BASTBANPEM-compatible import template
- Maps CPCL columns → BASTBANPEM columns automatically

**Module 4: BAST Builder**
- Groups recipients → generates BAST groups
- Calculates Nilai BAST per group
- Exports BAST summary for admin

**Module 5: Penerima Bantuan Helper**
- Lists all NIK + their confirmation status
- Tracks which penerima have confirmed (Sudah Diterima) vs pending
- Can generate reminder list for field officers

**Module 6: Upload Checklist**
- Pre-flight check before vendor goes to BASTBANPEM to upload
- Shows exactly what is missing per contract/row

### Option C — Browser Extension / Script
Auto-fill BASTBANPEM forms using local data → highest risk of breaking when site changes

---

## Real Contract Reference Data (Live Data — All 39 Contracts)

Extracted directly from the live BASTBANPEM system (April 2026) for CV KARYA ALFREDO NUSANTARA (NPWP 84.299.005.3-416.000). All values are real.

### Complete Contract Status Breakdown

| Status Review | Count | Total Nilai | Contract IDs |
|---|---|---|---|
| **Sesuai** (approved) | 14 | Rp 43,064,127,552 | 7350, 7255, 7248, 7247, 7206, 7164, 7081, 6985, 6956, 6953, 6921, 6893, 6209, 6193 |
| **Perbaikan** (needs correction) | 2 | Rp 1,157,498,454 | 6923, 4497 |
| **Menunggu** (submitted, awaiting review) | 2 | Rp 77,114,453 | 6109, 4673 |
| **Belum** (not yet submitted) | 21 | Rp 10,147,870,330 | 7395, 7392, 7385, 7375, 6971, 6968, 6967, 6966, 6964, 6216, 6211, 6205, 6165, 6160, 4642, 4634, 4631, 4629, 4628, 4435, 3880 |
| **TOTAL** | **39** | **Rp 54.4 Billion** | |

### Two Distinct Contract Types — Critical Difference

This vendor has **two completely different contract types** that require different workflows:

#### Type A — Dinas Contracts (all Sesuai contracts)
| Field | Value |
|---|---|
| Titik Bagi | Kabupaten |
| Tipe Penerima | Dinas (government offices) |
| Penerima per contract | 1–9 (average ~4) |
| Penerima identity | PNS officer (Kepala Dinas / POPT) |
| NIK used for login | Individual PNS's NIK |
| Delivery | 1 truck/batch per Kabupaten Dinas office |
| Qty per row | 800–50,968 liters |
| Nilai per contract | Rp 78M – Rp 9.5B |

#### Type B — Poktan/Gapoktan Contracts (all Belum/Perbaikan/Menunggu)
| Field | Value |
|---|---|
| Titik Bagi | Desa |
| Tipe Penerima | Poktan/Gapoktan/Brigade/Lainnya |
| Penerima per contract | Many (farmer groups per village) |
| Penerima identity | Ketua Poktan or individual farmer |
| NIK used for login | Farmer's own NIK |
| Delivery | Per desa/village |
| Nilai per contract | Rp 17M – Rp 1.2B (smaller) |

> **Key implication for the tool:** Type A (Dinas) has few penerima and large amounts — easy to manage. Type B (Poktan) has many penerima per contract and is the harder management problem, especially for matching WhatsApp photos and scattered field docs to the right NIK/Desa.

### Barang Types (Both Contract Types)

| Barang | Merk | Spesifikasi | Satuan |
|---|---|---|---|
| INSEKTISIDA | VISTA 400 SL | Dimehipo : 400 g/l | liter |
| MOLUSKISIDA | KRESNACID 250 EC | Niklosamida : 250 g/l | liter |

Every contract is one of these two barang types. This means Uji Lab documents are the same for all contracts of the same barang type — the vendor only needs **2 sets of lab docs** total, reused across all contracts.

### Confirmed Sesuai Contract Details (5 deep-inspected)

| ID | Nilai Kontrak | Barang | Penerima | Provinces |
|---|---|---|---|---|
| 7206 | Rp 9,496,214,387 | INSEKTISIDA VISTA 400 SL | 8 Dinas | Jawa Timur, Jawa Tengah |
| 7247 | Rp 2,520,898,800 | INSEKTISIDA VISTA 400 SL | 3 Dinas | Jawa Tengah, Jambi, Sumatera Selatan |
| 7248 | Rp 7,200,071,357 | INSEKTISIDA VISTA 400 SL | 9 Dinas | Bengkulu, Lampung |
| 7255 | Rp 988,792,440 | MOLUSKISIDA KRESNACID 250 EC | 1 Dinas | Jawa Barat (Kab. Cirebon) |
| 7350 | Rp 78,434,154 | MOLUSKISIDA | 2 | — |

Sample penerima from contract 7248 (Rp 7.2B, 9 penerima):

| NIK | Nama | Kab | Qty | Nilai |
|---|---|---|---|---|
| 1701040105810002 | FEDI SUMANTRI, SP | Bengkulu Selatan | 7,807 L | 636,379,486 |
| 1872041702740003 | AGUNG CAHYANTO | Lampung Tengah | 22,395 L | 1,813,075,909 |
| 1801072512850006 | BERLIANTARA | Lampung Selatan | 25,000 L | 2,023,974,000 |

### Perbaikan Contract Analysis — What Goes Wrong

| ID | Nilai | Reviewer | Error Note |
|---|---|---|---|
| 6923 | Rp 1,126,390,882 | BAHAGIO UTAMA, S.P. | "Mohon ditindaklanjuti" (vague — follow up required) |
| 4497 | Rp 31,107,572 | AHMAD SYARIPUDIN, SP, M.SI | **"SK CPCL belum diupload, BAST tidak sesuai dengan rincian penerima"** |

Contract 4497 error translation: "The SK CPCL document has not been uploaded; the BAST document does not match the penerima list."

**The two most critical pre-submission checks the tool must enforce:**
1. ✅ **SK CPCL file must be uploaded** (File CPCL field on the contract header — many vendors forget this)
2. ✅ **BAST penerima list must match Rincian Penyaluran exactly** — every NIK in BAST must exist in rincian, and the total Nilai BAST must equal total Nilai Rincian

### Menunggu Contracts (Submitted, Awaiting Itjen Review)

| ID | Nilai | Tipe | Submitted |
|---|---|---|---|
| 6109 | Rp 16,972,433 | Poktan/Desa | 2026-04-07 08:52 |
| 4673 | Rp 60,142,020 | Poktan/Desa | 2026-04-07 08:49 |

These were submitted on 2026-04-07 and have no review notes yet (reviewer hasn't acted).

### What This Means for the Tool

1. **Uji Lab deduplication:** The vendor only needs 2 Uji Lab document sets (one for INSEKTISIDA, one for MOLUSKISIDA). The same docs can be reused across all contracts of the same barang type. The tool should store lab docs by barang type, not per contract.

2. **Type A (Dinas) workflow is simpler:** With 1–9 penerima per contract, the file management burden is manageable. Each penerima = 1 Dinas office = 1 delivery = 1 DO + 1 Invoice + 1-5 photos.

3. **Type B (Poktan) workflow is the hard problem:** Many penerima spread across many desas. Photos come in via WhatsApp from field officers. The tool must help match each photo to the right NIK + Desa + Contract.

4. **SK CPCL is a separate required upload** from the CPCL data file. The system field shows "File CPCL: File tidak ada" when it's missing. This is the #1 reason contracts get flagged Perbaikan.

5. **BAST consistency check:** Before submission, verify that every NIK in every BAST document matches exactly one row in Rincian Penyaluran. Sum of BAST nilai must equal Nilai Kontrak.

6. **Selisih must = 0:** Sum of all pn_nilai_disalurkan across all penerima rows must equal k_kontrak_nilai exactly. The system blocks AJUKAN PEMBAYARAN if Selisih ≠ 0.

---

## Recommended Build Order

1. **Start:** Excel master template (immediate value, no dev)
2. **Phase 2:** Simple web app (Python Flask or Node.js) — file organizer + import template generator
3. **Phase 3:** Add BAST builder + penerima status tracker
4. **Phase 4:** Auto-fill helpers (optional)

---

## Key Rules the Tool Must Enforce

1. **Nilai Kontrak = Sum of all Nilai Rincian** (Selisih must = 0)
2. **Nilai BAST ≤ Nilai Penyaluran** for assigned recipients
3. **One DO & Bukti Terima set per monitoring row** (not per recipient — per barang item delivery batch)
4. **Foto Bukti Terima 1 is required** — the other 4 are optional
5. **Uji Lab document + cert number + date + lembaga all required together**
6. **Penerima must confirm independently** via their own NIK login — vendor cannot do this for them
7. **Kalkulasi Monitoring must run before AJUKAN PEMBAYARAN** — tool should flag this as a manual step

---

## File Naming Convention (Recommended)
```
{NomorKontrak}/
  titik_bagi_import.xlsx           ← titik distribusi import file
  rincian_penerima_import.xlsx     ← penerima import file
  bast/
    BAST-001_{NomorBAST}.pdf
    BAST-002_{NomorBAST}.pdf
  do_bukti/
    {NIK}_{Nama}/
      DO_SuratJalan.pdf
      InvoiceOngkir.pdf
      UjiLab_{NomorSertifikat}.pdf
      SertifikasiLab.pdf
      BuktiTerima_1.jpg
      BuktiTerima_2.jpg
      NomorRangka.txt
  penerima_konfirmasi/             ← tracking which NIKs have confirmed
    status.csv
```
