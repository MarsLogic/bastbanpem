import React, { useState, useEffect, useRef } from 'react';
import { readDir, writeFile } from '@tauri-apps/plugin-fs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FolderOpen, Image as ImageIcon, Link, CheckCircle2, Crop, RotateCcw, RotateCw, Save, X } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';

interface Farmer {
  id: string;
  nik: string;
  name: string;
  hasSJ: boolean;
  hasPhoto: boolean;
  isMathSynced: boolean;
}

interface GlobalConfig {
  nomor_sertifikat: string;
  tanggal_sertifikat: string;
  lembaga_penguji: string;
  ktpDir?: string;
  proofDir?: string;
}

interface ImageTaggerWorkspaceProps {
  farmers: Farmer[];
  setFarmers: React.Dispatch<React.SetStateAction<Farmer[]>>;
  globalConfig: GlobalConfig;
  setGlobalConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
  type: 'ktp' | 'proof';
}

interface ImageEntry {
  name: string;
  path: string;
  assetUrl: string;
}

export const ImageTaggerWorkspace: React.FC<ImageTaggerWorkspaceProps> = ({ farmers, setFarmers, globalConfig, setGlobalConfig, type }) => {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editor State
  const [isEditing, setIsEditing] = useState(false);
  const cropperRef = useRef<ReactCropperElement>(null);
  const [rotation, setRotation] = useState(0);

  // Mapping: imageName -> farmer.nik
  const [tagMap, setTagMap] = useState<Record<string, string>>({});

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
      loadedImages.sort((a, b) => b.name.includes('_edited_') ? 1 : a.name.includes('_edited_') ? -1 : 0);

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
      const oldTag = tagMap[selectedImage.name];
      if (oldTag) {
         setTagMap(prev => {
            const next = { ...prev };
            // Optional: untag the old one (commented out to preserve history if desired)
            // delete next[selectedImage.name];
            next[newName] = oldTag;
            return next;
         });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to inject edited image onto local disk.");
    }
  };

  const handleTag = (farmerNik: string) => {
    if (!selectedImage) return;

    // Update internal tag map
    setTagMap(prev => ({ ...prev, [selectedImage.name]: farmerNik }));

    // Update farmers global state
    setFarmers(prev => prev.map(f => {
      if (f.nik === farmerNik) {
        if (type === 'ktp') {
          return f; // currently no direct KTP boolean needed, but we could add hasKtp
        } else {
          return { ...f, hasPhoto: true };
        }
      }
      return f;
    }));

    toast.success(`Tagged ${selectedImage.name} to ${farmerNik}`);

    // Auto select next untagged image
    const currentIndex = images.findIndex(i => i.name === selectedImage.name);
    for (let i = currentIndex + 1; i < images.length; i++) {
        if (!tagMap[images[i].name]) {
            setSelectedImage(images[i]);
            return;
        }
    }
  };

  const filteredFarmers = farmers.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.nik.includes(searchTerm)
  );

  return (
    <div className={cn("w-full overflow-hidden bg-background relative", directoryPath ? "flex h-[650px]" : "flex items-center justify-center h-full min-h-[320px]")}>
      
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
        
        {/* Top Header Bar */}
        <div className="h-12 bg-background/95 border-b shrink-0 flex items-center justify-between px-4 z-10 shadow-sm">
           <div className="flex items-center gap-3 min-w-0">
             <div className="bg-primary/20 p-1.5 rounded-md">
               <ImageIcon className="size-4 text-primary" />
             </div>
             <span className="text-sm font-bold whitespace-nowrap">{type.toUpperCase()} Studio</span>
             <span className="text-xs text-muted-foreground font-mono truncate hidden md:inline-block max-w-[300px]">
               {directoryPath}
             </span>
           </div>
           <div className="flex items-center gap-2">
             <div className="text-xs font-mono px-3 py-1 bg-muted rounded-full">
               {Object.keys(tagMap).length} / {images.length} TAGGED
             </div>
             <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleSelectFolder}>
                Change Folder
             </Button>
           </div>
        </div>

        {/* Studio Viewport */}
        <main className="flex-1 flex flex-col items-center justify-center p-2 relative overflow-hidden bg-slate-950/50">
          {selectedImage ? (
             <div className="flex flex-col items-center justify-center w-full h-full relative group">
               
               {/* Floating Editor Controls */}
               <div className="absolute top-4 right-4 z-20 flex gap-2">
                   {!isEditing ? (
                     <Button variant="secondary" className="gap-2 shadow-xl bg-background/80 hover:bg-background backdrop-blur-md border border-border/50" onClick={() => setIsEditing(true)}>
                        <Crop className="size-4" /> Edit & Deskew
                     </Button>
                   ) : (
                     <>
                       <Button variant="destructive" className="gap-2 shadow-xl" onClick={() => setIsEditing(false)}>
                          <X className="size-4" /> Cancel
                       </Button>
                       <Button variant="default" className="gap-2 shadow-xl bg-black hover:bg-zinc-800 text-white border border-white/20" onClick={handleSaveEdit}>
                          <Save className="size-4" /> Save Edit
                       </Button>
                     </>
                   )}
               </div>

               {/* Active Canvas */}
               <div className="relative rounded-xl overflow-hidden bg-black/50 shadow-2xl flex flex-col items-center justify-center ring-1 ring-white/10 w-full h-full max-h-[100%] max-w-[100%]">
                 {isEditing ? (
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
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
                       {/* Comprehensive Editor Toolbars */}
                       
                       {/* Top Left: 90-Degree Rotations */}
                       <div className="absolute top-4 left-4 z-20 flex gap-3">
                          <div className="bg-background/95 backdrop-blur-xl p-1.5 rounded-xl border border-primary/20 shadow-xl flex gap-1">
                            <Button variant="ghost" size="sm" className="h-8 hover:bg-primary/20 hover:text-primary px-3 flex gap-2" onClick={() => cropperRef.current?.cropper.rotate(-90)}>
                               <RotateCcw className="size-4" /> -90°
                            </Button>
                            <div className="w-px bg-border my-1" />
                            <Button variant="ghost" size="sm" className="h-8 hover:bg-primary/20 hover:text-primary px-3 flex gap-2" onClick={() => cropperRef.current?.cropper.rotate(90)}>
                               <RotateCw className="size-4" /> +90°
                            </Button>
                          </div>
                       </div>

                       {/* Bottom Center: Straighten (Micro-Rotation) */}
                       <div className="absolute bottom-6 bg-background/95 backdrop-blur-xl px-6 py-4 rounded-2xl border border-primary/20 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col items-center z-20 w-80">
                           <div className="flex w-full justify-between items-center mb-3">
                               <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Straighten Image</span>
                               <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{rotation}°</span>
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
                           <span className="text-[9px] text-muted-foreground/50 italic mt-1">Double-click slider to reset</span>
                       </div>
                    </div>
                 ) : (
                   <img 
                     src={selectedImage.assetUrl} 
                     alt={selectedImage.name} 
                     className="object-contain w-full h-full max-h-[85vh] p-4"
                   />
                 )}
               </div>
             </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-muted/30 size-[250px] rounded-3xl bg-muted/5 shadow-inner">
               <ImageIcon className="size-12 mb-4 opacity-20" />
               <h3 className="text-sm font-bold uppercase tracking-widest">Awaiting Selection</h3>
               <p className="text-[10px] opacity-50 mt-1">Pick an image from the filmstrip</p>
            </div>
          )}
        </main>

        {/* Horizontal Filmstrip Engine */}
        <div className="h-[100px] shrink-0 bg-[#000000] border-t border-border/50 flex w-full relative z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
           {images.length === 0 ? (
             <div className="flex w-full items-center justify-center text-xs text-muted-foreground">
               No images found in the selected folder.
             </div>
           ) : (
             <div className="flex flex-nowrap overflow-x-auto items-center px-4 gap-3 w-full scrollbar-thin scrollbar-thumb-muted p-2">
                 {images.map(img => {
                   const isTagged = !!tagMap[img.name];
                   const isSelected = selectedImage?.name === img.name;
                   
                   return (
                     <div 
                       key={img.name}
                       onClick={() => setSelectedImage(img)}
                       className={cn(
                         "shrink-0 relative cursor-pointer rounded-lg overflow-hidden transition-all duration-200 select-none",
                         isSelected 
                           ? "border-[3px] border-primary w-[76px] h-[76px] shadow-[0_0_15px_rgba(var(--primary),0.6)] z-10 scale-105" 
                           : "border border-border/50 w-16 h-16 opacity-60 hover:opacity-100 hover:border-muted-foreground"
                       )}
                     >
                       <img src={img.assetUrl} alt={img.name} className="w-full h-full object-cover" draggable={false} />
                       {isTagged && (
                         <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center">
                           <CheckCircle2 className="text-white drop-shadow-md size-6" />
                         </div>
                       )}
                       {/* Render small filename at bottom if it's not selected or if it's an edited file */}
                       {img.name.includes('_edited_') && (
                           <div className="absolute top-0 right-0 bg-primary text-black text-[8px] font-bold px-1 rounded-bl-md">
                               EDIT
                           </div>
                       )}
                     </div>
                   )
                 })}
             </div>
           )}
        </div>
      </div>

      {/* Right Sidebar: Ultra-Compact Tagging Targeting */}
      <aside className="w-[360px] bg-background flex flex-col shadow-2xl z-20 shrink-0">
        <div className="p-4 border-b bg-muted/10 shadow-sm relative z-10">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Link className="size-4 text-primary" /> Bind Record to Image
          </h2>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search by NIK or Name..." 
              className="pl-9 h-10 bg-background shadow-inner text-sm transition-all focus-visible:ring-primary/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1 bg-muted/5">
          <div className="flex flex-col divide-y divide-border/40">
            {filteredFarmers.map((f, i) => {
               const isTaggedToThis = selectedImage && tagMap[selectedImage.name] === f.nik;
               
               return (
                <div 
                  key={f.nik}
                  onClick={() => handleTag(f.nik)}
                  className={cn(
                    "group flex items-center justify-between p-3 cursor-pointer transition-colors hover:bg-slate-50",
                    isTaggedToThis && "bg-slate-900 border-l-4 border-black text-white",
                    i % 2 === 0 && !isTaggedToThis ? "bg-background" : ""
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                       <span className={cn("font-bold text-sm tracking-tight uppercase truncate", isTaggedToThis ? "text-white" : "text-slate-900")}>{f.name}</span>
                       {isTaggedToThis && <CheckCircle2 size={14} className="text-white shrink-0" />}
                    </div>
                    <span className={cn("text-[11px] font-mono mt-0.5 truncate", isTaggedToThis ? "text-slate-400" : "text-muted-foreground")}>{f.nik}</span>
                  </div>
                  
                  <Button 
                    variant={isTaggedToThis ? "default" : "outline"} 
                    size="sm" 
                    className={cn(
                      "h-8 px-3 shrink-0 text-xs font-semibold shadow-sm transition-all",
                      isTaggedToThis 
                        ? "bg-white text-black hover:bg-zinc-100" 
                        : "group-hover:border-black group-hover:text-black"
                    )}
                  >
                    {isTaggedToThis ? 'BOUND' : 'Bind'}
                  </Button>
                </div>
               );
            })}
            
            {filteredFarmers.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground italic">
                    No recipients matched your search.
                </div>
            )}
          </div>
        </ScrollArea>
      </aside>
      </>
    )}
    </div>
  );
};
