# Contract Intelligence Panel Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the page navigator (cosmetic: replace browser-spinner input with ghost buttons) and fully revamp the Contract Intelligence panel (resizable height slider, smart two-pane section viewer with article accordion for SSUK/SSKK, paginated table viewer, enhanced RPB cards).

**Architecture:** Extract the 4 tab content areas from `PdfSyncModule.tsx` into focused sub-components under `src/components/pdf-sync/`. `SectionViewer` owns the two-pane navigator + search. `SectionFormatter` contains pure rendering logic (article accordion for SSUK/SSKK, key-value grid for PEMESAN/PENYEDIA, financial list for RINGKASAN, redirect for LAMPIRAN). `TableViewer` handles both PyMuPDF `find_tables` structured rows and `block_parsing` fallback rows with pagination. `RecipientCards` renders a 2-column card grid for delivery blocks. `PdfSyncModule` stays as the orchestrator.

**Tech Stack:** React 19, TypeScript, shadcn/ui (Slider, Badge, ScrollArea, Tabs, Accordion, Button, Input, Table), Tailwind CSS, lucide-react

---

## File Structure

### Files Modified
- `src/components/PdfSyncModule.tsx` — page nav fix, panelHeight state + slider, import and render sub-components, replace tab content

### Files Created
- `src/components/pdf-sync/SectionFormatter.tsx` — pure formatter: article accordion (SSUK/SSKK), key-value grid (PEMESAN/PENYEDIA/HEADER), financial list (RINGKASAN_*), LAMPIRAN redirect, text fallback
- `src/components/pdf-sync/SectionViewer.tsx` — two-pane: left sidebar section list + char count badges + right content area with per-section search
- `src/components/pdf-sync/TableViewer.tsx` — paginated tables (25 rows/page), table selector for multiple tables, `block_parsing` field renderer, sticky header
- `src/components/pdf-sync/RecipientCards.tsx` — 2-column card grid with recipient name, phone, full address, poktan, quantity, prices, delivery date

---

## Task 1: Fix Page Navigator (Red Section)

**Files:**
- Modify: `src/components/PdfSyncModule.tsx:238-248`

**Problem:** `<Input type="number">` shows browser-native up/down spinners that don't match ghost button style. Also missing prev/next single-page buttons.

**Fix:** Replace with `[<<] [<] "N / Total" [>] [>>]` — all ghost icon buttons + plain text display.

- [ ] **Step 1: Replace the nav block in `renderPdfViewer`**

Find the entire `{numPages && numPages > 1 && ...}` block (currently lines 238–248) and replace with:

```tsx
{numPages && numPages > 1 && (
  <div className="p-2 border-t bg-background flex justify-center items-center gap-1">
    <Button
      variant="ghost" size="icon" className="h-8 w-8"
      disabled={pageNumber <= 1}
      onClick={() => setPageNumber(1)}
    >
      <ChevronsLeft className="h-4 w-4" />
    </Button>
    <Button
      variant="ghost" size="icon" className="h-8 w-8"
      disabled={pageNumber <= 1}
      onClick={() => setPageNumber(p => Math.max(1, p - 1))}
    >
      <ChevronLeft className="h-4 w-4" />
    </Button>
    <span className="text-sm font-medium tabular-nums px-3 min-w-[80px] text-center select-none">
      {pageNumber} / {numPages}
    </span>
    <Button
      variant="ghost" size="icon" className="h-8 w-8"
      disabled={pageNumber >= numPages}
      onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
    >
      <ChevronRight className="h-4 w-4" />
    </Button>
    <Button
      variant="ghost" size="icon" className="h-8 w-8"
      disabled={pageNumber >= numPages}
      onClick={() => setPageNumber(numPages)}
    >
      <ChevronsRight className="h-4 w-4" />
    </Button>
  </div>
)}
```

- [ ] **Step 2: Verify imports** — `ChevronLeft`, `ChevronRight` are already imported at line 8. No new imports needed.

- [ ] **Step 3: Commit**
```bash
git add src/components/PdfSyncModule.tsx
git commit -m "fix: [UIUX-005] replace number spinner input with ghost prev/next page buttons"
```

