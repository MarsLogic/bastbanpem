const fs = require('fs');
const idn = require('idn-area-data');

async function buildMasterData() {
  console.log("Loading regional data from idn-area-data...");
  const provinces = await idn.getProvinces();
  const regencies = await idn.getRegencies();
  const districts = await idn.getDistricts();
  // We can skip villages if the payload is too massive (>20MB) but let's check size first.
  const villages = await idn.getVillages();

  console.log(`Loaded ${provinces.length} provinces, ${regencies.length} regencies, ${districts.length} districts, ${villages.length} villages.`);

  // Create lookup maps
  const provMap = new Map();
  provinces.forEach(p => provMap.set(p.code, p.name));

  const regMap = new Map();
  regencies.forEach(r => regMap.set(r.code, { name: r.name.replace(/^(KAB\.|KOTA)\s+/i, ''), pCode: r.province_code }));

  const distMap = new Map();
  districts.forEach(d => distMap.set(d.code, { name: d.name, rCode: d.regency_code }));

  const output = [];

  for (const v of villages) {
    const distCode = v.district_code;
    const distData = distMap.get(distCode);
    if (!distData) continue;
    
    const regCode = distData.rCode;
    const regData = regMap.get(regCode);
    if (!regData) continue;

    const provCode = regData.pCode;
    const provName = provMap.get(provCode);

    output.push({
      provinsi: provName || '',
      kabupaten: regData.name || '',
      kecamatan: distData.name || '',
      desa: v.name || ''
    });
  }

  const outPath = 'public/master_locations.json';
  fs.writeFileSync(outPath, JSON.stringify(output));
  console.log(`Successfully wrote ${output.length} flattened locations to ${outPath}`);
  console.log(`File size: ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB`);
}

buildMasterData().catch(console.error);
