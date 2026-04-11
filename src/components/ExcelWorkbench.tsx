import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
    FileSpreadsheet, AlertCircle, CheckCircle2, Wand2, Download, Trash2, 
    Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter,
    Eye, EyeOff, XCircle, ShieldAlert, ArrowUpDown, RotateCcw,
    CornerDownLeft, Info, RefreshCcw, PlusCircle, ChevronDown, ExternalLink
} from 'lucide-react';
import Decimal from 'decimal.js';
import { 
    ingestWorkbook, 
    extractSheetMetadata, 
    processMappedData, 
    applyMagicBalance, 
    ExcelRow 
} from '../lib/excelParser';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { 
    Table, TableHeader, TableBody, TableHead, TableRow, TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useMasterDataStore } from '../lib/masterDataStore';

const formatIDR = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

const TablePagination = ({ 
  currentPage, 
  totalPages, 
  itemsPerPage, 
  setItemsPerPage, 
  setCurrentPage, 
  totalRecords 
}: any) => {
  return (
    <div className="flex items-center justify-between p-2 px-4 bg-slate-50/50 border-y">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Per page:</span>
           <Select value={itemsPerPage > 500 ? 'all' : String(itemsPerPage)} onValueChange={(val) => { 
             setItemsPerPage(val === 'all' ? 1000000 : Number(val)); 
             setCurrentPage(1); 
           }}>
              <SelectTrigger className="h-8 w-[70px] text-[11px] font-bold bg-white ring-1 ring-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">ALL</SelectItem>
              </SelectContent>
           </Select>
        </div>
        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase whitespace-nowrap hidden sm:block">
           {totalRecords} RECORDS
        </span>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
          <ChevronsLeft size={16}/>
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}>
          <ChevronLeft size={16}/>
        </Button>
        
        <div className="flex items-center gap-2 mx-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase">Page</span>
          <Input 
            className="h-8 w-12 text-center text-[11px] font-bold p-0 bg-white ring-1 ring-slate-200" 
            value={currentPage}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val) && val > 0 && val <= totalPages) setCurrentPage(val);
            }}
          />
          <span className="text-[10px] font-bold text-slate-500 uppercase">of {totalPages || 1}</span>
        </div>

        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p: number) => Math.min(totalPages || 1, p + 1))}>
          <ChevronRight size={16}/>
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
          <ChevronsRight size={16}/>
        </Button>
      </div>
    </div>
  );
};

interface ExcelWorkbenchProps {
  recipients: ExcelRow[];
  onDataLoaded: (rows: ExcelRow[]) => void;
  globalConfig: any;
  setGlobalConfig: (config: any) => void;
  globalNIKRegistry?: Map<string, { id: string, name: string }[]>;
  currentContractId?: string;
}

