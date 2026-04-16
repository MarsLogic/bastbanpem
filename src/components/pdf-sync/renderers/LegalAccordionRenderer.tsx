import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Search, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { ProseRenderer } from './ProseRenderer';

interface LegalAccordionRendererProps {
  text: string;
}

interface Article {
  id: string;
  title: string;
  body: string;
}

/**
 * Parses SSUK/SSKK legal text by article/clause patterns:
 * - "Pasal N" (Indonesian legal articles)
 * - Numbered clauses like "1.", "2.", etc at start of line
 * Falls back to ProseRenderer if no structure found.
 */
function parseArticles(text: string): Article[] {
  // Try Pasal-based splitting first
  const pasalParts = text.split(/(?=\bPasal\s+\d+\b)/i).filter(s => s.trim());
  if (pasalParts.length >= 2) {
    return pasalParts.map((part, idx) => {
      const lines      = part.trim().split('\n');
      const titleLine  = lines[0].trim();
      const body       = lines.slice(1).join('\n').trim();
      return { id: `pasal-${idx}`, title: titleLine, body };
    });
  }

  // Try numbered clause splitting: lines starting with "1." / "2." etc at top level
  const clausePattern = /^(\d{1,2})\.\s+/;
  const clauseLines   = text.split('\n');
  const articles: Article[] = [];
  let current: Article | null = null;

  for (const line of clauseLines) {
    const m = line.match(clausePattern);
    if (m) {
      if (current) articles.push(current);
      current = {
        id:    `clause-${m[1]}`,
        title: line.trim(),
        body:  '',
      };
    } else if (current) {
      current.body += (current.body ? '\n' : '') + line;
    }
  }
  if (current) articles.push(current);

  return articles.length >= 2 ? articles : [];
}

export const LegalAccordionRenderer: React.FC<LegalAccordionRendererProps> = ({ text }) => {
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const articles = useMemo(() => parseArticles(text), [text]);

  // When no articles detected — fall back to prose with search
  if (articles.length === 0) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search text..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-[11px] bg-slate-50 border-slate-200"
          />
        </div>
        <ProseRenderer text={text} searchQuery={search} />
      </div>
    );
  }

  const q = search.toLowerCase().trim();

  const visible = useMemo(() => {
    if (!q) return articles;
    return articles.filter(
      a =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q),
    );
  }, [articles, q]);

  // Auto-expand articles that match search
  const autoExpanded = useMemo<Set<string>>(() => {
    if (!q) return expanded;
    const s = new Set(expanded);
    visible.forEach(a => s.add(a.id));
    return s;
  }, [q, visible, expanded]);

  const toggleArticle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allExpanded  = visible.every(a => autoExpanded.has(a.id));
  const toggleAll    = () => {
    if (allExpanded) {
      setExpanded(prev => {
        const next = new Set(prev);
        visible.forEach(a => next.delete(a.id));
        return next;
      });
    } else {
      setExpanded(prev => {
        const next = new Set(prev);
        visible.forEach(a => next.add(a.id));
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder={`Search ${articles.length} articles...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-[11px] bg-slate-50 border-slate-200"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAll}
          className="h-8 px-3 text-[10px] font-bold text-slate-500 hover:text-slate-800 shrink-0"
        >
          {allExpanded
            ? <><ChevronsDownUp className="h-3.5 w-3.5 mr-1.5" />Collapse all</>
            : <><ChevronsUpDown className="h-3.5 w-3.5 mr-1.5" />Expand all</>
          }
        </Button>
      </div>

      {/* No results */}
      {visible.length === 0 && (
        <p className="text-sm text-slate-400 italic text-center py-8">
          No articles match "{search}"
        </p>
      )}

      {/* Articles */}
      <div className="space-y-1.5">
        {visible.map(article => {
          const isOpen = autoExpanded.has(article.id);
          return (
            <div
              key={article.id}
              className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
            >
              {/* Header */}
              <button
                onClick={() => toggleArticle(article.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left
                           hover:bg-slate-50 transition-colors"
              >
                {isOpen
                  ? <ChevronDown  className="h-4 w-4 text-blue-500 shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                }
                <span className={`text-[12px] font-bold leading-snug flex-1
                                  ${isOpen ? 'text-blue-700' : 'text-slate-800'}`}>
                  {q ? (
                    // Highlight search term in title
                    highlightText(article.title, q)
                  ) : (
                    article.title
                  )}
                </span>
                {article.body && (
                  <span className="text-[9px] font-mono text-slate-400 shrink-0">
                    {article.body.length > 1000
                      ? `${(article.body.length / 1000).toFixed(1)}k chars`
                      : `${article.body.length} chars`}
                  </span>
                )}
              </button>

              {/* Body */}
              {isOpen && article.body && (
                <div className="px-5 pb-4 pt-1 border-t border-slate-100 bg-slate-50/40">
                  <ProseRenderer text={article.body} searchQuery={q || undefined} />
                </div>
              )}
              {isOpen && !article.body && (
                <div className="px-5 pb-4 pt-1 border-t border-slate-100">
                  <p className="text-[11px] text-slate-400 italic">No body text.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Simple inline highlight helper — avoids regex exec
function highlightText(text: string, query: string): React.ReactNode {
  const lower   = text.toLowerCase();
  const qLower  = query.toLowerCase();
  const idx     = lower.indexOf(qLower);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
