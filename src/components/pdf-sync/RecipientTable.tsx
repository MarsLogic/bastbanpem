import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Search, Users,
  Banknote, Truck, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { ShipmentLedgerItem } from '@/lib/contractStore';

interface RecipientTableProps {
  ledger: ShipmentLedgerItem[];
  /** Contract total excluding tax — used for reconciliation badge */
  grandTotal?: number;
}

type SortKey =
  | 'shipment_id'
  | 'name'
  | 'group'
  | 'desa'
  | 'kabupaten'
  | 'provinsi'
  | 'product_total'
  | 'shipping_total';

type SortDir = 'asc' | 'desc';

// ─── Sort indicator icon ──────────────────────────────────────────────────────

function SortIcon({
  col,
  active,
  dir,
}: {
  col: SortKey;
  active: SortKey;
  dir: SortDir;
}) {
  if (col !== active) return <ChevronsUpDown className="h-3 w-3 text-slate-300 shrink-0" />;
  return dir === 'asc'
    ? <ChevronUp   className="h-3 w-3 text-blue-500 shrink-0" />
    : <ChevronDown className="h-3 w-3 text-blue-500 shrink-0" />;
}

// ─── Sortable header cell ─────────────────────────────────────────────────────

function TH({
  label,
  col,
  active,
  dir,
  onSort,
  className = '',
}: {
  label: string;
  col: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500
                  bg-slate-50 border-b border-slate-200 cursor-pointer select-none
                  hover:bg-slate-100 whitespace-nowrap transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon col={col} active={active} dir={dir} />
      </div>
    </th>
  );
}

// ─── Format helpers ───────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n === 0 ? '—' : `Rp${n.toLocaleString('id-ID')}`;

// ─── Main component ───────────────────────────────────────────────────────────

