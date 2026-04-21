import { cleanValue } from '../src/lib/dataCleaner';

const testCases = [
  { val: 'Kalimantan Tengah', label: 'PROVINSI' },
  { val: 'Kalimantan Barat', label: 'PROVINSI' },
  { val: 'Sumatera Utara', label: 'PROVINSI' },
  { val: 'Bangka Belitung', label: 'PROVINSI' },
  { val: 'Provinsi: Kalimantan Selatan', label: 'PROVINSI' },
];

console.log('--- CLEAN VALUE TEST ---');
testCases.forEach(tc => {
  const result = cleanValue(tc.val, tc.label);
  console.log(`[${tc.label}] "${tc.val}" -> "${result}"`);
});
