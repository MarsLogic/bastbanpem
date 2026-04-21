import React from 'react';
import { Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface BackgroundSyncTrayProps {
  progress: number;
  status: string;
  onCancel?: () => void;
  isVisible: boolean;
  error?: string;
}

export const BackgroundSyncTray: React.FC<BackgroundSyncTrayProps> = ({ 
  progress, 
  status, 
  onCancel, 
  isVisible,
  error 
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-[#1f2937] border border-[#111827] rounded-xl shadow-2xl p-4 z-[100] animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {status === 'RUNNING' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
          {status === 'FAILED' && <AlertCircle className="w-4 h-4 text-red-400" />}
          {status === 'COMPLETED' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span className="text-xs font-bold text-white tracking-widest uppercase">
            {status === 'RUNNING' ? 'Aligning Data' : status}
          </span>
        </div>
        {status === 'RUNNING' && (
          <button 
            onClick={onCancel}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors group"
            title="Cancel Ingestion"
          >
            <X className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
          </button>
        )}
      </div>

      {error ? (
          <div className="text-[10px] text-red-400 leading-relaxed font-mono">
            {error}
          </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 font-mono">Progress: {progress}%</span>
            <span className="text-[10px] text-gray-400 font-mono">
              {status === 'RUNNING' ? 'Standardizing...' : 'Finalizing...'}
            </span>
          </div>
          
          <div className="h-1 w-full bg-black/40 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-3 text-[9px] text-gray-400/80 leading-relaxed italic text-center">
             Ingestion will persist even if you refresh or navigate away. 
          </p>
        </>
      )}
    </div>
  );
};
