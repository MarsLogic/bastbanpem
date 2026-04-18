import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Search, FileText, Database, ShieldCheck, Sparkles } from 'lucide-react';

const STATUSES = [
  { icon: Search, text: "Scanning PDF Document..." },
  { icon: Cpu, text: "Processing Contract Structure..." },
  { icon: FileText, text: "Extracting SSKK Articles..." },
  { icon: Database, text: "Formatting Data Tables..." },
  { icon: ShieldCheck, text: "Validating Extraction Results..." },
  { icon: Sparkles, text: "Optimizing Document View..." },
];

export const ScanningLoader: React.FC = () => {
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % STATUSES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const CurrentIcon = STATUSES[statusIdx].icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-slate-50/50 backdrop-blur-sm relative overflow-hidden rounded-xl border border-slate-200 shadow-inner">
      {/* Background Animated Orbs - Now subtle and Monochrome */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.05, 0.1, 0.05],
          x: [0, 50, 0],
          y: [0, -30, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 -left-20 w-64 h-64 bg-slate-300 rounded-full blur-[100px] pointer-events-none"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.05, 0.1, 0.05],
          x: [0, -40, 0],
          y: [0, 40, 0]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-1/4 -right-20 w-80 h-80 bg-slate-200 rounded-full blur-[120px] pointer-events-none"
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Main Pulsing Orb - Professional Slate/White */}
        <div className="relative">
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 0.9, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-full bg-slate-100 p-[1px] shadow-xl shadow-slate-200 border border-slate-200"
          >
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={statusIdx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  className="text-slate-800"
                >
                  <CurrentIcon size={36} strokeWidth={1.5} />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
          
          {/* Animated Ring - Subtle Slate */}
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-4 border border-dashed border-slate-200 rounded-full opacity-60"
          />
        </div>

        {/* Text Engine */}
        <div className="text-center space-y-4">
          <div className="h-6 overflow-hidden flex flex-col items-center">
             <AnimatePresence mode="wait">
                <motion.p
                  key={statusIdx}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="text-[13px] font-medium text-slate-900 tracking-tight"
                >
                  {STATUSES[statusIdx].text}
                </motion.p>
             </AnimatePresence>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.25em]">
              Document Processing
            </div>
            {/* Shimmer Progress Bar - Monochromatic */}
            <div className="w-40 h-[2px] bg-slate-100 rounded-full overflow-hidden relative">
              <motion.div 
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-400 to-transparent w-full"
              />
            </div>
          </div>
        </div>

        {/* Professional Caveat */}
        <p className="max-w-[280px] text-center text-[11px] text-slate-400 leading-relaxed italic">
          Please wait while the system processes contract tables and section formatting.
        </p>
      </div>
    </div>
  );
};
