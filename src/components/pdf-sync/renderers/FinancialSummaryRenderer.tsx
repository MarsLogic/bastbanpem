import React, { useState, useEffect, useMemo } from 'react';
import { cleanValue, formatPhone, toTitleCase, stripRegionalPrefix } from '@/lib/dataCleaner';
import { useMasterDataStore } from '@/lib/masterDataStore';
import { Badge } from '@/components/ui/badge';
import { Highlight } from '@/components/ui/highlight';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  Banknote, Info, Calculator, 
  ChevronUp, ChevronDown, Search, FileDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { exportStyledExcel } from '@/lib/excelExpert';
import { generateExportFilename } from '@/lib/exportUtils';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FinancialRow {
  label:    string;
  amount:   string;
  isTotal?: boolean;
}

interface FinancialSummaryRendererProps {
  text: string;
  ledger?: any[];
  financials?: any;
  searchQuery?: string;
  orderId?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;


// ─── Parser (Fallback for unstructured text) ───────────────────────────────────

const SKIP_LINES = new Set([
  'keterangan', 'harga', 'pembayaran', 'detail informasi pembayaran & pengiriman',
  'ringkasan pembayaran (dari semua pengiriman)', 'ringkasan pembayaran',
  'no', 'produk', 'varian', 'layanan tambahan', 'catatan', 'jumlah', 'pengiriman',
]);

function isSkip(line: string): boolean {
  const t = line.trim().toLowerCase();
  if (!t) return true;
  if (SKIP_LINES.has(t)) return true;
  if (/^halaman \d+\/\d+/.test(t)) return true;
  if (t === ':' || t === '—' || t === 'null' || t === 'none') return true;
  return false;
}

function parseFinancialRows(text: string): FinancialRow[] {
  const lines = text.split('\n');
  const rawRows: FinancialRow[] = [];
  let currentLabelBuffer: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || isSkip(line)) continue;
    const amountMatch = line.match(/Rp[\d\.,]+/i);
    const amount = amountMatch ? amountMatch[0] : null;

    if (amountMatch) {
      const amount = amountMatch[0];
      let labelPart = line.replace(amount, '').replace(/[:\s\-]+$/, '').trim();
      rawRows.push({
        label: labelPart || 'Total',
        amount: amount,
        isTotal: /estimasi total|grand total|total pembayaran/i.test(labelPart)
      });
    }
  }
  return rawRows;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

