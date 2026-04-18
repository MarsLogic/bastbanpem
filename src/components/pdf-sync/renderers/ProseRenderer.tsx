import React from 'react';
import { ChevronRight, Dot } from 'lucide-react';

interface ProseRendererProps {
  text: string;
  searchQuery?: string;
}

/**
 * Renders arbitrary block text with:
 * - Paragraph grouping (blank-line separated)
 * - Rp amounts highlighted green
 * - Dates highlighted blue
 * - Code/ID patterns in monospace
 * - Optional search term highlighting
 */

type SpanType = 'plain' | 'rp' | 'date' | 'id' | 'url' | 'highlight';
type Span = { text: string; type: SpanType };

const PATTERNS: { pattern: RegExp; type: SpanType }[] = [
  { pattern: /https?:\/\/[^\s]+|\/\/[kK]atalog\.[^\s]+/g,                                              type: 'url'  },
  { pattern: /Rp[\d.,]+/g,                                                                            type: 'rp'   },
  { pattern: /\b\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}(?:,\s*\d{2}:\d{2}(?::\d{2})?\s*WIB)?\b/gi, type: 'date' },
  { pattern: /\b[A-Z0-9]{4,}(?:[-\/][A-Z0-9]+){1,}\b/g,                                             type: 'id'   },
];

function annotate(line: string, searchQuery?: string): Span[] {
  const annotations: { start: number; end: number; type: SpanType }[] = [];
  const MAX_HITS = 500; // Total matches per line safety

  const collect = (pattern: RegExp, type: SpanType) => {
    let hits = 0;
    for (const m of line.matchAll(new RegExp(pattern.source, pattern.flags))) {
      if (hits++ > MAX_HITS) break;
      const start = m.index ?? 0;
      const end   = start + m[0].length;
      const overlaps = annotations.some(a => start < a.end && end > a.start);
      if (!overlaps) annotations.push({ start, end, type });
    }
  };

  PATTERNS.forEach(({ pattern, type }) => collect(pattern, type));

  // Search Highlighting with Safety Cap and iterative logic
  if (searchQuery?.trim() && searchQuery.trim().length >= 2) {
    const q = searchQuery.toLowerCase().trim();
    const txt = line.toLowerCase();
    let pos = 0;
    let hits = 0;
    while ((pos = txt.indexOf(q, pos)) !== -1 && hits < MAX_HITS) {
      const start = pos;
      const end = pos + q.length;
      const overlaps = annotations.some(a => start < a.end && end > a.start);
      if (!overlaps) annotations.push({ start, end, type: 'highlight' });
      pos = end;
      hits++;
    }
  }

  annotations.sort((a, b) => a.start - b.start);

  const spans: Span[] = [];
  let cursor = 0;

  for (const ann of annotations) {
    if (ann.start > cursor) spans.push({ text: line.slice(cursor, ann.start), type: 'plain' });
    spans.push({ text: line.slice(ann.start, ann.end), type: ann.type });
    cursor = ann.end;
  }
  if (cursor < line.length) spans.push({ text: line.slice(cursor), type: 'plain' });

  return spans.length > 0 ? spans : [{ text: line, type: 'plain' }];
}

function SpanEl({ span }: { span: Span }) {
  switch (span.type) {
    case 'url':
      return (
        <a 
          href={span.text.startsWith('//') ? `https:${span.text}` : span.text} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all font-medium transition-colors"
        >
          {span.text}
        </a>
      );
    case 'rp':        return <span className="text-emerald-700 font-bold font-mono bg-emerald-50 px-0.5 rounded transition-all">{span.text}</span>;
    case 'date':      return <span className="text-slate-900 font-semibold underline decoration-slate-200 decoration-2 underline-offset-4">{span.text}</span>;
    case 'id':        return <span className="font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded text-[11px] border border-slate-200/50">{span.text}</span>;
    case 'highlight': return <mark className="bg-amber-100 text-amber-900 rounded px-0.5 shadow-sm">{span.text}</mark>;
    default:          return <span className="text-slate-700 font-normal">{span.text}</span>;
  }
}

export const ProseRenderer: React.FC<ProseRendererProps> = ({ text, searchQuery }) => {
  const paragraphs = React.useMemo(() => {
    return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  }, [text]);

  if (paragraphs.length === 0) {
    return <p className="text-sm text-slate-400 italic">No content detected.</p>;
  }

  return (
    <div className="space-y-4 text-slate-700 font-sans">
      {paragraphs.map((para, pIdx) => {
        const rawLines = para.split('\n');
        
        // Group lines into logical list items or plain text blocks
        // This handles "hanging indent" for multi-line list items
        interface Block {
            type: 'plain' | 'bullet' | 'numbered' | 'lettered';
            marker?: string;
            lines: string[];
        }
        
        const blocks: Block[] = [];
        rawLines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            const bulletMatch   = trimmed.match(/^([•\-\*])\s+(.*)/);
            const numberedMatch = trimmed.match(/^(\d{1,2}[\)\.])\s+(.*)/);
            const letteredMatch = trimmed.match(/^([a-z][\)\.])\s+(.*)/);
            
            if (bulletMatch) {
                blocks.push({ type: 'bullet', marker: bulletMatch[1], lines: [bulletMatch[2]] });
            } else if (numberedMatch) {
                blocks.push({ type: 'numbered', marker: numberedMatch[1], lines: [numberedMatch[2]] });
            } else if (letteredMatch) {
                blocks.push({ type: 'lettered', marker: letteredMatch[1], lines: [letteredMatch[2]] });
            } else if (blocks.length > 0) {
                // Continuation line
                blocks[blocks.length - 1].lines.push(trimmed);
            } else {
                // Initial plain block
                blocks.push({ type: 'plain', lines: [trimmed] });
            }
        });

        return (
          <div key={pIdx} className="text-[12.5px] leading-[1.6]">
            {blocks.map((block, bIdx) => {
              const fullText = block.lines.join(' ');
              
              if (block.type === 'bullet') {
                return (
                  <div key={bIdx} className="flex items-start gap-3 mt-1.5 mb-2">
                    <div className="mt-[6.5px] shrink-0">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-400 border border-slate-500/20" />
                    </div>
                    <span className="flex-1">
                      {annotate(fullText, searchQuery).map((span, sIdx) => (
                        <SpanEl key={sIdx} span={span} />
                      ))}
                    </span>
                  </div>
                );
              }
              
              if (block.type === 'numbered' || block.type === 'lettered') {
                return (
                  <div key={bIdx} className="flex items-start gap-3 mt-1.5 mb-2">
                    <span className="text-[11px] font-extrabold text-slate-600 w-6 shrink-0 text-right mt-[2px] tabular-nums">
                        {block.marker}
                    </span>
                    <div className="flex-1 text-[12px] leading-relaxed text-slate-800">
                      {annotate(fullText, searchQuery).map((span, sIdx) => (
                        <SpanEl key={sIdx} span={span} />
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div key={bIdx} className={`pl-2 ${bIdx > 0 ? "mt-3" : "mt-1"}`}>
                 {annotate(fullText, searchQuery).map((span, sIdx) => (
                    <SpanEl key={sIdx} span={span} />
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
