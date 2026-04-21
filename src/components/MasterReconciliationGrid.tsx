import React, { useMemo, useState, useEffect } from 'react';
import { ContractData } from '../lib/contractStore';
import { generateMasterImportList, MasterRow } from '../lib/auditEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { 
    CheckCircle2, AlertTriangle, XCircle, FileText, 
    Download, Search, RefreshCcw, Loader2, Info, Eye
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';
import ExcelJS from 'exceljs';

interface MasterReconciliationGridProps {
  contract: ContractData;
}

export const MasterReconciliationGrid: React.FC<MasterReconciliationGridProps> = ({ contract }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [data, setData] = useState<MasterRow[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Auto-sync on load or when source data changes
  useEffect(() => {
    handleSync();
  }, [contract.recipients?.length, contract.deliveryBlocks?.length]);

  const handleSync = () => {
    setIsSyncing(true);
    try {
        const masterList = generateMasterImportList(contract);
        setData(masterList);
        if (masterList.length > 0) {
            toast.success(`Consolidated ${masterList.length} unique distribution records.`);
        }
    } catch (e) {
        console.error(e);
        toast.error("Failed to consolidate data.");
    } finally {
        setIsSyncing(false);
    }
  };

  const handleExportExcel = async () => {
    const validData = data.filter(r => r.is_valid);
    
    if (validData.length === 0) {
      toast.error("No valid records to export. Please fix high-severity issues first.");
      return;
    }

    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data Penyaluran');

      // 1. Column Definitions (Strict Schema)
      worksheet.columns = [
        { header: 'no', key: 'no', width: 5 },
        { header: 'provinsi', key: 'provinsi', width: 20 },
        { header: 'kota', key: 'kota', width: 20 },
        { header: 'kecamatan', key: 'kecamatan', width: 20 },
        { header: 'desa', key: 'desa', width: 20 },
        { header: 'gapoktan', key: 'gapoktan', width: 30 },
        { header: 'barang', key: 'barang', width: 20 },
        { header: 'qty', key: 'qty', width: 10 },
        { header: 'nilai', key: 'nilai', width: 15 },
        { header: 'nik_penerima', key: 'nik_penerima', width: 25 },
        { header: 'qty_disalurkan', key: 'qty_disalurkan', width: 15 },
        { header: 'nilai_disalurkan', key: 'nilai_disalurkan', width: 15 }
      ];

      // 2. Formatting - Set Header Style
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // 3. Add Data with Strict Formatting
      validData.forEach(row => {
        const sheetRow = worksheet.addRow({
          no: row.no,
          provinsi: row.provinsi,
          kota: row.kota,
          kecamatan: row.kecamatan,
          desa: row.desa,
          gapoktan: row.gapoktan,
          barang: row.barang,
          qty: row.qty,
          nilai: row.nilai,
          nik_penerima: row.nik_penerima, // ExcelJS handles strings as Text by default
          qty_disalurkan: row.qty_disalurkan,
          nilai_disalurkan: row.nilai_disalurkan
        });

        // Forced Formatting for NIK (Text) and Financials (Number)
        sheetRow.getCell('nik_penerima').numFmt = '@'; // Force Text
        sheetRow.getCell('qty').numFmt = '#,##0';
        sheetRow.getCell('nilai').numFmt = '#,##0';
        sheetRow.getCell('qty_disalurkan').numFmt = '#,##0';
        sheetRow.getCell('nilai_disalurkan').numFmt = '#,##0';
      });

      // 4. Finalize & Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Import_Penyaluran_${contract.name.replace(/\s+/g, '_')}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${validData.length} records in official BAKU format.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate Excel file.");
    } finally {
      setIsExporting(false);
    }
  };

  const stats = useMemo(() => {
    return {
        total: data.length,
        valid: data.filter(r => r.is_valid).length,
        issues: data.reduce((acc, row) => acc + row.issues.length, 0)
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200">
          <CardContent className="pt-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Master Records</p>
            <div className="flex items-end justify-between">
                <h3 className="text-2xl font-black font-mono">{stats.total}</h3>
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100">Consolidated</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="pt-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Verified (Ready)</p>
            <div className="flex items-end justify-between">
                <h3 className="text-2xl font-black font-mono text-emerald-600">{stats.valid}</h3>
                <div className="text-[10px] text-emerald-500 font-bold">NIK ValidATED</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="pt-6">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Audit Flags</p>
            <div className="flex items-end justify-between">
                <h3 className={cn("text-2xl font-black font-mono", stats.issues > 0 ? "text-amber-500" : "text-slate-300")}>
                    {stats.issues}
                </h3>
                <AlertTriangle size={16} className={stats.issues > 0 ? "text-amber-400" : "text-slate-300"} />
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center gap-2 pl-2">
            <Button 
                variant="outline" 
                className="flex-1 h-full bg-black text-white hover:bg-zinc-800 hover:text-white border-none font-bold gap-2"
                onClick={handleExportExcel}
                disabled={isExporting || data.length === 0}
            >
                {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                Export Portal Template
            </Button>
            <Button 
                variant="outline" 
                size="icon"
                className="h-full px-4 border-slate-200 hover:bg-slate-50"
                onClick={handleSync}
                disabled={isSyncing}
            >
                <RefreshCcw size={16} className={cn(isSyncing && "animate-spin")} />
            </Button>
        </div>
      </div>

      {/* Main Reconciliation Table */}
      <Card className="border-slate-200 shadow-xl overflow-hidden bg-white">
        <CardHeader className="px-6 py-4 border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                        Rincian Penyaluran (Portal Mirror)
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                        Consolidated data ready for Government Portal import. (Only verified rows will be exported).
                    </CardDescription>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                   <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> RECONCILED</div>
                   <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> MISSING NIK</div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto scrollbar-thin scrollbar-thumb-slate-200">
            <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b">
                <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 text-center text-[10px] font-bold uppercase text-slate-400">#</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-400">GAPOKTAN / PENERIMA</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-400">NIK PENERIMA</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-400">LOCATION (DESA/KEC)</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-400 text-right">QTY (BASE/DISALURKAN)</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-slate-400">STATUS</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                <AnimatePresence mode="popLayout">
                    {data.map((row, idx) => (
                        <motion.tr 
                            key={row.nik_penerima}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: idx * 0.02 }}
                            className={cn(
                                "group border-b hover:bg-slate-50/80 transition-colors",
                                !row.is_valid && "bg-red-50/30"
                            )}
                        >
                            <TableCell className="text-center font-mono text-[10px] text-slate-400">
                                {idx + 1}
                            </TableCell>
                            <TableCell className="py-4">
                                <div className="font-bold text-[13px] text-slate-900 leading-tight mb-0.5">{row.gapoktan}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">{row.barang}</div>
                            </TableCell>
                            <TableCell>
                                <div className={cn(
                                    "font-mono text-xs tracking-tighter",
                                    row.issues.some(i => i.type === 'INVALID_NIK') ? "text-red-500 font-bold" : "text-slate-600"
                                )}>
                                    {row.nik_penerima}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="text-[11px] font-medium text-slate-700">{row.desa}</div>
                                <div className="text-[10px] text-slate-400">{row.kecamatan}</div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                    <div className="font-bold text-[13px] text-slate-900">
                                        {row.qty_disalurkan} / {row.qty}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                        Rp {row.nilai_disalurkan.toLocaleString('id-ID')}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    {row.is_valid ? (
                                        <Badge className="w-fit bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-50 text-[10px] font-bold">
                                            READY TO IMPORT
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="w-fit text-[10px] font-bold">
                                            ACTION REQUIRED
                                        </Badge>
                                    )}
                                    
                                    {row.issues.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {row.issues.map((issue, i) => (
                                                <div key={i} className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                                    {issue.type === 'NAME_FUZZY_MATCH' && <RefreshCcw size={10} className="text-amber-500" />}
                                                    {issue.type === 'INVALID_NIK' && <XCircle size={10} className="text-red-500" />}
                                                    {issue.type}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                        </motion.tr>
                    ))}
                </AnimatePresence>
                </TableBody>
            </Table>
            {data.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-slate-200" />
                    <p className="font-bold text-sm uppercase tracking-widest">Awaiting Data Consolidation...</p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer Instructions */}
      <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl text-white">
          <div className="p-3 bg-white/10 rounded-lg">
              <Info className="text-blue-400" />
          </div>
          <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Audit Compliance Instructions</p>
              <p className="text-[11px] text-slate-300">
                  Rows highlighted in <span className="text-red-400 font-bold">RED</span> are missing critical NIK data and will be excluded from the export. 
                  Update the Excel spreadsheet in Section 2 to resolve these issues before finalizing the import bundle.
              </p>
          </div>
      </div>
    </div>
  );
};
