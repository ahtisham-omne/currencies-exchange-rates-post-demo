/* ── Step 1 · Set up the run (spec S2, v4 9/16/26) ────────────────────
 * The first iteration's arrangement, kept: titled section cards on the
 * left (the module's flat form-modal chrome), the live "This run will"
 * summary + prerequisites rail on the right, and the grid FILLS the
 * modal, no centered island with dead margins. Field-level detail lives
 * in info tooltips (the KPI-card recipe); long-form in the guide.
 */

import { History, CalendarClock, CheckCircle2, AlertTriangle, Ban, Info, FileSpreadsheet, Landmark } from 'lucide-react';
import type { ReactNode } from 'react';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { GL_ACCOUNTS } from '@/app/data/glAccounts';
import { PAYMENT_TERM_PRESETS } from '@/app/data/paymentTermPresets';
import type { Invoice } from '@/app/data/mockInvoices';
import {
  OUT_OF_SCOPE_V1,
  SUGGESTED_CLEARING_ACCOUNT,
  type ImportMode,
  type ImportRunConfig,
} from './importModel';
import { fmtPeriod } from './importUi';

const MODE_CARDS: { mode: ImportMode; title: string; description: string; icon: typeof History }[] = [
  { mode: 'migration', title: 'Migration', description: 'Bulk-load history once, at go-live. Statuses and payments come along.', icon: History },
  { mode: 'ongoing', title: 'Ongoing Batch', description: 'Bulk-enter this period’s invoices. Everything lands at Pending Approval.', icon: CalendarClock },
];

function postingPeriodOptions(today: Date): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value, label: fmtPeriod(value) });
  }
  return out;
}

