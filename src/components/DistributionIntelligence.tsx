// [UIUX-004] Distribution Intelligence — clean recipient data table
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileSpreadsheet, Loader2, Table as TableIcon, X,
  AlertCircle, Search, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ChevronUp, ChevronDown, FileDown
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cleanValue, stripRegionalPrefix } from '@/lib/dataCleaner';
import { exportStyledExcel } from '@/lib/excelExpert';
import { generateExportFilename, getStandardHeaderMeta } from '@/lib/exportUtils';
import * as XLSX from 'xlsx';
import { ingestExcel, probeExcel, saveContract } from '../lib/api';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { ExcelIngestionLoader } from './pdf-sync/ExcelIngestionLoader';
import { useMasterDataStore } from '../lib/masterDataStore';

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
  column_data?: Record<string, any>;
}

interface IngestResult {
  rows: IngestRow[];
  headers: string[];
  sheet_name: string;
  header_meta?: Record<string, string>;
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

/**
 * Robust Indonesian Numeric Parser: Handles '1.000.000,50' formatting.
 */
const parseNumberID = (v: any): number => {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const s = String(v).trim().replace(/Rp| /gi, '');
  // If it has BOTH dot and comma, it's definitely Indonesian (dot=thousands, comma=decimal)
  if (s.includes('.') && s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(/,/g, '.'));
  }
  // If it only has a comma, treat as decimal
  if (s.includes(',') && !s.includes('.')) {
    return parseFloat(s.replace(/,/g, '.'));
  }
  // If it's plain or has dots as thousands
  return parseFloat(s.replace(/\./g, '')) || parseFloat(s) || 0;
};

