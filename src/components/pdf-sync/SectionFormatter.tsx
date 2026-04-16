import React, { useState, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, TableIcon } from 'lucide-react';

interface SectionFormatterProps {
  name: string;
  text: string;
  searchQuery: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArticles(text: string): { title: string; body: string }[] {
  const parts = text.split(/(?=Pasal\s+\d+)/i);
  return parts
    .filter(p => p.trim().length > 10)
    .map(p => {
      const lines = p.split('\n');
      return { title: lines[0].trim(), body: lines.slice(1).join('\n').trim() };
    });
}

function parseKeyValues(text: string): { key: string; value: string }[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const pairs: { key: string; value: string }[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i + 1].startsWith(':')) {
      pairs.push({ key: lines[i], value: lines[i + 1].replace(/^:\s*/, '').trim() });
      i++;
    }
  }
  return pairs;
}

// ── Highlight ─────────────────────────────────────────────────────────────────

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// ── Article Accordion ─────────────────────────────────────────────────────────

function ArticleItem({ title, body, searchQuery }: { title: string; body: string; searchQuery: string }) {
  const hasMatch = !!searchQuery && body.toLowerCase().includes(searchQuery.toLowerCase());
  const [open, setOpen] = useState(false);
  const isOpen = open || hasMatch;

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${hasMatch ? 'border-yellow-300' : 'border-slate-200'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-left transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
          <Highlighted text={title} query={searchQuery} />
        </span>
        <div className="flex items-center gap-2">
          {hasMatch && (
            <Badge variant="outline" className="text-[9px] text-yellow-700 border-yellow-300 bg-yellow-50 h-4 px-1.5">
              match
            </Badge>
          )}
          {isOpen
            ? <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
            : <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 py-3 text-[11px] text-slate-700 font-serif leading-relaxed whitespace-pre-wrap bg-white border-t border-slate-100">
          <Highlighted text={body} query={searchQuery} />
        </div>
      )}
    </div>
  );
}

// ── Key-Value Grid ────────────────────────────────────────────────────────────

function KeyValueGrid({ pairs, searchQuery }: { pairs: { key: string; value: string }[]; searchQuery: string }) {
  const filtered = searchQuery
    ? pairs.filter(p =>
        p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.value.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pairs;

  if (filtered.length === 0) {
    return (
      <p className="text-[11px] text-slate-400 text-center py-8">
        {searchQuery ? `No fields matching "${searchQuery}"` : 'No key-value fields detected in this section.'}
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {filtered.map((p, i) => (
        <div key={i} className="flex gap-3 bg-white border border-slate-100 rounded-md px-3 py-2.5 hover:border-slate-200 transition-colors">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide min-w-[140px] shrink-0 pt-0.5">
            <Highlighted text={p.key} query={searchQuery} />
          </span>
          <span className="text-[12px] text-slate-800 font-medium break-words">
            <Highlighted text={p.value} query={searchQuery} />
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const SectionFormatter: React.FC<SectionFormatterProps> = ({ name, text, searchQuery }) => {
  const isLegal = ['SSUK', 'SSKK'].includes(name);
  const isKV    = ['HEADER', 'PEMESAN', 'PENYEDIA'].includes(name);
  const isLamp  = name === 'LAMPIRAN';

  const articles = useMemo(() => (isLegal ? parseArticles(text) : []), [name, text]);
  const kvPairs  = useMemo(() => (isKV    ? parseKeyValues(text) : []), [name, text]);

  if (isLamp) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <TableIcon className="h-10 w-10 text-slate-200" />
        <p className="text-sm font-medium text-slate-500">Lampiran data is in the <strong>Tables</strong> tab.</p>
        <p className="text-[11px] text-slate-400">Switch to the Tables tab to view extracted Lampiran rows.</p>
      </div>
    );
  }

  if (isLegal) {
    if (articles.length === 0) {
      return <p className="text-[11px] text-slate-400 text-center py-8">No Pasal articles detected in {name}.</p>;
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <Badge variant="secondary" className="text-[10px]">{articles.length} articles (Pasal)</Badge>
          {searchQuery && (
            <Badge variant="outline" className="text-[10px] text-yellow-700">
              Searching: &ldquo;{searchQuery}&rdquo;
            </Badge>
          )}
        </div>
        {articles.map((a, i) => (
          <ArticleItem key={i} title={a.title} body={a.body} searchQuery={searchQuery} />
        ))}
      </div>
    );
  }

  if (isKV) {
    return <KeyValueGrid pairs={kvPairs} searchQuery={searchQuery} />;
  }

  // Fallback: preformatted searchable text (truncated at 20k for performance)
  const display = text.length > 20000
    ? text.slice(0, 20000) + '\n\n[...truncated — switch to Full Text for complete content]'
    : text;

  return (
    <div className="bg-white border border-slate-100 rounded-md p-4 text-[11px] text-slate-700 font-mono leading-relaxed whitespace-pre-wrap">
      <Highlighted text={display} query={searchQuery} />
    </div>
  );
};
