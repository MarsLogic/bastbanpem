import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
    FileText, ZoomIn, ZoomOut, Maximize2, Minimize2,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, FileUp,
    LayoutDashboard, BookOpen, UserCheck, Table as TableIcon, ShieldAlert, Zap, Globe
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractData } from '../lib/contractStore';
import { toast } from "sonner";
import { Document, Page, pdfjs } from 'react-pdf';
import { parsePdfFile, saveContract } from '../lib/api';
import { getPdfBlob, savePdfBlob } from '../lib/pdfStorage';
import { SectionViewer } from './pdf-sync/SectionViewer';
import { TableViewer } from './pdf-sync/TableViewer';
import { RecipientCards } from './pdf-sync/RecipientCards';
import { ComplianceDashboard } from './pdf-sync/ComplianceDashboard';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfSyncModuleProps {
  contract: ContractData;
  onUpdate: (updates: Partial<ContractData>) => void;
}

export const PdfSyncModule: React.FC<PdfSyncModuleProps> = ({ contract, onUpdate }) => {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isExtracting, setIsExtracting] = useState(false);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState<number>(850);
  const [pdfLoadStatus, setPdfLoadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const hydratePdf = async () => {
      if (blobUrl) return; 
      setPdfLoadStatus('loading');
      if (contract.pdfBlob instanceof Blob) {
        setBlobUrl(URL.createObjectURL(contract.pdfBlob));
        setPdfLoadStatus('success');
      } else if (contract.contractPdfPath) {
        const storedBlob = await getPdfBlob(contract.id);
        if (storedBlob instanceof Blob) {
          setBlobUrl(URL.createObjectURL(storedBlob));
          setPdfLoadStatus('success');
        } else {
          setPdfLoadStatus('error');
          setPdfLoadError('PDF not found.');
        }
      } else {
        setPdfLoadStatus('idle');
      }
    };
    hydratePdf();
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [contract.id, contract.pdfBlob, contract.contractPdfPath, blobUrl]);

  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type === 'application/pdf') {
      setBlobUrl(URL.createObjectURL(file));
      setPdfLoadStatus('success');
      onUpdate({ contractPdfPath: file.name, pdfBlob: file, deliveryBlocks: [], recipients: [] });
      await savePdfBlob(contract.id, file, file.name);
      toast.info(`Engine Linked: ${file.name}`);
    }
  };

  const handleAutoExtract = async () => {
    const file = contract.pdfBlob instanceof Blob ? contract.pdfBlob : null;
    if (!file) return toast.error("Upload PDF first.");
    setIsExtracting(true);
    try {
      toast.info("Activating Ultra-Robust AI Scanning Protocol...");
      const result = await parsePdfFile(file as File);
      const updates: any = { ultraRobust: result.ultra_robust, sections: result.metadata?.sections, fullText: result.metadata?.full_text, tables: result.tables };
      if (result.metadata?.nomor_kontrak) updates.nomorKontrak = result.metadata.nomor_kontrak;
      onUpdate(updates);
      await saveContract((result.metadata?.nomor_kontrak || 'UNK').replace(/\s+/g, '_'), result.metadata?.nomor_kontrak || 'UNK', 0, result.metadata);
      toast.success("Intelligence Extraction Complete.");
    } catch (err) { toast.error("Extraction failed."); } finally { setIsExtracting(false); }
  };

  const renderPdfViewer = (isFull: boolean) => (
    <div className={`flex flex-col relative bg-slate-900 ${isFull ? 'w-full h-full' : 'w-full border-b h-[700px]'}`}>
      <div className="p-2.5 border-b border-white/10 flex justify-between items-center bg-slate-950/80 backdrop-blur text-white z-10">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-2 py-0 h-5 text-[9px] font-black uppercase tracking-tighter">PDF Engine</Badge>
          <span className="text-[11px] font-bold truncate max-w-[200px] text-slate-300">
            {contract.contractPdfPath?.split(/[\\/]/).pop()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
           <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}><ZoomOut className="h-3.5 w-3.5" /></Button>
           <span className="text-[10px] font-mono w-8 text-center text-slate-500">{Math.round(scale * 100)}%</span>
           <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10" onClick={() => setScale(s => Math.min(3.0, s + 0.2))}><ZoomIn className="h-3.5 w-3.5" /></Button>
           <div className="w-[1px] h-3 bg-white/10 mx-1" />
           <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10" onClick={() => setIsFullscreen(!isFull)}>
             {isFull ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
           </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex justify-center p-6 custom-scrollbar">
        {blobUrl && <Document file={blobUrl} onLoadSuccess={(pdf) => setNumPages(pdf.numPages)}><Page pageNumber={pageNumber} scale={scale} renderAnnotationLayer={false} renderTextLayer={false} className="shadow-2xl ring-1 ring-white/10" /></Document>}
      </div>
      {numPages && numPages > 1 && (
        <div className="p-3 border-t border-white/5 bg-slate-950/90 flex justify-center items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10" disabled={pageNumber <= 1} onClick={() => setPageNumber(1)}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10" disabled={pageNumber <= 1} onClick={() => setPageNumber(p => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="bg-slate-900 border border-white/10 rounded-md px-4 py-1 flex items-center gap-2 mx-2 shadow-inner">
            <span className="text-[11px] font-black text-blue-500 tabular-nums">{pageNumber}</span>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">of</span>
            <span className="text-[11px] font-black text-slate-400 tabular-nums">{numPages}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10" disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10" disabled={pageNumber >= numPages} onClick={() => setPageNumber(numPages)}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full p-6 bg-[#f8fafc]">
      {!contract.contractPdfPath ? (
        <div className="p-16 text-center border-dashed border-2 border-slate-200 rounded-3xl bg-white shadow-xl flex flex-col items-center gap-6">
          <div className="p-5 bg-blue-50 rounded-full"><FileText className="h-12 w-12 text-blue-600" /></div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Connect Master PDF</h2>
            <p className="text-slate-500 max-w-sm">Attach the official Surat Pesanan PDF to activate the Ultra-Robust Intelligence Engine.</p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} size="lg" className="bg-slate-900 hover:bg-black text-white px-8 rounded-full shadow-lg transition-all hover:scale-105">
            <FileUp className="mr-2 h-5 w-5" /> Select File
          </Button>
          <input type="file" ref={fileInputRef} onChange={handlePdfFileSelect} accept=".pdf" className="hidden" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className={`flex flex-col bg-white border border-slate-200 shadow-2xl rounded-[32px] overflow-hidden ${isFullscreen ? 'fixed inset-4 z-[100] m-0 flex-row ring-[20px] ring-black/10' : ''}`}>
             {renderPdfViewer(isFullscreen)}
             {!isFullscreen && (
               <div className="w-full flex flex-col bg-white min-w-0" style={{ height: `${panelHeight}px` }}>
                  <div className="px-6 py-5 border-b flex justify-between items-center bg-white gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200"><LayoutDashboard className="h-6 w-6 text-white" /></div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Contract Intelligence</h3>
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[9px] h-5 tracking-tighter uppercase px-1.5">v2.5-ULTRA</Badge>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ground-Truth Audit System</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end gap-1 mr-2">
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Workspace Height</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-400 tabular-nums">{panelHeight}px</span>
                            <Slider min={600} max={1400} step={50} value={[panelHeight]} onValueChange={([v]) => setPanelHeight(v)} className="w-24" />
                          </div>
                        </div>
                        <Button onClick={handleAutoExtract} disabled={isExtracting} className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-6 rounded-2xl font-black text-[12px] shadow-lg shadow-blue-100 transition-all active:scale-95">
                            {isExtracting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <><Zap className="h-4 w-4 mr-2" /> RUN AI SCAN</>}
                        </Button>
                      </div>
                  </div>

                  <Tabs defaultValue="metadata" className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 py-3 border-b bg-slate-50/50">
                      <TabsList className="bg-slate-200/50 p-1.5 h-12 w-full justify-start rounded-2xl">
                        <TabsTrigger value="metadata" className="text-[11px] font-bold gap-2 flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"><ShieldAlert className="h-3.5 w-3.5" /> DASHBOARD</TabsTrigger>
                        <TabsTrigger value="sections" className="text-[11px] font-bold gap-2 flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"><BookOpen className="h-3.5 w-3.5" /> SECTIONS</TabsTrigger>
                        <TabsTrigger value="tables" className="text-[11px] font-bold gap-2 flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"><TableIcon className="h-3.5 w-3.5" /> TABLES {contract.tables?.length ? <Badge className="ml-1 h-4 px-1 text-[9px] bg-slate-400">{contract.tables.length}</Badge> : null}</TabsTrigger>
                        <TabsTrigger value="recipients" className="text-[11px] font-bold gap-2 flex-1 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"><Globe className="h-3.5 w-3.5" /> RPB LEDGER {contract.ultraRobust?.shipment_ledger?.length ? <Badge className="ml-1 h-4 px-1 text-[9px] bg-blue-500">{contract.ultraRobust.shipment_ledger.length}</Badge> : null}</TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden bg-white">
                      <TabsContent value="metadata" className="h-full m-0 flex flex-col">
                        {contract.ultraRobust ? (
                          <>
                            <ComplianceDashboard data={contract.ultraRobust} />
                            <ScrollArea className="flex-1 px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                                <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100 space-y-4 shadow-sm">
                                  <div className="flex items-center gap-2"><div className="w-1.5 h-4 bg-blue-500 rounded-full" /><span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Contract Identity</span></div>
                                  <div className="space-y-3">
                                    <div><Label className="text-[9px] font-bold text-slate-400 uppercase">Order Identifier</Label><div className="text-sm font-black text-slate-800 font-mono mt-0.5">{contract.ultraRobust.contract_header.order_id}</div></div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div><Label className="text-[9px] font-bold text-slate-400 uppercase">Timestamp</Label><div className="text-[11px] font-bold text-slate-600 mt-0.5">{contract.ultraRobust.contract_header.timestamp}</div></div>
                                      <div><Label className="text-[9px] font-bold text-slate-400 uppercase">Duration</Label><div className="text-[11px] font-bold text-slate-600 mt-0.5">{contract.ultraRobust.contract_header.duration_days} Days</div></div>
                                    </div>
                                  </div>
                                </div>
                                <div className="p-5 rounded-3xl bg-slate-50 border border-slate-100 space-y-4 shadow-sm">
                                  <div className="flex items-center gap-2"><div className="w-1.5 h-4 bg-amber-500 rounded-full" /><span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Vendor Context</span></div>
                                  <div className="space-y-3">
                                    <div><Label className="text-[9px] font-bold text-slate-400 uppercase">Penyedia (Pihak II)</Label><div className="text-[12px] font-black text-slate-800 mt-0.5">{contract.namaPenyedia || '—'}</div></div>
                                    <div><Label className="text-[9px] font-bold text-slate-400 uppercase">Pemesan (Pihak I)</Label><div className="text-[11px] font-bold text-slate-600 mt-0.5 truncate">{contract.namaPemesan || '—'}</div></div>
                                  </div>
                                </div>
                                {Object.keys(contract.ultraRobust.technical_specifications).length > 0 && (
                                  <div className="col-span-full p-5 rounded-3xl bg-slate-900 text-white space-y-4 shadow-xl">
                                    <div className="flex items-center gap-2"><div className="w-1.5 h-4 bg-emerald-400 rounded-full" /><span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Elite Technical Specs</span></div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                      {Object.entries(contract.ultraRobust.technical_specifications).map(([k, v]) => (
                                        <div key={k} className="border-l border-white/10 pl-3">
                                          <Label className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">{k.replace(/_/g, ' ')}</Label>
                                          <div className="text-[11px] font-black text-slate-200 mt-0.5 leading-tight">{v}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
                            <Zap className="h-12 w-12 text-slate-200 animate-pulse" />
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">Intelligence Offline</h4>
                              <p className="text-[11px] text-slate-400 max-w-xs mt-1">Run the AI Scan to populate the Ultra-Robust Dashboard with compliance flags and granular costs.</p>
                            </div>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="sections" className="h-full m-0 bg-slate-50/30"><SectionViewer sections={contract.sections ?? {}} fullText={contract.fullText} /></TabsContent>
                      <TabsContent value="tables" className="h-full m-0"><TableViewer tables={contract.tables ?? []} /></TabsContent>
                      <TabsContent value="recipients" className="h-full m-0"><RecipientCards ledger={contract.ultraRobust?.shipment_ledger ?? []} /></TabsContent>
                    </div>
                  </Tabs>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
