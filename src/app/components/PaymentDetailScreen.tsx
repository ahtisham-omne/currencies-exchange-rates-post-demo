import { TableEmptyState } from '@/app/components/ui/table-empty-state';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Ban,
  ArrowLeftRight,
  DollarSign,
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
  BookOpen,
  Banknote,
  Wallet,
  Landmark,
  Receipt,
  Clock,
  Calendar,
  Check,
  FileText,
  Maximize2,
  Minimize2,
  Link2,
  Truck,
  Info,
  Printer,
  PenLine,
  StickyNote,
  MessageSquare,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { VendorQuickCard, PO_EXTERNAL_URL } from './InvoiceDataTable';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import { PhotoPersonAvatar } from '@/app/components/data-table';
import { paymentStatusLabel } from './PaymentDataTable';
import { AttachmentsTab } from './invoice-details/AttachmentsTab';
import { ComingSoonTab } from './invoice-details/ComingSoonTab';
import { NotesTab, type InvoiceNote } from './invoice-details/NotesTab';
import { mockVendors, partnerVendorUrl } from '@/app/data/mockVendors';
import { type Payment, PAY_FROM_ACCOUNTS, paymentStatusAxis, paymentApplicationAxis } from '@/app/data/mockPayments';
import { splitAccount } from '@/app/lib/glPosting';
import { DEFAULT_PREPAYMENT_ASSET_ACCOUNT } from '@/app/data/glAccounts';
import { ReversePaymentModal, type PaymentRecord } from './invoice-details/ReversePaymentModal';
import { InvoiceReasonDialog } from './InvoiceReasonDialog';
import { paymentVoidOverride, voidEffectText } from './payments/paymentReasonConfigs';
import { CheckPrintFlow } from '@/app/components/payments/CheckPrintFlow';
import { voidCheck, checkSettingsFor, checkInputForPayment } from '@/app/lib/checkPrinting';
import type { Invoice } from '@/app/data/mockInvoices';
import { actionToneClass, type ActionTone } from '@/app/lib/actionMenuTone';
import { downloadRemittanceAdvice } from '@/app/lib/remittanceAdvice';
import { localTodayIso } from '@/app/lib/dueBucket';
import { palette } from '@/styles/tokens';
import { CollapseReveal } from '@/app/components/ui/collapse-reveal';
import { SegmentedCountPill } from '@/app/components/SegmentedCountPill';

// Payment detail — PRD §9. Redesigned to share the InvoiceDetailScreen
// design language so the two record pages read as one product: a
// sticky morphing status-tinted header card, a lifecycle workflow
// ladder, a tab bar, and a body with left tab-content + a sticky
// collapsible right sidebar.

const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Status palette ────────────────────────────────────────────────
// Mirrors PAYMENT_STATUS_STYLES in PaymentDataTable.tsx (so the listing
// pill and the detail pill are identical) but reshaped to the
// {bg,color,border} contract the invoice header gradient + workflow
// ladder consume.
const STATUS_PALETTE: Record<string, { bg: string; color: string; border: string }> = {
  Scheduled: { bg: palette.blue[50], color: palette.blue[700], border: palette.blue[200] },
  Paid: { bg: palette.emerald[100], color: palette.emerald[800], border: palette.emerald[300] },
  Cancelled: { bg: palette.red[50], color: palette.red[700], border: palette.red[200] },
  Unapplied: { bg: palette.amber[50], color: palette.amber[700], border: palette.amber[200] },
  'Partially Applied': { bg: palette.orange[50], color: palette.orange[700], border: palette.orange[200] },
  'Fully Applied': { bg: palette.emerald[50], color: palette.emerald[700], border: palette.emerald[200] },
  Reversed: { bg: palette.rose[50], color: palette.rose[700], border: palette.rose[200] },
};
const FALLBACK_PALETTE = { bg: palette.slate[100], color: palette.slate[600], border: palette.slate[300] };
const paletteFor = (s: string) => STATUS_PALETTE[s] ?? FALLBACK_PALETTE;

// Per-type tile / pill palette — same identity as the listing Type column
// (PaymentDataTable TYPE_CONFIG): Payment green / Banknote, Prepayment
// purple / Wallet.
const TYPE_META: Record<string, { icon: React.ElementType; label: string; bg: string; color: string; border: string }> = {
  Payment: { icon: Banknote, label: 'Payment', bg: palette.emerald[50], color: palette.emerald[700], border: palette.emerald[200] },
  Prepayment: { icon: Wallet, label: 'Prepayment', bg: palette.purple[50], color: palette.purple[700], border: palette.purple[200] },
};

// Status-tinted gradient header — soft status tint at the bottom edge
// (where the ladder / tab bar sit) fading to white moving up. Verbatim
// recipe from InvoiceDetailScreen.headerCardStyle.
function headerCardStyle(status: string): React.CSSProperties {
  const p = paletteFor(status);
  const softMix = `color-mix(in srgb, ${p.bg} 35%, white)`;
  return {
    background: `linear-gradient(to top, ${p.bg} 0%, ${softMix} 45%, #FFFFFF 90%)`,
    borderColor: p.border,
  };
}

// ── Tabs ──────────────────────────────────────────────────────────
type TabKey = 'applied' | 'gl-impact' | 'notes' | 'communication' | 'attachments' | 'activity';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'applied', label: 'Applied To' },
  { key: 'gl-impact', label: 'GL Impact' },
  // The four standard record tabs (10/1/26): every detail page in the
  // module carries Notes, Communication, Attachments, Recent Activity.
  { key: 'notes', label: 'Notes' },
  { key: 'communication', label: 'Communications' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'activity', label: 'Activity' },
];

// ── Workflow ladders (PRD lifecycle) ──────────────────────────────
//   Payment:    Scheduled → Paid
//   Prepayment: Unapplied → Partially applied → Fully applied
// Off-path terminal states (Failed/Returned, Void) render an appended
// aux chip, mirroring the invoice ladder's off-path handling.
const PAYMENT_LADDER: Array<{ status: string; icon: React.ElementType }> = [
  { status: 'Scheduled', icon: Calendar },
  { status: 'Paid', icon: Check },
];
const PREPAYMENT_LADDER: Array<{ status: string; icon: React.ElementType }> = [
  { status: 'Unapplied', icon: Wallet },
  { status: 'Partially Applied', icon: Banknote },
  { status: 'Fully Applied', icon: Check },
];

interface ActionDef {
  key: string;
  label: string;
  icon: React.ElementType;
  variant?: 'primary' | 'default' | 'destructive';
}

// Action-menu segregation (partner-style) — group the header Actions and render
// a divider between each group, priority top→bottom: forward-workflow (apply)
// → output → red "destructive" state-change pinned at the bottom.
type PaymentDetailCategory = 'primary' | 'workflow' | 'output' | 'destructive';

const PAYMENT_DETAIL_CATEGORY_ORDER: PaymentDetailCategory[] = ['primary', 'workflow', 'output', 'destructive'];

function paymentDetailCategory(key: string): PaymentDetailCategory {
  switch (key) {
    case 'apply':
    case 'markPaid':
      return 'workflow';
    case 'remittance':
    case 'print':
      return 'output';
    case 'void':
    case 'reverse':
      return 'destructive';
    default:
      return 'primary';
  }
}

function groupPaymentDetailActions(actions: ActionDef[]): ActionDef[][] {
  return PAYMENT_DETAIL_CATEGORY_ORDER
    .map((cat) => actions.filter((a) => paymentDetailCategory(a.key) === cat))
    .filter((group) => group.length > 0);
}

