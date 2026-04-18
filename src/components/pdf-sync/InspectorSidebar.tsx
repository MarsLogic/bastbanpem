import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, FileText, Users2,
  Building2, ShoppingCart, CreditCard, BookOpen,
  FileSearch, Paperclip, TableIcon, Hash,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavItemId =
  | { type: 'section'; key: string }
  | { type: 'table';   index: number };

export type NavItemIdString = string; // serialized form used as React key + active check

function serializeId(id: NavItemId): NavItemIdString {
  if (typeof id === 'object' && id.type === 'section') return `section::${id.key}`;
  if (typeof id === 'object' && id.type === 'table')   return `table::${id.index}`;
  return '';
}

export function parseNavId(s: NavItemIdString): NavItemId {
  if (s.startsWith('section::')) return { type: 'section', key: s.replace('section::', '') };
  if (s.startsWith('table::'))   return { type: 'table',   index: parseInt(s.replace('table::', ''), 10) };
  return { type: 'section', key: 'HEADER' };
}

export interface SidebarSection {
  key:     string;
  label:   string;
  chars:   number;
}

export interface SidebarTable {
  index:  number;
  page?:  number;
  method: string;
  rows:   number;
}

interface InspectorSidebarProps {
  activeId:        NavItemIdString;
  onSelect:        (id: NavItemIdString) => void;
  sections:        SidebarSection[];
  tables:          SidebarTable[];
  hasIntel:        boolean;
}

// ─── Section icon map ─────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  HEADER:               <FileText     className="h-3.5 w-3.5 shrink-0" />,
  PEMESAN:              <Users2       className="h-3.5 w-3.5 shrink-0" />,
  PENYEDIA:             <Building2    className="h-3.5 w-3.5 shrink-0" />,
  RINGKASAN_PESANAN:    <ShoppingCart className="h-3.5 w-3.5 shrink-0" />,
  RINGKASAN_PEMBAYARAN: <CreditCard   className="h-3.5 w-3.5 shrink-0" />,
  SSUK:                 <BookOpen     className="h-3.5 w-3.5 shrink-0" />,
  SSKK:                 <FileSearch   className="h-3.5 w-3.5 shrink-0" />,
  LAMPIRAN:             <Paperclip    className="h-3.5 w-3.5 shrink-0" />,
};

const SECTION_LABELS: Record<string, string> = {
  HEADER:               'Header',
  PEMESAN:              'Pemesan',
  PENYEDIA:             'Penyedia',
  RINGKASAN_PESANAN:    'Ringkasan Pesanan',
  RINGKASAN_PEMBAYARAN: 'Ringkasan Pembayaran',
  SSUK:                 'SSUK',
  SSKK:                 'SSKK',
  LAMPIRAN:             'Lampiran',
};

function fmtChars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

// ─── Group header ─────────────────────────────────────────────────────────────

const GroupHeader: React.FC<{ label: string; count?: number }> = ({ label, count }) => (
  <div className="px-3 py-1.5 flex items-center gap-2">
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    {count !== undefined && count > 0 && (
      <span className="text-[9px] font-bold text-slate-300 tabular-nums">{count}</span>
    )}
  </div>
);

// ─── Nav item ─────────────────────────────────────────────────────────────────

const NavItem: React.FC<{
  id:       NavItemIdString;
  active:   boolean;
  icon:     React.ReactNode;
  label:    string;
  meta?:    string;
  badge?:   number;
  disabled?: boolean;
  onClick:  () => void;
}> = ({ id, active, icon, label, meta, badge, disabled = false, onClick }) => {
  const ref = useRef<HTMLButtonElement>(null);
  
  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [active]);

  return (
  <button
    ref={ref}
    disabled={disabled}
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                group rounded-none
                ${active
                  ? 'bg-slate-200 border-r-2 border-slate-800 text-slate-900'
                  : disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
  >
    <span className={active ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-600'}>
      {icon}
    </span>
    <span className={`flex-1 min-w-0 text-[11px] font-medium leading-tight truncate
                      ${active ? 'font-bold' : ''}`}>
      {label}
    </span>
    {badge !== undefined && badge > 0 && (
      <Badge
        className={`shrink-0 h-4 px-1 text-[8px] font-bold
                    ${active ? 'bg-slate-800 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-600 hover:bg-slate-200'}`}
      >
        {badge}
      </Badge>
    )}
    {meta && !badge && (
      <span className="text-[9px] text-slate-300 font-mono shrink-0 tabular-nums">{meta}</span>
    )}
  </button>
  );
};

// ─── Divider ──────────────────────────────────────────────────────────────────

const Divider = () => <div className="mx-3 my-1 h-px bg-slate-100" />;

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  activeId,
  onSelect,
  sections,
  tables,
  hasIntel,
}) => {
  const [filter, setFilter] = useState('');
  const q = filter.toLowerCase().trim();

  const visibleSections = useMemo(
    () => sections.filter(s => !q || s.label.toLowerCase().includes(q) || s.key.toLowerCase().includes(q)),
    [sections, q],
  );

  const visibleTables = useMemo(
    () => tables.filter(t => !q || `table ${t.index + 1}`.includes(q)),
    [tables, q],
  );

  const showSections = visibleSections.length > 0;
  const showTables   = visibleTables.length > 0;

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 overflow-hidden">
      {/* Filter input */}
      <div className="px-3 py-2.5 border-b border-slate-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
          <Input
            placeholder="Filter..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="h-7 pl-8 text-[11px] bg-slate-50 border-slate-200 focus-visible:ring-slate-300"
          />
        </div>
      </div>

      {/* Nav items — scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">

        {/* Empty state — show hint if no search and no intel */}
        {!q && !hasIntel && (
          <div className="px-3 py-4">
            <p className="text-[10px] text-slate-400 leading-relaxed italic">
              AI Scan pending. Content will appear here after extraction.
            </p>
          </div>
        )}

        {showSections && (
          <>
            <GroupHeader label="Sections" count={visibleSections.length} />
            {visibleSections.map(section => (
              <NavItem
                key={section.key}
                id={serializeId({ type: 'section', key: section.key })}
                active={activeId === serializeId({ type: 'section', key: section.key })}
                icon={SECTION_ICONS[section.key] ?? <Hash className="h-3.5 w-3.5 shrink-0" />}
                label={section.label}
                meta={fmtChars(section.chars)}
                disabled={!hasIntel}
                onClick={() => onSelect(serializeId({ type: 'section', key: section.key }))}
              />
            ))}
          </>
        )}

        {/* TABLES group */}
        {showTables && (
          <>
            <Divider />
            <GroupHeader label="Tables" count={visibleTables.length} />
            {visibleTables.map(table => (
              <NavItem
                key={table.index}
                id={serializeId({ type: 'table', index: table.index })}
                active={activeId === serializeId({ type: 'table', index: table.index })}
                icon={<TableIcon className="h-3.5 w-3.5 shrink-0" />}
                label={`Table ${table.index + 1}`}
                meta={table.page ? `p.${table.page}` : undefined}
                badge={table.rows > 0 ? table.rows : undefined}
                disabled={!hasIntel}
                onClick={() => onSelect(serializeId({ type: 'table', index: table.index }))}
              />
            ))}
          </>
        )}

        {/* Empty state when filter matches nothing */}
        {q && !showSections && !showTables && (
          <p className="px-4 py-6 text-[11px] text-slate-400 italic text-center">
            No items match "{filter}"
          </p>
        )}

      </div>
    </div>
  );
};

export { serializeId };
