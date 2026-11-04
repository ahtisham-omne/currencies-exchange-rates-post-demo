import { BulkInvoiceList } from '@/app/components/BulkInvoiceList';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Archive, ArchiveRestore, Ban, Check, ChevronDown, Lock, Paperclip, Upload, X, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { DiscardConfirm } from '@/app/components/ui/discard-guard';
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
import { exceptionOptionsFor, invoiceReasonKindOf, type InvoiceReasonKind } from '@/app/components/SubmittedFlagCard';
import { HOLD_REASON_TYPES } from '@/app/data/holdReasons';
import { NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { formatMoney } from '@/app/currency/money';

export type ReasonAction = 'reject' | 'cancel' | 'uncancel' | 'paymentHold' | 'flagException' | 'archive' | 'restore';

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
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  notify?: { label: string; helper?: string; accentColor: string; accentBg: string; accentBorder: string; accentText: string };
  /** Per-action description placeholder (user 10/4) — a question in the
   *  action's own voice instead of one generic prompt. */
  descriptionPlaceholder?: string;
  /** Secondary CTA label (user 10/4): "Go back" for the flag actions,
   *  "Keep invoice" for the destructive ones. Overrides "Keep as
   *  {status}" when set. */
  secondaryText?: string;
  /** What a bulk count names (user 10/22/26): "invoice" by default,
   *  "payment" for the payment void flavor. */
  countNoun?: string;
  /** Where the bulk list's item numbers link (default '/invoices/'). */
  listHrefBase?: string;
}

interface InvoiceReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ReasonAction | null;
  /** Number of invoices the action applies to (bulk or single). */
  count: number;
  /** The affected invoices — when more than one, the dialog lists them so
   *  a bulk action always shows exactly what it touches (review 7/9/26). */
  targets?: { invoiceNumber: string; vendor: string; amount: number; type?: string }[];
  /** Recipient ids ride along so the action history remembers who was
   *  notified — resolve flows offer the same list (feedback 7/20/26). */
  onConfirm: (reason: string, notifiedRecipientIds?: string[]) => void;
  /** Current status, for the "Keep as {status}" escape CTA. */
  currentStatus?: string;
  /** Invoice type (Pre-Invoice / Standalone / PO-based / Receiving-based /
   *  GRN-based), used to GATE cancel/archive reasons to what can actually
   *  be true for this invoice's state (Eli 10/5). Omitted for bulk/run
   *  flows, which show every reason. */
  invoiceType?: string;
  /** Reversing journal lines shown when cancelling a POSTED invoice —
   *  the cancellation backs the original posting out of the GL
   *  (feedback 7/21/26). Omit for unposted invoices / bulk actions. */
  glReversal?: { code: string; name: string; debit: number; credit: number }[];
  /** The currency the reversal lines are in (Currency & Exchange Rates: a
   *  vendor invoice's GL is in the base currency). Defaults to USD. */
  glCurrency?: string;
  /** Copy/logic overrides merged over the action's config, so payment
   *  runs reuse the exact same dialog (8/4/26) with run wording, run
   *  reasons, and (for cancel) the notify block the invoice flavor
   *  doesn't carry. */
  configOverride?: Partial<ReasonActionConfig>;
  /** Selected invoices the bulk action can't touch (Mahreen 10/10): the
   *  popup says how many are skipped and why, like bulk approve. */
  skipped?: { invoiceNumber: string }[];
  skipReason?: string;
}

