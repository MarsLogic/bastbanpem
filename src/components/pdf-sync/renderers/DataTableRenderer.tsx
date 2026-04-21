import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileDown } from 'lucide-react';
import { cleanValue, stripRegionalPrefix } from '@/lib/dataCleaner';
import { exportStyledExcel } from '@/lib/excelExpert';
import { useMasterDataStore } from '@/lib/masterDataStore';

interface RawTable {
  page?: number;
  headers: string[];
  rows: Record<string, any>[];
  method?: string;
}

interface DataTableRendererProps {
  table: RawTable;
  /** Show page/method metadata badge in header */
  showMeta?: boolean;
  searchQuery?: string;
}

// Initial default
const DEFAULT_PAGE_SIZE = 10;

type SortDir = 'asc' | 'desc' | null;

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc')  return <ChevronUp   className="h-3 w-3 text-slate-700 shrink-0" />;
  if (dir === 'desc') return <ChevronDown className="h-3 w-3 text-slate-700 shrink-0" />;
  return <ChevronsUpDown className="h-3 w-3 text-slate-300 shrink-0" />;
}

/** Attempt to parse block-parsing rows (fields string[]) into keyed rows */
function normalizeRows(headers: string[], rows: Record<string, any>[]): Record<string, string>[] {
  return rows.map(row => {
    // find_tables rows: already keyed by header
    if (headers.length > 0 && headers[0] in row) return row as Record<string, string>;

    // block_parsing rows: may have a `fields` array
    if (Array.isArray(row.fields)) {
      const out: Record<string, string> = {};
      headers.forEach((h, i) => { out[h] = String(row.fields[i] ?? '—'); });
      return out;
    }

    // fallback: stringify all values
    const out: Record<string, string> = {};
    headers.forEach(h => { out[h] = row[h] !== undefined ? String(row[h]) : '—'; });
    return out;
  });
}

/** Produce synthetic headers when none exist, from field arrays */
function inferHeaders(rows: Record<string, any>[]): string[] {
  if (rows.length === 0) return [];
  const first = rows[0];
  if (Array.isArray(first.fields)) {
    const maxLen = rows.reduce((m, r) => Math.max(m, Array.isArray(r.fields) ? r.fields.length : 0), 0);
    return Array.from({ length: maxLen }, (_, i) => `Col ${i + 1}`);
  }
  return Object.keys(first);
}

import { Highlight } from '@/components/ui/highlight';

