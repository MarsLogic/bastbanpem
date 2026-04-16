import React from 'react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCheck, Phone, MapPin, Package, Banknote, Calendar, Truck, Info } from 'lucide-react';
import { ShipmentLedgerItem } from '@/lib/contractStore';

interface RecipientCardsProps {
  ledger: ShipmentLedgerItem[];
}

const PROVINCE_COLORS: [string, string][] = [
  ['Jawa',        'bg-blue-50 border-blue-200'],
  ['Sumatera',    'bg-emerald-50 border-emerald-200'],
  ['Kalimantan',  'bg-amber-50 border-amber-200'],
  ['Sulawesi',    'bg-purple-50 border-purple-200'],
  ['Papua',       'bg-rose-50 border-rose-200'],
  ['Bali',        'bg-pink-50 border-pink-200'],
  ['Nusa',        'bg-teal-50 border-teal-200'],
  ['Maluku',      'bg-cyan-50 border-cyan-200'],
];

function provinceColor(provinsi?: string): string {
  if (!provinsi) return 'bg-white border-slate-200';
  for (const [key, cls] of PROVINCE_COLORS) {
    if (provinsi.includes(key)) return cls;
  }
  return 'bg-white border-slate-200';
}

export const RecipientCards: React.FC<RecipientCardsProps> = ({ ledger }) => {
  if (!ledger || ledger.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center gap-4">
        <UserCheck className="h-12 w-12 text-slate-200" />
        <p className="text-sm text-slate-400">No recipients extracted.</p>
        <p className="text-[11px] text-slate-300">Run AI Scan to extract Ultra-Robust shipment ledger.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shipment Ledger</span>
          <Badge variant="secondary" className="text-[10px]">{ledger.length} recipients</Badge>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {ledger.map((item, idx) => (
            <div
              key={idx}
              className={`border rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow ${provinceColor(item.destination.provinsi)}`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 font-mono shrink-0">#{item.shipment_id}</span>
                    <h4 className="text-[13px] font-bold text-slate-900 leading-tight truncate">
                      {item.recipient.name || '—'}
                    </h4>
                  </div>
                  {item.recipient.phone && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] text-slate-500 font-mono">{item.recipient.phone}</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <Badge className="bg-slate-900 text-white text-[10px] h-6">
                    <Package className="h-3 w-3 mr-1" />
                    Shipment Item
                  </Badge>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5 min-w-0">
                  {item.recipient.group && (
                    <div className="text-[10px] font-semibold text-blue-700">
                      Poktan: {item.recipient.group}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-600 leading-snug">
                    {[item.destination.desa, item.destination.kabupaten].filter(Boolean).join(', ')}
                  </div>
                  {item.destination.provinsi && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium mt-1">
                      {item.destination.provinsi}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Financials */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5">
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    <Banknote className="h-3 w-3 text-emerald-500" />
                    <span className="text-[9px] text-slate-400 uppercase tracking-wide">Product Total</span>
                  </div>
                  <span className="text-[11px] font-bold font-mono text-emerald-700">
                    Rp{item.costs.product_total.toLocaleString('id-ID')}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    <Truck className="h-3 w-3 text-blue-500" />
                    <span className="text-[9px] text-slate-400 uppercase tracking-wide">Shipping</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold font-mono text-blue-700">
                      Rp{item.costs.shipping_total.toLocaleString('id-ID')}
                    </span>
                    {item.costs.is_at_cost && (
                      <span title="At Cost (Verified)">
                        <Info className="h-3 w-3 text-slate-300" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};
