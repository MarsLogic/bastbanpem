import re

text = """
BANTUAN PESTISIDA APBN TAHUN ANGGARAN 2025 
DITJEN PRASARANA DAN SARANA PERTANIAN 
KEMENTERIAN PERTANIAN  
DIBERIKAN SECARA GRATIS DAN TIDAK UNTUK 
DIPERJUALBELIKAN 

Lampiran
No. Surat Pesanan
: #EP-01K7NM3AVZA3Z6QQXRQN3QEPTV
Tanggal Surat Pesanan
: 21 Okt 2025, 23:58:07 WIB
Halaman 8/32
 
7. Pengiriman 
"""

clean_text = re.sub(r'[\f\n]*Lampiran\s*\nNo\.\s*Surat\s*Pesanan\s*\n:\s*#[A-Z0-9-]+\s*\nTanggal\s*Surat\s*Pesanan\s*\n:\s*[\d\w\s,:]+\s*\nHalaman\s*\d+/\d+', '', text)
print("CLEAN TEXT:\n", clean_text.strip())
