import { useState, useEffect } from 'react';
import { AlertTriangle, Ban, Check, ChevronDown, Lock, Paperclip, Upload, X, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { SearchableUserPicker } from '@/app/components/vendors/SearchableUserPicker';

export type ReasonAction = 'reject' | 'cancel' | 'paymentHold' | 'flagException';

/** One action's full recipe — exported so other record types (payment
 *  runs, 8/4/26) can reuse the dialog AS IS with their own copy. */
export interface ReasonActionConfig {
  targetLabel: string;
  title: string;
  description: string;
  actionText: string;
  bg: string;
  solid: string;
  reasons: string[];
  /** What the free-text box asks for. A cancellation has no reviewers, so the
   *  approval flow's "so reviewers can act on it" was asking the wrong
   *  question of whoever is calling a return off. */
  notePlaceholder?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  notify?: { label: string; accentColor: string; accentBg: string; accentBorder: string; accentText: string };
}

interface InvoiceReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ReasonAction | null;
  /** Number of invoices the action applies to (bulk or single). */
  count: number;
  /** The affected invoices — when more than one, the dialog lists them so
   *  a bulk action always shows exactly what it touches (review 7/9/26). */
  targets?: { invoiceNumber: string; vendor: string; amount: number }[];
  /** Recipient ids ride along so the action history remembers who was
   *  notified — resolve flows offer the same list (feedback 7/20/26). */
  onConfirm: (reason: string, notifiedRecipientIds?: string[]) => void;
  /** Current status, for the "Keep as {status}" escape CTA. */
  currentStatus?: string;
  /** Reversing journal lines shown when cancelling a POSTED invoice —
   *  the cancellation backs the original posting out of the GL
   *  (feedback 7/21/26). Omit for unposted invoices / bulk actions. */
  glReversal?: { code: string; name: string; debit: number; credit: number }[];
  /** Copy/logic overrides merged over the action's config, so payment
   *  runs reuse the exact same dialog (8/4/26) with run wording, run
   *  reasons, and (for cancel) the notify block the invoice flavor
   *  doesn't carry. */
  configOverride?: Partial<ReasonActionConfig>;
}

/* Reason-required state changes share one modal, in the same gradient
 * design language as the status-change confirm dialog (restored 7/15/26):
 * glow hero with centered icon tile + uppercase target pill, centered
 * title and copy, one stacked form column, full-width stacked CTAs.
 * Payment Hold and Exception additionally carry the creation form's
 * Notify recipients and Supporting Documents blocks (attachments last)
 * so flagging from the detail page is as capable as at creation. */
const OTHER = 'Other';