export const DataTableRenderer: React.FC<DataTableRendererProps> = ({ table, showMeta = false, searchQuery }) => {
  // Sync internal search ONLY on initial load if provided
  const [search,   setSearch]   = useState(searchQuery || '');
  const [sortCol,  setSortCol]  = useState<string | null>(null);
  const [sortDir,  setSortDir]  = useState<SortDir>(null);
  const [pageSize,  setPageSize]  = useState<number | 'all'>(DEFAULT_PAGE_SIZE);
  const [page,      setPage]      = useState(0);

  React.useEffect(() => {
    if (searchQuery && !search) {
      setSearch(searchQuery);
    }
  }, []);

  const resolveRawAddress = useMasterDataStore(state => state.resolveRawAddress);
  const resolveHierarchy = useMasterDataStore(state => state.resolveHierarchy);
  const isLoaded = useMasterDataStore(state => state.isLoaded);

  const { 
    finalHeaders, 
    normalizedRows 
  } = useMemo(() => {
    const rawHeaders = table.headers.length > 0 ? table.headers : inferHeaders(table.rows);
    const rows = normalizeRows(rawHeaders, table.rows);

    // 1. Map raw headers to internal hierarchy keys
    const hProv = rawHeaders.find(h => /provinsi|prov/i.test(h));
    const hKab  = rawHeaders.find(h => /kabupaten|kab/i.test(h));
    const hKec  = rawHeaders.find(h => /kecamatan|kec/i.test(h));
    const hDesa = rawHeaders.find(h => /desa|kelurahan|kel/i.test(h));

    // 2. Define Elite Standard Header set
    const MANDATORY = ['PROVINSI', 'KABUPATEN', 'KECAMATAN', 'DESA'];
    const otherHeaders = rawHeaders.filter(h => 
      h !== hProv && h !== hKab && h !== hKec && h !== hDesa
    );

    const mergedHeaders = [...MANDATORY, ...otherHeaders];

    // 3. Transform & Heal Rows
    const healed = rows.map((row, idx) => {
      const vProv = hProv ? String(row[hProv] || '').trim() : '';
      const vKab  = hKab  ? String(row[hKab]  || '').trim() : '';
      const vKec  = hKec  ? String(row[hKec]  || '').trim() : '';
      const vDesa = hDesa ? String(row[hDesa] || '').trim() : '';

      const cProv = cleanValue(vProv, 'provinsi');
      const cKab  = cleanValue(vKab, 'kabupaten');
      const cKec  = cleanValue(vKec, 'kecamatan');
      const cDesa = cleanValue(vDesa, 'desa');

      const resolved = resolveHierarchy({ provinsi: cProv, kabupaten: cKab, kecamatan: cKec, desa: cDesa });

      const newRow: Record<string, any> = { _idx: idx };
      newRow['PROVINSI']  = stripRegionalPrefix(resolved?.provinsi  || cProv || vProv);
      newRow['KABUPATEN'] = stripRegionalPrefix(resolved?.kabupaten || cKab  || vKab);
      newRow['KECAMATAN'] = stripRegionalPrefix(resolved?.kecamatan || cKec  || vKec);
      newRow['DESA']      = stripRegionalPrefix(resolved?.desa      || cDesa || vDesa);

      otherHeaders.forEach(h => {
        newRow[h] = row[h];
      });

      return newRow;
    });

    return { finalHeaders: mergedHeaders, normalizedRows: healed };
  }, [table.headers, table.rows, resolveHierarchy]);

  const toggleSort = (col: string) => {
    if (sortCol !== col) { setSortCol(col); setSortDir('asc'); }
    else if (sortDir === 'asc')  setSortDir('desc');
    else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return normalizedRows;
    const q = search.toLowerCase();
    return normalizedRows.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(q)),
    );
  }, [normalizedRows, search]);

  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      // Handle # Index Sort
      if (sortCol === '#') {
        const idxA = a._idx ?? 0;
        const idxB = b._idx ?? 0;
        return sortDir === 'asc' ? idxA - idxB : idxB - idxA;
      }

      const va = String(a[sortCol] ?? '');
      const vb = String(b[sortCol] ?? '');
      // numeric sort if both look numeric
      const na = parseFloat(va.replace(/[^0-9.,]/g, '').replace(',', '.'));
      const nb = parseFloat(vb.replace(/[^0-9.,]/g, '').replace(',', '.'));
      const cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : va.localeCompare(vb, 'id');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const actualPageSize = pageSize === 'all' ? sorted.length : pageSize;
  const totalPages = Math.max(1, Math.ceil(sorted.length / actualPageSize));
  const pageRows   = sorted.slice(page * actualPageSize, (page + 1) * actualPageSize);

  // Reset to page 0 when filter or page size changes
  React.useEffect(() => { setPage(0); }, [search, sortCol, sortDir, pageSize]);

  const handleExportExcel = async () => {
    // Use the Elite Export Engine [EXCEL-600]
    await exportStyledExcel(
      sorted,
      finalHeaders,
      {
        sheetName: 'Data Table',
        filename: `extracted_table_${new Date().getTime()}.xlsx`
      }
    );
  };

  if (finalHeaders.length === 0) {
    return <p className="text-sm text-slate-400 italic p-4">No columns detected in this table.</p>;
  }

  const isEmpty = normalizedRows.length === 0;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      {/* Table toolbar */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Search rows..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 py-0 text-[12px] bg-white border-slate-200 shadow-sm" />
        </div>
        {!isLoaded && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-black animate-pulse">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            <span className="text-[9px] font-medium text-white uppercase tracking-tighter">Analyzing...</span>
          </div>
        )}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <Badge variant="secondary" className="text-[10px] h-5 font-mono">
            {filtered.length}/{normalizedRows.length} rows · {finalHeaders.length} cols
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-7 text-[10px] font-bold gap-2 px-3 border-emerald-100 bg-emerald-50/10 text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm shrink-0"
          >
            <FileDown className="h-3.5 w-3.5" />
            EXPORT EXCEL
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        {isEmpty ? (
          <div className="p-8 text-center text-slate-400 text-[12px]">
            <div className="mb-2 font-medium">No data rows extracted</div>
            <div className="text-[10px]">Headers detected: {finalHeaders.join(', ')}</div>
          </div>
        ) : (
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th 
                  onClick={() => toggleSort('#')}
                  className="px-3 py-2.5 text-center text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 w-10 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>#</span>
                    <SortIcon dir={sortCol === '#' ? sortDir : null} />
                  </div>
                </th>
                {finalHeaders.map(h => (
                  <th
                    key={h}
                    onClick={() => toggleSort(h)}
                    className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em]
                               text-slate-400 border-b border-slate-200 cursor-pointer select-none
                               hover:bg-slate-100 transition-colors whitespace-nowrap"
                    style={{ minWidth: 80, maxWidth: 300 }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="truncate">{h || `Col`}</span>
                      <SortIcon dir={sortCol === h ? sortDir : null} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={`border-b border-slate-100 hover:bg-slate-100/30 transition-colors
                              ${rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                >
                  <td className="px-3 py-2 text-[9px] font-mono text-slate-400 tabular-nums">
                    {page * actualPageSize + rIdx + 1}
                  </td>
                  {finalHeaders.map(h => {
                    const val = row[h] ?? '—';
                    const strVal = String(val);
                    const isEmpty = strVal === '' || strVal === 'nan' || strVal === 'None';
                    return (
                      <td
                        key={h}
                        className="px-3 py-2 align-top"
                        style={{ maxWidth: 300 }}
                      >
                        <div
                          className={`truncate text-[12px] leading-relaxed font-medium
                                      ${isEmpty ? 'text-slate-300 italic' : 'text-slate-700'}`}
                          title={strVal}
                        >
                          {isEmpty ? '—' : (
                            <Highlight text={cleanValue(strVal, h, resolveRawAddress)} query={search || searchQuery} />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-slate-400 tabular-nums">
              {page * actualPageSize + 1}–{Math.min((page + 1) * actualPageSize, sorted.length)} of {sorted.length}
            </span>
            
            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-4">
              <span className="text-[10px] text-slate-400 uppercase tracking-tight font-medium">Show:</span>
              {[10, 20, 50, 'all'].map(size => (
                <button
                  key={size}
                  onClick={() => setPageSize(size as any)}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors font-mono
                             ${pageSize === size 
                               ? 'bg-slate-800 text-white font-medium' 
                               : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  {size === 'all' ? 'All' : size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="h-7 w-7 border-slate-200"
              disabled={page === 0}
              onClick={() => setPage(0)}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-7 w-7 border-slate-200"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            
            <div className="flex items-center px-4 h-7 bg-white rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600 tabular-nums shadow-sm">
              <input 
                className="w-8 text-center bg-transparent border-0 p-0 focus:outline-none font-bold text-slate-900" 
                value={page + 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0 && val <= totalPages) setPage(val - 1);
                }}
                onFocus={(e) => e.target.select()}
              />
              <span className="mx-1 text-slate-300">/</span>
              <span>{totalPages}</span>
            </div>

            <Button
              variant="outline" size="icon" className="h-7 w-7 border-slate-200"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-7 w-7 border-slate-200"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
