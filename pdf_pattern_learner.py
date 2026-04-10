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


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    pdfs = discover_pdfs(PDF_ROOT)
    print(f"Discovered {len(pdfs)} valid PDFs")
