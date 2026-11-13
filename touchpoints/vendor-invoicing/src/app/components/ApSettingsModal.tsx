import { useEffect, useState } from 'react';
import { CalendarClock, Check, Percent, Settings, ShieldCheck, UserCog, X } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import {
  AP_ROLES,
  RATE_DATE_BASIS_LABEL,
  apPermissionsFor,
  updateApSettings,
  useApSettings,
  type ApRole,
  type RateDateBasis,
} from '@/app/hooks/useApSettings';

/* ── Vendor Invoicing / Vendor Payments settings ──────────────────────
 * The A/P fork of ArSettingsModal's flat form chrome. Module defaults for
 * vendor invoices (which date's rate an invoice takes, and how far an
 * invoice may be from what the vendor billed before it needs review), the
 * exchange-rate permissions, and the prototype's acting role. Vendor
 * Invoicing opens it with its defaults and its permission; Vendor
 * Payments with its own permission. */

export type ApSettingsScope = 'invoices' | 'payments';

const ROLE_HELPER: Record<ApRole, string> = {
  'Accounting Manager': 'Approves invoices and payments, and sets module defaults.',
  'AP Clerk': 'Enters vendor invoices and records payments.',
  'General User': 'Read only.',
};

const RATE_DATE_OPTIONS: { value: RateDateBasis; helper: string }[] = [
  { value: 'invoiceDate', helper: 'The rate on the date printed on the vendor’s invoice.' },
  { value: 'receivingDate', helper: 'The rate on the date the goods were received. With several receivings, the Receiving Trigger setting picks the date.' },
  { value: 'poDate', helper: 'The rate on the purchase order’s date, the rate the PO was raised at.' },
];

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

function Radio({ selected }: { selected: boolean }) {
  return (
    <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selected ? 'border-primary bg-primary' : 'border-slate-300 bg-white'}`}>
      {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
    </span>
  );
}

/** A number field that keeps what's typed and commits a valid value on blur. */
function NumberField({
  value,
  onCommit,
  suffix,
  prefix,
  placeholder,
  ariaLabel,
  width = 'w-[88px]',
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
  ariaLabel: string;
  width?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => setText(value == null ? '' : String(value)), [value]);
  const commit = () => {
    const t = text.trim();
    if (t === '') return onCommit(null);
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) onCommit(Math.round(n * 100) / 100);
    else setText(value == null ? '' : String(value));
  };
  return (
    <span className={`relative inline-flex items-center ${width} shrink-0`}>
      {prefix && <span className="absolute left-2.5 text-[12px] text-slate-400 pointer-events-none">{prefix}</span>}
      <Input
        value={text}
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className={`h-8 rounded-lg text-[12.5px] tabular-nums ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-7' : ''}`}
      />
      {suffix && <span className="absolute right-2.5 text-[12px] text-slate-400 pointer-events-none">{suffix}</span>}
    </span>
  );
}

