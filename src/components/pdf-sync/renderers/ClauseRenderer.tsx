import React, { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { KeyValueRenderer, canRenderAsKeyValue } from './KeyValueRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubClause {
  number:  string;   // "1.1", "1.2"
  title:   string;
  content: string;
}

interface MainClause {
  number:     string;   // "1", "2"
  title:      string;
  content:    string;
  children:   SubClause[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseClauses(text: string): MainClause[] {
  const lines = text.split('\n');
  const roots: MainClause[] = [];
  let currentMain: MainClause | null = null;
  let currentSub:  SubClause  | null = null;

  const subRe          = /^\s*(\d{1,3})\.(\d{1,3})\s*(.*)/;
  const mainAloneRe    = /^\s*(\d{1,3})\.\s*$/;
  const mainAndSubRe   = /^\s*(\d{1,3})\.\s+(.*?)\s+(\d{1,3})\.(\d{1,3})\s+(.*)/;
  const mainInlineRe   = /^\s*(\d{1,3})\.\s+(.+)/;

  const flushSub = () => {
    if (currentSub && currentMain) {
      if (currentSub.title || currentSub.content) {
          currentMain.children.push(currentSub);
      }
      currentSub = null;
    }
  };
  const flushMain = () => {
    flushSub();
    if (currentMain) {
        // Only keep if it has title, content, or children
        if (currentMain.title || currentMain.content || currentMain.children.length > 0) {
            roots.push(currentMain);
        }
    }
    currentMain = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const trimmed = line.trim();

    // Sub-clause
    const subMatch = trimmed.match(subRe);
    if (subMatch) {
      flushSub();
      currentSub = {
        number:  `${subMatch[1]}.${subMatch[2]}`,
        title:   subMatch[3].trim(),
        content: '',
      };
      continue;
    }

    // Main clause — number alone on its own line, title on next
    const aloneMatch = trimmed.match(mainAloneRe);
    if (aloneMatch) {
      flushMain();
      let title = '';
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (
        j < lines.length &&
        !lines[j].trim().match(/^\d+\./) &&
        lines[j].trim().length < 120
      ) {
        title = lines[j].trim();
        i = j;

        // Peak ahead for orphan title continuation (PDF column artifacts like "pihak")
        if (i + 1 < lines.length) {
            const nextTrimmed = lines[i + 1].trim();
            if (nextTrimmed.length > 0 && nextTrimmed.length < 15 && !nextTrimmed.match(/^\d+\./) && !nextTrimmed.includes(':')) {
                title += ' ' + nextTrimmed;
                i++;
            }
        }
      }
      currentMain = { number: aloneMatch[1], title, content: '', children: [] };
      continue;
    }

    // Main clause and Sub clause on the exact same line (Multi-column artifact)
    const mainAndSubMatch = trimmed.match(mainAndSubRe);
    if (mainAndSubMatch) {
      flushMain();
      const title = mainAndSubMatch[2].trim();
      currentMain = { number: mainAndSubMatch[1], title, content: '', children: [] };
      
      // Immediately open the sub-clause
      currentSub = {
        number:  `${mainAndSubMatch[3]}.${mainAndSubMatch[4]}`,
        title:   mainAndSubMatch[5].trim(),
        content: '',
      };
      // The rest of the block goes into sub-clause content
      continue;
    }

    // Main clause with inline title
    const inlineMatch = trimmed.match(mainInlineRe);
    if (inlineMatch) {
      flushMain();
      let title = inlineMatch[2].trim();
      let content = '';
      
      // Look for a 2+ space gap indicating a multi-column split from pdfplumber
      const gapMatch = title.match(/^(.*?)\s{2,}(.*)$/);
      if (gapMatch) {
          title = gapMatch[1].trim();
          content = gapMatch[2].trim();
      }
      
      // Peak ahead for orphan title continuation 
      while (!content && title.length < 50 && i + 1 < lines.length) {
          const nextTrimmed = lines[i + 1].trim();
          if (nextTrimmed.length === 0) {
              i++;
              continue;
          }
          if (nextTrimmed.length < 20 && !nextTrimmed.match(/^\d+\./) && !nextTrimmed.includes(':')) {
              title += ' ' + nextTrimmed;
              i++;
          } else {
              break;
          }
      }

      currentMain = { number: inlineMatch[1], title, content, children: [] };
      continue;
    }

    // Continuation text
    if (trimmed.length > 0) {
      if (currentSub) {
        currentSub.content += (currentSub.content ? '\n' : '') + trimmed;
      } else if (currentMain) {
        currentMain.content += (currentMain.content ? '\n' : '') + trimmed;
      }
    }
  }

  flushMain();
  return roots;
}

// ─── Highlight ────────────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {highlight(text.slice(idx + query.length), query)}
    </>
  );
}