// Icon-chip + CTA palette per action — keyed to the action menu's tone
// colors (actionMenuTone.ts): warning actions amber, destructive rose.
// Notify blocks (creation-form recipe) ride hold, exception, and reject.
const ACTION_CONFIG: Record<ReasonAction, ReasonActionConfig> = {
  reject: {
    // Pill wears the ACTION, not the resulting status — the modal is a
    // confirmation, nothing has been rejected yet (feedback 7/15/26).
    targetLabel: 'Reject',
    title: 'Reject this invoice?',
    description: 'The invoice leaves the approval queue and moves to Rejected. It stays there until someone resolves the issue.',
    actionText: 'Reject invoice',
    // Discard-modal red: #FEE2E2 tile + destructive token.
    bg: '#FEE2E2',
    solid: 'hsl(var(--destructive))',
    reasons: [
      'Duplicate invoice',
      'Incorrect amount',
      'Wrong vendor or PO',
      'Missing documentation',
      OTHER,
    ],
    icon: Ban,
    // Rejection notifies people too (meeting feedback 7/17/26): the
    // creator by default, plus anyone added here.
    notify: { label: 'Notify On Rejection', accentColor: 'hsl(var(--destructive))', accentBg: '#FEF2F2', accentBorder: '#FECACA', accentText: '#B91C1C' },
  },
  cancel: {
    targetLabel: 'Cancel',
    title: 'Cancel this invoice?',
    description: 'Once an invoice has been cancelled, it cannot be reversed.',
    actionText: 'Cancel invoice',
    // Discard-modal red: #FEE2E2 tile + destructive token.
    bg: '#FEE2E2',
    solid: 'hsl(var(--destructive))',
    reasons: [
      'Created in error',
      'Duplicate invoice',
      'Order was cancelled',
      OTHER,
    ],
    icon: XCircle,
  },
  paymentHold: {
    targetLabel: 'Payment Hold',
    title: 'Place on payment hold?',
    description: 'The invoice stays posted to the GL but payment runs skip it until the hold is released. The reason you mention here will be recorded.',
    actionText: 'Place on Hold',
    // Listing status colors — On Hold yellow (STATUS_PALETTE), 7/15/26.
    bg: '#FEFCE8',
    solid: '#A16207',
    reasons: [
      'Vendor dispute in progress',
      'Waiting on missing documents',
      'Price or quantity mismatch',
      'Cash flow timing',
      OTHER,
    ],
    icon: Lock,
    // Notify accents follow the modal's status tone (yellow, 7/15/26).
    notify: { label: 'Notify On Hold', accentColor: '#A16207', accentBg: '#FEFCE8', accentBorder: '#FEF08A', accentText: '#A16207' },
  },
  flagException: {
    targetLabel: 'Exception',
    title: 'Flag as an exception?',
    description: 'The invoice stays out of the approval queue until someone resolves the flagged issue.',
    actionText: 'Flag as Exception',
    // Exception wears yellow everywhere (menu, modal, creation form) —
    // red reads too destructive for a fixable flag (feedback 7/15/26).
    bg: '#FFFBEB',
    solid: '#D97706',
    // Mirrors EXCEPTION_TYPE_OPTIONS in the creation flow.
    reasons: [
      'Price Discrepancy',
      'Quantity Mismatch',
      'Damaged Goods',
      'Duplicate Invoice',
      'Incorrect Vendor',
      OTHER,
    ],
    icon: AlertTriangle,
    // Notify accents follow the modal's yellow tone (7/15/26).
    notify: { label: 'Notify On Exception', accentColor: '#D97706', accentBg: '#FFFBEB', accentBorder: '#FDE68A', accentText: '#B45309' },
  },
};

