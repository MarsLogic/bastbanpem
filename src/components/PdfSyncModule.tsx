import React, { useState } from 'react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    FileText, Save, CheckCircle2, ZoomIn, ZoomOut, Maximize2, Minimize2, 
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, 
    Grid, ChevronUp, ChevronDown 
} from 'lucide-react';
import { ContractData } from '../lib/contractStore';
import { ExcelRow } from '../lib/excelParser';
import { toast } from "sonner";
import { Document, Page, pdfjs } from 'react-pdf';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PDFDocument } from 'pdf-lib';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatDataString } from '../lib/normalization';
import { cn } from "@/lib/utils";
import { ingestPdf, normalizeRow } from '../lib/dataPipeline';
import { extractContractMetadata, findSpecsSection, parseSpecsTable, extractDeliveryBlocks, findSectionPageRange } from '../lib/pdfContractParser';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfSyncModuleProps {
  contract: ContractData;
  onUpdate: (updates: Partial<ContractData>) => void;
}

export const PdfSyncModule: React.FC<PdfSyncModuleProps> = ({ contract, onUpdate }) => {
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isExtracting, setIsExtracting] = useState(false);
  const [shouldAutoExtract, setShouldAutoExtract] = useState(false);
  const [docInstance, setDocInstance] = useState<any>(null);
  const [pdfData, setPdfData] = useState<any>(null);
  const [deliveryBlocks, setDeliveryBlocks] = React.useState<any[]>(contract.deliveryBlocks || []);
  const [sskkText, setSskkText] = React.useState<string>(contract.sskkText || "");
  const [sskkPageRange, setSskkPageRange] = React.useState<[number, number] | null>(contract.sskkPageRange || null);
  const [sskkExpanded, setSskkExpanded] = React.useState(false);
  const [specsTable, setSpecsTable] = React.useState<any[]>(contract.specsTable || []);
  const [specsPageRange, setSpecsPageRange] = React.useState<[number, number] | null>(contract.specsPageRange || null);

  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfSearchQuery, setPdfSearchQuery] = useState("");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (contract.contractPdfPath) {
      readFile(contract.contractPdfPath).then(bytes => {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setPdfData({ data: bytes });
      }).catch(err => {
        console.error("Failed to read PDF bytes natively:", err);
        toast.error("Failed to read PDF file natively.");
      });
    }
  }, [contract.contractPdfPath]);

  const [formData, setFormData] = useState({
    nomorKontrak: contract.nomorKontrak || '',
    tanggalKontrak: contract.tanggalKontrak || '',
    namaPemesan: contract.namaPemesan || '',
    namaPenyedia: contract.namaPenyedia || '',
    namaProduk: contract.namaProduk || '',
    kuantitasProduk: contract.kuantitasProduk || '',
    totalPembayaran: contract.totalPembayaran || ''
  });

  React.useEffect(() => {
    setFormData({
      nomorKontrak: contract.nomorKontrak || '',
      tanggalKontrak: contract.tanggalKontrak || '',
      namaPemesan: contract.namaPemesan || '',
      namaPenyedia: contract.namaPenyedia || '',
      namaProduk: contract.namaProduk || '',
      kuantitasProduk: contract.kuantitasProduk || '',
      totalPembayaran: contract.totalPembayaran || ''
    });
    setDeliveryBlocks(contract.deliveryBlocks || []);
    setSskkText(contract.sskkText || "");
    setSskkPageRange(contract.sskkPageRange || null);
    setSpecsTable(contract.specsTable || []);
    setSpecsPageRange(contract.specsPageRange || null);
  }, [contract.nomorKontrak, contract.tanggalKontrak, contract.namaPemesan, contract.namaPenyedia, contract.namaProduk, contract.kuantitasProduk, contract.totalPembayaran, contract.deliveryBlocks, contract.sskkText, contract.specsTable, contract.sskkPageRange, contract.specsPageRange]);

  const handleBrowsePdf = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (selected && typeof selected === 'string') {
        const clearedData = {
          nomorKontrak: '',
          tanggalKontrak: '',
          namaPemesan: '',
          namaPenyedia: '',
          namaProduk: '',
          kuantitasProduk: '',
          totalPembayaran: '',
        };
        
        setFormData(clearedData);
        setDeliveryBlocks([]);
        setDocInstance(null);
        setShouldAutoExtract(true);
        
        onUpdate({ 
          ...clearedData, 
          contractPdfPath: selected,
          deliveryBlocks: [],
          sskkText: "",
          sskkPageRange: undefined,
          specsTable: [],
          specsPageRange: undefined
        });
        
        setPageNumber(1);
        toast.info("PDF Replaced. Previous metadata cleared, please click Auto-Extract.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to open file dialog.");
    }
  };

  const handleExportSubPdf = async (range: [number, number], title: string) => {
    if (!contract.contractPdfPath) return;
    try {
      const fileBytes = await readFile(contract.contractPdfPath);
      const pdfDoc = await PDFDocument.load(fileBytes);
      const subPdf = await PDFDocument.create();
      const indices = [];
      for (let i = range[0] - 1; i < range[1]; i++) indices.push(i);
      const copiedPages = await subPdf.copyPages(pdfDoc, indices);
      copiedPages.forEach(p => subPdf.addPage(p));
      const subPdfBytes = await subPdf.save();
      const savePath = await save({
        defaultPath: `${title}_Pages_${range[0]}-${range[1]}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if (savePath) {
        await writeFile(savePath, subPdfBytes);
        toast.success(`Exported ${title} to ${savePath}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to export section PDF.");
    }
  };

  const SubsetPdfViewer = ({ range, file }: { range: [number, number], file: any }) => {
    const [localPage, setLocalPage] = useState(range[0]);
    const [localScale, setLocalScale] = useState(0.8);
    const totalLocalPages = range[1] - range[0] + 1;

    React.useEffect(() => {
      setLocalPage(range[0]);
    }, [range[0], range[1]]);

    return (
      <div className="flex flex-col h-full bg-slate-100 rounded-lg overflow-hidden border">
        <div className="p-2 border-b bg-white flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-1.5 overflow-hidden">
             <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-none px-1.5 py-0 text-[9px] uppercase font-bold tracking-tight">Source Evidence</Badge>
             <span className="text-[10px] font-bold text-slate-500 truncate">Pages {range[0]} - {range[1]}</span>
          </div>
          <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLocalScale(s => Math.max(0.4, s - 0.1))}><ZoomOut size={12} /></Button>
             <span className="text-[10px] font-mono w-8 text-center">{Math.round(localScale * 100)}%</span>
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLocalScale(s => Math.min(2.0, s + 0.1))}><ZoomIn size={12} /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-200/50">
           <Document file={file} loading={<div className="p-4 text-xs italic">Loading range...</div>}>
              <Page pageNumber={localPage} scale={localScale} renderAnnotationLayer={false} className="shadow-md border border-slate-300" />
           </Document>
        </div>
        <div className="p-2 border-t bg-white flex items-center justify-center gap-4">
           <Button variant="ghost" size="icon" className="h-8 w-8" disabled={localPage <= range[0]} onClick={() => setLocalPage(p => p - 1)}><ChevronLeft size={16} /></Button>
           <div className="text-[11px] font-bold whitespace-nowrap">Slide <span className="text-black px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100 mx-1">{localPage - range[0] + 1}</span> of {totalLocalPages}</div>
           <Button variant="ghost" size="icon" className="h-8 w-8" disabled={localPage >= range[1]} onClick={() => setLocalPage(p => p + 1)}><ChevronRight size={16} /></Button>
        </div>
      </div>
    );
  };

  function onDocumentLoadSuccess(pdf: any): void {
    setNumPages(pdf.numPages);
    setDocInstance(pdf);
  }

  React.useEffect(() => {
    if (shouldAutoExtract && docInstance) {
      handleAutoExtract();
      setShouldAutoExtract(false);
    }
  }, [shouldAutoExtract, docInstance]);

  const handleAutoExtract = async () => {
    if (!docInstance) return;
    setIsExtracting(true);
    try {
      // 1. Extract high-fidelity Titik Bagi table using dataPipeline.ts (Legacy/Fallback)
      const { rows: srcRows, issues } = await ingestPdf(docInstance, contract.contractYear ? String(contract.contractYear) : '2025');
      const normalized = srcRows.map((s, i) => normalizeRow(s, i, contract.contractYear ? String(contract.contractYear) : '2025'));
      
      const extractedDeliveries = normalized.map(r => ({
        nama: r.ketua,
        telepon: r.phone,
        alamat: `${r.desa}, ${r.kecamatan}, ${r.kabupaten}, ${r.provinsi}`,
        kuantitas: r.qty.toString(),
        hargaProduk: r.totalHarga.toString(),
        ongkosKirim: r.totalOngkir.toString(),
        pageSource: r.pageNumber || 0
      }));

      // 2. Extract full text for section analysis
      let allPagesText = "";
      const pageTexts: string[] = [];
      for (let i = 1; i <= docInstance.numPages; i++) {
        const page = await docInstance.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map((item: any) => item.str).join(' ').replace(/\s+/g, ' ');
        pageTexts.push(text);
        allPagesText += " " + text;
      }

      // 3. Extract Metadata from Page 1
      const metadata = extractContractMetadata(pageTexts[0]);

      // 4. Extract Technical Specs
      const specsSection = findSpecsSection(allPagesText);
      const specsRows = specsSection ? parseSpecsTable(specsSection) : [];
      const specsRange = findSectionPageRange(pageTexts, "Lampiran 1. SPESIFIKASI TEKNIS");

      // 5. Extract SSKK
      const sskkRange = findSectionPageRange(pageTexts, "SYARAT-SYARAT KHUSUS KONTRAK") || 
                        findSectionPageRange(pageTexts, "SSKK");

      // 6. Modern Delivery Block Extraction (New Pattern Learner logic)
      const modernDeliveries = extractDeliveryBlocks(pageTexts);
      
      // Merge logic: prefer modern deliveries if they exist and are plausible
      const finalDeliveries = modernDeliveries.length > 0 ? modernDeliveries.map(d => ({
        nama: d.namaPenerima || '',
        telepon: d.telepon || '',
        alamat: d.alamatLengkap || '',
        kuantitas: d.jumlahProduk?.toString() || '0',
        hargaProduk: d.hargaProdukTotal || '0',
        ongkosKirim: d.ongkosKirim || '0',
        pageSource: 0 // Will need refinement to track actual page
      })) : extractedDeliveries;

      // 7. Update state
      const updates = {
        nomorKontrak: metadata.nomorKontrak || formData.nomorKontrak,
        tanggalKontrak: metadata.tanggalKontrak || formData.tanggalKontrak,
        namaPemesan: metadata.namaPemesan || formData.namaPemesan,
        namaPenyedia: metadata.namaPenyedia || formData.namaPenyedia,
        namaProduk: metadata.namaProduk || formData.namaProduk,
        kuantitasProduk: metadata.kuantitasProduk || formData.kuantitasProduk,
        totalPembayaran: metadata.totalPembayaran || formData.totalPembayaran,
        specsPageRange: specsRange || undefined,
        sskkPageRange: sskkRange || undefined
      };

      setFormData(updates);
      setDeliveryBlocks(finalDeliveries);
      setSpecsTable(specsRows);
      setSpecsPageRange(specsRange);
      setSskkPageRange(sskkRange);
      
      onUpdate({ 
        ...updates, 
        deliveryBlocks: finalDeliveries,
        specsTable: specsRows,
        specsPageRange: specsRange || undefined,
        sskkPageRange: sskkRange || undefined
      });

      if (issues.length > 0) {
        issues.forEach(issue => toast.warning(issue));
      }
      toast.success(`Extracted Metadata, ${specsRows.length} Specs, and ${finalDeliveries.length} Delivery Blocks successfully!`);
    } catch (err) {
      console.error(err);
      toast.error("Extraction failed.");
    } finally {
      setIsExtracting(false);
    }
  };

  const parseIndoNumber = (str: string) => {
    if (!str) return 0;
    const cleaned = str.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const deliverySum = deliveryBlocks.reduce((acc, current) => acc + parseIndoNumber(current.kuantitas), 0);
  const targetQty = parseIndoNumber(formData.kuantitasProduk);
  const qtyDiff = targetQty - deliverySum;
  const isQtyMatched = Math.abs(qtyDiff) < 0.01;
  const financialSum = deliveryBlocks.reduce((acc, curr) => acc + parseIndoNumber(curr.hargaProduk) + parseIndoNumber(curr.ongkosKirim), 0);
  const targetFinance = parseIndoNumber(formData.totalPembayaran);
  const financeDiff = targetFinance - financialSum;
  const isFinanceMatched = Math.abs(financeDiff) < 100;

  const renderPdfViewer = (isFull: boolean) => (
    <div className={`flex flex-col relative bg-muted/30 ${isFull ? 'w-full h-full' : 'w-full md:w-1/2 border-r h-[400px] md:h-full'}`}>
      <div className="p-3 border-b flex justify-between items-center bg-background/50 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium truncate max-w-[150px] md:max-w-[200px]" title={contract.contractPdfPath as string}>
            {(contract.contractPdfPath as string).split('\\').pop() || (contract.contractPdfPath as string).split('/').pop()}
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
           {!isFull && <Button variant="outline" size="sm" className="ml-2 hidden lg:flex" onClick={handleBrowsePdf}>Replace PDF</Button>}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 flex justify-center p-4">
        {blobUrl && (
          <Document file={blobUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="flex items-center justify-center p-10"><span className="animate-pulse">Parsing PDF Blob...</span></div>}>
            <Page pageNumber={pageNumber} renderTextLayer={true} renderAnnotationLayer={false} width={isFull ? 800 * scale : 500 * scale} className="shadow-xl" />
          </Document>
        )}
      </div>
      {numPages && numPages > 1 && (
        <div className="p-2 border-t bg-background flex justify-center items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageNumber <= 1} onClick={() => setPageNumber(1)}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
          <div className="flex items-center gap-2 mx-2">
            <span className="text-sm">Page</span>
            <Input type="number" className="h-8 w-16 text-center font-mono" min={1} max={numPages} value={pageNumber} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val >= 1 && val <= (numPages || 1)) setPageNumber(val); }} onFocus={(e) => e.target.select()} />
            <span className="text-sm">of {numPages}</span>
          </div>
          <Button variant="secondary" size="sm" disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => p + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageNumber >= numPages} onClick={() => setPageNumber(numPages)}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full p-6 bg-slate-50/20">
      {!contract.contractPdfPath ? (
        <div className="p-12 text-center border-dashed border-2 border-slate-200 rounded-xl bg-white shadow-sm">
          <FileText className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-4 font-medium">No Master PDF Linked. Select the main contract PDF to begin.</p>
          <Button onClick={handleBrowsePdf} className="bg-slate-900 text-white hover:bg-black">Browse Contract PDF</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className={`flex bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-4 z-[100] rounded-2xl shadow-2xl m-0' : (contract.contractPdfPath ? 'h-[650px]' : 'h-auto')}`}>
             {renderPdfViewer(isFullscreen)}
             {!isFullscreen && (
               <div className="w-full md:w-1/2 p-0 flex flex-col overflow-y-auto divide-y divide-slate-100">
                  <div className="p-6 bg-slate-50/30">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                            Master Metadata
                            {formData.nomorKontrak && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            </h3>
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Payload identification core fields</p>
                        </div>
                        <Button 
                            onClick={handleAutoExtract} 
                            disabled={isExtracting}
                            size="sm"
                            className="bg-slate-900 hover:bg-black text-white text-[11px] font-bold h-8 px-4"
                        >
                            {isExtracting ? "Extracting..." : "Run AI Scan"}
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor Kontrak</Label>
                                <Input className="h-9 bg-white border-slate-200 focus-visible:ring-indigo-100" value={formData.nomorKontrak} onChange={e => { setFormData({...formData, nomorKontrak: e.target.value}); onUpdate({ nomorKontrak: e.target.value }); }} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal Kontrak</Label>
                                <Input className="h-9 bg-white border-slate-200 focus-visible:ring-indigo-100" value={formData.tanggalKontrak} onChange={e => { setFormData({...formData, tanggalKontrak: e.target.value}); onUpdate({ tanggalKontrak: e.target.value }); }} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pihak Pertama (Pemesan)</Label>
                            <Input className="h-9 bg-white border-slate-200 focus-visible:ring-indigo-100" value={formData.namaPemesan} onChange={e => { setFormData({...formData, namaPemesan: e.target.value}); onUpdate({ namaPemesan: e.target.value }); }} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pihak Kedua (Penyedia)</Label>
                            <Input className="h-9 bg-white border-slate-200 focus-visible:ring-indigo-100" value={formData.namaPenyedia} onChange={e => { setFormData({...formData, namaPenyedia: e.target.value}); onUpdate({ namaPenyedia: e.target.value }); }} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produk Dalam Kontrak</Label>
                            <Input className="h-9 bg-white border-slate-200 focus-visible:ring-indigo-100" value={formData.namaProduk} onChange={e => { setFormData({...formData, namaProduk: e.target.value}); onUpdate({ namaProduk: e.target.value }); }} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Volume Target</Label>
                                <Input className="h-9 bg-white border-slate-200 focus-visible:ring-indigo-100" value={formData.kuantitasProduk} onChange={e => { setFormData({...formData, kuantitasProduk: e.target.value}); onUpdate({ kuantitasProduk: e.target.value }); }} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Nilai Kontrak</Label>
                                <Input className="h-9 bg-white border-slate-200 focus-visible:ring-indigo-100" value={formData.totalPembayaran} onChange={e => { setFormData({...formData, totalPembayaran: e.target.value}); onUpdate({ totalPembayaran: e.target.value }); }} />
                            </div>
                        </div>

                        <div className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${(isQtyMatched && isFinanceMatched) ? 'bg-black text-white border-black' : 'bg-zinc-50 border-zinc-200'}`}>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className={cn("font-bold uppercase tracking-wider", (isQtyMatched && isFinanceMatched) ? "text-zinc-400" : "text-slate-400")}>Volume Audit</span>
                                <span className="font-mono font-bold">
                                    {deliverySum.toLocaleString('id-ID')} / {formData.kuantitasProduk || 0}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className={cn("font-bold uppercase tracking-wider", (isQtyMatched && isFinanceMatched) ? "text-zinc-400" : "text-slate-400")}>Finance Audit</span>
                                <span className="font-mono font-bold">
                                    Rp {financialSum.toLocaleString('id-ID')} / {formData.totalPembayaran || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                  </div>
               </div>
             )}
          </div>

          <div className="grid grid-cols-1 gap-8">
            <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white">
                <CardHeader className="px-6 py-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <FileText className="text-indigo-500 w-5 h-5" />
                        Syarat-Syarat Khusus Kontrak (SSKK)
                        </CardTitle>
                        <CardDescription className="text-slate-500 mt-1">General terms and conditions extracted from the contract body.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {sskkPageRange && (
                           <Button variant="outline" size="sm" onClick={() => handleExportSubPdf(sskkPageRange, "SSKK")} className="h-8 gap-1.5 font-bold bg-zinc-100 text-zinc-800 border-zinc-200">
                               <Download size={14} /> Export Slide
                           </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setSskkExpanded(!sskkExpanded)} className="h-8 gap-1.5 font-bold">
                           {sskkExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                           {sskkExpanded ? "Collapse" : "Expand"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 border-t">
                    {sskkText ? (
                        <div className={cn("grid grid-cols-1 lg:grid-cols-2 divide-x", sskkExpanded ? "h-auto" : "h-[450px] overflow-hidden")}>
                            <div className="bg-slate-50/50 p-4 overflow-hidden border-r h-full">
                                {sskkPageRange && blobUrl && <SubsetPdfViewer range={sskkPageRange} file={blobUrl} />}
                            </div>
                            <div className="bg-white overflow-y-auto p-10 border-l shadow-inner font-serif h-full">
                                <div className="max-w-2xl mx-auto space-y-8 text-neutral-800">
                                    {sskkText.split(/(?=\bPASAL\b|\b\d+\.|\b\w\.)/i).map((para, i) => {
                                        const isHeader = /^PASAL|^\d+\./i.test(para);
                                        return (
                                            <div key={i} className={`text-[15px] leading-relaxed relative ${isHeader ? "mt-12 group" : "mt-2"}`}>
                                                {isHeader && (
                                                    <div className="relative mb-6">
                                                        <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-black rounded-full group-hover:h-8 transition-all" />
                                                        <h4 className="font-bold text-slate-900 text-xl tracking-tight uppercase">
                                                            {para.match(/^PASAL\s+\d+|^\d+\./i)?.[0] || para.substring(0, 20)}
                                                        </h4>
                                                    </div>
                                                )}
                                                <p className="text-slate-700 leading-[1.8] font-sans">
                                                    {isHeader ? para.replace(/^PASAL\s+\d+|^\d+\./i, '').trim() : para}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 text-center text-slate-400 bg-slate-50/50 italic font-medium">No SSKK data extracted yet. Run Auto-Extract.</div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white">
                    <CardHeader className="px-6 py-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Grid className="text-indigo-500 w-5 h-5" />
                            Spesifikasi Teknis
                            </CardTitle>
                            <CardDescription className="text-slate-500 mt-1">Product characteristics and requirements.</CardDescription>
                        </div>
                        {specsPageRange && (
                           <Button variant="outline" size="sm" onClick={() => handleExportSubPdf(specsPageRange, "Specs")} className="h-8 gap-1.5 font-bold">
                               <Download size={14} /> Export Slide
                           </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-0">
                        {specsTable.length > 0 ? (
                            <div className="grid grid-cols-1 divide-y border-t h-[500px]">
                                <div className="bg-slate-50/50 p-4 overflow-hidden h-[300px] border-b">
                                    {specsPageRange && blobUrl && <SubsetPdfViewer range={specsPageRange} file={blobUrl} />}
                                </div>
                                <div className="p-6 overflow-y-auto">
                                    <Table className="border rounded-lg overflow-hidden border-zinc-200 shadow-sm">
                                        <TableHeader className="bg-zinc-50">
                                            <TableRow>
                                                <TableHead className="w-16 text-black font-bold">No</TableHead>
                                                <TableHead className="w-1/3 text-black font-bold">Item</TableHead>
                                                <TableHead className="text-black font-bold">Spec</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {specsTable.map((row, i) => (
                                                <TableRow key={i} className="hover:bg-zinc-50 transition-colors">
                                                    <TableCell className="font-mono text-xs font-bold text-black">{row.index}</TableCell>
                                                    <TableCell className="text-[11px] font-semibold text-slate-700">{row.item}</TableCell>
                                                    <TableCell className="text-[11px] text-slate-600 italic border-l border-zinc-100">{row.spec}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-lg border-dashed border-2 italic font-medium mx-6 my-6">No Specifications found.</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white">
                    <CardHeader className="px-6 py-4 border-b bg-slate-50/50">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Download className="text-indigo-500 w-5 h-5" />
                        Delivery Blocks
                        </CardTitle>
                        <CardDescription className="text-slate-500 mt-1">Detailed distribution locations.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {deliveryBlocks.length > 0 ? (
                            <div className="max-h-[500px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur shadow-sm border-b">
                                        <TableRow className="border-slate-200">
                                            <TableHead className="w-12 text-center text-slate-400 font-bold text-[10px] uppercase">No</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase text-slate-400">Penerima</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase text-slate-400 text-right">Volume</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase text-slate-400 text-right w-20">Pg</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {deliveryBlocks.map((b, idx) => (
                                            <TableRow key={idx} className={cn("group hover:bg-slate-50 cursor-pointer", b.pageSource === pageNumber ? 'bg-zinc-100' : '')} onClick={() => setPageNumber(b.pageSource)}>
                                                <TableCell className="text-center font-mono text-[10px] text-slate-400">#{idx + 1}</TableCell>
                                                <TableCell className="py-2.5">
                                                    <div className="font-bold text-[13px] text-slate-900">{b.nama}</div>
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{b.alamat}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-[12px] text-black tabular-nums">{b.kuantitas}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant="secondary" className="bg-white border-slate-200 text-slate-500 font-bold text-[9px] h-5">P{b.pageSource}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="p-20 text-center text-slate-400 bg-slate-50/50 italic font-medium">No locations detected. Run AI Scan.</div>
                        )}
                    </CardContent>
                </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
