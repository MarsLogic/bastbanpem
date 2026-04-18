import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import {
  FileText, Users2, Building2, ShoppingCart, CreditCard,
  BookOpen, FileSearch, Paperclip, TableIcon, Hash,
} from 'lucide-react';

import { KeyValueRenderer }         from './renderers/KeyValueRenderer';
import { ClauseRenderer }           from './renderers/ClauseRenderer';
import { FinancialSummaryRenderer } from './renderers/FinancialSummaryRenderer';
import { OrderSummaryRenderer }     from './renderers/OrderSummaryRenderer';
import { DataTableRenderer }        from './renderers/DataTableRenderer';
import { AutoRenderer }             from './renderers/AutoRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawTable {
  page?:     number;
  page_end?: number;
  headers:   string[];
  rows:      Record<string, any>[];
  method?:   string;
}

interface DocumentViewProps {
  sections:        Record<string, string>;
  tables:          RawTable[];
  scrollToKey:     string; // section::KEY or table::N or ''
  onActiveChange?: (id: string) => void;
  ultraRobust?:    any;   // Pass through for advanced renderers
}

// ─── Section metadata ─────────────────────────────────────────────────────────

export const SECTION_ORDER = [
  'HEADER', 'PEMESAN', 'PENYEDIA',
  'RINGKASAN_PESANAN', 'RINGKASAN_PEMBAYARAN',
  'SSUK', 'SSKK', 'LAMPIRAN',
];

// Sections whose data is already shown elsewhere — skip rendering
const HIDDEN_SECTIONS = new Set(['_DELIVERY_BOUNDARY']);

const SECTION_META: Record<string, { label: string; Icon: React.FC<any> }> = {
  HEADER:               { label: 'Header',               Icon: FileText    },
  PEMESAN:              { label: 'Pemesan',               Icon: Users2      },
  PENYEDIA:             { label: 'Penyedia',              Icon: Building2   },
  RINGKASAN_PESANAN:    { label: 'Ringkasan Pesanan',     Icon: ShoppingCart },
  RINGKASAN_PEMBAYARAN: { label: 'Ringkasan Pembayaran',  Icon: CreditCard  },
  SSUK:                 { label: 'SSUK',                  Icon: BookOpen    },
  SSKK:                 { label: 'SSKK',                  Icon: FileSearch  },
  LAMPIRAN:             { label: 'Lampiran',              Icon: Paperclip   },
};

// ─── Section content renderer ─────────────────────────────────────────────────

function renderSectionContent(key: string, text: string, searchQuery: string, ultraRobust: any, tables: RawTable[]) {
  switch (key) {
    case 'HEADER':
    case 'PEMESAN':
    case 'PENYEDIA':
      return <KeyValueRenderer text={text} />;

    case 'RINGKASAN_PESANAN':
      return <OrderSummaryRenderer text={text} />;

    case 'RINGKASAN_PEMBAYARAN':
      return (
        <FinancialSummaryRenderer 
          text={text} 
          ledger={ultraRobust?.shipment_ledger}
          financials={ultraRobust?.financials}
        />
      );

    case 'SSUK':
    case 'SSKK':
      return <ClauseRenderer text={text} />;

    case 'LAMPIRAN':
      return (
        <div className="flex flex-col gap-4">
          <AutoRenderer text={text} searchQuery={searchQuery || undefined} />
          {tables.length > 0 && (
            <div className="mt-2 border-l-2 border-slate-100 pl-4">
              <div className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-tighter">Lampiran Data Table</div>
              <DataTableRenderer table={tables[0]} showMeta={false} />
            </div>
          )}
        </div>
      );

    default:
      return <AutoRenderer text={text} searchQuery={searchQuery || undefined} />;
  }
}

// ─── Section divider header ───────────────────────────────────────────────────

