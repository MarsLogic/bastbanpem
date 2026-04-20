// [UIUX-004] OCR Tagging UI
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, FolderOpen, Image as ImageIcon, Link, CheckCircle2,
  Crop, RotateCcw, RotateCw, Save, X, Sparkles, Loader2,
  ChevronDown, Scan, UserCheck, Users, Users2, Filter, Cpu, FileUp,
  ShieldCheck
} from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ocrKtp } from '../lib/api';

interface RecipientProxyData {
  nik: string;
  name: string;
  relation: string;
}

interface Farmer {
  id: string;
  nik: string;
  name: string;
  group: string;
  hasSJ: boolean;
  hasPhoto: boolean;
  hasKtp?: boolean;
  isMathSynced: boolean;
  proxy?: RecipientProxyData;
}

interface GlobalConfig {
  nomor_sertifikat: string;
  tanggal_sertifikat: string;
  lembaga_penguji: string;
  ktpDir?: string;
  proofDir?: string;
}

interface ImageEntry {
  name: string;
  path: string;
  assetUrl: string;
}

interface ImageTaggerWorkspaceProps {
  farmers: Farmer[];
  setFarmers: (setter: any) => void;
  globalConfig: GlobalConfig;
  setGlobalConfig: (setter: any) => void;
  type: 'ktp' | 'proof';
  bindings?: Record<string, string>;
  onBindChange?: (bindings: Record<string, string>) => void;
}

