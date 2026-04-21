import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { KeyValueRenderer, canRenderAsKeyValue } from './KeyValueRenderer';
import { ProseRenderer } from './ProseRenderer';
import { Highlight } from '@/components/ui/highlight';

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

  const subRe          = /^\s*(?:\*\*)?(\d{1,4}(?:[\.][a-z0-9]+)+)[\.\)]?(?:\*\*)?\s*(.*)$/i;
  const mainAloneRe    = /^\s*(?:\*\*)?(\d{1,4}(?:[a-z])?)[\.\)](?:\*\*)?\s*$/i;
  const mainAndSubRe   = /^\s*(?:\*\*)?(\d{1,4}(?:[a-z])?)[\.\)](?:\*\*)?\s+(.*?)\s+(?:\*\*)?(\d{1,4}(?:[\.][a-z0-9]+)+)[\.\)]?(?:\*\*)?\s+(.*)$/i;
  const mainInlineRe   = /^\s*(?:\*\*)?(\d{1,4}(?:[a-z])?)[\.\)](?:\*\*)?\s+(.+)$/i;

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

    // PERFORMANCE/SAFETY: Ignore lines that clearly look like shipment metadata
    // e.g. "114. 785 544" or "000 36 24 24 1.29"
    if (trimmed.match(/^\d{1,4}\.\s*\d{3,}/) || trimmed.match(/^\d{3,}\s+\d{2,}\s+\d{2,}/)) {
        continue;
    }

    // Sub-clause
    const subMatch = trimmed.match(subRe);
    if (subMatch) {
      flushSub();
      currentSub = {
        number:  subMatch[1],
        title:   subMatch[2].trim(),
        content: '',
      };
      continue;
    }

    // Main clause — number alone on its own line, title on next (Stanza support)
    const aloneMatch = trimmed.match(mainAloneRe);
    if (aloneMatch) {
      flushMain();
      let title = '';
      let j = i + 1;
      // Skip empty lines to find the title
      while (j < lines.length && !lines[j].trim()) j++;
      
      if (
        j < lines.length &&
        !lines[j].trim().match(/^(?:\*\*)?\d+/) &&
        lines[j].trim().length < 120
      ) {
        title = lines[j].trim();
        i = j;

        // Peak ahead for orphan title continuation (PDF column artifacts like "pihak")
        if (i + 1 < lines.length) {
            const nextTrimmed = lines[i + 1].trim();
            if (nextTrimmed.length > 0 && nextTrimmed.length < 15 && !nextTrimmed.match(/^(?:\*\*)?\d+/) && !nextTrimmed.includes(':')) {
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
        number:  mainAndSubMatch[3],
        title:   mainAndSubMatch[4].trim(),
        content: '',
      };
      // The rest of the block goes into sub-clause content
      continue;
    }

    // Main clause with inline title
    const inlineMatch = trimmed.match(mainInlineRe);
    // CRITICAL: Ensure the number part is short. 
    // Shipment IDs like 114. 785... have a long tail that mainInlineRe might eat.
    if (inlineMatch && inlineMatch[1].length <= 5) {
      flushMain();
      let title = inlineMatch[2].trim();
      let content = '';
      
      // Look for a 2+ space gap indicating a multi-column split from pdfplumber
      const gapMatch = title.match(/^(.*?)\s{3,}(.*)$/);
      if (gapMatch) {
          title = gapMatch[1].trim();
          content = gapMatch[2].trim();
      }
      
      // Peak ahead for orphan title continuation 
      while (!content && i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextTrimmed = nextLine.trim();
          if (nextTrimmed.length === 0) {
              i++;
              continue;
          }
          
          // If it starts with a number or seems like a section header, stop
          if (nextTrimmed.match(/^\d+\./) || nextTrimmed.match(/^[a-zA-Z]\./) || nextTrimmed.includes(':')) break;
          
          // If it's short and aligned with the title column (start index < 10)
          const startIdx = nextLine.search(/\S/);
          if (startIdx < 15 && nextTrimmed.length < 30) {
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

// ─── Search Logic ─────────────────────────────────────────────────────────────

function clauseMatches(clause: MainClause, q: string): boolean {
  if (!q) return true;
  const lowerQ = q.toLowerCase();
  if (clause.title.toLowerCase().includes(lowerQ)) return true;
  if (clause.content.toLowerCase().includes(lowerQ)) return true;
  return clause.children.some(
    s => s.title.toLowerCase().includes(lowerQ) || s.content.toLowerCase().includes(lowerQ)
  );
}

// ─── Sub-clause row ───────────────────────────────────────────────────────────

const SubClauseItem: React.FC<{ sub: SubClause; q: string }> = ({ sub, q }) => {
  const [open, setOpen] = useState(true);
  const hasContent = Boolean(sub.content);

  return (
    <div className="ml-5 border-l border-slate-200/60 pl-4 my-1">
      <button
        onClick={() => hasContent && setOpen(o => !o)}
        className={`flex items-start gap-2 w-full text-left py-2 transition-opacity ${hasContent ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
      >
        <span className="font-extrabold text-slate-600 tabular-nums text-[11px] mt-[1px] shrink-0">
          {sub.number}.
        </span>
        <span className="text-[12px] font-bold text-slate-800 leading-snug">
          <Highlight text={sub.title} query={q} />
        </span>
        {hasContent && (
           open
           ? <ChevronDown className="h-3 w-3 text-slate-400 mt-1 shrink-0 ml-auto" />
           : <ChevronRight className="h-3 w-3 text-slate-400 mt-1 shrink-0 ml-auto" />
        )}
      </button>

      {open && hasContent && (
        <div className="pb-3 pr-2">
            {canRenderAsKeyValue(sub.content) ? (
                <div className="bg-slate-50/50 p-2.5 rounded-xl mt-1 border border-slate-100">
                    <KeyValueRenderer text={sub.content} />
                </div>
            ) : (
                <ProseRenderer text={sub.content} searchQuery={q} />
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

  // Auto-expand if the query matches this specific clause or its children
  useEffect(() => {
    if (q && clauseMatches(clause, q)) {
      setOpen(true);
    }
  }, [q, clause]);

  return (
    <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header — always clickable */}
      <button
        onClick={() => hasBody && setOpen(o => !o)}
        className={`flex items-center gap-3 w-full text-left bg-slate-50/80 px-4 py-3 border-b border-slate-100 transition-colors hover:bg-slate-100/80 ${!hasBody ? 'cursor-default' : ''}`}
      >
        <span className="font-extrabold text-slate-700 tabular-nums text-[12px] shrink-0">
          {clause.number}.
        </span>
        <span className="text-[14px] font-bold text-slate-900 flex-1 leading-snug tracking-tight">
          <Highlight text={clause.title} query={q} />
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {clause.children.length > 0 && (
            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
              {clause.children.length} sub-clause{clause.children.length !== 1 ? 's' : ''}
            </span>
          )}
          {hasBody && (
            open
              ? <ChevronDown className="h-4 w-4 text-slate-500" />
              : <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Body */}
      {open && hasBody && (
        <div className="bg-white">
          {clause.content && (
            <div className="px-5 py-4 pt-1 border-b border-slate-50">
              <div className="pl-6 border-l border-slate-100 ml-1">
                {canRenderAsKeyValue(clause.content) ? (
                  <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                      <KeyValueRenderer text={clause.content} />
                  </div>
                ) : (
                  <ProseRenderer text={clause.content} searchQuery={q} />
                )}
              </div>
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

export const ClauseRenderer: React.FC<{ text: string; searchQuery?: string }> = ({ text, searchQuery }) => {
  const [search, setSearch] = useState('');
  
  // Sync internal search with external global search
  React.useEffect(() => {
    if (searchQuery !== undefined) {
      setSearch(searchQuery);
    }
  }, [searchQuery]);

  const q = search.toLowerCase().trim();

  const clauses = useMemo(() => parseClauses(text), [text]);

  // Fall back to plain prose if no clause structure detected
  if (clauses.length < 2) {
    return (
      <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap font-sans max-h-[600px] overflow-y-auto p-4 bg-slate-50/50 rounded-xl border border-slate-200">
        <div className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-2">
           <Search className="h-3 w-3" /> Raw Document Text (Parsing Refined)
        </div>
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
      {/* Only show local search if no global search is provided */}
      {!searchQuery && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder={`Search ${clauses.length} clauses…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-[11px] bg-slate-50 border-slate-200"
          />
        </div>
      )}

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
