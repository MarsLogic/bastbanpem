import re

text = """
BANTUAN PESTISIDA APBN TAHUN ANGGARAN 2025 

Lampiran
No. Surat Pesanan
: #EP-01K7NM3AVZA3Z6QQXRQN3QEPTV
Tanggal Surat Pesanan
: 21 Okt 2025, 23:58:07 WIB
Halaman 8/32
 
7. Pengiriman 
"""

pattern = r'[\f\n]*Lampiran\s*\n\s*No\.\s*Surat.*?Halaman\s*\d+/\d+'
clean_text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL)
print("CLEAN TEXT:\n", clean_text.strip())
