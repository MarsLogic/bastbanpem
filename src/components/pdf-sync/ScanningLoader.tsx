import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Search, FileText, Database, ShieldCheck, 
  Cpu, Layout, Sparkles, Binary
} from 'lucide-react';

const LOGIC_STEPS = [
  { id: 'decrypt', label: "PDF Decryption", icon: ShieldCheck, color: "text-emerald-500" },
  { id: 'entity', label: "Entity Mapping", icon: Search, color: "text-blue-500" },
  { id: 'sskk', label: "SSKK Extraction", icon: FileText, color: "text-indigo-500" },
  { id: 'table', label: "Table Reconstruction", icon: Database, color: "text-amber-500" },
  { id: 'optimize', label: "Neural Optimization", icon: Sparkles, color: "text-purple-500" },
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
    <div className="relative w-full min-h-[500px] bg-slate-50/30 overflow-hidden flex items-center justify-center p-8">
      
      {/* ── Background Intelligence Grid ─────────────────────────────────── */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      
      {/* ── Neural Sweep Area ────────────────────────────────────────────── */}
      <div className="relative w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left: Ghost Document Outline (The 'Neural Sweep') */}
        <div className="lg:col-span-7 relative h-[400px] w-full bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden group">
          
          {/* Skeleton Document Content */}
          <div className="p-8 space-y-6">
            <div className="h-4 w-1/3 bg-slate-100 rounded-full animate-pulse" />
            <div className="space-y-3">
              <div className="h-3 w-full bg-slate-50 rounded-full" />
              <div className="h-3 w-5/6 bg-slate-50 rounded-full" />
              <div className="h-3 w-4/6 bg-slate-50 rounded-full" />
            </div>
            
            {/* Table Ghost */}
            <div className="pt-8 grid grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-8 bg-slate-50 rounded-md border border-slate-100/50" />
              ))}
            </div>

            <div className="pt-8 space-y-3">
              <div className="h-3 w-full bg-slate-50 rounded-full" />
              <div className="h-3 w-2/3 bg-slate-50 rounded-full" />
            </div>
          </div>

          {/* THE SCANNING LASER */}
          <motion.div 
            animate={{ top: ['-10%', '110%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-24 bg-gradient-to-b from-transparent via-blue-400/20 to-transparent z-10 pointer-events-none"
          >
            <div className="h-[1px] w-full bg-blue-400/50 shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
          </motion.div>

          {/* Floating Data Points */}
          <AnimatePresence>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0.5, 1, 0.5],
                  x: Math.random() * 400,
                  y: Math.random() * 400
                }}
                transition={{ duration: 4, repeat: Infinity, delay: i * 0.7 }}
                className="absolute w-2 h-2 rounded-full bg-blue-500/20 blur-sm"
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Right: Intelligence Handoff Progress */}
        <div className="lg:col-span-5 space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Cpu className="w-5 h-5 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Intelligence Engine</h3>
            </div>
            <p className="text-[12px] text-slate-500 leading-relaxed font-medium">
              Autonomous extraction in progress. Reconstructing contract stanzas and financial matrices.
            </p>
          </div>

          <div className="space-y-4">
            {LOGIC_STEPS.map((step, idx) => {
              const isActive = idx === stepIdx;
              const isPast = idx < stepIdx;
              const Icon = step.icon;

              return (
                <div key={step.id} className="relative flex items-center gap-4">
                  <div className={`
                    z-10 w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all duration-500
                    ${isActive ? 'bg-white border-blue-500 shadow-lg shadow-blue-100 scale-110' : 
                      isPast ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-100'}
                  `}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : isPast ? 'text-emerald-600' : 'text-slate-300'}`} />
                  </div>
                  
                  {/* Connector Line */}
                  {idx < LOGIC_STEPS.length - 1 && (
                    <div className="absolute left-[17px] top-9 w-[2px] h-4 bg-slate-100" />
                  )}

                  <div className="flex flex-col">
                    <span className={`text-[12px] font-bold tracking-tight transition-colors duration-500 ${isActive ? 'text-slate-900' : isPast ? 'text-slate-500' : 'text-slate-300'}`}>
                      {step.label}
                    </span>
                    <AnimatePresence>
                      {isActive && (
                        <motion.span 
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-0.5"
                        >
                          Processing...
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {isPast && (
                    <motion.div 
                      initial={{ scale: 0 }} 
                      animate={{ scale: 1 }} 
                      className="ml-auto"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Shimmer Progress Bar */}
          <div className="pt-4 space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Extraction Fidelity</span>
              <span>{( (stepIdx + 1) / LOGIC_STEPS.length * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${( (stepIdx + 1) / LOGIC_STEPS.length * 100)}%` }}
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              />
            </div>
          </div>
        </div>

      </div>

      {/* ── Terminal Feed (Bottom Left) ─────────────────────────────────── */}
      <div className="absolute bottom-6 left-6 hidden xl:block">
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-2xl w-64 space-y-2 opacity-80 scale-90 origin-bottom-left">
          <div className="flex items-center gap-2 mb-2">
             <div className="w-2 h-2 rounded-full bg-red-400" />
             <div className="w-2 h-2 rounded-full bg-amber-400" />
             <div className="w-2 h-2 rounded-full bg-emerald-400" />
             <span className="text-[9px] text-slate-500 font-mono ml-auto">neuro-parser.log</span>
          </div>
          <div className="font-mono text-[9px] space-y-1">
             <p className="text-emerald-400">LOADING_KERNEL... OK</p>
             <p className="text-slate-400">SCANNING_PAGES: {stepIdx + 1}/12</p>
             <p className="text-slate-400">ENTITIES_FOUND: {12 * (stepIdx + 1)}</p>
             <p className="text-blue-400 animate-pulse">_LISTENING_FOR_DELIVERABLES</p>
          </div>
        </div>
      </div>

    </div>
  );
};
