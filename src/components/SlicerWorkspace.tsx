import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  CheckCircle2,
  Crosshair,
  Scissors,
  ZoomIn,
  ZoomOut,
  RotateCw,
  UploadCloud,
  FileText,
  User
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { splitPdf } from '../lib/api';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Farmer {
  id: string;
  nik: string;
  name: string;
  hasSJ: boolean;
  hasPhoto: boolean;
  hasKtp?: boolean;
  isMathSynced: boolean;
}

interface SlicerWorkspaceProps {
  farmers: Farmer[];
  setFarmers: (setter: any) => void;
}

export const SlicerWorkspace: React.FC<SlicerWorkspaceProps> = ({ farmers, setFarmers }) => {
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [evidenceType, setEvidenceType] = useState<string>("KTP");
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [rotation, setRotation] = useState(0);
  
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [isSniperMode, setIsSniperMode] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderPage = useCallback(async (pageNum: number, currentScale: number, currentRotation: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale, rotation: currentRotation });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
    } catch (err) {
      console.error("PDF Render Error:", err);
    }
  }, [pdfDoc]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage, scale, rotation);
  }, [currentPage, scale, rotation, renderPage, pdfDoc]);

  const handleSplitAndBind = async () => {
    if (!selectedFarmerId || selectedPages.length === 0 || !pdfPath) {
      toast.error("Selection incomplete: Select a recipient, pages, and load a PDF.");
      return;
    }

    const farmer = farmers.find(f => f.id === selectedFarmerId);
    if (!farmer) return;

    try {
      const prefix = `${farmer.nik}_${evidenceType}`;
      const outputDir = `App_Data/evidence/${farmer.nik}`;
      // In this expert tool environment, we pass the "filename" as path 
      // the backend should be configured to find it in the temp/upload dir
      const result = await splitPdf(pdfPath, selectedPages, outputDir, prefix);
      
      if (result.status === "success") {
        toast.success(`Successfully bound ${selectedPages.length} pages to ${farmer.name} as ${evidenceType}`);
        
        setFarmers((prev: any[]) => prev.map(f => {
          if (f.id === selectedFarmerId) {
            const updated = { ...f };
            if (evidenceType === "KTP") updated.hasKtp = true;
            if (evidenceType === "DO") updated.hasSJ = true;
            if (evidenceType === "PHOTO") updated.hasPhoto = true;
            return updated;
          }
          return f;
        }));

        setSelectedPages([]);
      }
    } catch (e: any) {
      toast.error("Split/Bind failed: " + e.message);
    }
  };

  const onFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
       setPdfPath(file.name);
       const buffer = await file.arrayBuffer();
       const loadingTask = pdfjs.getDocument({ data: buffer });
       const doc = await loadingTask.promise;
       setPdfDoc(doc);
       setNumPages(doc.numPages);
       setCurrentPage(1);
       toast.success(`PDF Loaded: ${doc.numPages} pages`);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden" onDragOver={e => e.preventDefault()} onDrop={onFileDrop}>
      {/* Sidebar: Recipient List */}
      <aside className="w-80 border-r bg-muted/20 flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="size-5 text-primary" /> Recipients
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Sync from Data Engine: {farmers.length}</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {farmers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No recipients loaded. <br/>Go to Data Engine first.
              </div>
            ) : (
              farmers.map(farmer => (
                <Card 
                  key={farmer.id}
                  className={cn(
                    "cursor-pointer transition-all hover:bg-slate-50 border-slate-100",
                    selectedFarmerId === farmer.id && "border-black bg-black/5 ring-1 ring-black"
                  )}
                  onClick={() => setSelectedFarmerId(farmer.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-black text-[10px] uppercase truncate w-[80%] text-slate-900 tracking-tight">{farmer.name}</span>
                      {farmer.hasSJ && <CheckCircle2 size={12} className="text-black" />}
                    </div>
                    <div className="flex gap-1.5">
                       <div className={cn("size-2 rounded-full border border-slate-200", farmer.hasSJ ? "bg-black" : "bg-slate-100")} title="SJ" />
                       <div className={cn("size-2 rounded-full border border-slate-200", farmer.hasPhoto ? "bg-black" : "bg-slate-100")} title="Photo" />
                       <div className={cn("size-2 rounded-full border border-slate-200", farmer.hasKtp ? "bg-indigo-600" : "bg-slate-100")} title="KTP" />
                       <div className={cn("size-2 rounded-full border border-slate-200", farmer.isMathSynced ? "bg-black" : "bg-slate-100")} title="Math" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Slicer View */}
      <main className="flex-1 flex flex-col relative bg-slate-950/40">
        {/* Floating Toolbar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-background/80 backdrop-blur-md border rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8 hover:bg-black hover:text-white" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
                <ZoomOut className="size-4" />
              </Button>
              <span className="text-[10px] font-mono font-black w-10 text-center">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="icon" className="size-8 hover:bg-black hover:text-white" onClick={() => setScale(s => Math.min(4, s + 0.2))}>
                <ZoomIn className="size-4" />
              </Button>
            </div>
            
            <div className="w-px h-6 bg-border" />
            
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setRotation(r => (r + 90) % 360)}>
              <RotateCw className="size-4" />
            </Button>

            <div className="w-px h-6 bg-border" />

            <Select value={evidenceType} onValueChange={setEvidenceType}>
              <SelectTrigger className="w-[140px] h-8 text-[10px] font-black uppercase rounded-full">
                <SelectValue placeholder="Evidence Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="KTP">IDENTITY (KTP)</SelectItem>
                <SelectItem value="DO">DELIVERY (DO)</SelectItem>
                <SelectItem value="PHOTO">PHOTO BUKTI</SelectItem>
                <SelectItem value="BAST">BAST REPORT</SelectItem>
                <SelectItem value="LAB">CERT LAB</SelectItem>
              </SelectContent>
            </Select>

            <div className="w-px h-6 bg-border" />

            <Button 
              variant={isSniperMode ? "default" : "secondary"} 
              size="sm" 
              className={cn("gap-2 rounded-full h-8 text-[10px] uppercase font-black tracking-widest", isSniperMode && "bg-black text-white hover:bg-zinc-800")}
              onClick={() => setIsSniperMode(!isSniperMode)}
            >
              <Crosshair className="size-4" /> {isSniperMode ? 'Sniper Active' : 'Sniper Mode'}
            </Button>

            <Button 
              variant="default" 
              size="sm" 
              className="px-6 h-8 rounded-full bg-black text-white hover:bg-zinc-800 font-bold text-[10px] uppercase"
              disabled={!selectedFarmerId || selectedPages.length === 0}
              onClick={handleSplitAndBind}
            >
              <Scissors className="size-4 mr-2" /> Bind to {evidenceType}
            </Button>
          </div>
        </div>

        {/* Canvas / Viewport */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-20 custom-scrollbar">
          {!pdfDoc ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-muted size-[500px] rounded-3xl animate-in fade-in zoom-in duration-500">
               <UploadCloud className="size-16 mb-6 opacity-20" />
               <h3 className="text-xl font-bold">Drop PDF Here</h3>
               <p className="text-sm mt-2 opacity-50 text-center max-w-[200px]">Combine all letters into one file for batch processing</p>
            </div>
          ) : (
            <div className="relative shadow-2xl ring-1 ring-white/10 rounded-sm overflow-hidden bg-white">
               <canvas ref={canvasRef} />
            </div>
          )}
        </div>

        {/* Thumbnail Selector */}
        {pdfDoc && (
          <div className="h-40 bg-muted/10 border-t backdrop-blur-sm p-4">
            <ScrollArea className="h-full">
              <div className="flex gap-4 pb-4">
                {Array.from({ length: numPages }).map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex-shrink-0 w-24 aspect-[3/4] rounded-md border text-center overflow-hidden cursor-pointer relative group transition-all",
                      currentPage === i + 1 ? "border-black ring-2 ring-black/5 scale-105" : "border-slate-200 opacity-60 hover:opacity-100",
                      selectedPages.includes(i + 1) && "opacity-100 ring-4 ring-black/10 shadow-lg"
                    )}
                    onClick={() => {
                       setCurrentPage(i + 1);
                       if (!selectedPages.includes(i+1)) {
                          setSelectedPages(prev => [...prev, i+1]);
                       } else {
                          setSelectedPages(prev => prev.filter(p => p !== i+1));
                       }
                    }}
                  >
                    <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-[10px] uppercase">
                      Pg {i + 1}
                    </div>
                    {selectedPages.includes(i + 1) && (
                       <div className="absolute top-1 right-1 bg-black text-white rounded-full p-0.5 z-10 box-content border-2 border-white">
                          <CheckCircle2 size={10} />
                       </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </main>
    </div>
  );
};
