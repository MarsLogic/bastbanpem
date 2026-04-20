import React, { useState } from 'react';
import { ContractData } from '../lib/contractStore';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Server, FileText, ImageIcon, Scissors, Save, FileUp, ShieldCheck, Printer, FileCheck, RefreshCw } from 'lucide-react';
import { ExcelWorkbench } from './ExcelWorkbench';
import { ImageTaggerWorkspace } from './ImageTaggerWorkspace';
import { SlicerWorkspace } from './SlicerWorkspace';
import { PdfSyncModule } from './PdfSyncModule';
import { DocumentManager } from './DocumentManager';
import { ReconciliationTab } from './ReconciliationTab';
import { PortalSyncModule } from './PortalSyncModule';
import { ContractSummary } from './ContractSummary';
import { DistributionIntelligence } from './DistributionIntelligence';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ContractDetailViewProps {
  contract: ContractData;
  globalNIKRegistry: Map<string, { id: string, name: string }[]>;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<ContractData>) => void;
}

const DashboardSection = ({ id, icon: Icon, title, subtitle, badge, actions, children, viewportClassName }: any) => (
  <section id={id} className="admin-section !overflow-visible border-slate-200 bg-white shadow-sm rounded-xl mb-8">
    <div className="px-6 py-4 border-b bg-slate-50/50 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
          <Icon className="size-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {actions}
      </div>
    </div>
    <div className={cn("min-h-[400px]", viewportClassName)}>
      {children}
    </div>
  </section>
);

