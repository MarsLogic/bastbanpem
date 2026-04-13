// [UIUX-003] PDF Slicing UI
import React, { useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, CheckCircle2, FileText, FileBadge, Truck, FlaskConical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContractData } from '../lib/contractStore';

interface DocumentManagerProps {
  contract: ContractData;
  onUpdate: (updates: Partial<ContractData>) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({ contract, onUpdate }) => {
  const attachFile = (key: keyof ContractData) => {
    // Standard file input for cross-platform support
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        // In local development/portable mode, we use the filename as a handle
        // The backend will resolve this from the App_Data folder
        onUpdate({ [key]: file.name });
      }
    };
    input.click();
  };

  const removeFile = (key: keyof ContractData) => {
    onUpdate({ [key]: null });
  };

  const documents = [
    {
      id: 'bastbPath' as const,
      label: 'BASTB BAP (Berita Acara)',
      icon: <FileSignature className="h-8 w-8" />,
      description: 'Official handover document signed by both parties.',
    },
    {
      id: 'suratJalanPath' as const,
      label: 'Surat Jalan / B/L',
      icon: <Truck className="h-8 w-8" />,
      description: 'Proof of delivery or shipping manifest.',
    },
    {
      id: 'invoiceOngkirPath' as const,
      label: 'Invoice Ongkir',
      icon: <FileText className="h-8 w-8" />,
      description: 'Shipping or freight invoice (if applicable).',
    },
    {
      id: 'sertifikatLabPath' as const,
      label: 'Sertifikat Uji Lab',
      icon: <FlaskConical className="h-8 w-8" />,
      description: 'Quality assurance / laboratory test results.',
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mx-auto py-10 px-6">
      {documents.map((doc) => {
        const value = contract[doc.id] as string | null;
        
        return (
          <Card 
            key={doc.id} 
            className={`transition-all border-2 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${value ? 'border-black bg-white' : 'border-dashed border-slate-200 bg-white hover:bg-slate-50'}`}
          >
            <CardContent className="p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className={cn("p-4 rounded-xl transition-all", value ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400')}>
                  {value ? <CheckCircle2 className="h-7 w-7" /> : React.cloneElement(doc.icon as any, { className: 'h-7 w-7' })}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">{doc.label}</h3>
                  {value ? (
                    <div className="text-[10px] font-mono text-slate-400 mt-1 truncate max-w-[180px] font-bold" title={value}>
                      {value.split(/[/\\]/).pop()}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 font-medium mt-1 leading-tight uppercase tracking-wider">{doc.description}</p>
                  )}
                </div>
              </div>
              
              <div>
                {value ? (
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-40 hover:opacity-100 hover:bg-black hover:text-white" onClick={() => removeFile(doc.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => attachFile(doc.id)} className="h-8 font-black text-[10px] uppercase border-slate-200">
                    <UploadCloud className="h-3 w-3 mr-2" /> Link
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Local icon alias mapping since lucide-react name differs slightly
const FileSignature = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9.3 12.3l4.6 4.6" />
    <path d="M12.9 12.3l-5.6 5.6" />
  </svg>
);
