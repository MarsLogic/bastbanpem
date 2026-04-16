import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ShieldCheck, AlertTriangle, Info, Banknote, 
  Percent, Scale, FileText, CheckCircle2, XCircle
} from 'lucide-react';
import { UltraRobustContract } from '@/lib/contractStore';

interface ComplianceDashboardProps {
  data: UltraRobustContract;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ data }) => {
  const { financials, compliance_flags, shipment_ledger } = data;
  
  // Integrity check: sum(shipment ledger) vs financials
  const calculatedTotal = shipment_ledger.reduce((acc, item) => acc + item.costs.product_total, 0);
  const taxAmount = financials.tax_logic.total_tax || (financials.grand_total * financials.tax_logic.ppn_rate / (1 + financials.tax_logic.ppn_rate));
  const expectedTotal = financials.grand_total - taxAmount;
  const isBalanced = Math.abs(calculatedTotal - expectedTotal) < 1000; // Allow slight rounding diff

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-50/50">
      {/* Financial Health */}
      <Card className="border-l-4 border-l-emerald-500 shadow-sm">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Financial Integrity</CardTitle>
          {isBalanced ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-400 uppercase font-bold">Extraction Sum</span>
              <span className="text-sm font-mono font-bold text-slate-900">Rp{calculatedTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-400 uppercase font-bold">Target (Excl Tax)</span>
              <span className="text-xs font-mono text-slate-500">Rp{expectedTotal.toLocaleString('id-ID')}</span>
            </div>
            <div className={`mt-2 p-1.5 rounded text-[10px] flex items-center gap-2 ${isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <Info className="h-3.5 w-3.5" />
              {isBalanced ? "All shipment costs match grand total." : "Minor discrepancy in sum vs total."}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Flags */}
      <Card className="border-l-4 border-l-blue-500 shadow-sm">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Compliance & Audit</CardTitle>
          <ShieldCheck className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-700">Penalty Rate</span>
            <Badge variant="outline" className="bg-slate-900 text-white font-mono text-[10px] border-0">
              {(compliance_flags.penalty_rate * 1000).toFixed(0)}‰ / day
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-700">Sampling Required</span>
            {compliance_flags.sampling_required ? 
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px]">YES</Badge> : 
              <Badge variant="outline" className="text-slate-400 text-[10px]">NO</Badge>
            }
          </div>
          {compliance_flags.mandatory_label && (
            <div className="pt-1">
              <span className="text-[9px] text-slate-400 uppercase font-bold block mb-1">Mandatory Labeling</span>
              <div className="text-[10px] bg-slate-100 p-1.5 rounded border border-slate-200 font-serif italic text-slate-600">
                "{compliance_flags.mandatory_label}"
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disbursement Data */}
      <Card className="border-l-4 border-l-indigo-500 shadow-sm">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bank Disbursement</CardTitle>
          <Banknote className="h-4 w-4 text-indigo-500" />
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 uppercase font-bold">Account Holder</span>
            <div className="text-[11px] font-bold text-slate-800 truncate">{financials.bank_disbursement.account_name || '—'}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <span className="text-[9px] text-slate-400 uppercase font-bold">Account No</span>
              <div className="text-[11px] font-mono font-medium text-slate-800">{financials.bank_disbursement.account_number || '—'}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[9px] text-slate-400 uppercase font-bold">Bank</span>
              <div className="text-[11px] font-medium text-slate-800 truncate">{financials.bank_disbursement.bank_name || '—'}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
