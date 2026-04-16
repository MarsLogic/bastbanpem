# PDF Intelligence UI/UX Redesign + Full Persistence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the PdfSyncModule into a horizontal split layout (PDF left / Intelligence right), with full SQLite persistence of ultra_robust + tables data so extracted intelligence survives page refreshes.

**Architecture:** Backend extends the `contracts` SQLite table with two new JSON columns (`ultra_robust_json`, `tables_json`). The load endpoint returns the full parsed intelligence. The frontend loads saved data on mount (before the user re-runs AI scan), and the right-panel is redesigned as a command-center: always-visible contract identity strip, plus OVERVIEW / RECIPIENTS / SECTIONS / TABLES tabs. The RECIPIENTS tab replaces the card grid with a dense sortable/filterable table.

**Tech Stack:** FastAPI (SQLite via `db.py`), Pydantic v2, React 19, Zustand, react-pdf, Lucide icons, Tailwind CSS, shadcn/ui

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/db.py` | Modify | Add `ultra_robust_json` + `tables_json` columns via safe ALTER TABLE |
| `backend/services/vault_service.py` | Modify | Accept + persist `ultra_robust` dict and `tables` list; parse on load |
| `backend/api/router.py` | Modify | Update `/contracts/save` body model; update `/contracts/load` response |
| `backend/models.py` | Modify | Add `ContractSaveRequest` model |
| `src/lib/api.ts` | Modify | Update `saveContract`; add `loadContractIntelligence` |
| `src/components/pdf-sync/RecipientTable.tsx` | **Create** | Dense sortable/filterable/paginated recipient table |
| `src/components/pdf-sync/OverviewPanel.tsx` | **Create** | Extraction health score + contract identity + financial reconciliation |
| `src/components/PdfSyncModule.tsx` | **Rewrite** | Horizontal split layout + mount-time DB hydration |

---

## Task 1: DB Schema Migration

**Files:**
- Modify: `backend/db.py`

- [ ] **Step 1: Add safe column migrations in `_init_schema`**

Open `backend/db.py`. After `self.conn.commit()` at the end of `_init_schema`, add:

```python
def _init_schema(self):
    # Enable WAL for 4GB RAM performance
    self.conn.execute("PRAGMA journal_mode=WAL")

    # Contract Table
    self.conn.execute("""
        CREATE TABLE IF NOT EXISTS contracts (
            id TEXT PRIMARY KEY,
            name TEXT,
            target_value REAL,
            status TEXT,
            metadata TEXT
        )
    """)

    # Recipients Table (Elite Lineage)
    self.conn.execute("""
        CREATE TABLE IF NOT EXISTS recipients (
            id TEXT PRIMARY KEY,
            contract_id TEXT,
            nik TEXT,
            raw_data TEXT,
            balanced_data TEXT,
            is_balanced INTEGER DEFAULT 0,
            FOREIGN KEY(contract_id) REFERENCES contracts(id)
        )
    """)
    self.conn.commit()

    # Additive migrations — safe to run on existing DBs
    for ddl in [
        "ALTER TABLE contracts ADD COLUMN ultra_robust_json TEXT",
        "ALTER TABLE contracts ADD COLUMN tables_json TEXT",
    ]:
        try:
            self.conn.execute(ddl)
            self.conn.commit()
        except Exception:
            pass  # Column already exists — safe to ignore
