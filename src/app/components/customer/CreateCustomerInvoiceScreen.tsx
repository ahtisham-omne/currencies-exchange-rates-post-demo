import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  DollarSign,
  Edit3,
  ExternalLink,
  FileText,
  Info,
  LayoutGrid,
  Lock,
  BadgePercent,
  MapPin,
  MessageSquareWarning,
  Maximize2,
  Package,
  Paperclip,
  Phone,
  Plus,
  ReceiptText,
  Save,
  Search,
  SendHorizontal,
  Settings2,
  StickyNote,
  Trash2,
  Truck,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/app/components/ui/accordion';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { Switch } from '@/app/components/ui/switch';
import { Textarea } from '@/app/components/ui/textarea';
import { ExpandableTextarea } from '@/app/components/ExpandableTextarea';
import { SegmentedCountPill } from '@/app/components/SegmentedCountPill';
import { CarrierCard } from '@/app/components/CarrierCard';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { MaxChip, MoneyInput } from '@/app/components/payments/MoneyInput';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { addDaysIso, formatUsDate, localTodayIso } from '@/app/lib/dueBucket';
import { CARRIER_CATALOGUE, type VendorCarrier } from '@/app/data/vendorCarriers';
import { partnerVendorUrl } from '@/app/data/mockVendors';
import { useArPermissions, useArSettings } from '@/app/hooks/useArSettings';
import { AR_ACTING_USER } from '@/app/hooks/useCustomerInvoicing';
import { addressLine } from '@/app/data/ar/mockCustomers';
import { depositRemaining } from '@/app/data/ar/customerInvoiceStatus';
import type { ChargeTemplate } from '@/app/data/ar/chargeTemplates';
import {
  AR_ACCOUNTS,
  CHARGE_ACCOUNTS,
  CHARGE_DEFAULT_ACCOUNT,
  CHARGE_TYPES,
  COMPANY_CURRENCY,
  CUSTOMER_DEPOSITS_ACCOUNT,
  CUSTOMER_DEPOSIT_ACCOUNTS,
  FREIGHT_INCOME_ACCOUNT,
  REVENUE_ACCOUNTS,
  arAccountForCategory,
  splitGlAccount,
  type CustomerChargeType,
} from '@/app/data/ar/arGlAccounts';
import {
  AR_TRIGGER_COPY,
  arTermById,
  netDaysFor,
  stageLabel,
  stagesForTerm,
  triggerEventFor,
} from '@/app/data/ar/arPaymentTerms';
import type { PaymentTermPreset } from '@/app/data/paymentTermPresets';
import type { ArCreateSeed, CreateCustomerInvoiceFormProps } from './arCreateContract';
import { CustomerSelectionModalNested } from './CustomerSelectionModalNested';
import {
  EPS,
  advanceAvailability,
  advanceLinesFor,
  advanceTriggerFor,
  billedStages,
  blankStandaloneLine,
  closedPeriod,
  coverageBySo,
  dueDateFor,
  firstOpenStage,
  glRowsFor,
  glTotals,
  initialState,
  money,
  newCharge,
  applicableDeposits,
  blankManualLine,
  duplicateLinesFor,
  freightSourcesFor,
  fxRateFor,
  orderedLeftFor,
  treatmentFor,
  lockedUnitsByLine,
  FLAG_REASONS,
  type FlagKind,
  resolveContext,
  round2,
  shipmentAvailability,
  shipmentTriggerFor,
  eventDateFor,
  defaultTriggerEvent,
  stageOf,
  totalsFor,
  type FormCharge,
  type FormLine,
  type FormState,
  type Issue,
} from './form/formModel';
import { fid, validateForSubmit } from './form/formValidation';
import { buildInvoice } from './form/formBuild';
import { DestructiveConfirm, GLAccountPicker } from './form/VendorFormKit';
import { RevenueTreatmentCard } from './form/RevenueTreatmentCard';
import { SourceLinesCard, StandaloneLinesCard, type SourceTab } from './form/ArLineTables';
import { ArTermBrowseModal } from './form/ArTermBrowseModal';
import { ArAccountModal } from './form/ArAccountModals';
import { BillToAddressModal } from './form/BillToAddressModal';
import { SearchableUserPicker } from '@/app/components/vendors/SearchableUserPicker';
import { ArSubmitConfirm, type PriceChange } from './form/ArSubmitConfirm';

// Customer invoice form (PRD §7.4, §8.4, §9.3, §10.1, §11.3, BR-005 to
// BR-021). Round 2: a fork of the vendor CreateInvoiceScreen, the same
// portal shell, header, 70/30 split, Invoice Details card, source-tab
// line items card, sidebar accordions (General Information, charges,
// freight, GL Impact, attachments), breakdown + Total Due and footer.
// Only the data and the PRD flow differ. The form never persists: it
// emits onSaved and App saves.

const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP'];

/** A shipment's carrier as the partner-style carrier card shape. */
function carrierFor(name: string, shipmentNumber: string): VendorCarrier {
  const hit = CARRIER_CATALOGUE.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (hit) return { ...hit, isPrimary: false };
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return {
    id: `carrier-${shipmentNumber}`,
    name,
    shortName: name.split(' ')[0],
    initials,
    colorBg: '#F1F5F9',
    colorText: '#334155',
    desc: `Carrier on shipment ${shipmentNumber}.`,
    mode: 'ground',
    region: 'North America',
    methodName: `${name.split(' ')[0]} Ground`,
    minDays: 3,
    maxDays: 5,
    status: 'Active',
    isPrimary: false,
  };
}

