import os
import re
import json
import pypdf

PDF_ROOT = r"C:\Users\Wyx\Desktop\Project 2026"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")


def is_valid_pdf(path: str) -> bool:
    """Return True if file starts with PDF magic bytes %PDF."""
    try:
        with open(path, 'rb') as f:
            header = f.read(4)
        return header == b'%PDF'
    except OSError:
        return False


def discover_pdfs(root: str) -> list[str]:
    """Recursively find all valid PDF files under root."""
    found = []
    for dirpath, _, filenames in os.walk(root):
        for fname in filenames:
            if fname.lower().endswith('.pdf'):
                full = os.path.join(dirpath, fname)
                if is_valid_pdf(full):
                    found.append(full)
    return found


def extract_pages(pdf_path: str) -> list[str]:
    """
    Extract text from each page as a separate string.
    Returns a list where index 0 = page 1 text, index 1 = page 2 text, etc.
    Each page's text items are joined with a single space and normalised.
    """
    reader = pypdf.PdfReader(pdf_path)
    pages = []
    for page in reader.pages:
        raw = page.extract_text() or ""
        # Collapse all whitespace runs to single space, strip edges
        normalised = re.sub(r'\s+', ' ', raw).strip()
        pages.append(normalised)
    return pages


# Ordered list of (section_name, regex_anchor) pairs.
# Anchors are searched sequentially in page 1 text.
# Each section spans from its anchor to the next anchor's position.
SECTION_ANCHORS = [
    ('HEADER',               r'Surat Pesanan'),
    ('PEMESAN',              r'\bPemesan\b'),
    ('PAYMENT_SUMMARY',      r'Informasi Pembayaran dan Pengiriman'),
    ('PENYEDIA',             r'\bPenyedia\b'),
    ('RINGKASAN_PESANAN',    r'Ringkasan Pesanan'),
    ('RINGKASAN_PEMBAYARAN', r'Ringkasan Pembayaran'),
    ('DETAIL_END',           r'Detail Informasi Pembayaran & Pengiriman(?!\))'),  # sentinel — marks end of page 1 contract data (excludes parenthetical reference)
]


def split_page1_sections(page1_text: str) -> dict[str, str]:
    """
    Split page 1 text into named sections using sequential anchor detection.
    Returns dict mapping section name → section text.
    Each section spans from its own anchor (inclusive) to the start of the next anchor (exclusive).
    If an anchor is not found in the text, that section is omitted from the result without error.
    """
    positions: list[tuple[str, int]] = []
    for name, pattern in SECTION_ANCHORS:
        match = re.search(pattern, page1_text)
        if match:
            positions.append((name, match.start()))

    positions.sort(key=lambda x: x[1])

    sections: dict[str, str] = {}
    for i, (name, start) in enumerate(positions):
        if name == 'DETAIL_END':
            break
        end = positions[i + 1][1] if i + 1 < len(positions) else len(page1_text)
        section_text = page1_text[start:end].strip()
        sections[name] = section_text

    return sections


def parse_header(text: str) -> dict:
    """Extract nomorKontrak and tanggalKontrak from HEADER section."""
    nomor = re.search(r'No\.\s*Surat\s*Pesanan\s*:\s*(EP-[A-Z0-9]+)', text)
    tanggal = re.search(
        r'Tanggal\s*Surat\s*Pesanan\s*:\s*(\d{1,2}\s+\w+\s+\d{4},\s*\d{2}:\d{2}:\d{2}\s*WIB)',
        text
    )
    return {
        'nomorKontrak': nomor.group(1).strip() if nomor else None,
        'tanggalKontrak': tanggal.group(1).strip() if tanggal else None,
    }


def parse_pemesan(text: str) -> dict:
    """Extract buyer fields from PEMESAN section."""
    org = re.search(r'Pemesan\s+([A-Z][A-Z\s]+?)(?:\s+Kementerian|\s+Nama Penanggung)', text)
    pj = re.search(r'Nama Penanggung Jawab\s*:\s*(.+?)(?:\s+Jabatan|\s+Divisi)', text)
    jabatan = re.search(r'Jabatan Penanggung Jawab\s*:\s*(.+?)(?:\s+Divisi|\s+NPWP)', text)
    divisi = re.search(r'Divisi\s*/\s*Unit Kerja\s*:\s*(.+?)(?:\s+NPWP)', text)
    npwp = re.search(r'NPWP Pemesan\s*:\s*([\d.\-]+)', text)
    alamat = re.search(r'Alamat Pemesan\s*:\s*(.+?)$', text, re.DOTALL)
    return {
        'nama': org.group(1).strip() if org else None,
        'pj': pj.group(1).strip() if pj else None,
        'jabatan': jabatan.group(1).strip() if jabatan else None,
        'divisi': divisi.group(1).strip() if divisi else None,
        'npwp': npwp.group(1).strip() if npwp else None,
        'alamat': re.sub(r'\s+', ' ', alamat.group(1)).strip() if alamat else None,
    }