function InfoTip({ tip }: { tip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" tabIndex={-1} className="inline-flex shrink-0">
          <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-[280px] text-[11px] leading-[1.5] z-[300]">
        <p className="text-slate-500">{tip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function FieldLabel({ label, required, tip }: { label: string; required?: boolean; tip?: string }) {
  return (
    <div className="flex items-center gap-1 mb-1.5">
      <p className="text-[12px] text-slate-600" style={{ fontWeight: 500 }}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </p>
      {tip && <InfoTip tip={tip} />}
    </div>
  );
}

/** Titled section card, the flat form-modal chrome from the first iteration. */
function SectionCard({ title, helper, children }: { title: string; helper?: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-xl">
      <div className="px-4 pt-3.5">
        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</p>
        {helper && <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>{helper}</p>}
      </div>
      <div className="px-4 pt-3 pb-4">{children}</div>
    </div>
  );
}

export function ImportSetupStep({
  config,
  onChange,
  invoices,
}: {
  config: ImportRunConfig;
  onChange: (next: ImportRunConfig) => void;
  invoices: Invoice[];
}) {
  const set = (patch: Partial<ImportRunConfig>) => onChange({ ...config, ...patch });
  const isMigration = config.mode === 'migration';
  const toleranceValid = /^\d+$/.test(config.toleranceText.trim());
  const vendorCount = new Set(invoices.map((i) => i.vendor)).size;
  const periods = postingPeriodOptions(new Date());

  const optionalObjects = [
    ...(isMigration && config.objects.payments ? ['payments'] : []),
    ...(isMigration && config.objects.creditMemos ? ['credit memos'] : []),
  ];

  const checklist: { label: string; ok: boolean; detail: string }[] = [
    { label: 'Payment Terms', ok: true, detail: `${PAYMENT_TERM_PRESETS.length} terms in the library` },
    { label: 'Chart of Accounts', ok: true, detail: `${GL_ACCOUNTS.length} accounts available` },
    ...(isMigration
      ? [{
          label: 'Clearing Account',
          ok: !!config.clearingAccount,
          detail: config.clearingAccount || 'Pick the offset account',
        }]
      : []),
    {
      label: 'Vendors',
      ok: true,
      detail: `${vendorCount} resolve by name${config.createMissingVendors ? ', missing ones get created' : ', missing ones block'}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-3 items-start w-full">
      {/* ── Left: titled section cards ── */}
      <div className="flex flex-col gap-3 min-w-0">
        <SectionCard
          title="What kind of import is this?"
          helper="Same engine, different rules. The mode never changes once files are in."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MODE_CARDS.map((card) => {
              const selected = config.mode === card.mode;
              const Icon = card.icon;
              return (
                <button
                  key={card.mode}
                  type="button"
                  onClick={() => set({ mode: card.mode })}
                  className={`group text-left rounded-xl border p-3.5 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${
                    selected
                      ? 'border-primary bg-accent/60 shadow-[0_6px_18px_-10px_rgba(10,119,255,0.45)]'
                      : 'border-border bg-white hover:border-primary/40 hover:bg-blue-50/30 hover:shadow-[0_8px_20px_-10px_rgba(10,119,255,0.35)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                      style={{
                        backgroundColor: selected ? 'hsl(var(--primary))' : '#F1F5F9',
                        color: selected ? '#fff' : '#64748B',
                      }}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13.5px]" style={{ fontWeight: 600, color: selected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>
                        {card.title}
                      </p>
                      <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">{card.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Import Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
            <div className="min-w-0">
              <FieldLabel
                label="Import Name"
                required
                tip="How this import shows up in history and on the audit trail, e.g. QuickBooks cutover, September."
              />
              <Input
                value={config.runName}
                onChange={(e) => set({ runName: e.target.value })}
                className="h-9 text-sm bg-white w-full"
                placeholder="e.g. QuickBooks cutover, September"
              />
            </div>
            {isMigration && (
              <>
                <div className="min-w-0">
                  <FieldLabel
                    label="Clearing Account"
                    required
                    tip="Migrated payables offset here instead of expense accounts: Dr Clearing, Cr Accounts Payable per invoice, then one entry reverses the whole load. Your migrated GL balance stays untouched."
                  />
                  <Select value={config.clearingAccount} onValueChange={(v) => set({ clearingAccount: v })}>
                    <SelectTrigger className="h-9 text-[13px] bg-white w-full [&>span]:truncate">
                      <SelectValue placeholder="Pick an account" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[280px]">
                      {GL_ACCOUNTS.filter((a) => a.startsWith('2') || a === SUGGESTED_CLEARING_ACCOUNT)
                        .concat(GL_ACCOUNTS.includes(SUGGESTED_CLEARING_ACCOUNT) ? [] : [SUGGESTED_CLEARING_ACCOUNT])
                        .sort()
                        .map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <FieldLabel
                    label="Posting Period"
                    required
                    tip="The go-live period. Every row posts here whatever date the legacy invoice carries, so the load reverses in one entry."
                  />
                  <Select value={config.postingPeriod} onValueChange={(v) => set({ postingPeriod: v })}>
                    <SelectTrigger className="h-9 text-[13px] bg-white w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {periods.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <FieldLabel
                    label="Rounding Tolerance"
                    tip="Cents of slack per invoice when totals are compared. Legacy exports are off by cents, e.g. a tolerance of 2 lets $9,949.98 match $9,950.00 instead of raising 300 exceptions."
                  />
                  <div className="relative">
                    <Input
                      inputMode="numeric"
                      value={config.toleranceText}
                      onChange={(e) => set({ toleranceText: e.target.value })}
                      className={`h-9 text-sm bg-white w-full pr-12 ${toleranceValid ? '' : 'border-rose-300 focus-visible:ring-rose-200 text-rose-600'}`}
                      title={toleranceValid ? undefined : 'Whole number of cents, e.g. 2'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">cents</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="What is in this import?"
          helper="One invoice file. The first pass imports only the open balances as standalone vendor invoices, no payments and no credit memos."
        >
          <div className="flex flex-col gap-2">
            {/* Owed-only scope (Eli 10/9): a single invoice file is the whole
                import. Payments and credit memos are not imported — the amount
                already paid rides in each invoice's memo instead. */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/25 bg-accent/40 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>
                  Invoices<span className="text-red-500 ml-0.5">*</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-px">
                  One file. Unpaid invoices import in full; partly paid import only the remaining balance; fully paid are left out.
                </p>
              </div>
              <Switch checked disabled />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>
                  Create vendors that are not in Omne yet
                </p>
                <p className="text-[11px] text-slate-500 mt-px">
                  Matched by normalized name. Created vendors are flagged for review after the import.
                </p>
              </div>
              <Switch
                checked={config.createMissingVendors}
                onCheckedChange={(v) => set({ createMissingVendors: v })}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Right: live summary rail ── */}
      <div className="flex flex-col gap-3 lg:sticky lg:top-0">
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="px-4 pt-3.5 pb-3 border-b border-slate-100">
            <p className="text-[13px]" style={{ fontWeight: 600 }}>This import will</p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2 text-[12px] text-slate-600" style={{ lineHeight: 1.5 }}>
                <span className="w-4 h-4 rounded-full bg-blue-50 text-primary flex items-center justify-center shrink-0 mt-px">
                  <FileSpreadsheet className="w-2.5 h-2.5" />
                </span>
                Ask for one file: your invoice export
                {optionalObjects.length > 0 ? `, with ${optionalObjects.join(' and ')} welcome as extra sheets or separate files` : ''}
              </li>
              <li className="flex items-start gap-2 text-[12px] text-slate-600" style={{ lineHeight: 1.5 }}>
                <span className="w-4 h-4 rounded-full bg-blue-50 text-primary flex items-center justify-center shrink-0 mt-px">
                  <Landmark className="w-2.5 h-2.5" />
                </span>
                {isMigration
                  ? `Post everything into ${fmtPeriod(config.postingPeriod)} against ${config.clearingAccount || 'the clearing account'}, reversed in one entry`
                  : 'Route every invoice into the approval queue at Pending Approval'}
              </li>
              <li className="flex items-start gap-2 text-[12px] text-slate-600" style={{ lineHeight: 1.5 }}>
                <span className="w-4 h-4 rounded-full bg-blue-50 text-primary flex items-center justify-center shrink-0 mt-px">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                </span>
                Validate everything before commit. Nothing writes until you say so
              </li>
            </ul>
          </div>
          <div className="px-4 pt-3 pb-4">
            <p className="text-[10.5px] text-slate-400 mb-2" style={{ fontWeight: 600 }}>
              Prerequisites
            </p>
            <div className="space-y-2">
              {checklist.map((c) => (
                <div key={c.label} className="flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-px" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-px" />
                  )}
                  <p className="text-[12px] text-foreground min-w-0" style={{ fontWeight: 500, lineHeight: 1.45 }}>
                    {c.label}
                    <span className="text-slate-400 ml-1.5" style={{ fontWeight: 400 }}>{c.detail}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl px-4 pt-3 pb-3.5">
          <div className="flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[12px] text-slate-600" style={{ fontWeight: 600 }}>Not in This Version</p>
          </div>
          <p className="text-[11.5px] text-slate-500 mt-1.5" style={{ fontWeight: 400, lineHeight: 1.6 }}>
            {OUT_OF_SCOPE_V1.join(' · ')}
          </p>
        </div>
      </div>
    </div>
  );
}
