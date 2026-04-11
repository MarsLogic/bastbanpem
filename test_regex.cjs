const fs = require('fs');

const fullText = fs.readFileSync('pdf_extract_utf8.txt', 'utf8');

const noMatch = fullText.match(/No\.\s*Surat\s*Pesanan\s*:\s*([A-Z0-9\-]+)/i);
const tglMatch = fullText.match(/Tanggal\s*Surat\s*Pesanan\s*:\s*([\d]{1,2}\s+[a-zA-Z]+\s+\d{4})/i);
const pemesanMatch = fullText.match(/Pemesan\s+(.+?)\s+Nama Penanggung Jawab/i);
const penyediaMatch = fullText.match(/Penyedia\s+(.+?)\s+(?:UMKK\s+)?Nama Penanggung Jawab/i);
const produkMatch = fullText.match(/PDN\s+(.+?)\s+([\d.,]+)\s*(?:liter|kg|gr)/i);
const totalMatch = fullText.match(/Estimasi Total Pembayaran (?:Termin 1\s+)?(Rp[\d.,]+)/i) || fullText.match(/Estimasi Total Pembayaran\s+(Rp[\d.,]+)/i);

console.log("Nomor Kontrak:", noMatch ? noMatch[1] : "NOT FOUND");
console.log("Tanggal:", tglMatch ? tglMatch[1] : "NOT FOUND");
console.log("Pemesan:", pemesanMatch ? pemesanMatch[1] : "NOT FOUND");
console.log("Penyedia:", penyediaMatch ? penyediaMatch[1] : "NOT FOUND");
console.log("Produk:", produkMatch ? produkMatch[1] + ' | QTY: ' + produkMatch[2] : "NOT FOUND");
console.log("Total:", totalMatch ? totalMatch[1] : "NOT FOUND");
