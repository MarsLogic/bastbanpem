// [UIUX-004] Distribution Intelligence — clean recipient data table
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileSpreadsheet, Loader2, Table as TableIcon, X,
  AlertCircle, Search, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ingestExcel, probeExcel } from '../lib/api';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'IDLE' | 'ANALYZING' | 'SELECTING' | 'LOADING' | 'READY';

interface ProbeSheet {
  name: string;
  row_count: number;
  col_count: number;
  discovery_score: number;
}

interface IngestRow {
  id: string;
  name: string;
  nik: string;
  phone: string;
  group: string;
  jadwal_tanam: string;
  location: {
    provinsi: string;
    kabupaten: string;
    kecamatan: string;
    desa: string;
  };
  financials: {
    qty: number;
    unit_price: number;
    shipping: number;
    target_value: number;
    calculated_value: number;
    gap: number;
  };
}

interface IngestResult {
  rows: IngestRow[];
  headers: string[];
  sheet_name: string;
}

// Keep parent-compatible interface even if not all props are consumed here
interface Props {
  contract?: any;
  onDataLoaded: (rows: any[]) => void;
  globalConfig?: any;
  setGlobalConfig?: (c: any) => void;
  globalNIKRegistry?: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatIDR = (value: number): string =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const safeStr = (v: unknown): string => (v == null ? '' : String(v));

const rowMatchesSearch = (row: IngestRow, term: string): boolean => {
  if (!term) return true;
  const t = term.toLowerCase();
  return (
    safeStr(row.name).toLowerCase().includes(t) ||
    safeStr(row.nik).toLowerCase().includes(t) ||
    safeStr(row.group).toLowerCase().includes(t) ||
    safeStr(row.location?.desa).toLowerCase().includes(t) ||
    safeStr(row.location?.kecamatan).toLowerCase().includes(t) ||
    safeStr(row.jadwal_tanam).toLowerCase().includes(t)
  );
};

// ─── Spinner ─────────────────────────────────────────────────────────────────

const Spinner = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-24">
    <Loader2 className="h-8 w-8 text-slate-900 animate-spin" />
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const DistributionIntelligence: React.FC<Props> = ({ onDataLoaded }) => {
  const [stage, setStage] = useState<Stage>('IDLE');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [probedSheets, setProbedSheets] = useState<ProbeSheet[]>([]);
  const [loadedSheets, setLoadedSheets] = useState<Record<string, IngestResult>>({});
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);

  // Table state
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Reset to page 1 whenever search term changes
  useEffect(() => { setCurrentPage(1); }, [search]);

  // ── Ingest a single sheet ─────────────────────────────────────────────────

  const ingestSheet = useCallback(
    async (sheetName: string, file: File, cachedSheets: Record<string, IngestResult>) => {
      // Already cached — just activate it
      if (cachedSheets[sheetName]) {
        setActiveSheetName(sheetName);
        setStage('READY');
        setSearch('');
        setCurrentPage(1);
        return;
      }

      setStage('LOADING');
      const tid = toast.loading(`Parsing "${sheetName}"…`);

      try {
        const result: IngestResult = await ingestExcel(file, sheetName);
        setLoadedSheets(prev => ({ ...prev, [sheetName]: result }));
        setActiveSheetName(sheetName);
        setStage('READY');
        setSearch('');
        setCurrentPage(1);
        onDataLoaded(result.rows);
        toast.success(`${result.rows.length} rows captured`, { id: tid });
      } catch (err: any) {
        toast.error(err?.message ?? 'Failed to parse sheet', { id: tid });
        // Revert to sheet picker if nothing loaded, else stay on current table
        setStage(Object.keys(cachedSheets).length > 0 ? 'READY' : 'SELECTING');
      }
    },
    [onDataLoaded],
  );

  // ── Drop handler ──────────────────────────────────────────────────────────

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Reset all sheet state before processing new file
      const freshCache: Record<string, IngestResult> = {};
      setCurrentFile(file);
      setLoadedSheets(freshCache);
      setActiveSheetName(null);
      setSearch('');
      setCurrentPage(1);
      setStage('ANALYZING');

      const tid = toast.loading(`Analyzing "${file.name}"…`);

