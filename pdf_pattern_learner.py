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


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    pdfs = discover_pdfs(PDF_ROOT)
    print(f"Discovered {len(pdfs)} valid PDFs")
