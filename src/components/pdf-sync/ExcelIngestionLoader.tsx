import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cpu, 
  FileSpreadsheet, 
  Search, 
  AlignJustify, 
  Zap, 
  Sparkles,
  Database
} from 'lucide-react';

const EXCEL_LOGIC_STEPS = [
  { id: 'open', label: "Workbook Discovery", icon: FileSpreadsheet, threshold: 0 },
  { id: 'structure', label: "Structural Mapping", icon: Search, threshold: 15 },
  { id: 'align', label: "Data Alignment", icon: AlignJustify, threshold: 40 },
  { id: 'clean', label: "Forensic Cleanup", icon: Zap, threshold: 75 },
  { id: 'audit', label: "Audit Validation", icon: Sparkles, threshold: 95 },
];

interface ExcelIngestionLoaderProps {
  progress: number;
}

export const ExcelIngestionLoader: React.FC<ExcelIngestionLoaderProps> = ({ progress }) => {
  // Determine which step is active based on real percentage
  const activeStepIdx = EXCEL_LOGIC_STEPS.reduce((acc, step, idx) => {
    return progress >= step.threshold ? idx : acc;
  }, 0);

  return (
    <div className="relative w-full min-h-[480px] bg-white overflow-hidden flex items-center justify-center p-8 border-t border-slate-100 rounded-b-3xl">
      
      {/* ── Background Intelligence Grid ─────────────────────────────────── */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      
      {/* ── Neural Sweep Area ────────────────────────────────────────────── */}
      <div className="relative w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        
        {/* Left: Ghost Sheet Outline (The 'Neuro-Sweep') */}
        <div className="lg:col-span-7 relative h-[400px] w-full bg-slate-50/50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
          
          {/* Skeleton Sheet Content */}
          <div className="p-10 space-y-4">
            <div className="h-4 w-1/4 bg-slate-200 rounded-full animate-pulse" />
            
            {/* Grid Ghost */}
            <div className="pt-6 grid grid-cols-6 gap-2">
              {[...Array(48)].map((_, idx) => (
                <div key={idx} className={`h-6 rounded-sm border border-slate-200/50 ${idx < 6 ? 'bg-slate-100' : 'bg-white'}`} />
              ))}
            </div>

            <div className="pt-6 space-y-2">
              <div className="h-2 w-full bg-slate-100 rounded-full" />
              <div className="h-2 w-2/3 bg-slate-100 rounded-full" />
            </div>
          </div>

          {/* THE SCANNING LASER - Monochromatic */}
          <motion.div 
            animate={{ top: ['-10%', '110%'] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-slate-900/5 to-transparent z-10 pointer-events-none"
          >
            <div className="h-[1px] w-full bg-slate-900/20 shadow-[0_0_15px_rgba(0,0,0,0.05)]" />
          </motion.div>

          {/* Floating Data Bits */}
          <AnimatePresence>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 0.4, 0],
                  scale: [0.8, 1.2, 0.8],
                  x: [Math.random() * 400, Math.random() * 400],
                  y: [Math.random() * 400, Math.random() * 400]
                }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.7 }}
                className="absolute w-1 h-1 rounded-full bg-slate-900/20 blur-[0.5px]"
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Right: Technical Progress */}
        <div className="lg:col-span-5 space-y-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-900 rounded-xl shadow-lg shadow-slate-200">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Ingestion</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">High-Fidelity Engine</span>
              </div>
            </div>
            <p className="text-[12px] text-slate-500 leading-relaxed font-medium pl-14">
              Analyzing workbook clusters and identifying recipient alignment.
            </p>
          </div>

          <div className="space-y-4">
            {EXCEL_LOGIC_STEPS.map((step, idx) => {
              const isActive = idx === activeStepIdx;
              const isPast = idx < activeStepIdx;
              const Icon = step.icon;

              return (
                <div key={step.id} className="relative flex items-center gap-4">
                  <div className={`
                    z-10 w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-500
                    ${isActive ? 'bg-white border-slate-900 shadow-xl shadow-slate-100 scale-105 z-20' : 
                      isPast ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-100'}
                  `}>
                    <Icon className={`w-3.5 h-3.5 transition-colors duration-500 ${isActive ? 'text-slate-900' : isPast ? 'text-slate-400' : 'text-slate-200'}`} />
                  </div>
                  
                  {/* Connector Line */}
                  {idx < EXCEL_LOGIC_STEPS.length - 1 && (
                    <div className="absolute left-[18px] top-9 w-[1px] h-4 bg-slate-100" />
                  )}

                  <div className="flex flex-col">
                    <span className={`text-[12px] font-black tracking-tight transition-all duration-500 ${isActive ? 'text-slate-900' : isPast ? 'text-slate-500' : 'text-slate-300'}`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <motion.span 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[8px] text-slate-900 font-black uppercase tracking-[0.2em] mt-0.5"
                      >
                        Active
                      </motion.span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shimmer Progress Bar */}
          <div className="pt-4 space-y-3">
            <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.1em] text-slate-900 px-1">
              <span>Sync Progress</span>
              <span>{isNaN(progress) ? 0 : Math.round(progress)}%</span>
            </div>
            <div className="h-[3px] w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${isNaN(progress) ? 0 : progress}%` }}
                className="h-full bg-slate-900 shadow-[0_0_8px_rgba(0,0,0,0.1)]"
              />
            </div>
            <p className="text-[9px] text-slate-400 italic text-center pt-2">
              Synchronizing and validating dataset...
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