export function InvoiceReasonDialog({
  open,
  onOpenChange,
  action,
  count,
  targets,
  onConfirm,
  currentStatus,
  glReversal,
  configOverride,
}: InvoiceReasonDialogProps) {
  const [category, setCategory] = useState<string | null>(null);
  // Exception reasons are multi-select — an invoice can carry several at
  // once, mirroring the creation form's Type picker (feedback 7/15/26).
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<{ name: string }[]>([]);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());

  // Reset whenever the dialog is reopened for a new action
  useEffect(() => {
    if (open) {
      setCategory(null);
      setCategories([]);
      setDescription('');
      setAttachments([]);
      setRecipients(new Set());
    }
  }, [open, action]);

  if (!action) return null;

  const config: ReasonActionConfig = { ...ACTION_CONFIG[action], ...configOverride };
  const Icon = config.icon;
  const lightTint = `color-mix(in srgb, ${config.bg} 50%, white)`;
  const isException = action === 'flagException';
  const hasSelection = isException ? categories.length > 0 : !!category;
  const isOther = isException ? categories.includes(OTHER) : category === OTHER;
  const trimmedDesc = description.trim();
  // Other requires the user to say what the reason actually is.
  const disabled = !hasSelection || (isOther && trimmedDesc.length === 0);

  const reasonLabel = isException
    ? categories.filter((c) => c !== OTHER).join(', ')
    : category === OTHER ? '' : category ?? '';
  const composedReason = reasonLabel
    ? trimmedDesc ? `${reasonLabel}: ${trimmedDesc}` : reasonLabel
    : trimmedDesc;

  const countSuffix = count > 1 ? ` (${count} invoices)` : '';
  const fileInputId = `reason-dialog-upload-${action}`;
  // Hold + Exception carry the creation-form extras (documents + notify),
  // which don't fit a narrow stack without scrolling — they get the wide
  // two-column layout with a summary rail. Reject / Cancel stay narrow
  // (reason + description only) with a compacted hero (feedback 7/14/26).
  const hasRail = Boolean(config.notify);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        // No internal scroll (feedback 7/20/26): instead of capping the
        // height, the modal runs wider so the hero copy wraps to two
        // lines, and the vertical rhythm is tightened until the tallest
        // variant (hold/exception with notify + documents) fits whole.
        className={`p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] ${
          hasRail ? 'sm:max-w-[560px]' : 'sm:max-w-[440px]'
        }`}
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
      >
        {/* Colored glow hero — gradient confirm-modal recipe (restored
            7/15/26): centered icon tile + uppercase target pill. */}
        <div
          className="relative flex flex-col items-center pt-6 pb-4 shrink-0"
          style={{
            background: `linear-gradient(180deg, ${lightTint} 0%, color-mix(in srgb, ${lightTint} 30%, transparent) 70%, transparent 100%)`,
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none"
            style={{ backgroundColor: config.solid, filter: 'blur(50px)' }}
          />
          <div
            className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: config.bg }}
          >
            <Icon className="w-7 h-7" style={{ color: config.solid, strokeWidth: 2 }} />
          </div>
          <span
            className="mt-2.5 px-3 py-1 rounded-full text-[11px]"
            style={{
              fontWeight: 600,
              backgroundColor: lightTint,
              color: config.solid,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {config.targetLabel}
          </span>
        </div>

        {/* Title + copy */}
        <div className="flex flex-col items-center text-center px-6 shrink-0">
          <AlertDialogTitle
            className="text-[20px] tracking-[-0.02em] text-foreground"
            style={{ fontWeight: 600, lineHeight: 1.3 }}
          >
            {config.title.replace('?', `${countSuffix}?`)}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-[13px] mt-1.5 mx-auto text-muted-foreground"
            style={{ lineHeight: 1.6, maxWidth: '440px' }}
          >
            {config.description}
          </AlertDialogDescription>
        </div>

        {/* Body — one stacked column for every action; hold and exception
            simply carry two extra blocks (notify + documents) below the
            reason fields. */}
        <div className="px-5 sm:px-6 pt-3.5 space-y-3 text-left">
          {/* Bulk summary — a bulk action always lists exactly which
              invoices it affects (design review 7/9/26). */}
          {targets && targets.length > 1 && (
            <div className="rounded-lg border border-border divide-y divide-border/70 max-h-[132px] overflow-y-auto">
              {targets.map((t) => (
                <div key={t.invoiceNumber} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px]">
                  <span className="tabular-nums" style={{ fontWeight: 600 }}>{t.invoiceNumber}</span>
                  <span className="text-slate-500 truncate flex-1">{t.vendor}</span>
                  <span className="tabular-nums text-slate-700 shrink-0" style={{ fontWeight: 600 }}>
                    ${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
              Reason
              <span style={{ color: '#DC2626' }}>*</span>
            </Label>
            {isException ? (
              /* Multi-select — same Popover + Checkbox picker as the
                 creation form's Exception Type field (7/15/26). */
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-white px-3 text-[12px] shadow-none transition-colors cursor-pointer ${
                      categories.length ? 'border-slate-300 text-foreground' : 'border-slate-200 text-slate-400'
                    } hover:border-slate-300 focus:ring-1 focus:ring-primary/20 focus:border-primary`}
                  >
                    {/* Fixed-width field — overflow collapses into a "+X
                        more" counter (partner Freight & Logistics pattern)
                        so the modal never stretches. */}
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">
                        {categories.length ? categories.slice(0, 2).join(', ') : 'Select reasons…'}
                      </span>
                      {categories.length > 2 && (
                        <span className="shrink-0 px-1.5 py-px rounded-full bg-slate-100 text-slate-600 text-[10px]" style={{ fontWeight: 600 }}>
                          +{categories.length - 2} more
                        </span>
                      )}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-1 z-[400]">
                  {config.reasons.map((r) => {
                    const checked = categories.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() =>
                          setCategories((prev) =>
                            prev.includes(r) ? prev.filter((v) => v !== r) : [...prev, r],
                          )
                        }
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
                      >
                        <Checkbox checked={checked} className="pointer-events-none" />
                        <span className="text-[12px] text-foreground">{r}</span>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-[12px] shadow-none transition-colors cursor-pointer ${
                      category ? 'border-slate-300 text-foreground' : 'border-slate-200 text-slate-400'
                    } hover:border-slate-300 focus:ring-1 focus:ring-primary/20 focus:border-primary`}
                  >
                    <span className="truncate">{category ?? 'Select a reason…'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] z-[400]">
                  {config.reasons.map((r) => (
                    <DropdownMenuItem key={r} onClick={() => setCategory(r)} className="text-[12px]">
                      <span className="flex-1">{r}</span>
                      {category === r && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
              Description
              {isOther && <span style={{ color: '#DC2626' }}>*</span>}
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isOther
                  ? 'Tell the vendor and your team why…'
                  : (config.notePlaceholder ?? 'Describe the issue so reviewers can act on it…')
              }
              rows={2}
              className="w-full min-h-[52px] text-[11px] rounded-md border border-slate-200 bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-[11px] placeholder:text-slate-400 resize-none"
            />
          </div>

        {/* GL reversal preview (feedback 7/21/26): cancelling a POSTED
            invoice backs the original posting out of the ledger, so the
            confirm shows the reversing entry it will create. */}
        {glReversal && glReversal.length > 0 && (
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              GL impact, posting reversed
            </Label>
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50/70 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>Account</th>
                    <th className="text-right px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>Debit</th>
                    <th className="text-right px-2.5 py-1 text-[9px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {glReversal.map((l) => (
                    <tr key={`${l.code}-${l.debit > 0 ? 'dr' : 'cr'}`} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-2.5 py-1 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-slate-500 tabular-nums" style={{ fontWeight: 500 }}>{l.code}</span>
                        <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{l.name}</span>
                      </td>
                      <td className="px-2.5 py-1 text-right tabular-nums">
                        {l.debit > 0 ? <span style={{ fontWeight: 600 }}>${l.debit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> : <span className="text-slate-300">, </span>}
                      </td>
                      <td className="px-2.5 py-1 text-right tabular-nums">
                        {l.credit > 0 ? <span style={{ fontWeight: 600 }}>${l.credit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> : <span className="text-slate-300">, </span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400">
              The invoice was posted to the general ledger. Cancelling posts this reversing entry so your books back the invoice out.
            </p>
          </div>
        )}

        {/* Notify + supporting documents (hold and exception carry the
            same capabilities as the creation form). Order: notify above,
            attachments always the last block of the modal. */}
        {config.notify && (
          <>
              <div className="pt-0.5">
                <SearchableUserPicker
                  selectedIds={recipients}
                  onSelectionChange={setRecipients}
                  accentColor={config.notify.accentColor}
                  accentBg={config.notify.accentBg}
                  accentBorder={config.notify.accentBorder}
                  accentText={config.notify.accentText}
                  label={config.notify.label}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  Supporting Documents
                </Label>
                <input
                  type="file"
                  id={fileInputId}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAttachments((prev) => [...prev, { name: file.name }]);
                    }
                    e.target.value = '';
                  }}
                />
                {/* Partner-style drop zone: centered upload tile + helper
                    copy, link + hover tint in the modal's tone. */}
                <button
                  type="button"
                  onClick={() => document.getElementById(fileInputId)?.click()}
                  className="w-full flex flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 transition-colors cursor-pointer"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = lightTint;
                    e.currentTarget.style.borderColor = `color-mix(in srgb, ${config.solid} 35%, white)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = '';
                  }}
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: config.bg }}>
                    <Upload className="w-4 h-4" style={{ color: config.solid }} />
                  </span>
                  <span className="text-[11px] text-slate-600 mt-0.5" style={{ fontWeight: 500 }}>
                    <span style={{ color: config.solid, fontWeight: 600 }}>Click to upload</span> or drag and drop
                  </span>
                  <span className="text-[10px] text-slate-400">PDF, DOC, XLS, PNG, JPG up to 10MB</span>
                </button>
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                        <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                        <span className="truncate max-w-[140px]">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
          </>
        )}
        </div>

        {/* Footer — gradient confirm-modal recipe: stacked full-width
            CTAs, solid action on top, soft escape below. */}
        <div className="px-5 sm:px-6 pt-3.5 pb-5 flex flex-col gap-2 shrink-0">
          <AlertDialogAction
            disabled={disabled}
            onClick={(e) => {
              if (disabled) {
                e.preventDefault();
                return;
              }
              onConfirm(composedReason, recipients.size > 0 ? Array.from(recipients) : undefined);
            }}
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ fontWeight: 600, backgroundColor: config.solid, color: '#fff' }}
          >
            {config.actionText}
          </AlertDialogAction>
          <AlertDialogCancel
            className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors mt-0"
            style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
          >
            {currentStatus ? `Keep as ${currentStatus}` : 'Go back'}
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