      try {
        const sheets: ProbeSheet[] = await probeExcel(file);
        if (!sheets || sheets.length === 0) throw new Error('No sheets detected in file');

        setProbedSheets(sheets);
        toast.dismiss(tid);

        if (sheets.length === 1) {
          // Single sheet: auto-ingest, pass freshCache to skip stale-closure issue
          await ingestSheet(sheets[0].name, file, freshCache);
        } else {
          setStage('SELECTING');
        }
      } catch (err: any) {
        toast.error(err?.message ?? 'Analysis failed', { id: tid });
        setStage('IDLE');
        setCurrentFile(null);
      }
    },
    [ingestSheet],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    multiple: false,
    disabled: stage === 'ANALYZING' || stage === 'LOADING',
  });

  // ── Sheet management ──────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setCurrentFile(null);
    setProbedSheets([]);
    setLoadedSheets({});
    setActiveSheetName(null);
    setSearch('');
    setCurrentPage(1);
    setStage('IDLE');
  }, []);

  const removeSheet = useCallback((name: string) => {
    setLoadedSheets(prev => {
      const next = { ...prev };
      delete next[name];
      const remaining = Object.keys(next);

      if (remaining.length === 0) {
        setActiveSheetName(null);
        setStage('SELECTING');
      } else if (activeSheetName === name) {
        setActiveSheetName(remaining[0]);
        setSearch('');
        setCurrentPage(1);
      }
      return next;
    });
  }, [activeSheetName]);

  const handleTabSwitch = useCallback((name: string) => {
    if (name === activeSheetName) return;
    setActiveSheetName(name);
    setSearch('');
    setCurrentPage(1);
  }, [activeSheetName]);

  // ── Table computation ─────────────────────────────────────────────────────

  const activeData = activeSheetName ? loadedSheets[activeSheetName] ?? null : null;

  const filteredRows = useMemo(() => {
    if (!activeData?.rows) return [];
    return activeData.rows.filter(row => rowMatchesSearch(row, search));
  }, [activeData, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  // Clamp safePage so page never exceeds total (e.g. after search narrows results)
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return filteredRows.slice(start, start + perPage);
  }, [filteredRows, safePage, perPage]);

  const sheetNames = Object.keys(loadedSheets);
  // Only show "+ Add Sheet" if more probed sheets exist than are loaded
  const hasMoreSheets = probedSheets.length > sheetNames.length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── IDLE ─────────────────────────────────────────────────────────── */}
      {stage === 'IDLE' && (
        <div
          {...getRootProps()}
          className={cn(
            'm-6 flex flex-col items-center justify-center gap-5 rounded-xl',
            'border-2 border-dashed p-16 cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-slate-900 bg-slate-50 scale-[0.99]'
              : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50/50',
          )}
        >
          <input {...getInputProps()} />
          <div className="p-4 bg-slate-100 rounded-xl border border-slate-200">
            <FileSpreadsheet className="h-8 w-8 text-slate-900" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
              {isDragActive ? 'Release to upload' : 'Upload Recipient List'}
            </p>
            <p className="text-xs text-slate-500">
              Drag & drop or click to browse
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500">.xlsx</Badge>
            <Badge variant="secondary" className="text-[9px] font-bold uppercase bg-slate-100 text-slate-500">.xls</Badge>
          </div>
        </div>
      )}

      {/* ── ANALYZING / LOADING ──────────────────────────────────────────── */}
      {(stage === 'ANALYZING' || stage === 'LOADING') && (
        <Spinner label={stage === 'ANALYZING' ? 'Detecting structure…' : 'Parsing data…'} />
      )}

      {/* ── SELECTING ────────────────────────────────────────────────────── */}
      {stage === 'SELECTING' && (
        <div className="m-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {currentFile?.name} — select a sheet
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-7 text-[10px] font-bold text-slate-400 hover:text-red-600"
            >
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {probedSheets.map(sheet => {
              const isLoaded = !!loadedSheets[sheet.name];
              const recommended = sheet.discovery_score > 0.5;
              return (
                <button
                  key={sheet.name}
                  disabled={isLoaded}
                  onClick={() => ingestSheet(sheet.name, currentFile!, loadedSheets)}
                  className={cn(
                    'text-left p-4 rounded-xl border-2 transition-all',
                    isLoaded
                      ? 'border-slate-100 bg-slate-50 opacity-50 cursor-default'
                      : recommended
                        ? 'border-slate-900 bg-white hover:bg-slate-50 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-400',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <TableIcon className="h-4 w-4 text-slate-400" />
                    {isLoaded && (
                      <Badge variant="outline" className="text-[8px] h-4 text-slate-400">LOADED</Badge>
                    )}
                    {!isLoaded && recommended && (
                      <Badge className="bg-slate-900 text-white text-[8px] h-4 font-black">RECOMMENDED</Badge>
                    )}
                  </div>
                  <p className="text-[13px] font-black text-slate-900 truncate">{sheet.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1">
                    {sheet.row_count} rows · {sheet.col_count} cols
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── READY ────────────────────────────────────────────────────────── */}
      {stage === 'READY' && activeData && (
        <div className="flex flex-col">

          {/* Sheet tabs + file controls */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <div className="flex items-center gap-0.5 flex-wrap">
              {sheetNames.map(name => (
                <div key={name} className="flex items-center">
                  <button
                    onClick={() => handleTabSwitch(name)}
                    className={cn(
                      'flex items-center gap-1.5 h-7 px-3 rounded-md text-[10px] font-black',
                      'uppercase tracking-tight transition-all',
                      activeSheetName === name
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100',
                    )}
                  >
                    <TableIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[120px]">{name}</span>
                    <span className={cn(
                      'font-mono text-[9px] shrink-0',
                      activeSheetName === name ? 'text-slate-300' : 'text-slate-400',
                    )}>
                      {loadedSheets[name].rows.length}
                    </span>
                  </button>
                  <button
                    title={`Remove ${name}`}
                    onClick={e => { e.stopPropagation(); removeSheet(name); }}
                    className="p-0.5 ml-0.5 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}

              {hasMoreSheets && (
                <>
                  <div className="w-px h-4 bg-slate-200 mx-1.5" />
                  <button
                    onClick={() => setStage('SELECTING')}
                    className="h-7 px-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    + Add Sheet
                  </button>
                </>
              )}
            </div>

            <button
              onClick={handleReset}
              className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-700 transition-colors shrink-0 ml-4"
            >
              Change File
            </button>
          </div>

          {/* Search + record count */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/40">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search records…"
                className="pl-8 h-8 text-[11px] bg-white border-slate-200 focus-visible:ring-slate-900"
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase ml-auto shrink-0">
              {filteredRows.length} records
            </span>
          </div>

          {/* Data table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['#', 'Nama Penerima', 'NIK', 'Poktan/Group', 'Desa/Kel', 'Kecamatan', 'QTY', 'Target Val', 'Jadwal'].map(
                    (col, i) => (
                      <th
                        key={col}
                        className={cn(
                          'px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap',
                          i === 0 ? 'w-10' : '',
                          i >= 6 && i <= 7 ? 'text-right' : 'text-left',
                        )}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <AlertCircle className="h-5 w-5" />
                        <p className="text-[11px] font-bold uppercase tracking-wide">
                          {search ? 'No records match your search' : 'No data available'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : pagedRows.map((row, idx) => {
                  const globalIdx = (safePage - 1) * perPage + idx + 1;
                  return (
                    <tr
                      key={row.id ?? `row-${globalIdx}`}
                      className={cn(
                        'border-b border-slate-100 hover:bg-blue-50/20 transition-colors',
                        idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white',
                      )}
                    >
                      <td className="px-3 py-2.5 text-slate-400 font-mono tabular-nums text-[10px]">
                        {globalIdx}
                      </td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                        {row.name || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 tabular-nums">
                        {row.nik || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {row.group || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {row.location?.desa || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {row.location?.kecamatan || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-700 tabular-nums">
                        {row.financials?.qty ?? 0}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {formatIDR(row.financials?.target_value ?? 0)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {row.jadwal_tanam || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Per page:</span>
              <Select
                value={String(perPage)}
                onValueChange={v => { setPerPage(Number(v)); setCurrentPage(1); }}
              >
                <SelectTrigger className="h-7 w-16 text-[10px] font-bold bg-white border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 50, 100].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={safePage === 1}
                onClick={() => setCurrentPage(1)}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={safePage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>

              <span className="text-[10px] font-bold text-slate-500 uppercase mx-2 tabular-nums">
                {safePage} / {totalPages}
              </span>

              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