/** Which roles hold a permission: one chip per role, ticked when it may. */
function RoleChips({ value, onChange, label }: { value: ApRole[]; onChange: (next: ApRole[]) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {AP_ROLES.map((r) => {
        const on = value.includes(r);
        return (
          <button
            key={r}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onChange(on ? value.filter((x) => x !== r) : AP_ROLES.filter((x) => x === r || value.includes(x)))}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11.5px] transition-colors cursor-pointer ${
              on ? 'border-primary bg-primary/[0.06] text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            style={{ fontWeight: 500 }}
          >
            <span className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center ${on ? 'border-primary bg-primary' : 'border-slate-300 bg-white'}`}>
              {on && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </span>
            {r}
          </button>
        );
      })}
    </div>
  );
}

export function ApSettingsModal({ open, onOpenChange, scope }: { open: boolean; onOpenChange: (open: boolean) => void; scope: ApSettingsScope }) {
  const settings = useApSettings();
  if (!open) return null;
  const perms = apPermissionsFor(settings);
  const isInvoices = scope === 'invoices';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[240] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isInvoices ? 'Vendor Invoicing Settings' : 'Vendor Payments Settings'}
      >
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 500 }}>
                {isInvoices ? 'Vendor Invoicing Settings' : 'Vendor Payments Settings'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                {isInvoices
                  ? 'Module defaults for vendor invoices, and who can change an invoice’s exchange rate.'
                  : 'Who can change a payment’s exchange rate.'}
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
          {isInvoices && (
            <>
              {/* Module defaults: which date's rate a new invoice takes. */}
              <section>
                <SectionLabel icon={CalendarClock}>Module Defaults</SectionLabel>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>Rate Date for Vendor Invoices</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed" style={{ fontWeight: 400 }}>
                      Which date’s exchange rate a new vendor invoice uses. The invoice shows the date in its Rate as of field.
                    </p>
                  </div>
                  <div role="radiogroup" aria-label="Rate date for vendor invoices">
                    {RATE_DATE_OPTIONS.map((o) => {
                      const selected = settings.rateDateBasis === o.value;
                      return (
                        <button
                          key={o.value}
                          role="radio"
                          aria-checked={selected}
                          onClick={() => updateApSettings({ rateDateBasis: o.value })}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-t border-slate-100 transition-colors ${selected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                        >
                          <Radio selected={selected} />
                          <div className="min-w-0 flex-1">
                            <span className={`text-[12.5px] ${selected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                              {RATE_DATE_BASIS_LABEL[o.value]}
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>{o.helper}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[10.5px] text-slate-400 mt-2" style={{ fontWeight: 400 }}>
                  An invoice without receivings or a PO uses its vendor invoice date. Saved invoices keep their rate.
                </p>

                {/* Allowed difference: Vendor billed vs We're paying. */}
                <div className="rounded-xl border border-slate-200 px-4 py-3 mt-3">
                  <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>Allowed Difference</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed" style={{ fontWeight: 400 }}>
                    How far what you’re paying may be from what the vendor billed before the invoice needs review.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <label className="block">
                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Percentage of the Billed Amount</span>
                      <div className="mt-1">
                        <NumberField
                          value={settings.allowedDifferencePct}
                          onCommit={(v) => updateApSettings({ allowedDifferencePct: v ?? 0 })}
                          suffix="%"
                          ariaLabel="Allowed difference, percent of the billed amount"
                          width="w-full"
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Amount Cap, Base Currency</span>
                      <div className="mt-1">
                        <NumberField
                          value={settings.allowedDifferenceBase}
                          onCommit={(v) => updateApSettings({ allowedDifferenceBase: v })}
                          placeholder="No cap"
                          ariaLabel="Allowed difference, amount cap in the base currency"
                          width="w-full"
                        />
                      </div>
                    </label>
                  </div>
                  <p className="text-[10.5px] text-slate-400 mt-2" style={{ fontWeight: 400 }}>
                    Both apply when set: an invoice past either one needs review. Leave the cap blank for none.
                  </p>
                </div>
              </section>
            </>
          )}

          {/* Permissions: who may change an exchange rate. */}
          <section>
            <SectionLabel icon={ShieldCheck}>Permissions</SectionLabel>
            {isInvoices ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3">
                  <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>Change the Exchange Rate on an Invoice</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed" style={{ fontWeight: 400 }}>
                    Lets these roles type a rate other than the corporate rate in effect. Mid-market rates are always read-only.
                  </p>
                  <div className="mt-2.5">
                    <RoleChips
                      label="Roles that can change the exchange rate on an invoice"
                      value={settings.invoiceRateRoles}
                      onChange={(next) => updateApSettings({ invoiceRateRoles: next })}
                    />
                  </div>
                </div>
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>Limit</p>
                    <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                      {settings.invoiceRateLimitPct == null
                        ? 'Optional. No limit: any rate above zero can be entered.'
                        : 'How far a typed rate may be from the corporate rate, either way.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {settings.invoiceRateLimitPct != null && (
                      <NumberField
                        value={settings.invoiceRateLimitPct}
                        onCommit={(v) => updateApSettings({ invoiceRateLimitPct: v ?? 0 })}
                        prefix="±"
                        suffix="%"
                        ariaLabel="Limit, percent either side of the corporate rate"
                      />
                    )}
                    <Switch
                      checked={settings.invoiceRateLimitPct != null}
                      onCheckedChange={(on) => updateApSettings({ invoiceRateLimitPct: on ? 2 : null })}
                      aria-label="Limit the change"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="text-[12.5px] text-foreground" style={{ fontWeight: 500 }}>Change the Exchange Rate on a Payment</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed" style={{ fontWeight: 400 }}>
                  Lets these roles enter the rate the bank actually used, instead of the rate on the payment date.
                </p>
                <div className="mt-2.5">
                  <RoleChips
                    label="Roles that can change the exchange rate on a payment"
                    value={settings.paymentRateRoles}
                    onChange={(next) => updateApSettings({ paymentRateRoles: next })}
                  />
                </div>
              </div>
            )}
          </section>

          {/* The prototype's acting role, to walk the rate fields as each role. */}
          <section>
            <SectionLabel icon={UserCog}>Acting Role</SectionLabel>
            <div className="rounded-xl border border-slate-200 overflow-hidden" role="radiogroup" aria-label="Acting role">
              {AP_ROLES.map((r, i) => {
                const selected = settings.role === r;
                return (
                  <button
                    key={r}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updateApSettings({ role: r })}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i > 0 ? 'border-t border-slate-100' : ''} ${selected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <Radio selected={selected} />
                    <div className="min-w-0 flex-1">
                      <span className={`text-[12.5px] ${selected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>{r}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>{ROLE_HELPER[r]}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 mt-2">
              <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>As {settings.role} you can</p>
              <p className="text-[11.5px] text-slate-700 mt-1 leading-relaxed" style={{ fontWeight: 400 }}>
                {isInvoices
                  ? perms.canChangeInvoiceRate
                    ? perms.invoiceRateLimitPct != null
                      ? `change an invoice’s exchange rate, by up to ±${perms.invoiceRateLimitPct}%.`
                      : 'change an invoice’s exchange rate, with no limit.'
                    : 'use the rate in the rate table only. The rate field is read-only.'
                  : perms.canChangePaymentRate
                    ? 'change a payment’s exchange rate.'
                    : 'use the rate on the payment date only. The rate field is read-only.'}
              </p>
            </div>
            <p className="text-[10.5px] text-slate-400 mt-2" style={{ fontWeight: 400 }}>
              Prototype only, to try the rate fields as each role.
            </p>
          </section>
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
