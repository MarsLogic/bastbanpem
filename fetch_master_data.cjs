const https = require('https');
const fs = require('fs');
const readline = require('readline');

console.log("Fetching Indonesian Regions Data...");

https.get('https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.csv', (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed to fetch: ${res.statusCode}`);
    return;
  }

  const provinces = {};
  const regencies = {};
  const districts = {};
  const output = [];

  const rl = readline.createInterface({
    input: res,
    crlfDelay: Infinity
  });

  rl.on('line', (line) => {
    // Format: kode,nama
    // ex: 11,ACEH
    //     11.01,KAB. ACEH SELATAN
    //     11.01.01,Kecamatan Bakongan  (sometimes it includes "Kecamatan" or just name)
    //     11.01.01.2001,Keude Bakongan
    const parts = line.split(',');
    if (parts.length < 2) return;
    
    // We only care about the first comma separation if the name contains commas they are quoted?
    // Actually the CSV uses commas, no quotes.
    const code = parts[0];
    const name = parts.slice(1).join(',').trim();
    
    if (code.length === 2) {
      provinces[code] = name;
    } else if (code.length === 5) {
      regencies[code] = name.replace(/^(KAB\.|KOTA)\s+/i, '');
    } else if (code.length === 8) {
      districts[code] = name;
    } else if (code.length === 13) {
      // Village
      const provCode = code.substring(0, 2);
      const regCode = code.substring(0, 5);
      const distCode = code.substring(0, 8);
      
      output.push({
        p: provinces[provCode] || '',
        k: regencies[regCode] || '',
        c: districts[distCode] || '',
        d: name
      });
    }
  });

  rl.on('close', () => {
    // Write to a compressed JSON structure to save space
    console.log(`Successfully parsed ${output.length} villages.`);
    fs.writeFileSync('src/lib/regions.json', JSON.stringify(output));
    console.log("Written to src/lib/regions.json");
  });
}).on('error', (err) => {
  console.error("Error: ", err.message);
});
