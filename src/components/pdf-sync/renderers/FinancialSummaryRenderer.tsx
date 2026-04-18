import React from 'react';
import { cleanValue } from '@/lib/dataCleaner';
import { useMasterDataStore } from '@/lib/masterDataStore';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { 
  Banknote, Info, Calculator, 
  ChevronUp, ChevronDown, Search, FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

const formatPhone = (raw: string) => {
  if (!raw) return '—';
  // Standardize: remove non-digits, handle +62 or 62 prefix
  const clean = raw.replace(/\D/g, '').replace(/^62/, '');
  
  // Mobile: starts with 8
  if (clean.startsWith('8')) {
    return `0${clean}`;
  }
  
  // Landline (Regional): 2 to 3 digit area code
  // Common 2-digit: 21 (Jakarta), 22 (Bandung), 24 (Semarang), 31 (Surabaya), etc.
  if (clean.startsWith('2') || clean.startsWith('3')) {
    const area = clean.substring(0, 2);
    const rest = clean.substring(2);
    return `(0${area}) ${rest}`;
  }

  return `0${clean}`; // Fallback: just prefix with 0
};

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

const RecipientFinancialGrid: React.FC<{ ledger: any[]; taxRate: number }> = ({ ledger, taxRate }) => {
  const [search, setSearch] = React.useState('');
  const [province, setProvince] = React.useState<string>('');
  const [sortKey, setSortKey] = React.useState<string>('shipment_id');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const resolveHierarchy = useMasterDataStore(state => state.resolveHierarchy);

  const provinces = React.useMemo(() => {
    const set = new Set<string>();
    ledger.forEach(i => { if (i.destination.provinsi) set.add(i.destination.provinsi); });
    return Array.from(set).sort();
  }, [ledger]);

  // Expert Triangulation: Hydrate ledger with missing regional data
  const hydratedLedger = React.useMemo(() => {
    return ledger.map(item => {
      const { provinsi, kabupaten, kecamatan, desa } = item.destination;
      // If either kecamatan or desa is missing, try to resolve from master data
      if (!kecamatan || kecamatan === '—' || !desa || desa === '—') {
        const resolved = resolveHierarchy({ provinsi, kabupaten, kecamatan, desa });
        if (resolved) {
          return {
            ...item,
            destination: {
              ...item.destination,
              kecamatan: (kecamatan === '—' || !kecamatan) ? resolved.kecamatan : kecamatan,
              desa: (desa === '—' || !desa) ? resolved.desa : desa,
            }
          };
        }
      }
      return item;
    });
  }, [ledger, resolveHierarchy]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return hydratedLedger.filter(item => {
      const matchSearch = !q || [item.recipient.name, item.destination.kabupaten, item.destination.provinsi].some(v => v?.toLowerCase().includes(q));
      const matchProv = !province || item.destination.provinsi === province;
      return matchSearch && matchProv;
    });
  }, [hydratedLedger, search, province]);

  const handleExportExcel = () => {
    const exportData = sorted.map(item => {
      const dpp = (item.costs?.product_total || 0) + (item.costs?.shipping_total || 0);
      const ppn = Math.round(dpp * taxRate);
      const gross = dpp + ppn;
      return {
        '#': item.shipment_id,
        'Penerima': item.recipient.name,
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

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Recipient Financials');
    XLSX.writeFile(workbook, `ringkasan_pembayaran_${new Date().getTime()}.xlsx`);
  };

  const sorted = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: any, vb: any;
      const dppA = (a.costs?.product_total || 0) + (a.costs?.shipping_total || 0);
      const dppB = (b.costs?.product_total || 0) + (b.costs?.shipping_total || 0);
      switch (sortKey) {
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
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'id');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, taxRate]);

  const TH = ({ label, col, align = 'left' }: { label: string, col: string, align?: 'left' | 'right' }) => (
    <th 
      className={`px-3 py-2.5 text-${align} text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap`}
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
          <Input placeholder="Search recipients..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 pl-8 py-0 text-[10px] bg-slate-50 border-slate-200" />
        </div>
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
          className="h-7 text-[10px] gap-1.5 px-2.5 border-slate-200 hover:bg-slate-100 shrink-0"
        >
          <FileDown className="h-3 w-3" />
          Export Excel
        </Button>
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
            {sorted.map((item, idx) => {
              const dpp = (item.costs?.product_total || 0) + (item.costs?.shipping_total || 0);
              const ppn = Math.round(dpp * taxRate);
              const gross = dpp + ppn;
              return (
                <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-3 py-2.5 font-mono text-slate-400 tabular-nums text-[10px]">{item.shipment_id}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-slate-800 leading-snug truncate max-w-[150px]">{item.recipient.name}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[10px] font-mono text-slate-500 tabular-nums">{formatPhone(item.recipient.phone)}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-[10px] font-black uppercase text-slate-500 whitespace-nowrap">
                      {item.destination.provinsi ? cleanValue(item.destination.provinsi, 'provinsi') : '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 truncate max-w-[120px]">
                    {item.destination.kabupaten ? cleanValue(item.destination.kabupaten, 'kabupaten') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 truncate max-w-[100px]">
                    {item.destination.kecamatan ? cleanValue(item.destination.kecamatan, 'kecamatan') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 truncate max-w-[100px] text-[10px]">
                    {item.destination.desa ? cleanValue(item.destination.desa, 'desa') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">{fmt(dpp)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-400 tabular-nums">{fmt(ppn)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-black text-slate-900 tabular-nums">{fmt(gross)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
      <div className={`md:col-span-2 p-6 rounded-3xl text-white shadow-2xl space-y-4 relative overflow-hidden group transition-colors duration-500
                       ${isBalanced ? 'bg-slate-900' : 'bg-slate-900 border-2 border-red-500/30'}`}>
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Calculator className="h-5 w-5 text-slate-300" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Total Kontrak</span>
              <span className={`text-[8px] font-bold uppercase tracking-widest mt-0.5 ${isExtractionFailed ? 'text-amber-400' : (isBalanced ? 'text-emerald-400' : 'text-red-400')}`}>
                {isExtractionFailed ? '⚠ Reconstructed from Ledger' : (isBalanced ? '✓ Reconciled with Ledger' : '⚠ Total Discrepancy')}
              </span>
            </div>
          </div>
          <Badge className={`bg-white/20 text-white border-0 text-[10px] px-3 py-1 ${isExtractionFailed ? 'bg-amber-500/20 text-amber-300' : ''}`}>
            {isExtractionFailed ? 'ESTIMATED' : (isBalanced ? 'IDR' : `GAP: ${fmt(discrepancy)}`)}
          </Badge>
        </div>
        
        <div className="text-4xl font-black font-mono tracking-tighter tabular-nums relative z-10">{fmt(grandTotal)}</div>

        <div className="flex items-center gap-6 pt-4 border-t border-white/10 relative z-10 overflow-x-auto no-scrollbar">
          <div className="flex flex-col gap-0.5 min-w-fit">
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">DPP (Excl. Tax)</span>
            <span className="text-[13px] font-bold font-mono">{fmt(netValue)}</span>
          </div>
          <div className="w-px h-8 bg-white/10 shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-fit">
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Ledger Sum</span>
            <span className={`text-[13px] font-bold font-mono ${(isBalanced && !isExtractionFailed) ? 'text-white/60' : 'text-emerald-300'}`}>{fmt(ledgerSum)}</span>
            <span className="text-[8px] text-slate-500 mt-0.5">{isExtractionFailed ? '※ Used as Baseline' : (isBalanced ? '✓ Match' : '⚠ Missing Data')}</span>
          </div>
          <div className="w-px h-8 bg-white/10 shrink-0" />
          <div className="flex flex-col gap-0.5 min-w-fit">
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Tax (PPN {displayTax}%)</span>
            <span className="text-[13px] font-bold font-mono text-slate-200">{fmt(totalTax)}</span>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded-lg"><Info className="h-3.5 w-3.5 text-slate-500" /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tax Breakdown</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center group">
              <span className="text-[11px] text-slate-500 font-medium">PPN {displayTax}%</span>
              <span className="font-mono font-bold text-slate-900 text-[12px] tabular-nums">{fmt(totalTax)}</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-[9px] text-slate-400 italic leading-relaxed">Derived from Grand Total using intelligent rate snapping.</p>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const FinancialSummaryRenderer: React.FC<FinancialSummaryRendererProps> = ({ text, ledger, financials }) => {
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
        <RecipientFinancialGrid ledger={ledger} taxRate={rate} />
        <FinancialTotalsCard financials={financials} ledger={ledger} taxRate={rate} displayTax={displayTax} />
      </div>
    );
  }

  if (rows.length === 0) return <p className="text-[12px] text-slate-400 italic p-4">No financial data detected.</p>;

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <table className="w-full text-[12px] border-collapse">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">Keterangan</th>
            <th className="px-4 py-2 text-right text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 w-[38%]">Harga / Nilai</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-slate-100 ${row.isTotal ? 'bg-slate-100 font-semibold' : 'bg-white hover:bg-slate-50'}`}>
              <td className="px-4 py-2.5 align-top leading-snug">{cleanValue(row.label, 'keterangan')}</td>
              <td className="px-4 py-2.5 text-right align-top font-mono text-slate-800 font-semibold">{row.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
