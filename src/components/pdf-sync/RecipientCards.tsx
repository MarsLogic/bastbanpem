import React from 'react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCheck, Phone, MapPin, Package, Banknote, Calendar, Truck } from 'lucide-react';
import { DeliveryBlock } from '../../lib/contractStore';

interface RecipientCardsProps {
  blocks: DeliveryBlock[];
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

function fmt(v?: string) {
  if (!v) return '—';
  return v.startsWith('Rp') ? v : `Rp${v}`;
}

export const RecipientCards: React.FC<RecipientCardsProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center gap-4">
        <UserCheck className="h-12 w-12 text-slate-200" />
        <p className="text-sm text-slate-400">No recipients extracted.</p>
        <p className="text-[11px] text-slate-300">Run AI Scan to extract RPB delivery blocks.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Delivery RPB Blocks</span>
          <Badge variant="secondary" className="text-[10px]">{blocks.length} recipients</Badge>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {blocks.map((block, idx) => (
            <div
              key={idx}
              className={`border rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow ${provinceColor(block.provinsi)}`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-slate-400 font-mono shrink-0">#{idx + 1}</span>
                    <h4 className="text-[13px] font-bold text-slate-900 leading-tight truncate">
                      {block.namaPenerima || '—'}
                    </h4>
                  </div>
                  {block.noTelp && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span className="text-[10px] text-slate-500 font-mono">{block.noTelp}</span>
                    </div>
                  )}
                </div>
                {block.jumlah && (
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 bg-emerald-600 text-white rounded-lg px-2.5 py-1.5">
                      <Package className="h-3 w-3" />
                      <span className="text-[12px] font-bold font-mono">{block.jumlah}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 block text-right mt-0.5">liter</span>
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="flex items-start gap-1.5">
                <MapPin className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
                <div className="space-y-0.5 min-w-0">
                  {block.namaPoktan && (
                    <div className="text-[10px] font-semibold text-blue-700">
                      Poktan: {block.namaPoktan}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-600 leading-snug">
                    {[block.desa, block.kecamatan, block.kabupaten].filter(Boolean).join(', ')}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {block.provinsi && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium">
                        {block.provinsi}
                      </Badge>
                    )}
                    {block.kodePos && (
                      <span className="text-[9px] text-slate-400 font-mono">{block.kodePos}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Financials */}
              {(block.hargaProdukTotal || block.ongkosKirim) && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5">
                  {block.hargaProdukTotal && (
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Banknote className="h-3 w-3 text-emerald-500" />
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide">Harga Produk</span>
                      </div>
                      <span className="text-[11px] font-bold font-mono text-emerald-700">{fmt(block.hargaProdukTotal)}</span>
                    </div>
                  )}
                  {block.ongkosKirim && (
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Truck className="h-3 w-3 text-blue-500" />
                        <span className="text-[9px] text-slate-400 uppercase tracking-wide">Ongkir</span>
                      </div>
                      <span className="text-[11px] font-bold font-mono text-blue-700">{fmt(block.ongkosKirim)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery date */}
              {block.permintaanTiba && (
                <div className="flex items-center gap-1.5 pt-2 border-t border-black/5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500">
                    Tiba: <strong className="text-slate-700">{block.permintaanTiba}</strong>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
};
