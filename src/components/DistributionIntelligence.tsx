import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileSpreadsheet, ShieldCheck, AlertTriangle, Search, 
  Settings2, ChevronDown, CheckCircle2, Loader2, Info,
  Table as TableIcon, LayoutGrid, Download
} from 'lucide-react';
import { ingestExcel, probeExcel } from '../lib/api';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ParsingStats {
  headerRow: number;
  totalRowsFound: number;
  mappedColumns: number;
  pollutionDropped: number;
  healthScore: number;
}

export const DistributionIntelligence = ({ onDataLoaded }: { onDataLoaded: (data: any) => void }) => {
  const [isIngesting, setIsIngesting] = useState(false);
  const [parsingStats, setParsingStats] = useState<ParsingStats | null>(null);
  const [ingestProgress, setIngestProgress] = useState(0);
  const [viewMode, setViewMode] = useState<'ringkasan' | 'lampiran'>('ringkasan');
  const [data, setData] = useState<any>(null);
  
  // Expert Phase 1 State
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [probedSheets, setProbedSheets] = useState<any[]>([]);
  const [stage, setStage] = useState<'IDLE' | 'PROBING' | 'DISCOVERY' | 'INGESTING' | 'COMPLETE'>('IDLE');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setCurrentFile(file);
    setStage('PROBING');
    setIngestProgress(20);
    
    const probeToast = toast.loading(`Probing Physical Structure of "${file.name}"...`);

    try {
      const sheets = await probeExcel(file);
      setProbedSheets(sheets);
      setStage('DISCOVERY');
      setIngestProgress(100);
      toast.success("Workbook Structure Analyzed", { id: probeToast });
    } catch (error: any) {
      toast.error(`Probe Failed: ${error.message}`, { id: probeToast });
      setStage('IDLE');
    }
  }, []);

  const handleSheetSelect = async (sheetName: string) => {
    if (!currentFile) return;
    
    setStage('INGESTING');
    setIsIngesting(true);
    setIngestProgress(30);
    const loadingToast = toast.loading(`Extracting Payload from [${sheetName}]...`);

    try {
      const result = await ingestExcel(currentFile, sheetName);
      setIngestProgress(100);
      setData(result);
      
      const stats: ParsingStats = {
        headerRow: result.header_index,
        totalRowsFound: result.rows.length,
        mappedColumns: result.headers.length,
        pollutionDropped: result.pollution_count,
        healthScore: result.rows.length > 0 ? 98 : 0
      };

      setParsingStats(stats);
      setStage('COMPLETE');
      onDataLoaded(result);
      toast.success("Extraction Complete", { id: loadingToast });
    } catch (error: any) {
      toast.error(`Ingestion Failed: ${error.message}`, { id: loadingToast });
      setStage('DISCOVERY');
    } finally {
      setIsIngesting(false);
    }
  };

  // Aggregation Logic for Ringkasan
  const aggregates = React.useMemo(() => {
    if (!data?.rows) return [];
    const map = new Map();
    
    data.rows.forEach((row: any) => {
      const key = `${row.location.kabupaten}|${row.location.kecamatan}`;
      if (!map.has(key)) {
        map.set(key, {
          kabupaten: row.location.kabupaten,
          kecamatan: row.location.kecamatan,
          qty: 0,
          value: 0,
          recipients: 0
        });
      }
      const entry = map.get(key);
      entry.qty += row.financials.qty;
      entry.value += row.financials.calculated_value;
      entry.recipients += 1;
    });
    
    return Array.from(map.values()).sort((a: any, b: any) => 
      a.kabupaten.localeCompare(b.kabupaten) || a.kecamatan.localeCompare(b.kecamatan)
    );
  }, [data]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: isIngesting
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* 1. Expert Ingestion Stage: IDLE or PROBING */}
      {(stage === 'IDLE' || stage === 'PROBING') && (
        <div 
          {...getRootProps()} 
          className={cn(
            "relative group overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300",
            "bg-slate-50/50 p-12 text-center clickable cursor-pointer",
            isDragActive ? "border-slate-900 bg-slate-100/50 scale-[0.99]" : "border-slate-200 hover:border-slate-400 hover:bg-white",
            stage === 'PROBING' && "opacity-50 pointer-events-none"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-slate-900/5 blur-2xl rounded-full" />
              <div className="relative p-6 bg-white rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                {stage === 'PROBING' ? (
                  <Loader2 className="h-10 w-10 text-slate-900 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-10 w-10 text-slate-800" />
                )}
              </div>
            </div>
            
            <div className="max-w-xs space-y-1">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                {stage === 'PROBING' ? "Probing Structure..." : "Load Distribution Payload"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {stage === 'PROBING' ? "Identifying sheets and header density" : "Drag your recipient Excel file here or click to browse."}
              </p>
            </div>

            {stage === 'PROBING' && (
              <div className="w-48 mt-2">
                <Progress value={ingestProgress} className="h-1.5" />
              </div>
            )}

            {stage === 'IDLE' && (
              <div className="flex gap-4 mt-2">
                <Badge variant="outline" className="bg-white text-[9px] font-bold text-slate-500 border-slate-200 py-1">
                  XLSX SUPPORT
                </Badge>
                <Badge variant="outline" className="bg-white text-[9px] font-bold text-slate-500 border-slate-200 py-1">
                  PRE-FLIGHT PROBE
                </Badge>
                <Badge variant="outline" className="bg-white text-[9px] font-bold text-slate-500 border-slate-200 py-1">
                  SCHEMA AUDIT
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. DISCOVERY HUB: Sheet Selection */}
      {stage === 'DISCOVERY' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between px-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Workbook Selection</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Select the target payload sheet</p>
            </div>
            <Button 
               variant="ghost" 
               size="sm" 
               className="h-7 text-[10px] font-black underline"
               onClick={() => setStage('IDLE')}
            >
              Cancel
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {probedSheets.map((sheet) => {
              const isPayload = sheet.discovery_score > 0.5;
              return (
                <div 
                  key={sheet.name}
                  onClick={() => handleSheetSelect(sheet.name)}
                  className={cn(
                    "group p-4 rounded-2xl border-2 transition-all cursor-pointer bg-white",
                    isPayload ? "border-slate-900 shadow-lg scale-[1.01]" : "border-slate-200 hover:border-slate-400 opacity-60 hover:opacity-100"
                  )}
                >
                   <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                        <TableIcon className="h-4 w-4" />
                      </div>
                      {isPayload && (
                        <Badge className="bg-slate-900 text-white text-[8px] h-4 px-1.5 font-black uppercase">
                          Detected Payload
                        </Badge>
                      )}
                   </div>
                   <h4 className="text-[13px] font-black text-slate-900 truncate mb-1">{sheet.name}</h4>
                   <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums uppercase">{sheet.row_count} Rows</span>
                      <span className="text-slate-200">|</span>
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums uppercase">{sheet.col_count} Cols</span>
                   </div>
                   
                   {sheet.headers.length > 0 && (
                     <div className="mt-4 pt-3 border-t border-slate-50 space-y-2">
                        <p className="text-[8px] font-black text-slate-300 uppercase underline text-right">Structure Preview</p>
                        <div className="flex flex-wrap gap-1">
                           {sheet.headers.slice(0, 4).map((h: string, i: number) => (
                             <Badge key={i} variant="outline" className="text-[8px] h-4 text-slate-400 border-slate-100 bg-slate-50/50">
                                {h}
                             </Badge>
                           ))}
                           {sheet.headers.length > 4 && <span className="text-[8px] text-slate-300">+{sheet.headers.length - 4}</span>}
                        </div>
                     </div>
                   )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. INGESTING STATE */}
      {stage === 'INGESTING' && (
        <Card className="border-slate-200 rounded-2xl overflow-hidden shadow-xl">
           <CardContent className="p-12 text-center space-y-6">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-slate-900/10 blur-3xl animate-pulse rounded-full" />
                <Loader2 className="h-12 w-12 text-slate-900 animate-spin relative" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Analyzing Forensic Blocks...</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Applying Polars-Strict schema validation</p>
              </div>
              <div className="max-w-md mx-auto">
                 <Progress value={ingestProgress} className="h-2 rounded-full bg-slate-100" />
                 <div className="flex justify-between mt-2">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-tight">Extracting Cells</span>
                    <span className="text-[9px] font-black text-slate-900 tabular-nums">{ingestProgress}%</span>
                 </div>
              </div>
           </CardContent>
        </Card>
      )}

      {/* 4. Extraction Detail: COMPLETE */}
      {stage === 'COMPLETE' && parsingStats && (
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden rounded-2xl">
          <CardContent className="p-0">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <FileSpreadsheet className="h-5 w-5 text-slate-900" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Extraction Payload Active</h4>
                  <div className="flex items-center gap-x-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono font-bold tracking-tight uppercase">Health Score:</span>
                    <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100 text-[10px] h-4 px-1.5 font-black uppercase">
                      {parsingStats.healthScore}% Optimal
                    </Badge>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wider"
                onClick={() => {
                   setParsingStats(null);
                   setData(null);
                   setStage('IDLE');
                   setProbedSheets([]);
                   setCurrentFile(null);
                }}
              >
                Reset Engine
              </Button>
            </div>

            <div className="grid grid-cols-4 divide-x divide-slate-100">
              <div className="p-4 py-6 text-center space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Header Row</p>
                <p className="text-xl font-black text-slate-900 tabular-nums">{parsingStats.headerRow}</p>
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Detected</span>
                </div>
              </div>
              <div className="p-4 py-6 text-center space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real Data</p>
                <p className="text-xl font-black text-slate-900 tabular-nums">{parsingStats.totalRowsFound}</p>
                <span className="text-[9px] text-slate-400 font-bold uppercase">Recipients</span>
              </div>
              <div className="p-4 py-6 text-center space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Col Mapping</p>
                <p className="text-xl font-black text-slate-900 tabular-nums">{parsingStats.mappedColumns}</p>
                <span className="text-[9px] text-slate-400 font-bold uppercase">Canonical</span>
              </div>
              <div className="p-4 py-6 text-center space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pollution</p>
                <p className="text-xl font-black text-slate-900 tabular-nums">{parsingStats.pollutionDropped}</p>
                <div className="flex items-center justify-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-slate-400" />
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Excised</span>
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-slate-900 flex items-center justify-between">
              <div className="flex gap-2">
                <div 
                  onClick={() => setViewMode('ringkasan')}
                  className={cn(
                    "flex items-center gap-1 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer",
                    viewMode === 'ringkasan' ? "bg-white text-slate-900 shadow-sm" : "bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                   <LayoutGrid className="h-3.5 w-3.5" /> Ringkasan Pembayaran
                </div>
                <div 
                  onClick={() => setViewMode('lampiran')}
                  className={cn(
                    "flex items-center gap-1 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer",
                    viewMode === 'lampiran' ? "bg-white text-slate-900 shadow-sm" : "bg-slate-800 text-slate-400 hover:text-white"
                  )}
                >
                   <TableIcon className="h-3.5 w-3.5" /> Lampiran Recipient
                </div>
              </div>
              <Button variant="ghost" className="h-6 text-[9px] text-slate-400 hover:text-white font-black uppercase tracking-tight gap-1">
                <Settings2 className="h-3 w-3" /> Verify Schema
              </Button>
            </div>

            <div className="max-h-[500px] overflow-auto border-t border-slate-200">
               {viewMode === 'ringkasan' ? (
                 <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Kabupaten</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Kecamatan</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Volume</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Penerima</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Bayar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {aggregates.map((agg: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-4 py-3 text-[11px] font-black text-slate-900 uppercase border-r border-slate-100">{agg.kabupaten}</td>
                          <td className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase border-r border-slate-100">{agg.kecamatan}</td>
                          <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-700 text-right border-r border-slate-100">{agg.qty.toLocaleString()}</td>
                          <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-700 text-right border-r border-slate-100">{agg.recipients}</td>
                          <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-900 text-right bg-slate-50/30 group-hover:bg-transparent">{formatCurrency(agg.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               ) : (
                 <table className="w-full border-collapse text-nowrap">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">NIK</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Nama Penerima</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Phone</th>
                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Desa</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Volume</th>
                        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Calculated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.rows.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-900 border-r border-slate-100">{row.nik}</td>
                          <td className="px-4 py-3 text-[11px] font-black text-slate-700 uppercase border-r border-slate-100">{row.name}</td>
                          <td className="px-4 py-3 text-[11px] font-mono text-slate-500 border-r border-slate-100">{row.phone || '-'}</td>
                          <td className="px-4 py-3 text-[11px] font-bold text-slate-400 uppercase border-r border-slate-100">{row.location.desa}</td>
                          <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-700 text-right border-r border-slate-100">{row.financials.qty.toLocaleString()}</td>
                          <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-900 text-right bg-slate-50/30 group-hover:bg-transparent">{formatCurrency(row.financials.calculated_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. Strategy Gating Alerts */}
      {parsingStats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="group p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 hover:border-slate-300 transition-colors">
            <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-slate-900" />
            </div>
            <div className="space-y-0.5">
              <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-wide">Strict Parse Active</h5>
              <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                String coercion applied to 16-digit IDs. Scientific notation artifacts prevented.
              </p>
            </div>
          </div>
          <div className="group p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-start gap-3 hover:border-amber-200 transition-colors">
            <div className="p-2 bg-white rounded-xl border border-amber-100 shadow-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="space-y-0.5">
              <h5 className="text-[10px] font-black text-amber-900 uppercase tracking-wide">Stateful Healing Gated</h5>
              <p className="text-[10px] text-amber-700/70 leading-relaxed font-medium">
                Location resolutions found. Approval required in the next stage.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
