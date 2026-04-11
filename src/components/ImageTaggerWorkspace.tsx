import React, { useState, useEffect, useRef } from 'react';
import { readDir, writeFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, FolderOpen, Image as ImageIcon, Link, CheckCircle2, 
  Crop, RotateCcw, RotateCw, Save, X, Sparkles, Loader2,
  ChevronDown, Scan
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

interface Farmer {
  id: string;
  nik: string;
  name: string;
  hasSJ: boolean;
  hasPhoto: boolean;
  hasKtp?: boolean;
  isMathSynced: boolean;
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
  setGlobalConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
  type: 'ktp' | 'proof';
  bindings?: Record<string, string>;
  onBindChange?: (newBindings: Record<string, string>) => void;
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
  
  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [isQuadMode, setIsQuadMode] = useState(false);
  const cropperRef = useRef<ReactCropperElement>(null);
  const [rotation, setRotation] = useState(0);

  // AI Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const directoryPath = type === 'ktp' ? globalConfig.ktpDir : globalConfig.proofDir;

  useEffect(() => {
    if (directoryPath) {
      loadImagesFromDir(directoryPath, true);
    } else {
      setImages([]);
      setSelectedImage(null);
    }
  }, [directoryPath]);

  // Reset editor on image change
  useEffect(() => {
    setIsEditing(false);
    setIsQuadMode(false);
    setRotation(0);
  }, [selectedImage]);

  const handleSelectFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        if (type === 'ktp') {
          setGlobalConfig(prev => ({ ...prev, ktpDir: selected }));
        } else {
          setGlobalConfig(prev => ({ ...prev, proofDir: selected }));
        }
        // Force a non-silent reload
        loadImagesFromDir(selected, false);
      }
    } catch (err) {
      console.error("Failed to open dialog", err);
    }
  };

  const loadImagesFromDir = async (dirPath: string, silent = true) => {
    try {
      const entries = await readDir(dirPath);
      const imageFiles = entries.filter(e => 
        e.isFile && e.name && /\.(jpg|jpeg|png)$/i.test(e.name)
      );

      const loadedImages = imageFiles.map(e => {
        // Build absolute path string
        const fullPath = `${dirPath}\\${e.name}`;
        return {
          name: e.name,
          path: fullPath,
          assetUrl: convertFileSrc(fullPath)
        } as ImageEntry;
      });

      // Sort edited images to top
      loadedImages.sort((a, b) => {
        const aEdited = a.name.includes('_edited_');
        const bEdited = b.name.includes('_edited_');
        if (aEdited && !bEdited) return -1;
        if (!aEdited && bEdited) return 1;
        return 0;
      });

      setImages(loadedImages);
      if (loadedImages.length > 0 && !selectedImage) {
        setSelectedImage(loadedImages[0]);
      }
      
      if (!silent) {
        toast.success(`Loaded ${loadedImages.length} images from ${type.toUpperCase()} directory`);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to read directory: ${dirPath}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!cropperRef.current?.cropper || !selectedImage || !directoryPath) return;
    const cropper = cropperRef.current.cropper;
    const dataUrl = cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    }).toDataURL('image/jpeg', 0.9);
    
    // Convert Base64 to Uint8Array for Tauri FS writing
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = window.atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Generate isolated edited filename
    const extMatch = selectedImage.name.match(/\.(jpg|jpeg|png)$/i);
    const ext = extMatch ? extMatch[0] : '.jpeg';
    const baseName = selectedImage.name.replace(/\.(jpg|jpeg|png)$/i, '');
    const newName = `${baseName}_edited_${Date.now()}${ext}`;
    const newPath = `${directoryPath}\\${newName}`;
    
    try {
      await writeFile(newPath, bytes);
      
      const newEntry: ImageEntry = {
        name: newName,
        path: newPath,
        assetUrl: convertFileSrc(newPath)
      };
      
      setImages(prev => [newEntry, ...prev]);
      setSelectedImage(newEntry);
      setIsEditing(false);
      toast.success("Image edited and explicitly saved securely!");
      
      // Auto-migrate the tag if the raw version was already tagged
      const oldTag = bindings[selectedImage.name];
      if (oldTag && onBindChange) {
         onBindChange({ ...bindings, [newName]: oldTag });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to inject edited image onto local disk.");
    }
  };

  const handleRevert = async () => {
    if (!selectedImage || !directoryPath || !selectedImage.name.includes('_edited_')) return;
    
    if (confirm("Delete this edited version and revert to original?")) {
      try {
        const { remove } = await import('@tauri-apps/plugin-fs');
        await remove(selectedImage.path);
        
        // Find the original image name
        const baseName = selectedImage.name.split('_edited_')[0];
        const extMatch = selectedImage.name.match(/\.(jpg|jpeg|png)$/i);
        const ext = extMatch ? extMatch[0] : '';
        const originalName = `${baseName}${ext}`;
        
        // If the edited version was tagged, migrate tag back to original if not already tagged
        const currentTag = bindings[selectedImage.name];
        if (currentTag && onBindChange) {
           const next = { ...bindings };
           delete next[selectedImage.name];
           if (!next[originalName]) {
              next[originalName] = currentTag;
           }
           onBindChange(next);
        }

        toast.success("Reverted to original image.");
        loadImagesFromDir(directoryPath, true);
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete edited file.");
      }
    }
  };

  const handleTag = (farmerNik: string) => {
    if (!selectedImage) return;

    const isCurrentlyTagged = bindings[selectedImage.name] === farmerNik;
    const newBindings = { ...bindings };

    if (isCurrentlyTagged) {
      delete newBindings[selectedImage.name];
      toast.info(`Unbound ${selectedImage.name}`);
    } else {
      newBindings[selectedImage.name] = farmerNik;
      toast.success(`Tagged ${selectedImage.name} to ${farmerNik}`);
    }

    if (onBindChange) {
      onBindChange(newBindings);
    }

    // Update farmers global state for UI checkmarks elsewhere if needed
    setFarmers((prev: Farmer[]) => prev.map(f => {
      if (f.nik === farmerNik) {
        if (type === 'ktp') {
          // Check if this NIK has any other KTP bindings
          const hasAnyKtp = Object.values(newBindings).includes(farmerNik);
          return { ...f, hasKtp: hasAnyKtp };
        } else {
          const hasAnyPhoto = Object.values(newBindings).includes(farmerNik);
          return { ...f, hasPhoto: hasAnyPhoto };
        }
      }
      return f;
    }));

    // Auto select next untagged image only when tagging (not unbinding)
    if (!isCurrentlyTagged) {
      const currentIndex = images.findIndex(i => i.name === selectedImage.name);
      for (let i = currentIndex + 1; i < images.length; i++) {
          if (!newBindings[images[i].name]) {
              setSelectedImage(images[i]);
              return;
          }
      }
    }
  };

  const handleScanAI = async (scope: 'current' | 'unbound' | 'all') => {
    setIsScanning(true);
    let targets: ImageEntry[] = [];
    
    if (scope === 'current') {
      if (selectedImage) targets = [selectedImage];
    } else if (scope === 'unbound') {
      targets = images.filter(img => !bindings[img.name]);
    } else {
      targets = images;
    }

    if (targets.length === 0) {
      toast.info("No images to scan.");
      setIsScanning(false);
      return;
    }

    setScanProgress({ current: 0, total: targets.length });
    
    const newBindings = { ...bindings };
    let boundCount = 0;

    for (let i = 0; i < targets.length; i++) {
      setScanProgress({ current: i + 1, total: targets.length });
      
      // Simulate PaddleOCR bridge call
      const mockNik = await simulateOCR(targets[i]);
      
      if (mockNik) {
        // Check if NIK exists in farmers
        const match = farmers.find(f => f.nik === mockNik);
        if (match) {
          newBindings[targets[i].name] = mockNik;
          boundCount++;
        }
      }
      
      // Artificial delay for UI feedback
      await new Promise(r => setTimeout(r, 300));
    }

    if (onBindChange) {
      onBindChange(newBindings);
    }

    // Refresh farmers state
    setFarmers((prev: Farmer[]) => prev.map(f => {
      const isNowBound = Object.values(newBindings).includes(f.nik);
      if (type === 'ktp') {
        return { ...f, hasKtp: isNowBound };
      } else {
        return { ...f, hasPhoto: isNowBound };
      }
    }));

    setIsScanning(false);
    toast.success(`AI Scan Complete: Automatically bound ${boundCount} images.`);
  };

  const simulateOCR = async (image: ImageEntry): Promise<string | null> => {
    // Mock logic: Extract 16-digit NIK from filename if present
    const nikMatch = image.name.match(/\d{16}/);
    if (nikMatch) return nikMatch[0];
    
    // 5% chance to "discover" a NIK from the list
    if (Math.random() < 0.05 && farmers.length > 0) {
      const idx = Math.floor(Math.random() * farmers.length);
      return farmers[idx].nik;
    }
    
    return null;
  };

  const handleResetAll = () => {
    if (confirm("Clear ALL bindings for this folder?")) {
      const allBoundNiks = Array.from(new Set(Object.values(bindings)));
      if (onBindChange) onBindChange({});
      
      setFarmers((prev: Farmer[]) => prev.map(f => {
        if (allBoundNiks.includes(f.nik)) {
          return type === 'ktp' ? { ...f, hasKtp: false } : { ...f, hasPhoto: false };
        }
        return f;
      }));
      toast.info("All bindings cleared");
    }
  };

  const filteredFarmers = farmers.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.nik.includes(searchTerm)
  );

  return (
    <div className={cn("w-full overflow-hidden bg-background relative", directoryPath ? "flex h-[800px]" : "flex items-center justify-center h-full min-h-[400px]")}>
      
      {!directoryPath && (
         <div className="flex flex-col items-center justify-center text-center p-8 w-full">
            <div className="bg-slate-100 p-5 rounded-2xl mb-6 shadow-sm ring-1 ring-slate-200">
               <FolderOpen className="size-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Configure {type.toUpperCase()} Source</h3>
            <p className="text-xs text-muted-foreground mt-2 mb-8 leading-relaxed max-w-xs">
              Map a local folder containing uncompressed photograph evidence for this contract.
            </p>
            <Button 
              onClick={handleSelectFolder}
              className="px-10 bg-black hover:bg-zinc-800 text-white gap-2 h-12 shadow-xl font-bold rounded-xl"
            >
              <FolderOpen className="size-4" /> Browse Local System
            </Button>
         </div>
      )}

      {directoryPath && (
        <>
      {/* Main Image Area + Filmstrip */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative border-r bg-[#09090b]">
        
        {/* Floating Top Action Bar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl z-50 shadow-2xl transition-all hover:bg-black/80">
           <div className="flex items-center gap-3 border-r border-white/10 pr-3">
             <div className="bg-primary/20 p-1.5 rounded-lg">
               <ImageIcon className="size-4 text-primary" />
             </div>
             <span className="text-xs font-black uppercase tracking-tighter text-white">{type.toUpperCase()} STUDIO</span>
           </div>
           
           <div className="flex items-center gap-2">
             {/* AI Scanning Group */}
             <div className="flex items-center border border-white/10 rounded-xl bg-black/40 overflow-hidden shadow-sm">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  disabled={isScanning}
                  className="h-8 text-[10px] gap-2 px-3 hover:bg-primary/20 text-white transition-colors font-bold"
                  onClick={() => handleScanAI('unbound')}
                >
                  {isScanning ? (
                    <Loader2 className="size-3 animate-spin text-primary" />
                  ) : (
                    <Scan className="size-3 text-amber-500" />
                  )}
                  {isScanning ? `SCANNING ${scanProgress.current}/${scanProgress.total}` : 'AI SCAN'}
                </Button>
                <div className="w-px h-4 bg-white/10" />
                <Select onValueChange={(val: any) => handleScanAI(val)}>
                  <SelectTrigger className="h-8 w-7 border-none bg-transparent hover:bg-white/5 p-0 shadow-none ring-0 focus:ring-0 text-white">
                    <ChevronDown className="size-3 mx-auto" />
                  </SelectTrigger>
                  <SelectContent align="end" className="text-[10px] font-bold bg-[#18181b] border-white/10 text-white">
                    <SelectItem value="current">Scan Current Image</SelectItem>
                    <SelectItem value="unbound">Scan Incremental (New/Unbound)</SelectItem>
                    <SelectItem value="all">Scan Entire Folder</SelectItem>
                  </SelectContent>
                </Select>
             </div>

             <div className="w-px h-4 bg-white/10 mx-1" />

             <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-[10px] font-bold gap-2 text-white hover:bg-white/5" 
                onClick={handleSelectFolder}
             >
                <FolderOpen className="size-3" /> MAP FOLDER
             </Button>
           </div>
        </div>

        {/* Studio Viewport */}
        <main className="studio-viewport">
          {selectedImage ? (
             <div className="flex flex-col items-center justify-center w-full h-full relative group">
               
               {/* Floating Editor Toolbar (Top Center, below Action Bar) */}
               <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 p-1.5 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl scale-90 group-hover:scale-100 transition-all duration-300">
                   {!isEditing ? (
                     <>
                       {selectedImage.name.includes('_edited_') && (
                         <Button variant="destructive" size="sm" className="h-9 px-3 gap-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 transition-all" onClick={handleRevert}>
                            <RotateCcw className="size-4" /> Revert
                         </Button>
                       )}
                       <Button variant="secondary" size="sm" className="h-9 px-4 gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10" onClick={() => setIsEditing(true)}>
                          <Crop className="size-4" /> Edit
                       </Button>
                     </>
                   ) : (
                     <>
                       <div className="flex items-center gap-1 pr-2 mr-2 border-r border-white/10">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 text-white" onClick={() => cropperRef.current?.cropper.rotate(-90)}>
                             <RotateCcw className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 text-white" onClick={() => cropperRef.current?.cropper.rotate(90)}>
                             <RotateCw className="size-4" />
                          </Button>
                       </div>

                       {/* Quad Deskew Toggle */}
                       <div className="flex items-center gap-2 pr-2 mr-2 border-r border-white/10">
                          <Button 
                            variant={isQuadMode ? "default" : "ghost"} 
                            size="sm" 
                            className={cn(
                              "h-8 px-3 text-[10px] font-black uppercase tracking-widest gap-2",
                              isQuadMode ? "bg-primary text-black hover:bg-primary/90" : "text-white hover:bg-white/10"
                            )}
                            onClick={() => setIsQuadMode(!isQuadMode)}
                          >
                            <Scan className="size-3" /> QUAD DESKEW
                          </Button>
                       </div>
                       
                       <Button variant="ghost" size="sm" className="h-9 px-3 gap-2 text-white/60 hover:text-white" onClick={() => setIsEditing(false)}>
                          <X className="size-4" /> Cancel
                       </Button>
                       <Button variant="default" size="sm" className="h-9 px-4 gap-2 bg-white text-black hover:bg-zinc-200 font-bold" onClick={handleSaveEdit}>
                          <Save className="size-4" /> Finish
                       </Button>
                     </>
                   )}
               </div>

               {/* Active Canvas */}
               <div className="relative w-full h-full flex items-center justify-center p-8">
                 {isEditing ? (
                    <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-zinc-900/50">
                       <Cropper
                         src={selectedImage.assetUrl}
                         style={{ height: '100%', width: '100%' }}
                         initialAspectRatio={NaN}
                         guides={true}
                         ref={cropperRef}
                         rotatable={true}
                         background={false}
                         viewMode={1}
                         autoCrop={false}
                         dragMode="crop"
                         toggleDragModeOnDblclick={false}
                       />
                       
                       {/* Straighten Control (Bottom Floating) */}
                       <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl px-6 py-4 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center z-50 w-72">
                           <div className="flex w-full justify-between items-center mb-3">
                               <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Straighten</span>
                               <span className="text-xs font-mono font-bold text-primary">{rotation}°</span>
                           </div>
                           <input 
                             type="range" 
                             min="-45"  
                             max="45" 
                             step="1"
                             value={rotation} 
                             onChange={(e) => {
                                const val = Number(e.target.value);
                                setRotation(val);
                                cropperRef.current?.cropper.rotateTo(val);
                             }} 
                             onDoubleClick={() => {
                                setRotation(0);
                                cropperRef.current?.cropper.rotateTo(0);
                             }}
                             className="w-full accent-primary cursor-pointer mb-1"
                           />
                       </div>
                    </div>
                 ) : (
                   <div className="relative group/img max-w-full max-h-full">
                     <img 
                       src={selectedImage.assetUrl} 
                       alt={selectedImage.name} 
                       className="object-contain max-h-[70vh] rounded-lg shadow-[0_30px_60px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover/img:scale-[1.02]"
                     />
                     <div className="absolute inset-0 rounded-lg ring-1 ring-white/10 pointer-events-none" />
                   </div>
                 )}
               </div>
             </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-white/20">
               <ImageIcon className="size-20 mb-6 opacity-10 animate-pulse" />
               <h3 className="text-sm font-black uppercase tracking-[0.2em]">Studio Idle</h3>
               <p className="text-[10px] opacity-40 mt-2">Select a document from the filmstrip below</p>
            </div>
          )}
        </main>

        {/* Studio Filmstrip */}
        <div className="studio-filmstrip">
           {images.length === 0 ? (
             <div className="flex w-full items-center justify-center text-xs text-white/20 font-bold uppercase tracking-widest">
               Empty Studio
             </div>
           ) : (
             <div className="flex flex-nowrap overflow-x-auto items-center px-6 gap-4 w-full scrollbar-none p-4">
                 {images.map(img => {
                   const isTagged = !!bindings[img.name];
                   const isSelected = selectedImage?.name === img.name;
                   
                   return (
                     <div 
                       key={img.name}
                       onClick={() => setSelectedImage(img)}
                       className={cn(
                         "shrink-0 relative cursor-pointer rounded-xl overflow-hidden transition-all duration-300 select-none group/thumb",
                         isSelected 
                           ? "ring-2 ring-primary ring-offset-4 ring-offset-black w-[80px] h-[80px] z-10 scale-110" 
                           : "w-16 h-16 opacity-40 hover:opacity-100 grayscale hover:grayscale-0"
                       )}
                     >
                       <img src={img.assetUrl} alt={img.name} className="w-full h-full object-cover" draggable={false} />
                       {isTagged && (
                         <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                           <div className="bg-primary text-black rounded-full p-1 shadow-lg">
                              <CheckCircle2 size={16} strokeWidth={3} />
                           </div>
                         </div>
                       )}
                       {img.name.includes('_edited_') && (
                           <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-bl-lg">
                               EDT
                           </div>
                       )}
                     </div>
                   )
                 })}
             </div>
           )}
        </div>
      </div>

      {/* Studio Sidebar: Target Binding Panel */}
      <aside className="studio-sidebar">
        <div className="p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
              <Link className="size-3 text-primary" /> Bind Record
            </h2>
            <div className="text-[10px] font-mono px-2 py-0.5 bg-primary/10 text-primary rounded-full font-bold">
               {Object.keys(bindings).length} / {images.length} TAGGED
            </div>
          </div>
          
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-white/20" />
            <Input 
              placeholder="Search by NIK or Name..." 
              className="pl-11 h-12 bg-black border-white/10 text-white text-sm rounded-xl focus:ring-primary/50 transition-all placeholder:text-white/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 flex flex-col gap-2">
            {filteredFarmers.map((f) => {
               const isTaggedToThis = selectedImage && bindings[selectedImage.name] === f.nik;
               
               return (
                <div 
                  key={f.nik}
                  onClick={() => handleTag(f.nik)}
                  className={cn(
                    "group relative flex items-center justify-between p-4 cursor-pointer rounded-xl transition-all duration-200 border",
                    isTaggedToThis 
                      ? "bg-white border-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.1)]" 
                      : "bg-[#121214] border-white/5 text-white hover:border-white/20 hover:bg-[#18181b]"
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <span className={cn("font-bold text-sm tracking-tight uppercase truncate", isTaggedToThis ? "text-black" : "text-white")}>
                      {f.name}
                    </span>
                    <span className={cn("text-[10px] font-mono mt-1 opacity-50", isTaggedToThis ? "text-black" : "text-white/40")}>
                      {f.nik}
                    </span>
                  </div>
                  
                  {isTaggedToThis ? (
                    <div className="bg-black text-white rounded-full p-1 shadow-xl animate-in zoom-in-50 duration-300">
                       <CheckCircle2 size={16} strokeWidth={3} />
                    </div>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-3 text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Bind
                    </Button>
                  )}
                </div>
               );
            })}
            
            {filteredFarmers.length === 0 && (
                <div className="p-12 text-center text-xs text-white/20 font-bold uppercase tracking-[0.2em]">
                    No Matches
                </div>
            )}
          </div>
        </ScrollArea>

        {/* Sidebar Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-black/40 flex gap-2">
           <Button variant="ghost" size="sm" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 hover:bg-red-500/10" onClick={handleResetAll}>
              Reset All
           </Button>
           <Button variant="outline" size="sm" className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={handleSelectFolder}>
              Source Settings
           </Button>
        </div>
      </aside>
      </>
    )}
    </div>
  );

};
