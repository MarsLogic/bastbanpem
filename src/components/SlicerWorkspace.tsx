import React, { useState, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  CheckCircle2,
  Crosshair,
  Scissors,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Globe,
  FileText,
  UploadCloud
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import './SlicerWorkspace.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Farmer {
  id: string;
  nik: string;
  name: string;
  hasSJ: boolean;
  hasPhoto: boolean;
  isMathSynced: boolean;
  useGlobal: {
    ujiLab: boolean;
    sertifikasiLab: boolean;
    transportInvoice: boolean;
  }
}

interface SlicerWorkspaceProps {
  farmers: Farmer[];
  setFarmers: React.Dispatch<React.SetStateAction<Farmer[]>>;
}

export const SlicerWorkspace: React.FC<SlicerWorkspaceProps> = ({ farmers, setFarmers }) => {
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [rotation, setRotation] = useState(0);
  
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [isSniperMode, setIsSniperMode] = useState(false);
  const [cropBox, setCropBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });

  const isFarmerReady = (farmer: Farmer) => {
    return farmer.hasSJ && farmer.hasPhoto && farmer.isMathSynced;
  };

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

  const onFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
       const buffer = await file.arrayBuffer();
       const loadingTask = pdfjs.getDocument({ data: buffer });
       const doc = await loadingTask.promise;
       setPdfDoc(doc);
       setNumPages(doc.numPages);
       setCurrentPage(1);
    }
  };

  return (
    <div className="slicer-container" onDragOver={e => e.preventDefault()} onDrop={onFileDrop}>
      <aside className="slicer-sidebar">
        <div className="sidebar-header">
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Daftar Penerima</h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Sync from Data Engine: {farmers.length}
          </div>
        </div>
        <div className="farmer-list">
          {farmers.map(farmer => (
            <div 
              key={farmer.id}
              className={`farmer-card ${selectedFarmerId === farmer.id ? 'active' : ''}`}
              onClick={() => setSelectedFarmerId(farmer.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{farmer.name}</span>
                {isFarmerReady(farmer) && <CheckCircle2 size={16} color="var(--success)" />}
              </div>
              <div className="indicator-row">
                <div className={`dot-v4 ${farmer.hasSJ ? 'active' : ''}`} title="Surat Jalan Ready" />
                <div className={`dot-v4 ${farmer.hasPhoto ? 'active' : ''}`} title="Photo Ready" />
                <div className={`dot-v4 ${farmer.isMathSynced ? 'inherited' : ''}`} title="Math Balanced" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="slicer-main">
        {/* Floating Toolbar */}
        <div className="floating-toolbar">
          <button className="magic-button" style={{ width: '2rem', padding: 0 }} onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
            <ZoomOut size={18} />
          </button>
          <span className="scale-display">{Math.round(scale * 100)}%</span>
          <button className="magic-button" style={{ width: '2rem', padding: 0 }} onClick={() => setScale(s => Math.min(4, s + 0.2))}>
            <ZoomIn size={18} />
          </button>
          
          <div className="tool-divider" />
          
          <button className="magic-button" style={{ width: '2rem', padding: 0 }} onClick={() => setRotation(r => (r + 90) % 360)}>
            <RotateCw size={18} />
          </button>

          <div className="tool-divider" />

          <button 
            className={`magic-button ${isSniperMode ? 'active' : ''}`} 
            style={{ padding: '0 1rem', background: isSniperMode ? 'var(--warning)' : undefined }}
            onClick={() => setIsSniperMode(!isSniperMode)}
          >
            <Crosshair size={18} /> {isSniperMode ? 'Sniper Active' : 'Sniper Mode'}
          </button>

          <button className="magic-button" disabled={!selectedFarmerId || selectedPages.length === 0}>
            <Scissors size={18} /> Split PDF
          </button>
        </div>

        <div className="canvas-area">
          {!pdfDoc ? (
            <div className="drop-instruction">
              <UploadCloud size={64} color="var(--primary)" style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3 style={{ margin: 0, color: 'var(--text-muted)' }}>Tarik file PDF ke sini</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Satu PDF berisi semua Surat Jalan</p>
            </div>
          ) : (
            <div className="pdf-page-container">
               <canvas ref={canvasRef} />
            </div>
          )}
        </div>

        {pdfDoc && (
          <div className="thumbnail-bar">
            {Array.from({ length: numPages }).map((_, i) => (
              <div 
                key={i} 
                className={`thumbnail-item ${currentPage === i + 1 ? 'active' : ''} ${selectedPages.includes(i + 1) ? 'selected' : ''}`}
                onClick={() => {
                   setCurrentPage(i + 1);
                   if (!selectedPages.includes(i+1)) {
                      setSelectedPages(prev => [...prev, i+1]);
                   } else {
                      setSelectedPages(prev => prev.filter(p => p !== i+1));
                   }
                }}
              >
                <div className="thumbnail-number">{i + 1}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