def parse_penyedia(text: str) -> dict:
    """Extract supplier fields from PENYEDIA section."""
    company = re.search(r'Penyedia\s+([A-Z][A-Z\s]+?)\s+Nama Penanggung Jawab', text)
    pj = re.search(r'Nama Penanggung Jawab\s*:\s*(.+?)(?:\s+Jabatan|\s+NPWP)', text)
    jabatan = re.search(r'Jabatan Penanggung Jawab\s*:\s*(.+?)(?:\s+NPWP)', text)
    npwp = re.search(r'NPWP Penyedia\s*:\s*([\d.\-]+)', text)
    alamat = re.search(r'Alamat Penyedia\s*:\s*(.+?)$', text, re.DOTALL)
    return {
        'nama': company.group(1).strip() if company else None,
        'pj': pj.group(1).strip() if pj else None,
        'jabatan': jabatan.group(1).strip() if jabatan else None,
        'npwp': npwp.group(1).strip() if npwp else None,
        'alamat': re.sub(r'\s+', ' ', alamat.group(1)).strip() if alamat else None,
    }


def parse_ringkasan_pesanan(text: str) -> dict:
    """Extract product name, quantity, unit, and unit price from RINGKASAN_PESANAN section."""
    product = re.search(
        r'(?:Barang PDN|PDN)\s+(.+?)\s+([\d.]+,\d{2})\s*(liter|kg|gr|botol|Unit|btl|can|sachet|box|Kg)',
        text, re.IGNORECASE
    )
    # hargaSatuan comes after Golongan PPN XX%
    harga = re.search(r'Golongan\s+PPN\s+\d+%\s+(Rp[\d.,]+)', text)
    if not harga:
        # fallback: first Rp after the product block
        harga = re.search(r'(Rp[\d.,]+)\s+[\d.,]+\s*(?:https|Golongan|$)', text)
    return {
        'namaProduk': product.group(1).strip() if product else None,
        'kuantitas': product.group(2).strip() if product else None,
        'satuan': product.group(3).strip().lower() if product else None,
        'hargaSatuan': harga.group(1).strip() if harga else None,
    }


def parse_ringkasan_pembayaran(text: str) -> dict:
    """Extract total payment from RINGKASAN_PEMBAYARAN section."""
    total = re.search(r'Estimasi Total Pembayaran\s+(Rp[\d.,]+)', text)
    return {
        'totalPembayaran': total.group(1).strip() if total else None,
    }


def parse_payment_summary(text: str) -> dict:
    """Extract number of payment terms and delivery stages from PAYMENT_SUMMARY section."""
    termin = re.search(r'Pembayaran\s*:\s*(\d+)\s*Termin', text)
    tahap = re.search(r'Pengiriman\s*:\s*(\d+)\s*Tahap', text)
    return {
        'jumlahTermin': int(termin.group(1)) if termin else None,
        'jumlahTahap': int(tahap.group(1)) if tahap else None,
    }


def _parse_address(raw: str) -> dict:
    """
    inaproc.id address format:
    "<free text description>, <desa>, <kecamatan>, <Kab/Kota>, <Provinsi>, <kodepos>"
    Split on commas after the first comma to get structured fields.
    """
    parts = [p.strip() for p in raw.split(',')]
    result = {
        'alamatLengkap': raw.strip(),
        'kecamatan': None,
        'kabupaten': None,
        'provinsi': None,
        'kodePos': None,
    }
    if len(parts) >= 2:
        kodepos_match = re.search(r'\b(\d{5})\b', parts[-1])
        if kodepos_match:
            result['kodePos'] = kodepos_match.group(1)
            if len(parts) >= 4:
                result['kecamatan'] = parts[-4].strip()
            if len(parts) >= 3:
                result['kabupaten'] = parts[-3].strip()
            if len(parts) >= 2:
                result['provinsi'] = parts[-2].strip()
    return result