```

- [ ] **Step 2: Verify migration runs without error**

```bash
python -c "from backend.db import db; print('DB OK')"
```

Expected: `DB OK`

- [ ] **Step 3: Commit**

```bash
git add backend/db.py
git commit -m "feat: [DATA-003] Add ultra_robust_json + tables_json columns to contracts table"
```

---

## Task 2: Vault Service — Save and Load Intelligence

**Files:**
- Modify: `backend/services/vault_service.py`

- [ ] **Step 1: Update `save_contract` signature**

Replace the existing `save_contract` static method with:

```python
@staticmethod
def save_contract(
    id: str,
    name: str,
    target_value: float,
    metadata: Optional[ContractMetadata] = None,
    ultra_robust: Optional[dict] = None,
    tables: Optional[list] = None,
):
    meta_json = metadata.model_dump_json() if metadata else "{}"
    ultra_json = json.dumps(ultra_robust, ensure_ascii=False) if ultra_robust is not None else None
    tables_json = json.dumps(tables, ensure_ascii=False) if tables is not None else None
    with db.get_cursor() as cursor:
        cursor.execute(
            """INSERT OR REPLACE INTO contracts
               (id, name, target_value, status, metadata, ultra_robust_json, tables_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (id, name, target_value, "ACTIVE", meta_json, ultra_json, tables_json),
        )
```

- [ ] **Step 2: Update `get_contract` to parse new columns**

Replace the existing `get_contract` static method with:

```python
@staticmethod
def get_contract(id: str) -> Optional[dict]:
    with db.get_cursor() as cursor:
        cursor.execute("SELECT * FROM contracts WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            return None
        result = dict(row)
        # Parse ultra_robust JSON
        ultra_json = result.pop("ultra_robust_json", None)
        result["ultra_robust"] = None
        if ultra_json:
            try:
                result["ultra_robust"] = json.loads(ultra_json)
            except Exception:
                pass
        # Parse tables JSON
        tables_json_val = result.pop("tables_json", None)
        result["tables"] = []
        if tables_json_val:
            try:
                result["tables"] = json.loads(tables_json_val)
            except Exception:
                pass
        return result
```

- [ ] **Step 3: Run existing tests to verify no regression**

```bash
python -m pytest backend/tests/test_pdf_persistence.py::test_persistence_logic -v
```

Expected: `PASSED`

- [ ] **Step 4: Commit**

```bash
git add backend/services/vault_service.py
git commit -m "feat: [DATA-003] Persist + load ultra_robust and tables in vault service"
```

---

## Task 3: Router — Update Save + Load Endpoints

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/api/router.py`

- [ ] **Step 1: Add `ContractSaveRequest` to models.py**

Append to `backend/models.py`:

```python
class ContractSaveRequest(BaseModel):
    rows: List[Any] = []
    metadata: Optional[ContractMetadata] = None
    ultra_robust: Optional[Dict[str, Any]] = None
    tables: List[Dict[str, Any]] = []
```

- [ ] **Step 2: Update `/contracts/save` endpoint in router.py**

Replace the existing `save_contract_data` function:

```python
@router.post("/contracts/save")
async def save_contract_data(
    id: str,
    name: str,
    target_value: float,
    request: ContractSaveRequest,
):
    try:
        vault_service.save_contract(
            id=id,
            name=name,
            target_value=target_value,
            metadata=request.metadata,
            ultra_robust=request.ultra_robust,
            tables=request.tables,
        )
        if request.rows:
            from backend.models import PipelineRow
            pipeline_rows = [PipelineRow(**r) if isinstance(r, dict) else r for r in request.rows]
            vault_service.save_recipients(id, pipeline_rows)
        return {
            "status": "success",
            "message": f"Saved contract '{name}' with {len(request.rows)} recipients.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Also add `ContractSaveRequest` to the import line from backend.models:
```python
from backend.models import (
    KtpResult, ReconciliationResult, AutomationRequest,
    BundleRequest, PipelineRow, ExcelIngestResult, LocationData,
    PdfParseResult, PdfParseRequest, BatchSummary, ContractMetadata,
    ContractSaveRequest
)
```

- [ ] **Step 3: Update `/contracts/load/{contract_id}` endpoint**

Replace the existing `load_contract_data` function:

```python
@router.get("/contracts/load/{contract_id}")
async def load_contract_data(contract_id: str):
    """Retrieve saved contract intelligence from SQLite vault."""
    try:
        contract = vault_service.get_contract(contract_id)
        if not contract:
            raise HTTPException(
                status_code=404,
                detail=f"Contract '{contract_id}' not found in vault",
            )

        # Parse metadata JSON back into typed model
        metadata_obj = None
        raw_metadata = contract.get("metadata")
        if raw_metadata and raw_metadata != "{}":
            try:
                metadata_obj = ContractMetadata.model_validate_json(raw_metadata)
            except Exception:
                pass

        return {
            "status": "success",
            "metadata": metadata_obj.model_dump() if metadata_obj else None,
            "ultra_robust": contract.get("ultra_robust"),
            "tables": contract.get("tables", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 4: Verify backend starts clean**

```bash
python -m uvicorn backend.main:app --reload --port 8000
```

Hit `Ctrl+C` after seeing `Application startup complete.`

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/api/router.py
git commit -m "feat: [UIUX-001] Update save/load endpoints to persist ultra_robust + tables"
```

---

## Task 4: Frontend API Layer

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Update `saveContract` to send ultra_robust + tables**

Replace the existing `saveContract` function:

```typescript
export const saveContract = async (
  id: string,
  name: string,
  targetValue: number,
  metadata: Record<string, any> | null,
  ultraRobust?: Record<string, any> | null,
  tables?: any[],
): Promise<void> => {
  await api.post(
    `/contracts/save?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&target_value=${targetValue}`,
    {
      rows: [],
      metadata: metadata ?? null,
      ultra_robust: ultraRobust ?? null,
      tables: tables ?? [],
    },
  );
};
```

- [ ] **Step 2: Add `loadContractIntelligence` function**

Append after `loadContract`:

```typescript
/**
 * Load saved AI extraction results for a contract from SQLite.
 * Returns null if contract has never been scanned.
 */
export const loadContractIntelligence = async (
  contractId: string,
): Promise<{
  metadata: Record<string, any> | null;
  ultraRobust: Record<string, any> | null;
  tables: any[];
} | null> => {
  try {
    const { data } = await api.get(
      `/contracts/load/${encodeURIComponent(contractId)}`,
    );
    return {
      metadata: data.metadata ?? null,
      ultraRobust: data.ultra_robust ?? null,
      tables: data.tables ?? [],
    };
  } catch (err: any) {
    if (err?.response?.status === 404) return null; // Never scanned
    throw err;
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: [UIUX-001] Add loadContractIntelligence; update saveContract with ultra_robust + tables"
```

---

## Task 5: RecipientTable Component

**Files:**
- Create: `src/components/pdf-sync/RecipientTable.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/pdf-sync/RecipientTable.tsx` with the full content:

```tsx
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Search, Users,
  Banknote, Truck, MapPin, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { ShipmentLedgerItem } from '@/lib/contractStore';

interface RecipientTableProps {
  ledger: ShipmentLedgerItem[];
  grandTotal?: number; // contract total (excl. tax) for reconciliation
}

type SortKey = 'name' | 'group' | 'desa' | 'kabupaten' | 'provinsi' | 'product_total' | 'shipping_total';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3 w-3 text-slate-300" />;
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-blue-500" />
    : <ChevronDown className="h-3 w-3 text-blue-500" />;
}

export const RecipientTable: React.FC<RecipientTableProps> = ({ ledger, grandTotal }) => {
  const [search, setSearch]         = useState('');
  const [province, setProvince]     = useState<string>('__all__');
  const [sortKey, setSortKey]       = useState<SortKey>('shipment_id' as any);
  const [sortDir, setSortDir]       = useState<SortDir>('asc');

  // Collect unique provinces for filter
  const provinces = useMemo(() => {
    const set = new Set<string>();
    ledger.forEach(i => { if (i.destination.provinsi) set.add(i.destination.provinsi); });
    return Array.from(set).sort();
  }, [ledger]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ledger.filter(item => {
      const matchSearch = !q || [
        item.recipient.name,
        item.recipient.group,
        item.destination.desa,
        item.destination.kabupaten,
        item.destination.provinsi,
      ].some(v => v?.toLowerCase().includes(q));
      const matchProv = province === '__all__' || item.destination.provinsi === province;
      return matchSearch && matchProv;
    });
  }, [ledger, search, province]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey as string) {
        case 'name':          va = a.recipient.name ?? '';           vb = b.recipient.name ?? '';           break;
        case 'group':         va = a.recipient.group ?? '';          vb = b.recipient.group ?? '';          break;
        case 'desa':          va = a.destination.desa ?? '';         vb = b.destination.desa ?? '';         break;
        case 'kabupaten':     va = a.destination.kabupaten ?? '';    vb = b.destination.kabupaten ?? '';    break;
        case 'provinsi':      va = a.destination.provinsi ?? '';     vb = b.destination.provinsi ?? '';     break;
        case 'product_total': va = a.costs.product_total;            vb = b.costs.product_total;            break;
        case 'shipping_total':va = a.costs.shipping_total;           vb = b.costs.shipping_total;           break;
        default:              va = a.shipment_id;                    vb = b.shipment_id;                    break;
      }
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'id');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Totals for footer
  const totalProduct  = filtered.reduce((s, i) => s + i.costs.product_total, 0);
  const totalShipping = filtered.reduce((s, i) => s + i.costs.shipping_total, 0);
  const totalCombined = totalProduct + totalShipping;

  // Reconciliation: compare all-ledger product sum vs grandTotal
  const allProduct = ledger.reduce((s, i) => s + i.costs.product_total, 0);
  const isBalanced = grandTotal !== undefined
    ? Math.abs(allProduct - grandTotal) < 5000
    : null;

  const fmt = (n: number) =>
    n === 0 ? '—' : `Rp${n.toLocaleString('id-ID')}`;

  if (!ledger || ledger.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-16 text-center gap-4">
        <Users className="h-10 w-10 text-slate-200" />
        <p className="text-sm font-medium text-slate-500">No recipients extracted.</p>
        <p className="text-[11px] text-slate-400">Run AI Scan to extract the shipment ledger.</p>
      </div>
    );
  }

  const TH = ({ label, col }: { label: string; col: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 cursor-pointer select-none hover:bg-slate-100 whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon col={col} sortKey={sortKey as SortKey} sortDir={sortDir} />
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b bg-white flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search name, group, area..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-[11px] bg-slate-50 border-slate-200"
          />
        </div>
        <Select value={province} onValueChange={setProvince}>
          <SelectTrigger className="h-8 w-[180px] text-[11px] bg-slate-50 border-slate-200">
            <SelectValue placeholder="All Provinces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-[11px]">All Provinces</SelectItem>
            {provinces.map(p => (
              <SelectItem key={p} value={p} className="text-[11px]">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Badge variant="secondary" className="text-[10px] h-6">
            {filtered.length} / {ledger.length} recipients
          </Badge>
          {isBalanced !== null && (
            isBalanced
              ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] h-6 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Balanced
                </Badge>
              : <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] h-6 gap-1">
                  <AlertTriangle className="h-3 w-3" /> Discrepancy
                </Badge>
          )}
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 w-10">#</th>
              <TH label="Nama"     col="name"          />
              <TH label="Poktan"   col="group"         />
              <TH label="Desa"     col="desa"          />
              <TH label="Kab/Kota" col="kabupaten"     />
              <TH label="Provinsi" col="provinsi"      />
              <TH label="Produk"   col="product_total" />
              <TH label="Ongkir"   col="shipping_total"/>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, idx) => (
              <tr
                key={item.shipment_id}
                className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
              >
                <td className="px-3 py-2 font-mono text-slate-400 text-[10px]">{item.shipment_id}</td>
                <td className="px-3 py-2 font-semibold text-slate-800 max-w-[180px]">
                  <div className="truncate" title={item.recipient.name}>{item.recipient.name || '—'}</div>
                  {item.recipient.phone && (
                    <div className="text-[9px] font-mono text-slate-400 mt-0.5">{item.recipient.phone}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-[120px]">
                  <div className="truncate text-blue-700 font-medium" title={item.recipient.group ?? ''}>
                    {item.recipient.group || '—'}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-[120px]">
                  <div className="truncate" title={item.destination.desa ?? ''}>{item.destination.desa || '—'}</div>
                </td>
                <td className="px-3 py-2 text-slate-600 max-w-[130px]">
                  <div className="truncate" title={item.destination.kabupaten ?? ''}>{item.destination.kabupaten || '—'}</div>
                </td>
                <td className="px-3 py-2">
                  {item.destination.provinsi
                    ? <Badge variant="outline" className="text-[9px] h-5 px-1.5 font-medium whitespace-nowrap">{item.destination.provinsi}</Badge>
                    : <span className="text-slate-300">—</span>
                  }
                </td>
                <td className="px-3 py-2 font-mono text-emerald-700 font-medium whitespace-nowrap">
                  {fmt(item.costs.product_total)}
                </td>
                <td className="px-3 py-2 font-mono text-blue-700 font-medium whitespace-nowrap">
                  {fmt(item.costs.shipping_total)}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Sticky footer totals */}
          <tfoot className="sticky bottom-0 bg-slate-900 text-white">
            <tr>
              <td colSpan={6} className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {filtered.length === ledger.length ? 'Total' : `Subtotal (${filtered.length} shown)`}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 font-mono font-black text-emerald-400 whitespace-nowrap text-[11px]">
                <div className="flex items-center gap-1"><Banknote className="h-3 w-3" />{fmt(totalProduct)}</div>
              </td>
              <td className="px-3 py-2.5 font-mono font-black text-blue-400 whitespace-nowrap text-[11px]">
                <div className="flex items-center gap-1"><Truck className="h-3 w-3" />{fmt(totalShipping)}</div>
              </td>
            </tr>
          </tfoot>
        </table>
      </ScrollArea>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pdf-sync/RecipientTable.tsx
git commit -m "feat: [UIUX-005] Add RecipientTable — dense sortable/filterable recipient ledger"
```

---

## Task 6: OverviewPanel Component

**Files:**
- Create: `src/components/pdf-sync/OverviewPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/pdf-sync/OverviewPanel.tsx`:

```tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2, AlertTriangle, XCircle, Banknote, ShieldCheck,
  Activity, FileText, Building2, Users, Package, Scale,
} from 'lucide-react';
import { UltraRobustContract } from '@/lib/contractStore';

interface OverviewPanelProps {
  data: UltraRobustContract;
  nomorKontrak?: string;
  namaPenyedia?: string;
  namaPemesan?: string;
}

/** Count how many key fields were successfully extracted */
function computeExtractionHealth(u: UltraRobustContract): { score: number; total: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [u.contract_header.order_id !== 'UNKNOWN' && !!u.contract_header.order_id, 'Order ID'],
    [!!u.contract_header.timestamp, 'Timestamp'],
    [!!u.contract_header.duration_days, 'Duration'],
    [u.financials.grand_total > 0, 'Grand Total'],
    [!!u.financials.bank_disbursement.account_name, 'Bank Account Name'],
    [!!u.financials.bank_disbursement.account_number, 'Bank Account Number'],
    [!!u.financials.bank_disbursement.bank_name, 'Bank Name'],
    [u.compliance_flags.penalty_rate > 0, 'Penalty Rate'],
    [!!u.compliance_flags.mandatory_label, 'Mandatory Label'],
    [u.shipment_ledger.length > 0, 'Shipment Recipients'],
    [Object.keys(u.technical_specifications).length > 0, 'Technical Specs'],
    [Object.keys(u.sections).length > 0, 'Sections'],
  ];
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  return { score: checks.filter(([ok]) => ok).length, total: checks.length, missing };
}

function HealthBar({ score, total }: { score: number; total: number }) {
  const pct = Math.round((score / total) * 100);
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-black tabular-nums ${pct >= 85 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
        {score}/{total}
      </span>
    </div>
  );
}

function StatRow({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-[12px] font-bold text-slate-800 leading-tight ${mono ? 'font-mono' : ''} ${!value ? 'text-slate-300 italic' : ''}`}>
        {value || 'Not extracted'}
      </span>
    </div>
  );
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  data, nomorKontrak, namaPenyedia, namaPemesan
}) => {
  const { contract_header, financials, compliance_flags, shipment_ledger, technical_specifications } = data;
  const health = computeExtractionHealth(data);

  // Financial reconciliation
  const ledgerSum    = shipment_ledger.reduce((s, i) => s + i.costs.product_total, 0);
  const taxAmount    = financials.tax_logic.total_tax
    || (financials.grand_total * financials.tax_logic.ppn_rate / (1 + financials.tax_logic.ppn_rate));
  const netExpected  = financials.grand_total - taxAmount;
  const discrepancy  = Math.abs(ledgerSum - netExpected);
  const isBalanced   = discrepancy < 5000;

  const fmt = (n: number) => n > 0 ? `Rp${n.toLocaleString('id-ID')}` : '—';
  const fmtPct = (r: number) => `${(r * 100).toFixed(0)}%`;

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-5">

        {/* Extraction Health */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Extraction Health</span>
            </div>
            <Badge className={`text-[10px] h-5 ${health.score === health.total ? 'bg-emerald-500' : health.score >= health.total * 0.7 ? 'bg-amber-500' : 'bg-red-500'}`}>
              {Math.round(health.score / health.total * 100)}%
            </Badge>
          </div>
          <HealthBar score={health.score} total={health.total} />
          {health.missing.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {health.missing.map(m => (
                <span key={m} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono">
                  ✗ {m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Contract Identity */}
        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
            <div className="w-1 h-4 bg-blue-500 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Contract Identity</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <StatRow label="Order ID" value={contract_header.order_id} mono />
            </div>
            <StatRow label="Issued Date" value={contract_header.timestamp} />
            <StatRow label="Duration" value={contract_header.duration_days ? `${contract_header.duration_days} days` : null} />
            <div className="col-span-2 flex items-center gap-2 pt-2 border-t border-slate-50">
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <StatRow label="Penyedia (Vendor)" value={namaPenyedia} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <StatRow label="Pemesan (Purchaser)" value={namaPemesan} />
            </div>
          </div>
        </div>

        {/* Financial Reconciliation */}
        <div className={`p-4 rounded-2xl border shadow-sm space-y-3 ${isBalanced ? 'border-emerald-200 bg-emerald-50/50' : 'border-red-200 bg-red-50/50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Financial Reconciliation</span>
            </div>
            {isBalanced
              ? <Badge className="bg-emerald-500 text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> Balanced</Badge>
              : <Badge className="bg-red-500 text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Discrepancy</Badge>
            }
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-100">
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Grand Total</div>
              <div className="text-[13px] font-black font-mono text-slate-900">{fmt(financials.grand_total)}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">PPN {fmtPct(financials.tax_logic.ppn_rate)} incl.</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100">
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Ledger Sum</div>
              <div className={`text-[13px] font-black font-mono ${isBalanced ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(ledgerSum)}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">{shipment_ledger.length} recipients</div>
            </div>
          </div>
          {!isBalanced && (
            <div className="flex items-center gap-2 p-2 bg-red-100 rounded-lg">
              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-[10px] text-red-700 font-medium">
                Gap: {fmt(discrepancy)} — verify recipient costs
              </span>
            </div>
          )}
        </div>

        {/* Bank Disbursement */}
        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
            <Banknote className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Bank Disbursement</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <StatRow label="Account Holder" value={financials.bank_disbursement.account_name} />
            </div>
            <StatRow label="Account Number" value={financials.bank_disbursement.account_number} mono />
            <StatRow label="Bank" value={financials.bank_disbursement.bank_name} />
          </div>
        </div>

        {/* Compliance */}
        <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-50">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Compliance Flags</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600">Penalty Rate</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {(compliance_flags.penalty_rate * 1000).toFixed(0)}‰/day
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600">Sampling Required</span>
            {compliance_flags.sampling_required
              ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">YES</Badge>
              : <Badge variant="outline" className="text-slate-400 text-[10px]">NO</Badge>
            }
          </div>
          {compliance_flags.mandatory_label && (
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Mandatory Label</span>
              <div className="text-[10px] bg-slate-50 p-2 rounded-lg border font-serif italic text-slate-600">
                "{compliance_flags.mandatory_label}"
              </div>
            </div>
          )}
        </div>

        {/* Technical Specs */}
        {Object.keys(technical_specifications).length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-white/10">
              <Package className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Technical Specifications</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(technical_specifications).map(([k, v]) => (
                <div key={k} className="border-l border-white/10 pl-3">
                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[11px] font-bold text-slate-200 mt-0.5 leading-snug">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </ScrollArea>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pdf-sync/OverviewPanel.tsx
git commit -m "feat: [UIUX-005] Add OverviewPanel with extraction health, reconciliation, compliance"
```

---

## Task 7: PdfSyncModule Complete Redesign

**Files:**
- Rewrite: `src/components/PdfSyncModule.tsx`

**Key behaviors:**
- On mount: load PDF blob from IndexedDB (existing) AND load intelligence from SQLite
- If both exist → show full split layout with populated data without requiring re-scan
- Upload dropzone: full-width centered, shown only when no PDF attached
- Split layout: 45% PDF viewer | 55% intelligence panel
- Header strip: always-visible contract identity row + RUN AI SCAN button
- Tabs: OVERVIEW → RECIPIENTS → SECTIONS → TABLES

- [ ] **Step 1: Rewrite PdfSyncModule.tsx**

Replace the entire file with:

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileUp, Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Zap, LayoutDashboard, Users,
  BookOpen, Table as TableIcon, FileText, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { toast } from 'sonner';

import { ContractData } from '@/lib/contractStore';
import { parsePdfFile, saveContract, loadContractIntelligence } from '@/lib/api';
import { getPdfBlob, savePdfBlob } from '@/lib/pdfStorage';

import { OverviewPanel } from './pdf-sync/OverviewPanel';
import { RecipientTable } from './pdf-sync/RecipientTable';
import { SectionViewer } from './pdf-sync/SectionViewer';
import { TableViewer } from './pdf-sync/TableViewer';

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfSyncModuleProps {
  contract: ContractData;
  onUpdate: (updates: Partial<ContractData>) => void;
}

// ─── Upload Dropzone ─────────────────────────────────────────────────────────

interface UploadDropzoneProps {
  onFile: (file: File) => void;
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({ onFile }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file: File) => {
    if (file.type === 'application/pdf') onFile(file);
    else toast.error('Only PDF files are accepted.');
  };

  return (
    <div
      className={`flex-1 flex items-center justify-center p-8 transition-colors ${dragging ? 'bg-blue-50' : 'bg-slate-50'}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
    >
      <div className={`border-2 border-dashed rounded-3xl p-16 flex flex-col items-center gap-6 max-w-md w-full text-center transition-all ${dragging ? 'border-blue-400 bg-blue-50/50 scale-[1.01]' : 'border-slate-200 bg-white'}`}>
        <div className={`p-5 rounded-full transition-colors ${dragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
          <FileText className={`h-12 w-12 transition-colors ${dragging ? 'text-blue-600' : 'text-slate-400'}`} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Connect Master PDF</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Drop your Surat Pesanan PDF here, or click to browse.<br />
            Previously scanned intelligence loads automatically.
          </p>
        </div>
        <Button
          onClick={() => ref.current?.click()}
          size="lg"
          className="bg-slate-900 hover:bg-black text-white px-8 rounded-full shadow-lg hover:scale-105 transition-all"
        >
          <FileUp className="mr-2 h-5 w-5" /> Select PDF
        </Button>
        <input ref={ref} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      </div>
    </div>
  );
};

// ─── PDF Viewer Pane ──────────────────────────────────────────────────────────

interface PdfViewerPaneProps {
  blobUrl: string;
  pdfName: string;
  loadError: string | null;
}

const PdfViewerPane: React.FC<PdfViewerPaneProps> = ({ blobUrl, pdfName, loadError }) => {
  const [numPages, setNumPages]   = useState<number>(0);
  const [page, setPage]           = useState(1);
  const [scale, setScale]         = useState(1.0);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const goTo = (n: number) => setPage(Math.max(1, Math.min(numPages, n)));

  const commitEdit = () => {
    const n = parseInt(editValue, 10);
    if (!isNaN(n)) goTo(n);
    setIsEditingPage(false);
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <div>
          <p className="text-sm font-bold text-slate-700">PDF Load Error</p>
          <p className="text-[11px] text-slate-400 mt-1">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Toolbar */}
      <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] font-black uppercase tracking-tighter shrink-0">PDF</Badge>
          <span className="text-[10px] text-slate-400 truncate">{pdfName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-500 w-8 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3.0, +(s + 0.2).toFixed(1)))} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* PDF canvas */}
      <div className="flex-1 overflow-auto flex justify-center p-4">
        <Document
          file={blobUrl}
          onLoadSuccess={pdf => { setNumPages(pdf.numPages); setPage(1); }}
          onLoadError={() => {}}
          loading={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-600" /></div>}
        >
          <Page
            pageNumber={page}
            scale={scale}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="shadow-2xl ring-1 ring-white/10"
          />
        </Document>
      </div>

      {/* Page navigation */}
      {numPages > 1 && (
        <div className="bg-slate-900/90 border-t border-white/5 flex justify-center items-center gap-1.5 py-2.5 shrink-0">
          <button onClick={() => goTo(1)} disabled={page <= 1} className="p-1.5 text-slate-500 hover:text-blue-400 disabled:opacity-30 transition-colors rounded hover:bg-blue-500/10">
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button onClick={() => goTo(page - 1)} disabled={page <= 1} className="p-1.5 text-slate-500 hover:text-blue-400 disabled:opacity-30 transition-colors rounded hover:bg-blue-500/10">
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Inline editable page pill */}
          {isEditingPage ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setIsEditingPage(false); }}
              className="w-16 text-center text-[11px] font-black bg-slate-800 border border-blue-500/60 text-blue-300 rounded px-2 py-1 outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditValue(String(page)); setIsEditingPage(true); }}
              className="bg-slate-800 border border-white/10 rounded px-3 py-1 flex items-center gap-1.5 hover:border-blue-500/40 transition-colors"
            >
              <span className="text-[11px] font-black text-blue-400 tabular-nums">{page}</span>
              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">of</span>
              <span className="text-[11px] font-black text-slate-500 tabular-nums">{numPages}</span>
            </button>
          )}

          <button onClick={() => goTo(page + 1)} disabled={page >= numPages} className="p-1.5 text-slate-500 hover:text-blue-400 disabled:opacity-30 transition-colors rounded hover:bg-blue-500/10">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => goTo(numPages)} disabled={page >= numPages} className="p-1.5 text-slate-500 hover:text-blue-400 disabled:opacity-30 transition-colors rounded hover:bg-blue-500/10">
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Contract Header Strip ────────────────────────────────────────────────────

interface HeaderStripProps {
  contract: ContractData;
  isExtracting: boolean;
  isHydrating: boolean;
  onRunScan: () => void;
  onChangePdf: () => void;
}

const ContractHeaderStrip: React.FC<HeaderStripProps> = ({
  contract, isExtracting, isHydrating, onRunScan, onChangePdf,
}) => {
  const orderId    = contract.ultraRobust?.contract_header?.order_id || contract.nomorKontrak || '—';
  const vendor     = contract.namaPenyedia || '—';
  const grandTotal = contract.ultraRobust?.financials?.grand_total;
  const pdfName    = contract.contractPdfPath?.split(/[\\/]/).pop() || '—';
  const hasIntel   = !!contract.ultraRobust;

  return (
    <div className="px-5 py-3 border-b bg-white flex items-center gap-4 shrink-0 flex-wrap">
      {/* Identity */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-100 shrink-0">
          <LayoutDashboard className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-black text-slate-900 truncate max-w-[300px]" title={orderId}>
              {orderId}
            </span>
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[8px] h-4 tracking-tighter uppercase px-1.5">
              v2.5-ULTRA
            </Badge>
            {hasIntel && (
              <Badge variant="outline" className="text-[8px] h-4 text-emerald-600 border-emerald-200 bg-emerald-50">
                Intel Loaded
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{vendor}</span>
            {grandTotal && grandTotal > 0 && (
              <>
                <span className="text-slate-200 text-[10px]">·</span>
                <span className="text-[10px] font-bold font-mono text-slate-600">
                  Rp{grandTotal.toLocaleString('id-ID')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onChangePdf}
          className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
          title={pdfName}
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
        {isHydrating ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-500">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span className="text-[11px] font-bold">Loading...</span>
          </div>
        ) : (
          <Button
            onClick={onRunScan}
            disabled={isExtracting}
            className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5 rounded-xl font-black text-[11px] shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            {isExtracting
              ? <><Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />Scanning...</>
              : <><Zap className="h-3.5 w-3.5 mr-2" />RUN AI SCAN</>
            }
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Offline State ────────────────────────────────────────────────────────────

const OfflineState: React.FC<{ onRunScan: () => void; isExtracting: boolean }> = ({ onRunScan, isExtracting }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-5">
    <div className="p-4 bg-slate-100 rounded-full">
      <Zap className="h-10 w-10 text-slate-300" />
    </div>
    <div>
      <h4 className="text-sm font-black text-slate-800">Intelligence Offline</h4>
      <p className="text-[11px] text-slate-400 max-w-xs mt-1.5 leading-relaxed">
        Click <strong>RUN AI SCAN</strong> to extract contract identity, recipients, financials, compliance flags, and section text from this PDF.
      </p>
    </div>
    <Button
      onClick={onRunScan}
      disabled={isExtracting}
      className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl"
    >
      {isExtracting ? <><Loader2 className="animate-spin h-4 w-4 mr-2" />Scanning...</> : <><Zap className="h-4 w-4 mr-2" />Run AI Scan</>}
    </Button>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const PdfSyncModule: React.FC<PdfSyncModuleProps> = ({ contract, onUpdate }) => {
  const [blobUrl, setBlobUrl]               = useState<string | null>(null);
  const [pdfLoadError, setPdfLoadError]     = useState<string | null>(null);
  const [isExtracting, setIsExtracting]     = useState(false);
  const [isHydrating, setIsHydrating]       = useState(false);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  // ── Hydrate PDF blob ──────────────────────────────────────────────────────
  useEffect(() => {
    let objectUrl: string | null = null;

    const hydrate = async () => {
      if (blobUrl) return;
      if (contract.pdfBlob instanceof Blob) {
        objectUrl = URL.createObjectURL(contract.pdfBlob);
        setBlobUrl(objectUrl);
      } else if (contract.contractPdfPath) {
        const stored = await getPdfBlob(contract.id);
        if (stored instanceof Blob) {
          objectUrl = URL.createObjectURL(stored);
          setBlobUrl(objectUrl);
        } else {
          setPdfLoadError('PDF not found in local storage. Please re-upload.');
        }
      }
    };

    hydrate();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [contract.id, contract.pdfBlob, contract.contractPdfPath]);

  // ── Load saved intelligence from SQLite on mount ──────────────────────────
  useEffect(() => {
    if (contract.ultraRobust) return; // Already hydrated in store
    const sqliteId = contract.nomorKontrak?.replace(/\s+/g, '_');
    if (!sqliteId) return;

    setIsHydrating(true);
    loadContractIntelligence(sqliteId)
      .then(saved => {
        if (!saved) return;
        const updates: Partial<ContractData> = {};
        if (saved.ultraRobust)               updates.ultraRobust   = saved.ultraRobust as any;
        if (saved.tables?.length)            updates.tables        = saved.tables;
        if (saved.metadata?.sections)        updates.sections      = saved.metadata.sections;
        if (saved.metadata?.full_text)       updates.fullText      = saved.metadata.full_text;
        if (saved.metadata?.nomor_kontrak)   updates.nomorKontrak  = saved.metadata.nomor_kontrak;
        if (saved.metadata?.nama_penyedia)   updates.namaPenyedia  = saved.metadata.nama_penyedia;
        if (saved.metadata?.nama_pemesan)    updates.namaPemesan   = saved.metadata.nama_pemesan;
        if (Object.keys(updates).length > 0) {
          onUpdate(updates);
          toast.success('Intelligence restored from database.');
        }
      })
      .catch(() => { /* 404 = not yet scanned, silently skip */ })
      .finally(() => setIsHydrating(false));
  }, [contract.id, contract.nomorKontrak]);

  // ── Handle PDF file selection ─────────────────────────────────────────────
  const handleFileSelect = useCallback(async (file: File) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    setPdfLoadError(null);
    onUpdate({ contractPdfPath: file.name, pdfBlob: file, deliveryBlocks: [], recipients: [] });
    await savePdfBlob(contract.id, file, file.name);
    toast.info(`Engine Linked: ${file.name}`);
  }, [blobUrl, contract.id]);

  // ── AI Scan ───────────────────────────────────────────────────────────────
  const handleAutoExtract = useCallback(async () => {
    const file = contract.pdfBlob instanceof Blob ? contract.pdfBlob : null;
    if (!file) return toast.error('Upload a PDF first.');
    setIsExtracting(true);
    try {
      toast.info('Activating Ultra-Robust AI Scanning Protocol...');
      const result = await parsePdfFile(file as File);

      const updates: Partial<ContractData> = {
        ultraRobust:  result.ultra_robust  ?? undefined,
        tables:       result.tables        ?? [],
        sections:     result.metadata?.sections  ?? {},
        fullText:     result.metadata?.full_text ?? '',
      };
      if (result.metadata?.nomor_kontrak)  updates.nomorKontrak  = result.metadata.nomor_kontrak;
      if (result.metadata?.nama_penyedia)  updates.namaPenyedia  = result.metadata.nama_penyedia;
      if (result.metadata?.nama_pemesan)   updates.namaPemesan   = result.metadata.nama_pemesan;
      onUpdate(updates);

      // Persist everything to SQLite
      const sqliteId = (result.metadata?.nomor_kontrak || 'UNK').replace(/\s+/g, '_');
      await saveContract(
        sqliteId,
        result.metadata?.nomor_kontrak || 'UNK',
        result.ultra_robust?.financials?.grand_total ?? 0,
        result.metadata ?? null,
        result.ultra_robust ?? null,
        result.tables ?? [],
      );

      toast.success(`Intelligence Extraction Complete. ${result.ultra_robust?.shipment_ledger?.length ?? 0} recipients found.`);
    } catch (err) {
      console.error(err);
      toast.error('Extraction failed. Check backend logs.');
    } finally {
      setIsExtracting(false);
    }
  }, [contract.pdfBlob, onUpdate]);

  // ── Render ────────────────────────────────────────────────────────────────

  const hasPdf   = !!contract.contractPdfPath;
  const hasIntel = !!contract.ultraRobust;

  if (!hasPdf) {
    return (
      <div className="flex flex-col h-full">
        <UploadDropzone onFile={handleFileSelect} />
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
      </div>
    );
  }

  const grandTotalForReconciliation = hasIntel
    ? (contract.ultraRobust!.financials.grand_total - (contract.ultraRobust!.financials.tax_logic.total_tax || 0))
    : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Change PDF input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
      />

      {/* Header strip */}
      <ContractHeaderStrip
        contract={contract}
        isExtracting={isExtracting}
        isHydrating={isHydrating}
        onRunScan={handleAutoExtract}
        onChangePdf={() => fileInputRef.current?.click()}
      />

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: PDF Viewer (45%) ── */}
        <div className="w-[45%] min-w-[280px] max-w-[600px] border-r flex flex-col overflow-hidden shrink-0">
          {blobUrl
            ? <PdfViewerPane blobUrl={blobUrl} pdfName={contract.contractPdfPath?.split(/[\\/]/).pop() || ''} loadError={pdfLoadError} />
            : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-950 text-white">
                {pdfLoadError
                  ? <><AlertCircle className="h-8 w-8 text-red-400" /><p className="text-[11px] text-slate-400 text-center px-4">{pdfLoadError}</p></>
                  : <><Loader2 className="h-6 w-6 animate-spin text-slate-600" /><p className="text-[10px] text-slate-600">Loading PDF...</p></>
                }
              </div>
            )
          }
        </div>

        {/* ── Right: Intelligence Panel (55%) ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
          <Tabs defaultValue="overview" className="flex flex-col h-full">

            {/* Tab bar */}
            <div className="px-4 py-2 border-b bg-slate-50/50 shrink-0">
              <TabsList className="bg-slate-200/50 p-1 h-10 w-full rounded-xl">
                <TabsTrigger value="overview" className="text-[10px] font-bold gap-1.5 flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <LayoutDashboard className="h-3.5 w-3.5" /> OVERVIEW
                </TabsTrigger>
                <TabsTrigger value="recipients" className="text-[10px] font-bold gap-1.5 flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Users className="h-3.5 w-3.5" /> RECIPIENTS
                  {contract.ultraRobust?.shipment_ledger?.length ? (
                    <Badge className="ml-1 h-4 px-1 text-[8px] bg-blue-500">{contract.ultraRobust.shipment_ledger.length}</Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="sections" className="text-[10px] font-bold gap-1.5 flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <BookOpen className="h-3.5 w-3.5" /> SECTIONS
                </TabsTrigger>
                <TabsTrigger value="tables" className="text-[10px] font-bold gap-1.5 flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <TableIcon className="h-3.5 w-3.5" /> TABLES
                  {contract.tables?.length ? (
                    <Badge className="ml-1 h-4 px-1 text-[8px] bg-slate-400">{contract.tables.length}</Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab contents */}
            <div className="flex-1 overflow-hidden">

              <TabsContent value="overview" className="h-full m-0">
                {hasIntel
                  ? <OverviewPanel
                      data={contract.ultraRobust!}
                      nomorKontrak={contract.nomorKontrak}
                      namaPenyedia={contract.namaPenyedia}
                      namaPemesan={contract.namaPemesan}
                    />
                  : <OfflineState onRunScan={handleAutoExtract} isExtracting={isExtracting} />
                }
              </TabsContent>

              <TabsContent value="recipients" className="h-full m-0">
                {hasIntel
                  ? <RecipientTable
                      ledger={contract.ultraRobust!.shipment_ledger ?? []}
                      grandTotal={grandTotalForReconciliation}
                    />
                  : <OfflineState onRunScan={handleAutoExtract} isExtracting={isExtracting} />
                }
              </TabsContent>

              <TabsContent value="sections" className="h-full m-0 bg-slate-50/30">
                <SectionViewer sections={contract.sections ?? {}} fullText={contract.fullText} />
              </TabsContent>

              <TabsContent value="tables" className="h-full m-0">
                <TableViewer tables={contract.tables ?? []} />
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PdfSyncModule.tsx
git commit -m "feat: [UIUX-005] Redesign PdfSyncModule — horizontal split, DB hydration on mount, new tabs"
```

---

## Task 8: Build, Test, Push

- [ ] **Step 1: Run backend tests**

```bash
python -m pytest backend/tests/ -v
```

Expected: all pass

- [ ] **Step 2: Run frontend build**

```bash
npm run build
```

Expected: `✓ built in Xs` with no TypeScript errors

- [ ] **Step 3: Fix any TS errors**

Common issues to watch:
- `UltraRobustContract` type mismatch between frontend store and API response → cast with `as any` if needed
- `ContractData` missing import in new components → add from `@/lib/contractStore`
- `Select` component from shadcn/ui may not be installed → check with `ls src/components/ui/select.tsx`

If `select.tsx` doesn't exist:
```bash
npx shadcn@latest add select
```

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: [UIUX-005] Full PDF intelligence persistence + horizontal split UI redesign

- DB: Added ultra_robust_json + tables_json columns with safe migration
- Backend: VaultService now saves/loads ultra_robust + tables
- Router: /contracts/save accepts full intelligence payload
- Router: /contracts/load returns metadata + ultra_robust + tables
- Frontend: loadContractIntelligence() auto-hydrates from SQLite on mount
- UI: Horizontal split layout (PDF 45% | Intel 55%)
- UI: Always-visible contract identity strip with grand total
- UI: OverviewPanel with extraction health score + financial reconciliation
- UI: RecipientTable — dense sortable/filterable table with totals footer
- UI: Drag-and-drop PDF upload with visual feedback
- Edge cases: 404 from SQLite handled silently, partial extraction flagged"

git push origin main
```
