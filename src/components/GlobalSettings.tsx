import React from 'react';
import { Zap, Pin, FileText, FileCheck, Coins } from 'lucide-react';
import './GlobalSettings.css';

interface GlobalConfig {
  uji_lab_file?: string;
  sertifikasi_lab_file?: string;
  transport_invoice_file?: string;
  nomor_sertifikat: string;
  tanggal_sertifikat: string;
  lembaga_penguji: string;
}

interface GlobalSettingsProps {
  config: GlobalConfig;
  onUpdate: (config: GlobalConfig) => void;
  onPinToAll: () => void;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ config, onUpdate, onPinToAll }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onUpdate({ ...config, [name]: value });
  };

  const handleFileDrop = (type: 'uji' | 'invoice' | 'cert') => (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      // In a real Tauri app, we'd use the path from the event or a dialog
      // For now, we simulate setting the path
      const simulatedPath = `C:\\Global_Assets\\${file.name}`;
      const fieldMap: Record<string, keyof GlobalConfig> = {
        uji: 'uji_lab_file',
        invoice: 'transport_invoice_file',
        cert: 'sertifikasi_lab_file'
      };
      onUpdate({ ...config, [fieldMap[type]]: simulatedPath });
    }
  };

  return (
    <div className="global-settings-container glass-card">
      <div className="settings-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={20} color="var(--primary)" />
          Batch Settings & Global Assets
        </h2>
        <button className="pin-button" onClick={onPinToAll}>
          <Pin size={16} />
          Pin to All Recipients
        </button>
      </div>

      <div className="settings-grid">
        <div className="dropzone-area">
          <div 
            className={`file-dropzone ${config.uji_lab_file ? 'has-file' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop('uji')}
          >
            <span className="icon"><FileText size={24} /></span>
            <div className="dropzone-text">
              <strong>Laporan Uji Lab</strong>
              <p>{config.uji_lab_file ? config.uji_lab_file.split('\\').pop() : 'Drop PDF here'}</p>
            </div>
            {config.uji_lab_file && <span className="status-badge">Set</span>}
          </div>

          <div 
            className={`file-dropzone ${config.sertifikasi_lab_file ? 'has-file' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop('cert')}
          >
            <span className="icon"><FileCheck size={24} /></span>
            <div className="dropzone-text">
              <strong>Sertifikat Lab</strong>
              <p>{config.sertifikasi_lab_file ? config.sertifikasi_lab_file.split('\\').pop() : 'Drop PDF here'}</p>
            </div>
            {config.sertifikasi_lab_file && <span className="status-badge">Set</span>}
          </div>

          <div 
            className={`file-dropzone ${config.transport_invoice_file ? 'has-file' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop('invoice')}
          >
            <span className="icon"><Coins size={24} /></span>
            <div className="dropzone-text">
              <strong>Invoice Transport</strong>
              <p>{config.transport_invoice_file ? config.transport_invoice_file.split('\\').pop() : 'Drop PDF here'}</p>
            </div>
            {config.transport_invoice_file && <span className="status-badge">Set</span>}
          </div>
        </div>

        <div className="metadata-area">
          <div className="input-group">
            <label>Nomor Sertifikat</label>
            <input 
              type="text" 
              name="nomor_sertifikat" 
              value={config.nomor_sertifikat} 
              onChange={handleInputChange}
              placeholder="e.g. 123/LAB/2025"
            />
          </div>
          <div className="input-group">
            <label>Tanggal Sertifikat</label>
            <input 
              type="text" 
              name="tanggal_sertifikat" 
              value={config.tanggal_sertifikat} 
              onChange={handleInputChange}
              placeholder="e.g. 01 Januari 2025"
            />
          </div>
          <div className="input-group">
            <label>Lembaga Penguji</label>
            <input 
              type="text" 
              name="lembaga_penguji" 
              value={config.lembaga_penguji} 
              onChange={handleInputChange}
              placeholder="e.g. Sucofindo"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;