def extract_delivery_blocks(pages: list[str]) -> list[dict]:
    """
    Scan all pages for Pengiriman blocks.
    Each block starts with 'Pengiriman Nama Penerima :' and ends at the next block start.
    Returns list of parsed delivery block dicts.
    """
    full_text = ' '.join(pages)
    raw_blocks = re.split(r'Pengiriman\s+Nama Penerima\s*:', full_text)

    blocks = []
    for raw in raw_blocks[1:]:
        block = raw.strip()

        nama_match = re.match(r'^(.+?)\s*\((\d{8,15})\)', block)
        nama = nama_match.group(1).strip() if nama_match else None
        telepon = nama_match.group(2) if nama_match else None

        tiba_match = re.search(
            r'Permintaan Tiba\s*:\s*(.+?)(?:\s+Alamat Pengiriman|\s+Kurir)', block
        )

        alamat_match = re.search(
            r'Alamat Pengiriman\s*:\s*(.+?)(?:\s+Catatan Alamat|\s+Kurir Pengiriman)', block
        )
        addr_data = _parse_address(alamat_match.group(1)) if alamat_match else {
            'alamatLengkap': None, 'kecamatan': None,
            'kabupaten': None, 'provinsi': None, 'kodePos': None
        }

        catatan_match = re.search(
            r'Catatan Alamat Pengiriman\s*(.+?)(?:\s+Kurir Pengiriman)', block, re.DOTALL
        )
        catatan = re.sub(r'\s+', ' ', catatan_match.group(1)).strip() if catatan_match else None

        qty_match = re.search(r'Harga Produk\s*\(\s*([\d.,]+)\s*\)', block)
        jumlah_raw = qty_match.group(1).replace('.', '').replace(',', '.') if qty_match else None
        jumlah = float(jumlah_raw) if jumlah_raw else None

        harga_match = re.search(r'Harga Produk\s*\([\d.,]+\)\s*(Rp[\d.,]+)', block)
        ongkos_match = re.search(r'Ongkos Kirim\s*\([\d.,\s]+(?:kg|liter|gr)?\s*\)\s*(Rp[\d.,]+)', block)

        if nama:
            blocks.append({
                'namaPenerima': nama,
                'telepon': telepon,
                'permintaanTiba': tiba_match.group(1).strip() if tiba_match else None,
                **addr_data,
                'catatanAlamat': catatan,
                'jumlahProduk': jumlah,
                'hargaProdukTotal': harga_match.group(1) if harga_match else None,
                'ongkosKirim': ongkos_match.group(1) if ongkos_match else None,
            })

    return blocks


def parse_pdf(pdf_path: str) -> dict | None:
    """
    Full pipeline: extract pages -> split sections -> parse all fields.
    Returns a complete contract dict or None if the file cannot be parsed.
    """
    try:
        pages = extract_pages(pdf_path)
    except Exception as e:
        return {'sourceFile': pdf_path, 'error': str(e), 'pengiriman': []}

    if not pages:
        return None

    sections = split_page1_sections(pages[0])

    header = parse_header(sections.get('HEADER', ''))
    pemesan = parse_pemesan(sections.get('PEMESAN', ''))
    payment_summary = parse_payment_summary(sections.get('PAYMENT_SUMMARY', ''))
    penyedia = parse_penyedia(sections.get('PENYEDIA', ''))
    produk = parse_ringkasan_pesanan(sections.get('RINGKASAN_PESANAN', ''))
    pembayaran = parse_ringkasan_pembayaran(sections.get('RINGKASAN_PEMBAYARAN', ''))
    pengiriman = extract_delivery_blocks(pages)

    return {
        'sourceFile': pdf_path,
        **header,
        **payment_summary,
        'pemesan': pemesan,
        'penyedia': penyedia,
        'produk': produk,
        'totalPembayaran': pembayaran.get('totalPembayaran'),
        'pengiriman': pengiriman,
    }


