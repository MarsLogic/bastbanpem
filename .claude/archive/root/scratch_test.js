const text = `
Satuan Kerja : Direktorat Pestisida
PPK          Direktorat Jenderal Prasarana dan
Sarana Pertanian
Nama         : Handi Arief
Alamat       : Kantor kementerian Pertanian Gedung
D Lantai 9 Jl. Harsono RM No.3 Ragunan, 
Jakarta Selatan
Telepon      : (021) 7890043
Website      : www.deptan.go.id
Faksimili    : 78833240; 78840622
E-mail       : handi.a@pertanian.go.id

Penyedia     : CV.Karya Alfredo Nusantara
Nama         : Ferdy Nurmansyah
Alamat       : Paninggilan Utara No.114 Rt 02 Rw 10
Ciledug - tangerang 15153
Telepon      : 081282061423
Email        : infokaryaalfredonusantara@gmail.com
Wakil Sah PPK dan Penyedia sebagai berikut:

Untuk PPK                 : Handi Arief

Untuk Penyedia            : Ferdy Nurmansyah
`;

const lines = text.split('\n');
const pairs = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i].trim();
  if (!line) { i++; continue; }

  let currentPair = null;

  if (
    line.length > 0 &&
    line.length < 80 &&
    !line.includes(':') &&
    i + 1 < lines.length &&
    lines[i + 1].trim().startsWith(':')
  ) {
    const value = lines[i + 1].trim().replace(/^:\s*/, '').trim();
    currentPair = { key: line, value: value || '—' };
    i += 2;
  } 
  else {
    const sameLineMatch = line.match(/^([^:]{1,60}?)\s*:\s*(.*)$/);
    if (sameLineMatch) {
      currentPair = {
        key: sameLineMatch[1].trim(),
        value: sameLineMatch[2].trim() || '—',
      };
      i++;
    }
  }

  if (currentPair) {
    while (i < lines.length) {
      const nextLine = lines[i].trim();
      if (!nextLine) { i++; continue; }

      const isNextKeyPatternA = (
        nextLine.length > 0 && 
        nextLine.length < 80 && 
        !nextLine.includes(':') && 
        i + 1 < lines.length && 
        lines[i + 1].trim().startsWith(':')
      );
      const isNextKeyPatternB = nextLine.match(/^([^:]{1,60}?)\s*:\s*(.*)$/);

      if (isNextKeyPatternA || isNextKeyPatternB) {
        break; 
      }

      if (currentPair.value === '—') currentPair.value = nextLine;
      else currentPair.value += ' ' + nextLine;
      i++;
    }
    pairs.push(currentPair);
    continue;
  }
  i++;
}

console.log(JSON.stringify(pairs, null, 2));
console.log(pairs.length >= 2);
