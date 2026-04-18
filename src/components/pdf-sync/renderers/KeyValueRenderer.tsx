import React from 'react';
import { cleanValue } from '@/lib/dataCleaner';
import { useMasterDataStore } from '@/lib/masterDataStore';
import { Highlight } from '@/components/ui/highlight';

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

const JUNK_KEYS = new Set([
  'halaman', 'surat pesanan',
  'https', 'termasuk', 'ringkasan pesanan', 'catatan alamat'
]);

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
      JUNK_KEYS.has(line.toLowerCase()) ||
      /^halaman \d+\/\d+/i.test(line) ||
      /^surat pesanan/i.test(line) ||
      /^http/i.test(line)
    ) {
      i++;
      continue;
    }

    i++;
  }

  // Final Pass: Filter out pairs with junk keys and deduplicate
  const uniquePairs: KVPair[] = [];
  const seen = new Set<string>();

  pairs.forEach(p => {
    const k = p.key.toLowerCase();
    const v = p.value.toLowerCase();
    const signature = `${k}|${v}`;

    // Skip junk or duplicates
    if (JUNK_KEYS.has(k) || seen.has(signature)) return;
    
    // Skip values that look like URLs assigned to generic keys
    if (k === 'https' || k === 'http') return;

    uniquePairs.push(p);
    seen.add(signature);
  });

  return uniquePairs;
}

export function canRenderAsKeyValue(text: string): boolean {
  return parseKeyValues(text).length >= 2;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Section {
  title: string;
  pairs: KVPair[];
}

/**
 * Detects and renders URLs as clickable links, potentially with highlights.
 */
function renderValueWithLinks(val: string, q?: string) {
  if (!val || val === '—') return val;
  
  // Pattern to catch http/https and protocol-relative links (//katalog...)
  const urlPattern = /(https?:\/\/[^\s]+|\/\/[kK]atalog\.[^\s]+)/g;
  const parts = val.split(urlPattern);
  
  if (parts.length === 1) return q ? <Highlight text={val} query={q} /> : val;

  return parts.map((part, i) => {
    if (urlPattern.test(part)) {
      const href = part.startsWith('//') ? `https:${part}` : part;
      return (
        <a 
          key={i} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all font-normal"
        >
          {part}
        </a>
      );
    }
    return q ? <Highlight text={part} query={q} /> : part;
  });
}

export const KeyValueRenderer: React.FC<{ text: string; searchQuery?: string }> = ({ text, searchQuery }) => {
  const allPairs = React.useMemo(() => parseKeyValues(text), [text]);
  const resolveRawAddress = useMasterDataStore(state => state.resolveRawAddress);

  if (allPairs.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 italic p-4">
        No structured fields detected in this section.
      </p>
    );
  }

  // 1. Group into Sections
  const sections: Section[] = [];
  let currentSection: Section = { title: 'General Information', pairs: [] };

  allPairs.forEach((pair) => {
    const isGroupHeader = pair.value === '—';
    if (isGroupHeader) {
      if (currentSection.pairs.length > 0) sections.push(currentSection);
      currentSection = { title: pair.key, pairs: [] };
    } else {
      currentSection.pairs.push(pair);
    }
  });
  sections.push(currentSection);

  return (
    <div className="space-y-4 pt-1">
      {sections.map((section, sIdx) => (
        <div 
          key={sIdx} 
          className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
        >
          {/* Section Header */}
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center">
            <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-black">
              {section.title}
            </span>
          </div>

          {/* Section Content */}
          <div className="flex flex-col">
            {section.pairs.map((pair, pIdx) => (
              <div
                key={pIdx}
                className="grid grid-cols-[180px_1fr] border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
              >
                <div className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider align-top leading-normal border-r border-slate-100/50">
                  <Highlight text={pair.key} query={searchQuery} />
                </div>
                <div className="px-5 py-3 text-[12px] text-slate-700 font-medium align-top leading-relaxed break-words">
                  {renderValueWithLinks(cleanValue(pair.value, pair.key, resolveRawAddress), searchQuery)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
