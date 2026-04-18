import React from 'react';
import { cleanValue } from '@/lib/dataCleaner';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderField {
  label:  string;
  value:  string;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const COLUMN_HEADERS = new Set([
  'nama produk', 'harga produk', 'jumlah', 'barang', 'pdn',
  'jumlah barang', 'keterangan', 'ringkasan pesanan',
]);

const PROCUREMENT_TYPES = ['Melalui Negosiasi', 'Tender', 'E-Purchasing'];

function isColumnHeader(line: string): boolean {
  return COLUMN_HEADERS.has(line.trim().toLowerCase());
}

function isUrl(line: string): boolean {
  const clean = line.replace(/\s/g, '').toLowerCase();
  return clean.startsWith('http') || clean.includes('katalog.ina');
}

function isPortalNoise(line: string): boolean {
  const clean = line.replace(/\s/g, '').toLowerCase();
  // Filter common portal parameters and GUIDs
  return (
    /orderkey=|productid=|itemkey=|orderid=|snapshot-product/.test(clean) ||
    /^[0-9a-f-]{32,36}$/i.test(clean) || // GUIDs
    (clean.includes('&') && clean.includes('=')) || // raw query params
    /^[a-f0-9]{8,12}$/i.test(clean) // short hashes
  );
}

function parseOrderSummary(text: string): { procurement: string; fields: OrderField[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let procurement = '';
  const fields: OrderField[] = [];
  let catalogUrlParts: string[] = [];

  // 1. Identify procurement method first
  const dataLines = lines.filter(line => {
    if (PROCUREMENT_TYPES.some(t => line.toLowerCase().includes(t.toLowerCase()))) {
      procurement = line;
      return false;
    }
    return true;
  });

  // 2. Process data lines
  let i = 0;
  while (i < dataLines.length) {
    const line = dataLines[i];
    const lower = line.toLowerCase();

    // Skip obviously non-data lines (headers)
    if (lower === 'ringkasan pesanan' || isColumnHeader(line)) {
      i++;
      continue;
    }

    // Product Category URL / Hash aggregation
    if (isUrl(line) || isPortalNoise(line)) {
      catalogUrlParts.push(line.replace(/\s/g, ''));
      i++;
      // Keep consuming subsequent lines if they look like URL parts or hashes
      while (i < dataLines.length && (isUrl(dataLines[i]) || isPortalNoise(dataLines[i]))) {
        catalogUrlParts.push(dataLines[i].replace(/\s/g, ''));
        i++;
      }
      continue;
    }

    // PPN rate pattern
    if (/^Golongan PPN/i.test(line)) {
      fields.push({ label: 'Golongan PPN', value: line.replace(/^Golongan PPN\s*/i, '') });
      i++;
      continue;
    }

    // Currency amount (Rp...)
    if (/^Rp[\d\.,]+/.test(line)) {
      fields.push({ label: 'Harga Satuan', value: line });
      i++;
      continue;
    }

    // Quantity pattern
    if (/^[\d\.,]+\s*(?:liter|kg|unit|gr|btl|box)/i.test(line) || (/^[\d\.,]+\s*$/.test(line) && line.length > 2)) {
      fields.push({ label: 'Jumlah', value: line });
      i++;
      continue;
    }

    // Product name: all-caps or title case multi-word
    if (/^[A-Z][A-Z\s\d\(\)-]+$/.test(line) && line.length > 4) {
      if (!line.includes('RP') && !line.includes('WIB')) {
        fields.push({ label: 'Nama Produk', value: line });
        i++;
        continue;
      }
    }

    i++;
  }

  // Final merging and URL cleaning
  const resultFields: OrderField[] = [];
  const seenValues = new Set<string>();

  // Add extracted fields
  for (const f of fields) {
    if (seenValues.has(f.value)) continue;
    seenValues.add(f.value);
    resultFields.push(f);
  }

  // Add catalog URL if found
  if (catalogUrlParts.length > 0) {
    const fullUrl = catalogUrlParts.join('');
    resultFields.push({ label: 'Product Catalog', value: fullUrl });
  }

  return { procurement, fields: resultFields };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const OrderSummaryRenderer: React.FC<{ text: string }> = ({ text }) => {
  const { procurement, fields } = React.useMemo(() => parseOrderSummary(text), [text]);

  return (
    <div className="space-y-3">
      {procurement && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] h-5">
            {procurement}
          </Badge>
        </div>
      )}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-[12px] border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 w-[38%]">
                Field
              </th>
              <th className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, i) => (
              <tr
                key={i}
                className={`border-b border-slate-100 hover:bg-slate-100/30 transition-colors
                            ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
              >
                <td className="px-4 py-2.5 text-slate-500 font-medium align-top leading-snug">
                  {field.label}
                </td>
                <td className="px-4 py-2.5 text-slate-800 font-semibold align-top leading-snug break-words">
                  {field.label === 'Product Catalog' ? (
                    <a 
                      href={field.value.startsWith('http') ? field.value : `https://${field.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline decoration-blue-200 underline-offset-2 break-all"
                    >
                      {field.value}
                    </a>
                  ) : (
                    cleanValue(field.value, field.label)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
