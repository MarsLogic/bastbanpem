import React, { useRef, useEffect, useState, useMemo, useDeferredValue } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Search, Hash, Table as TableIcon, X, ChevronUp, ChevronDown } from 'lucide-react';
import {
  FileText, Users2, Building2, ShoppingCart, CreditCard,
  BookOpen, FileSearch, Paperclip,
} from 'lucide-react';

import { KeyValueRenderer }         from './renderers/KeyValueRenderer';
import { ClauseRenderer }           from './renderers/ClauseRenderer';
import { FinancialSummaryRenderer } from './renderers/FinancialSummaryRenderer';
import { OrderSummaryRenderer }     from './renderers/OrderSummaryRenderer';
import { DataTableRenderer }        from './renderers/DataTableRenderer';
import { AutoRenderer }             from './renderers/AutoRenderer';
import { SSKKRenderer }             from './renderers/SSKKRenderer';
import { serializeId, NavItemIdString } from './InspectorSidebar';

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
  sskkClauses?:    any[]; // Pre-parsed structured clauses
}

// ─── Section metadata ─────────────────────────────────────────────────────────

export const SECTION_ORDER = [
  'HEADER', 'PEMESAN', 'PENYEDIA',
  'RINGKASAN_PESANAN', 'RINGKASAN_PEMBAYARAN',
  'SSUK', 'SSKK', 'LAMPIRAN',
];

// Sections whose data is already shown elsewhere — skip rendering
const HIDDEN_SECTIONS = new Set(['_DELIVERY_BOUNDARY', 'PEMESAN', 'PENYEDIA']);

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

