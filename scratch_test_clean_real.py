import re

with open('sskk_output.txt', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'[\f\n]*Lampiran\s*\n\s*No\.\s*Surat.*?Halaman\s*\d+/\d+'
matches = re.findall(pattern, text, flags=re.IGNORECASE | re.DOTALL)
print(f"Found {len(matches)} matches")
if matches:
    print("First match:", repr(matches[0][:100]))

clean_text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.DOTALL)
print("Before len:", len(text), "After len:", len(clean_text))
