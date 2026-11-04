import { Settings, X, Check, BookOpen, Hash, PackageCheck, FileDigit } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Switch } from '@/app/components/ui/switch';
import {
  useSystemSettings,
  updateSystemSettings,
  type RunIdFormat,
  type ReceivingDateBasis,
  formatDocumentNumber,
} from '@/app/hooks/useSystemSettings';

/* ── System settings (8/5/26 review) ──────────────────────────────────
 * Flat-chrome form modal (the PayFromAccountModal recipe). Two company
 * level switches for now: GL depth on confirmation steps, and the
 * payment run ID convention. IDs stay system generated and non-editable
 * everywhere; only the pattern is a setting. */

interface SystemSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// One ID format system-wide (10/29): prefix + six-digit sequence.
function sampleId(_format: RunIdFormat): string {
  return 'RUN-000001';
}

const ID_FORMATS: { value: RunIdFormat; label: string; helper: string }[] = [
  { value: 'iso', label: 'Sequential', helper: 'RUN and a six-digit number that counts up with every run.' },
];

const RECEIVING_BASES: { value: ReceivingDateBasis; label: string; helper: string }[] = [
  { value: 'latest', label: 'Latest Receiving', helper: 'The payment clock starts when the last linked receiving arrives.' },
  { value: 'earliest', label: 'Earliest Receiving', helper: 'The payment clock starts with the first linked receiving.' },
];

export function SystemSettingsModal({ open, onOpenChange }: SystemSettingsModalProps) {
  const settings = useSystemSettings();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[240] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 600 }}>
                System Settings
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                Company-level defaults. They apply to everyone using this workspace.
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
          {/* Confirmations */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>
                Confirmations
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12.5px] text-foreground" style={{ fontWeight: 600 }}>
                  Show GL Impact in Confirmation Steps
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed" style={{ fontWeight: 400 }}>
                  Debits and credits appear inside record-payment and prepayment confirmations.
                  Turn off for a simpler confirmation. The GL Impact tab on detail pages always stays.
                </p>
              </div>
              <Switch
                checked={settings.showGlOnConfirmations}
                onCheckedChange={(checked) => updateSystemSettings({ showGlOnConfirmations: checked })}
                className="mt-0.5"
              />
            </div>
          </section>

          {/* Receiving trigger — which receiving date starts the payment
              clock when an invoice spans multiple receivings and the
              vendor's term runs from receiving (8/25/26 meeting). */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <PackageCheck className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>
                Receiving Trigger
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {RECEIVING_BASES.map((b, i) => {
                const selected = settings.receivingDateBasis === b.value;
                return (
                  <button
                    key={b.value}
                    onClick={() => updateSystemSettings({ receivingDateBasis: b.value })}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    } ${selected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-[12.5px] ${selected ? 'text-primary' : 'text-foreground'}`}
                        style={{ fontWeight: 600 }}
                      >
                        {b.label}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                        {b.helper}
                      </p>
                    </div>
                    {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-slate-400 mt-2" style={{ fontWeight: 500 }}>
              Applies when an invoice spans multiple receivings and the vendor's payment term runs from receiving.
            </p>
          </section>

          {/* Document numbering (FAD 11/2): company-level, the number
              printed on customer invoices. */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FileDigit className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>
                Document Numbering
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12.5px] text-foreground" style={{ fontWeight: 600 }}>Customer Invoices</p>
                <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600" style={{ fontWeight: 600 }}>
                  {formatDocumentNumber(settings.customerInvoiceNumbering, settings.customerInvoiceNumbering.start)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                {([
                  ['Prefix', 'prefix'],
                  ['Digits', 'digits'],
                  ['Start Number', 'start'],
                ] as const).map(([label, key]) => (
                  <label key={key} className="block">
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{label}</span>
                    <Input
                      value={String(settings.customerInvoiceNumbering[key])}
                      inputMode={key === 'prefix' ? 'text' : 'numeric'}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const cur = settings.customerInvoiceNumbering;
                        const next =
                          key === 'prefix'
                            ? { ...cur, prefix: raw.toUpperCase().slice(0, 8) }
                            : key === 'digits'
                              ? { ...cur, digits: Math.min(10, Math.max(1, parseInt(raw.replace(/\D/g, ''), 10) || 1)) }
                              : { ...cur, start: Math.max(1, parseInt(raw.replace(/\D/g, ''), 10) || 1) };
                        updateSystemSettings({ customerInvoiceNumbering: next });
                      }}
                      className="mt-1 h-8 rounded-lg text-[12.5px]"
                    />
                  </label>
                ))}
              </div>
            </div>
            <p className="text-[10.5px] text-slate-400 mt-2" style={{ fontWeight: 500 }}>
              The number printed on customer invoices. New invoices pick up the format, existing invoices keep theirs.
            </p>
          </section>

          {/* Payment run IDs */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 tracking-wide" style={{ fontWeight: 600 }}>
                Payment Run IDs
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {ID_FORMATS.map((f, i) => {
                const selected = settings.runIdFormat === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => updateSystemSettings({ runIdFormat: f.value })}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    } ${selected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[12.5px] ${selected ? 'text-primary' : 'text-foreground'}`}
                          style={{ fontWeight: 600 }}
                        >
                          {f.label}
                        </span>
                        <span
                          className="text-[10.5px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                          style={{ fontWeight: 600 }}
                        >
                          {sampleId(f.value)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                        {f.helper}
                      </p>
                    </div>
                    {selected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-slate-400 mt-2" style={{ fontWeight: 500 }}>
              IDs are system generated and cannot be edited. New runs pick up the format, existing runs keep theirs.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            className="inline-flex items-center justify-center h-8 rounded-md px-4 text-[12px] border border-slate-200 cursor-pointer transition-colors"
            style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
