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

type SpanType = 'plain' | 'rp' | 'date' | 'id' | 'highlight';
type Span = { text: string; type: SpanType };

const PATTERNS: { pattern: RegExp; type: SpanType }[] = [
  { pattern: /Rp[\d.,]+/g,                                                                            type: 'rp'   },
  { pattern: /\b\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}(?:,\s*\d{2}:\d{2}(?::\d{2})?\s*WIB)?\b/gi, type: 'date' },
  { pattern: /\b[A-Z0-9]{4,}(?:[-\/][A-Z0-9]+){1,}\b/g,                                             type: 'id'   },
];

function annotate(line: string, searchQuery?: string): Span[] {
  const annotations: { start: number; end: number; type: SpanType }[] = [];

  const collect = (pattern: RegExp, type: SpanType) => {
    for (const m of line.matchAll(new RegExp(pattern.source, pattern.flags))) {
      const start = m.index ?? 0;
      const end   = start + m[0].length;
      const overlaps = annotations.some(a => start < a.end && end > a.start);
      if (!overlaps) annotations.push({ start, end, type });
    }
  };

  PATTERNS.forEach(({ pattern, type }) => collect(pattern, type));

  if (searchQuery?.trim()) {
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    collect(new RegExp(escaped, 'gi'), 'highlight');
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
    case 'rp':        return <span className="text-emerald-700 font-semibold font-mono">{span.text}</span>;
    case 'date':      return <span className="text-slate-700 font-medium">{span.text}</span>;
    case 'id':        return <span className="font-mono text-slate-600 bg-slate-100 px-0.5 rounded text-[11px]">{span.text}</span>;
    case 'highlight': return <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{span.text}</mark>;
    default:          return <>{span.text}</>;
  }
}

export const ProseRenderer: React.FC<ProseRendererProps> = ({ text, searchQuery }) => {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);

  if (paragraphs.length === 0) {
    return <p className="text-sm text-slate-400 italic">No content.</p>;
  }

  return (
    <div className="space-y-4">
      {paragraphs.map((para, pIdx) => {
        const lines = para.split('\n');
        return (
          <div key={pIdx} className="text-[12px] text-slate-700 leading-relaxed font-sans">
            {lines.map((line, lIdx) => {
              const strLine = line.trim();
              const isBullet = strLine.startsWith('•') || strLine.startsWith('-');
              
              if (isBullet) {
                const content = strLine.substring(1).trim();
                return (
                  <div key={lIdx} className="flex items-start gap-2 mt-1.5 mb-1.5">
                    <Dot className="h-4 w-4 shrink-0 text-slate-400 mt-[1px]" />
                    <span className="flex-1">
                      {annotate(content, searchQuery).map((span, sIdx) => (
                        <SpanEl key={sIdx} span={span} />
                      ))}
                    </span>
                  </div>
                );
              }
              
              const isNumbered = /^\d{1,2}[\)\.]\s/.test(strLine);
              if (isNumbered) {
                const match = strLine.match(/^(\d{1,2}[\)\.])\s(.*)/);
                if (match) {
                  return (
                    <div key={lIdx} className="flex items-start gap-2 mt-1.5 mb-1.5">
                      <span className="text-[11px] font-bold text-slate-500 w-5 shrink-0 text-right mt-[2px]">{match[1]}</span>
                      <span className="flex-1">
                        {annotate(match[2], searchQuery).map((span, sIdx) => (
                          <SpanEl key={sIdx} span={span} />
                        ))}
                      </span>
                    </div>
                  );
                }
              }

              const isLettered = /^[a-z][\)\.]\s/.test(strLine);
              if (isLettered) {
                const match = strLine.match(/^([a-z][\)\.])\s(.*)/);
                if (match) {
                  return (
                    <div key={lIdx} className="flex items-start gap-2 mt-1.5 mb-1.5">
                      <span className="text-[11px] font-bold text-slate-500 w-5 shrink-0 text-right mt-[2px]">{match[1]}</span>
                      <span className="flex-1">
                        {annotate(match[2], searchQuery).map((span, sIdx) => (
                          <SpanEl key={sIdx} span={span} />
                        ))}
                      </span>
                    </div>
                  );
                }
              }

              return (
                <div key={lIdx} className={lIdx > 0 ? "mt-1" : ""}>
                 {annotate(line, searchQuery).map((span, sIdx) => (
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