function renderSectionContent(
  key: string, 
  text: string, 
  searchQuery: string, 
  ultraRobust: any, 
  tables: RawTable[],
  sskkClauses?: any[]
) {
  switch (key) {
    case 'HEADER':
      return (
        <div className="flex flex-col gap-4">
          <AutoRenderer text={text} searchQuery={searchQuery} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ultraRobust?.sections?.PEMESAN && ultraRobust.sections.PEMESAN !== text && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">I. Pemesan (Buyer)</span>
                </div>
                <KeyValueRenderer text={ultraRobust.sections.PEMESAN} searchQuery={searchQuery} />
              </div>
            )}
            {ultraRobust?.sections?.PENYEDIA && ultraRobust.sections.PENYEDIA !== text && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">II. Penyedia (Vendor)</span>
                </div>
                <KeyValueRenderer text={ultraRobust.sections.PENYEDIA} searchQuery={searchQuery} />
              </div>
            )}
          </div>
        </div>
      );

    case 'RINGKASAN_PESANAN':
      return <OrderSummaryRenderer text={text} allSections={ultraRobust?.sections} searchQuery={searchQuery} />;

    case 'RINGKASAN_PEMBAYARAN':
      return (
        <FinancialSummaryRenderer 
          text={text} 
          ledger={ultraRobust?.shipment_ledger}
          financials={ultraRobust?.financials}
          searchQuery={searchQuery}
        />
      );

    case 'SSKK':
      // [PHASE 4] Prioritize structural logic over raw text parsing
      if (sskkClauses && sskkClauses.length > 0) {
        return <SSKKRenderer clauses={sskkClauses} searchQuery={searchQuery} />;
      }
      return <ClauseRenderer text={text} searchQuery={searchQuery} />;

    case 'SSUK':
      return <ClauseRenderer text={text} searchQuery={searchQuery} />;

    case 'LAMPIRAN':
      return <AutoRenderer text={text} searchQuery={searchQuery || undefined} />;

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
  sskkClauses,
}) => {
  const [globalSearch, setGlobalSearch] = useState('');
  const deferredSearch = useDeferredValue(globalSearch);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  const onActiveChangeRef = useRef(onActiveChange);
  useEffect(() => { onActiveChangeRef.current = onActiveChange; }, [onActiveChange]);

  const lastJumpIdRef = useRef<string>('');
  const lastJumpTimeRef = useRef<number>(0);

  // 1. Search Logic: Calculate occurrences & Handle "Auto-Reveal" with Loop Protection
  useEffect(() => {
    // Immediate reset if search is too short or empty
    if (!deferredSearch.trim() || deferredSearch.trim().length < 2) {
      setMatchCount(0);
      setCurrentMatchIdx(0);
      return;
    }

    const lowerQ = deferredSearch.toLowerCase().trim();
    let total = 0;
    const matchingSectionKeys: string[] = [];
    const MAX_TOTAL_MATCHES = 1000;

    for (const [key, text] of Object.entries(sections)) {
      if (total >= MAX_TOTAL_MATCHES) break;
      const lowerText = text.toLowerCase();
      let pos = lowerText.indexOf(lowerQ);
      let sectionMatches = 0;
      while (pos !== -1 && total < MAX_TOTAL_MATCHES) {
        total++;
        sectionMatches++;
        pos = lowerText.indexOf(lowerQ, pos + lowerQ.length);
      }
      if (sectionMatches > 0) matchingSectionKeys.push(key);
    }

    setMatchCount(total);

    // Auto-Reveal: Jump to first match with strict cooldown to prevent re-render loops
    if (matchingSectionKeys.length > 0) {
      const firstKey = matchingSectionKeys[0];
      const targetId = serializeId({ type: 'section', key: firstKey });
      
      const now = Date.now();
      const isNewTarget = targetId !== lastJumpIdRef.current;
      const cooldownElapsed = (now - lastJumpTimeRef.current) > 1500;

      // Logic: Only jump if query is 3+ chars, target is new, and we haven't jumped recently
      if (deferredSearch.trim().length >= 3 && isNewTarget && cooldownElapsed) {
        const t = setTimeout(() => {
          // Double check target vs current scroll position to avoid redundant jumps
          if (internalActiveIdRef.current !== targetId) {
            onActiveChangeRef.current?.(targetId);
            lastJumpIdRef.current = targetId;
            lastJumpTimeRef.current = Date.now();
          }
        }, 800);
        return () => clearTimeout(t);
      }
    }
  }, [deferredSearch, sections]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!globalSearch.trim()) return;

      const lowerQ = globalSearch.toLowerCase().trim();
      const matchingSectionKeys = Object.entries(sections)
        .filter(([_, text]) => text.toLowerCase().includes(lowerQ))
        .map(([key]) => key);

      if (matchingSectionKeys.length === 0) return;

      // Cycle to next matching section
      const nextIdx = (currentMatchIdx + 1) % matchingSectionKeys.length;
      setCurrentMatchIdx(nextIdx);
      onActiveChange?.(serializeId({ type: 'section', key: matchingSectionKeys[nextIdx] }));
    }
  };
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
        // Vertical offset for sticky header
        const yOffset = -60;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
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
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center p-16 text-center"
      >
        <p className="text-[12px] text-slate-400 italic">
          No content extracted yet. Run PDF Scan to populate sections and tables.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      ref={containerRef} 
      className="max-w-4xl mx-auto px-6 pb-16"
    >

      {/* Global search */}
      <div className="sticky top-0 z-20 bg-white pt-4 pb-3 border-b border-slate-100 mb-2">
        <form 
          onSubmit={e => e.preventDefault()}
          action="javascript:void(0)"
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search across all sections and tables…"
            value={globalSearch}
            onChange={e => {
                setGlobalSearch(e.target.value);
                setCurrentMatchIdx(0); // Reset cycling on new type
            }}
            onKeyDown={handleSearchKeyDown}
            className="h-9 pl-9 pr-24 text-[12px] bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
          />
          <div className="absolute right-9 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-2">
            {globalSearch && (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {matchCount} {matchCount === 1 ? 'match' : 'matches'}
              </span>
            )}
          </div>
          {globalSearch && (
            <button
              type="button"
              onClick={() => setGlobalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
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
              {renderSectionContent(key, text, globalSearch, ultraRobust, tables, sskkClauses)}
            </div>
          </section>
        );
      })}

      {/* ── Tables ── */}
      {tables.map((table, idx) => (
        <section
          key={`table-${idx}`}
          data-nav-id={`table::${idx}`}
          ref={el => { sectionRefs.current[`table::${idx}`] = el; }}
        >
          <SectionHeader 
            id={`table-${idx}`} 
            label={`Table ${idx + 1}`} 
            Icon={TableIcon} 
            chars={table.rows.length * 10} // Approximation
          />
          <div className="mt-1">
            <DataTableRenderer 
              table={table} 
              showMeta={true} 
              searchQuery={globalSearch || undefined} 
            />
          </div>
        </section>
      ))}

    </motion.div>
  );
};
