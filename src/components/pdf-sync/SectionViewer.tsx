import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, Users, Building2, ShoppingCart, CreditCard,
  BookOpen, FileSearch, Paperclip, Search
} from 'lucide-react';
import { SectionFormatter } from './SectionFormatter';

interface SectionViewerProps {
  sections: Record<string, string>;
  fullText?: string;
}

const SECTION_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  HEADER:               { label: 'Header',              icon: <FileText    className="h-3.5 w-3.5" />, color: 'text-slate-500'   },
  PEMESAN:              { label: 'Pemesan',              icon: <Users       className="h-3.5 w-3.5" />, color: 'text-blue-600'    },
  PENYEDIA:             { label: 'Penyedia',             icon: <Building2   className="h-3.5 w-3.5" />, color: 'text-indigo-600'  },
  RINGKASAN_PESANAN:    { label: 'Ringkasan Pesanan',    icon: <ShoppingCart className="h-3.5 w-3.5"/>, color: 'text-emerald-600' },
  RINGKASAN_PEMBAYARAN: { label: 'Ringkasan Pembayaran', icon: <CreditCard  className="h-3.5 w-3.5" />, color: 'text-amber-600'   },
  SSUK:                 { label: 'SSUK',                 icon: <BookOpen    className="h-3.5 w-3.5" />, color: 'text-purple-600'  },
  SSKK:                 { label: 'SSKK',                 icon: <FileSearch  className="h-3.5 w-3.5" />, color: 'text-rose-600'    },
  LAMPIRAN:             { label: 'Lampiran',             icon: <Paperclip   className="h-3.5 w-3.5" />, color: 'text-orange-600'  },
};

function fmtChars(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export const SectionViewer: React.FC<SectionViewerProps> = ({ sections, fullText }) => {
  const entries = Object.entries(sections).filter(([, t]) => (t as string).trim().length > 0);
  const [active, setActive]   = useState<string>(entries[0]?.[0] ?? '');
  const [query, setQuery]     = useState('');

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center gap-4">
        <BookOpen className="h-12 w-12 text-slate-200" />
        <p className="text-sm text-slate-400">No sections extracted yet. Run AI Scan first.</p>
      </div>
    );
  }

  const activeText = (sections[active] as string) ?? '';
  const meta       = SECTION_META[active];

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left sidebar ── */}
      <div className="w-44 shrink-0 border-r bg-slate-50/80 flex flex-col">
        <div className="px-3 py-2 border-b">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sections</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-1">
            {entries.map(([name, text]) => {
              const m       = SECTION_META[name];
              const isActive = name === active;
              return (
                <button
                  key={name}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/80 ${
                    isActive ? 'bg-white border-r-2 border-blue-500 shadow-sm' : ''
                  }`}
                  onClick={() => { setActive(name); setQuery(''); }}
                >
                  <span className={m ? m.color : 'text-slate-500'}>{m?.icon}</span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className={`text-[11px] font-semibold truncate leading-tight ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                      {m?.label ?? name.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">{fmtChars((text as string).length)} chars</span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        {fullText && (
          <div className="p-2 border-t">
            <button
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors hover:bg-slate-200 ${
                active === '__FULL__' ? 'bg-slate-200' : ''
              }`}
              onClick={() => { setActive('__FULL__'); setQuery(''); }}
            >
              <FileSearch className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium text-slate-500">Full Text</span>
                <span className="text-[9px] text-slate-400 font-mono">{fmtChars(fullText.length)} chars</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* ── Right content pane ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Search bar */}
        <div className="px-4 py-2 border-b bg-white flex items-center gap-2 shrink-0">
          <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <Input
            placeholder={`Search in ${meta?.label ?? active}...`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-7 text-[11px] border-0 shadow-none focus-visible:ring-0 bg-transparent p-0 placeholder:text-slate-300"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[10px] text-slate-400 hover:text-slate-600 shrink-0"
            >
              clear
            </button>
          )}
        </div>
        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {active === '__FULL__' ? (
              <div className="bg-slate-900 text-slate-300 rounded-md p-4 text-[10px] font-mono leading-tight whitespace-pre-wrap">
                {fullText}
              </div>
            ) : (
              <SectionFormatter name={active} text={activeText} searchQuery={query} />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