const formatIDR = (value: any): string => {
  const num = typeof value === 'number' ? value : parseNumberID(value);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

const formatDecimal = (v: any): string => {
  const num = parseNumberID(v);
  if (isNaN(num)) return String(v ?? '');
  
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

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

// ─── Data Alignment Engine ────────────────────────────────────────────────

/**
 * Triangulates butchered location strings using the Master Data store.
 * Operates in-place on IngestResult to ensure zero UI jitter.
 */
/**
 * Asynchronously aligns location data in chunks to prevent UI freezing.
 */
// ─── Main Component ───────────────────────────────────────────────────────────

export const DistributionIntelligence: React.FC<Props> = ({ onDataLoaded, contract }) => {
  const [stage, setStage] = useState<Stage>('IDLE');
  const [isExtracting, setIsExtracting] = useState(false);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  
  // contract info for job key
  const contractId = contract?.nomorKontrak || contract?.id || 'unknown';

  const fetchMasterData = useMasterDataStore((state: any) => state.fetchMasterData);
  const resolveHierarchy = useMasterDataStore((state: any) => state.resolveHierarchy);
  // Master Data Cache
  const isMasterLoaded = useMasterDataStore((state: any) => state.isLoaded);

  useEffect(() => {
    fetchMasterData().catch(console.error);
  }, [fetchMasterData]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [probedSheets, setProbedSheets] = useState<ProbeSheet[]>([]);
  const [loadedSheets, setLoadedSheets] = useState<Record<string, IngestResult>>({});
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);

  // Table state
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>(null);

  // ── Recovery & Initial Hydration ──────────────────────────────────────────

  useEffect(() => {
    // Initial Hydration: Load saved recipients
    if (contract?.recipients && contract.recipients.length > 0 && Object.keys(loadedSheets).length === 0) {
      const savedResult: IngestResult = {
        rows: contract.recipients,
        headers: ['NIK', 'NAMA PENERIMA', 'DESA', 'KECAMATAN', 'QTY', 'TOTAL_VALUE'],
        sheet_name: 'Saved List'
      };
      
      // If we have custom column data from a previous extraction, try to recover headers
      if (contract.recipients[0]?.column_data) {
        savedResult.headers = Object.keys(contract.recipients[0].column_data);
      }

      setLoadedSheets({ 'Saved List': savedResult });
      setActiveSheetName('Saved List');
      setStage('READY');
      onDataLoaded(contract.recipients);
    }
  }, [contractId, contract?.recipients, onDataLoaded]); // Trigger on mount or contract change

  // Reset to page 1 whenever search term changes
  useEffect(() => { setCurrentPage(1); }, [search]);


  // ── Ingest a single sheet ─────────────────────────────────────────────────

  const ingestSheet = useCallback(
    async (sheetName: string, file: File) => {
      setStage('LOADING');
      setIsExtracting(true);
      setSimulatedProgress(2);

      // 1. Kick off simulated progress (PDF style)
      const timer = setInterval(() => {
        setSimulatedProgress(prev => {
          if (prev >= 95) return prev; // Hold at 98%
          const step = (100 - prev) * 0.1; // Logarithmic slowing
          return prev + step;
        });
      }, 400) as any;

      try {
        const data = await ingestExcel(file, sheetName);
        
        // 2. Wrap up on success
        clearInterval(timer);
        setSimulatedProgress(100);
        
        // Wait a small moment for UI to 'feel' the completion
        setTimeout(() => {
          setLoadedSheets(prev => ({ ...prev, [data.sheet_name]: data }));
          setActiveSheetName(data.sheet_name);
          setStage('READY');
          setIsExtracting(false);
          onDataLoaded(data.rows);
          toast.success(`Intelligence Applied: ${data.rows.length} rows extracted`);
          
          // Auto-save result to vault
          const sqliteId = contractId.replace(/\s+/g, '_');
          saveContract(
            sqliteId,
            contract?.nomorKontrak || 'RECOVERED_CONTRACT',
            contract?.ultraRobust?.financials?.grand_total ?? 0,
            contract?.metadata ?? null,
            contract?.ultraRobust ?? null,
            contract?.tables ?? [],
            data.rows
          ).catch(e => console.warn('Failed to auto-save vault:', e));
        }, 800);

      } catch (err: any) {
        clearInterval(timer);
        setIsExtracting(false);
        toast.error('Failed to process Excel sheet');
        setStage('SELECTING');
      }
    },
    [contractId, contract, onDataLoaded],
  );

  // ── Drop handler ──────────────────────────────────────────────────────────

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Reset all sheet state before processing new file
      setCurrentFile(file);
      setLoadedSheets({});
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
          await ingestSheet(sheets[0].name, file);
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
        handleReset();
      } else if (activeSheetName === name) {
        setActiveSheetName(remaining[0]);
        setSearch('');
        setCurrentPage(1);
      }
      return next;
    });
  }, [activeSheetName, handleReset]);

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
    
    // [HEAL] Recovery step for missing regional fields
    const healedRows = activeData.rows.map(row => {
      const data = { ...row.column_data };
      const hProv = activeData.headers.find(h => h.toUpperCase().includes('PROVINSI') || h.toUpperCase() === 'INSU');
      const hKab  = activeData.headers.find(h => h.toUpperCase().includes('KABUPATEN') || h.toUpperCase() === 'KAB');
      
      if (hProv && hKab && !data[hProv] && data[hKab]) {
        const found = resolveHierarchy({ kabupaten: cleanValue(data[hKab], 'kabupaten') });
        if (found?.provinsi) {
          data[hProv] = stripRegionalPrefix(found.provinsi);
        }
      }
      return { ...row, column_data: data };
    });

    return healedRows.filter(row => rowMatchesSearch(row, search));
  }, [activeData, search, resolveHierarchy]);

  const sortedRows = useMemo(() => {
    let result = [...filteredRows];
    if (sortConfig) {
        const { key, direction } = sortConfig;
        result.sort((a, b) => {
          if (key === '#') {
            const idA = parseInt(String(a.id || 0).split('-').pop() || '0');
            const idB = parseInt(String(b.id || 0).split('-').pop() || '0');
            return direction === 'asc' ? idA - idB : idB - idA;
          }

          let valA = a.column_data?.[key] ?? '';
          let valB = b.column_data?.[key] ?? '';
        
        const numA = parseFloat(String(valA).replace(/[^0-9.-]+/g, ""));
        const numB = parseFloat(String(valB).replace(/[^0-9.-]+/g, ""));
        
        if (!isNaN(numA) && !isNaN(numB)) {
          return direction === 'asc' ? numA - numB : numB - numA;
        }
        
        return direction === 'asc' 
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return result;
  }, [filteredRows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / perPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return sortedRows.slice(start, start + perPage);
  }, [sortedRows, safePage, perPage]);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const handleExportExcel = async () => {
    if (!activeData?.rows) return;
    
    // Use the Elite Export Engine [EXCEL-600]
    // This applies design, healing, and proper number formatting
    await exportStyledExcel(
      sortedRows.map(r => r.column_data).filter((d): d is Record<string, any> => !!d),
      activeData.headers,
      {
        sheetName: activeSheetName || 'Recipient List',
        filename: generateExportFilename(
          activeData.header_meta?.order_id || activeData.header_meta?.contract_id, 
          activeSheetName || 'Recipient List'
        ),
        headerMeta: activeData.header_meta || getStandardHeaderMeta(activeData.headers)
      }
    );
  };

  const sheetNames = useMemo(() => {
    const names = Object.keys(loadedSheets);
    if (activeSheetName && !names.includes(activeSheetName)) {
      names.push(activeSheetName);
    }
    return names;
  }, [loadedSheets, activeSheetName]);

  const hasMoreSheets = probedSheets.length > (Object.keys(loadedSheets).length);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* ── REHYDRATION / IDLE ────────────────────────────────────────────── */}
      {stage === 'IDLE' && contract?.recipients?.length > 0 ? (
        <div className="flex flex-col items-center justify-center p-20 text-center animate-in fade-in duration-700">
           <Loader2 className="h-10 w-10 text-slate-200 animate-spin mb-4" />
           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Data...</h3>
           <p className="text-[11px] text-slate-300 mt-2">Restoring previously uploaded recipient lists.</p>
        </div>
      ) : stage === 'IDLE' && (
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
        <ExcelIngestionLoader progress={stage === 'ANALYZING' ? 10 : simulatedProgress} />
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
                  onClick={() => ingestSheet(sheet.name, currentFile!)}
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

      {/* ── WORKBENCH (READY) ──────────────────────────────────────────────── */}
      {stage === 'READY' && activeSheetName && (
        <div className="flex flex-col h-[700px] bg-white animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <div className="flex items-center gap-0.5 flex-wrap">
              {sheetNames.map(name => (
                <div key={name} className="flex items-center">
                  <button
                    onClick={() => handleTabSwitch(name)}
                    className={cn(
                      'flex items-center gap-1.5 h-7 px-3 rounded-md text-[10px] font-black',
                      'uppercase tracking-tight transition-all relative overflow-hidden',
                      activeSheetName === name
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100',
                    )}
                  >
                    {activeSheetName === name && !loadedSheets[name] && (
                      <div className="absolute inset-0 bg-slate-800/10 animate-pulse" />
                    )}
                    <TableIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[120px]">{name}</span>
                    <span className={cn(
                      'font-mono text-[9px] shrink-0',
                      activeSheetName === name ? 'text-slate-300' : 'text-slate-400',
                    )}>
                      {loadedSheets[name] ? loadedSheets[name].rows.length : <Loader2 className="h-2 w-2 animate-spin" />}
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
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase ml-auto shrink-0 flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="h-7 text-[10px] font-bold gap-2 px-3 border-emerald-100 bg-emerald-50/10 text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
              >
                <FileDown className="h-3.5 w-3.5" />
                EXPORT EXCEL
              </Button>
              <div className="w-px h-4 bg-slate-200" />
              <span>{filteredRows.length} / {activeData?.rows?.length || 0} RECORDS</span>
            </span>
          </div>


          {/* Data table */}
          <div className="w-full overflow-x-auto scrollbar-thin scrollbar-track-slate-50 scrollbar-thumb-slate-200">
            <table className="w-full min-w-[max-content] text-[11px] border-collapse bg-white">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm">
                  <th 
                    onClick={() => handleSort('#')}
                    className={cn(
                      "px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-center w-10 border-r border-slate-100 cursor-pointer select-none transition-colors group",
                      sortConfig?.key === '#' ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-100/50"
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span>#</span>
                      <div className={cn("transition-opacity", sortConfig?.key === '#' ? "opacity-100" : "opacity-0 group-hover:opacity-40")}>
                        {sortConfig?.key === '#' && sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : (sortConfig?.key === '#' && sortConfig.direction === 'desc' ? <ChevronDown className="h-3 w-3" /> : <div className="h-2 w-2 border-x border-slate-300 opacity-20" />)}
                      </div>
                    </div>
                  </th>
                  {activeData ? activeData.headers.map((header) => {
                    const hUpper = header.toUpperCase();
                    const isRight = ['QTY', 'TOTAL_VALUE', 'HARGA SATUAN', 'ONGKOS KIRIM', 'NOMINAL BAST', 'LUAS LAHAN', 'VOLUME', 'JUMLAH', 'VALUE', 'TOTAL', 'HARGA'].some(k => hUpper.includes(k));
                    const isSorted = sortConfig?.key === header;
                    const dir = isSorted ? sortConfig?.direction : null;
                    
                    return (
                      <th
                        key={header}
                        onClick={() => handleSort(header)}
                        className={cn(
                          'px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer transition-colors group select-none',
                          isRight ? 'text-right' : 'text-left',
                          isSorted ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-100/50'
                        )}
                      >
                        <div className={cn("flex flex-col gap-0.5", isRight ? "items-end" : "items-start")}>
                           <div className={cn("flex items-center gap-1.5", isRight && "flex-row-reverse")}>
                              <span className="truncate">{header.replace(/_/g, ' ')}</span>
                             <div className={cn("transition-all duration-300", isSorted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1 group-hover:opacity-40 group-hover:translate-y-0")}>
                                {dir === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : (dir === 'desc' ? <ChevronDown className="h-2.5 w-2.5" /> : <div className="h-2 w-2 border-x border-slate-300 opacity-20" />)}
                             </div>
                          </div>
                          {activeData?.header_meta?.[header] && (
                            <span className="text-[8px] font-normal lowercase text-slate-400 italic line-clamp-1">
                              ({activeData.header_meta[header]})
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  }) : (
                    <>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-300 uppercase tracking-wider text-left">NIK</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-300 uppercase tracking-wider text-left">NAMA PENERIMA</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-300 uppercase tracking-wider text-left">PROVINSI</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-300 uppercase tracking-wider text-left">KABUPATEN</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-300 uppercase tracking-wider text-right">QTY</th>
                      <th className="px-4 py-2.5 text-[10px] font-black text-slate-300 uppercase tracking-wider text-right">TOTAL_VALUE</th>
                    </>
                  )}
                </tr>
              </thead>
            <tbody>
              {!activeData ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 animate-pulse">
                    <td className="px-3 py-4 border-r border-slate-50"><div className="h-2 w-4 bg-slate-100 rounded mx-auto" /></td>
                    <td className="px-4 py-4"><div className="h-2 w-24 bg-slate-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-2 w-40 bg-slate-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-2 w-20 bg-slate-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-2 w-20 bg-slate-100 rounded" /></td>
                    <td className="px-4 py-4"><div className="h-2 w-12 bg-slate-100 rounded ml-auto" /></td>
                    <td className="px-4 py-4"><div className="h-2 w-20 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={(activeData?.headers?.length || 0) + 1} className="px-4 py-16 text-center">
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
                        'border-b border-slate-100 hover:bg-highlight hover:shadow-sm transition-all',
                        idx % 2 === 1 ? 'bg-slate-50/20' : 'bg-white',
                    )}
                    >
                      <td className="px-3 py-2.5 text-slate-300 font-mono tabular-nums text-[10px] text-center border-r border-slate-50">
                        {globalIdx}
                      </td>
                      {activeData.headers.map((header) => {
                        const val = row.column_data?.[header] ?? '—';
                        const hUpper = header.toUpperCase();
                        const isNIK = hUpper.includes('NIK') || hUpper === 'ID' || hUpper.includes('KTP') || hUpper.includes('IDX') || hUpper.includes('SOURCE') || hUpper.includes('HP') || hUpper.includes('WA') || hUpper.includes('TELEPON');
                        const isJadwal = hUpper.includes('JADWAL') || hUpper.includes('TANAM') || hUpper.includes('PERIODE') || hUpper.includes('MASA');
                        const isMain = hUpper === 'NAMA PENERIMA' || hUpper === 'PENERIMA' || hUpper === 'NAMA';
                        
                        const isPrice = hUpper.includes('HARGA') || hUpper.includes('PRICE') || hUpper.includes('VALUE') || hUpper.includes('NOMINAL') || hUpper.includes('TOTAL') || hUpper.includes('ONGKOS') || hUpper.includes('KIRIM') || hUpper.includes('BIAYA');
                        const isVolume = !isJadwal && (hUpper.includes('QTY') || hUpper.includes('VOLUME') || hUpper.includes('JUMLAH') || hUpper.includes('UNIT') || hUpper.includes('LUAS'));
                        
                        // Robust Content Check: If value looks like a number, treat it as one for alignment/formatting
                        // Skip this for NIK/JADWAL to prevent decimal/separator pollution [NIK-700/JADWAL-700]
                        const isNumericContent = !isNIK && !isJadwal && (typeof val === 'number' || (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val.trim())));

                        return (
                          <td 
                            key={header} 
                            className={cn(
                              "px-4 py-2.5 whitespace-nowrap transition-colors border-r border-slate-50/50",
                              "text-[11px] text-slate-600 font-medium", // Uniform Font & Size
                              isMain ? "font-bold text-slate-900 bg-slate-50/10" : "",
                              (isPrice || isVolume || isNumericContent) ? "text-right font-mono tabular-nums" : "", // Align numbers right
                              isNIK ? "font-mono" : ""
                            )}
                          >
                            {isPrice 
                              ? formatIDR(Number(val)) 
                              : (isNIK || isJadwal
                                  ? cleanValue(safeStr(val), header) 
                                  : (isVolume || isNumericContent ? formatDecimal(val) : cleanValue(safeStr(val), header))
                                )
                            }
                          </td>
                        );
                      })}
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
                  {[10, 20, 50, 100].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                  <SelectItem value={String(activeData?.rows?.length || 1000)}>All</SelectItem>
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

              <div className="flex items-center px-4 h-7 bg-white rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600 tabular-nums shadow-sm">
                <input 
                  className="w-8 text-center bg-transparent border-0 p-0 focus:outline-none font-bold text-slate-900" 
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0 && val <= totalPages) setCurrentPage(val);
                  }}
                  onFocus={(e) => e.target.select()}
                />
                <span className="mx-1 text-slate-300">/</span>
                <span>{totalPages}</span>
              </div>

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
