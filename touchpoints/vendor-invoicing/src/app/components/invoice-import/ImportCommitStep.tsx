/* ── Step 5 · Simulate, then commit (spec S6 + S7) ────────────────────
 * Read only until the last click. Left, what will be created; right,
 * the accounting preview (Dr Clearing / Cr AP per invoice, one
 * reversing entry) and the AP reconciliation input, the screen that
 * removes the worst afternoon of any implementation by running the
 * balance tie-out BEFORE commit instead of after. Commit shows
 * determinate progress and lands on counts, next actions and the
 * rollback with its expiry stated. No celebration state.
 */

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Landmark,
  Scale,
  Undo2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { MoneyInput } from '@/app/components/payments/MoneyInput';
import { downloadTextFile, toCsv, type ImportRunConfig } from './importModel';
import {
  importedStatusLabel,
  rowSeverity,
  type ImportInvoiceRow,
  type SimulateSummary,
} from './importEngine';
import { fmtPeriod, money } from './importUi';

export interface CommitState {
  phase: 'idle' | 'confirm' | 'running' | 'done';
  processed: number;
  total: number;
  importedInvoiceCount: number;
  importedPaymentCount: number;
  exceptionCount: number;
}

const STATUS_TONES: Record<string, { bg: string; fg: string; border: string }> = {
  'Pending Approval': { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
  Approved: { bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
  'Partially Paid': { bg: '#FEFCE8', fg: '#A16207', border: '#FEF08A' },
  'Paid in Full': { bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
  'Payment Hold': { bg: '#FFFBEB', fg: '#B45309', border: '#FDE68A' },
  Exception: { bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
  Cancelled: { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' },
  Settled: { bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
};

export function ImportCommitStep({
  rows,
  summary,
  config,
  commit,
  onViewInvoices,
  onRollback,
}: {
  rows: ImportInvoiceRow[];
  summary: SimulateSummary;
  config: ImportRunConfig;
  commit: CommitState;
  onViewInvoices: () => void;
  onRollback: () => void;
}) {
  const [expectedAp, setExpectedAp] = useState(0);
  const [expectedTouched, setExpectedTouched] = useState(false);
  const hasExpected = expectedTouched && expectedAp > 0;
  const delta = hasExpected ? Math.round((expectedAp - summary.outstandingTotal) * 100) / 100 : 0;
  const ties = hasExpected && Math.abs(delta) <= (Number(config.toleranceText) || 0) / 100 + 0.005;
  const isMigration = config.mode === 'migration';

  /* ── Commit progress ── */
  if (commit.phase === 'running') {
    const pct = commit.total === 0 ? 0 : Math.round((commit.processed / commit.total) * 100);
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16">
        <div className="w-full max-w-[440px] flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-[17px] mt-4" style={{ fontWeight: 600 }}>Committing the Import</h3>
          <p className="text-[12.5px] text-slate-500 mt-1">
            {commit.processed} of {commit.total} rows posted. The commit is atomic: if anything fails, the whole import rolls back.
          </p>
          <div className="w-full h-2 bg-slate-100 rounded-full mt-5 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 " style={{ fontWeight: 500 }}>{pct}%</p>
        </div>
      </div>
    );
  }

  /* ── Result (S7): counts and next actions ── */
  if (commit.phase === 'done') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-10">
        <div className="w-full max-w-[560px]">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-[18px] mt-4" style={{ fontWeight: 600 }}>Import Committed</h3>
            <p className="text-[13px] text-slate-500 mt-1 max-w-[420px]">
              {commit.importedInvoiceCount} invoice{commit.importedInvoiceCount === 1 ? '' : 's'}
              {commit.importedPaymentCount > 0 ? ` and ${commit.importedPaymentCount} payment${commit.importedPaymentCount === 1 ? '' : 's'}` : ''} are now in Omne.
              {commit.exceptionCount > 0
                ? ` ${commit.exceptionCount} landed in the Exception queue and stay out of payment runs and aging until cleared.`
                : ''}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-6">
            {[
              { label: 'Invoices', value: commit.importedInvoiceCount },
              { label: 'Payments', value: commit.importedPaymentCount },
              { label: 'Exceptions', value: commit.exceptionCount },
            ].map((c) => (
              <div key={c.label} className="bg-white border border-border rounded-xl px-4 py-3 text-center">
                <p className="text-[20px] " style={{ fontWeight: 600 }}>{c.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>{c.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-6">
            <button
              type="button"
              onClick={onViewInvoices}
              className="w-full h-10 rounded-xl text-[13px] text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer border-0"
              style={{ fontWeight: 600 }}
            >
              View the Imported Invoices
            </button>
            <button
              type="button"
              onClick={() => {
                const rowsCsv = toCsv([
                  ['source_reference', 'vendor', 'invoice_number', 'status', 'total'],
                  ...rows.filter((r) => !r.excluded && rowSeverity(r) !== 'blocker').map((r) => [
                    r.ref,
                    r.header.vendor_name ?? '',
                    r.header.vendor_invoice_number ?? '',
                    importedStatusLabel(r),
                    String(r.header.total || r.header.subtotal || ''),
                  ]),
                ]);
                downloadTextFile('import-run-report.csv', rowsCsv);
                toast.success('Import report downloaded');
              }}
              className="w-full h-10 rounded-xl border border-border bg-white text-[13px] text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              style={{ fontWeight: 500 }}
            >
              <Download className="w-4 h-4 text-slate-400" />
              Download the Import Report
            </button>
            <button
              type="button"
              onClick={onRollback}
              className="w-full h-10 rounded-xl border border-rose-200 bg-white text-[13px] text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              style={{ fontWeight: 500 }}
            >
              <Undo2 className="w-4 h-4" />
              Roll Back This Import
            </button>
            <p className="text-[11px] text-slate-400 text-center mt-1">
              Rollback stays available for 72 hours, or until the first payment run touches an imported invoice.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Simulate ── */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start w-full">
      {/* Left: what will be created. */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="bg-white border border-border rounded-xl px-4 pt-3.5 pb-4">
          <p className="text-[13px]" style={{ fontWeight: 600 }}>What This Import Creates</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Nothing has committed yet. This is a dry run against live data.</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              // Owed-only scope (Eli 10/9): no payments or credit records
              // are imported, so the count shows invoices + the open balance.
              { label: 'Invoices', value: summary.invoiceCount },
              { label: 'Lines', value: summary.lineCount },
              { label: 'Open Balance', value: money(summary.outstandingTotal) },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-border bg-slate-50/50 px-3 py-2.5">
                <p className="text-[18px] " style={{ fontWeight: 600 }}>{c.value}</p>
                <p className="text-[10.5px] text-slate-500" style={{ fontWeight: 500 }}>{c.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3.5">
            <p className="text-[11px] text-slate-400 mb-1.5" style={{ fontWeight: 600 }}>Invoices by Landing Status</p>
            <div className="flex flex-wrap gap-1.5">
              {summary.byStatus.map((s) => {
                const tone = STATUS_TONES[s.label] ?? { bg: '#F8FAFC', fg: '#475569', border: '#E2E8F0' };
                return (
                  <span
                    key={s.label}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                    style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border, fontWeight: 600 }}
                  >
                    {s.label}
                    <span className="" style={{ fontWeight: 700 }}>{s.count}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {summary.vendorsCreated.length > 0 && (
            <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <UserPlus className="w-4 h-4 text-slate-400 shrink-0 mt-px" />
              <p className="text-[12px] text-slate-600" style={{ fontWeight: 400 }}>
                <span style={{ fontWeight: 600 }}>{summary.vendorsCreated.length} vendor{summary.vendorsCreated.length === 1 ? '' : 's'} will be created:</span>{' '}
                {summary.vendorsCreated.join(', ')}. They are flagged for review after the import.
              </p>
            </div>
          )}
        </div>

        {/* Per-vendor subtotals. */}
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-4 pt-3.5 pb-2.5">
            <p className="text-[13px]" style={{ fontWeight: 600 }}>Per-Vendor Subtotals</p>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50 border-y border-border">
                <th className="text-left px-4 py-1.5 text-slate-500" style={{ fontWeight: 600 }}>Vendor</th>
                <th className="text-right px-4 py-1.5 text-slate-500" style={{ fontWeight: 600 }}>Total</th>
                <th className="text-right px-4 py-1.5 text-slate-500" style={{ fontWeight: 600 }}>Still Owed</th>
              </tr>
            </thead>
            <tbody>
              {summary.perVendor.map((v) => (
                <tr key={v.vendor} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-1.5 text-slate-700" style={{ fontWeight: 500 }}>{v.vendor}</td>
                  <td className="px-4 py-1.5 text-right text-slate-600 ">{money(v.total)}</td>
                  <td className="px-4 py-1.5 text-right text-slate-700 " style={{ fontWeight: 500 }}>{money(v.outstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: accounting preview + reconciliation. */}
      <div className="flex flex-col gap-3 min-w-0">
        {isMigration && (
          <div className="bg-white border border-border rounded-xl px-4 pt-3.5 pb-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-slate-400" />
              <p className="text-[13px]" style={{ fontWeight: 600 }}>Accounting Preview</p>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Each invoice posts into {fmtPeriod(config.postingPeriod)} for its open balance only: debit the migration clearing account, credit Accounts Payable. The imported invoices then add up to the A/P opening balance, with no expense account touched and nothing double-counted against the chart-of-accounts openings.
            </p>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10.5px] text-slate-400" style={{ fontWeight: 600 }}>
                  Per Invoice, at Commit
                </div>
                <div className="px-3 py-2 grid grid-cols-[1fr_auto] gap-y-1 text-[12px] ">
                  <span className="text-slate-600">Dr · {config.clearingAccount || '2105 Migration Clearing'}</span>
                  <span className="text-slate-700" style={{ fontWeight: 500 }}>{money(summary.clearingDebit)}</span>
                  <span className="text-slate-600">Cr · 2000 Accounts Payable</span>
                  <span className="text-slate-700" style={{ fontWeight: 500 }}>{money(summary.apCredit)}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                The clearing account nets to zero once your opening A/P balance is loaded against it, so the two never double-count.
              </p>
            </div>
          </div>
        )}

        {/* Reconciliation: the reason this screen exists. */}
        <div className="bg-white border border-border rounded-xl px-4 pt-3.5 pb-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-slate-400" />
            <p className="text-[13px]" style={{ fontWeight: 600 }}>Tie Out Against Your Legacy System</p>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Enter your legacy accounts payable closing balance as of cutover to compare it with this import before committing.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <p className="text-[12px] text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Legacy AP Closing Balance</p>
              <MoneyInput
                value={expectedAp}
                onValueChange={(n) => { setExpectedAp(n); setExpectedTouched(true); }}
                placeholder="0.00"
                fluid
                className="h-9 text-sm bg-white"
              />
            </div>
            <div>
              <p className="text-[12px] text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Omne Computed Balance</p>
              <div className="h-9 rounded-lg border border-border bg-slate-50/60 px-3 flex items-center text-sm text-slate-700" style={{ fontWeight: 500 }}>
                {money(summary.outstandingTotal)}
              </div>
            </div>
          </div>
          {hasExpected && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 ${
                ties ? 'border-emerald-200 bg-emerald-50/70' : 'border-orange-200 bg-orange-50/70'
              }`}
            >
              {ties ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-px" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-px" />
              )}
              <p className={`text-[12px] ${ties ? 'text-emerald-800' : 'text-orange-800'}`} style={{ fontWeight: 400 }}>
                {ties ? (
                  <span style={{ fontWeight: 600 }}>The balances tie. Commit with confidence.</span>
                ) : (
                  <>
                    <span style={{ fontWeight: 600 }}>Off by {money(Math.abs(delta))}.</span>{' '}
                    The legacy balance is {delta > 0 ? 'higher' : 'lower'} than the computed total. Check the per-vendor subtotals on the left, or the rows you excluded.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
