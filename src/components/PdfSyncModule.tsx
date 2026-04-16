// [UIUX-005] Ground Truth vs Excel Sync
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
    LayoutDashboard, BookOpen, UserCheck, Table as TableIcon
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ContractData } from '../lib/contractStore';
import { toast } from "sonner";
import { Document, Page, pdfjs } from 'react-pdf';
import { parsePdfFile, saveContract } from '../lib/api';
import { getPdfBlob, savePdfBlob, deletePdfBlob } from '../lib/pdfStorage';
import { SectionViewer } from './pdf-sync/SectionViewer';
import { TableViewer } from './pdf-sync/TableViewer';
import { RecipientCards } from './pdf-sync/RecipientCards';

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
  const [panelHeight, setPanelHeight] = useState<number>(750);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence: Hydrate blobUrl from contract.pdfBlob or IndexedDB
  // [UIUX-005] Multi-layer PDF persistence:
  // 1. In-memory Blob (during same session) ✓
  // 2. IndexedDB fallback (across page reloads) ✓
  // 3. Prompt to re-upload if both are missing
  React.useEffect(() => {
    const hydratePdf = async () => {
      // Try 1: In-memory Blob
      if (contract.pdfBlob instanceof Blob && !blobUrl) {
        const url = URL.createObjectURL(contract.pdfBlob);
        setBlobUrl(url);
        return;
      }

      // Try 2: Recover from IndexedDB (page reload scenario)
      if (!contract.pdfBlob && contract.contractPdfPath && !blobUrl) {
        try {
          const storedBlob = await getPdfBlob(contract.id);
          if (storedBlob instanceof Blob) {
            const url = URL.createObjectURL(storedBlob);
            setBlobUrl(url);
            return;
          }
        } catch (err) {
          console.warn(`[UIUX-005] Failed to retrieve PDF from IndexedDB for contract ${contract.id}:`, err);
        }

        // If we get here, PDF is truly missing
        toast.info("PDF was cleared on page reload. Re-upload the PDF to continue.");
      }
    };

    hydratePdf();

    // Cleanup URL on unmount to prevent memory leaks
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [contract.id, contract.pdfBlob, contract.contractPdfPath, blobUrl]);

  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setBlobUrl(url);

      // Update contract state
      onUpdate({
        contractPdfPath: file.name,
        pdfBlob: file, // Store the file/blob in the global state
        deliveryBlocks: [],
        recipients: []
      });

      // [UIUX-005] Persist PDF to IndexedDB for recovery after page reload
      try {
        await savePdfBlob(contract.id, file, file.name);
      } catch (err) {
        console.warn(`[UIUX-005] Failed to save PDF to IndexedDB:`, err);
        // Don't fail the upload if IndexedDB save fails
      }

      toast.info(`PDF Linked: ${file.name}`);
    } else if (file) {
      toast.error("Please select a PDF file.");
    }
  };

  const handleBrowsePdf = () => {
    fileInputRef.current?.click();
  };

  const handleAutoExtract = async () => {
    // Check either the local state (if just uploaded) or the persisted blob
    const fileToExtract = contract.pdfBlob instanceof Blob ? contract.pdfBlob : null;

    if (!fileToExtract) {
      toast.error("No PDF file selected. Please upload a PDF first.");
      return;
    }
    setIsExtracting(true);
    try {
      toast.info("AI Engine Scanning PDF via Python Backend...");

      const result = await parsePdfFile(fileToExtract as File);

      // === Map All Header Metadata (12+ fields) ===
      const m = result.metadata || {};
      const updates: Record<string, any> = {};

      // Basic Identity
      if (m.nomor_kontrak)   updates.nomorKontrak    = m.nomor_kontrak.trim();
      if (m.tanggal_kontrak) updates.tanggalKontrak  = m.tanggal_kontrak.trim();
      
      // Pemesan
      if (m.nama_pemesan)    updates.namaPemesan     = m.nama_pemesan.trim();
      if (m.nama_ppk)        updates.namaPpk         = m.nama_ppk.trim();
      if (m.npwp_pemesan)    updates.npwpPemesan     = m.npwp_pemesan.trim();

      // Penyedia
      if (m.nama_penyedia)   updates.namaPenyedia    = m.nama_penyedia.trim();
      if (m.npwp_penyedia)   updates.npwpPenyedia    = m.npwp_penyedia.trim();

      // Product & Financials
      if (m.nama_produk)     updates.namaProduk      = m.nama_produk.trim().replace(/\s+$/, '');
      if (m.harga_satuan)    updates.hargaSatuan     = `Rp${m.harga_satuan.trim()}`;
      if (m.nilai_kontrak)   updates.totalPembayaran = `Rp${m.nilai_kontrak.trim()}`;
      if (m.total_kuantitas) updates.kuantitasProduk = `${m.total_kuantitas.trim()} liter`;
      if (m.jumlah_tahap)    updates.jumlahTahap     = m.jumlah_tahap.trim();

      // Technicals
      if (m.nomor_dipa)          updates.nomorDipa          = m.nomor_dipa.trim();
      if (m.kegiatan_output_akun) updates.kegiatanOutputAkun = m.kegiatan_output_akun.trim();
      
      // Flags
      updates.isOngkirTerpisah      = !!m.is_ongkir_terpisah;
      updates.isSwakelola           = !!m.is_swakelola;
      updates.isMenggunakanTermin   = !!m.is_menggunakan_termin;

      // === Capture Extended PDF Data ===
      if (m.sections) updates.sections = m.sections;
      if (m.full_text) updates.fullText = m.full_text;
      if (result.tables) updates.tables = result.tables;

      // === Map Delivery Blocks (per-recipient) ===
      const rawBlocks: any[] = result.delivery_blocks || [];
      if (rawBlocks.length > 0) {
        updates.deliveryBlocks = rawBlocks.map((b: any) => ({
          namaPenerima:    b.nama_penerima   || '',
          nama:            b.nama_penerima   || '',   // alias for reconciliation
          noTelp:          b.no_telp         || '',
          permintaanTiba:  b.permintaan_tiba || '',
          namaPoktan:      b.nama_poktan     || '',
          alamatLengkap:   b.alamat_lengkap  || '',
          desa:            b.desa            || '',
          kecamatan:       b.kecamatan       || '',
          kabupaten:       b.kabupaten       || '',
          provinsi:        b.provinsi        || '',
          kodePos:         b.kode_pos        || '',
          jumlah:          b.jumlah          || '',
          hargaProdukTotal: b.harga_produk_total || '',
          ongkosKirim:     b.ongkos_kirim    || '',
        }));
      }

      onUpdate(updates);

      // Auto-persist extracted metadata to SQLite vault
      const contractId = (m.nomor_kontrak || 'UNKNOWN').replace(/\s+/g, '_');
      try {
        await saveContract(contractId, m.nomor_kontrak || 'Unknown Contract', 0, m);
        toast.success(`Elite AI Scan complete. Extracted from ${result.total_pages} pages. Saved to vault.`);
      } catch {
        toast.success(`Elite AI Scan complete. Extracted from ${result.total_pages} pages. (Vault save skipped)`);
      }
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
    <div className={`flex flex-col relative bg-muted/30 ${isFull ? 'w-full h-full' : 'w-full border-b h-[500px]'}`}>
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
        <div className="p-2 border-t bg-background flex justify-center items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageNumber <= 1} onClick={() => setPageNumber(1)}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageNumber <= 1} onClick={() => setPageNumber(p => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <input
            type="text"
            inputMode="numeric"
            value={pageNumber.toString()}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              if (val === '') {
                e.target.value = pageNumber.toString();
              } else {
                const num = Math.max(1, Math.min(numPages, parseInt(val, 10) || pageNumber));
                e.target.value = num.toString();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const num = Math.max(1, Math.min(numPages, parseInt(e.currentTarget.value, 10) || pageNumber));
                setPageNumber(num);
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                e.currentTarget.value = pageNumber.toString();
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const num = Math.max(1, Math.min(numPages, parseInt(e.currentTarget.value, 10) || pageNumber));
              setPageNumber(num);
              e.currentTarget.value = num.toString();
            }}
            className="text-sm font-medium tabular-nums px-2 min-w-[50px] text-center border border-slate-300 rounded bg-white hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-slate-400">/ {numPages}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pageNumber >= numPages} onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
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
          <div className={`flex flex-col bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-4 z-[100] m-0 flex-row' : ''}`}>
             {renderPdfViewer(isFullscreen)}
             {!isFullscreen && (
               <div className="w-full flex flex-col bg-slate-50/30 min-w-0" style={{ height: `${panelHeight}px` }}>
                  <div className="p-4 border-b flex justify-between items-center bg-white/50 backdrop-blur gap-4">
                      <div className="flex flex-col min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <LayoutDashboard className="h-5 w-5 text-blue-600 shrink-0" />
                          Contract Intelligence [v2.2-PRO]
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">1. Master PDF Sync</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">{panelHeight}px</span>
                          <Slider
                            min={500}
                            max={1200}
                            step={50}
                            value={[panelHeight]}
                            onValueChange={([v]: [number]) => setPanelHeight(v)}
                            className="w-24"
                          />
                        </div>
                        <Button onClick={handleAutoExtract} disabled={isExtracting} size="sm" className="bg-slate-900 hover:bg-black text-white text-[11px] font-bold h-8 whitespace-nowrap">
                            {isExtracting ? <Loader2 className="animate-spin mr-2 h-3 w-3" /> : "Run AI Scan"}
                        </Button>
                      </div>
                  </div>

                  <Tabs defaultValue="metadata" className="flex-1 flex flex-col min-h-0">
                    <div className="px-4 py-2 border-b bg-white shrink-0">
                      <TabsList className="bg-slate-100/50 p-1 h-9 w-full justify-start">
                        <TabsTrigger value="metadata" className="text-[11px] gap-1.5 flex-1">
                          <LayoutDashboard className="h-3 w-3" />
                          Fields
                        </TabsTrigger>
                        <TabsTrigger value="sections" className="text-[11px] gap-1.5 flex-1">
                          <BookOpen className="h-3 w-3" />
                          Sections
                        </TabsTrigger>
                        <TabsTrigger value="tables" className="text-[11px] gap-1.5 flex-1">
                          <TableIcon className="h-3 w-3" />
                          Tables
                          {(contract.tables?.length ?? 0) > 0 && (
                            <Badge className="ml-1 h-4 px-1.5 text-[9px] bg-slate-600 hover:bg-slate-600">
                              {contract.tables!.length}
                            </Badge>
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="recipients" className="text-[11px] gap-1.5 flex-1">
                          <UserCheck className="h-3 w-3" />
                          RPB
                          {(contract.deliveryBlocks?.length ?? 0) > 0 && (
                            <Badge className="ml-1 h-4 px-1.5 text-[9px] bg-slate-600 hover:bg-slate-600">
                              {contract.deliveryBlocks!.length}
                            </Badge>
                          )}
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden">

                    <ScrollArea className="flex-1">
                      <TabsContent value="metadata" className="p-6 m-0 space-y-6">
                          {/* Identitas Section */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 border-l-2 border-blue-500 pl-2">
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Identitas Kontrak</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor Kontrak</Label>
                                    <Input className="h-9 bg-white text-xs" value={contract.nomorKontrak} onChange={e => onUpdate({ nomorKontrak: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tanggal</Label>
                                    <Input className="h-9 bg-white text-xs" value={contract.tanggalKontrak} onChange={e => onUpdate({ tanggalKontrak: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nomor DIPA</Label>
                                    <Input className="h-9 bg-white text-xs" value={contract.nomorDipa || ''} onChange={e => onUpdate({ nomorDipa: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kegiatan/Output/Akun</Label>
                                    <Input className="h-9 bg-white text-xs" value={contract.kegiatanOutputAkun || ''} onChange={e => onUpdate({ kegiatanOutputAkun: e.target.value })} />
                                </div>
                            </div>
                          </div>

                          {/* Pihak-Pihak Section */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 border-l-2 border-amber-500 pl-2">
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Stakeholders</span>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pihak Pertama (Pemesan)</Label>
                                  <Input className="h-9 bg-white text-xs" value={contract.namaPemesan || ''} onChange={e => onUpdate({ namaPemesan: e.target.value })} />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Penanggung Jawab (PPK)</Label>
                                    <Input className="h-9 bg-white text-xs font-medium" value={contract.namaPpk || ''} onChange={e => onUpdate({ namaPpk: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NPWP Pemesan</Label>
                                    <Input className="h-9 bg-white text-xs" value={contract.npwpPemesan || ''} onChange={e => onUpdate({ npwpPemesan: e.target.value })} />
                                </div>
                              </div>
                            </div>
                            <div className="space-y-3 pt-2">
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pihak Kedua (Penyedia)</Label>
                                  <Input className="h-9 bg-white text-xs" value={contract.namaPenyedia || ''} onChange={e => onUpdate({ namaPenyedia: e.target.value })} />
                              </div>
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">NPWP Penyedia</Label>
                                  <Input className="h-9 bg-white text-xs" value={contract.npwpPenyedia || ''} onChange={e => onUpdate({ npwpPenyedia: e.target.value })} />
                              </div>
                            </div>
                          </div>

                          {/* Detail Pesanan Section */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 border-l-2 border-emerald-500 pl-2">
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Detail Komoditas & Nilai</span>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Produk</Label>
                                  <Input className="h-9 bg-white text-xs" value={contract.namaProduk || ''} onChange={e => onUpdate({ namaProduk: e.target.value })} />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vol Total</Label>
                                    <Input className="h-9 bg-white text-xs font-bold text-emerald-600" value={contract.kuantitasProduk || ''} onChange={e => onUpdate({ kuantitasProduk: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hrg Satuan</Label>
                                    <Input className="h-9 bg-white text-xs" value={contract.hargaSatuan || ''} onChange={e => onUpdate({ hargaSatuan: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jumlah Tahap</Label>
                                    <Input className="h-9 bg-white text-xs" value={contract.jumlahTahap || ''} onChange={e => onUpdate({ jumlahTahap: e.target.value })} />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimasi Total Pembayaran</Label>
                                  <Input className="h-10 bg-slate-900 text-emerald-400 text-sm font-mono font-bold" value={contract.totalPembayaran || ''} onChange={e => onUpdate({ totalPembayaran: e.target.value })} />
                              </div>
                            </div>
                          </div>
                      </TabsContent>

                      <TabsContent value="sections" className="p-0 m-0">
                        <SectionViewer sections={contract.sections ?? {}} fullText={contract.fullText} />
                      </TabsContent>

                      <TabsContent value="tables" className="p-0 m-0">
                        <TableViewer tables={contract.tables ?? []} />
                      </TabsContent>

                      <TabsContent value="recipients" className="p-0 m-0">
                        <RecipientCards blocks={contract.deliveryBlocks ?? []} />
                      </TabsContent>
                    </ScrollArea>
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