export const ExcelWorkbench: React.FC<ExcelWorkbenchProps> = ({
    recipients: rows,
    onDataLoaded,
    globalConfig,
    setGlobalConfig,
    globalNIKRegistry,
    currentContractId
}) => {

  const [isProcessing, setIsProcessing] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>(null);
  const [totalTarget, setTotalTarget] = useState(new Decimal(0));
  const [discoveredHeaders, setDiscoveredHeaders] = useState<string[]>([]);
  
  const { resolveHierarchy } = useMasterDataStore();

  const processedRows = useMemo(() => {
    if (rows.length === 0) return [];
    const getFingerprint = (r: ExcelRow) => `${r.nik}-${r.name}-${r.village}-${r.qty}-${r.unitPrice}-${r.shipping}-${r.targetValue}`;
    const fingerCounts = new Map<string, number>();
    const nikCounts = new Map<string, number>();
    
    rows.forEach(r => {
        const finger = getFingerprint(r);
        fingerCounts.set(finger, (fingerCounts.get(finger) || 0) + 1);
        nikCounts.set(r.nik, (nikCounts.get(r.nik) || 0) + 1);
    });

    const fingerSeen = new Set<string>();
    
    return rows.map(r => {
        const finger = getFingerprint(r);
        let status: 'unique' | 'partial' | 'exact' = 'unique';
        let isGlobalDouble = false;
        let otherContracts: any[] = [];

        // Local Duplicate Check (within this contract)
        if ((fingerCounts.get(finger) || 0) > 1) {
            if (fingerSeen.has(finger)) { status = 'exact'; } 
            else { status = 'unique'; fingerSeen.add(finger); }
        } else if ((nikCounts.get(r.nik) || 0) > 1) {
            status = 'partial';
        }

        // Global Duplicate Check (across other contracts)
        if (globalNIKRegistry && r.nik) {
            const matches = globalNIKRegistry.get(r.nik) || [];
            otherContracts = matches.filter(m => m.id !== currentContractId);
            if (otherContracts.length > 0) {
                isGlobalDouble = true;
            }
        }

        return { ...r, duplicateStatus: status, isGlobalDouble, otherContracts };
    });
  }, [rows, globalNIKRegistry, currentContractId]);

  useEffect(() => {
    if (rows.length > 0) {
      const sum = rows.filter(r => !r.isExcluded).reduce((acc, r) => acc.plus(new Decimal(r.targetValue || 0)), new Decimal(0));
      setTotalTarget(sum);
    }
  }, [rows]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = ingestWorkbook(buffer);
      const metadata = extractSheetMetadata(wb, wb.SheetNames[0]);
      const result = processMappedData(metadata, metadata.suggestedMap, resolveHierarchy);
      setDiscoveredHeaders(result.discoveredHeaders);
      onDataLoaded(result.rows);
      setCurrentPage(1);
      toast.success(`Success! Imported ${result.rows.length} rows.`);
    } catch (error: any) {
      toast.error(error.message || 'Excel Import Failed');
    } finally { setIsProcessing(false); }
  }, [onDataLoaded, resolveHierarchy]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }, multiple: false });

  const activeRows = rows.filter(r => !r.isExcluded);
  const currentSum = activeRows.reduce((acc, row) => acc.plus(new Decimal(row.calculatedValue)), new Decimal(0));
  const targetVal = totalTarget.isZero() && activeRows.length > 0 ? activeRows.reduce((acc, r) => acc.plus(new Decimal(r.targetValue || 0)), new Decimal(0)) : totalTarget;
  const gap = currentSum.minus(targetVal);
  const isBalanced = gap.abs().lessThan(1);

  const displayRows = useMemo(() => {
    let result = [...processedRows];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.nik.includes(q) || 
        r.name?.toLowerCase().includes(q) || 
        Object.values(r.columnData).some(v => String(v).toLowerCase().includes(q))
      );
    }
    if (sortConfig) {
      result.sort((a: any, b: any) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (typeof valA === 'string') return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      });
    }
    return result;
  }, [processedRows, searchQuery, sortConfig]);

  const totalPages = Math.ceil(displayRows.length / itemsPerPage);
  const paginatedRows = displayRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCellEdit = (rowId: string, header: string, value: any) => {
    const updated = rows.map(r => {
        if (r.rowId === rowId) {
            const newColumnData = { ...r.columnData, [header]: value };
            const nr = { ...r, columnData: newColumnData };
            
            // Re-sync basic fields if they match mapped columns
            if (header.toLowerCase().includes('nik')) nr.nik = String(value).replace(/\D/g, '');
            if (header.toLowerCase().includes('nama') || header.toLowerCase().includes('ketua')) nr.name = value;
            
            return nr;
        }
        return r;
    });
    onDataLoaded(updated);
  };

  const resetCell = (rowId: string, header: string) => {
    const updated = rows.map(r => {
        if (r.rowId === rowId) {
            return { ...r, columnData: { ...r.columnData, [header]: r.originalValues.columnData[header] } };
        }
        return r;
    });
    onDataLoaded(updated);
  };

  const resetRow = (rowId: string) => onDataLoaded(rows.map(r => (r.rowId === rowId ? { ...r.originalValues as ExcelRow } : r)));
  
  const resetAll = () => {
    if (window.confirm("ARE YOU SURE? This will revert ALL manual edits to the original Excel data.")) {
        onDataLoaded(rows.map(r => ({ ...r.originalValues as ExcelRow })));
        toast.success("All data reset to original");
    }
  };

  const clearWorkbench = () => {
    if (window.confirm("Delete all imported data and start over?")) {
        onDataLoaded([]);
        setDiscoveredHeaders([]);
        toast.info("Workbench cleared");
    }
  };

  const handleSort = (key: string) => setSortConfig(prev => ({ key, direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  const toggleExclude = (rowId: string) => onDataLoaded(rows.map(r => r.rowId === rowId ? { ...r, isExcluded: !r.isExcluded } : r));
  
  const handleMagicBalance = () => {
    onDataLoaded(applyMagicBalance(rows, targetVal));
    toast.success("Magic Balance Complete");
  };

  return (
    <div className="flex flex-col gap-4 w-full p-4 bg-slate-50/20">
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Distribution Workbench</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                Reconcile Excel payload with contract values
                <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[9px] h-4 uppercase">{rows.length} Rows</Badge>
              </CardDescription>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" onClick={clearWorkbench} className="h-8 gap-2 text-[10px] font-bold border-slate-200 text-red-600 hover:bg-red-50">
                  <Trash2 size={12} /> CLEAR DATA
               </Button>
               <Button variant="outline" size="sm" onClick={resetAll} className="h-8 gap-2 text-[10px] font-bold border-slate-200">
                  <RotateCcw size={12} /> RESET ALL
               </Button>
               <Button size="sm" onClick={handleMagicBalance} disabled={isBalanced} className={cn("h-8 gap-2 text-[10px] font-bold", isBalanced ? "bg-slate-100 text-slate-400" : "bg-black text-white hover:bg-zinc-800")}>
                  <Wand2 size={12} /> AUTO-BALANCE
               </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
             <StatItem label="Contract Pagu" value={formatIDR(targetVal.toNumber())} icon={<FileSpreadsheet size={15}/>} status="info" />
             <StatItem label="Active Total" value={formatIDR(currentSum.toNumber())} icon={<CheckCircle2 size={15}/>} status="default" />
             <StatItem label="Differential" value={formatIDR(gap.toNumber())} icon={<Filter size={15}/>} status={gap.isZero() ? "success" : "warning"} />
             <StatItem label="Status" value={isBalanced ? "SYNCED" : "UNBALANCED"} status={isBalanced ? "success" : "warning"} isStatus />
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <div {...getRootProps()} className={cn("flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed rounded-xl transition-all gap-4 bg-white/50", isDragActive ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200 hover:bg-white")}>
          <input {...getInputProps()} />
          <FileSpreadsheet size={40} className="text-slate-300" />
          <p className="font-semibold text-slate-900">Upload Excel Distribution Payload</p>
          <Button variant="outline" className="mt-2">Select XLSX File</Button>
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
          <div className="flex justify-between items-center p-3 px-4 border-b">
             <div className="relative w-full max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input placeholder="Search records..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} className="pl-9 h-9 text-[13px] bg-slate-50/50" />
             </div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">
                Precision Distribution Workbench
             </div>
          </div>
          <TablePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
            setCurrentPage={setCurrentPage}
            totalRecords={displayRows.length}
          />
          <ScrollArea className="w-full">
            <div className="min-w-fit">
              <Table>
                <TableHeader className="admin-table-header sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-20 px-4">TOOLS</TableHead>
                    <TableHead className="w-16 text-center">AUDIT</TableHead>
                    {discoveredHeaders.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tighter border-l border-slate-100 first:border-none">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRows.map((row) => (
                    <TableRow key={row.rowId} className={cn("hover:bg-slate-50/50 transition-colors h-10", row.isExcluded && "opacity-40 grayscale bg-slate-50")}>
                      <TableCell className="px-4 py-1">
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm" onClick={() => toggleExclude(row.rowId)} title="Toggle Exclude">
                               {row.isExcluded ? <EyeOff size={13} /> : <Eye size={13} />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm" onClick={() => resetRow(row.rowId)} title="Reset Row">
                               <RotateCcw size={13} className="text-slate-400" />
                            </Button>
                         </div>
                      </TableCell>
                      <TableCell className="text-center p-0">
                         <div className="flex flex-col items-center gap-0.5 group relative">
                            <AuditPill status={row.isExcluded ? 'grey' : row.isGlobalDouble ? 'red' : row.duplicateStatus === 'exact' ? 'orange' : row.isSynced ? 'green' : 'red'} />
                            {row.duplicateStatus === 'exact' && <span className="text-[8px] font-black text-orange-600 leading-none">DBL</span>}
                            {row.isGlobalDouble && (
                                <>
                                    <span className="text-[8px] font-black text-red-600 leading-none">GLOB</span>
                                    <div className="absolute left-full top-0 ml-2 hidden group-hover:block z-50 bg-white border border-slate-200 shadow-xl rounded-lg p-3 min-w-[200px] text-left">
                                        <div className="flex items-center gap-2 text-red-600 mb-2">
                                            <ShieldAlert size={14} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Global Duplicate Detected</span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mb-2">This NIK is already registered in:</p>
                                        <div className="space-y-1">
                                            {row.otherContracts?.map((c: any) => (
                                                <div key={c.id} className="text-[10px] font-mono bg-slate-50 p-1.5 rounded border border-slate-100 flex items-center justify-between">
                                                    <span className="truncate max-w-[120px]">{c.name}</span>
                                                    <ExternalLink size={10} className="text-slate-400" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                         </div>
                      </TableCell>
                      {discoveredHeaders.map((h) => (
                         <TableCell key={h} className="p-0 border-l border-slate-100 min-w-[120px] group relative">
                            <input 
                              value={row.columnData[h] ?? ''} 
                              onChange={(e) => handleCellEdit(row.rowId, h, e.target.value)}
                              onDoubleClick={() => resetCell(row.rowId, h)}
                              className={cn(
                                "w-full h-10 px-3 bg-transparent border-none text-[11px] font-medium transition-all focus:bg-white focus:ring-1 focus:ring-inset focus:ring-black",
                                row.columnData[h] !== row.originalValues.columnData[h] && "bg-amber-50/30 text-amber-900 font-bold"
                              )}
                              title="Double click to reset cell"
                            />
                            {row.columnData[h] !== row.originalValues.columnData[h] && (
                                <div className="absolute right-1 top-1 w-1 h-1 rounded-full bg-amber-500" />
                            )}
                         </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <TablePagination 
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            setItemsPerPage={setItemsPerPage}
            setCurrentPage={setCurrentPage}
            totalRecords={displayRows.length}
          />
        </Card>
      )}
    </div>
  );
};

const StatItem = ({ label, value, subValue, icon, status, isStatus }: any) => {
    const statusStyles: any = {
        default: "bg-white border-slate-200 text-slate-900",
        info: "bg-slate-50 border-slate-200 text-slate-900",
        success: "bg-slate-950 border-black text-white",
        warning: "bg-white border-zinc-200 text-slate-900"
    };
    return (
        <div className={cn("p-4 rounded-xl border flex flex-col gap-1 transition-all", statusStyles[status] || statusStyles.default)}>
            <div className={cn("flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60", status === 'success' && "opacity-80")}>
                {icon} {label}
            </div>
            <div className={cn("text-xl font-bold tracking-tight tabular-nums", isStatus && "text-base")}>{value}</div>
            {subValue && <div className="text-[10px] font-medium opacity-60 uppercase">{subValue}</div>}
        </div>
    );
};

const SortableHead = ({ label, field, config, onSort, center, right }: any) => (
    <TableHead onClick={() => onSort(field)} className={cn("h-10 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-black transition-colors px-6", center && "text-center", right && "text-right")}>
        <div className={cn("flex items-center gap-1.5", center && "justify-center", right && "justify-end")}>
            {label} 
            <ArrowUpDown size={10} className={cn(config?.key === field ? "opacity-100 text-black" : "opacity-0")} />
        </div>
    </TableHead>
);

const AuditPill = ({ status }: { status: 'green' | 'orange' | 'grey' | 'red' }) => {
    const styles = {
        green: "bg-black text-white border-black",
        orange: "bg-zinc-100 text-zinc-900 border-zinc-200 shadow-inner",
        grey: "bg-slate-50 text-slate-300 border-slate-100",
        red: "bg-white text-black border-zinc-900"
    };
    return (
        <div className={cn("inline-flex items-center justify-center w-5 h-5 rounded border text-[10px] font-mono font-black shadow-sm", styles[status])}>
            {status === 'green' ? "S" : status === 'orange' ? "!" : status === 'grey' ? "×" : "!"}
        </div>
    );
};

export default ExcelWorkbench;
