// [UIUX-005] Ground Truth vs Excel Sync
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    FileText, ZoomIn, ZoomOut, Maximize2, Minimize2,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, FileUp,
    LayoutDashboard, BookOpen, UserCheck, Table as TableIcon, FileSearch
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence: Hydrate blobUrl from contract.pdfBlob if it exists
  React.useEffect(() => {
    if (contract.pdfBlob && !blobUrl) {
      const url = URL.createObjectURL(contract.pdfBlob);
      setBlobUrl(url);
    }
    
    // Cleanup URL on unmount to prevent memory leaks
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [contract.pdfBlob]);

  const handlePdfFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      
      onUpdate({
        contractPdfPath: file.name,
        pdfBlob: file, // Store the file/blob in the global state
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
    // Check either the local state (if just uploaded) or the persisted blob
    const fileToExtract = contract.pdfBlob;
    
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
          <div className={`flex flex-col bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-4 z-[100] m-0 flex-row' : ''}`}>
             {renderPdfViewer(isFullscreen)}
             {!isFullscreen && (
               <div className="w-full flex flex-col bg-slate-50/30 min-w-0 h-[600px]">
                  <div className="p-6 border-b flex justify-between items-center bg-white/50 backdrop-blur">
                      <div className="flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <LayoutDashboard className="h-5 w-5 text-blue-600" />
                          Contract Intelligence [v2.2-PRO]
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">1. Master PDF Sync</p>
                      </div>
                      <Button onClick={handleAutoExtract} disabled={isExtracting} size="sm" className="bg-slate-900 hover:bg-black text-white text-[11px] font-bold h-8">
                          {isExtracting ? <Loader2 className="animate-spin mr-2 h-3 w-3" /> : "Run AI Scan"}
                      </Button>
                  </div>

                  <Tabs defaultValue="metadata" className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 py-2 border-b bg-white">
                      <TabsList className="bg-slate-100/50 p-1 h-9 w-full justify-start" variant="default">
                        <TabsTrigger value="metadata" className="text-[11px] gap-1.5 flex-1">
                          <LayoutDashboard className="h-3 w-3" />
                          Fields
                        </TabsTrigger>
                        <TabsTrigger value="sections" className="text-[11px] gap-1.5 flex-1">
                          <BookOpen className="h-3 w-3" />
                          Text
                        </TabsTrigger>
                        <TabsTrigger value="tables" className="text-[11px] gap-1.5 flex-1">
                          <TableIcon className="h-3 w-3" />
                          Tables
                        </TabsTrigger>
                        <TabsTrigger value="recipients" className="text-[11px] gap-1.5 flex-1">
                          <UserCheck className="h-3 w-3" />
                          RPB ({contract.deliveryBlocks?.length || 0})
                        </TabsTrigger>
                      </TabsList>
                    </div>

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

                      <TabsContent value="sections" className="p-0 m-0 flex flex-col h-full min-h-0">
                        <ScrollArea className="flex-1">
                          <div className="p-6 space-y-6">
                            {contract.sections ? (
                              Object.entries(contract.sections).map(([name, text]) => (
                                <div key={name} className="space-y-2">
                                  <div className="flex items-center justify-between border-b pb-1 border-slate-200">
                                    <Label className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">{name.replace(/_/g, ' ')}</Label>
                                    <span className="text-[9px] text-slate-400 font-mono">{(text as string).length} chars</span>
                                  </div>
                                  <div className="bg-white border rounded-md p-4 text-[11px] text-slate-600 font-serif leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                    {text as string}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                                <BookOpen className="h-12 w-12 text-slate-200" />
                                <p className="text-sm text-slate-400">No sections extracted yet.</p>
                              </div>
                            )}
                            {contract.fullText && (
                              <div className="mt-8 border-t pt-8">
                                <div className="flex items-center gap-2 mb-4">
                                  <FileSearch className="h-4 w-4 text-slate-400" />
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Raw Content</span>
                                </div>
                                <div className="bg-slate-900 text-slate-300 border rounded-md p-4 text-[10px] font-mono leading-tight h-[400px] overflow-y-auto">
                                  {contract.fullText}
                                </div>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="tables" className="p-0 m-0">
                        {contract.tables && contract.tables.length > 0 ? (
                          <div className="p-4 space-y-8">
                            {contract.tables.map((table, tIdx) => (
                              <div key={tIdx} className="space-y-3">
                                <div className="flex items-center justify-between bg-slate-100 p-2 rounded-md border border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-700 uppercase">Lampiran Table #{tIdx + 1} (Page {table.page})</span>
                                  <span className="text-[9px] bg-white px-2 py-0.5 rounded border font-mono text-slate-500">{table.method}</span>
                                </div>
                                <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                  <Table>
                                    <TableHeader className="bg-slate-50">
                                      <TableRow>
                                        {table.headers.map((h: string, hIdx: number) => (
                                          <TableHead key={hIdx} className="text-[9px] font-bold py-2">{h}</TableHead>
                                        ))}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {table.rows.slice(0, 100).map((row: any, rIdx: number) => (
                                        <TableRow key={rIdx}>
                                          {table.headers.map((h: string, cIdx: number) => (
                                            <TableCell key={cIdx} className="text-[9px] py-1 font-mono">
                                              {row[h] || (row.fields && row.fields[cIdx]) || '-'}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  {table.rows.length > 100 && (
                                    <div className="p-2 text-center text-[9px] bg-slate-50 text-slate-400 italic">
                                      Showing first 100 of {table.rows.length} rows...
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center p-24 text-center space-y-4">
                            <TableIcon className="h-12 w-12 text-slate-200" />
                            <p className="text-sm text-slate-400">No Lampiran tables detected. Tables from PDFs are extracted automatically during the AI Scan.</p>
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="recipients" className="p-0 m-0">
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Delivery RPB Blocks</span>
                            <span className="text-[10px] font-mono text-slate-400">Total: {contract.deliveryBlocks?.length || 0}</span>
                          </div>
                          {contract.deliveryBlocks?.map((block, idx) => (
                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                              <div className="flex justify-between items-start mb-1">
                                <div className="font-bold text-xs text-slate-800">{block.namaPenerima}</div>
                                <div className="text-[10px] font-bold text-blue-600">{block.jumlah}</div>
                              </div>
                              <div className="text-[10px] text-slate-500 line-clamp-1">{block.desa}, {block.kecamatan}</div>
                              <div className="mt-2 flex justify-between items-center">
                                <span className="text-[9px] text-slate-400 italic">Poktan: {block.namaPoktan || 'N/A'}</span>
                                <span className="text-[9px] font-mono text-slate-400">{block.permintaanTiba}</span>
                              </div>
                            </div>
                          ))}
                          {!contract.deliveryBlocks?.length && (
                            <div className="p-12 text-center text-slate-400 text-sm">
                              No recipients extracted.
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </ScrollArea>
                  </Tabs>
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};
