import fs from 'fs';

const fullText = fs.readFileSync('pdf_extract_utf8.txt', 'utf8');

// The sequence in a block is roughly:
// Pengiriman  Nama Penerima   : NAME (PHONE)  Permintaan Tiba ... Alamat Pengiriman   :   ADDRESS  Catatan ... Kurir ... 1   INSEKTISIDA VISTA 400 SL   QTY Harga Produk (QTY)   RpX ... Ongkos Kirim (QTY kg)   RpY

const blockRegex = /Nama Penerima\s*:\s*([^]+?)Permintaan Tiba.*?Alamat Pengiriman\s*:\s*([^]+?)Catatan Alamat.*?([\d.,]+)\s*Harga Produk.*?([R][pP][\d.,]+).*?Ongkos Kirim.*?([R][pP][\d.,]+)/gi;

let match;
let count = 0;
while ((match = blockRegex.exec(fullText)) !== null) {
  if (count < 3) {
    console.log(`Block ${count + 1}:`);
    console.log(`Nama: ${match[1].trim()}`);
    console.log(`Alamat: ${match[2].trim()}`);
    console.log(`Kuantitas: ${match[3].trim()}`);
    console.log(`Harga Produk: ${match[4].trim()}`);
    console.log(`Ongkos Kirim: ${match[5].trim()}`);
    console.log('---');
  }
  count++;
}
console.log(`Total blocks found: ${count}`);
