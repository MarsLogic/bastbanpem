import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { extractSheetMetadata, processMappedData } from '../src/lib/excelParser';

const file = "C:\\Users\\Wyx\\Desktop\\Project 2026\\Data Lama\\Insektisida\\Cilacap\\Rekapitulasi_Cilacap_Meroke CPCL.xlsx";
const sheetName = "CILACAP";

try {
  const buffer = fs.readFileSync(file);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  
  const metadata = extractSheetMetadata(wb, sheetName);
  console.log("Metadata Detected:");
  console.log("Has NIK Pattern:", metadata.hasNikPattern);
  console.log("First Data Row:", metadata.firstDataRowIdx);
  console.log("Suggested NIK Col:", metadata.suggestedMap.nik);
  console.log("Headers:", metadata.headers);

  const rawNikCol = metadata.suggestedMap.nik;
  
  for (let i = metadata.firstDataRowIdx; i < metadata.firstDataRowIdx + 5; i++) {
     const row = metadata.grid[i];
     console.log(`Row ${i} Raw Nik Data:`, row.data[rawNikCol], typeof row.data[rawNikCol]);
  }

  const data = processMappedData(metadata, metadata.suggestedMap);
  console.log("Parsed Rows:", data.rows.length);

} catch(e) {
  console.error("FATAL ERROR:", e);
}
