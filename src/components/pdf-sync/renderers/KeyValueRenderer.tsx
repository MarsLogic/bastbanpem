import React from 'react';

interface KeyValueRendererProps {
  text: string;
}

interface KVPair {
  key: string;
  value: string;
}

/**
 * Parses "Key\n: Value" and "Key : Value" patterns common in Surat Pesanan sections
 * (Pemesan, Penyedia, Header). Renders as a responsive card grid.
 */
function parseKeyValues(text: string): KVPair[] {
  const pairs: KVPair[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Pattern 1: "Key\n: Value" — key on one line, colon+value on next
    if (
      line.length > 0 &&
      !line.startsWith(':') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith(':')
    ) {
      const value = lines[i + 1].trim().replace(/^:\s*/, '').trim();
      if (line.length < 80) { // avoid treating paragraphs as keys
        pairs.push({ key: line, value: value || '—' });
        i += 2;
        continue;
      }
    }

    // Pattern 2: "Key : Value" or "Key: Value" on same line
    const sameLineMatch = line.match(/^([^:]{1,60}?)\s*:\s*(.+)$/);
    if (sameLineMatch) {
      pairs.push({
        key:   sameLineMatch[1].trim(),
        value: sameLineMatch[2].trim() || '—',
      });
      i++;
      continue;
    }

    i++;
  }

  return pairs;
}

export function canRenderAsKeyValue(text: string): boolean {
  const pairs = parseKeyValues(text);
  return pairs.length >= 2;
}

export const KeyValueRenderer: React.FC<KeyValueRendererProps> = ({ text }) => {
  const pairs = parseKeyValues(text);

  if (pairs.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">
        No key-value fields detected in this section.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {pairs.map((pair, idx) => (
        <div
          key={idx}
          className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <dt className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">
            {pair.key}
          </dt>
          <dd
            className={`text-[13px] leading-snug break-words
                        ${pair.value === '—' ? 'text-slate-300 italic font-normal' : 'text-slate-800 font-semibold'}`}
          >
            {pair.value}
          </dd>
        </div>
      ))}
    </div>
  );
};