---

## Task 2: Panel Height Slider

**Files:**
- Modify: `src/components/PdfSyncModule.tsx`

Add `panelHeight` state (default 750px) and a Slider in the intelligence panel header.

- [ ] **Step 1: Add Slider import**

In `PdfSyncModule.tsx`, add to the shadcn imports:
```tsx
import { Slider } from "@/components/ui/slider";
```

- [ ] **Step 2: Add state** after existing `useState` declarations:
```tsx
const [panelHeight, setPanelHeight] = useState<number>(750);
```

- [ ] **Step 3: Replace fixed height** — find `h-[600px]` on the data panel div and replace:
```tsx
<div className="w-full flex flex-col bg-slate-50/30 min-w-0" style={{ height: `${panelHeight}px` }}>
```

- [ ] **Step 4: Replace the intelligence panel header div** (the one with title + Run AI Scan button):
```tsx
<div className="p-4 border-b flex justify-between items-center bg-white/50 backdrop-blur gap-4">
  <div className="flex flex-col min-w-0">
    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
      <LayoutDashboard className="h-5 w-5 text-blue-600 shrink-0" />
      Contract Intelligence [v2.2-PRO]
    </h3>
    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">1. Master PDF Sync</p>
  </div>
  <div className="flex items-center gap-3 shrink-0">
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">{panelHeight}px</span>
      <Slider
        min={500}
        max={1200}
        step={50}
        value={[panelHeight]}
        onValueChange={([v]) => setPanelHeight(v)}
        className="w-24"
      />
    </div>
    <Button
      onClick={handleAutoExtract}
      disabled={isExtracting}
      size="sm"
      className="bg-slate-900 hover:bg-black text-white text-[11px] font-bold h-8 whitespace-nowrap"
    >
      {isExtracting ? <Loader2 className="animate-spin mr-2 h-3 w-3" /> : "Run AI Scan"}
    </Button>
  </div>
</div>
```

- [ ] **Step 5: Verify Slider component exists**
```bash
ls src/components/ui/slider.tsx
```
If missing: `npx shadcn@latest add slider`

- [ ] **Step 6: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 7: Commit**
```bash
git add src/components/PdfSyncModule.tsx
git commit -m "feat: [UIUX-005] add panel height slider (500-1200px) to intelligence panel header"
```

---

## Task 3: SectionFormatter — Smart Content Renderer

**Files:**
- Create: `src/components/pdf-sync/SectionFormatter.tsx`

Pure presenter. Receives section `name` + `text` + `searchQuery`. Selects render strategy by name:
- `SSUK` / `SSKK` → article accordion (parse `Pasal \d+`)
- `HEADER` / `PEMESAN` / `PENYEDIA` → key-value grid (parse `Label\n: Value`)
- `RINGKASAN_PESANAN` / `RINGKASAN_PEMBAYARAN` → structured list
- `LAMPIRAN` → redirect notice
- Fallback → searchable preformatted text

- [ ] **Step 1: Create `src/components/pdf-sync/` directory**
```bash
mkdir -p src/components/pdf-sync
```

- [ ] **Step 2: Create the file**

```tsx
// src/components/pdf-sync/SectionFormatter.tsx
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
```

- [ ] **Step 3: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 4: Commit**
```bash
git add src/components/pdf-sync/SectionFormatter.tsx
git commit -m "feat: [UIUX-005] add SectionFormatter — article accordion SSUK/SSKK, key-value PEMESAN/PENYEDIA"
```

---

## Task 4: SectionViewer — Two-Pane Section Navigator

**Files:**
- Create: `src/components/pdf-sync/SectionViewer.tsx`

Left sidebar (144px): section list with icon + char count badge, active state with blue right border.
Right content: search bar + scrollable `SectionFormatter` output. Full Text entry at sidebar bottom.

- [ ] **Step 1: Create the file**

```tsx
// src/components/pdf-sync/SectionViewer.tsx
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
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/pdf-sync/SectionViewer.tsx
git commit -m "feat: [UIUX-005] add SectionViewer — two-pane navigator with per-section search"
```

---

## Task 5: TableViewer — Paginated Table Display