export const ContractDetailView: React.FC<ContractDetailViewProps> = ({ contract, globalNIKRegistry, onBack, onUpdate }) => {
  const ktpDir = contract.ktpDir || '';
  const proofDir = contract.proofDir || '';

  const handleExcelDataLoaded = (result: any) => {
    onUpdate(contract.id, { 
      recipients: result.rows,
      // Metadata from Excel scan could go here
    });
  };

  const handleGlobalConfigUpdate = (config: any) => {
    onUpdate(contract.id, {
      nomorKontrak: config.nomor_sertifikat,
      tanggalKontrak: config.tanggal_sertifikat,
      namaPenyedia: config.lembaga_penguji,
      ktpDir: config.ktpDir,
      proofDir: config.proofDir
    });
  };

  const globalConfig = {
    nomor_sertifikat: contract.nomorKontrak || '',
    tanggal_sertifikat: contract.tanggalKontrak || '',
    lembaga_penguji: contract.namaPenyedia || '',
    ktpDir: ktpDir,
    proofDir: proofDir
  };

  const farmers = contract.recipients.map(r => ({
    id: r.nik,
    nik: r.nik,
    name: r.name,
    group: r.group || 'N/A',
    hasSJ: r.hasSJ || false,
    hasPhoto: r.hasPhoto || false,
    hasKtp: r.hasKtp || false,
    isMathSynced: r.is_synced,
    useGlobal: { ujiLab: true, sertifikasiLab: true, transportInvoice: true }
  }));

  const setFarmersProxyByNik = (setter: any) => {
    const updatedFarmers = typeof setter === 'function' ? setter(farmers) : setter;
    const updatedRecipients = contract.recipients.map(r => {
        const matchingFarmer = updatedFarmers.find((f: any) => f.nik === r.nik);
        if (matchingFarmer) {
            return { ...r, hasPhoto: matchingFarmer.hasPhoto, hasKtp: matchingFarmer.hasKtp, hasSJ: matchingFarmer.hasSJ };
        }
        return r;
    });
    onUpdate(contract.id, { recipients: updatedRecipients });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
          <div>
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Contract Detail</div>
            <h1 className="text-base font-black text-slate-900 uppercase tracking-tight">{contract.name}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <NavButton icon={FileText} label="Contract PDF" target="sec-pdf" />
          <NavButton icon={Server} label="Recipients" target="sec-excel" />
          <NavButton icon={ShieldCheck} label="Audit" target="sec-audit" />
          <NavButton icon={ImageIcon} label="Documents" target="sec-ktp" />
          <NavButton icon={RefreshCw} label="Portal Sync" target="sec-portal" />
          <div className="w-px h-6 bg-slate-200 mx-2" />
          <Button className="gap-2 bg-black hover:bg-zinc-800 text-white font-bold h-8 px-4 rounded-full shadow-lg text-[10px] uppercase tracking-widest">
            <Server className="h-3.5 w-3.5" /> Submit to Portal
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8 max-w-[1600px] mx-auto w-full space-y-2 pb-24 scroll-smooth">
        
        <DashboardSection
          id="sec-pdf"
          icon={FileText}
          title="1. Contract PDF"
          subtitle="Document Viewer & Data Extraction"
        >
          <PdfSyncModule 
            contract={contract} 
            onUpdate={(updates) => onUpdate(contract.id, updates)} 
          />
        </DashboardSection>

        <DashboardSection 
          id="sec-excel"
          icon={Server}
          title="2. Distribution Intelligence"
          subtitle="Precision Parsing & Recipient Hub"
        >
          <div className="p-6">
            <DistributionIntelligence 
              onDataLoaded={handleExcelDataLoaded}
            />
          </div>
        </DashboardSection>

        <DashboardSection 
          id="sec-audit"
          icon={ShieldCheck}
          title="3. Audit & Reconciliation"
          subtitle="Data Discrepancy Report"
        >
          <div className="p-6">
            <ReconciliationTab contract={contract} />
          </div>
        </DashboardSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DashboardSection 
              id="sec-ktp"
              icon={ImageIcon}
              title="4. ID Documents (KTP)"
              subtitle="KTP Matching & Verification"
              viewportClassName="min-h-[600px]"
            >
              <ImageTaggerWorkspace 
                farmers={farmers}
                setFarmers={setFarmersProxyByNik}
                globalConfig={globalConfig}
                setGlobalConfig={(c:any) => handleGlobalConfigUpdate(typeof c === 'function' ? c(globalConfig) : c)}
                type="ktp"
                bindings={contract.ktpBindings}
                onBindChange={(newBindings: Record<string, string>) => onUpdate(contract.id, { ktpBindings: newBindings })}
              />
            </DashboardSection>

            <DashboardSection 
              id="sec-proof"
              icon={ImageIcon}
              title="5. Delivery Photos"
              subtitle="Photo Evidence & Binding"
              viewportClassName="min-h-[600px]"
            >
              <ImageTaggerWorkspace 
                farmers={farmers}
                setFarmers={setFarmersProxyByNik}
                globalConfig={globalConfig}
                setGlobalConfig={(c: any) => handleGlobalConfigUpdate(typeof c === 'function' ? c(globalConfig) : c)}
                type="proof"
                bindings={contract.proofBindings}
                onBindChange={(newBindings: Record<string, string>) => onUpdate(contract.id, { proofBindings: newBindings })}
              />
            </DashboardSection>
        </div>

        <DashboardSection 
          id="sec-docs"
          icon={Scissors}
          title="6. Document Generator"
          subtitle="Generate BASTB, SJ, and Lab Reports"
          actions={
            <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 gap-2 rounded-full border-slate-200 text-[9px] font-black uppercase">
                  <Printer className="h-3 w-3 text-slate-400"/> Batch Print
                </Button>
                <Button size="sm" className="h-7 gap-2 rounded-full bg-black hover:bg-zinc-800 text-white text-[9px] font-black uppercase shadow-md shadow-slate-300">
                  <FileCheck className="h-3 w-3"/> Bundle All
                </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-[800px]">
             <div className="border-r border-slate-100">
                <DocumentManager contract={contract} onUpdate={(updates: Partial<ContractData>) => onUpdate(contract.id, updates)} />
             </div>
             <div className="bg-slate-50/30 overflow-hidden flex flex-col">
                <div className="px-6 py-3 border-b flex justify-between items-center bg-white/50">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Document Slicer</span>
                </div>
                <div className="flex-1 overflow-hidden">
                   <SlicerWorkspace farmers={farmers} setFarmers={setFarmersProxyByNik} />
                </div>
             </div>
          </div>
        </DashboardSection>

        <DashboardSection 
          id="sec-portal"
          icon={RefreshCw}
          title="7. Portal Sync"
          subtitle="Government Portal Data Submission"
          viewportClassName="min-h-[600px]"
        >
          <PortalSyncModule 
            contract={contract} 
            onUpdate={onUpdate} 
          />
        </DashboardSection>
      </div>
    </div>
  );
};

const NavButton = ({ icon: Icon, label, target, className }: any) => (
  <Button 
    variant="ghost" 
    size="sm" 
    onClick={() => document.getElementById(target)?.scrollIntoView({behavior: "smooth"})}
    className={cn("h-8 text-[10px] font-bold uppercase tracking-tight gap-2 rounded-full", className)}
  >
    <Icon className="size-3.5 opacity-60" /> {label}
  </Button>
);
