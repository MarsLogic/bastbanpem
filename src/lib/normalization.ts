/**
 * SHARED NORMALIZATION UTILITIES
 * Used by both Excel and PDF extraction engines to ensure 
 * consistent data quality and typo correction.
 */

export const HEADER_DICTIONARY: Record<string, string> = {
    'hrgabarang': 'Harga Barang',
    'hargasatuan': 'Harga Satuan',
    'ongkoskirim': 'Ongkos Kirim',
    'luaslahan': 'Luas Lahan',
    'optdominan': 'OPT Dominan',
    'optkonfirmasi': 'OPT Konfirmasi',
    'spesifikasibantuan': 'Spesifikasi Bantuan',
    'jadwaltanam': 'Jadwal Tanam',
    'titikkoordinat': 'Titik Koordinat',
    'lokasipertanaman': 'Lokasi Pertanaman',
    'namapenerima': 'Nama Penerima',
    'nomorbastb': 'Nomor BASTB',
    'insi': 'Provinsi',
    'propinsi': 'Provinsi',
    'kabupatenkota': 'Kabupaten / Kota',
    'kabupa': 'Kabupaten',
    'kecama': 'Kecamatan',
    'desa': 'Desa',
    'kelurahan': 'Kelurahan',
    'poktan': 'Poktan',
    'gapoktan': 'Gapoktan',
    'nik': 'NIK',
    'nohp': 'Nomor HP',
    'nomorhp': 'Nomor HP',
    'nomorhandphone': 'Nomor HP',
    'nomorhnadphone': 'Nomor HP',
    'telepon': 'Nomor HP',
    'notelepon': 'Nomor HP',
    'jadwaltana': 'Jadwal Tanam',
    'pestisidalataukg': 'Pestisida (Liter/Kg)',
    'poktangapoktanlmdhkoperasi': 'Poktan / Gapoktan / LMDH / Koperasi',
    'poktangapoktanlmdhkoperasikwt': 'Poktan / Gapoktan / LMDH / Koperasi / KWT',
    'poktangapoktan': 'Poktan / Gapoktan',
    'poktangapoktanlmdh': 'Poktan / Gapoktan / LMDH',
    'volumevolume': 'Volume',
    'hargabarangsatuanhargabarangsatuan': 'Harga Barang Satuan',
    'hargasatuanhargasatuan': 'Harga Satuan',
    'ongkoskirimsatuanongkoskirimsatuan': 'Ongkos Kirim Satuan',
    'jumlahtotalhargasatuanjumlahtotalhargasatuan': 'Total Harga Satuan',
    'jumlahtotalongkoskirimjumlahtotalongkoskirim': 'Total Ongkos Kirim',
    'jumlahtotalhargabarangjmltotalongkirjumlahtotalhargabarangjmltotalongkir': 'Total Harga + Ongkir',
    'jumlahnominalyangditulisdibastpertitikpoktanjumlahnominalyangditulisdibastpertitikpoktan': 'Total Nominal BAST',
    'kecamatankecamatan': 'Kecamatan',
    'desadesa': 'Desa',
    'dusun': 'Dusun',
    'rt': 'RT',
    'rw': 'RW',
    'ktp': 'KTP',
    'kodepos': 'Kode Pos',
    'ketua': 'Ketua kelompok',
    'poktangapoktanlmdhkoperasikwtbrigadepangan': 'Poktan / Gapoktan / LMDH / Koperasi / KWT / Brigade Pangan'
};

/**
 * Standard data string formatter (CamelCase, acronym correction, punctuation fixing)
 */
export const formatDataString = (val: any) => {
    if (val === null || val === undefined) return val;
    let str = String(val);
    
    // Ignore pure numbers or NIK-like strings
    if (/^[\d.\-,]{10,}$/.test(str.trim())) return str;
    
    // Fix missing spaces after punctuation
    str = str.replace(/([.,\/])([a-zA-Z])/g, '$1 $2');
    // Global typo fixes
    str = str.replace(/Ko\s+Perasi/gi, 'Koperasi');
    
    let finalStr = str.split(/(\s+)/).map(word => {
        if (word.trim().length === 0) return word;
        if (/\d/.test(word)) return word.toUpperCase();
        
        const acronyms = ['pt', 'cv', 'bp', 'tbk', 'lmdh', 'kwt', 'ud', 'pd', 'nik', 'hp', 'bast', 'bastb'];
        if (acronyms.includes(word.toLowerCase())) {
           return word.toUpperCase();
        }
        
        if (['di', 'ke', 'dan'].includes(word.toLowerCase())) {
           return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join('');

    return finalStr;
};

/**
 * Normalizes a header or label by checking for known typos.
 */
export const normalizeLabel = (str: string): string => {
    if (!str) return '';
    const squishedKey = String(str).replace(/[^a-z]/gi, '').toLowerCase();
    if (HEADER_DICTIONARY[squishedKey]) {
        return HEADER_DICTIONARY[squishedKey];
    }
    return str;
};
