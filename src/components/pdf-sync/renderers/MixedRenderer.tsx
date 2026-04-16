import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ProseRenderer } from './ProseRenderer';
import { DataTableRenderer } from './DataTableRenderer';

interface MixedRendererProps {
  text: string;
  searchQuery?: string;
}

type BlockType = 'prose' | 'table';

interface Block {
  type: BlockType;
  content: string;
  lines: string[];
}

/**
 * Splits section text into alternating prose and table blocks.
 * Table detection: 3+ consecutive lines with consistent column-separator
 * patterns (multiple whitespace gaps of 2+ spaces, or pipe separators).
 */

const MIN_TABLE_ROWS = 3;

function looksTabular(line: string): boolean {
  if (!line.trim()) return false;
  // Pipe-separated
  if ((line.match(/\|/g) ?? []).length >= 2) return true;
  // Multiple double-space gaps (column alignment pattern)
  if ((line.match(/\s{2,}/g) ?? []).length >= 2) return true;
  return false;
}

function splitBlocks(text: string): Block[] {
  const lines  = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    // Check if we're entering a table region
    let tableEnd = i;
    while (tableEnd < lines.length && (looksTabular(lines[tableEnd]) || lines[tableEnd].trim() === '')) {
      tableEnd++;
    }

    const tableLines = lines.slice(i, tableEnd).filter(l => l.trim());

    if (tableLines.length >= MIN_TABLE_ROWS) {
      blocks.push({ type: 'table', content: tableLines.join('\n'), lines: tableLines });
      i = tableEnd;
    } else {
      // Accumulate prose until we hit a real table region
      const proseLines: string[] = [];
      while (i < lines.length) {
        // Peek ahead for table
        let peekEnd = i;
        while (peekEnd < lines.length && (looksTabular(lines[peekEnd]) || lines[peekEnd].trim() === '')) {
          peekEnd++;
        }
        const peekTableLines = lines.slice(i, peekEnd).filter(l => l.trim());
        if (peekTableLines.length >= MIN_TABLE_ROWS) break;

        proseLines.push(lines[i]);
        i++;
      }
      const content = proseLines.join('\n').trim();
      if (content) blocks.push({ type: 'prose', content, lines: proseLines });
    }
  }

  return blocks;
}

/**
 * Parse a table block (column-aligned text) into headers + rows.
 * Strategy: use the first non-empty line as headers, split by 2+ spaces.
 */
function parseTextTable(lines: string[]): { headers: string[]; rows: Record<string, string>[] } {
  if (lines.length === 0) return { headers: [], rows: [] };

  // Find column boundaries from the first data line
  const headerLine = lines[0];
  const colPattern = /\S+(?:\s\S+)*/g;
  const headers: { text: string; start: number; end: number }[] = [];

  for (const m of headerLine.matchAll(/\S+(?:\s(?!\s)\S+)*/g)) {
    headers.push({ text: m[0].trim(), start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }

  if (headers.length < 2) {
    // Single column or undetectable — treat each line as a row with one cell
    return {
      headers: ['Content'],
      rows: lines.map(l => ({ Content: l.trim() })),
    };
  }

  const headerNames = headers.map(h => h.text);

  const rows = lines.slice(1).map(line => {
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const nextStart = idx + 1 < headers.length ? headers[idx + 1].start : line.length + 10;
      const cell = line.slice(h.start, nextStart).trim();
      row[h.text] = cell || '—';
    });
    return row;
  });

  return { headers: headerNames, rows };
}

export const MixedRenderer: React.FC<MixedRendererProps> = ({ text, searchQuery }) => {
  const blocks = React.useMemo(() => splitBlocks(text), [text]);

  if (blocks.length === 0) {
    return <p className="text-sm text-slate-400 italic">No content.</p>;
  }

  return (
    <div className="space-y-5">
      {blocks.map((block, idx) => {
        if (block.type === 'prose') {
          return (
            <div key={idx}>
              <ProseRenderer text={block.content} searchQuery={searchQuery} />
            </div>
          );
        }

        // Table block
        const { headers, rows } = parseTextTable(block.lines);
        return (
          <div key={idx}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[9px] h-5 font-mono">
                table {idx + 1}
              </Badge>
              <span className="text-[9px] text-slate-400">{rows.length} rows · {headers.length} cols</span>
            </div>
            <DataTableRenderer
              table={{ headers, rows, method: 'text-parsed' }}
              showMeta={false}
            />
          </div>
        );
      })}
    </div>
  );
};
