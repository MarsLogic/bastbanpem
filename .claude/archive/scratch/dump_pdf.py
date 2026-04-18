import fitz
import sys

def dump_pdf_text(path):
    try:
        doc = fitz.open(path)
        print(f"--- TEXT START ---")
        for page in doc:
            print(page.get_text())
        print(f"--- TEXT END ---")
        doc.close()
    except Exception as e:
        print(f"Error reading PDF: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        dump_pdf_text(sys.argv[1])
    else:
        print("No path provided")