def build_pattern_report(contracts: list[dict]) -> dict:
    """
    Analyse field presence and value formats across all parsed contracts.
    Returns a pattern confidence report.
    """
    valid = [c for c in contracts if 'error' not in c]
    total = len(contracts)
    n = len(valid)

    def field_stats(getter, label):
        values = []
        for c in valid:
            try:
                v = getter(c)
            except (KeyError, TypeError):
                v = None
            if v is not None:
                values.append(str(v))
        return {
            'presentIn': len(values),
            'rate': round(len(values) / n, 3) if n else 0,
            'samples': list(dict.fromkeys(values))[:5],
        }

    all_blocks = [b for c in valid for b in c.get('pengiriman', [])]
    block_count = len(all_blocks)

    def block_field_stats(key):
        present = sum(1 for b in all_blocks if b.get(key) is not None)
        return {
            'presentInAllBlocks': present == block_count,
            'rate': round(present / block_count, 3) if block_count else 0,
            'samples': list(dict.fromkeys(
                str(b[key]) for b in all_blocks if b.get(key)
            ))[:3],
        }

    block_counts = [len(c.get('pengiriman', [])) for c in valid]

    return {
        'totalPdfs': total,
        'validPdfs': n,
        'skippedFiles': [c['sourceFile'] for c in contracts if 'error' in c],
        'contractFields': {
            'nomorKontrak':    field_stats(lambda c: c.get('nomorKontrak'), 'nomorKontrak'),
            'tanggalKontrak':  field_stats(lambda c: c.get('tanggalKontrak'), 'tanggalKontrak'),
            'jumlahTermin':    field_stats(lambda c: c.get('jumlahTermin'), 'jumlahTermin'),
            'jumlahTahap':     field_stats(lambda c: c.get('jumlahTahap'), 'jumlahTahap'),
            'pemesan.nama':    field_stats(lambda c: c.get('pemesan', {}).get('nama'), 'pemesan.nama'),
            'pemesan.pj':      field_stats(lambda c: c.get('pemesan', {}).get('pj'), 'pemesan.pj'),
            'pemesan.npwp':    field_stats(lambda c: c.get('pemesan', {}).get('npwp'), 'pemesan.npwp'),
            'penyedia.nama':   field_stats(lambda c: c.get('penyedia', {}).get('nama'), 'penyedia.nama'),
            'penyedia.pj':     field_stats(lambda c: c.get('penyedia', {}).get('pj'), 'penyedia.pj'),
            'penyedia.npwp':   field_stats(lambda c: c.get('penyedia', {}).get('npwp'), 'penyedia.npwp'),
            'namaProduk':      field_stats(lambda c: c.get('produk', {}).get('namaProduk'), 'namaProduk'),
            'satuan':          field_stats(lambda c: c.get('produk', {}).get('satuan'), 'satuan'),
            'hargaSatuan':     field_stats(lambda c: c.get('produk', {}).get('hargaSatuan'), 'hargaSatuan'),
            'totalPembayaran': field_stats(lambda c: c.get('totalPembayaran'), 'totalPembayaran'),
        },
        'pengirimanStats': {
            'totalBlocks': block_count,
            'minBlocksPerContract': min(block_counts) if block_counts else 0,
            'maxBlocksPerContract': max(block_counts) if block_counts else 0,
            'avgBlocksPerContract': round(sum(block_counts) / len(block_counts), 1) if block_counts else 0,
            'fields': {
                'namaPenerima':    block_field_stats('namaPenerima'),
                'telepon':         block_field_stats('telepon'),
                'permintaanTiba':  block_field_stats('permintaanTiba'),
                'alamatLengkap':   block_field_stats('alamatLengkap'),
                'kabupaten':       block_field_stats('kabupaten'),
                'provinsi':        block_field_stats('provinsi'),
                'kodePos':         block_field_stats('kodePos'),
                'catatanAlamat':   block_field_stats('catatanAlamat'),
                'jumlahProduk':    block_field_stats('jumlahProduk'),
                'hargaProdukTotal':block_field_stats('hargaProdukTotal'),
                'ongkosKirim':     block_field_stats('ongkosKirim'),
            }
        }
    }


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Pass 1 — Discovering PDFs...")
    pdfs = discover_pdfs(PDF_ROOT)
    print(f"  Found {len(pdfs)} valid PDFs")

    print("Pass 2+3 — Extracting + pattern learning...")
    contracts = []
    for i, pdf_path in enumerate(pdfs, 1):
        print(f"  [{i}/{len(pdfs)}] {os.path.basename(pdf_path)}", end='\r')
        result = parse_pdf(pdf_path)
        if result:
            contracts.append(result)
    print(f"\n  Parsed {len(contracts)} contracts")

    print("Writing output/parsed_contracts.json...")
    with open(os.path.join(OUTPUT_DIR, 'parsed_contracts.json'), 'w', encoding='utf-8') as f:
        json.dump(contracts, f, ensure_ascii=False, indent=2)

    print("Writing output/pattern_report.json...")
    report = build_pattern_report(contracts)
    with open(os.path.join(OUTPUT_DIR, 'pattern_report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\nDone.")
    print(f"  Contracts parsed: {report['validPdfs']}/{report['totalPdfs']}")
    print(f"  Delivery blocks total: {report['pengirimanStats']['totalBlocks']}")
    if report['skippedFiles']:
        print(f"  Skipped (errors): {len(report['skippedFiles'])}")
        for sf in report['skippedFiles']:
            print(f"    - {sf}")
