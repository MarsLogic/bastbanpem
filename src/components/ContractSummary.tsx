import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Shield, CreditCard, Landmark, Truck, Settings2 } from 'lucide-react';
import { cn } from "@/lib/utils";

interface ContractSummaryProps {
  metadata: any;
}

export const ContractSummary: React.FC<ContractSummaryProps> = ({ metadata }) => {
  if (!metadata) return null;

  const sections = [
    {
      title: "Administrative",
      icon: <Landmark className="size-4" />,
      fields: [
        { label: "Eselon 1", value: metadata.eselon1 },
        { label: "Satker", value: metadata.satker },
        { label: "Nomor Dipa", value: metadata.nomor_dipa },
        { label: "Kegiatan/Output/Akun", value: metadata.kegiatan_output_akun },
      ]
    },
    {
      title: "Contract Info",
      icon: <FileText className="size-4" />,
      fields: [
        { label: "Nomor Kontrak", value: metadata.nomor_kontrak },
        { label: "Tanggal Kontrak", value: metadata.tanggal_kontrak },
        { label: "Judul Kegiatan", value: metadata.judul_kegiatan },
        { label: "Vendor", value: metadata.vendor_name },
      ]
    },
    {
      title: "Financials",
      icon: <CreditCard className="size-4" />,
      fields: [
        { label: "Nilai Kontrak", value: metadata.nilai_kontrak, highlight: true },
        { label: "Nilai Konfirmasi", value: metadata.nilai_konfirmasi },
        { label: "Nilai BAST", value: metadata.nilai_bast },
        { label: "Nilai SPM", value: metadata.nilai_spm },
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {sections.map((section, idx) => (
        <div key={idx} className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b px-4 py-2 flex items-center gap-2">
            {section.icon}
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{section.title}</span>
          </div>
          <div className="p-4 space-y-3">
            {section.fields.map((f, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase">{f.label}</span>
                <span className={cn(
                  "text-[11px] font-semibold text-slate-900 truncate",
                  f.highlight && "text-indigo-600 font-black"
                )}>
                  {f.value || "N/A"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {/* Flags / Configuration */}
      <div className="md:col-span-3 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex flex-wrap gap-4 items-center">
         <div className="flex items-center gap-2 text-[10px] font-black text-indigo-900 uppercase tracking-tighter mr-4">
            <Settings2 className="size-4" /> Config Flags
         </div>
         <FlagItem label="Ongkir Terpisah" active={metadata.is_ongkir_terpisah} />
         <FlagItem label="Swakelola" active={metadata.is_swakelola} />
         <FlagItem label="Termin" active={metadata.is_menggunakan_termin} />
      </div>
    </div>
  );
};

const FlagItem = ({ label, active }: { label: string, active: boolean }) => (
  <div className="flex items-center gap-2">
    <div className={cn(
      "size-2 rounded-full",
      active ? "bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]" : "bg-slate-300"
    )} />
    <span className={cn(
      "text-[10px] font-bold uppercase",
      active ? "text-indigo-900" : "text-slate-400"
    )}>{label}</span>
  </div>
);
