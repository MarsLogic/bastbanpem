import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileUp, Loader2, ZoomIn, ZoomOut,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Zap, LayoutDashboard, Users, BookOpen, Table as TableIcon,
  FileText, AlertCircle, RefreshCw,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { toast } from 'sonner';

import { ContractData } from '@/lib/contractStore';
import { parsePdfFile, saveContract, loadContractIntelligence } from '@/lib/api';
import { getPdfBlob, savePdfBlob } from '@/lib/pdfStorage';

import { OverviewPanel }   from './pdf-sync/OverviewPanel';
import { RecipientTable }  from './pdf-sync/RecipientTable';
import { SectionViewer }   from './pdf-sync/SectionViewer';
import { TableViewer }     from './pdf-sync/TableViewer';

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PdfSyncModuleProps {
  contract: ContractData;
  onUpdate: (updates: Partial<ContractData>) => void;
}

// ─── Upload Dropzone ──────────────────────────────────────────────────────────

const UploadDropzone: React.FC<{ onFile: (f: File) => void }> = ({ onFile }) => {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const validate = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted.');
      return;
    }
    onFile(file);
  };

  return (
    <div
      className={`flex-1 flex items-center justify-center p-8 transition-colors
                  ${dragging ? 'bg-blue-50' : 'bg-slate-50'}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) validate(f);
      }}
    >
      <div
        className={`border-2 border-dashed rounded-3xl p-16 flex flex-col items-center gap-6
                    max-w-md w-full text-center transition-all duration-200
                    ${dragging
                      ? 'border-blue-400 bg-blue-50/60 scale-[1.01]'
                      : 'border-slate-200 bg-white'}`}
      >
        <div className={`p-5 rounded-full transition-colors ${dragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
          <FileText
            className={`h-12 w-12 transition-colors ${dragging ? 'text-blue-600' : 'text-slate-400'}`}
          />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Connect Master PDF</h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Drop your Surat Pesanan PDF here, or click to browse.<br />
            Previously scanned intelligence loads automatically.
          </p>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          size="lg"
          className="bg-slate-900 hover:bg-black text-white px-8 rounded-full shadow-lg hover:scale-105 transition-all"
        >
          <FileUp className="mr-2 h-5 w-5" /> Select PDF
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) validate(f); }}
        />
      </div>
    </div>
  );
};

// ─── PDF Viewer Pane ──────────────────────────────────────────────────────────

const PdfViewerPane: React.FC<{
  blobUrl: string;
  pdfName: string;
  loadError: string | null;
}> = ({ blobUrl, pdfName, loadError }) => {
  const [numPages, setNumPages]     = useState(0);
  const [page, setPage]             = useState(1);
  const [scale, setScale]           = useState(1.0);
  const [editingPage, setEditing]   = useState(false);
  const [editVal, setEditVal]       = useState('');
  const inputRef                    = useRef<HTMLInputElement>(null);

  const goTo = (n: number) => setPage(Math.max(1, Math.min(numPages || 1, n)));

  const commitEdit = () => {
    const n = parseInt(editVal, 10);
    if (!isNaN(n)) goTo(n);
    setEditing(false);
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center bg-slate-950">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <div>
          <p className="text-sm font-bold text-white">PDF Load Error</p>
          <p className="text-[11px] text-slate-400 mt-1">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Toolbar */}
      <div className="px-3 py-2 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px] font-black uppercase tracking-tighter shrink-0"
          >
            PDF
          </Badge>
          <span className="text-[10px] text-slate-400 truncate" title={pdfName}>
            {pdfName}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setScale(s => Math.max(0.5, +(s - 0.2).toFixed(1)))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-500 w-9 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(3.0, +(s + 0.2).toFixed(1)))}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* PDF canvas */}
      <div className="flex-1 overflow-auto flex justify-center p-4">
        <Document
          file={blobUrl}
          onLoadSuccess={pdf => { setNumPages(pdf.numPages); setPage(1); }}
          loading={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
            </div>
          }
        >
          <Page
            pageNumber={page}
            scale={scale}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            className="shadow-2xl ring-1 ring-white/10"
          />
        </Document>
      </div>

      {/* Page navigation */}
      {numPages > 1 && (
        <div className="bg-slate-900/95 border-t border-white/5 flex justify-center items-center gap-1 py-2 shrink-0">
          <button
            onClick={() => goTo(1)}
            disabled={page <= 1}
            className="p-1.5 text-slate-500 hover:text-blue-400 disabled:opacity-30 rounded hover:bg-blue-500/10 transition-colors"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="p-1.5 text-slate-500 hover:text-blue-400 disabled:opacity-30 rounded hover:bg-blue-500/10 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Inline editable page pill */}
          {editingPage ? (
            <input
              ref={inputRef}
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-16 text-center text-[11px] font-black bg-slate-800 border border-blue-500/60
                         text-blue-300 rounded px-2 py-1 outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditVal(String(page)); setEditing(true); }}
              title="Click to jump to page"
              className="bg-slate-800 border border-white/10 rounded px-3 py-1 flex items-center gap-1.5
                         hover:border-blue-500/40 transition-colors"
            >
              <span className="text-[11px] font-black text-blue-400 tabular-nums">{page}</span>
              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">of</span>
              <span className="text-[11px] font-black text-slate-500 tabular-nums">{numPages}</span>
            </button>
          )}

          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= numPages}
            className="p-1.5 text-slate-500 hover:text-blue-400 disabled:opacity-30 rounded hover:bg-blue-500/10 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => goTo(numPages)}
            disabled={page >= numPages}
            className="p-1.5 text-slate-500 hover:text-blue-400 disabled:opacity-30 rounded hover:bg-blue-500/10 transition-colors"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Contract header strip ────────────────────────────────────────────────────

