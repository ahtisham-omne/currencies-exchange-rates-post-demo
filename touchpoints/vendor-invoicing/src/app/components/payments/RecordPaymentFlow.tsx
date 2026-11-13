import { TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { highlightText as sharedHighlightText } from '@/app/components/InvoiceDataTable';
import { formatUsDate, localTodayIso, overdueDaysOf, overdueLabel } from '@/app/lib/dueBucket';
import { discountTermsFor, discountIsLive, discountAmountOn, discountDaysLeft } from '@/app/lib/runMath';
import {
  X,
  Building2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  Landmark,
  Receipt,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SendHorizontal,
  Info,
  Maximize2,
  Minimize2,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Download,
  Wallet,
  Banknote,
  Calendar,
  Clock,
  RotateCcw,
  Settings2,
  ShoppingCart,
  Package,
  Pencil,
  Edit3,
  Plus,
  Search,
  Paperclip,
  Upload,
  ExternalLink,
  Lock,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { resolvePaymentTerm } from '@/app/data/paymentTermPresets';
import { PaymentMethodModal } from '@/app/components/payments/PaymentMethodModal';
import { CheckPrintFlow } from '@/app/components/payments/CheckPrintFlow';
import { ManualCheckModal } from '@/app/components/payments/ManualCheckModal';
import { STOCK_PROFILES, checkSettingsFor, checkInputForPayment, recordChecks, updateCheckSettings, type CheckPaymentInput } from '@/app/lib/checkPrinting';
import { paymentMethodInfo, methodCategoryColors } from '@/app/data/paymentMethodCatalog';
import { PrimaryPill } from './PrimaryPill';
import { renderPaymentStatus, paymentStatusLabel } from '@/app/components/PaymentDataTable';
import { vendorPaymentMethods, genericPaymentMethods, methodSummary, methodDataRows, type VendorPaymentMethod } from '@/app/data/vendorPaymentMethods';
import type { Invoice } from '@/app/data/mockInvoices';
import { PAY_FROM_ACCOUNTS, PAYMENT_METHODS, accountTypeForMethod, accountBalanceLabel, accountsForCurrency, vendorPaymentCurrency, type Payment } from '@/app/data/mockPayments';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { CurrencyFlag } from '@/app/components/currency/CurrencyChip';
import { formatMoney } from '@/app/currency/money';
import { rateOn, toBase } from '@/app/currency/rates';
import { invoiceFx, toInvoiceBase } from '@/app/currency/invoiceFx';
import { exchangeDifference, stampPaymentRate, toPaymentBase } from '@/app/currency/paymentFx';
import { useApPermissions } from '@/app/hooks/useApSettings';
import { PaymentCurrencyField, PaymentRateField } from '@/app/components/currency/PaymentCurrencyFields';
import { ExchangeDifferenceLine, signedBase } from '@/app/components/currency/ExchangeDifference';
import { paidRateText } from '@/app/currency/paidRate';
import { mockVendors, partnerVendorUrl, resolveRegistryVendor } from '@/app/data/mockVendors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import { ExpandableTextarea } from '@/app/components/ExpandableTextarea';
import { PREPAYMENT_ASSET_ACCOUNTS, DEFAULT_PREPAYMENT_ASSET_ACCOUNT, ADVANCES_ACCOUNT, formatGLAccount, AP_ACCOUNTS, defaultApAccountForCategory } from '@/app/data/glAccounts';
import { buildPaymentGlEntries } from '@/app/lib/glPosting';
import { openRunInvoiceIds, type PaymentRun } from '@/app/data/paymentRuns';
import { GLAccountConfigModal } from '@/app/components/GLAccountConfigModal';
import { PayFromAccountModal } from '@/app/components/payments/PayFromAccountModal';
import { PrepaymentSourcePicker } from '@/app/components/payments/PrepaymentSourcePicker';
import { downloadRemittanceAdvice, type RemittanceLine } from '@/app/lib/remittanceAdvice';
import { MoneyInput, formatMoneyText } from '@/app/components/payments/MoneyInput';
import { DueDatePill } from '@/app/components/payments/run/runUi';
import { PrepaidOriginNote } from '@/app/components/payments/PrepaidOriginNote';
import { useSystemSettings } from '@/app/hooks/useSystemSettings';
import { proofLabelFor } from '@/app/components/payments/run/RunExecuteStage';
import { memoLimitFor } from '@/app/lib/memoLimits';
import { claimPaymentNumber, peekPaymentNumber } from '@/app/lib/invoiceIds';

// Record payment wizard — two transaction types selected up-front from the
// PaymentTypeSelectionModal:
//   Payment    — settle open vendor invoices (one payment record per vendor).
//   Prepayment — log an advance to a vendor before an invoice exists.
//
// Two steps, mirroring the vendor-invoicing creation UX (rich vendor cards,
// expanded rounded rows). The flow ends at a "recorded" confirmation.

export type RecordPaymentMode = 'pay' | 'prepay';

export interface InvoiceAllocation {
  invoiceId: string;
  /** Total applied to the invoice. */
  applied: number;
}

/** How much on-account prepayment credit was drawn from each prepayment
 *  record in a pay run (feedback 7/22/26) — the parent reduces each
 *  record's unapplied balance so its status walks Unapplied → Partially
 *  applied → Fully applied. */
export interface PrepaymentConsumption {
  paymentId: string;
  amount: number;
  /** Invoices the drawn credit settled, for the record's applied list. */
  invoiceNumbers: string[];
  /** Per-invoice credit amounts (9/22/26 review response, GPT RR12):
   *  the source advance's applied list carries real dollars, so an
   *  applied advance never reads "Unapplied" on its own page. Falls
   *  back to spreading `amount` when absent. */
  invoiceDraws?: { invoiceNumber: string; amount: number }[];
}

interface RecordPaymentFlowProps {
  open: boolean;
  initialMode: RecordPaymentMode;
  invoices: Invoice[];
  payments: Payment[];
  onClose: () => void;
  /** Steps back to the Payment/Prepayment type picker (header back button). */
  onBack: () => void;
  /** Records the payments and (for posted payments) settles the invoices.
   *  `prepayConsumption` lists on-account advances drawn down in the run. */
  onComplete: (
    records: Payment[],
    allocations: InvoiceAllocation[],
    asDraft: boolean,
    prepayConsumption?: PrepaymentConsumption[],
  ) => void;
  /** Opens a recorded payment's detail page (user 10/15): the success
   *  modal lands there instead of the listing. */
  onViewPayment?: (payment: Payment) => void;
  /** Optional prepay pre-fill — e.g. opened from a pre-invoice record. Seeds the
   *  vendor, sets the target to "against a pre-invoice", and links the doc. */
  prefill?: { vendor: string; preInvoiceId?: string };
  /** Pay-mode pre-selection — e.g. opened from the Ready to pay tab. Seeds the
   *  vendors + invoice lines from these invoice ids (full balance each) and
   *  jumps straight to step 2 so the user just confirms and records. */
  paySelection?: { invoiceIds: string[] };
  /** 'workspace' (V2) renders step 2 as a two-panel layout mirroring the vendor
   *  invoicing creation form. 'classic' (V1, invoice-initiated) keeps the
   *  single-column step 2. */
  variant?: 'classic' | 'workspace';
  /** Payment runs — invoices with a live line in an OPEN run are money in
   *  motion and never offered here (9/22/26 review response). */
  runs?: PaymentRun[];
}

// Past a trillion dollars the grouped format stops being readable, so
// absurd magnitudes render in exponential notation instead.
// A pre-invoice's expected total after credit memos (BA 10/10): a $140
// credit on $38,005.00 expects $37,865.00.
const preInvoiceExpected = (pi: { amount: number; creditedAmount?: number }) =>
  Math.round((pi.amount - (pi.creditedAmount ?? 0)) * 100) / 100;

const fmt = (n: number) =>
  n >= 1e12
    ? `$${n.toExponential(2)}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDeadline = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
};

/** Early-pay discount at the CHOSEN payment date (Nophil 9/23): backdating
 *  the payment revives the window; the expired state stays visible and
 *  carries a one-click discounted amount for the negotiated-after-the-fact
 *  case. Shared by both invoice tables. */
/** A table header with its ⓘ (Currency & Exchange Rates columns). */
/** Which currency's invoices this payment settles, for a vendor with open
 *  invoices in more than one (one payment can't mix currencies). The
 *  partner segmented style: flag, code, open count. */
function InvoiceCurrencySwitch({
  counts,
  value,
  onChange,
}: {
  counts: { code: string; count: number }[];
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <span className="ml-auto inline-flex items-center gap-2">
      <span className="text-[11px] text-slate-500 inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
        Invoice Currency
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-slate-300 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
            <p className="text-[11px] text-slate-500 leading-snug">
              This vendor has open invoices in more than one currency. One payment can’t mix currencies, so each currency is paid separately.
            </p>
          </TooltipContent>
        </Tooltip>
      </span>
      <span role="radiogroup" aria-label="Invoice currency" className="inline-flex items-stretch h-7 rounded-md border border-slate-200 bg-white overflow-hidden text-[11px]">
        {counts.map(({ code, count }, i) => {
          const on = code === value;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => { if (!on) onChange(code); }}
              className={`inline-flex items-center gap-1.5 px-2.5 cursor-pointer transition-colors ${i > 0 ? 'border-l border-slate-200' : ''} ${
                on ? 'bg-primary/[0.06] text-primary' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CurrencyFlag code={code} size={14} />
              <span style={{ fontWeight: 600 }}>{code}</span>
              <span className={on ? 'text-primary/70' : 'text-slate-400'} style={{ fontWeight: 500 }}>{count}</span>
            </button>
          );
        })}
      </span>
    </span>
  );
}

function FxHeader({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1 justify-end">
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="w-3 h-3 text-slate-300 cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md">
          <p className="text-[11px] text-slate-500 leading-snug" style={{ fontWeight: 400 }}>{tip}</p>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function DiscountCell({ inv, paymentDate, onUseDiscounted }: { inv: Invoice; paymentDate: string; onUseDiscounted: (amount: number) => void }) {
  // In the invoice's own currency (Currency & Exchange Rates), not the module's $.
  const fmt = (n: number) => formatMoney(n, inv.currency);
  const dTerms = discountTermsFor(inv);
  if (!dTerms) return null;
  const asOf = paymentDate || undefined;
  const live = discountIsLive(dTerms, asOf);
  const dAmount = discountAmountOn(inv.outstandingBalance, dTerms);
  const discounted = Math.round((inv.outstandingBalance - dAmount) * 100) / 100;
  const dDays = live ? discountDaysLeft(dTerms, asOf) : 0;
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        {live ? (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] cursor-help" style={{ fontWeight: 600 }}>
            {dTerms.percent}% · −{fmt(dAmount)}
          </span>
        ) : (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] cursor-help" style={{ fontWeight: 600 }}>
            {dTerms.percent}% expired
          </span>
        )}
      </HoverCardTrigger>
      <HoverCardContent side="top" align="end" className="w-[290px] p-3 bg-white border border-border rounded-xl shadow-lg z-[300]">
        {live ? (
          <>
            <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Early-pay discount, {dTerms.label}</p>
            <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
              Pay by {fmtDeadline(dTerms.deadline)} and take {dTerms.percent}% off. On this balance that's{' '}
              <span className="text-emerald-700" style={{ fontWeight: 600 }}>{fmt(dAmount)}</span>: you pay{' '}
              <span style={{ fontWeight: 600 }}>{fmt(discounted)}</span> instead of {fmt(inv.outstandingBalance)}.
            </p>
            <p className="text-[11px] mt-1.5" style={{ fontWeight: 600, color: dDays <= 2 ? '#B45309' : '#047857' }}>
              {paymentDate
                ? dDays === 0
                  ? 'The payment date is the last day of the window.'
                  : `${dDays} day${dDays === 1 ? '' : 's'} left at the chosen payment date.`
                : 'Enter the payment date to confirm the window.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Discount Window Closed</p>
            <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
              The {dTerms.label} window ended {fmtDeadline(dTerms.deadline)}{paymentDate ? ' at the chosen payment date' : ''}. If the payment was actually made in time, backdate the payment date. If the vendor honors the {dTerms.percent}% anyway, use the discounted amount.
            </p>
          </>
        )}
        <button
          type="button"
          onClick={() => onUseDiscounted(discounted)}
          className="mt-2 w-full h-7 rounded-md border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer "
          style={{ fontWeight: 600 }}
        >
          Use discounted amount · {fmt(discounted)}
        </button>
      </HoverCardContent>
    </HoverCard>
  );
}

/** "2026-06-14" → "Jun 14, 2026" — list rows read dates, not ISO strings. */
const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

// Money input — extracted to its own file (7/29/26) so the payment run
// proposal shares the exact same field. Imported near the top with the
// other payments components.

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$', CHF: 'CHF', CNY: '¥', INR: '₹',
};
const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen', CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar', CHF: 'Swiss Franc', CNY: 'Chinese Yuan', INR: 'Indian Rupee',
};
const currencySymbol = (code: string) => CURRENCY_SYMBOLS[code] ?? code;

// Opening a PO from a payment row jumps to the procurement module (new tab),
// mirroring how the vendor / items pills deep-link out to partner surfaces.
const PO_DETAIL_URL = 'https://pleasant-flow.lovable.app/purchase-orders/po-10';
// Vendor deep-link to the partner module (new tab), mirroring the listing.
// Vendor links resolve per vendor (9/22/26, GPT LINK-01).

/** Saved-payment-method pill with a rich hover card — mirrors the partner
 *  details-header group pill: a dark gradient header (method + Primary badge)
 *  over a white body of masked account detail rows. Hover-controlled so the
 *  card stays open while the cursor travels into it. */
function BankMethodHoverPill({ vendorName }: { vendorName: string }) {
  const methods = vendorPaymentMethods(vendorName);
  const primary = methods.find((m) => m.isPrimary) ?? methods[0];
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!primary) return null;
  const info = paymentMethodInfo(primary.type);
  const Icon = info.icon;
  const rows = methodDataRows(primary);
  // Match the KPI tooltip open delay (300ms) so pill hovers don't feel abrupt.
  const handleEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (enterTimer.current) clearTimeout(enterTimer.current);
    enterTimer.current = setTimeout(() => setOpen(true), 300);
  };
  const handleLeave = () => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => setOpen(false), 150);
  };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-50 text-slate-600 border border-slate-200 cursor-default transition-colors hover:bg-slate-100 hover:border-slate-300"
          style={{ fontWeight: 500 }}
        >
          <Icon className="w-3 h-3 text-slate-400" />
          {primary.nickname}{primary.isPrimary ? ' · Primary' : ''}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        className="p-0 w-auto border-0 shadow-none bg-transparent z-[300]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="w-[260px] rounded-xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border/60">
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center justify-between relative gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 rounded-md bg-white/10 text-white flex items-center justify-center shrink-0"><Icon className="w-3.5 h-3.5" /></span>
                <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>{primary.nickname}</span>
              </div>
              {primary.isPrimary && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] tracking-wide bg-white/15 text-white" style={{ fontWeight: 700 }}>Primary</span>
              )}
            </div>
            <p className="text-[10px] text-white/60 mt-1 relative">{info.label}</p>
          </div>
          <div className="bg-white px-3.5 py-3 space-y-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-slate-400">{r.label}</span>
                <span className="text-slate-700 " style={{ fontWeight: 600 }}>{r.value}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-muted flex items-center gap-1.5 text-[11px] text-slate-500">
              <Wallet className="w-3 h-3 text-slate-400" />
              <span>{methods.length} method{methods.length === 1 ? '' : 's'} saved · change in step 2</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Vendor-level payment-terms pill — the partner two-segment pill (NET/Pre/Split
 *  badge + trigger), with the full partner PaymentTermCard shown on hover. The
 *  vendor's free-text terms label is resolved to a preset so the card renders
 *  the same way it does on the partner vendor profile. Exported (8/7/26):
 *  the run authoring Step 1 terms column wears the same pill. */
export function PaymentTermPill({ termLabel, variant = 'pill' }: { termLabel: string; variant?: 'pill' | 'name' }) {
  const term = resolvePaymentTerm(termLabel);
  const pill =
    term.category === 'net'
      ? { text: '#0A77FF', bg: 'var(--color-blue-50)', border: 'var(--color-blue-100)' }
      : term.category === 'prepayment'
        ? { text: '#6D28D9', bg: '#F5F3FF', border: '#EDE9FE' }
        : { text: '#B45309', bg: '#FFFBEB', border: '#FDE68A' };
  // Name variant (8/28/26 review): tables read the TERM NAME, not the
  // type pill — the pill said "NET · Invoice Date" where the user needs
  // "Net 15". Plain text that turns primary-blue on hover (no underline,
  // 8/28 evening pass) so the hovered term is obvious; the full partner
  // card still opens on hover.
  if (variant === 'name') {
    return (
      <HoverCard openDelay={300} closeDelay={120}>
        <HoverCardTrigger asChild>
          <span
            className="inline-flex max-w-full cursor-default align-middle text-[12.5px] text-slate-700 whitespace-nowrap hover:text-primary transition-colors"
            style={{ fontWeight: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate">{term.name}</span>
          </span>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="p-0 bg-transparent border-0 shadow-none w-[300px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <PaymentTermCard term={term} readOnly hideCheckmark />
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex items-stretch rounded-full overflow-hidden border shrink-0 cursor-default align-middle"
          style={{ borderColor: pill.border }}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="inline-flex items-center gap-1 px-2 py-[2px] text-[10px]"
            style={{ fontWeight: 600, color: pill.text, backgroundColor: pill.bg }}
          >
            {term.category === 'net' ? (
              <Receipt className="w-3 h-3" />
            ) : term.category === 'prepayment' ? (
              <Clock className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3" />
            )}
            {term.typeBadge}
          </span>
          <span
            className="inline-flex items-center px-2 py-[2px] text-[10px] bg-white text-slate-500 border-l max-w-[160px]"
            style={{ fontWeight: 500, borderColor: pill.border }}
          >
            <span className="truncate">{term.trigger}</span>
          </span>
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="p-0 bg-transparent border-0 shadow-none w-[300px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Strong drop shadow (matches the vendor quick-card) so the term card
            lifts off the row behind it instead of blending in. */}
        <div className="rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <PaymentTermCard term={term} readOnly hideCheckmark />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Search-match highlight: the shared yellow mark so this flow reads the
 *  same as every listing in the system (10/9/26). */
function highlightText(text: string, query: string) {
  return sharedHighlightText(text, query);
}

/** Open approved invoices are payable; a Pending Approval invoice is too
 *  when the payer holds approve rights (7/16/26): recording the payment
 *  approves it in the same step, so approve-then-pay is one action.
 *  A live payment hold blocks payability whatever the status — a held
 *  pending invoice keeps its status and carries the flag (7/21/26). */
function isPayable(inv: Invoice) {
  return (
    (inv.status === 'Approved' || inv.status === 'Partially Paid' || inv.status === 'Pending Approval') &&
    !inv.is_payment_held &&
    inv.outstandingBalance > 0
  );
}

// Per-mode accent palette — Payment owns a green identity, Prepayment a purple
// one. Applied (via inline styles) wherever the invoicing design uses blue.
const THEME: Record<RecordPaymentMode, {
  primary: string; soft: string; softBorder: string; text: string;
  chevronBg: string; expandedBg: string; hoverBg: string;
  heroBg: string; heroIcon: string; heroTint: string;
}> = {
  pay: {
    primary: '#059669', soft: '#ECFDF5', softBorder: '#A7F3D0', text: '#047857',
    chevronBg: '#D1FAE5', expandedBg: '#F0FDF4', hoverBg: '#F0FDF4',
    heroBg: '#DCFCE7', heroIcon: '#047857', heroTint: '#ECFDF5',
  },
  prepay: {
    primary: '#7C3AED', soft: '#F5F3FF', softBorder: '#DDD6FE', text: '#6D28D9',
    chevronBg: '#EDE9FE', expandedBg: '#FAF5FF', hoverBg: '#FAF5FF',
    heroBg: '#EDE9FE', heroIcon: '#6D28D9', heroTint: '#F5F3FF',
  },
};

// Selection chrome is a neutral blue (matches the vendor-invoicing selection
// step), so the green/purple mode identity stays reserved for the type badge,
// hero icon, and Continue button. Reduces the cognitive load of two accent
// colors fighting for "selected" meaning.
const SEL = {
  expandedBg: '#F8FAFF',
  hoverBg: '#F0F7FF',
  chevronBg: '#D6E8FF',
  soft: 'var(--color-blue-50)',        // blue-50
  softBorder: '#93C5FD',  // blue-300
  text: 'hsl(var(--primary))',
};

// ── Due-date helpers ── signed whole days a due date is past today
// (positive = overdue, 0 = due today, negative = still in the future).
function daysPastDue(dueDate: string): number {
  // Shared date core (9/22/26): one midnight, one parser, everywhere.
  return overdueDaysOf(dueDate);
}
function daysOverdue(dueDate: string): number {
  return Math.max(0, daysPastDue(dueDate));
}
// One phrasing family (9/22/26 review response): the shared
// overdueLabel wording, keyed here by due date for the row meta line.
function overdueRowLabel(dueDate: string): string {
  const n = daysPastDue(dueDate);
  return n <= 0 ? 'Due Today' : overdueLabel(n);
}
// Forward-looking companion for the row meta line. Inside the final week
// it reads as a countdown ("3 days left"); further out it stays calm
// ("due in 21 days").
function dueInLabel(dueDate: string): string | null {
  const n = -daysPastDue(dueDate);
  if (n <= 0) return null;
  if (n <= 7) return `${n} day${n === 1 ? '' : 's'} left`;
  return `due in ${n} days`;
}
// True when the bill is due within the next 7 days (not today, not past).
function isDueSoon(dueDate: string): boolean {
  const n = -daysPastDue(dueDate);
  return n >= 1 && n <= 7;
}

interface LineState {
  selected: boolean;
  amount: number;
  /** Prepayment (on-account credit) applied to this specific invoice. */
  prepayApplied?: number;
  /** Vendor honored the early-pay discount AFTER its window (user 9/23
   *  spec): the discount settles the invoice alongside the cash, with a
   *  required reason on the record. */
  lateDiscount?: { amount: number; reason: string };
}

interface RecordedRecord {
  record: Payment;
  lines: RemittanceLine[];
}

type SortKey = 'dueDesc' | 'dueAsc' | 'dueDate' | 'dueDateDesc' | 'overdueDesc' | 'invoicesDesc' | 'vendorAZ' | 'vendorZA';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'dueDesc', label: 'Highest Due' },
  { key: 'dueAsc', label: 'Lowest Due' },
  { key: 'dueDate', label: 'Due Date (Soonest)' },
  { key: 'dueDateDesc', label: 'Due Date (Latest)' },
  { key: 'overdueDesc', label: 'Most Overdue' },
  { key: 'invoicesDesc', label: 'Most Invoices' },
  { key: 'vendorAZ', label: 'Vendor A–Z' },
  { key: 'vendorZA', label: 'Vendor Z–A' },
];

/* ── Split Create CTA (user 9/25) ─────────────────────────────────────
 * One control, three flows: the PRIMARY action follows the selected
 * payment-type tab (Invoice on the invoices tab, Pre-Invoice on the
 * pre-invoice tab), the other two live in the chevron dropdown. Every
 * option deep-links ?create=<type>&vendor= — the creation flow opens in
 * a new tab with the type asserted and the vendor pre-selected, no type
 * screen, no vendor re-pick. */
// Each option wears the LISTING's type colors (user 9/25 second pass):
// BLUE inventory, TEAL standalone, VIOLET pre-invoice — the exact
// TYPE_CONFIG identity the invoicing table pills use, one type language
// everywhere in the system.
// Standalone is second, Pre-Invoice last (user 9/25): the everyday
// inventory invoice leads, the proforma sits at the bottom of the menu.
const CREATE_DOC_OPTIONS = [
  // "Create New Inventory Invoice" (user 9/25): the everyday inventory
  // invoice, named in full so it isn't confused with the other two.
  { kind: 'invoice', label: 'Create New Inventory Invoice', icon: Banknote, color: '#1D4ED8', menuCls: 'text-blue-700 focus:text-blue-700 focus:bg-blue-50' },
  { kind: 'standalone', label: 'Create Standalone Invoice', icon: Wallet, color: '#0F766E', menuCls: 'text-teal-700 focus:text-teal-700 focus:bg-teal-50' },
  { kind: 'pre-invoice', label: 'Create Pre-Invoice', icon: Receipt, color: '#6D28D9', menuCls: 'text-violet-700 focus:text-violet-700 focus:bg-violet-50' },
] as const;

/* Can this vendor start an INVENTORY invoice? (user 9/25) The deep link
 * opens the create flow's PO/receiving picker locked to the vendor — if
 * the vendor resolves to no registry record, or every PO and receiving
 * is already closed/fully invoiced, that picker is empty and the flow is
 * a dead end. Resolves the payment-screen vendor name the same tolerant
 * way InvoiceCreationFlow does, then mirrors the picker's own "open"
 * rule so the CTA state matches what the picker would actually show. */
function inventoryInvoiceAvailable(vendorName: string): boolean {
  // The SHARED resolver (Eli 9/25): the same chain the create flow's
  // vendor lock uses, so this check and the deep link never disagree.
  const v = resolveRegistryVendor(vendorName);
  if (!v) return false;
  const hasOpenPO = v.purchaseOrders.some((po) => {
    const fullyInvoiced = (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0;
    const fullyReceived =
      po.status === 'Fully Received' ||
      po.status === 'Fully Invoiced' ||
      po.items.every((it) => (it.receivedQty || 0) >= it.quantity);
    const closed =
      po.status === 'Closed' ||
      po.status === 'Cancelled' ||
      po.status === 'Fully Invoiced' ||
      (fullyReceived && fullyInvoiced);
    return !closed;
  });
  const hasOpenGRN = v.receivingDocuments.some((grn) => grn.status !== 'Fully Invoiced');
  return hasOpenPO || hasOpenGRN;
}

function CreateDocSplitCta({ vendor, primary, tone }: {
  vendor: string;
  primary: (typeof CREATE_DOC_OPTIONS)[number]['kind'];
  tone: 'blue' | 'violet' | 'teal';
}) {
  const openKind = (kind: string) =>
    window.open(`/invoices?create=${kind}&vendor=${encodeURIComponent(vendor)}`, '_blank', 'noopener');
  const primaryOpt = CREATE_DOC_OPTIONS.find((o) => o.kind === primary)!;
  const rest = CREATE_DOC_OPTIONS.filter((o) => o.kind !== primary);
  // Dead-end deep links grey out with a hover reason (Eli 9/25 ruling):
  // inventory needs an open PO or receiving; a pre-invoice needs the
  // vendor's POs, so an unresolvable vendor blocks it too. Standalone
  // always works (it synthesizes the vendor).
  const vendorResolvable = !!resolveRegistryVendor(vendor);
  const blockedReasonFor = (kind: string): string | null => {
    if (kind === 'invoice' && !inventoryInvoiceAvailable(vendor))
      return `No un-invoiced inventory for ${vendor}. Create a standalone invoice, or receive goods first.`;
    if (kind === 'pre-invoice' && !vendorResolvable)
      return `No purchase orders on file for ${vendor}. A pre-invoice bills against a PO.`;
    return null;
  };
  const toneCls =
    tone === 'violet'
      ? 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50'
      : tone === 'teal'
        ? 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50'
        : 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50';
  const primaryBlockedReason = blockedReasonFor(primaryOpt.kind);
  const primaryBlocked = !!primaryBlockedReason;
  return (
    <span className="ml-auto inline-flex shrink-0 shadow-sm rounded-lg">
      {primaryBlocked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              aria-disabled
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-l-lg border border-slate-200 bg-slate-50 text-slate-400 text-[11px] cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3 h-3" /> {primaryOpt.label}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] z-[300]">
            <p className="text-[11px] text-slate-500 leading-snug">{primaryBlockedReason}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={() => openKind(primaryOpt.kind)}
          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-l-lg border text-[11px] transition-colors cursor-pointer ${toneCls}`}
          style={{ fontWeight: 600 }}
          title={`Opens the ${primaryOpt.label} flow in a new tab, vendor pre-selected`}
        >
          <Plus className="w-3 h-3" /> {primaryOpt.label}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`h-7 w-6 rounded-r-lg border border-l-0 flex items-center justify-center transition-colors cursor-pointer ${toneCls}`}
            aria-label="More create options"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        {/* Wide enough that every label stays on ONE line (user 9/26). */}
        <DropdownMenuContent align="end" className="z-[300] min-w-[240px]">
          {rest.map((o) => {
            const OptIcon = o.icon;
            const blockedReason = blockedReasonFor(o.kind);
            // Text and hover carry the SAME hue as the icon (user 9/25)
            // so the option reads as one identity.
            if (blockedReason) {
              return (
                <Tooltip key={o.kind}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-slate-400 cursor-not-allowed select-none"
                      aria-disabled
                    >
                      <OptIcon className="w-3.5 h-3.5 shrink-0" />
                      {o.label}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[240px] z-[300]">
                    <p className="text-[11px] text-slate-500 leading-snug">{blockedReason}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }
            return (
              <DropdownMenuItem key={o.kind} className={`cursor-pointer gap-1.5 whitespace-nowrap ${o.menuCls}`} onClick={() => openKind(o.kind)}>
                <OptIcon className="w-3.5 h-3.5 shrink-0 text-current" />
                {o.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

// Inline "more/less" description, matching the invoicing vendor card.
// The toggle appears only when the text ACTUALLY truncates (user 9/24):
// a fully visible sentence with a "more" that reveals nothing is noise,
// so the collapsed span is measured and the control earns its place.
function VendorBlurb({ text, accent }: { text: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, open]);
  return (
    <div className="mt-0.5 text-[11px] text-slate-500 leading-snug min-w-0">
      {open ? (
        <span>
          {text}{' '}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="inline-flex items-center gap-0.5 align-baseline text-[11px] transition-colors"
            style={{ color: accent, fontWeight: 500 }}
          >
            less <ChevronUp className="w-3 h-3" />
          </button>
        </span>
      ) : (
        // Collapsed: CSS-truncate on one line; the "more" toggle sits flush
        // after the ellipsis (matches the invoicing vendor card).
        <span className="flex items-baseline gap-1 min-w-0">
          <span ref={measureRef} className="truncate min-w-0">{text}</span>
          {truncated && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              className="inline-flex items-center gap-0.5 align-baseline shrink-0 text-[11px] transition-colors"
              style={{ color: accent, fontWeight: 500 }}
            >
              more <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export function RecordPaymentFlow({
  open,
  initialMode,
  invoices,
  payments,
  onClose,
  onBack,
  onComplete,
  onViewPayment,
  prefill,
  paySelection,
  variant = 'classic',
  runs = [],
}: RecordPaymentFlowProps) {
  // Mode is settable now (7/23/26 vendor-first restructure): a fresh flow starts
  // vendor-first and the Step 2 option boxes set the mode. Deep-link entries
  // (paySelection / pre-invoice prefill) keep the initialMode they were opened
  // with. baseRows / filteredVendorRows list `mode` in their deps, so an
  // in-place change recomputes the selection cleanly.
  const [mode, setMode] = useState<RecordPaymentMode>(initialMode);
  const isV2 = variant === 'workspace';

  // Ready-to-pay preselection — resolve the seeded invoices to their vendors
  // and per-line state (full balance each), and jump to step 2 so the user
  // just confirms and records. Computed once at mount (the flow is remounted
  // per open via its key).
  // Bulk payments (feedback 7/20/26): a seed can span vendors — every
  // seeded vendor enters the run and the flow records one payment per
  // vendor, same as multi-vendor selection in step 1.
  const paySeededIds = paySelection?.invoiceIds ?? [];
  const paySeededVendors = Array.from(
    new Set(invoices.filter((i) => paySeededIds.includes(i.id)).map((i) => i.vendor)),
  );
  // Currency & Exchange Rates: one payment can't mix currencies, so a
  // vendor's payment settles invoices in one currency. A seed keeps the
  // currency of its first invoice per vendor.
  const invCurrency = (inv: Pick<Invoice, 'currency'>) => (inv.currency || BASE_CURRENCY).toUpperCase();
  const paySeededCurrency: Record<string, string> = {};
  paySeededIds.forEach((id) => {
    const inv = invoices.find((i) => i.id === id);
    if (inv && !paySeededCurrency[inv.vendor]) paySeededCurrency[inv.vendor] = invCurrency(inv);
  });
  const paySeededLines: Record<string, LineState> = {};
  if (paySeededVendors.length > 0) {
    invoices.forEach((inv) => {
      if (paySeededVendors.includes(inv.vendor)) {
        paySeededLines[inv.id] = {
          selected: paySeededIds.includes(inv.id) && invCurrency(inv) === paySeededCurrency[inv.vendor],
          // Amounts start EMPTY (Eli 9/8): recording a payment is a
          // conscious action — the user types it or clicks Pay in full.
          amount: 0,
        };
      }
    });
  }
  const t = THEME[mode];
  const ModeIcon = mode === 'prepay' ? Wallet : Banknote;
  // Mode-accent hover classes for the stat box (literal strings so Tailwind's
  // JIT scanner keeps them).
  const metricHover = mode === 'prepay' ? 'hover:border-purple-300' : 'hover:border-emerald-300';
  const metricIconHover = mode === 'prepay'
    ? 'group-hover/metric:bg-purple-50 group-hover/metric:text-purple-700'
    : 'group-hover/metric:bg-emerald-50 group-hover/metric:text-emerald-700';

  // Start at step 2 when the flow is pre-scoped: pay mode seeded from invoices
  // (paySelection), or prepay mode seeded from a pre-invoice (prefill). Step 1
  // (vendor + how-to-apply) is auto-filled, so the user lands on the details.
  const startAtStep2 =
    paySeededVendors.length > 0 ||
    (initialMode === 'prepay' && !!prefill?.vendor && !!prefill?.preInvoiceId);
  const [step, setStep] = useState(startAtStep2 ? 2 : 1);
  // ── Vendor-first pre-flow (Eli + Nophil, 7/22/26) ────────────────────
  // A fresh "Record a Payment" opens vendor-first: Step 1 pick the vendor,
  // Step 2 choose what to pay (invoices / pre-invoices / standalone advance),
  // Step 3 resume the existing selection + record flow. Deep-link entries
  // (paySelection / pre-invoice prefill) skip straight into the flow.
  const vendorFirst = !startAtStep2;
  const [entryStage, setEntryStage] = useState<'vendor' | 'choose' | 'flow'>(
    !vendorFirst ? 'flow' : prefill?.vendor ? 'choose' : 'vendor',
  );
  // Step 2 "What to pay" is now a SELECTION, not instant navigation
  // (7/24/26): pick a card, the list below updates, Continue proceeds.
  const [chooseSel, setChooseSel] = useState<'invoices' | 'pre-invoices' | 'advance' | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [grnSearch, setGrnSearch] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [includePaid, setIncludePaid] = useState(false);
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [activePopover, setActivePopover] = useState<'date' | 'amount' | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('dueDesc');
  const [selectedVendors, setSelectedVendors] = useState<string[]>(
    prefill?.vendor ? [prefill.vendor] : paySeededVendors,
  );
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  // Pay-flow expanded vendor sub-tab: Invoices vs Prepayments (per vendor).
  // Prepay target (spec §3): anchor the advance to a specific pre-invoice, or
  // hold it on account against the vendor. Pre-invoice is the standard way to
  // record a prepayment, so it's the default.
  const [prepayTarget, setPrepayTarget] = useState<'pre-invoice' | 'on-account'>('pre-invoice');
  // The Payment type card drives the mode AS SOON AS it is picked (user
  // 10/22/26): going back from a prepayment and choosing "Pay an Open
  // Invoice" used to keep prepay mode until Continue, so the open list
  // let pre-invoices in and the header still read Record Prepayment.
  useEffect(() => {
    if (entryStage !== 'choose' || !chooseSel) return;
    if (chooseSel === 'invoices') {
      setMode('pay');
      return;
    }
    setMode('prepay');
    setPrepayTarget(chooseSel === 'pre-invoices' ? 'pre-invoice' : 'on-account');
  }, [entryStage, chooseSel]);
  // Multi-select (7/24/26): several prepayments can be recorded against
  // several pre-invoices in one run — checkbox selection like invoices.
  // Single-select call sites keep working through the derived id + setter.
  const [selectedPreInvoiceIds, setSelectedPreInvoiceIds] = useState<string[]>(prefill?.preInvoiceId ? [prefill.preInvoiceId] : []);
  const selectedPreInvoiceId = selectedPreInvoiceIds[0] ?? '';
  const setSelectedPreInvoiceId = (id: string) => setSelectedPreInvoiceIds(id ? [id] : []);
  const togglePreInvoice = (id: string) =>
    setSelectedPreInvoiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  // Per-pre-invoice prepayment amounts for multi-selection runs, seeded to
  // each pre-invoice's expected total when the config step opens.
  const [preInvAmounts, setPreInvAmounts] = useState<Record<string, number>>({});
  // Prepayment (asset) account — the Dr side. An advance anchored to a
  // pre-invoice defaults to the account the pre-invoice itself names,
  // 1205 Advance Payments (BA 9/28: the form defaulted to 1300 while
  // the document said 1205); on-account advances keep 1300. The default
  // tracks the target until the user picks an account by hand.
  const [assetAccount, setAssetAccountRaw] = useState<string>(
    prefill?.preInvoiceId ? ADVANCES_ACCOUNT : DEFAULT_PREPAYMENT_ASSET_ACCOUNT,
  );
  const assetTouchedRef = useRef(false);
  const setAssetAccount = (v: string) => {
    assetTouchedRef.current = true;
    setAssetAccountRaw(v);
  };
  useEffect(() => {
    if (mode !== 'prepay' || assetTouchedRef.current) return;
    setAssetAccountRaw(prepayTarget === 'pre-invoice' ? ADVANCES_ACCOUNT : DEFAULT_PREPAYMENT_ASSET_ACCOUNT);
  }, [mode, prepayTarget]);
  // A/P account (pay mode) — the Dr side, configured exactly like invoicing:
  // auto-derived from the vendor's category, overridable via the GL picker modal.
  const [apAccount, setApAccount] = useState<string>(defaultApAccountForCategory(''));
  const [apModalOpen, setApModalOpen] = useState(false);
  // When linked to a pre-invoice, suggest this advance on that invoice's payment
  // once it converts. Default on (spec §4 Section B).
  // Per-invoice line state (step 2), keyed by invoice id.
  const [lines, setLines] = useState<Record<string, LineState>>(paySeededLines);
  // Whether to apply the vendor's available prepayment credit against their
  // invoices in this run (pay mode), keyed by vendor name. Reduces net-to-pay.
  // (Legacy toggle, still used by the deprecated V1 classic strip.)
  const [prepayApply, setPrepayApply] = useState<Record<string, boolean>>({});
  // Per-record prepayment draws (feedback 7/22/26): vendor → paymentId →
  // amount drawn from that on-account prepayment record in this run. The
  // V2 flow lets the user pick WHICH advances to consume; the drawn total
  // spreads across the vendor's invoices oldest-due-first.
  const [prepayDraws, setPrepayDraws] = useState<Record<string, Record<string, number>>>({});
  // Step 2 — defaults.
  // Defaults to TODAY (user 9/24/26, superseding Nophil 9/23's empty
  // default): most payments are recorded the day they're made, and the
  // date stays fully editable for backdating or scheduling.
  const [paymentDate, setPaymentDate] = useState(() => localTodayIso());
  const [method, setMethod] = useState('Bank Transfer');
  const [methodId, setMethodId] = useState('');
  const [bankAccount, setBankAccount] = useState(PAY_FROM_ACCOUNTS[0].id);
  // ── Per-vendor payment config (feedback 7/21/26) ──
  // A multi-vendor bulk run pays each vendor with ITS OWN method and
  // pay-from account: methods default to the partner module's primary
  // saved method per vendor; overrides live here, keyed by vendor name.
  // cfgMethodVendor / cfgAccountVendor drive the per-vendor picker modals.
  const [vendorPayCfg, setVendorPayCfg] = useState<Record<string, { methodId: string; bankAccount: string }>>({});
  const [cfgMethodVendor, setCfgMethodVendor] = useState<string | null>(null);
  const [cfgAccountVendor, setCfgAccountVendor] = useState<string | null>(null);
  // Bulk setup (feedback 7/21/26): the rail's Payment panel standardizes
  // the whole run in one action — pick a method type + account, Apply.
  // '' method = keep each vendor's own method, apply the account only.
  const [bulkMethodId, setBulkMethodId] = useState('');
  const [bulkAccountId, setBulkAccountId] = useState(PAY_FROM_ACCOUNTS[0].id);
  const [bulkMethodModalOpen, setBulkMethodModalOpen] = useState(false);
  const [bulkAccountModalOpen, setBulkAccountModalOpen] = useState(false);
  // "Other open invoices from this vendor" modal (9/4/26 Eli, BB-27):
  // which vendor's modal is open, its search text, and the picked ids.
  const [addInvVendor, setAddInvVendor] = useState<string | null>(null);
  const [addInvSearch, setAddInvSearch] = useState('');
  const [addInvPicked, setAddInvPicked] = useState<Set<string>>(new Set());
  // Applying a bulk method TYPE re-routes every vendor's method, so it
  // confirms first (feedback 7/21/26): the modal spells out who switches
  // to the type and who falls back to their primary. Account-only
  // applies skip the prompt, nothing surprising happens.
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  // Vendor tab strip (feedback 7/21/26): a multi-vendor run pages ONE
  // vendor card at a time behind PO-style pills below Payment details,
  // same recipe as the Create Vendor Invoice PO tabs.
  const [activeVendorTab, setActiveVendorTab] = useState<string | null>(null);
  const [vendorToRemove, setVendorToRemove] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  // Check printing (BA spec 9/22): single check payments print from the
  // confirm modal — preview → blocking confirm → the payment posts with
  // its issued check number as the reference.
  const [checkPrintOpen, setCheckPrintOpen] = useState(false);
  const [checkInputs, setCheckInputs] = useState<CheckPaymentInput[]>([]);
  // Late-discount prompt (user 9/23 spec): amount equals the discounted
  // total but the window closed at the chosen date → ask whether the
  // vendor allowed it, with a required reason. Declines are remembered
  // per invoice; changing the payment date re-runs every check.
  const [ldQueue, setLdQueue] = useState<{ invId: string; invoiceNumber: string; vendor: string; percent: number; deadline: string; dAmount: number; discounted: number }[]>([]);
  const [ldReason, setLdReason] = useState('');
  const [ldReasonError, setLdReasonError] = useState(false);
  const [ldDeclined, setLdDeclined] = useState<Set<string>>(new Set());
  useEffect(() => {
    // A new payment date re-runs the checks (user 9/23): late-discount
    // decisions reset; the typed amounts stay untouched.
    setLdDeclined(new Set());
    setLines((prev) => {
      let changed = false;
      const next: typeof prev = {};
      for (const [id, l] of Object.entries(prev)) {
        if (l.lateDiscount) { changed = true; next[id] = { ...l, lateDiscount: undefined }; }
        else next[id] = l;
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentDate]);
  // Payment instrument validation (design review 7/9/26; check spec
  // 7/19/26): check numbers are unique PER pay-from account, wire and
  // other references unique globally — the same check or wire can never
  // sit on two payments. The duplicate payment is kept as an object so
  // the error can LINK to it.
  const referenceDup = useMemo(() => {
    const ref = reference.trim();
    if (!ref) return null;
    return payments.find((p) => {
      if (!p.reference || p.reference.toLowerCase() !== ref.toLowerCase()) return false;
      if (method === 'Check') return p.bankAccount === bankAccount;
      return true;
    }) ?? null;
  }, [reference, method, bankAccount, payments]);
  const referenceError = useMemo(() => {
    const ref = reference.trim();
    if (!ref) return null;
    // Check numbers must be NUMERIC (spec 7/19/26) — an optional CHK-
    // prefix is tolerated, anything else is rejected.
    if (method === 'Check' && !/^(CHK-?)?\d+$/i.test(ref)) {
      return 'Check numbers must be numeric (e.g. CHK-45061 or 45061).';
    }
    if (!referenceDup) return null;
    return method === 'Check'
      ? `Check No. ${ref} was already issued from this account. Check numbers can't be reused per account.`
      : `Reference ${ref} is already on another payment. Wire and reference numbers can't be reused.`;
  }, [reference, method, referenceDup]);
  // Check sequencing (meeting feedback 7/17/26): highest check number
  // already issued from the selected account — drives the next-number
  // prefill and the out-of-sequence warning.
  const lastCheckNumber = useMemo(() => {
    const nums = payments
      .filter((p) => p.bankAccount === bankAccount)
      .map((p) => /^CHK-?(\d+)$/i.exec(p.reference ?? '')?.[1])
      .filter((n): n is string => !!n)
      .map(Number);
    return nums.length ? Math.max(...nums) : null;
  }, [payments, bankAccount]);
  const referenceAutoFilled = useRef(false);
  const [memo, setMemo] = useState('');
  // Short memo line that prints on the check / transmits in the ACH/wire field
  // (Eli 7/22/26) — separate from the long-form Description. Deliberately hard-
  // limited per instrument (the printable/transmittable standards).
  const [printMemo, setPrintMemo] = useState('');
  // Anchored-prepayment rows the user has manually edited (Eli 7/22/26 — "what
  // if part of this applied to that one?"): once touched, the auto-apply effect
  // stops forcing the anchored amount so the field is genuinely editable.
  const [anchoredTouched, setAnchoredTouched] = useState<Set<string>>(new Set());
  // Prepayment-only fields.
  const [prepayAmount, setPrepayAmount] = useState<number>(0);
  const [prepayPO, setPrepayPO] = useState('');
  // Inline field errors surfaced on submit (partner-style red highlight +
  // helper text under the field instead of a toast). Cleared as the user types.
  const [fieldErrors, setFieldErrors] = useState<{ amount?: string; description?: string; reference?: string; paymentDate?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  // GL depth on confirmations is a system setting (8/5/26): the journal
  // table shows for controllers, everyone else confirms without it.
  const { showGlOnConfirmations } = useSystemSettings();
  // Explicit "resolve prepayments first?" gate (Eli 7/22/26): when the config
  // step opens on a pay flow whose vendor(s) carry available prepayment credit,
  // surface a deliberate modal — skipping past it is a conscious click, and the
  // Available-prepayments panel stays afterward for skippers.
  const [prepayPrompt, setPrepayPrompt] = useState<'unshown' | 'open' | 'dismissed'>('unshown');
  // "Review prepayments" routes into the Apply-prepayment-credit modal for
  // the first credited vendor — a bumped signal opens that vendor's picker.
  const [prepayReview, setPrepayReview] = useState<{ vendor: string; n: number }>({ vendor: '', n: 0 });
  // Overdraw acknowledgment (Eli 7/24/26): recording more than the available
  // cash risks bounced payments, "nearly the worst thing you can do in
  // business" — the user must consciously confirm before the GL review.
  // A legit case exists (wiring funds in tomorrow), so it never blocks.
  const [overdrawAckOpen, setOverdrawAckOpen] = useState(false);
  const [payFromModalOpen, setPayFromModalOpen] = useState(false);
  const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [recorded, setRecorded] = useState<RecordedRecord[] | null>(null);
  // The stage swaps (vendor → payment type → config) reuse ONE scroll
  // container — a stale scrollTop from a long Step 1 list made the next
  // stage land mid-scroll and visibly jump (glitch fix 7/27/26).
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyScrollRef.current?.scrollTo({ top: 0 });
  }, [entryStage, step, recorded]);
  // Discard guard — shown when the user backs out / cancels with unsaved
  // selections. discardVariant decides whether confirming steps back to the
  // type picker, closes the flow, or (non-destructively) returns to step 1.
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  // 'step1' is a non-destructive "go back to selection" guard (keeps entered data);
  // 'close'/'back' are the destructive discard variants.
  const [discardVariant, setDiscardVariant] = useState<'close' | 'back' | 'step1' | 'choose'>('close');
  // Sidebar totals breakdown (pinned footer) collapse state, collapsed by default.
  // Proof-of-payment attachments (UI only, mirrors the invoicing attachments).
  const [attachments, setAttachments] = useState<{ name: string }[]>([]);

  // Auto-generated internal ID (10/29): the next PMT-n, previewed here
  // and claimed per record when the payment is recorded.
  const idBase = useMemo(
    () => peekPaymentNumber(),
    [mode],
  );

  // ── Derived data ──
  // Committed money in motion is unpayable here (9/22/26 review
  // response, GPT C07-D1/C08-X2): an invoice with a live line in an open
  // run, or one covered by a recorded SCHEDULED payment, never appears
  // in step 2 — that's the double-payment door both reviews walked
  // through (INV-000048).
  const committedByRun = useMemo(() => openRunInvoiceIds(runs), [runs]);
  const scheduledInvoiceNumbers = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => {
      if (p.status !== 'Scheduled') return;
      (p.appliedInvoices ?? []).forEach((a) => set.add(a.invoiceNumber));
    });
    return set;
  }, [payments]);
  // The invoice currency each vendor's payment settles (Currency & Exchange
  // Rates: one payment can't mix currencies). Unset means the vendor's own
  // currency, else the earliest-due open invoice's.
  const [invoiceCurrencyByVendor, setInvoiceCurrencyByVendor] = useState<Record<string, string>>(paySeededCurrency);
  const vendorRows = useMemo(() => {
    const byVendor = new Map<string, { open: Invoice[]; closed: Invoice[]; due: number }>();
    invoices.forEach((inv) => {
      const entry = byVendor.get(inv.vendor) ?? { open: [], closed: [], due: 0 };
      // Pre-invoices settle through the ADVANCE flow, never ordinary AP
      // settlement (9/22/26, GPT C08-X3 qualification): pay mode's open
      // list is regular invoices only.
      const ordinarilyPayable = mode === 'pay' ? inv.type !== 'Pre-Invoice' : true;
      if (isPayable(inv) && ordinarilyPayable && !committedByRun.has(inv.id) && !scheduledInvoiceNumbers.has(inv.invoiceNumber)) {
        entry.open.push(inv);
        entry.due += inv.outstandingBalance;
      } else if (inv.status === 'Paid in Full' || inv.status === 'Settled') {
        entry.closed.push(inv);
      }
      byVendor.set(inv.vendor, entry);
    });
    return Array.from(byVendor.entries())
      .map(([vendor, v]) => {
        const allOpen = v.open.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        // One payment can't mix currencies (Currency & Exchange Rates): a
        // vendor with open invoices in two currencies pays one currency's
        // invoices per payment; the rest wait for a payment of their own.
        const currencyCounts: { code: string; count: number }[] = [];
        allOpen.forEach((inv) => {
          const c = currencyCounts.find((x) => x.code === invCurrency(inv));
          if (c) c.count += 1;
          else currencyCounts.push({ code: invCurrency(inv), count: 1 });
        });
        const codes = currencyCounts.map((c) => c.code);
        const own = vendorPaymentCurrency(vendor).toUpperCase();
        const picked = invoiceCurrencyByVendor[vendor];
        const currency = picked && codes.includes(picked)
          ? picked
          : codes.includes(own)
            ? own
            : codes[0] ?? (v.closed[0] ? invCurrency(v.closed[0]) : own);
        const open = codes.length > 1 ? allOpen.filter((inv) => invCurrency(inv) === currency) : allOpen;
        return {
          vendor,
          open,
          closed: v.closed.sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
          due: Math.round(open.reduce((sum, inv) => sum + inv.outstandingBalance, 0) * 100) / 100,
          terms: mockVendors.find((mv) => mv.vendorName === vendor)?.paymentTerms ?? 'Net 30',
          currency,
          /** Open invoices per currency, when the vendor has more than one. */
          currencyCounts: codes.length > 1 ? currencyCounts : [],
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, mode, committedByRun, scheduledInvoiceNumbers, invoiceCurrencyByVendor]);

  // Invoice-level filters (due-date range + balance-due range) applied to a
  // vendor's open invoices for both inclusion and the expanded preview.
  const invoiceMatchesFilters = (inv: Invoice) => {
    if (dueFrom && inv.dueDate < dueFrom) return false;
    if (dueTo && inv.dueDate > dueTo) return false;
    const min = amountMin ? parseFloat(amountMin) : null;
    const max = amountMax ? parseFloat(amountMax) : null;
    if (min !== null && inv.outstandingBalance < min) return false;
    if (max !== null && inv.outstandingBalance > max) return false;
    if (filterOverdue && !(new Date(inv.dueDate) < new Date())) return false;
    return true;
  };

  // Prepayment can target ANY vendor (advance before an invoice exists); pay
  // mode only lists vendors with payable open invoices.
  const baseRows = useMemo(() => {
    if (mode === 'pay') return vendorRows.filter((r) => r.open.length > 0 || (includePaid && r.closed.length > 0));
    const known = new Set(vendorRows.map((r) => r.vendor));
    const extra = mockVendors
      .filter((mv) => !known.has(mv.vendorName))
      .map((mv) => ({ vendor: mv.vendorName, open: [] as Invoice[], closed: [] as Invoice[], due: 0, terms: mv.paymentTerms ?? 'Net 30', currency: vendorPaymentCurrency(mv.vendorName), currencyCounts: [] as { code: string; count: number }[] }));
    return [...vendorRows, ...extra];
  }, [vendorRows, mode, includePaid]);

  const filteredVendorRows = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    const iq = invoiceSearch.trim().toLowerCase();
    const pq = poSearch.trim().toLowerCase();
    const gq = grnSearch.trim().toLowerCase();
    const hasInvFilters = filterOverdue || !!dueFrom || !!dueTo || !!amountMin || !!amountMax;
    const preInvoiceMode = mode === 'prepay' && prepayTarget === 'pre-invoice';
    return baseRows.filter((r) => {
      if (q) {
        const vendorMatch = r.vendor.toLowerCase().includes(q);
        // In prepay pre-invoice mode, also match on the vendor's pre-invoice IDs.
        const preInvMatch = preInvoiceMode && invoices.some(
          (inv) => inv.type === 'Pre-Invoice' && inv.vendor === r.vendor && inv.invoiceNumber.toLowerCase().includes(q),
        );
        if (!vendorMatch && !preInvMatch) return false;
      }
      const pool = includePaid ? [...r.open, ...r.closed] : r.open;
      if (iq && !pool.some((inv) => inv.invoiceNumber.toLowerCase().includes(iq) || inv.vendorInvoiceNumber?.toLowerCase().includes(iq))) return false;
      if (pq && !pool.some((inv) => inv.linkedPOs.some((p) => p.toLowerCase().includes(pq)))) return false;
      if (gq && !pool.some((inv) => inv.linkedGRNs.some((g) => g.toLowerCase().includes(gq)))) return false;
      // Invoice-level filters apply to open invoices; a closed-only vendor
      // (when Include paid is on) stays regardless so its history shows.
      if (hasInvFilters && r.open.length > 0 && !r.open.some(invoiceMatchesFilters)) {
        if (!(includePaid && r.closed.length > 0)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRows, vendorSearch, invoiceSearch, poSearch, grnSearch, filterOverdue, includePaid, dueFrom, dueTo, amountMin, amountMax, mode, prepayTarget, invoices]);

  const sortedVendorRows = useMemo(() => {
    const arr = [...filteredVendorRows];
    const today = localTodayIso();
    const overdueCount = (r: (typeof arr)[number]) => r.open.filter((inv) => inv.dueDate && inv.dueDate < today).length;
    // Vendors settle in different currencies, so amounts compare in the base
    // currency, each invoice at its own rate (Currency & Exchange Rates).
    const dueBase = new Map(arr.map((r) => [r.vendor, r.open.reduce((sum, inv) => sum + toInvoiceBase(inv, inv.outstandingBalance), 0)]));
    const due = (r: (typeof arr)[number]) => dueBase.get(r.vendor) ?? 0;
    switch (sortKey) {
      case 'dueAsc': arr.sort((a, b) => due(a) - due(b)); break;
      case 'dueDate': arr.sort((a, b) => (a.open[0]?.dueDate || '9999').localeCompare(b.open[0]?.dueDate || '9999')); break;
      case 'dueDateDesc': arr.sort((a, b) => (b.open[0]?.dueDate || '0000').localeCompare(a.open[0]?.dueDate || '0000')); break;
      case 'overdueDesc': arr.sort((a, b) => overdueCount(b) - overdueCount(a) || due(b) - due(a)); break;
      case 'invoicesDesc': arr.sort((a, b) => b.open.length - a.open.length || due(b) - due(a)); break;
      case 'vendorAZ': arr.sort((a, b) => a.vendor.localeCompare(b.vendor)); break;
      case 'vendorZA': arr.sort((a, b) => b.vendor.localeCompare(a.vendor)); break;
      default: arr.sort((a, b) => due(b) - due(a));
    }
    return arr;
  }, [filteredVendorRows, sortKey]);

  const hasActiveFilters = vendorSearch !== '' || invoiceSearch !== '' || poSearch !== '' || grnSearch !== '' || filterOverdue
    || includePaid || dueFrom !== '' || dueTo !== '' || amountMin !== '' || amountMax !== '';
  const clearAllFilters = () => {
    setVendorSearch(''); setInvoiceSearch(''); setPoSearch(''); setGrnSearch(''); setFilterOverdue(false); setIncludePaid(false);
    setDueFrom(''); setDueTo(''); setAmountMin(''); setAmountMax('');
  };
  const hasUserInput = hasActiveFilters;

  const selectedRows = baseRows.filter((r) => selectedVendors.includes(r.vendor));

  // Payment method options come from the partner: for a single vendor we offer
  // exactly the methods that vendor accepts (defaulting to its primary). For a
  // multi-vendor run one method applies to all, so we fall back to the full set.
  const methodVendorName = (mode === 'prepay' || selectedVendors.length === 1) ? selectedVendors[0] : undefined;
  // Concrete saved methods (each its own card with bank/account detail), so the
  // user sees exactly which account they're paying from. Multi-vendor runs use a
  // generic type-only set.
  const vendorMethods = useMemo(
    () => (methodVendorName ? vendorPaymentMethods(methodVendorName) : genericPaymentMethods()),
    [methodVendorName],
  );
  const resolvedMethodRaw =
    vendorMethods.find((m) => m.id === methodId) ??
    vendorMethods.find((m) => m.isPrimary) ??
    vendorMethods[0];
  // Method and funding account stay compatible BOTH ways (Sep 8 VI-D15;
  // 9/22/26 review response, GPT RR09): funding moved to an account the
  // resolved method can't draw from (e.g. petty cash under an ACH card),
  // the vendor method stops resolving and the generic method state
  // (Cash / Card / Bank Transfer set by onAccountApply) drives the
  // display and the trace fields instead of a stale ACH card.
  const acctForCompat = PAY_FROM_ACCOUNTS.find((a) => a.id === bankAccount);
  const resolvedMethod = resolvedMethodRaw && acctForCompat
    ? (() => {
        const tp = accountTypeForMethod(resolvedMethodRaw.type);
        return tp === 'any' || tp === acctForCompat.type ? resolvedMethodRaw : undefined;
      })()
    : resolvedMethodRaw;

  // Bank matcher shared by BOTH directions of the method↔account link
  // (Eli 9/24: "these are linked events, they can't disagree"). Exact
  // name equality wins before the loose substring test, so "PNC Bank"
  // never half-matches "PNC Bank Card" ahead of its true sibling.
  const bankMatches = (a?: string, b?: string) => {
    if (!a || !b) return false;
    const x = a.toLowerCase().trim();
    const y = b.toLowerCase().trim();
    return x === y || x.includes(y) || y.includes(x);
  };
  const pickByBank = <T extends { bankName?: string }>(pool: T[], bankName?: string): T | undefined => {
    if (!bankName) return undefined;
    const bn = bankName.toLowerCase().trim();
    return (
      pool.find((p) => p.bankName?.toLowerCase().trim() === bn) ??
      pool.find((p) => bankMatches(p.bankName, bankName))
    );
  };
  // Derive the pay-from account that matches a method: same bank where
  // possible, else the first account of the method's class.
  const deriveAccountId = (type?: string, bankName?: string) => {
    const tp = type ? accountTypeForMethod(type) : 'any';
    const pool = tp === 'any' ? PAY_FROM_ACCOUNTS : PAY_FROM_ACCOUNTS.filter((a) => a.type === tp);
    const match = pickByBank(pool, bankName);
    return (match ?? pool[0] ?? PAY_FROM_ACCOUNTS[0]).id;
  };
  const defaultCfgFor = (vendor: string) => {
    const ms = vendorPaymentMethods(vendor);
    const m = ms.find((x) => x.isPrimary) ?? ms[0];
    return { methodId: m?.id ?? '', bankAccount: deriveAccountId(m?.type, m?.bankName) };
  };
  const cfgFor = (vendor: string) => vendorPayCfg[vendor] ?? defaultCfgFor(vendor);
  const cfgMethodFor = (vendor: string) => {
    const ms = vendorPaymentMethods(vendor);
    return ms.find((m) => m.id === cfgFor(vendor).methodId) ?? ms.find((m) => m.isPrimary) ?? ms[0];
  };
  const isMultiVendorPay = mode === 'pay' && selectedVendors.length > 1;
  // Active vendor card in a multi-vendor run — driven by the tab strip;
  // falls back to the first vendor when the tab points at a removed one.
  const activePayVendor =
    activeVendorTab && selectedVendors.includes(activeVendorTab)
      ? activeVendorTab
      : selectedRows[0]?.vendor ?? selectedVendors[0];
  const removeVendorFromRun = (vendor: string) => {
    setSelectedVendors((prev) => prev.filter((v) => v !== vendor));
    setVendorPayCfg((prev) => {
      if (!(vendor in prev)) return prev;
      const next = { ...prev };
      delete next[vendor];
      return next;
    });
    if (activeVendorTab === vendor) setActiveVendorTab(null);
    setVendorToRemove(null);
    toast.success(`${vendor} removed from this run`);
  };
  // Who gets the bulk method type and who keeps their primary — feeds
  // both the confirm modal and the apply itself so they can never drift.
  const bulkMethodPreview = (id: string) => {
    const gm = genericPaymentMethods().find((m) => m.id === id);
    if (!gm) return null;
    const gets: Array<{ vendor: string; method: VendorPaymentMethod }> = [];
    const keeps: Array<{ vendor: string; method: VendorPaymentMethod | undefined }> = [];
    selectedVendors.forEach((v) => {
      const ms = vendorPaymentMethods(v);
      const match = ms.find((m) => m.type === gm.type);
      if (match) gets.push({ vendor: v, method: match });
      else keeps.push({ vendor: v, method: ms.find((m) => m.isPrimary) ?? ms[0] });
    });
    return { gm, gets, keeps };
  };
  // Bulk apply: standardize the run from the rail — the chosen method
  // TYPE where each vendor accepts it (their primary stays otherwise),
  // and the chosen pay-from account for everyone. No method chosen =
  // account-only apply, every vendor keeps its own method.
  const applyBulkToAll = () => {
    const preview = bulkMethodPreview(bulkMethodId);
    setVendorPayCfg((prev) => {
      const next = { ...prev };
      selectedVendors.forEach((v) => {
        const ms = vendorPaymentMethods(v);
        const chosen = preview
          ? ms.find((m) => m.type === preview.gm.type) ?? ms.find((m) => m.isPrimary) ?? ms[0]
          : cfgMethodFor(v);
        next[v] = { methodId: chosen?.id ?? '', bankAccount: bulkAccountId };
      });
      return next;
    });
    const acctLabel = PAY_FROM_ACCOUNTS.find((a) => a.id === bulkAccountId)?.label ?? 'the selected account';
    toast.success(`Applied to all ${selectedVendors.length} vendors`, {
      description: preview
        ? `${preview.gets.length} vendor${preview.gets.length === 1 ? '' : 's'} now pay by ${preview.gm.nickname}${preview.keeps.length > 0 ? `, ${preview.keeps.length} kept their primary method` : ''}. Paying from ${acctLabel}.`
        : `Paying from ${acctLabel}; each vendor keeps its own method.`,
    });
    setBulkConfirmOpen(false);
  };

  // Reference field identity follows the method (feedback 7/14/26): a check
  // payment records a check number, a wire its confirmation, and so on.
  // Formats mirror refFor() in mockPayments so examples look like real data.
  const REFERENCE_FIELD_META: Record<string, { label: string; placeholder: string }> = {
    Check: { label: 'Check No.', placeholder: 'e.g. CHK-40213' },
    ACH: { label: 'ACH Trace Number', placeholder: 'e.g. ACH-901234' },
    Wire: { label: 'Wire Confirmation Number', placeholder: 'e.g. WIRE-704512' },
    'Bank Transfer': { label: 'Transfer Reference', placeholder: 'e.g. TRF-305678' },
    Card: { label: 'Card Authorization Number', placeholder: 'e.g. CARD-6123' },
    Cash: { label: 'Cash Receipt Number', placeholder: 'e.g. CASH-2201' },
  };
  const refFieldMeta =
    REFERENCE_FIELD_META[resolvedMethod ? resolvedMethod.type : method] ??
    { label: 'Reference No.', placeholder: 'Check No., wire confirmation, ACH trace…' };
  const methodType = resolvedMethod ? resolvedMethod.type : method;
  // A manual ACH or wire carries its reference (Aug 31 rule; 9/22/26
  // review response, GPT C10-D1): the trace/confirmation number is the
  // proof of payment, so those methods can't record without one. Checks
  // get their number at print; other methods stay optional.
  const referenceRequired = methodType === 'ACH' || methodType === 'Wire';
  // Per-instrument memo character limits (Eli 7/22/26 — the rare hard-limit
  // case): check memo 80 (reconciled 7/24/26, was 60), ACH addenda ~80, a
  // Fedwire OBI field ~140. Print-side overflow wraps to a second line on
  // the check (checkPrint.ts), so the limit is about transmit fields.
  // Card 80, Wire 140, every other method 100 (10/29).
  const memoLimit = memoLimitFor(methodType);
  // There's ALWAYS a memo (Eli 7/24/26) — every payment type, every method.
  const showPrintMemo = true;
  // defaultPrintMemo is declared further down (it reads the invoice
  // selection, which isn't initialized yet at this point).

  // Pre-populate the NEXT check number for the chosen account (meeting
  // feedback 7/17/26). A hand-edited number is never overwritten; a
  // prefilled one refreshes when the account or method changes, and
  // clears again when the method moves off Check.
  useEffect(() => {
    if (methodType !== 'Check') {
      if (referenceAutoFilled.current) {
        setReference('');
        referenceAutoFilled.current = false;
      }
      return;
    }
    if ((reference.trim() === '' || referenceAutoFilled.current) && lastCheckNumber != null) {
      setReference(`CHK-${lastCheckNumber + 1}`);
      referenceAutoFilled.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodType, bankAccount, lastCheckNumber]);

  // Non-blocking amber warning (spec 7/19/26): a number LOWER than the
  // last recorded check, or a BIG JUMP ahead, warns and asks for a
  // confirm on the review sheet — it never blocks, split checkbooks are
  // legitimate. Duplicates and non-numeric input hard-block separately.
  const BIG_JUMP = 100;
  const referenceWarning = useMemo(() => {
    if (methodType !== 'Check' || referenceError) return null;
    const m = /^(?:CHK-?)?(\d+)$/i.exec(reference.trim());
    if (!m || lastCheckNumber == null) return null;
    const n = Number(m[1]);
    // Any out-of-sequence entry warns in BOTH directions (Eli 7/22/26); it
    // never blocks. The expected next check is lastCheckNumber + 1.
    if (n <= lastCheckNumber) {
      return `Out of sequence: this is lower than the last recorded check (${lastCheckNumber}) on this account.`;
    }
    if (n > lastCheckNumber + 1) {
      const skipped = n - lastCheckNumber - 1;
      // A big forward jump (>100) gets the specific stronger warning.
      if (n > lastCheckNumber + BIG_JUMP) {
        return `Big jump ahead: this skips ${skipped} numbers past the last recorded check (${lastCheckNumber}).`;
      }
      return `Out of sequence: this skips ${skipped} number${skipped === 1 ? '' : 's'} ahead of the last recorded check (${lastCheckNumber}).`;
    }
    return null;
  }, [methodType, reference, lastCheckNumber, referenceError]);

  // ── Prepay-specific derived data (spec §3/§4) ──
  const prepayVendor = mode === 'prepay' ? selectedVendors[0] : undefined;
  // Currency is inherited from the vendor and locked for the prepayment.
  const prepayCurrency = useMemo(
    () => (prepayVendor ? vendorPaymentCurrency(prepayVendor) : BASE_CURRENCY),
    [prepayVendor],
  );

  // ── Currency & Exchange Rates ─────────────────────────────────────────
  // Every amount on a vendor's card is in its invoices' currency (`fmt`
  // shadows the module's $ formatter). The payment goes out in the vendor's
  // currency or the base currency (Payment Currency); its rate is the
  // invoices' currency on the payment date, which a role allowed to
  // (Settings, Permissions) may change to the bank's. Settling each invoice
  // at it, against the invoice's own rate, leaves the exchange difference.
  const apPerms = useApPermissions();
  const rowCurrency = (vendor?: string) =>
    vendor ? (baseRows.find((r) => r.vendor === vendor)?.currency ?? vendorPaymentCurrency(vendor)) : BASE_CURRENCY;
  const flowCurrency = mode === 'prepay' ? prepayCurrency : rowCurrency(activePayVendor);
  const fmt = (n: number) => formatMoney(n, flowCurrency);
  const fmtIn = (code: string) => (n: number) => formatMoney(n, code);
  const [payCurrencyByVendor, setPayCurrencyByVendor] = useState<Record<string, string>>({});
  const [payRateTypedByVendor, setPayRateTypedByVendor] = useState<Record<string, string | null>>({});
  /** The currency the payment to this vendor goes out in. */
  const payCurrencyFor = (vendor?: string) =>
    mode === 'prepay' ? prepayCurrency : (vendor && payCurrencyByVendor[vendor]) || rowCurrency(vendor);
  /** The invoices' currency, the one the payment's rate converts. */
  const settledCurrencyFor = (vendor?: string) => (mode === 'prepay' ? prepayCurrency : rowCurrency(vendor));
  const payQuoteFor = (vendor?: string) => {
    const cur = settledCurrencyFor(vendor);
    return isBaseCurrency(cur) ? 1 : rateOn(cur, paymentDate, 'mid').rate;
  };
  /** The payment's rate: the bank's when one was entered (and the role may), else the table's. */
  const payRateFor = (vendor?: string) => {
    const quote = payQuoteFor(vendor) ?? 1;
    const typed = vendor ? payRateTypedByVendor[vendor] : null;
    const n = typed != null && typed.trim() !== '' ? Number(typed) : null;
    return apPerms.canChangePaymentRate && n != null && n > 0 ? n : quote;
  };
  const payRateEditedFor = (vendor?: string) => payRateFor(vendor) !== (payQuoteFor(vendor) ?? 1);
  /** An amount in the invoices' currency, as it goes out in the payment currency. */
  const inPayCurrency = (vendor: string | undefined, n: number) =>
    payCurrencyFor(vendor) === settledCurrencyFor(vendor) ? n : toBase(n, payRateFor(vendor));
  // Pre-invoices belonging to the chosen vendor (proformas billed before a real
  // invoice exists). mockInvoices marks these with type 'Pre-Invoice'.
  const vendorPreInvoices = useMemo(
    () => (prepayVendor ? invoices.filter((inv) => inv.type === 'Pre-Invoice' && inv.vendor === prepayVendor) : []),
    [invoices, prepayVendor],
  );
  const selectedPreInvoice = useMemo(
    () => vendorPreInvoices.find((inv) => inv.id === selectedPreInvoiceId) ?? null,
    [vendorPreInvoices, selectedPreInvoiceId],
  );
  // All selected pre-invoices (multi-run) — resolved from the full invoice
  // set so the list survives the pay→prepay mode flip at Continue time.
  const selectedPreInvoices = useMemo(
    () => selectedPreInvoiceIds.map((id) => invoices.find((i) => i.id === id)).filter((i): i is Invoice => !!i),
    [selectedPreInvoiceIds, invoices],
  );
  const multiPrepay = prepayTarget === 'pre-invoice' && selectedPreInvoices.length > 1;
  // Seed the per-pre-invoice amounts (expected totals) + their sum as the
  // run's prepayAmount when the config step opens.
  const seedPreInvoiceAmounts = (ids: string[]) => {
    // Amounts start EMPTY (user 9/25, Eli's 9/8 rule for the pay flow):
    // prepaying in full is a deliberate act — the Prepay-in-full chip —
    // never an assumption.
    const map: Record<string, number> = {};
    ids.forEach((id) => {
      map[id] = 0;
    });
    setPreInvAmounts(map);
    setPrepayAmount(0);
    if (ids.length === 1) {
      const first = invoices.find((i) => i.id === ids[0]);
      if (first?.linkedPOs?.length) setPrepayPO(first.linkedPOs[0]);
    }
  };
  const setPreInvAmount = (id: string, v: number) => {
    setPreInvAmounts((prev) => {
      const next = { ...prev, [id]: v };
      const sum = selectedPreInvoiceIds.reduce((s, x) => s + (next[x] || 0), 0);
      setPrepayAmount(Math.round(sum * 100) / 100);
      return next;
    });
  };
  // Remove a pre-invoice from the run (user 9/25: the trash icon was
  // missing here) — the selection shrinks and the total re-sums.
  const removePreInvoice = (id: string) => {
    const nextIds = selectedPreInvoiceIds.filter((x) => x !== id);
    setSelectedPreInvoiceIds(nextIds);
    setPreInvAmounts((prev) => {
      const next = { ...prev };
      delete next[id];
      const sum = nextIds.reduce((s, x) => s + (next[x] || 0), 0);
      setPrepayAmount(Math.round(sum * 100) / 100);
      return next;
    });
  };
  // ── Bulk selection + remove prompts (user 9/26): the creation form's
  // line-item interactions, mirrored on the step-3 tables. Rows carry
  // checkboxes; a red "Remove N" action appears with a selection; every
  // removal — single trash or bulk — confirms through the same red
  // prompt the invoice form uses. ──
  const [rowPick, setRowPick] = useState<Set<string>>(new Set());
  const toggleRowPick = (id: string) =>
    setRowPick((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [removePrompt, setRemovePrompt] = useState<{ kind: 'pay' | 'prepay'; ids: string[]; label?: string } | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setRowPick(new Set()); }, [step, mode, prepayTarget]);
  const removePayLines = (ids: string[]) => {
    setLines((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = { ...(next[id] ?? { selected: true, amount: 0 }), selected: false, amount: 0, prepayApplied: 0 };
      });
      return next;
    });
  };
  const removePreInvoicesBatch = (ids: string[]) => {
    const nextIds = selectedPreInvoiceIds.filter((x) => !ids.includes(x));
    setSelectedPreInvoiceIds(nextIds);
    setPreInvAmounts((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      const sum = nextIds.reduce((s, x) => s + (next[x] || 0), 0);
      setPrepayAmount(Math.round(sum * 100) / 100);
      return next;
    });
  };
  const confirmRemovePrompt = () => {
    if (!removePrompt) return;
    if (removePrompt.kind === 'pay') removePayLines(removePrompt.ids);
    else removePreInvoicesBatch(removePrompt.ids);
    setRowPick(new Set());
    const n = removePrompt.ids.length;
    toast.success(n === 1 ? `${removePrompt.label ?? 'Invoice'} removed` : `${n} invoices removed`, {
      description: removePrompt.kind === 'pay' ? 'The balance stays payable on the invoice list.' : 'The pre-invoices stay open to prepay later.',
    });
    setRemovePrompt(null);
  };

  // Pre-invoices still open for this vendor and not on the run yet —
  // feeds the "+ Add other pre-invoices" control (user 9/25).
  const addablePreInvoices = useMemo(() => {
    const vendor = selectedVendors[0];
    if (!vendor) return [] as Invoice[];
    return invoices.filter(
      (inv) =>
        inv.type === 'Pre-Invoice' &&
        inv.vendor === vendor &&
        inv.status !== 'Cancelled' &&
        inv.outstandingBalance > 0 &&
        !selectedPreInvoiceIds.includes(inv.id),
    );
  }, [invoices, selectedVendors, selectedPreInvoiceIds]);
  const addPreInvoice = (pi: Invoice) => {
    setSelectedPreInvoiceIds((prev) => [...prev, pi.id]);
    setPreInvAmounts((prev) => {
      // Added rows start EMPTY too (user 9/25) — Prepay in full fills.
      const next = { ...prev, [pi.id]: 0 };
      const sum = [...selectedPreInvoiceIds, pi.id].reduce((s, x) => s + (next[x] || 0), 0);
      setPrepayAmount(Math.round(sum * 100) / 100);
      return next;
    });
  };
  // The pre-invoice prepayment section (Eli 9/25, unified single + multi):
  // the SAME anatomy as the pay flow's "Invoices To Pay" — header band
  // with Total, Prepay in full and Add other pre-invoices; a real table
  // with linked IDs, the payment-date-aware due pill, Expected total,
  // the Discount column (payment terms can be prepayment terms too), the
  // amount input, and a per-row remove. One recipe for every invoice type.
  const renderMultiPrepayRows = () => (
    <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50 rounded-t-lg flex-wrap">
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-violet-50 text-violet-600"><Receipt className="w-3.5 h-3.5" /></div>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Pre-Invoices To Prepay</span>
          {/* The applies-automatically fact lives HERE now (user 9/25):
              the full-width banner repeated what this table already shows. */}
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="inline-flex cursor-help">
                <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] z-[300]">
              <p className="text-[11px] text-slate-500 leading-snug">
                Each prepayment stays with its pre-invoice and sits on its PO. Once the PO has receiving, the prepayment applies automatically when you record payment.
              </p>
            </TooltipContent>
          </Tooltip>
        </span>
        <span className="ml-auto text-[12px] " style={{ fontWeight: 700 }}>Total Prepayment {fmt(prepayAmount)}</span>
        {/* One-click full fill, the pay flow's "Pay in full" sibling. */}
        <button
          type="button"
          onClick={() => selectedPreInvoices.forEach((pi) => setPreInvAmount(pi.id, pi.outstandingBalance))}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 bg-white text-[11px] text-primary hover:bg-accent transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          <Banknote className="w-3 h-3" /> Prepay in Full
        </button>
        {/* Bulk remove (user 9/26): the creation form's red action —
            appears with a selection, confirms through the same prompt. */}
        {(() => {
          const picked = selectedPreInvoices.filter((pi) => rowPick.has(pi.id));
          if (picked.length === 0) return null;
          return (
            <button
              type="button"
              onClick={() => setRemovePrompt({ kind: 'prepay', ids: picked.map((pi) => pi.id), label: picked.length === 1 ? picked[0].invoiceNumber : undefined })}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-red-50 text-[11px] text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Trash2 className="w-3 h-3" /> Remove {picked.length === 1 ? picked[0].invoiceNumber : `${picked.length} Pre-Invoices`}
            </button>
          );
        })()}
        {/* Add other pre-invoices (user 9/25): the pay flow's Add-invoices
            recipe. Greyed with the reason when the vendor has none left. */}
        {addablePreInvoices.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/50 bg-white text-[11px] text-primary hover:bg-accent hover:border-primary transition-colors cursor-pointer"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3 h-3" />
                Add Other Pre-Invoices
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-primary text-[9px] " style={{ fontWeight: 700 }}>
                  {addablePreInvoices.length}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[300] w-64">
              {addablePreInvoices.map((pi) => (
                <DropdownMenuItem key={pi.id} className="cursor-pointer justify-between gap-3" onClick={() => addPreInvoice(pi)}>
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Receipt className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="truncate" style={{ fontWeight: 500 }}>{pi.invoiceNumber}</span>
                  </span>
                  <span className="text-slate-500 shrink-0" style={{ fontWeight: 600 }}>{fmt(pi.amount)}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled
                aria-disabled
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-[11px] text-slate-400 cursor-not-allowed"
                style={{ fontWeight: 600 }}
              >
                <Plus className="w-3 h-3" />
                Add Other Pre-Invoices
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] z-[300]">
              <p className="text-[11px] text-slate-500 leading-snug">
                No other open pre-invoices for {selectedVendors[0] ?? 'this vendor'}. Create one from step 2's Create menu.
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {/* Terms line — the pay section's recipe: each row carries its own
          dates and discount (prepayment terms discount too). */}
      <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-2 text-[12px]">
        <FileText className="w-3.5 h-3.5 text-slate-300 shrink-0" />
        <span className="text-slate-400" style={{ fontWeight: 600 }}>Terms</span>
        <span className="text-slate-500 truncate">
          Each pre-invoice row carries its own dates and discount.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50/60 border-b border-slate-100">
            <tr>
              {/* Bulk selection (user 9/26): the creation form's line-item
                  checkboxes, here to remove several at once. */}
              <th className="w-9 pl-4 pr-1 py-2">
                <Checkbox
                  checked={
                    selectedPreInvoices.length > 0 && selectedPreInvoices.every((pi) => rowPick.has(pi.id))
                      ? true
                      : selectedPreInvoices.some((pi) => rowPick.has(pi.id))
                        ? 'indeterminate'
                        : false
                  }
                  onCheckedChange={() =>
                    setRowPick(
                      selectedPreInvoices.every((pi) => rowPick.has(pi.id))
                        ? new Set()
                        : new Set(selectedPreInvoices.map((pi) => pi.id)),
                    )
                  }
                  aria-label="Select all pre-invoices"
                />
              </th>
              <th className="text-left px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Invoice ID</th>
              {/* No Due pill here (user 9/25): a deposit has nothing to be
                  on time against — the discount window carries the dates. */}
              <th className="text-left px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Invoice Date</th>
              <th className="text-left px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>PO</th>
              <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Expected Total</th>
              <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Discount</th>
              <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Prepayment</th>
              <th className="w-9 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selectedPreInvoices.map((pi) => {
              // Legacy single-pick paths seed prepayAmount only — the lone
              // row reads it until its own cell is touched.
              const val = preInvAmounts[pi.id] ?? (selectedPreInvoices.length === 1 ? prepayAmount : 0);
              // Capped at what's still OWED (Mahreen 10/10): a credit memo
              // lowers the pre-invoice, so prepaying past it is blocked.
              const cap = Math.max(0, pi.outstandingBalance);
              const over = val > cap + 0.004;
              return (
                <tr key={pi.id} className={rowPick.has(pi.id) ? 'bg-red-50/30' : undefined}>
                  <td className="pl-4 pr-1 py-2">
                    <Checkbox checked={rowPick.has(pi.id)} onCheckedChange={() => toggleRowPick(pi.id)} aria-label={`Select ${pi.invoiceNumber}`} />
                  </td>
                  {/* Blue-on-hover link, the pay table's recipe (Eli 9/8). */}
                  <td className="px-3 py-2">
                    <a
                      href={`/invoices/${encodeURIComponent(pi.invoiceNumber)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:text-primary hover:underline transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      {pi.invoiceNumber}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{humanDate(pi.invoiceDate)}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{pi.linkedPOs[0] ? `PO ${pi.linkedPOs[0]}` : ''}</td>
                  <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                    <div className="flex flex-col items-end leading-tight gap-0.5">
                      <span>{fmt(preInvoiceExpected(pi))}</span>
                      {cap < preInvoiceExpected(pi) - 0.004 && !over && (
                        <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Outstanding {fmt(cap)}</span>
                      )}
                      {over && (
                        <button
                          type="button"
                          onClick={() => setPreInvAmount(pi.id, cap)}
                          className="text-[10px] text-red-600 underline decoration-red-400/60 underline-offset-2 hover:decoration-red-500 cursor-pointer p-0 bg-transparent border-0"
                          style={{ fontWeight: 500 }}
                        >
                          Cannot exceed outstanding {fmt(cap)}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {/* Prepayment terms carry early-pay discounts too (user
                        9/25) — same cell, same liveness at the payment date,
                        same one-click discounted amount. */}
                    <DiscountCell inv={pi} paymentDate={paymentDate} onUseDiscounted={(amount) => setPreInvAmount(pi.id, amount)} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="relative w-[140px] ml-auto">
                      <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] ${over ? 'text-red-500' : 'text-slate-400'}`}>{currencySymbol(prepayCurrency)}</span>
                      <MoneyInput
                        fluid
                        value={val}
                        onValueChange={(v) => { setPreInvAmount(pi.id, v); setFieldErrors((prev) => ({ ...prev, amount: undefined })); }}
                        placeholder="0.00"
                        className={`w-full pl-6 pr-2 rounded-md border h-9 text-[13px] text-right bg-white placeholder:text-slate-400 outline-none ${over ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-100' : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/20'}`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {/* Per-row remove — confirms through the creation form's
                        red prompt (user 9/26), never removes silently. */}
                    <button
                      type="button"
                      onClick={() => setRemovePrompt({ kind: 'prepay', ids: [pi.id], label: pi.invoiceNumber })}
                      className="w-7 h-7 rounded-md inline-flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                      aria-label={`Remove ${pi.invoiceNumber} from this prepayment`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Footer band removed (user 9/25): the header already carries the
          total and the pinned summary reads the full breakdown. */}
      {fieldErrors.amount && (
        <p className="px-4 py-2 text-[11px] text-red-600 border-t border-slate-100" style={{ fontWeight: 500 }}>{fieldErrors.amount}</p>
      )}
    </div>
  );
  // Existing unapplied advances already on account for this vendor, so the user
  // doesn't double-prepay (spec §3 vendor context card).
  const existingUnapplied = useMemo(() => {
    if (!prepayVendor) return { count: 0, total: 0 };
    const list = payments.filter(
      (p) => p.type === 'Prepayment' && p.vendor === prepayVendor && (p.unappliedAmount ?? 0) > 0,
    );
    return { count: list.length, total: list.reduce((s, p) => s + (p.unappliedAmount ?? 0), 0) };
  }, [payments, prepayVendor]);

  // Default is UNSELECTED (7/24/26): ticking a vendor no longer implies its
  // invoices — only explicit ticks (or deep-link seeds) select a line.
  // Amounts default EMPTY (Eli 9/8): "where did they get a number from?" —
  // paying in full is a positive action (per-vendor Pay in full button),
  // never an assumption.
  const lineFor = (inv: Invoice): LineState =>
    lines[inv.id] ?? { selected: false, amount: 0 };
  const setLine = (id: string, next: Partial<LineState>, inv: Invoice) =>
    setLines((prev) => ({ ...prev, [id]: { ...lineFor(inv), ...prev[id], ...next } }));

  // Default memo = the invoice numbers being paid, comma-delimited (Eli
  // 7/24/26). Declared AFTER lineFor — the selection read runs on every
  // render, so referencing lineFor earlier was a TDZ crash the moment a
  // vendor was selected (blank-screen fix 7/24/26).
  // 7/24/26: "what am I paying with this check" — the check number and date
  // already print on the check, so they're useless as defaults). Truncates
  // cleanly at the limit: never cuts a number mid-way, appends +N instead.
  const memoFromNumbers = (nums: string[], limit: number): string => {
    if (nums.length === 0) return '';
    const parts: string[] = [];
    for (let i = 0; i < nums.length; i++) {
      const candidate = [...parts, nums[i]].join(', ');
      const rest = nums.length - i - 1;
      const suffix = rest > 0 ? ` +${rest}` : '';
      if ((candidate + suffix).length <= limit || parts.length === 0) {
        parts.push(nums[i]);
      } else {
        return `${parts.join(', ')} +${nums.length - parts.length}`;
      }
    }
    return parts.join(', ');
  };
  const memoNumbers = mode === 'pay'
    ? selectedRows.flatMap((r) => r.open.filter((inv) => lineFor(inv).selected).map((inv) => inv.invoiceNumber))
    : prepayTarget === 'pre-invoice'
      ? selectedPreInvoices.map((pi) => pi.invoiceNumber)
      : [];
  const defaultPrintMemo =
    memoFromNumbers(memoNumbers, memoLimit)
    // Nothing document-anchored (standalone advance / empty run): a short
    // traceable fallback.
    || `${mode === 'prepay' ? 'Vendor prepayment' : methodType}${selectedVendors[0] ? ` · ${selectedVendors[0]}` : ''}`.slice(0, memoLimit);

  // Unapplied VENDOR CREDIT available for a vendor (Eli, 8/31/26):
  // standalone advances only. Prepayments anchored to a pre-invoice are
  // consumed when the receiving invoice is created (reconciliation), so
  // they never surface at payment time.
  // Vendor credit draws only in the currency of the invoices it pays
  // (Currency & Exchange Rates: one payment can't mix currencies).
  const creditInRowCurrency = (p: Payment, vendor: string) =>
    mode !== 'pay' || (p.currency || BASE_CURRENCY).toUpperCase() === rowCurrency(vendor).toUpperCase();
  const prepayAvailableFor = (vendor: string) =>
    payments
      .filter((p) => p.type === 'Prepayment' && p.vendor === vendor && !p.preInvoiceId && (p.unappliedAmount ?? 0) > 0 && creditInRowCurrency(p, vendor))
      .reduce((s, p) => s + (p.unappliedAmount ?? 0), 0);

  // ── Prepayment anchoring, retired at payment time (Eli, 8/31/26) ────
  // Anchored advances used to auto-apply (locked) on their pre-invoice
  // row here. They now apply at invoice creation instead, so payment
  // flows see zero anchored credit; the locked-row UI stays dormant.
  const anchoredCreditFor = (invoiceNumber: string) => 0;
  const anchoredTotalFor = (vendor: string) => 0;
  // On-account credit = everything not reserved by an anchored advance.
  const onAccountCreditFor = (vendor: string) =>
    Math.max(0, Math.round((prepayAvailableFor(vendor) - anchoredTotalFor(vendor)) * 100) / 100);

  // On-account (vendor-level) prepayment RECORDS available to draw from,
  // oldest first — the selectable list in the source picker (7/22/26).
  const onAccountPrepaymentsFor = (vendor: string) =>
    payments
      .filter((p) => p.type === 'Prepayment' && p.vendor === vendor && !p.preInvoiceId && (p.unappliedAmount ?? 0) > 0.004 && creditInRowCurrency(p, vendor))
      .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

  const drawsFor = (vendor: string) => prepayDraws[vendor] ?? {};
  const drawnTotalFor = (vendor: string) =>
    Math.round(Object.values(drawsFor(vendor)).reduce((s, v) => s + (v || 0), 0) * 100) / 100;

  // Spread a vendor's drawn on-account credit across its selected,
  // NON-anchored invoices oldest-due-first (anchored invoices are driven
  // by their own effect). Mirrors the old "apply all" distribution but
  // capped at the user-selected draw total.
  const spreadDrawsToInvoices = (row: (typeof baseRows)[number], drawTotal: number) => {
    const unlocked = row.open.filter(
      (inv) => lineFor(inv).selected && anchoredCreditFor(inv.invoiceNumber) <= 0,
    );
    let credit = drawTotal;
    [...unlocked]
      .sort((a, b) =>
        a.dueDate === b.dueDate ? b.outstandingBalance - a.outstandingBalance : a.dueDate.localeCompare(b.dueDate),
      )
      .forEach((inv) => {
        // Amounts start EMPTY now (Eli 9/8), so the cap reads the invoice
        // OUTSTANDING minus the cash already typed — never the typed
        // amount alone, which zeroed every draw and made the credit
        // picker unselectable (user 9/9). Applying credit settles that
        // much of the invoice: the line's gross (amount = cash + credit)
        // moves with the draw while the typed cash side stays put.
        const l = lineFor(inv);
        const cash = Math.max(0, Math.round(((l.amount || 0) - (l.prepayApplied || 0)) * 100) / 100);
        const cap = Math.min(Math.max(0, inv.outstandingBalance - cash), credit);
        const val = Math.round(Math.max(0, cap) * 100) / 100;
        setLine(inv.id, { prepayApplied: val, amount: Math.round((cash + val) * 100) / 100 }, inv);
        credit = Math.round((credit - val) * 100) / 100;
      });
  };

  // Picker onChange: store the per-record draws and re-spread the new
  // total onto the vendor's invoices.
  const applyPrepayDraws = (row: (typeof baseRows)[number], next: Record<string, number>) => {
    setPrepayDraws((prev) => ({ ...prev, [row.vendor]: next }));
    const total = Math.round(Object.values(next).reduce((s, v) => s + (v || 0), 0) * 100) / 100;
    spreadDrawsToInvoices(row, total);
  };

  const vendorMath = (row: (typeof baseRows)[number]) => {
    const selectedInvs = row.open.filter((inv) => lineFor(inv).selected);
    // Gross = the invoice amounts being settled; applied = prepayment credit
    // applied against them (capped at gross); net = cash actually paid out.
    const gross = selectedInvs.reduce((s, inv) => s + (lineFor(inv).amount || 0), 0);
    const available = prepayAvailableFor(row.vendor);
    // Per-invoice applied amounts take precedence; each is clamped to the
    // invoice's own payment amount. Falls back to the vendor-level "apply all"
    // toggle that spreads the whole credit up to the gross.
    const perLine = selectedInvs.reduce(
      (s, inv) => s + Math.min(lineFor(inv).prepayApplied || 0, lineFor(inv).amount || 0),
      0,
    );
    // Per-line credit is NOT clamped to what the vendor has (user
    // 10/22/26): the clamp quietly turned the excess into cash. Over the
    // available credit is refused at Record instead.
    const applied = perLine > 0
      ? Math.min(perLine, gross)
      : prepayApply[row.vendor]
        ? Math.min(available, gross)
        : 0;
    return {
      selectedInvs,
      gross: Math.round(gross * 100) / 100,
      applied: Math.round(applied * 100) / 100,
      net: Math.round((gross - applied) * 100) / 100,
    };
  };

  // Anchored advances auto-apply to their invoice the moment it's selected
  // and stay clamped to the payment amount. Their row input is locked, so
  // this effect is the single writer for those lines (it converges: writes
  // only happen while the stored value differs from the clamp).
  useEffect(() => {
    if (mode !== 'pay') return;
    selectedRows.forEach((row) => {
      row.open.forEach((inv) => {
        const line = lineFor(inv);
        if (!line.selected) return;
        const anchored = anchoredCreditFor(inv.invoiceNumber);
        if (anchored <= 0) return;
        // Once the user edits an anchored row, stop auto-forcing it (unlocked).
        if (anchoredTouched.has(inv.id)) return;
        const want = Math.round(Math.min(anchored, line.amount || 0) * 100) / 100;
        if ((line.prepayApplied ?? 0) !== want) setLine(inv.id, { prepayApplied: want }, inv);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, selectedRows, mode, payments]);

  const grand = useMemo(() => {
    if (mode === 'prepay') {
      // Multi pre-invoice run records one prepayment per pre-invoice.
      const recCount = selectedVendors.length === 0
        ? 0
        : prepayTarget === 'pre-invoice' && selectedPreInvoiceIds.length > 1
          ? selectedPreInvoiceIds.length
          : 1;
      return { invoices: 0, gross: prepayAmount, applied: 0, net: prepayAmount, records: recCount };
    }
    let invs = 0, gross = 0, applied = 0, net = 0;
    selectedRows.forEach((row) => {
      const m = vendorMath(row);
      invs += m.selectedInvs.length;
      gross += m.gross;
      applied += m.applied;
      net += m.net;
    });
    return {
      invoices: invs,
      gross: Math.round(gross * 100) / 100,
      applied: Math.round(applied * 100) / 100,
      net: Math.round(net * 100) / 100,
      records: selectedRows.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedRows, lines, selectedVendors, prepayAmount, prepayApply, payments]);

  // ── Single-invoice run: "Net to pay" would just echo the typed amount,
  // so those spots show the invoice's REMAINING balance after this payment
  // instead (review 7/14/26). Multi-invoice keeps Net to pay, where the
  // aggregate genuinely helps.
  const singleInv = (() => {
    if (mode !== 'pay' || selectedRows.length !== 1) return null;
    const m = vendorMath(selectedRows[0]);
    return m.selectedInvs.length === 1 ? m.selectedInvs[0] : null;
  })();
  const singleRemaining = singleInv
    ? Math.max(0, Math.round((singleInv.outstandingBalance - (lineFor(singleInv).amount || 0)) * 100) / 100)
    : null;

  // Draft payments are DELETED from the model (Eli review 7/15/26): a
  // payment is a recordation of an event — you do it or you don't. The
  // duplicate-draft guard banner went with them.

  /* The full-width "Applies automatically" strip is GONE (user 9/25):
   * the pre-invoice table lists the documents itself, so the strip was
   * repetition eating a whole row. The applies-automatically fact moved
   * into the info tip on the table's own title. */
  const prepayAnchorBanner = null;

  // Pay-from accounts eligible for the chosen method.
  const accountType = accountTypeForMethod(method);
  // …and in the payment currency or the base currency (Currency & Exchange Rates).
  const payCurrencyNow = payCurrencyFor(mode === 'prepay' ? prepayVendor : activePayVendor);
  const currencyAccounts = accountsForCurrency(PAY_FROM_ACCOUNTS, payCurrencyNow);
  const availableAccounts = accountType === 'any'
    ? currencyAccounts
    : currencyAccounts.filter((a) => a.type === accountType);
  const bank = availableAccounts.find((b) => b.id === bankAccount) ?? availableAccounts[0] ?? currencyAccounts[0] ?? PAY_FROM_ACCOUNTS[0];
  // A payment currency the chosen account can't pay in moves the pick to one that can.
  useEffect(() => {
    if (!currencyAccounts.some((a) => a.id === bankAccount) && bank) setBankAccount(bank.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payCurrencyNow]);
  // Vendor-category A/P default (pay mode) — drives the "auto-derived" indicator
  // and the modal's reset-to-default affordance, exactly like invoicing.
  const apVendorCategory = mockVendors.find((v) => v.vendorName === selectedVendors[0])?.category ?? '';
  const apDefault = defaultApAccountForCategory(apVendorCategory);
  // Picking a saved method selects the instance, snaps the method type, and
  // defaults the pay-from account to the one matching that method's bank so the
  // two stay consistent (e.g. a Bank of America wire pays from the BofA account).
  const onMethodApply = (id: string) => {
    const picked = vendorMethods.find((m) => m.id === id);
    if (!picked) return;
    setMethodId(id);
    setMethod(picked.type);
    // ALWAYS re-derive the pay-from account (Eli 9/24): every method
    // pick moves the account, not just the first or the incompatible.
    setBankAccount(deriveAccountId(picked.type, picked.bankName));
  };

  // Derived-field model (design review 7/9/26): method and pay-from account
  // are one decision, not double entry. The vendor's configured default
  // payment method preselects both when the vendor context changes…
  useEffect(() => {
    if (!methodVendorName) return;
    const primaryMethod = vendorMethods.find((m) => m.isPrimary) ?? vendorMethods[0];
    if (!primaryMethod) return;
    setMethodId(primaryMethod.id);
    setMethod(primaryMethod.type);
    setBankAccount(deriveAccountId(primaryMethod.type, primaryMethod.bankName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodVendorName]);

  // …and picking a pay-from account drives the method in return (Eli 9/8:
  // the link "wasn't doing it in reverse"). Resolve a concrete method of
  // the account's class from the given list, same bank where possible.
  const deriveMethodFromAccount = (
    accountId: string,
    methods: { id: string; type: string; bankName?: string }[],
  ) => {
    const acct = PAY_FROM_ACCOUNTS.find((a) => a.id === accountId);
    if (!acct) return undefined;
    const pool = methods.filter((m) => {
      const tp = accountTypeForMethod(m.type);
      return tp === 'any' || tp === acct.type;
    });
    // Same-bank match ONLY (exact first, then loose). No pool[0] guess:
    // naming an unrelated saved method is exactly the disagreement Eli
    // flagged 9/24 — the caller falls back to a generic type instead.
    return pickByBank(pool, acct.bankName);
  };
  const onAccountApply = (id: string) => {
    setBankAccount(id);
    const acct = PAY_FROM_ACCOUNTS.find((a) => a.id === id);
    if (!acct) return;
    // The displayed method resolves through methodId, so the reverse link
    // must move BOTH — setMethod alone left the method card stale.
    const derived = deriveMethodFromAccount(id, vendorMethods);
    if (derived) {
      setMethodId(derived.id);
      setMethod(derived.type);
      return;
    }
    // No saved method banks at this account — a named method card would
    // now claim a different bank than the money leaves from, so it clears
    // to the generic type for the account's class (Eli 9/24: the two
    // fields can never disagree).
    setMethodId('');
    if (acct.type === 'card') setMethod('Card');
    else if (acct.type === 'cash') setMethod('Cash');
    else if (accountTypeForMethod(method) !== 'bank') setMethod('Bank Transfer');
  };
  // Multi-vendor runs draw from PER-VENDOR accounts — an account reads
  // low when the sum of ITS vendors' nets exceeds its balance.
  // Compared in the account's own currency (Currency & Exchange Rates): a
  // base-currency account pays a foreign payment at the payment's rate.
  const inAccountCurrency = (vendor: string, net: number, accountCurrency: string) =>
    accountCurrency === settledCurrencyFor(vendor) ? net : toBase(net, payRateFor(vendor));
  /** The whole run's cash as text: in its payment currency when there is one,
   *  else in the base currency at each payment's rate (Currency & Exchange Rates). */
  /** Recorded payments' total: in their currency when they share one, else in
   *  the base currency at each payment's own rate. */
  const fmtRecordsTotal = (recs: Payment[]) => {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const curs = Array.from(new Set(recs.map((r) => r.currency)));
    return curs.length === 1
      ? formatMoney(r2(recs.reduce((t, r) => t + r.amount, 0)), curs[0])
      : formatMoney(r2(recs.reduce((t, r) => t + toPaymentBase(r, r.amount), 0)), BASE_CURRENCY);
  };
  const grandPayText = () => {
    if (mode !== 'pay') return grandPayText();
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const curs = Array.from(new Set(selectedRows.map((r) => payCurrencyFor(r.vendor))));
    if (curs.length === 1) {
      return formatMoney(r2(selectedRows.reduce((t, r) => t + inPayCurrency(r.vendor, vendorMath(r).net), 0)), curs[0]);
    }
    return formatMoney(r2(selectedRows.reduce((t, r) => t + toBase(vendorMath(r).net, payRateFor(r.vendor)), 0)), BASE_CURRENCY);
  };
  const lowBalance = isMultiVendorPay
    ? (() => {
        const perAccount = new Map<string, number>();
        selectedRows.forEach((row) => {
          const acc = cfgFor(row.vendor).bankAccount;
          const accCur = PAY_FROM_ACCOUNTS.find((x) => x.id === acc)?.currency ?? BASE_CURRENCY;
          perAccount.set(acc, (perAccount.get(acc) ?? 0) + inAccountCurrency(row.vendor, vendorMath(row).net, accCur));
        });
        return [...perAccount.entries()].some(([id, total]) => {
          const a = PAY_FROM_ACCOUNTS.find((x) => x.id === id);
          return !!a && a.balance < total;
        });
      })()
    : bank && bank.balance < (mode === 'pay'
        ? selectedRows.reduce((t, row) => t + inAccountCurrency(row.vendor, vendorMath(row).net, bank.currency), 0)
        : inAccountCurrency(prepayVendor ?? '', grand.net, bank.currency));

  // A future-dated payment is SCHEDULED, not posted: nothing hits the GL and the
  // invoice stays outstanding until that date arrives. (Pay mode only.)
  const todayStr = localTodayIso();
  const isFuture = mode === 'pay' && paymentDate > todayStr;
  const dateLabel = new Date(paymentDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  if (!open) return null;

  // ── Selection helpers ──
  // Pay a vendor's invoices in another currency instead (one payment can't
  // mix currencies). What was picked, the payment currency, the rate and the
  // credit drawn all belonged to the other currency, so they reset.
  const switchInvoiceCurrency = (vendor: string, code: string) => {
    const drop = <T,>(prev: Record<string, T>) => {
      const next = { ...prev };
      delete next[vendor];
      return next;
    };
    setInvoiceCurrencyByVendor((prev) => ({ ...prev, [vendor]: code }));
    setLines((prev) => {
      const next = { ...prev };
      invoices.forEach((inv) => {
        if (inv.vendor === vendor && next[inv.id]?.selected) next[inv.id] = { ...next[inv.id], selected: false, amount: 0, prepayApplied: 0 };
      });
      return next;
    });
    setPayCurrencyByVendor(drop);
    setPayRateTypedByVendor(drop);
    setPrepayDraws(drop);
    setPrepayApply(drop);
  };

  const setVendorLines = (row: (typeof baseRows)[number], selected: boolean) => {
    setLines((prev) => {
      const next = { ...prev };
      row.open.forEach((inv) => {
        next[inv.id] = { amount: prev[inv.id]?.amount ?? 0, selected };
      });
      return next;
    });
  };

  // Bulk payments (feedback 7/21/26): pay mode allows MULTIPLE vendors in
  // one run — the flow already records one payment per vendor, so the old
  // single-vendor lockout is gone.
  // Vendor checkbox = the VENDOR only (7/24/26): it no longer sweeps every
  // open invoice into the selection. Ticking specific invoices is the
  // deliberate per-invoice path; a vendor-only tick routes to What-to-pay.
  const toggleVendor = (vendor: string, rowHasOpen: boolean) => {
    if (!rowHasOpen && !vendorFirst) return;
    const row = baseRows.find((r) => r.vendor === vendor);
    // Selections stay EXCLUSIVE (7/24/26): a vendor tick clears invoice and
    // pre-invoice picks and locks the run to one vendor — what gets recorded
    // is chosen on Step 2 (What to pay).
    setSelectedPreInvoiceIds([]);
    if (selectedVendors.includes(vendor)) {
      setSelectedVendors((prev) => prev.filter((v) => v !== vendor));
      if (row) setVendorLines(row, false);
    } else {
      setSelectedVendors([vendor]);
      setLines({});
    }
  };

  // Prepayment is one vendor at a time.
  const selectVendorPrepay = (vendor: string) => {
    setSelectedVendors((prev) => (prev[0] === vendor ? [] : [vendor]));
  };

  const toggleExpand = (vendor: string) => {
    setExpandedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });
  };

  // KPI stat boxes deep-link into the vendor (mirrors the invoicing flow):
  // expand the row if collapsed and jump straight to the relevant sub-tab —
  // Prepaid credit → Prepayments, Owed → Invoices.

  const toggleInvoiceLine = (row: (typeof baseRows)[number], inv: Invoice) => {
    // Ticking an invoice is the deliberate per-invoice path — it supersedes
    // any pre-invoice pick (payment vs prepayment are exclusive).
    setSelectedPreInvoiceIds([]);
    const vendorSelected = selectedVendors.includes(row.vendor);
    if (!vendorSelected) {
      setSelectedVendors((prev) => [...prev, row.vendor]);
      setLines((prev) => {
        const next = { ...prev };
        row.open.forEach((o) => {
          next[o.id] = { amount: prev[o.id]?.amount ?? 0, selected: o.id === inv.id };
        });
        return next;
      });
      return;
    }
    const wasOn = lineFor(inv).selected;
    setLines((prev) => ({
      ...prev,
      [inv.id]: { amount: prev[inv.id]?.amount ?? 0, selected: !wasOn },
    }));
    // Unticking the last invoice keeps the VENDOR selected (7/24/26) — the
    // vendor checkbox is its own choice now, no longer shorthand for "all".
  };

  const goContinue = () => {
    // Vendor-first Step 1 Continue (rework 7/24/26): Step 1 is vendor
    // selection — Continue ALWAYS lands on Step 2 (What to pay), with the
    // card matching whatever was picked while searching (invoices /
    // pre-invoices) already selected. Step 2 is the prompt that states
    // what gets recorded; no gate modal in between.
    if (vendorFirst && entryStage === 'vendor') {
      if (selectedVendors.length === 0) { toast.error('Select a vendor to continue.'); return; }
      setChooseSel(
        selectedPreInvoiceIds.length > 0 ? 'pre-invoices' : grand.invoices > 0 ? 'invoices' : recommendedOption,
      );
      setEntryStage('choose');
      return;
    }
    if (step !== 1) return;
    if (selectedVendors.length === 0) {
      toast.error('Select a vendor to continue.');
      return;
    }
    if (mode === 'pay' && grand.invoices === 0) {
      toast.error('Select at least one invoice to pay.');
      return;
    }
    if (mode === 'prepay' && prepayTarget === 'pre-invoice' && !selectedPreInvoiceId) {
      toast.error('Pick a pre-invoice to link, or switch to "Against the vendor".');
      return;
    }
    // Default to the vendor's primary saved method; this selects the concrete
    // instance and snaps the pay-from account to a matching one.
    const primaryMethod = vendorMethods.find((m) => m.isPrimary) ?? vendorMethods[0];
    // onMethodApply also snaps the pay-from account to the method's bank, so the
    // default pay-from is consistent with the default method.
    if (primaryMethod) onMethodApply(primaryMethod.id);
    // Auto-derive the A/P account from the vendor's category (pay mode), matching
    // the invoicing create flow.
    if (mode === 'pay') setApAccount(defaultApAccountForCategory(apVendorCategory));
    setStep(2);
  };

  // When the flow opens pre-scoped straight to step 2 (pay via paySelection or
  // prepay via a pre-invoice prefill), replicate goContinue's seeding so the
  // method / pay-from / A/P reflect the vendor's defaults (not just the display
  // fallback). Runs once on mount.
  useEffect(() => {
    if (!startAtStep2) return;
    const primary = vendorMethods.find((m) => m.isPrimary) ?? vendorMethods[0];
    if (primary) onMethodApply(primary.id);
    if (mode === 'pay') setApAccount(defaultApAccountForCategory(apVendorCategory));
    // Prepay launched from a pre-invoice: seed the amount + PO from that
    // pre-invoice (full total prefilled, PO prefilled but still editable).
    if (mode === 'prepay' && selectedPreInvoice) {
      setPrepayAmount(selectedPreInvoice.outstandingBalance);
      if (selectedPreInvoice.linkedPOs?.length) setPrepayPO(selectedPreInvoice.linkedPOs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire the explicit prepayment gate the first time the CONFIG step opens on a
  // pay flow whose selected vendor(s) hold available prepayment credit. Eli
  // 7/24/26: this reminder is fine on the config step and NOWHERE earlier —
  // the vendor and What-to-pay stages must never surface pop-ups.
  useEffect(() => {
    if (
      step === 2 &&
      entryStage === 'flow' &&
      mode === 'pay' &&
      prepayPrompt === 'unshown' &&
      selectedRows.some((r) => prepayAvailableFor(r.vendor) > 0)
    ) {
      setPrepayPrompt('open');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, entryStage]);

  // ── Back / discard guard (mirrors the invoicing selection modal) ──
  const hasSelection = () => selectedVendors.length > 0 || prepayAmount > 0;
  // Print later (user 10/15): once recorded, closing never nags about the
  // check — an unprinted check prints from the payment detail header.
  const closeFromRecorded = () => onClose();
  const handleCancelClick = () => {
    if (recorded) { closeFromRecorded(); return; }
    if (!hasSelection()) { onClose(); return; }
    setDiscardVariant('close');
    setShowDiscardConfirm(true);
  };
  const handleBackToPicker = () => {
    if (!hasSelection()) { onBack(); return; }
    setDiscardVariant('back');
    setShowDiscardConfirm(true);
  };
  // Header back. Vendor-first: flow step 2 → confirm→step1; flow step 1 →
  // back to the option boxes; choose → back to vendor; vendor → close/back.
  // Deep-link entries keep the legacy step 2 → step 1 → picker behavior.
  const handleHeaderBack = () => {
    if (vendorFirst) {
      // choose → vendor (back to the reused step-1 selection, in pay mode).
      if (entryStage === 'choose') { setStep(1); setMode('pay'); setEntryStage('vendor'); return; }
      if (entryStage === 'flow') {
        // Config → wherever the user came from (7/24/26): the What-to-pay
        // boxes when routed through them, or straight back to Step 1 when a
        // direct invoice / pre-invoice pick skipped the boxes. Confirm first
        // when anything was entered; details are kept either way.
        if (hasSelection()) { setDiscardVariant('choose'); setShowDiscardConfirm(true); return; }
        // step must fall back to 1 with the stage — a leftover step=2 makes
        // the body wear the config layout classes and shifts the choose
        // stage left (glitch fix 7/27/26).
        setStep(1); setEntryStage('choose'); return;
      }
      handleBackToPicker(); // vendor stage → close / back
      return;
    }
    if (step === 2) { setDiscardVariant('step1'); setShowDiscardConfirm(true); return; }
    handleBackToPicker();
  };
  const confirmDiscard = () => {
    // Non-destructive: just return to selection, keeping every entered detail.
    if (discardVariant === 'step1') {
      setShowDiscardConfirm(false);
      setStep(1);
      // Vendor-first direct entry: back to the Step 1 vendor stage (the
      // What-to-pay boxes were skipped, so don't land on them).
      if (vendorFirst) { setMode('pay'); setEntryStage('vendor'); }
      return;
    }
    // Vendor-first: config → "What to pay" option boxes, details kept.
    // step falls back to 1 with the stage, otherwise the body keeps the
    // config layout classes and the choose stage shifts left (7/27/26).
    if (discardVariant === 'choose') {
      setShowDiscardConfirm(false);
      setStep(1);
      setEntryStage('choose');
      return;
    }
    setSelectedVendors([]);
    setLines({});
    setExpandedVendors(new Set());
    setPrepayAmount(0);
    setPrepayPO('');
    setShowDiscardConfirm(false);
    if (discardVariant === 'back') onBack();
    else onClose();
  };

  // ── Build records + allocations and hand off ──
  // ── Over-limit guards, checked at the Record button (user 10/22/26) ──
  // Before the confirm ever opens: never more than a pre-invoice still
  // owes, and never more vendor credit than the vendor actually has. The
  // pay total used to clamp credit to what was available and quietly
  // turn the rest into cash.
  const preInvoiceOverRow = () =>
    mode === 'prepay' && prepayTarget === 'pre-invoice'
      ? selectedPreInvoices.find((pi) => {
          const val = preInvAmounts[pi.id] ?? (selectedPreInvoices.length === 1 ? prepayAmount : 0);
          return val > Math.max(0, pi.outstandingBalance) + 0.004;
        })
      : undefined;
  const creditOverVendor = () => {
    if (mode !== 'pay') return undefined;
    for (const row of selectedRows) {
      const invs = row.open.filter((inv) => lineFor(inv).selected);
      const applied = Math.round(invs.reduce((s, inv) => s + (lineFor(inv).prepayApplied || 0), 0) * 100) / 100;
      const available = prepayAvailableFor(row.vendor);
      if (applied > available + 0.004) {
        const firstInv = invs.find((inv) => (lineFor(inv).prepayApplied || 0) > 0);
        return { vendor: row.vendor, applied, available, firstInv };
      }
    }
    return undefined;
  };

  const buildAndComplete = (asDraft: boolean) => {
    // Posted = hits the GL + settles invoices now. Drafts and future-dated
    // (Scheduled) payments post nothing yet.
    const posted = !asDraft && !isFuture;
    const today = paymentDate;
    const records: Payment[] = [];
    const allocations: InvoiceAllocation[] = [];
    const prepayConsumption: PrepaymentConsumption[] = [];
    const summaries: RecordedRecord[] = [];
    const stamp = Date.now();

    if (mode === 'prepay') {
      const vendor = selectedVendors[0];
      if (!vendor || prepayAmount <= 0) {
        setFieldErrors((prev) => ({ ...prev, amount: 'Enter a prepayment amount greater than zero.' }));
        return;
      }
      // Never more than a pre-invoice still owes (Mahreen 10/10).
      if (prepayTarget === 'pre-invoice') {
        const overRow = preInvoiceOverRow();
        if (overRow) {
          setFieldErrors((prev) => ({ ...prev, amount: `Cannot exceed outstanding ${fmt(Math.max(0, overRow.outstandingBalance))} on ${overRow.invoiceNumber}.` }));
          toast.error('Prepayment is more than the pre-invoice still owes', {
            description: `${overRow.invoiceNumber} has ${fmt(Math.max(0, overRow.outstandingBalance))} outstanding. Lower the prepayment to submit.`,
          });
          return;
        }
      }
      // Multi pre-invoice run (7/24/26): ONE prepayment per selected
      // pre-invoice, each anchored to its own document at its row amount.
      // Single selection / on-account keep the one-record path.
      const prepayRuns: { amount: number; preInvoiceId?: string; linkedPO?: string }[] =
        prepayTarget === 'pre-invoice' && selectedPreInvoices.length > 1
          ? selectedPreInvoices
              .map((pi) => ({ amount: Math.round((preInvAmounts[pi.id] || 0) * 100) / 100, preInvoiceId: pi.id, linkedPO: pi.linkedPOs[0] }))
              .filter((r) => r.amount > 0)
          : [{ amount: prepayAmount, preInvoiceId: prepayTarget === 'pre-invoice' ? (selectedPreInvoiceId || undefined) : undefined, linkedPO: prepayPO || undefined }];
      prepayRuns.forEach((run, idx) => {
        // The record carries the pre-invoice NUMBER like the seeds do
        // (Eli 9/24 R09): the invoice's Payments tab and Linked Records
        // match on it; the allocation below keeps using the id.
        const preInvNumber = run.preInvoiceId
          ? (invoices.find((i) => i.id === run.preInvoiceId)?.invoiceNumber ?? run.preInvoiceId)
          : undefined;
        // An advance anchored to a pre-invoice is APPLIED to it at recording
        // (BA 9/28: the same $25 advance read Applied in Linked Records,
        // Unapplied in payment history and "Not applied yet" in the success
        // dialog). The anchoring model locks the money to its document, so
        // the record carries the application: no spendable unapplied balance,
        // status on the tri-state Applied axis. On-account advances stay
        // Unapplied until a run or payment consumes them.
        const anchoredNow = !asDraft && !!run.preInvoiceId && !!preInvNumber;
        const record: Payment = {
          id: `pmt-${stamp}-${idx}`,
          paymentNumber: claimPaymentNumber(),
          type: 'Prepayment',
          vendor,
          paymentDate: today,
          createdDate: today,
          paymentMethod: method,
          bankAccount,
          apAccount: assetAccount,
          amount: run.amount,
          appliedInvoices: anchoredNow ? [{ invoiceNumber: preInvNumber!, amount: run.amount }] : [],
          appliedAmount: anchoredNow ? run.amount : 0,
          unappliedAmount: anchoredNow ? 0 : run.amount,
          linkedPO: run.linkedPO,
          preInvoiceId: preInvNumber,
          autoApply: preInvNumber ? true : undefined,
          currency: prepayCurrency,
          // The rate it was paid at (Currency & Exchange Rates): what the
          // vendor credit banner shows when it is applied later.
          ...(isBaseCurrency(prepayCurrency)
            ? {}
            : { exchangeRate: payRateFor(prepayVendor), rateType: 'mid' as const, rateDate: paymentDate, rateEdited: payRateEditedFor(prepayVendor) || undefined }),
          reference: reference || '',
          memo: memo || 'Vendor prepayment',
          printMemo: printMemo.trim() || defaultPrintMemo,
          status: anchoredNow ? 'Fully Applied' : 'Unapplied',
          createdBy: 'Ahtisham Ahmad',
          // An advance debits its chosen asset account and credits the
          // bank — snapshotted so the saved journal always matches the
          // confirmation (9/22/26, GPT F33).
          glEntries: buildPaymentGlEntries({
            type: 'Prepayment',
            cashAmount: run.amount,
            bankAccount: bank.creditGl,
            apAccount: assetAccount,
            description: preInvNumber ? `Advance against ${preInvNumber}` : `Advance to ${vendor}`,
          }),
          // Print-flow confirm already verified the check (Eli 9/25).
          ...(method === 'Check' && printedViaFlowRef.current
            ? { checkPrint: { status: 'printed' as const, by: 'Ahtisham Ahmad', at: localTodayIso() } }
            : {}),
        };
        records.push(record);
        summaries.push({ record, lines: [] });
        // A prepayment aimed at a specific pre-invoice settles it: partial
        // advances move it to Partially Prepaid, the full amount to Prepaid.
        if (!asDraft && run.preInvoiceId) {
          allocations.push({ invoiceId: run.preInvoiceId, applied: run.amount });
        }
      });
      onComplete(records, allocations, asDraft);
      // One success modal (user 10/15): recorded + print in one place.
      if (!asDraft) {
        setSuccessLines(Object.fromEntries(summaries.map((x) => [x.record.id, x.lines])));
        successShownAtRef.current = Date.now();
      setSuccessRecords(records);
      }
      return;
    }

    // Phantom-record guard (user 9/25): a stray confirm after the print
    // flow could reach here with nothing selected — never record $0.00.
    if (selectedRows.every((row) => vendorMath(row).selectedInvs.length === 0)) {
      toast.error('Nothing to record', { description: 'No invoices are selected on this payment.' });
      return;
    }
    selectedRows.forEach((row, idx) => {
      const m = vendorMath(row);
      if (m.selectedInvs.length === 0) return;
      const paymentNumber = claimPaymentNumber();
      // Multi-vendor runs pay each vendor by its own method + account
      // (feedback 7/21/26); single-vendor runs keep the shared fields.
      const rowMethod = isMultiVendorPay ? (cfgMethodFor(row.vendor)?.type ?? method) : method;
      const rowBank = isMultiVendorPay ? cfgFor(row.vendor).bankAccount : bankAccount;
      const remittanceLines: RemittanceLine[] = m.selectedInvs.map((inv) => {
        const l = lineFor(inv);
        const paid = l.amount || 0;
        const settled = Math.min(paid, inv.outstandingBalance) + (l.lateDiscount?.amount ?? 0);
        return { invoiceNumber: inv.invoiceNumber, paid, balanceDue: Math.max(0, Math.round((inv.outstandingBalance - settled) * 100) / 100) };
      });
      // Settlement per line (user 9/23 spec): cash is clamped at the
      // balance (over-balance amounts are refused at Record, Eli 9/24
      // M16) — a vendor-honored late discount settles the rest of the
      // invoice. min() stays as a belt against float drift.
      const settledFor = (inv: Invoice) => {
        const l = lineFor(inv);
        return Math.round((Math.min(l.amount || 0, inv.outstandingBalance) + (l.lateDiscount?.amount ?? 0)) * 100) / 100;
      };
      const lateNotes = m.selectedInvs
        .filter((inv) => lineFor(inv).lateDiscount)
        .map((inv) => `${inv.invoiceNumber}: late ${fmt(lineFor(inv).lateDiscount!.amount)} discount honored (${lineFor(inv).lateDiscount!.reason})`);
      // Per-invoice cash/credit attribution (9/22/26 review response):
      // per-line applied amounts win; the vendor-level spread follows the
      // stated rule, most overdue first. The split rides the payment so
      // the invoice's Payments tab shows the true composition and a
      // reversal can restore every side.
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const creditByInvoice = new Map<string, number>();
      if (m.applied > 0.004) {
        const perLineMode = m.selectedInvs.some((inv) => (lineFor(inv).prepayApplied || 0) > 0);
        if (perLineMode) {
          m.selectedInvs.forEach((inv) => {
            const c = round2(Math.min(lineFor(inv).prepayApplied || 0, lineFor(inv).amount || 0));
            if (c > 0) creditByInvoice.set(inv.invoiceNumber, c);
          });
        } else {
          let remaining = m.applied;
          [...m.selectedInvs]
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .forEach((inv) => {
              if (remaining <= 0.004) return;
              const c = round2(Math.min(remaining, lineFor(inv).amount || 0));
              creditByInvoice.set(inv.invoiceNumber, c);
              remaining = round2(remaining - c);
            });
        }
      }
      const perInvoiceSplit = m.selectedInvs.map((inv) => {
        const grossAmt = lineFor(inv).amount || 0;
        const credit = creditByInvoice.get(inv.invoiceNumber) ?? 0;
        return { invoiceNumber: inv.invoiceNumber, cash: round2(grossAmt - credit), credit };
      });
      const appliedCredits = Object.entries(drawsFor(row.vendor))
        .filter(([, amount]) => (amount || 0) > 0.004)
        .map(([paymentId, amount]) => ({
          sourcePaymentId: paymentId,
          sourcePaymentNumber: payments.find((p) => p.id === paymentId)?.paymentNumber ?? paymentId,
          amount: round2(amount),
        }));
      const rowBankGl = isMultiVendorPay
        ? (PAY_FROM_ACCOUNTS.find((x) => x.id === rowBank)?.creditGl ?? bank.creditGl)
        : bank.creditGl;
      // One AP account per record when the invoices agree (Eli 9/24 D2);
      // an explicit picker override or a mixed set keeps the form value.
      const rowAp = (() => {
        if (apAccount !== apDefault) return apAccount;
        const accs = new Set(m.selectedInvs.map((inv) => inv.apAccount).filter(Boolean));
        return accs.size === 1 ? (Array.from(accs)[0] as string) : apAccount;
      })();
      const record: Payment = {
        id: `pmt-${stamp}-${idx}`,
        paymentNumber,
        type: 'Payment',
        vendor: row.vendor,
        paymentDate: today,
        createdDate: today,
        paymentMethod: rowMethod,
        bankAccount: rowBank,
        apAccount: rowAp,
        // In the payment currency (Currency & Exchange Rates): the invoices'
        // currency, or the base currency at the payment's rate. The applied
        // invoice amounts stay in the invoices' currency.
        amount: inPayCurrency(row.vendor, m.net),
        appliedInvoices: m.selectedInvs.map((inv) => ({ invoiceNumber: inv.invoiceNumber, amount: settledFor(inv) })),
        // Posted only when recorded for today/past; a future-dated payment is
        // Scheduled — nothing applies and the invoice stays outstanding until then.
        appliedAmount: posted ? inPayCurrency(row.vendor, m.net) : 0,
        unappliedAmount: 0,
        currency: payCurrencyFor(row.vendor),
        ...(payCurrencyFor(row.vendor) !== settledCurrencyFor(row.vendor) ? { settledCurrency: settledCurrencyFor(row.vendor) } : {}),
        ...(isBaseCurrency(settledCurrencyFor(row.vendor))
          ? {}
          : { exchangeRate: payRateFor(row.vendor), rateType: 'mid' as const, rateDate: today, rateEdited: payRateEditedFor(row.vendor) || undefined }),
        reference: reference || '',
        memo: [memo || `Manual payment · ${m.selectedInvs.length} invoice${m.selectedInvs.length === 1 ? '' : 's'}`, ...lateNotes].join(' · '),
        printMemo: printMemo.trim() || defaultPrintMemo,
        status: isFuture ? 'Scheduled' : 'Paid',
        // Future-dated → scheduled first; recorded for today → paid
        // directly, so its timeline shows just Paid (feedback 7/22/26).
        wasScheduled: isFuture,
        createdBy: 'Ahtisham Ahmad',
        // The bridge the 9/20 reviews found missing: the credit consumed,
        // the per-invoice split, and the exact journal the confirmation
        // showed all persist on the record (lib/glPosting.ts).
        appliedCredits: appliedCredits.length > 0 ? appliedCredits : undefined,
        perInvoiceSplit,
        glEntries: buildPaymentGlEntries({
          type: 'Payment',
          cashAmount: m.net,
          bankAccount: rowBankGl,
          apAccount: rowAp,
          appliedCreditTotal: m.applied,
          creditAssetAccount: DEFAULT_PREPAYMENT_ASSET_ACCOUNT,
          description: `Settle ${m.selectedInvs.length} invoice${m.selectedInvs.length === 1 ? '' : 's'} · ${row.vendor}`,
        }),
        // Recorded straight from the print flow's blocking confirm (Eli
        // 9/25): the check already printed, so the trail rides the record.
        ...(rowMethod === 'Check' && printedViaFlowRef.current
          ? { checkPrint: { status: 'printed' as const, by: 'Ahtisham Ahmad', at: localTodayIso() } }
          : {}),
      };
      records.push(record);
      summaries.push({ record, lines: remittanceLines });
      if (posted) {
        m.selectedInvs.forEach((inv) =>
          allocations.push({ invoiceId: inv.id, applied: settledFor(inv) })
        );
        // On-account advances drawn for this vendor get consumed by the
        // amount the user selected from each record (feedback 7/22/26).
        // Draws attribute to invoices in the same order the credit split
        // used, so the source advance's applied list carries real
        // per-invoice dollars (9/22/26, GPT RR12).
        const invNumbers = m.selectedInvs.map((inv) => inv.invoiceNumber);
        const creditQueue = [...creditByInvoice.entries()].map(([invoiceNumber, amount]) => ({ invoiceNumber, remaining: amount }));
        let qi = 0;
        Object.entries(drawsFor(row.vendor)).forEach(([paymentId, amount]) => {
          if ((amount || 0) <= 0.004) return;
          let left = round2(amount);
          const invoiceDraws: { invoiceNumber: string; amount: number }[] = [];
          while (left > 0.004 && qi < creditQueue.length) {
            const q = creditQueue[qi];
            const take = round2(Math.min(left, q.remaining));
            if (take > 0.004) {
              invoiceDraws.push({ invoiceNumber: q.invoiceNumber, amount: take });
              q.remaining = round2(q.remaining - take);
              left = round2(left - take);
            }
            if (q.remaining <= 0.004) qi += 1;
          }
          prepayConsumption.push({
            paymentId,
            amount: round2(amount),
            invoiceNumbers: invoiceDraws.length > 0 ? invoiceDraws.map((d) => d.invoiceNumber) : invNumbers,
            invoiceDraws: invoiceDraws.length > 0 ? invoiceDraws : undefined,
          });
        });
      }
    });

    onComplete(records, allocations, asDraft, prepayConsumption);
    // Record FIRST, print after (10/5 single-check spec), in ONE success
    // modal (user 10/15): recorded summary plus Print check / Print
    // later / Manual check, then the payment detail page.
    if (!asDraft) {
      setSuccessLines(Object.fromEntries(summaries.map((x) => [x.record.id, x.lines])));
      successShownAtRef.current = Date.now();
      setSuccessRecords(records);
    }
  };
  // Ref indirection for the check-print flow: its blocking confirm sets
  // the issued check number as the reference, then records — the ref
  // guarantees the LATEST closure (with the new reference) runs.
  const buildAndCompleteRef = useRef(buildAndComplete);
  buildAndCompleteRef.current = buildAndComplete;
  // True when the CheckPrintFlow's blocking confirm issued the numbers —
  // the very next record build stamps the printed-by trail (Eli 9/25).
  const printedViaFlowRef = useRef(false);
  // Post-record print path (10/5 spec steps 2-6): the payment posted
  // Unprinted; the prompt and the print flow only UPDATE its check
  // trail — a failed print can never lose the payment.
  const [successRecords, setSuccessRecords] = useState<Payment[] | null>(null);
  // The tick animates on first show only, not on the return from a print.
  const successShownAtRef = useRef(0);
  // Remittance lines per recorded payment, for the success modal's
  // Download remittance advice (the old recorded screen's action).
  const [successLines, setSuccessLines] = useState<Record<string, RemittanceLine[]>>({});
  const downloadRemittanceFor = (record: Payment) => {
    const rl = successLines[record.id] ?? [];
    downloadRemittanceAdvice(record, {
      lines: rl.length > 0
        ? rl
        : [{ invoiceNumber: record.linkedPO ? `Advance on PO ${record.linkedPO}` : 'On-account advance', paid: record.amount }],
    });
  };
  // Leaves the success modal: one payment opens its detail page, several
  // return to the listing.
  const finishSuccess = () => {
    const recs = successRecords ?? [];
    setSuccessRecords(null);
    onClose();
    if (recs.length === 1 && onViewPayment) onViewPayment(recs[0]);
  };
  // The recorded check payments being printed, all on ONE pay-from
  // account (the flow prints one account's stock at a time).
  const postRecordPrintRef = useRef<Payment[] | null>(null);
  const [postPrintBank, setPostPrintBank] = useState<string | null>(null);
  const [manualCheckFor, setManualCheckFor] = useState<Payment | null>(null);

  // One CheckPaymentInput per selected vendor for the print flow (BA
  // spec 9/22): stub lines carry gross / credit adjustment / net cash.
  // Prepayments print the SAME way (Eli 9/24: "should be the same
  // flow") — one check for the advance, stub carries the anchor.
  const buildCheckInputs = (): CheckPaymentInput[] => {
    if (mode === 'prepay') {
      const vendor = selectedVendors[0] ?? '';
      const anchor =
        prepayTarget === 'pre-invoice'
          ? invoices.find((i) => selectedPreInvoiceIds.includes(i.id))?.invoiceNumber
          : undefined;
      const amount = Math.round(prepayAmount * 100) / 100;
      return [{
        paymentRef: vendor,
        payee: vendor,
        date: paymentDate,
        memo: printMemo.trim() || memo.trim() || `Advance payment to ${vendor}`,
        total: amount,
        lines: [{
          invoiceNumber: anchor ?? 'Advance',
          invoiceDate: paymentDate,
          description: anchor ? `Prepayment on ${anchor}` : 'Vendor credit (advance)',
          gross: amount,
          discount: 0,
          adjustment: 0,
          net: amount,
        }],
        remittanceEmail: `ap@${vendor.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
      }];
    }
    return selectedRows
      .map((r) => ({ r, m: vendorMath(r) }))
      .filter((x) => x.m.selectedInvs.length > 0)
      .map(({ r, m }) => ({
        paymentRef: r.vendor,
        payee: r.vendor,
        date: paymentDate,
        memo: printMemo.trim() || memo.trim() || `Payment to ${r.vendor}`,
        total: m.net,
        lines: m.selectedInvs.map((inv) => {
          const l = lineFor(inv);
          const credit = Math.min(l.prepayApplied || 0, l.amount || 0);
          return {
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: inv.dueDate ?? '',
            description: inv.type,
            gross: Math.round((l.amount || 0) * 100) / 100,
            discount: 0,
            adjustment: Math.round(credit * 100) / 100,
            net: Math.round(((l.amount || 0) - credit) * 100) / 100,
          };
        }),
        remittanceEmail: `ap@${r.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
      }));
  };

  // ── GL preview lines for the confirm modal ──
  const creditCode = bank.creditGl.split(' ')[0];
  const creditName = bank.creditGl.substring(creditCode.length + 1) || bank.label;
  const assetCode = assetAccount.split(' ')[0];
  const assetName = assetAccount.substring(assetCode.length + 1) || 'Vendor Prepayments';
  const apCode = apAccount.split(' ')[0];
  const apName = apAccount.substring(apCode.length + 1) || 'Accounts Payable';
  // The payment debits the AP account each invoice actually POSTED to
  // (Eli 9/24 D2): an invoice on 2100 is settled from 2100, never a
  // blanket 2000. An explicit picker override still wins; mixed accounts
  // split the debit per account.
  const apForInv = (inv: Invoice) => (apAccount !== apDefault ? apAccount : (inv.apAccount || apAccount));
  const apLegs = (() => {
    const map = new Map<string, number>();
    selectedRows.forEach((row) => {
      vendorMath(row).selectedInvs.forEach((inv) => {
        const acc = apForInv(inv);
        map.set(acc, Math.round(((map.get(acc) ?? 0) + (lineFor(inv).amount || 0)) * 100) / 100);
      });
    });
    return [...map.entries()].filter(([, n]) => n > 0.004).map(([acc, n]) => {
      const code = acc.split(' ')[0];
      const name = acc.substring(code.length + 1) || 'Accounts Payable';
      return { code, name, debit: n, credit: 0 };
    });
  })();
  // When a prepayment is applied in pay mode, A/P is debited for the full
  // invoice amount settled (gross), credited by the prepayment asset for the
  // applied portion, and the bank only for the remaining cash (net).
  const prepayAssetCode = DEFAULT_PREPAYMENT_ASSET_ACCOUNT.split(' ')[0];
  const prepayAssetName = DEFAULT_PREPAYMENT_ASSET_ACCOUNT.substring(prepayAssetCode.length + 1) || 'Vendor Prepayments';
  const glLines = (mode === 'prepay'
    ? [
        { code: assetCode, name: assetName, debit: grand.net, credit: 0 },
        { code: creditCode, name: creditName, debit: 0, credit: grand.net },
      ]
    : [
        ...(apLegs.length > 0 ? apLegs : [{ code: apCode, name: apName, debit: grand.gross, credit: 0 }]),
        ...(grand.applied > 0
          ? [{ code: prepayAssetCode, name: prepayAssetName, debit: 0, credit: grand.applied }]
          : []),
        // Multi-vendor runs credit each vendor's OWN pay-from account, so
        // the preview carries one bank line per distinct account.
        ...(isMultiVendorPay
          ? (() => {
              const perAccount = new Map<string, number>();
              selectedRows.forEach((row) => {
                const acc = cfgFor(row.vendor).bankAccount;
                perAccount.set(acc, (perAccount.get(acc) ?? 0) + vendorMath(row).net);
              });
              return [...perAccount.entries()]
                .filter(([, n]) => n > 0)
                .map(([id, n]) => {
                  const a = PAY_FROM_ACCOUNTS.find((x) => x.id === id);
                  const code = a ? a.creditGl.split(' ')[0] : creditCode;
                  const name = a ? (a.creditGl.substring(code.length + 1) || a.label) : creditName;
                  return { code, name, debit: 0, credit: Math.round(n * 100) / 100 };
                });
            })()
          : [{ code: creditCode, name: creditName, debit: 0, credit: grand.net }]),
      ]
    // Drop zero-impact legs (user 9/25): when vendor credit fully covers
    // the payment the bank line nets to $0 and neither column hits the
    // ledger, so it's noise in the preview. The credit legs that DID move
    // the money (AP debit, Vendor Prepayments credit) still balance.
  ).filter((l) => l.debit > 0.004 || l.credit > 0.004);

  // ── Vendor-first pre-flow data (7/22/26) ─────────────────────────────
  // Every vendor is selectable in Step 1 (even one with only pre-invoices or
  // no invoices, so a standalone advance can still be logged). Counts feed the
  // Step 2 option boxes.
  const vendorOptions = useMemo(() => {
    // Union of every vendor that has invoices, an advance on account, or exists
    // in the vendor master — so vendors with real activity always appear with
    // correct counts, and any vendor can still take a standalone advance.
    const names = new Set<string>();
    invoices.forEach((i) => names.add(i.vendor));
    payments.forEach((p) => names.add(p.vendor));
    mockVendors.forEach((mv) => names.add(mv.vendorName));
    return Array.from(names)
      .map((v) => {
        const vinv = invoices.filter((i) => i.vendor === v);
        // Exactly the step-2 predicate (9/22/26 review response, GPT
        // C08-X4): the vendor card counts what step 2 will actually list,
        // including the run-lock and scheduled-payment exclusions — the
        // "10 on the card, 7 in the list" bridge gap is gone.
        // One payment can't mix currencies (Currency & Exchange Rates): the
        // card counts the invoices in the currency this payment settles.
        const payCur = vendorRows.find((r) => r.vendor === v)?.currency;
        const openList = vinv.filter(
          (i) =>
            i.type !== 'Pre-Invoice' &&
            isPayable(i) &&
            !committedByRun.has(i.id) &&
            !scheduledInvoiceNumbers.has(i.invoiceNumber) &&
            (!payCur || invCurrency(i) === payCur),
        );
        const openInvoices = openList.length;
        const openPreInvoices = vinv.filter(
          (i) => i.type === 'Pre-Invoice' && i.status !== 'Cancelled' && i.outstandingBalance > 0,
        ).length;
        const outstanding = Math.round(openList.reduce((s, i) => s + i.outstandingBalance, 0) * 100) / 100;
        const overdue = openList.filter((i) => daysPastDue(i.dueDate) > 0).length;
        const mv = mockVendors.find((m) => m.vendorName === v);
        return {
          vendor: v,
          openInvoices,
          openPreInvoices,
          advance: prepayAvailableFor(v),
          outstanding,
          overdue,
          terms: mv?.paymentTerms ?? 'Net 30',
          currency: payCur ?? openList[0]?.currency ?? vendorPaymentCurrency(v),
        };
      })
      .sort((a, b) => {
        // Actionable vendors (open invoices / pre-invoices / on-account credit)
        // float to the top; the rest stay alphabetical and searchable.
        const aAct = a.openInvoices + a.openPreInvoices + (a.advance > 0 ? 1 : 0) > 0;
        const bAct = b.openInvoices + b.openPreInvoices + (b.advance > 0 ? 1 : 0) > 0;
        if (aAct !== bAct) return aAct ? -1 : 1;
        return a.vendor.localeCompare(b.vendor);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, payments, committedByRun, scheduledInvoiceNumbers, vendorRows]);
  const chosenVendor = selectedVendors[0] ?? '';
  const chosenVendorOpt = vendorOptions.find((o) => o.vendor === chosenVendor);
  // Step 2 auto-recommend (Eli 7/24/26): if the user already ticked invoices in
  // Step 1, "Pay against invoices" is the implied choice — pre-highlight it.
  const chosenVendorRow = baseRows.find((r) => r.vendor === chosenVendor);
  const step1HasInvoiceSelection = !!chosenVendorRow?.open.some((inv) => lineFor(inv).selected);
  const recommendedOption: 'invoices' | 'pre-invoices' | 'advance' | null = step1HasInvoiceSelection
    ? 'invoices'
    : (chosenVendorOpt?.openInvoices ?? 0) > 0
      ? 'invoices'
      : (chosenVendorOpt?.openPreInvoices ?? 0) > 0
        ? 'pre-invoices'
        // Nothing to pay against → the standalone advance is the only
        // recordable thing, recommend it outright (Eli 7/24/26 empty state).
        : 'advance';
  // Step 2 empty state (Eli 7/24/26): no open invoices AND no pre-invoices
  // means the advance is the only path; the panel says so with a link to
  // enter an invoice.
  const chosenVendorEmpty =
    (chosenVendorOpt?.openInvoices ?? 0) === 0 && (chosenVendorOpt?.openPreInvoices ?? 0) === 0;

  const recordVerb = mode === 'prepay' ? 'Record Prepayment' : isFuture ? 'Schedule Payment' : 'Record Payment';

  // Unified 3-step header for vendor-first flows. The third pill ("Record
  // …") spans the resumed flow's own internal select→configure sub-steps.
  const VF_STEPS = ['Select Vendor', 'Payment Type', mode === 'prepay' ? 'Record Prepayment' : 'Record Payment'];
  const vfIndex = entryStage === 'vendor' ? 0 : entryStage === 'choose' ? 1 : 2;
  // Only the "What to pay" boxes stage renders a custom body. The vendor stage
  // reuses the EXISTING step 1 verbatim (same search band, filters, expandable
  // vendor cards, inline invoice selection) — feedback 7/23/26: "same modal,
  // same search, everything same." The flow stage is the resumed record flow.
  const inPreFlow = vendorFirst && entryStage === 'choose';

  // Step 2 option-box pick → set mode/target, seed the vendor's defaults, and
  // resume the existing record flow. "Pay against invoices" jumps straight to
  // the configure step when invoices were already ticked in Step 1's cards;
  // otherwise it lands on the selection list. Pre-invoices resume on the
  // pre-invoice picker; a standalone advance goes straight to the amount step.
  // Step 2 Continue (rework 7/24/26): the What-to-pay cards are a selection;
  // the list under them collects the invoice ticks / pre-invoice pick, and
  // Continue routes to the matching config form.
  const confirmChoose = () => {
    const primary = vendorMethods.find((m) => m.isPrimary) ?? vendorMethods[0];
    const seed = () => { if (primary) onMethodApply(primary.id); };
    if (chooseSel === 'invoices') {
      const vRow = baseRows.find((r) => r.vendor === chosenVendor);
      if (!vRow || !vRow.open.some((inv) => lineFor(inv).selected)) {
        toast.error('Select at least one invoice to pay.');
        return;
      }
      setMode('pay');
      seed();
      setApAccount(defaultApAccountForCategory(apVendorCategory));
      setExpandedVendors(new Set(selectedVendors));
      setStep(2);
      setEntryStage('flow');
    } else if (chooseSel === 'pre-invoices') {
      if (selectedPreInvoiceIds.length === 0) {
        toast.error('Pick at least one pre-invoice to continue.');
        return;
      }
      setMode('prepay');
      setPrepayTarget('pre-invoice');
      seedPreInvoiceAmounts(selectedPreInvoiceIds);
      seed();
      setStep(2);
      setEntryStage('flow');
    } else if (chooseSel === 'advance') {
      setMode('prepay');
      setPrepayTarget('on-account');
      setSelectedPreInvoiceIds([]);
      seed();
      setStep(2);
      setEntryStage('flow');
    } else {
      toast.error('Choose what to record to continue.');
    }
  };

  // ── V2 workspace step 2 ── invoicing-style two-panel: left = key fields +
  // line items (invoices / prepayment amount), right = accordion sidebar
  // (vendor + money-movement fields) + totals breakdown.
  // "Other open invoices from this vendor" (9/4/26 Eli, BB-27, his words):
  // the old small single-pick dropdown breaks at Fastenal scale — daily
  // deliveries, one check run a fortnight, "it can be literally 20 or 30
  // invoices" — so the trigger opens a searchable MULTI-SELECT modal.
  // Rows carry invoice number + amount + checkbox, nothing more (Eli:
  // "it doesn't need more information than you have here"). Shared by
  // the V2 two-panel step 2 and the classic step-2 card.
  const renderAddInvoiceMenu = (row: (typeof baseRows)[number]) => {
    const addable = row.open.filter((inv) => !lineFor(inv).selected);
    return (
      <button
        type="button"
        onClick={() => {
          setAddInvVendor(row.vendor);
          setAddInvSearch('');
          setAddInvPicked(new Set());
        }}
        // Blue OUTLINE + the word "Add" (Eli 9/8, third pass on this
        // control): it has to read as an action, not a label.
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/50 bg-white text-[11px] text-primary hover:bg-accent hover:border-primary transition-colors cursor-pointer"
        style={{ fontWeight: 600 }}
      >
        <Plus className="w-3 h-3" />
        Add Other Open Invoices
        {addable.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-primary text-[9px] " style={{ fontWeight: 700 }}>
            {addable.length}
          </span>
        )}
      </button>
    );
  };

  // Per-vendor method + pay-from controls (feedback 7/21/26): they live
  // INSIDE each vendor's Invoices To Pay card — the method is vendor
  // information, so it sits with the vendor, not in the run-level rail
  // (same principle as the single-vendor card, 7/14/26). "Apply to all"
  // broadcasts one vendor's setup across the run.
  const renderVendorPayControls = (vendor: string) => {
    const m = cfgMethodFor(vendor);
    const mInfo = paymentMethodInfo(m?.type ?? 'Check');
    const MIcon = mInfo.icon;
    const mColors = methodCategoryColors(mInfo.category);
    const acct = PAY_FROM_ACCOUNTS.find((a) => a.id === cfgFor(vendor).bankAccount);
    const AccIcon = acct?.type === 'cash' ? Banknote : acct?.type === 'card' ? Wallet : Landmark;
    return (
      /* Labels sit INLINE to the left of their fields (feedback 7/21/26)
         so the strip stays a single compact row per vendor. */
      <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center gap-x-4 gap-y-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[250px]">
          <Label className="text-[10px] text-slate-500 shrink-0" style={{ fontWeight: 500 }}>Payment Method<span className="text-red-500">*</span></Label>
          <button
            type="button"
            onClick={() => setCfgMethodVendor(vendor)}
            className="flex-1 min-w-0 inline-flex items-center justify-between gap-2 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0 text-left">
              <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: mColors.bg, color: mColors.color }}>
                <MIcon className="w-3 h-3" />
              </span>
              <span className="truncate" style={{ fontWeight: 500 }}>{m ? m.nickname : 'Select method'}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {m?.isPrimary && <PrimaryPill size="xs" />}
              <Settings2 className="w-3 h-3 text-slate-400" />
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[250px]">
          <Label className="text-[10px] text-slate-500 shrink-0" style={{ fontWeight: 500 }}>Pay-From Account<span className="text-red-500">*</span></Label>
          <button
            type="button"
            onClick={() => setCfgAccountVendor(vendor)}
            className="flex-1 min-w-0 inline-flex items-center justify-between gap-2 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0 text-left">
              <span className="w-5 h-5 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                <AccIcon className="w-3 h-3" />
              </span>
              <span className="truncate" style={{ fontWeight: 500 }}>{acct ? acct.label : 'Select account'}</span>
              {acct && <span className="text-[9px] text-slate-400 truncate shrink-0">{accountBalanceLabel(acct, fmt)}</span>}
            </span>
            <Settings2 className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
        </div>
      </div>
    );
  };

  // Vendor tab hovercard — the PO-pill breakdown recipe from Create
  // Vendor Invoice (dark gradient header, scrolling line list, totals
  // footer), retold with this vendor's slice of the run.
  const renderVendorTabHover = (row: (typeof selectedRows)[number], m: ReturnType<typeof vendorMath>) => {
    const vm = cfgMethodFor(row.vendor);
    const vmInfo = paymentMethodInfo(vm?.type ?? 'Check');
    const VmIcon = vmInfo.icon;
    const vmColors = methodCategoryColors(vmInfo.category);
    const acct = PAY_FROM_ACCOUNTS.find((a) => a.id === cfgFor(row.vendor).bankAccount);
    return (
      <HoverCardContent className="w-80 p-0 overflow-hidden rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-[300]" align="start">
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center justify-between gap-2 relative">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-3.5 h-3.5 text-white/70 shrink-0" />
              <span className="text-white text-[13px] truncate" style={{ fontWeight: 600 }}>{row.vendor}</span>
            </div>
            <span
              className="inline-flex items-center px-1.5 py-px rounded border text-[9px] shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200"
              style={{ fontWeight: 700 }}
            >
              Payment
            </span>
          </div>
          <p className="text-[11px] text-white/50 mt-1" style={{ fontWeight: 400 }}>
            {row.terms} terms · settles in {row.currency}
          </p>
        </div>
        <div className="px-3.5 py-3 space-y-2.5 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              Invoices in this run <span className="text-slate-400">·</span> <span className="text-slate-700" style={{ fontWeight: 600 }}>{m.selectedInvs.length}</span>
            </span>
            {m.applied > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-warning" style={{ fontWeight: 600 }}>
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                {fmtIn(row.currency)(m.applied)} credit applied
              </span>
            )}
          </div>
          <div className="space-y-0.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar -mx-1">
            {m.selectedInvs.map((inv) => {
              const l = lineFor(inv);
              const pastDue = daysPastDue(inv.dueDate);
              return (
                <div key={inv.id} className="flex items-center gap-2.5 py-1.5 px-1 border-b border-slate-50 last:border-0">
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-[12px] text-slate-800 leading-tight truncate" style={{ fontWeight: 600 }}>{inv.invoiceNumber}</span>
                    <span className={`text-[10px] leading-tight truncate ${pastDue > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      Due {formatUsDate(inv.dueDate)}{pastDue > 0 ? ` · ${pastDue} days overdue` : ''}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[12px] text-slate-800 " style={{ fontWeight: 600 }}>{fmtIn(row.currency)(l.amount || 0)}</span>
                    {(l.prepayApplied || 0) > 0 && (
                      <p className="text-[10px] text-purple-600 mt-0.5 " style={{ fontWeight: 500 }}>{fmtIn(row.currency)(l.prepayApplied || 0)} prepayment</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center border border-primary/15">
                <Wallet className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 leading-none" style={{ fontWeight: 500 }}>Total Payment</p>
                <p className="text-[14px] text-slate-800 mt-0.5" style={{ fontWeight: 600 }}>{fmtIn(row.currency)(m.net)}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 min-w-0">
              <span className="inline-flex items-center gap-1 max-w-full">
                <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: vmColors.bg, color: vmColors.color }}>
                  <VmIcon className="w-2.5 h-2.5" />
                </span>
                <span className="text-[10px] text-slate-600 truncate" style={{ fontWeight: 600 }}>{vm ? vm.nickname : 'No method'}</span>
                {vm?.isPrimary && <PrimaryPill size="xs" />}
              </span>
              {acct && <span className="text-[9px] text-slate-400 truncate">{acct.label}</span>}
            </div>
          </div>
        </div>
      </HoverCardContent>
    );
  };

  // Vendor tab strip (feedback 7/21/26) — the PO-tab recipe from Create
  // Vendor Invoice, verbatim: pills scroll in their own flex container,
  // the active pill wears the accent tint, hover opens the breakdown
  // card, X removes the vendor (confirmed), and the CTA pinned right
  // steps back to vendor selection.
  const renderVendorTabs = () => (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide flex-1 min-w-0 items-center">
        {selectedRows.map((row) => {
          const m = vendorMath(row);
          const active = activePayVendor === row.vendor;
          return (
            <HoverCard key={row.vendor} openDelay={300}>
              <HoverCardTrigger asChild>
                <div
                  className={`group flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-accent text-primary border-primary/30'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveVendorTab(row.vendor)}
                    className="flex items-center gap-1.5 text-[12px]"
                    style={{ fontWeight: 500 }}
                  >
                    <Building2 className={`w-3 h-3 ${active ? 'text-primary/70' : 'text-slate-400'}`} />
                    <span>{row.vendor}</span>
                    <span className="text-slate-300">·</span>
                    <span className={active ? 'text-primary/70' : 'text-slate-400'}>{m.selectedInvs.length}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVendorToRemove(row.vendor);
                    }}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label={`Remove ${row.vendor}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </HoverCardTrigger>
              {renderVendorTabHover(row, m)}
            </HoverCard>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setStep(1)}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
        style={{ fontWeight: 500 }}
      >
        <Plus className="w-3 h-3" />
        Add Vendors
      </button>
    </div>
  );

  // Rail bulk control (feedback 7/21/26): one obvious place to
  // standardize the run — choose a method + account once, Apply to all.
  // Vendors that don't accept the method keep their primary.
  const renderBulkPayControls = () => {
    const gm = genericPaymentMethods().find((m) => m.id === bulkMethodId);
    const gInfo = gm ? paymentMethodInfo(gm.type) : null;
    const GIcon = gInfo?.icon ?? Banknote;
    const gColors = gInfo ? methodCategoryColors(gInfo.category) : null;
    const acct = PAY_FROM_ACCOUNTS.find((a) => a.id === bulkAccountId);
    const AccIcon = acct?.type === 'cash' ? Banknote : acct?.type === 'card' ? Wallet : Landmark;
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 space-y-2">
        <div>
          <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Set Every Vendor at Once</p>
          <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
            Each card below carries its own method and account, defaulted from Partner Management. Standardize the whole run here.
          </p>
        </div>
        <div>
          <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Payment Method</Label>
          <button
            type="button"
            onClick={() => setBulkMethodModalOpen(true)}
            className="mt-1 w-full inline-flex items-center justify-between gap-2 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0 text-left">
              <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={gColors ? { backgroundColor: gColors.bg, color: gColors.color } : undefined}>
                <GIcon className={`w-3 h-3 ${gColors ? '' : 'text-slate-400'}`} />
              </span>
              <span className="truncate" style={{ fontWeight: 500 }}>{gm ? gm.nickname : "Keep Each Vendor's Method"}</span>
            </span>
            <Settings2 className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
        </div>
        <div>
          <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Pay-From Account</Label>
          <button
            type="button"
            onClick={() => setBulkAccountModalOpen(true)}
            className="mt-1 w-full inline-flex items-center justify-between gap-2 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0 text-left">
              <span className="w-5 h-5 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                <AccIcon className="w-3 h-3" />
              </span>
              <span className="truncate" style={{ fontWeight: 500 }}>{acct ? acct.label : 'Select account'}</span>
              {acct && <span className="text-[9px] text-slate-400 truncate shrink-0">{accountBalanceLabel(acct, fmt)}</span>}
            </span>
            <Settings2 className="w-3 h-3 text-slate-400 shrink-0" />
          </button>
        </div>
        <button
          type="button"
          // A method-type apply confirms first (feedback 7/21/26): vendors
          // without the type silently falling back to their primary is
          // exactly the surprise the modal exists to prevent.
          onClick={() => (bulkMethodId ? setBulkConfirmOpen(true) : applyBulkToAll())}
          className="w-full h-8 rounded-lg border border-primary/30 bg-white text-[12px] text-primary hover:bg-primary/[0.04] transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          Apply to All {selectedVendors.length} vendors
        </button>
        {lowBalance && (
          <p className="text-[10px] text-amber-600 inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
            <AlertTriangle className="w-3 h-3" /> An account's available balance is below its share of this run. You can still record, nothing is blocked.
          </p>
        )}
      </div>
    );
  };

  const renderV2Step2 = () => {
    // Partner PaymentMethodCard port (PaymentMethodsSection.tsx) — the
    // method is vendor information, so it renders inside the vendor card
    // (design feedback 7/14/26). Card click or the "Change" link on the
    // label row opens the picker modal, changeable at any point in the flow.
    const methodCard = (() => {
      const mInfo = paymentMethodInfo(resolvedMethod ? resolvedMethod.type : method);
      const MIcon = mInfo.icon;
      const mColors = methodCategoryColors(mInfo.category);
      const rows = resolvedMethod ? methodDataRows(resolvedMethod) : [];
      const title = resolvedMethod ? resolvedMethod.nickname : mInfo.label;
      return (
        <div
          onClick={() => setPaymentMethodModalOpen(true)}
          // White partner-card chrome like the creation form's Payment
          // Terms card (user 9/9): the blue primary border made the card
          // read selected/active — the Primary pill alone says primary.
          className="bg-white rounded-xl group transition-all duration-200 flex flex-col relative cursor-pointer border border-border hover:border-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]"
        >
          <div className="p-3 flex-1 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: mColors.bg }}>
                  <MIcon className="w-3.5 h-3.5" style={{ color: mColors.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate leading-tight" style={{ fontWeight: 600 }}>{title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] px-1.5 py-[1px] rounded-full" style={{ fontWeight: 600, color: mColors.color, backgroundColor: mColors.bg }}>
                      {mInfo.label}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {resolvedMethod?.isPrimary && <PrimaryPill size="xs" />}
              </div>
            </div>
            {rows.length > 0 && (
              <div className="flex flex-col gap-[5px] py-1.5 px-2 rounded-lg bg-[#FAFBFC] border border-muted">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-slate-400">{r.label}</span>
                    <span className="text-slate-700 " style={{ fontWeight: 600 }}>{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    })();
    const payFromField = (() => {
      const AccIcon = bank?.type === 'cash' ? Banknote : bank?.type === 'card' ? Wallet : Landmark;
      const detail = bank
        ? [bank.accountTypeLabel, bank.bankName, bank.accountMask ? `••••${bank.accountMask}` : null, accountBalanceLabel(bank, fmt)].filter(Boolean).join(' · ')
        : '';
      return (
        <button
          type="button"
          onClick={() => setPayFromModalOpen(true)}
          className="w-full inline-flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0 text-left">
            <span className="w-6 h-6 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0"><AccIcon className="w-3.5 h-3.5" /></span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="truncate text-[12px]" style={{ fontWeight: 500 }}>{bank ? bank.label : 'Select account'}</span>
              {detail && <span className="text-[10px] text-slate-400 truncate">{detail}</span>}
            </span>
          </span>
          <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      );
    })();

    return (
      <div className="flex flex-1 w-full overflow-hidden">
        {/* ── LEFT panel ── key fields + line items */}
        <div className="w-full lg:w-[70%] flex flex-col overflow-hidden bg-slate-50 lg:border-r border-border/60">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Details — mirrors the invoicing "Invoice Details" card: primary
                header icon, 13px labels, h-10 inputs, 2×2 grid with an
                ExpandableTextarea description parallel to the reference field. */}
            <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-100 bg-slate-50 rounded-t-lg flex items-center gap-2 flex-wrap">
                <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center shrink-0">
                  <ModeIcon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>{mode === 'prepay' ? 'Prepayment Details' : 'Payment Details'}</span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
              </div>
              <div className="px-3 sm:px-4 py-3 space-y-3">
                {/* Row 1: Payment date | Payment ID */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Payment Date<span className="text-red-500">*</span>
                      </Label>
                      {isFuture && (
                        <span className="text-[10px] text-blue-600 inline-flex items-center gap-1 shrink-0" style={{ fontWeight: 600 }}>
                          <Clock className="w-3 h-3" /> Scheduled · {dateLabel}
                        </span>
                      )}
                    </div>
                    <DatePicker id="rp-payment-date" value={paymentDate} onChange={(v) => { setPaymentDate(v); setFieldErrors((f) => ({ ...f, paymentDate: undefined })); }} className="mt-1" error={!!fieldErrors.paymentDate} />
                    {fieldErrors.paymentDate && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.paymentDate}</p>}
                  </div>
                  <div>
                    <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>{mode === 'prepay' ? 'Prepayment ID' : 'Payment ID'}<span className="text-red-500">*</span></Label>
                    <Input value={mode === 'pay' && grand.records > 1 ? `${idBase} (+${grand.records - 1} more)` : idBase} readOnly className="mt-1 rounded-lg border-slate-200 !h-10 text-sm bg-slate-50 text-slate-500 " />
                    <p className="text-[11px] text-slate-400 mt-1">System-generated, unique per record.</p>
                  </div>
                </div>
                {/* Payment Currency + Exchange Rate (Currency & Exchange
                    Rates): after the vendor is chosen. The pay-from list
                    follows the payment currency. */}
                {(() => {
                  const v = mode === 'prepay' ? prepayVendor : activePayVendor;
                  if (!v) return null;
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <PaymentCurrencyField
                        value={payCurrencyFor(v)}
                        vendorCurrency={settledCurrencyFor(v)}
                        onChange={(code) => setPayCurrencyByVendor((prev) => ({ ...prev, [v]: code }))}
                        locked={mode === 'prepay'}
                        lockedReason="A prepayment is recorded in the vendor’s currency, the one its invoices will be in."
                      />
                      <PaymentRateField
                        settledCurrency={settledCurrencyFor(v)}
                        quoteRate={payQuoteFor(v)}
                        paymentDate={paymentDate}
                        typed={payRateTypedByVendor[v] ?? null}
                        onTypedChange={(t) => setPayRateTypedByVendor((prev) => ({ ...prev, [v]: t }))}
                        canEdit={apPerms.canChangePaymentRate}
                      />
                    </div>
                  );
                })()}
                {/* Row 2: Reference no | (pay: Memo line · prepay: Prepayment amount).
                    Pre-invoice prepay pairs the memo line with the reference
                    like the pay flow (user 11/3); its per-pre-invoice amounts
                    render in a full-width section below (user 9/25). */}
                <div className={`grid ${mode === 'prepay' && prepayTarget === 'pre-invoice' && !showPrintMemo ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                  <div>
                    <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>{refFieldMeta.label}{referenceRequired && <span className="text-red-500">*</span>}</Label>
                    <div className="relative mt-1">
                      <Input value={reference} onChange={(e) => { referenceAutoFilled.current = false; setReference(e.target.value); setFieldErrors((prev) => ({ ...prev, reference: undefined as unknown as string })); }} placeholder={refFieldMeta.placeholder} className={`rounded-lg bg-white !h-10 text-sm placeholder:text-slate-400 ${referenceError || fieldErrors.reference ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-100' : referenceWarning ? 'pr-8 border-amber-400 text-amber-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-100' : 'border-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20'}`} />
                      {/* Out-of-sequence warning rides IN the input (7/24/26,
                          same recipe as the payment-amount warnings): amber
                          triangle, hover card with the same copy PLUS the
                          expected next check number, click-to-use. */}
                      {!referenceError && referenceWarning && (
                        <HoverCard openDelay={300} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-amber-500 hover:bg-amber-100 transition-colors cursor-help" aria-label="Check number warning">
                              <AlertTriangle className="w-3 h-3" />
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>{referenceWarning.startsWith('Big jump') ? 'Big Jump Ahead' : 'Out of Sequence'}</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{referenceWarning}</p>
                            {lastCheckNumber != null && (
                              <p className="text-[11px] text-slate-500 leading-snug mt-1">
                                Expected next:{' '}
                                <button type="button" onClick={() => { referenceAutoFilled.current = false; setReference(`CHK-${lastCheckNumber + 1}`); }} className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline" style={{ fontWeight: 600 }}>CHK-{lastCheckNumber + 1}</button>.
                                {' '}Click it to use that number.
                              </p>
                            )}
                          </HoverCardContent>
                        </HoverCard>
                      )}
                      </div>
                    {!referenceError && fieldErrors.reference && (
                      <p className="text-[11px] text-red-600 mt-1" style={{ fontWeight: 500 }}>{fieldErrors.reference}</p>
                    )}
                    {referenceError && (
                      <p className="text-[11px] text-red-600 mt-1" style={{ fontWeight: 500 }}>
                        {referenceError}
                        {referenceDup && (
                          <>
                            {' '}
                            <a
                              href={`/payments-v2/${encodeURIComponent(referenceDup.paymentNumber)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700"
                              style={{ fontWeight: 600 }}
                            >
                              View {referenceDup.paymentNumber}
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    {methodType === 'Check' && !referenceError && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {lastCheckNumber != null
                          ? `Last check recorded on this account: ${lastCheckNumber}.`
                          : 'No checks recorded on this account yet.'}
                      </p>
                    )}
                  </div>
                  {/* The amount field stays ONLY for on-account credit
                      (user 9/25): pre-invoice prepayments — single or
                      multi — read the same table as the pay flow below. */}
                  {/* Pre-invoice prepayments put the memo line beside the
                      reference like the pay flow (user 11/3); only on-account
                      credit keeps the amount here. */}
                  {mode === 'prepay' && prepayTarget !== 'pre-invoice' ? (() => {
                    const amountOver = !!selectedPreInvoice && prepayAmount > selectedPreInvoice.amount;
                    const amountInvalid = !!fieldErrors.amount || amountOver;
                    return (
                    <div>
                      <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>{prepayTarget === 'on-account' ? 'Vendor Credit Amount' : 'Prepayment Amount'}<span className="text-red-500">*</span></Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{currencySymbol(prepayCurrency)}</span>
                        <MoneyInput fluid value={prepayAmount} onValueChange={(v) => { setPrepayAmount(v); setFieldErrors((prev) => ({ ...prev, amount: undefined })); }} placeholder="0.00" className={`w-full pl-7 pr-3 rounded-lg border h-10 text-sm bg-white placeholder:text-slate-400 outline-none ${amountInvalid ? 'pr-8 border-red-400 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-100' : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/20'}`} />
                        {amountInvalid && (
                          <HoverCard openDelay={300} closeDelay={120}>
                            <HoverCardTrigger asChild>
                              <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-500 hover:bg-red-100 transition-colors cursor-help" aria-label={amountOver ? 'Amount exceeds the pre-invoice total' : 'Amount is required'}>
                                <AlertTriangle className="w-3 h-3" />
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                              {amountOver ? (
                                <>
                                  <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Exceeds the Pre-Invoice Total</p>
                                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                    Amount is <span className="text-foreground " style={{ fontWeight: 600 }}>{fmt(prepayAmount)}</span> but the pre-invoice totals{' '}
                                    <button type="button" onClick={() => setPrepayAmount(selectedPreInvoice!.amount)} className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline" style={{ fontWeight: 600 }}>{fmt(selectedPreInvoice!.amount)}</button>.
                                    {' '}Click the amount to snap the input back.
                                  </p>
                                </>
                              ) : (
                                <p className="text-[11px] text-slate-500 leading-snug">{fieldErrors.amount}</p>
                              )}
                            </HoverCardContent>
                          </HoverCard>
                        )}
                      </div>
                      {fieldErrors.amount && (
                        <p className="text-[11px] text-red-600 mt-1" style={{ fontWeight: 500 }}>{fieldErrors.amount}</p>
                      )}
                      {selectedPreInvoice && prepayAmount > 0 && (
                        <p className={`text-[11px] mt-1 ${amountOver ? 'text-red-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
                          {amountOver ? (
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Exceeds the pre-invoice total of{' '}
                              <button type="button" onClick={() => setPrepayAmount(selectedPreInvoice.amount)} className="text-[11px] leading-snug underline decoration-red-400/60 underline-offset-2 hover:decoration-red-500 cursor-pointer p-0 bg-transparent border-0 align-baseline" style={{ fontWeight: 600 }}>{fmt(selectedPreInvoice.amount)}</button>.
                            </span>
                          ) : (
                            <>{fmt(prepayAmount)} of {fmt(selectedPreInvoice.amount)} · {Math.round((prepayAmount / selectedPreInvoice.amount) * 100)}% deposit against this pre-invoice.</>
                          )}
                        </p>
                      )}
                    </div>
                    );
                  })() : showPrintMemo ? (
                    /* Pay flow (user 10/9): the memo line sits beside the
                       reference; Description drops to a full-width row. */
                    <div>
                    <div className="flex items-center justify-between">
                      {/* The helper moved OFF the field into an info tip
                          (user 9/25): under the input it read like data
                          already typed. Method-aware copy + an example,
                          the partner tooltip anatomy. */}
                      <span className="inline-flex items-center gap-1.5">
                        <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Memo Line</Label>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help">
                              <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] z-[300]">
                            <p className="text-[11px] leading-snug text-slate-600">
                              What this payment is for, like invoice or PO numbers.{' '}
                              {methodType === 'Check'
                                ? 'Prints on the check memo line.'
                                : methodType === 'ACH'
                                  ? 'Sent with the ACH addenda.'
                                  : methodType === 'Wire'
                                    ? 'Sent with the wire instructions.'
                                    : 'Saved with the payment record.'}{' '}
                              {memoNumbers.length > 0
                                ? 'If left blank, the invoice numbers fill in automatically.'
                                : 'If left blank, a short payment reference fills in automatically.'}
                            </p>
                            <div className="mt-1.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                              <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Example</p>
                              <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                                {memoNumbers.length > 0 ? `${memoNumbers[0]}${memoNumbers.length > 1 ? `, +${memoNumbers.length - 1} more` : ''}` : 'Advance on PO 4100'}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      {/* Counter appears once typing starts (user 10/9): an
                          idle 0/N read like content already in the field. */}
                      {printMemo.length > 0 && (
                        <span className={`text-[11px] ${printMemo.length >= memoLimit ? 'text-amber-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>{printMemo.length}/{memoLimit}</span>
                      )}
                    </div>
                    <Input
                      value={printMemo}
                      maxLength={memoLimit}
                      onChange={(e) => setPrintMemo(e.target.value.slice(0, memoLimit))}
                      placeholder="Add a memo"
                      className="mt-1 !h-10 text-sm rounded-lg bg-white placeholder:text-slate-400"
                    />
                  </div>
                  ) : null}
                </div>
                {/* Memo line — prints on the check / transmits in the ACH/wire
                    field (Eli 7/22/26). Separate from Description; hard-limited
                    per instrument; a traceable default fills in when blank. */}
                {showPrintMemo && mode === 'prepay' && prepayTarget !== 'pre-invoice' && (
                  <div className="-mt-1">
                    <div className="flex items-center justify-between">
                      {/* The helper moved OFF the field into an info tip
                          (user 9/25): under the input it read like data
                          already typed. Method-aware copy + an example,
                          the partner tooltip anatomy. */}
                      <span className="inline-flex items-center gap-1.5">
                        <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Memo Line</Label>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help">
                              <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px] z-[300]">
                            <p className="text-[11px] leading-snug text-slate-600">
                              What this payment is for, like invoice or PO numbers.{' '}
                              {methodType === 'Check'
                                ? 'Prints on the check memo line.'
                                : methodType === 'ACH'
                                  ? 'Sent with the ACH addenda.'
                                  : methodType === 'Wire'
                                    ? 'Sent with the wire instructions.'
                                    : 'Saved with the payment record.'}{' '}
                              {memoNumbers.length > 0
                                ? 'If left blank, the invoice numbers fill in automatically.'
                                : 'If left blank, a short payment reference fills in automatically.'}
                            </p>
                            <div className="mt-1.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                              <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Example</p>
                              <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                                {memoNumbers.length > 0 ? `${memoNumbers[0]}${memoNumbers.length > 1 ? `, +${memoNumbers.length - 1} more` : ''}` : 'Advance on PO 4100'}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      {/* Counter appears once typing starts (user 10/9): an
                          idle 0/N read like content already in the field. */}
                      {printMemo.length > 0 && (
                        <span className={`text-[11px] ${printMemo.length >= memoLimit ? 'text-amber-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>{printMemo.length}/{memoLimit}</span>
                      )}
                    </div>
                    <Input
                      value={printMemo}
                      maxLength={memoLimit}
                      onChange={(e) => setPrintMemo(e.target.value.slice(0, memoLimit))}
                      placeholder="Add a memo"
                      className="mt-1 h-9 text-[13px] bg-white placeholder:text-slate-400"
                    />
                  </div>
                )}
                {/* Row 3: full-width description (pay and prepay alike; prepay
                    adds the on-account note under it). */}
                {(
                  <>
                    <div>
                      <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Description{method === 'Other' && <span className="text-red-500">*</span>}</Label>
                      <div className={`mt-1 ${fieldErrors.description ? 'rounded-lg ring-1 ring-red-400' : ''}`}>
                        <ExpandableTextarea value={memo} onChange={(v) => { setMemo(v); setFieldErrors((prev) => ({ ...prev, description: undefined })); }} placeholder="Brief note or context for this record." expandMode="full" hideCounter />
                      </div>
                      {fieldErrors.description ? (
                        <p className="text-[11px] text-red-600 mt-1" style={{ fontWeight: 500 }}>{fieldErrors.description}</p>
                      ) : method === 'Other' ? (
                        <p className="text-[11px] text-slate-400 mt-1">Required when the method is “Other”.</p>
                      ) : null}
                    </div>
                    {mode === 'prepay' && prepayTarget !== 'pre-invoice' && (
                      <div className="pt-1">
                        <p className="text-[11px] text-slate-600 inline-flex items-center gap-1.5 leading-snug">
                          <Info className="w-3.5 h-3.5 shrink-0" style={{ color: t.text }} /> Held on the vendor account, apply it to any future invoice for {selectedVendors[0]}.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Pre-invoice prepayment section — full-width under the
                details card (user 9/25), the pre-invoice equivalent of the
                pay flow's "Invoices To Pay". SINGLE and multi read the
                same table now. */}
            {mode === 'prepay' && prepayTarget === 'pre-invoice' && selectedPreInvoices.length > 0 && renderMultiPrepayRows()}

            {/* Vendor tabs (feedback 7/21/26) — PO-pill pattern below
                Payment details: the pills switch which vendor card is
                shown, one at a time, cutting the stacked-card scroll. */}
            {isMultiVendorPay && renderVendorTabs()}

            {/* A seeded invoice that an open run reserved never shows a
                blank allocation form (Eli 9/24 R06): the notice names the
                run holding it instead. */}
            {mode === 'pay' && (() => {
              const lockedSeeded = paySeededIds
                .map((id) => invoices.find((i) => i.id === id))
                .filter((i): i is Invoice => !!i && committedByRun.has(i.id));
              if (lockedSeeded.length === 0) return null;
              return (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3.5 py-2.5 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-indigo-900" style={{ fontWeight: 500 }}>
                    {lockedSeeded.map((i) => i.invoiceNumber).join(', ')} {lockedSeeded.length === 1 ? 'is' : 'are'} reserved in {lockedSeeded.length === 1 ? `payment run ${committedByRun.get(lockedSeeded[0].id)}` : 'open payment runs'} and can't be paid here. Cancel or execute the run to release {lockedSeeded.length === 1 ? 'it' : 'them'}.
                  </p>
                </div>
              );
            })()}
            {mode === 'pay' && (
              selectedRows.filter((row) => !isMultiVendorPay || row.vendor === activePayVendor).map((row) => {
                const m = vendorMath(row);
                if (m.selectedInvs.length === 0) return null;
                const available = prepayAvailableFor(row.vendor);
                const hasCredit = available > 0;
                // Discount column always renders (8/31/26, parity with the
                // run tables); rows without a live window read a dash.
                const hasLiveDiscount = true;
                // Currency & Exchange Rates: invoices in a foreign currency show
                // each payment in the base currency at the invoice's rate and at
                // this payment's rate, and the difference.
                const showFx = !isBaseCurrency(settledCurrencyFor(row.vendor));
                const rowPayRate = payRateFor(row.vendor);
                const appliedSum = m.selectedInvs.reduce((s, inv) => s + (lineFor(inv).prepayApplied || 0), 0);
                const remainingCredit = Math.round((available - m.applied) * 100) / 100;
                const creditUsedPct = available > 0 ? Math.min(100, Math.round((m.applied / available) * 100)) : 0;
                return (
                  <div key={row.vendor} className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50 rounded-t-lg flex-wrap">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: t.soft, color: t.text }}><Receipt className="w-3.5 h-3.5" /></div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Invoices To Pay</span>
                      {selectedVendors.length > 1 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <VendorAvatar name={row.vendor} size="sm" />
                          <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{row.vendor}</span>
                        </>
                      )}
                      <span className="ml-auto text-[12px] " style={{ fontWeight: 700 }}>Total Payment {fmt(m.net)}</span>
                      {/* Bulk fill stays one click (Eli 9/8 + Mahreen's
                          condition): amounts start empty, Pay in full
                          consciously fills every selected line. */}
                      <button
                        type="button"
                        onClick={() => m.selectedInvs.forEach((inv) => setLine(inv.id, { amount: inv.outstandingBalance }, inv))}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 bg-white text-[11px] text-primary hover:bg-accent transition-colors cursor-pointer"
                        style={{ fontWeight: 600 }}
                      >
                        <Banknote className="w-3 h-3" /> Pay in Full
                      </button>
                      {/* Bulk remove (user 9/26): the creation form's red
                          action, gated so a payment keeps ≥1 invoice. */}
                      {(() => {
                        const picked = m.selectedInvs.filter((inv) => rowPick.has(inv.id));
                        if (picked.length === 0) return null;
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (picked.length >= m.selectedInvs.length) {
                                toast.error('A payment needs at least one invoice', { description: 'Leave one row on the payment, or cancel the payment instead.' });
                                return;
                              }
                              setRemovePrompt({ kind: 'pay', ids: picked.map((inv) => inv.id), label: picked.length === 1 ? picked[0].invoiceNumber : undefined });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-red-200 bg-red-50 text-[11px] text-red-600 hover:bg-red-100 transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Trash2 className="w-3 h-3" /> Remove {picked.length === 1 ? picked[0].invoiceNumber : `${picked.length} invoices`}
                          </button>
                        );
                      })()}
                      {/* Add invoice sits at the right edge of the header,
                          matching the invoicing line-items header (7/14/26). */}
                      {renderAddInvoiceMenu(row)}
                    </div>
                    {/* The invoice's payment term up top, in one plain
                        sentence (user 9/23 spec): "{p}% off if paid by
                        {date}, otherwise {amount} due by {due}." */}
                    {(() => {
                      const termInv = m.selectedInvs[0];
                      if (!termInv) return null;
                      const dTerms = discountTermsFor(termInv);
                      const due = fmtDeadline(termInv.dueDate);
                      return (
                        <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <p className="text-[11.5px] text-slate-600 min-w-0 truncate" style={{ fontWeight: 500 }}>
                            <span className="text-slate-400" style={{ fontWeight: 600 }}>Terms{termInv.paymentTerms ? ` · ${termInv.paymentTerms}` : ''}</span>
                            <span className="mx-1.5 text-slate-300">·</span>
                            {dTerms
                              ? `${dTerms.percent}% off if paid by ${fmtDeadline(dTerms.deadline)}, otherwise ${fmt(termInv.outstandingBalance)} due by ${due}.`
                              : `${fmt(termInv.outstandingBalance)} due by ${due}.`}
                            {m.selectedInvs.length > 1 && (
                              <span className="text-slate-400"> Each invoice row carries its own dates and discount.</span>
                            )}
                          </p>
                        </div>
                      );
                    })()}
                    {/* One payment can't mix currencies (Currency & Exchange
                        Rates): the vendor's invoices in another currency
                        wait for a payment of their own. */}
                    {row.currencyCounts.length > 1 && (
                      <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-[11.5px] text-slate-500 min-w-0" style={{ fontWeight: 500 }}>
                          This vendor also has open invoices in another currency. One payment can’t mix currencies, so record those as a separate payment.
                        </p>
                      </div>
                    )}
                    {/* Per-vendor pay controls ride WITH the vendor's card
                        (feedback 7/21/26) — no rail disconnect. */}
                    {isMultiVendorPay && renderVendorPayControls(row.vendor)}
                    {hasCredit && (
                      <div className="px-4 py-2 bg-purple-50/60 border-b border-purple-100 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Wallet className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        {/* Segmented credit breakdown — each legend carries its OWN
                            hover tooltip explaining the term (Eli 7/24/26): the
                            standalone "Available prepayments" label is gone; hover
                            any of Available / Applied / Remaining to see its meaning. */}
                        <div className="inline-flex items-stretch rounded-lg border border-purple-200/70 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)] shrink-0">
                          {[
                            { label: 'Available', value: available, dot: 'bg-purple-500', text: 'text-purple-700', tip: 'Prepayment on the vendor account, not yet applied to any invoice.' },
                            { label: 'Applied', value: m.applied, dot: 'bg-success', text: 'text-success', tip: "How much of that prepayment you're applying on this payment." },
                            { label: 'Remaining', value: remainingCredit, dot: 'bg-destructive', text: 'text-destructive', tip: 'What is left on the vendor account after this payment.' },
                          ].map((s, i) => (
                            <Tooltip key={s.label} delayDuration={300}>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 cursor-help ${i > 0 ? 'border-l border-slate-100' : ''}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                                  <span className="text-[10px] text-slate-500 underline decoration-dotted decoration-slate-300 underline-offset-2" style={{ fontWeight: 500 }}>{s.label}</span>
                                  <span className={`text-[11px] ${s.text}`} style={{ fontWeight: 700 }}>{fmt(s.value)}</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] p-2 bg-white border border-border rounded-lg shadow-md z-[300]">
                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>{s.label}</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{s.tip}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-[60px]">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full rounded-full bg-purple-500 transition-all duration-300" style={{ width: `${creditUsedPct}%` }} />
                          </div>
                          <span className="text-[10px] shrink-0 text-slate-500" style={{ fontWeight: 600 }}>{creditUsedPct}% used</span>
                        </div>
                        {/* The credit's own currency and the rate it was paid at
                            (Currency & Exchange Rates). One rate reads as it is;
                            several advances at different rates say how many. */}
                        {(() => {
                          const credits = onAccountPrepaymentsFor(row.vendor).filter((p) => p.exchangeRate);
                          if (credits.length === 0 || isBaseCurrency(credits[0].currency)) return null;
                          const rates = Array.from(new Set(credits.map((p) => p.exchangeRate)));
                          const text = rates.length === 1
                            ? paidRateText(credits[0].currency, { rate: rates[0] })
                            : `In ${credits[0].currency}, paid at ${rates.length} different rates`;
                          return (
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <span className="basis-full order-last pl-[26px] text-[10px] text-purple-700/80 cursor-help" style={{ fontWeight: 500 }}>{text}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Paid Rate</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The rate each advance was paid at. The credit is in the vendor’s currency; the apply list shows each advance’s rate.</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                        {/* Per-record source picker (feedback 7/22/26):
                            choose which on-account advances to draw from;
                            the total spreads oldest-due-first below. The
                            "tied to pre-invoices" figure lives inside it. */}
                        <div className="shrink-0">
                          <PrepaymentSourcePicker
                            sources={onAccountPrepaymentsFor(row.vendor).map((p) => ({
                              id: p.id,
                              label: p.paymentNumber,
                              date: p.paymentDate,
                              remaining: p.unappliedAmount ?? 0,
                              currency: p.currency,
                              rate: p.exchangeRate,
                              rateDate: p.rateDate,
                            }))}
                            draws={drawsFor(row.vendor)}
                            // Outstanding-based headroom (user 9/9): the
                            // typed amounts start empty now, so capping by
                            // them froze the picker at $0 and made every
                            // credit row unselectable.
                            maxTotal={m.selectedInvs
                              .filter((inv) => anchoredCreditFor(inv.invoiceNumber) <= 0)
                              .reduce((s, inv) => {
                                const l = lineFor(inv);
                                const cash = Math.max(0, (l.amount || 0) - (l.prepayApplied || 0));
                                return s + Math.max(0, inv.outstandingBalance - cash);
                              }, 0)}
                            anchoredTotal={anchoredTotalFor(row.vendor)}
                            anchoredCount={m.selectedInvs.filter((inv) => anchoredCreditFor(inv.invoiceNumber) > 0).length}
                            onChange={(next) => applyPrepayDraws(row, next)}
                            fmt={fmt}
                            openSignal={prepayReview.vendor === row.vendor ? prepayReview.n : 0}
                          />
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead className="bg-slate-50/60 border-b border-slate-100">
                          <tr>
                            {/* Bulk selection (user 9/26): the creation
                                form's line-item checkboxes for multi-remove. */}
                            <th className="w-9 pl-4 pr-1 py-2">
                              <Checkbox
                                checked={
                                  m.selectedInvs.length > 0 && m.selectedInvs.every((inv) => rowPick.has(inv.id))
                                    ? true
                                    : m.selectedInvs.some((inv) => rowPick.has(inv.id))
                                      ? 'indeterminate'
                                      : false
                                }
                                onCheckedChange={() =>
                                  setRowPick(
                                    m.selectedInvs.every((inv) => rowPick.has(inv.id))
                                      ? new Set()
                                      : new Set(m.selectedInvs.map((inv) => inv.id)),
                                  )
                                }
                                aria-label="Select all invoices"
                              />
                            </th>
                            <th className="text-left px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Invoice ID</th>
                            <th className="text-left px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Due</th>
                            <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Balance Due</th>
                            {hasLiveDiscount && <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Discount</th>}
                            {hasCredit && <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Vendor Credit Applied</th>}
                            <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Payment</th>
                            {showFx && (
                              <>
                                <th className="text-right px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>
                                  <FxHeader tip="This payment in the base currency at the invoice’s own rate, the rate it was booked at.">Base at Invoice Rate</FxHeader>
                                </th>
                                <th className="text-right px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>
                                  <FxHeader tip="This payment in the base currency at the payment’s rate: today’s rate unless it was changed.">Base at Today’s Rate</FxHeader>
                                </th>
                                <th className="text-right px-3 py-2 text-[11px] text-slate-400 whitespace-nowrap" style={{ fontWeight: 600 }}>
                                  <FxHeader tip="Base at invoice rate minus base at today’s rate. Positive is a gain, negative a loss.">Difference</FxHeader>
                                </th>
                              </>
                            )}
                            <th className="w-9 px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {m.selectedInvs.map((inv, invIdx) => {
                            const l = lineFor(inv);
                            const overAmount = Math.round((l.amount - inv.outstandingBalance) * 100) / 100;
                            const isOver = overAmount > 0.004;
                            const pastDue = daysPastDue(inv.dueDate);
                            const overdue = pastDue >= 0;
                            const paidSoFar = Math.round((inv.amount - inv.outstandingBalance) * 100) / 100;
                            const rowPrepay = l.prepayApplied || 0;
                            const creditLeft = Math.round((available - (appliedSum - rowPrepay)) * 100) / 100;
                            // Cap = outstanding minus the CASH side, never the
                            // typed amount alone (user 9/9): amounts start
                            // empty, and applying credit is itself a way of
                            // settling the invoice.
                            const prepayCap = Math.round(Math.min(Math.max(0, inv.outstandingBalance - Math.max(0, (l.amount || 0) - rowPrepay)), creditLeft) * 100) / 100;
                            const prepayOver = rowPrepay > prepayCap + 0.004;
                            // Anchored advance — recorded against this specific
                            // invoice, auto-applied and locked (feedback 7/14/26).
                            const rowAnchored = anchoredCreditFor(inv.invoiceNumber);
                            // The Payment input reads/writes the CASH side only:
                            // balance due minus the prepayment applied. l.amount
                            // stays the gross settled on the invoice underneath.
                            const rowCash = Math.max(0, Math.round(((l.amount || 0) - rowPrepay) * 100) / 100);
                            // Below the invoice balance — a legitimate partial
                            // payment, flagged orange (meeting feedback 7/17/26).
                            const isBelow = !isOver && (rowCash + rowPrepay) > 0.004 && (rowCash + rowPrepay + (l.lateDiscount?.amount ?? 0)) < inv.outstandingBalance - 0.004;
                            const belowRemainder = Math.max(0, Math.round((inv.outstandingBalance - rowCash - rowPrepay) * 100) / 100);
                            return (
                              <tr key={inv.id} className={rowPick.has(inv.id) ? 'bg-red-50/30' : undefined}>
                                <td className="pl-4 pr-1 py-2">
                                  <Checkbox checked={rowPick.has(inv.id)} onCheckedChange={() => toggleRowPick(inv.id)} aria-label={`Select ${inv.invoiceNumber}`} />
                                </td>
                                {/* Blue text IS a link (Eli 9/8): the number opens the invoice. */}
                                <td className="px-3 py-2 ">
                                  <a
                                    href={`/invoices/${encodeURIComponent(inv.invoiceNumber)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground hover:text-primary hover:underline transition-colors"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {inv.invoiceNumber}
                                  </a>
                                </td>
                                <td className="px-3 py-2">
                                  {/* The run's segmented date + urgency pill (8/28/26
                                      evening) — one due language across pay surfaces. */}
                                  {/* Three states at the CHOSEN date
                                      (user 9/23 spec): discount lives in
                                      its own column; here the row reads
                                      on time or overdue AS OF the payment
                                      date, not today. */}
                                  {paymentDate ? (() => {
                                    const daysLate = Math.round((new Date(`${paymentDate}T00:00:00`).getTime() - new Date(`${inv.dueDate}T00:00:00`).getTime()) / 86400000);
                                    return daysLate > 0 ? (
                                      <span className="inline-flex px-2 py-px rounded-full text-[10px] border bg-red-50 text-red-600 border-red-200 whitespace-nowrap" style={{ fontWeight: 600 }}>
                                        Overdue by {daysLate} Day{daysLate === 1 ? "" : "s"} at Payment Date
                                      </span>
                                    ) : (
                                      <span className="inline-flex px-2 py-px rounded-full text-[10px] border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap" style={{ fontWeight: 600 }}>
                                        On Time at Payment Date
                                      </span>
                                    );
                                  })() : (
                                    <DueDatePill dueDate={inv.dueDate} />
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                                  <div className="flex flex-col items-end leading-tight gap-0.5">
                                    <span>{fmt(inv.outstandingBalance)}</span>
                                    {/* Prepaid-origin note (9/2/26): the
                                        balance being paid names the
                                        prepayment that already covered
                                        part of the original total. */}
                                    <PrepaidOriginNote invoice={inv} />
                                    {paidSoFar > 0.004 && (
                                      <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                                        <span className="text-emerald-600" style={{ fontWeight: 600 }}>{fmt(paidSoFar)} paid</span> of {fmt(inv.amount)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {hasLiveDiscount && (
                                  <td className="px-3 py-2 text-right whitespace-nowrap">
                                    <DiscountCell inv={inv} paymentDate={paymentDate} onUseDiscounted={(amt) => setLine(inv.id, { amount: amt }, inv)} />
                                  </td>
                                )}
                                {hasCredit && (
                                  <td className="px-3 py-2 text-right">
                                    {/* Prepayment applied — editable for ALL rows (Eli 7/22/26):
                                        an anchored (pre-invoice) advance still auto-applies by
                                        default, but the field is no longer locked, so the user can
                                        adjust where the credit lands. Never-clamps; over-cap warns. */}
                                    <div className="relative inline-block">
                                      <MoneyInput
                                        value={rowPrepay}
                                        placeholder="0.00"
                                        onValueChange={(v) => {
                                          // amount = cash + credit: the typed cash side stays put,
                                          // the gross moves with the credit (user 9/9).
                                          setLine(inv.id, { prepayApplied: v, amount: Math.round((rowCash + v) * 100) / 100 }, inv);
                                          setPrepayApply((prev) => ({ ...prev, [row.vendor]: false }));
                                          // Editing an anchored row unlocks it from the auto-apply effect.
                                          if (rowAnchored > 0) setAnchoredTouched((prev) => { const n = new Set(prev); n.add(inv.id); return n; });
                                        }}
                                        className={`h-7 text-right text-[12px] font-semibold rounded-md border bg-white px-2 outline-none focus:ring-1 ${prepayOver ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-red-100 pl-7' : rowPrepay > 0 ? `border-purple-200 focus:border-purple-400 focus:ring-purple-100 text-purple-700 ${rowAnchored > 0 ? 'pl-7' : ''}` : 'border-slate-300 text-foreground focus:border-primary focus:ring-primary/20'}`}
                                      />
                                      {prepayOver ? (
                                        <HoverCard openDelay={300} closeDelay={120}>
                                          <HoverCardTrigger asChild>
                                            <button type="button" tabIndex={-1} className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-500 hover:bg-red-100 transition-colors cursor-help" aria-label="Prepayment exceeds what can be applied">
                                              <AlertTriangle className="w-3 h-3" />
                                            </button>
                                          </HoverCardTrigger>
                                          <HoverCardContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Exceeds What Can Be Applied</p>
                                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                              Applied is <span className="text-foreground " style={{ fontWeight: 600 }}>{fmt(rowPrepay)}</span> but only{' '}
                                              <button type="button" onClick={() => setLine(inv.id, { prepayApplied: Math.max(0, prepayCap), amount: Math.round((rowCash + Math.max(0, prepayCap)) * 100) / 100 }, inv)} className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline" style={{ fontWeight: 600 }}>{fmt(Math.max(0, prepayCap))}</button>{' '}
                                              can go against this invoice. Click the amount to snap the input back.
                                            </p>
                                          </HoverCardContent>
                                        </HoverCard>
                                      ) : rowAnchored > 0 ? (
                                        <Tooltip delayDuration={300}>
                                          <TooltipTrigger asChild>
                                            <button type="button" tabIndex={-1} className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-purple-500 hover:bg-purple-100 transition-colors cursor-help" aria-label="Auto-applied from a pre-invoice">
                                              <Wallet className="w-3 h-3" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Auto-Applied Prepayment</p>
                                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                              Recorded against this pre-invoice and applied automatically. Edit the amount to apply the credit differently.
                                            </p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : null}
                                    </div>
                                  </td>
                                )}
                                <td className="px-3 py-2 text-right">
                                  <div className="relative inline-block" id={`pay-amt-${inv.id}`}>
                                    <MoneyInput
                                      value={rowCash}
                                      placeholder="0.00"
                                      autoFocus={startAtStep2 && invIdx === 0}
                                      onValueChange={(v) => setLine(inv.id, { amount: Math.round((v + rowPrepay) * 100) / 100 }, inv)}
                                      className={`h-8 text-right text-[12px] font-semibold rounded-md border bg-white px-2 outline-none focus:ring-1 ${isOver ? 'border-rose-300 text-rose-700 focus:border-rose-400 focus:ring-rose-100 pl-7' : isBelow ? 'border-slate-300 focus:border-primary focus:ring-primary/20 pl-7' : 'border-slate-300 focus:border-primary focus:ring-primary/20'}`}
                                    />
                                    {/* A partial payment is a CHOICE, not an
                                        error (Nophil 9/23): quiet info cue,
                                        plain statement, no push back to the
                                        full amount. Silent while empty. */}
                                    {isBelow && (
                                      <HoverCard openDelay={300} closeDelay={120}>
                                        <HoverCardTrigger asChild>
                                          <button type="button" tabIndex={-1} className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:bg-slate-100 transition-colors cursor-help" aria-label="Partial payment">
                                            <Info className="w-3 h-3" />
                                          </button>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                          <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Partial Payment</p>
                                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                            The amount entered is less than the balance due. If you continue, this records a partial payment and <span className="text-foreground " style={{ fontWeight: 600 }}>{fmt(belowRemainder)}</span> stays open on the invoice.
                                          </p>
                                        </HoverCardContent>
                                      </HoverCard>
                                    )}
                                    {/* Over the balance is REFUSED (Eli
                                        9/24 M16): rose identity, the hover
                                        names the max, Record won't post it. */}
                                    {isOver && (
                                      <HoverCard openDelay={300} closeDelay={120}>
                                        <HoverCardTrigger asChild>
                                          <button type="button" tabIndex={-1} className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-rose-500 hover:bg-rose-100 transition-colors cursor-help" aria-label="Payment exceeds the balance">
                                            <AlertCircle className="w-3 h-3" />
                                          </button>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="top" className="max-w-[270px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                          <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Payment Exceeds the Balance</p>
                                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                            Only <span className="text-foreground " style={{ fontWeight: 600 }}>{fmt(Math.max(0, Math.round((inv.outstandingBalance - rowPrepay) * 100) / 100))}</span> is owed on this invoice. A payment can't exceed the balance due.
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => setLine(inv.id, { amount: inv.outstandingBalance }, inv)}
                                            className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 bg-rose-50 text-[11px] text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                            style={{ fontWeight: 600 }}
                                          >
                                            Use max · {fmt(Math.max(0, Math.round((inv.outstandingBalance - rowPrepay) * 100) / 100))}
                                          </button>
                                        </HoverCardContent>
                                      </HoverCard>
                                    )}
                                  </div>
                                </td>
                                {showFx && (() => {
                                  const d = exchangeDifference(rowCash, invoiceFx(inv).rate, rowPayRate);
                                  return (
                                    <>
                                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{rowCash > 0 ? formatMoney(d.booked, BASE_CURRENCY) : '—'}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 whitespace-nowrap">{rowCash > 0 ? formatMoney(d.atPayment, BASE_CURRENCY) : '—'}</td>
                                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ fontWeight: 600, color: d.difference > 0.004 ? '#047857' : d.difference < -0.004 ? '#B91C1C' : '#64748B' }}>
                                        {rowCash > 0 ? signedBase(d.difference) : '—'}
                                      </td>
                                    </>
                                  );
                                })()}
                                <td className="px-3 py-2 text-center">
                                  {m.selectedInvs.length > 1 ? (
                                    /* Removal confirms through the creation
                                       form's red prompt (user 9/26). */
                                    <button type="button" onClick={() => setRemovePrompt({ kind: 'pay', ids: [inv.id], label: inv.invoiceNumber })} className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer" title="Remove from this payment" aria-label={`Remove ${inv.invoiceNumber}`}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    // A payment needs at least one invoice — the last row can't be removed.
                                    <span className="p-1 inline-flex text-slate-200 cursor-not-allowed" title="A payment needs at least one invoice">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT sidebar ── view-only cards (scroll) + pinned breakdown */}
        <div className="hidden lg:flex w-[30%] bg-slate-50 border-l border-slate-100 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Vendor Information — view only, clean identity card */}
            <div className="relative rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              {selectedVendors.length > 1 ? (
                <div className="p-4 flex items-center gap-3">
                  <div className="flex -space-x-2 shrink-0">
                    {selectedVendors.slice(0, 4).map((v) => (<div key={v} className="ring-2 ring-white rounded-md"><VendorAvatar name={v} size="sm" /></div>))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] text-foreground tracking-tight" style={{ fontWeight: 600 }}>{selectedVendors.length} vendors selected</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{grand.invoices} invoice{grand.invoices === 1 ? '' : 's'} · {grand.records} payment{grand.records === 1 ? '' : 's'}</p>
                  </div>
                </div>
              ) : (() => {
                const v = mockVendors.find((mv) => mv.vendorName === selectedVendors[0]);
                const row = baseRows.find((r) => r.vendor === selectedVendors[0]);
                // The term pill follows the INVOICES being paid when they
                // carry their own explicit term (user 9/25): a 2/10 discount
                // invoice then reads "2/10 Net 30 Post Shipping" here and its
                // hover discloses the discount, instead of the vendor default.
                // Only fires when EVERY selected invoice carries an explicit
                // term and they all agree — otherwise the vendor default
                // stands, so ordinary invoices are unchanged.
                const selInvsForTerm = row ? row.open.filter((inv) => lineFor(inv).selected) : [];
                const explicitTerms = [...new Set(selInvsForTerm.map((inv) => inv.paymentTerms).filter((t): t is string => !!t))];
                const allExplicit = selInvsForTerm.length > 0 && selInvsForTerm.every((inv) => !!inv.paymentTerms);
                const sidebarTerm = allExplicit && explicitTerms.length === 1 ? explicitTerms[0] : (v?.paymentTerms ?? row?.terms ?? 'Net 30');
                // Same vendor blurb shown in the step-1 selection list.
                const blurb = row
                  ? `Active vendor on ${row.terms} terms, settling in ${row.currency}.${row.open.length > 0 ? ` ${row.open.length} open invoice${row.open.length === 1 ? '' : 's'} totaling ${fmtIn(row.currency)(row.due)} outstanding.` : ` No open balance${row.closed.length ? `, ${row.closed.length} paid invoice${row.closed.length === 1 ? '' : 's'} on file.` : ' right now.'}`}`
                  : v
                    ? `${v.category} · ${v.type} vendor`
                    : '';
                return (
                  <div className="p-4">
                    {/* The vendor NAME is the link now (user 9/25): the
                        corner View CTA is gone — hover turns the name blue
                        and underlined, click opens the partner detail in a
                        new tab. Same recipe as the payment detail hero. */}
                    <div className="flex items-start gap-3">
                      <VendorAvatar name={selectedVendors[0]} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={partnerVendorUrl(selectedVendors[0] ?? '')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate max-w-full text-[15px] text-foreground tracking-tight hover:text-primary hover:underline underline-offset-2 transition-colors"
                            style={{ fontWeight: 600 }}
                            title={`Open ${selectedVendors[0]} in Partners`}
                          >
                            {selectedVendors[0]}
                          </a>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100" style={{ fontWeight: 600 }}>Active</span>
                        </div>
                        {blurb && <VendorBlurb text={blurb} accent="hsl(var(--primary))" />}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border bg-white" style={{ fontWeight: 600, color: t.text, borderColor: t.softBorder }}>
                            {mode === 'prepay' ? <><Wallet className="w-2.5 h-2.5" /> Prepayment</> : <><Banknote className="w-2.5 h-2.5" /> Payment</>}
                          </span>
                          <PaymentTermPill termLabel={sidebarTerm} />
                        </div>
                      </div>
                    </div>
                    {/* Payment method — vendor information (feedback
                        7/14/26), partner card design. The "Change" link
                        sits on the label row, outside the card, mirroring
                        the Payment Terms card in the creation form. */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        {/* "Vendor payment method" (user 9/9): this is how
                            the VENDOR gets paid, off their partner profile —
                            which is why changing the pay-from account below
                            doesn't rewrite it. The info tip says so. */}
                        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                          Vendor Payment Method<span className="text-red-500">*</span>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center justify-center cursor-help" onClick={(e) => e.stopPropagation()}>
                                <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Vendor Payment Method</p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                How this vendor receives payment. It comes from the payment methods saved on the vendor's profile in Partner Management. Picking one sets the matching pay-from account in the Payment section below.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPaymentMethodModalOpen(true)}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer"
                          style={{ fontWeight: 500 }}
                        >
                          <Edit3 className="w-2.5 h-2.5" />
                          Change
                        </button>
                      </div>
                      {methodCard}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Payment / Prepayment — method, pay-from, account */}
            <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50 rounded-t-lg flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: t.soft, color: t.text }}><ModeIcon className="w-3.5 h-3.5" /></div>
                <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{mode === 'prepay' ? 'Prepayment' : 'Payment'}</span>
              </div>
              <div className="p-3.5 space-y-2.5">
                {/* Single vendor: the method lives in the vendor card above
                    (it's vendor information) and one pay-from field covers
                    the run. Multi-vendor bulk runs get a per-vendor list —
                    each vendor's own method + account, with Apply to all
                    (feedback 7/21/26). */}
                {isMultiVendorPay ? (
                  renderBulkPayControls()
                ) : (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Pay-From Account<span className="text-red-500">*</span></Label>
                    {payFromField}
                    {lowBalance && (
                      <p className="text-[10px] text-amber-600 inline-flex items-center gap-1" style={{ fontWeight: 500 }}><AlertTriangle className="w-3 h-3" /> The available balance is below the total to pay. You can still record, nothing is blocked.</p>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500 inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                    {mode === 'prepay' ? <>Prepayment Account<span className="text-red-500">*</span></> : (<>A/P Account<Lock className="w-2.5 h-2.5 text-slate-300" /></>)}
                  </Label>
                  {mode === 'prepay' ? (
                    <Select value={assetAccount} onValueChange={setAssetAccount}>
                      <SelectTrigger className="h-10 text-sm bg-white border-slate-200 text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {PREPAYMENT_ASSET_ACCOUNTS.map((acc) => (<SelectItem key={acc} value={acc} className="text-[12px] ">{formatGLAccount(acc)}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  ) : (
                    /* Locked (design review 7/9/26): the A/P account is set
                       at invoice creation from the vendor profile, so the
                       payment must settle the same account. */
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <div className="w-full inline-flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-[12px] cursor-not-allowed" style={{ fontWeight: 500 }}>
                          <span className="truncate text-left">{formatGLAccount(apAccount)}</span>
                          <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                        <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Set by the Vendor Profile</p>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The A/P account was locked at invoice creation and the payment settles that same account. Manage it from the vendor record.</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>

            {/* Attachments — proof of payment upload */}
            <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0"><Paperclip className="w-3.5 h-3.5 text-slate-600" /></div>
                <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Attachments</span>
                {/* The "pending" chip is gone (Nophil 9/22): it read as
                    a recorded payment awaiting confirmation. The proof is
                    optional and never holds up recording; the drop zone
                    names the document it takes. */}
                {attachments.length > 0 && (
                  <span className="ml-auto text-[11px] text-slate-400 ">{attachments.length}</span>
                )}
              </div>
              {/* Partner-style drop zone (attachment visuals rev 7/15/26,
                  supersedes the 7/9/26 single-row compact). */}
              <div className="p-3.5 space-y-2">
                <input
                  type="file"
                  id="payment-proof-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAttachments((prev) => [...prev, { name: file.name }]);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('payment-proof-upload')?.click()}
                  className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                  title="Receipt, wire confirmation, or bank slip · PDF, JPG, PNG up to 10MB"
                >
                  <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-slate-500" />
                  </span>
                  <span className="text-[11px] text-slate-600 mt-1" style={{ fontWeight: 500 }}>
                    <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span>{' '}
                    {mode === 'prepay' ? 'proof of prepayment' : `the ${proofLabelFor(method)}`}
                  </span>
                  <span className="text-[10px] text-slate-400">PDF, JPG, PNG up to 10MB</span>
                </button>
                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-0.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                          aria-label={`Remove ${file.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pinned totals breakdown (sticky footer, mirrors invoicing).
              Always visible — the collapse hid the balance + payment
              amounts by default (design review 7/9/26). */}
          <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
            {/* Summary reads Invoice total → Total payment → Remaining
                balance to pay (copy rev 7/15/26). */}
            {(() => {
              const totalOutstanding = mode === 'pay'
                ? Math.round(selectedRows.reduce((s, row) => s + vendorMath(row).selectedInvs.reduce((t, inv) => t + inv.outstandingBalance, 0), 0) * 100) / 100
                : 0;
              const remainingToPay = Math.max(0, Math.round((totalOutstanding - grand.gross) * 100) / 100);
              // Live early-pay discounts across every selected invoice at
              // the chosen payment date (user 9/25): the Discount column's
              // total, so multi-invoice payments show the aggregate here.
              const discountTotal = mode === 'pay'
                ? Math.round(selectedRows.reduce((s, row) => s + vendorMath(row).selectedInvs.reduce((t, inv) => {
                    const dt = discountTermsFor(inv);
                    return dt && discountIsLive(dt, paymentDate || undefined)
                      ? t + discountAmountOn(inv.outstandingBalance, dt)
                      : t;
                  }, 0), 0) * 100) / 100
                : 0;
              // The prepay summary mirrors the pay anatomy (user 9/25):
              // Discount + Total prepayment lines over the big remaining
              // number — same logic, computed off the pre-invoices.
              const preInvTableMode = mode === 'prepay' && prepayTarget === 'pre-invoice' && selectedPreInvoices.length > 0;
              // What's still owed across the picks (credits and earlier
              // prepayments already off), so paying it all leaves $0.00.
              const preOutstandingTotal = Math.round(selectedPreInvoices.reduce((s, pi) => s + Math.max(0, pi.outstandingBalance), 0) * 100) / 100;
              const preDiscountTotal = preInvTableMode
                ? Math.round(selectedPreInvoices.reduce((t, pi) => {
                    const dt = discountTermsFor(pi);
                    return dt && discountIsLive(dt, paymentDate || undefined)
                      ? t + discountAmountOn(pi.amount, dt)
                      : t;
                  }, 0) * 100) / 100
                : 0;
              const remainingToPrepay = Math.max(0, Math.round((preOutstandingTotal - prepayAmount) * 100) / 100);
              // Currency & Exchange Rates: per vendor payment, its invoices'
              // currency, payment currency, rate and exchange difference. One
              // currency reads in it; several (a multi-vendor run) read in the
              // base currency, each converted at its own payment's rate.
              const r2 = (n: number) => Math.round(n * 100) / 100;
              const perRow = mode === 'pay'
                ? selectedRows.map((row) => {
                    const m = vendorMath(row);
                    const rate = payRateFor(row.vendor);
                    let diff = 0;
                    m.selectedInvs.forEach((inv) => {
                      const l = lineFor(inv);
                      const amt = l.amount || 0;
                      const cash = Math.max(0, amt - Math.min(l.prepayApplied || 0, amt));
                      diff += exchangeDifference(cash, invoiceFx(inv).rate, rate).difference;
                    });
                    const discount = m.selectedInvs.reduce((t, inv) => {
                      const dt = discountTermsFor(inv);
                      return dt && discountIsLive(dt, paymentDate || undefined) ? t + discountAmountOn(inv.outstandingBalance, dt) : t;
                    }, 0);
                    const outstanding = m.selectedInvs.reduce((t, inv) => t + inv.outstandingBalance, 0);
                    return { vendor: row.vendor, cur: settledCurrencyFor(row.vendor), payCur: payCurrencyFor(row.vendor), rate, m, diff, discount, outstanding };
                  })
                : [];
              const mixedCurrencies = new Set(perRow.map((r) => r.cur)).size > 1;
              const sumIn = (pick: (r: (typeof perRow)[number]) => number) =>
                r2(perRow.reduce((t, r) => t + (mixedCurrencies ? toBase(pick(r), r.rate) : pick(r)), 0));
              const fmtSum = (n: number) => (mixedCurrencies ? formatMoney(n, BASE_CURRENCY) : fmt(n));
              const payCurrencies = Array.from(new Set(perRow.map((r) => r.payCur)));
              const payTotal = payCurrencies.length === 1 ? r2(perRow.reduce((t, r) => t + inPayCurrency(r.vendor, r.m.net), 0)) : null;
              const baseTotal = r2(perRow.reduce((t, r) => t + toBase(r.m.net, r.rate), 0));
              const diffTotal = r2(perRow.reduce((t, r) => t + r.diff, 0));
              const anyForeign = perRow.some((r) => !isBaseCurrency(r.cur));
              const paidInBase = payCurrencies.length === 1 && isBaseCurrency(payCurrencies[0]);
              return (
                <>
                  {mode === 'pay' && (
                    <div className="space-y-1.5 pb-2">
                      {discountTotal > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-emerald-700" style={{ fontWeight: 500 }}>Discount</span>
                          <span className="text-[12px] text-emerald-700 " style={{ fontWeight: 600 }}>−{fmtSum(sumIn((r) => r.discount))}</span>
                        </div>
                      )}
                      {grand.applied > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-purple-700" style={{ fontWeight: 500 }}>Vendor Credit Applied</span>
                          <span className="text-[12px] text-purple-700 " style={{ fontWeight: 600 }}>−{fmtSum(sumIn((r) => r.m.applied))}</span>
                        </div>
                      )}
                      {/* The total in the payment currency (Currency & Exchange Rates). */}
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Total Payment</span>
                        <span className="text-[12px] text-foreground " style={{ fontWeight: 600 }}>
                          {payTotal != null ? formatMoney(payTotal, payCurrencies[0]) : formatMoney(baseTotal, BASE_CURRENCY)}
                        </span>
                      </div>
                      {anyForeign && !paidInBase && (
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>In {BASE_CURRENCY} (base)</span>
                          <span className="text-[12px] text-slate-600 tabular-nums" style={{ fontWeight: 500 }}>{formatMoney(baseTotal, BASE_CURRENCY)}</span>
                        </div>
                      )}
                      {anyForeign && <ExchangeDifferenceLine difference={diffTotal} />}
                    </div>
                  )}
                  {preInvTableMode && (
                    <div className="space-y-1.5 pb-2">
                      {preDiscountTotal > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-emerald-700" style={{ fontWeight: 500 }}>Discount</span>
                          <span className="text-[12px] text-emerald-700 " style={{ fontWeight: 600 }}>−{fmt(preDiscountTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Total Prepayment</span>
                        <span className="text-[12px] text-foreground " style={{ fontWeight: 600 }}>{fmt(prepayAmount)}</span>
                      </div>
                    </div>
                  )}
                  <div className="pt-2.5 border-t border-slate-100 flex justify-between items-baseline">
                    <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                      {mode === 'pay' ? 'Remaining Balance to Pay' : preInvTableMode ? 'Remaining Expected to Prepay' : 'Net to Pay'}
                    </span>
                    <span className="text-[20px] text-foreground leading-none tracking-tight" style={{ fontWeight: 700 }}>
                      {mode === 'pay'
                        ? fmtSum(sumIn((r) => Math.max(0, r.outstanding - r.m.gross)))
                        : fmt(preInvTableMode ? remainingToPrepay : prepayAmount)}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6">
      {/* Backdrop */}
      {!successRecords && <div className="absolute inset-0 bg-black/40" onClick={handleCancelClick} />}

      {/* Shell */}
      <div
        className={`relative bg-white flex flex-col overflow-hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${successRecords ? 'hidden' : ''} ${
          recorded
            ? 'w-full sm:w-auto sm:min-w-[440px] sm:max-w-[560px] h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl'
            : isFullScreen
              ? 'w-full h-full max-w-full max-h-full sm:max-w-[calc(100vw-1.5rem)] lg:max-w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-1.5rem)] lg:max-h-[calc(100vh-2rem)] rounded-none sm:rounded-2xl'
              : `w-full sm:w-[calc(100%-2rem)] ${isV2 ? 'sm:max-w-[1430px] sm:h-[92vh]' : 'sm:max-w-[min(70vw,1320px)] sm:h-[90vh]'} h-[100dvh] rounded-none sm:rounded-2xl`
        }`}
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
      >
        {/* ── Header ── */}
        {/* Header bottom padding: the step-tab strip normally provides the
            spacing above the border, but it's hidden on the recorded
            confirmation AND on pre-scoped direct flows — both need real
            padding or the title sits flush on the divider. */}
        <div className={`px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 ${recorded || startAtStep2 ? 'pb-3 sm:pb-4' : 'pb-0'} shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-slate-100`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {!recorded && (
                <button
                  type="button"
                  onClick={handleHeaderBack}
                  className="w-10 h-10 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                  aria-label={vendorFirst && entryStage === 'flow' ? 'Back to payment type' : step === 2 ? 'Back to selection' : 'Back to payment type'}
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
              )}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: t.soft, color: t.text }}
              >
                <ModeIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                  {recorded
                    ? mode === 'prepay'
                      ? 'Prepayment Recorded'
                      : recorded[0]?.record.status === 'Scheduled' ? 'Payment Scheduled' : 'Payment Recorded'
                    : mode === 'prepay' ? 'Record Prepayment' : 'Record Payment'}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                  {recorded
                    ? mode === 'prepay'
                      ? 'The advance sits on the vendor account, ready to apply.'
                      : recorded[0]?.record.status === 'Scheduled' ? 'Queued to send on the payment date.' : 'Saved to your payments list.'
                    : mode === 'prepay'
                      ? 'Pay a vendor in advance, applied to an invoice later.'
                      : 'Settle approved invoices, one payment recorded per vendor.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {!recorded && (
                <button
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullScreen ? 'Exit Full' : 'Full View'}
                </button>
              )}
              <button
                onClick={handleCancelClick}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Step tabs — the vendor-first 3-step stepper (Select vendor →
              What to pay → Record …). Hidden on the recorded confirmation and
              on pre-scoped deep-link entries (the invoice/pre-invoice was
              already chosen, so there is no pre-flow). A completed pill jumps
              back to that stage; the third pill spans the resumed flow's own
              internal select→configure sub-steps. */}
          {!recorded && vendorFirst && (
            <div className="flex items-center justify-between gap-3 mt-3 sm:mt-3.5 -mb-px">
              <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
                {VF_STEPS.map((label, i) => {
                  const active = vfIndex === i;
                  const completed = vfIndex > i;
                  const goToStage = () => {
                    if (!completed) return;
                    // Reset the inner step so the vendor stage always shows the
                    // Step 1 selection, never the leftover config (glitch fix 7/24).
                    if (i === 0) { setStep(1); setMode('pay'); setEntryStage('vendor'); }
                    else if (i === 1) { setStep(1); setEntryStage('choose'); }
                  };
                  return (
                    <div
                      key={label}
                      className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${completed ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={goToStage}
                    >
                      <div
                        className="w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 transition-all duration-200"
                        style={
                          completed
                            ? { backgroundColor: 'hsl(var(--success))', color: '#fff', fontWeight: 600 }
                            : active
                              ? { backgroundColor: 'hsl(var(--primary))', color: '#fff', fontWeight: 600 }
                              : { border: '1.5px solid var(--color-slate-300)', color: 'var(--color-slate-500)', backgroundColor: '#fff', fontWeight: 600 }
                        }
                      >
                        {completed ? <Check className="w-3 h-3" /> : i + 1}
                      </div>
                      <span
                        className="text-[12px] sm:text-[13px] whitespace-nowrap transition-colors"
                        style={{ color: completed ? 'hsl(var(--success))' : active ? 'hsl(var(--primary))' : 'var(--color-slate-700)', fontWeight: active || completed ? 600 : 500 }}
                      >
                        {label}
                      </span>
                      {(active || completed) && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full" style={{ backgroundColor: completed ? 'hsl(var(--success))' : 'hsl(var(--primary))' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Header banner strips — full-bleed, under the header divider ── */}
        {prepayAnchorBanner}

        {/* ── Body ── */}
        <div ref={bodyScrollRef} className={`flex-1 min-h-0 bg-slate-50 ${isV2 && step === 2 && !recorded ? 'overflow-hidden flex' : 'overflow-y-auto'}`}>
          {/* ════ Recorded — success ════ */}
          {recorded ? (
            <div className="p-4 sm:p-6 max-w-2xl mx-auto">
              {(() => { const scheduled = recorded[0]?.record.status === 'Scheduled'; return (
              <div className="flex flex-col items-center text-center pt-4 pb-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center animate-spin-in" style={{ backgroundColor: scheduled ? 'var(--color-blue-100)' : t.soft }}>
                  {scheduled ? (
                    <Clock className="w-7 h-7" style={{ color: 'var(--color-blue-700)' }} />
                  ) : (
                    // Draw-in tick: the circle sweeps first, then the check strokes in.
                    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke={t.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" className="tick-circle" />
                      <path d="M8 12.4l2.6 2.6L16.2 9.4" className="tick-check" />
                    </svg>
                  )}
                </div>
                {/* Hero amount — the recorded value is the thing the user came
                    to confirm, so it gets the big number; the header carries the
                    "recorded" title so it isn't repeated here. */}
                <p className="mt-3 text-[28px] leading-none tracking-tight text-foreground " style={{ fontWeight: 700 }}>
                  {fmtRecordsTotal(recorded.map((r) => r.record))}
                </p>
                {/* Date and timestamp only (user 9/23): the count is
                    visible in the record list right below. */}
                <p className="text-[12px] text-slate-500 mt-2">
                  {scheduled
                    ? `Posts ${dateLabel}`
                    : `Posted ${dateLabel} · ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                </p>
                {mode === 'prepay' && (
                  // The chip speaks the tri-state the record actually holds
                  // (BA 9/28): an anchored advance reads Applied with its
                  // pre-invoice named; an on-account one reads Unapplied.
                  <span className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] border" style={{ fontWeight: 600, backgroundColor: t.soft, color: t.text, borderColor: t.softBorder }}>
                    <Wallet className="w-3 h-3" />
                    {recorded[0]?.record.status === 'Fully Applied' && recorded[0]?.record.preInvoiceId
                      ? `Applied to ${recorded[0].record.preInvoiceId}`
                      : paymentStatusLabel(recorded[0]?.record.status ?? 'Unapplied')}
                  </span>
                )}
              </div>
              ); })()}
              <div className="rounded-xl border border-border bg-white overflow-hidden divide-y divide-border/60">
                {/* Identity row runs full width so the vendor name never
                    truncates; the download CTA sits on its own full-width
                    row underneath (feedback 7/21/26). */}
                {recorded.map(({ record, lines: rlines }) => (
                  <div key={record.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <VendorAvatar name={record.vendor} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>{record.vendor}</p>
                        <p className="text-[11px] text-slate-500">
                          {record.paymentNumber} · {mode === 'prepay'
                            ? `advance${record.linkedPO ? ` · PO ${record.linkedPO}` : ''}`
                            : `${rlines.length} invoice${rlines.length === 1 ? '' : 's'}`}
                        </p>
                      </div>
                      <span className="text-[13px] text-foreground shrink-0" style={{ fontWeight: 700 }}>{formatMoney(record.amount, record.currency)}</span>
                    </div>
                    {/* Every payment record offers its remittance advice
                        (feedback 7/21/26) — prepayments included, with an
                        advance line standing in for the invoice rows. */}
                    {/* The confirmation's one action (user 10/9): primary
                        blue, no footer; the header X closes. */}
                    <Button
                      size="sm"
                      className="mt-2.5 w-full gap-1.5 h-8 text-[12px] bg-primary text-white hover:bg-primary/90"
                      onClick={() =>
                        downloadRemittanceAdvice(record, {
                          lines: rlines.length > 0
                            ? rlines
                            : [{ invoiceNumber: record.linkedPO ? `Advance on PO ${record.linkedPO}` : 'On-account advance', paid: record.amount }],
                        })
                      }
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Remittance Advice (PDF)
                    </Button>
                  </div>
                ))}
              </div>
              {mode === 'prepay' ? (
                <div className="mt-3 rounded-lg border border-border bg-slate-50/60 px-3 py-2.5">
                  <p className="text-[11px] text-slate-400 mb-1" style={{ fontWeight: 600 }}>What Happens Next</p>
                  {(() => {
                    const rec = recorded[0]?.record;
                    const pi = rec?.preInvoiceId ? invoices.find((i) => i.id === rec.preInvoiceId) : null;
                    return (
                      <p className="text-[12px] text-slate-600 leading-snug">
                        {pi
                          ? `Available on the payment for the invoice once ${pi.invoiceNumber} is converted${rec?.autoApply ? ', and pre-checked automatically.' : '.'}`
                          : `Available to apply to any open invoice for ${rec?.vendor ?? 'this vendor'}.`}
                      </p>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          ) : inPreFlow ? (
            /* ════ Step 2 — What to pay (vendor-first option boxes) ════ */
            <div className="flex flex-col bg-white min-h-full">
                <div className="px-3 sm:px-4 lg:px-5 py-5 sm:py-6 max-w-[980px] w-full mx-auto">
                  {/* ── Vendor banner — mirrors the partner "Group Selected"
                        card: identity on the left, account summary chips on the
                        right, soft primary-tinted frame. ── */}
                  <div className="rounded-xl bg-white border border-primary/25 shadow-[0_1px_4px_rgba(10,119,255,0.06),0_4px_12px_-2px_rgba(0,0,0,0.06)] overflow-hidden mb-5">
                    <div className="flex items-center justify-between gap-3 px-3.5 py-3 flex-wrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <VendorAvatar name={chosenVendor} size="lg" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[14px] text-foreground tracking-tight truncate" style={{ fontWeight: 600 }}>{chosenVendor}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100" style={{ fontWeight: 600 }}>
                              Active
                            </span>
                            {chosenVendorOpt?.terms && <PaymentTermPill termLabel={chosenVendorOpt.terms} />}
                            <BankMethodHoverPill vendorName={chosenVendor} />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {chosenVendorOpt && (chosenVendorOpt.openInvoices > 0 || chosenVendorOpt.openPreInvoices > 0)
                              ? `${chosenVendorOpt.openInvoices} open invoice${chosenVendorOpt.openInvoices === 1 ? '' : 's'}${chosenVendorOpt.openPreInvoices > 0 ? `, ${chosenVendorOpt.openPreInvoices} pre-invoice${chosenVendorOpt.openPreInvoices === 1 ? '' : 's'}` : ''}, settling in ${chosenVendorOpt.currency}.`
                              : 'No open documents on file.'}
                          </p>
                        </div>
                      </div>
                      {/* Account summary — stat blocks (label under value) read
                          cleaner than pill chips at a glance (7/24/26). Each
                          stat carries a hover tooltip explaining the number,
                          same recipe as the type-card tooltips (7/27/26);
                          labels are sentence case, not caps. */}
                      {chosenVendorOpt && (chosenVendorOpt.outstanding > 0 || chosenVendorOpt.overdue > 0 || chosenVendorOpt.advance > 0) && (
                        <div className="flex items-stretch shrink-0 rounded-lg border border-slate-200 bg-white divide-x divide-slate-100 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                          {([
                            // Outstanding keeps the plain black/grey identity
                            // (user 9/26); Overdue and Vendor credit color
                            // their label, tip prefix AND the TIP box itself.
                            chosenVendorOpt.outstanding > 0 ? {
                              key: 'outstanding',
                              value: fmt(chosenVendorOpt.outstanding),
                              label: 'Outstanding',
                              valueClass: 'text-foreground',
                              labelClass: 'text-slate-400',
                              tipColor: '#334155',
                              tipBoxClass: 'bg-slate-50 border-muted',
                              tipLabelClass: 'text-slate-400',
                              desc: `The total balance still unpaid across ${chosenVendor}'s open invoices.`,
                              tip: 'Paying open invoices brings this number down.',
                            } : null,
                            chosenVendorOpt.overdue > 0 ? {
                              key: 'overdue',
                              value: String(chosenVendorOpt.overdue),
                              label: 'Overdue',
                              valueClass: 'text-red-600',
                              // Full red on the label too (user 9/26): the
                              // washed red-400 read as a different hue.
                              labelClass: 'text-red-600',
                              tipColor: '#DC2626',
                              tipBoxClass: 'bg-red-50 border-red-100',
                              tipLabelClass: 'text-red-400',
                              desc: 'How many of the open invoices are past their due date.',
                              tip: 'Vendor credit applies to the most overdue invoice first.',
                            } : null,
                            chosenVendorOpt.advance > 0 ? {
                              key: 'advance',
                              value: fmt(chosenVendorOpt.advance),
                              // "Vendor credit", never "On account" (user
                              // 9/24): one name for this money everywhere.
                              label: 'Vendor Credit',
                              valueClass: 'text-teal-700',
                              labelClass: 'text-teal-700',
                              tipColor: '#0F766E',
                              tipBoxClass: 'bg-teal-50 border-teal-100',
                              tipLabelClass: 'text-teal-600/80',
                              // BA copy 9/25.
                              desc: 'Vendor credit that has not been applied to an invoice yet.',
                              tip: 'Apply it to an invoice when you’re ready.',
                            } : null,
                          ].filter(Boolean) as { key: string; value: string; label: string; valueClass: string; labelClass: string; tipColor: string; tipBoxClass: string; tipLabelClass: string; desc: string; tip: string }[]).map((stat) => (
                            <Tooltip key={stat.key}>
                              <TooltipTrigger asChild>
                                <div className="px-3 py-1.5 text-right cursor-help">
                                  <p className={`text-[13px] leading-tight ${stat.valueClass}`} style={{ fontWeight: 700 }}>{stat.value}</p>
                                  <p className={`text-[10px] mt-0.5 ${stat.labelClass}`} style={{ fontWeight: 600 }}>{stat.label}</p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                                <p className="text-slate-500">{stat.desc}</p>
                                <div className={`mt-2 px-2.5 py-2 rounded-lg border ${stat.tipBoxClass}`}>
                                  <p className={`text-[10px] tracking-wide ${stat.tipLabelClass}`} style={{ fontWeight: 600 }}>Tip</p>
                                  <p className="text-[11px] text-slate-700 mt-1"><span style={{ fontWeight: 600, color: stat.tipColor }}>{stat.label}</span>: {stat.tip}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Heading asks the actual question — "Payment Type" told the
                      user nothing (copy feedback 7/24/26). */}
                  <div className="mb-3">
                    <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>How do you want to pay {chosenVendor}?</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Pick what this payment is recorded against. The details update below.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([
                      // Card accents follow the invoicing listing's TYPE
                      // colors verbatim (user 9/25): BLUE inventory, VIOLET
                      // pre-invoice, TEAL standalone — one type identity
                      // everywhere in the system.
                      // Card headings (user 9/26, second pass): Title Case main
                      // words, articles stay lowercase, and all three read
                      // "Verb a Noun" for grammatical consistency.
                      { key: 'invoices', icon: Banknote, title: 'Pay an Open Invoice', sub: 'Settle what you owe on open invoices', count: chosenVendorOpt?.openInvoices ?? 0, accentColor: '#1D4ED8', accentBg: '#EFF6FF', accentBorder: '#BFDBFE', circleBg: '#3B82F6', circleShadow: 'rgba(59,130,246,0.15)', hoverBorder: 'hover:border-blue-200', hoverCircle: 'group-hover:border-blue-300', overdue: chosenVendorOpt?.overdue ?? 0, tip: { desc: 'Pick the open invoices below and settle them in one payment.', example: 'Bulk Pay', exampleDesc: 'clear several approved invoices in one run.' } },
                      { key: 'pre-invoices', icon: Receipt, title: 'Prepay a Pre-Invoice', sub: 'Pay in advance for goods', count: chosenVendorOpt?.openPreInvoices ?? 0, accentColor: '#6D28D9', accentBg: '#F5F3FF', accentBorder: '#DDD6FE', circleBg: '#8B5CF6', circleShadow: 'rgba(139,92,246,0.15)', hoverBorder: 'hover:border-[#DDD6FE]', hoverCircle: 'group-hover:border-[#C4B5FD]', overdue: 0, tip: { desc: 'The prepayment is automatically applied to the PO when the goods are received.', example: 'Deposit', exampleDesc: 'prepay before goods ship.' } },
                      { key: 'advance', icon: Wallet, title: 'Log a Standalone Advance', sub: 'Record an advance payment', count: null as number | null, accentColor: '#0F766E', accentBg: '#F0FDFA', accentBorder: '#99F6E4', circleBg: '#14B8A6', circleShadow: 'rgba(20,184,166,0.15)', hoverBorder: 'hover:border-teal-200', hoverCircle: 'group-hover:border-teal-300', overdue: 0, tip: { desc: 'Use this when you pay a vendor in advance. The amount is saved as a vendor credit and can be applied to a future invoice.', example: 'Vendor Credit', exampleDesc: 'available credit, applied whenever you choose.' } },
                    ] as const).map((box) => {
                      const BoxIcon = box.icon;
                      // Zero pre-invoices is NOT a dead end and NOT a redirect
                      // (7/24/26): the card still selects, and the panel below
                      // shows an empty state with the Create Pre-Invoice CTA.
                      const isCreatePreInvoice = box.key === 'pre-invoices' && (box.count ?? 0) === 0;
                      // Only "Pay against invoices" is a true no-op when empty.
                      const disabled = box.key === 'invoices' && box.count === 0;
                      const recommended = box.key === recommendedOption && !disabled;
                      // Cards are a SELECTION now (7/24/26): clicking picks the
                      // card, the detail list below updates, Continue proceeds.
                      const isSel = (chooseSel ?? recommendedOption) === box.key && !disabled;
                      return (
                        <Tooltip key={box.key}>
                          <TooltipTrigger asChild>
                            <div
                              role="button"
                              tabIndex={disabled ? -1 : 0}
                              aria-disabled={disabled}
                              onClick={() => {
                                if (disabled) return;
                                setChooseSel(box.key);
                              }}
                              onKeyDown={(e) => {
                                if (disabled) return;
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChooseSel(box.key); }
                              }}
                              className={`group relative rounded-xl overflow-hidden border transition-all duration-200 ${
                                disabled
                                  ? 'opacity-50 cursor-not-allowed border-border bg-white'
                                  : isSel
                                    ? 'cursor-pointer bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                                    : `cursor-pointer border-border bg-white ${box.hoverBorder} hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)]`
                              }`}
                              style={isSel ? { borderColor: `${box.accentBorder}` } : undefined}
                            >
                              {/* Accent wash — solid on the selected card, fades in on hover otherwise (matches partner term-type tiles). */}
                              {!disabled && (
                                <div className={`absolute inset-0 transition-all duration-300 pointer-events-none ${isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} style={{ background: `linear-gradient(135deg, ${box.accentBg}80 0%, transparent 70%)` }} />
                              )}
                              <div className="relative flex items-start gap-3 pl-3.5 pr-3 py-3">
                                <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-all duration-200 ${isSel ? '' : 'group-hover:scale-105'}`} style={{ background: `linear-gradient(135deg, ${box.accentBg}, ${box.accentBorder}66)`, color: box.accentColor }}>
                                  <BoxIcon className="w-[18px] h-[18px]" />
                                </div>
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-[13px] leading-tight" style={{ fontWeight: 600, color: isSel ? box.accentColor : '#0F172A' }}>{box.title}</p>
                                    {/* "Recommended" chip removed (user 9/26):
                                        the pre-selection already says it. */}
                                  </div>
                                  <p className="text-[11px] mt-0.5 truncate" style={{ color: isSel ? box.accentColor : '#94A3B8' }}>{box.sub}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                    {isCreatePreInvoice ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border border-violet-200 bg-violet-50 text-violet-700" style={{ fontWeight: 600 }}>
                                        0 open · create one below
                                      </span>
                                    ) : box.count !== null ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border " style={{ fontWeight: 600, backgroundColor: box.accentBg, color: box.accentColor, borderColor: box.accentBorder }}>
                                        {box.count} open
                                      </span>
                                    ) : chosenVendorOpt && chosenVendorOpt.advance > 0 ? (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border " style={{ fontWeight: 600, backgroundColor: box.accentBg, color: box.accentColor, borderColor: box.accentBorder }}>
                                        {fmt(chosenVendorOpt.advance)} vendor credit
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400">None on file</span>
                                    )}
                                    {box.overdue > 0 && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] border border-red-200 bg-red-50 text-red-600 " style={{ fontWeight: 600 }}>
                                        <AlertTriangle className="w-2.5 h-2.5" /> {box.overdue} overdue
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Selection circle — filled check on the selected card, empty ring that tints on hover otherwise. */}
                                <div
                                  className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 mt-0.5 ${isSel ? '' : disabled ? 'border-[1.5px] border-[#D1D5DB] bg-white' : `border-[1.5px] border-[#D1D5DB] bg-white ${box.hoverCircle}`}`}
                                  style={isSel ? { backgroundColor: box.circleBg, boxShadow: `0 0 0 2px ${box.circleShadow}` } : undefined}
                                >
                                  {isSel && <Check className="w-3 h-3 text-white" strokeWidth={2.5} />}
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-slate-500">{box.tip.desc}</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                              <p className="text-[11px] text-slate-700 mt-1"><span style={{ fontWeight: 600, color: box.accentColor }}>{box.tip.example}</span>: {box.tip.exampleDesc}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  {/* ── Selection detail — updates with the picked card
                        (7/24/26): invoices → tick which to pay; pre-invoices
                        → tick which to reserve for; advance → selected is
                        enough. Partner-groups header band: Select All on the
                        left, the Create CTA on the right. ── */}
                  {(() => {
                    const effSel = chooseSel ?? recommendedOption;
                    if (effSel === 'invoices' && chosenVendorRow && chosenVendorRow.open.length > 0) {
                      const selN = chosenVendorRow.open.filter((inv) => lineFor(inv).selected).length;
                      const allSel = selN === chosenVendorRow.open.length;
                      return (
                        <div className="mt-5">
                          {/* Section heading OUTSIDE the card (7/24/26) — the
                              band below keeps actions only: Select all + Create. */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Open Invoices for {chosenVendor}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border bg-white text-slate-600 border-slate-200" style={{ fontWeight: 600 }}>
                              {selN} of {chosenVendorRow.open.length} selected
                            </span>
                            {chosenVendorRow.currencyCounts.length > 1 && (
                              <InvoiceCurrencySwitch
                                counts={chosenVendorRow.currencyCounts}
                                value={chosenVendorRow.currency}
                                onChange={(code) => switchInvoiceCurrency(chosenVendor, code)}
                              />
                            )}
                          </div>
                          <div className="rounded-xl border border-border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2.5 flex-wrap">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <Checkbox
                                checked={allSel ? true : selN > 0 ? 'indeterminate' : false}
                                className="shrink-0"
                                onCheckedChange={() => setVendorLines(chosenVendorRow, !allSel)}
                                aria-label="Select all invoices"
                              />
                              <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Select All</span>
                            </label>
                            {/* Split CTA (user 9/25): Invoice is primary on
                                THIS tab; the other flows ride the dropdown. */}
                            <CreateDocSplitCta vendor={chosenVendor} primary="invoice" tone="blue" />
                          </div>
                          <div className="p-2.5 space-y-1.5">
                            {chosenVendorRow.open.map((inv) => {
                              const invSelected = lineFor(inv).selected;
                              const pastDue = daysPastDue(inv.dueDate);
                              const invOverdue = pastDue >= 0;
                              return (
                                <div
                                  key={inv.id}
                                  className={`rounded-xl border transition-all px-3 py-2 flex items-center gap-3 cursor-pointer ${invSelected ? '' : 'hover:border-slate-300'}`}
                                  style={invSelected
                                    ? { borderColor: SEL.softBorder, backgroundColor: SEL.soft }
                                    : { borderColor: 'hsl(var(--border))', backgroundColor: '#fff' }}
                                  onClick={() => toggleInvoiceLine(chosenVendorRow, inv)}
                                >
                                  <Checkbox
                                    checked={invSelected}
                                    className="shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleInvoiceLine(chosenVendorRow, inv)}
                                  />
                                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={invSelected ? { backgroundColor: SEL.chevronBg, color: SEL.text } : { backgroundColor: 'var(--color-slate-100)', color: 'var(--color-slate-400)' }}>
                                    <Receipt className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[13px] text-slate-900 " style={{ fontWeight: 600 }}>{inv.invoiceNumber}</span>
                                      {invOverdue && (
                                        <span className={`inline-flex px-2 py-px rounded-full text-[10px] border ${pastDue === 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'}`} style={{ fontWeight: 600 }}>{overdueRowLabel(inv.dueDate)}</span>
                                      )}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-gray-500" style={{ fontWeight: 500 }}>Due {humanDate(inv.dueDate)}</div>
                                  </div>
                                  <div className="flex flex-col items-end leading-none shrink-0">
                                    <span className="text-[14px] text-slate-900 " style={{ fontWeight: 700 }}>{fmt(inv.outstandingBalance)}</span>
                                    <span className="text-[9px] text-slate-400 mt-1" style={{ fontWeight: 600 }}>Balance Due</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          </div>
                        </div>
                      );
                    }
                    if (effSel === 'pre-invoices') {
                      const list = invoices.filter((inv) => inv.type === 'Pre-Invoice' && inv.vendor === chosenVendor && inv.status !== 'Cancelled' && inv.outstandingBalance > 0);
                      const selN = list.filter((pi) => selectedPreInvoiceIds.includes(pi.id)).length;
                      const allSel = list.length > 0 && selN === list.length;
                      const createPreInvoice = () => window.open(`/invoices?create=pre-invoice&vendor=${encodeURIComponent(chosenVendor)}`, '_blank', 'noopener');
                      return (
                        <div className="mt-5">
                          {/* Section heading OUTSIDE the card (7/24/26) — the
                              band below keeps actions only: Select all + Create. */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Pre-Invoices for {chosenVendor}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] border bg-white text-violet-700 border-violet-200" style={{ fontWeight: 600 }}>
                              {selN} of {list.length} selected
                            </span>
                          </div>
                          <div className="rounded-xl border border-violet-200/70 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                          <div className="px-3.5 py-2.5 bg-violet-50/50 border-b border-violet-100 flex items-center gap-2.5 flex-wrap">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <Checkbox
                                checked={allSel ? true : selN > 0 ? 'indeterminate' : false}
                                className="shrink-0 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                                disabled={list.length === 0}
                                onCheckedChange={() => {
                                  if (allSel) { setSelectedPreInvoiceIds([]); return; }
                                  setLines({});
                                  setSelectedVendors([chosenVendor]);
                                  setSelectedPreInvoiceIds(list.map((pi) => pi.id));
                                }}
                                aria-label="Select all pre-invoices"
                              />
                              <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Select All</span>
                            </label>
                            {/* Split CTA (user 9/25): Pre-Invoice is primary
                                on THIS tab; the other flows ride the dropdown. */}
                            <CreateDocSplitCta vendor={chosenVendor} primary="pre-invoice" tone="violet" />
                          </div>
                          {list.length === 0 ? (
                            <TableEmptyState
                              compact
                              kind="no-data"
                              entity={{ singular: 'pre-invoice', plural: 'pre-invoices' }}
                              title="No open pre-invoices yet"
                              description={`No open pre-invoices for ${chosenVendor}.`}
                              onCreate={createPreInvoice}
                              createLabel="Create the First Pre-Invoice"
                            />
                          ) : (
                          <div className="p-2.5 space-y-1.5">
                            {list.map((pi) => {
                              const piSelected = selectedPreInvoiceIds.includes(pi.id);
                              const pick = () => {
                                if (piSelected) { setSelectedPreInvoiceIds((prev) => prev.filter((x) => x !== pi.id)); return; }
                                setLines({});
                                setSelectedVendors([chosenVendor]);
                                setSelectedPreInvoiceIds((prev) => [...prev, pi.id]);
                              };
                              return (
                                <div
                                  key={pi.id}
                                  className={`rounded-xl border transition-all px-3 py-2 flex items-center gap-3 cursor-pointer ${piSelected ? '' : 'hover:border-[#DDD6FE]'}`}
                                  style={piSelected
                                    ? { borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }
                                    : { borderColor: 'hsl(var(--border))', backgroundColor: '#fff' }}
                                  onClick={pick}
                                >
                                  <Checkbox
                                    checked={piSelected}
                                    className="shrink-0 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={pick}
                                  />
                                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-violet-50 text-violet-600">
                                    <Receipt className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[13px] text-slate-900 " style={{ fontWeight: 600 }}>{pi.invoiceNumber}</span>
                                      <span className="inline-flex items-center px-2 py-px rounded-full text-[10px] border bg-violet-50 text-violet-700 border-violet-200" style={{ fontWeight: 600 }}>Pre-Invoice</span>
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-gray-500 truncate" style={{ fontWeight: 500 }}>
                                      {humanDate(pi.invoiceDate)}{pi.linkedPOs.length > 0 ? ` · PO ${pi.linkedPOs[0]}` : ''}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end leading-none shrink-0">
                                    <span className="text-[14px] text-slate-900 " style={{ fontWeight: 700 }}>{fmt(pi.amount)}</span>
                                    <span className="text-[9px] text-slate-400 mt-1" style={{ fontWeight: 600 }}>Expected Total</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          )}
                          </div>
                        </div>
                      );
                    }
                    if (effSel === 'advance') {
                      // Standalone advance now mirrors the pre-invoice flow
                      // structure (user 9/25): a heading, a card whose header
                      // band carries the SAME split Create CTA (standalone is
                      // primary here, the other flows ride the dropdown), and a
                      // centered empty state inside — so all three step-2
                      // flows read the same.
                      const createStandalone = () => window.open(`/invoices?create=standalone&vendor=${encodeURIComponent(chosenVendor)}`, '_blank', 'noopener');
                      return (
                        <div className="mt-5">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Standalone Advance for {chosenVendor}</span>
                          </div>
                          <div className="rounded-xl border border-teal-200/70 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                            <div className="px-3.5 py-2.5 bg-teal-50/50 border-b border-teal-100 flex items-center gap-2.5 flex-wrap">
                              <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Record an Advance</span>
                              {/* Split CTA (user 9/25): Standalone is primary
                                  on THIS tab; the other flows ride the dropdown. */}
                              <CreateDocSplitCta vendor={chosenVendor} primary="standalone" tone="teal" />
                            </div>
                            <div className="px-4 py-8 flex flex-col items-center text-center">
                              <span className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-2"><Wallet className="w-4 h-4" /></span>
                              <p className="text-[12px] text-slate-500 max-w-[420px] leading-relaxed" style={{ fontWeight: 500 }}>
                                {chosenVendorEmpty
                                  ? `No open invoices or pre-invoices for ${chosenVendor}. Log a standalone advance, held as a vendor credit to apply to a future invoice.`
                                  : `The advance is held as credit on ${chosenVendor}'s account. You'll enter the amount on the next step and can apply it to any invoice later.`}
                              </p>
                              <button
                                type="button"
                                onClick={createStandalone}
                                className="mt-2 text-[12px] text-teal-700 hover:underline underline-offset-2 cursor-pointer"
                                style={{ fontWeight: 600 }}
                              >
                                Create a Standalone Invoice Instead
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
            </div>
          ) : (
            <>
              {/* ════ STEP 1 — Select ════ */}
              {step === 1 && (
                <div className="flex flex-col bg-white">
                  {/* Full-bleed search + filter band (edge-to-edge, like invoicing) */}
                  <div className="px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 bg-slate-50 border-b border-slate-100 space-y-3">
                  {/* Prepay target — partner-style radio cards with on-hover example
                      tooltips (mirrors the Payment Term / Pricing Rule type pickers).
                      Sits ABOVE the vendor search so the recording choice is made first.
                      Hidden in the vendor-first flow: the Step 2 option boxes already
                      chose pre-invoice vs on-account (7/22/26). */}
                  {mode === 'prepay' && !vendorFirst && (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400" style={{ fontWeight: 600 }}>What is this prepayment for?<span className="text-red-500"> *</span></span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {([
                        { key: 'pre-invoice', icon: Receipt, title: 'A Pre-Invoice', sub: 'The advance is reserved for one pre-invoice and applies automatically when it becomes a receiving invoice.' },
                        { key: 'on-account', icon: Wallet, title: 'The Vendor Account', sub: "The advance is held as available credit. Apply it to any of this vendor's invoices whenever you choose." },
                      ] as const).map((opt) => {
                          const active = prepayTarget === opt.key;
                          const OptIcon = opt.icon;
                          return (
                                <button
                              key={opt.key}
                                  type="button"
                                  onClick={() => { setPrepayTarget(opt.key); if (opt.key === 'on-account') setSelectedPreInvoiceId(''); }}
                                  className="text-left rounded-lg border px-3 py-2.5 transition-colors flex items-start gap-2.5"
                                  style={{
                                    backgroundColor: active ? t.soft : '#fff',
                                    borderColor: active ? t.softBorder : '#E2E8F0',
                                    boxShadow: active ? `inset 0 0 0 1px ${t.softBorder}` : 'none',
                                  }}
                                >
                                  <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: active ? '#fff' : 'var(--color-slate-100)', color: active ? t.text : 'var(--color-slate-500)' }}>
                                    <OptIcon className="w-3.5 h-3.5" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-[13px]" style={{ fontWeight: 600, color: active ? t.text : '#0F172A' }}>{opt.title}</span>
                                    <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{opt.sub}</span>
                                  </span>
                                </button>
                                                        );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Search row */}
                  <div className="flex items-stretch border border-border rounded-lg bg-white shadow-sm overflow-hidden transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 hover:border-primary/50 [&>div]:flex-1 [&>div:not(:last-child)]:border-r [&>div:not(:last-child)]:border-border/70">
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        placeholder={mode === 'prepay' && prepayTarget === 'pre-invoice' ? 'Search vendors or pre-invoice ID...' : 'Search vendors...'}
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px] placeholder:text-slate-400"
                      />
                    </div>
                    {mode === 'pay' && (
                      <div className="relative">
                        <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <Input
                          placeholder="Search invoices..."
                          value={invoiceSearch}
                          onChange={(e) => setInvoiceSearch(e.target.value)}
                          className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px] placeholder:text-slate-400"
                        />
                      </div>
                    )}
                    {mode === 'pay' && (
                      <div className="relative">
                        <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <Input
                          placeholder="Search POs..."
                          value={poSearch}
                          onChange={(e) => setPoSearch(e.target.value)}
                          className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px] placeholder:text-slate-400"
                        />
                      </div>
                    )}
                    {mode === 'pay' && (
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <Input
                          placeholder="Search receivings..."
                          value={grnSearch}
                          onChange={(e) => setGrnSearch(e.target.value)}
                          className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px] placeholder:text-slate-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* Filter chips — Overdue, Include paid, Due date range, Balance range, Reset */}
                  {mode === 'pay' && (
                    <div className="flex items-center gap-x-4 gap-y-2 flex-wrap px-0.5">
                      <Tooltip delayDuration={500}>
                        <TooltipTrigger asChild>
                          <label htmlFor="filter-overdue" className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox
                              id="filter-overdue"
                              checked={filterOverdue}
                              onCheckedChange={(checked) => setFilterOverdue(!!checked)}
                              className="w-4 h-4 border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-none"
                            />
                            <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Overdue Only</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md z-[300]">
                          <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 400 }}>Limits the list to vendors with at least one open invoice past its due date.</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip delayDuration={500}>
                        <TooltipTrigger asChild>
                          <label htmlFor="filter-paid" className="inline-flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox
                              id="filter-paid"
                              checked={includePaid}
                              onCheckedChange={(checked) => setIncludePaid(!!checked)}
                              className="w-4 h-4 border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-none"
                            />
                            <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>Include Paid</span>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md z-[300]">
                          <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 400 }}>Also show fully-paid (closed) invoices, and vendors with no open balance, for reference.</p>
                        </TooltipContent>
                      </Tooltip>
                      {/* Due date range */}
                      <Popover open={activePopover === 'date'} onOpenChange={(o) => setActivePopover(o ? 'date' : null)}>
                        <PopoverTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-2 h-8 px-3 bg-white border rounded-lg transition-colors text-[12px] ${dueFrom || dueTo ? 'border-primary/30 text-foreground' : 'border-border text-slate-600 hover:border-slate-300'}`}
                            style={{ fontWeight: 500 }}
                          >
                            <Calendar className={`w-3.5 h-3.5 ${dueFrom || dueTo ? 'text-primary' : 'text-slate-400'}`} />
                            <span>{dueFrom || dueTo ? `${dueFrom || '…'} – ${dueTo || '…'}` : 'Due Date Range'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'date' ? 'rotate-180' : ''}`} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" sideOffset={6} className="w-[300px] p-0 bg-white border border-border rounded-xl overflow-hidden" style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                            <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Due Date Range</p>
                            {(dueFrom || dueTo) && (<button onClick={() => { setDueFrom(''); setDueTo(''); }} className="text-[11px] text-primary hover:text-blue-700 transition-colors" style={{ fontWeight: 600 }}>Reset</button>)}
                          </div>
                          <div className="px-4 py-3 grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>From</label>
                              <DatePicker value={dueFrom} onChange={setDueFrom} placeholder="Any" className="mt-1 !h-9" />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>To</label>
                              <DatePicker value={dueTo} onChange={setDueTo} placeholder="Any" className="mt-1 !h-9" />
                            </div>
                          </div>
                          <div className="px-4 pb-3 pt-1 flex items-center justify-end border-t border-slate-100">
                            <Button onClick={() => setActivePopover(null)} className="h-8 px-4 text-[12px] rounded-lg shadow-sm" style={{ fontWeight: 600 }}>Apply</Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      {/* Balance due range */}
                      <Popover open={activePopover === 'amount'} onOpenChange={(o) => setActivePopover(o ? 'amount' : null)}>
                        <PopoverTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-2 h-8 px-3 bg-white border rounded-lg transition-colors text-[12px] ${amountMin || amountMax ? 'border-primary/30 text-foreground' : 'border-border text-slate-600 hover:border-slate-300'}`}
                            style={{ fontWeight: 500 }}
                          >
                            <Receipt className={`w-3.5 h-3.5 ${amountMin || amountMax ? 'text-primary' : 'text-slate-400'}`} />
                            <span>{amountMin || amountMax ? `${amountMin ? '$' + Number(amountMin).toLocaleString('en-US') : '$0'} – ${amountMax ? '$' + Number(amountMax).toLocaleString('en-US') : '∞'}` : 'Balance Due Range'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'amount' ? 'rotate-180' : ''}`} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" sideOffset={6} className="w-[300px] p-0 bg-white border border-border rounded-xl overflow-hidden" style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}>
                          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                            <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>Balance Due Range</p>
                            {(amountMin || amountMax) && (<button onClick={() => { setAmountMin(''); setAmountMax(''); }} className="text-[11px] text-primary hover:text-blue-700 transition-colors" style={{ fontWeight: 600 }}>Reset</button>)}
                          </div>
                          <div className="px-4 py-3 grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Min</label>
                              <Input type="text" inputMode="decimal" value={formatMoneyText(amountMin)} onChange={(e) => setAmountMin(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" className="mt-1 h-9 text-sm bg-white placeholder:text-slate-400" />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Max</label>
                              <Input type="text" inputMode="decimal" value={formatMoneyText(amountMax)} onChange={(e) => setAmountMax(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Any" className="mt-1 h-9 text-sm bg-white placeholder:text-slate-400" />
                            </div>
                          </div>
                          <div className="px-4 pb-3 pt-1 flex items-center justify-end border-t border-slate-100">
                            <Button onClick={() => setActivePopover(null)} className="h-8 px-4 text-[12px] rounded-lg shadow-sm" style={{ fontWeight: 600 }}>Apply</Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        disabled={!hasActiveFilters}
                        className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] transition-colors group ${hasActiveFilters ? 'text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer' : 'text-slate-300 cursor-default'}`}
                        style={{ fontWeight: 500 }}
                      >
                        <RotateCcw className={`w-3.5 h-3.5 transition-transform duration-300 ${hasActiveFilters ? 'group-hover:rotate-[-45deg]' : ''}`} /> Reset
                      </button>
                    </div>
                  )}
                  </div>

                  {/* Recently used / showing-results + Collapse + Sort */}
                  <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 pb-2">
                    <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>
                      {hasUserInput ? (
                        <>Showing results for <span className="text-foreground" style={{ fontWeight: 600 }}>"{vendorSearch || invoiceSearch || poSearch || grnSearch || 'filters'}"</span></>
                      ) : (
                        "Vendors You've Recently Paid"
                      )}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Collapse all — pay mode, and prepay "deposit on a pre-invoice"
                          where rows are expandable. (No Reset: prepay has no filters.) */}
                      {(mode === 'pay' || (mode === 'prepay' && prepayTarget === 'pre-invoice')) && expandedVendors.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedVendors(new Set())}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-white text-[12px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          <Minimize2 className="w-3.5 h-3.5" /> Collapse
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-white text-[12px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            <span className="text-foreground" style={{ fontWeight: 500 }}>{SORT_OPTIONS.find((o) => o.key === sortKey)?.label}</span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                          <DropdownMenuLabel className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Sort By</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {SORT_OPTIONS.map((o) => (
                            <DropdownMenuItem key={o.key} onClick={() => setSortKey(o.key)} className="text-[13px]">
                              {o.label}
                              {sortKey === o.key && <Check className="w-3.5 h-3.5 ml-auto text-primary" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Vendor cards — edge-to-edge, hairline-divided (like invoicing) */}
                  <div className="bg-white border-t border-slate-100 divide-y divide-slate-100">
                    {sortedVendorRows.map((row) => {
                      const hasOpen = row.open.length > 0;
                      const iq = invoiceSearch.trim().toLowerCase();
                      const pq = poSearch.trim().toLowerCase();
                      const gq = grnSearch.trim().toLowerCase();
                      const overdueCount = row.open.filter((o) => daysPastDue(o.dueDate) > 0).length;
                      const matchInv = (inv: Invoice) =>
                        (!iq || inv.invoiceNumber.toLowerCase().includes(iq) || (inv.vendorInvoiceNumber?.toLowerCase().includes(iq) ?? false))
                        && (!pq || inv.linkedPOs.some((p) => p.toLowerCase().includes(pq)))
                        && (!gq || inv.linkedGRNs.some((g) => g.toLowerCase().includes(gq)));
                      const previewOpen = row.open.filter((inv) => matchInv(inv) && invoiceMatchesFilters(inv));
                      const previewClosed = includePaid ? row.closed.filter(matchInv) : [];
                      const autoExpand = iq !== '' || pq !== '' || gq !== '' || filterOverdue || !!dueFrom || !!dueTo || !!amountMin || !!amountMax;
                      // Prepay "deposit on a pre-invoice" rows expand like the pay flow:
                      // a chevron reveals the vendor's pre-invoices without selecting it.
                      const prepayExpandable = mode === 'prepay' && prepayTarget === 'pre-invoice';
                      const expanded = mode === 'pay'
                        ? (expandedVendors.has(row.vendor) || (autoExpand && (previewOpen.length > 0 || previewClosed.length > 0)))
                        : prepayExpandable && expandedVendors.has(row.vendor);
                      const isVendorSelected = selectedVendors.includes(row.vendor);
                      const selCount = mode === 'pay' && isVendorSelected ? row.open.filter((o) => lineFor(o).selected).length : 0;
                      // Vendor checkbox = the vendor itself (7/24/26). Full
                      // check when selected; indeterminate only hints that a
                      // SUBSET of invoices was hand-picked underneath.
                      const checkboxState: boolean | 'indeterminate' = mode === 'prepay'
                        ? isVendorSelected
                        : isVendorSelected && selCount > 0 && selCount < row.open.length
                          ? 'indeterminate'
                          : isVendorSelected;
                      // Tint the row whenever it is expanded OR has an active
                      // selection, so a selected vendor stays highlighted even
                      // once its card is collapsed.
                      const highlightRow =
                        expanded ||
                        (mode === 'prepay' && isVendorSelected) ||
                        // Any pay-mode selection tints the row — vendor-only
                        // (advance intent) included (7/24/26).
                        (mode === 'pay' && (selCount > 0 || isVendorSelected));
                      const blurb = `Active vendor on ${row.terms} terms, settling in ${row.currency}.${hasOpen ? ` ${row.open.length} open invoice${row.open.length === 1 ? '' : 's'} totaling ${fmtIn(row.currency)(row.due)} outstanding.` : ` No open balance${row.closed.length ? `, ${row.closed.length} paid invoice${row.closed.length === 1 ? '' : 's'} on file.` : ' right now.'}`}`;
                      // Prepay: every vendor row carries its saved-method pill and an
                      // on-account credit KPI (always visible, not only when selected).
                      // The selected row additionally shows the pre-invoice picker.
                      const isPrepay = mode === 'prepay';
                      const isPrepaySel = isPrepay && isVendorSelected;
                      // Unapplied advances on account for this vendor — drives the
                      // on-account KPI (both flows) and the pay-flow Prepayments tab.
                      const rowUnappliedList = payments.filter(
                        (p) => p.type === 'Prepayment' && p.vendor === row.vendor && (p.unappliedAmount ?? 0) > 0 && creditInRowCurrency(p, row.vendor),
                      );
                      // Vendor-level tab shows ON-ACCOUNT advances only
                      // (feedback 7/22/26): advances anchored to a
                      // pre-invoice belong to that invoice and surface on
                      // its row in the Invoices tab, not here.
                      const rowOnAccountList = rowUnappliedList.filter((p) => !p.preInvoiceId);
                      const rowUnapplied = rowUnappliedList.reduce(
                        (a, p) => ({
                          count: a.count + 1,
                          total: a.total + (p.unappliedAmount ?? 0),
                          // Reserved = advances anchored to a pre-invoice; they
                          // auto-apply when it converts to a PO invoice.
                          reserved: a.reserved + (p.preInvoiceId ? (p.unappliedAmount ?? 0) : 0),
                        }),
                        { count: 0, total: 0, reserved: 0 },
                      );
                      // Vendor-level tile shows ON-ACCOUNT credit only —
                      // anchored advances surface on their invoice rows
                      // instead (feedback 7/14/26).
                      const rowOnAccount = Math.max(0, Math.round((rowUnapplied.total - rowUnapplied.reserved) * 100) / 100);
                      // This vendor's open pre-invoices (proformas), for the expandable
                      // accordion. Filtered by the search query so a pre-invoice ID search
                      // narrows the list within the vendor too.
                      // Pay mode filters the inline pre-invoice hits by the
                      // INVOICE search; the prepay picker keeps the combined
                      // vendor / pre-invoice search box. Pills and row tints
                      // read the unfiltered set so selections stay visible
                      // whatever the current query is.
                      const preInvQ = (mode === 'pay' ? invoiceSearch : vendorSearch).trim().toLowerCase();
                      const rowPreInvoicesAll = prepayExpandable || mode === 'pay'
                        ? invoices.filter((inv) => inv.type === 'Pre-Invoice' && inv.vendor === row.vendor)
                        : [];
                      const rowPreInvoices = preInvQ
                        ? rowPreInvoicesAll.filter((inv) => inv.invoiceNumber.toLowerCase().includes(preInvQ) || row.vendor.toLowerCase().includes(preInvQ))
                        : rowPreInvoicesAll;
                      // Pay-flow expanded sub-tab (Invoices vs Prepayments) for this vendor.
                      // Selection row tint (7/24/26): violet for pre-invoice
                      // picks, blue for everything else (vendor tick or invoice
                      // picks). The Step 2 boxes decide what gets recorded, so
                      // a vendor-only tick no longer implies a type of its own.
                      const rowPreSelCount = selectedPreInvoiceIds.filter((id) => rowPreInvoicesAll.some((pi) => pi.id === id)).length;
                      const rowTint = mode === 'pay' && rowPreSelCount > 0 ? '#F5F3FF' : SEL.expandedBg;
                      return (
                        <Tooltip key={row.vendor} delayDuration={300}>
                        <TooltipTrigger asChild>
                        <div
                          className="transition-all duration-150"
                          style={{ backgroundColor: highlightRow ? rowTint : '#FFFFFF' }}
                        >
                          <div
                            className="flex items-center gap-3 px-4 sm:px-5 py-2.5 cursor-pointer group transition-colors"
                            onClick={() => {
                              // Flat list (7/24/26): no accordion in pay mode —
                              // clicking the row toggles the VENDOR selection.
                              // Documents surface inline only while searching.
                              if (mode === 'pay') { toggleVendor(row.vendor, hasOpen); }
                              else if (prepayExpandable) toggleExpand(row.vendor);
                              else selectVendorPrepay(row.vendor);
                            }}
                            onMouseEnter={(e) => { if (!highlightRow) e.currentTarget.parentElement!.style.backgroundColor = SEL.hoverBg; }}
                            onMouseLeave={(e) => { if (!highlightRow) e.currentTarget.parentElement!.style.backgroundColor = '#FFFFFF'; }}
                          >
                            {prepayExpandable && (
                              <div
                                className="shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
                                style={expanded ? { backgroundColor: SEL.chevronBg, color: SEL.text } : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
                              >
                                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </div>
                            )}
                            {/* Vendor RADIO — pay mode + prepay "on account" (direct pick).
                                A radio, not a checkbox (user 9/24): the flow locks to ONE
                                vendor per run, so square checks promised a multi-select
                                that doesn't exist. In prepay "pre-invoice" mode selection
                                happens by picking a doc. */}
                            {!prepayExpandable && (() => {
                              const radioOn = checkboxState !== false;
                              return (
                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={radioOn}
                                  className="shrink-0 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-colors cursor-pointer p-0"
                                  style={{ borderColor: radioOn ? SEL.text : '#CBD5E1' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (mode === 'prepay') selectVendorPrepay(row.vendor);
                                    else toggleVendor(row.vendor, hasOpen);
                                  }}
                                >
                                  {radioOn && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SEL.text }} />}
                                </button>
                              );
                            })()}
                            <VendorAvatar name={row.vendor} size="lg" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-[14px] text-foreground tracking-tight truncate" style={{ fontWeight: 600 }}>
                                  {highlightText(row.vendor, vendorSearch)}
                                </h3>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100" style={{ fontWeight: 600 }}>
                                  Active
                                </span>
                                <PaymentTermPill termLabel={row.terms} />
                                {/* Saved payment method as a pill with a rich hover card — both modes. */}
                                <BankMethodHoverPill vendorName={row.vendor} />
                                {/* Dynamic selection indicator (7/24/26): reads WHAT is
                                    selected — invoices (blue), pre-invoices (purple), or
                                    a vendor prepayment (orange). */}
                                {mode === 'pay' && selCount > 0 && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border"
                                    style={{ backgroundColor: SEL.soft, color: SEL.text, borderColor: SEL.softBorder, fontWeight: 600 }}
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5" /> {selCount} of {row.open.length} invoice{row.open.length === 1 ? '' : 's'} selected
                                  </span>
                                )}
                                {mode === 'pay' && (() => {
                                  const rowPreSel = selectedPreInvoiceIds.filter((id) => rowPreInvoicesAll.some((pi) => pi.id === id)).length;
                                  if (rowPreSel === 0) return null;
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border bg-violet-50 text-violet-700 border-violet-200" style={{ fontWeight: 600 }}>
                                      <CheckCircle2 className="w-2.5 h-2.5" /> {rowPreSel} pre-invoice{rowPreSel === 1 ? '' : 's'} selected
                                    </span>
                                  );
                                })()}
                                {/* Vendor-only tick (7/24/26): a plain blue Selected
                                    pill — what gets recorded is chosen on Step 2. */}
                                {mode === 'pay' && isVendorSelected && selCount === 0
                                  && selectedPreInvoiceIds.filter((id) => rowPreInvoicesAll.some((pi) => pi.id === id)).length === 0 && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border"
                                    style={{ backgroundColor: SEL.soft, color: SEL.text, borderColor: SEL.softBorder, fontWeight: 600 }}
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Vendor selected
                                  </span>
                                )}
                                {mode === 'prepay' && isVendorSelected && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border"
                                    style={{ backgroundColor: SEL.soft, color: SEL.text, borderColor: SEL.softBorder, fontWeight: 600 }}
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Selected
                                  </span>
                                )}
                              </div>
                              <VendorBlurb text={blurb} accent={SEL.text} />
                            </div>
                            <div className="hidden sm:flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              {/* Prepaid-credit stat — advances sitting unapplied on this
                                  vendor. Always rendered (even $0.00) so the two-stat block
                                  stays aligned across every row, in both pay and prepay. */}
                              <Tooltip delayDuration={400}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={undefined}
                                    aria-label={mode === 'pay' ? 'View prepaid credit' : undefined}
                                    className={`group/oncredit flex items-center gap-2.5 bg-white px-2.5 py-1.5 rounded-lg border border-border w-[180px] text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${mode === 'pay' ? 'cursor-pointer' : 'cursor-default'} ${rowUnapplied.total > 0 ? 'hover:border-purple-300' : 'hover:border-slate-300'}`}
                                  >
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-slate-50 text-slate-400 transition-colors ${rowUnapplied.total > 0 ? 'group-hover/oncredit:bg-purple-50 group-hover/oncredit:text-purple-700' : ''}`}>
                                      <Wallet className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex flex-col leading-none min-w-0">
                                      <span className={`text-[14px] ${rowOnAccount > 0 ? 'text-foreground' : 'text-slate-400'}`} style={{ fontWeight: 600 }}>{fmtIn(row.currency)(rowOnAccount)}</span>
                                      <span className="text-[10px] text-slate-500 mt-1 truncate" style={{ fontWeight: 500 }}>
                                        {/* Vendor credit, nothing else
                                            (user 9/23): the chip shows how
                                            much credit sits on the vendor
                                            account — anchored pre-invoice
                                            money stays in the tooltip. */}
                                        {rowOnAccount > 0 ? 'Vendor Credit' : 'No Vendor Credit'}
                                      </span>
                                    </div>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md z-[300]">
                                  <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Vendor Credit</p>
                                  <p className="text-[12px] text-foreground leading-snug mt-0.5" style={{ fontWeight: 400 }}>
                                    {/* BA copy 9/25. */}
                                    {rowOnAccount > 0
                                      ? 'Credit available to apply to a future invoice.'
                                      : `No vendor credit for ${row.vendor}.`}
                                  </p>
                                  {/* The on-pre-invoices paragraph is GONE
                                      (BA 9/25): this KPI speaks vendor
                                      credit only. */}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip delayDuration={500}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (prepayExpandable) toggleExpand(row.vendor);
                                      else if (mode === 'prepay') selectVendorPrepay(row.vendor);
                                    }}
                                    aria-label={prepayExpandable ? 'Show pre-invoices' : mode === 'prepay' ? 'Select vendor' : 'Open invoices'}
                                    className={`flex items-center gap-2.5 bg-white px-2.5 py-1.5 rounded-lg border border-border ${metricHover} hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group/metric text-left w-[180px]`}
                                  >
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${hasOpen ? `bg-slate-50 text-slate-500 ${metricIconHover}` : 'bg-slate-50 text-slate-400'}`}>
                                      <Receipt className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex flex-col leading-none min-w-0">
                                      <span className={`text-[14px] ${hasOpen ? 'text-foreground' : 'text-slate-400'}`} style={{ fontWeight: 600 }}>
                                        {fmtIn(row.currency)(row.due)}
                                      </span>
                                      <span className="text-[10px] text-slate-500 mt-1 block truncate" style={{ fontWeight: 500 }}>
                                        {hasOpen ? `${row.open.length} invoice${row.open.length === 1 ? '' : 's'}` : 'Nothing owed'}
                                        {overdueCount > 0 && (
                                          <> · <span className="text-red-600" style={{ fontWeight: 600 }}>{overdueCount} overdue</span></>
                                        )}
                                      </span>
                                    </div>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md z-[300]">
                                  <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 400 }}>
                                    {hasOpen
                                      ? `What you owe ${row.vendor} across their open invoices. Pick which to pay on the next step, or search invoices to select them here.`
                                      : `No open invoices for ${row.vendor} right now${mode === 'prepay' ? ', you can still log a prepayment.' : '.'}`}
                                  </p>
                                  {hasOpen && (() => {
                                    // Vendor breakdown: pre-invoices vs regular invoices,
                                    // plus any prepaid credit sitting on account.
                                    const preInvs = row.open.filter((o) => o.type === 'Pre-Invoice');
                                    const regInvs = row.open.filter((o) => o.type !== 'Pre-Invoice');
                                    const sumBal = (list: typeof row.open) => list.reduce((s, o) => s + o.outstandingBalance, 0);
                                    return (
                                      <div className="mt-2 p-2 bg-slate-50 rounded-md space-y-1">
                                        <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Breakdown</p>
                                        {preInvs.length > 0 && (
                                          <p className="text-[11px] text-foreground flex justify-between gap-3" style={{ fontWeight: 500 }}>
                                            <span>{preInvs.length} pre-invoice{preInvs.length === 1 ? '' : 's'}</span>
                                            <span className="" style={{ fontWeight: 600 }}>{fmtIn(row.currency)(sumBal(preInvs))}</span>
                                          </p>
                                        )}
                                        {regInvs.length > 0 && (
                                          <p className="text-[11px] text-foreground flex justify-between gap-3" style={{ fontWeight: 500 }}>
                                            <span>{regInvs.length} invoice{regInvs.length === 1 ? '' : 's'}</span>
                                            <span className="" style={{ fontWeight: 600 }}>{fmtIn(row.currency)(sumBal(regInvs))}</span>
                                          </p>
                                        )}
                                        {overdueCount > 0 && (
                                          <p className="text-[11px] text-red-600 flex justify-between gap-3" style={{ fontWeight: 600 }}>
                                            <span>{overdueCount} overdue</span>
                                          </p>
                                        )}
                                        {rowUnapplied.total > 0 && (
                                          <p className="text-[11px] text-amber-700 flex justify-between gap-3" style={{ fontWeight: 500 }}>
                                            {/* "Vendor credit", the one name (BA 9/25). */}
                                            <span>Vendor Credit</span>
                                            <span className="" style={{ fontWeight: 600 }}>{fmtIn(row.currency)(rowUnapplied.total)}</span>
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>

                          {/* Pre-invoice accordion (prepay, "deposit" mode) — expands on the
                              chevron without selecting the vendor; picking a proforma anchors
                              the advance and selects that vendor. Mirrors the pay-mode rows. */}
                          {mode === 'prepay' && expanded && prepayTarget === 'pre-invoice' && (
                            <div className="px-4 sm:px-5 pb-3 pt-0.5">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <Receipt className="w-3 h-3" style={{ color: t.text }} />
                                <Label className="text-[11px] text-slate-600" style={{ fontWeight: 600 }}>Pick a Pre-Invoice to Link<span className="text-red-500">*</span></Label>
                              </div>
                              {rowPreInvoices.length === 0 ? (
                                <p className="text-[12px] text-amber-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No open pre-invoices for {row.vendor}. Switch to “Against the vendor”.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {rowPreInvoices.map((pi) => {
                                    const piSelected = selectedPreInvoiceId === pi.id;
                                    return (
                                      <div
                                        key={pi.id}
                                        className="rounded-xl border transition-all px-3 py-2 flex items-center gap-3 cursor-pointer"
                                        style={piSelected
                                          ? { borderColor: SEL.softBorder, backgroundColor: SEL.soft }
                                          : { borderColor: 'hsl(var(--border))', backgroundColor: '#fff' }}
                                        onClick={() => { setSelectedPreInvoiceId(pi.id); setSelectedVendors([row.vendor]); }}
                                      >
                                        <span className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors" style={{ borderColor: piSelected ? SEL.text : 'var(--color-slate-300)', backgroundColor: piSelected ? SEL.text : '#fff' }}>
                                          {piSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                        </span>
                                        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={piSelected ? { backgroundColor: SEL.chevronBg, color: SEL.text } : { backgroundColor: 'var(--color-slate-100)', color: 'var(--color-slate-400)' }}>
                                          <Receipt className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[13px] text-slate-900 " style={{ fontWeight: 600 }}>{pi.invoiceNumber}</span>
                                            <span className="inline-flex items-center px-2 py-px rounded-full text-[10px] border" style={{ fontWeight: 600, backgroundColor: t.soft, color: t.text, borderColor: t.softBorder }}>Pre-Invoice</span>
                                          </div>
                                          <div className="mt-0.5 text-[10px] text-gray-500 truncate" style={{ fontWeight: 500 }}>
                                            {humanDate(pi.invoiceDate)}{pi.linkedPOs.length > 0 ? ` · PO ${pi.linkedPOs[0]}` : ''}
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end leading-none shrink-0">
                                          <span className="text-[14px] text-slate-900 " style={{ fontWeight: 700 }}>{fmtIn(row.currency)(pi.amount)}</span>
                                          <span className="text-[9px] text-slate-400 mt-1" style={{ fontWeight: 600 }}>Expected Total</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Search-hit documents (7/24/26): Step 1 is a FLAT
                              vendor list — no tabs, no accordion. Matching
                              invoices / pre-invoices surface inline only while
                              an invoice / PO / receiving search is active, so
                              they can still be picked directly from here. */}
                          {mode === 'pay' && (invoiceSearch.trim() !== '' || poSearch.trim() !== '' || grnSearch.trim() !== '') && (
                            <div className="px-4 sm:px-5 pb-3 pt-0.5">
                              {previewOpen.length === 0 && previewClosed.length === 0 && rowPreInvoices.length === 0 ? (

                                <p className="text-[12px] text-slate-400 py-3 inline-flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> No open invoices or pre-invoices for {row.vendor}.</p>
                              ) : (
                            <div className="space-y-1.5">
                              {previewOpen.map((inv) => {
                                const invSelected = isVendorSelected && lineFor(inv).selected;
                                const pastDue = daysPastDue(inv.dueDate);
                                const overdue = pastDue >= 0;
                                const dueSoon = isDueSoon(inv.dueDate);
                                const dueIn = dueInLabel(inv.dueDate);
                                return (
                                  <div
                                    key={inv.id}
                                    className="rounded-xl border transition-all px-3 py-2 flex items-center gap-3 cursor-pointer"
                                    style={invSelected
                                      ? { borderColor: SEL.softBorder, backgroundColor: SEL.soft }
                                      : { borderColor: 'hsl(var(--border))', backgroundColor: '#fff' }}
                                    onClick={() => toggleInvoiceLine(row, inv)}
                                  >
                                    <Checkbox
                                      checked={invSelected}
                                      className="shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                      onCheckedChange={() => toggleInvoiceLine(row, inv)}
                                    />
                                    <div
                                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                                      style={invSelected ? { backgroundColor: SEL.chevronBg, color: SEL.text } : { backgroundColor: 'var(--color-slate-100)', color: 'var(--color-slate-400)' }}
                                    >
                                      <Receipt className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(`/invoices/${inv.invoiceNumber}`, '_blank', 'noopener,noreferrer');
                                          }}
                                          className="text-[13px] text-slate-900 hover:text-primary hover:underline cursor-pointer p-0 bg-transparent border-0"
                                          style={{ fontWeight: 600 }}
                                          title={`Open ${inv.invoiceNumber} in a new tab`}
                                        >
                                          {highlightText(inv.invoiceNumber, invoiceSearch)}
                                        </button>
                                        {overdue && (
                                          <span className={`inline-flex px-2 py-px rounded-full text-[10px] border ${pastDue === 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'}`} style={{ fontWeight: 600 }}>{overdueRowLabel(inv.dueDate)}</span>
                                        )}
                                        {!overdue && dueSoon && (
                                          <span className="inline-flex px-2 py-px rounded-full text-[10px] border bg-amber-50 text-amber-700 border-amber-200" style={{ fontWeight: 600 }}>{dueIn}</span>
                                        )}
                                        {/* Anchored advance — a prepayment was recorded against
                                            this specific invoice; it auto-applies in step 2. */}
                                        {(() => {
                                          const anchored = anchoredCreditFor(inv.invoiceNumber);
                                          if (anchored <= 0) return null;
                                          return (
                                            <span className="inline-flex items-center gap-1 px-2 py-px rounded-full text-[10px] border bg-violet-50 text-violet-700 border-violet-200" style={{ fontWeight: 600 }}>
                                              <Wallet className="w-2.5 h-2.5" />
                                              {fmtIn(row.currency)(anchored)} prepayment available
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div className="mt-0.5 text-[10px] text-gray-500 truncate flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                                        <span>Due {formatUsDate(inv.dueDate)}{dueIn && !dueSoon ? ` · ${dueIn}` : ''} · {inv.currency}</span>
                                        {inv.linkedPOs.length > 0 && (
                                          <>
                                            <span className="text-gray-300">·</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(PO_DETAIL_URL, '_blank', 'noopener,noreferrer');
                                              }}
                                              className="inline-flex items-center gap-1 text-[10px] leading-none text-gray-500 hover:text-primary hover:underline cursor-pointer shrink-0"
                                              style={{ fontWeight: 700 }}
                                              title={`Open PO ${inv.linkedPOs[0]} in a new tab`}
                                            >
                                              <ShoppingCart className="w-3 h-3 text-gray-400" />
                                              <span className="text-gray-400">PO No.</span>
                                              {highlightText(inv.linkedPOs[0], poSearch)}
                                            </button>
                                            {inv.linkedPOs.length > 1 && (
                                              <Tooltip delayDuration={300}>
                                                <TooltipTrigger asChild>
                                                  <span className="text-gray-400 cursor-default" style={{ fontWeight: 600 }}>+{inv.linkedPOs.length - 1}</span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="px-2.5 py-1.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                                  <p className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{inv.linkedPOs.slice(1).join(', ')}</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            )}
                                          </>
                                        )}
                                        {inv.linkedGRNs.length > 0 && (
                                          <>
                                            <span className="text-gray-300">·</span>
                                            <span className="inline-flex items-center gap-1 shrink-0" style={{ fontWeight: 600 }}>
                                              <Package className="w-3 h-3 text-gray-400" />
                                              {highlightText(inv.linkedGRNs[0], grnSearch)}
                                            </span>
                                            {inv.linkedGRNs.length > 1 && (
                                              <Tooltip delayDuration={300}>
                                                <TooltipTrigger asChild>
                                                  <span className="text-gray-400 cursor-default" style={{ fontWeight: 600 }}>+{inv.linkedGRNs.length - 1}</span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="px-2.5 py-1.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                                  <p className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>{inv.linkedGRNs.slice(1).join(', ')}</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end leading-none shrink-0">
                                      <span className="text-[14px] text-slate-900 whitespace-nowrap" style={{ fontWeight: 700 }}>{fmtIn(row.currency)(inv.outstandingBalance)}</span>
                                      <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap" style={{ fontWeight: 600 }}>Balance Due</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Pre-invoices live in the SAME tab (7/24/26) — violet
                                  cards tell them apart; checkbox multi-select, one
                                  prepayment per ticked pre-invoice. Ticking one clears
                                  invoice picks (payment vs prepayment are exclusive). */}
                              {rowPreInvoices.map((pi) => {
                                const piSelected = selectedPreInvoiceIds.includes(pi.id);
                                const pickPreInvoice = () => {
                                  if (piSelected) { setSelectedPreInvoiceIds((prev) => prev.filter((x) => x !== pi.id)); return; }
                                  setLines({});
                                  setSelectedVendors([row.vendor]);
                                  setSelectedPreInvoiceIds((prev) => {
                                    const sameVendor = prev.every((id) => invoices.find((i) => i.id === id)?.vendor === row.vendor);
                                    return sameVendor ? [...prev, pi.id] : [pi.id];
                                  });
                                };
                                return (
                                  <div
                                    key={pi.id}
                                    className="rounded-xl border transition-all px-3 py-2 flex items-center gap-3 cursor-pointer"
                                    style={piSelected
                                      ? { borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }
                                      : { borderColor: '#E9E5F8', backgroundColor: '#FDFCFF' }}
                                    onClick={pickPreInvoice}
                                  >
                                    <Checkbox
                                      checked={piSelected}
                                      className="shrink-0 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                                      onClick={(e) => e.stopPropagation()}
                                      onCheckedChange={pickPreInvoice}
                                    />
                                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-violet-50 text-violet-600">
                                      <Receipt className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(`/invoices/${pi.invoiceNumber}`, '_blank', 'noopener,noreferrer');
                                          }}
                                          className="text-[13px] text-slate-900 hover:text-primary hover:underline cursor-pointer p-0 bg-transparent border-0"
                                          style={{ fontWeight: 600 }}
                                          title={`Open ${pi.invoiceNumber} in a new tab`}
                                        >
                                          {highlightText(pi.invoiceNumber, vendorSearch)}
                                        </button>
                                        <span className="inline-flex items-center px-2 py-px rounded-full text-[10px] border bg-violet-50 text-violet-700 border-violet-200" style={{ fontWeight: 600 }}>Pre-Invoice</span>
                                      </div>
                                      <div className="mt-0.5 text-[10px] text-gray-500 truncate" style={{ fontWeight: 500 }}>
                                        {humanDate(pi.invoiceDate)}{pi.linkedPOs.length > 0 ? ` · PO ${pi.linkedPOs[0]}` : ''} · select to record a prepayment
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end leading-none shrink-0">
                                      <span className="text-[14px] text-slate-900 " style={{ fontWeight: 700 }}>{fmtIn(row.currency)(pi.amount)}</span>
                                      <span className="text-[9px] text-slate-400 mt-1" style={{ fontWeight: 600 }}>Expected Total</span>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Paid (closed) invoices — reference only, when Include paid is on */}
                              {previewClosed.map((inv) => (
                                <div
                                  key={inv.id}
                                  className="rounded-xl border border-border/70 bg-slate-50/50 px-3 py-2 flex items-center gap-3 opacity-80"
                                  title="Fully paid, shown for reference"
                                >
                                  <div className="w-4 h-4 shrink-0" />
                                  <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-600">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[13px] text-slate-600 " style={{ fontWeight: 600 }}>{inv.invoiceNumber}</span>
                                      <span className="inline-flex px-2 py-px rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100" style={{ fontWeight: 600 }}>Paid</span>
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-slate-400" style={{ fontWeight: 500 }}>Due {formatUsDate(inv.dueDate)} · {inv.currency}</div>
                                  </div>
                                  <div className="flex flex-col items-end leading-none shrink-0">
                                    <span className="text-[14px] text-slate-400 line-through" style={{ fontWeight: 700 }}>{fmtIn(invCurrency(inv))(inv.amount)}</span>
                                    <span className="text-[9px] text-slate-400 mt-1" style={{ fontWeight: 600 }}>Settled</span>
                                  </div>
                                </div>
                              ))}
                              {previewOpen.length < row.open.length && (
                                <div className="px-1 py-1 text-[10px] text-muted-foreground">
                                  {row.open.length - previewOpen.length} more open invoice{row.open.length - previewOpen.length === 1 ? '' : 's'} hidden by the current filters
                                </div>
                              )}
                            </div>
                              )}
                            </div>
                          )}
                        </div>
                        </TooltipTrigger>
                        </Tooltip>
                      );
                    })}
                    {sortedVendorRows.length === 0 && (() => {
                      // Table Empty & Error States Standard (11/3/26),
                      // compact in the flow modal. The four search boxes
                      // read as one search; the date/amount/overdue facets
                      // are the filters.
                      const stepQuery = vendorSearch || invoiceSearch || poSearch || grnSearch;
                      const stepFilters = (filterOverdue ? 1 : 0) + (dueFrom || dueTo ? 1 : 0) + (amountMin || amountMax ? 1 : 0);
                      const clearSearches = () => { setVendorSearch(''); setInvoiceSearch(''); setPoSearch(''); setGrnSearch(''); };
                      const clearFacets = () => { setFilterOverdue(false); setDueFrom(''); setDueTo(''); setAmountMin(''); setAmountMax(''); };
                      return (
                        <TableEmptyState
                          compact
                          kind={resolveTableEmptyKind({ totalCount: baseRows.length, filteredCount: 0, searchQuery: stepQuery, filterCount: stepFilters }) ?? 'no-data'}
                          entity={{ singular: 'vendor', plural: 'vendors' }}
                          title={mode === 'pay' ? 'No vendors with open invoices yet' : undefined}
                          description={mode === 'pay' ? 'Vendors with approved invoices to pay will show up here.' : undefined}
                          searchQuery={stepQuery}
                          suggestion={vendorSearch.trim() ? findSearchSuggestion(vendorSearch, baseRows.map((r) => r.vendor)) : null}
                          onApplySuggestion={setVendorSearch}
                          filterCount={stepFilters}
                          onClearSearch={clearSearches}
                          onClearFilters={clearFacets}
                          onClearAll={clearAllFilters}
                        />
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ════ STEP 2 — Record ════ */}
              {step === 2 && entryStage !== 'vendor' && (isV2 ? renderV2Step2() : (
                <div className="p-4 space-y-3">
                  {/* Vendor identity. V1: sticky full-bleed bar at the top. V2:
                      a card in the right sidebar (two-panel layout mirroring the
                      vendor invoicing creation form). */}
                  <div className={isV2 ? 'order-2 w-full sm:w-[340px] shrink-0 space-y-3' : 'sticky top-0 z-20 -mx-4 -mt-4 px-4 pt-4 pb-3 bg-slate-50'}>
                  {/* Selected-vendor banner — mirrors the partner Create flow's step-2
                      "selected groups" summary: the chosen vendor lives in a card at the
                      top with a Change action, instead of repeating it inside the form. */}
                  {mode === 'prepay' && selectedVendors[0] && (
                    <div className="rounded-xl bg-white border overflow-hidden" style={{ borderColor: t.softBorder, boxShadow: '0 1px 4px rgba(124,58,237,0.06), 0 4px 12px -2px rgba(0,0,0,0.05)' }}>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-3" style={{ background: `linear-gradient(180deg, ${t.heroTint} 0%, #FFFFFF 100%)` }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <VendorAvatar name={selectedVendors[0]} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={partnerVendorUrl(selectedVendors[0] ?? "")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[14px] text-foreground truncate hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
                                style={{ fontWeight: 600 }}
                                title={`Open ${selectedVendors[0]} in the partner module`}
                              >
                                {selectedVendors[0]}
                              </a>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border bg-white" style={{ fontWeight: 600, color: t.text, borderColor: t.softBorder }}>
                                <Wallet className="w-3 h-3" /> Prepayment
                              </span>
                              <PaymentTermPill termLabel={mockVendors.find((v) => v.vendorName === selectedVendors[0])?.paymentTerms ?? 'Net 30'} />
                              <BankMethodHoverPill vendorName={selectedVendors[0]} />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {/* One state name (BA 9/28): an anchored advance
                                  is APPLIED to its pre-invoice at recording —
                                  the success chip, payment history and Linked
                                  Records all say the same. */}
                              {multiPrepay
                                ? `Applied to ${selectedPreInvoices.length} pre-invoices, one prepayment each, carried into the receiving invoices when they convert.`
                                : prepayTarget === 'pre-invoice' && selectedPreInvoice
                                  ? `Applied to ${selectedPreInvoice.invoiceNumber}, carried into the receiving invoice when it converts.`
                                  : 'Held on account, applied to any future invoice.'}
                              {existingUnapplied.total > 0 ? ` · ${fmt(existingUnapplied.total)} already on account.` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pay mode — vendor identity banner at the TOP (parity with the
                      prepay card) so it's always clear who is being paid, instead of
                      only surfacing the vendor in the per-invoice card lower down. */}
                  {mode === 'pay' && selectedVendors.length === 1 && (
                    <div className="rounded-xl bg-white border overflow-hidden" style={{ borderColor: t.softBorder, boxShadow: '0 1px 4px rgba(16,185,129,0.06), 0 4px 12px -2px rgba(0,0,0,0.05)' }}>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-3" style={{ background: `linear-gradient(180deg, ${t.heroTint} 0%, #FFFFFF 100%)` }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <VendorAvatar name={selectedVendors[0]} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={partnerVendorUrl(selectedVendors[0] ?? "")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[14px] text-foreground truncate hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
                                style={{ fontWeight: 600 }}
                                title={`Open ${selectedVendors[0]} in the partner module`}
                              >
                                {selectedVendors[0]}
                              </a>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border bg-white" style={{ fontWeight: 600, color: t.text, borderColor: t.softBorder }}>
                                <Banknote className="w-3 h-3" /> Payment
                              </span>
                              <PaymentTermPill termLabel={mockVendors.find((v) => v.vendorName === selectedVendors[0])?.paymentTerms ?? 'Net 30'} />
                              <BankMethodHoverPill vendorName={selectedVendors[0]} />
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {grand.invoices} invoice{grand.invoices === 1 ? '' : 's'} selected · net to pay {grandPayText()}.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {mode === 'pay' && selectedVendors.length > 1 && (
                    <div className="rounded-xl bg-white border overflow-hidden" style={{ borderColor: t.softBorder, boxShadow: '0 1px 4px rgba(16,185,129,0.06), 0 4px 12px -2px rgba(0,0,0,0.05)' }}>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-3" style={{ background: `linear-gradient(180deg, ${t.heroTint} 0%, #FFFFFF 100%)` }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex -space-x-2 shrink-0">
                            {selectedVendors.slice(0, 4).map((v) => (
                              <div key={v} className="ring-2 ring-white rounded-full">
                                <VendorAvatar name={v} size="sm" />
                              </div>
                            ))}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                                {selectedVendors.length} vendors selected
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border bg-white" style={{ fontWeight: 600, color: t.text, borderColor: t.softBorder }}>
                                <Banknote className="w-3 h-3" /> Payment
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {grand.invoices} invoice{grand.invoices === 1 ? '' : 's'} across {grand.records} payment{grand.records === 1 ? '' : 's'} · net to pay {grandPayText()}.
                            </p>
                          </div>
                        </div>
                        {!startAtStep2 && (
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-muted-foreground hover:border-primary hover:text-primary transition-all shrink-0 text-[11px] sm:text-xs cursor-pointer"
                            style={{ fontWeight: 600 }}
                          >
                            <Pencil className="w-3 h-3" />
                            <span className="hidden min-[400px]:inline">Change Selection</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  </div>

                  {/* Left column (V2 two-panel): key fields + the invoices/amount
                      "items" area. In V1 this is a transparent spacing wrapper. */}
                  <div className={isV2 ? 'order-1 flex-1 min-w-0 space-y-3' : 'space-y-3'}>
                  {/* A. Defaults — partner-form sectioned card with a 2-col labeled grid */}
                  <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50 rounded-t-lg">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: t.soft, color: t.text }}>
                        <ModeIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          {mode === 'prepay' ? 'Prepayment Details' : 'Payment Details'}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
                      </div>
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                              Payment Date<span className="text-red-500">*</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center cursor-help"><Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" /></span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[280px] z-[300]">
                                  <p className="text-[11px] text-slate-500 leading-snug">The date this payment posts to your books. Pick today to post now, or a future date to post automatically on that day. The invoice stays in your outstanding balance until then.</p>
                                </TooltipContent>
                              </Tooltip>
                            </Label>
                            {isFuture && (
                              <span className="text-[10px] text-blue-600 inline-flex items-center gap-1 shrink-0" style={{ fontWeight: 600 }}>
                                <Clock className="w-3 h-3" /> Scheduled · {dateLabel}
                              </span>
                            )}
                          </div>
                          <DatePicker
                            id="rp-payment-date-full"
                            value={paymentDate}
                            onChange={(v) => { setPaymentDate(v); setFieldErrors((f) => ({ ...f, paymentDate: undefined })); }}
                            className="mt-1"
                            error={!!fieldErrors.paymentDate}
                          />
                          {fieldErrors.paymentDate && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.paymentDate}</p>}
                        </div>
                        {isMultiVendorPay ? (
                          /* Multi-vendor bulk run — method + pay-from live
                             on each vendor's Invoices To Pay card
                             (feedback 7/21/26); the grid carries the
                             standardize-the-run bulk control. */
                          <div className="min-[480px]:col-span-2">
                            {renderBulkPayControls()}
                          </div>
                        ) : (
                        <>
                        <div>
                          <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Payment Method<span className="text-red-500">*</span></Label>
                          {(() => {
                            const mInfo = paymentMethodInfo(resolvedMethod ? resolvedMethod.type : method);
                            const MIcon = mInfo.icon;
                            const title = resolvedMethod ? resolvedMethod.nickname : mInfo.label;
                            const sub = resolvedMethod
                              ? `${mInfo.label}${methodDataRows(resolvedMethod).length ? ` · ${methodSummary(resolvedMethod)}` : ''}`
                              : mInfo.category;
                            const mColors = methodCategoryColors(mInfo.category);
                            return (
                              <button
                                type="button"
                                onClick={() => setPaymentMethodModalOpen(true)}
                                className="mt-1 w-full inline-flex items-center justify-between gap-2 !h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors"
                              >
                                <span className="flex items-center gap-2 min-w-0 text-left">
                                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: mColors.bg, color: mColors.color }}>
                                    <MIcon className="w-3.5 h-3.5" />
                                  </span>
                                  <span className="flex flex-col leading-tight min-w-0">
                                    <span className="truncate" style={{ fontWeight: 500 }}>{title}</span>
                                    <span className="text-[10px] text-slate-400 truncate">{sub}</span>
                                  </span>
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  {resolvedMethod?.isPrimary && <PrimaryPill size="xs" />}
                                  <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                        <div>
                          <Label className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                            Pay-From Account<span className="text-red-500">*</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center cursor-help"><Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" /></span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] z-[300]">
                                <p className="text-[11px] text-slate-500 leading-snug">Shows the account's <span className="text-foreground" style={{ fontWeight: 600 }}>book balance</span> (GL balance), not the real-time cleared bank balance. Filtered by the chosen method.</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                          {(() => {
                            const AccIcon = bank?.type === 'cash' ? Banknote : bank?.type === 'card' ? Wallet : Landmark;
                            // Full account identity inline (mirrors the Payment method
                            // field + the pay-from picker rows): type · bank · ••••mask · balance.
                            const detail = bank
                              ? [bank.accountTypeLabel, bank.bankName, bank.accountMask ? `••••${bank.accountMask}` : null, accountBalanceLabel(bank, fmt)]
                                  .filter(Boolean)
                                  .join(' · ')
                              : '';
                            return (
                              <button
                                type="button"
                                onClick={() => setPayFromModalOpen(true)}
                                className="mt-1 w-full inline-flex items-center justify-between gap-2 !h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors"
                              >
                                <span className="flex items-center gap-2 min-w-0 text-left">
                                  <span className="w-6 h-6 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                                    <AccIcon className="w-3.5 h-3.5" />
                                  </span>
                                  <span className="flex flex-col leading-tight min-w-0">
                                    <span className="truncate" style={{ fontWeight: 500 }}>{bank ? bank.label : 'Select account'}</span>
                                    {detail && <span className="text-[10px] text-slate-400 truncate">{detail}</span>}
                                  </span>
                                </span>
                                <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>
                            );
                          })()}
                          {lowBalance && (
                            <p className="text-[10px] text-amber-600 mt-1 inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                              <AlertTriangle className="w-3 h-3" /> The available balance is below the total to pay. You can still record, nothing is blocked.
                            </p>
                          )}
                        </div>
                        </>
                        )}
                        <div>
                          <Label className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                            {mode === 'prepay' ? <>Prepayment Account<span className="text-red-500">*</span></> : 'A/P Account'}
                            {mode === 'prepay' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center cursor-help"><Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" /></span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[280px] z-[300]">
                                  <p className="text-[11px] text-slate-500 leading-snug">Replaces the A/P account. The advance is debited here as an asset. This is the field that makes it a prepayment, not a payment.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </Label>
                          {mode === 'prepay' ? (
                            <Select value={assetAccount} onValueChange={setAssetAccount}>
                              <SelectTrigger className="mt-1 !h-10 text-sm bg-white border-border text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors"><SelectValue /></SelectTrigger>
                              <SelectContent className="max-h-[280px]">
                                {PREPAYMENT_ASSET_ACCOUNTS.map((acc) => (
                                  <SelectItem key={acc} value={acc} className="text-[12px] ">{formatGLAccount(acc)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            /* Locked (design review 7/9/26): flows from the
                               vendor profile via the invoice, mirrors V2. */
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <div className="mt-1 w-full inline-flex items-center justify-between gap-2 !h-10 px-2.5 rounded-lg border border-border bg-slate-50 text-slate-500 text-sm cursor-not-allowed" style={{ fontWeight: 500 }}>
                                  <span className="truncate text-left">{formatGLAccount(apAccount)}</span>
                                  <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Set by the Vendor Profile</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The A/P account was locked at invoice creation and the payment settles that same account. Manage it from the vendor record.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                            {mode === 'prepay' ? 'Prepayment ID' : 'Payment ID'}<span className="text-red-500">*</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center cursor-help"><Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" /></span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] z-[300]">
                                <p className="text-[11px] text-slate-500 leading-snug">Internal key for this record, auto-generated and unique.{mode === 'pay' && grand.records > 1 ? ' One ID is issued per vendor record.' : ''}</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                          <Input
                            value={mode === 'pay' && grand.records > 1 ? `${idBase} (+${grand.records - 1} more)` : idBase}
                            readOnly
                            className="mt-1 rounded-lg border-border !h-10 text-sm bg-slate-50 text-slate-600 "
                          />
                        </div>
                        <div>
                          <Label className="text-xs sm:text-[13px] text-foreground inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                            {refFieldMeta.label}{referenceRequired && <span className="text-red-500">*</span>}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center cursor-help"><Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" /></span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[280px] z-[300]">
                                <p className="text-[11px] text-slate-500 leading-snug">External identifier used to match this payment against your bank statement at reconciliation (check number, wire confirmation, ACH trace). Often filled in after the payment clears.</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                          <div className="relative mt-1">
                      <Input id="rp-reference-full" value={reference} onChange={(e) => { referenceAutoFilled.current = false; setReference(e.target.value); setFieldErrors((prev) => ({ ...prev, reference: undefined as unknown as string })); }} placeholder={refFieldMeta.placeholder} className={`rounded-lg bg-white !h-10 text-sm placeholder:text-slate-400 ${referenceError || fieldErrors.reference ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-100' : referenceWarning ? 'pr-8 border-amber-400 text-amber-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-100' : 'border-border text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20'}`} />
                      {/* Out-of-sequence warning rides IN the input (7/24/26,
                          same recipe as the payment-amount warnings): amber
                          triangle, hover card with the same copy PLUS the
                          expected next check number, click-to-use. */}
                      {!referenceError && referenceWarning && (
                        <HoverCard openDelay={300} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <button type="button" tabIndex={-1} className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-amber-500 hover:bg-amber-100 transition-colors cursor-help" aria-label="Check number warning">
                              <AlertTriangle className="w-3 h-3" />
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>{referenceWarning.startsWith('Big jump') ? 'Big Jump Ahead' : 'Out of Sequence'}</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{referenceWarning}</p>
                            {lastCheckNumber != null && (
                              <p className="text-[11px] text-slate-500 leading-snug mt-1">
                                Expected next:{' '}
                                <button type="button" onClick={() => { referenceAutoFilled.current = false; setReference(`CHK-${lastCheckNumber + 1}`); }} className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline" style={{ fontWeight: 600 }}>CHK-{lastCheckNumber + 1}</button>.
                                {' '}Click it to use that number.
                              </p>
                            )}
                          </HoverCardContent>
                        </HoverCard>
                      )}
                      </div>
                    {!referenceError && fieldErrors.reference && (
                      <p className="text-[11px] text-red-600 mt-1" style={{ fontWeight: 500 }}>{fieldErrors.reference}</p>
                    )}
                    {referenceError && (
                      <p className="text-[11px] text-red-600 mt-1" style={{ fontWeight: 500 }}>
                        {referenceError}
                        {referenceDup && (
                          <>
                            {' '}
                            <a
                              href={`/payments-v2/${encodeURIComponent(referenceDup.paymentNumber)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700"
                              style={{ fontWeight: 600 }}
                            >
                              View {referenceDup.paymentNumber}
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    {methodType === 'Check' && !referenceError && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        {lastCheckNumber != null
                          ? `Last check recorded on this account: ${lastCheckNumber}.`
                          : 'No checks recorded on this account yet.'}
                      </p>
                    )}
                        </div>
                        <div className="min-[480px]:col-span-2">
                          <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                            Description{method === 'Other' && <span className="text-red-500">*</span>}
                          </Label>
                          <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            rows={3}
                            placeholder="Brief note or context for this record"
                            className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-slate-400 outline-none resize-y focus:border-primary focus:ring-1 focus:ring-primary/20"
                          />
                          {method === 'Other' && (<p className="text-[10px] text-slate-400 mt-1">Required when the method is “Other”.</p>)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* B. Advance details — vendor identity now lives in the top banner,
                      so this card holds only the amount + intent + cash-out. */}
                  {mode === 'prepay' ? (
                    <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50 rounded-t-lg">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: t.soft, color: t.text }}>
                          <Wallet className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Amount &amp; Application</span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
                      </div>

                      {/* Body — fields side by side (mirrors the Payment details grid
                          above); the auto-application toggle sits at the bottom left. */}
                      <div className="p-3 sm:p-4">
                        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-2.5 sm:gap-y-3">
                          {multiPrepay ? (
                            <div className="min-[480px]:col-span-2">{renderMultiPrepayRows()}</div>
                          ) : (
                          <div>
                            <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>{prepayTarget === 'on-account' ? 'Vendor Credit Amount' : 'Prepayment Amount'}<span className="text-red-500">*</span></Label>
                            <div className="relative mt-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{currencySymbol(prepayCurrency)}</span>
                              <MoneyInput
                                fluid
                                value={prepayAmount}
                                onValueChange={(v) => { setPrepayAmount(v); setFieldErrors((prev) => ({ ...prev, amount: undefined })); }}
                                placeholder="0.00"
                                className={`w-full pl-7 pr-3 rounded-lg border h-10 text-sm bg-white placeholder:text-slate-400 outline-none ${fieldErrors.amount ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-1 focus:ring-red-100' : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/20'}`}
                              />
                            </div>
                            {fieldErrors.amount && (
                              <p className="text-[10px] text-red-600 mt-1" style={{ fontWeight: 500 }}>{fieldErrors.amount}</p>
                            )}
                            {selectedPreInvoice && prepayAmount > 0 && (
                              <p className={`text-[10px] mt-1 ${prepayAmount > selectedPreInvoice.amount ? 'text-amber-600' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>
                                {prepayAmount > selectedPreInvoice.amount ? (
                                  <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Exceeds the pre-invoice total of {fmt(selectedPreInvoice.amount)}.</span>
                                ) : (
                                  <>{fmt(prepayAmount)} of {fmt(selectedPreInvoice.amount)} · {Math.round((prepayAmount / selectedPreInvoice.amount) * 100)}% deposit</>
                                )}
                              </p>
                            )}
                          </div>
                          )}
                        </div>

                        {/* Anchored advances always auto-apply (banner at the top of the
                            form explains it); on-account advances just show where the
                            credit is held. */}
                        {prepayTarget !== 'pre-invoice' && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-[11px] text-slate-600 inline-flex items-center gap-1.5 leading-snug">
                              <Info className="w-3.5 h-3.5 shrink-0" style={{ color: t.text }} />
                              Held on account for any open invoice for {selectedVendors[0]}.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    selectedRows.map((row) => {
                      const m = vendorMath(row);
                      if (m.selectedInvs.length === 0) return null;
                      // Prepaid credit math — same as the V2 workspace panel so both
                      // variants apply advances identically (V1 parity, 7/9/26).
                      const available = prepayAvailableFor(row.vendor);
                      const hasCredit = available > 0;
                      const appliedSum = m.selectedInvs.reduce((s, inv) => s + (lineFor(inv).prepayApplied || 0), 0);
                      const remainingCredit = Math.round((available - m.applied) * 100) / 100;
                      const creditUsedPct = available > 0 ? Math.min(100, Math.round((m.applied / available) * 100)) : 0;
                      // Discount column always renders (8/31/26, parity
                      // with the run tables); no-window rows read a dash.
                      const hasLiveDiscount = true;
                      return (
                        <div
                          key={row.vendor}
                          className={
                            selectedVendors.length > 1
                              ? 'rounded-xl border border-border bg-white overflow-hidden'
                              : 'rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden'
                          }
                        >
                          {/* Header. With a single vendor, the identity + badges live in the
                              sticky card at the top, so this becomes a plain "Invoices to pay"
                              section header (matching the Payment details / Amount & application
                              sections) instead of repeating the vendor info. Multi-vendor keeps
                              the full header so each block stays identifiable. */}
                          {selectedVendors.length > 1 ? (
                            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-border/60 flex-wrap">
                              <VendorAvatar name={row.vendor} size="sm" />
                              <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{row.vendor}</span>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100" style={{ fontWeight: 600 }}>
                                Active
                              </span>
                              <PaymentTermPill termLabel={row.terms} />
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
                                <span className="text-slate-400">{currencySymbol(row.currency)}</span>{row.currency}
                              </span>
                              {/* Selected-summary pill — partner segmented style. */}
                              <span className="inline-flex items-stretch h-[18px] rounded-md border border-blue-200 overflow-hidden text-[10px] leading-none">
                                <span className="inline-flex items-center gap-1 px-1.5 bg-blue-50 text-primary" style={{ fontWeight: 600 }}>
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Selected
                                </span>
                                <span className="inline-flex items-center gap-0.5 px-1.5 bg-white text-slate-600 border-l border-blue-200" style={{ fontWeight: 500 }}>
                                  <span className="text-[9px]" style={{ fontWeight: 700 }}>{m.selectedInvs.length}</span>
                                  <span className="text-slate-400 text-[9px] tracking-wider">{m.selectedInvs.length === 1 ? 'Invoice' : 'Invoices'}</span>
                                </span>
                              </span>
                              {renderAddInvoiceMenu(row)}
                              <span className="ml-auto text-[12px] " style={{ fontWeight: 700 }}>
                                {m.selectedInvs.length === 1
                                  ? <>Remaining Balance to Pay {fmt(Math.max(0, Math.round((m.selectedInvs[0].outstandingBalance - (lineFor(m.selectedInvs[0]).amount || 0)) * 100) / 100))}</>
                                  : <>Net to Pay {fmt(m.net)}</>}
                              </span>
                            </div>
                          ) : (
                            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50 rounded-t-lg">
                              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: t.soft, color: t.text }}>
                                <Receipt className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Invoices To Pay</span>
                              {selectedVendors.length > 1 && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <VendorAvatar name={row.vendor} size="sm" />
                                  <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{row.vendor}</span>
                                </>
                              )}
                              {renderAddInvoiceMenu(row)}
                            </div>
                          )}
                          {/* Per-vendor pay controls ride WITH the vendor's
                              card (feedback 7/21/26). */}
                          {isMultiVendorPay && renderVendorPayControls(row.vendor)}
                          {/* Available prepayments — same segmented credit breakdown as the
                              V2 panel: Available · Applied · Remaining, a used-credit bar,
                              and an "Apply all" toggle that spreads the credit per invoice. */}
                          {hasCredit && (
                            <div className="px-4 py-2 bg-purple-50/60 border-b border-purple-100 flex items-center gap-3 flex-wrap">
                              <Wallet className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                              <div className="inline-flex items-stretch rounded-lg border border-purple-200/70 bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                {[
                                  { label: 'Available', value: available, dot: 'bg-purple-500', text: 'text-purple-700' },
                                  { label: 'Applied', value: m.applied, dot: 'bg-success', text: 'text-success' },
                                  { label: 'Remaining', value: remainingCredit, dot: 'bg-destructive', text: 'text-destructive' },
                                ].map((s, i) => (
                                  <span key={s.label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${i > 0 ? 'border-l border-slate-100' : ''}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                                    <span className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>{s.label}</span>
                                    <span className={`text-[11px] ${s.text}`} style={{ fontWeight: 700 }}>{fmt(s.value)}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-[100px] max-w-[180px]">
                                <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                  <div className="h-full rounded-full bg-purple-500 transition-all duration-300" style={{ width: `${creditUsedPct}%` }} />
                                </div>
                                <span className="text-[10px] shrink-0 text-slate-500" style={{ fontWeight: 600 }}>{creditUsedPct}% used</span>
                              </div>
                              <label className="ml-auto inline-flex items-center gap-2 cursor-pointer shrink-0" title={appliedSum > 0 ? 'Set an amount per invoice below.' : 'Apply All, or set an amount per invoice below.'}>
                                <span className="text-[11px] text-purple-800" style={{ fontWeight: 600 }}>Apply All</span>
                                <Switch
                                  checked={!!prepayApply[row.vendor]}
                                  onCheckedChange={(on) => {
                                    setPrepayApply((prev) => ({ ...prev, [row.vendor]: on }));
                                    // Anchored rows are excluded either way — the
                                    // ON-ACCOUNT credit spreads, most overdue
                                    // invoice first (feedback 7/14/26).
                                    const unlocked = m.selectedInvs.filter((inv) => anchoredCreditFor(inv.invoiceNumber) <= 0);
                                    if (on) {
                                      let credit = onAccountCreditFor(row.vendor);
                                      [...unlocked]
                                        .sort((a, b) =>
                                          a.dueDate === b.dueDate
                                            ? b.outstandingBalance - a.outstandingBalance
                                            : a.dueDate.localeCompare(b.dueDate),
                                        )
                                        .forEach((inv) => {
                                          // Outstanding minus cash, never the typed amount
                                          // alone (user 9/9) — and the gross moves with the
                                          // credit so amount = cash + credit stays true.
                                          const l = lineFor(inv);
                                          const cash = Math.max(0, Math.round(((l.amount || 0) - (l.prepayApplied || 0)) * 100) / 100);
                                          const cap = Math.min(Math.max(0, inv.outstandingBalance - cash), credit);
                                          const val = Math.round(Math.max(0, cap) * 100) / 100;
                                          setLine(inv.id, { prepayApplied: val, amount: Math.round((cash + val) * 100) / 100 }, inv);
                                          credit = Math.round((credit - val) * 100) / 100;
                                        });
                                    } else {
                                      unlocked.forEach((inv) => {
                                        const l = lineFor(inv);
                                        const cash = Math.max(0, Math.round(((l.amount || 0) - (l.prepayApplied || 0)) * 100) / 100);
                                        setLine(inv.id, { prepayApplied: 0, amount: cash }, inv);
                                      });
                                    }
                                  }}
                                  className="shrink-0"
                                />
                              </label>
                            </div>
                          )}
                          <table className="w-full text-[12px]">
                            <thead className="bg-slate-50/60 border-b border-slate-100">
                              <tr>
                                <th className="text-left pl-4 px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Invoice ID</th>
                                <th className="text-left px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Due</th>
                                <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Invoice Total</th>
                                <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>
                                  <span className="inline-flex items-center gap-1 w-full justify-end">
                                    Balance Due
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center cursor-help"><Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" /></span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[260px] tracking-normal z-[300]">
                                        <p className="text-[11px] text-slate-500 leading-snug">Open amount still owed on this bill, not the original invoice total.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </span>
                                </th>
                                {hasLiveDiscount && <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Discount</th>}
                                {hasCredit && <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Vendor Credit Applied</th>}
                                <th className="text-right px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Payment</th>
                                <th className="w-9 px-3 py-2" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {m.selectedInvs.map((inv, invIdx) => {
                                const l = lineFor(inv);
                                const remainingAfter = Math.round((inv.outstandingBalance - l.amount) * 100) / 100;
                                const overAmount = Math.round((l.amount - inv.outstandingBalance) * 100) / 100;
                                const isOver = overAmount > 0.004;
                                const pastDue = daysPastDue(inv.dueDate);
                                const overdue = pastDue >= 0;
                                const paidSoFar = Math.round((inv.amount - inv.outstandingBalance) * 100) / 100;
                                const rowPrepay = l.prepayApplied || 0;
                                const creditLeft = Math.round((available - (appliedSum - rowPrepay)) * 100) / 100;
                                // Cap = outstanding minus the CASH side, never the
                            // typed amount alone (user 9/9): amounts start
                            // empty, and applying credit is itself a way of
                            // settling the invoice.
                            const prepayCap = Math.round(Math.min(Math.max(0, inv.outstandingBalance - Math.max(0, (l.amount || 0) - rowPrepay)), creditLeft) * 100) / 100;
                                const prepayOver = rowPrepay > prepayCap + 0.004;
                                // The Payment input reads/writes the CASH side only:
                                // balance due minus the prepayment applied. l.amount
                                // stays the gross settled on the invoice underneath.
                                const rowCash = Math.max(0, Math.round(((l.amount || 0) - rowPrepay) * 100) / 100);
                                // Below the invoice balance — a legitimate partial
                                // payment, flagged orange (meeting feedback 7/17/26).
                                const isBelow = !isOver && (rowCash + rowPrepay) > 0.004 && (rowCash + rowPrepay + (l.lateDiscount?.amount ?? 0)) < inv.outstandingBalance - 0.004;
                                const belowRemainder = Math.max(0, Math.round((inv.outstandingBalance - rowCash - rowPrepay) * 100) / 100);
                                return (
                                  <tr key={inv.id}>
                                    {/* Blue text IS a link (Eli 9/8): the number opens the invoice. */}
                                    <td className="pl-4 px-3 py-2 ">
                                      <a
                                        href={`/invoices/${encodeURIComponent(inv.invoiceNumber)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground hover:text-primary hover:underline transition-colors"
                                        style={{ fontWeight: 600 }}
                                      >
                                        {inv.invoiceNumber}
                                      </a>
                                    </td>
                                    <td className="px-3 py-2">
                                      {/* Three states at the CHOSEN date
                                      (user 9/23 spec): discount lives in
                                      its own column; here the row reads
                                      on time or overdue AS OF the payment
                                      date, not today. */}
                                  {paymentDate ? (() => {
                                    const daysLate = Math.round((new Date(`${paymentDate}T00:00:00`).getTime() - new Date(`${inv.dueDate}T00:00:00`).getTime()) / 86400000);
                                    return daysLate > 0 ? (
                                      <span className="inline-flex px-2 py-px rounded-full text-[10px] border bg-red-50 text-red-600 border-red-200 whitespace-nowrap" style={{ fontWeight: 600 }}>
                                        Overdue by {daysLate} Day{daysLate === 1 ? "" : "s"} at Payment Date
                                      </span>
                                    ) : (
                                      <span className="inline-flex px-2 py-px rounded-full text-[10px] border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap" style={{ fontWeight: 600 }}>
                                        On Time at Payment Date
                                      </span>
                                    );
                                  })() : (
                                    <DueDatePill dueDate={inv.dueDate} />
                                  )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-400">{fmt(inv.amount)}</td>
                                    <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">
                                      <div className="flex flex-col items-end leading-tight">
                                        <span>{fmt(inv.outstandingBalance)}</span>
                                        {paidSoFar > 0.004 && (
                                          <span className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{fmt(paidSoFar)} already paid</span>
                                        )}
                                      </div>
                                    </td>
                                    {hasLiveDiscount && (
                                      <td className="px-3 py-2 text-right whitespace-nowrap">
                                        <DiscountCell inv={inv} paymentDate={paymentDate} onUseDiscounted={(amt) => setLine(inv.id, { amount: amt }, inv)} />
                                      </td>
                                    )}
                                    {hasCredit && (
                                      <td className="px-3 py-2 text-right">
                                        {anchoredCreditFor(inv.invoiceNumber) > 0 ? (
                                          <Tooltip delayDuration={300}>
                                            <TooltipTrigger asChild>
                                              <div className="inline-flex items-center justify-end gap-1.5 w-[104px] h-7 rounded-md border border-slate-200 bg-slate-50/60 px-2 cursor-not-allowed">
                                                <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="text-[12px] text-slate-600" style={{ fontWeight: 600 }}>{fmt(rowPrepay)}</span>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Auto-Applied Prepayment</p>
                                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                                This credit was recorded against this pre-invoice and applies automatically. It can't be edited.
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        ) : (
                                        <div className="relative inline-block">
                                          <MoneyInput
                                            value={rowPrepay}
                                            placeholder="0.00"
                                            onValueChange={(v) => {
                                              setLine(inv.id, { prepayApplied: Math.min(v, prepayCap), amount: Math.round((rowCash + Math.min(v, prepayCap)) * 100) / 100 }, inv);
                                              // Editing a single row means the user is no longer
                                              // in "apply all" mode, so drop the shortcut flag to
                                              // stop the vendor-level fallback from re-spreading.
                                              setPrepayApply((prev) => ({ ...prev, [row.vendor]: false }));
                                            }}
                                            className={`h-7 text-right text-[12px] font-semibold rounded-md border bg-white px-2 outline-none focus:ring-1 ${prepayOver ? 'border-red-400 text-red-600 focus:border-red-500 focus:ring-red-100 pl-7' : rowPrepay > 0 ? 'border-purple-200 focus:border-purple-400 focus:ring-purple-100 text-purple-700' : 'border-slate-300 text-foreground focus:border-primary focus:ring-primary/20'}`}
                                          />
                                          {prepayOver && (
                                            <HoverCard openDelay={300} closeDelay={120}>
                                              <HoverCardTrigger asChild>
                                                <button type="button" tabIndex={-1} className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-500 hover:bg-red-100 transition-colors cursor-help" aria-label="Prepayment exceeds what can be applied">
                                                  <AlertTriangle className="w-3 h-3" />
                                                </button>
                                              </HoverCardTrigger>
                                              <HoverCardContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Exceeds What Can Be Applied</p>
                                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                                  Applied is <span className="text-foreground " style={{ fontWeight: 600 }}>{fmt(rowPrepay)}</span> but only{' '}
                                                  <button type="button" onClick={() => setLine(inv.id, { prepayApplied: Math.max(0, prepayCap), amount: Math.round((rowCash + Math.max(0, prepayCap)) * 100) / 100 }, inv)} className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline" style={{ fontWeight: 600 }}>{fmt(Math.max(0, prepayCap))}</button>{' '}
                                                  can go against this invoice. Click the amount to snap the input back.
                                                </p>
                                              </HoverCardContent>
                                            </HoverCard>
                                          )}
                                        </div>
                                        )}
                                      </td>
                                    )}
                                    <td className="px-3 py-2 text-right" id={`pay-amt-${inv.id}`}>
                                      <MoneyInput
                                        value={rowCash}
                                        placeholder="0.00"
                                        autoFocus={startAtStep2 && invIdx === 0}
                                        onValueChange={(v) => {
                                          setLine(inv.id, { amount: Math.round((v + rowPrepay) * 100) / 100 }, inv);
                                        }}
                                        className={`h-8 text-right text-[12px] font-semibold rounded-md border bg-white px-2 outline-none focus:ring-1 ${
                                          isOver
                                            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100 text-rose-700'
                                            : 'border-slate-300 focus:border-primary focus:ring-primary/20'
                                        }`}
                                      />
                                      {isOver ? (
                                        <span className="block text-[10px] text-rose-600 mt-0.5 inline-flex items-center justify-end gap-1 w-full" style={{ fontWeight: 500 }}>
                                          <AlertCircle className="w-3 h-3" /> Exceeds the balance, max is {fmt(inv.outstandingBalance)}
                                        </span>
                                      ) : isBelow ? (
                                        /* A partial payment is a choice, not
                                           an error (Nophil 9/23). */
                                        <span className="block text-[10px] text-slate-500 mt-0.5 inline-flex items-center justify-end gap-1 w-full" style={{ fontWeight: 500 }}>
                                          <Info className="w-3 h-3" /> Partial payment, {fmt(belowRemainder)} stays open
                                        </span>
                                      ) : remainingAfter > 0 && (l.amount || 0) > 0 ? (
                                        <span className="block text-[10px] text-amber-600 mt-0.5" style={{ fontWeight: 500 }}>{fmt(remainingAfter)} remaining after</span>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {m.selectedInvs.length > 1 ? (
                                        <button
                                          type="button"
                                          onClick={() => setLine(inv.id, { selected: false }, inv)}
                                          className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                          title="Remove from this payment"
                                          aria-label={`Remove ${inv.invoiceNumber}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      ) : (
                                        <span className="p-1 inline-flex text-slate-200 cursor-not-allowed" title="A payment needs at least one invoice">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div className="px-4 py-2 border-t border-border/60 bg-slate-50/50 flex items-center justify-end gap-4 text-[11px] ">
                            {/* Bulk fill stays one click (Eli 9/8 + Mahreen's
                                condition): amounts start empty, Pay in full
                                consciously fills every selected line. */}
                            <button
                              type="button"
                              onClick={() => m.selectedInvs.forEach((inv) => setLine(inv.id, { amount: inv.outstandingBalance }, inv))}
                              className="mr-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/40 bg-white text-[11px] text-primary hover:bg-accent transition-colors cursor-pointer"
                              style={{ fontWeight: 600 }}
                            >
                              <Banknote className="w-3 h-3" /> Pay in Full
                            </button>
                            <span className="text-slate-500" style={{ fontWeight: 500 }}>
                              Invoice total <span className="text-slate-700" style={{ fontWeight: 600 }}>{fmt(m.selectedInvs.reduce((s, inv) => s + inv.amount, 0))}</span>
                            </span>
                            {m.applied > 0 && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-purple-700" style={{ fontWeight: 600 }}>Vendor credit applied −{fmt(m.applied)}</span>
                              </>
                            )}
                            <span className="text-slate-300">·</span>
                            <span className="text-foreground" style={{ fontWeight: 700 }}>Total Payment {fmt(m.net)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {/* The recorded confirmation carries no footer (user 10/9): the
            remittance download is its primary action, the header X closes. */}
        {recorded ? null : inPreFlow ? (
          <div className="shrink-0 border-t border-slate-100 bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-3 sm:rounded-b-2xl">
            <div className="text-[11px] text-slate-500 min-w-0 truncate">
              {(chooseSel ?? recommendedOption) === 'invoices' && chosenVendorRow
                ? <>Recording a <span className="text-foreground" style={{ fontWeight: 600 }}>payment</span> against {chosenVendorRow.open.filter((inv) => lineFor(inv).selected).length} invoice{chosenVendorRow.open.filter((inv) => lineFor(inv).selected).length === 1 ? '' : 's'} for <span className="text-foreground" style={{ fontWeight: 600 }}>{chosenVendor}</span></>
                : (chooseSel ?? recommendedOption) === 'pre-invoices'
                  ? selectedPreInvoiceIds.length > 1
                    ? <>Recording <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedPreInvoiceIds.length} prepayments</span>, one per selected pre-invoice</>
                    : <>Recording a <span className="text-foreground" style={{ fontWeight: 600 }}>prepayment</span> reserved for a pre-invoice</>
                  : (chooseSel ?? recommendedOption) === 'advance'
                    ? <>Recording a <span className="text-foreground" style={{ fontWeight: 600 }}>standalone advance</span> held on {chosenVendor}'s account</>
                    : <>Choose what to record for <span className="text-foreground" style={{ fontWeight: 600 }}>{chosenVendor}</span></>}
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCancelClick}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-5 h-8 sm:h-9"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm text-white transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 500 }}
                onClick={confirmChoose}
              >
                Continue
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t border-slate-100 bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center gap-3 flex-wrap sm:rounded-b-2xl">
            <div className="flex items-center gap-3 text-[11px] text-slate-500 min-w-0 flex-wrap">
              {mode === 'prepay' ? (
                step === 2 ? (
                  // No footer number (user 9/25, same rule as the pay flow):
                  // the summary panel already reads the totals.
                  null
                ) : (
                  <span>
                    <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedVendors[0] ?? 'No vendor'}</span>
                    {prepayTarget === 'pre-invoice'
                      ? (selectedPreInvoice ? <> · linked to {selectedPreInvoice.invoiceNumber}</> : selectedVendors[0] ? <> · pick a pre-invoice</> : null)
                      : selectedVendors[0] ? <> · on account</> : null}
                  </span>
                )
              ) : step === 2 ? (
                // Step 2 carries no footer number — the summary panel already
                // reads Total payment + Remaining balance to pay (7/15/26).
                null
              ) : selectedPreInvoiceIds.length > 0 ? (
                // Selection-type summary (7/24/26): says what Continue records.
                <span>
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedPreInvoiceIds.length}</span> pre-invoice{selectedPreInvoiceIds.length === 1 ? '' : 's'} selected
                  <span className="text-slate-300"> · </span>
                  records {selectedPreInvoiceIds.length === 1 ? 'a prepayment' : 'one prepayment each'}
                </span>
              ) : grand.invoices === 0 && selectedVendors.length > 0 ? (
                <span>
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedVendors[0]}</span> selected
                  <span className="text-slate-300"> · </span>
                  choose what to record on the next step
                </span>
              ) : (
                <>
                  <span><span className="text-foreground" style={{ fontWeight: 600 }}>{grand.invoices}</span> invoice{grand.invoices === 1 ? '' : 's'} selected from <span className="text-foreground" style={{ fontWeight: 600 }}>{selectedVendors.length}</span> vendor{selectedVendors.length === 1 ? '' : 's'}</span>
                  <span className="text-slate-300">·</span>
                  <span>net to pay <span className="text-foreground" style={{ fontWeight: 700 }}>{grandPayText()}</span></span>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCancelClick}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-white text-xs sm:text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0 cursor-pointer px-3 sm:px-5 h-8 sm:h-9"
                style={{ fontWeight: 500 }}
              >
                Cancel
              </button>
              {step === 2 ? (
                <>
                  {/* "Save as draft" removed — draft payments are deleted
                      from the model (Eli review 7/15/26). */}
                  <button
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm text-white transition-opacity hover:opacity-90 cursor-pointer"
                    style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 500 }}
                    onClick={() => {
                      setFieldErrors({});
                      if (mode === 'prepay' && prepayAmount <= 0) {
                        setFieldErrors({ amount: 'Enter a prepayment amount greater than zero.' });
                        return;
                      }
                      // Never prepay more than a pre-invoice still owes,
                      // refused HERE, before the confirm (user 10/22/26).
                      const overPre = preInvoiceOverRow();
                      if (overPre) {
                        const owed = fmt(Math.max(0, overPre.outstandingBalance));
                        setFieldErrors({ amount: `Cannot exceed outstanding ${owed} on ${overPre.invoiceNumber}.` });
                        toast.error('Prepayment is more than the pre-invoice still owes', {
                          description: `${overPre.invoiceNumber} has ${owed} outstanding. Lower the prepayment to record.`,
                        });
                        return;
                      }
                      // Vendor credit can't exceed what the vendor has
                      // (user 10/22/26): refused, never converted to cash.
                      const overCredit = creditOverVendor();
                      if (overCredit) {
                        toast.error('Vendor credit is more than the vendor has', {
                          description: `${overCredit.vendor} has ${fmt(overCredit.available)} in vendor credit, but ${fmt(overCredit.applied)} is applied. Lower the credit to record.`,
                        });
                        if (overCredit.firstInv) document.getElementById(`pay-amt-${overCredit.firstInv.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        return;
                      }
                      // Block only when there's genuinely nothing to settle. A
                      // fully-applied prepayment leaves gross > 0 but net (cash)
                      // = 0, which is a valid $0-cash record.
                      if (mode === 'pay' && grand.gross <= 0) {
                        toast.error('Nothing to pay, select at least one invoice with an amount.');
                        return;
                      }
                      // A payment can never exceed the balance due
                      // (Eli 9/24 retest M16/R01, reinstating the Aug 31
                      // rule): cash plus applied credit above the
                      // outstanding amount is refused, the row is already
                      // rose, the toast names the fix.
                      if (mode === 'pay') {
                        const overRows = selectedRows.flatMap((row) =>
                          vendorMath(row).selectedInvs.filter((inv) => (lineFor(inv).amount || 0) > inv.outstandingBalance + 0.004),
                        );
                        if (overRows.length > 0) {
                          const first = overRows[0];
                          const owed = Math.round(first.outstandingBalance * 100) / 100;
                          toast.error('Payment exceeds the balance', {
                            description: `${first.invoiceNumber} only has ${fmt(owed)} due. Reduce the amount or use Pay in Full.`,
                          });
                          // The highlight takes you there (Eli 9/23): the
                          // offending row scrolls into view.
                          document.getElementById(`pay-amt-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          return;
                        }
                      }
                      if (method === 'Other' && !memo.trim()) {
                        setFieldErrors({ description: 'A description is required when the method is “Other”.' });
                        return;
                      }
                      // The date is stated, never assumed (Nophil 9/23).
                      if (!paymentDate) {
                        setFieldErrors((f) => ({ ...f, paymentDate: 'Payment date is missing.' }));
                        toast.error('Payment date required', { description: 'Enter the date the payment was made before recording.' });
                        // The highlight takes you there (user 9/24): the
                        // offending field scrolls into view AND takes focus.
                        const dateEl = document.getElementById('rp-payment-date') ?? document.getElementById('rp-payment-date-full');
                        dateEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        dateEl?.focus({ preventScroll: true });
                        return;
                      }
                      // A reused check or wire number can't post (review 7/9/26).
                      if (referenceError) {
                        toast.error(referenceError);
                        return;
                      }
                      // Manual ACH/wire requires its proof (Aug 31 rule;
                      // 9/22/26 review response): no trace or confirmation
                      // number, no record.
                      if (referenceRequired && !reference.trim()) {
                        setFieldErrors({ reference: methodType === 'ACH' ? 'ACH trace number is missing.' : 'Wire confirmation number is missing.' });
                        toast.error('Reference required', { description: `Record ${methodType === 'ACH' ? 'an ACH trace number' : 'a wire confirmation number'} before recording the payment.` });
                        const refEl = document.getElementById('rp-reference') ?? document.getElementById('rp-reference-full');
                        refEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        refEl?.focus({ preventScroll: true });
                        return;
                      }
                      // Amount equals the DISCOUNTED total after the
                      // window closed (user 9/23 spec): ask whether the
                      // vendor allowed a late discount, reason required.
                      if (mode === 'pay') {
                        const candidates = selectedRows.flatMap((row) =>
                          vendorMath(row).selectedInvs.flatMap((inv) => {
                            const l = lineFor(inv);
                            if (l.lateDiscount || ldDeclined.has(inv.id)) return [];
                            const dTerms = discountTermsFor(inv);
                            if (!dTerms || discountIsLive(dTerms, paymentDate || undefined)) return [];
                            const dAmount = discountAmountOn(inv.outstandingBalance, dTerms);
                            const discounted = Math.round((inv.outstandingBalance - dAmount) * 100) / 100;
                            if (Math.abs((l.amount || 0) - discounted) > 0.005) return [];
                            return [{ invId: inv.id, invoiceNumber: inv.invoiceNumber, vendor: inv.vendor, percent: dTerms.percent, deadline: dTerms.deadline, dAmount, discounted }];
                          }),
                        );
                        if (candidates.length > 0) {
                          setLdReason('');
                          setLdQueue(candidates);
                          return;
                        }
                      }
                      // Low balance never BLOCKS (book balances lag real
                      // cash), but overdrawing must be consciously
                      // acknowledged first (Eli 7/24/26) — the amber
                      // pop-up, then the normal GL review.
                      if (lowBalance) {
                        setOverdrawAckOpen(true);
                        return;
                      }
                      setConfirmOpen(true);
                    }}
                  >
                    <SendHorizontal className="w-3.5 h-3.5" />
                    {recordVerb}
                  </button>
                </>
              ) : (
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm text-white transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: 'hsl(var(--primary))', fontWeight: 500 }}
                  onClick={goContinue}
                >
                  Continue
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Late discount confirm (user 9/23 spec): amount equals the
          discounted total after the window closed — did the vendor allow
          it? Reason required; the invoice then settles in full. ── */}
      <AlertDialog open={ldQueue.length > 0} onOpenChange={(o) => { if (!o) setLdQueue([]); }}>
        <AlertDialogContent
          className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[440px]"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)', zIndex: 240 }}
        >
          {ldQueue[0] && (() => {
            const c = ldQueue[0];
            const advance = () => {
              const rest = ldQueue.slice(1);
              setLdQueue(rest);
              setLdReason('');
              if (rest.length === 0) {
                if (lowBalance) setOverdrawAckOpen(true);
                else setConfirmOpen(true);
              }
            };
            return (
              <>
                <div
                  className="relative flex flex-col items-center pt-7 pb-4 shrink-0"
                  style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#B45309', filter: 'blur(50px)' }} />
                  <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                    <AlertTriangle className="w-7 h-7" style={{ color: '#B45309', strokeWidth: 2 }} />
                  </div>
                  <span className="mt-2.5 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FFFBEB', color: '#92400E' }}>
                    Late Discount
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-6">
                  <AlertDialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                    Did the vendor allow a late discount?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[13px] mt-1.5 mx-auto text-muted-foreground" style={{ lineHeight: 1.6, maxWidth: '380px' }}>
                    The amount on <span className="text-foreground " style={{ fontWeight: 600 }}>{c.invoiceNumber}</span> equals the {c.percent}% discounted total of <span className="text-foreground " style={{ fontWeight: 600 }}>{fmt(c.discounted)}</span>, but the window closed {fmtDeadline(c.deadline)}. If {c.vendor} honored it anyway, the invoice settles in full.
                  </AlertDialogDescription>
                </div>
                <div className="px-6 pt-4 pb-6 space-y-3 text-left">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                      Reason
                      <span style={{ color: '#DC2626' }}>*</span>
                    </Label>
                    <textarea
                      value={ldReason}
                      onChange={(e) => { setLdReason(e.target.value); setLdReasonError(false); }}
                      placeholder="How was the late discount agreed? e.g. vendor email on file"
                      rows={2}
                      className={`w-full text-[11px] rounded-md border bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-[11px] placeholder:text-slate-400 resize-none ${ldReasonError ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                    />
                    {ldReasonError && <p className="text-[10px] text-red-600 mt-1">Add the reason first.</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!ldReason.trim()) {
                        setLdReasonError(true);
                        toast.error('Reason required', { description: 'Note how the late discount was agreed first.' });
                        return;
                      }
                      setLines((prev) => ({
                        ...prev,
                        [c.invId]: { ...(prev[c.invId] ?? { selected: true, amount: c.discounted }), lateDiscount: { amount: c.dAmount, reason: ldReason.trim() } },
                      }));
                      advance();
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
                    style={{ fontWeight: 600, backgroundColor: '#B45309' }}
                  >
                    Vendor Honored It, Apply the Discount
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLdDeclined((prev) => new Set(prev).add(c.invId));
                      advance();
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  >
                    No, Record It as a Partial Payment
                  </button>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Explicit prepayment gate (Eli 7/22/26) — gradient-hero confirm
          modal, matching the system's confirmation modal language. ── */}
      <AlertDialog open={prepayPrompt === 'open'} onOpenChange={(o) => { if (!o) setPrepayPrompt('dismissed'); }}>
        <AlertDialogContent
          className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[420px]"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)', zIndex: 240 }}
        >
          {(() => {
            const rows = selectedRows.filter((r) => prepayAvailableFor(r.vendor) > 0);
            const total = rows.reduce((s, r) => s + prepayAvailableFor(r.vendor), 0);
            const vendorLabel = rows.length === 1 ? rows[0].vendor : `${rows.length} vendors`;
            return (
              <>
                {/* Gradient hero */}
                <div
                  className="relative flex flex-col items-center pt-8 pb-5 shrink-0"
                  style={{ background: 'linear-gradient(180deg, #F3E8FF 0%, rgba(243,232,255,0.3) 70%, transparent 100%)' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[90px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#7E22CE', filter: 'blur(50px)' }} />
                  <div className="relative w-[56px] h-[56px] rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#E9D5FF' }}>
                    <Wallet className="w-7 h-7" style={{ color: '#7E22CE', strokeWidth: 2 }} />
                  </div>
                  <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#F3E8FF', color: '#7E22CE' }}>
                    Vendor Credit
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-6">
                  <AlertDialogTitle className="text-[20px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                    Apply vendor credit to this invoice?
                  </AlertDialogTitle>
                  {/* User copy 9/23. */}
                  <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.7, maxWidth: '340px' }}>
                    {vendorLabel} {rows.length === 1 ? 'has' : 'have'}{' '}
                    <span className="text-foreground " style={{ fontWeight: 700 }}>{fmt(total)}</span>{' '}
                    in vendor credit. Apply it here, or keep it for a later invoice.
                  </p>
                </div>
                {/* gap-4, not 2.5 (Eli 9/24): he misclicked "Keep for
                    later" reaching for Apply — the pair needs air. */}
                <div className="px-6 pt-4 pb-6 flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      // Open the Apply-prepayment-credit modal for the first
                      // credited vendor (was a dead button, fix 7/24/26).
                      setPrepayPrompt('dismissed');
                      if (rows[0]) setPrepayReview((p) => ({ vendor: rows[0].vendor, n: p.n + 1 }));
                    }}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ fontWeight: 600, backgroundColor: '#7E22CE', color: '#fff' }}
                  >
                    Apply to This Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrepayPrompt('dismissed')}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  >
                    Keep for Later
                  </button>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm modal, GL impact ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent
          // 480px (user 9/9: "too big") — the record confirm slims toward
          // the discard-modal scale; the GL panel reads in columns now.
          className="flex flex-col w-full sm:max-w-[480px] max-h-[calc(100dvh-2rem)] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
        >
          {/* Scheduled confirms wear the blue clock identity head to toe.
              Previously the gradient + glow kept the pay/prepay tone
              (green/purple) while the icon, pill and CTA went blue, so
              the hero read as washed-out white with clashing accents
              (feedback 7/20/26). */}
          <div
            className="relative flex flex-col items-center pt-9 pb-5 shrink-0"
            style={{ background: `linear-gradient(180deg, ${isFuture ? 'var(--color-blue-50)' : t.heroTint} 0%, rgba(255,255,255,0.3) 70%, transparent 100%)` }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: isFuture ? 'hsl(var(--primary))' : t.primary }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center animate-spin-in" style={{ backgroundColor: isFuture ? 'var(--color-blue-100)' : t.heroBg }}>
              {isFuture ? <Clock className="w-7 h-7" style={{ color: 'var(--color-blue-700)' }} /> : mode === 'prepay' ? <Wallet className="w-7 h-7" style={{ color: t.heroIcon }} /> : <Landmark className="w-7 h-7" style={{ color: t.heroIcon }} />}
            </div>
            <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: isFuture ? 'var(--color-blue-50)' : t.heroTint, color: isFuture ? 'var(--color-blue-700)' : t.text,  }}>
              {isFuture ? 'Schedule' : `Confirm ${mode === 'prepay' ? 'Prepayment' : 'Payment'}`}
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-7 pb-7 min-h-0 overflow-y-auto">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[20px] tracking-[-0.02em]" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                {isFuture
                  ? `Schedule payment for ${grandPayText()}?`
                  : mode === 'prepay'
                    ? multiPrepay
                      ? `Record ${grand.records} prepayments for ${grandPayText()}?`
                      : `Record ${grandPayText()} advance to ${selectedVendors[0]}?`
                    : `Record ${grand.records} payment${grand.records === 1 ? '' : 's'} for ${grandPayText()}?`}
              </AlertDialogTitle>
            </AlertDialogHeader>
            {!isFuture && mode === 'prepay' && (
              <p className="text-[12px] text-slate-500 mt-1.5">
                {multiPrepay
                  ? `One per pre-invoice: ${selectedPreInvoices.map((pi) => pi.invoiceNumber).join(', ')}.`
                  : prepayTarget === 'pre-invoice' && selectedPreInvoice
                    ? `Linked to ${selectedPreInvoice.invoiceNumber}.`
                    : 'Held on the vendor account.'}
              </p>
            )}
            {/* Late-discount + pending-approval facts, stated before
                posting (user 9/23 spec; Eli 9/24 N01: paying a pending
                invoice approves it). Banner alerts at the top of the body
                (user 10/15), not loose lines under the title. */}
            {!isFuture && mode === 'pay' && (() => {
              const allSel = selectedRows.flatMap((row) => vendorMath(row).selectedInvs);
              const lateTotal = Math.round(allSel.reduce((sum, inv) => sum + (lineFor(inv).lateDiscount?.amount ?? 0), 0) * 100) / 100;
              const pendingSel = allSel.filter((inv) => inv.status === 'Pending Approval');
              if (lateTotal <= 0.004 && pendingSel.length === 0) return null;
              return (
                <div className="w-full mt-4 space-y-2 text-left">
                  {pendingSel.length > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
                      <div className="min-w-0">
                        <p className="text-[12px] text-amber-900" style={{ fontWeight: 600 }}>
                          {pendingSel.length === 1 ? 'This invoice is pending approval' : `${pendingSel.length} invoices are pending approval`}
                        </p>
                        <p className="text-[11.5px] text-amber-800 mt-0.5 leading-snug">
                          Recording this payment approves {pendingSel.map((i) => i.invoiceNumber).join(', ')}.
                        </p>
                      </div>
                    </div>
                  )}
                  {lateTotal > 0.004 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-px" />
                      <div className="min-w-0">
                        <p className="text-[12px] text-emerald-900" style={{ fontWeight: 600 }}>Late Discount Honored</p>
                        <p className="text-[11.5px] text-emerald-800 mt-0.5 leading-snug">
                          The vendor accepted a {fmt(lateTotal)} discount after the window closed. It's included in this payment.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {isFuture ? (
              <div className="w-full mt-4 text-left rounded-xl border border-slate-200/70 bg-slate-50/60 px-3.5 py-3 space-y-2">
                {(() => {
                  const rows = selectedRows.map((r) => ({ r, m: vendorMath(r) })).filter((x) => x.m.selectedInvs.length > 0);
                  const firstVendor = rows[0]?.r.vendor ?? 'this vendor';
                  const firstInv = rows.flatMap((x) => x.m.selectedInvs)[0]?.invoiceNumber ?? 'the invoice';
                  const manyV = grand.records > 1;
                  const manyI = grand.invoices > 1;
                  const lines = [
                    manyV ? `These ${grand.records} payments will post on ${dateLabel}, not today.` : `This payment to ${firstVendor} will post on ${dateLabel}, not today.`,
                    manyI ? `On that date they clear Accounts Payable and mark the ${grand.invoices} selected invoices paid.` : `On that date it clears Accounts Payable and marks ${firstInv} paid.`,
                    manyI ? 'Until then they stay in your outstanding balance.' : 'Until then it stays in your outstanding balance.',
                  ];
                  return lines.map((l, i) => (
                    <p key={i} className="text-[12px] text-slate-600 leading-snug flex gap-2">
                      <span className="text-slate-300 shrink-0">•</span><span>{l}</span>
                    </p>
                  ));
                })()}
              </div>
            ) : !showGlOnConfirmations ? null : (
            <div className="w-full mt-4 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 700 }}>GL Impact</p>
              </div>
              {/* Scrolls inside itself on short screens (user 10/15): the
                  height tracks the viewport, header and totals stay put. */}
              <div className="rounded-lg border border-slate-200 bg-white overflow-y-auto max-h-[max(150px,calc(100dvh-480px))]">
                <table className="w-full text-[12px]">
                  {/* Column headers (user 9/9): same readable ACCOUNT /
                      DEBIT / CREDIT anatomy as the invoice submit confirm. */}
                  <thead>
                    <tr className="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50">
                      <th className="px-3 py-1.5 text-left text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Account</th>
                      <th className="px-3 py-1.5 text-right text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Debit</th>
                      <th className="px-3 py-1.5 text-right text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {glLines.map((l, i) => {
                      // Debit/credit direction label at point of entry (Eli
                      // 7/22/26) — same rule as the invoice GL Impact tab: on
                      // asset/expense accounts a debit increases; on liability/
                      // equity/revenue a credit increases.
                      const isAsset = l.code.startsWith('1');
                      const isExpense = l.code.startsWith('5') || l.code.startsWith('6');
                      const isDebit = l.debit > 0;
                      const up = isAsset || isExpense ? isDebit : !isDebit;
                      // Arrow-only direction indicator (7/24/26, system-wide):
                      // green up / red down; the word + rule live in the tooltip.
                      const kind = isAsset ? 'asset' : isExpense ? 'expense' : 'liability';
                      const dirExplain = `${isDebit ? 'Debit' : 'Credit'} ${up ? 'increases' : 'decreases'} this ${kind} account, ${l.code} ${l.name}.`;
                      return (
                      <tr key={i} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-1.5">
                          <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{l.code}</span>
                          <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{l.name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full border align-middle cursor-help"
                                aria-label={up ? 'Increases' : 'Decreases'}
                                style={up
                                  ? { color: '#047857', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                                  : { color: '#E11D48', backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }}
                              >
                                {up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[240px] z-[300]">
                              <p className="text-[11px] leading-snug" style={{ fontWeight: 600, color: up ? '#047857' : '#E11D48' }}>{up ? 'Increases' : 'Decreases'}</p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{dirExplain}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-1.5 text-right ">{l.debit > 0 ? <span style={{ fontWeight: 600 }}>{fmt(l.debit)}</span> : null}</td>
                        <td className="px-3 py-1.5 text-right ">{l.credit > 0 ? <span style={{ fontWeight: 600 }}>{fmt(l.credit)}</span> : null}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="sticky bottom-0 z-[1] border-t border-slate-200 bg-slate-50">
                      <td className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
                          <CheckCircle2 className="w-2.5 h-2.5" /> Debit = Credit
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{fmt(glLines.reduce((s, l) => s + l.debit, 0))}</td>
                      <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{fmt(glLines.reduce((s, l) => s + l.credit, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            )}
            {/* Out-of-sequence / big-jump check numbers surface here so
                recording IS the confirm-to-proceed (spec 7/19/26) — the
                warning never blocks, split checkbooks are legitimate. */}
            {referenceWarning && (
              <div className="w-full mt-3 text-left rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800 leading-snug">
                  <span style={{ fontWeight: 600 }}>Check Number {reference.trim()}:</span> {referenceWarning}{' '}
                  Recording anyway confirms the number is what you actually wrote.
                </p>
              </div>
            )}
            {/* Print BEFORE recording (BA spec §9, restored user 10/15):
                preview, blocking confirm, then the payment posts with the
                issued number as its reference. Skipping it is fine, the
                success modal offers the print again. */}
            {!isFuture && methodType === 'Check' && (mode === 'prepay' || grand.records === 1) && (
              <div className="w-full mt-3 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Printer className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                    Check {checkSettingsFor(bankAccount).nextCheckNumber} · {STOCK_PROFILES[checkSettingsFor(bankAccount).style].displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Print it first and the payment records once you confirm it printed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCheckInputs(buildCheckInputs());
                    // The confirm steps aside while the preview is up
                    // (user 9/24): stacked dialogs buried the preview.
                    setConfirmOpen(false);
                    setCheckPrintOpen(true);
                  }}
                  className="h-9 px-3.5 rounded-lg border border-border bg-white text-[12px] text-foreground hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                  style={{ fontWeight: 600 }}
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  Print Check
                </button>
              </div>
            )}
            <div className="w-full mt-5 flex flex-col gap-2.5">
              {/* Gradient modals carry their gradient hue into the CTA (like the
                  red Discard modal): green for pay, purple for prepay. Scheduled
                  keeps the blue identity of its clock hero. */}
              <button
                onClick={() => { setConfirmOpen(false); buildAndComplete(false); }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: isFuture ? 'hsl(var(--primary))' : t.primary, color: '#fff' }}
              >
                {recordVerb}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: 'var(--color-slate-50)', color: 'var(--color-slate-700)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-slate-50)'; }}
              >
                Keep Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk method confirm (feedback 7/21/26) ── applying a method
          TYPE run-wide is a broadcast, so it confirms first: vendors WITH
          a saved method of that type switch to it (primary or not, which
          is why the Primary pill only shows where it truly is their
          primary), vendors WITHOUT one keep their primary method. */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent
          className="flex flex-col w-full sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
        >
          {(() => {
            const preview = bulkMethodPreview(bulkMethodId);
            if (!preview) return null;
            const { gm, gets, keeps } = preview;
            const gInfo = paymentMethodInfo(gm.type);
            const GIcon = gInfo.icon;
            const gColors = methodCategoryColors(gInfo.category);
            const acctLabel = PAY_FROM_ACCOUNTS.find((a) => a.id === bulkAccountId)?.label ?? 'the selected account';
            return (
              <>
                <div
                  className="relative flex flex-col items-center pt-9 pb-5"
                  style={{ background: `linear-gradient(180deg, ${t.heroTint} 0%, rgba(255,255,255,0.3) 70%, transparent 100%)` }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: t.primary }} />
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center animate-spin-in" style={{ backgroundColor: gColors.bg }}>
                    <GIcon className="w-7 h-7" style={{ color: gColors.color }} />
                  </div>
                  <span
                    className="mt-3 px-3 py-1 rounded-full text-[11px]"
                    style={{ fontWeight: 600, backgroundColor: t.heroTint, color: t.text,  }}
                  >
                    Standardize Method
                  </span>
                </div>
                <div className="flex flex-col items-center text-center px-7 pb-7">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                    <AlertDialogTitle className="text-[20px] tracking-[-0.02em]" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                      Pay every vendor by {gInfo.label}?
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <p className="text-[12px] text-slate-500 mt-1.5">
                    You are changing the payment method for every vendor in this run that has a saved {gInfo.label} method. Vendors without one keep their primary method.
                  </p>
                  <div className="w-full mt-4 space-y-3 text-left">
                    {gets.length > 0 && (
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-3.5 py-2.5">
                        <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 700 }}>
                          Switches to {gInfo.label} · {gets.length}
                        </p>
                        <div className="space-y-1.5 max-h-[130px] overflow-y-auto custom-scrollbar">
                          {gets.map(({ vendor, method: mm }) => (
                            <div key={vendor} className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] text-slate-700 truncate flex-1" style={{ fontWeight: 600 }}>{vendor}</span>
                              <span className="text-[11px] text-slate-500 truncate">{mm.nickname}</span>
                              {mm.isPrimary && <PrimaryPill size="xs" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {keeps.length > 0 && (
                      <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-3.5 py-2.5">
                        <p className="text-[10px] text-amber-600 mb-1.5" style={{ fontWeight: 700 }}>
                          No saved {gInfo.label}, keeps primary · {keeps.length}
                        </p>
                        <div className="space-y-1.5 max-h-[130px] overflow-y-auto custom-scrollbar">
                          {keeps.map(({ vendor, method: mm }) => (
                            <div key={vendor} className="flex items-center gap-2 min-w-0">
                              <span className="text-[12px] text-slate-700 truncate flex-1" style={{ fontWeight: 600 }}>{vendor}</span>
                              <span className="text-[11px] text-slate-500 truncate">{mm ? mm.nickname : 'No saved method'}</span>
                              {mm?.isPrimary && <PrimaryPill size="xs" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3 inline-flex items-center gap-1.5">
                    <Landmark className="w-3 h-3 text-slate-400 shrink-0" /> Every vendor pays from {acctLabel}.
                  </p>
                  <div className="w-full mt-5 flex flex-col gap-2.5">
                    <button
                      onClick={applyBulkToAll}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: t.primary, color: '#fff' }}
                    >
                      Apply to All {selectedVendors.length} vendors
                    </button>
                    <button
                      onClick={() => setBulkConfirmOpen(false)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: 'var(--color-slate-50)', color: 'var(--color-slate-700)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-slate-50)'; }}
                    >
                      Keep Current Methods
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Remove-vendor confirm — the PO-tab removal recipe from
          Create Vendor Invoice (feedback 7/21/26). ── */}
      {vendorToRemove && (
        <div className="fixed inset-0 bg-black/40 z-[240] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Remove vendor?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              You are about to remove <span className="font-bold text-foreground">{vendorToRemove}</span> from this payment run. Its invoices and payment setup will be cleared from the run.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setVendorToRemove(null)}
                className="flex-1 h-10 text-xs font-bold tracking-wider rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={() => removeVendorFromRun(vendorToRemove)}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-xs font-bold tracking-wider rounded-lg"
              >
                Yes, Remove
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pay-from account picker (GL-config-style modal) ── */}
      <PayFromAccountModal
        open={payFromModalOpen}
        onOpenChange={setPayFromModalOpen}
        value={bankAccount}
        // All accounts, not just the current method's pool — picking an
        // account of a different class re-derives the method instead of
        // being impossible (derived-field model, review 7/9/26). Only those
        // in the payment currency or the base currency, though.
        accounts={currencyAccounts}
        onApply={onAccountApply}
      />

      <PaymentMethodModal
        open={paymentMethodModalOpen}
        onOpenChange={setPaymentMethodModalOpen}
        value={resolvedMethod ? resolvedMethod.id : ''}
        methods={vendorMethods}
        vendorName={methodVendorName}
        onApply={onMethodApply}
      />

      {/* Per-vendor pickers for multi-vendor bulk runs (feedback 7/21/26):
          each row edits ITS vendor's saved methods; picking a method
          re-derives that vendor's pay-from account to the matching bank. */}
      <PaymentMethodModal
        open={!!cfgMethodVendor}
        onOpenChange={(o) => { if (!o) setCfgMethodVendor(null); }}
        value={cfgMethodVendor ? cfgFor(cfgMethodVendor).methodId : ''}
        methods={cfgMethodVendor ? vendorPaymentMethods(cfgMethodVendor) : []}
        vendorName={cfgMethodVendor ?? undefined}
        onApply={(id) => {
          if (!cfgMethodVendor) return;
          const picked = vendorPaymentMethods(cfgMethodVendor).find((m) => m.id === id);
          setVendorPayCfg((prev) => ({
            ...prev,
            [cfgMethodVendor]: { methodId: id, bankAccount: deriveAccountId(picked?.type, picked?.bankName) },
          }));
        }}
      />
      <PayFromAccountModal
        open={!!cfgAccountVendor}
        onOpenChange={(o) => { if (!o) setCfgAccountVendor(null); }}
        value={cfgAccountVendor ? cfgFor(cfgAccountVendor).bankAccount : PAY_FROM_ACCOUNTS[0].id}
        accounts={accountsForCurrency(PAY_FROM_ACCOUNTS, payCurrencyFor(cfgAccountVendor ?? undefined))}
        onApply={(id) => {
          if (!cfgAccountVendor) return;
          // Two-way link (Eli 9/8): the account pick re-derives the
          // vendor's method too, mirroring method → account.
          const derived = deriveMethodFromAccount(id, vendorPaymentMethods(cfgAccountVendor));
          setVendorPayCfg((prev) => ({
            ...prev,
            [cfgAccountVendor]: {
              methodId: derived?.id ?? cfgFor(cfgAccountVendor).methodId,
              bankAccount: id,
            },
          }));
        }}
      />

      {/* Bulk standardize pickers — generic method types (vendors differ),
          the full account list; Apply lives in the rail control. */}
      <PaymentMethodModal
        open={bulkMethodModalOpen}
        onOpenChange={setBulkMethodModalOpen}
        value={bulkMethodId}
        methods={genericPaymentMethods()}
        onApply={(id) => {
          setBulkMethodId(id);
          // The method drives the pay-from account (9/4/26 Eli, BB-28):
          // picking a method here re-derives the bulk account to one of
          // the method's class — "I shouldn't be able to select Chase
          // Bank ACH and then pull PNC distributions." The link was
          // one-way (account followed nothing) before this.
          const gm = genericPaymentMethods().find((m) => m.id === id);
          if (gm) setBulkAccountId(deriveAccountId(gm.type, gm.bankName));
        }}
      />
      <PayFromAccountModal
        open={bulkAccountModalOpen}
        onOpenChange={setBulkAccountModalOpen}
        value={bulkAccountId}
        // One account for every vendor: in their shared payment currency,
        // else only base-currency accounts fit them all.
        accounts={(() => {
          const curs = Array.from(new Set(selectedVendors.map((v) => payCurrencyFor(v))));
          return curs.length === 1 ? accountsForCurrency(PAY_FROM_ACCOUNTS, curs[0]) : PAY_FROM_ACCOUNTS.filter((a) => isBaseCurrency(a.currency));
        })()}
        onApply={(id) => {
          setBulkAccountId(id);
          // Two-way link (Eli 9/8): a bulk account of a different class
          // re-derives the bulk method, mirroring method → account. A ''
          // method (keep each vendor's own) only re-derives when the
          // current pick no longer fits the account.
          if (bulkMethodId) {
            const gm = genericPaymentMethods().find((m) => m.id === bulkMethodId);
            const acct = PAY_FROM_ACCOUNTS.find((a) => a.id === id);
            const fits = gm && acct && (accountTypeForMethod(gm.type) === 'any' || accountTypeForMethod(gm.type) === acct.type);
            if (!fits) {
              const derived = deriveMethodFromAccount(id, genericPaymentMethods());
              if (derived) setBulkMethodId(derived.id);
            }
          }
        }}
      />

      {/* ── "Other open invoices from this vendor" (9/4/26 Eli, BB-27) ──
          Searchable multi-select modal: checkbox + invoice number + amount
          per row, nothing more. Scales to the Fastenal case (20-30 open
          invoices) where the old inline dropdown broke. */}
      {addInvVendor && (() => {
        const row = baseRows.find((r) => r.vendor === addInvVendor);
        const addable = (row?.open ?? []).filter((inv) => !lineFor(inv).selected);
        const q = addInvSearch.trim().toLowerCase();
        const filtered = q ? addable.filter((inv) => inv.invoiceNumber.toLowerCase().includes(q)) : addable;
        const close = () => setAddInvVendor(null);
        return (
          <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] overflow-hidden border border-border flex flex-col max-h-[70vh] animate-in fade-in zoom-in-95 duration-200">
              <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>Other Open Invoices from {addInvVendor}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tick the invoices to add to this payment.</p>
                </div>
                <button onClick={close} className="p-1 rounded-md hover:bg-muted/60 text-slate-400 hover:text-foreground transition-colors cursor-pointer shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Toolbar band + table — the start-run modal recipe (user
                  10/8): slate toolbar carrying the search, then the listing
                  table with Amount due pinned to the right edge. */}
              <div className="px-4 py-2.5 bg-slate-50 border-y border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <Input
                    autoFocus
                    value={addInvSearch}
                    onChange={(e) => setAddInvSearch(e.target.value)}
                    placeholder="Search invoices..."
                    className="pl-9 pr-3 h-9 text-[12px] bg-white border-border rounded-lg shadow-sm placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {filtered.length === 0 ? (
                  <TableEmptyState
                    compact
                    kind={addable.length === 0 ? 'no-data' : 'no-results'}
                    entity={{ singular: 'invoice', plural: 'invoices' }}
                    title={addable.length === 0 ? 'No more open invoices' : undefined}
                    description={addable.length === 0 ? 'All open invoices for this vendor are already included.' : undefined}
                    searchQuery={addInvSearch}
                    suggestion={addable.length > 0 && addInvSearch.trim() ? findSearchSuggestion(addInvSearch, addable.flatMap((i) => [i.invoiceNumber, i.vendorInvoiceNumber])) : null}
                    onApplySuggestion={setAddInvSearch}
                    onClearSearch={() => setAddInvSearch('')}
                  />
                ) : (
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50/80 border-b border-slate-100 sticky top-0 z-10">
                      <tr>
                        <th className="w-9 pl-4 pr-1 py-2">
                          {/* Select all (BA 9/6) — tri-state over the FILTERED
                              list, so search + select-all picks what's shown. */}
                          <Checkbox
                            checked={
                              filtered.every((inv) => addInvPicked.has(inv.id))
                                ? true
                                : filtered.some((inv) => addInvPicked.has(inv.id))
                                  ? 'indeterminate'
                                  : false
                            }
                            onCheckedChange={() =>
                              setAddInvPicked((prev) => {
                                const next = new Set(prev);
                                const allPicked = filtered.every((inv) => next.has(inv.id));
                                filtered.forEach((inv) => {
                                  if (allPicked) next.delete(inv.id);
                                  else next.add(inv.id);
                                });
                                return next;
                              })
                            }
                            aria-label="Select all listed invoices"
                            className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-white"
                          />
                        </th>
                        <th className="text-left px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Invoice ID</th>
                        <th className="text-left px-3 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Due Date</th>
                        <th className="text-right px-3 pr-4 py-2 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>Amount Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.map((inv) => {
                        const picked = addInvPicked.has(inv.id);
                        return (
                          <tr
                            key={inv.id}
                            onClick={() =>
                              setAddInvPicked((prev) => {
                                const next = new Set(prev);
                                if (next.has(inv.id)) next.delete(inv.id);
                                else next.add(inv.id);
                                return next;
                              })
                            }
                            className={`cursor-pointer transition-colors ${picked ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-[#F8FAFF]'}`}
                          >
                            <td className="pl-4 pr-1 py-2" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={picked}
                                onCheckedChange={() =>
                                  setAddInvPicked((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(inv.id)) next.delete(inv.id);
                                    else next.add(inv.id);
                                    return next;
                                  })
                                }
                                aria-label={`Add ${inv.invoiceNumber}`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              {/* Invoice numbers are links everywhere in the
                                  system (user 9/22): hover blue + underline,
                                  opens the invoice in a new tab. */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  window.open(`/invoices/${inv.invoiceNumber}`, '_blank', 'noopener,noreferrer');
                                }}
                                className="text-[12px] text-foreground hover:text-primary hover:underline cursor-pointer p-0 bg-transparent border-0"
                                style={{ fontWeight: 600 }}
                                title={`Open ${inv.invoiceNumber} in a new tab`}
                              >
                                {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                                {highlightText(inv.invoiceNumber, addInvSearch)}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{humanDate(inv.dueDate)}</td>
                            <td className="px-3 pr-4 py-2 text-right text-foreground" style={{ fontWeight: 600 }}>{fmt(inv.outstandingBalance)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {/* Footer readout — the start-run counts + total, bottom-left. */}
              {addInvPicked.size > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{addInvPicked.size}</span>
                  {` invoice${addInvPicked.size === 1 ? '' : 's'} · `}
                  <span className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>
                    {fmt(addable.filter((inv) => addInvPicked.has(inv.id)).reduce((s, inv) => s + inv.outstandingBalance, 0))}
                  </span>
                </div>
              )}
              <div className="px-4 py-3 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    if (addInvPicked.size === 0) {
                      toast.error('Pick an invoice first', { description: 'Check at least one invoice to add it to this payment.' });
                      return;
                    }
                    addable.filter((inv) => addInvPicked.has(inv.id)).forEach((inv) =>
                      setLine(inv.id, { selected: true, amount: 0 }, inv),
                    );
                    toast.success(`${addInvPicked.size} invoice${addInvPicked.size === 1 ? '' : 's'} added to this payment`);
                    close();
                  }}
                  className="w-full h-10 rounded-xl text-[13px] text-white bg-primary hover:bg-primary/90 transition-colors cursor-pointer"
                  style={{ fontWeight: 600 }}
                >
                  {addInvPicked.size > 0 ? `Add ${addInvPicked.size} Invoice${addInvPicked.size === 1 ? '' : 's'}` : 'Add Invoices'}
                </button>
                {/* "Add an invoice" (Eli 7/22/26) — a link that opens
                    pre-invoice creation in a new tab, pre-populated for
                    this vendor; never a nested creation flow in payments. */}
                <button
                  type="button"
                  onClick={() => window.open(`/invoices?create=pre-invoice&vendor=${encodeURIComponent(addInvVendor)}`, '_blank', 'noopener')}
                  className="w-full h-8 rounded-lg text-[11px] text-primary bg-white border border-border hover:bg-slate-50 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                  style={{ fontWeight: 500 }}
                >
                  <Plus className="w-3 h-3" />
                  Create a Pre-Invoice for {addInvVendor}
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* A/P account GL configuration (pay mode) — same picker + catalogue the
          invoicing create flow uses, defaulted from the vendor's category. */}
      <GLAccountConfigModal
        open={apModalOpen}
        onOpenChange={setApModalOpen}
        value={apAccount}
        defaultValue={apDefault}
        title="A/P Account"
        subtitle="The Accounts Payable liability this payment clears. Defaults from the vendor's profile, change only if needed."
        accountList={AP_ACCOUNTS}
        onApply={setApAccount}
      />

      {/* ── Check print flow (BA spec 9/22): preview the real PDF at
          100%, then the blocking confirm — on "yes, all printed" the
          issued number becomes the reference and the payment records. ── */}
      <CheckPrintFlow
        open={checkPrintOpen}
        onOpenChange={(o) => {
          setCheckPrintOpen(o);
          if (!o && postRecordPrintRef.current) {
            // Post-record print closed, printed or not (user 10/15): back
            // to the success modal, which stays until the user closes it.
            postRecordPrintRef.current = null;
            setPostPrintBank(null);
            return;
          }
          // Closing without printing returns to the payment form (user
          // 10/15: reopening the confirm read as a glitch). The confirm is
          // one Record click away.
        }}
        bankAccountId={postPrintBank ?? bankAccount}
        bankAccountLabel={(() => {
          const id = postPrintBank ?? bankAccount;
          return PAY_FROM_ACCOUNTS.find((a) => a.id === id)?.label ?? id;
        })()}
        payments={checkInputs}
        recordedAlready={!!postPrintBank}
        onIssued={(issued) => {
          const n = issued[0]?.checkNumbers[0];
          const postRecords = postRecordPrintRef.current;
          if (postRecords) {
            // The payments already posted (10/5 spec step 6): the print
            // only updates each check trail and reference.
            issued.forEach((iss) => {
              const rec = postRecords.find((r) => r.paymentNumber === iss.paymentRef);
              if (!rec) return;
              if (iss.checkNumbers[0]) rec.reference = String(iss.checkNumbers[0]);
              rec.checkPrint = { status: 'printed', by: 'Ahtisham Ahmad', at: localTodayIso() };
            });
            // The flow closes itself next; its onOpenChange lands on the
            // payment (never back on the record confirm).
            return;
          }
          if (n) setReference(String(n));
          // The blocking confirm just verified the print (Eli 9/25) — the
          // record built below carries the printed-by trail.
          printedViaFlowRef.current = true;
          setCheckPrintOpen(false);
          setConfirmOpen(false);
          // Record with the LATEST closure so the new reference lands on
          // the payment (spec §8.13: confirming the run posts).
          setTimeout(() => buildAndCompleteRef.current(false), 50);
        }}
      />

      {/* ── Payment recorded (user 10/15): ONE modal for the success, the
          check print choice and the remittance advice, replacing the
          recorded screen + stacked print prompt. It stays open through
          printing (closing the preview returns here) and only the user
          closes it, landing on the payment detail page. ── */}
      {successRecords && !checkPrintOpen && !manualCheckFor && (() => {
        const recs = successRecords;
        const single = recs.length === 1 ? recs[0] : null;
        const total = Math.round(recs.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
        const checks = recs.filter((r) => r.paymentMethod === 'Check');
        const unprinted = checks.filter((r) => !r.checkPrint);
        const done = checks.filter((r) => r.checkPrint);
        const isScheduled = recs.every((r) => r.status === 'Scheduled');
        const noun = recs[0]?.type === 'Prepayment' ? 'Prepayment' : 'Payment';
        const bankLabel = (id: string) => PAY_FROM_ACCOUNTS.find((a) => a.id === id)?.label ?? id;
        const printBank = unprinted[0]?.bankAccount;
        const nextNo = printBank ? checkSettingsFor(printBank).nextCheckNumber : null;
        const subline = single
          ? [single.paymentNumber, single.paymentMethod, formatUsDate(single.paymentDate)].join(' · ')
          : `${recs.length} payments · ${formatUsDate(recs[0]?.paymentDate ?? '')}`;
        const fresh = Date.now() - successShownAtRef.current < 1500;
        const stock = printBank ? STOCK_PROFILES[checkSettingsFor(printBank).style].displayName : '';
        // Inline CTA inside an alert box: the pre-record print card recipe.
        const boxBtn = 'h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-foreground hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5';
        // Every secondary action wears the Print later chrome.
        const softBtn = 'w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100';
        return (
          <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150">
            {/* Running tick (user 10/15): inside the standard icon tile, the
                ring runs round once, then the tick marks itself done. */}
            <style>{`
              @keyframes omne-ok-run { to { stroke-dashoffset: 0 } }
              @keyframes omne-ok-fade { to { opacity: 0.25 } }
              .omne-ok-static * { animation: none !important; stroke-dashoffset: 0 !important }
              .omne-ok-static .omne-ok-ring { opacity: 0.25 }
              @media (prefers-reduced-motion: reduce) { .omne-ok-anim * { animation: none !important; stroke-dashoffset: 0 !important } .omne-ok-anim .omne-ok-ring { opacity: 0.25 } }
            `}</style>
            <div
              className="relative bg-white w-full sm:max-w-[420px] max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
              style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            >
              <button
                type="button"
                onClick={finishSuccess}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div
                className="relative flex flex-col items-center pt-7 pb-3 shrink-0"
                style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(236,253,245,0.3) 70%, transparent 100%)' }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#059669', filter: 'blur(50px)' }} />
                <div
                  className={`relative w-14 h-14 rounded-2xl flex items-center justify-center ${fresh ? 'omne-ok-anim' : 'omne-ok-static'}`}
                  style={{ backgroundColor: '#D1FAE5' }}
                >
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="#047857" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle
                      className="omne-ok-ring"
                      cx="12" cy="12" r="10"
                      transform="rotate(-90 12 12)"
                      style={{ strokeDasharray: 63, strokeDashoffset: 63, animation: 'omne-ok-run 650ms ease-in-out forwards' }}
                    />
                    <path
                      d="M8 12.5l2.8 2.8L16.5 9.5"
                      style={{ strokeDasharray: 14, strokeDashoffset: 14, animation: 'omne-ok-run 320ms ease-out 620ms forwards' }}
                    />
                  </svg>
                </div>
                <span className="mt-2.5 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857' }}>
                  {isScheduled ? `${noun} Scheduled` : `${noun} Recorded`}
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-6 pb-6 min-h-0 overflow-y-auto">
                <h3 className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                  {single
                    ? `${fmtRecordsTotal(recs)} ${isScheduled ? 'scheduled' : 'paid'} to ${single.vendor}`
                    : `${recs.length} payments recorded for ${fmtRecordsTotal(recs)}`}
                </h3>
                <p className="text-[12px] text-slate-500 mt-1">{subline}</p>
                <div className="w-full mt-4 space-y-2 text-left">
                  {unprinted.length > 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3 py-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Printer className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                          {unprinted.length === 1 ? `Check ${nextNo} · ${stock}` : `${unprinted.length} checks from ${nextNo}`}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{bankLabel(printBank!)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // Built from the SAVED records (user 10/15): the
                          // form's invoices already read paid. One pay-from
                          // account's stock per print.
                          const group = unprinted.filter((r) => r.bankAccount === printBank);
                          postRecordPrintRef.current = group;
                          setPostPrintBank(printBank!);
                          setCheckInputs(group.map(checkInputForPayment));
                          setCheckPrintOpen(true);
                        }}
                        className={boxBtn}
                        style={{ fontWeight: 600 }}
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-400" />
                        {unprinted.length === 1 ? 'Print Check' : 'Print Checks'}
                      </button>
                    </div>
                  ) : done.length > 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white border border-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-[12px] text-emerald-800 min-w-0" style={{ fontWeight: 500 }}>
                        {done.length === 1
                          ? `Check ${done[0].reference || ''} ${done[0].checkPrint?.status === 'manual' ? 'logged as written by hand' : 'printed'}.`
                          : `${done.length} checks printed.`}
                      </p>
                    </div>
                  ) : null}
                  {/* Remittance advice (the old recorded screen's action),
                      in the same alert-box recipe: one PDF per payment. */}
                  <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3 py-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Remittance Advice</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {recs.length === 1 ? 'PDF for the vendor, listing what this pays.' : `${recs.length} PDFs, one per payment.`}
                      </p>
                    </div>
                    <button type="button" onClick={() => recs.forEach(downloadRemittanceFor)} className={boxBtn} style={{ fontWeight: 600 }}>
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      Download
                    </button>
                  </div>
                </div>
                <div className="w-full mt-4 flex flex-col gap-2">
                  {unprinted.length > 0 ? (
                    <div className={`grid gap-2 ${single ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <button type="button" onClick={finishSuccess} className={softBtn} style={{ fontWeight: 500, color: '#334155' }}>
                        Print Later
                      </button>
                      {single && (
                        <button type="button" onClick={() => setManualCheckFor(single)} className={softBtn} style={{ fontWeight: 500, color: '#334155' }}>
                          Manual Check
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={finishSuccess}
                      className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
                      style={{ fontWeight: 600, backgroundColor: '#059669' }}
                    >
                      {single ? `View ${noun}` : 'Done'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Step 8 (10/5 spec): manual check, the shared modal. Logging
          returns to the success modal (user 10/15). ── */}
      <ManualCheckModal payment={manualCheckFor} onClose={() => setManualCheckFor(null)} />

      {/* ── Discard confirmation, back/cancel with unsaved selections ── */}
      {/* ── Overdraw acknowledgment (Eli 7/24/26) — recording more than the
          available cash can bounce payments; the user must consciously
          proceed. Amber gradient hero, never blocks. ── */}
      {overdrawAckOpen && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150"
          onClick={() => setOverdrawAckOpen(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[440px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF3C7 0%, rgba(254,243,199,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#B45309', filter: 'blur(50px)' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FDE68A' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: '#B45309' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF9C3', color: '#92400E',  }}>
                Warning
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                Record more than the available cash?
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '340px' }}>
                You are about to record {mode === 'prepay' ? 'a prepayment' : grand.records === 1 ? 'a payment' : 'payments'} of{' '}
                <span className="text-foreground " style={{ fontWeight: 700 }}>{grandPayText()}</span>, which exceeds the available cash in{' '}
                <span className="text-foreground" style={{ fontWeight: 600 }}>{isMultiVendorPay ? 'one of the pay-from accounts' : bank ? bank.label : 'the pay-from account'}</span>.
                {' '}Proceeding can bounce payments if the account is not funded in time.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => { setOverdrawAckOpen(false); setConfirmOpen(true); }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: '#B45309', color: '#fff' }}
                >
                  I Understand, Proceed
                </button>
                <button
                  type="button"
                  onClick={() => setOverdrawAckOpen(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove-from-payment confirm (user 9/26): the creation form's
          red prompt, single and bulk — nothing leaves the table silently. ── */}
      {removePrompt && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150"
          onClick={() => setRemovePrompt(null)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444', filter: 'blur(50px)' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                {removePrompt.ids.length === 1 ? 'Remove Invoice' : 'Remove Invoices'}
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {removePrompt.ids.length === 1
                  ? `Remove ${removePrompt.label ?? 'this invoice'}?`
                  : `Remove ${removePrompt.ids.length} ${removePrompt.kind === 'prepay' ? 'pre-invoices' : 'invoices'}?`}
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
                {removePrompt.kind === 'pay'
                  ? `${removePrompt.ids.length === 1 ? 'The invoice leaves' : 'The invoices leave'} this payment only. ${removePrompt.ids.length === 1 ? 'Its balance stays' : 'Their balances stay'} payable and nothing posts.`
                  : `${removePrompt.ids.length === 1 ? 'The pre-invoice leaves' : 'The pre-invoices leave'} this prepayment only. ${removePrompt.ids.length === 1 ? 'It stays' : 'They stay'} open to prepay later.`}
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={confirmRemovePrompt}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  {removePrompt.ids.length === 1 ? 'Yes, Remove It' : 'Yes, Remove Them'}
                </button>
                <button
                  type="button"
                  onClick={() => setRemovePrompt(null)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  {removePrompt.ids.length === 1
                    ? removePrompt.kind === 'prepay' ? 'Keep It on the Prepayment' : 'Keep It on the Payment'
                    : removePrompt.kind === 'prepay' ? 'Keep Them on the Prepayment' : 'Keep Them on the Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150"
          onClick={() => setShowDiscardConfirm(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Colored glow header — gradient confirm recipe, matching the
                other discard modals (restored 7/15/26). */}
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444', filter: 'blur(50px)' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B',  }}>
                {discardVariant === 'step1' || discardVariant === 'choose' ? 'Go Back' : 'Discard'}
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {discardVariant === 'choose'
                  ? 'Go back to payment type?'
                  : discardVariant === 'step1'
                    ? 'Go back to selection?'
                    : `Discard this ${mode === 'prepay' ? 'prepayment' : 'payment'}?`}
              </h3>
              <p className="text-[13px] mt-2 mx-auto" style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}>
                {discardVariant === 'choose'
                  ? "You'll return to the payment type choice. Your entered details are kept."
                  : discardVariant === 'step1'
                    ? "You'll return to vendor and invoice selection. Your entered details are kept."
                    : mode === 'prepay'
                      ? 'The selected vendor and advance details will be cleared. This action cannot be undone.'
                      : 'The selected vendors and invoice allocations will be cleared. This action cannot be undone.'}
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={confirmDiscard}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  {discardVariant === 'step1' || discardVariant === 'choose' ? 'Go Back' : 'Discard Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                >
                  Continue Editing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
