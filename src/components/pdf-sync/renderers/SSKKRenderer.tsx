import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  ChevronsDownUp, 
  ChevronsUpDown,
  FileText,
  AlignLeft
} from 'lucide-react';
import { Highlight } from '@/components/ui/highlight';

interface SSKKClause {
  nomor: string;
  judul: string;
  isi: string;
}

interface SSKKRendererProps {
  clauses: SSKKClause[];
  searchQuery?: string;
}

/**
 * [PHASE 4] High-Fidelity SSKK Structured Renderer
 * Implements absolute typography uniformity and split-column layout.
 */
export const SSKKRenderer: React.FC<SSKKRendererProps> = ({ clauses, searchQuery }) => {
  const [search, setSearch] = useState(searchQuery || '');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const q = search.toLowerCase().trim();

  const visible = useMemo(() => {
    if (!q) return clauses;
    return clauses.filter(
      c =>
        c.nomor.toLowerCase().includes(q) ||
        c.judul.toLowerCase().includes(q) ||
        c.isi.toLowerCase().includes(q)
    );
  }, [clauses, q]);

  const allExpanded = visible.every(c => expanded.has(c.nomor));
  
  const toggleAll = () => {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(visible.map(c => c.nomor)));
    }
  };

  const toggleClause = (nomor: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(nomor) ? next.delete(nomor) : next.add(nomor);
      return next;
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Search & Actions Panel */}
      <div className="flex items-center gap-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder={`Search ${clauses.length} clauses...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-9 text-[12px] bg-white border-slate-200 focus-visible:ring-slate-300 rounded-lg shadow-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleAll}
          className="h-9 px-3 text-[10px] font-semibold text-slate-500 hover:text-slate-700 bg-white border-slate-200 shadow-sm shrink-0"
        >
          {allExpanded
            ? <><ChevronsDownUp className="h-3.5 w-3.5 mr-2 opacity-70" />Collapse All</>
            : <><ChevronsUpDown className="h-3.5 w-3.5 mr-2 opacity-70" />Expand All</>
          }
        </Button>
      </div>

      {visible.length === 0 && (
        <div className="text-center py-12 bg-slate-50/30 rounded-2xl border border-dashed border-slate-200">
          <Search className="h-8 w-8 text-slate-200 mx-auto mb-3" />
          <p className="text-[12px] text-slate-400 italic">No clauses found matching "{search}"</p>
        </div>
      )}

      {/* Clauses List */}
      <div className="space-y-2">
        {visible.map((clause) => {
          const isExp = expanded.has(clause.nomor) || q.length > 0;
          return (
            <div
              key={clause.nomor}
              className={`group border rounded-xl transition-all duration-200 bg-white shadow-sm overflow-hidden
                ${isExp ? 'border-slate-300 ring-1 ring-slate-100' : 'border-slate-200 hover:border-slate-300'}
              `}
            >
              {/* Header - Domain Structured */}
              <button
                onClick={() => toggleClause(clause.nomor)}
                className="w-full flex items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/50"
              >
                <div className="flex flex-col items-center shrink-0 pt-0.5">
                   <div className="text-[10px] font-mono text-slate-400 font-bold leading-none mb-1 uppercase tracking-tighter">Art.</div>
                   <div className="text-[14px] font-mono font-black text-slate-900 leading-none">{clause.nomor}</div>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-800 uppercase tracking-tight">
                      <Highlight text={clause.judul} query={q} />
                    </span>
                    {q && clause.isi.toLowerCase().includes(q) && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-100 font-medium">Match in content</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-3 self-center">
                  <span className="text-[10px] font-mono text-slate-300">
                    {clause.isi.length.toLocaleString()} chars
                  </span>
                  {isExp 
                    ? <ChevronDown className="h-4 w-4 text-slate-400" />
                    : <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  }
                </div>
              </button>

              {/* High-Fidelity Content Display (Phase 4 Max Logic) */}
              {isExp && (
                <div className="px-5 pb-5 pt-1 bg-slate-50/30 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-[120px_1fr] gap-6 mt-3">
                    {/* Left Column: Metadata / Actions */}
                    <div className="space-y-4 pr-4 border-r border-slate-200/50">
                       <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <FileText className="h-3 w-3" /> Section Target
                          </label>
                          <div className="text-[10px] text-slate-600 font-medium bg-white px-2 py-1 rounded border border-slate-200 shadow-sm inline-block">
                            SSKK Article {clause.nomor}
                          </div>
                       </div>
                       
                    </div>

                    {/* Right Column: Pre-wrapped Body Text with Professional Typography */}
                    <div className="relative group">
                      <div className="absolute -left-3 top-0 bottom-0 w-[2px] bg-slate-200 rounded-full group-hover:bg-slate-300 transition-colors" />
                      <div className="whitespace-pre-wrap text-[12px] leading-[1.6] text-slate-700 font-normal font-sans tracking-normal selection:bg-slate-200">
                         <Highlight text={clause.isi} query={q} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
