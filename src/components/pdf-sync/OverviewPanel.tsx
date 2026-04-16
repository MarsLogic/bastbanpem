import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2, AlertTriangle, XCircle, Banknote, ShieldCheck,
  Activity, Building2, Users, Package, Scale,
} from 'lucide-react';
import { UltraRobustContract } from '@/lib/contractStore';

interface OverviewPanelProps {
  data: UltraRobustContract;
  nomorKontrak?: string;
  namaPenyedia?: string;
  namaPemesan?: string;
}

// ─── Extraction health ────────────────────────────────────────────────────────

interface HealthResult {
  score: number;
  total: number;
  missing: string[];
}

function computeExtractionHealth(u: UltraRobustContract): HealthResult {
  const checks: [boolean, string][] = [
    [u.contract_header.order_id !== 'UNKNOWN' && !!u.contract_header.order_id, 'Order ID'],
    [!!u.contract_header.timestamp, 'Timestamp'],
    [!!u.contract_header.duration_days, 'Duration'],
    [u.financials.grand_total > 0, 'Grand Total'],
    [!!u.financials.bank_disbursement.account_name, 'Bank Account Name'],
    [!!u.financials.bank_disbursement.account_number, 'Bank Account No.'],
    [!!u.financials.bank_disbursement.bank_name, 'Bank Name'],
    [u.compliance_flags.penalty_rate > 0, 'Penalty Rate'],
    [!!u.compliance_flags.mandatory_label, 'Mandatory Label'],
    [u.shipment_ledger.length > 0, 'Shipment Recipients'],
    [Object.keys(u.technical_specifications).length > 0, 'Technical Specs'],
    [Object.keys(u.sections).length > 0, 'Sections'],
  ];
  return {
    score:   checks.filter(([ok]) => ok).length,
    total:   checks.length,
    missing: checks.filter(([ok]) => !ok).map(([, label]) => label),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthBar({ score, total }: { score: number; total: number }) {
  const pct   = Math.round((score / total) * 100);
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-[11px] font-black tabular-nums shrink-0
                    ${pct >= 85 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}
      >
        {score}/{total}
      </span>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm space-y-3">
      <div className={`flex items-center gap-2 pb-2 border-b border-slate-50`}>
        <span className={accent}>{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  const empty = value === null || value === undefined || value === '' || value === 'UNKNOWN';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span
        className={`text-[12px] leading-tight
                    ${mono ? 'font-mono' : 'font-bold'}
                    ${empty ? 'text-slate-300 italic font-normal' : 'text-slate-800'}`}
      >
        {empty ? 'Not extracted' : String(value)}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  data,
  nomorKontrak,
  namaPenyedia,
  namaPemesan,
}) => {
  const { contract_header, financials, compliance_flags, shipment_ledger, technical_specifications } =
    data;
  const health = computeExtractionHealth(data);

  // Financial reconciliation
  const ledgerProductSum = shipment_ledger.reduce((s, i) => s + i.costs.product_total, 0);
  const taxAmount =
    financials.tax_logic.total_tax ||
    (financials.grand_total *
      financials.tax_logic.ppn_rate /
      (1 + financials.tax_logic.ppn_rate));
  const netExpected  = financials.grand_total - taxAmount;
  const discrepancy  = Math.abs(ledgerProductSum - netExpected);
  const isBalanced   = discrepancy < 5000; // Rp 5,000 tolerance for rounding

  const fmt    = (n: number) => (n > 0 ? `Rp${n.toLocaleString('id-ID')}` : '—');
  const fmtPct = (r: number) => `${(r * 100).toFixed(0)}%`;

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-4 pb-10">

        {/* ── Extraction Health ─────────────────────────────────────────── */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Extraction Health
              </span>
            </div>
            <Badge
              className={`text-[10px] h-5 border-0
                ${health.score === health.total
                  ? 'bg-emerald-500'
                  : health.score >= health.total * 0.7
                  ? 'bg-amber-500'
                  : 'bg-red-500'}`}
            >
              {Math.round((health.score / health.total) * 100)}%
            </Badge>
          </div>
          <HealthBar score={health.score} total={health.total} />
          {health.missing.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {health.missing.map(m => (
                <span
                  key={m}
                  className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono"
                >
                  ✗ {m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Contract Identity ─────────────────────────────────────────── */}
        <SectionCard
          icon={<Building2 className="h-3.5 w-3.5" />}
          title="Contract Identity"
          accent="text-blue-500"
        >
          <div className="grid grid-cols-1 gap-3">
            <Field label="Order ID"  value={contract_header.order_id} mono />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Issued Date" value={contract_header.timestamp} />
              <Field
                label="Duration"
                value={
                  contract_header.duration_days
                    ? `${contract_header.duration_days} days`
                    : null
                }
              />
            </div>
            <div className="pt-1 border-t border-slate-50 flex items-start gap-2">
              <Users className="h-3.5 w-3.5 text-slate-300 mt-2 shrink-0" />
              <Field label="Penyedia (Vendor)" value={namaPenyedia} />
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="h-3.5 w-3.5 text-slate-300 mt-2 shrink-0" />
              <Field label="Pemesan (Purchaser)" value={namaPemesan} />
            </div>
          </div>
        </SectionCard>

        {/* ── Financial Reconciliation ──────────────────────────────────── */}
        <div
          className={`p-4 rounded-2xl border shadow-sm space-y-3
                      ${isBalanced
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-red-200 bg-red-50/40'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-slate-500 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                Financial Reconciliation
              </span>
            </div>
            {isBalanced ? (
              <Badge className="bg-emerald-500 text-[10px] gap-1 border-0">
                <CheckCircle2 className="h-3 w-3" /> Balanced
              </Badge>
            ) : (
              <Badge className="bg-red-500 text-[10px] gap-1 border-0">
                <AlertTriangle className="h-3 w-3" /> Discrepancy
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Grand Total</div>
              <div className="text-[13px] font-black font-mono text-slate-900 tabular-nums">
                {fmt(financials.grand_total)}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">
                PPN {fmtPct(financials.tax_logic.ppn_rate)} incl.
              </div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
              <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">
                Ledger Sum (excl. tax)
              </div>
              <div
                className={`text-[13px] font-black font-mono tabular-nums
                            ${isBalanced ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {fmt(ledgerProductSum)}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">
                {shipment_ledger.length} recipients
              </div>
            </div>
          </div>

          {!isBalanced && (
            <div className="flex items-center gap-2 p-2 bg-red-100 rounded-lg">
              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-[10px] text-red-700 font-semibold">
                Gap: {fmt(discrepancy)} — verify recipient costs against contract total
              </span>
            </div>
          )}
        </div>

        {/* ── Bank Disbursement ─────────────────────────────────────────── */}
        <SectionCard
          icon={<Banknote className="h-3.5 w-3.5" />}
          title="Bank Disbursement"
          accent="text-indigo-500"
        >
          <div className="grid grid-cols-1 gap-3">
            <Field label="Account Holder" value={financials.bank_disbursement.account_name} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account Number" value={financials.bank_disbursement.account_number} mono />
              <Field label="Bank"           value={financials.bank_disbursement.bank_name} />
            </div>
          </div>
        </SectionCard>

        {/* ── Compliance Flags ──────────────────────────────────────────── */}
        <SectionCard
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          title="Compliance Flags"
          accent="text-blue-500"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Penalty Rate</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {(compliance_flags.penalty_rate * 1000).toFixed(0)}‰ / day
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-600">Sampling Required</span>
              {compliance_flags.sampling_required ? (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] hover:bg-amber-100">
                  YES
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-400 text-[10px]">NO</Badge>
              )}
            </div>

            {compliance_flags.mandatory_label && (
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">
                  Mandatory Label
                </span>
                <div className="text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-serif italic text-slate-700 leading-snug">
                  "{compliance_flags.mandatory_label}"
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Technical Specifications ──────────────────────────────────── */}
        {Object.keys(technical_specifications).length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <Package className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Technical Specifications
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(technical_specifications).map(([k, v]) => (
                <div key={k} className="border-l border-white/10 pl-3">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter mb-0.5">
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[11px] font-bold text-slate-200 leading-snug">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </ScrollArea>
  );
};
