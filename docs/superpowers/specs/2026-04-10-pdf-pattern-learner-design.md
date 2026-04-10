# PDF Pattern Learner — Design Spec
**Date:** 2026-04-10  
**Status:** Approved  
**Target:** Standalone Python script — no Tauri app dependency

---

## Purpose

Read all 88+ "Surat Pesanan" PDFs from `C:\Users\Wyx\Desktop\Project 2026` recursively,
learn the consistent field patterns across all documents, extract every field into structured
JSON, and produce a pattern confidence report. The output directly informs the data model
for the Tauri app's in-browser PDF parser.

---

## Architecture — Three Sequential Passes

```
Pass 1 — Discovery
  Walk target folder recursively
  Collect all .pdf paths
  Skip corrupted files (some files have .pdf extension but are actually .xlsx — detected by PK header)

Pass 2 — Pattern Learning
  Extract raw text page-by-page via pypdf
  Split text into named sections using anchor labels
  For each field: record presence rate, value samples, format variations
  Output → output/pattern_report.json

Pass 3 — Extraction
  Parse each valid PDF using confirmed patterns
  Build one ContractData object per PDF
  Output → output/parsed_contracts.json
```

**Runtime:** Python 3, pypdf (already installed). No additional dependencies.  
**Invocation:** `python pdf_pattern_learner.py`  
**Output directory:** `output/` next to the script.

---

## Section Detection Strategy

Text is extracted per-page then concatenated with page boundary markers.
Sections are identified by their anchor labels exactly as they appear in the inaproc.id document:

| Section key | Anchor text |
|---|---|
| `HEADER` | `"Surat Pesanan"` at start of page 1 |
| `PEMESAN` | `"Pemesan"` label |
| `PAYMENT_SUMMARY` | `"Informasi Pembayaran dan Pengiriman"` |
| `PENYEDIA` | `"Penyedia"` label |
| `RINGKASAN_PESANAN` | `"Ringkasan Pesanan"` |
| `RINGKASAN_PEMBAYARAN` | `"Ringkasan Pembayaran"` |
| `PENGIRIMAN[n]` | Repeating `"Pengiriman"` + `"Nama Penerima"` blocks |

Each `PENGIRIMAN` block is a repeating unit. A 54-page PDF may have 50+ blocks.

---

## Extracted Fields

### Contract level (one per PDF)

| Field | Source label | Example |
|---|---|---|
| `nomorKontrak` | `No. Surat Pesanan :` | `EP-01K7N8N66XF1P31F35YXJJ1RFG` |
| `tanggalKontrak` | `Tanggal Surat Pesanan :` | `22 Okt 2025, 00:13:16 WIB` |
| `jumlahTermin` | `Pembayaran : X Termin` | `1` |
| `jumlahTahap` | `Pengiriman : Y Tahap` | `2` |
| `namaProduk` | Product name in Ringkasan Pesanan | `INSEKTISIDA VISTA 400 SL` |
| `kuantitasProduk` | Quantity + unit | `11.538,00 liter` |
| `hargaSatuan` | Unit price | `Rp66.936,00` |
| `totalPembayaran` | `Estimasi Total Pembayaran` | `Rp922.174.200,00` |
| `pemesan.nama` | Org name under Pemesan | `DIREKTORAT JENDERAL PRASARANA DAN SARANA PERTANIAN` |
| `pemesan.pj` | `Nama Penanggung Jawab :` in Pemesan | `HANDI ARIEF` |
| `pemesan.jabatan` | `Jabatan Penanggung Jawab :` in Pemesan | `Pejabat Pembuat Komitmen (PPK)` |
| `pemesan.npwp` | `NPWP Pemesan :` | `00.013.411.4-017.000` |
| `pemesan.alamat` | `Alamat Pemesan :` | `Jl. Harsono RM No.3, Ragunan...` |
| `penyedia.nama` | Company name under Penyedia | `KARYA ALFREDO NUSANTARA UMKK` |
| `penyedia.pj` | `Nama Penanggung Jawab :` in Penyedia | `ferdy nurmansyah` |
| `penyedia.jabatan` | `Jabatan Penanggung Jawab :` in Penyedia | `DIREKTUR` |
| `penyedia.npwp` | `NPWP Penyedia :` | `84.299.005.3-416.000` |
| `penyedia.alamat` | `Alamat Penyedia :` | `JL. HAJI JUKI NO114...` |

### Per pengiriman block (array — 1 to 50+ per contract)

