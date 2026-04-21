import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const GOVERNMENT_SCHEMA = [
  "Provinsi", "Kota", "Kecamatan", "Kel / Desa", 
  "Dinas / Gapoktan / Brigade", "Barang", "Qty", "Nilai", 
  "NIK Penerima", "Qty Disalurkan", "Nilai Disalurkan"
];

interface ImportMapperProps {
  onMappingComplete: (data: any[]) => void;
}

export const ImportMapper: React.FC<ImportMapperProps> = ({ onMappingComplete }) => {
  const [fileData, setFileData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const bstr = e.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      if (data.length > 0) {
        setFileData(data);
        const discoveredHeaders = Object.keys(data[0] as object);
        setHeaders(discoveredHeaders);
        
        // Auto-match logic
        const newMapping: Record<string, string> = {};
        discoveredHeaders.forEach(h => {
          const match = GOVERNMENT_SCHEMA.find(s => 
            h.toLowerCase().includes(s.toLowerCase()) || 
            s.toLowerCase().includes(h.toLowerCase())
          );
          if (match) newMapping[match] = h;
        });
        setMapping(newMapping);
        toast.success(`Discovered ${discoveredHeaders.length} columns`);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false 
  });

  const handleApplyMapping = () => {
    setIsProcessing(true);
    try {
      const mappedData = fileData.map((row, idx) => {
        const newRow: any = { id: `mapped-${idx}` };
        Object.entries(mapping).forEach(([govField, vendorField]) => {
          newRow[govField] = row[vendorField];
        });
        return newRow;
      });
      onMappingComplete(mappedData);
      toast.success("Mapping applied successfully");
    } catch (e) {
      toast.error("Mapping failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      {fileData.length === 0 ? (
        <div {...getRootProps()} className={cn(
          "flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all",
          isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300 bg-white"
        )}>
          <input {...getInputProps()} />
          <div className="p-4 bg-slate-50 rounded-full border border-slate-100">
            <FileSpreadsheet className="size-10 text-slate-400" />
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-900">Drop Vendor Excel Here</p>
            <p className="text-xs text-slate-500 mt-1 uppercase font-black tracking-widest">Any Format Allowed</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-400 mb-1">Active Mapping</h3>
              <p className="text-sm font-bold text-slate-900">{headers.length} Source Columns Identified</p>
            </div>
            <Button onClick={handleApplyMapping} className="bg-black hover:bg-zinc-800 text-white font-bold px-8 rounded-full h-9 uppercase text-[10px] tracking-widest shadow-lg">
              {isProcessing ? <Loader2 className="animate-spin" /> : "Apply & Sync"}
            </Button>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden">
            {/* Government Schema (Left) */}
            <div className="bg-slate-50/50 rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
              <div className="px-6 py-3 border-b bg-white/50 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-green-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Standard Columns</span>
              </div>
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-3">
                  {GOVERNMENT_SCHEMA.map(field => (
                    <div key={field} className="flex flex-col gap-1.5 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <label className="text-[10px] font-black text-slate-400 uppercase">{field}</label>
                      <select 
                        value={mapping[field] || ''} 
                        onChange={(e) => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                        className="bg-slate-50 border-none text-[11px] font-bold text-slate-900 focus:ring-2 ring-indigo-500 rounded-md p-1"
                      >
                        <option value="">-- No Match --</option>
                        {headers.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Preview (Right) */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 flex flex-col overflow-hidden text-white">
              <div className="px-6 py-3 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
                <AlertCircle className="size-4 text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Preview</span>
              </div>
              <ScrollArea className="flex-1 p-6 font-mono text-[10px]">
                <pre className="opacity-80">
                  {JSON.stringify(fileData.slice(0, 3), null, 2)}
                </pre>
                <div className="mt-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300">
                  Showing first 3 records from source file.
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
