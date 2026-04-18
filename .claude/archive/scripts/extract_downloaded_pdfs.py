import sys
import os
import json
import polars as pl

# Add parent directory to sys.path to import backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.pdf_intelligence import pdf_intel

def main():
    pdf_dir = 'sitemap-bastbanpem/extracted_pdfs'
    output_file = 'output/extracted_pdf_data.json'
    
    if not os.path.exists(pdf_dir):
        print(f"Error: Directory {pdf_dir} not found.")
        return

    results = {}
    pdf_files = [f for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf')]
    
    print(f"Found {len(pdf_files)} PDF files.")
    
    for pdf_file in pdf_files:
        file_path = os.path.join(pdf_dir, pdf_file)
        print(f"Analyzing {pdf_file}...")
        try:
            analysis = pdf_intel.analyze_document(file_path)
            results[pdf_file] = analysis
        except Exception as e:
            print(f"Failed to analyze {pdf_file}: {e}")
            
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    print(f"Extraction complete. Results saved to {output_file}")

if __name__ == "__main__":
    main()
