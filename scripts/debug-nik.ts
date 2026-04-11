import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const file = "C:\\Users\\Wyx\\Desktop\\KAN\\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.xlsx";
const buffer = fs.readFileSync(file);
const wb = XLSX.read(buffer, { type: 'buffer' });

const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const grid = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

for (let r = 0; r < Math.min(25, grid.length); r++) {
    const row = grid[r];
    if (!row) continue;
    // Just find the column that looks like NIK (length 16)
    const n = row.find(c => String(c).replace(/\s/g, '').length === 16 && /^\d+$/.test(String(c).replace(/\s/g, '')));
    if (n) {
        console.log(`Row ${r}: ${n} (Type: ${typeof n})`);
    }
}
