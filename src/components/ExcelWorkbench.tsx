import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, AlertCircle, CheckCircle2, Wand2, Download, Trash2 } from 'lucide-react';
import Decimal from 'decimal.js';
import { parseExcelFile, applyMagicBalance, ExcelRow } from '../lib/excelParser';
import './ExcelWorkbench.css';

const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

interface ExcelWorkbenchProps {
  onDataLoaded?: (rows: ExcelRow[]) => void;
}

export const ExcelWorkbench: React.FC<ExcelWorkbenchProps> = ({ onDataLoaded }) => {
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [totalTarget, setTotalTarget] = useState<Decimal>(new Decimal(0));
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelFile(buffer);
      setRows(result.rows);
      setTotalTarget(result.totalTargetValue);
      if (onDataLoaded) onDataLoaded(result.rows);
    } catch (error: any) {
      console.error('Error parsing Excel:', error);
      alert(error.message || 'Gagal membaca file Excel. Pastikan format sesuai.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const currentSum = rows.reduce((acc, row) => acc.plus(row.calculatedValue), new Decimal(0));
  const gap = currentSum.minus(totalTarget);
  const isBalanced = gap.abs().lessThan(1);

  const handleMagicBalance = () => {
    if (gap.abs().gt(10000)) {
      alert('Selisih terlalu besar (> Rp 10.000). Silakan periksa data secara manual.');
      return;
    }
    const balancedRows = applyMagicBalance(rows, totalTarget);
    setRows(balancedRows);
  };

  const clearData = () => {
    setRows([]);
    setTotalTarget(new Decimal(0));
  };

  return (
    <div className="workbench-container">
      <header className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.875rem' }}>Excel Math Balancer</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>BASTBANPEM Data Engine v2.0</p>
          </div>
          {rows.length > 0 && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={handleMagicBalance} 
                className="magic-button"
                disabled={isBalanced}
              >
                <Wand2 size={18} />
                Magic Balance
              </button>
              <button 
                onClick={clearData} 
                className="magic-button" 
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error)' }}
              >
                <Trash2 size={18} />
                Reset
              </button>
            </div>
          )}
        </div>

        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-label">Total Kontrak (Target)</span>
            <span className="stat-value">{formatIDR(totalTarget.toNumber())}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Sum of Rows (Calculated)</span>
            <span className="stat-value">{formatIDR(currentSum.toNumber())}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Gap / Selisih</span>
            <span className={`stat-value ${gap.isZero() ? 'gap-zero' : gap.gt(0) ? 'gap-positive' : 'gap-negative'}`}>
              {formatIDR(gap.toNumber())}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Status Guard</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              {isBalanced ? (
                <><CheckCircle2 color="var(--success)" size={20} /> <span style={{ color: 'var(--success)' }}>READY FOR INJECTION</span></>
              ) : (
                <><AlertCircle color="var(--error)" size={20} /> <span style={{ color: 'var(--error)' }}>UNSYNCED</span></>
              )}
            </div>
          </div>
        </div>
      </header>

      {rows.length === 0 ? (
        <div {...getRootProps()} className="dropzone glass-card">
          <input {...getInputProps()} />
          <FileSpreadsheet size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          {isDragActive ? (
            <p style={{ fontSize: '1.25rem' }}>Drop file Excel di sini...</p>
          ) : (
            <>
              <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Tarik & Lepas file Excel di sini</p>
              <p style={{ color: 'var(--text-muted)' }}>Mendukung .xlsx dari format KAN_Vista</p>
            </>
          )}
        </div>
      ) : (
        <main className="glass-card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>NIK</th>
                  <th>Nama Penerima</th>
                  <th>Desa</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Shipping</th>
                  <th>Target (Col X)</th>
                  <th>Calc Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowId}>
                    <td className="amount-display">{row.nik}</td>
                    <td>{row.name}</td>
                    <td>{row.village}</td>
                    <td>{row.qty}</td>
                    <td className="amount-display">{formatIDR(row.unitPrice)}</td>
                    <td className="amount-display">{formatIDR(row.shipping)}</td>
                    <td className="amount-display" style={{ fontWeight: 600 }}>{formatIDR(row.targetValue)}</td>
                    <td className="amount-display" style={{ color: row.isSynced ? 'inherit' : 'var(--error)' }}>
                      {formatIDR(row.calculatedValue)}
                    </td>
                    <td>
                      <span className={`status-indicator ${row.isSynced ? 'status-synced' : 'status-unsynced'}`}>
                        {row.isSynced ? 'SYNCED' : 'ERR'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}
      
      {rows.length > 0 && (
        <footer style={{ display: 'flex', justifyContent: 'flex-end' }}>
           <button className="magic-button" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
              <Download size={20} />
              Export Rincian_Penerima_Import.xlsx
           </button>
        </footer>
      )}
    </div>
  );
};