export const ImageTaggerWorkspace: React.FC<ImageTaggerWorkspaceProps> = ({ 
  farmers, 
  setFarmers, 
  globalConfig, 
  setGlobalConfig, 
  type,
  bindings = {},
  onBindChange
}) => {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [poktanFilter, setPoktanFilter] = useState('ALL');
  const [ocrVersion, setOcrVersion] = useState<'v4' | 'v5'>('v4');
  const [ocrData, setOcrData] = useState<any>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  
  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [isQuadMode, setIsQuadMode] = useState(false);
  const cropperRef = useRef<ReactCropperElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rotation, setRotation] = useState(0);

  // Proxy Entry Mode
  const [isProxyMode, setIsProxyMode] = useState(false);
  const [proxyData, setProxyData] = useState({ nik: '', name: '', relation: 'Keluarga' });

  // PDF Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const directoryPath = type === 'ktp' ? globalConfig.ktpDir : globalConfig.proofDir;

  const poktans = useMemo(() => {
    const set = new Set(farmers.map((f: Farmer) => f.group).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [farmers]);

  // Note: Images are now loaded via file upload, not directory scanning
  // useEffect for directoryPath removed - web app uses file upload instead

  useEffect(() => {
    setIsEditing(false);
    setIsQuadMode(false);
    setRotation(0);
    setIsProxyMode(false);
    setOcrData(null);
    
    // Auto-trigger OCR for selected image if it's KTP and not yet scanned
    if (selectedImage && type === 'ktp' && !bindings[selectedImage.name]) {
        handleSingleOcr(selectedImage);
    }
  }, [selectedImage]);

  const handleSelectFolder = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Convert FileList to ImageEntry array
    const loadedImages: ImageEntry[] = Array.from(files)
      .filter(file => /\.(jpg|jpeg|png)$/i.test(file.name))
      .map(file => ({
        name: file.name,
        path: file.name,
        assetUrl: URL.createObjectURL(file),
        // Store file object for later upload to backend
        _file: file
      } as any));

    if (loadedImages.length === 0) {
      toast.error(`No valid image files found. Select JPG or PNG files.`);
      return;
    }

    setImages(loadedImages);
    if (loadedImages.length > 0) {
      setSelectedImage(loadedImages[0]);
    }
    toast.success(`Loaded ${loadedImages.length} images`);
  };

  const handleSaveEdit = async () => {
    if (!cropperRef.current?.cropper || !selectedImage) return;
    const cropper = cropperRef.current.cropper;
    const dataUrl = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    }).toDataURL('image/jpeg', 0.9);
    
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const extMatch = selectedImage.name.match(/\.(jpg|jpeg|png)$/i);
    const ext = extMatch ? extMatch[0] : '.jpeg';
    const baseName = selectedImage.name.replace(/\.(jpg|jpeg|png)$/i, '');
    const newName = `${baseName}_edited_${Date.now()}${ext}`;
    const newPath = `${directoryPath}\\${newName}`;
    
    try {
      // TODO: POST to backend API endpoint (POST /api/images/save)
      // Backend should save edited image to /data/images/ and return URL
      // For now: create blob URL locally
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const assetUrl = URL.createObjectURL(blob);

      const newEntry: ImageEntry = { name: newName, path: newName, assetUrl };
      setImages(prev => [newEntry, ...prev]);
      setSelectedImage(newEntry);
      setIsEditing(false);
      toast.success("Image processed and saved.");

      const oldTag = bindings[selectedImage.name];
      if (oldTag && onBindChange) {
        onBindChange({ ...bindings, [newName]: oldTag });
      }
    } catch (err) {
      toast.error("Failed to save edited image.");
    }
  };

  const handleTag = (farmerNik: string, isProxy = false) => {
    if (!selectedImage) return;

    const isCurrentlyTagged = bindings[selectedImage.name] === farmerNik;
    const newBindings = { ...bindings };

    if (isCurrentlyTagged && !isProxy) {
      delete newBindings[selectedImage.name];
      toast.info(`Unbound ${selectedImage.name}`);
    } else {
      newBindings[selectedImage.name] = farmerNik;
      toast.success(`${isProxy ? 'Proxy' : 'Primary'} tag applied`);
    }

    if (onBindChange) onBindChange(newBindings);

    setFarmers((prev: Farmer[]) => prev.map(f => {
      if (f.nik === farmerNik) {
        const isBound = Object.values(newBindings).includes(farmerNik);
        const updates: any = type === 'ktp' ? { hasKtp: isBound } : { hasPhoto: isBound };
        if (isProxy) {
            updates.proxy = { ...proxyData };
        }
        return { ...f, ...updates };
      }
      return f;
    }));

    if (!isCurrentlyTagged) {
      const currentIndex = images.findIndex(i => i.name === selectedImage.name);
      if (images[currentIndex + 1]) setSelectedImage(images[currentIndex + 1]);
    }
    setIsProxyMode(false);
  };

  const handleSingleOcr = async (image: ImageEntry) => {
    setIsProcessingOcr(true);
    try {
        let file: File;
        if ((image as any)._file) {
            file = (image as any)._file;
        } else {
            const response = await fetch(image.assetUrl);
            const blob = await response.blob();
            file = new File([blob], image.name, { type: 'image/jpeg' });
        }
        const res = await ocrKtp(file);
        setOcrData(res);
        
        // Auto-Link: If 100% confidence match to a farmer, auto-bind
        if (res.nik) {
            const match = farmers.find(f => f.nik === res.nik);
            if (match && !bindings[image.name]) {
                handleTag(match.nik);
                toast.success(`Auto-Stapled to ${match.name}`);
            }
        }
    } catch (e) {
        console.error("OCR Auto-fetch failed", e);
    } finally {
        setIsProcessingOcr(false);
    }
  };

  const handleScanAI = async (scope: 'current' | 'unbound' | 'all') => {
    setIsScanning(true);
    let targets = scope === 'current' ? [selectedImage].filter(Boolean) as ImageEntry[] :
                  scope === 'unbound' ? images.filter(img => !bindings[img.name]) : images;

    if (targets.length === 0) { setIsScanning(false); return; }

    setScanProgress({ current: 0, total: targets.length });
    const newBindings = { ...bindings };
    let boundCount = 0;

    for (let i = 0; i < targets.length; i++) {
      setScanProgress({ current: i + 1, total: targets.length });
      
      try {
          // Get file from stored _file or fetch from assetUrl
          let file: File;
          if ((targets[i] as any)._file) {
            file = (targets[i] as any)._file;
          } else {
            // Fallback: fetch from assetUrl blob
            const response = await fetch(targets[i].assetUrl);
            const blob = await response.blob();
            file = new File([blob], targets[i].name, { type: 'image/jpeg' });
          }

          const ocrResult = await ocrKtp(file);
          const nik = ocrResult.nik;

          if (nik && farmers.find((f: Farmer) => f.nik === nik)) {
            newBindings[targets[i].name] = nik;
            boundCount++;
          }
      } catch (e) {
          console.error(`OCR failed for ${targets[i].name}`, e);
      }
      
      await new Promise(r => setTimeout(r, 100));
    }

    if (onBindChange) onBindChange(newBindings);
    setIsScanning(false);
    toast.success(`AI Discovery Complete: ${boundCount} matches found.`);
  };

  const handleResetAll = () => {
    if (confirm("Clear ALL bindings?")) {
      if (onBindChange) onBindChange({});
      toast.info("All bindings cleared");
    }
  };

  const filteredFarmers = farmers.filter((f: Farmer) => 
    (poktanFilter === 'ALL' || f.group === poktanFilter) &&
    (f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.nik.includes(searchTerm))
  );

  return (
    <div className={cn("w-full overflow-hidden bg-background relative flex", images.length > 0 ? "h-[800px]" : "items-center justify-center h-full min-h-[400px]")}>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".jpg,.jpeg,.png"
        multiple
        className="hidden"
      />

      {images.length === 0 && (
         <div className="flex flex-col items-center justify-center text-center p-8 w-full">
            <FileUp className="size-10 text-slate-400 mb-6" />
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Load {type.toUpperCase()} Images</h3>
            <p className="text-sm text-slate-500 mt-2">Select JPG or PNG files to begin tagging</p>
            <Button onClick={handleSelectFolder} className="mt-8 px-10 bg-black text-white font-bold rounded-xl h-12 shadow-xl">
              <FileUp className="mr-2 h-4 w-4" />
              Select Images
            </Button>
         </div>
      )}

      {images.length > 0 && (
        <>
      <div className="flex-1 flex flex-col min-w-0 h-full relative border-r bg-[#09090b]">
        
        {/* Top Control Bar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl z-50 shadow-2xl">
           <div className="flex items-center gap-3 border-r border-white/10 pr-3">
             <ImageIcon className="size-4 text-primary" />
             <span className="text-[10px] font-black uppercase tracking-widest text-white">{type.toUpperCase()} STUDIO</span>
           </div>
           
           <div className="flex items-center gap-2">
             {/* OCR Version Toggle */}
             <div className="flex bg-black/40 rounded-lg p-0.5 border border-white/10">
                <button 
                    onClick={() => setOcrVersion('v4')}
                    className={cn("px-2 py-1 text-[8px] font-black rounded-md transition-all", ocrVersion === 'v4' ? "bg-primary text-black" : "text-white/40 hover:text-white")}
                >V4</button>
                <button 
                    onClick={() => setOcrVersion('v5')}
                    className={cn("px-2 py-1 text-[8px] font-black rounded-md transition-all", ocrVersion === 'v5' ? "bg-primary text-black" : "text-white/40 hover:text-white")}
                >V5</button>
             </div>

             <Button variant="ghost" size="sm" className="h-8 text-[10px] gap-2 px-3 text-white font-bold" onClick={() => handleScanAI('unbound')}>
                {isScanning ? <Loader2 className="size-3 animate-spin" /> : <Scan className="size-3 text-amber-500" />}
                AI DISCOVERY
             </Button>
             <div className="w-px h-4 bg-white/10 mx-1" />
             <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] font-bold gap-2 text-white hover:bg-white/5" onClick={handleSelectFolder}>
                <FolderOpen className="size-3" /> FOLDER
             </Button>
           </div>
        </div>

        <main className="studio-viewport h-full w-full relative">
          {selectedImage ? (
             <div className="flex flex-col items-center justify-center w-full h-full p-8">
               <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 p-1.5 bg-zinc-900/90 border border-white/10 rounded-xl shadow-2xl scale-95 hover:scale-100 transition-all">
                   {!isEditing ? (
                     <Button variant="secondary" size="sm" className="h-9 px-4 gap-2 bg-white/5 text-white" onClick={() => setIsEditing(true)}>
                        <Crop className="size-4" /> PROCESS IMAGE
                     </Button>
                   ) : (
                     <>
                       <Button variant="ghost" size="icon" className="text-white" onClick={() => cropperRef.current?.cropper.rotate(-90)}><RotateCcw /></Button>
                       <Button variant="ghost" size="icon" className="text-white" onClick={() => cropperRef.current?.cropper.rotate(90)}><RotateCw /></Button>
                       <div className="w-px h-4 bg-white/10 mx-2" />
                       <Button variant="ghost" size="sm" className="text-white/60" onClick={() => setIsEditing(false)}>CANCEL</Button>
                       <Button variant="default" size="sm" className="bg-white text-black font-bold" onClick={handleSaveEdit}>SAVE PROCESSED</Button>
                     </>
                   )}
               </div>

                {isEditing ? (
                  <div className="w-full h-full rounded-2xl overflow-hidden bg-zinc-900/50">
                     <Cropper
                       src={selectedImage.assetUrl}
                       style={{ height: '100%', width: '100%' }}
                       ref={cropperRef}
                       viewMode={1}
                       dragMode="crop"
                     />
                  </div>
               ) : (
                 <div className="relative group">
                    <img src={selectedImage.assetUrl} className="object-contain max-h-[75vh] rounded-lg shadow-2xl ring-1 ring-white/10" />
                    
                    {/* Verification Shield Overlay */}
                    {ocrData && (
                        <div className="absolute top-4 left-4 p-4 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl max-w-xs animate-in fade-in slide-in-from-left-4 duration-500">
                             <div className="flex items-center gap-3 mb-3">
                                <div className={cn("p-1.5 rounded-lg", ocrData.nik ? "bg-emerald-500/10" : "bg-red-500/10")}>
                                   <ShieldCheck className={cn("size-5", ocrData.nik ? "text-emerald-500" : "text-red-500")} />
                                </div>
                                <div>
                                    <h4 className="text-white font-black text-[10px] uppercase tracking-widest leading-none">OCR Insight</h4>
                                    <p className="text-white/40 text-[9px] font-bold mt-1">Identity Intelligence</p>
                                </div>
                             </div>
                             
                             <div className="space-y-2">
                                <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                                    <div className="text-[8px] font-black uppercase text-white/40 mb-0.5">Detected NIK</div>
                                    <div className="text-xs font-mono text-white tracking-wider">{ocrData.nik || 'Not Found'}</div>
                                </div>
                                <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                                    <div className="text-[8px] font-black uppercase text-white/40 mb-0.5">Detected Name</div>
                                    <div className="text-xs font-bold text-white uppercase">{ocrData.nama || 'N/A'}</div>
                                </div>
                             </div>

                             {ocrData.nik && bindings[selectedImage.name] === ocrData.nik && (
                                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                                   <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                   <span className="text-[9px] font-black uppercase text-emerald-500">Forensically Verified</span>
                                </div>
                             )}
                        </div>
                    )}
                 </div>
               )}
             </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/20 uppercase tracking-widest text-[10px]">
               <ImageIcon size={48} className="mb-4 opacity-10" /> Select Document
            </div>
          )}
        </main>

        <div className="studio-filmstrip bg-black/40 border-t border-white/5 p-4 flex gap-4 overflow-x-auto scrollbar-none">
            {images.map((img: ImageEntry) => (
                <div 
                    key={img.name} 
                    onClick={() => setSelectedImage(img)}
                    className={cn(
                        "shrink-0 w-16 h-16 rounded-lg overflow-hidden cursor-pointer ring-offset-2 transition-all",
                        selectedImage?.name === img.name ? "ring-2 ring-primary scale-110" : "opacity-40 grayscale"
                    )}
                >
                    <img src={img.assetUrl} className="w-full h-full object-cover" />
                    {bindings[img.name] && <div className="absolute inset-0 bg-primary/20 flex items-center justify-center"><CheckCircle2 className="text-white size-4" /></div>}
                </div>
            ))}
        </div>
      </div>

      <aside className="studio-sidebar w-[350px] flex flex-col bg-[#09090b] border-l border-white/5">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
            <Users2 size={12} /> Recipient Directory
          </h2>
          
          <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-white/20" />
                <Input placeholder="Search..." className="pl-9 h-10 bg-black border-white/10 text-white text-xs rounded-lg" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <Select value={poktanFilter} onValueChange={(val) => setPoktanFilter(val || 'ALL')}>
                  <SelectTrigger className="w-[100px] h-10 bg-black border-white/10 text-white text-[10px] font-bold">
                      <Filter size={12} />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      {poktans.map((p: any) => <SelectItem key={String(p)} value={String(p)}>{String(p)}</SelectItem>)}
                  </SelectContent>
              </Select>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-2">
            {filteredFarmers.map((f: Farmer) => {
               const isTagged = selectedImage && bindings[selectedImage.name] === f.nik;
               return (
                <div key={f.nik} className={cn("p-4 rounded-xl border transition-all cursor-pointer group", isTagged ? "bg-white border-white text-black" : "bg-white/5 border-white/5 text-white hover:border-white/20")}>
                  <div className="flex justify-between items-start mb-2" onClick={() => handleTag(f.nik)}>
                    <div className="flex flex-col">
                        <span className="font-bold text-xs uppercase truncate">{f.name}</span>
                        <span className="text-[9px] font-mono opacity-50 mt-1">{f.nik}</span>
                    </div>
                    {isTagged && <CheckCircle2 size={14} className="text-black" />}
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className="text-[8px] font-bold uppercase">{f.group}</Badge>
                      {f.proxy && <Badge className="bg-amber-500 text-black text-[8px] font-bold uppercase">PROXY: {f.proxy.relation}</Badge>}
                  </div>

                  {!isTagged && (
                      <div className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px] font-black uppercase" onClick={() => handleTag(f.nik)}>Bind Main</Button>
                          <Button size="sm" variant="outline" className="flex-1 h-7 text-[9px] font-black uppercase text-amber-500 border-amber-500/20" onClick={() => { setIsProxyMode(true); setProxyData({ ...proxyData, nik: '', name: '' }); handleTag(f.nik, true); }}>Bind Proxy</Button>
                      </div>
                  )}
                </div>
               );
            })}
          </div>
        </ScrollArea>

        {isProxyMode && (
            <div className="p-4 bg-amber-500 text-black">
                <h4 className="text-[10px] font-black uppercase mb-2 flex items-center gap-2"><UserCheck size={12}/> PROXY DATA ENTRY</h4>
                <div className="grid gap-2">
                    <Input placeholder="Proxy Name" className="h-8 text-xs bg-white/20 border-none placeholder:text-black/40" value={proxyData.name} onChange={e => setProxyData({...proxyData, name: e.target.value})} />
                    <Input placeholder="Proxy NIK" className="h-8 text-xs bg-white/20 border-none placeholder:text-black/40" value={proxyData.nik} onChange={e => setProxyData({...proxyData, nik: e.target.value})} />
                    <select className="h-8 text-xs bg-white/20 border-none rounded-md px-2" value={proxyData.relation} onChange={e => setProxyData({...proxyData, relation: e.target.value})}>
                        <option>Suami</option><option>Istri</option><option>Anak</option><option>Keluarga</option><option>Lainnya</option>
                    </select>
                </div>
            </div>
        )}

        <div className="p-4 border-t border-white/5 bg-black/40 flex gap-2">
           <Button variant="ghost" className="flex-1 text-[9px] font-black text-red-500/60 uppercase" onClick={handleResetAll}>Reset All</Button>
           <Button variant="outline" className="flex-1 text-[9px] font-black text-white uppercase border-white/10" onClick={handleSelectFolder}>Folder</Button>
        </div>
      </aside>
      </>
    )}
    </div>
  );
};