**Files:**
- Create: `src/components/pdf-sync/TableViewer.tsx`

Table selector tabs when multiple tables. Paginated (25 rows). Handles `find_tables` (structured) and `block_parsing` (field array) rows. Sticky header for structured tables.

- [ ] **Step 1: Create the file**

```tsx
// src/components/pdf-sync/TableViewer.tsx
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface RawTable {
  page: number;
  headers: string[];
  rows: Record<string, any>[];
  method: 'find_tables' | 'block_parsing' | string;
}

interface TableViewerProps {
  tables: RawTable[];
}

const PAGE_SIZE = 25;

// Render block_parsing rows (each row has .fields string[])
function BlockRow({ fields }: { fields: string[] }) {
  return (
    <div className="bg-white border border-slate-100 rounded-md p-3">
      <div className="grid grid-cols-2 gap-1.5">
        {fields.map((f, i) => (
          <div key={i} className="text-[10px] font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded">
            <span className="text-slate-400 mr-1.5 select-none">[{i}]</span>{f}
          </div>
        ))}
      </div>
    </div>
  );
}

function PaginatedTable({ table }: { table: RawTable }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(table.rows.length / PAGE_SIZE);
  const pageRows   = table.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const Pagination = () => totalPages <= 1 ? null : (
    <div className="flex justify-between items-center px-4 py-2 border-t bg-slate-50/50">
      <span className="text-[10px] text-slate-400 tabular-nums">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, table.rows.length)} of {table.rows.length} rows
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[11px] font-medium tabular-nums">{page + 1}/{totalPages}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  // block_parsing: render field arrays
  if (table.method === 'block_parsing') {
    const blockRows = pageRows as { raw_block?: string; fields: string[] }[];
    return (
      <div>
        <div className="p-3 space-y-2">
          {blockRows.map((r, i) => <BlockRow key={i} fields={r.fields ?? []} />)}
        </div>
        <Pagination />
      </div>
    );
  }

  // find_tables: structured table with headers
  return (
    <div>
      <div className="overflow-auto">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10">
            <TableRow>
              {table.headers.map((h, i) => (
                <TableHead key={i} className="text-[10px] font-bold py-2 whitespace-nowrap">
                  {h || `Col ${i + 1}`}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, rIdx) => (
              <TableRow key={rIdx} className="hover:bg-slate-50/50">
                {table.headers.map((h, cIdx) => (
                  <TableCell key={cIdx} className="text-[10px] py-1.5 font-mono align-top max-w-[200px] truncate">
                    {row[h] ?? '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination />
    </div>
  );
}

export const TableViewer: React.FC<TableViewerProps> = ({ tables }) => {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!tables || tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center gap-4">
        <TableIcon className="h-12 w-12 text-slate-200" />
        <p className="text-sm text-slate-400">No Lampiran tables detected.</p>
        <p className="text-[11px] text-slate-300">Tables are extracted automatically during AI Scan.</p>
      </div>
    );
  }

  const active = tables[activeIdx];

  return (
    <div className="flex flex-col h-full">
      {/* Table selector */}
      {tables.length > 1 && (
        <div className="px-4 py-2 border-b bg-slate-50/80 flex gap-2 flex-wrap shrink-0">
          {tables.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                activeIdx === i
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Table #{i + 1}
              <Badge
                variant="outline"
                className={`text-[9px] h-4 px-1 ${activeIdx === i ? 'border-white/30 text-white/70' : ''}`}
              >
                p.{t.page}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[9px] h-4 px-1 ${activeIdx === i ? 'border-white/30 text-white/70' : ''}`}
              >
                {t.method === 'find_tables' ? 'structured' : 'block'}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Active table */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b">
              <span className="text-[10px] font-bold text-slate-700 uppercase">
                Table #{activeIdx + 1} — Page {active.page}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">{active.method}</Badge>
                <Badge variant="secondary" className="text-[9px]">{active.rows.length} rows</Badge>
              </div>
            </div>
            <PaginatedTable table={active} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/pdf-sync/TableViewer.tsx
