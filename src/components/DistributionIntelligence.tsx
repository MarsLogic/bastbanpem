import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileSpreadsheet, Loader2, Table as TableIcon, CheckCircle2, 
  ArrowRight, X, AlertCircle, FileText, Search, ChevronLeft, 
  ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { ingestExcel, probeExcel } from '../lib/api';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const DistributionIntelligence = ({ contract, onDataLoaded }: { contract?: any, onDataLoaded: (data: any) => void }) => {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [probedSheets, setProbedSheets] = useState<any[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [stage, setStage] = useState<'IDLE' | 'ANALYZING' | 'SELECTING' | 'LOADING' | 'READY'>('IDLE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState<any>(null);

  // Table State (SSKK Alignment)
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setCurrentFile(file);
    setStage('ANALYZING');
    
    const analyzeToast = toast.loading(`Analyzing "${file.name}"...`);

    try {
      const sheets = await probeExcel(file);
      setProbedSheets(sheets);
      setStage('SELECTING');
      toast.success("File analyzed", { id: analyzeToast });
    } catch (error: any) {
      toast.error(`Analysis failed: ${error.message}`, { id: analyzeToast });
      setStage('IDLE');
      setCurrentFile(null);
    }
  }, []);

  const handleSheetSelect = async (sheetName: string) => {
    if (!currentFile) return;
    
    setStage('LOADING');
    setIsProcessing(true);
    const loadingToast = toast.loading(`Loading data from ${sheetName}...`);

    try {
      const result = await ingestExcel(currentFile, sheetName);
      setSelectedSheet(sheetName);
      setData(result);
      setStage('READY');
      onDataLoaded(result);
      toast.success("Data loaded successfully", { id: loadingToast });
    } catch (error: any) {
      toast.error(`Failed to load data: ${error.message}`, { id: loadingToast });
      setStage('SELECTING');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentFile(null);
    setProbedSheets([]);
    setSelectedSheet(null);
    setStage('IDLE');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: isProcessing
  });

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
          <FileText className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">2. Recipient Data</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Upload and verify your distribution list</p>
        </div>
      </div>

      {/* STAGE 1: UPLOAD */}
      {stage === 'IDLE' && (
        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <div 
              {...getRootProps()} 
              className={cn(
                "p-12 text-center clickable transition-all duration-300",
                isDragActive ? "bg-slate-100 scale-[0.99]" : "bg-white hover:bg-slate-50"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className="p-5 bg-slate-100 rounded-2xl border border-slate-200">
                  <FileSpreadsheet className="h-8 w-8 text-slate-900" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-900 uppercase">Upload Recipient List</h3>
                  <p className="text-xs text-slate-500 font-medium">Drag and drop your Excel file here, or click to browse</p>
                </div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tight bg-slate-100 text-slate-600">.xlsx</Badge>
                  <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tight bg-slate-100 text-slate-600">.xls</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STAGE 2: ANALYZING */}
      {stage === 'ANALYZING' && (
        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardContent className="p-16 text-center space-y-4">
            <Loader2 className="h-10 w-10 text-slate-900 animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 uppercase">Analyzing File</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Detecting sheets and structure</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STAGE 3: SELECT SHEET */}
      {stage === 'SELECTING' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic">Select Sheet</h3>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-[10px] font-bold text-slate-400">
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {probedSheets.map((sheet) => {
              const recommended = sheet.discovery_score > 0.5;
              return (
                <div 
                  key={sheet.name}
                  onClick={() => handleSheetSelect(sheet.name)}
                  className={cn(
                    "relative group p-5 rounded-2xl border-2 transition-all cursor-pointer bg-white",
                    recommended ? "border-slate-900 ring-4 ring-slate-900/5 shadow-xl" : "border-slate-200 hover:border-slate-400"
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn(
                      "p-2 rounded-xl border transition-colors",
                      recommended ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-400 border-slate-100"
                    )}>
                      <TableIcon className="h-4 w-4" />
                    </div>
                    {recommended && (
                      <Badge className="bg-slate-900 text-white text-[8px] h-4 font-black">RECOMMENDED</Badge>
                    )}
                  </div>
                  
                  <h4 className="text-[13px] font-black text-slate-900 truncate mb-1">{sheet.name}</h4>
                  <div className="flex gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                    <span>{sheet.row_count} Rows</span>
                    <span>•</span>
                    <span>{sheet.col_count} Cols</span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-300 uppercase">Click to select</span>
                    <ArrowRight className="h-3 w-3 text-slate-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STAGE 4: LOADING DATA */}
      {stage === 'LOADING' && (
        <Card className="border-slate-200 shadow-sm rounded-2xl">
          <CardContent className="p-16 text-center space-y-4">
            <Loader2 className="h-10 w-10 text-slate-900 animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 uppercase">Processing Data</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Applying validation rules</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STAGE 5: READY (SSKK ALIGNMENT) */}
      {stage === 'READY' && data && (() => {
        const filtered = data.rows.filter((row: any) => 
          Object.values(row).some(v => String(v).toLowerCase().includes(search.toLowerCase())) ||
          Object.values(row.location).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
        );
        
        const actualPageSize = pageSize === 'all' ? filtered.length : pageSize;
        const totalPages = Math.ceil(filtered.length / actualPageSize);
        const pageRows = filtered.slice(page * actualPageSize, (page + 1) * actualPageSize);

        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
              {/* Table Toolbar */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input 
                    placeholder="Search rows..." 
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    className="h-9 pl-9 text-[12px] bg-white border-slate-200 shadow-sm" 
                  />
                </div>
                <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                  <Badge variant="secondary" className="text-[10px] h-6 font-mono bg-slate-100 text-slate-600 border-slate-200">
                    {filtered.length}/{data.rows.length} rows · {Object.keys(data.rows[0] || {}).length} cols
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleReset}
                    className="h-8 text-[10px] font-black uppercase text-slate-400 hover:text-slate-900"
                  >
                    Change File
                  </Button>
                </div>
              </div>

              {/* Table Body */}
              <div className="overflow-auto min-h-[300px]">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 w-12">#</th>
                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-1">NIK <ChevronsUpDown className="h-3 w-3 text-slate-300" /></div>
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-1">Name <ChevronsUpDown className="h-3 w-3 text-slate-300" /></div>
                      </th>
                      <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                        Location
                      </th>
                      <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map((row: any, idx: number) => (
                      <tr key={idx} className={cn(
                        "hover:bg-slate-50 border-b border-slate-50 transition-colors group",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                      )}>
                        <td className="px-4 py-3 text-[9px] font-mono text-slate-400">
                          {page * actualPageSize + idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-mono font-bold text-slate-900">{row.nik}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-black text-slate-700 uppercase">{row.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-900 uppercase leading-tight">{row.location.desa}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{row.location.kecamatan}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {row.financials.qty.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                    {page * actualPageSize + 1}–{Math.min((page + 1) * actualPageSize, filtered.length)} of {filtered.length}
                  </span>
                  
                  <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Show:</span>
                    {[10, 20, 50, 'all'].map(size => (
                      <button
                        key={size}
                        onClick={() => { setPageSize(size as any); setPage(0); }}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded transition-colors font-mono font-bold",
                          pageSize === size ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {size === 'all' ? 'All' : size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-slate-400"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-[10px] font-mono font-bold text-slate-900 px-2">{page + 1}/{totalPages}</span>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-slate-400"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ERROR HINT */}
      {!currentFile && stage === 'IDLE' && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
          <AlertCircle className="h-4 w-4 text-slate-400" />
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
            Please ensure your file contains columns for Nama, NIK, and Alamat.
          </p>
        </div>
      )}
    </div>
  );
};
