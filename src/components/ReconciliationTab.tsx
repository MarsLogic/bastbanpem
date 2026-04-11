import React, { useMemo } from 'react';
import { ContractData } from '../lib/contractStore';
import { performReconciliation, calculateNameSimilarity } from '../lib/auditEngine';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    CheckCircle2, AlertTriangle, XCircle, FileText, 
    ArrowRight, Info, ExternalLink, Download, Search
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface ReconciliationTabProps {
  contract: ContractData;
}

export const ReconciliationTab: React.FC<ReconciliationTabProps> = ({ contract }) => {
  const result = useMemo(() => {
    return performReconciliation(contract.deliveryBlocks || [], contract.recipients || []);
  }, [contract.deliveryBlocks, contract.recipients]);

  const stats = useMemo(() => {
    const total = contract.deliveryBlocks?.length || 0;
    const critical = result.issues.filter(i => i.severity === 'high').length;
    const warnings = result.issues.filter(i => i.severity === 'medium').length;
    return { total, critical, warnings };
  }, [contract.deliveryBlocks, result]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-50 border-red-100';
      case 'medium': return 'text-amber-500 bg-amber-50 border-amber-100';
      case 'low': return 'text-blue-500 bg-blue-50 border-blue-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <XCircle size={14} />;
      case 'medium': return <AlertTriangle size={14} />;
      default: return <Info size={14} />;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", result.score > 90 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600")}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audit Integrity</p>
                <h3 className="text-2xl font-black font-mono">{result.score}%</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600">
                <XCircle size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Critical Mismatches</p>
                <h3 className="text-2xl font-black font-mono">{stats.critical}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200 text-right">
          <CardContent className="pt-6 flex justify-end gap-2">
             <Button variant="outline" size="sm" className="h-10 gap-2 font-bold">
                <Download size={16} /> Export Report
             </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="px-6 py-4 border-b bg-slate-50/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Search className="text-indigo-500 w-5 h-5" />
              Reconciliation Detail
            </CardTitle>
            <CardDescription className="text-slate-500">Cross-checking PDF Delivery Blocks against Excel rows.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 border-b">
              <TableRow>
                <TableHead className="w-12 text-center text-[10px] font-bold uppercase text-slate-400">Idx</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-400">PDF Evidence</TableHead>
                <TableHead className="w-10 text-center"></TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-400">Excel Data</TableHead>
                <TableHead className="text-[10px] font-bold uppercase text-slate-400">Audit Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(contract.deliveryBlocks || []).map((block, idx) => {
                const issues = result.issues.filter(i => i.pdfValue === block.nama || i.message.includes(block.nama));
                const isClean = issues.length === 0;
                
                return (
                  <TableRow key={idx} className="group hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-center font-mono text-[10px] text-slate-400">#{idx + 1}</TableCell>
                    <TableCell className="py-4">
                      <div className="font-bold text-[13px] text-slate-900">{block.nama}</div>
                      <div className="text-[11px] font-mono text-slate-500">{block.kuantitas} Unit</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="text-slate-300 w-4 h-4 mx-auto" />
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[13px] font-medium text-slate-700">Matched Recipient</span>
                        <Badge variant="outline" className="w-fit text-[10px] bg-slate-50 text-slate-500 border-slate-200">
                          {isClean ? "100% Match" : "Fuzzy Match"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {isClean ? (
                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                          <CheckCircle2 size={14} /> Reconciled
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {issues.map((issue, i) => (
                            <div key={i} className={cn("flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold", getSeverityColor(issue.severity))}>
                              {getSeverityIcon(issue.severity)}
                              {issue.type}
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