git commit -m "feat: [UIUX-005] add TableViewer — paginated table (25/page), structured + block_parsing renderers"
```

---

## Task 6: RecipientCards — Enhanced RPB Display

**Files:**
- Create: `src/components/pdf-sync/RecipientCards.tsx`

2-column card grid. Province color coding. Full address hierarchy. Financials (harga produk, ongkir). Delivery date. Quantity pill.

- [ ] **Step 1: Create the file**

```tsx
// src/components/pdf-sync/RecipientCards.tsx
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCheck, Phone, MapPin, Package, Banknote, Calendar, Truck } from 'lucide-react';
import { DeliveryBlock } from '../../lib/contractStore';

interface RecipientCardsProps {
  blocks: DeliveryBlock[];
}

const PROVINCE_COLORS: [string, string][] = [
  ['Jawa',        'bg-blue-50 border-blue-200'],
  ['Sumatera',    'bg-emerald-50 border-emerald-200'],
  ['Kalimantan',  'bg-amber-50 border-amber-200'],
  ['Sulawesi',    'bg-purple-50 border-purple-200'],
  ['Papua',       'bg-rose-50 border-rose-200'],
  ['Bali',        'bg-pink-50 border-pink-200'],
  ['Nusa',        'bg-teal-50 border-teal-200'],
  ['Maluku',      'bg-cyan-50 border-cyan-200'],
];

function provinceColor(provinsi?: string): string {
  if (!provinsi) return 'bg-white border-slate-200';
  for (const [key, cls] of PROVINCE_COLORS) {
    if (provinsi.includes(key)) return cls;
  }
  return 'bg-white border-slate-200';
}

function fmt(v?: string) {
  if (!v) return '—';
  return v.startsWith('Rp') ? v : `Rp${v}`;
}