const SectionHeader: React.FC<{
  label:    string;
  Icon:     React.FC<any>;
  chars:    number;
  id:       string;
}> = ({ label, Icon, chars, id }) => (
  <div id={id} className="flex items-center gap-3 pt-8 pb-3 scroll-mt-4">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-500" />
      <span className="text-[13px] font-black text-slate-800 uppercase tracking-wide">{label}</span>
    </div>
    <div className="flex-1 h-px bg-slate-200" />
    <span className="text-[9px] font-mono text-slate-400 tabular-nums shrink-0">
      {chars >= 1000 ? `${(chars / 1000).toFixed(1)}k` : chars} chars
    </span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const DocumentView: React.FC<DocumentViewProps> = ({
  sections,
  tables,
  scrollToKey,
  onActiveChange,
  ultraRobust,
}) => {
  const [globalSearch, setGlobalSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs  = useRef<Record<string, HTMLElement | null>>({});
  const ignoreScrollUntil = useRef(0);
  const [internalActiveId, setInternalActiveId] = useState('');
  const internalActiveIdRef = useRef(''); // Sync ref for scroll listener

  // Wrapper for updating both state and ref
  const updateActiveId = (id: string) => {
    setInternalActiveId(id);
    internalActiveIdRef.current = id;
  };

  // Build ordered section entries (ordered + unknown appended)
  const orderedEntries = useMemo(() => {
    const known = new Set(SECTION_ORDER);
    const order: [string, string][] = [];

    // First: known sections in fixed order
    for (const key of SECTION_ORDER) {
      const text = sections[key];
      if (text && text.trim() && !HIDDEN_SECTIONS.has(key)) {
        order.push([key, text]);
      }
    }
    // Then: unknown sections not in order list
    for (const [key, text] of Object.entries(sections)) {
      if (!known.has(key) && !HIDDEN_SECTIONS.has(key) && text && text.trim()) {
        order.push([key, text]);
      }
    }

    return order;
  }, [sections]);

  // Scroll to section when scrollToKey changes
  useEffect(() => {
    if (!scrollToKey) return;

    let domId = '';
    if (scrollToKey.startsWith('section::')) {
      domId = `section-${scrollToKey.replace('section::', '')}`;
    } else if (scrollToKey.startsWith('table::')) {
      domId = `table-${scrollToKey.replace('table::', '')}`;
    }

    if (!domId) return;

    // Slight delay so DOM is painted
    const t = setTimeout(() => {
      // Temporarily ignore scroll events to avoid jitter during the animation
      ignoreScrollUntil.current = Date.now() + 800; 
      
      const el = document.getElementById(domId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateActiveId(scrollToKey);
      }
    }, 50);

    return () => clearTimeout(t);
  }, [scrollToKey]);

  // Scroll-tracking (ScrollSpy) using window.onscroll + requestAnimationFrame
  // This is significantly more resilient for short sections than IntersectionObserver
  useEffect(() => {
    if (!onActiveChange) return;

    let ticking = false;

    const handleScroll = () => {
      // Don't track while executing a manual "smooth scroll" from sidebar click
      if (Date.now() < ignoreScrollUntil.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const elements = Array.from(document.querySelectorAll('[data-nav-id]'));
          
          let activeElement = elements[0];
          
          // Heuristic: iterate through elements (in visual DOM order).
          // We pick the LAST element whose top bounding box crosses above
          // our "read line" threshold          // Read line threshold: 30% down the viewport is a natural 'focus' area
          const threshold = window.innerHeight * 0.3;
          
          // If we reached the bottom of the scroll, prioritize the last element
          const scrollContainer = containerRef.current?.closest('.overflow-auto') || document.documentElement;
          const isAtBottom = (scrollContainer.scrollTop + scrollContainer.clientHeight) >= (scrollContainer.scrollHeight - 50);

          for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= threshold || (isAtBottom && el === elements[elements.length - 1])) {
              activeElement = el;
            } else {
              break;
            }
          }

          if (activeElement) {
            const id = activeElement.getAttribute('data-nav-id');
            if (id && id !== internalActiveIdRef.current) {
              updateActiveId(id);
              onActiveChange(id);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const scrollContainer = containerRef.current?.closest('.overflow-auto') || window;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    // Trigger once on mount to establish initial state
    handleScroll();

    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [onActiveChange]);

  const hasSections = orderedEntries.length > 0;
  const hasTables   = tables.length > 0;

  if (!hasSections && !hasTables) {
    return (
      <div className="flex items-center justify-center p-16 text-center">
        <p className="text-[12px] text-slate-400 italic">
          No content extracted yet. Run AI Scan to populate sections and tables.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto px-6 pb-16">

      {/* Global search */}
      <div className="sticky top-0 z-20 bg-white pt-4 pb-3 border-b border-slate-100 mb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search across all sections and tables…"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            className="h-9 pl-9 pr-9 text-[12px] bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Sections ── */}
      {orderedEntries.map(([key, text]) => {
        const meta    = SECTION_META[key];
        const label   = meta?.label ?? key.replace(/_/g, ' ');
        const Icon    = meta?.Icon  ?? Hash;
        const domId   = `section-${key}`;

        return (
          <section
            key={key}
            data-nav-id={`section::${key}`}
            ref={el => { sectionRefs.current[`section::${key}`] = el; }}
          >
            <SectionHeader id={domId} label={label} Icon={Icon} chars={text.length} />
            <div className="mt-1">
              {renderSectionContent(key, text, globalSearch, ultraRobust, tables)}
            </div>
          </section>
        );
      })}

    </div>
  );
};
