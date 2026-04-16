# Document Inspector — Design Spec

**Date:** 2026-04-16  
**Scope:** Sections + Tables viewer redesign within PdfSyncModule [UIUX-005]

---

## Goal

Replace the cramped horizontal-split sections/tables tab UI with a full-width vertical document inspector. Users read their contract data comfortably. Every data type is rendered in the format that makes it easiest to read — not a generic text dump.

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTRACT HEADER STRIP (sticky, full width)                     │
│  [Order ID] [v2.5-ULTRA] [Intel Loaded] [Rp total] [SCAN btn]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PDF VIEWER — full width, natural A4 height                     │
│  Zoom controls | Page nav at bottom                             │
│  (user scrolls past this to reach data)                         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ↓ scroll                                                         │
├──────────────────────┬──────────────────────────────────────────┤
│  SIDEBAR NAV (200px) │  CONTENT PANE (remaining width, sticky)  │
│  sticky while        │                                           │
│  scrolling content   │  Section-aware rendered content          │
│                      │                                           │
│  🔍 filter...        │                                           │
│  ─────────────       │                                           │
│  CONTRACT INTEL      │                                           │
│   ● Overview         │                                           │
│   ● Recipients [N]   │                                           │
│  ─────────────       │                                           │
│  SECTIONS            │                                           │
│   ● Header           │                                           │
│   ● Pemesan          │                                           │
│   ● Penyedia         │                                           │
│   ● Ringkasan…       │                                           │
│   ● SSUK             │                                           │
│   ● SSKK             │                                           │
│   ● Lampiran         │                                           │
│  ─────────────       │                                           │
│  TABLES              │                                           │
│   ● Table 1 [p.3]   │                                           │
│   ● Table 2 [p.7]   │                                           │
└──────────────────────┴──────────────────────────────────────────┘
```

### Scroll behavior
- Header strip: `sticky top-0 z-50` — always visible
- PDF viewer: normal flow, full width, no height constraint
- Below PDF: sidebar + content pane sit inside a `flex` row
- Sidebar: `sticky top-[header-height]` so it stays visible while scrolling through long content
- Content pane: scrolls naturally

---

## Sidebar Navigation

**Structure:**
```
🔍 [filter input]
─────────────────
CONTRACT INTEL
  ○ Overview
  ○ Recipients       [10]
─────────────────
SECTIONS             [7]
  ○ Header           113 chars
  ○ Pemesan          487 chars
  ○ Penyedia         259 chars
  ○ Ringkasan Pesanan
  ○ Ringkasan Pembayaran
  ○ SSUK             58.4k chars
  ○ SSKK
  ○ Lampiran
─────────────────
TABLES               [2]
  ○ Table 1  p.3  structured
  ○ Table 2  p.7  block
