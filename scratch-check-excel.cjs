const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePaths = [
  "C:\\Users\\Wyx\\Desktop\\!Other Files\\CPCL Magelang _ PT. Alfredo.xls",
  "C:\\Users\\Wyx\\Desktop\\!Other Files\\2-BASTB dan Surat Jalan_KAN_Vista_CianjurCiamisGarutLamselPesawaranTulangbawang (Padi Gogo) (1).xlsx",
  "C:\\Users\\Wyx\\Desktop\\!Other Files\\2CPCL Magelang _ PT. Alfredo NEW.xlsx",
  "C:\\Users\\Wyx\\Desktop\\!Other Files\\KAN_Vista_LamtengTulangbawangWaykananPesawaranLamtimLamutTubabaratMagelang (Padi Gogo).xlsx",
  "C:\\Users\\Wyx\\Desktop\\!Other Files\\KAN_Vista_Sheet 2 (Padi Gogo).xlsx"
];

filePaths.forEach(fp => {
  if (fs.existsSync(fp)) {
    console.log("Reading:", path.basename(fp));
    try {
      const wb = XLSX.readFile(fp);
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const grid = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      const firstRows = grid.slice(0, 5);
      console.log(JSON.stringify(firstRows, null, 2));
    } catch(e) {
      console.log("Error reading file:", e.message);
    }
  } else {
    console.log("File not found:", fp);
  }
});
