import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface SettingsTabProps {
  config: {
    nomor_sertifikat: string;
    tanggal_sertifikat: string;
    lembaga_penguji: string;
  };
  setConfig: React.Dispatch<React.SetStateAction<any>>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ config, setConfig }) => {
  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground italic">Configure global metadata for automated BAST injection.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-5" /> Global Metadata
          </CardTitle>
          <CardDescription>These values will be applied to all recipients during the "Magic Fill" process.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="cert-no">Nomor Sertifikat Kontrak</Label>
            <Input 
              id="cert-no" 
              placeholder="e.g. 123/LAB/2025/KTU" 
              value={config.nomor_sertifikat}
              onChange={e => setConfig({...config, nomor_sertifikat: e.target.value})}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cert-date">Tanggal Sertifikat</Label>
            <Input 
              id="cert-date" 
              placeholder="e.g. 05 Maret 2025" 
              value={config.tanggal_sertifikat}
              onChange={e => setConfig({...config, tanggal_sertifikat: e.target.value})}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agency">Lembaga Penguji / Vendor</Label>
            <Input 
              id="agency" 
              placeholder="e.g. PT. SUCOFINDO (PERSERO)" 
              value={config.lembaga_penguji}
              onChange={e => setConfig({...config, lembaga_penguji: e.target.value})}
            />
          </div>

          <Button className="w-full mt-4" onClick={() => toast.success("Configuration Saved Locally")}>
            <Save className="mr-2 size-4" /> Save Configuration
          </Button>
        </CardContent>
      </Card>
      
      <div className="p-4 bg-muted/30 rounded-lg border border-dashed text-xs text-muted-foreground flex gap-3">
         <Info className="size-4 flex-shrink-0" />
         <p>Note: Global settings are stored in-memory during this session. In production, these should be verified against the official contract PDF.</p>
      </div>
    </div>
  );
};

const Info = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);
