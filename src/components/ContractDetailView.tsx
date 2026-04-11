import React, { useState } from 'react';
import { ContractData } from '../lib/contractStore';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Server, FileText, ImageIcon, Scissors, Save, FileUp, ShieldCheck } from 'lucide-react';
import { ExcelWorkbench } from './ExcelWorkbench';
import { ImageTaggerWorkspace } from './ImageTaggerWorkspace';
import { SlicerWorkspace } from './SlicerWorkspace';
import { PdfSyncModule } from './PdfSyncModule';
import { DocumentManager } from './DocumentManager';
import { ReconciliationTab } from './ReconciliationTab';
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
  <section id={id} className="admin-section">
    <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <Icon className="size-5 text-slate-400" />
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">{title}</h2>
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-tight">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge}
        {actions}
      </div>
    </div>
    <div className={cn("admin-viewport", viewportClassName)}>
      {children}
    </div>
  </section>
);

export const ContractDetailView: React.FC<ContractDetailViewProps> = ({ contract, onBack, onUpdate }) => {
  const [activeSection, setActiveSection] = useState<'all' | 'pdf' | 'excel' | 'ktp' | 'proof' | 'docs'>('all');

  const ktpDir = contract.ktpDir || '';
  const proofDir = contract.proofDir || '';

  const handleExcelDataLoaded = (data: any[]) => {
    onUpdate(contract.id, { recipients: data });
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
    hasSJ: false,
    hasPhoto: r.hasPhoto || false,
    isMathSynced: r.isSynced,
    useGlobal: { ujiLab: true, sertifikasiLab: true, transportInvoice: true }
  }));

  const setFarmersProxyByNik = (setter: any) => {
    const updatedFarmers = typeof setter === 'function' ? setter(farmers) : setter;
    // Map back to recipients
    const updatedRecipients = contract.recipients.map(r => {
        const matchingFarmer = updatedFarmers.find((f:any) => f.nik === r.nik);
        if (matchingFarmer) {
            return { ...r, hasPhoto: matchingFarmer.hasPhoto };
        }
        return r;
    });
    onUpdate(contract.id, { recipients: updatedRecipients });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full bg-muted/50 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Editing Contract</div>
            <h1 className="text-xl font-bold">{contract.name}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => document.getElementById("sec-pdf")?.scrollIntoView({behavior: "smooth"})}>PDF Sync</Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById("sec-excel")?.scrollIntoView({behavior: "smooth"})}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById("sec-audit")?.scrollIntoView({behavior: "smooth"})} className="bg-indigo-50 border-indigo-100 text-indigo-700">Audit</Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById("sec-ktp")?.scrollIntoView({behavior: "smooth"})}>KTPs</Button>
          <div className="w-px h-6 bg-border mx-2" />
          <Button className="gap-2 bg-slate-900 hover:bg-black font-bold h-9 px-4 rounded-lg shadow-sm">
            <Server className="h-4 w-4" /> Inject All to Portal
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-8 pb-16 scroll-smooth">
        <DashboardSection 
          id="sec-pdf"
          icon={FileText}
          title="1. Master PDF Sync"
          subtitle="Link and extract core contract metadata."
          actions={
            <Button variant="outline" size="sm" className="h-8 gap-2 border-slate-200 text-[10px] font-bold uppercase">
              <FileUp className="h-3.5 w-3.5 text-slate-400"/> Attach PDF
            </Button>
          }
        >
          <PdfSyncModule 
            contract={contract} 
            onUpdate={(updates) => onUpdate(contract.id, updates)} 
          />
        </DashboardSection>

        <DashboardSection 
          id="sec-excel"
          icon={Server}
          title="2. Distribution Workbench"
          subtitle="Reconcile Excel payload with contract values."
        >
          <ExcelWorkbench 
            recipients={contract.recipients}
            globalConfig={globalConfig}
            setGlobalConfig={(c:any) => handleGlobalConfigUpdate(typeof c === 'function' ? c(globalConfig) : c)}
            onDataLoaded={handleExcelDataLoaded}
            globalNIKRegistry={globalNIKRegistry}
            currentContractId={contract.id}
          />
        </DashboardSection>

        <DashboardSection 
          id="sec-audit"
          icon={ShieldCheck}
          title="3. Audit & Reconciliation"
          subtitle="Physical PDF vs Digital Excel data integrity report."
        >
          <ReconciliationTab contract={contract} />
        </DashboardSection>

        <DashboardSection 
          id="sec-ktp"
          icon={ImageIcon}
          title="4. KTP Tagging Gallery"
          subtitle="Scan folders to attach local KTP images."
          badge={
            <Badge variant={ktpDir ? "outline" : "secondary"} className="h-6">
              {ktpDir ? "Connected" : "Disconnected"}
            </Badge>
          }
          actions={
            <Button variant="outline" size="sm" className="h-8 gap-2 border-slate-200 text-[10px] font-bold uppercase">
              <Server className="h-3.5 w-3.5 text-slate-400"/> Export Stats
            </Button>
          }
        >
          <ImageTaggerWorkspace 
            farmers={farmers}
            setFarmers={setFarmersProxyByNik}
            globalConfig={globalConfig}
            setGlobalConfig={(c:any) => handleGlobalConfigUpdate(typeof c === 'function' ? c(globalConfig) : c)}
            type="ktp"
          />
        </DashboardSection>

        <DashboardSection 
          id="sec-proof"
          icon={ImageIcon}
          title="5. Photo Tagging Gallery"
          subtitle="Scan folders to attach local Proof/Photo images."
          badge={
            <Badge variant={proofDir ? "outline" : "secondary"} className="h-6">
              {proofDir ? "Connected" : "Disconnected"}
            </Badge>
          }
        >
          <ImageTaggerWorkspace 
            farmers={farmers}
            setFarmers={setFarmersProxyByNik}
            globalConfig={globalConfig}
            setGlobalConfig={(c:any) => handleGlobalConfigUpdate(typeof c === 'function' ? c(globalConfig) : c)}
            type="proof"
          />
        </DashboardSection>

        <DashboardSection 
          id="sec-docs"
          icon={Scissors}
          title="6. Global Documents & Slicer"
          subtitle="Attach or slice BASTB, Surat Jalan, and Uji LAB."
          actions={
            <Button variant="outline" size="sm" className="h-8 gap-2 border-slate-200 text-[10px] font-bold uppercase">
              <Server className="h-4 w-4 text-slate-400"/> Export Docs
            </Button>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 h-[800px]">
             <DocumentManager contract={contract} onUpdate={(updates) => onUpdate(contract.id, updates)} />
             <div className="border rounded-xl border-slate-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col">
                <div className="px-4 py-2 bg-slate-50 border-b flex justify-between items-center">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Document Slicer</span>
                   <Badge variant="outline" className="text-[9px] border-slate-200 bg-white">BETA</Badge>
                </div>
                <div className="flex-1 overflow-hidden">
                   <SlicerWorkspace farmers={farmers} setFarmers={setFarmersProxyByNik} />
                </div>
             </div>
          </div>
        </DashboardSection>
      </div>
    </div>
  );
};