export const RecipientTable: React.FC<RecipientTableProps> = ({
  ledger,
  grandTotal,
}) => {
  const [search,   setSearch]  = useState('');
  const [province, setProvince] = useState<string>('__all__');
  const [sortKey,  setSortKey]  = useState<SortKey>('shipment_id');
  const [sortDir,  setSortDir]  = useState<SortDir>('asc');

  // Unique provinces for the filter dropdown
  const provinces = useMemo(() => {
    const set = new Set<string>();
    ledger.forEach(i => {
      if (i.destination.provinsi) set.add(i.destination.provinsi);
    });
    return Array.from(set).sort();
  }, [ledger]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Filter first, then sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ledger.filter(item => {
      const matchSearch =
        !q ||
        [
          item.recipient.name,
          item.recipient.group,
          item.destination.desa,
          item.destination.kabupaten,
          item.destination.provinsi,
        ].some(v => v?.toLowerCase().includes(q));
      const matchProv =
        province === '__all__' || item.destination.provinsi === province;
      return matchSearch && matchProv;
    });
  }, [ledger, search, province]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      switch (sortKey) {
        case 'name':           va = a.recipient.name    ?? ''; vb = b.recipient.name    ?? ''; break;
        case 'group':          va = a.recipient.group   ?? ''; vb = b.recipient.group   ?? ''; break;
        case 'desa':           va = a.destination.desa      ?? ''; vb = b.destination.desa      ?? ''; break;
        case 'kabupaten':      va = a.destination.kabupaten ?? ''; vb = b.destination.kabupaten ?? ''; break;
        case 'provinsi':       va = a.destination.provinsi  ?? ''; vb = b.destination.provinsi  ?? ''; break;
        case 'product_total':  va = a.costs.product_total;  vb = b.costs.product_total;  break;
        case 'shipping_total': va = a.costs.shipping_total; vb = b.costs.shipping_total; break;
        default:               va = a.shipment_id;           vb = b.shipment_id;           break;
      }
      const cmp =
        typeof va === 'number'
          ? (va as number) - (vb as number)
          : String(va).localeCompare(String(vb), 'id');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Footer totals for currently visible (filtered) rows
  const totalProduct  = filtered.reduce((s, i) => s + i.costs.product_total,  0);
  const totalShipping = filtered.reduce((s, i) => s + i.costs.shipping_total, 0);

  // Reconciliation check across ALL ledger rows vs supplied contract total
  const allProduct = ledger.reduce((s, i) => s + i.costs.product_total, 0);
  const isBalanced =
    grandTotal !== undefined ? Math.abs(allProduct - grandTotal) < 5000 : null;

  if (!ledger || ledger.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-16 text-center gap-4">
        <Users className="h-10 w-10 text-slate-200" />
        <p className="text-sm font-bold text-slate-500">No recipients extracted.</p>
        <p className="text-[11px] text-slate-400">
          Run AI Scan to extract the shipment ledger.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b bg-white flex items-center gap-3 shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search name, group, area..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-[11px] bg-slate-50 border-slate-200 focus-visible:ring-blue-400"
          />
        </div>

        <Select value={province} onValueChange={(v) => setProvince(v ?? '__all__')}>
          <SelectTrigger className="h-8 w-[170px] text-[11px] bg-slate-50 border-slate-200 shrink-0">
            <SelectValue placeholder="All Provinces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-[11px]">All Provinces</SelectItem>
            {provinces.map(p => (
              <SelectItem key={p} value={p} className="text-[11px]">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <Badge variant="secondary" className="text-[10px] h-6 font-mono">
            {filtered.length}/{ledger.length}
          </Badge>
          {isBalanced === true && (
            <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] h-6 gap-1 hover:bg-emerald-100">
              <CheckCircle2 className="h-3 w-3" /> Balanced
            </Badge>
          )}
          {isBalanced === false && (
            <Badge className="bg-red-100 text-red-700 border border-red-200 text-[10px] h-6 gap-1 hover:bg-red-100">
              <AlertTriangle className="h-3 w-3" /> Discrepancy
            </Badge>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200 w-10 select-none">
                #
              </th>
              <TH label="Nama"     col="name"           active={sortKey} dir={sortDir} onSort={toggleSort} />
              <TH label="Poktan"   col="group"          active={sortKey} dir={sortDir} onSort={toggleSort} />
              <TH label="Desa"     col="desa"           active={sortKey} dir={sortDir} onSort={toggleSort} />
              <TH label="Kab/Kota" col="kabupaten"      active={sortKey} dir={sortDir} onSort={toggleSort} />
              <TH label="Provinsi" col="provinsi"       active={sortKey} dir={sortDir} onSort={toggleSort} />
              <TH label="Produk"   col="product_total"  active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
              <TH label="Ongkir"   col="shipping_total" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-right" />
            </tr>
          </thead>

          <tbody>
            {sorted.map((item, idx) => (
              <tr
                key={item.shipment_id}
                className={`border-b border-slate-100 hover:bg-blue-50/50 transition-colors
                            ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
              >
                <td className="px-3 py-2 font-mono text-slate-400 text-[10px] tabular-nums">
                  {item.shipment_id}
                </td>

                <td className="px-3 py-2 max-w-[180px]">
                  <div
                    className="font-semibold text-slate-800 truncate leading-tight"
                    title={item.recipient.name}
                  >
                    {item.recipient.name || '—'}
                  </div>
                  {item.recipient.phone && (
                    <div className="text-[9px] font-mono text-slate-400 mt-0.5 tabular-nums">
                      {item.recipient.phone}
                    </div>
                  )}
                </td>

                <td className="px-3 py-2 max-w-[130px]">
                  <div
                    className="text-blue-700 font-medium truncate"
                    title={item.recipient.group ?? ''}
                  >
                    {item.recipient.group || '—'}
                  </div>
                </td>

                <td className="px-3 py-2 max-w-[130px]">
                  <div className="text-slate-600 truncate" title={item.destination.desa ?? ''}>
                    {item.destination.desa || '—'}
                  </div>
                </td>

                <td className="px-3 py-2 max-w-[140px]">
                  <div
                    className="text-slate-600 truncate"
                    title={item.destination.kabupaten ?? ''}
                  >
                    {item.destination.kabupaten || '—'}
                  </div>
                </td>

                <td className="px-3 py-2">
                  {item.destination.provinsi ? (
                    <Badge
                      variant="outline"
                      className="text-[9px] h-5 px-1.5 font-medium whitespace-nowrap"
                    >
                      {item.destination.provinsi}
                    </Badge>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>

                <td className="px-3 py-2 font-mono text-emerald-700 font-semibold whitespace-nowrap text-right tabular-nums">
                  {fmt(item.costs.product_total)}
                </td>

                <td className="px-3 py-2 font-mono text-blue-700 font-semibold whitespace-nowrap text-right tabular-nums">
                  {fmt(item.costs.shipping_total)}
                </td>
              </tr>
            ))}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-[11px]">
                  No recipients match your search.
                </td>
              </tr>
            )}
          </tbody>

          {/* ── Sticky footer totals ─── */}
          <tfoot>
            <tr className="sticky bottom-0 bg-slate-900 text-white">
              <td colSpan={6} className="px-3 py-2.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {filtered.length === ledger.length
                    ? 'Total'
                    : `Subtotal — ${filtered.length} of ${ledger.length} shown`}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-400 whitespace-nowrap tabular-nums">
                <div className="flex items-center justify-end gap-1">
                  <Banknote className="h-3 w-3 shrink-0" />
                  {fmt(totalProduct)}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-black text-blue-400 whitespace-nowrap tabular-nums">
                <div className="flex items-center justify-end gap-1">
                  <Truck className="h-3 w-3 shrink-0" />
                  {fmt(totalShipping)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
