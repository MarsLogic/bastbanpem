# BAST-Automator Design System

**Single source of truth for all UI components, styling, branding, and visual consistency across Claude Code, Claude CLI, Gemini CLI, and Antigravity AI.**

This file ensures 100% consistency when creating, editing, or modifying ANY component—from toast notifications to complex tables.

---

## Color Palette

### Primary Colors
| Name | Hex | Use Case |
|------|-----|----------|
| **White** | `#ffffff` | Backgrounds, text on dark backgrounds |
| **Light Grey** | `#f3f4f6` | Secondary backgrounds, hover states |
| **Grey** | `#6b7280` | Borders, secondary text |
| **Dark Grey** | `#374151` | Primary backgrounds, primary text |
| **Very Dark Grey** | `#1f2937` | Prominent backgrounds, dark text |
| **Black** | `#111827` | Darkest accents, borders |

### Semantic Color Mapping
| Element | Background | Text | Border |
|---------|-----------|------|--------|
| **Success** (✓) | Dark Grey `#374151` | White `#ffffff` | Very Dark Grey `#1f2937` |
| **Info** (ℹ) | Grey `#6b7280` | White `#ffffff` | Dark Grey `#4b5563` |
| **Warning** (⚠) | Light Grey `#f3f4f6` | Dark Grey `#374151` | Grey `#d1d5db` |
| **Error** (✕) | Very Dark Grey `#1f2937` | White `#ffffff` | Black `#111827` |

---

## Typography

### Font Families
```css
--font-sans: "Geist Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
--font-heading: var(--font-sans);
```

### Text Sizes (Tailwind scale)
- **Headings**: `text-sm` to `text-2xl` (font-black/bold)
- **Body**: `text-[10px]` to `text-base`
- **Captions**: `text-[9px]` to `text-xs`
- **Monospace**: `font-mono` for technical data

### Font Weights
- **Black/Bold**: Headings, labels, emphasis
- **Normal**: Body text
- **Medium**: Secondary labels

---

## Icon System

**Library**: Lucide React (`lucide-react`)

### Common Icons
```typescript
import {
  FileUp,           // Upload actions
  Zap,             // Scan/activation
  LayoutDashboard, // Navigation/overview
  FileText,        // Documents/PDF
  AlertCircle,     // Warnings
  RefreshCw,       // Loading/refresh
  ChevronLeft,     // Navigation
  CircleCheckIcon, // Success
  InfoIcon,        // Information
  TriangleAlertIcon, // Warning
  OctagonXIcon,    // Error
  Loader2Icon,     // Loading spinner
} from 'lucide-react';
```

**Size Convention**: 
- Icons: `h-4 w-4` (small), `h-5 w-5` (medium), `h-10 w-10` (large)
- Spinner: `animate-spin`

---

## Component Patterns

### Buttons

**Primary Button** (Dark background)
```typescript
<Button className="bg-slate-900 hover:bg-black text-white px-8 rounded-full shadow-lg hover:scale-105 transition-all">
  <Icon className="mr-2 h-5 w-5" /> Action
</Button>
```

**Secondary Button** (Outline)
```typescript
<Button variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50">
  <Icon className="mr-2 h-3.5 w-3.5" /> Action
</Button>
```

**States**:
- Hover: `hover:bg-black`, `hover:scale-105`, `transition-all`
- Disabled: `disabled:opacity-30`, `disabled:cursor-not-allowed`
- Loading: Show `Loader2` icon with `animate-spin`

### Toast Notifications

**Pattern**:
```typescript
toast.success('Message', {
  style: {
    backgroundColor: '#374151',  // Dark grey
    color: '#ffffff',            // White
    border: '1px solid #1f2937', // Very dark grey
  },
});
```

**Types**:
- `toast.success()` → Dark Grey bg
- `toast.info()` → Grey bg
- `toast.warning()` → Light Grey bg
- `toast.error()` → Very Dark Grey bg

### Tables

**Row Styling**:
```typescript
<tr className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
  <td className="px-3 py-2.5 text-[10px] text-slate-600">{data}</td>
</tr>
```

