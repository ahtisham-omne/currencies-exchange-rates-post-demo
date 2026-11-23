/**
 * Credit or refund, asked once per RMA.
 *
 * It did not exist, which is why a newly created draft opened already saying
 * `Replacement / Failed inspection` with nothing having asked (brief 8.1,
 * 8.5). Two questions live here and both of them are answers about a whole
 * RMA rather than about a line: how it settles, and why it is going back.
 *
 * One RMA is one vendor, so "once per RMA" is once per vendor, and a return
 * that becomes three documents is three answers. Asking once for the whole
 * return wrote the same remedy onto three different vendors' credits, which is
 * a claim nobody made.
 *
 * The card and the column are the merge and split step's, not an echo of them:
 * the same `minmax(0, 1fr) 420px` grid with the sidebar space left empty, the
 * same 16px gap between cards, and the same vendor card `ReturnVendorStep.tsx`
 * draws for a branch -- blue Building2 tile, name over the vendor's
 * description, line-item count on the right. A vendor reads the same wherever
 * it appears, and this step is no wider than the one before it.
 *
 * The two questions are asked at the two levels they belong to. Why a part is
 * going back is a fact about the part, so the reason is a dropdown on the
 * line: one return carries a damaged pump and a wrong-part bracket, and a
 * single reason for the document had to be wrong about one of them. How the
 * money settles is a fact about the document, so refund or credit is asked
 * once, under the table. A description field appears only for a line that says
 * Other, the one reason that says nothing on its own; its markup is the
 * vendor-invoicing reason dialog's (`src/app/components/InvoiceReasonDialog.tsx:350-388`).
 *
 * What has been paid decides what the money question can even mean, so it is
 * stated at the top of the card at the size of a headline figure rather than
 * as a column of small print. A part nobody has billed yet comes back with
 * nothing attached, and the user is told which parts those are at the moment
 * they choose, not afterwards. A part with no receiving document behind it has
 * no invoice to check against at all, so it is always eligible; the choice
 * closes only when the whole return is unpaid.
 *
 * Both answers are required before the return can be saved. They were not:
 * the reasoning was that a vendor or a reviewer could supply them after the
 * fact, and that holding a complete return at the door over two dropdowns was
 * the step asking for more than it was owed. Reversed on Oct 9 -- a return
 * saved without them is a return nobody can act on, and the gap was being
 * found downstream instead of here.
 *
 * Nothing is marked until the user presses the button, though. The step opens
 * quiet and only says what is missing once they have tried to leave, so the
 * questions are asked before they are complained about.
 *
 * One resolution per RMA is Eli's rule, and the note at the bottom says so in
 * words rather than only enforcing it: he asked for the constraints explained
 * (brief 8.8).
 */