/* Reason-required state changes share one modal, in the same gradient
 * design language as the status-change confirm dialog (restored 7/15/26):
 * glow hero with centered icon tile + target pill, centered
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
    actionText: 'Reject Invoice',
    // Discard-modal red: #FEE2E2 tile + destructive token.
    bg: '#FEE2E2',
    solid: 'hsl(var(--destructive))',
    reasons: [
      'Duplicate Invoice',
      'Incorrect Amount',
      'Wrong Vendor or PO',
      'Missing Documentation',
      OTHER,
    ],
    icon: Ban,
    // Rejection notifies people too (meeting feedback 7/17/26): the
    // creator by default, plus anyone added here.
    notify: { label: 'Notify People', helper: "They'll be told this invoice was rejected.", accentColor: 'hsl(var(--destructive))', accentBg: '#FEF2F2', accentBorder: '#FECACA', accentText: '#B91C1C' },
  },
  cancel: {
    targetLabel: 'Cancel',
    title: 'Cancel this invoice?',
    // 10/4 copy table: short, and honest about reversibility — a
    // cancelled posted invoice CAN be reversed back (the lifecycle
    // supports it), so the old "cannot be reversed" line is gone.
    description: "It won't be approved or paid. You can reverse this later.",
    actionText: 'Cancel Invoice',
    // Discard-modal red: #FEE2E2 tile + destructive token.
    bg: '#FEE2E2',
    solid: 'hsl(var(--destructive))',
    reasons: [
      'Created in Error',
      'Duplicate Invoice',
      'Order Was Cancelled',
      OTHER,
    ],
    icon: XCircle,
    // Full capture recipe (user 9/9): cancel joins the family — the
    // notify config alone buys the 680px width, the Description ∥
    // Supporting-documents pair and the closing notify card.
    notify: { label: 'Notify People', helper: "They'll be told this invoice was cancelled.", accentColor: 'hsl(var(--destructive))', accentBg: '#FEF2F2', accentBorder: '#FECACA', accentText: '#B91C1C' },
    descriptionPlaceholder: 'Why is this invoice being cancelled?',
    secondaryText: 'Keep Invoice',
  },
  paymentHold: {
    targetLabel: 'Payment Hold',
    title: 'Put this invoice on hold?',
    description: "It can't be paid until the hold is released. Approval and posting aren't affected.",
    actionText: 'Place on Hold',
    // Listing status colors — On Hold yellow (STATUS_PALETTE), 7/15/26.
    bg: '#FEFCE8',
    solid: '#A16207',
    // Hold reasons (user 10/9).
    reasons: [...HOLD_REASON_TYPES, OTHER],
    icon: Lock,
    // Notify accents follow the modal's status tone (yellow, 7/15/26).
    notify: { label: 'Notify People', helper: "They'll be told it's on hold, and again when it's released.", accentColor: '#A16207', accentBg: '#FEFCE8', accentBorder: '#FEF08A', accentText: '#A16207' },
    descriptionPlaceholder: "What's holding this up?",
    secondaryText: 'Go Back',
  },
  flagException: {
    // "Exception", not "Exception" (Nophil 9/22): an exception is something
    // ALLOWED to break a rule; this raises an exception against the invoice.
    // The internal action key stays flagException.
    targetLabel: 'Exception',
    title: 'Flag as exception?',
    description: "The invoice can't be approved or posted until the exception is resolved.",
    actionText: 'Flag as Exception',
    // Exception wears yellow everywhere (menu, modal, creation form) —
    // red reads too destructive for a fixable flag (feedback 7/15/26).
    bg: '#FFFBEB',
    solid: '#D97706',
    // Fallback only: the real list is per invoice kind (user 10/9), from
    // exceptionOptionsFor, the same source the creation flow reads.
    reasons: exceptionOptionsFor(['inventory', 'pre', 'standalone']).map((o) => o.label),
    icon: AlertTriangle,
    // Notify accents follow the modal's yellow tone (7/15/26).
    notify: { label: 'Notify People', helper: "They'll be told an exception was flagged.", accentColor: '#D97706', accentBg: '#FFFBEB', accentBorder: '#FDE68A', accentText: '#B45309' },
    descriptionPlaceholder: "What's wrong with this invoice?",
    secondaryText: 'Go Back',
  },
  archive: {
    // Archiving is a SOFT DELETE, not a status change (user 10/1): the
    // copy says so, and the modal wears the Archive CTA's red with the
    // standard notify block instead of the status-confirm chrome.
    targetLabel: 'Archive',
    title: 'Archive this invoice?',
    description: "It's removed from your invoice lists but keeps its full history. You can restore it anytime.",
    actionText: 'Archive Invoice',
    bg: '#FEE2E2',
    solid: 'hsl(var(--destructive))',
    reasons: [
      'Fully Processed',
      'Created in Error',
      'Duplicate Record',
      'No Longer Needed',
      OTHER,
    ],
    icon: Archive,
    notify: { label: 'Notify People', helper: "They'll be told this invoice was archived.", accentColor: 'hsl(var(--destructive))', accentBg: '#FEF2F2', accentBorder: '#FECACA', accentText: '#B91C1C' },
    descriptionPlaceholder: 'Why is this invoice being archived?',
    secondaryText: 'Keep Invoice',
  },
  restore: {
    // Restoring an archived invoice (user 10/1): same reason-required
    // recipe as reject, in the Restore CTA's primary blue. The invoice
    // returns to the state it was archived from (user 10/9).
    targetLabel: 'Restore',
    title: 'Restore this invoice?',
    // Only cancelled invoices archive, so restore always lands on
    // Cancelled (Mahreen 10/10 copy).
    description: 'The invoice comes out of the archive and goes back to Cancelled.',
    actionText: 'Restore Invoice',
    bg: '#DBEAFE',
    solid: 'hsl(var(--primary))',
    reasons: [
      // Restore reasons (user 10/9).
      'Archived in Error',
      'Needed for Audit',
      'Needed to Match a Vendor Statement',
      OTHER,
    ],
    icon: ArchiveRestore,
    notify: { label: 'Notify People', helper: "They'll be told this invoice was restored to Cancelled.", accentColor: 'hsl(var(--primary))', accentBg: '#EFF6FF', accentBorder: '#BFDBFE', accentText: '#1D4ED8' },
    secondaryText: 'Keep as Archived',
  },
  uncancel: {
    // Reversing a cancellation (user 10/5): returns the invoice to the
    // exact state it held before cancel. Primary-blue recovery chrome,
    // same reason-required recipe as restore.
    targetLabel: 'Uncancel',
    title: 'Uncancel this invoice?',
    // Always back to Pending Approval (Mahreen 10/10).
    description: 'The invoice goes back to Pending Approval and needs to be approved again.',
    actionText: 'Uncancel Invoice',
    bg: '#DBEAFE',
    solid: 'hsl(var(--primary))',
    reasons: [
      // Uncancel reasons (user 10/9).
      'Cancelled by Mistake',
      'Payment Still Due',
      'Order Restarted',
      OTHER,
    ],
    icon: ArchiveRestore,
    notify: { label: 'Notify People', helper: "They'll be told this invoice is no longer cancelled.", accentColor: 'hsl(var(--primary))', accentBg: '#EFF6FF', accentBorder: '#BFDBFE', accentText: '#1D4ED8' },
    secondaryText: 'Keep Cancelled',
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
  invoiceType,
  glReversal,
  glCurrency = 'USD',
  configOverride,
  skipped = [],
  skipReason,
}: InvoiceReasonDialogProps) {
  const [category, setCategory] = useState<string | null>(null);
  // Exception reasons are multi-select — an invoice can carry several at
  // once, mirroring the creation form's Type picker (feedback 7/15/26).
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<{ name: string }[]>([]);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  // Notify card toggle (user 9/9, one notify interaction system-wide):
  // on by default, the picker only shows while on, and submitting with
  // it off sends no recipients.
  const [notifyOn, setNotifyOn] = useState(true);
  // Outside-click standard (user 9/22): pristine → outside click closes
  // silently; anything selected or typed → a discard warning intercepts.
  const [discardOpen, setDiscardOpen] = useState(false);
  // Never block the CTA (user 9/23): clicking with missing input
  // highlights the field instead of a disabled button.
  const [reasonError, setReasonError] = useState(false);
  const [descError, setDescError] = useState(false);

  // Reset whenever the dialog is reopened for a new action
  useEffect(() => {
    if (open) {
      setCategory(null);
      setCategories([]);
      setDescription('');
      setAttachments([]);
      setRecipients(new Set());
      setNotifyOn(true);
      setDiscardOpen(false);
      setReasonError(false);
      setDescError(false);
    }
  }, [open, action]);

  if (!action) return null;

  // A pre-invoice posts nothing until it is paid (Mahreen 10/10), so its
  // hold and exception copy never mentions posting.
  const preInvoiceCopy: Partial<ReasonActionConfig> =
    invoiceType === 'Pre-Invoice' && action === 'paymentHold'
      ? { description: 'It cannot be paid until the hold is released. Approval is not affected.' }
      : invoiceType === 'Pre-Invoice' && action === 'flagException'
        ? { description: 'The pre-invoice cannot be approved or paid until the exception is resolved.' }
        : {};
  const config: ReasonActionConfig = { ...ACTION_CONFIG[action], ...preInvoiceCopy, ...configOverride };
  // State-gated reasons (Eli 10/5, flagged for Mahreen's review): only
  // offer a reason that can actually be TRUE for this invoice's state —
  // no "Duplicate invoice" once goods are received against a matched
  // inventory invoice, no "Order was cancelled" once a receiving exists,
  // no "Fully Processed" archive on an invoice that isn't paid/closed.
  // No invoiceType (bulk / payment-run flows) ⇒ every reason stays.
  // Per-kind reason lists (user 10/9): exception reasons differ for
  // inventory, pre-invoice and standalone invoices; inventory invoices get
  // their own cancel reasons. A bulk selection unions its kinds.
  const kinds: InvoiceReasonKind[] | null = invoiceType
    ? [invoiceReasonKindOf(invoiceType)]
    : targets && targets.some((t) => t.type)
      ? Array.from(new Set(targets.map((t) => invoiceReasonKindOf(t.type))))
      : null;
  const CANCEL_REASONS_BY_KIND: Record<InvoiceReasonKind, string[]> = {
    inventory: ['Created in Error', 'Wrong Purchase Order or Receiving', 'Goods Returned to Vendor'],
    pre: ['Created in Error', 'Prepayment No Longer Required', 'Order Was Cancelled'],
    standalone: ['Created in Error', 'Wrong Vendor Selected', 'Service Was Cancelled'],
  };
  const gatedReasons: string[] = (() => {
    if (kinds && !configOverride?.reasons) {
      if (action === 'flagException') return exceptionOptionsFor(kinds).map((o) => o.label);
      if (action === 'cancel') {
        // Per-kind cancel reasons (user 10/9); a bulk selection unions them, Other last.
        return [...Array.from(new Set(kinds.flatMap((k) => CANCEL_REASONS_BY_KIND[k]))), OTHER];
      }
    }
    if (!invoiceType) return config.reasons;
    if (action === 'archive') {
      return config.reasons.filter((r) => (r === 'Fully Processed' ? currentStatus === 'Paid' : true));
    }
    return config.reasons;
  })();
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

  const noun = config.countNoun ?? 'invoice';
  const countSuffix = count > 1 ? ` (${count} ${noun}s)` : '';
  // Bulk copy counts the invoices (Mahreen 10/10): "Reject 3 invoices?"
  // and a "Reject 3 invoices" button, wherever the verb names an invoice.
  const verbNoun = new RegExp(` ${noun}$`, 'i');
  const countsInVerb = count > 1 && verbNoun.test(config.actionText);
  const bulkVerb = countsInVerb ? config.actionText.replace(verbNoun, (m) => ` ${count}${m}s`) : config.actionText;
  const fileInputId = `reason-dialog-upload-${action}`;
  // Anything the user selected, typed, or attached makes the form dirty —
  // notify recipients count too; the default-on toggle alone does not.
  const dirty =
    hasSelection || trimmedDesc.length > 0 || attachments.length > 0 || recipients.size > 0;
  // Hold + Exception carry the creation-form extras (documents + notify),
  // which don't fit a narrow stack without scrolling — they get the wide
  // two-column layout with a summary rail. Reject / Cancel stay narrow
  // (reason + description only) with a compacted hero (feedback 7/14/26).
  const hasRail = Boolean(config.notify);
  // Bulk runs compact (user 10/9): smaller hero, side-by-side CTAs, so the
  // invoice list and the form fit short screens without the modal growing.
  const isBulk = !!targets && targets.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // No internal scroll (feedback 7/20/26): instead of capping the
        // height, the modal runs wider so the hero copy wraps to two
        // lines, and the vertical rhythm is tightened until the tallest
        // variant (hold/exception with notify + documents) fits whole.
        // One flow-modal width (user 9/9): every capture modal that
        // carries the Description ∥ Documents pair matches the payment
        // reversal's 680px; the slim variants (cancel) stay compact.
        // Pinned-footer recipe (Eli 9/23: no modal requires scrolling to
        // reach its CTAs on a small screen) — the body scrolls alone.
        className={`p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] flex flex-col max-h-[calc(100dvh-2rem)] ${
          hasRail ? 'sm:max-w-[680px]' : 'sm:max-w-[440px]'
        }`}
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        showCloseButton={false}
        // Outside-click standard (user 9/22): a pristine modal closes on
        // outside click; a dirty one raises the discard warning instead.
        onInteractOutside={(e) => {
          if (dirty) {
            e.preventDefault();
            setDiscardOpen(true);
          }
        }}
        onEscapeKeyDown={(e) => {
          if (dirty) {
            e.preventDefault();
            setDiscardOpen(true);
          }
        }}
      >
        {/* Colored glow hero — gradient confirm-modal recipe (restored
            7/15/26): centered icon tile + target pill. */}
        <div
          className={`relative flex flex-col items-center shrink-0 ${isBulk ? 'pt-4 pb-2' : 'pt-6 pb-4'}`}
          style={{
            background: `linear-gradient(180deg, ${lightTint} 0%, color-mix(in srgb, ${lightTint} 30%, transparent) 70%, transparent 100%)`,
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none"
            style={{ backgroundColor: config.solid, filter: 'blur(50px)' }}
          />
          <div
            className={`relative rounded-2xl flex items-center justify-center ${isBulk ? 'w-11 h-11' : 'w-[56px] h-[56px]'}`}
            style={{ backgroundColor: config.bg }}
          >
            <Icon className={isBulk ? 'w-5 h-5' : 'w-7 h-7'} style={{ color: config.solid, strokeWidth: 2 }} />
          </div>
          <span
            className={`${isBulk ? 'mt-2' : 'mt-2.5'} px-3 py-1 rounded-full text-[11px]`}
            style={{
              fontWeight: 600,
              backgroundColor: lightTint,
              color: config.solid,
            }}
          >
            {config.targetLabel}
          </span>
        </div>

        {/* Title + copy */}
        <div className="flex flex-col items-center text-center px-6 shrink-0">
          <DialogTitle
            className={`${isBulk ? 'text-[18px]' : 'text-[20px]'} tracking-[-0.02em] text-foreground`}
            style={{ fontWeight: 600, lineHeight: 1.3 }}
          >
            {countsInVerb ? `${bulkVerb}?` : config.title.replace('?', `${countSuffix}?`)}
          </DialogTitle>
          <DialogDescription
            className={`text-[13px] mx-auto text-muted-foreground ${isBulk ? 'mt-1' : 'mt-1.5'}`}
            style={{ lineHeight: isBulk ? 1.45 : 1.6, maxWidth: '440px' }}
          >
            {config.description}
          </DialogDescription>
        </div>

        {/* Body — one stacked column for every action; hold and exception
            simply carry two extra blocks (notify + documents) below the
            reason fields. */}
        <div className={`px-6 sm:px-8 text-left flex-1 min-h-0 overflow-y-auto ${isBulk ? 'pt-3 space-y-3' : 'pt-4 space-y-3.5'}`}>
          {/* Bulk summary — a bulk action always lists exactly which
              invoices it affects (design review 7/9/26). */}
          {isBulk && <BulkInvoiceList items={targets!} maxHeight="min(180px, 22vh)" noun={noun} hrefBase={config.listHrefBase} />}
          {skipped.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
              <p className="text-[12px] text-amber-800" style={{ fontWeight: 500 }}>
                {skipped.length} selected {noun}{skipped.length === 1 ? '' : 's'} will be skipped
              </p>
              <p className="text-[11px] text-amber-700/90 mt-0.5 leading-snug">
                {skipReason ? `${skipReason}: ` : ''}
                {skipped.slice(0, 4).map((inv, i) => (
                  <span key={inv.invoiceNumber}>
                    {i > 0 && ', '}
                    <a
                      href={`${config.listHrefBase ?? '/invoices/'}${encodeURIComponent(inv.invoiceNumber)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary hover:underline underline-offset-2 transition-colors"
                      style={{ fontWeight: 500 }}
                    >
                      {inv.invoiceNumber}
                    </a>
                  </span>
                ))}
                {skipped.length > 4 ? `, +${skipped.length - 4} more` : ''}.
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
              Reason
              <span style={{ color: '#DC2626' }}>*</span>
            </Label>
            {isException ? (
              /* Multi-select — same Popover + Checkbox picker as the
                 creation form's Exception Type field (7/15/26). Modal
                 (user 9/22): a click elsewhere (e.g. "Add notification
                 recipients") dismisses the open dropdown first instead
                 of leaving it floating over the recipients modal. */
              <Popover modal>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-white px-3 text-[12px] shadow-none transition-colors cursor-pointer ${
                      reasonError ? 'border-red-400 ring-2 ring-red-100' : categories.length ? 'border-slate-300 text-foreground' : 'border-slate-200 text-slate-400'
                    } hover:border-slate-300 focus:ring-1 focus:ring-primary/20 focus:border-primary`}
                  >
                    {/* Fixed-width field — overflow collapses into a "+X
                        more" counter (partner Freight & Logistics pattern)
                        so the modal never stretches. */}
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">
                        {categories.length ? categories.slice(0, 2).join(', ') : 'Select one or more reasons'}
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
                  {gatedReasons.map((r) => {
                    const checked = categories.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setReasonError(false);
                          setCategories((prev) =>
                            prev.includes(r) ? prev.filter((v) => v !== r) : [...prev, r],
                          );
                        }}
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
                      reasonError ? 'border-red-400 ring-2 ring-red-100' : category ? 'border-slate-300 text-foreground' : 'border-slate-200 text-slate-400'
                    } hover:border-slate-300 focus:ring-1 focus:ring-primary/20 focus:border-primary`}
                  >
                    <span className="truncate">{category ?? 'Select a reason'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] z-[400]">
                  {gatedReasons.map((r) => (
                    <DropdownMenuItem key={r} onClick={() => { setCategory(r); setReasonError(false); }} className="text-[12px]">
                      <span className="flex-1">{r}</span>
                      {category === r && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {reasonError && <p className="text-[10px] text-red-600 mt-1">Pick a reason first.</p>}
          </div>

          {/* Description ∥ Supporting documents (user 9/9, the reversal
              modal's final arrangement): parallel evidence blocks where
              the variant carries documents; plain full-width otherwise. */}
          <div className={config.notify ? 'grid sm:grid-cols-2 gap-3 items-start' : ''}>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
              Description
              {isOther && <span style={{ color: '#DC2626' }}>*</span>}
            </Label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setDescError(false); }}
              placeholder={config.descriptionPlaceholder ?? (isOther ? 'Tell the vendor and your team why…' : 'Describe the issue so reviewers can act on it…')}
              rows={config.notify ? 4 : 2}
              className={`w-full text-[11px] rounded-md border bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-[11px] placeholder:text-slate-400 resize-none ${descError ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'} ${config.notify ? 'h-[104px]' : 'min-h-[52px]'}`}
            />
            {descError && <p className="text-[10px] text-red-600 mt-1">"Other" needs a description.</p>}
          </div>
          {config.notify && (
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
                {/* The reversal modal's drop-zone recipe verbatim (user
                    9/9): slate icon tile, primary link, blue hover, and a
                    FIXED height matching the description textarea so the
                    parallel pair sits aligned. */}
                <button
                  type="button"
                  onClick={() => document.getElementById(fileInputId)?.click()}
                  className="w-full h-[104px] flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-slate-500" />
                  </span>
                  <span className="text-[11px] text-slate-600 mt-0.5" style={{ fontWeight: 500 }}>
                    <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
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
          )}
          </div>

        {/* GL reversal preview (feedback 7/21/26): cancelling a POSTED
            invoice backs the original posting out of the ledger, so the
            confirm shows the reversing entry it will create. */}
        {glReversal && glReversal.length > 0 && (
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              GL Impact, Posting Reversed
            </Label>
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50/70 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-2.5 py-1 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>Account</th>
                    <th className="text-right px-2.5 py-1 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>Debit</th>
                    <th className="text-right px-2.5 py-1 text-[9px] text-slate-500" style={{ fontWeight: 600 }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {glReversal.map((l) => (
                    <tr key={`${l.code}-${l.debit > 0 ? 'dr' : 'cr'}`} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-2.5 py-1 whitespace-nowrap">
                        <span className="text-[10px] text-slate-500 " style={{ fontWeight: 500 }}>{l.code}</span>
                        <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{l.name}</span>
                      </td>
                      <td className="px-2.5 py-1 text-right ">
                        {l.debit > 0 ? <span style={{ fontWeight: 600 }}>{formatMoney(l.debit, glCurrency)}</span> : null}
                      </td>
                      <td className="px-2.5 py-1 text-right ">
                        {l.credit > 0 ? <span style={{ fontWeight: 600 }}>{formatMoney(l.credit, glCurrency)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Footnote removed (user 10/4): the table's own label says
                it's the reversal. */}
          </div>
        )}

        {/* Notify closes the modal, full width (user 9/9, the reversal
            modal's final arrangement) — the system's one notify
            interaction. */}
        {config.notify && (
          <div className="pt-0.5">
            <NotifyToggleCard
              title={config.notify.label}
              helper={config.notify.helper ?? 'Tell the people you choose.'}
              checked={notifyOn}
              onCheckedChange={setNotifyOn}
              selectedIds={recipients}
              onSelectionChange={setRecipients}
              accentColor={config.notify.accentColor}
              accentBg={config.notify.accentBg}
              accentBorder={config.notify.accentBorder}
              accentText={config.notify.accentText}
            />
          </div>
        )}
        </div>

        {/* Footer — gradient confirm-modal recipe: stacked full-width
            CTAs, solid action on top, soft escape below. */}
        <div className={`px-6 sm:px-8 shrink-0 ${isBulk ? 'pt-3 pb-5 flex flex-row-reverse gap-2' : 'pt-4 pb-6 flex flex-col gap-2'}`}>
          <button
            type="button"
            onClick={() => {
              // Never blocked (user 9/23): missing input highlights the
              // field, the button stays live.
              if (!hasSelection) {
                setReasonError(true);
                toast.error('Reason required', { description: 'Pick a reason from the dropdown first.' });
                return;
              }
              if (isOther && trimmedDesc.length === 0) {
                setDescError(true);
                toast.error('Description required', { description: '"Other" needs a description before this can go through.' });
                return;
              }
              onConfirm(composedReason, notifyOn && recipients.size > 0 ? Array.from(recipients) : undefined);
              onOpenChange(false);
            }}
            className={`${isBulk ? 'flex-1 h-10 text-[13px]' : 'w-full h-11 text-[14px]'} rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90`}
            style={{ fontWeight: 600, backgroundColor: config.solid, color: '#fff' }}
          >
            {bulkVerb}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={`${isBulk ? 'flex-1 h-10 text-[13px]' : 'w-full h-11 text-[14px]'} rounded-xl border-0 cursor-pointer transition-colors mt-0`}
            style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
          >
            {config.secondaryText ?? (currentStatus ? `Keep as ${currentStatus}` : 'Go Back')}
          </button>
        </div>
      </DialogContent>
      <DiscardConfirm
        open={discardOpen}
        what="this form"
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