**Header Styling**:
```typescript
<th className="px-3 py-2.5 text-[10px] font-black uppercase text-slate-500 bg-slate-50 border-b border-slate-200">
  Column
</th>
```

**Alternating Rows**:
```typescript
className={`... ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
```

### Badges

**Primary Badge**:
```typescript
<Badge variant="outline" className="text-slate-500 border-slate-300 text-[9px] font-black uppercase">
  Label
</Badge>
```

**Scanned State**:
```typescript
<Badge variant="outline" className="text-[8px] h-4 text-slate-500 border-slate-300">
  Scanned
</Badge>
```

### Scrollable Content

**Scroll Area**:
```typescript
<div className="flex-1 overflow-y-auto bg-white">
  {/* Scrollable content */}
</div>
```

**Sticky Headers**:
```typescript
<div className="sticky top-0 bg-white border-b border-slate-200 z-10">
  {/* Header */}
</div>
```

### Highlight Sections

**Active/Highlight**:
```typescript
className={`... ${active ? 'bg-slate-100 border-l-2 border-slate-900' : ''}`}
```

**Hover State**:
```typescript
className="... hover:bg-slate-50 transition-colors"
```

---

## Layout Patterns

### Vertical Stack (Flex Column)
```typescript
<div className="flex flex-col gap-4">
  {/* Stacked items */}
</div>
```

### Horizontal Stack (Flex Row)
```typescript
<div className="flex items-center gap-2">
  {/* Aligned items */}
</div>
```

### Grid
```typescript
<div className="grid gap-3">
  {/* Grid items */}
</div>
```

### Sidebar + Content Layout
```typescript
<div className="flex border-t border-slate-200">
  <div className="w-56 shrink-0 border-r overflow-y-auto">Sidebar</div>
  <div className="flex-1">Content</div>
</div>
```

---

## Spacing & Sizing

### Padding (Tailwind)
- `p-1` = 4px
- `p-2` = 8px
- `p-3` = 12px
- `p-4` = 16px
- `p-6` = 24px
- `p-8` = 32px

### Gap (Between items)
- `gap-1` = 4px
- `gap-2` = 8px
- `gap-3` = 12px
- `gap-4` = 16px
- `gap-6` = 24px

### Border Radius
- `rounded` = 4px
- `rounded-lg` = 8px
- `rounded-xl` = 12px
- `rounded-full` = 50% (circles/pills)

---

## States & Transitions

### Hover
```typescript
className="... hover:bg-slate-100 transition-colors"
```

### Focus
```typescript
className="... focus:outline-none focus:ring-2 focus:ring-slate-900"
```

### Disabled
```typescript
className="... disabled:opacity-30 disabled:cursor-not-allowed"
```

### Loading
```typescript
className="... animate-spin"
```

### Transitions
```typescript
className="... transition-colors transition-all duration-200"
```

---

## Implementation Checklist

When creating or editing ANY component:

- [ ] Colors from palette (no arbitrary colors)
- [ ] Icons from lucide-react
- [ ] Typography matches scale
- [ ] Spacing uses gap/padding system
- [ ] Hover/disabled states defined
- [ ] Toast messages use semantic colors
- [ ] Buttons follow patterns
- [ ] Tables use alternating rows
- [ ] Scrollable areas have sticky headers
- [ ] Responsive & accessible (aria labels)
- [ ] Lucide icons use consistent sizing
- [ ] No hardcoded hex colors (use palette)

---

## Files Using This System

- `src/components/PdfSyncModule.tsx` ✓
- `src/components/ui/sonner.tsx` ✓ (toast config)
- `src/components/ContractDetailView.tsx` (follow pattern)
- `src/components/ContractListView.tsx` (follow pattern)
- `src/components/ExcelWorkbench.tsx` (follow pattern)
- All new components in `src/components/pdf-sync/` (follow pattern)

---

**Last Updated**: 2026-04-17  
**Version**: 1.0  
**Status**: ACTIVE — Use for all new component work