export function PaymentDetailScreen({
  payment,
  onClose,
  ledger = 'ap',
  invoices = [],
  onReversePayment,
  onVoidPayment,
  onMarkPaid,
  notes = [],
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}: {
  payment: Payment;
  onClose: () => void;
  /** 'ap' = vendor payment (cash out), 'ar' = customer payment received
   *  (cash in). Flips the GL journal direction (7/20/26). */
  ledger?: 'ap' | 'ar';
  /** Invoice context for the reversal dialog's after-reversal preview. */
  invoices?: Invoice[];
  /** Real reversal at App level (9/22/26 review response, GPT F48 and
   *  C09-X1): "Mark as reversed" performs the reversal, never a toast. */
  onReversePayment?: (args: { paymentReference: string; reason?: string }) => void;
  /** Void at App level (user 10/22/26), behind the invoice Cancel dialog. */
  onVoidPayment?: (paymentId: string, reason: string) => void;
  /** Mark as paid at App level: a scheduled payment completes, the
   *  listing's action verbatim (applied invoices settle now). */
  onMarkPaid?: (paymentId: string) => void;
  /** Notes for this payment (user 10/22/26), the invoice Notes tab. */
  notes?: InvoiceNote[];
  onAddNote?: (text: string) => void;
  onUpdateNote?: (noteId: string, text: string) => void;
  onDeleteNote?: (noteId: string) => void;
}) {
  const navigate = useNavigate();
  const [voidOpen, setVoidOpen] = useState(false);
  const isPrepay = payment.type === 'Prepayment';
  const bankCode = payment.bankAccount.split('-')[0];

  const [activeTab, setActiveTab] = useState<TabKey>('applied');
  const [reverseOpen, setReverseOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  // Check print surfaces (10/5 spec step 7): an Unprinted check prints
  // from here or logs as manual; a printed one can reprint (step 6).
  const [printFlowOpen, setPrintFlowOpen] = useState(false);

  // One CheckPaymentInput for THIS payment, from the saved record
  // (shared with the post-record print prompt).
  const [renderTick, bumpRender] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkInput = useMemo(() => checkInputForPayment(payment), [payment, renderTick]);

  // IntersectionObserver-driven header morph — sentinel sits just below
  // the topbar; the moment the page scrolls past it the header
  // collapses to compact. Same mechanism as InvoiceDetailScreen.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const vendorData = useMemo(
    () => mockVendors.find((v) => v.vendorName === payment.vendor) || null,
    [payment.vendor],
  );

  // GL lines for this record (PRD §7/§8 GL effects). The AR ledger runs
  // the mirror image: cash comes IN, so the bank line debits and the
  // receivable / deposit line credits (7/20/26).
  const glLines = useMemo(() => {
    // Records created this session carry the exact journal the
    // confirmation showed (lib/glPosting.ts snapshot) — including the
    // vendor-credit line the 9/20 reviews found dropped. Render it
    // verbatim; the synthesized entries below remain the seed fallback.
    if (payment.glEntries && payment.glEntries.length > 0) {
      return payment.glEntries.map((e) => ({
        code: e.accountCode,
        name: e.accountName,
        desc: e.description ?? '',
        debit: e.debit ?? 0,
        credit: e.credit ?? 0,
      }));
    }
    if (ledger === 'ar') {
      if (isPrepay) {
        return [
          { code: bankCode, name: `Bank · ${payment.bankAccount}`, desc: 'Cash in', debit: payment.amount, credit: 0 },
          { code: '2400', name: 'Customer Deposits', desc: `Advance from ${payment.vendor}`, debit: 0, credit: payment.amount },
        ];
      }
      return [
        { code: bankCode, name: `Bank · ${payment.bankAccount}`, desc: 'Cash in', debit: payment.amount, credit: 0 },
        { code: '1200', name: 'Accounts Receivable', desc: `Settles ${payment.appliedInvoices.length} invoice${payment.appliedInvoices.length === 1 ? '' : 's'}`, debit: 0, credit: payment.amount },
      ];
    }
    if (isPrepay) {
      // The record's own chosen asset account, never a hardcoded number
      // (9/22/26 review response, GPT F33: form said 1205, journal read
      // 1400) — seeds without one fall back to the configured default.
      const asset = splitAccount(payment.apAccount || DEFAULT_PREPAYMENT_ASSET_ACCOUNT);
      return [
        { code: asset.code, name: asset.name || 'Vendor Prepayments', desc: `Advance to ${payment.vendor}`, debit: payment.amount, credit: 0 },
        { code: bankCode, name: `Bank · ${payment.bankAccount}`, desc: 'Cash out', debit: 0, credit: payment.amount },
      ];
    }
    const ap = splitAccount(payment.apAccount || '2000 Accounts Payable');
    return [
      { code: ap.code, name: ap.name || 'Accounts Payable', desc: `Settles ${payment.appliedInvoices.length} invoice${payment.appliedInvoices.length === 1 ? '' : 's'}`, debit: payment.amount, credit: 0 },
      { code: bankCode, name: `Bank · ${payment.bankAccount}`, desc: 'Cash out', debit: 0, credit: payment.amount },
    ];
  }, [payment, isPrepay, bankCode, ledger]);
  const drTotal = glLines.reduce((s, l) => s + l.debit, 0);
  const crTotal = glLines.reduce((s, l) => s + l.credit, 0);

  const posted = ['Paid', 'Unapplied', 'Partially Applied', 'Fully Applied'].includes(payment.status);
  const failed = payment.status === 'Cancelled' || payment.status === 'Reversed';

  const status = payment.status;
  const statusPalette = paletteFor(status);
  const typeMeta = TYPE_META[payment.type] ?? TYPE_META.Payment;

  // ── Actions ──────────────────────────────────────────────────────
  const actions = useMemo<ActionDef[]>(() => {
    // Canonical payment actions (feedback 7/22/26), identical to the
    // listing three-dot menu: Download remittance advice, Mark as
    // reversed, Void payment. Assign Prepayment and Print were removed.
    const list: ActionDef[] = [];
    // Print later lands here (user 10/15): an unprinted check prints from
    // the header, not from the record-payment success screen.
    const unprintedCheck = payment.paymentMethod === 'Check' && (!payment.checkPrint || payment.checkPrint.status === 'void') && !failed;
    if (unprintedCheck) list.push({ key: 'print', label: 'Print Check', icon: Printer, variant: 'primary' });
    // "Log manual check" removed from payments (user 10/22/26): a manual
    // check is logged on the record-payment success screen or a run.
    // Mark as paid completes a scheduled payment (listing parity): it is
    // the next step, so it takes the primary slot while Scheduled.
    const scheduled = status === 'Scheduled' && !!onMarkPaid;
    if (scheduled) list.push({ key: 'markPaid', label: 'Mark as Paid', icon: CheckCircle2, variant: unprintedCheck ? undefined : 'primary' });
    list.push({ key: 'remittance', label: 'Download Remittance Advice', icon: Download, variant: unprintedCheck || scheduled ? undefined : 'primary' });
    // Reprint (10/5 spec step 6): a printed check lost or damaged later
    // voids its number and runs the print steps again.
    if (payment.paymentMethod === 'Check' && payment.checkPrint?.status === 'printed') {
      list.push({ key: 'reprint', label: 'Reprint Check', icon: Printer });
    }
    // Reversible once the money has gone out (a scheduled payment hasn't).
    const reversible = ['Paid', 'Unapplied', 'Partially Applied', 'Fully Applied'].includes(status);
    if (reversible) {
      list.push({ key: 'reverse', label: 'Mark as Reversed', icon: ArrowLeftRight, variant: 'destructive' });
    }
    if (!failed) {
      list.push({ key: 'void', label: 'Void Payment', icon: Ban, variant: 'destructive' });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failed, status, renderTick, onMarkPaid]);
  const primaryAction = actions.find((a) => a.variant === 'primary');

  const handleAction = (action: ActionDef) => {
    switch (action.key) {
      case 'remittance':
        // Prepayments carry no applied invoices, so an advance line
        // stands in for the invoice rows (feedback 7/21/26).
        downloadRemittanceAdvice(payment, payment.appliedInvoices.length === 0
          ? { lines: [{ invoiceNumber: payment.linkedPO ? `Advance on PO ${payment.linkedPO}` : 'On-account advance', paid: payment.amount }] }
          : undefined);
        toast.success('Remittance advice downloaded', { description: `${payment.paymentNumber}, saved as PDF.` });
        return;
      case 'reverse':
        // The real flow (9/22/26 review response): opens the reversal
        // dialog and performs the reversal at App level — the toast stub
        // both Sept 20 reviews flagged is dead.
        if (onReversePayment) {
          setReverseOpen(true);
        } else {
          toast.info('Mark as Reversed', { description: 'Reverses the GL and restores the applied balances.' });
        }
        return;
      case 'markPaid':
        if (onMarkPaid) onMarkPaid(payment.id);
        return;
      case 'void':
        // Confirms with the invoice Cancel dialog (user 10/22/26).
        setVoidOpen(true);
        return;
      case 'print':
        setPrintFlowOpen(true);
        return;
      case 'reprint': {
        // Reprint (10/5 step 6): void the old number as a reprint, then
        // run the print steps again. The payment stays Paid throughout.
        const oldNo = parseInt((payment.reference ?? '').replace(/\D/g, ''), 10);
        if (oldNo) voidCheck(payment.bankAccount, oldNo, 'reprint');
        payment.checkPrint = { status: 'void', by: 'Ahtisham Ahmad', at: localTodayIso() };
        bumpRender((n) => n + 1);
        toast.info(oldNo ? `Check ${oldNo} voided for reprint` : 'Reprinting check', {
          description: 'The number stays consumed on the register; the reprint issues a new one.',
        });
        setPrintFlowOpen(true);
        return;
      }
      default:
        toast.info(`${action.label}, coming next PR.`);
    }
  };

  // Header description sentence — mirrors the invoice header's row-2
  // narrative so both pages read the same way. Copy hygiene (9/22/26
  // review response, Claude C10-U2): a vendor name ending in "Co." never
  // doubles its full stop, an empty reference never prints "(ref )", and
  // the date reads "Sep 20, 2026", not raw ISO.
  const descriptionText = (() => {
    const endStop = (sentence: string) => (/[.!?]$/.test(sentence.trim()) ? sentence.trim() : `${sentence.trim()}.`);
    const prettyDate = (iso: string) =>
      new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const railClause = isPrepay
      ? `Advance ${ledger === 'ar' ? 'from' : 'to'} ${payment.vendor}${payment.linkedPO ? ` against PO ${payment.linkedPO}` : ', held as vendor credit'}`
      : `Settles ${payment.appliedInvoices.length} invoice${payment.appliedInvoices.length === 1 ? '' : 's'} for ${payment.vendor}`;
    // A reversed record never claims to be posted or pending (Eli 9/24
    // UX audit): the prose says what actually happened.
    const balanceClause = payment.status === 'Reversed'
      ? 'Reversed, the amounts returned to the invoices it covered'
      : isPrepay && payment.unappliedAmount > 0
        ? `${fmt(payment.unappliedAmount)} still available as unapplied credit`
        : posted ? 'Posted to the general ledger' : 'Not yet posted';
    const railAccount = isPrepay
      ? `Prepayment account ${payment.apAccount}`
      : `A/P account ${payment.apAccount}`;
    const refPart = payment.reference?.trim() ? ` (ref ${payment.reference.trim()})` : '';
    const movementClause = payment.status === 'Scheduled'
      ? `Scheduled to ${ledger === 'ar' ? 'receive' : 'pay'} ${payment.paymentMethod} ${ledger === 'ar' ? 'into' : 'from'} ${payment.bankAccount}${refPart} on ${prettyDate(payment.paymentDate)}`
      : payment.status === 'Reversed'
        ? `Was ${ledger === 'ar' ? 'received' : 'paid'} ${payment.paymentMethod} ${ledger === 'ar' ? 'into' : 'from'} ${payment.bankAccount}${refPart} on ${prettyDate(payment.paymentDate)}, then reversed`
        : `${ledger === 'ar' ? 'Received' : 'Paid'} ${payment.paymentMethod} ${ledger === 'ar' ? 'into' : 'from'} ${payment.bankAccount}${refPart} on ${prettyDate(payment.paymentDate)}`;
    return [railClause, movementClause, balanceClause, railAccount, `Created by ${payment.createdBy}`]
      .map(endStop)
      .join(' ');
  })();
  const descNeedsTruncation = descriptionText.length > 140;
  const [descExpanded, setDescExpanded] = useState(false);

  return (
    <div ref={scrollContainerRef} className="flex-1 flex flex-col bg-slate-50">
      {/* IntersectionObserver sentinel */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ══════════════════════════════════════════════
          STICKY MORPHING HEADER CARD
         ══════════════════════════════════════════════ */}
      {/* z-30 (user 9/29): DataTable sticky headers/frozen cells are z-20
          and painted over this header on scroll; the page header wins. */}
      <div className="shrink-0 sticky top-0 z-30 bg-slate-50">
        <div style={{ paddingTop: isScrolled ? '8px' : '12px', paddingBottom: '4px', transition: 'padding-top 250ms ease' }}>
          <div className={`mx-auto px-3 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${
                isScrolled
                  ? 'shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]'
                  : 'shadow-sm'
              }`}
              style={headerCardStyle(status)}
            >
              {/* Main header row */}
              <div
                className="flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-250 ease-in-out"
                style={{ padding: isScrolled ? '6px 16px' : '12px 16px' }}
              >
                {/* Left: Back + Tile + Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={onClose}
                    className="rounded-xl border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-all duration-250"
                    style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                    aria-label="Back to payments"
                  >
                    <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                  </button>

                  {/* Avatar tile — type-tinted (Payment blue / Prepayment indigo) */}
                  <div
                    className="rounded-xl flex items-center justify-center shrink-0 transition-all duration-250"
                    style={{
                      width: isScrolled ? 32 : 44,
                      height: isScrolled ? 32 : 44,
                      backgroundColor: typeMeta.bg,
                      border: `1px solid ${typeMeta.border}`,
                      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04)',
                    }}
                  >
                    <typeMeta.icon className="transition-all duration-250" style={{ width: isScrolled ? 14 : 18, height: isScrolled ? 14 : 18, color: typeMeta.color }} />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Line 1 — number + type + status + vendor link */}
                    <div className="flex items-center flex-wrap" style={{ gap: isScrolled ? 6 : 8 }}>
                      <h1
                        className="text-foreground truncate transition-all duration-250 "
                        style={{ fontSize: isScrolled ? 13 : 16, fontWeight: isScrolled ? 600 : 700, lineHeight: isScrolled ? '18px' : '22px' }}
                      >
                        {payment.paymentNumber}
                      </h1>

                      {/* Type pill */}
                      <span
                        className="inline-flex items-center gap-1 rounded-md border transition-all duration-250"
                        style={{
                          padding: isScrolled ? '1px 6px' : '2px 8px',
                          fontSize: isScrolled ? 10 : 11,
                          fontWeight: 600,
                          backgroundColor: typeMeta.bg,
                          color: typeMeta.color,
                          borderColor: typeMeta.border,
                        }}
                      >
                        <typeMeta.icon className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                        {typeMeta.label}
                      </span>

                      {/* Status pills — TWO axes (Eli review 7/15/26):
                          record status + application of funds, since a
                          scheduled payment can be unapplied. */}
                      {(() => {
                        const statusAxis = paymentStatusAxis(payment);
                        const applicationAxis = paymentApplicationAxis(payment);
                        const statusP = paletteFor(statusAxis);
                        const appP = paletteFor(applicationAxis);
                        const pillStyle = (p: { bg: string; color: string; border: string }) => ({
                          padding: isScrolled ? '1px 8px' : '2px 10px',
                          fontSize: isScrolled ? 10 : 11,
                          fontWeight: 600,
                          backgroundColor: p.bg,
                          color: p.color,
                          borderColor: p.border,
                        });
                        return (
                          <>
                            {/* A cancelled payment reads "Void", the
                                listing's word, and carries no funds axis
                                (user 10/22/26). */}
                            <span className="inline-flex items-center gap-1 rounded-full border transition-all duration-250" style={pillStyle(statusP)}>
                              {statusAxis === 'Cancelled' ? 'Void' : statusAxis}
                            </span>
                            {statusAxis !== 'Cancelled' && (
                              <span className="inline-flex items-center gap-1 rounded-full border transition-all duration-250" style={pillStyle(appP)}>
                                {applicationAxis}
                              </span>
                            )}
                          </>
                        );
                      })()}

                      {/* Vendor link — routes to Partners, with quick-card hover */}
                      <HoverCard openDelay={300} closeDelay={120}>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            onClick={() => navigate(`/partners/${encodeURIComponent(vendorData?.vendorCode ?? payment.vendor)}`)}
                            className="inline-flex items-center gap-1 rounded-md border bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 cursor-pointer"
                            style={{
                              padding: isScrolled ? '1px 6px' : '2px 8px',
                              fontSize: isScrolled ? 10 : 11,
                              fontWeight: 600,
                              color: 'hsl(var(--primary))',
                              borderColor: 'hsl(var(--border))',
                            }}
                            title={`Open ${payment.vendor} in Partners`}
                          >
                            <Truck className="transition-all duration-250" style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                            <span className="truncate max-w-[180px]">{payment.vendor}</span>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent
                          side="bottom"
                          align="start"
                          sideOffset={6}
                          className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <VendorQuickCard vendor={payment.vendor} description={payment.memo} />
                        </HoverCardContent>
                      </HoverCard>

                      {!isScrolled && payment.linkedPO && (
                        /* PO number is a link (user 10/5): black at rest,
                           blue + underline on hover, opens the procurement
                           module in a new tab. */
                        <SegmentedCountPill
                          segments={['Linked PO', payment.linkedPO]}
                          icon={Link2}
                          onClick={() => window.open(PO_EXTERNAL_URL, '_blank', 'noopener')}
                          title="Open the purchase order"
                        />
                      )}
                    </div>

                    {/* Row 2 — description with show more/less */}
                    <div
                      className="overflow-hidden transition-all duration-250 ease-in-out max-w-3xl relative"
                      style={{
                        maxHeight: isScrolled ? 0 : descExpanded ? 500 : 20,
                        opacity: isScrolled ? 0 : 1,
                        marginTop: isScrolled ? 0 : 4,
                      }}
                    >
                      <p className="text-[12px] text-slate-500 leading-[1.6]">
                        {descExpanded || !descNeedsTruncation ? descriptionText : `${descriptionText.slice(0, 140)}…`}
                        {descExpanded && descNeedsTruncation && (
                          <>
                            {' '}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDescExpanded(false); }}
                              className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer align-baseline"
                              style={{ fontWeight: 500 }}
                            >
                              Show less <ChevronUp className="w-3 h-3 inline" />
                            </button>
                          </>
                        )}
                      </p>
                      {!descExpanded && descNeedsTruncation && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDescExpanded(true); }}
                          className="absolute right-0 bottom-0 bg-gradient-to-l from-white via-white to-transparent pl-6 pr-0 inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer"
                          style={{ fontWeight: 500, lineHeight: '20px' }}
                        >
                          more <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Fullscreen + Actions + primary CTA */}
                <div className="flex items-center shrink-0 transition-all duration-250" style={{ gap: isScrolled ? 6 : 8 }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-250"
                        style={{ width: isScrolled ? 32 : 36, height: isScrolled ? 32 : 36 }}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        ) : (
                          <Maximize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[300]">{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]'}`}
                        style={{ fontWeight: 500 }}
                      >
                        Actions
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[200] w-56">
                      {groupPaymentDetailActions(actions).map((group, gi) => (
                        <React.Fragment key={gi}>
                          {gi > 0 && <DropdownMenuSeparator />}
                          {group.map((action) => {
                            const cat = paymentDetailCategory(action.key);
                            const tone: ActionTone =
                              cat === 'destructive'
                                ? 'destructive'
                                : action.key === 'apply'
                                  ? 'positive'
                                  : 'neutral';
                            const cls = actionToneClass(tone);
                            return (
                              <DropdownMenuItem
                                key={action.key}
                                onClick={() => handleAction(action)}
                                className={cls.item}
                              >
                                <action.icon className={`w-4 h-4 mr-2 ${cls.icon}`} />
                                {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {primaryAction ? (
                    <button
                      onClick={() => handleAction(primaryAction)}
                      // CTA takes the status color it acts on (design feedback
                      // 7/8/26): Assign Prepayment is yellow like the
                      // Unapplied pill; everything else stays primary blue.
                      className={`rounded-lg ${primaryAction.key === 'apply' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-[#0862D0]'} text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                      style={{ fontWeight: 600 }}
                    >
                      <primaryAction.icon className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                      {primaryAction.label}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction({ key: 'remittance', label: 'Remittance Advice', icon: Download })}
                      className={`rounded-lg bg-primary hover:bg-[#0862D0] text-white inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3.5 text-[12px]' : 'h-9 px-4 text-[13px]'}`}
                      style={{ fontWeight: 600 }}
                    >
                      <Download className={isScrolled ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                      Remittance Advice
                    </button>
                  )}
                </div>
              </div>

              {/* Workflow ladder — hidden in compact mode. */}
              <div
                className="overflow-hidden transition-all duration-250 ease-in-out border-t border-muted"
                style={{ maxHeight: isScrolled ? 0 : 80, opacity: isScrolled ? 0 : 1 }}
              >
                <PaymentWorkflowBar payment={payment} />
              </div>

              {/* Tab bar — always visible */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 px-3.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                        isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                      }`}
                      style={{
                        padding: isScrolled ? '8px 14px' : '10px 14px',
                        fontSize: isScrolled ? 12 : 13,
                        fontWeight: isActive ? 600 : 400,
                        transition: 'padding 250ms ease, font-size 250ms ease',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        {/* Bottom gradient fade */}
        <div
          className="pointer-events-none transition-opacity duration-300"
          style={{
            height: 8,
            background: 'linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)',
            opacity: isScrolled ? 1 : 0,
          }}
        />
      </div>

      {/* ── Scroll to top FAB ── */}
      <button
        onClick={() => {
          let el: HTMLElement | null = scrollContainerRef.current;
          while (el) {
            const s = window.getComputedStyle(el);
            if (s.overflowY === 'auto' || s.overflowY === 'scroll') break;
            el = el.parentElement;
          }
          (el || window).scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white border border-border shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12),0_4px_16px_-4px_rgba(0,0,0,0.08)] flex items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] active:scale-95 transition-all duration-300"
        style={{
          width: 40,
          height: 40,
          opacity: isScrolled ? 1 : 0,
          transform: isScrolled ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.9)',
          pointerEvents: isScrolled ? 'auto' : 'none',
        }}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5 text-slate-500" />
      </button>

      {/* ══════════════════════════════════════════════
          BODY
         ══════════════════════════════════════════════ */}
      <div className="flex-1">
        <div className={`mx-auto px-3 pt-3 pb-3 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
          <div className="flex gap-4 items-start">
            {/* ── LEFT: tab content ── */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Reversal story (meeting feedback 7/17/26): the detail page
                  tells the whole story without going back to the invoice —
                  what was reversed, where the money went, what reopened. */}
              {payment.status === 'Reversed' && (
                <div className="rounded-xl border bg-white px-4 py-3 flex items-start gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]" style={{ borderColor: '#FECDD3' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#FFF1F2' }}>
                    <AlertTriangle className="w-4 h-4" style={{ color: '#BE123C' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground" style={{ fontWeight: 700 }}>
                      This {isPrepay ? 'prepayment' : 'payment'} was reversed
                    </p>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                      {fmt(payment.amount)} returned to {payment.bankAccount} via {payment.paymentMethod}
                      {payment.reference ? ` (ref ${payment.reference})` : ''}.
                      {payment.appliedInvoices.length > 0
                        ? ` The ${payment.appliedInvoices.length === 1 ? 'invoice it settled reopened' : `${payment.appliedInvoices.length} invoices it settled reopened`} for the reversed amount: ${payment.appliedInvoices.map((a) => a.invoiceNumber).join(', ')}.`
                        : ' Nothing was applied, so no invoice balances changed.'}
                      {' '}The original GL posting was backed out on the reversal date.
                    </p>
                  </div>
                </div>
              )}
              {activeTab === 'applied' && <AppliedToCard payment={payment} isPrepay={isPrepay} />}
              {activeTab === 'gl-impact' && (
                <GLImpactCard glLines={glLines} drTotal={drTotal} crTotal={crTotal} posted={posted} failed={failed} isPrepay={isPrepay} ledger={ledger} />
              )}
              {/* The invoice Notes tab (user 10/22/26), notes kept in App
                  state per payment like invoice notes. */}
              {activeTab === 'notes' && (
                <NotesTab
                  notes={notes}
                  onAddNote={(text) => onAddNote?.(text)}
                  onUpdateNote={(noteId, text) => onUpdateNote?.(noteId, text)}
                  onDeleteNote={(noteId) => onDeleteNote?.(noteId)}
                  recordNoun="payment"
                />
              )}
              {activeTab === 'communication' && (
                <ComingSoonTab
                  label="Communication"
                  icon={MessageSquare}
                  description="Message history for this payment, with your team and the vendor, will live here. The shared communication surface keeps every conversation attached to the record it is about."
                />
              )}
              {activeTab === 'attachments' && <AttachmentsTab payment={payment} />}
              {activeTab === 'activity' && (
                <ComingSoonTab
                  label="Recent Activity"
                  icon={History}
                  description="A chronological audit trail of every action on this payment: scheduling, posting, reversals, and settlement. The activity feed arrives with backend integration."
                />
              )}
            </div>

            {/* ── RIGHT: sticky sidebar ── */}
            <PaymentDetailSidebar
              payment={payment}
              isPrepay={isPrepay}
              status={status}
              statusPalette={statusPalette}
              onPrintCheck={payment.paymentMethod === 'Check' && !payment.checkPrint ? () => setPrintFlowOpen(true) : undefined}
            />
          </div>
        </div>
      </div>

      {/* Void payment — the invoice Cancel dialog (user 10/22/26). */}
      <InvoiceReasonDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        action="cancel"
        count={1}
        configOverride={paymentVoidOverride([payment])}
        onConfirm={(reason) => {
          setVoidOpen(false);
          if (onVoidPayment) {
            onVoidPayment(payment.id, reason);
            toast.success(`${payment.paymentNumber} voided`, { description: voidEffectText([payment]) });
          }
        }}
      />
      {/* Mark as reversed — the REAL flow (9/22/26 review response):
          same dialog the invoice page uses, wired to the App-level
          payment-centric reversal. */}
      {onReversePayment && (() => {
        const primaryInvoiceNumber = payment.appliedInvoices[0]?.invoiceNumber ?? payment.preInvoiceId ?? '';
        const primaryInvoice = invoices.find((i) => i.invoiceNumber === primaryInvoiceNumber || i.id === primaryInvoiceNumber);
        const record: PaymentRecord = {
          id: payment.id,
          reference: payment.paymentNumber,
          paymentNumber: payment.paymentNumber,
          date: payment.paymentDate,
          amount: payment.amount,
          bankAccount: payment.bankAccount,
          apAccount: payment.apAccount,
          glEntries: payment.glEntries,
          appliedCreditTotal: Math.round(((payment.appliedCredits ?? []).reduce((s, c) => s + c.amount, 0)) * 100) / 100,
          appliedTo: (payment.perInvoiceSplit && payment.perInvoiceSplit.length > 0
            ? payment.perInvoiceSplit.map((s) => ({ invoiceNumber: s.invoiceNumber, applied: Math.round((s.cash + s.credit) * 100) / 100 }))
            : payment.appliedInvoices.map((a) => ({ invoiceNumber: a.invoiceNumber, applied: a.amount }))
          ).map((row) => ({
            ...row,
            outstanding: invoices.find((i) => i.invoiceNumber === row.invoiceNumber)?.outstandingBalance ?? 0,
          })),
        };
        return (
          <ReversePaymentModal
            open={reverseOpen}
            onOpenChange={setReverseOpen}
            invoiceNumber={primaryInvoice?.invoiceNumber ?? primaryInvoiceNumber}
            vendorName={payment.vendor}
            outstandingBalance={primaryInvoice?.outstandingBalance ?? 0}
            totalAmount={primaryInvoice?.amount ?? payment.amount}
            currency={payment.currency}
            payments={[record]}
            entity={isPrepay ? 'prepayment' : 'payment'}
            initialPaymentId={payment.id}
            onSubmit={(payload) => {
              onReversePayment({ paymentReference: payload.paymentReference, reason: payload.reason });
              toast.success(`${isPrepay ? 'Prepayment' : 'Payment'} ${payload.paymentReference} reversed`, {
                description: `${payload.reason} · every invoice it covered is restored.`,
              });
            }}
          />
        );
      })()}

      {/* Print check (10/5 spec steps 3-6, reprint path): runs the full
          review → preview → confirm flow but marks recordedAlready so
          the confirm copy doesn't say "nothing posts until you answer". */}
      {payment.paymentMethod === 'Check' && (
        <CheckPrintFlow
          open={printFlowOpen}
          onOpenChange={setPrintFlowOpen}
          bankAccountId={payment.bankAccount}
          bankAccountLabel={PAY_FROM_ACCOUNTS.find((a) => a.id === payment.bankAccount)?.label ?? payment.bankAccount}
          payments={[checkInput]}
          recordedAlready
          initialNumber={checkSettingsFor(payment.bankAccount).nextCheckNumber}
          onIssued={(issued) => {
            if (issued.length > 0) {
              // The issued number becomes the payment's reference.
              const issuedNo = issued[0].checkNumbers?.[0];
              if (issuedNo) payment.reference = String(issuedNo);
              payment.checkPrint = { status: 'printed', by: 'Ahtisham Ahmad', at: localTodayIso() };
              bumpRender((n) => n + 1);
              const num = issued[0].checkNumbers?.[0];
              toast.success(num ? `Check ${num} printed` : 'Check printed', {
                description: `Recorded for ${payment.paymentNumber}.`,
              });
            }
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Applied To card
// ══════════════════════════════════════════════════════════════════
function AppliedToCard({ payment, isPrepay }: { payment: Payment; isPrepay: boolean }) {
  const location = useLocation();
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EBF3FF' }}>
          <Receipt className="w-3.5 h-3.5" style={{ color: '#0654BC' }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] tracking-tight" style={{ fontWeight: 600 }}>Applied To</h3>
          <p className="text-[11px] text-slate-400">
            {isPrepay ? 'Invoices this advance has been applied to so far.' : 'The invoices this payment settled.'}
          </p>
        </div>
        {isPrepay && payment.unappliedAmount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border bg-amber-50 text-amber-700 border-amber-200" style={{ fontWeight: 600 }}>
            <Wallet className="w-3 h-3" />
            {fmt(payment.unappliedAmount)} unapplied
          </span>
        )}
      </div>
      {payment.appliedInvoices.length > 0 ? (
        <table className="w-full text-[12px]">
          <thead className="bg-slate-50/60 border-b border-slate-100">
            <tr>
              <th className="text-left pl-5 px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Invoice ID</th>
              <th className="text-right px-4 py-2 pr-5 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Amount Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payment.appliedInvoices.map((inv) => (
              <tr key={inv.invoiceNumber} className="hover:bg-[#F8FAFF] transition-colors">
                <td className="pl-5 px-4 py-2.5">
                  {/* New tab (user 10/5): every document code opens its
                      record in a fresh tab. */}
                  <a
                    href={`/invoices/${encodeURIComponent(inv.invoiceNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    {inv.invoiceNumber}
                  </a>
                </td>
                <td className="px-4 py-2.5 pr-5 text-right " style={{ fontWeight: 600 }}>{fmt(inv.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        /* Table Empty & Error States Standard (11/3/26), compact in a card. */
        <TableEmptyState
          compact
          kind="no-data"
          entity={{ singular: 'invoice', plural: 'invoices' }}
          title={isPrepay ? 'Nothing applied yet' : 'No linked invoices yet'}
          description={isPrepay ? 'The full advance is available as vendor credit.' : 'No invoice allocations on this record.'}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// GL Impact card
// ══════════════════════════════════════════════════════════════════
function GLImpactCard({
  glLines, drTotal, crTotal, posted, failed, isPrepay, ledger = 'ap',
}: {
  glLines: Array<{ code: string; name: string; desc: string; debit: number; credit: number }>;
  drTotal: number; crTotal: number; posted: boolean; failed: boolean; isPrepay: boolean;
  ledger?: 'ap' | 'ar';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EEF2FF' }}>
          <BookOpen className="w-3.5 h-3.5" style={{ color: '#4338CA' }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] tracking-tight" style={{ fontWeight: 600 }}>GL Impact</h3>
          <p className="text-[11px] text-slate-400">
            {ledger === 'ar'
              ? isPrepay
                ? 'Debit Bank / Credit Customer Deposits on entry; Debit Customer Deposits / Credit A/R as it gets applied.'
                : 'Debit Bank / Credit Accounts Receivable.'
              : isPrepay
                ? 'Debit Prepayment / Credit Bank on entry; Debit A/P / Credit Prepayment as it gets applied.'
                : 'Debit Accounts Payable / Credit Bank.'}
          </p>
        </div>
        {posted ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border bg-emerald-50 text-emerald-700 border-emerald-200" style={{ fontWeight: 600 }}>
            <CheckCircle2 className="w-3 h-3" /> Posted
          </span>
        ) : failed ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border bg-red-50 text-red-700 border-red-200" style={{ fontWeight: 600 }}>
            <AlertTriangle className="w-3 h-3" /> Reversed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border bg-slate-100 text-slate-500 border-slate-200" style={{ fontWeight: 600 }}>
            <CircleDashed className="w-3 h-3" /> Not posted
          </span>
        )}
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-slate-50/60 border-b border-slate-100">
          <tr>
            <th className="text-left pl-5 px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Account</th>
            <th className="text-left px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Description</th>
            <th className="text-right px-4 py-2 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Debit</th>
            <th className="text-right px-4 py-2 pr-5 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Credit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {glLines.map((l, i) => (
            <tr key={i} className="hover:bg-[#F8FAFF] transition-colors">
              <td className="pl-5 px-4 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-px rounded-md text-[10px] bg-slate-100/80 text-slate-500 border border-slate-200/60" style={{ fontWeight: 600 }}>
                    {l.code}
                  </span>
                  <span style={{ fontWeight: 500 }}>{l.name}</span>
                </span>
              </td>
              <td className="px-4 py-2.5 text-slate-500">{l.desc}</td>
              <td className="px-4 py-2.5 text-right ">{l.debit > 0 ? <span style={{ fontWeight: 600 }}>{fmt(l.debit)}</span> : null}</td>
              <td className="px-4 py-2.5 pr-5 text-right ">{l.credit > 0 ? <span style={{ fontWeight: 600 }}>{fmt(l.credit)}</span> : null}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200/80" style={{ backgroundColor: '#F7FDF9' }}>
            <td className="pl-5 px-4 py-2.5 text-[10px] text-slate-400" style={{ fontWeight: 700 }}>Totals</td>
            <td className="px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-px rounded-full text-[10px] border" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
                <CheckCircle2 className="w-3 h-3" /> Balanced · Debit = Credit
              </span>
            </td>
            <td className="px-4 py-2.5 text-right text-[13px]" style={{ fontWeight: 700 }}>{fmt(drTotal)}</td>
            <td className="px-4 py-2.5 pr-5 text-right text-[13px]" style={{ fontWeight: 700 }}>{fmt(crTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Activity card (tab)
// ══════════════════════════════════════════════════════════════════
function ActivityCard({ payment, posted, failed }: { payment: Payment; posted: boolean; failed: boolean }) {
  const activity = useMemo(() => {
    const items: Array<{ icon: React.ElementType; label: string; date: string; tone: 'neutral' | 'success' | 'danger' }> = [
      { icon: Clock, label: `Created by ${payment.createdBy}`, date: payment.createdDate, tone: 'neutral' },
    ];
    items.push({ icon: CheckCircle2, label: 'Approved', date: payment.createdDate, tone: 'success' });
    if (posted) items.push({ icon: Landmark, label: `Posted · ${payment.paymentMethod} from ${payment.bankAccount}`, date: payment.paymentDate, tone: 'success' });
    if (failed) items.push({ icon: Ban, label: 'Void / Reversed', date: payment.paymentDate, tone: 'danger' });
    return items;
  }, [payment, posted, failed]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#F1F5F9' }}>
          <Clock className="w-3.5 h-3.5" style={{ color: '#475569' }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] tracking-tight" style={{ fontWeight: 600 }}>Recent Activity</h3>
          <p className="text-[11px] text-slate-400">The lifecycle of this record.</p>
        </div>
      </div>
      <div className="px-4 py-4 space-y-3">
        {activity.map((a, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border"
              style={
                a.tone === 'success'
                  ? { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                  : a.tone === 'danger'
                    ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }
                    : { backgroundColor: palette.slate[100], borderColor: palette.slate[200] }
              }
            >
              <a.icon className="w-3.5 h-3.5" style={{ color: a.tone === 'success' ? '#047857' : a.tone === 'danger' ? '#B91C1C' : palette.slate[500] }} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{a.label}</p>
              <p className="text-[10px] text-slate-400 ">{a.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Sidebar — collapsible sections (mirrors InvoiceDetailSidebar recipe)
// ══════════════════════════════════════════════════════════════════
type SectionKey = 'details' | 'summary' | 'timeline';

function SidebarSection({
  icon: Icon, title, open, onToggle, children, collapsedSummary,
}: {
  icon: React.ElementType; title: string; open: boolean; onToggle: () => void;
  children: React.ReactNode; collapsedSummary?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {!open && collapsedSummary && (
            <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{collapsedSummary}</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <CollapseReveal open={open}>
        <div className="px-4 pb-4">{children}</div>
      </CollapseReveal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{label}</span>
      <span className="text-[11px] text-foreground text-right" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* Partner two-column grid field (user 9/25): label over value. */
function GridField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>{label}</p>
      <p className="text-[12px] text-foreground truncate mt-0.5" style={{ fontWeight: 600 }}>{value || '·'}</p>
    </div>
  );
}

// MMM D, YYYY (date format standard 9/3/26).
function fmtSidebarDate(iso?: string) {
  if (!iso) return '·';
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function PaymentDetailSidebar({
  payment, isPrepay, status, statusPalette, onPrintCheck,
}: {
  payment: Payment; isPrepay: boolean; status: string;
  statusPalette: { bg: string; color: string; border: string };
  onPrintCheck?: () => void;
}) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ details: true, summary: true, timeline: false });
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  // The mark-manual action mutates the payment record in place (demo data
  // is module state); this tick makes the card reflect it immediately.
  const [, bumpRender] = useState(0);

  const appliedPct = payment.amount > 0 ? Math.round((payment.appliedAmount / payment.amount) * 100) : 0;
  const fullyApplied = isPrepay && payment.unappliedAmount === 0 && payment.appliedAmount > 0;

  return (
    <aside className="w-[320px] shrink-0 space-y-3 self-start sticky top-[170px]">
      {/* ── Payment Details — partner-card anatomy (user 9/25): vendor
          hero first, two-column field grid, created-by/created-on
          footer, mirroring the invoice General Information card. */}
      <SidebarSection icon={Info} title="Payment Details" open={open.details} onToggle={() => toggle('details')} collapsedSummary={payment.paymentMethod}>
        <div>
          <HoverCard openDelay={300} closeDelay={120}>
            <HoverCardTrigger asChild>
              <a
                href={partnerVendorUrl(payment.vendor)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 min-w-0 group/vh"
                title={`Open ${payment.vendor} in Partners`}
              >
                <VendorAvatar
                  name={payment.vendor}
                  logoUrl={mockVendors.find((v) => v.vendorName === payment.vendor)?.imageUrl}
                  size="lg"
                />
                <span className="min-w-0">
                  <span className="block text-[14px] text-foreground truncate transition-colors group-hover/vh:text-primary group-hover/vh:underline" style={{ fontWeight: 600 }}>
                    {payment.vendor}
                  </span>
                  {/* Subline = the payment's memo (user 9/25): vendor facts
                      live in the hover card. */}
                  <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                    {payment.memo || mockVendors.find((v) => v.vendorName === payment.vendor)?.category || 'Vendor'}
                  </span>
                </span>
              </a>
            </HoverCardTrigger>
            <HoverCardContent
              side="left"
              align="start"
              sideOffset={8}
              className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
            >
              <VendorQuickCard vendor={payment.vendor} description={payment.memo} />
            </HoverCardContent>
          </HoverCard>

          <div className="grid grid-cols-2 gap-x-3 gap-y-3 mt-3.5 pt-3.5 border-t border-slate-100">
            <GridField label={isPrepay ? 'Prepayment ID' : 'Payment ID'} value={payment.paymentNumber ?? payment.reference} />
            <GridField label="Reference" value={payment.reference} />
            <GridField label="Method" value={payment.paymentMethod} />
            <GridField label="Bank Account" value={payment.bankAccount} />
            <GridField label="Payment Date" value={fmtSidebarDate(payment.paymentDate)} />
            <GridField label="Currency" value={payment.currency} />
            <GridField label={isPrepay ? 'Prepayment Account' : 'A/P Account'} value={payment.apAccount} />
            {payment.linkedPO && <GridField label="Linked PO" value={`PO ${payment.linkedPO}`} />}
          </div>
          {/* Check-print trail (Eli 9/25): who confirmed the print (or
              logged the hand-written check) and when; an unconfirmed
              check reads amber Unprinted with the manual escape hatch. */}
          {payment.paymentMethod === 'Check' && (
            <div className="mt-3.5 pt-3.5 border-t border-slate-100">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Check Print</p>
              {payment.checkPrint ? (
                <p className="flex items-center gap-1.5 mt-1 min-w-0 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] shrink-0"
                    style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
                  >
                    <Printer className="w-2.5 h-2.5" />
                    {payment.checkPrint.status === 'manual' ? 'Manual Check' : 'Printed'}
                  </span>
                  <span className="text-[12px] text-foreground min-w-0" style={{ fontWeight: 500 }}>
                    {payment.checkPrint.status === 'manual' ? 'logged by' : 'by'} {payment.checkPrint.by} on {fmtSidebarDate(payment.checkPrint.at)}
                  </span>
                </p>
              ) : (
                <div className="mt-1">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px]"
                    style={{ fontWeight: 600, backgroundColor: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' }}
                  >
                    <Printer className="w-2.5 h-2.5" />
                    Unprinted
                  </span>
                  {onPrintCheck && (
                    <button
                      type="button"
                      onClick={onPrintCheck}
                      className="block mt-1.5 text-[11.5px] text-primary hover:underline underline-offset-2 cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      Print Check
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Created By | Created On — partner footer, avatar included.
              The memo rides the vendor hero subline now (user 9/25). */}
          <div className="grid grid-cols-2 gap-x-3 mt-3.5 pt-3.5 border-t border-slate-100">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Created By</p>
              <p className="flex items-center gap-1.5 mt-1 min-w-0">
                <PhotoPersonAvatar name={payment.createdBy} size="sm" />
                <span className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>{payment.createdBy}</span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>Created On</p>
              <p className="text-[12px] text-foreground truncate mt-1.5" style={{ fontWeight: 600 }}>{fmtSidebarDate(payment.createdDate)}</p>
            </div>
          </div>
        </div>
      </SidebarSection>

      {/* ── Summary ── */}
      <SidebarSection icon={Wallet} title={isPrepay ? 'Prepayment Summary' : 'Payment Summary'} open={open.summary} onToggle={() => toggle('summary')} collapsedSummary={fmt(payment.amount)}>
        <div>
          <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>{isPrepay ? 'Advance Amount' : 'Payment Amount'}</p>
          <p className="text-[22px] text-foreground mt-0.5" style={{ fontWeight: 700, lineHeight: 1.1 }}>{fmt(payment.amount)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px]"
              style={{ fontWeight: 600, backgroundColor: statusPalette.bg, color: statusPalette.color, borderColor: statusPalette.border }}>
              {paymentStatusLabel(status)}
            </span>
          </p>
        </div>

        {/* Application progress — PREPAYMENTS only (feedback 7/22/26):
            a payment is fully applied by definition, so it carries no
            application axis. The prepayment bar tracks applied vs the
            still-available (unapplied) advance. */}
        {isPrepay && payment.amount > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {/* No progress bar (user 10/1, system-wide): the Applied /
                Unapplied breakdown carries the numbers. */}
            <div className="flex items-center justify-between text-[11px]" style={{ fontWeight: 500 }}>
              <span className="text-slate-500">
                Applied: <span className="text-foreground " style={{ fontWeight: 600 }}>{fmt(payment.appliedAmount)}</span>
              </span>
              <span className="text-slate-500">
                Unapplied: <span className="" style={{ fontWeight: 600, color: payment.unappliedAmount > 0 ? '#B45309' : '#047857' }}>{fmt(payment.unappliedAmount)}</span>
              </span>
            </div>
          </div>
        )}
      </SidebarSection>

      {/* Timeline sidebar card removed per feedback 7/15/26 — lifecycle
          history lives in the Recent Activity tab. */}
    </aside>
  );
}

// ══════════════════════════════════════════════════════════════════
// Workflow ladder — circle stepper, verbatim recipe from
// InvoiceDetailScreen.StatusWorkflowBar, keyed to payment lifecycle.
// ══════════════════════════════════════════════════════════════════
const STEP_SOLID: Record<string, string> = {
  Scheduled: '#0654BC',
  Paid: '#065F46',
  Unpaid: '#64748B',
  Unapplied: '#B45309',
  'Partially Applied': '#C2410C',
  'Fully Applied': '#047857',
  Cancelled: '#B91C1C',
  Reversed: '#BE123C',
};
const stepGlow = (s: string) => `color-mix(in srgb, ${STEP_SOLID[s] ?? '#64748B'} 18%, transparent)`;

function PaymentWorkflowBar({ payment }: { payment: Payment }) {
  /* Payment's own chronological status journey (7/16/26): terminal
   * events render as inline nodes where they happened, not off-path
   * chips. Scheduled → Paid, then Reversed appended after Paid when it
   * occurred; Cancelled is terminal (a cancelled payment never reached
   * Paid, so nothing renders after it). The APPLICATION track stays
   * separate — it is an orthogonal axis (a scheduled payment can be
   * unapplied), not an off-path state. */
  const statusAxis = paymentStatusAxis(payment);
  const applicationAxis = paymentApplicationAxis(payment);

  type TrackStep = { key: string; icon: React.ElementType; solid: string };
  const colorsFor = (key: string) => ({ solid: STEP_SOLID[key] ?? '#64748B', glow: stepGlow(key) });

  // The Scheduled node appears ONLY when the payment was scheduled
  // before it paid (feedback 7/22/26). A payment recorded for today is
  // paid directly, so its timeline is just Paid → (Reversed/Voided).
  const scheduledFirst = payment.wasScheduled === true || statusAxis === 'Scheduled';
  const schedNode: TrackStep = { key: 'Scheduled', icon: Calendar, solid: STEP_SOLID.Scheduled };
  const paidNode: TrackStep = { key: 'Paid', icon: Check, solid: STEP_SOLID.Paid };
  // Unpaid is the neutral pre-state (feedback 7/22/26): a paid-directly
  // payment reads Unpaid → Paid, a two-node track that keeps the same
  // connected timeline pattern as the invoice journey instead of a lone
  // node. Scheduled-origin payments open on Scheduled instead.
  const unpaidNode: TrackStep = { key: 'Unpaid', icon: Wallet, solid: STEP_SOLID.Unpaid };
  const statusSteps: TrackStep[] = (() => {
    // Not yet paid: Unpaid → Scheduled (current) → Paid (upcoming).
    if (statusAxis === 'Scheduled') return [schedNode, paidNode];
    if (statusAxis === 'Cancelled') {
      // Voided from wherever it was: scheduled-and-voided vs paid-and-voided.
      return [scheduledFirst ? schedNode : paidNode, { key: 'Cancelled', icon: Ban, solid: STEP_SOLID.Cancelled }];
    }
    const base: TrackStep[] = scheduledFirst ? [schedNode, paidNode] : [unpaidNode, paidNode];
    if (statusAxis === 'Reversed') base.push({ key: 'Reversed', icon: AlertTriangle, solid: STEP_SOLID.Reversed });
    return base;
  })();
  const statusAllDone = statusAxis === 'Paid';
  const statusCurrent = statusAxis === 'Scheduled' ? 0 : statusSteps.length - 1;
  const statusChip = null;

  const appSteps: TrackStep[] = [
    { key: 'Unapplied', icon: Wallet, solid: STEP_SOLID.Unapplied },
    { key: 'Partially Applied', icon: Banknote, solid: STEP_SOLID['Partially Applied'] },
    { key: 'Fully Applied', icon: Check, solid: STEP_SOLID['Fully Applied'] },
  ];
  const appAllDone = applicationAxis === 'Fully Applied';
  const appCurrent = applicationAxis === 'Partially Applied' ? 1 : appAllDone ? 2 : 0;

  const renderTrack = (
    _eyebrow: string,
    steps: TrackStep[],
    currentIndex: number,
    allCompleted: boolean,
    chip: { label: string; icon: React.ElementType; colors: { solid: string; glow: string } } | null,
    grow: boolean,
  ) => {
    const terminal = colorsFor(steps[steps.length - 1].key);
    const doneSolid = allCompleted ? terminal.solid : 'hsl(var(--primary))';
    const doneTint = allCompleted ? terminal.glow : 'color-mix(in srgb, hsl(var(--primary)) 16%, transparent)';
    const activeColors = chip ? chip.colors : colorsFor(steps[currentIndex].key);
    return (
      <div className={`flex items-center gap-1.5 min-w-0 ${grow ? 'flex-1' : 'shrink-0'}`}>
        {steps.map((step, idx) => {
          const isCompleted = allCompleted || idx < currentIndex;
          const isCurrent = idx === currentIndex && !allCompleted && !chip;
          const isLast = idx === steps.length - 1;
          const StepIcon = step.icon;
          return (
            <div key={step.key} className="contents">
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: isCurrent ? 24 : isCompleted ? 22 : 20,
                    height: isCurrent ? 24 : isCompleted ? 22 : 20,
                    ...(isCompleted
                      ? { backgroundColor: doneSolid, boxShadow: `0 2px 6px ${doneTint}` }
                      : isCurrent
                        ? { backgroundColor: activeColors.solid, boxShadow: `0 0 0 3px ${activeColors.glow}, 0 2px 8px color-mix(in srgb, currentColor 8%, transparent)` }
                        : { backgroundColor: 'transparent', border: '1.5px solid hsl(var(--border))' }),
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {isCompleted ? (
                    <Check className="size-2.5 text-white" style={{ strokeWidth: 3 }} />
                  ) : isCurrent ? (
                    <StepIcon className="size-3 text-white" style={{ strokeWidth: 2.5 }} />
                  ) : (
                    <StepIcon className="size-2.5" style={{ color: '#64748B', strokeWidth: 2 }} />
                  )}
                </div>
                <span
                  className="hidden sm:block whitespace-nowrap text-[12px] transition-all duration-300"
                  style={
                    isCompleted
                      ? { fontWeight: 500, color: doneSolid }
                      : isCurrent
                        ? { fontWeight: 600, color: '#0F172A' }
                        : { fontWeight: 500, color: '#475569' }
                  }
                >
                  {paymentStatusLabel(step.key)}
                </span>
              </div>
              {!isLast && (
                <div className="flex-1 mx-1.5 lg:mx-2 min-w-[10px] relative" style={{ height: 4 }}>
                  {idx < currentIndex || allCompleted ? (
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: doneSolid, height: 2, top: '50%', transform: 'translateY(-50%)' }} />
                  ) : (
                    <div
                      className="absolute rounded-full"
                      style={{
                        inset: 0,
                        height: 2,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        backgroundColor: '#94A3B8',
                        WebkitMaskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                        maskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                        opacity: 0.85,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        {chip && (
          <>
            <div
              className="flex-1 mx-1.5 lg:mx-2 min-w-[10px] relative"
              style={{
                height: 2,
                backgroundColor: '#CBD5E1',
                WebkitMaskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                maskImage: 'repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)',
                opacity: 0.6,
                alignSelf: 'center',
              }}
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: chip.colors.solid,
                  boxShadow: `0 0 0 3px ${chip.colors.glow}, 0 2px 8px color-mix(in srgb, currentColor 8%, transparent)`,
                }}
              >
                <chip.icon className="size-3 text-white" style={{ strokeWidth: 2.5 }} />
              </div>
              <span className="hidden sm:block whitespace-nowrap text-[12px]" style={{ fontWeight: 600, color: '#0F172A' }}>
                {chip.label}
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  // A payment has ONE axis only, cash/execution — it is fully applied by
  // definition, so the application track is hidden (feedback 7/22/26).
  // Only a PREPAYMENT carries the second, application axis.
  const isPrepayment = payment.type === 'Prepayment';

  return (
    <div className="px-4 lg:px-5 py-2.5">
      <div className="relative flex items-center w-full gap-3 py-1" style={{ minHeight: 32 }}>
        {renderTrack('Status', statusSteps, statusCurrent, statusAllDone, statusChip, !isPrepayment)}
        {isPrepayment && (
          <>
            <div className="w-px h-6 bg-border shrink-0" />
            {renderTrack('Application', appSteps, appCurrent, appAllDone, null, true)}
          </>
        )}
      </div>
    </div>
  );
}
