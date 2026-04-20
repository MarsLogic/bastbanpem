import React, { useState, useRef } from 'react';
import { ContractData, useContracts } from '../lib/contractStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Trash2, ArrowRight, X, FileUp, Loader2 } from 'lucide-react';
import { reconcileFiles } from '../lib/api';
import { toast } from 'sonner';

interface ContractListViewProps {
  contracts?: ContractData[]; // Optional since we use the hook
  onCreateContract: (name: string, data?: any) => void;
  onSelectContract: (id: string) => void;
  onDeleteContract: (id: string) => void;
}

export const ContractListView: React.FC<ContractListViewProps> = ({ onCreateContract, onSelectContract, onDeleteContract }) => {
  const { contracts, preloadPdfBlob } = useContracts();
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleOpenModal = () => {
    setNewName('');
    setSelectedPdf(null);
    setIsModalOpen(true);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedPdf(file);
    if (file) {
      // Auto-fill contract name with filename (minus extension)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setNewName(nameWithoutExt);
    }
  };

  const submitCreate = async () => {
    if (!newName.trim()) return;
    
    // In this updated version, we only initialize with name.
    // The PDF processing happens within the Contract Workspace.
    onCreateContract(newName);
    setIsModalOpen(false);
  };

  const filtered = (contracts || []).filter((c: ContractData) => {
    const searchLower = searchTerm.toLowerCase();
    const nomorStr = (c.nomorKontrak || "").toLowerCase();
    const penyedia = (c.namaPenyedia || "").toLowerCase();
    
    return c.name.toLowerCase().includes(searchLower) || nomorStr.includes(searchLower) || penyedia.includes(searchLower);
  });

  return (
    <div className="p-10 h-full flex flex-col bg-white">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Contracts</h1>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Government Contract Management</p>
        </div>
        <Button onClick={handleOpenModal} size="lg" className="bg-black hover:bg-slate-900 text-white font-bold px-6 h-11 shadow-lg shadow-slate-200 rounded-lg">
          <Plus className="mr-2 h-5 w-5" /> New Contract
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b py-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-3">
              <FileText className="text-slate-400 h-5 w-5" /> 
              <span className="font-bold text-slate-900">Active Directory</span>
              <span className="bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded font-black">{contracts.length}</span>
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search contracts..." 
                className="pl-9 h-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10 px-6">Contract Name</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Contract No.</TableHead>
                <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Recipients</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Value (Rp)</TableHead>
                <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10">Date</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-400 h-10 px-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No contracts found. Click "New Contract" to begin.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((contract: ContractData) => {
                  const totalAnggaran = (contract.recipients || []).reduce((sum: number, r: any) => sum + (r.calculatedValue || 0), 0);
                  
                  return (
                    <TableRow 
                      key={contract.id} 
                      className="cursor-pointer hover:bg-slate-50 group border-b border-slate-100" 
                      onClick={() => onSelectContract(contract.id)}
                      onMouseEnter={() => preloadPdfBlob(contract.id)}
                    >
                      <TableCell className="font-black text-slate-900 px-6">{contract.name}</TableCell>
                      <TableCell className="text-slate-400 font-mono text-[11px] font-medium">{contract.nomorKontrak || 'PENDING'}</TableCell>
                      <TableCell className="text-center">
                         <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold text-[10px]">{(contract.recipients || []).length}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-black text-slate-900">{totalAnggaran.toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-center text-[10px] font-bold text-slate-400 uppercase">
                        {new Date(contract.lastModified).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex items-center justify-end gap-1 opacity-10 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100" onClick={(e) => { e.stopPropagation(); onDeleteContract(contract.id); }}>
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 font-bold text-[10px] border-slate-200" onClick={(e) => { e.stopPropagation(); onSelectContract(contract.id); }}>
                            Open <ArrowRight className="ml-1.5 h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Custom Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-[450px] border rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/30">
              <h3 className="text-lg font-bold">Add Contract</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {/* Browse File Button */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Contract File</label>
                  <input
                    type="file"
                    ref={pdfInputRef}
                    onChange={handlePdfChange}
                    accept=".pdf,.xlsx,.xls"
                    className="hidden"
                  />
                  <Button
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isProcessing}
                    className={`w-full h-11 font-bold uppercase tracking-widest text-xs transition-all ${selectedPdf ? 'bg-slate-900 text-white hover:bg-black' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    variant={selectedPdf ? "default" : "outline"}
                  >
                    <FileUp className="mr-2 h-4 w-4" />
                    {selectedPdf ? selectedPdf.name : 'Browse File (PDF or Excel)'}
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Contract Name</label>
                  <Input
                    placeholder="e.g. Surat Pesanan 123..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    disabled={isProcessing}
                    className="h-11 font-bold"
                  />
                  <p className="text-[9px] text-slate-400 font-medium">
                    {selectedPdf ? '✓ File name auto-filled above. Edit manually if needed.' : 'Select a file to auto-populate this field'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isProcessing} className="text-xs font-bold uppercase">Back</Button>
              <Button onClick={submitCreate} disabled={!newName.trim() || isProcessing} className="px-10 bg-black text-white hover:bg-zinc-800 font-bold text-xs uppercase tracking-widest h-11 shadow-lg shadow-zinc-200 rounded-lg">
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : 'Create Contract'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
