import os
import re
from pypdf import PdfReader
from datetime import datetime

PROJECT_DIR = r'C:\Users\Wyx\Desktop\Project 2026'
OUTPUT_FILE = os.path.join(os.getcwd(), 'pdf_analysis_report.md')

def get_all_pdfs(directory):
    pdf_files = []
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith('.pdf'):
                pdf_files.append(os.path.join(root, file))
    return pdf_files

def analyze_pdfs():
    print("Starting recursively scanning for PDFs...")
    files = get_all_pdfs(PROJECT_DIR)
    print(f"Found {len(files)} PDF files.")

    report = f"# PDF Contract Analysis Report\n\nGenerated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    
    # Analyze up to 20 PDFs to keep it focused
    limit = min(len(files), 20)
    report += f"> Analyzing first {limit} files to identify common patterns.\n\n"

    for i in range(limit):
        file_path = files[i]
        file_name = os.path.basename(file_path)
        print(f"[{i+1}/{limit}] Analyzing: {file_name}")
        
        try:
            reader = PdfReader(file_path)
            full_text = ""
            for page in reader.pages:
                full_text += page.extract_text() + "\n"
                
            report += f"## {file_name}\n"
            report += f"- Path: `{file_path}`\n"
            report += f"- Pages: {len(reader.pages)}\n"
            
            # Detect Contract Number
            no_match = re.search(r'(?:No|Nomor)\s*Surat\s*Pesanan\s*:\s*([A-Z0-9-/]+)', full_text, re.IGNORECASE)
            report += f"- No Pesanan Target: `{no_match.group(1) if no_match else 'NOT FOUND'}`\n"
            
            # Detect Price Format
            price_match = re.search(r'Rp\s*([\d.,]{5,})', full_text)
            report += f"- Currency Sample: `{price_match.group(0) if price_match else 'NOT FOUND'}`\n"
            
            # Detect Distribution Table Headers
            lower_text = full_text.lower()
            if "nama penerima" in lower_text:
                report += "- ✅ Contains Recipient Table Pattern\n"
                # Extract a small snippet after "Nama Penerima"
                idx = lower_text.find("nama penerima")
                snippet = full_text[idx:idx+250].replace('\n', ' ').strip()
                report += f"  - Snippet: `{snippet}...`\n"
            else:
                report += "- ❌ No explicit Recipient Table header found\n"
                
            # Detect Product Info
            prod_match = re.search(r'(?:Nama Produk|PDN)\s+(.+?)(?:\s+[\d.,]+)', full_text, re.IGNORECASE)
            report += f"- Product Guess: `{prod_match.group(1).strip() if prod_match else 'NOT FOUND'}`\n"

            report += "\n---\n\n"
            
        except Exception as e:
            report += f"## {file_name}\n- ERROR: {str(e)}\n\n---\n\n"

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"Analysis complete. Report saved: {OUTPUT_FILE}")

if __name__ == "__main__":
    analyze_pdfs()
