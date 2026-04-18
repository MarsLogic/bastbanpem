import React from 'react';
import { cleanValue } from '@/lib/dataCleaner';
import { useMasterDataStore } from '@/lib/masterDataStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KVPair {
  key:   string;
  value: string;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parses two common KV formats found in Surat Pesanan sections:
 *   Pattern A — key on one line, ": value" on the next
 *   Pattern B — "Key : Value" or "Key: Value" on the same line
 */
const STOP_KEYWORDS = [
  'informasi pembayaran', 'ringkasan pesanan', 'ringkasan pembayaran',
  'penyedia', 'pemesan', 'penerima', 'lampiran', 'ssuk', 'sskk',
  'dokumen', 'informasi lain', 'catatan', 'detail'
];

function parseKeyValues(text: string): KVPair[] {
  const pairs: KVPair[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    let currentPair: KVPair | null = null;

    // Pattern A: key line followed by ": value" line
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
    // Pattern B: "Key : Value" on same line
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
      // Aggressively consume subsequent lines if they are not new keys or section headers
      while (i < lines.length) {
        const nextLine = lines[i].trim();
        if (!nextLine) { i++; continue; }

        // Detection for next key candidacy
        const isNextKeyPatternA = (
          nextLine.length > 0 && 
          nextLine.length < 80 && 
          !nextLine.includes(':') && 
          i + 1 < lines.length && 
          lines[i + 1].trim().startsWith(':')
        );
        const isNextKeyPatternB = nextLine.match(/^([^:]{1,60}?)\s*:\s*(.*)$/);
        
        // Detection for Section Headers (Stop aggregation)
        const isHeaderLike = STOP_KEYWORDS.some(k => nextLine.toLowerCase().includes(k));
        const isAllCapsHeader = nextLine.length > 5 && nextLine === nextLine.toUpperCase() && !nextLine.includes(',');

        if (isNextKeyPatternA || isNextKeyPatternB || isHeaderLike || isAllCapsHeader) {
          // Special exception: if it's an address continuation that happens to have a keyword but also has address markers
          const isActuallyAddress = /rt|rw|no\.|blok|kel\.|kec\./i.test(nextLine);
          if (isActuallyAddress && !isNextKeyPatternB) {
             // continue aggregation
          } else {
            break; // Stop aggregation
          }
        }

        // It's a continuation line (usually address line 2, 3...)
        if (currentPair.value === '—') currentPair.value = nextLine;
        else currentPair.value += ' ' + nextLine;
        i++;
      }
      pairs.push(currentPair);
      continue;
    }

    // Filter out common header/footer junk
    if (
      /^halaman \d+\/\d+/i.test(line) ||
      /^surat pesanan/i.test(line) ||
      /^tanggal surat pesanan/i.test(line) ||
      /^no\.\s*surat pesanan/i.test(line)
    ) {
      i++;
      continue;
    }

    i++;
  }

  return pairs;
}

export function canRenderAsKeyValue(text: string): boolean {
  return parseKeyValues(text).length >= 2;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const KeyValueRenderer: React.FC<{ text: string }> = ({ text }) => {
  const pairs = parseKeyValues(text);
  const resolveRawAddress = useMasterDataStore(state => state.resolveRawAddress);

  if (pairs.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 italic p-4">
        No structured fields detected in this section.
      </p>
    );
  }

  return (
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
          {pairs.map((pair, i) => {
            const isGroupHeader = pair.value === '—';
            
            if (isGroupHeader) {
                return (
                    <tr key={i} className="bg-slate-100/50 border-y border-slate-200">
                        <td colSpan={2} className="px-4 py-2.5 text-xs font-black uppercase text-slate-700 tracking-wide text-center">
                            {pair.key}
                        </td>
                    </tr>
                );
            }

            return (
              <tr
                key={i}
                className={`border-b border-slate-100 hover:bg-slate-100/30 transition-colors
                            ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
              >
                <td className="px-4 py-2.5 text-slate-500 font-medium align-top leading-snug">
                  {pair.key}
                </td>
                <td className="px-4 py-2.5 align-top leading-snug break-words text-slate-800 font-semibold">
                  {cleanValue(pair.value, pair.key, resolveRawAddress)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
