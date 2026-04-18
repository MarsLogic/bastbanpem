
import { resolveHierarchy, loadMasterData } from './src/lib/masterDataStore';
import fs from 'fs';

async function test() {
    // Mock the master data loading (since it's usually via fetch)
    const data = JSON.parse(fs.readFileSync('./public/master_locations.json', 'utf8'));
    // We need to manually initialize the store's data for this node test
    // But since the store uses global variables inside the module, we'd need a more complex mock.
    // Let's just create a simplified version of the logic to check the scoring.
    
    const prov = "SUMATERA UTARA";
    const kab = "Labuhan Batu";
    const kec = "—";
    const desa = "Sei Penggantun";

    console.log("Testing Triangulation v3 for:", { prov, kab, kec, desa });
    
    // Simulating stripCommon
    const strip = (s) => (s || '').toLowerCase()
        .replace(/\b(kabupaten|kab\.?|kecamatan|kec\.?|provinsi|prov\.?|desa|kelurahan|kel\.?|kota|kt\.?|daerah|istimewa|jakarta|pusat|utara|selatan|timur|barat)\b/g, '')
        .replace(/\s+/g, '').trim();

    const iProv = strip(prov);
    const iKab = strip(kab);
    const iKec = strip(kec);
    const iDesa = strip(desa);

    console.log("Stripped Inputs:", { iProv, iKab, iKec, iDesa });

    // Find "Labuhan Batu" in master data
    const matches = data.filter(r => strip(r.kabupaten) === iKab);
    console.log(`Found ${matches.length} records for Kabupaten ${kab}`);

    const scored = matches.map(r => {
        const dProv = strip(r.provinsi);
        const dKab = strip(r.kabupaten);
        const dKec = strip(r.kecamatan);
        const dDesa = strip(r.desa);

        let score = 0;
        let hits = { prov: 0, kab: 0, kec: 0, desa: 0 };

        if (iProv && dProv.includes(iProv)) { hits.prov = 1.0; score += 50; }
        if (iKab && dKab.includes(iKab)) { hits.kab = 1.0; score += 100; }
        
        // Desa check with prefix matching
        if (iDesa && dDesa.startsWith(iDesa)) { 
            hits.desa = 1.0; 
            score += 150; 
        }

        // Triangulation v3 Score
        if (hits.kab >= 0.6 && hits.desa >= 0.6 && (iKec === '' || iKec === '-')) {
            score += 200;
        }

        return { r, score, hits };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    
    if (best) {
        console.log("Best Match Score:", best.score);
        console.log("Best Match Details:", {
            prov: best.r.provinsi,
            kab: best.r.kabupaten,
            kec: best.r.kecamatan,
            desa: best.r.desa
        });
    } else {
        console.log("No match found.");
    }
}

test();
