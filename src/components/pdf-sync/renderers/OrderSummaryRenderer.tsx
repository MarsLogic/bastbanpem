import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Package, Globe, Tag, ExternalLink } from 'lucide-react';
import { Highlight } from '@/components/ui/highlight';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductItem {
  name: string;
  isBarang: boolean;
  isPDN: boolean;
  pricePerUnit: string;
  quantity: string;
  metadata: string[];
  catalogUrl?: string;
}

interface OrderSummaryProps {
  text: string;
  allSections?: Record<string, string>;
  searchQuery?: string;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseOrderSummary(text: string, context?: Record<string, string>): { procurement: string; products: ProductItem[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let procurement = '';
  const products: ProductItem[] = [];
  
  // 0. Build Identity Blacklist from other sections to prevent bleed
  const blacklist = new Set<string>();
  if (context) {
    ['HEADER', 'PEMESAN', 'PENYEDIA'].forEach(key => {
      const sectionText = context[key] || '';
      sectionText.split('\n').forEach(l => {
        const cleaned = l.trim();
        if (cleaned.length > 5) blacklist.add(cleaned.toUpperCase());
      });
    });
  }
  
  const EXCLUDE_NAMES = new Set([
    'DIREKTORAT', 'KODEPOS', 'ALAMAT', 'NAMA', 'PEMESAN', 'PENYEDIA', 
    'SURAT PESANAN', 'RINGKASAN PESANAN', 'TERM', 'DRAFT', 'HALAMAN'
  ]);

  const dataLines = lines.filter(line => {
    if (/Melalui Negosiasi|Tender|E-Purchasing/i.test(line)) {
      procurement = line;
      return false;
    }
    return true;
  });

  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  // 1. Expert Block Grouping: Identify Product Blocks
  for (const line of dataLines) {
    const upperLine = line.trim().toUpperCase();
    
    // STRICT PRODUCT DETECTION: 
    // Must be All-Caps, certain length, and NOT an administrative keyword.
    // AND must NOT be title case (e.g. "Surat Pesanan")
    const isStrictlyUpper = /^[A-Z0-9\s\(\)/-]{10,}$/.test(line);
    const isExcluded = [...EXCLUDE_NAMES].some(ex => upperLine.includes(ex));
    
    if (isStrictlyUpper && !isExcluded && !line.includes('Rp')) {
      if (currentBlock.length > 0) blocks.push(currentBlock);
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  // 2. Process Blocks: Only keep those that look like Products (Name + Amount/Qty)
  for (const block of blocks) {
    const pName = block[0];
    const prices: string[] = [];
    const quantities: string[] = [];
    const meta: string[] = [];
    let url = '';

    for (let i = 1; i < block.length; i++) {
      const line = block[i];
      if (line.includes('Rp')) {
        prices.push(line.match(/Rp\s?[\d\.,]+/i)?.[0] || '');
      } else if (/^[\d\.,]{2,}$/.test(line) && !/^\d{5}$/.test(line)) {
        quantities.push(line);
      } else if (/liter|kg|unit|gr|btl|box|Golongan PPN/i.test(line)) {
        meta.push(line);
      } else if (/katalog\.ina|snapshot-product|orderid=/i.test(line)) {
        url = line.replace(/\s/g, '');
      }
    }

    // FINAL VALIDATION: Must have a Name and at least a Price OR a Quantity
    // This wipes out noise like "Surat Pesanan" or "Divisi / Unit Kerja" which lack amounts.
    if (pName && (prices.length > 0 || quantities.length > 0)) {
      let finalPrice = prices[0] || '—';
      if (prices.length > 1) {
        const sorted = [...prices].sort((a, b) => {
          const valA = parseFloat(a.replace(/Rp\.?\s?|[\.]/g, '').replace(',', '.'));
          const valB = parseFloat(b.replace(/Rp\.?\s?|[\.]/g, '').replace(',', '.'));
          return valA - valB;
        });
        finalPrice = sorted[0];
      }

      products.push({
        name: pName,
        isBarang: true,
        isPDN: true,
        pricePerUnit: finalPrice,
        quantity: quantities[0] || '—',
        metadata: meta,
        catalogUrl: url
      });
    }
  }

  return { procurement, products };
}

export const OrderSummaryRenderer: React.FC<OrderSummaryProps> = ({ text, allSections, searchQuery }) => {
  const { procurement, products } = React.useMemo(() => parseOrderSummary(text, allSections), [text, allSections]);

  return (
    <div className="space-y-4">
      {/* Header with Procurement Badge */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-400" />
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">Ringkasan Pesanan</span>
        </div>
        {procurement && (
          <Badge variant="secondary" className="text-[9px] h-5 bg-slate-100 text-slate-600 font-medium">
            {procurement}
          </Badge>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 w-[50%]">Nama Produk</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Harga Produk</th>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {products.map((item, idx) => (
              <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-4 align-top space-y-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    {item.isBarang && (
                      <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] h-4 px-1.5 uppercase font-bold">Barang</Badge>
                    )}
                    {item.isPDN && (
                      <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] h-4 px-1.5 uppercase font-bold">PDN</Badge>
                    )}
                  </div>
                  
                  <div className="text-[12px] font-medium text-slate-900 leading-tight">
                    <Highlight text={item.name} query={searchQuery} />
                  </div>
                  
                  <div className="flex flex-col gap-0.5">
                    {item.metadata.map((meta, mIdx) => (
                      <span key={mIdx} className="text-[11px] text-slate-500 font-normal">
                        <Highlight text={meta} query={searchQuery} />
                      </span>
                    ))}
                  </div>

                  {item.catalogUrl && (
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <a 
                        href={item.catalogUrl.startsWith('http') ? item.catalogUrl : `https://${item.catalogUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] text-blue-600 hover:text-blue-800 transition-colors group/link"
                      >
                        <ExternalLink className="h-3 w-3 opacity-60" />
                        <span className="truncate max-w-[300px] underline underline-offset-4 decoration-blue-200">{item.catalogUrl}</span>
                      </a>
                    </div>
                  )}
                </td>
                
                <td className="px-4 py-4 text-right align-top">
                  <div className="text-[12px] font-normal font-mono text-slate-500 tabular-nums">
                    <Highlight text={item.pricePerUnit} query={searchQuery} />
                  </div>
                </td>
                
                <td className="px-4 py-4 text-right align-top">
                  <div className="text-[12px] font-normal font-mono text-slate-900 tabular-nums">
                    <Highlight text={item.quantity} query={searchQuery} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
