import re
with open("sskk_output.txt", "r", encoding="utf-8") as f:
    text = f.read()

text = re.sub(r'^\s*Lampiran\s*$', '', text, flags=re.MULTILINE | re.IGNORECASE)
text = re.sub(r'^\s*No\.\s*Surat\s*Pesanan\s*$', '', text, flags=re.MULTILINE | re.IGNORECASE)
text = re.sub(r'^\s*:\s*#[A-Z0-9-]+\s*$', '', text, flags=re.MULTILINE | re.IGNORECASE)
text = re.sub(r'^\s*Tanggal\s*Surat\s*Pesanan\s*$', '', text, flags=re.MULTILINE | re.IGNORECASE)
text = re.sub(r'^\s*:\s*.*?WIB\s*$', '', text, flags=re.MULTILINE | re.IGNORECASE)
text = re.sub(r'^\s*Halaman\s*\d+/\d+\s*$', '', text, flags=re.MULTILINE | re.IGNORECASE)
text = re.sub(r'\n{3,}', '\n\n', text)

print("AFTER STRIP LEN:", len(text))
idx = text.find('6. Pengepakan')
if idx != -1:
    print(text[idx:idx+800])
