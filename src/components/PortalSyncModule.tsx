import React, { useState, useEffect } from 'react';
import { ContractData, useContracts } from '../lib/contractStore';
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Database, 
  Sync, 
  UploadCloud, 
  ShieldAlert 
} from 'lucide-react';
import { 
  fetchPortalContractsList, 
  fetchPortalContractDetails, 
  syncRecipientToPortal,
  registerMasterRecipient 
} from '../lib/api';
import { performPortalReconciliation, PortalContractData } from '../lib/auditEngine';
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PortalSyncModuleProps {
  contract: ContractData;
  onUpdate: (id: string, updates: Partial<ContractData>) => void;
}

export const PortalSyncModule: React.FC<PortalSyncModuleProps> = ({ contract, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [portalList, setPortalList] = useState<any[]>([]);
  const [selectedPortalId, setSelectedPortalId] = useState<string>(contract.portalMetadata?.portalId || '');
  const [reconciliation, setReconciliation] = useState<any>(null);

  const fetchList = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPortalContractsList();
      setPortalList(data.data || []);
      toast.success('Portal contract list updated');
    } catch (error) {
      toast.error('Failed to fetch portal list');
    } finally {
      setIsLoading(false);
    }
  };

  const runFullAudit = async (idkontrak: string) => {
    setIsLoading(true);
    try {
      const portalDetail = await fetchPortalContractDetails(idkontrak);
      const result = performPortalReconciliation(contract, portalDetail);
      setReconciliation(result);
      
      onUpdate(contract.id, {
        portalMetadata: {
          portalId: idkontrak,
          syncTimestamp: Date.now(),
          nomorDipa: portalDetail.k_dipa,
          lastPortalStatus: portalDetail.status
        }
      });
      
      toast.info(`Audit complete: ${result.issues.length} discrepancies found`);
    } catch (error) {
      toast.error('Audit failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncRecipient = async (row: any) => {
    if (!selectedPortalId) return;
    try {
        await syncRecipientToPortal(selectedPortalId, row);
        toast.success(`Recipient ${row.name} synced`);
        // Refresh audit after sync
        runFullAudit(selectedPortalId);
    } catch (e) {
        toast.error(`Sync failed for ${row.name}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-md shadow-indigo-200">
            <RefreshCw className={cn("size-5 text-white", isLoading && "animate-spin")} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Portal Intelligence Sync</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Bidirectional Reconciliation Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            value={selectedPortalId} 
            onChange={(e) => setSelectedPortalId(e.target.value)}
            className="text-[10px] font-bold uppercase border-slate-200 rounded-full h-8 px-4 bg-white"
          >
            <option value="">-- Bind Portal Contract --</option>
            {portalList.map(p => (
              <option key={p.idkontrak} value={p.idkontrak}>
                {p.k_kontrak_nomor} ({p.idkontrak})
              </option>
            ))}
          </select>
          <Button onClick={fetchList} variant="outline" size="sm" className="h-8 rounded-full text-[10px] font-black uppercase">
            Refresh List
          </Button>
          <Button 
            onClick={() => selectedPortalId && runFullAudit(selectedPortalId)} 
            disabled={!selectedPortalId || isLoading}
            className="h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase px-6"
          >
            Run Integrity Audit
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {reconciliation ? (
          <div className="space-y-6">
            {/* Summary Metrics */}
            <div className="grid grid-cols-4 gap-4">
              <MetricCard 
                label="Integrity Score" 
                value={`${reconciliation.score}%`} 
                status={reconciliation.score > 90 ? 'success' : reconciliation.score > 70 ? 'warning' : 'danger'}
              />
              <MetricCard 
                label="Discrepancies" 
                value={reconciliation.issues.length} 
                status={reconciliation.issues.length === 0 ? 'success' : 'danger'}
              />
              <MetricCard 
                label="Local Recipients" 
                value={contract.recipients.length} 
              />
              <MetricCard 
                label="Portal Recipients" 
                value={reconciliation.portalCount || 0} 
              />
            </div>

            {/* Issue List */}
            <div className="border rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                Discrepancy Report
              </div>
              <div className="divide-y">
                {reconciliation.issues.map((issue: any, idx: number) => (
                  <div key={idx} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                    <div className={cn(
                        "mt-1 p-1.5 rounded-full",
                        issue.severity === 'high' ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                    )}>
                      <ShieldAlert className="size-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{issue.type}</span>
                        <Badge variant="outline" className="text-[8px] font-black uppercase">{issue.severity}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium">{issue.message}</p>
                      <div className="mt-2 flex gap-4 text-[9px] font-bold text-slate-400">
                        {issue.localValue && <span>Local: <span className="text-slate-900">{issue.localValue}</span></span>}
                        {issue.portalValue && <span>Portal: <span className="text-slate-900">{issue.portalValue}</span></span>}
                      </div>
                    </div>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-[9px] font-black uppercase rounded-full hover:bg-indigo-50 hover:text-indigo-600 border-slate-200"
                    >
                        Fix Discrepancy
                    </Button>
                  </div>
                ))}
                {reconciliation.issues.length === 0 && (
                  <div className="p-12 text-center">
                    <CheckCircle2 className="size-12 text-green-500 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">100% Data Integrity Verified</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <Sync className="size-16 text-slate-300 mb-6 animate-pulse" />
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Sync Engine Ready</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 max-w-xs">
              Bind a portal contract and run the integrity audit to begin the expert reconciliation process.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, status }: any) => (
  <div className="p-4 border rounded-xl bg-white shadow-sm border-slate-100">
    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</div>
    <div className={cn(
        "text-2xl font-black tracking-tighter",
        status === 'success' ? 'text-green-600' : status === 'warning' ? 'text-amber-600' : status === 'danger' ? 'text-red-600' : 'text-slate-900'
    )}>
      {value}
    </div>
  </div>
);