```

**Behavior:**
- Filter input narrows the list in real time (matches section name substring)
- Active item highlighted with left-border accent + background
- Section char-count shown as secondary text (gives user a sense of size before clicking)
- Table items show page number + method badge
- Groups always visible (Contract Intel / Sections / Tables), only items filter
- No nested tabs anywhere — sidebar is the only navigation

---

## Section-Aware Content Renderers

Each section name maps to a rendering strategy. Unknown sections fall back to smart auto-detection.

### Strategy Map

| Section key | Renderer | Rationale |
|---|---|---|
| `HEADER` | `KeyValueRenderer` | Structured key:value pairs |
| `PEMESAN` | `KeyValueRenderer` | Identity fields |
| `PENYEDIA` | `KeyValueRenderer` | Vendor identity fields |
| `RINGKASAN_PESANAN` | `MixedRenderer` | Prose + product table inline |
| `RINGKASAN_PEMBAYARAN` | `MixedRenderer` | Prose + payment table inline |
| `SSUK` | `LegalAccordionRenderer` | Long legal prose, parsed by Pasal |
| `SSKK` | `LegalAccordionRenderer` | Long legal prose, parsed by Pasal |
| `LAMPIRAN` | `DataTableRenderer` | Pure tables |
| Unknown/new | `AutoRenderer` | Heuristic detection |

### Renderer Specs

#### `KeyValueRenderer`
- Parses `Key\n: Value` or `Key : Value` patterns from section text
- Renders as a responsive card grid (2–3 columns)
- Each card: label in muted uppercase tiny text, value in readable bold text
- Empty values shown as `—` (not hidden)
- Falls back to `ProseRenderer` if no key-value pairs detected

#### `MixedRenderer`
- Splits text into prose blocks and table blocks
- Table detection: consecutive lines where ≥2 lines contain the same column-separator pattern (whitespace alignment or `|`)
- Renders in document order: prose → DataTable → prose → DataTable
- DataTable: sortable columns, sticky header, horizontal scroll for wide tables
- Prose: formatted paragraphs, indentation preserved, numbers highlighted

#### `LegalAccordionRenderer`
- Parses articles by `Pasal \d+` or numbered clause pattern
- Each article = one collapsible accordion item
- Accordion header shows article number + first line of content
- Full-text search bar at top — highlights matches across all articles, auto-expands matching articles
- All collapsed by default (58k chars of SSUK is unreadable if fully open)
- "Expand all / Collapse all" toggle

#### `DataTableRenderer`
- Full-width DataTable with sticky header row
- Sortable columns (click header)
- Horizontal scroll if columns overflow
- Broken/empty cells shown as `—` not blank (never crash on missing data)
- Row count badge in section header
- Column width auto-fit (min 80px, max 300px)
- If table has 0 rows but headers exist → show "No data rows extracted" with headers visible
- If table has 0 headers → show raw block rendering as monospace grid

#### `AutoRenderer` (fallback for unknown sections)
- Counts lines that look tabular (contain multiple tab/pipe separators)
- If >40% of lines look tabular → `DataTableRenderer` (attempt to parse columns)
- If text contains `Pasal` → `LegalAccordionRenderer`  
- If text has `\n:` patterns → `KeyValueRenderer`
- Otherwise → `ProseRenderer`: preserves line breaks, highlights Rp amounts in green, highlights dates in blue, monospace for codes/IDs

---

## Tables Tab (Extracted Tables)

When user selects a Table item from sidebar:

- Full-width `DataTableRenderer`
- Table metadata shown in header: page number, extraction method (structured/block), row + column count
- For `block_parsing` method: attempt column alignment detection; if it fails, render as monospace grid with copy button
- Search/filter row above table
- Pagination: 50 rows per page for large tables

---

## Full-Text Search (Global)

- Each section sidebar item has its char count visible
- Content pane search bar (appears at top of content pane for all text-based sections)
- For `LegalAccordionRenderer`: search automatically expands matching articles
- For `KeyValueRenderer`: highlights matching keys and values
- For `ProseRenderer`: standard text highlight

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Section extracted but empty | Sidebar item shown with `(empty)` tag, content shows "No content extracted for this section" |
| PDF has no sections yet (no AI scan) | Sidebar shows Overview + Recipients only, sections group shows "Run AI Scan to extract sections" |
| Table has mismatched row lengths | Shorter rows padded with `—` cells, never crash |
| 0 tables extracted | Tables group hidden from sidebar |
| Section text is only whitespace | Treated as empty |
| Unknown section key from future PDFs | Auto-detected renderer applied |
| SSUK/SSKK has no Pasal pattern | Falls back to ProseRenderer with search |

---

## Files

| File | Action | Responsibility |
|---|---|---|
| `src/components/PdfSyncModule.tsx` | Modify | New vertical scroll layout, unified sidebar |
| `src/components/pdf-sync/InspectorSidebar.tsx` | **Create** | Unified sidebar nav (all groups, filter input) |
| `src/components/pdf-sync/renderers/KeyValueRenderer.tsx` | **Create** | Key-value card grid |
| `src/components/pdf-sync/renderers/MixedRenderer.tsx` | **Create** | Mixed prose+table inline |
| `src/components/pdf-sync/renderers/LegalAccordionRenderer.tsx` | **Create** | Pasal-based accordion with search |
| `src/components/pdf-sync/renderers/DataTableRenderer.tsx` | **Create** | Full-width sortable DataTable |
| `src/components/pdf-sync/renderers/ProseRenderer.tsx` | **Create** | Formatted prose with highlights |
| `src/components/pdf-sync/renderers/AutoRenderer.tsx` | **Create** | Heuristic dispatcher |
| `src/components/pdf-sync/SectionViewer.tsx` | **Rewrite** | Thin router — picks renderer by section key |
| `src/components/pdf-sync/TableViewer.tsx` | **Rewrite** | Delegates to DataTableRenderer |

---

## Non-Goals (YAGNI)
- Editing section text in place
- Exporting individual sections to PDF
- Drag-to-reorder sections
- Annotations or comments