| Field | Source | Example |
|---|---|---|
| `namaPenerima` | `Nama Penerima :` (name part) | `Ii Liri` |
| `telepon` | Parenthesized number after name | `6285221043186` |
| `permintaanTiba` | `Permintaan Tiba :` | `22 Oktober 2025 - 29 November 2025` |
| `alamatLengkap` | `Alamat Pengiriman :` full text | `Cibolang Mekar Lamajang Pangalengan Bandung...` |
| `kecamatan` | inaproc.id address format after first comma: `[desa], [kecamatan], [kab], [provinsi], [kodepos]` — 2nd comma-segment | `Pangalengan` |
| `kabupaten` | `Kab.` or `Kota` extracted from address | `Kab. Bandung` |
| `provinsi` | Last named region before postcode | `Jawa Barat` |
| `kodePos` | 5-digit postcode at end of address | `40378` |
| `catatanAlamat` | `Catatan Alamat Pengiriman` | `TITIK BAGI DI POKTAN...` |
| `jumlahProduk` | Quantity per this delivery | `6088.00` |
| `hargaProdukTotal` | `Harga Produk (qty)` line | `Rp407.506.368,00` |
| `ongkosKirim` | `Ongkos Kirim (qty kg)` line | `Rp28.880.000,00` |

---

## Output Files

### `output/parsed_contracts.json`
```json
[
  {
    "sourceFile": "KAN/Bandung/surat-pesanan-EP-01K7N8N66....pdf",
    "nomorKontrak": "EP-01K7N8N66XF1P31F35YXJJ1RFG",
    "tanggalKontrak": "22 Okt 2025, 00:13:16 WIB",
    "jumlahTermin": 1,
    "jumlahTahap": 2,
    "namaProduk": "INSEKTISIDA VISTA 400 SL",
    "kuantitasProduk": "11.538,00 liter",
    "hargaSatuan": "Rp66.936,00",
    "totalPembayaran": "Rp922.174.200,00",
    "pemesan": { "nama": "...", "pj": "...", "jabatan": "...", "npwp": "...", "alamat": "..." },
    "penyedia": { "nama": "...", "pj": "...", "jabatan": "...", "npwp": "...", "alamat": "..." },
    "pengiriman": [
      {
        "namaPenerima": "Ii Liri",
        "telepon": "6285221043186",
        "permintaanTiba": "22 Oktober 2025 - 29 November 2025",
        "alamatLengkap": "Cibolang Mekar Lamajang Pangalengan Bandung Jawa Barat...",
        "kecamatan": "Pangalengan",
        "kabupaten": "Kab. Bandung",
        "provinsi": "Jawa Barat",
        "kodePos": "40378",
        "catatanAlamat": "TITIK BAGI DI POKTAN DAN BARANG TIDAK BISA DIPERJUALBELIKAN",
        "jumlahProduk": 6088.0,
        "hargaProdukTotal": "Rp407.506.368,00",
        "ongkosKirim": "Rp28.880.000,00"
      }
    ]
  }
]
```

### `output/pattern_report.json`
```json
{
  "totalPdfs": 88,
  "validPdfs": 85,
  "skippedFiles": ["...xlsx disguised as pdf"],
  "contractFields": {
    "nomorKontrak": { "presentIn": 85, "rate": 1.0, "samples": ["EP-01K7..."], "pattern": "EP-[A-Z0-9]+" },
    "tanggalKontrak": { "presentIn": 85, "rate": 1.0, "formatVariants": ["DD Mon YYYY, HH:MM:SS WIB"] }
  },
  "pengirimanStats": {
    "minBlocks": 1,
    "maxBlocks": 53,
    "avgBlocks": 6.2,
    "fields": {
      "namaPenerima": { "presentInAllBlocks": true, "rate": 1.0 },
      "catatanAlamat": { "presentInAllBlocks": false, "rate": 0.72 }
    }
  },
  "errors": [{ "file": "...", "error": "corrupt pdf" }]
}
```

---

## Error Handling

- Files with `PK\x03\x04` magic bytes are Excel files — skip with a logged warning
- pypdf `PdfStreamError` on corrupt files — skip, log to `errors[]` in pattern report
- Missing optional fields (e.g., `catatanAlamat`) — store `null`, do not fail
- Address parsing failures — store full `alamatLengkap` as-is, leave sub-fields `null`

---

## Constraints

- Python 3, pypdf only — no pdfplumber, no LLM, no OCR
- Reads PDFs as text layer only (these are digital PDFs, not scans — text layer is reliable)
- Does not write to or modify source PDFs
- Output folder is created automatically next to the script
