import { Settings, X, Check, UserCog, Landmark, ShieldCheck, Receipt, FileDigit } from 'lucide-react';
import { Switch } from '@/app/components/ui/switch';
import { AR_ROLES, permissionsFor, updateArSettings, useArSettings, type ArRole, type PreInvoiceTreatmentMode } from '@/app/hooks/useArSettings';
import { useSystemSettings, formatDocumentNumber } from '@/app/hooks/useSystemSettings';
import { TREATMENT_LABEL } from '@/app/data/ar/customerInvoiceStatus';

/* ── Customer Invoicing settings (PRD §15, BR-011, D6) ───────────────
 * The AR fork of SystemSettingsModal's flat form chrome. Company
 * switches for the A/R and deposit account overrides and whether
 * invoices need approval, plus the prototype's acting role so the flow
 * can be walked as a clerk, an approver or a sales rep. Vendor settings
 * are untouched. */

const ROLE_HELPER: Record<ArRole, string> = {
  'Accounting Manager': 'Creates, approves and sends. Can change prices and, when allowed, the A/R account.',
  'Billing Clerk': 'Creates and sends. Submits for approval, cannot approve or change prices.',
  'Sales Rep': 'Raises advance invoices from quotes only. Cannot approve or send.',
  'General User': 'Read only.',
};

// Mahreen 11/4 advance invoice flow: three settings and one proposed gate.
const TREATMENT_MODES: { value: PreInvoiceTreatmentMode; label: string; helper: string }[] = [
  { value: 'Never', label: 'Never', helper: 'Every advance invoice is Revenue on Shipment, locked. Payments are held as customer prepayment until the goods ship.' },
  { value: 'Always', label: 'Always', helper: 'Every advance invoice is Revenue on Invoice, locked. Revenue and cost post at invoice and the units are locked to the customer.' },
  { value: 'Optional', label: 'Optional', helper: 'The person creating the advance invoice picks, starting from the default below.' },
];

interface ArSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SectionLabel({ icon: Icon, children }: { icon: typeof Settings; children: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
      <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontWeight: 500 }}>
        {children}
      </span>
    </div>
  );
}

function ToggleRow({ title, helper, checked, onChange }: { title: string; helper: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="px-4 py-3 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>{title}</p>
        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed" style={{ fontWeight: 400 }}>{helper}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}

export function ArSettingsModal({ open, onOpenChange }: ArSettingsModalProps) {
  const settings = useArSettings();
  const numbering = useSystemSettings().customerInvoiceNumbering;
  if (!open) return null;
  const perms = permissionsFor(settings);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[240] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[540px] max-h-[85vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 500 }}>
                Customer Invoicing Settings
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                Company defaults for customer invoices, and the role you are acting as.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">
          <section>
            <SectionLabel icon={UserCog}>Acting Role</SectionLabel>
            <div className="rounded-xl border border-slate-200 overflow-hidden" role="radiogroup" aria-label="Acting role">
              {AR_ROLES.map((r, i) => {
                const selected = settings.role === r;
                return (
                  <button
                    key={r}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updateArSettings({ role: r })}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i > 0 ? 'border-t border-slate-100' : ''} ${selected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selected ? 'border-primary bg-primary' : 'border-slate-300 bg-white'}`}>
                      {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`text-[12.5px] ${selected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>{r}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>{ROLE_HELPER[r]}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-slate-400 mt-2" style={{ fontWeight: 400 }}>
              Prototype only. Buttons you are not allowed to use are hidden, as they will be in the product.
            </p>
          </section>

          <section>
            <SectionLabel icon={ShieldCheck}>Approval</SectionLabel>
            <div className="rounded-xl border border-slate-200">
              <ToggleRow
                title="Customer Invoices Need Approval"
                helper={`When off, finishing an invoice approves and posts it straight away. ${settings.approvalRequired ? '' : 'Billing clerks currently approve their own invoices.'}`.trim()}
                checked={settings.approvalRequired}
                onChange={(v) => updateArSettings({ approvalRequired: v })}
              />
            </div>
          </section>

          <section>
            <SectionLabel icon={Receipt}>Book Advance Invoices as Revenue</SectionLabel>
            <div className="rounded-xl border border-slate-200 overflow-hidden" role="radiogroup" aria-label="Book advance invoices as revenue">
              {TREATMENT_MODES.map((m, i) => {
                const selected = settings.preInvoiceTreatment === m.value;
                return (
                  <button
                    key={m.value}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updateArSettings({ preInvoiceTreatment: m.value })}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i > 0 ? 'border-t border-slate-100' : ''} ${selected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selected ? 'border-primary bg-primary' : 'border-slate-300 bg-white'}`}>
                      {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className={`text-[12.5px] ${selected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>{m.label}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>{m.helper}</p>
                    </div>
                  </button>
                );
              })}
              {settings.preInvoiceTreatment === 'Optional' && (
                <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between gap-4 bg-slate-50/50">
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>Default</p>
                    <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>What a new advance invoice starts as.</p>
                  </div>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shrink-0">
                    {(['Revenue', 'Deposit'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => updateArSettings({ preInvoiceDefault: v })}
                        className={`h-7 px-3 rounded-md text-[12px] transition-colors ${settings.preInvoiceDefault === v ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        style={{ fontWeight: 500 }}
                      >
                        {TREATMENT_LABEL[v]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 mt-2">
              <ToggleRow
                title="Revenue on Invoice Only for Units on Hand"
                helper="Proposed, awaiting sign-off. When the units are not on hand, Revenue on Invoice is disabled with the reason, such as Only 40 of 100 units on hand. Advance invoices from a quote are always Revenue on Shipment, whatever this setting says."
                checked={settings.revenueGate}
                onChange={(v) => updateArSettings({ revenueGate: v })}
              />
            </div>
          </section>

          <section>
            <SectionLabel icon={FileDigit}>Invoice Numbering</SectionLabel>
            <div className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-[11px] text-slate-500 leading-relaxed" style={{ fontWeight: 400 }}>
                Prefix, digits and start number are a company setting under System Settings, Document Numbering.
              </p>
              <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0" style={{ fontWeight: 500 }}>
                {formatDocumentNumber(numbering, numbering.start)}
              </span>
            </div>
          </section>

          <section>
            <SectionLabel icon={Landmark}>Accounts</SectionLabel>
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              <ToggleRow
                title="Allow Changing the A/R Account on an Invoice"
                helper="Same override setting as the A/P account on vendor invoices. Only Accounting Managers can change it."
                checked={settings.allowArOverride}
                onChange={(v) => updateArSettings({ allowArOverride: v })}
              />
              <ToggleRow
                title="Allow Changing the Customer Deposit Account on an Advance"
                helper="By default the deposit account comes from the customer."
                checked={settings.allowDepositOverride}
                onChange={(v) => updateArSettings({ allowDepositOverride: v })}
              />
            </div>
          </section>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>As {settings.role} you can</p>
            <p className="text-[11.5px] text-slate-700 mt-1 leading-relaxed" style={{ fontWeight: 400 }}>
              {[
                perms.canCreate && (perms.advanceFromQuoteOnly ? 'raise advance invoices from quotes' : 'create and edit invoices'),
                perms.canApprove && 'approve and send back',
                perms.canSend && 'send to customers',
                perms.canChangePrice && 'change prices',
                perms.canChangeArAccount && 'change the A/R account',
              ].filter(Boolean).join(', ') || 'view invoices'}.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 rounded-lg border border-slate-200 bg-white text-[12.5px] text-foreground hover:bg-slate-50 transition-colors"
            style={{ fontWeight: 500 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
