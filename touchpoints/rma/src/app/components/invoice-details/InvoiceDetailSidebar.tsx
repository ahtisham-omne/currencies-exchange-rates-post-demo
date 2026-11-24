import { formatMoney as moneyIn, formatRate, rateSentence } from '@/app/currency/money';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { splitToBase, toBase, type MoneyFx } from '@/app/currency/rates';
import { returnFx, rmaCurrency, rmaCurrencyPO } from '@/app/currency/returnCurrency';
import { accountCurrency, returnSettlementFx, settlementMoneyFx } from '@/app/currency/returnSettlement';
import { useReturnView, viewMoney } from '@/app/components/currency/returnView';
import { BaseMoney } from '@/app/components/currency/Money';
import { CurrencyFlag } from '@/app/components/currency/CurrencyChip';
import { RateTypeChip, ReturnCurrencyBlock, settleRateLine } from '@/app/components/currency/ReturnCurrencyConfig';
import React, { useEffect, useState } from 'react';
import {
  Banknote,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Edit3,
  Flag,
  Info,
  Lock,
  MapPin,
  Plus,
  Receipt,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { Invoice } from '@/app/data/mockInvoices';
import type { RMA } from '@/app/data/mockRMAs';
import {
  authorizedQty,
  expectedRefundDate,
  refundExpectationLabel,
  returnsContactFor,
  RMA_EDITABLE_STATUSES,
  rmaMaterialEditable,
  poLabel,
} from '@/app/data/mockRMAs';
import { formatDate } from '@/app/components/vendorSelectionModel';
import { useRMAContext } from '@/app/rma-context';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { ExpandableTextarea } from '@/app/components/ExpandableTextarea';
import { useRMAEditGate } from '@/app/components/rma-versions/RMAEditGate';
import { PAY_FROM_ACCOUNTS, PAY_TO_ACCOUNTS } from '@/app/data/mockPayments';
import { PayFromAccountModal } from '@/app/components/payments/PayFromAccountModal';
import { ShipToSelectionModal } from '@/app/components/ShipToSelectionModal';
import { partnerForItem } from '@/app/data/partnerLocations';
import { mockVendors, vendorAddress } from '@/app/data/mockVendors';
import {
  RMAVendorInformationCard,
  type RMAVendorContact,
} from '@/app/components/rma/RMAVendorInformationCard';
import { PaymentMethodPickerModal } from '@/app/components/vendors/PaymentMethodPickerModal';
import { PaymentMethodCard } from '@/app/components/vendors/PaymentMethodCard';
import { paymentEntryFor } from '@/app/data/vendorPaymentInstruments';
import {
  AdditionalChargesPanel,
  VENDOR_CHARGE_TYPES,
  type AdditionalCharge,
} from '@/app/components/vendors/AdditionalChargesPanel';
import { rmaScenarioValues, restockingFeeAmount, restockingFeeBase } from '@/app/data/rmaGLEntries';
import { RestockingFeeScopeModal } from '@/app/components/rma/RestockingFeeScopeModal';
import { invoiceSplitForRMALine } from '@/app/data/receiptInvoiceStatus';
import { CarrierCard } from '@/app/components/CarrierCard';
import { CarrierBrowseModal } from '@/app/components/CarrierBrowseModal';
import { getCarriersForVendor, CARRIER_CATALOGUE } from '@/app/data/vendorCarriers';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { VendorQuickCard, statusDisplayLabel } from '@/app/components/InvoiceDataTable';
import { LinkedFinancialRecord, countsTowardBalance } from '@/app/data/invoiceLinkedRecords';

// Partner-management module (separate app) — the vendor links open the
// vendor's detail page there.
const PARTNER_VENDOR_URL = 'https://partner-management-module.lovable.app/vendors/v-001';

/* ════════════════════════════════════════════════════════════════
   Right sidebar — sticky across all detail tabs. Ports the partner /
   PO detail-page sidebar recipe:
   - Each section is a stand-alone card with icon + title + chevron
   - Click the header to collapse/expand
   - Sections sized for invoice context: Summary, Vendor, Payment,
     Linked Records, Timeline
   ════════════════════════════════════════════════════════════════ */

type SectionKey =
  | 'general'
  | 'summary'
  | 'vendor'
  | 'payment'
  | 'matching'
  | 'charges'
  | 'freight'
  | 'flags'
  | 'linked'
  | 'timeline';

/** In the return's (the PO's) currency, with its symbol: £30.23 (app/currency/money.ts). */
function formatMoney(amount: number, currency: string) {
  return moneyIn(amount, currency);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function daysBetween(later: Date, earlier: Date) {
  const ms = later.getTime() - earlier.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

interface SidebarSectionProps {
  icon: React.ElementType;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** Compact one-line value shown collapsed (e.g. "$2,580.80"). */
  collapsedSummary?: React.ReactNode;
  /** What the section means, where its title cannot carry it. Rendered as an
   *  info icon beside the title that explains on hover, for a heading that
   *  names something the reader has no other way to find out. */
  info?: React.ReactNode;
}

function SidebarSection({ icon: Icon, title, open, onToggle, children, collapsedSummary, info }: SidebarSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      {/* The section title is a heading, with the toggle inside it -- the
          accordion pattern, since a heading cannot sit inside a button. Looks
          the same; screen readers can now jump between the cards. */}
      <h2 className="m-0 text-[13px]" style={{ fontWeight: 600 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            {title}
          </span>
          {info && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`What ${title} means`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center text-slate-400 transition-colors hover:text-slate-600"
                >
                  <Info className="w-3.5 h-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-[260px] text-[11px] leading-relaxed">
                {info}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!open && collapsedSummary && (
            <span className="text-[11px] text-slate-500 tabular-nums" style={{ fontWeight: 500 }}>
              {collapsedSummary}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      </h2>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/** Who to call at the vendor.
 *
 *  The same returns desk the rest of the module already knows
 *  (`returnsContactFor`), rather than a second name invented here: a vendor
 *  who reads as Dana Whitfield on one card and Priya Raghunathan on another is
 *  two people as far as anybody reading the page is concerned. */
function vendorContactFor(vendorName: string): RMAVendorContact {
  const contact = returnsContactFor(vendorName);
  return {
    name: contact.name,
    initials: contact.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join(''),
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
  };
}

/** Tags on a return.
 *
 *  A return is looked for months later by what it was about -- "the crushed
 *  pallet", "the Q3 recall" -- long after its number has gone. Free words,
 *  because the vocabulary is the warehouse's rather than ours, and they are
 *  what the listing search reads on top of the numbers it already searches.
 *
 *  Chips with a cross each, and one input that commits on Enter or on blur.
 *  Nothing is offered as a suggestion: a fixed list would be a taxonomy, and
 *  a taxonomy is somebody's job rather than a text field. */
function RMATags({
  tags,
  editable,
  onChange,
}: {
  tags: string[];
  editable: boolean;
  onChange: (next: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const word = draft.trim();
    setDraft('');
    setAdding(false);
    if (!word) return;
    if (tags.some((t) => t.toLowerCase() === word.toLowerCase())) return;
    onChange([...tags, word]);
  };

  if (tags.length === 0 && !editable) return null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-slate-500">Tags</span>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="group inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-px pl-2 pr-1.5 text-[11px] text-slate-600"
            style={{ fontWeight: 600 }}
          >
            {tag}
            {editable && (
              <button
                type="button"
                aria-label={`Remove the tag ${tag}`}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="text-slate-400 transition-colors hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {editable &&
          (adding ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                if (e.key === 'Escape') { setDraft(''); setAdding(false); }
              }}
              aria-label="Add a tag to this return"
              placeholder="Add a tag"
              className="h-6 w-[110px] rounded-full border border-slate-200 bg-white px-2.5 text-[11px] outline-none transition-colors placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-slate-300 py-px pl-1.5 pr-2 text-[11px] text-slate-500 transition-colors hover:border-primary/40 hover:text-primary"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3 h-3" />
              Tag
            </button>
          ))}
        {tags.length === 0 && !editable && (
          <span className="text-[11px] text-slate-400">None</span>
        )}
      </div>
    </div>
  );
}

interface InvoiceDetailSidebarProps {
  invoice: Invoice;
  numbers: {
    total: number;
    subtotal: number;
    tax: number;
    freight: number;
    /** Additional charges slice of the total (handling etc.). */
    additional: number;
    outstanding: number;
    paid: number;
    /** Credit memos applied against the invoice — shown as a reduction
     *  line under the invoice total. */
    credits?: number;
    daysOverdue: number;
  };
  status: string;
  statusPalette: { bg: string; color: string; border: string };
  /** Linked financial records — feeds the Timeline (credit memo /
   *  payment / prepayment events with real dates). */
  records?: LinkedFinancialRecord[];
  /** When 'rma', labels swap ("Invoice ID" → "RMA ID", "Invoice Summary" → "Return Summary", etc.). */
  mode?: 'invoice' | 'rma';
  /** Raw RMA payload — populates General Information, Freight &
   *  Logistics, and Return Summary when mode === 'rma'. */
  rma?: RMA;
  /** Locks the RMA edit affordances while an older version is on screen. */
  readOnly?: boolean;
  /** Opens the return's currency configuration (the header's Currency
   *  button does the same). */
  onOpenCurrencyConfig?: (() => void) | undefined;
}

export function InvoiceDetailSidebar({ invoice, numbers, status, statusPalette, records = [], mode = 'invoice', rma, readOnly = false, onOpenCurrencyConfig }: InvoiceDetailSidebarProps) {
  const isRma = mode === 'rma';
  // A return's page reads in its view (returnView.tsx): PKR at the return's
  // rate on Base Currency, the PO's currency on Vendor Currency.
  const pageView = useReturnView();
  const pageFx = isRma && rma ? returnFx(rma) : null;
  const formatMoney = (amount: number, currency: string) => viewMoney(pageView, amount, currency, pageFx);
  // A return opens on the two cards somebody actually lands for: who it is
  // with, and what it is worth. The rest are there when they are wanted --
  // six open panels is a page to scroll rather than a rail to read.
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(() =>
    mode === 'rma'
      ? {
          general: false,
          summary: true,
          vendor: true,
          payment: false,
          matching: false,
          charges: false,
          freight: false,
          flags: false,
          linked: false,
          timeline: false,
        }
      : {
          general: true,
          summary: true,
          vendor: true,
          payment: true,
          matching: true,
          charges: false,
          freight: false,
          flags: false,
          linked: true,
          timeline: false,
        },
  );
  const toggle = (k: SectionKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const { updateRMA, restockingStandardFor, setRestockingStandard } = useRMAContext();
  const guardEdit = useRMAEditGate();

  // Resolve the full vendor record so the vendor card can surface partner-
  // level facts (code, terms, currency) — mirrors InvoiceDetailScreen.
  const vendorData = mockVendors.find((v) => v.vendorName === invoice.vendor) || null;

  // 3-Way Matching panel removed per BA feedback — match status
  // lives elsewhere (header / linked-records tab). Sidebar focuses
  // on identifying info + summary.

  // Mock additional charges + freight — would come from invoice
  // creation form once persisted. We deterministically synthesize 1-2
  // additional charges and a freight line per invoice using the
  // numeric seed of the invoice number so the same invoice renders
  // the same charges across reloads.
  const chargeSeed = invoice.invoiceNumber.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  // The charge rows split numbers.additional exactly, so the card's
  // subtotal equals the Additional charges line in the Invoice Summary
  // and everything reconciles to the invoice total.
  const additionalCharges = (chargeSeed % 3 === 0)
    ? (() => {
        const doc = Math.round(numbers.additional * 0.35 * 100) / 100;
        return [
          { label: 'Handling fee', amount: Math.round((numbers.additional - doc) * 100) / 100, gl: '6100 Office Supplies' },
          { label: 'Documentation', amount: doc, gl: '6700 Professional Fees' },
        ];
      })()
    : [{ label: 'Handling fee', amount: numbers.additional, gl: '6100 Office Supplies' }];
  // Carrier inherited from the vendor's partner config — the same
  // deterministic slice the create-invoice freight picker uses, so the
  // detail page renders the identical partner-style CarrierCard. The
  // first carrier in the slice is the vendor's primary / default.
  const vendorCarrier = getCarriersForVendor(invoice.vendor)[0];
  // A return that fanned out ships from one site, and a site is its own
  // partner record with its own freight arrangements, so the carrier resolves
  // against that site rather than the header vendor and is matched across the
  // whole catalogue. With nothing stored the site's primary carrier stands,
  // which is what the create form defaults to.
  const rmaCarrierSite = rma?.items[0]?.originName ?? invoice.vendor;
  const rmaDefaultCarrier = getCarriersForVendor(rmaCarrierSite)[0];
  const rmaCarrier = CARRIER_CATALOGUE.find((c) => c.name === rma?.carrier) ?? rmaDefaultCarrier;
  const rmaCarrierInherited = rmaCarrier?.id === rmaDefaultCarrier?.id;
  // Logistics is settled before the return leaves, so it stays editable right
  // up to the shipment. Once the goods are gone the section reads back.
  const rmaEditable = isRma && !!rma && !readOnly && RMA_EDITABLE_STATUSES.includes(rma.status);
  // Material fields (DQ-07) lock at the first shipment (DQ-09); the minor
  // ones, tags, carrier, instructions, stay open while the return is.
  const rmaMaterialOk = rmaEditable && !!rma && rmaMaterialEditable(rma);
  const rmaShipToPartner = rma?.returnShipToPartner ?? rma?.returnLegs[0]?.shipToPartner;
  const [payToPickerOpen, setPayToPickerOpen] = useState(false);
  const [carrierPickerOpen, setCarrierPickerOpen] = useState(false);
  /** Vendor charges while they are being edited. The panel reports every
   *  keystroke, so what it reports is held here and only reaches the return
   *  when Save is pressed -- which is the moment the version is cut. */
  const [chargeDraft, setChargeDraft] = useState<AdditionalCharge[]>(
    () => rma?.additionalCharges ?? [],
  );
  const savedCharges = rma?.additionalCharges;
  useEffect(() => {
    setChargeDraft(savedCharges ?? []);
  }, [savedCharges]);
  const chargesDirty =
    JSON.stringify(chargeDraft) !== JSON.stringify(savedCharges ?? []);
  /** A restocking fee is typed here in dollars and held on a vendor profile as
   *  a percentage, so the two only meet through the base a fee is charged on:
   *  the full return value. With nothing going back there is no percentage to
   *  push anywhere, and the question is not worth asking. */
  const draftFeeAmount =
    Math.round(
      chargeDraft
        .filter((c) => c.type === 'Restocking fee')
        .reduce((n, c) => n + (c.amount || 0), 0) * 100,
    ) / 100;
  const chargeFeeBase = rma ? restockingFeeBase(rma) : 0;
  const draftFeePct =
    chargeFeeBase > 0.004 && draftFeeAmount > 0.004
      ? Math.round((draftFeeAmount / chargeFeeBase) * 1000) / 10
      : undefined;
  const vendorFeeStandard = rma ? restockingStandardFor(rma.vendor) : undefined;
  /** Only a fee that differs from the profile is news. Saving a charge that
   *  already matches what the vendor is on file for has nothing to decide. */
  const feeNeedsScope = draftFeePct !== undefined && vendorFeeStandard !== draftFeePct;
  const [feeScopeOpen, setFeeScopeOpen] = useState(false);
  const commitCharges = () => {
    if (!rma) return;
    updateRMA(rma.id, { additionalCharges: chargeDraft });
  };
  // The vendor card's payment-method picker, opened from its row the way the
  // order opens it. Terms have no row: a return is not paid on terms, so the
  // order's Payment Terms row has no counterpart on a return (Eli, 6 Oct).
  const [methodPickerOpen, setMethodPickerOpen] = useState(false);
  // The card carries its own ship-to picker: the logistics section's instance
  // only exists while that section is open, so a pencil on this card would
  // have opened nothing with it collapsed.
  const [cardShipToOpen, setCardShipToOpen] = useState(false);
  // The vendor reference is transcribed off the vendor's reply in one go, so it
  // is captured and committed as a whole rather than saved on every keystroke.
  const [vendorRefOpen, setVendorRefOpen] = useState(false);
  const [vendorRefDraft, setVendorRefDraft] = useState('');
  const freightDetails = {
    amount: numbers.freight,
    carrier: vendorCarrier,
    glAccount: '5020 Freight Inbound',
  };

  // Timeline events derived from invoice status + dates.
  const today = new Date();
  const dueDate = new Date(invoice.dueDate);
  const daysUntilDue = daysBetween(dueDate, today);
  const dueColor = numbers.daysOverdue > 0 ? '#DC2626' : numbers.daysOverdue >= -7 ? '#B45309' : '#475569';
  const dueLabel = numbers.daysOverdue > 0
    ? `Overdue ${numbers.daysOverdue}d`
    : numbers.daysOverdue === 0
      ? 'Due today'
      : daysUntilDue <= 7
        ? `${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} left`
        : `Due in ${daysUntilDue} days`;
  const isApprovedOrBeyond = status === 'Approved' || status === 'Partially Paid' || status === 'Paid' || status === 'On Hold';
  const isPaid = status === 'Paid';
  const isPartial = status === 'Partially Paid';


  return (
    <aside className="w-[320px] shrink-0 flex flex-col gap-3 self-start sticky top-[170px]">
      {/* ── Who the return is with ───────────────────────────
          
          The first thing on the rail, at the size of a name rather than the
          size of a field. It sat as the third row of General Information,
          between an id and a date, in 11px next to everything else in 11px:
          "I should not have to look with a magnifying glass to see who the
          vendor is."
          
          Modelled on the purchase order's own sidebar, which leads with the
          vendor and keeps the dates in cards of their own further down. The
          density vendor invoicing runs at is earned there by terms and due
          dates that genuinely change what somebody does today; a return has
          no such clock, so it reads like an order instead. */}
      {isRma && rma && (() => {
        const contact = vendorContactFor(invoice.vendor);
        const shipTo =
          rma.returnShipTo ?? rma.returnLegs[0]?.shipTo ?? null;
        // The account the money comes back to: the currency configuration's
        // "Deposited to", an account in PKR or the return's currency
        // (2026-11-24), so the card and the configuration name the same one.
        const payTo = returnSettlementFx(rma).account ?? PAY_FROM_ACCOUNTS.find((a) => a.id === rma.payToAccountId);
        return (
          <>
            {/* The order's own card, ported whole. */}
            <RMAVendorInformationCard
              vendorName={invoice.vendor}
              vendorLogoUrl={vendorData?.imageUrl}
              vendorAddress={(vendorData && vendorAddress(vendorData.vendorCode)) || null}
              contact={contact}
              shipTo={shipTo}
              shipToPartner={rmaShipToPartner ?? null}
              shipToAddress={(() => {
                const site = mockVendors.find((v) => v.vendorName === shipTo);
                return site ? vendorAddress(site.vendorCode) : null;
              })()}
              payTo={payTo ? `${payTo.label} · ${accountCurrency(payTo)}` : null}
              paymentMethod={
                rma.paymentMethodName ?? vendorData?.primaryPaymentMethod ?? '–'
              }
              paymentMethodCard={(() => {
                const method = rma.paymentMethodName ?? vendorData?.primaryPaymentMethod ?? '';
                if (!method || method === '–') return undefined;
                return (
                  <PaymentMethodCard
                    entry={paymentEntryFor(
                      invoice.vendor,
                      method,
                      method === vendorData?.primaryPaymentMethod,
                    )}
                    compact
                    {...(rmaMaterialOk
                      ? {
                          onApply: () => guardEdit(() => setMethodPickerOpen(true)),
                          onEdit: () => guardEdit(() => setMethodPickerOpen(true)),
                        }
                      : {})}
                  />
                );
              })()}
              onOpenVendor={PARTNER_VENDOR_URL}
              editable={rmaMaterialOk}
              onEditShipTo={() => guardEdit(() => setCardShipToOpen(true))}
              // The refund account is the currency configuration's "Deposited
              // to", so its pencil opens that (which asks for the version
              // itself when it applies).
              onEditPayTo={() => (onOpenCurrencyConfig ? onOpenCurrencyConfig() : guardEdit(() => setPayToPickerOpen(true)))}
              onEditMethod={() => guardEdit(() => setMethodPickerOpen(true))}
            />

            <ShipToSelectionModal
              open={cardShipToOpen}
              onOpenChange={setCardShipToOpen}
              selectedId={null}
              onSelect={(item) => {
                const partner = partnerForItem(item)?.name ?? item.name;
                updateRMA(rma.id, {
                  returnShipTo: item.name,
                  returnShipToPartner: partner,
                  returnLegs: rma.returnLegs.map((leg, i) =>
                    i === 0 ? { ...leg, shipTo: item.name, shipToPartner: partner } : leg,
                  ),
                });
              }}
            />
            {/* The partner module's own picker, the same one a purchase
                order opens from its Payment Method row. */}
            <PaymentMethodPickerModal
              open={methodPickerOpen}
              onClose={() => setMethodPickerOpen(false)}
              value={rma.paymentMethodName ?? vendorData?.primaryPaymentMethod ?? ''}
              methods={vendorData?.paymentMethods ?? ['ACH', 'Wire', 'Check', 'Card', 'Cash']}
              vendorDefault={vendorData?.primaryPaymentMethod ?? ''}
              vendorName={invoice.vendor}
              onApply={(name: string) => updateRMA(rma.id, { paymentMethodName: name })}
            />

            {/* What this document is, in the shape the order's summary card
                uses for the same job. The return's number stays here, where
                somebody reads it out. */}
          </>
        );
      })()}

      {/* ── General Information ───────────────────────────────
          Sent to the bottom of the rail on a return: created by, the
          resolution date and the point of contact are records rather than
          things anybody glances at, and they were holding the top of the
          page. */}
      <div className={isRma ? 'order-last' : ''}>
      <SidebarSection
        icon={Info}
        title={isRma ? 'Record details' : 'General Information'}
        open={open.general}
        onToggle={() => toggle('general')}
        collapsedSummary={invoice.invoiceNumber}
      >
        <div className="space-y-2.5">
          {!isRma && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Invoice ID</span>
              <span className="text-[11px] text-foreground tabular-nums text-right" style={{ fontWeight: 600 }}>
                {invoice.invoiceNumber}
              </span>
            </div>
          )}
          {/* Invoice-only: Vendor invoice no. — RMA uses Vendor RMA #
              inside its own field set below (item #4). */}
          {!isRma && invoice.vendorInvoiceNumber && (
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Vendor invoice no.</span>
              <span className="text-[11px] text-foreground tabular-nums text-right" style={{ fontWeight: 600 }}>
                {invoice.vendorInvoiceNumber}
              </span>
            </div>
          )}
          {/* Vendor — clickable link (image + name) with the same hover
              quick-card as the header pill; opens the partner detail page.
              On a return it leads the rail on its own card instead, so it
              does not read twice. */}
          <div className={`items-start justify-between gap-2 ${isRma ? 'hidden' : 'flex'}`}>
            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Vendor</span>
            <HoverCard openDelay={300} closeDelay={120}>
              <HoverCardTrigger asChild>
                <a
                  href={PARTNER_VENDOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-w-0 text-right text-primary hover:underline decoration-primary/50 underline-offset-2 transition-colors"
                  style={{ fontWeight: 700 }}
                  title={`Open ${invoice.vendor} in Partners`}
                >
                  <span className="w-4 h-4 rounded overflow-hidden border border-slate-200 bg-white flex items-center justify-center shrink-0">
                    {vendorData?.imageUrl ? (
                      <img src={vendorData.imageUrl} alt={invoice.vendor} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-2.5 h-2.5 text-slate-400" />
                    )}
                  </span>
                  <span className="text-[11px] truncate">{invoice.vendor}</span>
                </a>
              </HoverCardTrigger>
              <HoverCardContent
                side="left"
                align="start"
                sideOffset={8}
                className="p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden w-auto"
              >
                <VendorQuickCard vendor={invoice.vendor} description={invoice.description} />
              </HoverCardContent>
            </HoverCard>
          </div>
          {/* Invoice-only date/type/AP block. Wrapped in !isRma so RMA
              mode swaps in its own field set below (items #4, #6). */}
          {!isRma && (
            <>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Vendor invoice date</span>
                <span className="text-[11px] text-foreground tabular-nums text-right" style={{ fontWeight: 600 }}>
                  {invoice.invoiceDate}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Posting date</span>
                <span className="text-[11px] text-foreground tabular-nums text-right" style={{ fontWeight: 600 }}>
                  {invoice.postingDate || invoice.invoiceDate}
                </span>
              </div>
              {/* Due date + overdue badge — moved here from the removed
                  Payment Schedule panel; sits next to posting date so the
                  cadence is obvious at a glance. */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Due date</span>
                <span className="text-right inline-flex items-center gap-1.5">
                  <span className="text-[11px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                    {invoice.dueDate}
                  </span>
                  <span
                    className="text-[10px] tabular-nums px-1.5 py-px rounded"
                    style={{
                      fontWeight: 600,
                      color: dueColor,
                      backgroundColor: numbers.daysOverdue > 0 ? '#FEF2F2' : numbers.daysOverdue >= -7 ? '#FFFBEB' : '#F1F5F9',
                    }}
                  >
                    {dueLabel}
                  </span>
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Type</span>
                <span className="text-[11px] text-foreground text-right" style={{ fontWeight: 600 }}>
                  {invoice.type}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                {/* Locked by design (flows from the vendor profile) — the
                    tooltip says WHY, following the GL-account tooltip pattern
                    (design review 7/9/26). */}
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 cursor-help" style={{ fontWeight: 500 }}>
                      AP account
                      <Lock className="w-2.5 h-2.5 text-slate-300" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Set by the vendor profile</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The payable account flows from the vendor's configuration and can't be changed per invoice. Manage it from the vendor record.</p>
                  </TooltipContent>
                </Tooltip>
                <span className="text-[11px] text-foreground tabular-nums text-right truncate" style={{ fontWeight: 600 }}>
                  {invoice.apAccount || ', '}
                </span>
              </div>
              {invoice.description && (
                <div className="pt-2 mt-1 border-t border-slate-100">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1" style={{ fontWeight: 600 }}>Description</p>
                  <p className="text-[11px] text-slate-700 leading-snug" style={{ fontWeight: 500 }}>{invoice.description}</p>
                </div>
              )}
            </>
          )}
          {/* ── RMA-only field set (item #4) — mirrors the existing
              row/label typography (11px slate-500 label, foreground
              value). Empty values render as an em-dash. */}
          {isRma && rma && (() => {
            const dash = '–';
            const legs = rma.returnLegs;
            // One return, one vendor, one address. The card used to list a
            // destination per leg, from when a return could fan out across a
            // vendor's sites; it cannot, so the list said once per shipment
            // what the Return Ship-To row says once.
            // The vendor issues this reference when they answer, which can be
            // any time before the return is settled, so it stays writable
            // until the RMA is closed rather than only inside the approval.
            const vendorRefEditable = rma.status !== 'Closed' && rma.status !== 'Cancelled';
            const rows: { label: string; value: string | undefined; editable?: boolean }[] = [
              // What the return is, before what is planned for it. Return
              // type and reason are set per line, so the header no longer
              // summarizes either of them; who created it is on the activity
              // history, where it has a date against it.
              { label: 'Vendor RMA #', value: rma.vendorRMANumber, editable: vendorRefEditable },
              { label: 'Source PO', value: rma.sourcePO ? poLabel(rma.sourcePO) : undefined },
              // The return is in its PO's currency, and says which PO set it.
              { label: 'Currency', value: `${rmaCurrency(rma)} (from PO ${rmaCurrencyPO(rma)})` },
              // No refund promise here. When the money is due, and by what
              // instrument, now reads on the Return Summary beside the figure
              // it is a promise about.
              // A Draft edits the return address in Return Logistics below,
              // where the create form asked for it, so it doesn't read twice.
              ...(rmaEditable
                ? []
                : [
                    // The receiving party is its own row: a vendor can route
                    // returns to another partner's site, so this is not
                    // always the vendor the goods were bought from.
                    {
                      label: 'Return Ship-To Vendor',
                      value: rma.returnShipToPartner ?? legs[0]?.shipToPartner ?? rma.vendor,
                    },
                    { label: 'Return Ship-To', value: rma.returnShipTo ?? legs[0]?.shipTo },
                  ]),
            ];
            return (
              <>
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{r.label}</span>
                    {r.editable ? (
                      <Popover
                        open={vendorRefOpen}
                        onOpenChange={(next) => {
                          if (next) setVendorRefDraft(r.value ?? '');
                          setVendorRefOpen(next);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              guardEdit(() => {
                                setVendorRefDraft(r.value ?? '');
                                setVendorRefOpen(true);
                              }, 'minor');
                            }}
                            aria-label="Edit vendor RMA number"
                            className="inline-flex items-center gap-1.5 h-6 px-1.5 rounded-md border border-transparent text-[11px] tabular-nums hover:border-slate-200 hover:bg-white transition-colors"
                            style={{ fontWeight: 600 }}
                          >
                            <span className={r.value ? 'text-foreground' : 'text-slate-400'} style={{ fontWeight: r.value ? 600 : 400 }}>
                              {r.value || 'Not yet issued'}
                            </span>
                            <Edit3 className="w-3 h-3 text-slate-400 shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[248px] p-3">
                          <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                            Vendor RMA #
                          </Label>
                          <p className="mt-0.5 mb-2 text-[11px] text-muted-foreground leading-snug">
                            The reference the vendor issues when they authorize this return.
                          </p>
                          <Input
                            autoFocus
                            value={vendorRefDraft}
                            onChange={(e) => setVendorRefDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateRMA(rma.id, { vendorRMANumber: vendorRefDraft.trim() });
                                setVendorRefOpen(false);
                              }
                              if (e.key === 'Escape') setVendorRefOpen(false);
                            }}
                            placeholder="Not issued"
                            aria-label="Vendor RMA number"
                            className="h-7 px-2 text-[11px] md:text-[11px]"
                          />
                          <div className="mt-2.5 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setVendorRefOpen(false)}
                              className="h-7 px-2.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted transition-colors"
                              style={{ fontWeight: 500 }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateRMA(rma.id, { vendorRMANumber: vendorRefDraft.trim() });
                                setVendorRefOpen(false);
                              }}
                              className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-[11px] hover:bg-primary/90 transition-colors"
                              style={{ fontWeight: 600 }}
                            >
                              Save
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-[11px] text-foreground tabular-nums text-right" style={{ fontWeight: 600 }}>
                        {r.value || dash}
                      </span>
                    )}
                  </div>
                ))}
                {/* Words to find this return by, kept with the rest of what
                    the record carries. */}
                <RMATags
                  tags={rma.tags ?? []}
                  editable={rmaEditable}
                  onChange={(next) => guardEdit(() => updateRMA(rma.id, { tags: next }), 'minor')}
                />
                {/* What was written about the return when it was raised.
                    A note typed on the last step of the create flow had
                    nowhere to be read afterwards on this page, which made it
                    a field that swallowed what people wrote. It is a
                    paragraph, so it sits under its label rather than being
                    squeezed into the right-hand column. */}
                {rma.notes && (
                  <div className="flex flex-col gap-1 border-t border-[#F1F5F9] pt-2.5">
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                      Notes
                    </span>
                    <span className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">
                      {rma.notes}
                    </span>
                  </div>
                )}
                {/* The refund account is off this card: it reads on the
                    vendor card, in Shipping & Billing, where the rest of what
                    settles with this vendor reads. */}
              </>
            );
          })()}
        </div>
      </SidebarSection>
      </div>

      {/* 3-Way Matching panel removed per BA. */}

      {/* ── Additional Charges ─────────────────────────────────
          Invoice-only (item #5): the concept doesn't apply to RMAs. */}
      {!isRma && (
      <SidebarSection
        icon={Receipt}
        title="Additional Charges"
        open={open.charges}
        onToggle={() => toggle('charges')}
        collapsedSummary={
          additionalCharges.length > 0
            ? formatMoney(additionalCharges.reduce((s, c) => s + c.amount, 0), invoice.currency)
            : 'None'
        }
      >
        {additionalCharges.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-2" style={{ fontWeight: 500 }}>
            No additional charges on this invoice.
          </p>
        ) : (
          <div className="space-y-2">
            {additionalCharges.map((charge, idx) => (
              <div key={idx} className="flex items-start justify-between gap-2 px-2.5 py-2 rounded-md bg-slate-50/60 border border-slate-100">
                <div className="min-w-0">
                  <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>{charge.label}</p>
                  <p className="text-[10px] text-slate-500 tabular-nums mt-0.5" style={{ fontWeight: 500 }}>{charge.gl}</p>
                </div>
                <span className="text-[11px] text-foreground tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                  {formatMoney(charge.amount, invoice.currency)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 text-[12px]">
              <span className="text-foreground" style={{ fontWeight: 600 }}>Subtotal</span>
              <span className="text-foreground tabular-nums" style={{ fontWeight: 700 }}>
                {formatMoney(additionalCharges.reduce((s, c) => s + c.amount, 0), invoice.currency)}
              </span>
            </div>
          </div>
        )}
      </SidebarSection>
      )}

      {/* ── Freight & Logistics ──────────────────────────────── */}
      <SidebarSection
        icon={Truck}
        title={isRma ? 'Return Logistics' : 'Freight & Logistics'}
        open={open.freight}
        onToggle={() => toggle('freight')}
        collapsedSummary={isRma && rma
          ? (rmaCarrier?.name || '–')
          : (freightDetails.amount > 0 ? formatMoney(freightDetails.amount, invoice.currency) : 'None')}
      >
        {isRma && rma ? (
          /* Item #7 — Freight & Logistics for RMA: carrier and return
             ship-to. Mirrors the sidebar row typography. */
          <div className="space-y-2.5">
            {/* Return Ship-To is off this card. Where the goods go is
                settled in the create flow and read on the return's own
                shipment records; the control here was a second place to
                change it, sitting under a heading about carriers. */}
            {/* Carrier reads as the same partner-style card the create form
                confirmed it on, so the return shows the identity the user
                picked rather than a bare name. */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Carrier</p>
                {rmaEditable && (
                  <button
                    type="button"
                    onClick={() => guardEdit(() => setCarrierPickerOpen(true), 'minor')}
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Edit3 className="w-2.5 h-2.5" />
                    Change
                  </button>
                )}
              </div>
              {rmaCarrier && (
                <>
                  <CarrierCard carrier={rmaCarrier} isSelected hideCheckmark readOnly showStatusBadge />
                  {/* Name the vendor rather than saying "this vendor": the
                      carrier and the returns desk both resolve from whichever
                      partner the return is going to, and that partner is not
                      always the one on the RMA header. */}
                  <div className="flex items-start gap-1.5">
                    {rmaCarrierInherited ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-px" />
                    ) : (
                      <Edit3 className="w-3 h-3 text-slate-400 shrink-0 mt-px" />
                    )}
                    <span className="text-[10px] text-slate-500 leading-snug" style={{ fontWeight: 500 }}>
                      {rmaCarrierInherited ? (
                        <>Inherited from <span style={{ fontWeight: 600 }}>{rmaCarrierSite}</span>'s partner profile.</>
                      ) : (
                        <>Chosen for this return. <span style={{ fontWeight: 600 }}>{rmaCarrierSite}</span>'s default is {rmaDefaultCarrier?.name}.</>
                      )}
                    </span>
                  </div>
                </>
              )}
              {/* The same browser the create form picks from, so changing the
                  carrier later is the same decision in the same shape. Carrier
                  setup itself lives on the partner profile. */}
              <CarrierBrowseModal
                open={carrierPickerOpen}
                onOpenChange={setCarrierPickerOpen}
                title="Return Logistics"
                subtitle="Choose a carrier for this return"
                entityNoun="return"
                selectedId={rmaCarrier?.id ?? null}
                vendorDefaultCarrierId={rmaDefaultCarrier?.id ?? null}
                onApply={(c) => updateRMA(rma.id, { carrier: c.name })}
              />
            </div>
            {/* The returns desk used to be repeated here, under the
                carrier. It is one card up the rail now, inside Vendor
                Information, where the order keeps it. */}
            {/* Packing and dock notes are the one logistics field the user
                writes rather than inherits, so they read last. */}
            {rmaEditable ? (
              <div
                className="pt-2.5 border-t border-slate-100 space-y-1.5"
                onFocusCapture={() => guardEdit(() => {}, 'minor')}
              >
                <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Shipping Instruction</Label>
                <ExpandableTextarea
                  value={rma.shippingInstruction ?? ''}
                  onChange={(v) => updateRMA(rma.id, { shippingInstruction: v })}
                  placeholder="Packing, carrier, or dock instructions for this return."
                  expandMode="full"
                />
              </div>
            ) : rma.shippingInstruction ? (
              <div className="pt-2.5 border-t border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1" style={{ fontWeight: 600 }}>Shipping Instruction</p>
                <p className="text-[11px] text-slate-700 leading-snug" style={{ fontWeight: 500 }}>{rma.shippingInstruction}</p>
              </div>
            ) : null}
          </div>
        ) : freightDetails.amount === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-2" style={{ fontWeight: 500 }}>
            No freight on this invoice.
          </p>
        ) : (
          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400" style={{ fontWeight: 600 }}>Freight amount</p>
              <p className="text-[18px] text-foreground tabular-nums mt-0.5" style={{ fontWeight: 700, lineHeight: 1.1 }}>
                {formatMoney(freightDetails.amount, invoice.currency)}
              </p>
            </div>

            {/* Carrier — partner-style CarrierCard, identical to the
                create-invoice freight picker so the carrier identity reads
                the same across capture and review. */}
            {freightDetails.carrier && (
              <div className="pt-2.5 border-t border-slate-100 space-y-1.5">
                <p className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Carrier</p>
                <CarrierCard
                  carrier={freightDetails.carrier}
                  isSelected
                  hideCheckmark
                  readOnly
                  showStatusBadge
                />
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-100">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>GL account</span>
                <span className="text-[11px] text-foreground tabular-nums text-right" style={{ fontWeight: 600 }}>
                  {freightDetails.glAccount}
                </span>
              </div>
            </div>
          </div>
        )}
      </SidebarSection>

      {/* ── Flags & Exceptions ──────────────────────────────── */}
      {(invoice.is_exception || invoice.is_payment_held) && (
        <SidebarSection
          icon={Flag}
          title="Flags"
          open={open.flags}
          onToggle={() => toggle('flags')}
          collapsedSummary={
            <span className="text-red-600" style={{ fontWeight: 600 }}>
              {[invoice.is_exception && 'Exception', invoice.is_payment_held && 'Hold'].filter(Boolean).join(' · ')}
            </span>
          }
        >
          <div className="space-y-2">
            {invoice.is_exception && (
              <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-red-50 border border-red-100">
                <Flag className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-red-900" style={{ fontWeight: 600 }}>Exception raised</p>
                  <p className="text-[11px] text-red-800/80 mt-0.5">Invoice is excluded from GL posting until the exception is resolved.</p>
                </div>
              </div>
            )}
            {invoice.is_payment_held && (
              <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-amber-50 border border-amber-100">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-amber-900" style={{ fontWeight: 600 }}>Payment hold active</p>
                  <p className="text-[11px] text-amber-800/80 mt-0.5">Posted to GL but payments are blocked.</p>
                </div>
              </div>
            )}
          </div>
        </SidebarSection>
      )}

      {/* ── Invoice Summary / Return Summary ────────────────────
          Item #8: RMA collapses the whole breakdown into a single
          "Return value" (Σ returnQty × unitPrice). */}
      {(() => {
        // Rounded line by line, which is what the ledger does with the same
        // figures. Summing at full precision and rounding once at the end put
        // the summary a cent under the GL's own "Goods ship back" on returns
        // where the per-line products did not land on whole cents.
        const rmaReturnValue = isRma && rma
          ? rma.items.reduce(
              (s, li) => s + Math.round(authorizedQty(li) * li.unitPrice * 100) / 100,
              0,
            )
          : 0;
        // Every figure on the summary is in the return's (the PO's) currency,
        // with dollars on hover at the receiving-day rate.
        const summaryFx = isRma && rma ? returnFx(rma) : null;
        return (
      <SidebarSection
        icon={Wallet}
        title={isRma ? 'Return Summary' : 'Invoice Summary'}
        open={open.summary}
        onToggle={() => toggle('summary')}
        collapsedSummary={
          isRma
            ? formatMoney(Math.round(rmaReturnValue * 100) / 100, invoice.currency)
            : formatMoney(Math.max(0, Math.round((numbers.total - (numbers.credits ?? 0)) * 100) / 100), invoice.currency)
        }
      >
        {isRma && rma ? (
          (() => {
            // Currency Touchpoints Map (2026-11-24). The return value is at
            // the receiving rate, the rate its receipt was booked at. Of it,
            // what the vendor settles (the credit note and the refund) is
            // worth today's rate, until they settle; what reverses (goods
            // never invoiced) stays at the receiving rate. The gap between the
            // two is the FX variance, which the currency block below states.
            //
            // The rows add back to the return value at the receiving rate:
            // settled + charges + any loss is everything that was invoiced,
            // and reversed, replacement and written off are the rest. They
            // replace Refund / Vendor credit / Reversed (unpaid), which split
            // what is settled by where it came from; that split is on the
            // Settled row's hover.
            const s = returnSettlementFx(rma);
            const code = invoice.currency;
            const p = s.parts;
            const settleFx = s.foreign ? settlementMoneyFx(s) : null;
            const at = (where: 'today' | 'receiving') =>
              !s.foreign
                ? null
                : where === 'today'
                  ? s.locked
                    ? 'at the settlement rate'
                    : "at today's rate"
                  : 'at receiving rate';
            const settlement = rma.creditTerms?.refundOrCredit ?? null;
            const settledSplit = [
              p.paid > 0.004 ? `${settlement === 'Credit' ? 'Credit' : 'Refund'} ${moneyIn(p.paid, code)} (already paid for)` : null,
              p.credit > 0.004 ? `vendor credit ${moneyIn(p.credit, code)} (against the open invoice)` : null,
            ]
              .filter(Boolean)
              .join(' and ');
            const deductions = round2(p.charges + p.loss);
            type SummaryRow = {
              key: string;
              label: string;
              sub: string;
              tooltip?: string;
              value: number;
              base: number;
              fx: MoneyFx | null;
              strong?: boolean;
            };
            const rows: SummaryRow[] = [];
            if (p.settles > 0.004)
              rows.push({
                key: 'settled',
                label: 'Settled by vendor',
                sub: `${moneyIn(p.settles, code)}${at('today') ? ` ${at('today')}` : ''}`,
                tooltip: `${settledSplit ? `${settledSplit[0]!.toUpperCase()}${settledSplit.slice(1)}` : 'What was invoiced'}${
                  deductions > 0.004 ? `, less ${moneyIn(deductions, code)} kept back or unpaid` : ''
                }. The credit note and the refund come back at ${s.locked ? 'the rate on the day the vendor settled' : "today's rate until the vendor settles"}.`,
                value: p.settles,
                base: s.foreign ? s.settlesNow : p.settles,
                fx: settleFx,
                strong: true,
              });
            if (p.reverses > 0.004)
              rows.push({
                // Goods never billed: the receipt's accrual reverses and
                // nothing comes back for them (ERP-8688).
                key: 'reversed',
                label: 'Reversed, not invoiced',
                sub: `${moneyIn(p.reverses, code)}${at('receiving') ? ` ${at('receiving')}` : ''}`,
                tooltip: "Goods we hadn't been invoiced for. The receipt's accrual reverses at the rate it was booked at, so nothing comes back and there's no FX.",
                value: p.reverses,
                base: s.base.reverses,
                fx: summaryFx,
              });
            if (p.replacement > 0.004)
              rows.push({
                key: 'replacement',
                label: 'Replacement',
                sub: `${moneyIn(p.replacement, code)}${at('receiving') ? ` ${at('receiving')}` : ''} · stock comes back in`,
                value: p.replacement,
                base: s.base.replacement,
                fx: summaryFx,
              });
            if (p.loss > 0.004)
              rows.push({
                key: 'loss',
                label: 'Not paid, booked as a loss',
                sub: `${moneyIn(p.loss, code)}${at('receiving') ? ` ${at('receiving')}` : ''} · RMA Settlement Loss`,
                value: p.loss,
                base: s.base.loss,
                fx: summaryFx,
              });
            if (p.writtenOff > 0.004)
              rows.push({
                key: 'write-off',
                label: 'Written off as a loss',
                sub: `${moneyIn(p.writtenOff, code)}${at('receiving') ? ` ${at('receiving')}` : ''} · nothing is coming back for it`,
                value: p.writtenOff,
                base: s.base.writtenOff,
                fx: summaryFx,
              });

            // What the vendor keeps back, each charge by name: a restocking
            // fee and return freight are two deductions agreed for different
            // reasons. A fee held only as a percentage reads as its own line.
            // They are part of what was invoiced, at the receiving rate, and
            // the PKR figures share the charges' total to the paisa.
            const settlementWord =
              settlement === 'Credit' ? 'credit' : settlement === 'Refund' ? 'refund' : 'claim';
            const listed = (rma.additionalCharges ?? []).filter((c) => Math.abs(c.amount) > 0.004);
            const feeListed = listed.some((c) => c.type === 'Restocking fee');
            const feePct = rma.creditTerms?.restockingFee ?? 0;
            const chargeLines = [
              ...listed.map((c) => ({ id: String(c.id), type: c.type, amount: Math.round(c.amount * 100) / 100, description: c.description?.trim() ?? '' })),
              ...(!feeListed && feePct > 0 && p.charges > 0.004
                ? [{ id: 'pct-fee', type: 'Restocking fee', amount: restockingFeeAmount(rma, feePct), description: `${feePct}% of the return value` }]
                : []),
            ]
              .filter((c) => c.amount > 0.004)
              .sort((a, b) => b.amount - a.amount);
            const chargeBases = p.charges > 0.004 ? splitToBase(chargeLines.map((c) => c.amount), s.receivingRate, s.base.charges) : [];
            /** The vendor's promise about paying, resolved to a date where the
             *  clock has started and said in words where it has not. */
            const refundPromise = (() => {
              const when = expectedRefundDate(rma)
                ? formatDate(expectedRefundDate(rma)!)
                : refundExpectationLabel(rma);
              if (!when) return null;
              const how = rma.refundExpectation?.method;
              return how && how !== 'Unknown' ? `${when} · by ${how}` : when;
            })();
            return (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 tabular-nums" style={{ fontWeight: 600 }}>
                      Return value{s.foreign ? ` · receiving rate ${formatRate(s.receivingRate)}` : ''}
                    </p>
                    <p className="text-[22px] text-foreground tabular-nums mt-0.5" style={{ fontWeight: 700, lineHeight: 1.1 }}>
                      <BaseMoney value={Math.round(rmaReturnValue * 100) / 100} currency={code} fx={summaryFx} role="Return currency" />
                    </p>
                    <p className="text-[11px] text-slate-400 tabular-nums mt-1" style={{ fontWeight: 500 }}>
                      Sum of authorized qty × unit price
                    </p>
                  </div>
                </div>
                {(rows.length > 0 || chargeLines.length > 0) && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    {rows.map((r) => (
                      <div key={r.key} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span
                            className={`block text-[12px] ${r.strong ? 'text-foreground' : 'text-slate-600'}`}
                            style={{ fontWeight: r.strong ? 600 : 500 }}
                          >
                            {r.label}
                            {r.tooltip && (
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`About ${r.label}`}
                                    className="ml-1 inline-flex align-middle text-slate-400 hover:text-slate-600"
                                  >
                                    <Info className="w-3 h-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[260px] text-[11px]">
                                  {r.tooltip}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                          <span className="block text-[10px] text-slate-400 tabular-nums">{r.sub}</span>
                        </span>
                        <span
                          className={`shrink-0 text-[12px] tabular-nums ${r.strong ? 'text-primary' : 'text-foreground'}`}
                          style={{ fontWeight: r.strong ? 700 : 600 }}
                        >
                          <BaseMoney value={r.value} currency={code} fx={r.fx} baseValue={r.base} role="Return currency" />
                        </span>
                      </div>
                    ))}
                    {chargeLines.map((charge, idx) => (
                      <div key={charge.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[12px] text-slate-600" style={{ fontWeight: 500 }}>
                            {charge.type}
                          </span>
                          <span className="block text-[10px] text-slate-400 tabular-nums">
                            {charge.description ||
                              (idx === 0 ? `Kept back before the ${settlementWord} settles` : 'Kept back by the vendor')}
                            {s.foreign ? ` · ${moneyIn(charge.amount, code)} at receiving rate` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] tabular-nums text-rose-600" style={{ fontWeight: 600 }}>
                          −<BaseMoney value={charge.amount} currency={code} fx={summaryFx} baseValue={chargeBases[idx]} role="Return currency" />
                        </span>
                      </div>
                    ))}
                    {chargeLines.length > 1 && (
                      <div className="flex items-start justify-between gap-2 border-t border-slate-100 pt-2">
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                          Total charges
                        </span>
                        <span className="shrink-0 text-[12px] tabular-nums text-rose-600" style={{ fontWeight: 700 }}>
                          −<BaseMoney
                            value={chargeLines.reduce((sum, c) => sum + c.amount, 0)}
                            currency={code}
                            fx={summaryFx}
                            baseValue={s.base.charges}
                            role="Return currency"
                          />
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {/* The return's currency block: what the vendor settles,
                    what comes back today and into which account, the FX
                    variance and the rate. */}
                <ReturnCurrencyBlock rma={rma} onViewConfig={() => onOpenCurrencyConfig?.()} />
                {/* When the money is due, under what is owed. */}
                {refundPromise && (
                  <div className="mt-3 flex items-start justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                      Expected
                    </span>
                    <span
                      className="shrink-0 text-[11px] text-foreground"
                      style={{ fontWeight: 600 }}
                    >
                      {refundPromise}
                    </span>
                  </div>
                )}
              </>
            );
          })()
        ) : (
          <>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-400" style={{ fontWeight: 600 }}>Total Amount</p>
            {/* Hero reflects credit memos (feedback 7/20/26): the number
                the AP clerk owes is after credits; the pre-credit value
                reads back as "Original total" right under it. */}
            <p className="text-[22px] text-foreground tabular-nums mt-0.5" style={{ fontWeight: 700, lineHeight: 1.1 }}>
              {formatMoney(Math.max(0, Math.round((numbers.total - (numbers.credits ?? 0)) * 100) / 100), invoice.currency)}
            </p>
            {(numbers.credits ?? 0) > 0 && (
              <p className="text-[11px] text-slate-400 tabular-nums mt-1" style={{ fontWeight: 500 }}>
                Original total {formatMoney(numbers.total, invoice.currency)}
              </p>
            )}
          </div>
          {/* Settled (full credit memo, no cash) reads back as Settled
              here too (feedback 7/22/26), matching the header pill. */}
          {invoice.status === 'Settled' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] shrink-0 mt-0.5"
              style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}>
              Settled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-px rounded border text-[10px] shrink-0 mt-0.5"
              style={{ fontWeight: 600, backgroundColor: statusPalette.bg, color: statusPalette.color, borderColor: statusPalette.border }}>
              {statusDisplayLabel(status, invoice.type)}
            </span>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-foreground tabular-nums" style={{ fontWeight: 500 }}>
              {formatMoney(numbers.subtotal, invoice.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-500">Tax</span>
            <span className="text-foreground tabular-nums" style={{ fontWeight: 500 }}>
              {formatMoney(numbers.tax, invoice.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-500">Freight</span>
            <span className="text-foreground tabular-nums" style={{ fontWeight: 500 }}>
              {formatMoney(numbers.freight, invoice.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-slate-500">Additional charges</span>
            <span className="text-foreground tabular-nums" style={{ fontWeight: 500 }}>
              {formatMoney(numbers.additional, invoice.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px] pt-1.5 mt-1.5 border-t border-slate-100">
            <span className="text-foreground" style={{ fontWeight: 600 }}>Invoice total</span>
            <span className="text-foreground tabular-nums" style={{ fontWeight: 700 }}>
              {formatMoney(numbers.total, invoice.currency)}
            </span>
          </div>
          {/* Credit memos reduce the amount owed — the reduction and the
              resulting amount due read back explicitly (7/15/26). */}
          {(numbers.credits ?? 0) > 0 && (
            <>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-slate-500">Credit memos</span>
                <span className="tabular-nums" style={{ fontWeight: 600, color: '#047857' }}>
                  −{formatMoney(numbers.credits ?? 0, invoice.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px] pt-1.5 mt-1.5 border-t border-slate-100">
                <span className="text-foreground" style={{ fontWeight: 600 }}>Amount due after credits</span>
                <span className="text-foreground tabular-nums" style={{ fontWeight: 700 }}>
                  {formatMoney(Math.max(0, Math.round((numbers.total - (numbers.credits ?? 0)) * 100) / 100), invoice.currency)}
                </span>
              </div>
            </>
          )}
        </div>
          </>
        )}

        {/* Payment progress bar — invoice-only (paid/outstanding are
            invoice concepts; item #8 hides them for RMA). */}
        {!isRma && numbers.total > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            {/* "Paid" = payments + applied prepayments + credit memos —
                the complement of the outstanding balance, matching the
                Linked Records tab's reconciliation line. */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5" style={{ fontWeight: 500 }}>
              <span>{invoice.status === 'Settled' ? 'Settled' : 'Paid'}</span>
              <span className="tabular-nums">
                {Math.round((numbers.paid / numbers.total) * 100)}%
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(numbers.paid / numbers.total) * 100}%`,
                  backgroundColor: isPaid ? '#10B981' : isPartial ? '#F59E0B' : '#94A3B8',
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] mt-1.5" style={{ fontWeight: 500 }}>
              <span className="text-slate-500">
                {invoice.status === 'Settled' ? 'Settled by credit memos:' : 'Paid:'} <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{formatMoney(numbers.paid, invoice.currency)}</span>
              </span>
              <span className="text-slate-500">
                Outstanding: <span className="tabular-nums" style={{ fontWeight: 600, color: numbers.outstanding > 0 ? '#B45309' : '#047857' }}>
                  {formatMoney(numbers.outstanding, invoice.currency)}
                </span>
              </span>
            </div>
          </div>
        )}
      </SidebarSection>
        );
      })()}

      {/* ── Credit or refund ──────────────────────────────────────
          The creation flow's last step, read back.
          
          It asks only where money has already gone out: goods never billed
          credit the accrual when they ship and goods on an open invoice take
          a vendor credit, both without a decision. So the card either shows
          the choice that was made and lets a draft change it, or says what
          is happening on its own. */}
      {isRma && rma && (() => {
        const scenarios = rmaScenarioValues(rma);
        // How many lines that figure covers, which the row now names.
        const paidItemCount = rma.items.filter(
          (li) => (invoiceSplitForRMALine(rma.vendor, rma.receivingNumbers, li.originId, li.sku, li.receivedQty)?.paid ?? 0) > 0,
        ).length;
        const paid = scenarios['credit-paid'];
        const settlement = rma.creditTerms?.refundOrCredit ?? null;
        const automatic =
          scenarios.accrual + scenarios['accrual-noclaim'] > 0.004
            ? 'The goods were never billed, so the accrual comes off when they ship.'
            : scenarios['credit-unpaid'] > 0.004
              ? 'The invoice is still open, so a vendor credit is applied against it.'
              : scenarios.replacement > 0.004
                ? 'Replacement stock comes back in. No money moves.'
                : 'Nothing here was paid for, so there is nothing to claim back.';
        return (
          <SidebarSection
            icon={CircleDollarSign}
            title="Credit or refund"
            open={open.payment}
            onToggle={() => toggle('payment')}
            collapsedSummary={
              paid > 0.004
                // Every return records how it settles, from the moment it is
                // raised, so there is no unanswered state left to name.
                ? settlement ?? 'Refund'
                : 'Settles automatically'
            }
          >
            {/* A credit return closed when the last of it shipped (DQ-01).
                The credit it raised is not this return's to confirm, so the
                section says where it went and who finishes it. */}
            {rma.pendingCredit && !rma.creditNoteRef && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-900" style={{ fontSize: 12, fontWeight: 600 }}>
                    Credit pending · {rma.pendingCredit.ref}
                  </span>
                  <span className="text-amber-900 tabular-nums" style={{ fontSize: 12, fontWeight: 700 }}>
                    {/* In the return's currency: the credit is confirmed in it. */}
                    {moneyIn(rma.pendingCredit.amount, invoice.currency)}
                  </span>
                </div>
                <p className="m-0 mt-1 text-amber-800" style={{ fontSize: 11 }}>
                  Raised when everything shipped. Accounting confirms it in partner credits with the vendor's memo number, amount and date.
                </p>
                {pageFx && (() => {
                  // What the vendor settles is worth today's rate until they
                  // do (2026-11-24); the gap to the receiving rate is the FX
                  // variance on the Return Summary.
                  const settle = returnSettlementFx(rma);
                  return (
                    <p className="m-0 mt-1 text-amber-800 tabular-nums" style={{ fontSize: 11 }}>
                      Confirmed in {invoice.currency}. Until then it's at today's rate, {rateSentence(invoice.currency, settle.settleRate)} (
                      {moneyIn(toBase(rma.pendingCredit.amount, settle.settleRate), BASE_CURRENCY)}). Against the receiving rate,{' '}
                      {formatRate(pageFx.rate)}, the difference is the FX variance, to FX Gain or FX Loss.
                    </p>
                  );
                })()}
              </div>
            )}
            {paid > 0.004 ? (
              <div>
                {/* The same two questions the settlement step asks, drawn the
                    same way: what is claimable on a bordered row, then the two
                    options as cards that say what each one means and what it
                    is worth. It was a sentence over two chips here, which is
                    not the same decision wearing a different coat -- it is the
                    decision made harder to see. */}
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                  <span className="text-slate-900" style={{ fontSize: 12, fontWeight: 600 }}>
                    Paid items ({paidItemCount})
                  </span>
                  <span
                    className="text-slate-900 tabular-nums"
                    style={{ fontSize: 12, fontWeight: 700 }}
                  >
                    {formatMoney(paid, invoice.currency)}
                  </span>
                </div>
                <p className="m-0 mb-4 mt-1 text-slate-500" style={{ fontSize: 11 }}>
                  What you can get back
                </p>

                <p className="m-0 mb-1.5 text-slate-600" style={{ fontSize: 11, fontWeight: 600 }}>
                  Choose how you get it back:
                </p>
                <div className="grid gap-2">
                  {(
                    [
                      {
                        choice: 'Refund' as const,
                        icon: Banknote,
                        blurb: 'The vendor pays you back. Accounting logs it against what they owe, into the account it arrives in.',
                      },
                      {
                        choice: 'Credit' as const,
                        icon: ReceiptText,
                        blurb:
                          'A credit against what you owe this vendor, used on a future invoice.',
                      },
                    ]
                  ).map(({ choice, icon: ChoiceIcon, blurb }) => {
                    const on = settlement === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        aria-pressed={on}
                        disabled={!rmaMaterialOk}
                        onClick={() =>
                          guardEdit(() =>
                            updateRMA(rma.id, {
                              creditTerms: {
                                ...(rma.creditTerms ?? { creditPct: 100, restockingFee: 0 }),
                                refundOrCredit: choice,
                              },
                            }),
                          )
                        }
                        className={`relative flex items-start gap-3 rounded-lg border bg-white p-3 text-left transition-all disabled:cursor-not-allowed ${
                          on
                            ? 'border-primary shadow-[0_2px_12px_-4px_rgba(10,119,255,0.25)]'
                            : rmaMaterialOk
                              ? 'border-[#E8ECF1] hover:border-primary/40 hover:shadow-[0_4px_16px_-6px_rgba(10,119,255,0.18)]'
                              : 'border-[#E8ECF1] opacity-70'
                        }`}
                      >
                        <span
                          className={`flex w-8 h-8 shrink-0 items-center justify-center rounded-lg ${
                            on ? 'bg-primary text-white' : 'bg-blue-50 text-primary'
                          }`}
                        >
                          <ChoiceIcon className="w-3.5 h-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-[12px] text-foreground" style={{ fontWeight: 700 }}>
                              {choice}
                            </span>
                            <span
                              className={`text-[12px] tabular-nums ${on ? 'text-primary' : 'text-slate-500'}`}
                              style={{ fontWeight: 700 }}
                            >
                              {formatMoney(paid, invoice.currency)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                            {blurb}
                          </span>
                        </span>
                        {on && (
                          <span className="absolute -right-2 -top-2 flex w-5 h-5 items-center justify-center rounded-full bg-primary shadow-sm">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed text-slate-600">
                <span className="text-foreground" style={{ fontWeight: 600 }}>
                  Nothing to choose.
                </span>{' '}
                {automatic}
              </p>
            )}
            {/* Where the money lands and at what rate, with the settlement
                choice (Currency Touchpoints Map, 2026-11-24): the deposit
                account and the rate are set in the currency configuration. */}
            {(() => {
              const settle = returnSettlementFx(rma);
              return (
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }}>Deposited to</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-700" style={{ fontSize: 11.5, fontWeight: 500 }}>
                      <CurrencyFlag code={settle.accountCurrency} size={11} />
                      <span className="truncate">{settle.account?.label ?? 'No account'}</span>
                      <span className="shrink-0 text-slate-400">· {settle.accountCurrency}</span>
                    </span>
                  </div>
                  {settle.foreign ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }}>Rate</span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-500 tabular-nums" style={{ fontSize: 11 }}>{settleRateLine(settle)}</span>
                        <RateTypeChip type={settle.rateType} />
                      </span>
                    </div>
                  ) : (
                    <p className="text-slate-400" style={{ fontSize: 10.5 }}>
                      {BASE_CURRENCY} is the base currency, so there's no conversion.
                    </p>
                  )}
                  {onOpenCurrencyConfig && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={onOpenCurrencyConfig}
                        className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 hover:text-primary cursor-pointer"
                        style={{ fontWeight: 500 }}
                      >
                        <Settings2 className="w-3 h-3" />
                        {settle.locked || readOnly ? 'View currency configuration' : 'Change in configuration'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </SidebarSection>
        );
      })()}

      {/* ── Vendor charges ───────────────────────────────────
          Money the vendor keeps back out of the refund: restocking, return
          freight, an intake or handling fee. It was called "Additional
          charges", which reads as something added to what we owe. It is the
          opposite -- it comes off what we are owed -- and a reader has no way
          to tell from the old title which direction the money moves, so the
          heading now says it and the tooltip says what counts. The invoice
          create modal's own panel does the asking, so a charge is entered
          the same way it is on an invoice. */}
      {isRma && rma && (
        <SidebarSection
          icon={Receipt}
          title="Vendor charges"
          info="What the vendor keeps back out of your refund: a restocking fee, return freight, an intake or handling fee. Each one comes off before the money reaches you."
          open={open.charges}
          onToggle={() => toggle('charges')}
          collapsedSummary={
            (rma.additionalCharges ?? []).length > 0
              ? formatMoney(
                  (rma.additionalCharges ?? []).reduce((n, c) => n + c.amount, 0),
                  invoice.currency,
                )
              : 'None'
          }
        >
          {rmaMaterialOk ? (
            <>
              {/* Edited against a draft, committed on Save.
                  
                  The panel reports every keystroke, and every keystroke went
                  straight onto the return. Nothing was lost by that, but
                  nothing was recorded either: a charge typed in appeared on
                  the record with no moment anybody had agreed to, and once
                  the versions started watching charges, "53.18" would have
                  cut five of them on the way to being typed. */}
              <AdditionalChargesPanel
                currency={invoice.currency}
                charges={chargeDraft}
                onChange={setChargeDraft}
                types={VENDOR_CHARGE_TYPES}
                totalLabel="Total Charges"
                addLabel="Add charge"
                emptyNote="No charges yet. Add what the vendor keeps back."
                glNote="Taken off what the vendor credits back, and posted against the return's settlement."
              />
              {chargesDirty && (
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setChargeDraft(rma.additionalCharges ?? [])}
                    className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] text-muted-foreground transition-colors hover:bg-slate-50"
                    style={{ fontWeight: 500 }}
                  >
                    Discard
                  </button>
                  {/* A restocking fee somebody has just agreed is a fact
                      about the vendor, not only about this return, and the
                      save is the moment to ask how far it reaches. The
                      purchase order asks the same question when an item is
                      qualified against a vendor it is not on file for. */}
                  <button
                    type="button"
                    onClick={() =>
                      guardEdit(() => {
                        if (feeNeedsScope) {
                          setFeeScopeOpen(true);
                          return;
                        }
                        commitCharges();
                      })
                    }
                    className="h-8 rounded-lg border-0 px-3 text-[12px] text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ fontWeight: 500, backgroundColor: 'hsl(var(--primary))' }}
                  >
                    Save charges
                  </button>
                </div>
              )}
              <RestockingFeeScopeModal
                open={feeScopeOpen}
                onOpenChange={setFeeScopeOpen}
                vendorName={rma.vendor}
                pct={draftFeePct ?? 0}
                amount={draftFeeAmount}
                currentPct={vendorFeeStandard}
                currency={invoice.currency}
                onChoose={(scope) => {
                  if (scope === 'vendor' && draftFeePct !== undefined) {
                    setRestockingStandard(rma.vendor, draftFeePct);
                  }
                  setFeeScopeOpen(false);
                  commitCharges();
                }}
              />
            </>
          ) : (rma.additionalCharges ?? []).length > 0 ? (
            <div className="space-y-1.5">
              {(rma.additionalCharges ?? []).map((charge) => (
                <div key={charge.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-[11px] text-foreground" style={{ fontWeight: 600 }}>
                      {charge.type || 'Charge'}
                    </span>
                    {charge.description && (
                      <span className="block text-[10px] text-slate-500">{charge.description}</span>
                    )}
                  </span>
                  <span
                    className="shrink-0 text-[11px] text-foreground tabular-nums"
                    style={{ fontWeight: 600 }}
                  >
                    {formatMoney(charge.amount, invoice.currency)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  Total
                </span>
                <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 700 }}>
                  {formatMoney(
                    (rma.additionalCharges ?? []).reduce((n, c) => n + c.amount, 0),
                    invoice.currency,
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
              Nothing deducted on this return.
            </p>
          )}
        </SidebarSection>
      )}

      {/* Vendor Information sidebar section removed per BA — the
          header now carries the vendor pill with a HoverCard quick-
          card preview, so the sidebar card was just duplicating it. */}

      {/* Payment Schedule + Linked Records sidebar sections removed
          per BA — due-date / overdue lives inside General Information
          (where it makes more sense), linked records have their own
          tab at the top of the detail page. */}

      {/* Timeline sidebar card removed per feedback 7/15/26 — lifecycle
          history lives in the Recent Activity tab. */}
    </aside>
  );
}