const ContractHeaderStrip: React.FC<{
  contract:      ContractData;
  isExtracting:  boolean;
  isHydrating:   boolean;
  onRunScan:     () => void;
  onChangePdf:   () => void;
}> = ({ contract, isExtracting, isHydrating, onRunScan, onChangePdf }) => {
  const orderId    = contract.ultraRobust?.contract_header?.order_id || contract.nomorKontrak || '—';
  const vendor     = contract.namaPenyedia || '—';
  const grandTotal = contract.ultraRobust?.financials?.grand_total;
  const pdfName    = contract.contractPdfPath?.split(/[\\/]/).pop() || '—';
  const hasIntel   = !!contract.ultraRobust;

  return (
    <div className="px-5 py-3 border-b bg-white flex items-center gap-4 shrink-0 flex-wrap">
      {/* Identity block */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="p-2 bg-blue-600 rounded-xl shadow-md shadow-blue-100 shrink-0">
          <LayoutDashboard className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[13px] font-black text-slate-900 truncate max-w-[280px]"
              title={orderId}
            >
              {orderId}
            </span>
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white font-black text-[8px] h-4 tracking-tighter uppercase px-1.5 shrink-0">
              v2.5-ULTRA
            </Badge>
            {hasIntel && (
              <Badge
                variant="outline"
                className="text-[8px] h-4 text-emerald-600 border-emerald-200 bg-emerald-50 shrink-0"
              >
                Intel Loaded
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{vendor}</span>
            {grandTotal && grandTotal > 0 && (
              <>
                <span className="text-slate-200 text-[10px]">·</span>
                <span className="text-[10px] font-bold font-mono text-slate-600 tabular-nums">
                  Rp{grandTotal.toLocaleString('id-ID')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onChangePdf}
          title={`Change PDF (current: ${pdfName})`}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <FileText className="h-4 w-4" />
        </button>
        {isHydrating ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-500">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span className="text-[11px] font-bold">Loading saved data...</span>
          </div>
        ) : (
          <Button
            onClick={onRunScan}
            disabled={isExtracting}
            className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5 rounded-xl font-black
                       text-[11px] shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            {isExtracting ? (
              <><Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />Scanning...</>
            ) : (
              <><Zap className="h-3.5 w-3.5 mr-2" />RUN AI SCAN</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Offline placeholder ──────────────────────────────────────────────────────

const OfflinePlaceholder: React.FC<{
  onRunScan:    () => void;
  isExtracting: boolean;
}> = ({ onRunScan, isExtracting }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-5">
    <div className="p-5 bg-slate-100 rounded-full">
      <Zap className="h-10 w-10 text-slate-300" />
    </div>
    <div>
      <h4 className="text-sm font-black text-slate-800">Intelligence Offline</h4>
      <p className="text-[11px] text-slate-400 max-w-[260px] mt-1.5 leading-relaxed">
        Click <strong>RUN AI SCAN</strong> to extract contract identity, financials, recipients,
        compliance flags, and section text.
      </p>
    </div>
    <Button
      onClick={onRunScan}
      disabled={isExtracting}
      className="bg-blue-600 hover:bg-blue-700 text-white px-6 rounded-xl"
    >
      {isExtracting ? (
        <><Loader2 className="animate-spin h-4 w-4 mr-2" />Scanning...</>
      ) : (
        <><Zap className="h-4 w-4 mr-2" />Run AI Scan</>
      )}
    </Button>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const PdfSyncModule: React.FC<PdfSyncModuleProps> = ({ contract, onUpdate }) => {
  const [blobUrl,      setBlobUrl]      = useState<string | null>(null);
  const [pdfError,     setPdfError]     = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isHydrating,  setIsHydrating]  = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // ── Hydrate PDF blob from IndexedDB ────────────────────────────────────
  useEffect(() => {
    let url: string | null = null;

    const hydrate = async () => {
      if (blobUrl) return; // already loaded
      if (contract.pdfBlob instanceof Blob) {
        url = URL.createObjectURL(contract.pdfBlob);
        setBlobUrl(url);
      } else if (contract.contractPdfPath) {
        const stored = await getPdfBlob(contract.id).catch(() => null);
        if (stored instanceof Blob) {
          url = URL.createObjectURL(stored);
          setBlobUrl(url);
        } else {
          setPdfError('PDF not found in local storage. Please re-upload.');
        }
      }
    };

    hydrate();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [contract.id, contract.pdfBlob, contract.contractPdfPath]);

  // ── Load saved intelligence from SQLite on mount ────────────────────────
  // Runs only when ultraRobust isn't already in the Zustand store,
  // and the contract has a nomor_kontrak to look up.
  useEffect(() => {
    if (contract.ultraRobust) return; // already in store

    const sqliteId = contract.nomorKontrak?.replace(/\s+/g, '_');
    if (!sqliteId) return;

    setIsHydrating(true);

    loadContractIntelligence(sqliteId)
      .then(saved => {
        if (!saved) return; // 404 → not yet scanned, silently skip

        const updates: Partial<ContractData> = {};
        if (saved.ultraRobust)             updates.ultraRobust  = saved.ultraRobust  as any;
        if (saved.tables?.length)          updates.tables       = saved.tables;
        if (saved.metadata?.sections)      updates.sections     = saved.metadata.sections;
        if (saved.metadata?.full_text)     updates.fullText     = saved.metadata.full_text;
        if (saved.metadata?.nomor_kontrak) updates.nomorKontrak = saved.metadata.nomor_kontrak;
        if (saved.metadata?.nama_penyedia) updates.namaPenyedia = saved.metadata.nama_penyedia;
        if (saved.metadata?.nama_pemesan)  updates.namaPemesan  = saved.metadata.nama_pemesan;

        if (Object.keys(updates).length > 0) {
          onUpdate(updates);
          toast.success('Intelligence restored from database.');
        }
      })
      .catch(err => {
        // Network errors should not crash the UI — backend may be offline
        console.warn('[PdfSyncModule] Failed to load saved intelligence:', err);
      })
      .finally(() => setIsHydrating(false));
  // Intentionally depend only on contract.id + nomorKontrak to run once per contract
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.id, contract.nomorKontrak]);

  // ── Handle PDF file selection ─────────────────────────────────────────
  const handleFileSelect = useCallback(async (file: File) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    setPdfError(null);
    onUpdate({
      contractPdfPath: file.name,
      pdfBlob:         file,
      // Clear stale extraction data when a new PDF is attached
      ultraRobust:     undefined,
      sections:        {},
      fullText:        '',
      tables:          [],
      deliveryBlocks:  [],
      recipients:      [],
    });
    await savePdfBlob(contract.id, file, file.name);
    toast.info(`Engine Linked: ${file.name}`);
  }, [blobUrl, contract.id, onUpdate]);

  // ── AI Scan ───────────────────────────────────────────────────────────
  const handleAutoExtract = useCallback(async () => {
    const file = contract.pdfBlob instanceof Blob ? (contract.pdfBlob as File) : null;
    if (!file) {
      toast.error('Upload a PDF first.');
      return;
    }

    setIsExtracting(true);
    try {
      toast.info('Activating Ultra-Robust AI Scanning Protocol...');
      const result = await parsePdfFile(file);

      // Update store immediately so UI reflects new data
      const updates: Partial<ContractData> = {
        ultraRobust: result.ultra_robust   ?? undefined,
        tables:      result.tables         ?? [],
        sections:    result.metadata?.sections  ?? {},
        fullText:    result.metadata?.full_text ?? '',
      };
      if (result.metadata?.nomor_kontrak) updates.nomorKontrak = result.metadata.nomor_kontrak;
      if (result.metadata?.nama_penyedia) updates.namaPenyedia = result.metadata.nama_penyedia;
      if (result.metadata?.nama_pemesan)  updates.namaPemesan  = result.metadata.nama_pemesan;
      onUpdate(updates);

      // Persist to SQLite so data survives page refresh
      const sqliteId = (result.metadata?.nomor_kontrak || 'UNK').replace(/\s+/g, '_');
      await saveContract(
        sqliteId,
        result.metadata?.nomor_kontrak || 'UNK',
        result.ultra_robust?.financials?.grand_total ?? 0,
        result.metadata ?? null,
        result.ultra_robust ?? null,
        result.tables ?? [],
      );

      const count = result.ultra_robust?.shipment_ledger?.length ?? 0;
      toast.success(`Extraction complete — ${count} recipient${count !== 1 ? 's' : ''} found.`);
    } catch (err) {
      console.error('[PdfSyncModule] AI scan failed:', err);
      toast.error('Extraction failed. Check backend logs.');
    } finally {
      setIsExtracting(false);
    }
  }, [contract.pdfBlob, onUpdate]);

  // ── Derived state ─────────────────────────────────────────────────────
  const hasPdf   = !!contract.contractPdfPath;
  const hasIntel = !!contract.ultraRobust;

  // Net total for reconciliation (gross minus tax)
  const netForReconciliation = hasIntel
    ? contract.ultraRobust!.financials.grand_total -
      (contract.ultraRobust!.financials.tax_logic.total_tax || 0)
    : undefined;

  // ── No PDF attached → show upload dropzone ────────────────────────────
  if (!hasPdf) {
    return (
      <div className="flex flex-col h-full">
        <UploadDropzone onFile={handleFileSelect} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
        />
      </div>
    );
  }

  // ── PDF attached → show split layout ──────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hidden input for changing PDF */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
      />

      {/* Top: contract identity strip + scan button */}
      <ContractHeaderStrip
        contract={contract}
        isExtracting={isExtracting}
        isHydrating={isHydrating}
        onRunScan={handleAutoExtract}
        onChangePdf={() => fileInputRef.current?.click()}
      />

      {/* Bottom: split pane */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: PDF Viewer (45%) ── */}
        <div className="w-[45%] min-w-[260px] max-w-[580px] border-r shrink-0 flex flex-col overflow-hidden">
          {blobUrl ? (
            <PdfViewerPane
              blobUrl={blobUrl}
              pdfName={contract.contractPdfPath?.split(/[\\/]/).pop() || ''}
              loadError={pdfError}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-950">
              {pdfError ? (
                <>
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-[11px] text-slate-400 text-center px-6 leading-relaxed">
                    {pdfError}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-white border-white/20 hover:bg-white/10"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-3.5 w-3.5 mr-2" /> Re-upload PDF
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                  <p className="text-[10px] text-slate-600">Loading PDF…</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Intelligence Panel (55%) ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
          <Tabs defaultValue="overview" className="flex flex-col h-full">

            {/* Tab bar */}
            <div className="px-4 py-2 border-b bg-slate-50/50 shrink-0">
              <TabsList className="bg-slate-200/60 p-1 h-10 w-full rounded-xl">
                <TabsTrigger
                  value="overview"
                  className="text-[10px] font-bold gap-1.5 flex-1 rounded-lg
                             data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  OVERVIEW
                </TabsTrigger>

                <TabsTrigger
                  value="recipients"
                  className="text-[10px] font-bold gap-1.5 flex-1 rounded-lg
                             data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <Users className="h-3.5 w-3.5" />
                  RECIPIENTS
                  {(contract.ultraRobust?.shipment_ledger?.length ?? 0) > 0 && (
                    <Badge className="ml-0.5 h-4 px-1 text-[8px] bg-blue-500 hover:bg-blue-500">
                      {contract.ultraRobust!.shipment_ledger.length}
                    </Badge>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="sections"
                  className="text-[10px] font-bold gap-1.5 flex-1 rounded-lg
                             data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  SECTIONS
                </TabsTrigger>

                <TabsTrigger
                  value="tables"
                  className="text-[10px] font-bold gap-1.5 flex-1 rounded-lg
                             data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  TABLES
                  {(contract.tables?.length ?? 0) > 0 && (
                    <Badge className="ml-0.5 h-4 px-1 text-[8px] bg-slate-500 hover:bg-slate-500">
                      {contract.tables!.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab contents */}
            <div className="flex-1 min-h-0 overflow-hidden">

              <TabsContent value="overview" className="h-full m-0 overflow-hidden flex flex-col">
                {hasIntel ? (
                  <OverviewPanel
                    data={contract.ultraRobust!}
                    nomorKontrak={contract.nomorKontrak}
                    namaPenyedia={contract.namaPenyedia}
                    namaPemesan={contract.namaPemesan}
                  />
                ) : (
                  <OfflinePlaceholder onRunScan={handleAutoExtract} isExtracting={isExtracting} />
                )}
              </TabsContent>

              <TabsContent value="recipients" className="h-full m-0 overflow-hidden flex flex-col">
                {hasIntel ? (
                  <RecipientTable
                    ledger={contract.ultraRobust!.shipment_ledger ?? []}
                    grandTotal={netForReconciliation}
                  />
                ) : (
                  <OfflinePlaceholder onRunScan={handleAutoExtract} isExtracting={isExtracting} />
                )}
              </TabsContent>

              <TabsContent value="sections" className="h-full m-0 bg-slate-50/30 overflow-hidden">
                <SectionViewer
                  sections={contract.sections ?? {}}
                  fullText={contract.fullText}
                />
              </TabsContent>

              <TabsContent value="tables" className="h-full m-0 overflow-hidden">
                <TableViewer tables={contract.tables ?? []} />
              </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
