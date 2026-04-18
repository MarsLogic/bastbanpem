import os
import asyncio
from backend.services.pdf_intelligence import PDFIntelligence

async def main():
    pdf_path = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf"
    
    with open(pdf_path, 'rb') as f:
        file_bytes = f.read()

    import fitz
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n\f"

    intelligence = PDFIntelligence()
    
    sections = intelligence.extract_sections(full_text, pdf_path=pdf_path)
    
    for name, content in sections.items():
        if name == "SSKK":
            with open("sskk_output.txt", "w", encoding="utf-8") as out:
                out.write(content)
            print("Wrote SSKK to sskk_output.txt")
            break

if __name__ == "__main__":
    asyncio.run(main())
