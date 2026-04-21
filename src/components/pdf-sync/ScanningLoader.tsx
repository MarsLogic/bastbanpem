import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Search, FileText, Database, ShieldCheck, 
  Cpu, Sparkles
} from 'lucide-react';

const LOGIC_STEPS = [
  { id: 'decrypt', label: "Opening PDF", icon: ShieldCheck },
  { id: 'entity', label: "Location Mapping", icon: Search },
  { id: 'sskk', label: "SSKK Extraction", icon: FileText },
  { id: 'table', label: "Table Detection", icon: Database },
  { id: 'optimize', label: "Data Validation", icon: Sparkles },
];

export const ScanningLoader: React.FC = () => {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIdx((prev) => (prev + 1) % LOGIC_STEPS.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full min-h-[500px] bg-white overflow-hidden flex items-center justify-center p-8 border-t border-slate-100">
      
      {/* ── Background Intelligence Grid ─────────────────────────────────── */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      
      {/* ── Neural Sweep Area ────────────────────────────────────────────── */}
      <div className="relative w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        
        {/* Left: Ghost Document Outline (The 'Neural Sweep') */}
        <div className="lg:col-span-7 relative h-[420px] w-full bg-slate-50/50 rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
          
          {/* Skeleton Document Content */}
          <div className="p-10 space-y-6">
            <div className="h-4 w-1/3 bg-slate-200 rounded-full animate-pulse" />
            <div className="space-y-3">
              <div className="h-3 w-full bg-slate-100 rounded-full" />
              <div className="h-3 w-5/6 bg-slate-100 rounded-full" />
              <div className="h-3 w-4/6 bg-slate-100 rounded-full" />
            </div>
            
            {/* Table Ghost */}
            <div className="pt-8 grid grid-cols-4 gap-4">
              {[1, 2, 3, 4, 1, 2, 3, 4].map((i, idx) => (
                <div key={idx} className="h-10 bg-white rounded-md border border-slate-200/50" />
              ))}
            </div>

            <div className="pt-8 space-y-3">
              <div className="h-3 w-full bg-slate-100 rounded-full" />
              <div className="h-3 w-2/3 bg-slate-100 rounded-full" />
            </div>
          </div>

          {/* THE SCANNING LASER - Monochromatic */}
          <motion.div 
            animate={{ top: ['-10%', '110%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-32 bg-gradient-to-b from-transparent via-slate-900/5 to-transparent z-10 pointer-events-none"
          >
            <div className="h-[2px] w-full bg-slate-900/20 shadow-[0_0_20px_rgba(0,0,0,0.1)]" />
          </motion.div>

          {/* Floating Data Points */}
          <AnimatePresence>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ 
                  opacity: [0, 0.5, 0],
                  scale: [0.5, 1, 0.5],
                  x: Math.random() * 500,
                  y: Math.random() * 500
                }}
                transition={{ duration: 5, repeat: Infinity, delay: i * 0.5 }}
                className="absolute w-1.5 h-1.5 rounded-full bg-slate-900/10 blur-[1px]"
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Right: Intelligence Handoff Progress */}
        <div className="lg:col-span-5 space-y-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-900 rounded-xl shadow-lg shadow-slate-200">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Processing</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Data Processing</span>
              </div>
            </div>
            <p className="text-[12px] text-slate-500 leading-relaxed font-medium pl-14">
              Extracting document data and financial tables for review.
            </p>
          </div>

          <div className="space-y-5">
            {LOGIC_STEPS.map((step, idx) => {
              const isActive = idx === stepIdx;
              const isPast = idx < stepIdx;
              const Icon = step.icon;

              return (
                <div key={step.id} className="relative flex items-center gap-5">
                  <div className={`
                    z-10 w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-700
                    ${isActive ? 'bg-white border-slate-900 shadow-2xl shadow-slate-200 scale-110 z-20' : 
                      isPast ? 'bg-slate-50 border-slate-200' : 'bg-slate-50/50 border-slate-100'}
                  `}>
                    <Icon className={`w-4 h-4 transition-colors duration-700 ${isActive ? 'text-slate-900' : isPast ? 'text-slate-400' : 'text-slate-200'}`} />
                  </div>
                  
                  {/* Connector Line */}
                  {idx < LOGIC_STEPS.length - 1 && (
                    <div className="absolute left-[20px] top-10 w-[1px] h-5 bg-slate-100" />
                  )}

                  <div className="flex flex-col">
                    <span className={`text-[13px] font-black tracking-tight transition-all duration-700 ${isActive ? 'text-slate-900' : isPast ? 'text-slate-500' : 'text-slate-300'}`}>
                      {step.label}
                    </span>
                    <AnimatePresence>
                      {isActive && (
                        <motion.span 
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-[9px] text-slate-900 font-black uppercase tracking-[0.2em] mt-0.5"
                        >
                          Processing...
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {isPast && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }} 
                      animate={{ scale: 1, opacity: 1 }} 
                      className="ml-auto"
                    >
                      <div className="w-2 h-2 rounded-full bg-slate-900" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Shimmer Progress Bar - Strictly Black & White */}
          <div className="pt-6 space-y-3">
            <div className="flex justify-between text-[11px] font-black uppercase tracking-[0.1em] text-slate-900 px-1">
              <span>Progress</span>
              <span>{( (stepIdx + 1) / LOGIC_STEPS.length * 100).toFixed(0)}%</span>
            </div>
            <div className="h-[3px] w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${( (stepIdx + 1) / LOGIC_STEPS.length * 100)}%` }}
                className="h-full bg-slate-900 shadow-[0_0_8px_rgba(0,0,0,0.1)]"
              />
            </div>
          </div>
        </div>

      </div>

      {/* ── Terminal Feed (Monochrome Minimalist) ────────────────────────── */}
      <div className="absolute bottom-10 left-10 hidden xl:block">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xl w-72 space-y-3 opacity-90 scale-90 origin-bottom-left">
          <div className="flex items-center gap-1.5 mb-3">
             <div className="w-2.5 h-2.5 rounded-full bg-slate-200" />
             <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
             <div className="w-2.5 h-2.5 rounded-full bg-slate-50" />
             <span className="text-[10px] text-slate-400 font-black ml-auto lowercase">engine.core.log</span>
          </div>
          <div className="font-mono text-[10px] space-y-1.5">
             <p className="text-slate-900 font-bold">SYSTEM_READY ... [OK]</p>
             <p className="text-slate-500">READING_PAGES ... {stepIdx + 1}/12</p>
             <p className="text-slate-400">RECORDS_FOUND ... {12 * (stepIdx + 1)}</p>
             <p className="text-slate-900 animate-pulse font-black uppercase tracking-tighter">_PROCESSING_DATA</p>
          </div>
        </div>
      </div>

    </div>
  );
};
