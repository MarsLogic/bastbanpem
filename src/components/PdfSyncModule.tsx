// [UIUX-005] Ground Truth vs Excel Sync
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    FileText, ZoomIn, ZoomOut, Maximize2, Minimize2,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, FileUp
} from 'lucide-react';
import { ContractData } from '../lib/contractStore';
import { toast } from "sonner";
import { Document, Page, pdfjs } from 'react-pdf';
import { parsePdfFile } from '../lib/api';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfSyncModuleProps {
  contract: ContractData;
  onUpdate: (updates: Partial<ContractData>) => void;
}

export const PdfSyncModule: React.FC<PdfSyncModuleProps> = ({ contract, onUpdate }) => {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isExtracting, setIsExtracting] = useState(false);
  const [docInstance, setDocInstance] = useState<any>(null);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      setPdfFile(file);
      onUpdate({
        contractPdfPath: file.name,
        deliveryBlocks: [],
        recipients: []
      });
      toast.info(`PDF Linked: ${file.name}`);
    } else if (file) {
      toast.error("Please select a PDF file.");
    }
  };

  const handleBrowsePdf = () => {
    fileInputRef.current?.click();
  };

  const handleAutoExtract = async () => {
    if (!pdfFile) {
      toast.error("No PDF file selected. Please upload a PDF first.");
      return;
    }
    setIsExtracting(true);
    try {
      toast.info("AI Engine Scanning PDF via Python Backend...");

      const result = await parsePdfFile(pdfFile);

      // Map extracted metadata to contract fields
      // The backend returns: { metadata: {...}, tables: [...], total_pages: N }
      const metadata = result.metadata || {};

      onUpdate({
        nomorKontrak: metadata.nomor_kontrak || contract.nomorKontrak,
        tanggalKontrak: metadata.tanggal_kontrak || contract.tanggalKontrak,
        namaPenyedia: metadata.nama_penyedia || contract.namaPenyedia,
        // Note: namaPemesan and namaProduk are not automatically extracted from PDF
        // These fields require manual entry or additional OCR/ML processing
        // totalPembayaran mapped from nilai_kontrak field
        totalPembayaran: metadata.nilai_kontrak || contract.totalPembayaran,
      });

      toast.success(`Elite AI Scan complete. Extracted data from ${result.total_pages} pages.`);
    } catch (err) {
      console.error(err);
      toast.error("Extraction failed. Ensure PDF is valid and backend is running.");
    } finally {
      setIsExtracting(false);
    }
  };

  function onDocumentLoadSuccess(pdf: any): void {
    setNumPages(pdf.numPages);
    setDocInstance(pdf);
  }

  const renderPdfViewer = (isFull: boolean) => (
    <div className={`flex flex-col relative bg-muted/30 ${isFull ? 'w-full h-full' : 'w-full md:w-1/2 border-r h-[400px] md:h-full'}`}>
      <div className="p-3 border-b flex justify-between items-center bg-background/50 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium truncate max-w-[150px] md:max-w-[200px]">
            {contract.contractPdfPath?.split(/[\\/]/).pop()}
          </span>
        </div>
        <div className="flex items-center gap-1">
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}><ZoomOut className="h-4 w-4" /></Button>
           <span className="text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.min(3.0, s + 0.2))}><ZoomIn className="h-4 w-4" /></Button>
           <div className="w-[1px] h-4 bg-slate-200 mx-1" />
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsFullscreen(!isFull)}>
             {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
           </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 flex justify-center p-4">
        {blobUrl && (
          <Document file={blobUrl} onLoadSuccess={onDocumentLoadSuccess}>
            <Page pageNumber={pageNumber} scale={scale} renderAnnotationLayer={false} className="shadow-xl" />
          </Document>
        )}
      </div>
      {numPages && numPages > 1 && (
        <div className="p-2 border-t bg-background flex justify-center items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageNumber <= 1} onClick={() => setPageNumber(1)}><ChevronsLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2 mx-2">
            <span className="text-sm">Page</span>
            <Input type="number" className="h-8 w-16 text-center" min={1} max={numPages} value={pageNumber} onChange={(e) => setPageNumber(parseInt(e.target.value) || 1)} />
            <span className="text-sm">of {numPages}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageNumber >= numPages} onClick={() => setPageNumber(numPages)}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full p-6 bg-slate-50/20">
      {!contract.contractPdfPath ? (
        <div className="p-12 text-center border-dashed border-2 border-slate-200 rounded-xl bg-white shadow-sm">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePdfFileSelect}
            accept=".pdf"
            className="hidden"
          />
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4 font-medium">No Master PDF Linked. Select the main contract PDF to begin.</p>
          <Button onClick={handleBrowsePdf} className="bg-slate-900 text-white hover:bg-black">
            <FileUp className="mr-2 h-4 w-4" />
            Browse Contract PDF
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className={`flex bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-4 z-[100] m-0' : 'h-[650px]'}`}>
             {renderPdfViewer(isFullscreen)}
             {!isFullscreen && (
               <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto bg-slate-50/30">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-900">Master Metadata</h3>
                      <Button onClick={handleAutoExtract} disabled={isExtracting} size="sm" className="bg-slate-900 hover:bg-black text-white text-[11px] font-bold">
                          {isExtracting ? <Loader2 className="animate-spin mr-2 h-3 w-3" /> : "Run AI Scan"}
                      </Button>
                  </div>

                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor Kontrak</Label>
                              <Input className="h-9 bg-white" value={contract.nomorKontrak} onChange={e => onUpdate({ nomorKontrak: e.target.value })} />
                          </div>
                          <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal</Label>
                              <Input className="h-9 bg-white" value={contract.tanggalKontrak} onChange={e => onUpdate({ tanggalKontrak: e.target.value })} />
                          </div>
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pihak Pertama (Pemesan)</Label>
                          <Input className="h-9 bg-white" value={contract.namaPemesan || ''} onChange={e => onUpdate({ namaPemesan: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pihak Kedua (Penyedia)</Label>
                          <Input className="h-9 bg-white" value={contract.namaPenyedia || ''} onChange={e => onUpdate({ namaPenyedia: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produk</Label>
                          <Input className="h-9 bg-white" value={contract.namaProduk || ''} onChange={e => onUpdate({ namaProduk: e.target.value })} />
                      </div>
                  </div>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
