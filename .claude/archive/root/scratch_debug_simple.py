import sys, os
sys.path.append(os.getcwd())
from backend.services.pdf_intelligence import PDFIntelligence

pdf = PDFIntelligence()
h = "1-Produk"
out = pdf._clean_string(str(h)).title()
print("Cleaned:", out)
