import * as fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

async function extractText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  
  let fullText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += `\n--- PAGE ${i} ---\n` + strings.join(' ');
  }
  
  console.log(fullText);
}

extractText('C:\\Users\\Wyx\\Desktop\\KAN\\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf').catch(console.error);