import { formatMoney as moneyIn } from '@/app/currency/money';
import {
  Banknote,
  Building2,
  CalendarClock,
  ChevronDown,
  Check,
  CircleDollarSign,
  Info,
  MapPin,
  type LucideIcon,
  Paperclip,
  ReceiptText,
  Receipt,
  StickyNote,
  Tags,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { RETURN_REASONS, type ReturnReason, type ReturnType } from '@/app/data/mockRMAs';
import {
  AdditionalChargesPanel,
  VENDOR_CHARGE_TYPES,
  type AdditionalCharge,
} from '@/app/components/vendors/AdditionalChargesPanel';

/** Fulfilment mistakes are settled where the goods are counted, not here, so
 *  this picker offers the reasons a resolution actually turns on. */
const STEP_REASONS = RETURN_REASONS.filter(
  (r) => r !== 'Over-shipped' && r !== 'Not ordered',
);
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/app/components/ui/hover-card';
import { useLayoutEffect, useRef, useState } from 'react';
import { BASE_CURRENCY } from '@/app/currency/currencies';
import { fxToday } from '@/app/currency/rates';
import { viewMoney } from '@/app/components/currency/returnView';
import { CreateReturnCurrencyDialog } from '@/app/components/currency/ReturnCurrencyConfig';
import { Lock, Settings2 as CurrencyIcon } from 'lucide-react';
import { CurrencyFlag } from '@/app/components/currency/CurrencyChip';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import {
  ItemImageWithPreview,
  ItemQuickViewModal,
} from '@/app/components/invoice-details/ItemQuickView';
import { TRACKING_LABELS } from '@/app/data/itemProvenance';
import { imageForSku } from '@/app/lib/itemImages';
import { TrackingTag } from '@/app/components/rma/TrackingTag';
import { DatePicker } from '@/app/components/ui/date-picker';
import {
  CreateLineAttachments,
  type LineAttachmentFile,
} from '@/app/components/rma/CreateLineAttachments';
import { type TrackingMode } from '@/app/data/mockRMAs';

/** Money in PKR, the base currency, at today's rate, like the PO cart
 *  (Mahreen, 2026-11-20). A return takes its receiving-day rate once it is
 *  created; the amounts in its PO's currency are behind the Currency button. */
const formatMoney = (n: number, currency: string = BASE_CURRENCY) => viewMoney('base', n, currency, fxToday(currency));

/** One part on this vendor's return, and what the steps before settled for
 *  it. Shown as a thumbnail and a part number, with the rest on hover. */
export interface ResolutionItem {
  sku: string;
  description: string;
  qty: number;
  uom: string;
  trackingMode: TrackingMode;
  serials: string[];
  serialCount: number;
  lots: string[];
  documents: string[];
  /** What the whole of this share is worth, billed or not. */
  value?: number | undefined;
  /** What of this part's share the vendor has already been paid for. */
  paidQty?: number | undefined;
  paidValue?: number | undefined;
  /** Paid for in full, which is the only case with a refund or a credit to
   *  choose between. Anything else unwinds on its own. */
  fullyPaid?: boolean | undefined;
  /** Nothing on file to check the money against: no receiving document behind
   *  this share, so no invoice either. There is no payment to disqualify it,
   *  so a refund or a credit is always open to it. */
  unlinked?: boolean | undefined;
}

export interface ResolutionTarget {
  vendorCode: string;
  vendorName: string;
  /** Where they are. The address tells two partners of the same name apart;
   *  the description told nobody anything. */
  address?: string | null | undefined;
  lineCount: number;
  units: number;
  uom: string;
  items?: ResolutionItem[] | undefined;
  /** What this vendor has already been paid for, of what is going back.
   *  Zero means there is nothing to choose: goods that were never billed
   *  unwind their accrual, and an open invoice takes a vendor credit. Both
   *  happen on their own. */
  paidQty?: number | undefined;
  paidValue?: number | undefined;
  /** The return's currency: the PO currency of the receipts picked for this
   *  vendor. Paid, Total and Total Charges read in it. */
  currency?: string | undefined;
  /** "PO-11151": the PO that currency comes from. It can't change
   *  (Currency Touchpoints Map, 2026-11-24). */
  currencyPO?: string | null | undefined;
}

export interface ResolutionAnswer {
  returnType: ReturnType | null;
  /** The RMA's reason, kept because the saved document carries one. It follows
   *  the lines: why a part is going back is a fact about the part, and four
   *  parts on one return can each be going back for their own reason. */
  reason: ReturnReason | null;
  note: string;
  /** Why each part is going back, keyed by SKU. */
  reasons?: Record<string, ReturnReason> | undefined;
  /** What Other means, for the lines that say Other. */
  notes?: Record<string, string> | undefined;
  /** Money back or a credit on the account. Asked only where the goods were
   *  paid for, which is the only case where anybody has a choice to make. */
  settlement?: 'Refund' | 'Credit' | null;
  /** The vendor's own number for the return, where they have given one. */
  vendorRMANumber?: string | undefined;
  /** The date the vendor said the refund would arrive by. Optional: the
   *  approval asks again once the vendor has authorized the return. */
  refundExpectedDate?: string | undefined;
}

/** The same control twice, so it is written once. */
function PickOne({
  label,
  value,
  placeholder,
  options,
  onPick,
  ariaLabel,
}: {
  /** Left out where the column heading is already the label. */
  label?: string | undefined;
  /** What reads in the trigger, already in its display form. */
  value: string | null;
  placeholder: string;
  /** Display labels, in the order they should list. */
  options: readonly string[];
  onPick: (chosen: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {label && (
        <label
          className="flex items-center gap-1 text-[11px] text-slate-500"
          style={{ fontWeight: 500 }}
        >
          {label}
        </label>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className={`flex ${label ? 'h-9 px-3' : 'h-8 px-2.5'} w-full cursor-pointer items-center justify-between gap-2 rounded-md border bg-white text-[12px] shadow-none transition-colors hover:border-slate-300 focus:border-primary focus:ring-1 focus:ring-primary/20 ${
              value ? 'border-slate-300 text-foreground' : 'border-slate-200 text-slate-400'
            }`}
          >
            <span className="truncate">{value ?? placeholder}</span>
            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] z-[400]"
        >
          {options.map((o) => (
            <DropdownMenuItem key={o} onClick={() => onPick(o)} className="text-[12px]">
              <span className="flex-1">{o}</span>
              {value === o && <Check className="w-3.5 h-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** One panel in the right-hand column.
 *
 *  The vendor-invoicing create modal's `ReviewSection`: an outlined card
 *  whose header is a 24px tinted icon chip, the title at caption-semibold,
 *  and a chevron that rotates closed. Same split that modal uses -- the
 *  document and its lines on the left, everything asked about them on the
 *  right -- so the two flows read as one product.
 */
function ReviewSection({
  icon: Icon,
  iconClass,
  title,
  rightSlot,
  defaultOpen = true,
  children,
}: {
  icon: LucideIcon;
  /** Tailwind classes for the icon chip's fill and glyph. */
  iconClass: string;
  title: string;
  rightSlot?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  // The panel opens and closes on its own measured height, the way
  // `DashInfoCard` does it: a ResizeObserver keeps the figure current so the
  // content can grow -- a tag added, a file attached -- without the panel
  // having to be told.
  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    setHeight(node.scrollHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(node.scrollHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center px-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 cursor-pointer items-center gap-2.5 py-3 text-left transition-opacity hover:opacity-80"
        >
          <span className={`flex w-6 h-6 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
            <Icon className="w-3.5 h-3.5" />
          </span>
          <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
            {title}
          </span>
          <ChevronDown
            aria-hidden
            className="ml-auto w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        </button>
        {rightSlot}
      </div>
      {/* The body animates on height and opacity together, opacity trailing
          the open by 80ms so the content fades in after the panel has made
          room for it rather than smearing down with it. */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          maxHeight: open ? (height != null ? `${height + 24}px` : '1000px') : '0px',
          opacity: open ? 1 : 0,
          transitionDelay: open ? '0ms, 80ms' : '0ms, 0ms',
        }}
      >
        <div ref={bodyRef} className="px-4 pb-4 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Tags on the return, typed as words rather than chosen from a list.
 *
 *  A fixed vocabulary would be a taxonomy, and a taxonomy is somebody's job
 *  rather than a text field. Enter commits, the cross removes, and the words
 *  are what the returns listing searches on top of the numbers it already
 *  searches. */
function TagField({
  tags,
  onChange,
  vendorName,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  vendorName: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const word = draft.trim();
    setDraft('');
    if (!word) return;
    if (tags.some((t) => t.toLowerCase() === word.toLowerCase())) return;
    onChange([...tags, word]);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-px pl-2 pr-1.5 text-[11px] text-slate-600"
            style={{ fontWeight: 600 }}
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove the tag ${tag}`}
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-slate-400 transition-colors hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Backspace' && !draft && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          aria-label={`Tag the return to ${vendorName}`}
          placeholder={tags.length === 0 ? 'Add a tag, so this is easy to find later' : 'Add another'}
          className="h-6 min-w-[160px] flex-1 border-0 bg-transparent px-1 text-[12px] outline-none placeholder:text-[11px] placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}

/** One part on the return, as a thumbnail and a part number. Everything the
 *  steps before settled for it -- quantity, batches, documents -- opens on
 *  hover rather than filling the card. */
function ItemChip({ item, paid = false }: { item: ResolutionItem; paid?: boolean }) {
  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <HoverCardTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex cursor-help items-center gap-1.5 rounded-md border border-border bg-white py-1 pl-1 pr-2 transition-colors hover:border-primary/30"
        >
          <span className="w-5 h-5 shrink-0 overflow-hidden rounded border border-[#E8ECF1]">
            <ImageWithFallback
              src={imageForSku(item.sku)}
              alt={item.sku}
              className="w-full h-full object-cover"
            />
          </span>
          <span className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>
            {item.sku}
          </span>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {item.qty} {item.uom}
          </span>
          {paid && (item.paidValue ?? 0) > 0.004 && (
            <span className="text-[11px] text-primary tabular-nums" style={{ fontWeight: 600 }}>
              {item.fullyPaid
                ? formatMoney(item.paidValue!)
                : `${item.paidQty} of ${item.qty} paid · ${formatMoney(item.paidValue!)}`}
            </span>
          )}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" sideOffset={8} className="w-[320px] p-0">
        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
          <span className="w-9 h-9 shrink-0 overflow-hidden rounded-md border border-[#E8ECF1]">
            <ImageWithFallback
              src={imageForSku(item.sku)}
              alt={item.sku}
              className="w-full h-full object-cover"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                {item.sku}
              </span>
              <TrackingTag mode={item.trackingMode} />
            </span>
            <span className="block truncate text-[11px] text-slate-500">{item.description}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5 px-3 py-2.5 text-[11px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-slate-500">Going back</span>
            <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
              {item.qty} {item.uom}
            </span>
          </div>
          {item.serialCount > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500">
                {item.serialCount} serial {item.serialCount === 1 ? 'number' : 'numbers'}
              </span>
              <span className="text-foreground tabular-nums">
                {item.serials.join(', ')}
                {item.serialCount > item.serials.length ? ' …' : ''}
              </span>
            </div>
          )}
          {item.lots.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500">Lots</span>
              <span className="text-foreground tabular-nums">{item.lots.join(', ')}</span>
            </div>
          )}
          {item.documents.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500">Receiving documents</span>
              <span className="text-foreground tabular-nums">{item.documents.join(', ')}</span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function ReturnResolutionStep({
  targets,
  answers,
  onAnswer,
  files,
  onFiles,
  tags,
  onTags,
  charges,
  onCharges,
  savedCharges,
  onSaveCharges,
  onDiscardCharges,
  showErrors = false,
}: {
  /** One per RMA the save will write, which is one per vendor once the merge
   *  and split step has had its say. */
  targets: ResolutionTarget[];
  answers: Record<string, ResolutionAnswer>;
  onAnswer: (vendorCode: string, next: Partial<ResolutionAnswer>) => void;
  /** Evidence for the return as a whole, per RMA: the authorization email,
   *  the photographs, the inspection report. It lands on the document's
   *  Attachments tab, in the same cards the detail page draws. */
  files: Record<string, LineAttachmentFile[]>;
  onFiles: (vendorCode: string, next: LineAttachmentFile[]) => void;
  /** Free words for finding this return again, per RMA. */
  tags: Record<string, string[]>;
  onTags: (vendorCode: string, next: string[]) => void;
  /** What the vendor keeps back out of the refund, per RMA. The detail page
   *  asks the same question of a saved return in its own sidebar; asking it
   *  only there meant a restocking fee agreed on the phone had to be typed in
   *  again after the return was created. */
  charges: Record<string, AdditionalCharge[]>;
  onCharges: (vendorCode: string, next: AdditionalCharge[]) => void;
  /** What was last committed, per RMA, which is what Discard goes back to and
   *  what tells the Save pair whether to show itself at all. The detail page
   *  edits its charges against a draft and commits on a button, because a
   *  charge typed in with nothing to press is a figure nobody agreed to. This
   *  step now asks the same way. */
  savedCharges: Record<string, AdditionalCharge[]>;
  /** Commits this vendor's charges. The scope question a restocking fee
   *  raises is asked here, on the button, exactly as it is on the detail
   *  page. */
  onSaveCharges: (vendorCode: string) => void;
  onDiscardCharges: (vendorCode: string) => void;
  /** Raised once the user has tried to save, so an unanswered question is
   *  marked where it is asked rather than only in the band at the bottom. */
  showErrors?: boolean;
}) {
  /** The part a cell was clicked on, shown in the detail page's own quick
   *  view rather than a second one written here. */
  const [preview, setPreview] = useState<ResolutionItem | null>(null);
  /** The vendor whose return's Currency Configuration is open. */
  const [currencyFor, setCurrencyFor] = useState<string | null>(null);
  /** A settlement chosen on a return that is only part billed, held while the
   *  user is told what it will not cover. */
  const [partial, setPartial] = useState<{
    vendorCode: string;
    vendorName: string;
    choice: 'Refund' | 'Credit';
    items: ResolutionItem[];
    covered: number;
    paidTotal: number;
    currency?: string | undefined;
  } | null>(null);
  return (
    <div style={{ padding: '0 0 20px' }}>
      {/* The step's own question, in the band the steps before it wear:
          `ReturnConfigureItems` draws the same white strip with a 32px blue
          icon circle, the question at 13px and the line that bounds it at
          11px. This step had the two lines floating above its card, which
          left the question looking like a caption.

          The negative margins cancel the dialog body's `px-6 py-5` so the
          band reaches the edges the way the earlier steps' does; they are
          this component's only knowledge of its container. */}
      <div className="-mx-6 -mt-5 mb-5 flex items-center gap-3 border-b border-border bg-white px-5 py-3">
        <div className="flex w-8 h-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <CircleDollarSign className="w-4 h-4 text-primary" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
            Select Refund or credit on paid units
          </span>
          <span className="text-[11px] text-slate-500">
            You're asking for a refund or credit only on the units that were paid for.
          </span>
        </div>
      </div>

      {/* The merge and split step's grid, with the sidebar's space left empty.
          The cards ran the full width of the dialog before, which stretched a
          question with two dropdowns in it into something that reads as a
          form. */}
      <div className="grid gap-10" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className="min-w-0">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {targets.map((target) => {
              const answer = answers[target.vendorCode] ?? {
                returnType: null,
                reason: null,
                note: '',
              };
              // The question is asked of every RMA, whatever is behind it: how
              // a return settles is a decision about the document rather than
              // about the parts on it. What the money covers is what the table
              // reports, line by line.
              const items = target.items ?? [];
              const paidTotal =
                Math.round(items.reduce((n, i) => n + (i.paidValue ?? 0), 0) * 100) / 100 ||
                (target.paidValue ?? 0);
              // What a refund or a credit can actually cover.
              //
              // A part with no receiving document behind it has no invoice to
              // check against either, so nothing disqualifies it and the
              // choice is always open to it. A part that has simply not been
              // billed yet is the one the user has to be told about: it goes
              // back either way, and no money comes with it.
              const unlinkedItems = items.filter((i) => i.unlinked);
              const notInvoiced = items.filter(
                (i) => !i.unlinked && (i.paidValue ?? 0) <= 0.004,
              );
              const coveredCount = items.length - notInvoiced.length;
              const canSettle = paidTotal > 0.004 || unlinkedItems.length > 0;
              return (
                <div
                  key={target.vendorCode}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                >
                  {/* The create modal's split, brought over whole: the
                      document and its lines on the left on the surface, the
                      questions asked about them on the right on the canvas,
                      and the rule between them. One white card behind both
                      columns made it a form again; the line is what says
                      these are two halves of a modal. */}
                  <div className="grid items-stretch lg:grid-cols-[70%_30%]">
                  <div className="min-w-0 border-b border-border p-4 lg:border-b-0 lg:border-r">
                  {/* Who the document is with. */}
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="flex min-w-[220px] flex-1 items-start gap-3">
                      <div className="mt-0.5 flex w-9 h-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-primary shadow-sm">
                        <Building2 className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className="truncate text-[13px] text-gray-900"
                          style={{ fontWeight: 600, letterSpacing: '-0.01em' }}
                        >
                          {target.vendorName}
                        </span>
                        {target.address && (
                          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                            <span className="truncate">{target.address}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {/* The return's currency, fixed to its PO's ("Return
                        currency USD · from PO-11233", 2026-11-24), and the
                        Currency button with its amounts in it. */}
                    {target.currency && (
                      <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11.5px] text-slate-500 cursor-default"
                        title="A return is in its PO's currency, so it can't change. Goods from a PO in another currency go on a separate return."
                      >
                        <span style={{ fontWeight: 500 }}>Return currency</span>
                        <CurrencyFlag code={target.currency} size={12} />
                        <span className="text-slate-700" style={{ fontWeight: 600 }}>{target.currency}</span>
                        {target.currencyPO && <span className="text-slate-500">· from {target.currencyPO}</span>}
                        <Lock className="w-3 h-3 text-slate-300" />
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrencyFor(target.vendorCode)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[11.5px] text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
                        style={{ fontWeight: 500 }}
                        aria-label="Open currency configuration"
                      >
                        <CurrencyIcon className="w-3.5 h-3.5" />
                        Currency
                      </button>
                      </div>
                    )}
                  </div>

                  {/* What the answers are about, as the detail page lists it:
                      the part, how much of it is going back, what of that has
                      been paid for, and what comes back. A credit covers the
                      unbilled share as well, because it is applied against the
                      invoice rather than paid out of it; a refund is money,
                      and money only comes back where money went out. */}
                  {items.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
                      <div
                        className={`grid ${'grid-cols-[minmax(0,1.6fr)_184px_96px_112px]'} gap-3 border-b border-border bg-slate-50/80 px-3 py-2 text-[11px] uppercase tracking-wider text-slate-500`}
                        style={{ fontWeight: 600 }}
                      >
                        <span>Item</span>
                        <span>Return reason</span>
                        <span className="text-right">Returning</span>
                        <span className="text-right">Paid</span>
                      </div>
                      {items.map((item) => {
                        // What actually comes back is what went out. A part
                        // paid for in full or in part returns that money,
                        // whichever way it is settled; a part nobody has been
                        // billed for returns nothing, because there is nothing
                        // to return -- it unwinds what was accrued for it
                        // instead. Quoting its list value here read as money
                        // owed.
                        const rowReason = answer.reasons?.[item.sku] ?? null;
                        return (
                          <div key={item.sku} className="border-b border-border/60 last:border-b-0">
                          <div
                            className={`grid ${'grid-cols-[minmax(0,1.6fr)_184px_96px_112px]'} items-center gap-3 px-3 py-2`}
                          >
                            {/* The item as the detail page lists it: a 36px
                                image that previews on click, the part number
                                in mono beside its tracking chip, and the
                                description under both. */}
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="shrink-0">
                                <ItemImageWithPreview
                                  sku={item.sku}
                                  alt={item.sku}
                                  uom={item.uom}
                                  serialized={item.trackingMode === 'serialized'}
                                  trackingLabel={TRACKING_LABELS[item.trackingMode]}
                                  onPreview={() => setPreview(item)}
                                  disabled={preview !== null}
                                  size={36}
                                  contentZ="z-[260]"
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setPreview(item)}
                                    title={`View ${item.sku} details`}
                                    className="font-mono text-[12px] text-slate-900 underline-offset-2 transition-colors hover:text-primary hover:underline hover:decoration-primary/60"
                                    style={{ fontWeight: 700 }}
                                  >
                                    {item.sku}
                                  </button>
                                  <TrackingTag mode={item.trackingMode} />
                                </span>
                                <span className="block truncate text-[12px] text-slate-500">
                                  {item.description}
                                </span>
                              </span>
                            </span>
                            {/* Why this part is going back, asked on the part.
                                One return can carry a damaged pump and a
                                wrong-part bracket, and a single reason at the
                                bottom of the card had to be wrong about one of
                                them. */}
                            <span className="min-w-0">
                              <PickOne
                                value={rowReason}
                                placeholder="Select a reason…"
                                options={STEP_REASONS}
                                onPick={(chosen) =>
                                  onAnswer(target.vendorCode, {
                                    reasons: {
                                      ...(answer.reasons ?? {}),
                                      [item.sku]: chosen as ReturnReason,
                                    },
                                    // The document still carries one reason,
                                    // and the first line to answer sets it.
                                    reason: (answer.reason ?? chosen) as ReturnReason,
                                  })
                                }
                                ariaLabel={`Why ${item.sku} is going back`}
                              />
                            </span>
                            <span className="text-right">
                              <span
                                className="block text-[13px] text-foreground tabular-nums"
                                style={{ fontWeight: 500 }}
                              >
                                {item.qty}
                              </span>
                              <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                                {item.uom}
                              </span>
                            </span>
                            <span className="text-right">
                              <span
                                className="block text-[13px] text-foreground tabular-nums"
                                style={{ fontWeight: 500 }}
                              >
                                {formatMoney(item.paidValue ?? 0, target.currency)}
                              </span>
                              {!item.fullyPaid && (
                                <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>
                                  {(item.paidQty ?? 0) > 0
                                    ? `${item.paidQty} of ${item.qty} ${item.uom}`
                                    : item.unlinked
                                      ? 'no invoice on file'
                                      : 'not billed yet'}
                                </span>
                              )}
                            </span>
                          </div>
                          {/* Other says nothing on its own, so the line that
                              says it gets somewhere to say what it means. */}
                          {rowReason === 'Other' && (
                            <div className="px-3 pb-2.5">
                              <textarea
                                value={answer.notes?.[item.sku] ?? ''}
                                onChange={(e) =>
                                  onAnswer(target.vendorCode, {
                                    notes: { ...(answer.notes ?? {}), [item.sku]: e.target.value },
                                  })
                                }
                                aria-label={`Describe why ${item.sku} is going back`}
                                placeholder={`Why is ${item.sku} going back?`}
                                rows={2}
                                className="w-full min-h-[52px] resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] outline-none transition-colors placeholder:text-[11px] placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                              />
                            </div>
                          )}
                          </div>
                        );
                      })}
                      {/* The document's own line. What the vendor owes back is
                          a figure about the RMA, so it is stated once, under
                          the parts it is made of. */}
                      <div className={`grid ${'grid-cols-[minmax(0,1.6fr)_184px_96px_112px]'} items-center gap-3 border-t border-border bg-slate-50/60 px-3 py-2`}>
                        <span className="text-[11px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
                          {answer.settlement === 'Refund'
                            ? 'Refund total'
                            : answer.settlement === 'Credit'
                              ? 'Credit total'
                              : 'Total'}
                        </span>
                        <span />
                        <span
                          className="text-right text-[13px] text-foreground tabular-nums"
                          style={{ fontWeight: 600 }}
                        >
                          {target.units} {target.uom}
                        </span>
                        <span
                          className={`text-right text-[13px] tabular-nums ${
                            paidTotal > 0.004 ? 'text-primary' : 'text-slate-400'
                          }`}
                          style={{ fontWeight: 700 }}
                        >
                          {formatMoney(paidTotal, target.currency)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Both answers are about the whole document, and they are
                      read after it: the table says what is going back and what
                      comes back for it, and the two controls under the total
                      say why and in what form. Above the table they asked the
                      question before any of the facts it turns on. */}
                  </div>

                  {/* The right column: every question this step asks about
                      the document, each in its own panel. */}
                  <div className="flex min-w-0 flex-col gap-2.5 bg-[#F9FAFC] p-4">
                  {/* How this settles, asked as a decision rather than as a
                      pair of chips in the corner.

                      It sat at the end of a row of small print under the
                      table -- an 11px label over two 9px-high buttons -- and
                      it is the only question this step exists to ask. So it
                      is a panel of its own: what is claimable, then two
                      options that say what each one means and what it is
                      worth, the chosen one carrying the tick. */}
                  <ReviewSection
                    icon={CircleDollarSign}
                    iconClass={
                      canSettle && !answer.settlement
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-blue-50 text-primary'
                    }
                    title={canSettle ? 'Refund or credit' : 'Nothing to claim back'}
                  >
                    {canSettle && showErrors && !answer.settlement && (
                      <p
                        role="alert"
                        className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800"
                        style={{ fontWeight: 500 }}
                      >
                        Choose a refund or a credit before saving this return.
                      </p>
                    )}
                    {canSettle && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                          <span className="text-slate-900" style={{ fontSize: 12, fontWeight: 600 }}>
                            Paid items ({coveredCount})
                          </span>
                          <span
                            className="text-slate-900 tabular-nums"
                            style={{ fontSize: 12, fontWeight: 700 }}
                          >
                            {formatMoney(paidTotal, target.currency)}
                          </span>
                        </div>
                        <p className="m-0 mt-1 text-slate-500" style={{ fontSize: 11 }}>
                          What you can get back
                        </p>
                      </div>
                    )}
                    {!canSettle && (
                      <p className="text-[12px] leading-relaxed text-slate-600">
                        Nothing on this return has been paid for yet, so there is no refund or
                        credit to ask for. It unwinds what was accrued when the goods go back.
                      </p>
                    )}

                    {canSettle && (
                      <>
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
                        ).map(({ choice, icon: Icon, blurb }) => {
                          const on = answer.settlement === choice;
                          return (
                            <button
                              key={choice}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                if (on) {
                                  onAnswer(target.vendorCode, { settlement: null });
                                  return;
                                }
                                // Part-paid returns say what the choice will
                                // not cover before it is made, rather than
                                // leaving a zero in a column to be noticed.
                                if (notInvoiced.length > 0) {
                                  setPartial({
                                    vendorCode: target.vendorCode,
                                    vendorName: target.vendorName,
                                    choice,
                                    items: notInvoiced,
                                    covered: coveredCount,
                                    paidTotal,
                                    currency: target.currency,
                                  });
                                  return;
                                }
                                onAnswer(target.vendorCode, {
                                  settlement: choice,
                                  returnType: 'Refund/Credit',
                                });
                              }}
                              className={`relative flex items-start gap-3 rounded-lg border bg-white p-3 text-left transition-all ${
                                on
                                  ? 'border-primary shadow-[0_2px_12px_-4px_rgba(10,119,255,0.25)]'
                                  : 'border-[#E8ECF1] hover:border-primary/40 hover:shadow-[0_4px_16px_-6px_rgba(10,119,255,0.18)]'
                              }`}
                            >
                              <span
                                className={`flex w-8 h-8 shrink-0 items-center justify-center rounded-lg ${
                                  on ? 'bg-primary text-white' : 'bg-blue-50 text-primary'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                  <span
                                    className="text-[12px] text-foreground"
                                    style={{ fontWeight: 700 }}
                                  >
                                    {choice}
                                  </span>
                                  <span
                                    className={`text-[12px] tabular-nums ${on ? 'text-primary' : 'text-slate-500'}`}
                                    style={{ fontWeight: 700 }}
                                  >
                                    {formatMoney(paidTotal, target.currency)}
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
                      </>
                    )}
                  </ReviewSection>

                  {/* What the vendor keeps back out of the refund.
                      
                      The same control, the same words and the same list of
                      kinds the detail page's own Vendor charges section
                      carries, because it is the same question: a restocking
                      fee, the freight back, an intake fee. It is asked here
                      because it is agreed on the call that authorizes the
                      return, which is the call this step is written during --
                      asking only on the saved record meant typing it twice,
                      once on paper and once a day later. */}
                  <ReviewSection
                    icon={Receipt}
                    iconClass="bg-rose-50 text-rose-600"
                    title="Vendor charges"
                    defaultOpen={false}
                    rightSlot={
                      (charges[target.vendorCode] ?? []).length > 0 ? (
                        <span
                          className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 tabular-nums"
                          style={{ fontWeight: 700 }}
                        >
                          {formatMoney(
                            (charges[target.vendorCode] ?? []).reduce(
                              (n, c) => n + (c.amount || 0),
                              0,
                            ),
                            target.currency,
                          )}
                        </span>
                      ) : undefined
                    }
                  >
                    <p className="m-0 mb-2 text-slate-500" style={{ fontSize: 11, lineHeight: 1.6 }}>
                      What {target.vendorName} keeps back out of your refund: a restocking fee,
                      return freight, an intake or handling fee. Each one comes off before the
                      money reaches you.
                    </p>
                    <AdditionalChargesPanel
                      currency={target.currency}
                      charges={charges[target.vendorCode] ?? []}
                      onChange={(next) => onCharges(target.vendorCode, next)}
                      types={VENDOR_CHARGE_TYPES}
                      totalLabel="Total Charges"
                      formatTotal={(n) => formatMoney(n, target.currency)}
                      addLabel="Add charge"
                      emptyNote="No charges yet. Add what the vendor keeps back."
                      glNote="Taken off what the vendor credits back, and posted against the return's settlement."
                    />
                    {/* The detail page's own pair, to the letter. A charge is
                        agreed at a moment, and the moment is the button: it
                        is where a restocking fee the vendor has never quoted
                        before is put to the one question that turns it into a
                        default. */}
                    {JSON.stringify(charges[target.vendorCode] ?? []) !==
                      JSON.stringify(savedCharges[target.vendorCode] ?? []) && (
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => onDiscardCharges(target.vendorCode)}
                          className="h-8 rounded-lg border border-border bg-white px-3 text-[12px] text-muted-foreground transition-colors hover:bg-slate-50"
                          style={{ fontWeight: 500 }}
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          onClick={() => onSaveCharges(target.vendorCode)}
                          className="h-8 rounded-lg border-0 px-3 text-[12px] text-white shadow-sm transition-opacity hover:opacity-90"
                          style={{ fontWeight: 500, backgroundColor: 'hsl(var(--primary))' }}
                        >
                          Save charges
                        </button>
                      </div>
                    )}
                  </ReviewSection>

                  {/* What the vendor has already said about the return, where
                      they have said it. Both optional: a vendor often gives
                      their number and a date only once they authorize it,
                      and the approval asks for them again then. */}
                  <ReviewSection
                    icon={CalendarClock}
                    iconClass="bg-blue-50 text-blue-600"
                    title="Vendor reference"
                    defaultOpen={false}
                  >
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <label
                          className="text-slate-500"
                          style={{ fontSize: 10, fontWeight: 700 }}
                          htmlFor={`rma-vendor-number-${target.vendorCode}`}
                        >
                          Their RMA number (optional)
                        </label>
                        <input
                          id={`rma-vendor-number-${target.vendorCode}`}
                          value={answer.vendorRMANumber ?? ''}
                          onChange={(e) =>
                            onAnswer(target.vendorCode, { vendorRMANumber: e.target.value })
                          }
                          placeholder="The number on their authorization"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] outline-none transition-colors placeholder:text-[11px] placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <label
                          className="text-slate-500"
                          style={{ fontSize: 10, fontWeight: 700 }}
                          htmlFor={`rma-refund-by-${target.vendorCode}`}
                        >
                          Refund expected by (optional)
                        </label>
                        <DatePicker
                          id={`rma-refund-by-${target.vendorCode}`}
                          value={answer.refundExpectedDate ?? ''}
                          onChange={(next) =>
                            onAnswer(target.vendorCode, { refundExpectedDate: next })
                          }
                          placeholder="Pick a date"
                          className="!h-9"
                        />
                      </div>
                    </div>
                  </ReviewSection>

                  {/* Anything else about this return, and anything that
                      proves it.
                      
                      Both are about the document rather than a line: the
                      authorization email covers the return, not the third
                      part on it. They are written here because this is the
                      last step, where the return is being finished rather
                      than assembled, and they arrive on the RMA's own
                      Attachments tab in the cards the detail page draws. */}
                  <ReviewSection
                    icon={StickyNote}
                    iconClass="bg-purple-50 text-purple-600"
                    title="Notes"
                    defaultOpen={false}
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label
                        className="text-slate-500"
                        style={{ fontSize: 10, fontWeight: 700 }}
                        htmlFor={`rma-note-${target.vendorCode}`}
                      >
                        For the vendor and the warehouse
                      </label>
                      <textarea
                        id={`rma-note-${target.vendorCode}`}
                        value={answer.note}
                        onChange={(e) => onAnswer(target.vendorCode, { note: e.target.value })}
                        aria-label={`Notes for the return to ${target.vendorName}`}
                        placeholder="Anything the vendor or the warehouse needs to know about this return."
                        rows={3}
                        className="w-full min-h-[84px] resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] leading-relaxed outline-none transition-colors placeholder:text-[11px] placeholder:text-slate-400 focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </ReviewSection>

                  <ReviewSection
                    icon={Paperclip}
                    iconClass="bg-emerald-50 text-emerald-600"
                    title="Attachments"
                    defaultOpen={false}
                    rightSlot={
                      (files[target.vendorCode] ?? []).length > 0 ? (
                        <span
                          className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"
                          style={{ fontWeight: 700 }}
                        >
                          {(files[target.vendorCode] ?? []).length}
                        </span>
                      ) : undefined
                    }
                  >
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <p className="m-0 text-slate-500" style={{ fontSize: 10, fontWeight: 700 }}>
                        Photos, the vendor email, the inspection report
                      </p>
                      <CreateLineAttachments
                        lineId={`rma-${target.vendorCode}`}
                        files={files[target.vendorCode] ?? []}
                        onChange={(next) => onFiles(target.vendorCode, next)}
                      />
                    </div>
                  </ReviewSection>

                  {/* What this return was about, in the words the warehouse
                      would use to look for it again. The number is gone from
                      memory in a week; "crushed pallet" is not. */}
                  <ReviewSection
                    icon={Tags}
                    iconClass="bg-amber-50 text-amber-600"
                    title="Tags"
                    defaultOpen={false}
                  >
                    <p className="m-0 mb-1.5 text-slate-500" style={{ fontSize: 10, fontWeight: 700 }}>
                      Words to find this return by
                    </p>
                    <TagField
                      tags={tags[target.vendorCode] ?? []}
                      onChange={(next) => onTags(target.vendorCode, next)}
                      vendorName={target.vendorName}
                    />
                  </ReviewSection>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* What a refund or a credit will not cover.
       *
       *  Four parts go back, two of them were paid for, and the two that were
       *  not come back with nothing attached: they unwind the accrual instead.
       *  That is the whole of the surprise on this step, so it is said at the
       *  moment the choice is made rather than left in a column of zeroes. */}
      {partial && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="px-6 pt-6">
              <span className="mb-4 flex w-11 h-11 items-center justify-center rounded-full bg-amber-50">
                <Info className="w-5 h-5 text-amber-600" />
              </span>
              <h3 className="text-lg text-foreground" style={{ fontWeight: 700 }}>
                {partial.items.length === 1
                  ? "One item hasn't been invoiced yet"
                  : `${partial.items.length} items haven't been invoiced yet`}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {partial.items.length === 1 ? 'It is not' : 'They are not'} available for a{' '}
                {partial.choice.toLowerCase()} yet.{' '}
                {partial.items.length === 1 ? 'It still goes' : 'They still go'} back to{' '}
                {partial.vendorName}, and what was accrued for{' '}
                {partial.items.length === 1 ? 'it' : 'them'} unwinds when{' '}
                {partial.items.length === 1 ? 'it does' : 'they do'}.
              </p>
              <div className="mt-3 flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-[#E2E8F0]">
                {partial.items.map((item) => (
                  <div key={item.sku} className="flex items-center gap-2.5 bg-[#FAFBFC] px-3 py-2">
                    <span className="w-7 h-7 shrink-0 overflow-hidden rounded border border-[#E8ECF1]">
                      <ImageWithFallback
                        src={imageForSku(item.sku)}
                        alt={item.sku}
                        className="w-full h-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate font-mono text-[12px] text-slate-900"
                        style={{ fontWeight: 700 }}
                      >
                        {item.sku}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {item.qty} {item.uom} going back
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400" style={{ fontWeight: 600 }}>
                      Not billed yet
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-slate-500">
                {partial.paidTotal > 0.004
                  ? `The ${partial.choice.toLowerCase()} covers the ${partial.covered} ${
                      partial.covered === 1 ? 'item that was' : 'items that were'
                    } paid for, ${formatMoney(partial.paidTotal, partial.currency)} in all.`
                  : `The ${partial.choice.toLowerCase()} covers the ${partial.covered} ${
                      partial.covered === 1 ? 'item' : 'items'
                    } with no invoice on file to check against.`}
              </p>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setPartial(null)}
                className="inline-flex h-9 items-center rounded-lg border border-[#E2E8F0] bg-white px-3.5 text-[12px] text-foreground transition-colors hover:bg-slate-50"
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onAnswer(partial.vendorCode, {
                    settlement: partial.choice,
                    returnType: 'Refund/Credit',
                  });
                  setPartial(null);
                }}
                className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-[12px] text-white transition-colors hover:bg-blue-700"
                style={{ fontWeight: 600 }}
              >
                Continue with {partial.choice.toLowerCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The return's Currency Configuration, before it exists. */}
      {(() => {
        const t = currencyFor ? targets.find((x) => x.vendorCode === currencyFor) : null;
        if (!t?.currency) return null;
        const its = t.items ?? [];
        return (
          <CreateReturnCurrencyDialog
            open
            onOpenChange={(o) => {
              if (!o) setCurrencyFor(null);
            }}
            currency={t.currency}
            po={t.currencyPO}
            value={Math.round(its.reduce((n, i) => n + (i.value ?? 0), 0) * 100) / 100}
            paid={Math.round(its.reduce((n, i) => n + (i.paidValue ?? 0), 0) * 100) / 100 || (t.paidValue ?? 0)}
            charges={Math.round((charges[t.vendorCode] ?? []).reduce((n, c) => n + (c.amount || 0), 0) * 100) / 100}
          />
        );
      })()}

      {/* The part, in the quick view the detail page opens. */}
      {preview && (
        <ItemQuickViewModal
          open
          onClose={() => setPreview(null)}
          sku={preview.sku}
          description={preview.description}
          uom={preview.uom}
          serialized={preview.trackingMode === 'serialized'}
          trackingLabel={TRACKING_LABELS[preview.trackingMode]}
        />
      )}
    </div>
  );
}