function FieldInfo({ children, width = 240 }: { children: React.ReactNode; width?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3 h-3 text-slate-300 cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]" style={{ maxWidth: width }}>
        <p className="text-[11px] text-slate-500 leading-snug">{children}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const LABEL = 'text-xs sm:text-[13px] text-foreground flex items-center gap-1.5';
const RAIL_LABEL = 'text-[11px] text-slate-500';
const Req = () => <span style={{ color: '#DC2626' }}>*</span>;
const fmtFileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Tax reads as Sales Tax on the form (user 11/4). */
const chargeLabel = (t: string) => (t === 'Tax' ? 'Sales Tax' : t);

export function CreateCustomerInvoiceScreen({
  seed,
  editInvoice,
  customers,
  invoices,
  deposits,
  onBack,
  onClose,
  onSaved,
}: CreateCustomerInvoiceFormProps) {
  const perms = useArPermissions();
  const settings = useArSettings();

  // What is billed is fixed for the life of the form.
  // The billed source is fixed except through Add More (vendor parity,
  // 10/29), which widens it to more shipments of the same customer.
  const [ctx, setCtx] = useState(() => resolveContext(seed, customers, invoices, editInvoice));
  const [addMoreOpen, setAddMoreOpen] = useState(false);
  const [s, setS] = useState<FormState>(() => initialState(ctx, seed, invoices, deposits, editInvoice));
  const set = (patch: Partial<FormState>) => setS((prev) => ({ ...prev, ...patch }));

  // Add More: rebuild the context from the wider pick, then merge. Every
  // field the user already set stays; existing lines keep their edits;
  // new lines arrive with their defaults.
  const handleAddMore = (next: ArCreateSeed) => {
    setAddMoreOpen(false);
    if (next.kind !== 'Shipment Invoice') return;
    if (next.customerName !== ctx.customerName) {
      toast.error('Pick shipments for the same customer', { description: `This invoice bills ${ctx.customerName}.` });
      return;
    }
    const nextCtx = resolveContext(next, customers, invoices, editInvoice);
    const fresh = initialState(nextCtx, next, invoices, deposits, editInvoice);
    // Line keys are positional, so lines match on shipment + line id.
    const idOf = (l: { shipmentNumber?: string; shipmentLineId?: string; key: string }) => (l.shipmentLineId ? `${l.shipmentNumber}|${l.shipmentLineId}` : l.key);
    const added = fresh.lines.filter((l) => !s.lines.some((x) => idOf(x) === idOf(l))).length;
    setCtx(nextCtx);
    setS((prev) => {
      const byId = new Map(prev.lines.map((l) => [idOf(l), l]));
      const prevKeyById = new Map(prev.lines.map((l) => [idOf(l), l.key]));
      setLinePrepayState((lp) => {
        const out: Record<string, number> = {};
        fresh.lines.forEach((l) => {
          const old = prevKeyById.get(idOf(l));
          if (old && lp[old]) out[l.key] = lp[old];
        });
        return out;
      });
      const lines = fresh.lines.map((l) => {
        const kept = byId.get(idOf(l));
        return kept ? { ...kept, key: l.key } : l;
      });
      const names = new Set(prev.attachments.map((a) => a.name));
      return {
        ...prev,
        // Added (manual) lines and typed PO numbers survive the merge (FAD 11/2).
        lines: [...lines, ...prev.lines.filter((l) => l.manual)],
        poBySo: { ...fresh.poBySo, ...prev.poBySo },
        triggerDate: prev.triggerTouched ? prev.triggerDate : fresh.triggerDate,
        attachments: [...prev.attachments, ...fresh.attachments.filter((a) => !names.has(a.name))],
      };
    });
    if (added > 0) toast.success(`${added} item${added === 1 ? '' : 's'} added`, { description: 'Review the quantities, then submit.' });
  };

  const kind = ctx.kind;
  const isShip = kind === 'Shipment Invoice';
  const isAdv = kind === 'Advance Invoice';
  const isSA = kind === 'Standalone';
  const customer = ctx.customer;
  const cur = s.currency;
  const isResubmit = editInvoice?.invoiceStatus === 'Rejected';
  const isPendingEdit = editInvoice?.invoiceStatus === 'Pending Approval';

  // ── Live derivations (round-1 PRD logic) ────────────────────────
  const term = arTermById(s.paymentTermId);
  const shipAvail = useMemo(() => shipmentAvailability(ctx, invoices), [ctx, invoices]);
  const advAvail = useMemo(() => advanceAvailability(ctx, invoices), [ctx, invoices]);
  const coverage = useMemo(() => coverageBySo(ctx, invoices), [ctx, invoices]);
  const ratioBySo = useMemo(() => new Map([...coverage].map(([k, v]) => [k, v.ratio])), [coverage]);
  const totals = useMemo(() => totalsFor(ctx, s, invoices), [ctx, s, invoices]);
  // FAD 11/2: deposits taken on this invoice's SO(s) first, then on-account.
  const heldDeposits = useMemo(() => (isShip ? applicableDeposits(ctx, deposits) : []), [isShip, ctx, deposits]);
  const soDepositNos = new Set(ctx.salesOrders.map((o) => o.soNumber));
  const prepayCaption = (() => {
    const sos = [...new Set(heldDeposits.map((d) => d.soNumber).filter((n): n is string => !!n && soDepositNos.has(n)))];
    if (!sos.length) return "the customer's on-account deposits";
    return `deposits taken on SO ${sos.join(', ')}${heldDeposits.some((d) => !d.soNumber) ? ', then on-account deposits' : ''}`;
  })();
  // FAD 11/2: Revenue or Deposit on a pre-invoice, with the revenue gate.
  const treat = useMemo(() => treatmentFor(ctx, s, settings, editInvoice), [ctx, s, settings, editInvoice]);
  const advDeposit = isAdv && treat.effective === 'Deposit';
  const advRevenue = isAdv && treat.effective === 'Revenue';
  const orderedLeft = useMemo(() => (isShip ? orderedLeftFor(ctx, s, invoices) : new Map<string, number>()), [isShip, ctx, s, invoices]);
  const depositsApplied = round2(heldDeposits.reduce((a, d) => a + (s.depositAmounts[d.id] ?? 0), 0));

  // Customer prepayment per line (BA 10/29): entered in the lines table;
  // the total draws on the held deposits oldest first, so the GL, the
  // breakdown and the saved deposit applications stay deposit-based.
  const heldTotal = round2(heldDeposits.reduce((a, d) => a + depositRemaining(d), 0));
  const [linePrepay, setLinePrepayState] = useState<Record<string, number>>(() => {
    let left = round2(Object.values(s.depositAmounts).reduce((a, n) => a + (n ?? 0), 0));
    const out: Record<string, number> = {};
    for (const l of s.lines) {
      if (left <= EPS) break;
      const lineTotal = totals.lineMoney.get(l.key)?.total ?? 0;
      const take = round2(Math.min(left, lineTotal));
      if (take > EPS) { out[l.key] = take; left = round2(left - take); }
    }
    return out;
  });
  const allocateDeposits = (total: number): Record<string, number> => {
    let left = round2(total);
    const out: Record<string, number> = {};
    heldDeposits.forEach((d, i) => {
      const room = depositRemaining(d);
      const take = i === heldDeposits.length - 1 ? left : round2(Math.min(left, room));
      if (take > EPS) out[d.id] = take;
      left = round2(left - take);
    });
    return out;
  };
  const setLinePrepay = (key: string, n: number) => {
    const next = { ...linePrepay, [key]: round2(Math.max(0, n)) };
    setLinePrepayState(next);
    set({ depositAmounts: allocateDeposits(Object.values(next).reduce((a, x) => a + x, 0)) });
  };
  // A removed line takes its prepayment with it.
  useEffect(() => {
    const keys = new Set(s.lines.map((l) => l.key));
    if (Object.keys(linePrepay).every((k) => keys.has(k))) return;
    const next = Object.fromEntries(Object.entries(linePrepay).filter(([k]) => keys.has(k)));
    setLinePrepayState(next);
    set({ depositAmounts: allocateDeposits(Object.values(next).reduce((a, x) => a + x, 0)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.lines]);
  const prepayMaxFor = (key: string) => {
    const lineTotal = totals.lineMoney.get(key)?.total ?? 0;
    const others = Object.entries(linePrepay).reduce((a, [k, v]) => (k === key ? a : a + v), 0);
    return round2(Math.max(0, Math.min(lineTotal, heldTotal - others)));
  };
  const glRows = useMemo(() => glRowsFor(ctx, s, totals, depositsApplied, invoices, treat.effective), [ctx, s, totals, depositsApplied, invoices, treat.effective]);
  const duplicates = useMemo(() => duplicateLinesFor(ctx, s, invoices, shipAvail), [ctx, s, invoices, shipAvail]);
  const gl = glTotals(glRows);
  const dueDate = dueDateFor(kind, s);
  const billed = useMemo(() => billedStages(ctx, invoices), [ctx, invoices]);
  const allStages = stagesForTerm(term);
  const stage = stageOf(term, s.stageIndex);
  const inheritedTermId = isShip ? ctx.salesOrders[0]?.paymentTermId : isAdv ? (ctx.so ?? ctx.quote)?.paymentTermId : customer?.paymentTermId;
  const termDays = netDaysFor(kind, term, s.stageIndex);

  const issues = useMemo(() => {
    const list = validateForSubmit({
      ctx,
      s,
      totals,
      shipAvail,
      advAvail,
      deposits: heldDeposits,
      depositsApplied,
      glBalanced: gl.balanced,
      treatment: treat.effective,
      duplicates,
      orderedLeft,
    });
    // Advance stage: one must be picked, and each stage is billed once.
    if (isAdv && s.termApplied) {
      const billedOn = s.stageIndex ? billed.get(s.stageIndex) : undefined;
      if (!s.stageIndex) list.unshift({ fieldId: fid.stage, message: 'Pick the stage this advance bills.', section: 'general-info' });
      else if (billedOn) list.unshift({ fieldId: fid.stage, message: `This stage is already billed on ${billedOn}. Pick another stage.`, section: 'general-info' });
    }
    // Prepayment column (BA 10/29): no line may take more than it owes or
    // than the customer's deposits still hold.
    const overPrepay = s.lines.find((l) => (linePrepay[l.key] ?? 0) > prepayMaxFor(l.key) + EPS);
    if (overPrepay) list.unshift({ fieldId: fid.lines, message: `Prepayment on ${overPrepay.sku} is more than allowed. Lower it to ${money(prepayMaxFor(overPrepay.key), cur)} or less.` });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, s, totals, shipAvail, advAvail, heldDeposits, depositsApplied, gl.balanced, isAdv, billed, linePrepay, treat.effective, duplicates, orderedLeft]);
  const [attempted, setAttempted] = useState(false);
  const hasError = (id: string) => attempted && issues.some((i) => i.fieldId === id);

  const priceChanges: PriceChange[] = isShip
    ? s.lines.filter((l) => l.invoiceQty > EPS && Math.abs(l.unitPrice - l.originalUnitPrice) > EPS).map((l) => ({ sku: l.sku, from: l.originalUnitPrice, to: l.unitPrice }))
    : [];
  const releaseNote = totals.advanceRefs.length
    ? `The advance billed on ${totals.advanceRefs.map((r) => r.invoiceNumber).join(', ')} is released from Customer Deposits.`
    : undefined;

  // PRD §16 concurrency: availability as it stood when the form opened.
  const openedAvail = useRef(new Map(shipAvail));

  // ── UI state ────────────────────────────────────────────────────
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['general-info']);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [termModalOpen, setTermModalOpen] = useState(() => isAdv && !s.termApplied);
  const [confirmMode, setConfirmMode] = useState<'submit' | 'approve' | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [arModalOpen, setArModalOpen] = useState(false);
  const [billToOpen, setBillToOpen] = useState(false);
  // Dispute + exception notify lists and documents (vendor parity, user 11/4).
  const [disputeNotify, setDisputeNotify] = useState<Set<string>>(new Set());
  const [disputeDocs, setDisputeDocs] = useState<{ name: string }[]>([]);
  const [flagNotify, setFlagNotify] = useState<Set<string>>(new Set());
  const [flagDocs, setFlagDocs] = useState<{ name: string }[]>([]);
  const [depositPickOpen, setDepositPickOpen] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [relatedSearch, setRelatedSearch] = useState('');
  const [shipPickOpen, setShipPickOpen] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [fxDraft, setFxDraft] = useState<string | null>(null);
  const freightSources = useMemo(() => (isShip ? freightSourcesFor(ctx, invoices) : []), [isShip, ctx, invoices]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Source tabs (one per shipment, or the order / quote) ────────
  const tabs: SourceTab[] = useMemo(() => {
    if (isShip) {
      return ctx.shipments
        .filter((sh) => s.lines.some((l) => l.shipmentNumber === sh.shipmentNumber))
        .map((sh) => ({ key: sh.shipmentNumber, kind: 'shipment' as const, number: sh.shipmentNumber, soNumber: sh.soNumber, date: sh.shipDate, dateLabel: 'Shipped', currency: cur }));
    }
    if (isAdv) {
      if (ctx.so) return [{ key: ctx.so.soNumber, kind: 'so' as const, number: ctx.so.soNumber, date: ctx.so.soDate, dateLabel: 'Ordered', currency: cur }];
      if (ctx.quote) return [{ key: ctx.quote.quoteNumber, kind: 'quote' as const, number: ctx.quote.quoteNumber, date: ctx.quote.quoteDate, dateLabel: 'Quoted', currency: cur }];
    }
    return [];
  }, [isShip, isAdv, ctx, s.lines, cur]);
  const [activeTab, setActiveTab] = useState<string>(() => tabs[0]?.key ?? '');
  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.key === activeTab)) setActiveTab(tabs[0].key);
  }, [tabs, activeTab]);

  // ── Line handlers ───────────────────────────────────────────────
  const patchLine = (key: string, patch: Partial<FormLine>) =>
    setS((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const removeLines = (keys: string[]) =>
    setS((prev) => {
      const drop = new Set(keys);
      const lines = prev.lines.filter((l) => !drop.has(l.key));
      return { ...prev, lines: isSA && lines.length === 0 ? [blankStandaloneLine(1)] : lines };
    });

  const addTemplateLine = (t: ChargeTemplate) =>
    setS((prev) => {
      const blank = prev.lines.length === 1 && !prev.lines[0].description.trim() && prev.lines[0].unitPrice <= EPS && !prev.lines[0].glAccount;
      const line: FormLine = {
        ...blankStandaloneLine(prev.lines.length),
        chargeTemplateId: t.id,
        description: t.description,
        unitPrice: t.rate,
        originalUnitPrice: t.rate,
        glAccount: t.revenueAccount,
      };
      return {
        ...prev,
        lines: blank ? [line] : [...prev.lines, line],
        notesToCustomer: t.notes && !prev.notesToCustomer.includes(t.notes) ? [prev.notesToCustomer, t.notes].filter(Boolean).join('\n') : prev.notesToCustomer,
      };
    });

  // ── Term / stage ────────────────────────────────────────────────
  const restageAdvance = (t: PaymentTermPreset, stageIndex: number | undefined) => {
    const st = stageOf(t, stageIndex);
    return { stageIndex, triggerDate: advanceTriggerFor(ctx, st), lines: advanceLinesFor(ctx, invoices, st?.percent ?? 0) };
  };

  const applyTerm = (t: PaymentTermPreset) => {
    if (isAdv) {
      set({ paymentTermId: t.id, termApplied: true, ...restageAdvance(t, firstOpenStage(t, billed)) });
    } else {
      // A new term brings its own trigger event and date (BA 10/29).
      const ev = defaultTriggerEvent(kind, t);
      set({ paymentTermId: t.id, triggerEvent: ev, triggerDate: eventDateFor(ctx, ev, s.invoiceDate) || (ev === 'Invoice Date' ? s.invoiceDate : ''), triggerTouched: ev !== 'Invoice Date' });
    }
    toast.success(`Payment term set to ${t.name}.`);
  };

  const selectStage = (index: number) => {
    if (!term || index === s.stageIndex) return;
    set(restageAdvance(term, index));
  };

  // ── Charges ─────────────────────────────────────────────────────
  const patchCharge = (key: string, patch: Partial<FormCharge>) =>
    setS((prev) => ({ ...prev, charges: prev.charges.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));
  const setChargeType = (c: FormCharge, type: CustomerChargeType) => {
    const prevDefault = c.type ? CHARGE_DEFAULT_ACCOUNT[c.type] : '';
    patchCharge(c.key, { type, account: !c.account || c.account === prevDefault ? CHARGE_DEFAULT_ACCOUNT[type] : c.account });
  };

  // ── Focus the first problem (never-disabled CTA rule) ───────────
  const focusIssue = (issue: Issue) => {
    if (issue.section && !expanded.includes(issue.section)) setExpanded((prev) => [...prev, issue.section!]);
    // A line issue on another shipment tab switches to that tab first.
    const line = s.lines.find((l) => [fid.qty(l.key), fid.price(l.key), fid.rev(l.key), fid.advAmount(l.key), fid.desc(l.key)].includes(issue.fieldId));
    if (isShip && line?.shipmentNumber && line.shipmentNumber !== activeTab) setActiveTab(line.shipmentNumber);
    toast.error(issue.message);
    window.setTimeout(() => {
      const el = document.getElementById(issue.fieldId);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const focusable = el.matches('input,textarea,button') ? el : el.querySelector<HTMLElement>('input,textarea,button');
      focusable?.focus({ preventScroll: true });
    }, 160);
  };

  /** PRD §16: another invoice took units while this form was open. */
  const reconcileConcurrency = (): boolean => {
    if (!isShip) return false;
    let changed = false;
    const lines = s.lines.map((l) => {
      const id = l.shipmentLineId ?? '';
      const now = shipAvail.get(id) ?? 0;
      const then = openedAvail.current.get(id) ?? now;
      if (now < then - EPS && l.invoiceQty > now + EPS) {
        changed = true;
        return { ...l, invoiceQty: now };
      }
      return l;
    });
    openedAvail.current = new Map(shipAvail);
    if (changed) {
      set({ lines });
      setConfirmMode(null);
      toast.warning('Some lines were billed by someone else. Quantities have been updated.');
    }
    return changed;
  };

  const emit = (mode: 'draft' | 'submit' | 'approve') => {
    onSaved({ invoice: buildInvoice({ ctx, s, totals, mode, edit: editInvoice, treatment: treat }), mode, isEdit: !!editInvoice });
  };

  const handleSaveDraft = () => {
    if (!customer) {
      toast.error('Pick a customer before saving a draft.');
      return;
    }
    const hasSomething = isShip
      ? s.lines.some((l) => l.invoiceQty > EPS)
      : isAdv
        ? s.lines.some((l) => (l.advanceAmount ?? 0) > EPS)
        : s.lines.some((l) => l.description.trim() || l.unitPrice > EPS);
    if (!hasSomething) {
      toast.error('Add something to bill before saving a draft.');
      return;
    }
    // A draft holds its units, so it may not hold more than is left.
    if (reconcileConcurrency()) return;
    const over = issues.find((i) => i.message.startsWith('You can bill up to'));
    if (isShip && over) {
      setAttempted(true);
      focusIssue(over);
      return;
    }
    emit('draft');
  };

  // Always submit for approval (10/29): the invoice lands in Pending
  // Approval and is approved from the detail page, never straight from the form.
  const primaryMode = 'submit' as 'submit' | 'approve';
  const handlePrimary = () => {
    if (reconcileConcurrency()) return;
    setAttempted(true);
    if (issues.length) {
      focusIssue(issues[0]);
      return;
    }
    setConfirmMode(primaryMode);
  };

  const handleConfirm = () => {
    if (!confirmMode) return;
    if (reconcileConcurrency()) return;
    const mode = confirmMode;
    setConfirmMode(null);
    emit(mode);
  };

  // ── Derived display bits ────────────────────────────────────────
  const currencyLocked = !isSA || s.lines.some((l) => l.invoiceQty * l.unitPrice > EPS);
  const billTo = customer?.addresses.find((a) => a.id === s.billToAddressId);
  const relatedOptions = useMemo(
    () => invoices.filter((i) => i.customer === ctx.customerName && i.invoiceStatus === 'Approved' && i.docKind !== 'Credit Memo' && i.id !== ctx.editId),
    [invoices, ctx.customerName, ctx.editId],
  );
  const relatedShown = relatedOptions.filter((i) => {
    const q = relatedSearch.trim().toLowerCase();
    return !q || i.invoiceNumber.toLowerCase().includes(q) || (i.customerPONumber ?? '').toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
  });
  const postingClosed = !advDeposit && closedPeriod(s.postingDate);
  const advLeft = round2(advAvail.orderTotal - advAvail.alreadyBilled - totals.total);
  // Trigger event (BA 10/29): picked on shipment and standalone invoices;
  // an advance follows its stage event.
  const triggerEvent = isAdv ? triggerEventFor(ctx.kind, term, s.stageIndex) : s.triggerEvent;
  const shipTrigger = isShip ? s.triggerEvent : undefined;
  // The payment term names the event (user 11/3: no Trigger Event field).
  const triggerEventLabel = triggerEvent === 'Shipping' ? 'ship date' : triggerEvent === 'Invoice Date' ? 'invoice date' : `${String(triggerEvent).toLowerCase()} date`;
  const shipDateOptions = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const sh of ctx.shipments) m.set(sh.shipDate, [...(m.get(sh.shipDate) ?? []), sh.shipmentNumber]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, shipments]) => ({ date, shipments }));
  }, [ctx.shipments]);
  const defaultArAccount = customer?.arAccount || (customer ? arAccountForCategory(customer.category) : '');
  const cityLine = customer?.addresses[0] ? `${customer.addresses[0].city}, ${customer.addresses[0].region}` : '';
  const pillTone = isSA ? 'teal' : isAdv ? 'violet' : 'primary';
  const title = editInvoice
    ? isResubmit
      ? 'Edit and Resubmit Invoice'
      : 'Edit Customer Invoice'
    : isSA
      ? 'Create Standalone Customer Invoice'
      : isAdv
        ? 'Create Advance Invoice'
        : 'Create Customer Invoice';
  const subtitle = isPendingEdit
    ? 'Update the invoice details below. It stays in Pending Approval and your approvers review the edited version.'
    : isResubmit
      ? 'Fix the flagged issues below, then resubmit the invoice for approval.'
      : isSA
        ? 'Standalone invoice. Each line item credits a revenue account. Add line items, fill in invoice details, and submit for approval.'
        : isAdv
          ? 'Bill part of the order before it ships. Pick the stage, review the advance amounts, then submit for approval.'
          : 'Review the items pulled from the selected shipments, fill in invoice details, then submit for approval.';
  const rejectEntry = isResubmit ? [...(editInvoice?.actionHistory ?? [])].reverse().find((e) => e.action === 'reject') : undefined;
  const primaryLabel = primaryMode === 'approve' ? 'Approve' : isResubmit ? 'Resubmit' : isPendingEdit ? 'Save Changes' : 'Submit for Approval';
  const totalDue = round2(totals.total - depositsApplied);

  // Split / stage slice chips on the sidebar term card (vendor slice picker).
  const sliceProps = (() => {
    if (!term || term.category !== 'split') return {};
    if (isAdv) {
      return {
        sliceIdx: Math.max(0, (s.stageIndex ?? 1) - 1),
        onSliceSelect: (i: number) => selectStage(i + 1),
        splitNote: 'Each advance stage is billed on its own advance invoice. The balance is billed when the goods ship.',
        sliceDisabledReasons: allStages.map((st) => {
          if (st.kind === 'balance') return `This ${st.percent}% stage is due ${st.netDays > 0 ? `${st.netDays} days after` : 'at'} ${st.trigger}, so it belongs to the shipment invoice, not this advance.`;
          const on = billed.get(st.index);
          return on ? `This ${st.percent}% stage is already billed on ${on}. Each stage is billed once.` : null;
        }),
      };
    }
    const balance = allStages.find((st) => st.kind === 'balance');
    return {
      sliceIdx: Math.max(0, (balance?.index ?? 1) - 1),
      onSliceSelect: () => undefined,
      splitNote: 'This invoice bills the balance. Advance stages are billed on advance invoices.',
      sliceDisabledReasons: allStages.map((st) =>
        st.kind === 'advance' ? `This ${st.percent}% stage is an advance due at ${st.trigger}, so it belongs to an advance invoice.` : null,
      ),
    };
  })();

  const termCard = term ? (
    <PaymentTermCard term={term} isSelected hideCheckmark compact readOnly showPresetBadge isInherited={term.id === inheritedTermId} {...sliceProps} />
  ) : (
    <div className="h-9 px-2.5 rounded-md border border-slate-200 bg-slate-50 flex items-center text-[11px] text-slate-400">No term</div>
  );
  const termConflict = isAdv && !s.termApplied;
  // Early-pay discount from the term, per line (user 11/4: back on the form).
  const earlyPay =
    term?.applyDiscount && Number(term.discountPercent) > 0
      ? { percent: Number(term.discountPercent), days: Number(term.discountPeriod) || 0, termName: term.name }
      : undefined;
  const termGateErr = hasError(fid.termGate);
  const stageErr = hasError(fid.stage);

  // ── GL preview rows (vendor sidebar recipe) ─────────────────────
  const glPreview = glRows.length
    ? glRows
    : [{ account: '', code: ', ', name: isSA ? 'Select a revenue account on each line' : 'Accounts Receivable', debit: 0 }];

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 sm:p-5 lg:p-6">
      <div className={`bg-white shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300 relative rounded-lg ${isFullScreen ? 'h-full max-w-full' : 'max-w-[1430px] h-[92vh]'}`}>
        {/* Header, vendor recipe: back, title, customer pill, segmented count pill, Full view, close. */}
        <div className="px-3 sm:px-4 lg:px-5 pt-3 pb-3 shrink-0 bg-white border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              {onBack && (
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setShowBack(true)}
                      className="mt-0.5 w-8 h-8 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                      aria-label="Back to previous step"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-500" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px] z-[300]">Back</TooltipContent>
                </Tooltip>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-[15px] text-foreground truncate" style={{ fontWeight: 600 }}>{title}</h3>
                  <HoverCard openDelay={300}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 border rounded-full transition-colors cursor-help shrink-0 ${
                          pillTone === 'teal'
                            ? 'bg-teal-50 border-teal-200 hover:bg-teal-100/70'
                            : pillTone === 'violet'
                              ? 'bg-violet-50 border-violet-200 hover:bg-violet-100/70'
                              : 'bg-primary/[0.08] border-primary/15 hover:bg-primary/[0.12] hover:border-primary/25'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden border border-white bg-white">
                          <ImageWithFallback src="" alt={ctx.customerName} className="w-full h-full object-cover" />
                        </div>
                        <span
                          className={`text-[11px] max-w-[160px] truncate ${pillTone === 'teal' ? 'text-teal-700' : pillTone === 'violet' ? 'text-violet-700' : 'text-primary'}`}
                          style={{ fontWeight: 600 }}
                        >
                          {ctx.customerName}
                        </span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]">
                      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                        <div className="flex items-center gap-3 relative">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg shrink-0">
                            <ImageWithFallback src="" alt={ctx.customerName} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{ctx.customerName}</p>
                            <p className="text-[11px] text-slate-400 truncate">Customer{cityLine ? ` · ${cityLine}` : ''}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white px-4 py-3 space-y-2">
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {customer?.category ?? 'Customer'}. Terms {customer?.paymentTerms ?? term?.name ?? ''}, billed in {customer?.currency ?? cur}.
                        </p>
                        {customer?.addresses[0] && (
                          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{addressLine(customer.addresses[0])}</span>
                          </div>
                        )}
                        {customer?.billingContact.phone && (
                          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{customer.billingContact.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="bg-slate-50/60 border-t border-border/40 px-4 py-2 flex items-center justify-end">
                        <a
                          href={partnerVendorUrl(ctx.customerName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                          style={{ fontWeight: 500 }}
                        >
                          Go to Customer
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  {!isSA && (
                    <SegmentedCountPill
                      icon={Package}
                      segments={
                        isShip
                          ? [
                              `${ctx.salesOrders.length} Sales Order${ctx.salesOrders.length === 1 ? '' : 's'}`,
                              `${tabs.length} Shipment${tabs.length === 1 ? '' : 's'}`,
                              `${s.lines.length} Item${s.lines.length === 1 ? '' : 's'}`,
                            ]
                          : [ctx.quote && !ctx.so ? '1 Quote' : '1 Sales Order', `${s.lines.length} Item${s.lines.length === 1 ? '' : 's'}`]
                      }
                    />
                  )}
                  {/* FAD 11/2: flagged at creation. Label on tone, no dot. */}
                  {s.flagOn && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700 text-[11px] shrink-0" style={{ fontWeight: 500 }}>
                      {s.flagKind}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate" style={{ fontWeight: 400 }}>{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                style={{ fontWeight: 500 }}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                {isFullScreen ? 'Exit Full' : 'Full View'}
              </button>
              <button
                type="button"
                onClick={() => setShowDiscard(true)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Edit and resubmit: the rejection replayed under the header. */}
        {isResubmit && (
          <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2.5 bg-red-50/70 border-red-200">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border shrink-0 border-red-200 text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
            <p className="text-[11px] min-w-0 flex-1 text-red-900" style={{ fontWeight: 500 }}>
              <span style={{ fontWeight: 700 }}>{rejectEntry?.by ?? 'An approver'}</span>
              {' rejected this invoice'}
              {editInvoice?.rejectionReason ? (
                <>
                  {' for '}
                  <span style={{ fontWeight: 700 }}>{editInvoice.rejectionReason.replace(/[.!?]$/, '')}</span>
                </>
              ) : (
                ''
              )}
              {'. Please review the details and resubmit the invoice for approval.'}
            </p>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT SECTION (70%) */}
          <div className="w-[70%] flex flex-col overflow-hidden bg-[#FAFBFC] border-r border-border/60">
            <div className={`flex-1 min-h-0 px-4 pt-3 pb-4 space-y-3 ${isSA ? 'overflow-y-auto custom-scrollbar' : 'flex flex-col overflow-hidden'}`}>
              {/* Invoice Details */}
              <section className="space-y-3 shrink-0">
                <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC] rounded-t-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center shrink-0">
                        <ReceiptText className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Invoice Details</span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
                    </div>
                    {isAdv && (
                      <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] border border-dashed bg-violet-50 text-violet-700 border-violet-300 tracking-wider" style={{ fontWeight: 700 }}>
                        Advance Invoice
                      </span>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    {/* Row 1: Invoice Number + Invoice Date */}
                    <div className="grid grid-cols-2 gap-4">
                      <div id={fid.invoiceNumber}>
                        <Label className={LABEL} style={{ fontWeight: 500 }}>
                          Invoice Number<Req />
                          <FieldInfo>The number printed on the invoice the customer receives. Prefilled with the next SI number; change it if you need to. Separate from the system Invoice ID.</FieldInfo>
                        </Label>
                        <Input
                          value={s.invoiceNumber}
                          maxLength={40}
                          onChange={(e) => set({ invoiceNumber: e.target.value })}
                          placeholder="e.g. SI-000143"
                          className={`mt-1 rounded-lg !h-10 text-sm text-foreground placeholder:text-slate-400 bg-white focus:border-primary focus:ring-1 focus:ring-primary/20 ${
                            hasError(fid.invoiceNumber) && !s.invoiceNumber.trim() ? 'border-red-400 ring-2 ring-red-100' : 'border-border'
                          }`}
                        />
                        {hasError(fid.invoiceNumber) && !s.invoiceNumber.trim() && (
                          <p className="text-[11px] text-red-500 mt-1" style={{ fontWeight: 500 }}>Invoice number is required.</p>
                        )}
                      </div>
                      <div id={fid.invoiceDate}>
                        <Label className={LABEL} style={{ fontWeight: 500 }}>
                          Invoice Date<Req />
                          <FieldInfo>The date printed on the invoice.</FieldInfo>
                        </Label>
                        <DatePicker
                          value={s.invoiceDate}
                          onChange={(v) => set({ invoiceDate: v, ...(!isAdv && s.triggerEvent === 'Invoice Date' && !s.triggerTouched ? { triggerDate: v } : {}) })}
                          placeholder="Select invoice date"
                          className="mt-1"
                          error={hasError(fid.invoiceDate)}
                        />
                        {hasError(fid.invoiceDate) && <p className="text-[11px] text-red-500 mt-1" style={{ fontWeight: 500 }}>Invoice date is required.</p>}
                      </div>
                    </div>

                    {/* Row 2: Posting Date + Trigger Date. Payment Terms lives on the rail
                        card only (10/30); the header field was a duplicate. The trigger
                        event comes from the payment term (user 11/3), so it has no field. */}
                    <div className="grid grid-cols-2 gap-4">
                      <div id={fid.postingDate}>
                        <Label className={LABEL} style={{ fontWeight: 500 }}>
                          Posting Date
                          {!advDeposit && <Req />}
                        </Label>
                        {advDeposit ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center justify-between gap-2 cursor-not-allowed">
                                <span className="text-sm text-slate-400 italic">Nothing posts</span>
                                <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                              <p className="text-[11px] text-slate-500 leading-snug">Revenue on shipment makes no journal entry when the advance invoice is approved, so it has no posting date. Pick Revenue on invoice to post at approval.</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          (() => {
                            const todayIso = localTodayIso();
                            const notToday = !!s.postingDate && s.postingDate !== todayIso;
                            const missing = hasError(fid.postingDate) && !s.postingDate;
                            return (
                              <>
                                <DatePicker value={s.postingDate} onChange={(v) => set({ postingDate: v })} placeholder="Select posting date" className="mt-1" error={postingClosed || missing} />
                                <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: postingClosed || missing ? '#DC2626' : notToday ? '#B45309' : 'rgb(148 163 184)' }}>
                                  {(postingClosed || notToday || missing) && <AlertCircle className="w-3 h-3 shrink-0" />}
                                  <span>
                                    {missing
                                      ? 'Posting date is required.'
                                      : postingClosed
                                        ? `${formatUsDate(s.postingDate)} falls in a closed period. Pick a date in the open period.`
                                        : notToday
                                          ? `Posting on ${formatUsDate(s.postingDate)}, not today's date`
                                          : 'The date this invoice is recorded in the general ledger, today by default.'}
                                  </span>
                                </div>
                              </>
                            );
                          })()
                        )}
                      </div>
                      <div id={fid.triggerDate}>
                        <Label className={LABEL} style={{ fontWeight: 500 }}>
                          Trigger Date
                          {!isAdv && <Req />}
                          <FieldInfo width={260}>
                            {isShip && shipTrigger === 'Shipping'
                              ? 'The date the payment term counts from, set to the latest ship date by default.'
                              : isAdv
                                ? `The date the payment term counts from: the stage event. The due date is this date plus ${termDays} day${termDays === 1 ? '' : 's'}.`
                                : `The date the payment term counts from: the ${triggerEventLabel} the term names.`}
                          </FieldInfo>
                        </Label>
                        {isShip && shipTrigger === 'Shipping' && shipDateOptions.length > 0 ? (
                          (() => {
                            const settingDate = shipDateOptions[shipDateOptions.length - 1].date;
                            const isSettingPick = s.triggerDate === settingDate;
                            return (
                              <Popover open={shipPickOpen} onOpenChange={setShipPickOpen}>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className={`mt-1 h-10 w-full rounded-lg text-sm bg-white border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none px-3 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                      hasError(fid.triggerDate) ? 'border-red-400 ring-2 ring-red-100' : 'border-border'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2 min-w-0">
                                      <span style={{ fontWeight: 500 }}>{s.triggerDate ? formatUsDate(s.triggerDate) : 'Select ship date'}</span>
                                      {s.triggerDate &&
                                        (isSettingPick ? (
                                          <span className="inline-flex items-center px-1.5 py-px rounded-full bg-slate-100 text-slate-500 text-[10px] whitespace-nowrap" style={{ fontWeight: 600 }}>
                                            Auto · Latest Shipment
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-1.5 py-px rounded-full bg-blue-50 text-primary text-[10px] whitespace-nowrap" style={{ fontWeight: 600 }}>
                                            Changed
                                          </span>
                                        ))}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${shipPickOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  sideOffset={6}
                                  className="w-[min(460px,calc(100vw-2rem))] p-0 bg-white border border-border rounded-xl overflow-hidden z-[260]"
                                  style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
                                >
                                  <div className="p-1.5 max-h-[280px] overflow-y-auto">
                                    {shipDateOptions.map((opt) => {
                                      const rowSelected = s.triggerDate === opt.date;
                                      return (
                                        <button
                                          key={opt.date}
                                          type="button"
                                          onClick={() => {
                                            set({ triggerDate: opt.date, triggerTouched: true });
                                            setShipPickOpen(false);
                                          }}
                                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${rowSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                                        >
                                          <span className="flex items-center gap-1.5 w-[136px] shrink-0">
                                            <span className={`text-[13px] ${rowSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>{formatUsDate(opt.date)}</span>
                                            {opt.date === settingDate && (
                                              <span className="inline-flex items-center px-1.5 py-px rounded-full bg-slate-100 text-slate-500 text-[9px] whitespace-nowrap shrink-0" style={{ fontWeight: 600 }}>
                                                Auto
                                              </span>
                                            )}
                                          </span>
                                          <span className="h-3.5 w-px bg-slate-200 shrink-0" />
                                          <span className="flex items-center gap-1 shrink-0 pl-1">
                                            {opt.shipments.map((sh) => (
                                              <span
                                                key={sh}
                                                className="inline-flex items-center gap-1 px-1.5 py-px rounded-md border border-slate-200 bg-slate-50 text-[10px] text-slate-600 whitespace-nowrap"
                                                style={{ fontWeight: 600 }}
                                              >
                                                <Truck className="w-2.5 h-2.5 text-slate-400" />
                                                {sh}
                                              </span>
                                            ))}
                                          </span>
                                          <span className="flex-1" />
                                          {rowSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            );
                          })()
                        ) : (
                          <>
                            <DatePicker
                              value={s.triggerDate}
                              onChange={(v) => set({ triggerDate: v, triggerTouched: true })}
                              placeholder={isAdv ? 'Event has not happened yet' : 'Select trigger date'}
                              className="mt-1"
                              error={hasError(fid.triggerDate)}
                            />
                            {hasError(fid.triggerDate) ? (
                              <p className="text-[11px] text-red-500 mt-1" style={{ fontWeight: 500 }}>Trigger date is required to calculate the due date.</p>
                            ) : (
                              <p className="text-[11px] text-slate-400 mt-1 truncate">
                                {isAdv
                                  ? stage
                                    ? s.triggerDate
                                      ? `Covers the ${stage.percent}% stage. ${AR_TRIGGER_COPY[stage.trigger]}`
                                      : `${stage.trigger} has not happened yet. The due date fills in once it does.`
                                    : 'Pick a prepayment or split term to see the stage event.'
                                  : !s.triggerDate && s.triggerEvent !== 'Invoice Date'
                                    ? `No ${triggerEventLabel} on this order yet. Enter the trigger date.`
                                    : s.triggerTouched && s.triggerEvent === 'Invoice Date'
                                      ? 'Changed from the invoice date.'
                                      : `The ${triggerEventLabel}, set by the payment term. Editable.`}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Customer PO Number + Description (user 11/3: Due Date moved to
                        the rail under Payment Terms), then Treatment on a pre-invoice. */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {/* Customer PO Number, one per SO on a combined invoice
                          (FAD 11/2); the grid wraps any extras. */}
                      {(Object.keys(s.poBySo).length ? Object.keys(s.poBySo) : ['']).map((so) => {
                        const multi = Object.keys(s.poBySo).length > 1;
                        const value = so ? s.poBySo[so] ?? '' : s.customerPONumber;
                        return (
                          <div key={so || 'po'}>
                            <Label className={LABEL} style={{ fontWeight: 500 }}>
                              {multi ? `Customer PO Number · SO ${so}` : 'Customer PO Number'}
                              <FieldInfo>
                                {isAdv && ctx.quote && !ctx.so
                                  ? 'Blank when billing from a quote. Printed on the invoice.'
                                  : isSA
                                    ? "The customer's own reference for this charge. Printed on the invoice."
                                    : "The customer's purchase order number, from the sales order. Printed on the invoice."}
                              </FieldInfo>
                            </Label>
                            <Input
                              value={value}
                              maxLength={100}
                              onChange={(e) => (so ? set({ poBySo: { ...s.poBySo, [so]: e.target.value } }) : set({ customerPONumber: e.target.value }))}
                              placeholder="e.g. CPO-8841"
                              className="mt-1 rounded-lg !h-10 text-sm text-foreground placeholder:text-slate-400 bg-white border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                          </div>
                        );
                      })}
                      {/* Description beside Customer PO Number (user 11/3), one
                          its usual height, half width to keep the card short. */}
                      <div>
                        <Label className={LABEL} style={{ fontWeight: 500 }}>
                          Description
                        </Label>
                        <div className="mt-1">
                          <ExpandableTextarea value={s.description} onChange={(v) => set({ description: v })} placeholder="Enter a description, like the order or project this invoice covers." expandMode="full" hideCounter />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </section>

              {isAdv && <RevenueTreatmentCard id={fid.treatment} treat={treat} onPick={(v) => set({ treatment: v, treatmentTouched: true })} />}

              {isSA ? (
                <StandaloneLinesCard
                  lines={s.lines}
                  currency={cur}
                  lineMoney={totals.lineMoney}
                  attempted={attempted}
                  hasError={hasError}
                  cardError={hasError(fid.lines)}
                  onChange={patchLine}
                  onAdd={() => setS((prev) => ({ ...prev, lines: [...prev.lines, blankStandaloneLine(prev.lines.length)] }))}
                  onAddTemplate={addTemplateLine}
                  onRemove={removeLines}
                  discount={earlyPay}
                />
              ) : (
                <SourceLinesCard
                  kind={isShip ? 'Shipment Invoice' : 'Advance Invoice'}
                  discount={isShip ? earlyPay : undefined}
                  tabs={tabs}
                  activeTab={activeTab}
                  onTab={setActiveTab}
                  lines={s.lines}
                  currency={cur}
                  customerName={ctx.customerName}
                  shipAvail={shipAvail}
                  advCap={advAvail.perLine}
                  lineMoney={totals.lineMoney}
                  ratioBySo={ratioBySo}
                  canChangePrice={perms.canChangePrice}
                  termLocked={termConflict}
                  stagePill={stage && s.termApplied ? `Stage ${stage.index} of ${allStages.length} · ${stage.percent}%` : undefined}
                  hasError={hasError}
                  cardError={hasError(fid.lines)}
                  onQty={(key, n) => patchLine(key, { invoiceQty: n })}
                  onPrice={(key, n) => patchLine(key, { unitPrice: n })}
                  onAdvance={(key, patch) => patchLine(key, patch)}
                  onRemoveLines={removeLines}
                  onRemoveTab={(tabKey) => setS((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.shipmentNumber !== tabKey) }))}
                  onAddMore={isShip && !editInvoice ? () => setAddMoreOpen(true) : undefined}
                  prepay={isShip && heldDeposits.length > 0 ? { values: linePrepay, maxFor: prepayMaxFor, onChange: setLinePrepay } : undefined}
                  prepayCaption={prepayCaption}
                  lockedUnits={advRevenue ? { byLine: lockedUnitsByLine(ctx, s), onChange: (key, units) => patchLine(key, { lockedUnits: units }) } : undefined}
                  orderedLeft={orderedLeft}
                  duplicates={duplicates}
                  manual={
                    isShip
                      ? {
                          currency: cur,
                          onAdd: () => setS((prev) => ({ ...prev, lines: [...prev.lines, blankManualLine(prev.lines.length)] })),
                          onChange: patchLine,
                          onRemove: (key) => removeLines([key]),
                        }
                      : undefined
                  }
                />
              )}
              {isSA && <div className="h-6" />}
            </div>
          </div>

          {/* RIGHT SECTION (30%) */}
          <div className="w-[30%] bg-[#FAFBFC] flex flex-col overflow-hidden border-l border-[#EEF2F6]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              <Accordion type="multiple" value={expanded} onValueChange={setExpanded} className="space-y-2.5">
                {/* Section 1: General Information */}
                <AccordionItem value="general-info" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-2.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                        <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>General Information</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Invoice ID */}
                      <div className="space-y-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 cursor-help w-fit">
                              <Label className={RAIL_LABEL} style={{ fontWeight: 500 }}>Invoice ID</Label>
                              <Info className="w-2.5 h-2.5 text-gray-300" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                            <p className="text-[11px] text-slate-500 leading-snug">Omne's own reference for this invoice, the number the customer sees. Assigned automatically and can't be changed.</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block w-full cursor-not-allowed">
                              <Input
                                value={ctx.invoiceNumber}
                                readOnly
                                aria-disabled="true"
                                className="h-9 bg-slate-50 border-slate-200 text-[11px] text-slate-500 cursor-not-allowed pointer-events-none shadow-none disabled:opacity-100 w-full"
                                style={{ fontWeight: 600 }}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                            <p className="text-[11px] text-slate-500 leading-snug">Omne's own reference for this invoice, the number the customer sees. Assigned automatically and can't be changed.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Due Date (user 11/3): read-only, right under Invoice ID.
                          The vendor field shape (11/4): locked input, tooltip only. */}
                      <div className="space-y-1.5">
                        <Label className={`${RAIL_LABEL} flex items-center gap-1`} style={{ fontWeight: 500 }}>
                          Due Date
                          <FieldInfo width={260}>The trigger date plus the payment term days. It updates when either changes.</FieldInfo>
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative cursor-not-allowed">
                              <Input
                                value={dueDate ? formatUsDate(dueDate) : ''}
                                placeholder="Set by trigger date"
                                readOnly
                                aria-disabled="true"
                                className="h-9 bg-slate-50 border-slate-200 text-[11px] text-slate-500 cursor-not-allowed pointer-events-none shadow-none disabled:opacity-100 w-full placeholder:text-slate-400"
                                style={{ fontWeight: 600 }}
                              />
                              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Auto-Calculated</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                              {dueDate
                                ? "Due date is the trigger date plus the term days from the customer's payment terms. Change either of those to recompute it."
                                : 'Enter the trigger date to calculate the due date.'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* A/R Account, or Customer Deposit Account on a Deposit advance
                          (a Revenue advance books A/R, FAD 11/2) */}
                      {advDeposit ? (
                        <div className="space-y-1.5" id={fid.depositAccount}>
                          <Label className={`${RAIL_LABEL} flex items-center gap-1`} style={{ fontWeight: 500 }}>
                          Customer Deposit Account
                          <FieldInfo width={260}>The liability account that holds money received on this advance until the goods ship.</FieldInfo>
                        </Label>
                          {settings.allowDepositOverride ? (
                            <Popover open={depositPickOpen} onOpenChange={setDepositPickOpen}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className={`w-full inline-flex items-center justify-between gap-2 h-9 px-2.5 rounded-md border text-[12px] transition-colors bg-white text-foreground hover:bg-primary/[0.03] hover:border-primary/40 ${
                                    hasError(fid.depositAccount) ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'
                                  }`}
                                  style={{ fontWeight: 500 }}
                                >
                                  <span className={`truncate ${s.depositAccount ? '' : 'italic text-slate-400'}`}>{s.depositAccount || 'No deposit account'}</span>
                                  <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-1 z-[260] bg-white border border-border rounded-xl" style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12)' }}>
                                {CUSTOMER_DEPOSIT_ACCOUNTS.map((account) => {
                                  const isSelected = s.depositAccount === account;
                                  return (
                                    <button
                                      key={account}
                                      type="button"
                                      onClick={() => {
                                        set({ depositAccount: account });
                                        setDepositPickOpen(false);
                                      }}
                                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                    >
                                      <span className={`text-[12px] flex-1 truncate ${isSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>{account}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                    </button>
                                  );
                                })}
                              </PopoverContent>
                            </Popover>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`w-full inline-flex items-center justify-between gap-2 h-9 px-2.5 rounded-md border bg-slate-50 text-[12px] text-slate-500 cursor-not-allowed ${
                                    hasError(fid.depositAccount) ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'
                                  }`}
                                  style={{ fontWeight: 500 }}
                                >
                                  <span className={`truncate ${s.depositAccount ? '' : 'italic text-red-500'}`}>{s.depositAccount || 'No deposit account'}</span>
                                  <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>From the customer profile</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Changing it here needs the company setting that allows a deposit account override.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {s.depositAccount ? (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>Money received on an advance is held here until the goods ship.</span>
                            </div>
                          ) : (
                            <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Set a customer deposit account on {ctx.customerName} first.</p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <Label className={`${RAIL_LABEL} flex items-center gap-1`} style={{ fontWeight: 500 }}>
                          A/R Account
                          <FieldInfo width={260}>The receivable account this invoice books to. It comes from the customer profile and can be changed here.</FieldInfo>
                        </Label>
                          {/* Never locked on creation (10/29): always pickable. */}
                          <button
                            id={fid.arAccount}
                            type="button"
                            onClick={() => setArModalOpen(true)}
                            className={`w-full inline-flex items-center justify-between gap-2 h-9 px-2.5 rounded-md border text-[12px] transition-colors bg-white text-foreground hover:bg-primary/[0.03] hover:border-primary/40 ${
                              hasError(fid.arAccount) ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'
                            }`}
                            style={{ fontWeight: 500 }}
                          >
                            <span className={`truncate ${s.arAccount ? '' : 'italic text-slate-400'}`}>{s.arAccount || 'No A/R account'}</span>
                            <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </button>
                          {s.arAccount ? (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                                {s.arAccount === customer?.arAccount ? "Auto-derived from this customer's profile." : 'Overridden for this invoice.'}
                              </span>
                            </div>
                          ) : (
                            <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Set an A/R account on {ctx.customerName} first.</p>
                          )}
                        </div>
                      )}

                      {/* Bill-To Address: the vendor payment flow's Pay From field
                          (user 11/4), opening the same picker modal. */}
                      <div className="space-y-1.5">
                        <Label className={`${RAIL_LABEL} flex items-center gap-1`} style={{ fontWeight: 500 }}>
                          Bill-To Address
                          <FieldInfo width={260}>Where the invoice is sent. Pick from the addresses saved on the customer profile.</FieldInfo>
                        </Label>
                        {customer && customer.addresses.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setBillToOpen(true)}
                            className="w-full inline-flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-foreground hover:bg-primary/[0.03] hover:border-primary/40 transition-colors"
                          >
                            <span className="flex items-center gap-2 min-w-0 text-left">
                              <span className="w-6 h-6 rounded-md bg-slate-50 text-slate-500 flex items-center justify-center shrink-0"><MapPin className="w-3.5 h-3.5" /></span>
                              <span className="flex flex-col leading-tight min-w-0">
                                <span className={`truncate text-[12px] ${billTo ? '' : 'text-slate-400'}`} style={{ fontWeight: 500 }}>{billTo ? billTo.label : 'Select address'}</span>
                                {billTo && <span className="text-[10px] text-slate-400 truncate">{addressLine(billTo)}</span>}
                              </span>
                            </span>
                            <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </button>
                        ) : (
                          <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center text-[12px] text-slate-400 italic">No saved addresses</div>
                        )}
                      </div>

                      {/* Currency */}
                      <div className="space-y-1.5">
                        <Label className={`${RAIL_LABEL} flex items-center gap-1`} style={{ fontWeight: 500 }}>
                          Currency
                          <FieldInfo width={260}>One currency per invoice. It comes from the sales order and locks once a line has an amount.</FieldInfo>
                        </Label>
                        {currencyLocked ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative cursor-not-allowed">
                                <Input
                                  value={cur}
                                  readOnly
                                  aria-disabled="true"
                                  className="h-9 bg-slate-50 border-slate-200 text-[11px] text-slate-500 cursor-not-allowed pointer-events-none shadow-none disabled:opacity-100 w-full"
                                  style={{ fontWeight: 600 }}
                                />
                                <Lock className="w-3.5 h-3.5 text-slate-300 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>One currency per invoice</p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                {isSA ? 'The currency locks once a line has an amount. Clear the line amounts to change it.' : 'One currency per invoice, taken from the sales order.'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <Select value={cur} onValueChange={(v) => set({ currency: v, fxRate: fxRateFor(v) })}>
                            <SelectTrigger className="h-9 w-full bg-white border-slate-200 text-[12px] shadow-none focus:ring-1 focus:ring-primary/20 focus:border-primary">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[300]">
                              {[...new Set([cur, ...CURRENCIES])].map((c) => (
                                <SelectItem key={c} value={c} className="text-[12px]">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {/* FAD 11/2: rate to the company currency at the invoice date. */}
                        {cur !== COMPANY_CURRENCY && (
                          <div id={fid.fxRate} className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                            <span style={{ fontWeight: 500 }}>Rate at invoice date: 1 {cur} =</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              aria-label={`${cur} to ${COMPANY_CURRENCY} rate`}
                              value={fxDraft ?? s.fxRate.toFixed(4)}
                              onFocus={() => setFxDraft(String(s.fxRate))}
                              onBlur={() => setFxDraft(null)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d.]/g, '');
                                const [i, ...d] = raw.split('.');
                                const clean = d.length ? `${i}.${d.join('').slice(0, 4)}` : i;
                                setFxDraft(clean);
                                set({ fxRate: Number(clean) || 0 });
                              }}
                              className={`h-7 w-[76px] px-2 text-right text-[11px] bg-white shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary ${
                                hasError(fid.fxRate) ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
                              }`}
                              style={{ fontWeight: 500 }}
                            />
                            <span style={{ fontWeight: 500 }}>{COMPANY_CURRENCY}</span>
                          </div>
                        )}
                      </div>

                      {/* Payment Terms: read-only card + Change, slice chips, BR-007 conflict strip */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className={`${RAIL_LABEL} flex items-center gap-1`} style={{ fontWeight: 500 }}>
                          Payment Terms
                          <FieldInfo width={260}>When the customer has to pay, inherited from the sales order or the customer profile.</FieldInfo>
                        </Label>
                          <button
                            type="button"
                            onClick={() => setTermModalOpen(true)}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            Change
                          </button>
                        </div>
                        {termConflict ? (
                          <div
                            id={fid.termGate}
                            className={`rounded-xl bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] border transition-colors ${termGateErr ? 'border-rose-300 ring-2 ring-rose-100' : 'border-amber-300'}`}
                          >
                            <div className={`flex items-start gap-2 border-b px-2.5 py-2 ${termGateErr ? 'bg-rose-50/80 border-rose-200' : 'bg-amber-50/80 border-amber-200'}`}>
                              <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-px ${termGateErr ? 'text-rose-600' : 'text-amber-600'}`} />
                              <p className={`text-[11px] leading-snug ${termGateErr ? 'text-rose-700' : 'text-amber-800'}`} style={{ fontWeight: 500 }}>
                                {ctx.so ? `SO ${ctx.so.soNumber}` : `Quote ${ctx.quote?.quoteNumber ?? ''}`} has a net term, which bills after shipping. An advance invoice needs a prepayment or split term. Use Change to pick one.
                              </p>
                            </div>
                            <div className="p-2">{termCard}</div>
                          </div>
                        ) : (
                          <div id={fid.stage} className={stageErr ? 'rounded-xl ring-2 ring-rose-100 border border-rose-300' : ''}>
                            {termCard}
                          </div>
                        )}
                        {stageErr && <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>{issues.find((i) => i.fieldId === fid.stage)?.message}</p>}
                        {isAdv && s.termApplied && stage && term?.category !== 'split' && (
                          <p className="text-[10px] text-slate-500 leading-tight">{stageLabel(stage, allStages.length)}</p>
                        )}
                      </div>

                    </div>
                  </AccordionContent>
                </AccordionItem>


                {/* Dispute: the vendor Payment Hold slot (user 11/4). Flag the
                    invoice as disputed by the customer, with the dispute type. */}
                <AccordionItem
                  value="dispute"
                  className={`border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${
                    hasError(fid.disputeReason) || hasError(fid.disputeDesc) ? 'border-red-300 ring-2 ring-red-100' : 'border-border'
                  }`}
                >
                  <AccordionTrigger className="hover:no-underline py-2.5 w-full group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-yellow-50 flex items-center justify-center">
                        <MessageSquareWarning className="w-3.5 h-3.5 text-yellow-700" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Dispute</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center cursor-help" onClick={(e) => e.stopPropagation()}>
                            <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px] z-[300]">
                          <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Dispute</p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            Flag that the customer questions this invoice, like a pricing or quantity disagreement, so it is followed up before it is collected.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Switch
                      checked={s.disputeOn}
                      onCheckedChange={(checked) => {
                        set({ disputeOn: checked, ...(checked ? {} : { disputeReason: '', disputeDescription: '' }) });
                        setExpanded((prev) => (checked ? (prev.includes('dispute') ? prev : [...prev, 'dispute']) : prev.filter((x) => x !== 'dispute')));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-90 mr-2"
                      aria-label="Dispute"
                    />
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-2 space-y-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Type
                        <span style={{ color: '#DC2626' }}>*</span>
                      </Label>
                      <Select value={s.disputeReason || undefined} onValueChange={(v) => set({ disputeReason: v, disputeOn: true })}>
                        <SelectTrigger
                          id={fid.disputeReason}
                          className={`h-9 w-full bg-white text-[12px] shadow-none focus:ring-1 focus:ring-primary/20 focus:border-primary ${hasError(fid.disputeReason) ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                        >
                          <SelectValue placeholder={<span className="text-slate-400">Select a reason…</span>} />
                        </SelectTrigger>
                        <SelectContent className="z-[300]">
                          {FLAG_REASONS.Disputed.map((r) => (
                            <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hasError(fid.disputeReason) && <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Select a dispute type.</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Description
                        {s.disputeReason === 'Other' && <span style={{ color: '#DC2626' }}>*</span>}
                      </Label>
                      <Textarea
                        id={fid.disputeDesc}
                        placeholder="Describe what the customer disputes…"
                        value={s.disputeDescription}
                        onChange={(e) => set({ disputeDescription: e.target.value })}
                        className={`min-h-[68px] text-[11px] bg-white shadow-none resize-none placeholder:text-[11px] placeholder:text-slate-400 ${
                          hasError(fid.disputeDesc) ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary'
                        }`}
                        style={{ fontWeight: 400 }}
                      />
                      {hasError(fid.disputeDesc) && <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Description is required for an "Other" dispute.</p>}
                    </div>
                    <div className="pt-0.5">
                      <SearchableUserPicker
                        selectedIds={disputeNotify}
                        onSelectionChange={setDisputeNotify}
                        accentColor="#A16207"
                        accentBg="#FEFCE8"
                        accentBorder="#FEF08A"
                        accentText="#A16207"
                        label="Notify on Dispute"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                        Supporting Documents
                      </Label>
                      <input
                        type="file"
                        id="customer-dispute-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setDisputeDocs((prev) => [...prev, { name: file.name }]);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('customer-dispute-upload')?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Upload className="w-4 h-4 text-slate-500" />
                        </span>
                        <span className="text-[11px] text-slate-600 mt-1" style={{ fontWeight: 500 }}>
                          <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                        </span>
                        <span className="text-[10px] text-slate-400">PDF, DOC, XLS, PNG, JPG up to 10MB</span>
                      </button>
                      {disputeDocs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {disputeDocs.map((file, idx) => (
                            <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                              <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                              <span className="truncate max-w-[140px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => setDisputeDocs((prev) => prev.filter((_, i) => i !== idx))}
                                className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                aria-label={`Remove ${file.name}`}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Exception: the vendor Exception accordion (user 11/4). A
                    customer dispute is marked from the invoice after it is sent. */}
                <AccordionItem
                  value="flag"
                  className={`border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${
                    hasError(fid.flagReason) || hasError(fid.flagDesc) ? 'border-red-300 ring-2 ring-red-100' : 'border-border'
                  }`}
                >
                  <AccordionTrigger className="hover:no-underline py-2.5 w-full group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Exception</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center cursor-help" onClick={(e) => e.stopPropagation()}>
                            <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[300px] z-[300]">
                          <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Exception</p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            Flag an issue on this invoice, like a quantity or price mismatch, so it is looked at before it is settled.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Switch
                      checked={s.flagOn}
                      onCheckedChange={(checked) => {
                        set({ flagOn: checked, ...(checked ? {} : { flagReason: '', flagDescription: '' }) });
                        setExpanded((prev) => (checked ? (prev.includes('flag') ? prev : [...prev, 'flag']) : prev.filter((x) => x !== 'flag')));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-90 mr-2"
                      aria-label="Exception"
                    />
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-2 space-y-3.5">
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Type
                        <span style={{ color: '#DC2626' }}>*</span>
                      </Label>
                      <Select value={s.flagReason || undefined} onValueChange={(v) => set({ flagReason: v, flagOn: true })}>
                        <SelectTrigger
                          id={fid.flagReason}
                          className={`h-9 w-full bg-white text-[12px] shadow-none focus:ring-1 focus:ring-primary/20 focus:border-primary ${hasError(fid.flagReason) ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                        >
                          <SelectValue placeholder={<span className="text-slate-400">Select a reason…</span>} />
                        </SelectTrigger>
                        <SelectContent className="z-[300]">
                          {FLAG_REASONS[s.flagKind].map((r) => (
                            <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hasError(fid.flagReason) && <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Select an exception type.</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Description
                        {s.flagReason === 'Other' && <span style={{ color: '#DC2626' }}>*</span>}
                      </Label>
                      <Textarea
                        id={fid.flagDesc}
                        placeholder="Describe the issue so reviewers can act on it…"
                        value={s.flagDescription}
                        onChange={(e) => set({ flagDescription: e.target.value })}
                        className={`min-h-[68px] text-[11px] bg-white shadow-none resize-none placeholder:text-[11px] placeholder:text-slate-400 ${
                          hasError(fid.flagDesc) ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary'
                        }`}
                        style={{ fontWeight: 400 }}
                      />
                      {hasError(fid.flagDesc) && <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Description is required for an "Other" exception.</p>}
                    </div>
                    <div className="pt-0.5">
                      <SearchableUserPicker
                        selectedIds={flagNotify}
                        onSelectionChange={setFlagNotify}
                        accentColor="#D97706"
                        accentBg="#FFFBEB"
                        accentBorder="#FDE68A"
                        accentText="#B45309"
                        label="Notify on Exception"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                        Supporting Documents
                      </Label>
                      <input
                        type="file"
                        id="customer-exception-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setFlagDocs((prev) => [...prev, { name: file.name }]);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('customer-exception-upload')?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Upload className="w-4 h-4 text-slate-500" />
                        </span>
                        <span className="text-[11px] text-slate-600 mt-1" style={{ fontWeight: 500 }}>
                          <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                        </span>
                        <span className="text-[10px] text-slate-400">PDF, DOC, XLS, PNG, JPG up to 10MB</span>
                      </button>
                      {flagDocs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {flagDocs.map((file, idx) => (
                            <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                              <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                              <span className="truncate max-w-[140px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => setFlagDocs((prev) => prev.filter((_, i) => i !== idx))}
                                className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                aria-label={`Remove ${file.name}`}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Additional Charges */}
                {!isAdv && (
                  <AccordionItem value="charges" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                    <AccordionTrigger className="hover:no-underline py-2.5 group">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-orange-50 flex items-center justify-center">
                          <DollarSign className="w-3.5 h-3.5 text-orange-600" />
                        </div>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Additional Charges</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-2">
                      <div className="space-y-2.5">
                        {s.charges.map((c) => {
                          const typeErr = hasError(fid.chargeType(c.key));
                          const descErr = hasError(fid.chargeDesc(c.key));
                          const acctErr = hasError(fid.chargeAcct(c.key));
                          return (
                            <div
                              key={c.key}
                              className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-amber-200 hover:shadow-[0_4px_12px_-4px_rgba(245,158,11,0.10)] animate-in fade-in slide-in-from-top-1 duration-200"
                            >
                              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-100" style={{ background: 'linear-gradient(90deg, #FFF7ED 0%, #FFFBEB 100%)' }}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-4 h-4 rounded bg-white border border-orange-100 flex items-center justify-center shrink-0">
                                    <DollarSign className="w-2.5 h-2.5 text-orange-600" />
                                  </div>
                                  <span className={`text-[11px] truncate ${c.type ? 'text-foreground' : 'text-slate-400 italic'}`} style={{ fontWeight: 600 }}>
                                    {c.type ? chargeLabel(c.type) : 'New Charge'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => set({ charges: s.charges.filter((x) => x.key !== c.key) })}
                                  className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-md text-slate-400 transition-colors hover:text-red-500 hover:bg-red-50"
                                  aria-label="Delete charge"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="p-2.5 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1 min-w-0">
                                    <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Type</Label>
                                    <Select value={c.type || undefined} onValueChange={(v) => setChargeType(c, v as CustomerChargeType)}>
                                      <SelectTrigger
                                        id={fid.chargeType(c.key)}
                                        className={`h-9 w-full bg-white text-[11px] shadow-none focus:ring-1 focus:ring-primary/20 focus:border-primary ${typeErr ? 'border-red-400 ring-1 ring-red-100' : 'border-slate-200'}`}
                                      >
                                        <SelectValue placeholder={<span className="text-slate-400">Select</span>} />
                                      </SelectTrigger>
                                      <SelectContent className="z-[300]">
                                        {/* Sales tax is a charge row (user 11/4), 2300 Sales Tax Payable. */}
                                        {CHARGE_TYPES.map((t) => (
                                          <SelectItem key={t} value={t} className="text-[12px]">{chargeLabel(t)}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Amount</Label>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]" style={{ fontWeight: 500 }}>$</span>
                                      <MoneyInput
                                        fluid
                                        value={c.amount || 0}
                                        onValueChange={(n) => patchCharge(c.key, { amount: n })}
                                        className="flex h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white pl-5 pr-2 py-1 text-[11px] shadow-none text-right font-medium outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-slate-300"
                                        placeholder="0.00"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>GL Account</Label>
                                  <GLAccountPicker
                                    id={fid.chargeAcct(c.key)}
                                    heightClass="h-9"
                                    value={c.account}
                                    defaultValue={c.type ? CHARGE_DEFAULT_ACCOUNT[c.type] : ''}
                                    accounts={CHARGE_ACCOUNTS}
                                    onChange={(next) => patchCharge(c.key, { account: next })}
                                    error={acctErr}
                                  />
                                </div>
                                {c.type === 'Other' && (
                                  <div className="space-y-1">
                                    <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>
                                      Description<span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                      id={fid.chargeDesc(c.key)}
                                      value={c.description}
                                      onChange={(e) => patchCharge(c.key, { description: e.target.value })}
                                      placeholder="What is this charge for?"
                                      className={`h-8 bg-white text-[11px] shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-slate-300 ${
                                        descErr ? 'border-red-400 ring-1 ring-red-100' : 'border-slate-200'
                                      }`}
                                      style={{ fontWeight: 500 }}
                                    />
                                    {descErr && <p className="text-[10px] text-red-500" style={{ fontWeight: 500 }}>Describe the charge, "Other" needs context.</p>}
                                  </div>
                                )}
                                {typeErr && <p className="text-[10px] text-red-500" style={{ fontWeight: 500 }}>Pick a charge type.</p>}
                              </div>
                            </div>
                          );
                        })}
                        {s.charges.length === 0 && (
                          <p className="text-[11px] text-slate-400 text-center py-1" style={{ fontWeight: 500 }}>
                            No additional charges. Add one below to get started.
                          </p>
                        )}
                        {s.charges.length < 5 && (
                          <button
                            type="button"
                            onClick={() => set({ charges: [...s.charges, newCharge(s.charges.length)] })}
                            className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-slate-300 bg-white text-[11px] text-slate-500 hover:border-primary/50 hover:bg-accent/50 hover:text-amber-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                            style={{ fontWeight: 500 }}
                          >
                            <Plus className="w-3 h-3" />
                            {s.charges.length === 0 ? 'Add Charge' : 'Add Another'}
                          </button>
                        )}
                        <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
                          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Total Additional Charges</span>
                          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{money(totals.charges, cur)}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Freight & Logistics */}
                {!isAdv && (
                  <AccordionItem value="freight" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                    <AccordionTrigger className="hover:no-underline py-2.5 group">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center">
                          <Truck className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Freight &amp; Logistics</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-2 space-y-3">
                      {isShip &&
                        tabs.map((tab) => {
                          const sh = ctx.shipments.find((x) => x.shipmentNumber === tab.number);
                          if (!sh) return null;
                          return (
                            <div key={sh.shipmentNumber} className="space-y-1.5">
                              <Label className={RAIL_LABEL} style={{ fontWeight: 500 }}>Carrier</Label>
                              <CarrierCard carrier={carrierFor(sh.carrier, sh.shipmentNumber)} isSelected hideCheckmark readOnly showStatusBadge />
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>From shipment {sh.shipmentNumber}.</span>
                              </div>
                            </div>
                          );
                        })}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5 min-w-0">
                          <Label className={RAIL_LABEL} style={{ fontWeight: 500 }}>Freight Charges</Label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]" style={{ fontWeight: 500 }}>$</span>
                            <MoneyInput
                              fluid
                              value={s.freightAmount || 0}
                              onValueChange={(n) => set({ freightAmount: n })}
                              className="flex h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white pl-6 pr-2.5 py-1 text-[12px] shadow-none text-right font-medium outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <Label className={RAIL_LABEL} style={{ fontWeight: 500 }}>GL Account</Label>
                          <GLAccountPicker
                            id={fid.freightAccount}
                            heightClass="h-9"
                            value={s.freightAccount}
                            defaultValue={FREIGHT_INCOME_ACCOUNT}
                            accounts={REVENUE_ACCOUNTS}
                            onChange={(next) => set({ freightAccount: next })}
                            error={hasError(fid.freightAccount)}
                          />
                        </div>
                      </div>
                      {/* FAD 11/2 (proposed): on a partly shipped order, freight
                          lands on the first invoice for that order. */}
                      {isShip &&
                        freightSources.map((f) =>
                          f.billedOn ? (
                            <div key={f.soNumber} className="flex items-start gap-1.5">
                              <Info className="w-3 h-3 text-slate-400 shrink-0 mt-px" />
                              <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                                SO {f.soNumber} freight already billed on{' '}
                                <a
                                  href={`/customer-invoices/${encodeURIComponent(f.billedOn)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-700 hover:text-primary hover:underline"
                                >
                                  {f.billedOn}
                                </a>
                                .
                              </span>
                            </div>
                          ) : f.amount > EPS ? (
                            <div key={f.soNumber} className="flex items-start gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-px" />
                              <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                                {money(f.amount, cur)} from SO {f.soNumber}, billed on the first invoice for this order.
                              </span>
                            </div>
                          ) : null,
                        )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* GL Impact */}
                <AccordionItem value="gl-impact" className="border border-border rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-2.5 px-3.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>GL Impact</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0 pt-0">
                    <div id="cif-gl">
                      {advDeposit ? (
                        (() => {
                          const dep = splitGlAccount(s.depositAccount || CUSTOMER_DEPOSITS_ACCOUNT);
                          return (
                            <div className="px-3.5 pb-3.5">
                              <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                                <p className="text-[11px] text-violet-900" style={{ fontWeight: 600 }}>No GL impact yet</p>
                                <p className="text-[11px] text-violet-800/80 leading-snug mt-0.5">
                                  Revenue on shipment: this advance invoice posts as a pre-invoice and nothing reaches revenue. The first entry posts when the customer pays, into customer prepayment.
                                </p>
                                {treat.note && <p className="text-[11px] text-amber-700 leading-snug mt-1">{treat.note}</p>}
                              </div>
                              <p className="text-[10px] text-slate-400 mt-3 mb-1.5" style={{ fontWeight: 600 }}>At Payment · Preview</p>
                              <div className="rounded-lg border border-slate-200 overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                                  <span className="text-[11px]">
                                    <span className="inline-flex px-1.5 py-px rounded text-[9px] bg-blue-50 text-blue-700 mr-1.5" style={{ fontWeight: 700 }}>Debit</span>
                                    <span className="text-[10px] text-slate-400 mr-1">1000</span>
                                    <span className="text-slate-700" style={{ fontWeight: 500 }}>Cash / Bank</span>
                                  </span>
                                  <span className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>{money(totals.total, cur)}</span>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2">
                                  <span className="text-[11px]">
                                    <span className="inline-flex px-1.5 py-px rounded text-[9px] bg-slate-100 text-slate-600 mr-1.5" style={{ fontWeight: 700 }}>Credit</span>
                                    <span className="text-[10px] text-slate-400 mr-1">{dep.code}</span>
                                    <span className="text-slate-700" style={{ fontWeight: 500 }}>{dep.name}</span>
                                  </span>
                                  <span className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>{money(totals.total, cur)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="border-t border-border bg-white">
                          {glPreview.map((row, idx) => {
                            const isDr = (row.debit ?? 0) > 0 || row.credit === undefined;
                            return (
                              <div key={`${row.code}-${idx}`}>
                                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className="inline-flex items-center px-1.5 h-[18px] rounded-md text-[10px] tracking-wide cursor-help"
                                        style={isDr ? { fontWeight: 700, backgroundColor: '#EBF3FF', color: '#0654BC' } : { fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569' }}
                                      >
                                        {isDr ? 'DEBIT' : 'CREDIT'}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[240px] z-[300]">
                                      <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>{isDr ? 'Debit (Dr)' : 'Credit (Cr)'}</p>
                                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                        {isDr
                                          ? 'Increases an asset account or clears a liability. Here it books the receivable from the customer, or releases a deposit.'
                                          : 'Increases a revenue or liability account. The invoice recognizes revenue for the goods, freight and charges billed.'}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{row.code}</span>
                                  <span className="text-[12px] text-foreground flex-1 min-w-0" style={{ fontWeight: 500 }}>
                                    {row.name}
                                    {'note' in row && row.note ? <span className="block text-[10px] text-slate-400" style={{ fontWeight: 400 }}>{row.note}</span> : null}
                                  </span>
                                  <span className="text-[12px] text-foreground shrink-0" style={{ fontWeight: 600 }}>{money(isDr ? row.debit ?? 0 : row.credit ?? 0, cur)}</span>
                                </div>
                                <div className="h-px bg-border/60 mx-3.5" />
                              </div>
                            );
                          })}
                          <div
                            className="flex items-center justify-between px-3.5 py-1.5 border-t"
                            style={gl.balanced ? { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' } : { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
                          >
                            <div className="flex items-center gap-1.5">
                              {gl.balanced ? <CheckCircle2 className="w-3 h-3" style={{ color: '#059669' }} /> : <AlertTriangle className="w-3 h-3" style={{ color: '#B45309' }} />}
                              <span className="text-[10px] tracking-wide" style={{ fontWeight: 600, color: gl.balanced ? '#047857' : '#92400E' }}>
                                {gl.balanced ? 'Balanced' : 'Out of Balance'}
                              </span>
                            </div>
                            <span className="text-[10px]" style={{ fontWeight: 500, color: gl.balanced ? '#047857' : '#92400E' }}>Debit = Credit</span>
                          </div>
                          {releaseNote && <p className="px-3.5 py-2 text-[10px] text-slate-500 leading-snug border-t border-slate-100">{releaseNote}</p>}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>


                {/* Notes to Customer: moved off the header into the rail (10/30)
                    so the header stays short. Printed on the invoice. */}
                <AccordionItem value="notes" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-2.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-sky-50 flex items-center justify-center">
                        <StickyNote className="w-3.5 h-3.5 text-sky-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Notes to Customer</span>
                      {s.notesToCustomer.trim() && !expanded.includes('notes') && (
                        <span className="text-[11px] text-slate-400 truncate max-w-[140px]" style={{ fontWeight: 400 }}>{s.notesToCustomer.trim()}</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1">
                    <ExpandableTextarea value={s.notesToCustomer} onChange={(v) => set({ notesToCustomer: v })} placeholder="A note printed on the invoice." expandMode="full" />
                  </AccordionContent>
                </AccordionItem>

                {/* Attachments */}
                <AccordionItem value="attachments" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-2.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                        <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Attachments</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1">
                    <div className="space-y-3">
                      <input
                        type="file"
                        id="customer-invoice-attachments-upload"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
                            if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) setAttachmentError(`${file.name} is not an accepted type. Use PDF, JPG or PNG.`);
                            else if (file.size > 10 * 1024 * 1024) setAttachmentError(`${file.name} is over the 10 MB limit.`);
                            else {
                              setAttachmentError(null);
                              set({ attachments: [...s.attachments, { name: file.name, size: file.size }] });
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => document.getElementById('customer-invoice-attachments-upload')?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') document.getElementById('customer-invoice-attachments-upload')?.click();
                        }}
                        className="border-2 border-dashed border-border/60 rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:bg-blue-50/50 hover:border-blue-100 cursor-pointer transition-all group/upload"
                      >
                        <Upload className="w-6 h-6 text-gray-300 group-hover/upload:text-blue-500 group-hover/upload:scale-110 transition-all" />
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-muted-foreground">Attach Supporting Documents</p>
                          <p className="text-[8px] text-muted-foreground/70 font-medium mt-0.5">PDF, JPG, or PNG up to 10MB</p>
                        </div>
                      </div>
                      {attachmentError && <p className="text-[11px] text-red-600 -mt-1" style={{ fontWeight: 500 }}>{attachmentError}</p>}
                      {s.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {s.attachments.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 border border-border/60 rounded text-[9px] font-medium text-muted-foreground group/attachment w-full justify-between"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Paperclip className="w-2.5 h-2.5 text-muted-foreground/70 shrink-0" />
                                <span className="truncate">{file.name}</span>
                                {file.size !== undefined && <span className="shrink-0 text-muted-foreground/70">· {fmtFileSize(file.size)}</span>}
                                {file.fromShipment && (
                                  <span className="inline-flex items-center px-1 py-px rounded bg-primary/[0.06] text-primary border border-primary/15 text-[9px] shrink-0" style={{ fontWeight: 500 }}>
                                    From Shipment
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  set({ attachments: s.attachments.filter((_, i) => i !== idx) });
                                }}
                                className="ml-0.5 p-0.5 hover:bg-gray-200 rounded-sm text-muted-foreground/70 hover:text-red-500 transition-colors shrink-0"
                                aria-label={`Remove ${file.name}`}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <div className="h-10" />
            </div>

            {/* Footer: breakdown + Total Due + CTAs */}
            <div className="px-3 sm:px-4 lg:px-5 py-3 border-t border-[#EEF2F6] bg-white shrink-0 sticky bottom-0 z-10">
              <div className="mb-3 px-0.5">
                <button
                  type="button"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer mb-2"
                  style={{ fontWeight: 500 }}
                >
                  {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}
                </button>
                <div
                  className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{ gridTemplateRows: showBreakdown ? '1fr' : '0fr', opacity: showBreakdown ? 1 : 0 }}
                  aria-hidden={!showBreakdown}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1.5 pb-2">
                      {isAdv ? (
                        <>
                          <BreakRow label="Order Total" value={money(advAvail.orderTotal, cur)} />
                          <BreakRow label="Already Advance-Billed" value={money(advAvail.alreadyBilled, cur)} />
                          {stage && (
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-amber-700" style={{ fontWeight: 500 }}>{`This Stage · ${stage.percent}% at ${stage.trigger}`}</span>
                              <span className="text-[12px] text-amber-700" style={{ fontWeight: 600 }}>{money(totals.total, cur)}</span>
                            </div>
                          )}
                          <BreakRow label="Left on Order" value={money(Math.max(0, advLeft), cur)} />
                          <p className="text-[10.5px] text-slate-400 leading-snug">The rest is billed on shipment invoices, and nothing is billed twice.</p>
                        </>
                      ) : (
                        <>
                          <BreakRow label="Subtotal" value={money(totals.grossSubtotal, cur)} />
                          {totals.advanceRefs.map((r) => (
                            <div key={r.invoiceNumber} className="flex justify-between items-center">
                              <span className="text-[11px] text-violet-700" style={{ fontWeight: 500 }}>Billed on advance · {r.invoiceNumber}</span>
                              <span className="text-[12px] text-violet-700" style={{ fontWeight: 600 }}>−{money(r.amount, cur)}</span>
                            </div>
                          ))}
                          <BreakRow label="Freight" value={money(totals.freight, cur)} />
                          {s.charges.map(
                            (c) =>
                              c.amount > 0 && <BreakRow key={c.key} label={c.type ? chargeLabel(c.type) : 'Charge'} value={money(c.amount, cur)} />,
                          )}
                          {heldDeposits.map((d) =>
                            (s.depositAmounts[d.id] ?? 0) > EPS ? (
                              <div key={d.id} className="flex justify-between items-center">
                                <span className="text-[11px] text-violet-700" style={{ fontWeight: 500 }}>
                                  {d.soNumber ? `Deposit taken on SO ${d.soNumber}` : 'On-account deposit'} · {d.depositNumber}
                                </span>
                                <span className="text-[12px] text-violet-700" style={{ fontWeight: 600 }}>−{money(s.depositAmounts[d.id], cur)}</span>
                              </div>
                            ) : null,
                          )}
                          {totals.advanceRefs.length > 0 && (
                            <p className="text-[10.5px] text-slate-400 leading-snug">The advance share was billed earlier. It is released from Customer Deposits, not charged again.</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-2.5 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>Total Due</span>
                  <span className="text-[14px] text-foreground leading-none tracking-tight" style={{ fontWeight: 600 }}>{money(totalDue, cur)}</span>
                </div>
                {/* FAD 11/2: the same total in the company currency. */}
                {cur !== COMPANY_CURRENCY && s.fxRate > 0 && (
                  <div className="flex justify-end mt-1">
                    <span className="text-[11px] text-slate-400" style={{ fontWeight: 400 }}>
                      ≈ {COMPANY_CURRENCY} {(round2(totalDue * s.fxRate)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at {s.fxRate.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Three CTAs in the vendor's two-CTA space (10/29): one row,
                  never wrapping; Save Draft folds to an icon with a
                  tooltip when the rail is narrow. */}
              <div className="flex flex-nowrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiscard(true)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                  }}
                  className="inline-flex items-center justify-center h-9 rounded-lg px-4 text-[13px] border border-slate-200 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
                >
                  Cancel
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      aria-label="Save Draft"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }}
                      className="inline-flex items-center justify-center gap-1.5 h-9 w-9 2xl:w-auto 2xl:px-3.5 rounded-lg text-[13px] border border-slate-200 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                      style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
                    >
                      <Save className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="hidden 2xl:inline">Save Draft</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="2xl:hidden px-2.5 py-1.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                    <p className="text-[11px] text-slate-600" style={{ fontWeight: 500 }}>Save Draft</p>
                  </TooltipContent>
                </Tooltip>
                <Button onClick={handlePrimary} className="bg-primary text-primary-foreground shrink-0 whitespace-nowrap">
                  {primaryMode === 'approve' ? <CheckCircle2 className="w-4 h-4 mr-1.5" /> : <SendHorizontal className="w-4 h-4 mr-1.5" />}
                  {primaryLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add More (vendor parity, 10/29): the shipment picker pinned to this
          customer, current shipments pre-ticked so only new picks add. */}
      {addMoreOpen && (
        <CustomerSelectionModalNested
          flow="shipment"
          customers={customers}
          invoices={invoices}
          initialCustomerName={ctx.customerName}
          initialShipments={[...new Set(s.lines.map((l) => l.shipmentNumber).filter((n): n is string => !!n))].map((shipmentNumber) => ({
            shipmentNumber,
            lineIds: s.lines.filter((l) => l.shipmentNumber === shipmentNumber && l.shipmentLineId).map((l) => l.shipmentLineId as string),
          }))}
          onClose={() => setAddMoreOpen(false)}
          onContinue={handleAddMore}
        />
      )}

      <ArTermBrowseModal
        open={termModalOpen}
        onOpenChange={setTermModalOpen}
        kind={kind}
        currentId={s.paymentTermId}
        inheritedId={inheritedTermId}
        kindConflict={termConflict}
        onApply={applyTerm}
      />

      {customer && (
          <BillToAddressModal
            open={billToOpen}
            onOpenChange={setBillToOpen}
            customerName={ctx.customerName}
            value={s.billToAddressId}
            addresses={customer.addresses}
            defaultId={customer.defaultBillToId}
            onApply={(id) => set({ billToAddressId: id })}
          />
        )}
      {arModalOpen && (
        <ArAccountModal
          open
          accounts={AR_ACCOUNTS}
          value={s.arAccount}
          defaultValue={defaultArAccount}
          onPick={(a) => set({ arAccount: a })}
          onClose={() => setArModalOpen(false)}
        />
      )}

      <ArSubmitConfirm
        open={!!confirmMode}
        onOpenChange={(v) => !v && setConfirmMode(null)}
        mode={confirmMode ?? primaryMode}
        isAdvance={advDeposit}
        advanceRevenue={advRevenue}
        treatmentNote={treat.note}
        isResubmit={isResubmit}
        isPendingEdit={isPendingEdit}
        termName={term?.name ?? 'payment'}
        currency={cur}
        total={totals.total}
        glRows={glRows}
        dr={gl.dr}
        cr={gl.cr}
        balanced={gl.balanced}
        priceChanges={priceChanges}
        releaseNote={releaseNote}
        depositAccount={s.depositAccount}
        onConfirm={handleConfirm}
      />

      <DestructiveConfirm
        open={showDiscard}
        chip="Discard"
        title={editInvoice ? 'Discard invoice changes?' : 'Discard invoice creation?'}
        body={editInvoice ? 'Your unsaved edits will be lost. The saved invoice remains unchanged.' : 'All the information you’ve entered will be lost. This action cannot be undone.'}
        confirmLabel="Discard Changes"
        onConfirm={() => {
          setShowDiscard(false);
          onClose();
        }}
        onCancel={() => setShowDiscard(false)}
      />

      <DestructiveConfirm
        open={showBack}
        chip="Go Back"
        title={isSA ? 'Go back and discard this invoice?' : isAdv ? 'Go back to order selection?' : 'Go back to shipment selection?'}
        body={
          isSA
            ? 'The invoice details you’ve entered will be discarded and you’ll return to customer selection. This cannot be undone.'
            : 'The invoice details you’ve entered will be discarded, and you’ll return to the selection step with your selection kept.'
        }
        confirmLabel="Discard and Go Back"
        onConfirm={() => {
          setShowBack(false);
          onBack?.();
        }}
        onCancel={() => setShowBack(false)}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `,
        }}
      />
    </div>,
    document.body,
  );
}

function BreakRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{label}</span>
      <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