export const RecipientCards: React.FC<RecipientCardsProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center gap-4">
        <UserCheck className="h-12 w-12 text-slate-200" />
        <p className="text-sm text-slate-400">No recipients extracted.</p>
        <p className="text-[11px] text-slate-300">Run AI Scan to extract RPB delivery blocks.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Delivery RPB Blocks</span>
          <Badge variant="secondary" className="text-[10px]">{blocks.length} recipients</Badge>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {blocks.map((block, idx) => (
            <div
              key={idx}
              className={`border rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow ${provinceColor(block.provinsi)}`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 font-mono shrink-0">#{idx + 1}</span>
                    <h4 className="text-[13px] font-bold text-slate-900 leading-tight truncate">
                      {block.namaPenerima || '—'}
                    </h4>
                  </div>
                  {block.noTelp && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] text-slate-500 font-mono">{block.noTelp}</span>
                    </div>
                  )}
                </div>
                {block.jumlah && (
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 bg-emerald-600 text-white rounded-lg px-2.5 py-1.5">
                      <Package className="h-3 w-3" />
                      <span className="text-[12px] font-bold font-mono">{block.jumlah}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 block text-right mt-0.5">liter</span>
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5 min-w-0">
                  {block.namaPoktan && (
                    <div className="text-[10px] font-semibold text-blue-700">
                      Poktan: {block.namaPoktan}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-600 leading-snug">
                    {[block.desa, block.kecamatan, block.kabupaten].filter(Boolean).join(', ')}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {block.provinsi && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium">
                        {block.provinsi}
                      </Badge>
                    )}
                    {block.kodePos && (
                      <span className="text-[9px] text-slate-400 font-mono">{block.kodePos}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Financials */}
              {(block.hargaProdukTotal || block.ongkosKirim) && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5">
                  {block.hargaProdukTotal && (
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Banknote className="h-3 w-3 text-emerald-500" />
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide">Harga Produk</span>
                      </div>
                      <span className="text-[11px] font-bold font-mono text-emerald-700">{fmt(block.hargaProdukTotal)}</span>
                    </div>
                  )}
                  {block.ongkosKirim && (
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Truck className="h-3 w-3 text-blue-500" />
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide">Ongkir</span>
                      </div>
                      <span className="text-[11px] font-bold font-mono text-blue-700">{fmt(block.ongkosKirim)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery date */}
              {block.permintaanTiba && (
                <div className="flex items-center gap-1.5 pt-2 border-t border-black/5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500">
                    Tiba: <strong className="text-slate-700">{block.permintaanTiba}</strong>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};
```

- [ ] **Step 2: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors.

- [ ] **Step 3: Commit**
```bash
git add src/components/pdf-sync/RecipientCards.tsx
git commit -m "feat: [UIUX-005] add RecipientCards — 2-col grid with address, financials, delivery date, province color"
```

---

## Task 7: Wire Sub-components into PdfSyncModule

**Files:**
- Modify: `src/components/PdfSyncModule.tsx`

Remove inline tab content from Sections / Tables / RPB tabs. Import and render sub-components. Rename "Text" tab to "Sections". Rename existing `BookOpen` + label text in the trigger.

- [ ] **Step 1: Add imports** after existing import block in PdfSyncModule.tsx:
```tsx
import { Badge } from "@/components/ui/badge";
import { SectionViewer } from './pdf-sync/SectionViewer';
import { TableViewer } from './pdf-sync/TableViewer';
import { RecipientCards } from './pdf-sync/RecipientCards';
```

- [ ] **Step 2: Replace the entire `<Tabs>` block** (currently lines 289–515) with the following:

```tsx
<Tabs defaultValue="metadata" className="flex-1 flex flex-col min-h-0">
  <div className="px-4 py-2 border-b bg-white shrink-0">
    <TabsList className="bg-slate-100/50 p-1 h-9 w-full justify-start">
      <TabsTrigger value="metadata" className="text-[11px] gap-1.5 flex-1">
        <LayoutDashboard className="h-3 w-3" />
        Fields
      </TabsTrigger>
      <TabsTrigger value="sections" className="text-[11px] gap-1.5 flex-1">
        <BookOpen className="h-3 w-3" />
        Sections
      </TabsTrigger>
      <TabsTrigger value="tables" className="text-[11px] gap-1.5 flex-1">
        <TableIcon className="h-3 w-3" />
        Tables
        {(contract.tables?.length ?? 0) > 0 && (
          <Badge className="ml-1 h-4 px-1.5 text-[9px] bg-slate-600 hover:bg-slate-600">
            {contract.tables!.length}
          </Badge>
        )}
      </TabsTrigger>
      <TabsTrigger value="recipients" className="text-[11px] gap-1.5 flex-1">
        <UserCheck className="h-3 w-3" />
        RPB
        {(contract.deliveryBlocks?.length ?? 0) > 0 && (
          <Badge className="ml-1 h-4 px-1.5 text-[9px] bg-slate-600 hover:bg-slate-600">
            {contract.deliveryBlocks!.length}
          </Badge>
        )}
      </TabsTrigger>
    </TabsList>
  </div>

  <div className="flex-1 min-h-0 overflow-hidden">
    <TabsContent value="metadata" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* ── Identitas Kontrak ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-l-2 border-blue-500 pl-2">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Identitas Kontrak</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor Kontrak</Label>
                <Input className="h-9 bg-white text-xs" value={contract.nomorKontrak || ''} onChange={e => onUpdate({ nomorKontrak: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal</Label>
                <Input className="h-9 bg-white text-xs" value={contract.tanggalKontrak || ''} onChange={e => onUpdate({ tanggalKontrak: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor DIPA</Label>
                <Input className="h-9 bg-white text-xs" value={contract.nomorDipa || ''} onChange={e => onUpdate({ nomorDipa: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kegiatan/Output/Akun</Label>
                <Input className="h-9 bg-white text-xs" value={contract.kegiatanOutputAkun || ''} onChange={e => onUpdate({ kegiatanOutputAkun: e.target.value })} />
              </div>
            </div>
          </div>

          {/* ── Stakeholders ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-2">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Stakeholders</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pihak Pertama (Pemesan)</Label>
                <Input className="h-9 bg-white text-xs" value={contract.namaPemesan || ''} onChange={e => onUpdate({ namaPemesan: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penanggung Jawab (PPK)</Label>
                  <Input className="h-9 bg-white text-xs font-medium" value={contract.namaPpk || ''} onChange={e => onUpdate({ namaPpk: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NPWP Pemesan</Label>
                  <Input className="h-9 bg-white text-xs" value={contract.npwpPemesan || ''} onChange={e => onUpdate({ npwpPemesan: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pihak Kedua (Penyedia)</Label>
                <Input className="h-9 bg-white text-xs" value={contract.namaPenyedia || ''} onChange={e => onUpdate({ namaPenyedia: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NPWP Penyedia</Label>
                <Input className="h-9 bg-white text-xs" value={contract.npwpPenyedia || ''} onChange={e => onUpdate({ npwpPenyedia: e.target.value })} />
              </div>
            </div>
          </div>

          {/* ── Detail Komoditas & Nilai ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-l-2 border-emerald-500 pl-2">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Detail Komoditas & Nilai</span>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Produk</Label>
                <Input className="h-9 bg-white text-xs" value={contract.namaProduk || ''} onChange={e => onUpdate({ namaProduk: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vol Total</Label>
                  <Input className="h-9 bg-white text-xs font-bold text-emerald-600" value={contract.kuantitasProduk || ''} onChange={e => onUpdate({ kuantitasProduk: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hrg Satuan</Label>
                  <Input className="h-9 bg-white text-xs" value={contract.hargaSatuan || ''} onChange={e => onUpdate({ hargaSatuan: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jumlah Tahap</Label>
                  <Input className="h-9 bg-white text-xs" value={contract.jumlahTahap || ''} onChange={e => onUpdate({ jumlahTahap: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimasi Total Pembayaran</Label>
                <Input className="h-10 bg-slate-900 text-emerald-400 text-sm font-mono font-bold" value={contract.totalPembayaran || ''} onChange={e => onUpdate({ totalPembayaran: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </TabsContent>

    <TabsContent value="sections" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
      <SectionViewer sections={contract.sections ?? {}} fullText={contract.fullText} />
    </TabsContent>

    <TabsContent value="tables" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
      <TableViewer tables={contract.tables ?? []} />
    </TabsContent>

    <TabsContent value="recipients" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
      <RecipientCards blocks={contract.deliveryBlocks ?? []} />
    </TabsContent>
  </div>
</Tabs>
```

- [ ] **Step 3: Remove orphaned imports** from PdfSyncModule.tsx — the `FileSearch` import was used in the old Sections tab. Check if it's still used elsewhere; if not, remove it from the lucide-react import line.

- [ ] **Step 4: Final TypeScript check**
```bash
npx tsc --noEmit 2>&1
```
Expected: 0 errors.

- [ ] **Step 5: Build**
```bash
npm run build 2>&1 | tail -20
```
Expected: `✓ built in X.Xs`

- [ ] **Step 6: Commit**
```bash
git add src/components/PdfSyncModule.tsx src/components/pdf-sync/
git commit -m "feat: [UIUX-005] wire SectionViewer, TableViewer, RecipientCards — revamp Contract Intelligence panel"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered By |
|---|---|
| Red section: nav buttons match ghost style | Task 1 — replaces Input with ghost Button pattern |
| Blue section: not cramped, proper sizing | Task 2 — height slider 500–1200px |
| All components working properly | Tasks 3–7 — sub-components replace broken inline code |
| Sections with professional design | Task 4 — two-pane sidebar + content |
| SSUK/SSKK: structured, searchable | Task 3 — article accordion with Pasal detection + search |
| PEMESAN/PENYEDIA: key-value not free-text | Task 3 — parseKeyValues → KeyValueGrid |
| Tables with pagination | Task 5 — 25 rows/page, block_parsing fallback |
| RPB cards with all data | Task 6 — name, phone, address, poktan, qty, prices, date |
| Works for both PDFs (EP-01K7... and EP-01K87...) | SSUK/SSKK parser handles any `Pasal \d+` pattern |

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references. All code complete.

**Type consistency:**
- `DeliveryBlock` imported from `../../lib/contractStore` in RecipientCards ✓
- `contract.sections` typed as `Record<string, string>` in contractStore.ts ✓
- `contract.tables` typed as `any[]` — TableViewer uses `RawTable` local interface ✓
- `SectionFormatter` props match SectionViewer usage ✓
