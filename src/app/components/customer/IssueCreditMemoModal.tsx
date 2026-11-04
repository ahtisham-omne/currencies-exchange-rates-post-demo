import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileText, Lock, Package, Receipt, Upload, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from '@/app/components/ui/alert-dialog';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { DiscardConfirm } from '@/app/components/ui/discard-guard';
import { formatMoneyText, MaxChip, MoneyInput } from '@/app/components/payments/MoneyInput';
import { NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { SYSTEM_ROLES, SYSTEM_USERS } from '@/app/data/systemUsers';
import { LineItemsTable } from '@/app/components/invoice-details/LineItemsTab';
import { ItemImageWithPreview } from '@/app/components/invoice-details/ItemQuickView';
import { highlightText } from '@/app/components/InvoiceDataTable';
import type { ColumnDef } from '@/app/components/data-table/types';
import { localTodayIso, formatUsDate } from '@/app/lib/dueBucket';
import type { CustomerInvoice, CustomerInvoiceCharge, CustomerInvoiceLine } from '@/app/data/ar/mockCustomerInvoices';
import type { Customer } from '@/app/data/ar/mockCustomers';
import {
  DEFAULT_REVENUE_ACCOUNT,
  FREIGHT_INCOME_ACCOUNT,
  REVENUE_ACCOUNTS,
  SALES_RETURNS_ACCOUNT,
  splitGlAccount,
} from '@/app/data/ar/arGlAccounts';
import { creditMemosFor, creditableRemaining, creditedQtyByLine } from '@/app/data/ar/arBilling';
import { treatmentOf } from '@/app/data/ar/customerInvoiceStatus';
import { useArPermissions } from '@/app/hooks/useArSettings';
import { AR_ACTING_USER, nextCustomerInvoiceNumber } from '@/app/hooks/useCustomerInvoicing';
import type { ArSaveMode, ArSaveResult } from './arCreateContract';

/* ════════════════════════════════════════════════════════════════════
   Issue Credit Memo: the AR inverse of the vendor AddCreditMemoModal.
   A vendor sends US a credit and we record their number; here WE issue
   the credit to the customer, numbered from our CRN- sequence, and what
   the customer owes (A/R) drops once it is approved.

   Same chrome as the vendor modal: 680px flat form dialog, context strip,
   one column, attachment last, pinned footer with a live "Credited after
   this" readout, and a GL confirm step before the commit.
   - By lines: credit quantity per invoice line, capped at invoiced minus
     already credited; freight and charges creditable up to the original.
   - By amount: one amount capped at what is still creditable, against
     one revenue account.
   - Return reason debits 4900 Sales Returns and Allowances and carries an
     optional RMA Number.
   - A credit memo on an Advance Invoice posts nothing (the advance never
     posted), mirroring the vendor pre-invoice credit.
   Over the cap never silently caps: rose ring + Max chip, submit refuses.
   Credit memos never change the parent's status (statuses are approval
   only); the parent's summary shows "Credited".
   ════════════════════════════════════════════════════════════════════ */

export interface IssueCreditMemoModalProps {
  /** The approved invoice being credited. */
  invoice: CustomerInvoice;
  allInvoices: CustomerInvoice[];
  customers: Customer[];
  /** Editing a Draft, Pending Approval or Rejected credit memo. */
  editCreditMemo?: CustomerInvoice;
  onClose: () => void;
  onSave: (result: ArSaveResult) => void;
}

type CreditReason = 'Return' | 'Price adjustment' | 'Billing error' | 'Goodwill' | 'Other';
const REASONS: Array<{ value: CreditReason; hint: string }> = [
  { value: 'Return', hint: 'Goods came back' },
  { value: 'Price adjustment', hint: 'Agreed lower price' },
  { value: 'Billing error', hint: 'Invoice was wrong' },
  { value: 'Goodwill', hint: 'Gesture to the customer' },
  { value: 'Other', hint: 'Needs a description' },
];

type Basis = 'lines' | 'amount';

const THEME = { bg: '#EBF3FF', solid: 'hsl(var(--primary))' };

const EPS = 0.004;
const r2 = (n: number) => Math.round(n * 100) / 100;

function money(n: number, currency: string) {
  return `${currency === 'USD' ? '$' : `${currency} `}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** What one unit of the line BILLED (after any advance coverage), so a
 *  full line credit never exceeds what the line put on the invoice. */
const billedUnit = (l: CustomerInvoiceLine) => (l.invoiceQty > 0 ? r2(l.total / l.invoiceQty) : l.unitPrice);

/** Whole-unit quantity field: never type=number (house rule). */
function QtyInput({ value, onChange, over }: { value: number; onChange: (n: number) => void; over: boolean }) {
  const [text, setText] = useState(value ? String(value) : '');
  // Programmatic updates (the Max chip) resync the visible text.
  useEffect(() => {
    if ((parseInt(text || '0', 10) || 0) !== value) setText(value ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      placeholder="0"
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        setText(digits);
        onChange(digits ? parseInt(digits, 10) : 0);
      }}
      className={`h-8 w-full rounded-md border bg-white pl-2.5 pr-11 text-[12px] text-right outline-none placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20 ${
        over ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200'
      }`}
    />
  );
}

function OverTip({ over, message, children }: { over: boolean; message: string; children: React.ReactNode }) {
  if (!over) return <>{children}</>;
  return (
    <Tooltip open delayDuration={0}>
      <TooltipTrigger asChild>
        <div>{children}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="z-[400] max-w-[240px] text-[11px]">{message}</TooltipContent>
    </Tooltip>
  );
}

export function IssueCreditMemoModal({ invoice, allInvoices, customers: _customers, editCreditMemo, onClose, onSave }: IssueCreditMemoModalProps) {
  const perms = useArPermissions();
  const edit = editCreditMemo;
  const currency = invoice.currency;
  const isAdvanceParent = invoice.docKind === 'Advance Invoice';
  // FAD 11/2: a Revenue pre-invoice posted revenue, so its credit memo
  // reverses it (Dr revenue, Cr A/R) and releases the locked units. A
  // Deposit pre-invoice posted nothing, so its credit memo posts nothing.
  const revenueAdvance = isAdvanceParent && treatmentOf(invoice) === 'Revenue';
  const postsNothing = isAdvanceParent && !revenueAdvance;
  const isStandalone = invoice.docKind === 'Standalone';
  const number = useMemo(() => edit?.invoiceNumber ?? nextCustomerInvoiceNumber(allInvoices, 'credit'), [edit, allInvoices]);

  // ── What is still creditable (own record excluded when editing) ──
  const remaining = creditableRemaining(invoice, allInvoices, edit?.id);
  const alreadyCredited = r2(invoice.amount - remaining);
  const creditedQty = useMemo(() => creditedQtyByLine(invoice, allInvoices, edit?.id), [invoice, allInvoices, edit?.id]);
  const priorMemos = useMemo(() => creditMemosFor(invoice.invoiceNumber, allInvoices).filter((m) => m.id !== edit?.id), [invoice, allInvoices, edit?.id]);
  const freightOriginal = Math.max(0, invoice.freightAmount ?? 0);
  const freightCap = Math.max(0, r2(freightOriginal - priorMemos.reduce((s, m) => s + Math.abs(m.freightAmount ?? 0), 0)));
  const chargeCap = (c: CustomerInvoiceCharge) =>
    Math.max(0, r2(c.amount - priorMemos.reduce((s, m) => s + Math.abs(m.charges.find((x) => x.id === c.id)?.amount ?? 0), 0)));
  const lineCap = (l: CustomerInvoiceLine) => Math.max(0, l.invoiceQty - (creditedQty.get(l.id) ?? 0));

  const lineAccountOptions = Array.from(new Set([...invoice.lines.map((l) => l.glAccount).filter(Boolean), ...(isStandalone ? REVENUE_ACCOUNTS : [])]));
  const defaultAccount = invoice.lines.find((l) => l.glAccount)?.glAccount || DEFAULT_REVENUE_ACCOUNT;

  // ── Form state (edit preloads the record) ──
  const initialBasis: Basis = edit?.creditBasis ?? (isAdvanceParent || invoice.lines.length === 0 ? 'amount' : 'lines');
  const [date, setDate] = useState(edit?.invoiceDate ?? localTodayIso());
  const [reason, setReason] = useState<CreditReason>((edit?.creditReason as CreditReason) ?? 'Price adjustment');
  const [basis, setBasis] = useState<Basis>(initialBasis);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    edit?.lines.forEach((l) => {
      if (l.creditOfLineId) m[l.creditOfLineId] = l.invoiceQty;
    });
    return m;
  });
  const [freightCredit, setFreightCredit] = useState(edit && edit.creditBasis === 'lines' ? Math.abs(edit.freightAmount ?? 0) : 0);
  const [chargeCredit, setChargeCredit] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    if (edit?.creditBasis === 'lines') edit.charges.forEach((c) => (m[c.id] = Math.abs(c.amount)));
    return m;
  });
  const [amount, setAmount] = useState(edit && edit.creditBasis === 'amount' ? Math.abs(edit.amount) : 0);
  const [amountText, setAmountText] = useState(edit && edit.creditBasis === 'amount' ? Math.abs(edit.amount).toFixed(2) : '');
  const [notify, setNotify] = useState(true);
  const [recipients, setRecipients] = useState<Set<string>>(new Set());
  const [account, setAccount] = useState(
    edit && edit.creditBasis === 'amount' && edit.lines[0]?.glAccount && edit.lines[0].glAccount !== SALES_RETURNS_ACCOUNT ? edit.lines[0].glAccount : defaultAccount,
  );
  const [rmaNumber, setRmaNumber] = useState(edit?.rmaNumber ?? '');
  const [description, setDescription] = useState(edit?.description ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [confirmMode, setConfirmMode] = useState<ArSaveMode | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const closingRef = useRef(false);
  const descRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);

  const isReturn = reason === 'Return';

  // ── Live totals ──
  const lineRows = invoice.lines.map((l) => {
    const q = qty[l.id] ?? 0;
    const cap = lineCap(l);
    return { line: l, q, cap, over: q > cap, credit: r2(q * billedUnit(l)) };
  });
  const chargeRows = invoice.charges.map((c) => {
    const v = chargeCredit[c.id] ?? 0;
    const cap = chargeCap(c);
    return { charge: c, v, cap, over: v > cap + EPS };
  });
  const freightOver = freightCredit > freightCap + EPS;
  const linesTotal = r2(lineRows.reduce((s, r) => s + r.credit, 0));
  const chargesTotal = r2(chargeRows.reduce((s, r) => s + r.v, 0));
  const total = basis === 'lines' ? r2(linesTotal + freightCredit + chargesTotal) : r2(amount);
  const totalOver = total > remaining + EPS;
  const amountOver = basis === 'amount' && amount > remaining + EPS;
  const anyLineOver = basis === 'lines' && (lineRows.some((r) => r.over) || chargeRows.some((r) => r.over) || freightOver);
  const descriptionMissing = reason === 'Other' && !description.trim();
  const creditedAfter = r2(alreadyCredited + total);

  const dirty =
    total > 0 || !!description.trim() || !!rmaNumber.trim() || !!file || recipients.size > 0 || reason !== ((edit?.creditReason as CreditReason) ?? 'Price adjustment');

  // ── GL (Dr revenue / returns / freight / charges, Cr A/R) ──
  const glLines = useMemo(() => {
    if (postsNothing) return [];
    const map = new Map<string, number>();
    const add = (acct: string, v: number) => v > EPS && map.set(acct, r2((map.get(acct) ?? 0) + v));
    if (basis === 'lines') {
      lineRows.forEach((r) => add(isReturn ? SALES_RETURNS_ACCOUNT : r.line.glAccount || DEFAULT_REVENUE_ACCOUNT, r.credit));
      add(invoice.freightAccount || FREIGHT_INCOME_ACCOUNT, freightCredit);
      chargeRows.forEach((r) => add(r.charge.account, r.v));
    } else {
      add(isReturn ? SALES_RETURNS_ACCOUNT : account, amount);
    }
    const rows = Array.from(map.entries()).map(([acct, v]) => ({ account: acct, debit: v, credit: 0 }));
    if (total > EPS) rows.push({ account: invoice.arAccount, debit: 0, credit: total });
    return rows;
  }, [postsNothing, basis, lineRows, chargeRows, freightCredit, amount, account, isReturn, total, invoice.arAccount, invoice.freightAccount]);

  // ── Build the credit memo record ──
  const build = (mode: ArSaveMode): CustomerInvoice => {
    const now = new Date().toISOString();
    const status = mode === 'draft' ? 'Draft' : mode === 'submit' ? 'Pending Approval' : 'Approved';
    let lines: CustomerInvoiceLine[];
    let charges: CustomerInvoiceCharge[] = [];
    let freight: number | undefined;
    if (basis === 'lines') {
      lines = lineRows
        .filter((r) => r.q > 0)
        .map((r, i) => ({
          ...r.line,
          id: `L${i + 1}`,
          invoiceQty: r.q,
          unitPrice: billedUnit(r.line),
          originalUnitPrice: undefined,
          grossTotal: undefined,
          advanceCovered: undefined,
          total: -r.credit,
          glAccount: postsNothing ? '' : isReturn ? SALES_RETURNS_ACCOUNT : r.line.glAccount || DEFAULT_REVENUE_ACCOUNT,
          creditOfLineId: r.line.id,
        }));
      charges = chargeRows.filter((r) => r.v > EPS).map((r) => ({ ...r.charge, amount: -r2(r.v) }));
      freight = freightCredit > EPS ? -r2(freightCredit) : undefined;
    } else {
      lines = [
        {
          id: 'L1',
          sku: '',
          description: `${reason} on ${invoice.invoiceNumber}`,
          uom: '',
          orderedQty: 0,
          invoiceQty: 1,
          unitPrice: r2(amount),
          total: -r2(amount),
          glAccount: postsNothing ? '' : isReturn ? SALES_RETURNS_ACCOUNT : account,
        },
      ];
    }
    return {
      id: edit?.id ?? `cinv-${number}`,
      invoiceNumber: number,
      docKind: 'Credit Memo',
      customer: invoice.customer,
      customerPONumber: invoice.customerPONumber,
      invoiceDate: date,
      createdDate: edit?.createdDate ?? localTodayIso(),
      // An advance never posted, so its credit memo posts nothing either.
      postingDate: postsNothing ? undefined : date,
      amount: -total,
      freightAmount: freight,
      freightAccount: freight ? invoice.freightAccount || FREIGHT_INCOME_ACCOUNT : undefined,
      charges,
      currency: invoice.currency,
      arAccount: invoice.arAccount,
      billToAddressId: invoice.billToAddressId,
      description: description.trim() || `${reason} credit on ${invoice.invoiceNumber}`,
      linkedSOs: [...invoice.linkedSOs],
      linkedShipments: [...invoice.linkedShipments],
      relatedInvoiceNumber: invoice.invoiceNumber,
      invoiceStatus: status,
      rejectionReason: edit?.rejectionReason,
      submittedBy: mode === 'draft' ? edit?.submittedBy : AR_ACTING_USER,
      submittedAt: mode === 'draft' ? edit?.submittedAt : now,
      approvedBy: mode === 'approve' ? AR_ACTING_USER : undefined,
      approvedAt: mode === 'approve' ? now : undefined,
      creditBasis: basis,
      creditReason: reason,
      rmaNumber: isReturn && rmaNumber.trim() ? rmaNumber.trim() : undefined,
      depositApplications: [],
      receipts: [],
      creditApplied: 0,
      lines,
      createdBy: edit?.createdBy ?? AR_ACTING_USER,
      updatedBy: edit ? AR_ACTING_USER : undefined,
      updatedDate: edit ? localTodayIso() : undefined,
      actionHistory: edit?.actionHistory,
    };
  };

  // ── Validation: never-disabled CTAs, the toast names the exact fix ──
  const validate = (): boolean => {
    setAttempted(true);
    if (!(total > EPS)) {
      linesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast.error('Nothing to credit yet', {
        description: basis === 'lines' ? 'Enter a credit quantity on at least one line, or credit freight or a charge.' : 'Enter the amount to credit.',
      });
      return false;
    }
    if (anyLineOver) {
      linesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const first = lineRows.find((r) => r.over);
      toast.error('A credit is above what is left', {
        description: first
          ? `You can credit up to ${first.cap} ${first.line.uom} on ${first.line.sku || 'this line'}. Use Max to fix it.`
          : 'Lower the highlighted freight or charge credit, or use Max to fix it.',
      });
      return false;
    }
    if (amountOver || totalOver) {
      linesRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast.error('Credit cannot exceed what is still creditable', {
        description: `You can credit up to ${money(remaining, currency)} on ${invoice.invoiceNumber}. Lower the credit, or use Max.`,
      });
      return false;
    }
    if (descriptionMissing) {
      descRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast.error('Description required', { description: '"Other" needs a description.' });
      return false;
    }
    return true;
  };

  const commit = (mode: ArSaveMode) => {
    closingRef.current = true;
    onSave({ invoice: build(mode), mode, isEdit: !!edit });
    setConfirmMode(null);
    onClose();
  };

  const submitMode: ArSaveMode = perms.canApprove ? 'approve' : 'submit';
  const handleDraft = () => validate() && commit('draft');
  const handleSubmit = () => validate() && setConfirmMode(submitMode);

  const basisLockReason = isAdvanceParent
    ? 'An advance bills a share of the order, so it is credited by amount.'
    : invoice.lines.length === 0
      ? 'This invoice has no lines.'
      : undefined;
  const creditableAfter = Math.max(0, r2(remaining - total));

  // ── Credit lines: the shared vendor LineItemsTable chrome (search,
  // count, full screen, density, columns) with the credit inputs in-cell.
  type CreditRow = (typeof lineRows)[number];
  const lineColumns: ColumnDef<CreditRow>[] = [
    {
      key: 'item', label: 'Item', minWidth: 200, defaultWidth: 240, align: 'left', locked: true, sticky: 'left', flex: true,
      getValue: (r) => r.line.sku || r.line.description,
      searchText: (r) => `${r.line.sku} ${r.line.description}`,
      render: (r, { searchQuery }) =>
        r.line.sku ? (
          <div className="flex items-start gap-3 py-1">
            <ItemImageWithPreview sku={r.line.sku} alt={r.line.sku} unitPrice={r.line.unitPrice} uom={r.line.uom} serialized={false} onPreview={() => {}} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-slate-900" style={{ fontWeight: 700 }}>{highlightText(r.line.sku, searchQuery)}</div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">{highlightText(r.line.description, searchQuery)}</div>
            </div>
          </div>
        ) : (
          <span className="text-[12px] text-slate-900 py-1" style={{ fontWeight: 700 }}>{highlightText(r.line.description, searchQuery)}</span>
        ),
    },
    {
      key: 'invoiced', label: 'Invoiced', minWidth: 90, defaultWidth: 100, sortable: true,
      getValue: (r) => r.line.invoiceQty,
      render: (r) => (
        <div>
          <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{r.line.invoiceQty}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{r.line.uom}</div>
        </div>
      ),
    },
    {
      key: 'credited', label: 'Already Credited', minWidth: 120, defaultWidth: 130, sortable: true,
      getValue: (r) => creditedQty.get(r.line.id) ?? 0,
      render: (r) => (
        <div>
          <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{creditedQty.get(r.line.id) ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{r.line.uom}</div>
        </div>
      ),
    },
    {
      key: 'creditQty', label: 'Credit Qty', minWidth: 130, defaultWidth: 140,
      getValue: (r) => r.q,
      render: (r) => (
        <OverTip over={r.over} message={`You can credit up to ${r.cap} ${r.line.uom} on this line.`}>
          <div className="relative" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <QtyInput value={r.q} over={r.over} onChange={(n) => setQty((m) => ({ ...m, [r.line.id]: n }))} />
            <MaxChip onClick={() => setQty((m) => ({ ...m, [r.line.id]: r.cap }))} atMax={r.q === r.cap} over={r.over} title={`Credit all ${r.cap} left`} />
          </div>
        </OverTip>
      ),
    },
    {
      key: 'unitPrice', label: 'Price per Unit', minWidth: 110, defaultWidth: 120, sortable: true,
      getValue: (r) => billedUnit(r.line),
      render: (r) => (
        <div>
          <div className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{money(billedUnit(r.line), currency)}</div>
          {r.line.uom && <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>per {r.line.uom}</div>}
        </div>
      ),
    },
    {
      key: 'creditAmount', label: 'Credit Amount', minWidth: 120, defaultWidth: 130, sortable: true,
      getValue: (r) => r.credit,
      render: (r) =>
        r.credit > 0 ? (
          <span className="text-[13px]" style={{ fontWeight: 500, color: '#BE123C' }}>−{money(r.credit, currency)}</span>
        ) : null,
    },
  ];

  const chargeEditor = (opts: {
    key: string;
    label: string;
    sub: string;
    value: number;
    cap: number;
    over: boolean;
    onChange: (n: number) => void;
  }) => (
    <div key={opts.key} className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-md bg-slate-50/60 border border-slate-100">
      <div className="min-w-0">
        <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>{opts.label}</p>
        <p className="text-[10px] text-slate-500 mt-0.5" style={{ fontWeight: 500 }}>{opts.sub}</p>
      </div>
      <OverTip over={opts.over} message={`You can credit up to ${money(opts.cap, currency)} here.`}>
        <div className="relative w-[170px] shrink-0">
          <MoneyInput
            value={opts.value}
            onValueChange={opts.onChange}
            fluid
            className={`h-8 w-full rounded-md border bg-white pl-2.5 pr-11 text-[12px] text-right outline-none focus:border-primary ${opts.over ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200'}`}
          />
          <MaxChip onClick={() => opts.onChange(opts.cap)} atMax={Math.abs(opts.value - opts.cap) < EPS} over={opts.over} />
        </div>
      </OverTip>
    </div>
  );

  const fieldLabel = 'text-[11px] text-slate-500 flex items-center gap-1';
  const notifyNames = (ids: Set<string>) =>
    Array.from(ids)
      .map((id) => SYSTEM_ROLES.find((r) => r.id === id)?.name ?? SYSTEM_USERS.find((u) => u.id === id)?.name)
      .filter((n): n is string => !!n);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        // Pinned-footer column, the vendor credit memo's 680px flow width.
        className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[680px] max-h-[92vh] flex flex-col"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onInteractOutside={(e) => {
          if (closingRef.current || confirmMode || discardOpen) {
            e.preventDefault();
            return;
          }
          if (dirty) {
            e.preventDefault();
            setDiscardOpen(true);
          }
        }}
        onEscapeKeyDown={(e) => {
          if (closingRef.current || confirmMode || discardOpen) {
            e.preventDefault();
            return;
          }
          if (dirty) {
            e.preventDefault();
            setDiscardOpen(true);
          }
        }}
      >
        {/* Header: creation-modal chrome (tinted icon chip, title +
            subtitle, close X). No gradient hero. */}
        <div className="px-4 sm:px-5 pt-3.5 pb-3.5 bg-white border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
              <Receipt className="w-5 h-5" style={{ color: THEME.solid, strokeWidth: 2 }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] sm:text-[16px] text-foreground" style={{ fontWeight: 700, lineHeight: 1.3 }}>
                {edit ? `Edit Credit Memo ${number}` : 'New Credit Memo'}
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs mt-0.5 text-slate-500" style={{ lineHeight: 1.5 }}>
                {revenueAdvance
                  ? 'Reverses revenue on this advance invoice and releases the locked units back to stock.'
                  : isAdvanceParent
                  ? 'Lowers what this advance invoice bills. Nothing posts to the general ledger.'
                  : `Reduces what ${invoice.customer} owes on this invoice once it is approved.`}
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (dirty ? setDiscardOpen(true) : onClose())}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: one stacked column (context card, fields, lines,
            description ∥ doc, notify last). */}
        <div className="px-4 sm:px-5 pt-4 pb-5 space-y-3.5 text-left flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: THEME.bg }}>
                <FileText className="w-4 h-4" style={{ color: THEME.solid }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Invoice</p>
                <p className="text-[12px] text-foreground mt-0.5 truncate" style={{ fontWeight: 500 }}>
                  <span className="" style={{ fontWeight: 600 }}>{invoice.invoiceNumber}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  {invoice.customer}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Creditable</p>
                <p className="text-[13px] text-foreground mt-0.5" style={{ fontWeight: 700 }}>{money(remaining, currency)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel} style={{ fontWeight: 500 }}>
                Credit Memo No.
                <Lock className="w-2.5 h-2.5 text-slate-300" />
              </Label>
              <Input value={number} readOnly className="h-9 text-[12px] bg-slate-50 text-slate-600 cursor-default" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ccm-date" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Date
              </Label>
              <DatePicker id="ccm-date" value={date} onChange={(v) => setDate(v || localTodayIso())} className="!h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel} style={{ fontWeight: 500 }}>
                Reason
                <span style={{ color: '#DC2626' }}>*</span>
              </Label>
              <Select value={reason} onValueChange={(v) => setReason(v as CreditReason)}>
                <SelectTrigger className="h-9 text-[12px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[400]">
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="text-[12px]">{r.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className={fieldLabel} style={{ fontWeight: 500 }}>
                Credit Basis
                <span style={{ color: '#DC2626' }}>*</span>
              </Label>
              <Select
                value={basis}
                onValueChange={(v) => {
                  if (v === 'lines' && basisLockReason) {
                    toast.info('Credited by amount', { description: basisLockReason });
                    return;
                  }
                  setBasis(v as Basis);
                }}
              >
                <SelectTrigger className="h-9 text-[12px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[400]">
                  <SelectItem value="lines" className="text-[12px]">By Lines</SelectItem>
                  <SelectItem value="amount" className="text-[12px]">By Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isReturn && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ccm-rma" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>RMA Number</Label>
                <Input
                  id="ccm-rma"
                  value={rmaNumber}
                  onChange={(e) => setRmaNumber(e.target.value)}
                  placeholder="e.g. RMA-2026-0042"
                  className="h-9 text-[12px] bg-white placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className={fieldLabel} style={{ fontWeight: 500 }}>
                  Account
                  <Lock className="w-2.5 h-2.5 text-slate-300" />
                </Label>
                <Input value={SALES_RETURNS_ACCOUNT} readOnly className="h-9 text-[12px] bg-slate-50 text-slate-600 cursor-default" />
              </div>
            </div>
          )}

          <div ref={linesRef}>
            {basis === 'lines' ? (
              <div className="space-y-2.5">
                <LineItemsTable<CreditRow>
                  rows={lineRows}
                  columns={lineColumns}
                  catalog={lineColumns.map((c) => ({ key: c.key, label: c.label }))}
                  lockedKeys={['item', 'creditQty']}
                  defaultHiddenKeys={['credited', 'unitPrice']}
                  storageKey="omnesoft:customer-credit-memo-lines"
                  getRowId={(r) => r.line.id}
                  rowHeight={58}
                  title="Credit Lines"
                  countNoun="items"
                />
                {(freightOriginal > EPS || chargeRows.length > 0) && (
                  <div className="space-y-2">
                    {freightOriginal > EPS &&
                      chargeEditor({
                        key: 'freight',
                        label: 'Freight',
                        sub: `Billed ${money(freightOriginal, currency)}, up to ${money(freightCap, currency)} left`,
                        value: freightCredit,
                        cap: freightCap,
                        over: freightOver,
                        onChange: setFreightCredit,
                      })}
                    {chargeRows.map((r) =>
                      chargeEditor({
                        key: r.charge.id,
                        label: `${r.charge.type}${r.charge.description ? ` · ${r.charge.description}` : ''}`,
                        sub: `Billed ${money(r.charge.amount, currency)}, up to ${money(r.cap, currency)} left`,
                        value: r.v,
                        cap: r.cap,
                        over: r.over,
                        onChange: (n) => setChargeCredit((m) => ({ ...m, [r.charge.id]: n })),
                      }),
                    )}
                  </div>
                )}
                {attempted && !(total > EPS) && <p className="text-[10px] text-red-600">Enter a credit quantity on at least one line.</p>}
                {totalOver && !anyLineOver && (
                  <p className="text-[10px] text-red-600">
                    This credit is {money(total, currency)}; only {money(remaining, currency)} is still creditable on {invoice.invoiceNumber}.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ccm-amount" className={fieldLabel} style={{ fontWeight: 500 }}>
                    Amount
                    <span style={{ color: '#DC2626' }}>*</span>
                  </Label>
                  <OverTip over={amountOver} message={`You can credit up to ${money(remaining, currency)} on this invoice.`}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 ">$</span>
                      <Input
                        id="ccm-amount"
                        type="text"
                        inputMode="decimal"
                        value={formatMoneyText(amountText)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d.]/g, '');
                          setAmountText(raw);
                          const n = parseFloat(raw);
                          setAmount(Number.isFinite(n) ? n : 0);
                        }}
                        className={`h-9 text-[12px] pl-7 pr-11 bg-white ${amountOver || (attempted && !(amount > EPS)) ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
                        placeholder="0.00"
                      />
                      <MaxChip
                        onClick={() => {
                          setAmount(remaining);
                          setAmountText(remaining.toFixed(2));
                        }}
                        atMax={Math.abs(amount - remaining) < EPS}
                        over={amountOver}
                        title={`Credit the full ${money(remaining, currency)}`}
                      />
                    </div>
                  </OverTip>
                  {attempted && !(amount > EPS) && <p className="text-[10px] text-red-600 mt-1">Amount must be greater than zero.</p>}
                  {amountOver && <p className="text-[10px] text-red-600 mt-1">Cannot exceed creditable {money(remaining, currency)}.</p>}
                </div>
                {!isReturn && (
                  <div className="space-y-1.5">
                    <Label className={fieldLabel} style={{ fontWeight: 500 }}>
                      Revenue Account
                      {(!isStandalone || isAdvanceParent) && <Lock className="w-2.5 h-2.5 text-slate-300" />}
                    </Label>
                    {postsNothing ? (
                      <Input value="No accounting entry" readOnly className="h-9 text-[12px] bg-slate-50 text-slate-500 cursor-default" />
                    ) : isStandalone ? (
                      <Select value={account} onValueChange={setAccount}>
                        <SelectTrigger className="h-9 text-[12px] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[400]">
                          {lineAccountOptions.map((a) => (
                            <SelectItem key={a} value={a} className="text-[12px]">{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={account} readOnly className="h-9 text-[12px] bg-slate-50 text-slate-600 cursor-default" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description ∥ Supporting doc (the vendor arrangement). */}
          <div className="grid sm:grid-cols-2 gap-3 items-start">
            <div className="space-y-1.5" ref={descRef}>
              <Label htmlFor="ccm-description" className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Description
                {reason === 'Other' && <span style={{ color: '#DC2626' }}>*</span>}
              </Label>
              <Textarea
                id="ccm-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={reason === 'Other' ? 'Required for Other: what is this credit memo for?' : undefined}
                className={`text-[12px] resize-none bg-white h-[104px] ${attempted && descriptionMissing ? 'border-red-300 focus-visible:ring-red-200' : ''}`}
              />
              {attempted && descriptionMissing && <p className="text-[10px] text-red-600 mt-1">"Other" needs a description.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                Supporting Doc
              </Label>
              {file ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px] text-foreground truncate" style={{ fontWeight: 500 }}>{file.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 ">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-white transition-colors shrink-0"
                    aria-label="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="ccm-file"
                  className="w-full h-[104px] flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-slate-500" />
                  </span>
                  <span className="text-[11px] text-slate-600 mt-0.5" style={{ fontWeight: 500 }}>
                    <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                  </span>
                  <span className="text-[10px] text-slate-400">PDF or image up to 10MB</span>
                  <input id="ccm-file" type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>

          {/* Notify closes the form, full width: the system's one notify
              interaction. */}
          <NotifyToggleCard
            title="Notify Recipients"
            helper="Tell the people you choose that this credit memo was issued."
            checked={notify}
            onCheckedChange={setNotify}
            selectedIds={recipients}
            onSelectionChange={setRecipients}
            accentColor={THEME.solid}
            accentBg={THEME.bg}
            accentBorder="#BFDBFE"
            accentText="#1D4ED8"
          />
        </div>

        {/* Footer: pinned, the live readout on the left, CTAs right. */}
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 border-t border-slate-100 bg-white shrink-0">
          <div className="mr-auto min-w-0 text-left">
            <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Creditable After This</p>
            <p className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 700, color: totalOver ? '#BE123C' : undefined }}>
              {money(creditableAfter, currency)}
              {total > 0 && (
                <span className="text-[10px] text-slate-400 ml-1.5" style={{ fontWeight: 500 }}>
                  was {money(remaining, currency)}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (dirty ? setDiscardOpen(true) : onClose())}
            className="h-9 px-4 sm:px-5 rounded-lg border border-border bg-white text-[13px] text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDraft}
            className="h-9 px-4 rounded-lg border border-border bg-white text-[13px] text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-9 px-4 rounded-lg border-0 text-[13px] shadow-sm cursor-pointer transition-opacity hover:opacity-90"
            style={{ fontWeight: 500, backgroundColor: THEME.solid, color: '#fff' }}
          >
            {submitMode === 'approve' ? 'Create Credit Memo' : 'Submit for Approval'}
          </button>
        </div>
      </DialogContent>

      {/* GL-impact confirm: the vendor's emerald confirmation. */}
      <AlertDialog open={!!confirmMode} onOpenChange={(o) => !o && setConfirmMode(null)}>
        <AlertDialogContent
          className="flex flex-col w-full max-w-[calc(100%-2rem)] sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 240 }}
        >
          <div className="relative flex flex-col items-center pt-9 pb-5" style={{ background: 'linear-gradient(180deg, #ECFDF5 0%, rgba(255,255,255,0.3) 70%, transparent 100%)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#047857' }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
              <Receipt className="w-7 h-7" style={{ color: '#047857' }} />
            </div>
            <span className="mt-3 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857' }}>
              Confirm Credit Memo
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-7 pb-7">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle className="text-[20px] tracking-[-0.02em]" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                {confirmMode === 'approve' ? `Create credit memo for ${money(total, currency)}?` : `Submit ${number} for approval?`}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-[12px] text-slate-500 mt-1.5">
              {confirmMode === 'approve'
                ? `${invoice.invoiceNumber} shows ${money(creditedAfter, currency)} credited. Its status does not change.`
                : `The approver is notified. Nothing posts until it is approved. Dated ${formatUsDate(date)}.`}
            </p>
            {isReturn && !rmaNumber.trim() && (
              <div className="w-full mt-4 text-left rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-800 leading-snug" style={{ fontWeight: 500 }}>
                  No RMA Number on this return credit. You can add it later while it is not approved.
                </p>
              </div>
            )}
            <div className="w-full mt-4 text-left rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Receipt className="w-3 h-3 text-slate-400 shrink-0" />
                <p className="text-[10px] text-slate-400" style={{ fontWeight: 700 }}>{confirmMode === 'approve' ? 'GL Impact' : 'GL Impact on Approval'}</p>
              </div>
              {postsNothing ? (
                <div>
                  <p className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>No accounting entry</p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">An advance invoice posts nothing, so its credit memo has nothing to reverse.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="px-3 py-1.5 text-left text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Account</th>
                        <th className="px-3 py-1.5 text-right text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Debit</th>
                        <th className="px-3 py-1.5 text-right text-[10px] text-slate-400" style={{ fontWeight: 600 }}>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {glLines.map((row) => {
                        const { code, name } = splitGlAccount(row.account);
                        return (
                          <tr key={`${row.account}-${row.debit > 0 ? 'dr' : 'cr'}`} className="border-b border-slate-100 last:border-b-0">
                            <td className="px-3 py-1.5">
                              <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{code}</span>
                              <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{name}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right ">{row.debit > 0 ? <span style={{ fontWeight: 600 }}>{money(row.debit, currency)}</span> : null}</td>
                            <td className="px-3 py-1.5 text-right ">{row.credit > 0 ? <span style={{ fontWeight: 600 }}>{money(row.credit, currency)}</span> : null}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50/70">
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border" style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
                            <CheckCircle2 className="w-2.5 h-2.5" /> Debit = Credit
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{money(total, currency)}</td>
                        <td className="px-3 py-1.5 text-right " style={{ fontWeight: 700 }}>{money(total, currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {revenueAdvance && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug">
                  <Package className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                  Units released back to stock. The revenue booked at invoice is reversed by this amount.
                </p>
              )}
            </div>
            <div className="w-full mt-5 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (!confirmMode) return;
                  const names = notify ? notifyNames(recipients) : [];
                  commit(confirmMode);
                  if (names.length > 0) {
                    toast.success('Notification sent', { description: `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2} more` : ''} will hear about ${number}.` });
                  }
                }}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: '#047857', color: '#fff' }}
              >
                {confirmMode === 'approve' ? 'Create Credit Memo' : 'Submit for Approval'}
              </button>
              <button
                onClick={() => setConfirmMode(null)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: 'var(--color-slate-50)', color: 'var(--color-slate-700)' }}
              >
                Keep Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <DiscardConfirm
        open={discardOpen}
        what="this credit memo"
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </Dialog>
  );
}
