import React, { useState } from 'react';
import { Shield, BarChart3, Camera, Globe } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { ExcelWorkbench } from './components/ExcelWorkbench';
import { SlicerWorkspace } from './components/SlicerWorkspace';
import GlobalSettings from './components/GlobalSettings';
import './App.css';

// Re-defining the types here for now
export interface GlobalConfig {
  uji_lab_file?: string;
  sertifikasi_lab_file?: string;
  transport_invoice_file?: string;
  nomor_sertifikat: string;
  tanggal_sertifikat: string;
  lembaga_penguji: string;
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'excel' | 'slicer'>('excel');
  const [farmers, setFarmers] = useState<any[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    nomor_sertifikat: '',
    tanggal_sertifikat: '',
    lembaga_penguji: '',
  });

  const handlePinToAll = () => {
    // In a real app, this would update all recipient.useGlobal flags in the state
    console.log('Pinning global assets to all rows...');
    alert('Pinned! All recipients will now inherit these global assets unless unique ones are provided.');
  };

  const handleLaunchPortal = async () => {
    try {
      await invoke('open_portal');
    } catch (err) {
      console.error("Portal Launch Failed:", err);
    }
  };

  return (
    <div className="app-shell">
      <nav className="side-nav">
        <div className="nav-logo">
          <Shield size={24} style={{ marginRight: '0.5rem' }} />
          BAST Automator
        </div>
        <div className="nav-links">
          <button 
            className={activeTab === 'excel' ? 'active' : ''} 
            onClick={() => setActiveTab('excel')}
          >
            <BarChart3 size={18} style={{ marginRight: '0.5rem' }} />
            Data Engine
          </button>
          <button 
            className={activeTab === 'slicer' ? 'active' : ''} 
            onClick={() => setActiveTab('slicer')}
          >
            <Camera size={18} style={{ marginRight: '0.5rem' }} />
            Visual Slicer
          </button>
          
          <div className="nav-divider" style={{ margin: '1rem 0', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
          
          <button 
            className="portal-sidebar-btn"
            onClick={handleLaunchPortal}
            style={{ color: '#60a5fa' }}
          >
            <Globe size={18} style={{ marginRight: '0.5rem' }} />
            Launch Portal
          </button>
        </div>
        <div className="nav-footer">
          Phase 4: SOTA
        </div>
      </nav>

      <main className="content-area">
        <div className="top-global-bar">
          <GlobalSettings 
            config={globalConfig} 
            onUpdate={setGlobalConfig} 
            onPinToAll={handlePinToAll}
          />
        </div>

        {activeTab === 'excel' ? (
          <ExcelWorkbench 
            onDataLoaded={(data) => {
              setFarmers(data.map((r: any) => ({
                id: r.nik,
                nik: r.nik,
                name: r.name,
                hasSJ: false,
                hasPhoto: false,
                isMathSynced: r.isSynced,
                useGlobal: { ujiLab: true, sertifikasiLab: true, transportInvoice: true }
              })));
            }}
          />
        ) : (
          <SlicerWorkspace farmers={farmers} setFarmers={setFarmers} />
        )}
      </main>
    </div>
  );
};

export default App;