const RecipientFinancialGrid: React.FC<{ ledger: any[]; financials: any; searchQuery?: string; orderId?: string }> = ({ ledger, financials, searchQuery, orderId }) => {
  const [search, setSearch] = useState('');

  // Sync internal search ONLY on initial load
  React.useEffect(() => {
    if (searchQuery && !search) setSearch(searchQuery);
  }, []);
  const [province, setProvince] = useState('');
  const [sortKey, setSortKey] = useState<string>('shipment_id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const { resolveHierarchy, resolveRawAddress, fetchMasterData, isLoaded } = useMasterDataStore();
  const taxRate = financials.tax_logic.vat_rate || 0.11;

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  const provinces = React.useMemo(() => {
    const set = new Set<string>();
    ledger.forEach(i => { if (i.destination.provinsi) set.add(i.destination.provinsi); });
    return Array.from(set).sort();
  }, [ledger]);

  // Expert Triangulation: Hydrate ledger with missing or mangled regional data
  const hydratedLedger = React.useMemo(() => {
    return ledger.map(item => {
      const dest = item.destination || {};
      
      // Keep RAW values for fallback
      const rawProv = (dest.provinsi || '').trim();
      const rawKab  = (dest.kabupaten || '').trim();
      const rawKec  = (dest.kecamatan || '').trim();
      const rawDesa = (dest.desa || '').trim();

      // Preliminary cleaning (standardize case, strip obvious noise)
      // but only if it doesn't destroy the data
      const provinsi = cleanValue(rawProv, 'provinsi');
      const kabupaten = cleanValue(rawKab, 'kabupaten');
      const kecamatan = cleanValue(rawKec, 'kecamatan');
      const desa = cleanValue(rawDesa, 'desa');

      // Mangled detection: Empty, just dash, too short, or contains obvious OCR garbage
      // We allow hyphens and spaces in Indonesian regional names
      const isMangled = (s: string) => !s || s === '—' || s.length < 2 || /[%$#^*]/.test(s);
      
      if (isMangled(provinsi) || isMangled(kabupaten) || isMangled(kecamatan) || isMangled(desa)) {
        // Try structured triangulation first
        let resolved = resolveHierarchy({ provinsi, kabupaten, kecamatan, desa });
        
        // Deep Recovery: If structured fields are empty/mangled, try raw address triangulation
        if (!resolved && dest.full_address) {
          resolved = resolveRawAddress(dest.full_address);
        }

        if (resolved) {
          return {
            ...item,
            destination: {
              ...dest,
              provinsi: stripRegionalPrefix(resolved.provinsi || provinsi || rawProv),
              kabupaten: stripRegionalPrefix(resolved.kabupaten || kabupaten || rawKab),
              kecamatan: stripRegionalPrefix(isMangled(kecamatan) ? (resolved.kecamatan || kecamatan || rawKec) : (kecamatan || rawKec)),
              desa: stripRegionalPrefix(isMangled(desa) ? (resolved.desa || desa || rawDesa) : (desa || rawDesa)),
            }
          };
        }
      }

      // Fallback: Use cleaned values, but if cleanValue destroyed them, use rawProv
      return {
        ...item,
        destination: {
           ...dest,
           provinsi: stripRegionalPrefix(provinsi || rawProv),
           kabupaten: stripRegionalPrefix(kabupaten || rawKab),
           kecamatan: stripRegionalPrefix(kecamatan || rawKec),
           desa: stripRegionalPrefix(desa || rawDesa)
        }
      };
    });
  }, [ledger, resolveHierarchy, isLoaded]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return hydratedLedger.filter(item => {
      const dest = item.destination || {};
      const name = item.recipient?.name || '';
      const kab = dest.kabupaten || '';
      const prov = dest.provinsi || '';
      
      const matchSearch = !q || [name, kab, prov].some(v => String(v || '').toLowerCase().includes(q));
      const matchProv = !province || prov === province;
      return matchSearch && matchProv;
    });
  }, [hydratedLedger, search, province]);

  const handleExportExcel = async () => {
    const exportData = sorted.map(item => {
      const dpp = (item.costs?.product_total || 0) + (item.costs?.shipping_total || 0);
      const ppn = Math.round(dpp * taxRate);
      const gross = dpp + ppn;
      return {
        '#': item.shipment_id,
        'Penerima': toTitleCase(item.recipient.name),
        'Nomor Telepon': formatPhone(item.recipient.phone),
        'Provinsi': item.destination.provinsi || '',
        'Kabupaten': item.destination.kabupaten || '',
        'Kecamatan': item.destination.kecamatan || '',
        'Desa': item.destination.desa || '',
        'DPP (Excl. Tax)': dpp,
        'PPN (Tax)': ppn,
        'Total (Incl. Tax)': gross
      };
    });

    const totalDPP = sorted.reduce((sum, item) => sum + (item.costs?.product_total || 0) + (item.costs?.shipping_total || 0), 0);
    const totalPPN = Math.round(totalDPP * taxRate);
    const totalGross = totalDPP + totalPPN;

    await exportStyledExcel(exportData, [
      '#', 'Penerima', 'Nomor Telepon', 'Provinsi', 'Kabupaten', 'Kecamatan', 'Desa',
      'DPP (Excl. Tax)', 'PPN (Tax)', 'Total (Incl. Tax)'
    ], {
      sheetName: 'Ringkasan Pembayaran',
      filename: generateExportFilename(orderId, 'Ringkasan Pembayaran'),
      summaryRows: [
        {
          'Desa': 'GRAND TOTAL',
          'DPP (Excl. Tax)': totalDPP,
          'PPN (Tax)': totalPPN,
          'Total (Incl. Tax)': totalGross
        }
      ]
    });
  };

  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: any, vb: any;
      const dppA = (a.costs?.product_total || 0) + (a.costs?.shipping_total || 0);
      const dppB = (b.costs?.product_total || 0) + (b.costs?.shipping_total || 0);
      switch (sortKey) {
        case 'shipment_id': va = a.shipment_id; vb = b.shipment_id; break;
        case 'name':     va = a.recipient.name ?? ''; vb = b.recipient.name ?? ''; break;
        case 'phone':    va = a.recipient.phone ?? ''; vb = b.recipient.phone ?? ''; break;
        case 'prov':     va = a.destination.provinsi ?? ''; vb = b.destination.provinsi ?? ''; break;
        case 'kab':      va = a.destination.kabupaten ?? ''; vb = b.destination.kabupaten ?? ''; break;
        case 'kec':      va = a.destination.kecamatan ?? ''; vb = b.destination.kecamatan ?? ''; break;
        case 'desa':     va = a.destination.desa ?? ''; vb = b.destination.desa ?? ''; break;
        case 'dpp':      va = dppA; vb = dppB; break;
        case 'ppn':      va = dppA * taxRate; vb = dppB * taxRate; break;
        case 'gross':    va = dppA * (1 + taxRate); vb = dppB * (1 + taxRate); break;
        default:         va = a.shipment_id; vb = b.shipment_id; break;
      }
      
      if (typeof va === 'string' && typeof vb === 'string') {
        const cmp = va.localeCompare(vb, 'id');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      
      const cmp = (va || 0) - (vb || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, taxRate]);

  // Reset page when filtering or sorting changes
  React.useEffect(() => { setPage(0); }, [search, province, sortKey, sortDir, pageSize]);

  const actualPageSize = pageSize === 'all' ? Math.max(1, sorted.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(sorted.length / actualPageSize));
  const pageData = sorted.slice(page * actualPageSize, (page * actualPageSize) + actualPageSize);

  const TH = ({ label, col, align = 'left' }: { label: string, col: string, align?: 'left' | 'right' }) => (
    <th 
      className={`px-3 py-2.5 text-${align} text-[9px] font-medium uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap`}
      onClick={() => {
        if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(col); setSortDir('asc'); }
      }}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {sortKey === col && (sortDir === 'asc' ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />)}
      </div>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <Input 
            placeholder={searchQuery ? "Global search active..." : "Search recipients..."}
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="h-7 pl-8 py-0 text-[10px] bg-slate-50 border-slate-200" 
            readOnly={!!searchQuery}
          />
        </div>
        {!isLoaded && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-900 border border-black animate-pulse shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            <span className="text-[9px] font-black text-white uppercase tracking-tighter">Analyzing Locations...</span>
          </div>
        )}
        <Select value={province} onValueChange={(v) => setProvince(v || '')}>
          <SelectTrigger className="h-7 w-40 text-[10px] bg-slate-50 border-slate-200">
            <SelectValue placeholder="All Provinces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" className="text-[10px]">All Provinces</SelectItem>
            {provinces.map(p => <SelectItem key={p} value={p} className="text-[10px]">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-7 text-[10px] font-bold gap-2 px-3 border-emerald-100 bg-emerald-50/10 text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm shrink-0"
          >
            <FileDown className="h-3.5 w-3.5" />
            EXPORT EXCEL
          </Button>

          <div className="w-px h-4 bg-slate-200 shrink-0" />
          
          <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tabular-nums tracking-tight shrink-0">
            {filtered.length} / {hydratedLedger.length} RECORDS
          </div>
        </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white overflow-x-auto">
        <table className="w-full text-[11px] border-collapse min-w-[1100px]">
          <thead>
            <tr>
              <TH label="#" col="shipment_id" />
              <TH label="Penerima" col="name" />
              <TH label="Nomor Telepon" col="phone" />
              <TH label="Provinsi" col="prov" />
              <TH label="Kabupaten" col="kab" />
              <TH label="Kecamatan" col="kec" />
              <TH label="Desa" col="desa" />
              <TH label="DPP (Excl. Tax)" col="dpp" align="right" />
              <TH label="PPN (11%)" col="ppn" align="right" />
              <TH label="Total (Incl. Tax)" col="gross" align="right" />
            </tr>
          </thead>
          <tbody>
            {pageData.map((item, idx) => {
              const dpp = (item.costs?.product_total || 0) + (item.costs?.shipping_total || 0);
              const ppn = Math.round(dpp * taxRate);
              const gross = dpp + ppn;
              const globalIdx = page * actualPageSize + idx;
              return (
                <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-3 py-2.5 font-mono text-slate-400 tabular-nums text-[10px]">
                    <Highlight text={item.shipment_id} query={searchQuery} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-normal text-slate-700 leading-snug truncate max-w-[150px]">
                      <Highlight text={toTitleCase(item.recipient.name)} query={searchQuery} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                      <Highlight text={formatPhone(item.recipient.phone)} query={search || searchQuery} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                    <Highlight text={item.destination?.provinsi || '—'} query={search || searchQuery} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 truncate max-w-[120px]">
                    <Highlight text={item.destination?.kabupaten || '—'} query={search || searchQuery} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 truncate max-w-[100px]">
                    <Highlight text={item.destination?.kecamatan || '—'} query={search || searchQuery} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 truncate max-w-[100px]">
                    <Highlight text={item.destination?.desa || '—'} query={search || searchQuery} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">{fmt(dpp)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-400 tabular-nums">{fmt(ppn)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums">{fmt(gross)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Premium Pagination Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-slate-50/50 border-t border-slate-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Show</span>
            <div className="flex items-center p-0.5 bg-slate-200/50 rounded-lg">
              {[10, 20, 50, 'all'].map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size as any)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all duration-200 uppercase
                             ${pageSize === size 
                               ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' 
                               : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-4 w-px bg-slate-200" />
          
          <span className="text-[10px] text-slate-500 font-medium tabular-nums">
            Showing <span className="text-slate-900 font-bold">{page * actualPageSize + 1}</span>
            –<span className="text-slate-900 font-bold">{Math.min((page + 1) * actualPageSize, sorted.length)}</span>
            {' '}of <span className="text-slate-900 font-bold">{sorted.length}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 border-r border-slate-200 pr-3 mr-3">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-slate-400">Jump</span>
               <Input
                 type="number"
                 min={1}
                 max={totalPages}
                 value={page + 1}
                 onChange={(e) => {
                   const p = parseInt(e.target.value);
                   if (!isNaN(p) && p >= 1 && p <= totalPages) {
                     setPage(p - 1);
                   }
                 }}
                 className="h-7 w-14 text-[10px] font-mono text-center bg-white border-slate-200 focus:ring-1 focus:ring-slate-900 transition-all"
               />
            </div>
          )}

          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon"
              className="h-7 w-7 border-slate-200 disabled:opacity-30"
              disabled={page === 0}
              onClick={() => setPage(0)}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7 border-slate-200 disabled:opacity-30"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            
            <div className="flex items-center px-4 h-7 bg-white rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600 tabular-nums shadow-sm">
              <input 
                className="w-8 text-center bg-transparent border-0 p-0 focus:outline-none font-bold text-slate-900" 
                value={page + 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0 && val <= totalPages) setPage(val - 1);
                }}
                onFocus={(e) => e.target.select()}
              />
              <span className="mx-1 text-slate-300">/</span>
              <span>{totalPages}</span>
            </div>

            <Button
              variant="outline" size="icon"
              className="h-7 w-7 border-slate-200 disabled:opacity-30"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7 border-slate-200 disabled:opacity-30"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FinancialTotalsCard: React.FC<{ financials: any; ledger: any[]; taxRate: number; displayTax: number }> = ({ financials, ledger, taxRate, displayTax }) => {
  const isExempt = financials.tax_logic.tax_exempt;
  const rawGrandTotal = financials.grand_total || 0;
  const ledgerSum = ledger.reduce((s, i) => s + (i.costs?.product_total || 0) + (i.costs?.shipping_total || 0), 0);
  
  // Intelligent Fallback: If OCR failed to extract the total but we have a ledger, reconstruct it.
  const isExtractionFailed = rawGrandTotal === 0 && ledgerSum > 0;
  const grandTotal = isExtractionFailed ? Math.round(ledgerSum * (1 + taxRate)) : rawGrandTotal;

  let totalTax = financials.tax_logic.total_tax || 0;
  // Fallback to reverse calculation if extracted tax is 0 or if we are reconstructing
  if (isExtractionFailed || (totalTax === 0 && !isExempt && grandTotal > 0)) {
    totalTax = grandTotal - Math.round(grandTotal / (1 + taxRate));
  }

  const netValue = grandTotal - totalTax;
  const discrepancy = isExtractionFailed ? 0 : Math.abs(ledgerSum - netValue);
  const isBalanced = discrepancy < 5000 || isExtractionFailed;

  return (
    <div className="grid grid-cols-1 gap-4 mt-8">
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 relative overflow-hidden group transition-all duration-500
                       ${isBalanced 
                         ? 'bg-white border-slate-200 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]' 
                         : 'bg-white border-red-200 shadow-md ring-1 ring-red-50'}`}>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-colors ${isBalanced ? 'bg-slate-100' : 'bg-red-50'}`}>
              <Calculator className={`h-5 w-5 ${isBalanced ? 'text-slate-500' : 'text-red-500'}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Total Kontrak</span>
              <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isExtractionFailed ? 'text-amber-600' : (isBalanced ? 'text-emerald-600' : 'text-red-600')}`}>
                {isExtractionFailed ? '⚠ Reconstructed from Ledger' : (isBalanced ? '✓ Reconciled with Ledger' : '⚠ Total Discrepancy')}
              </span>
            </div>
          </div>
          <Badge className={`border-0 text-[10px] px-3 py-1 font-bold ${
            isExtractionFailed ? 'bg-amber-100 text-amber-700' : (isBalanced ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700')
          }`}>
            {isExtractionFailed ? 'ESTIMATED' : (isBalanced ? 'IDR' : `GAP: ${fmt(discrepancy)}`)}
          </Badge>
        </div>
        
        <div className="text-4xl font-bold font-mono tracking-tighter tabular-nums text-slate-900 relative z-10">{fmt(grandTotal)}</div>

        <div className="flex items-center gap-6 pt-4 border-t border-slate-100 relative z-10 overflow-x-auto no-scrollbar">
          <div className="flex flex-col gap-0.5 min-w-fit">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">DPP (Excl. Tax)</span>
            <span className="text-[13px] font-bold font-mono text-slate-700">{fmt(netValue)}</span>
          </div>
          <div className="w-px h-8 bg-slate-100 shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-fit">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Ledger Sum</span>
            <span className={`text-[13px] font-bold font-mono ${(isBalanced && !isExtractionFailed) ? 'text-slate-500' : 'text-emerald-600'}`}>{fmt(ledgerSum)}</span>

          </div>
          <div className="w-px h-8 bg-slate-100 shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-fit">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Tax (PPN {displayTax}%)</span>
            <span className="text-[13px] font-bold font-mono text-slate-600">{fmt(totalTax)}</span>
          </div>
        </div>
      </div>


    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const FinancialSummaryRenderer: React.FC<FinancialSummaryRendererProps> = ({ text, ledger, financials, searchQuery, orderId }) => {
  const rows = React.useMemo(() => parseFinancialRows(text), [text]);
  const resolveRawAddress = useMasterDataStore(state => state.resolveRawAddress);

  const { rate, displayTax } = React.useMemo(() => {
    if (!ledger || ledger.length === 0 || !financials) return { rate: 0.12, displayTax: 12 };
    const grandTotal = financials.grand_total || 0;
    const ledgerSum = ledger.reduce((s, i) => s + (i.costs?.product_total || 0) + (i.costs?.shipping_total || 0), 0);
    const n11 = Math.round(grandTotal / 1.11);
    const n12 = Math.round(grandTotal / 1.12);
    const d11 = Math.abs(ledgerSum - n11);
    const d12 = Math.abs(ledgerSum - n12);
    const pick11 = d11 < d12 && d11 < 1000000;
    return { rate: pick11 ? 0.11 : 0.12, displayTax: pick11 ? 11 : 12 };
  }, [ledger, financials]);

  if (ledger && ledger.length > 0 && financials) {
    return (
      <div className="space-y-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] py-1 px-3 rounded-full">Accounting View</Badge>
        </div>
        <RecipientFinancialGrid ledger={ledger} financials={financials} searchQuery={searchQuery} orderId={orderId} />
        <FinancialTotalsCard 
          financials={financials} 
          ledger={ledger} 
          taxRate={rate} 
          displayTax={displayTax} 
        />
      </div>
    );
  }

  if (rows.length === 0) return <p className="text-[12px] text-slate-400 italic p-4">No financial data detected.</p>;

  // Expert Grouping: Split rows into "Summary" vs "Detail" based on headers
  const summaryRows = rows.filter(r => !/total transaksi|total ppn|total ppnbm/i.test(r.label));
  const detailRows = rows.filter(r => /total transaksi|total ppn|total ppnbm/i.test(r.label));

  return (
    <div className="space-y-6 py-2">
      {/* 1. Ringkasan Pembayaran Block */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Banknote className="h-4 w-4 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Ringkasan Pembayaran</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-[12px] border-collapse">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase text-slate-400 border-b border-slate-200">Keterangan</th>
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase text-slate-400 border-b border-slate-200 w-[38%]">Harga</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row, i) => (
                <tr key={i} className={`border-b border-slate-100 last:border-0 ${row.isTotal ? 'bg-slate-50/80' : 'bg-white'}`}>
                  <td className="px-4 py-3.5 align-top">
                    <div className={`${row.isTotal ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                      <Highlight text={cleanValue(row.label, 'keterangan')} query={searchQuery} />
                    </div>
                    {row.isTotal && (
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-tight italic">
                        Harga Produk, Ongkos Kirim, PPN
                      </div>
                    )}
                  </td>
                  <td className={`px-4 py-3.5 text-right align-top font-mono tabular-nums ${row.isTotal ? 'text-slate-900 text-[14px] font-medium' : 'text-slate-600'}`}>
                    <Highlight text={row.amount} query={searchQuery} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Detail Informasi Block */}
      {detailRows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Info className="h-4 w-4 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Detail Informasi Pembayaran & Pengiriman</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Pembayaran</span>
            </div>
            
            {/* Gray Background Block for Totals Breakdown (Matching PDF) */}
            <div className="bg-slate-100/60 p-5 space-y-6">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-500">Ringkasan Pembayaran (dari semua pengiriman)</span>
              </div>

              <div className="space-y-5">
                {detailRows.map((row, i) => (
                  <div key={i} className="flex justify-between items-start group">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-medium text-slate-700">
                        <Highlight text={row.label} query={searchQuery} />
                      </span>
                      <span className="text-[10px] text-slate-400 italic">
                        {row.label.toLowerCase().includes('ppn') ? 'Pajak Produk, Pajak Ongkos Kirim' : 'Harga Produk, Ongkos Kirim'}
                      </span>
                    </div>
                    <span className="font-mono text-[13px] text-slate-900 font-medium tabular-nums">
                      <Highlight text={row.amount} query={searchQuery} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