function clauseMatches(clause: MainClause, q: string): boolean {
  if (!q) return true;
  if (clause.title.toLowerCase().includes(q)) return true;
  if (clause.content.toLowerCase().includes(q)) return true;
  return clause.children.some(
    s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
  );
}

// ─── Sub-clause row ───────────────────────────────────────────────────────────

const SubClauseItem: React.FC<{ sub: SubClause; q: string }> = ({ sub, q }) => {
  const [open, setOpen] = useState(true);
  const hasContent = Boolean(sub.content);

  return (
    <div className="ml-6 border-l-2 border-slate-100 pl-3">
      <button
        onClick={() => hasContent && setOpen(o => !o)}
        className={`flex items-start gap-1.5 w-full text-left py-1.5 ${hasContent ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {hasContent ? (
          open
            ? <ChevronDown className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="font-black text-slate-400 tabular-nums text-[11px] shrink-0">
          {sub.number}.
        </span>
        <span className="text-[12px] font-semibold text-slate-700 leading-snug">
          {q ? highlight(sub.title, q) : sub.title}
        </span>
      </button>

      {open && hasContent && (
        <div className={`ml-5 pb-2 leading-relaxed border-slate-50 ${canRenderAsKeyValue(sub.content) ? '' : 'text-[11.5px] text-slate-600 whitespace-pre-wrap'}`}>
            {canRenderAsKeyValue(sub.content) ? (
                <div className="bg-slate-50/30 p-2 rounded-xl mt-2">
                    <KeyValueRenderer text={sub.content} />
                </div>
            ) : (
                q ? highlight(sub.content, q) : sub.content
            )}
        </div>
      )}
    </div>
  );
};

// ─── Main clause row ──────────────────────────────────────────────────────────

const MainClauseItem: React.FC<{ clause: MainClause; q: string; defaultOpen: boolean }> = ({
  clause, q, defaultOpen,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasBody = Boolean(clause.content) || clause.children.length > 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header — always clickable */}
      <button
        onClick={() => hasBody && setOpen(o => !o)}
        className={`flex items-center gap-2 w-full text-left bg-slate-50 px-4 py-2.5 border-b border-slate-100 transition-colors hover:bg-slate-100 ${!hasBody ? 'cursor-default' : ''}`}
      >
        {hasBody ? (
          open
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="font-black text-slate-500 tabular-nums text-[12px] shrink-0">
          {clause.number}.
        </span>
        <span className="text-[13px] font-semibold text-slate-800 flex-1 leading-snug">
          {q ? highlight(clause.title, q) : clause.title}
        </span>
        {clause.children.length > 0 && (
          <span className="text-[10px] text-slate-400 shrink-0">
            {clause.children.length} sub-clause{clause.children.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {/* Body */}
      {open && hasBody && (
        <div className="bg-white">
          {clause.content && (
            <div className={`px-4 py-3 leading-relaxed border-b border-slate-50 ${canRenderAsKeyValue(clause.content) ? '' : 'text-[12px] text-slate-600 whitespace-pre-wrap'}`}>
              {canRenderAsKeyValue(clause.content) ? (
                <div className="bg-slate-50/30 p-2 rounded-xl">
                    <KeyValueRenderer text={clause.content} />
                </div>
              ) : (
                q ? highlight(clause.content, q) : clause.content
              )}
            </div>
          )}
          {clause.children.length > 0 && (
            <div className="px-3 py-2 space-y-0.5">
              {clause.children.map((sub, i) => (
                <SubClauseItem key={i} sub={sub} q={q} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Root component ───────────────────────────────────────────────────────────

export const ClauseRenderer: React.FC<{ text: string }> = ({ text }) => {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase().trim();

  const clauses = useMemo(() => parseClauses(text), [text]);

  // Fall back to plain prose if no clause structure detected
  if (clauses.length < 2) {
    return (
      <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
        {text}
      </div>
    );
  }

  const visible = useMemo(
    () => (q ? clauses.filter(c => clauseMatches(c, q)) : clauses),
    [clauses, q]
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <Input
          placeholder={`Search ${clauses.length} clauses…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 pl-8 text-[11px] bg-slate-50 border-slate-200"
        />
      </div>

      {/* No results */}
      {visible.length === 0 && (
        <p className="text-[12px] text-slate-400 italic text-center py-6">
          No clauses match "{search}"
        </p>
      )}

      {/* Clause list */}
      <div className="space-y-2">
        {visible.map((clause, i) => (
          <MainClauseItem
            key={i}
            clause={clause}
            q={q}
            defaultOpen={i === 0}  // only first clause open by default
          />
        ))}
      </div>
    </div>
  );
};
