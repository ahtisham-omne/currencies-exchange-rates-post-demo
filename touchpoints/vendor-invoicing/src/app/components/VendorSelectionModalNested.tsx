import { toast } from 'sonner';
import { TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Maximize2, Minimize2, ShoppingCart, Package, Building2, AlertTriangle, Filter, Calendar, User, Tag, RotateCcw, CheckCircle2, Info, Receipt, Layers, Star, ZoomIn, ExternalLink, ArrowUpDown, DollarSign, Hash, Check, Wallet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/app/components/ui/hover-card";
import { mockVendors, Vendor, VendorPO, VendorGRN, LineItem } from '@/app/data/mockVendors';
import { highlightText as sharedHighlightText } from '@/app/components/InvoiceDataTable';
import { resolvePaymentTerm } from '@/app/data/paymentTermPresets';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/app/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import { Calendar as CalendarPicker } from '@/app/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { CollapseReveal } from '@/app/components/ui/collapse-reveal';
import { MoneyOnDates } from '@/app/components/currency/MoneyOnDates';
import { CurrencyPill } from '@/app/components/currency/CurrencyChip';
import { formatMoney } from '@/app/currency/money';

// Material UI Imports
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

interface VendorSelectionModalProps {
  isOpen: boolean;
  /** Dismiss the modal entirely — Cancel / X / backdrop. In the creation
   *  flow this closes the whole flow back to the invoice listing; in the
   *  "Add more" flow it closes the add-more modal. */
  onClose: () => void;
  onContinue: (selectedData: SelectedPOData[]) => void;
  /** Optional: when supplied, "Discard changes" on a close uses this
   *  instead of onClose. */
  onDiscard?: () => void;
  /** Optional: go back to the previous step (the invoice-type picker).
   *  When provided, a back button is shown in the header; without it the
   *  modal has no previous step (e.g. the Add-more usage) and the button
   *  is hidden. */
  onBack?: () => void;
  fixedVendorId?: string; // New: lock to a specific vendor
  /** PO numbers already on the host invoice — hidden from the Purchase
   *  Orders tab so the user can't re-add the same PO via "Add more". */
  alreadySelectedPONumbers?: string[];
  /** GRN numbers already on the host invoice — hidden from the
   *  Receivers tab so the user can't re-add the same receiver. */
  alreadySelectedGRNNumbers?: string[];
  /** Composite keys `${grnNumber}:${itemId}` for items already on the
   *  host invoice. When passed, the modal pre-checks those items on
   *  open + marks them as locked so the user picks only-net-new ones
   *  (and the host's merge logic increments the count correctly). */
  alreadySelectedGRNItemIds?: string[];
  /** Which creation flow opened the picker (9/4/26 Eli review, D-01).
   *  Supersedes the old restrictMixedReceivingStatus mixed-kind lock —
   *  pre and post can no longer meet in one selection because each flow
   *  only ever offers one side (D-01b holds structurally).
   *  'pre'  — the Pre-Invoice flow: all non-draft POs listed, only the
   *           unreceived portion of each line is selectable, no GRN tab.
   *  'post' — the Inventory Invoice flow: the listing stays as-is, but
   *           unreceived lines are visible and permanently greyed out.
   *  Absent — legacy behavior (Add-more usage until migrated). */
  flowKind?: 'pre' | 'post';
  /** Reconciliation flags (Eli, 8/31/26): POs whose pre-invoices carry
   *  paid prepayments — the card wears a violet Prepaid chip so the
   *  user knows creating an invoice here consumes the prepayment. */
  prepaidPOContext?: Record<string, { preInvoiceNumber: string; amount: number }>;
}

export interface SelectedPOData {
  vendorCode: string;
  vendorName: string;
  vendorCategory: string;
  /** The PO's currency (else the vendor's): the invoice defaults to it. */
  currency: string;
  /** The PO's rate on its PO date, which the invoice's rate is compared against. */
  poExchangeRate?: number;
  paymentTerms: string;
  poNumber: string;
  poDate: string;
  poAmount: number;
  poStatus: string;
  itemCount: number;
  isPreInvoice: boolean;
  relatedGRNs: VendorGRN[];
  items: LineItem[];
  selectedItemIds: string[]; // New: track which specific items were selected
  selectedGRNItemIds?: string[]; // New: track which specific GRN items were selected (grnNumber:itemId)
}

type FilterType = 'all' | 'vendor' | 'po' | 'grn' | 'item';

// External partner-creation deep link — opens the Partner Management module in
// a new tab. Used by the "Create new partner" CTA in the empty state.
// `?from=vendor-invoicing` flags the upstream Partner Management form to
// render the Vendor-Invoicing context banner so the user remembers which
// flow they were dispatched from.
const PARTNER_CREATE_URL = 'https://partner-management-module.lovable.app/vendors?from=vendor-invoicing';

/* ── Line eligibility per creation flow (9/4/26 Eli review, D-01a) ──
 * Pre vs post is a LINE ITEM property, not a PO property: a partially
 * received PO appears in BOTH creation flows and each flow exposes only
 * its own side of every line.
 *   Pre flow:  a line is eligible for the qty NOT yet received — its
 *              unreceived remainder, net of qty already pre-invoiced.
 *   Post flow: a line is eligible only when something HAS been received.
 *
 * ── BL-01 SEAM (Eli, 56:08) ────────────────────────────────────────
 * The post-flow ineligibility — the grey-out of unreceived lines in the
 * Inventory Invoice flow — is a deliberately REMOVABLE layer. When the
 * draft/awaiting-receiving invoice state ships (backlog level 7), delete
 * the 'post' branch (make it return true) and the greyed rows become
 * selectable again; the draft-invoice flow bolts on after. Nothing else
 * may key off this predicate. */
export const preEligibleQty = (item: LineItem) =>
  Math.max(0, item.quantity - Math.max(item.receivedQty ?? 0, item.invoicedQty ?? 0));
export const lineEligible = (item: LineItem, flowKind?: 'pre' | 'post') =>
  flowKind === 'pre'
    ? preEligibleQty(item) > 0
    : flowKind === 'post'
      ? (item.receivedQty ?? 0) > 0
      : true;
/* Grey-out copy for the Inventory flow (BB-03; BA copy 9/6) — the hover
 * copy is the ENTIRE affordance; there is deliberately no
 * jump-to-pre-invoice button (BB-05). */
const UNRECEIVED_LINE_LOCK = {
  title: 'No receivings yet',
  body: "This line has no receivings, so it can't be invoiced yet. To invoice it before goods arrive, use the Pre-Invoice flow.",
};
/* Partially received PO in the Inventory flow (BA 9/6): the card stays
 * selectable — this info tip just explains why only some lines tick. */
const PARTIAL_PO_INFO = {
  title: 'Partially Received',
  body: 'This PO is only partially received. In the invoice flow, you can invoice only the quantities that have been received.',
};

// Parse a PO number to its integer value (e.g. "1019" → 1019). With the
// post-BA-feedback pure-integer numbering this is just `parseInt`, but
// we keep the trailing-digit fallback so any legacy `PO-2024-…` strings
// in mock data still range-filter correctly.
const extractPONumeric = (po: string): number => {
  const direct = parseInt(po, 10);
  if (!Number.isNaN(direct)) return direct;
  const match = po.match(/(\d+)(?!.*\d)/);
  return match ? parseInt(match[1], 10) : NaN;
};

// Lightweight Levenshtein distance — sufficient for short partner / PO /
// receiver / item number strings. We cap the input length defensively but typical
// queries are <40 chars so the O(m*n) cost is negligible.
const editDistance = (a: string, b: string): number => {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
};

// Best fuzzy candidate within an edit-distance threshold proportional to query
// length. Returns null when nothing crosses the bar — avoids suggesting wildly
// unrelated names. We also short-circuit when the candidate already contains
// the query as a substring (those would be exact matches, not "did you mean").
const findFuzzyMatch = (query: string, candidates: string[]): string | null => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  // Allow ~1 typo per 4 characters, capped at 3.
  const threshold = Math.min(3, Math.max(1, Math.floor(q.length / 4) + 1));
  let best: { candidate: string; distance: number } | null = null;
  for (const candidate of candidates) {
    const c = candidate.toLowerCase();
    if (c.includes(q)) return null; // already an exact substring match
    // Compare against the full candidate and also each whitespace-delimited
    // token so "ecme" matches "Acme Corp" via the "Acme" token.
    const tokens = [c, ...c.split(/\s+/)];
    let minDist = Infinity;
    for (const token of tokens) {
      const d = editDistance(q, token);
      if (d < minDist) minDist = d;
    }
    if (minDist <= threshold && (!best || minDist < best.distance)) {
      best = { candidate, distance: minDist };
    }
  }
  return best ? best.candidate : null;
};

export function VendorSelectionModalNested(props: VendorSelectionModalProps) {
  const {
    isOpen,
    onClose,
    onContinue,
    onDiscard,
    onBack,
    fixedVendorId,
    alreadySelectedPONumbers,
    alreadySelectedGRNNumbers,
    alreadySelectedGRNItemIds,
    prepaidPOContext,
    flowKind,
  } = props;
  // Sticky-toolbar height — measured live so the expanded vendor's
  // header row (with its Selected counts) can stick directly beneath
  // the toolbar while scrolling (BA UX feedback).
  const stickyToolbarRef = useRef<HTMLDivElement>(null);
  const [stickyToolbarHeight, setStickyToolbarHeight] = useState(0);
  useEffect(() => {
    const el = stickyToolbarRef.current;
    if (!el) return;
    const update = () => setStickyToolbarHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  // Memoized Sets for the exclusion props so callers don't have to.
  const excludedPOs = useMemo(
    () => new Set(alreadySelectedPONumbers ?? []),
    [alreadySelectedPONumbers],
  );
  const excludedGRNs = useMemo(
    () => new Set(alreadySelectedGRNNumbers ?? []),
    [alreadySelectedGRNNumbers],
  );
  const preselectedGRNItems = useMemo(
    () => new Set(alreadySelectedGRNItemIds ?? []),
    [alreadySelectedGRNItemIds],
  );
  // PO line items already on the host invoice. Composite GRN keys look
  // like `${grnNumber}:${itemId}` -- we strip the GRN prefix so the PO
  // tab (which keys off raw item.id) can flag them. Used by the PO
  // item checkbox to render as indeterminate ("partially on invoice")
  // so the user can still re-select the row and pick up its full
  // quantity for the current draft.
  const excludedPOItemIds = useMemo(() => {
    const s = new Set<string>();
    (alreadySelectedGRNItemIds ?? []).forEach((key) => {
      const colon = key.indexOf(':');
      if (colon >= 0) s.add(key.slice(colon + 1));
    });
    return s;
  }, [alreadySelectedGRNItemIds]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [grnSearch, setGrnSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  
  // Set initial expanded vendor if fixedVendorId is provided
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set(fixedVendorId ? [fixedVendorId] : []));
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [expandedGRNs, setExpandedGRNs] = useState<Set<string>>(new Set());
  const [selectedPOs, setSelectedPOs] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedGRNs, setSelectedGRNs] = useState<Set<string>>(new Set());
  const [selectedGRNItems, setSelectedGRNItems] = useState<Set<string>>(
    () => new Set(alreadySelectedGRNItemIds ?? []),
  );
  // When the modal (re)opens in add-more mode, re-seed selectedGRNItems
  // with whatever the host says is already on the invoice so the user
  // sees that state instead of a blank slate.
  useEffect(() => {
    if (isOpen) {
      setSelectedGRNItems(new Set(alreadySelectedGRNItemIds ?? []));
    }
  }, [isOpen, alreadySelectedGRNItemIds]);
  const [collapsedPOItemTables, setCollapsedPOItemTables] = useState<Set<string>>(new Set());
  const [showAlert, setShowAlert] = useState<{ show: boolean, msg: string, type: 'info' | 'warning' }>({ show: false, msg: '', type: 'info' });
  // Discard confirmation — shown when user clicks Cancel while there are
  // unsaved selections. Skips when nothing is selected so the close path
  // stays a single click.
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  // Term-kind confirm on Continue (user 9/22): NET terms on a pre-invoice
  // (or prepayment terms on received goods) raise a deliberate confirm
  // before the form opens with a different term.
  const [showTermKindConfirm, setShowTermKindConfirm] = useState(false);

  // Whether the discard confirmation, once confirmed, should close the
  // modal entirely or step back to the previous screen. Cancel / X /
  // backdrop close; the header back button steps back.
  const discardActionRef = useRef<'close' | 'back'>('close');

  const hasSelection = () =>
    selectedItemIds.size > 0 ||
    selectedPOs.size > 0 ||
    selectedGRNs.size > 0 ||
    selectedGRNItems.size > 0;

  // Cancel / X / click-away dismiss the whole modal. The discard
  // confirmation only fires when there's a fresh selection to lose;
  // otherwise we close straight through.
  const handleCancelClick = () => {
    if (!hasSelection()) {
      onClose();
      return;
    }
    discardActionRef.current = 'close';
    setShowDiscardConfirm(true);
  };

  // Header back button — returns to the invoice-type picker. Same
  // discard guard, but on confirm it steps back instead of closing.
  const handleBackClick = () => {
    if (!onBack) return;
    if (!hasSelection()) {
      onBack();
      return;
    }
    discardActionRef.current = 'back';
    setShowDiscardConfirm(true);
  };

  // Multi-vendor validation - Simplified and robust
  const selectedVendorCount = useMemo(() => {
    const activeVendors = new Set<string>();
    
    // We derive vendor codes directly from selected item IDs
    // ID format: item-V-01000-0-0
    selectedItemIds.forEach(id => {
      const parts = id.split('-');
      if (parts.length >= 3) {
        activeVendors.add(`${parts[1]}-${parts[2]}`);
      }
    });

    // Also check GRN items (which follow same ID format after the colon)
    selectedGRNItems.forEach(key => {
      const parts = key.split(':');
      if (parts.length >= 2) {
        const idParts = parts[1].split('-');
        if (idParts.length >= 3) {
          activeVendors.add(`${idParts[1]}-${idParts[2]}`);
        }
      }
    });

    return activeVendors.size;
  }, [selectedItemIds, selectedGRNItems]);

  // Sync Alert with selection state
  useEffect(() => {
    // Reset alert by default
    if (selectedVendorCount > 1) {
      setShowAlert({ 
        show: true, 
        type: 'warning', 
        msg: "Multiple vendors selected. You can only create an invoice against a single vendor at a time. Please deselect items from other vendors to continue." 
      });
    } else if (selectedGRNItems.size >= 2) {
      const selectedGRNNums = new Set<string>();
      const selectedPONums = new Set<string>();

      selectedGRNItems.forEach(key => {
        const [grnNumber] = key.split(':');
        selectedGRNNums.add(grnNumber);
        
        // Find the PO associated with this GRN
        for (const vendor of mockVendors) {
          const grn = vendor.receivingDocuments.find(g => g.grnNumber === grnNumber);
          if (grn) {
            selectedPONums.add(grn.poNumber);
            break;
          }
        }
      });

      if (selectedGRNNums.size >= 2 && selectedPONums.size >= 2) {
        setShowAlert({ 
          show: true, 
          type: 'info', 
          msg: "Selected items will be grouped by their respective Purchase Orders in the next step." 
        });
      } else {
        setShowAlert(prev => prev.type === 'warning' ? { ...prev, show: false } : prev);
      }
    } else {
      setShowAlert(prev => ({ ...prev, show: false }));
    }
  }, [selectedVendorCount, selectedGRNItems]);

  // New Filters
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<string>('all');
  const [selectedPOStatus, setSelectedPOStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showClosedPOs, setShowClosedPOs] = useState(false);

  // Advanced Search Modes
  const [vendorFilterMode, setVendorFilterMode] = useState<'include' | 'exclude'>('include');
  const [vendorActiveOnly, setVendorActiveOnly] = useState(false);
  const [poFilterMode, setPoFilterMode] = useState<'include' | 'exclude'>('include');
  const [grnFilterMode, setGrnFilterMode] = useState<'include' | 'exclude'>('include');
  const [itemFilterMode, setItemFilterMode] = useState<'include' | 'exclude'>('include');
  // "Show only matched line items" (default ON, Isha's shipment pattern,
  // design review 7/9/26): ON = item search hard-filters rows, OFF = all
  // rows render with matches highlighted. Selected rows are exempt from
  // the filter either way, so a selection can never be hidden.
  const [showOnlyMatched, setShowOnlyMatched] = useState(true);
  // Default OFF (8/13/26, reverses the 7/20/26 default-ON): open POs
  // must show in the default list, they're the pre-invoice entry point.
  // The toggle stays for narrowing to received goods.
  // Received-only toggle removed (user 10/5).
  
  // Date Range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // PO number range — supports sequence searches like "PO 1001–1010".
  // Strings (not numbers) so an empty field stays distinguishable from 0,
  // and so the user can paste a partial / leading-zeroed number.
  const [poRangeStart, setPoRangeStart] = useState('');
  const [poRangeEnd, setPoRangeEnd] = useState('');
  // Ref on the "From" field so we can autofocus it when the popover
  // opens (PopoverContent's default autofocus is suppressed to keep the
  // info-icon tooltip from flashing on open).
  const poRangeFromRef = useRef<HTMLInputElement | null>(null);

  // Result-list sorting — applied to each vendor's POs and Receivers so
  // users can prioritize "oldest receivers" or "highest-value POs" once
  // the search has narrowed the list. Default is newest-first (date desc).
  // `remaining` ranks POs by the un-invoiced value (poAmount − invoiced),
  // which is the most actionable "what should I invoice next" lens.
  const [sortKey, setSortKey] = useState<'date' | 'value' | 'poNumber' | 'remaining'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Popover states
  const [activePopover, setActivePopover] = useState<string | null>(null);

  // Item QuickView state — partner-style rich modal opened on item-image click.
  // src/alt kept for backwards compat with internal callers; sku/vendorName
  // power the rich detail panel.
  const [previewImage, setPreviewImage] = useState<{ src: string, alt: string, sku?: string, vendorName?: string } | null>(null);
  const [previewPhotoIdx, setPreviewPhotoIdx] = useState(0);
  useEffect(() => { setPreviewPhotoIdx(0); }, [previewImage?.sku]);

  const toggleVendor = (vendorId: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };

  const togglePO = (poKey: string) => {
    const newExpanded = new Set(expandedPOs);
    if (newExpanded.has(poKey)) {
      newExpanded.delete(poKey);
    } else {
      newExpanded.add(poKey);
    }
    setExpandedPOs(newExpanded);
  };

  const toggleGRN = (grnKey: string) => {
    const newExpanded = new Set(expandedGRNs);
    if (newExpanded.has(grnKey)) {
      newExpanded.delete(grnKey);
    } else {
      newExpanded.add(grnKey);
    }
    setExpandedGRNs(newExpanded);
  };

  const togglePOSelection = (poKey: string, vendor: Vendor, po: VendorPO) => {
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedGRNs = new Set(selectedGRNs);
    const newSelectedGRNItems = new Set(selectedGRNItems);

    // Fully selected = every ELIGIBLE PO line item AND every GRN line item
    // under this PO selected. Ineligible lines (the flow's other side —
    // 9/4/26 split) never count, or a partial PO could never toggle off.
    // Any partial (indeterminate) state escalates to "select everything
    // eligible" on click.
    const relatedGRNs = vendor.receivingDocuments.filter(g => g.poNumber === po.poNumber);
    const eligibleItems = po.items.filter(item => lineEligible(item, flowKind));
    const allItemsSelected = eligibleItems.length > 0 && eligibleItems.every(item => newSelectedItemIds.has(item.id));
    const allGRNItemsSelected = flowKind === 'pre' || relatedGRNs.every(grn =>
      grn.items.every(item => newSelectedGRNItems.has(`${grn.grnNumber}:${item.id}`))
    );
    const isCurrentlyFullySelected = allItemsSelected && allGRNItemsSelected;

    if (isCurrentlyFullySelected) {
      // Unselect everything in this PO
      newSelectedPOs.delete(poKey);
      po.items.forEach(item => newSelectedItemIds.delete(item.id));
      vendor.receivingDocuments.filter(g => g.poNumber === po.poNumber).forEach(grn => {
        newSelectedGRNs.delete(grn.grnNumber);
        grn.items.forEach(item => {
          newSelectedGRNItems.delete(`${grn.grnNumber}:${item.id}`);
        });
      });
    } else {
      // Select everything eligible in this PO
      newSelectedPOs.add(poKey);
      eligibleItems.forEach(item => newSelectedItemIds.add(item.id));
      // Pre-invoices carry no receivings — GRN selection never mirrors.
      if (flowKind !== 'pre') {
        vendor.receivingDocuments.filter(g => g.poNumber === po.poNumber).forEach(grn => {
          newSelectedGRNs.add(grn.grnNumber);
          grn.items.forEach(item => {
            newSelectedGRNItems.add(`${grn.grnNumber}:${item.id}`);
          });
        });
      }
      // The vendor stays open so the selection reads at a glance, but the
      // CARD no longer auto-expands on checkbox tick (9/3/26 review —
      // supersedes the 7/9 expose-all: ticking a header checkbox popping
      // the item table open read as a glitch). Selected item rows still
      // never hide behind filters once the user expands by hand.
      setExpandedVendors(prev => new Set(prev).add(vendor.id));
    }

    setSelectedPOs(newSelectedPOs);
    setSelectedItemIds(newSelectedItemIds);
    setSelectedGRNs(newSelectedGRNs);
    setSelectedGRNItems(newSelectedGRNItems);
  };

  const toggleGRNSelection = (grnNumber: string, poKey: string, po: VendorPO, grn: VendorGRN) => {
    const newSelectedGRNs = new Set(selectedGRNs);
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedGRNItems = new Set(selectedGRNItems);

    // Tri-state click semantics: only collapse when EVERY item is selected;
    // an indeterminate state escalates to "select all" instead of toggling off.
    const isFullySelected = grn.items.length > 0 &&
      grn.items.every(item => newSelectedGRNItems.has(`${grn.grnNumber}:${item.id}`));

    if (isFullySelected) {
      newSelectedGRNs.delete(grnNumber);
      // Deselect all items in this GRN
      grn.items.forEach(item => {
        const itemKey = `${grn.grnNumber}:${item.id}`;
        newSelectedGRNItems.delete(itemKey);

        // Only deselect from PO items if no OTHER selected GRN contains this
        // item number. The `gNum !== grnNumber` guard is critical — without it, the
        // GRN's own as-yet-unprocessed sibling items would still be in
        // newSelectedGRNItems and the check would falsely report the item number
        // as "still selected", leaving the PO item stuck in selectedItemIds.
        const poItem = po.items.find(i => i.sku === item.sku);
        if (poItem) {
          const isItemInOtherSelectedGRN = Array.from(newSelectedGRNItems).some(k => {
            const [gNum] = k.split(':');
            if (gNum === grnNumber) return false;
            const otherGrn = mockVendors.flatMap(v => v.receivingDocuments).find(g => g.grnNumber === gNum);
            return otherGrn?.poNumber === po.poNumber && otherGrn.items.some(i => i.sku === item.sku);
          });
          if (!isItemInOtherSelectedGRN) newSelectedItemIds.delete(poItem.id);
        }
      });

      // Update PO selection state based on items
      const anyItemInPOSelected = po.items.some(i => newSelectedItemIds.has(i.id));
      if (!anyItemInPOSelected) {
        newSelectedPOs.delete(poKey);
      }
    } else {
      newSelectedGRNs.add(grnNumber);
      // Select all items in this GRN
      grn.items.forEach(item => {
        newSelectedGRNItems.add(`${grn.grnNumber}:${item.id}`);
        const poItem = po.items.find(i => i.sku === item.sku);
        if (poItem) newSelectedItemIds.add(poItem.id);
      });
      newSelectedPOs.add(poKey);
      // No auto-expand on checkbox tick (9/3/26 review — supersedes the
      // 7/9 expose-all): ticking the receiver's checkbox popping its
      // item table open read as a glitch. Expanding stays a deliberate
      // chevron/row click.
    }

    setSelectedGRNs(newSelectedGRNs);
    setSelectedGRNItems(newSelectedGRNItems);
    setSelectedItemIds(newSelectedItemIds);
    setSelectedPOs(newSelectedPOs);
  };

  const toggleGRNItemSelection = (item: LineItem, grn: VendorGRN, po: VendorPO, poKey: string) => {
    const newSelectedGRNItems = new Set(selectedGRNItems);
    const newSelectedGRNs = new Set(selectedGRNs);
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedPOs = new Set(selectedPOs);
    
    const key = `${grn.grnNumber}:${item.id}`;
    
    if (newSelectedGRNItems.has(key)) {
      newSelectedGRNItems.delete(key);
      // If all items in GRN are deselected, deselect the GRN
      const anyOtherItemInGRNSelected = grn.items.some(i => newSelectedGRNItems.has(`${grn.grnNumber}:${i.id}`));
      if (!anyOtherItemInGRNSelected) {
        newSelectedGRNs.delete(grn.grnNumber);
      }
      
      // Check if this item item number exists in OTHER selected GRN items before
      // deselecting from PO level. Excluding the current GRN avoids a
      // false-positive from this GRN's own remaining selected siblings.
      const poItem = po.items.find(i => i.sku === item.sku);
      if (poItem) {
        const isItemInOtherSelectedGRN = Array.from(newSelectedGRNItems).some(k => {
          const [gNum] = k.split(':');
          if (gNum === grn.grnNumber) return false;
          const otherGrn = mockVendors.flatMap(v => v.receivingDocuments).find(g => g.grnNumber === gNum);
          return otherGrn?.poNumber === po.poNumber && otherGrn.items.some(i => i.sku === item.sku);
        });
        if (!isItemInOtherSelectedGRN) newSelectedItemIds.delete(poItem.id);
      }
    } else {
      newSelectedGRNItems.add(key);
      newSelectedGRNs.add(grn.grnNumber);
      newSelectedPOs.add(poKey);
      
      const poItem = po.items.find(i => i.sku === item.sku);
      if (poItem) newSelectedItemIds.add(poItem.id);
    }
    
    // Update PO selection state
    const anyItemInPOSelected = po.items.some(i => newSelectedItemIds.has(i.id));
    if (anyItemInPOSelected) {
      newSelectedPOs.add(poKey);
    } else {
      newSelectedPOs.delete(poKey);
    }
    
    setSelectedGRNItems(newSelectedGRNItems);
    setSelectedGRNs(newSelectedGRNs);
    setSelectedItemIds(newSelectedItemIds);
    setSelectedPOs(newSelectedPOs);
  };

  const toggleItemTableCollapse = (poKey: string) => {
    const newCollapsed = new Set(collapsedPOItemTables);
    if (newCollapsed.has(poKey)) {
      newCollapsed.delete(poKey);
    } else {
      newCollapsed.add(poKey);
    }
    setCollapsedPOItemTables(newCollapsed);
  };

  const toggleItemSelection = (item: LineItem, poKey: string, po: VendorPO, vendor: Vendor) => {
    // Flow-ineligible lines never enter the selection (9/4/26 split) —
    // the row's checkbox is disabled, this is the defensive backstop.
    if (!lineEligible(item, flowKind)) return;
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedGRNItems = new Set(selectedGRNItems);
    const newSelectedGRNs = new Set(selectedGRNs);

    const isSelecting = !newSelectedItemIds.has(item.id);

    if (isSelecting) {
      newSelectedItemIds.add(item.id);
      // Select related GRN items — never in the pre flow (a pre-invoice
      // carries no receivings).
      if (flowKind !== 'pre') vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber).forEach(grn => {
        const grnItem = grn.items.find(i => i.sku === item.sku);
        if (grnItem) {
          // Rule: Vendor invoices must always match the vendor's actual invoice amount.
          // When partial receipts exist, we select the GRN item, but the system
          // logic in CreateInvoiceScreen/Final step will handle the split.
          newSelectedGRNItems.add(`${grn.grnNumber}:${grnItem.id}`);
          newSelectedGRNs.add(grn.grnNumber);
        }
      });
    } else {
      newSelectedItemIds.delete(item.id);
      // Deselect related GRN items
      vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber).forEach(grn => {
        const grnItem = grn.items.find(i => i.sku === item.sku);
        if (grnItem) {
          newSelectedGRNItems.delete(`${grn.grnNumber}:${grnItem.id}`);
          // Check if GRN still has selected items
          const hasOtherItems = grn.items.some(i => newSelectedGRNItems.has(`${grn.grnNumber}:${i.id}`));
          if (!hasOtherItems) newSelectedGRNs.delete(grn.grnNumber);
        }
      });
    }
    
    // Update PO selection state based on items
    const anyItemInPOSelected = po.items.some(i => newSelectedItemIds.has(i.id));
    if (anyItemInPOSelected) {
      newSelectedPOs.add(poKey);
    } else {
      newSelectedPOs.delete(poKey);
    }
    
    setSelectedItemIds(newSelectedItemIds);
    setSelectedPOs(newSelectedPOs);
    setSelectedGRNItems(newSelectedGRNItems);
    setSelectedGRNs(newSelectedGRNs);
  };

  const selectAllVendorPOs = (vendor: Vendor, select: boolean) => {
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedGRNs = new Set(selectedGRNs);
    const newSelectedGRNItems = new Set(selectedGRNItems);
    
    // Expose-all: a vendor-level select-all opens the vendor and every PO
    // it just selected — a selection can never hide behind a collapsed
    // section or an active search filter (design review 7/9/26).
    const exposePOKeys = new Set<string>();

    vendor.purchaseOrders.forEach(po => {
      const poKey = `${vendor.vendorCode}-${po.poNumber}`;
      const relatedGRNs = vendor.receivingDocuments.filter(g => g.poNumber === po.poNumber);
      // Mass-select respects the flow split (9/4/26, BB-04): Draft POs
      // never select, and only the flow's eligible lines join.
      const eligibleItems = po.items.filter(item => lineEligible(item, flowKind));
      const poSelectable = po.status !== 'Draft' && eligibleItems.length > 0;
      if (select && !poSelectable) return;
      if (select) {
        newSelectedPOs.add(poKey);
        exposePOKeys.add(poKey);
        eligibleItems.forEach(item => newSelectedItemIds.add(item.id));
        if (flowKind !== 'pre') relatedGRNs.forEach(grn => {
          newSelectedGRNs.add(grn.grnNumber);
          grn.items.forEach(item => newSelectedGRNItems.add(`${grn.grnNumber}:${item.id}`));
        });
      } else {
        newSelectedPOs.delete(poKey);
        po.items.forEach(item => newSelectedItemIds.delete(item.id));
        // Also deselect all associated GRNs and their items
        relatedGRNs.forEach(grn => {
          newSelectedGRNs.delete(grn.grnNumber);
          grn.items.forEach(item => newSelectedGRNItems.delete(`${grn.grnNumber}:${item.id}`));
        });
      }
    });

    if (select && exposePOKeys.size > 0) {
      setExpandedVendors(prev => new Set(prev).add(vendor.id));
      setExpandedPOs(prev => {
        const next = new Set(prev);
        exposePOKeys.forEach(k => next.add(k));
        return next;
      });
    }

    setSelectedPOs(newSelectedPOs);
    setSelectedItemIds(newSelectedItemIds);
    setSelectedGRNs(newSelectedGRNs);
    setSelectedGRNItems(newSelectedGRNItems);
  };

  // Sync Alert with selection state
  // Calculate statistics for each vendor
  const vendorStats = useMemo(() => {
    return mockVendors.map(v => {
      const totalPOAmount = v.purchaseOrders.reduce((sum, po) => sum + po.poAmount, 0);
      const totalInvoicedAmount = v.purchaseOrders.reduce((sum, po) => sum + (po.invoicedAmount || 0), 0);
      const totalOpenAmount = totalPOAmount - totalInvoicedAmount;
      const poCount = v.purchaseOrders.length;
      const grnCount = v.receivingDocuments.length;
      
      return {
        id: v.id,
        totalPOAmount,
        totalInvoicedAmount,
        totalOpenAmount,
        poCount,
        grnCount
      };
    });
  }, []);

  // One search-hit look system-wide (10/9/26): the shared yellow mark
  // from the invoice listing, not the old local amber chip.
  const highlightText = (text: string, query: string) => sharedHighlightText(text, query);

  const clearAllFilters = () => {
    setVendorSearch('');
    setPoSearch('');
    setGrnSearch('');
    setItemSearch('');
    setSelectedCreatedBy('all');
    setSelectedPOStatus('all');
    setSelectedType('all');
    setSelectedDate('');
    setShowClosedPOs(false);
    setVendorFilterMode('include');
    setVendorActiveOnly(false);
    setPoFilterMode('include');
    setGrnFilterMode('include');
    setItemFilterMode('include');
    
    setStartDate('');
    setEndDate('');
    setPoRangeStart('');
    setPoRangeEnd('');
  };

  const filteredVendors = useMemo(() => {
    let vendors = fixedVendorId 
      ? mockVendors.filter(v => v.id === fixedVendorId)
      : mockVendors;

    // Filter by vendor search if not fixed
    if (!fixedVendorId && vendorSearch.trim()) {
      vendors = vendors.filter(v => {
        const matchesSearch = v.vendorName.toLowerCase().includes(vendorSearch.toLowerCase()) || 
                             v.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase());
        return vendorFilterMode === 'include' ? matchesSearch : !matchesSearch;
      });
    }

    if (selectedCreatedBy !== 'all') {
      vendors = vendors.filter(v => v.createdBy === selectedCreatedBy);
    }

    if (selectedPOStatus !== 'all') {
      vendors = vendors.filter(v => v.purchaseOrders.some(po => po.status === selectedPOStatus));
    }

    if (selectedType !== 'all') {
      vendors = vendors.filter(v => v.type === selectedType);
    }

    if (selectedDate) {
      vendors = vendors.filter(v => v.createdOn === selectedDate);
    }

    // Parallel Search Logic across Vendors, POs, GRNs, and Items
    return vendors.map(v => {
      // 1. Filter POs by poSearch AND itemSearch AND showClosedPOs AND dateRange
      // Note: POs already on the host invoice are NOT filtered out --
      // they render in the list with a disabled "Already on invoice"
      // treatment so the user can see them but can't re-pick them.
      const filteredPOs = v.purchaseOrders.filter(po => {
        // ERP Logic: By default hide Closed/Cancelled/Fully-Settled. If toggled, show everything.
        const isPOFullyInvoiced = (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0;
        const isPOFullyReceived = po.status === 'Fully Received' || po.status === 'Fully Invoiced' || po.items.every(item => (item.receivedQty || 0) >= item.quantity);
        const isActuallyClosed = po.status === 'Closed' || po.status === 'Cancelled' || po.status === 'Fully Invoiced' || (isPOFullyReceived && isPOFullyInvoiced);

        if (!showClosedPOs && isActuallyClosed) return false;

        // Date range filter (Inclusive)
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const poDate = new Date(po.poDate);
          if (poDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const poDate = new Date(po.poDate);
          if (poDate > end) return false;
        }

        const matchesPOQuery = poSearch.trim()
          ? po.poNumber.toLowerCase().includes(poSearch.toLowerCase())
          : true;

        const poSearchFinal = poFilterMode === 'include' ? matchesPOQuery : !matchesPOQuery;

        // PO number range — keeps the PO when its trailing sequence number
        // falls within [start, end]. Either bound is optional so users can
        // ask for "PO ≥ 1001" or "PO ≤ 1010" without typing both. POs
        // without parseable digits (composite numbers) are filtered out
        // when a range is active.
        const rangeStartNum = poRangeStart.trim() ? parseInt(poRangeStart.replace(/[^\d]/g, ''), 10) : NaN;
        const rangeEndNum = poRangeEnd.trim() ? parseInt(poRangeEnd.replace(/[^\d]/g, ''), 10) : NaN;
        const hasRangeFilter = !isNaN(rangeStartNum) || !isNaN(rangeEndNum);
        if (hasRangeFilter) {
          const poNum = extractPONumeric(po.poNumber);
          if (isNaN(poNum)) return false;
          if (!isNaN(rangeStartNum) && poNum < rangeStartNum) return false;
          if (!isNaN(rangeEndNum) && poNum > rangeEndNum) return false;
        }

        const matchesItemQuery = itemSearch.trim()
          ? po.items.some(item => 
              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) || 
              item.description.toLowerCase().includes(itemSearch.toLowerCase())
            )
          : true;
          
        const itemSearchFinal = itemFilterMode === 'include' ? matchesItemQuery : !matchesItemQuery;

        return poSearchFinal && itemSearchFinal;
      });

      // 2. Filter GRNs by grnSearch AND itemSearch AND dateRange.
      // Receivers already on the host invoice render with a disabled
      // "Already on invoice" treatment in the row markup (NOT filtered
      // out here) so the user keeps the visual context.
      const filteredGRNs = v.receivingDocuments.filter(grn => {
        // Closed rule mirrors the POs (BA 9/9): a fully invoiced receiving
        // is closed work — hidden by default, listed (green + locked) only
        // when "Include closed" is on.
        if (!showClosedPOs && grn.status === 'Fully Invoiced') return false;

        // Date range filter for GRNs (Inclusive)
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          const grnDate = new Date(grn.grnDate);
          if (grnDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          const grnDate = new Date(grn.grnDate);
          if (grnDate > end) return false;
        }

        const matchesGRNQuery = grnSearch.trim()
          ? grn.grnNumber.toLowerCase().includes(grnSearch.toLowerCase())
          : true;
          
        const grnSearchFinal = grnFilterMode === 'include' ? matchesGRNQuery : !matchesGRNQuery;

        const matchesItemQuery = itemSearch.trim()
          ? grn.items.some(item => 
              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) || 
              item.description.toLowerCase().includes(itemSearch.toLowerCase())
            )
          : true;
          
        const itemSearchFinal = itemFilterMode === 'include' ? matchesItemQuery : !matchesItemQuery;

        return grnSearchFinal && itemSearchFinal;
      });

      // 2b. Receivers render under their parent PO — the list drops GRNs
      // whose PO was filtered out (by PO search / range / closed toggle),
      // so the GRN set must respect the PO-level filters too. Otherwise
      // the Receivers tab pill counts rows that never render.
      const visiblePONumbers = new Set(filteredPOs.map((po) => po.poNumber));
      const visibleGRNs = filteredGRNs.filter((grn) => visiblePONumbers.has(grn.poNumber));

      // 3. Check Vendor match
      const rawVendorMatch = vendorSearch.trim()
        ? (v.vendorName.toLowerCase().includes(vendorSearch.toLowerCase()) ||
           v.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase()) ||
           v.category.toLowerCase().includes(vendorSearch.toLowerCase()))
        : true;
      
      const matchesVendorQuery = vendorFilterMode === 'include' ? rawVendorMatch : !rawVendorMatch;

      // Logic: A vendor is visible if:
      // (It matches the vendor search OR it's empty) 
      // AND (If PO/GRN/Item search is active, it must have at least one matching child)
      const hasActiveChildSearch = poSearch.trim() || grnSearch.trim() || itemSearch.trim() || startDate || endDate || poRangeStart.trim() || poRangeEnd.trim();
      const hasMatchingChildren = hasActiveChildSearch
        ? (filteredPOs.length > 0 || visibleGRNs.length > 0)
        : true;

      if (matchesVendorQuery && hasMatchingChildren) {
        // Sort POs / GRNs by the active key so the user can prioritize
        // "oldest receivers" / "highest-value POs" / "lowest PO number".
        // We work on shallow copies to avoid mutating the source data.
        const dir = sortDir === 'asc' ? 1 : -1;
        const sortedPOs = [...filteredPOs].sort((a, b) => {
          if (sortKey === 'date') return (new Date(a.poDate).getTime() - new Date(b.poDate).getTime()) * dir;
          if (sortKey === 'value') return (a.poAmount - b.poAmount) * dir;
          if (sortKey === 'remaining') {
            const ar = a.poAmount - (a.invoicedAmount || 0);
            const br = b.poAmount - (b.invoicedAmount || 0);
            return (ar - br) * dir;
          }
          const an = extractPONumeric(a.poNumber);
          const bn = extractPONumeric(b.poNumber);
          if (isNaN(an) && isNaN(bn)) return 0;
          if (isNaN(an)) return 1;
          if (isNaN(bn)) return -1;
          return (an - bn) * dir;
        });
        const sortedGRNs = [...visibleGRNs].sort((a, b) => {
          if (sortKey === 'date') return (new Date(a.grnDate).getTime() - new Date(b.grnDate).getTime()) * dir;
          if (sortKey === 'value' || sortKey === 'remaining') {
            // For GRNs "remaining" falls back to total received value since
            // GRN-level invoiced tracking lives at the line-item level —
            // this keeps the sort coherent across both PO + receiver lists.
            const av = a.items.reduce((s, i) => s + i.totalPrice, 0);
            const bv = b.items.reduce((s, i) => s + i.totalPrice, 0);
            return (av - bv) * dir;
          }
          // GRNs sort by their parent PO number for the poNumber key —
          // keeps related receivers grouped together.
          const an = extractPONumeric(a.poNumber);
          const bn = extractPONumeric(b.poNumber);
          if (isNaN(an) && isNaN(bn)) return 0;
          if (isNaN(an)) return 1;
          if (isNaN(bn)) return -1;
          return (an - bn) * dir;
        });
        return {
          ...v,
          purchaseOrders: sortedPOs,
          receivingDocuments: sortedGRNs
        };
      }
      return null;
    }).filter((v): v is Vendor => v !== null);
  }, [vendorSearch, poSearch, grnSearch, itemSearch, selectedCreatedBy, selectedPOStatus, selectedType, selectedDate, showClosedPOs, vendorFilterMode, poFilterMode, grnFilterMode, itemFilterMode, startDate, endDate, poRangeStart, poRangeEnd, sortKey, sortDir]);

  // Cold-start state — no user input yet. When idle, show a curated 10
  // "Recently used" preview; when the user types anything in any search
  // segment or applies a filter, switch to live filtered results.
  const hasUserInput =
    vendorSearch.trim().length > 0 ||
    poSearch.trim().length > 0 ||
    grnSearch.trim().length > 0 ||
    itemSearch.trim().length > 0 ||
    selectedCreatedBy !== 'all' ||
    selectedPOStatus !== 'all' ||
    selectedType !== 'all' ||
    selectedDate !== '' ||
    showClosedPOs ||
    !!startDate ||
    !!endDate ||
    poRangeStart.trim().length > 0 ||
    poRangeEnd.trim().length > 0;

  const RECENT_CAP = 10;
  const displayVendors = hasUserInput
    ? filteredVendors
    : filteredVendors.slice(0, RECENT_CAP);

  // Single-vendor enforcement (BA UX feedback). poKey is formatted
  // `${vendorCode}-${poNumber}` where vendorCode is e.g. `V-00001`.
  // Once any PO is selected, every other vendor row renders as
  // disabled — clicking a non-matching vendor's checkbox or expand
  // chevron is a no-op + tooltip. Clearing all selections re-enables
  // the entire list.
  const lockedToVendorCode: string | null = useMemo(() => {
    if (selectedPOs.size === 0) return null;
    const first = Array.from(selectedPOs)[0];
    const idx = first.lastIndexOf('-');
    return idx > 0 ? first.slice(0, idx) : null;
  }, [selectedPOs]);
  // Term-kind preview (9/1/26, reworked for the 9/4/26 flow split): the
  // FLOW decides the invoice kind, and that kind bounds which term
  // categories the invoice can take — a pre-invoice cannot run on NET
  // terms, a received-goods invoice cannot run on prepayment terms.
  // Selected POs whose vendor term conflicts feed the footer warning so
  // the user knows a different term gets picked at create.
  const termKindConflicts = useMemo(() => {
    if (!flowKind || selectedPOs.size === 0) return null;
    const pos: string[] = [];
    mockVendors.forEach((vendor) => {
      vendor.purchaseOrders.forEach((po) => {
        if (!selectedPOs.has(`${vendor.vendorCode}-${po.poNumber}`)) return;
        const cat = resolvePaymentTerm(po.paymentTerms || vendor.paymentTerms).category;
        if ((flowKind === 'pre' && cat === 'net') || (flowKind === 'post' && cat === 'prepayment')) pos.push(po.poNumber);
      });
    });
    return pos.length > 0 ? { kind: flowKind, pos } : null;
  }, [flowKind, selectedPOs]);
  // Display name for the lockout tooltip on the greyed-out vendor rows
  // ("Clear Acme Corp to select another.").
  const lockedVendorName = useMemo(
    () =>
      lockedToVendorCode
        ? mockVendors.find((v) => v.vendorCode === lockedToVendorCode)?.vendorName ?? null
        : null,
    [lockedToVendorCode],
  );

  // Fuzzy "Did you mean…" suggestion — only computed when there is a typed
  // query in any segment AND the live results are empty. We search across the
  // full vendor list (not the filtered slice) so a typo can still recover the
  // right partner. Suggestion field tracks which input to repair on click.
  const fuzzySuggestion = useMemo(() => {
    if (displayVendors.length > 0) return null;
    if (vendorSearch.trim()) {
      const candidates = mockVendors.flatMap(v => [v.vendorName, v.vendorCode]);
      const match = findFuzzyMatch(vendorSearch, candidates);
      if (match) return { field: 'vendor' as const, value: match };
    }
    if (poSearch.trim()) {
      const candidates = mockVendors.flatMap(v => v.purchaseOrders.map(po => po.poNumber));
      const match = findFuzzyMatch(poSearch, candidates);
      if (match) return { field: 'po' as const, value: match };
    }
    if (grnSearch.trim()) {
      const candidates = mockVendors.flatMap(v => v.receivingDocuments.map(g => g.grnNumber));
      const match = findFuzzyMatch(grnSearch, candidates);
      if (match) return { field: 'grn' as const, value: match };
    }
    if (itemSearch.trim()) {
      const candidates = Array.from(new Set(
        mockVendors.flatMap(v => v.purchaseOrders.flatMap(po => po.items.flatMap(i => [i.sku, i.description])))
      ));
      const match = findFuzzyMatch(itemSearch, candidates);
      if (match) return { field: 'item' as const, value: match };
    }
    return null;
  }, [displayVendors.length, vendorSearch, poSearch, grnSearch, itemSearch]);

  const applyFuzzySuggestion = () => {
    if (!fuzzySuggestion) return;
    if (fuzzySuggestion.field === 'vendor') setVendorSearch(fuzzySuggestion.value);
    else if (fuzzySuggestion.field === 'po') setPoSearch(fuzzySuggestion.value);
    else if (fuzzySuggestion.field === 'grn') setGrnSearch(fuzzySuggestion.value);
    else if (fuzzySuggestion.field === 'item') setItemSearch(fuzzySuggestion.value);
  };

  // What search auto-expanded, so clearing the query collapses exactly
  // those sections back while sections the user opened stay open
  // (design review 7/9/26: "collapse back when search is erased").
  const searchExpandedRef = useRef<{ vendors: Set<string>; pos: Set<string>; grns: Set<string> }>({
    vendors: new Set(),
    pos: new Set(),
    grns: new Set(),
  });

  useEffect(() => {
    const hasActiveSearch = vendorSearch.trim().length >= 2 ||
                           poSearch.trim().length >= 2 ||
                           grnSearch.trim().length >= 2 ||
                           itemSearch.trim().length >= 2;

    if (!hasActiveSearch) {
      const rec = searchExpandedRef.current;
      if (rec.vendors.size || rec.pos.size || rec.grns.size) {
        if (rec.vendors.size) setExpandedVendors(prev => { const next = new Set(prev); rec.vendors.forEach(id => next.delete(id)); return next; });
        if (rec.pos.size) setExpandedPOs(prev => { const next = new Set(prev); rec.pos.forEach(id => next.delete(id)); return next; });
        if (rec.grns.size) setExpandedGRNs(prev => { const next = new Set(prev); rec.grns.forEach(id => next.delete(id)); return next; });
        searchExpandedRef.current = { vendors: new Set(), pos: new Set(), grns: new Set() };
      }
    }

    if (hasActiveSearch) {
      const newExpandedVendors = new Set<string>();
      const newExpandedPOs = new Set<string>();
      const newExpandedGRNs = new Set<string>();

      filteredVendors.forEach(vendor => {
        let vendorShouldExpand = false;
        
        // Expansion logic for Vendor search
        if (vendorSearch.trim().length >= 2 && (
          vendor.vendorName.toLowerCase().includes(vendorSearch.toLowerCase()) ||
          vendor.vendorCode.toLowerCase().includes(vendorSearch.toLowerCase())
        )) {
          vendorShouldExpand = true;
        }

        // Expansion logic for PO search
        vendor.purchaseOrders.forEach(po => {
          const poMatch = (poSearch.trim().length >= 2 && po.poNumber.toLowerCase().includes(poSearch.toLowerCase())) ||
            (itemSearch.trim().length >= 2 && po.items.some(item => 
              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) || 
              item.description.toLowerCase().includes(itemSearch.toLowerCase())
            ));
          
          if (poMatch) {
            newExpandedPOs.add(`${vendor.vendorCode}-${po.poNumber}`);
            vendorShouldExpand = true;
          }
        });

        // Expansion logic for GRN search — also auto-expand the GRN card
        // itself when an item search hits so the highlighted items render
        // inline (mirrors the PO-tab behavior).
        vendor.receivingDocuments.forEach(grn => {
          const grnMatch = (grnSearch.trim().length >= 2 && grn.grnNumber.toLowerCase().includes(grnSearch.toLowerCase())) ||
            (itemSearch.trim().length >= 2 && grn.items.some(item =>
              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) ||
              item.description.toLowerCase().includes(itemSearch.toLowerCase())
            ));

          if (grnMatch) {
            newExpandedPOs.add(`${vendor.vendorCode}-${grn.poNumber}`);
            newExpandedGRNs.add(`${vendor.vendorCode}-${grn.poNumber}-${grn.grnNumber}`);
            vendorShouldExpand = true;
          }
        });

        if (vendorShouldExpand) {
          newExpandedVendors.add(vendor.id);
        }
      });

      if (newExpandedVendors.size > 0) {
        setExpandedVendors(prev => {
          const next = new Set(prev);
          newExpandedVendors.forEach(id => {
            if (!prev.has(id)) searchExpandedRef.current.vendors.add(id);
            next.add(id);
          });
          return next;
        });
      }

      if (newExpandedPOs.size > 0) {
        setExpandedPOs(prev => {
          const next = new Set(prev);
          newExpandedPOs.forEach(id => {
            if (!prev.has(id)) searchExpandedRef.current.pos.add(id);
            next.add(id);
          });
          return next;
        });
      }

      if (newExpandedGRNs.size > 0) {
        setExpandedGRNs(prev => {
          const next = new Set(prev);
          newExpandedGRNs.forEach(id => {
            if (!prev.has(id)) searchExpandedRef.current.grns.add(id);
            next.add(id);
          });
          return next;
        });
      }
    }
  }, [vendorSearch, poSearch, grnSearch, itemSearch, filteredVendors]);

  const handleContinue = () => {
    if (!isOpen) return;
    // Term-kind confirm on Continue (user 9/22): when the selection
    // carries terms the flow's invoice kind cannot take (NET on a
    // pre-invoice, prepayment on received goods), the footer banner alone
    // is easy to scroll past — a modal makes the term swap a deliberate
    // step before the form opens.
    if (termKindConflicts) {
      setShowTermKindConfirm(true);
      return;
    }
    proceedContinue();
  };

  const proceedContinue = () => {
    const selectedData: SelectedPOData[] = [];

    filteredVendors.forEach(vendor => {
      vendor.purchaseOrders.forEach(po => {
        const poKey = `${vendor.vendorCode}-${po.poNumber}`;
        if (selectedPOs.has(poKey)) {
          // Only include selected items, defensively filtered through the
          // flow's eligibility (9/4/26 split).
          const itemsToPass = po.items.filter(item => selectedItemIds.has(item.id) && lineEligible(item, flowKind));

          if (itemsToPass.length > 0) {
            const poRelatedGRNs = vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber);
            const selectedPOReceipts = poRelatedGRNs.filter(grn => selectedGRNs.has(grn.grnNumber));
            // Pre vs post is the FLOW's assertion (9/4/26, D-01), not an
            // inference from the PO's receivings — a partially received PO
            // billed through the Pre-Invoice flow is a pre-invoice for its
            // unreceived portion, and carries no receiving documents.
            const isPre = flowKind ? flowKind === 'pre' : poRelatedGRNs.length === 0;

            selectedData.push({
              vendorCode: vendor.vendorCode,
              vendorName: vendor.vendorName,
              vendorCategory: vendor.category,
              // The PO's currency, else the vendor's (spec 4.4): the invoice defaults to it.
              currency: po.currency ?? vendor.currency,
              poExchangeRate: po.exchangeRate,
              paymentTerms: vendor.paymentTerms,
              poNumber: po.poNumber,
              poDate: po.poDate,
              poAmount: po.poAmount,
              poStatus: po.status,
              itemCount: itemsToPass.length,
              isPreInvoice: isPre,
              relatedGRNs: isPre ? [] : (selectedPOReceipts.length > 0 ? selectedPOReceipts : poRelatedGRNs),
              items: itemsToPass,
              selectedItemIds: Array.from(selectedItemIds).filter(id => po.items.some(i => i.id === id)),
              selectedGRNItemIds: isPre ? [] : Array.from(selectedGRNItems).filter(key => {
                const [gNum] = key.split(':');
                return poRelatedGRNs.some(grn => grn.grnNumber === gNum);
              })
            });
          }
        }
      });
    });

    onContinue(selectedData);
  };

  // Partner CreatePartnerModal frame: centered via translate, fluid width with
  // 70vw cap on desktop (max 1320px), full-bleed on mobile, 90vh on desktop /
  // 100dvh on mobile. Full view drops the desktop width cap so the modal
  // stretches edge-to-edge inside the inset.
  const modalClasses = isFullScreen
    ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[151] bg-white border border-border w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] rounded-none sm:rounded-2xl overflow-hidden transition-[max-width,max-height,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
    : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[151] bg-white border border-border w-[calc(100%-2rem)] max-w-[100%] sm:max-w-[min(70vw,1320px)] h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden transition-[max-width,max-height,height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[150]"
        onClick={handleCancelClick}
      />

      <div className={modalClasses}>
        <div className="h-full flex flex-col">
              {/* ─── Header — partner CreatePartnerModal header pattern
                  (px-3..5 / pt-3..4 / pb-0, border-b #EEF2F6, plain
                  title + subtitle without icon tile, Full-view chip + X). ─── */}
              <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-4 shrink-0 bg-white border-b border-[#EEF2F6]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {/* Back to invoice-type picker — routed through the
                        discard guard so an in-progress selection isn't lost
                        without confirmation. Only shown when there's a
                        previous step (initial creation flow, not Add-more). */}
                    {onBack && (
                      <button
                        type="button"
                        onClick={handleBackClick}
                        className="mt-0.5 w-8 h-8 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                        aria-label="Back to previous step"
                        title="Back"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-500" />
                      </button>
                    )}
                    {/* Type icon + header follow the FLOW (BA 9/5): the pre
                        flow wears its violet Wallet identity and names its
                        own population; the inventory flow keeps the blue
                        Package card language. */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${flowKind === 'pre' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
                      {flowKind === 'pre' ? <Wallet className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                    <h2
                      className="text-[15px] sm:text-[17px] text-foreground truncate"
                      style={{ fontWeight: 700 }}
                    >
                      {flowKind === 'pre' ? 'Create Pre-Invoice' : 'Create New Inventory Invoice'}
                    </h2>
                    <p
                      className="text-[11px] sm:text-xs text-slate-500 mt-0.5"
                      style={{ fontWeight: 400 }}
                    >
                      {flowKind === 'pre'
                        ? 'Select purchase orders with no receiving or partial receiving to create a pre-invoice.'
                        : 'Pick the purchase orders, receiving documents, or line items to invoice.'}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                      style={{ fontWeight: 500 }}
                    >
                      {isFullScreen ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                      {isFullScreen ? 'Exit Full' : 'Full View'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelClick}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter row — breaks out of header padding via negative
                    margins so a partner-style slate-tinted band runs edge-to
                    -edge behind the search bar + filter chips, separated
                    from the title above by a hairline. */}
                <div className="-mx-3 sm:-mx-4 lg:-mx-5 -mb-3 sm:-mb-4 mt-4 px-3 sm:px-4 lg:px-5 py-3 sm:py-3.5 bg-[#FAFBFC] border-t border-[#EEF2F6] overflow-visible space-y-3">
                  {/* 1. Unified search bar — one rounded container with
                       internal vertical dividers between segments. Outer
                       container picks up a primary focus ring via
                       focus-within, so when any input segment is focused
                       the whole bar gets a clear active state (matches
                       the partner Purchase Order modal). */}
                  <div
                    className="flex items-stretch border border-border rounded-lg bg-white shadow-sm overflow-hidden transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 hover:border-primary/50 [&>div]:flex-1 [&>div:not(:last-child)]:border-r [&>div:not(:last-child)]:border-border/70 [&>div:first-child>input]:rounded-l-lg [&>div:last-child>input]:rounded-r-lg"
                  >
                    {/* Vendor Search (Disabled if fixedVendorId provided) */}
                    <div className="relative group">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder={fixedVendorId ? "Locked to current vendor" : "Search vendors..."}
                        value={fixedVendorId ? "" : vendorSearch}
                        disabled={!!fixedVendorId}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        className={`pl-9 pr-3 h-10 border-0 rounded-none transition-all text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0 ${fixedVendorId ? 'bg-muted/30 cursor-not-allowed text-muted-foreground' : 'bg-white hover:bg-muted/20 focus:bg-white'}`}
                      />
                    </div>

                    {/* PO Search */}
                    <div className="relative group">
                      <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search POs..."
                        value={poSearch}
                        onChange={(e) => setPoSearch(e.target.value)}
                        className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px]"
                      />
                    </div>

                    {/* Receiver Search */}
                    <div className="relative group">
                      <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search receivings..."
                        value={grnSearch}
                        onChange={(e) => setGrnSearch(e.target.value)}
                        className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px]"
                      />
                    </div>

                    {/* Item Search */}
                    <div className="relative group">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="pl-9 pr-3 h-10 bg-white border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/20 focus:bg-white transition-all text-[13px]"
                      />
                    </div>
                  </div>

                  {/* Modern compact filter row — checkboxes with info tooltips,
                      single-pill date range that bundles its own label, red-hover
                      Reset action. Date popover uses shadcn Popover so clicking
                      outside auto-dismisses. */}
                  <div className="flex items-center gap-x-5 gap-y-2 flex-wrap pt-2">
                    {/* "Show only matched line items" — Isha's shipment
                        pattern (design review 7/9/26): ON keeps the search a
                        hard filter, OFF shows every row with the matches
                        highlighted. Selected rows are always visible either
                        way, a selection can never hide. */}
                    <Tooltip delayDuration={500}>
                      <TooltipTrigger asChild>
                        <label htmlFor="show-only-matched" className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            id="show-only-matched"
                            checked={showOnlyMatched}
                            onCheckedChange={(checked) => setShowOnlyMatched(!!checked)}
                            className="w-4 h-4 border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-none"
                          />
                          <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                            Show Only Matched Line Items
                          </span>
                        </label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md">
                        <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 400 }}>
                          When searching items, hide rows that don't match. Turn it off to see every row with matches highlighted. Selected rows always stay visible.
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Received-only checkbox removed (user 10/5): the
                        flow split already scopes the population, so the
                        extra toggle was noise. */}

                    {/* Include-closed — tooltip on label hover */}
                    <Tooltip delayDuration={500}>
                      <TooltipTrigger asChild>
                        <label htmlFor="show-closed-combined" className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            id="show-closed-combined"
                            checked={showClosedPOs}
                            onCheckedChange={(checked) => setShowClosedPOs(!!checked)}
                            className="w-4 h-4 border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-none"
                          />
                          <span className="text-[12px] text-foreground" style={{ fontWeight: 500 }}>
                            Include Closed
                          </span>
                        </label>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md">
                        {/* One line (user 10/5): the example block is gone. */}
                        <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 400 }}>
                          Show fully invoiced POs and receiving documents.
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Date range — single pill, label baked in, Popover for
                        click-outside dismissal */}
                    <Popover
                      open={activePopover === 'date'}
                      onOpenChange={(open) => setActivePopover(open ? 'date' : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          className={`inline-flex items-center gap-2 h-8 px-3 bg-white border rounded-lg transition-colors text-[12px] ${
                            startDate || endDate
                              ? 'border-primary/30 text-foreground'
                              : 'border-border text-slate-600 hover:border-slate-300'
                          }`}
                          style={{ fontWeight: 500 }}
                        >
                          <Calendar className={`w-3.5 h-3.5 ${startDate || endDate ? 'text-primary' : 'text-slate-400'}`} />
                          <span>
                            {startDate && endDate
                              ? `${dayjs(startDate).format('MMM D')} – ${dayjs(endDate).format('MMM D, YYYY')}`
                              : 'PO Date Range'}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'date' ? 'rotate-180' : ''}`} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        sideOffset={6}
                        className="w-auto p-0 bg-white border border-border rounded-xl overflow-hidden"
                        style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
                      >
                        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                          <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>
                            Select Date Range
                          </p>
                          {(startDate || endDate) && (
                            <button
                              onClick={() => { setStartDate(''); setEndDate(''); }}
                              className="text-[11px] text-primary hover:text-blue-700 transition-colors"
                              style={{ fontWeight: 600 }}
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        <CalendarPicker
                          mode="range"
                          numberOfMonths={2}
                          defaultMonth={startDate ? new Date(startDate) : undefined}
                          selected={{
                            from: startDate ? new Date(startDate) : undefined,
                            to: endDate ? new Date(endDate) : undefined,
                          } as DateRange}
                          onSelect={(range: DateRange | undefined) => {
                            setStartDate(range?.from ? dayjs(range.from).format('YYYY-MM-DD') : '');
                            setEndDate(range?.to ? dayjs(range.to).format('YYYY-MM-DD') : '');
                          }}
                          className="p-3"
                        />

                        <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-[#EEF2F6]">
                          <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                            {startDate && endDate
                              ? `${dayjs(startDate).format('MMM D, YYYY')} – ${dayjs(endDate).format('MMM D, YYYY')}`
                              : 'No range selected'}
                          </span>
                          <Button
                            onClick={() => setActivePopover(null)}
                            className="h-8 px-4 text-[12px] rounded-lg shadow-sm"
                            style={{ fontWeight: 600 }}
                          >
                            Apply
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* PO number range — sibling of the date pill so users
                        can pull a sequence (e.g. 1001–1010) in one shot.
                        Same visual recipe as the date range; the trigger
                        label collapses to a compact summary when set. */}
                    <Popover
                      open={activePopover === 'poRange'}
                      onOpenChange={(open) => setActivePopover(open ? 'poRange' : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          className={`inline-flex items-center gap-2 h-8 px-3 bg-white border rounded-lg transition-colors text-[12px] ${
                            poRangeStart.trim() || poRangeEnd.trim()
                              ? 'border-primary/30 text-foreground'
                              : 'border-border text-slate-600 hover:border-slate-300'
                          }`}
                          style={{ fontWeight: 500 }}
                        >
                          <ShoppingCart className={`w-3.5 h-3.5 ${poRangeStart.trim() || poRangeEnd.trim() ? 'text-primary' : 'text-slate-400'}`} />
                          <span>
                            {poRangeStart.trim() && poRangeEnd.trim()
                              ? `PO ${poRangeStart} – ${poRangeEnd}`
                              : poRangeStart.trim()
                                ? `PO ≥ ${poRangeStart}`
                                : poRangeEnd.trim()
                                  ? `PO ≤ ${poRangeEnd}`
                                  : 'PO Number Range'}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activePopover === 'poRange' ? 'rotate-180' : ''}`} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        sideOffset={6}
                        onOpenAutoFocus={(e) => {
                          // Suppress Radix's default focus-first-child
                          // behavior, then land the cursor on the "From"
                          // input ourselves on the next tick so the DOM
                          // node has time to mount. A 0ms setTimeout is
                          // more reliable than rAF here — rAF can fire
                          // before Radix re-establishes its focus scope.
                          e.preventDefault();
                          setTimeout(() => poRangeFromRef.current?.focus(), 0);
                        }}
                        className="w-[320px] p-0 bg-white border border-border rounded-2xl overflow-hidden"
                        style={{ boxShadow: '0 20px 48px -12px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.04)' }}
                      >
                        {/* Header — title + hover-only info tooltip on the
                            left, reset on the right. Compact: icon + title
                            on one line, no subtitle, tight padding. */}
                        <div className="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-[#EEF2F6]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>
                              PO Number Range
                            </span>
                            <Tooltip delayDuration={300}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors"
                                  aria-label="How PO range works"
                                >
                                  <Info className="w-3 h-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 400 }}>
                                  Enter a PO number range. For example, <span style={{ fontWeight: 600 }}>1001 to 1010</span> pulls every PO in that sequence. Leave one side empty for an open-ended range.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {(poRangeStart.trim() || poRangeEnd.trim()) && (
                            <button
                              onClick={() => { setPoRangeStart(''); setPoRangeEnd(''); }}
                              className="text-[11px] text-slate-500 hover:text-primary transition-colors"
                              style={{ fontWeight: 600 }}
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {/* Body — segmented From / arrow / To pair. */}
                        <div className="px-4 py-3">
                          <div className="rounded-lg border border-[#E5E9F0] bg-white px-2.5 py-2 flex items-center gap-2 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>From</label>
                              <Input
                                ref={poRangeFromRef}
                                inputMode="numeric"
                                placeholder="Enter PO No."
                                value={poRangeStart}
                                onChange={(e) => setPoRangeStart(e.target.value.replace(/[^\d]/g, ''))}
                                className="h-6 px-0 text-[13px] bg-transparent border-0 shadow-none focus-visible:ring-0 text-foreground placeholder:text-slate-400 placeholder:font-normal"
                                style={{ fontWeight: 600 }}
                              />
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-3" />
                            <div className="flex-1 min-w-0">
                              <label className="block text-[10px] text-slate-500 mb-0.5" style={{ fontWeight: 500 }}>To</label>
                              <Input
                                inputMode="numeric"
                                placeholder="Enter PO No."
                                value={poRangeEnd}
                                onChange={(e) => setPoRangeEnd(e.target.value.replace(/[^\d]/g, ''))}
                                className="h-6 px-0 text-[13px] bg-transparent border-0 shadow-none focus-visible:ring-0 text-foreground placeholder:text-slate-400 placeholder:font-normal"
                                style={{ fontWeight: 600 }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Inverted range says so (GPT U1, 9/30: 1003 to
                            1002 silently returned nothing). */}
                        {poRangeStart.trim() && poRangeEnd.trim() && Number(poRangeStart) > Number(poRangeEnd) && (
                          <div className="px-4 pb-1 -mt-1">
                            <p className="text-[11px] text-amber-700 inline-flex items-center gap-1" style={{ fontWeight: 500 }}>
                              <Info className="w-3 h-3 shrink-0" />
                              This range is inverted. From {poRangeStart} down to {poRangeEnd} matches nothing; swap the ends.
                            </p>
                          </div>
                        )}

                        {/* Footer — compact summary + filled primary CTA. */}
                        <div className="px-4 pb-3 pt-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 truncate" style={{ fontWeight: 500 }}>
                            {poRangeStart.trim() && poRangeEnd.trim() ? (
                              <span className="text-foreground " style={{ fontWeight: 600 }}>{poRangeStart} – {poRangeEnd}</span>
                            ) : poRangeStart.trim() ? (
                              <>From <span className="text-foreground " style={{ fontWeight: 600 }}>{poRangeStart}</span></>
                            ) : poRangeEnd.trim() ? (
                              <>Up to <span className="text-foreground " style={{ fontWeight: 600 }}>{poRangeEnd}</span></>
                            ) : (
                              'No range set'
                            )}
                          </span>
                          <Button
                            onClick={() => setActivePopover(null)}
                            className="h-7 px-3.5 text-[12px] rounded-md shadow-sm"
                            style={{ fontWeight: 600 }}
                          >
                            Apply
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* Reset — disabled until a search/filter is active (matches
                        the payment modal); red-tinted destructive hover otherwise. */}
                    <button
                      onClick={clearAllFilters}
                      disabled={!hasUserInput}
                      className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] transition-colors group ${
                        hasUserInput
                          ? 'text-slate-500 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                          : 'text-slate-300 cursor-default'
                      }`}
                      style={{ fontWeight: 500 }}
                    >
                      <RotateCcw className={`w-3.5 h-3.5 transition-transform duration-300 ${hasUserInput ? 'group-hover:rotate-[-45deg]' : ''}`} />
                      Reset
                    </button>
                  </div>
                </div>
          </div>

          {/* overscroll-none kills the macOS rubber-band bounce, which
              detached the sticky toolbar mid-bounce and let list rows show
              through behind it (scroll glitch, feedback 7/13/26). */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-none bg-white relative">

            {/* Sticky toolbar group — keeps the Collapse / Sort
                controls and the selection summary at the top of the
                scroll area so the user can always see what's
                selected and how to act on it. Per BA UX feedback —
                previously these scrolled away with the content.
                Measured (ref) so the expanded vendor header can stick
                directly beneath it. */}
            <div ref={stickyToolbarRef} className="sticky top-0 z-20 bg-white">

            {/* Section label — partner pattern:
                · Idle: "Recently used"
                · After search: 'Showing results for "<query>"' on the left,
                  '1-N of M items' counter on the right. */}
            {displayVendors.length > 0 && (
              <div className="flex items-center justify-between px-6 pt-4 pb-2 gap-3">
                <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>
                  {hasUserInput ? (
                    <>
                      Showing results for
                      <span className="ml-1 text-foreground" style={{ fontWeight: 600 }}>
                        "{vendorSearch || poSearch || grnSearch || itemSearch || 'filters'}"
                      </span>
                    </>
                  ) : (
                    "Vendors you've recently invoiced"
                  )}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Collapse-all menu — gives the user a fast way out of a
                      deep search with many expanded cards. Each option
                      clears a single expansion set, so collapsing a layer
                      preserves the others; e.g. "Collapse vendors only"
                      hides every vendor but each vendor will re-open with
                      its previous PO / GRN expansions intact, because we
                      only reset `expandedVendors`. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-white text-[12px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                        Collapse
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[220px]">
                      <DropdownMenuLabel className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                        Collapse Cards
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          setExpandedVendors(new Set());
                          setExpandedPOs(new Set());
                          setExpandedGRNs(new Set());
                        }}
                        className="text-[12px]"
                      >
                        <Layers className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Collapse All
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setExpandedVendors(new Set())}
                        className="text-[12px]"
                      >
                        <Building2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Vendors Only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setExpandedPOs(new Set())}
                        className="text-[12px]"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Purchase Orders Only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setExpandedGRNs(new Set())}
                        className="text-[12px]"
                      >
                        <Package className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Receivings Only
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Sort menu — single dropdown with explicit
                      direction-labeled options so the user picks an
                      intent ("Newest first") rather than having to
                      reason about a separate asc/desc toggle. Groups by
                      key with section headers; remaining-value is
                      included because it's the most useful "what to
                      invoice next" lens. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-white text-[12px] text-slate-600 hover:text-foreground hover:border-slate-300 transition-colors"
                        style={{ fontWeight: 500 }}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <span className="text-foreground" style={{ fontWeight: 500 }}>
                          {(() => {
                            if (sortKey === 'date') return sortDir === 'desc' ? 'Newest First' : 'Oldest First';
                            if (sortKey === 'value') return sortDir === 'desc' ? 'Highest Value' : 'Lowest Value';
                            if (sortKey === 'remaining') return 'Most Remaining';
                            return sortDir === 'desc' ? 'PO No. High → Low' : 'PO No. Low → High';
                          })()}
                        </span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[220px]">
                      <DropdownMenuLabel className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                        <Calendar className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />Date
                      </DropdownMenuLabel>
                      {[
                        { key: 'date' as const, dir: 'desc' as const, label: 'Newest First' },
                        { key: 'date' as const, dir: 'asc' as const, label: 'Oldest First' },
                      ].map(opt => {
                        const active = sortKey === opt.key && sortDir === opt.dir;
                        return (
                          <DropdownMenuItem
                            key={`${opt.key}-${opt.dir}`}
                            onSelect={() => { setSortKey(opt.key); setSortDir(opt.dir); }}
                            className="text-[12px] flex items-center justify-between"
                          >
                            {opt.label}
                            {active && <Check className="w-3.5 h-3.5 text-primary" />}
                          </DropdownMenuItem>
                        );
                      })}

                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                        <DollarSign className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />Value
                      </DropdownMenuLabel>
                      {[
                        { key: 'value' as const, dir: 'desc' as const, label: 'Highest First' },
                        { key: 'value' as const, dir: 'asc' as const, label: 'Lowest First' },
                        { key: 'remaining' as const, dir: 'desc' as const, label: 'Most Remaining to Invoice' },
                      ].map(opt => {
                        const active = sortKey === opt.key && sortDir === opt.dir;
                        return (
                          <DropdownMenuItem
                            key={`${opt.key}-${opt.dir}`}
                            onSelect={() => { setSortKey(opt.key); setSortDir(opt.dir); }}
                            className="text-[12px] flex items-center justify-between"
                          >
                            {opt.label}
                            {active && <Check className="w-3.5 h-3.5 text-primary" />}
                          </DropdownMenuItem>
                        );
                      })}

                      {/* PO-number sorts removed (Nophil 9/28): sorting by
                          identifier confused everyone and answered no real
                          question the date/value sorts don't. */}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {hasUserInput && filteredVendors.length > 0 && (
                    <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                      Showing{' '}
                      <span className="text-foreground" style={{ fontWeight: 600 }}>
                        1-{filteredVendors.length}
                      </span>{' '}
                      of{' '}
                      <span className="text-foreground" style={{ fontWeight: 600 }}>
                        {mockVendors.length}
                      </span>{' '}
                      items
                    </span>
                  )}
                </div>
              </div>
            )}
            </div>{/* end sticky toolbar group */}

            {/* Empty state — when search returns nothing OR (just on first
                paint) we have no data. Partner-style centered illustration
                + headline + guidance copy. When the user has typed a query
                we layer in a fuzzy "Did you mean…" suggestion and a
                create-partner CTA so a typo or missing partner doesn't
                dead-end the flow. */}
            {displayVendors.length === 0 && (() => {
              /* Table Empty States Standard (11/3/26): one shared state; the
                 four search segments read as the search, the rest as filters. */
              const segQuery = [vendorSearch, poSearch, grnSearch, itemSearch].map((q) => q.trim()).filter(Boolean).join(' ');
              const segFilterCount =
                (selectedCreatedBy !== 'all' ? 1 : 0) + (selectedPOStatus !== 'all' ? 1 : 0) + (selectedType !== 'all' ? 1 : 0) +
                (selectedDate !== '' ? 1 : 0) + (showClosedPOs ? 1 : 0) + (startDate || endDate ? 1 : 0) +
                (poRangeStart.trim() || poRangeEnd.trim() ? 1 : 0);
              const clearSegSearch = () => { setVendorSearch(''); setPoSearch(''); setGrnSearch(''); setItemSearch(''); };
              const clearSegFilters = () => {
                setSelectedCreatedBy('all'); setSelectedPOStatus('all'); setSelectedType('all'); setSelectedDate('');
                setShowClosedPOs(false); setStartDate(''); setEndDate(''); setPoRangeStart(''); setPoRangeEnd('');
              };
              return (
                <div className="flex flex-col">
                  <TableEmptyState
                    compact
                    kind={resolveTableEmptyKind({ totalCount: mockVendors.length, filteredCount: 0, searchQuery: segQuery, filterCount: segFilterCount }) ?? 'no-data'}
                    entity={{ singular: 'vendor', plural: 'vendors' }}
                    searchQuery={segQuery}
                    filterCount={segFilterCount}
                    suggestion={fuzzySuggestion?.value ?? null}
                    onApplySuggestion={() => applyFuzzySuggestion()}
                    onClearSearch={clearSegSearch}
                    onClearFilters={clearSegFilters}
                    onClearAll={clearAllFilters}
                  />
                {hasUserInput && vendorSearch.trim() && (
                  <a
                    href={PARTNER_CREATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="-mt-4 mb-8 mx-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-[12px] hover:bg-primary/90 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Create New Partner
                  </a>
                )}
                </div>
              );
            })()}

            <div className="divide-y divide-[#EEF2F6]">
              {displayVendors.map((vendor) => (
                <VendorNestedRow
                  key={vendor.id}
                  vendor={vendor}
                  vendorSearch={vendorSearch}
                  poSearch={poSearch}
                  grnSearch={grnSearch}
                  itemSearch={itemSearch}
                  itemFilterMode={itemFilterMode}
                  showOnlyMatched={showOnlyMatched}
                  isExpanded={expandedVendors.has(vendor.id)}
                  onToggle={() => toggleVendor(vendor.id)}
                  selectedPOs={selectedPOs}
                  selectedItemIds={selectedItemIds}
                  selectedGRNs={selectedGRNs}
                  collapsedPOItemTables={collapsedPOItemTables}
                  onTogglePO={togglePOSelection}
                  onToggleItem={toggleItemSelection}
                  onToggleGRNSelection={toggleGRNSelection}
                  onToggleGRNItem={toggleGRNItemSelection}
                  onToggleItemTableCollapse={toggleItemTableCollapse}
                  onSelectAllPOs={selectAllVendorPOs}
                  highlightText={highlightText}
                  expandedPOs={expandedPOs}
                  onTogglePOExpand={togglePO}
                  expandedGRNs={expandedGRNs}
                  onToggleGRNExpand={toggleGRN}
                  selectedGRNItems={selectedGRNItems}
                  setPreviewImage={setPreviewImage}
                  quickViewOpen={!!previewImage}
                  excludedPOs={excludedPOs}
                  excludedGRNs={excludedGRNs}
                  excludedGRNItems={preselectedGRNItems}
                  excludedPOItemIds={excludedPOItemIds}
                  lockedOut={!!lockedToVendorCode && lockedToVendorCode !== vendor.vendorCode}
                  lockedVendorName={lockedVendorName ?? undefined}
                  prepaidPOContext={prepaidPOContext}
                  flowKind={flowKind}
                  stickyTop={stickyToolbarHeight}
                  selectionInfo={lockedToVendorCode === vendor.vendorCode ? {
                    poCount: selectedPOs.size,
                    receiverCount: selectedGRNs.size,
                    // One unit everywhere: billable PO line items. Adding
                    // selectedGRNItems double-counted lines picked via a
                    // receiver (the "18 vs 36" mismatch, review 7/9/26).
                    itemCount: selectedItemIds.size,
                    onClear: () => {
                      setSelectedPOs(new Set());
                      setSelectedItemIds(new Set());
                      setSelectedGRNs(new Set());
                      setSelectedGRNItems(new Set());
                    },
                  } : undefined}
                />
              ))}
            </div>
          </div>

          {/* Info bar — full-width edge-to-edge banner mounted just
              above the footer. Matches the partner module's carrier-
              creation banner recipe: violet fill, slim vertical
              padding, slim Info icon + message on the left, dismiss
              X on the right. No horizontal gutter so it spans the
              modal edge-to-edge. */}
          {/* Term-kind warning (9/1/26) — persistent while the selection
              carries terms the implied invoice kind cannot take. */}
          {termKindConflicts && (
            <div className="shrink-0 border-t border-amber-200 bg-amber-50/80 flex items-center gap-2.5 px-3 sm:px-4 lg:px-5 py-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <p className="text-[11px] leading-snug text-amber-800 flex-1" style={{ fontWeight: 500 }}>
                {termKindConflicts.kind === 'pre'
                  ? `${termKindConflicts.pos.length} selected ${termKindConflicts.pos.length === 1 ? 'PO carries' : 'POs carry'} NET terms, which apply only after receiving. Continue opens the term templates so you can pick the prepayment or split term this pre-invoice runs on.`
                  : `${termKindConflicts.pos.length} selected ${termKindConflicts.pos.length === 1 ? 'PO carries' : 'POs carry'} prepayment terms, which don’t apply to received goods. Continue opens the term templates so you can pick the NET or split term this invoice runs on.`}
              </p>
            </div>
          )}
          {showAlert.show && (
            <div
              className={`shrink-0 border-t flex items-center gap-2.5 px-3 sm:px-4 lg:px-5 py-2 animate-in fade-in slide-in-from-bottom-1 duration-200 ${
                showAlert.type === 'warning'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-violet-50 border-violet-200'
              }`}
            >
              {showAlert.type === 'warning' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-red-700 shrink-0" />
              ) : (
                <Info className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              )}
              <p
                className={`text-[11px] leading-snug flex-1 ${
                  showAlert.type === 'warning' ? 'text-red-900' : 'text-violet-900'
                }`}
                style={{ fontWeight: 500 }}
              >
                {showAlert.msg}
              </p>
              <button
                onClick={() => setShowAlert({ ...showAlert, show: false })}
                className={`shrink-0 w-5 h-5 rounded inline-flex items-center justify-center transition-colors ${
                  showAlert.type === 'warning'
                    ? 'text-red-500 hover:text-red-700 hover:bg-red-100'
                    : 'text-violet-500 hover:text-violet-800 hover:bg-violet-100'
                }`}
                aria-label="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* ─── Footer — partner Create-modal pattern: selection summary on
              left in plain muted text, Cancel + primary CTA on right. Uses
              the system primary color (not hard-coded blue-600) so it
              matches the rest of the design system. ─── */}
          {/* Footer — partner CreatePartnerModal byte-exact: white bg,
              border-[#EEF2F6] hairline, px-3..5 py-2.5..3, end-aligned
              cluster with selection summary at left via mr-auto, Cancel
              outline + primary CTA on the right. */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-4 lg:px-5 py-2.5 sm:py-3 flex items-center justify-end gap-2 sm:gap-2.5 sm:rounded-b-2xl">
            <div className="text-xs sm:text-[13px] text-slate-500 mr-auto" style={{ fontWeight: 500 }}>
              {/* Why the other vendors grayed out lives in a tooltip on the
                  locked vendor rows themselves (moved from here, 7/13/26). */}
              <span className="text-foreground " style={{ fontWeight: 600 }}>
                {selectedItemIds.size}
              </span>{' '}
              {selectedItemIds.size === 1 ? 'item' : 'items'} selected from{' '}
              <span className="text-foreground " style={{ fontWeight: 600 }}>
                {selectedPOs.size}
              </span>{' '}
              {selectedPOs.size === 1 ? 'PO' : 'POs'}
              {selectedGRNs.size > 0 && (
                <>
                  {' · '}
                  <span className="text-foreground " style={{ fontWeight: 600 }}>
                    {selectedGRNs.size}
                  </span>{' '}
                  {selectedGRNs.size === 1 ? 'receiving' : 'receivings'}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleCancelClick}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              className="inline-flex items-center justify-center h-8 sm:h-9 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] border border-slate-200 cursor-pointer transition-colors"
              style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Cancel
            </button>
            <Button
              onClick={() => {
                if (selectedItemIds.size === 0) {
                  toast.error('Nothing selected', { description: 'Pick at least one document to continue.' });
                  return;
                }
                if (selectedVendorCount > 1) {
                  toast.error('One vendor at a time', { description: 'An invoice covers a single vendor. Keep documents from one vendor only.' });
                  return;
                }
                handleContinue();
              }}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm"
            >
              {selectedVendorCount > 1 ? 'Select Single Vendor Only' : 'Continue'}
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          </div>
      </div>

      {/* ─── Discard Confirmation — partner Create-modal pattern (1:1):
          soft red radial glow at top of card, plain red triangle icon (no
          ring), red DISCARD text (no chip), 18px bold title, body
          copy, deep-red Discard primary, Continue editing on slate-tinted
          footer band. ─── */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setShowDiscardConfirm(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Colored glow header — pinkish gradient fading to white, plus
                a blurred red glow blob behind the icon tile. */}
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{
                background:
                  'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)',
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none"
                style={{ backgroundColor: '#EF4444', filter: 'blur(50px)' }}
              />

              {/* Icon tile — 64×64 rounded square with tinted red bg holding
                  the AlertTriangle, byte-exact partner pattern. */}
              <div
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: '#FEE2E2' }}
              >
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>

              <span
                className="mt-4 px-3 py-1 rounded-full text-[11px]"
                style={{
                  fontWeight: 600,
                  backgroundColor: '#FEF2F2',
                  color: '#991B1B',
                }}
              >
                Discard
              </span>
            </div>

            {/* Body */}
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3
                className="text-[18px] tracking-[-0.02em]"
                style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
              >
                Discard changes?
              </h3>
              {/* One line (Nophil 9/28): the inventory of what gets
                  cleared read as noise. */}
              <p
                className="text-[13px] mt-2 mx-auto"
                style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}
              >
                Any changes you made will be discarded.
              </p>

              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItemIds(new Set());
                    setSelectedPOs(new Set());
                    setSelectedGRNs(new Set());
                    setSelectedGRNItems(new Set());
                    setShowDiscardConfirm(false);
                    // Resolve to the action that opened the prompt: the back
                    // button steps back to the type picker, while Cancel / X
                    // close the modal entirely (onDiscard, falling back to
                    // onClose).
                    if (discardActionRef.current === 'back') {
                      onBack?.();
                    } else {
                      (onDiscard ?? onClose)();
                    }
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{
                    fontWeight: 600,
                    backgroundColor: 'hsl(var(--destructive))',
                    color: '#fff',
                  }}
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{
                    fontWeight: 500,
                    backgroundColor: '#F8FAFC',
                    color: '#334155',
                  }}
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

      {/* ─── Term-kind confirm on Continue (user 9/22) — same overlay
          recipe as the discard confirm, worn in amber: the selection
          carries terms the flow's invoice kind cannot take, so the term
          swap becomes a deliberate step instead of a scrolled-past
          banner. ─── */}
      {showTermKindConfirm && termKindConflicts && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150"
          onClick={() => setShowTermKindConfirm(false)}
        >
          <div
            className="relative bg-white w-full sm:max-w-[420px] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)' }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none"
                style={{ backgroundColor: '#B45309', filter: 'blur(50px)' }}
              />
              <div
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: '#FEF3C7' }}
              >
                <AlertTriangle className="w-8 h-8" style={{ color: '#B45309' }} />
              </div>
              <span
                className="mt-4 px-3 py-1 rounded-full text-[11px]"
                style={{ fontWeight: 600, backgroundColor: '#FFFBEB', color: '#92400E' }}
              >
                Payment Terms
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                {termKindConflicts.kind === 'pre'
                  ? 'NET terms do not apply to a pre-invoice'
                  : 'Prepayment terms do not apply to received goods'}
              </h3>
              <p
                className="text-[13px] mt-2 mx-auto"
                style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '320px' }}
              >
                {termKindConflicts.kind === 'pre'
                  ? `${termKindConflicts.pos.length === 1 ? `PO ${termKindConflicts.pos[0]} carries` : `${termKindConflicts.pos.length} selected POs carry`} NET terms, which start only after receiving. This pre-invoice runs on a prepayment or split term instead. You pick it on the next screen.`
                  : `${termKindConflicts.pos.length === 1 ? `PO ${termKindConflicts.pos[0]} carries` : `${termKindConflicts.pos.length} selected POs carry`} prepayment terms, which do not apply to received goods. This invoice runs on a NET or split term instead. You pick it on the next screen.`}
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowTermKindConfirm(false);
                    proceedContinue();
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: '#B45309', color: '#fff' }}
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => setShowTermKindConfirm(false)}
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

      {/* Item QuickView Modal — partner ItemQuickView parity (carousel hero,
          status pill, stat grid, detail rows, Go-to-Item CTA). The outer
          backdrop keeps the vendor-invoicing dark + blur treatment instead
          of partner's plain bg-black/50, per current design system. */}
      {previewImage && (() => {
        const sku = previewImage.sku || previewImage.alt;
        const vendorName = previewImage.vendorName || '';
        const d = mockItemDataFull(sku);
        const poolPhotos = photosForSku(sku);
        const photos = [previewImage.src, ...poolPhotos.filter(p => p !== previewImage.src)];
        const currentPhoto = photos[previewPhotoIdx % photos.length];
        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-white rounded-2xl border border-gray-200/50 overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close — pinned top-right, above everything */}
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-gray-200"
              >
                <X className="w-4 h-4 text-slate-700" />
              </button>

              <div className="flex-1 overflow-y-auto">
                {/* Image carousel */}
                <div className="relative overflow-hidden bg-[#0C1222] select-none shrink-0" style={{ height: 'clamp(200px, 45vh, 420px)' }}>
                  <ImageWithFallback
                    src={currentPhoto}
                    alt={sku}
                    className="w-full h-full object-cover transition-opacity duration-200"
                  />
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />

                  {/* Zoom — opens full-screen image in new tab */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(currentPhoto, '_blank', 'noopener'); }}
                    className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>

                  {/* Carousel arrows */}
                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoIdx(p => (p - 1 + photos.length) % photos.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoIdx(p => (p + 1) % photos.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {/* Dot indicators */}
                  {photos.length > 1 && (
                    <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPreviewPhotoIdx(i)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${i === (previewPhotoIdx % photos.length) ? 'bg-white w-3' : 'bg-white/40 hover:bg-white/60 w-1.5'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Detail body */}
                <div className="px-5 pt-4 pb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>{sku}</span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border bg-slate-50 text-slate-600 border-slate-200"
                      style={{ fontWeight: 500 }}
                    >
                      <Star className="w-3 h-3" />
                      Primary: {d.category}
                    </span>
                  </div>

                  <p className="text-[13px] text-slate-500 mt-2 leading-relaxed line-clamp-3" style={{ fontWeight: 400 }}>
                    {d.desc}
                  </p>

                  {/* 4-col stat grid */}
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-200 rounded-xl border border-gray-200 overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
                    <div className="px-2.5 py-2.5 text-center">
                      <div className="text-[13px] text-gray-900 truncate" style={{ fontWeight: 700 }}>{(vendorName || 'Vendor').split(' ').slice(0, 2).join(' ')}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Partner</div>
                    </div>
                    <div className="px-2.5 py-2.5 text-center">
                      <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>{formatCurrency(d.unitPrice)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Price per Unit</div>
                    </div>
                    <div className="px-2.5 py-2.5 text-center">
                      <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>
                        {d.uom}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Stocking Unit</div>
                    </div>
                    <div className="px-2.5 py-2.5 text-center">
                      <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>
                        {d.leadTime}
                        <span className="text-[11px] text-slate-500 ml-0.5">days</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Lead Time</div>
                    </div>
                  </div>

                  {/* Detail rows — master-data attributes (category / UOM,
                      inventory control, acquisition). No stock levels. */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2.5 py-0.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{d.category}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[13px] text-slate-500">{d.uom}</span>
                    </div>
                    <div className="flex items-center gap-2.5 py-0.5">
                      <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{d.inventoryControl}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[13px] text-slate-500">{d.acquisition}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { window.open(ITEMS_MODULE_URL, '_blank', 'noopener'); setPreviewImage(null); }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer bg-primary hover:bg-blue-700"
                  style={{ fontWeight: 600 }}
                >
                  Go to Item
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

interface VendorNestedRowProps {
  vendor: Vendor;
  vendorSearch: string;
  poSearch: string;
  grnSearch: string;
  itemSearch: string;
  itemFilterMode: 'include' | 'exclude';
  /** When false, item search highlights instead of hard-filtering rows. */
  showOnlyMatched: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  selectedPOs: Set<string>;
  selectedItemIds: Set<string>;
  selectedGRNs: Set<string>;
  collapsedPOItemTables: Set<string>;
  onTogglePO: (poKey: string, vendor: Vendor, po: VendorPO) => void;
  onToggleItem: (item: LineItem, poKey: string, po: VendorPO, vendor: Vendor) => void;
  onToggleGRNSelection: (grnNumber: string, poKey: string, po: VendorPO, grn: VendorGRN) => void;
  onToggleGRNItem: (item: LineItem, grn: VendorGRN, po: VendorPO, poKey: string) => void;
  onToggleItemTableCollapse: (poKey: string) => void;
  onSelectAllPOs: (vendor: Vendor, select: boolean) => void;
  highlightText: (text: string, query: string) => React.ReactNode;
  expandedPOs: Set<string>;
  onTogglePOExpand: (poKey: string) => void;
  expandedGRNs: Set<string>;
  onToggleGRNExpand: (grnKey: string) => void;
  selectedGRNItems: Set<string>;
  setPreviewImage: (image: { src: string, alt: string, sku?: string, vendorName?: string } | null) => void;
  quickViewOpen: boolean;
  /** POs / GRNs / item composite keys already on the host invoice.
   *  Rows whose identifier is in these sets render with a disabled
   *  "Already on invoice" treatment so the user can see them but
   *  can't re-pick them. */
  excludedPOs: Set<string>;
  excludedGRNs: Set<string>;
  excludedGRNItems: Set<string>;
  /** Raw PO line-item IDs already on the host invoice. PO-item
   *  checkboxes render as indeterminate ("partially on invoice")
   *  with a hover tooltip; clicking escalates to a full select. */
  excludedPOItemIds: Set<string>;
  /** Single-vendor enforcement (BA UX feedback). When true the
   *  entire row renders disabled — every interactive control is
   *  pointer-events-none + 40% opacity, and a tooltip on hover
   *  explains why. */
  lockedOut?: boolean;
  /** Name of the vendor currently holding the selection — read by the
   *  lockout tooltip so the copy can say who to clear. */
  lockedVendorName?: string;
  /** When this is the actively-selected vendor, the row pins a
   *  green "Selected" chip with PO / receiver / item counts on the
   *  card header (replaces the previous standalone blue bar that
   *  sat above the vendor list per BA UX feedback). */
  selectionInfo?: {
    poCount: number;
    receiverCount: number;
    itemCount: number;
    onClear: () => void;
  };
  /** Offset (px) below the modal's sticky toolbar — the expanded vendor's
   *  header row sticks here so the Selected indicator stays visible while
   *  scrolling through its POs / receivers (BA UX feedback). */
  stickyTop?: number;
  /** POs with paid prepayments against their pre-invoices. */
  prepaidPOContext?: Record<string, { preInvoiceNumber: string; amount: number }>;
  /** Which creation flow opened the picker (9/4/26 split). */
  flowKind?: 'pre' | 'post';
}

// External Items module URL — opened in a new tab when an item code is
// clicked, matching partner Items column behavior.
const ITEMS_MODULE_URL = 'https://nimble-palette.lovable.app';

// Deterministic per-item image picker — same partner pattern: a stable
// FNV-style string hash picks one of N pre-vetted Unsplash photos so every
// item number gets a unique image. IDs match the partner Items column + the proven
// set already used in mockVendors so we know they resolve.
const ITEM_IMAGES = [
  'photo-1772209049802-cd0e0ff1a5d3',
  'photo-1713575882582-8938739db351',
  'photo-1737223450913-2af6885945e1',
  'photo-1759159091728-e2c87b9d9315',
  'photo-1661069387900-54d5843b704d',
  'photo-1758873263527-ca53b938fbd4',
  'photo-1672689933227-2ce1249c46a9',
  'photo-1767340078306-89630b12d81c',
  'photo-1769355104335-acef3aa4c9b6',
  'photo-1758857087505-957823893209',
];
const imageForSku = (sku: string) => {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const photo = ITEM_IMAGES[Math.abs(h) % ITEM_IMAGES.length];
  return `https://images.unsplash.com/${photo}?w=160&h=160&fit=crop&auto=format&q=80`;
};

// Partner ItemQuickView parity: stable string hash + a multi-photo pool so
// every item number resolves a deterministic 2-3 image carousel set, plus mock
// master-data metadata (category, UOM, inventory control, acquisition,
// unit price, lead time) for the rich detail modal opened on item-image
// click. No stock-level data — vendor invoices don't surface it.
const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};
const ITEM_PHOTOS_LARGE = ITEM_IMAGES.map(p => `https://images.unsplash.com/${p}?w=600&h=400&fit=crop&auto=format&q=80`);
const photosForSku = (sku: string) => {
  const base = hashStr(sku);
  const count = (base % 2) + 2; // 2 or 3 photos
  return Array.from({ length: count }, (_, i) => ITEM_PHOTOS_LARGE[(base + i) % ITEM_PHOTOS_LARGE.length]);
};
const ITEM_UOMS = ['EA', 'ft', 'PK', 'RL', 'kg', 'lb', 'BX', 'SET'];
const formatCurrency = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
// Full deterministic item data — combines hover-card meta with extras
// needed by the QuickView (UOM, leadTime, longer desc).
function mockItemDataFull(sku: string, fallbackDesc?: string) {
  const meta = itemMetaFor(sku);
  const h = hashStr(sku);
  const uom = ITEM_UOMS[h % ITEM_UOMS.length];
  const unitPrice = ((hashStr(sku + 'p') % 500) + 10) + 0.99;
  const leadTime = (hashStr(sku + 'l') % 14) + 3;
  const desc = longDescriptionFor(sku, fallbackDesc || '');
  return { ...meta, uom, unitPrice, leadTime, desc };
}

// Deterministic per-item item metadata (category / inventory control /
// acquisition / price / short HoverCard description). Mirrors the
// Inventory > Items master-data fields — stock-level status is
// intentionally NOT surfaced here: on a vendor invoice you bill what
// was ordered/received, so on-hand / out-of-stock isn't relevant.
const ITEM_CATEGORIES = ['Raw Material', 'Component', 'Assembly', 'Consumable', 'Finished Good'];
const ITEM_INVENTORY_CONTROLS = ['Serialized', 'Non-Serialized'] as const;
const ITEM_ACQUISITIONS = ['Purchase', 'Manufacturing'] as const;
const ITEM_SHORT_DESCS = [
  'Industrial-grade component, batch-tracked, ready for production.',
  'Mill-certified raw material, ASTM-compliant.',
  'High-tolerance machined part for OEM assembly.',
  'Consumable supply, replenished on PAR-level schedule.',
  'Finished-good inventory item, pick-pack-ready.',
];
const itemMetaFor = (sku: string) => {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const ah = Math.abs(h);
  const category = ITEM_CATEGORIES[ah % ITEM_CATEGORIES.length];
  const inventoryControl = ITEM_INVENTORY_CONTROLS[ah % ITEM_INVENTORY_CONTROLS.length];
  const acquisition = ITEM_ACQUISITIONS[(ah * 3) % ITEM_ACQUISITIONS.length];
  const shortDesc = ITEM_SHORT_DESCS[ah % ITEM_SHORT_DESCS.length];
  const price = `$${(((ah * 7) % 500) + 10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return { category, inventoryControl, acquisition, shortDesc, price };
};

// Synthesize a longer realistic item description for any item number. Keeps the
// underlying mockVendors.ts shape untouched — wraps the existing
// description with category-specific tail text for visual variety.
const longDescriptionFor = (sku: string, baseDescription: string) => {
  const tails: Record<string, string> = {
    STEEL: 'Cold-rolled, ASTM A53 Grade B, ISO 9001 mill certified. Suitable for structural fabrication, laser-cutting, and process-piping applications. Batch-traceable from receiving through QA inspection.',
    COPPER: 'High-purity electrolytic copper at 99.95% conductivity, deburred and chamfered, RoHS-compliant. Indicated for power distribution, grounding, and HVAC line-set assembly.',
    WELD: 'AWS A5.1 E7018 low-hydrogen electrodes, moisture-resistant flux coating. Recommended for arc and TIG welding on mild / low-alloy steels under structural code.',
    MILD: 'ASTM A36 grade mild steel, hot-rolled finish with mill scale, normalized and stress-relieved. Ready for machining, drilling, and downstream powder coating.',
    ALLOY: '4140 chromoly alloy, normalized and tempered to HRC 28-32. Indicated for high-stress shaft, gear, and structural applications under cyclic loading.',
    ELEC: 'Industrial-grade power management IC, 450V rated, IEC 60068 environmental compliance. Includes anti-static packaging and full traceability documentation.',
    CAB: 'Heavy-duty 10 AWG copper conductor with XLPE insulation and tinned-copper shield. Suitable for industrial control panels, motor leads, and outdoor runs to NEC 600V.',
    BRKT: 'Hot-dipped galvanized steel mounting bracket, 12 ga, pre-drilled to 3/8" hole pattern. Powder-coated finish, indoor / outdoor rated, includes mounting hardware.',
    TECH: 'Pro-grade workstation hardware bundle including chassis, peripherals, and mounting kit. Pre-configured imaging, 3-year onsite warranty, asset-tag ready.',
    HYD: 'ISO VG 46 anti-wear hydraulic fluid, zinc-additive formula, oxidation-stabilized for extended drain intervals on industrial gear and hydraulic systems.',
    SAFE: 'Type I Class C ANSI Z89.1 hard hat with 4-point ratchet suspension, vented shell, dielectric-rated. Sweatband replaceable, side-slot accessory-ready.',
    GLOVE: 'Cut-resistant ANSI A4 work gloves with HPPE-blend liner and PU palm coating. Touchscreen-capable, machine-washable, sold in bulk by weight.',
    DEFAULT: 'Industrial-grade component sourced from a certified mill, batch-tracked through receiving QA, and approved for production-line use. Includes COA and mill-test report on request.',
  };
  const prefix = sku.split(/[-_\s]/)[0]?.toUpperCase() ?? 'DEFAULT';
  const tail = tails[prefix] ?? tails.DEFAULT;
  return baseDescription ? `${baseDescription}, ${tail}` : tail;
};

// Item image with partner-pattern HoverCard preview. Hovering the image
// opens a quick-preview card (slate-800 gradient header + white details:
// category, on-hand qty, unit price, status pill). Clicking still fires
// the lightbox preview wiring.
function ItemImageWithPreview({
  sku,
  src,
  alt,
  onPreview,
  size = 36,
  disabled = false,
}: {
  sku: string;
  src: string;
  alt: string;
  onPreview: () => void;
  size?: 32 | 36;
  /** When true the HoverCard quick-preview is force-closed — used while
      the full ItemQuickView modal is open so the small card never stacks
      in front of (or behind) the big modal. */
  disabled?: boolean;
}) {
  const meta = itemMetaFor(sku);
  const dim = size === 32 ? 'w-8 h-8' : 'w-9 h-9';
  return (
    <HoverCard openDelay={300} closeDelay={80} open={disabled ? false : undefined}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className={`${dim} rounded-lg border border-border bg-slate-50 overflow-hidden flex-shrink-0 cursor-zoom-in hover:border-primary/40 transition-colors group/img`}
        >
          <ImageWithFallback
            src={src}
            alt={alt}
            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-0 overflow-hidden z-[70]"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
              <ImageWithFallback src={src} alt={alt} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{sku}</p>
              <p className="text-[11px] text-slate-400 truncate">{meta.shortDesc}</p>
            </div>
          </div>
        </div>
        <div className="bg-white px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{meta.category}</span>
            </div>
            <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
              {meta.price}
              <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
            </span>
          </div>
          {/* Master-data attributes (neutral pills) — no stock status. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <Hash className="w-3 h-3 text-slate-400" />
              {meta.inventoryControl}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <ShoppingCart className="w-3 h-3 text-slate-400" />
              {meta.acquisition}
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// Per-row description truncation with inline "more / Show less" toggle —
// partner Lovable Purchase Orders item-row pattern. State is local to each
// item so toggling one doesn't expand all.
function ItemDescriptionWithToggle({
  description,
  highlightText,
  itemSearch,
}: {
  description: string;
  highlightText: (text: string, query: string) => React.ReactNode;
  itemSearch: string;
}) {
  const [expanded, setExpanded] = useState(false);
  // The description fills whatever width the Items column has (user 9/30 —
  // the old 240px cap left the column mostly white space), and the "more"
  // toggle appears only when the text actually overflows that width.
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [description, itemSearch, expanded]);
  if (!description) return null;
  return (
    <div className="text-[11px] text-slate-500 font-normal leading-snug mt-0.5 w-full">
      {expanded ? (
        <span className="block">
          {highlightText(description, itemSearch)}{' '}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors text-[11px] align-baseline"
            style={{ fontWeight: 500 }}
          >
            Show Less
            <ChevronUp className="w-3 h-3" />
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-1 w-full">
          <span ref={textRef} className="truncate flex-1 min-w-0">{highlightText(description, itemSearch)}</span>
          {overflowing && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
              className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors shrink-0 text-[11px]"
              style={{ fontWeight: 500 }}
            >
              more
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function VendorNestedRow({
  vendor,
  vendorSearch,
  poSearch,
  grnSearch,
  itemSearch,
  itemFilterMode,
  showOnlyMatched,
  isExpanded,
  onToggle,
  selectedPOs,
  selectedItemIds,
  selectedGRNs,
  collapsedPOItemTables,
  onTogglePO,
  onToggleItem,
  onToggleGRNSelection,
  onToggleGRNItem,
  onToggleItemTableCollapse,
  onSelectAllPOs,
  highlightText,
  expandedPOs,
  onTogglePOExpand,
  expandedGRNs,
  onToggleGRNExpand,
  selectedGRNItems,
  setPreviewImage,
  quickViewOpen,
  excludedPOs,
  excludedGRNs,
  excludedGRNItems,
  excludedPOItemIds,
  lockedOut,
  lockedVendorName,
  selectionInfo,
  stickyTop = 0,
  prepaidPOContext,
  flowKind,
}: VendorNestedRowProps) {
  // Pre-invoices are PO-only by definition — the pre flow opens (and
  // stays) on the Purchase Orders tab; the Receivings tab is hidden.
  const [activeTab, setActiveTab] = useState<'pos' | 'receivers'>(flowKind === 'pre' ? 'pos' : 'receivers');
  const [showFullDescription, setShowFullDescription] = useState(false);
  // Locked-card explainer (9/2/26): the reason FOLLOWS THE CURSOR over
  // the whole locked card instead of anchoring to one edge — an anchored
  // tooltip rendered over the neighbouring row and read as the wrong
  // card. Portaled to body because the dialog's transform would break
  // position:fixed. pointer-events-none so it never steals the hover.
  // Show DELAY of 300ms (user 9/9): instant tips flashed on every pass
  // of the cursor and read as noise — the position keeps tracking
  // silently, the tip only appears after a deliberate hover.
  const [lockTip, setLockTip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const lockTipPos = useRef({ x: 0, y: 0 });
  const lockTipShown = useRef(false);
  const lockTipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (lockTipTimer.current) clearTimeout(lockTipTimer.current); }, []);
  const lockTipHandlers = (locked: boolean, content: React.ReactNode) =>
    locked
      ? {
          onMouseMove: (e: React.MouseEvent) => {
            lockTipPos.current = {
              x: Math.min(e.clientX + 14, window.innerWidth - 286),
              y: Math.min(e.clientY + 18, window.innerHeight - 110),
            };
            if (lockTipShown.current) {
              setLockTip({ ...lockTipPos.current, content });
            } else if (!lockTipTimer.current) {
              lockTipTimer.current = setTimeout(() => {
                lockTipTimer.current = null;
                lockTipShown.current = true;
                setLockTip({ ...lockTipPos.current, content });
              }, 300);
            }
          },
          onMouseLeave: () => {
            if (lockTipTimer.current) {
              clearTimeout(lockTipTimer.current);
              lockTipTimer.current = null;
            }
            lockTipShown.current = false;
            setLockTip(null);
          },
        }
      : {};

  // KPI stat boxes deep-link into the vendor: expand the row (if collapsed)
  // and jump straight to the relevant tab — Unprocessed → Receivers,
  // POs to invoice → Purchase Orders.
  const openVendorTab = (tab: 'pos' | 'receivers') => {
    setActiveTab(tab);
    if (!isExpanded) onToggle();
  };

  // Description text — synthesized from vendor metadata (Vendor type doesn't
  // ship a description field). Long enough to need truncation + toggle.
  const vendorDescription = `${vendor.category} vendor specializing in ${vendor.type} operations. Established supplier with ${vendor.currency} settlements on ${vendor.paymentTerms} terms. Active across multiple purchase orders with consistent on-time delivery and competitive pricing for the supply chain.`;

  // Draft POs appear in NEITHER creation flow (9/4/26, BB-07): a draft
  // was never sent to the vendor, so there is nothing to bill. All the
  // row's listing, counting and select-all math runs on this set.
  const listedPOs = vendor.purchaseOrders.filter(po => po.status !== 'Draft');
  // Select-all reads "fully selected" against the flow's ELIGIBLE lines
  // of POs that have any — ineligible (greyed) lines can never join.
  const selectablePOs = listedPOs.filter(po => po.items.some(item => lineEligible(item, flowKind)));
  const allPOsFullySelected = selectablePOs.length > 0 &&
    selectablePOs.every(po => po.items.filter(item => lineEligible(item, flowKind)).every(item => selectedItemIds.has(item.id)));

  const anyPOPartiallySelected = listedPOs.some(po => po.items.some(item => selectedItemIds.has(item.id)));

  const allPOsCheckboxState = allPOsFullySelected ? true : (anyPOPartiallySelected ? "indeterminate" : false);
  
  const statusColors: Record<string, string> = {
    'Draft': 'bg-slate-50 text-slate-500 border-slate-200',
    'Sent': 'bg-sky-50 text-sky-700 border-sky-200',
    'Confirmed': 'bg-blue-50 text-blue-700 border-blue-200',
    'Partially Received': 'bg-amber-50 text-amber-700 border-amber-200',
    'Fully Received': 'bg-green-50 text-green-700 border-green-200',
    'Closed': 'bg-gray-50 text-gray-700 border-gray-200'
  };

  const totalPOs = vendor.purchaseOrders.length;
  const invoicedPOs = vendor.purchaseOrders.filter(po => (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0).length;
  const uninvoicedPOs = totalPOs - invoicedPOs;

  const invoicedAmount = vendor.purchaseOrders.reduce((sum, po) => sum + (po.invoicedAmount || 0), 0);
  const totalAmount = vendor.purchaseOrders.reduce((sum, po) => sum + po.poAmount, 0);
  
  const totalGRNs = vendor.receivingDocuments.length;
  const uninvoicedGRNs = totalGRNs; // Match the count to the total receivers shown in the list for consistency as requested

  const handleDocumentClick = (e: React.MouseEvent, poKey: string, grnNumber: string) => {
    e.stopPropagation();

    // Mirror the Receivers-tab → PO-tab navigation: switch to the
    // Receivers tab, pre-expand the matching GRN, then scroll+flash so
    // the user lands on the right card.
    setActiveTab('receivers');

    const grnKey = `${poKey}-${grnNumber}`;
    if (!expandedGRNs.has(grnKey)) {
      onToggleGRNExpand(grnKey);
    }

    // Slight delay so the tab swap renders the receiver list before we
    // try to find + flash the target card.
    setTimeout(() => {
      const element = document.getElementById(`grn-${grnNumber}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2');
        }, 2000);
      }
    }, 300);
  };

  // ── "Selected" chip navigation — clicking a count segment jumps to the
  // first selected PO / receiver / item container, reusing the linked-
  // document scroll + flash recipe above.
  const flashAndScroll = (elementId: string) => {
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
        setTimeout(() => element.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2'), 2000);
      }
    }, 300);
  };

  const firstSelectedPO =
    vendor.purchaseOrders.find(po => selectedPOs.has(po.poNumber)) ??
    vendor.purchaseOrders.find(po => po.items.some(i => selectedItemIds.has(i.id)));
  const firstSelectedGRN =
    vendor.receivingDocuments.find(g => selectedGRNs.has(g.grnNumber)) ??
    vendor.receivingDocuments.find(g => g.items.some(i => selectedGRNItems.has(`${g.grnNumber}:${i.id}`)));

  const goToSelectedPO = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firstSelectedPO) return;
    if (!isExpanded) onToggle();
    setActiveTab('pos');
    const poKey = `${vendor.vendorCode}-${firstSelectedPO.poNumber}`;
    if (!expandedPOs.has(poKey)) onTogglePOExpand(poKey);
    flashAndScroll(`po-${poKey}`);
  };

  const goToSelectedReceiver = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firstSelectedGRN) return;
    if (!isExpanded) onToggle();
    setActiveTab('receivers');
    const poKey = `${vendor.vendorCode}-${firstSelectedGRN.poNumber}`;
    const grnKey = `${poKey}-${firstSelectedGRN.grnNumber}`;
    if (!expandedGRNs.has(grnKey)) onToggleGRNExpand(grnKey);
    flashAndScroll(`grn-${firstSelectedGRN.grnNumber}`);
  };

  const goToSelectedItems = (e: React.MouseEvent) => {
    // Items live inside PO / receiver cards — route to whichever holds
    // the first selected one.
    if (vendor.purchaseOrders.some(po => po.items.some(i => selectedItemIds.has(i.id)))) {
      goToSelectedPO(e);
    } else {
      goToSelectedReceiver(e);
    }
  };

  // Keep a selected vendor visibly highlighted even when its card is
  // collapsed, so the selection reads at a glance (not just via the pill).
  const hasSelection =
    !!selectionInfo &&
    selectionInfo.poCount + selectionInfo.receiverCount + selectionInfo.itemCount > 0;

  return (
    // Outer row wrapper — single-vendor lockout per BA UX feedback.
    // When lockedOut, opacity drops to 40% and the row's CHILDREN stop
    // receiving pointer events while the wrapper itself keeps them. The
    // lockout explainer uses the same cursor-follow tip as the locked
    // cards (fix 9/9): the old Radix tooltip anchored to the edge of a
    // trigger taller than the viewport and rendered detached, floating
    // over the modal footer.
    <div
      {...lockTipHandlers(
        lockedOut,
        <p className="text-[11px] text-slate-500 leading-snug">
          You can only invoice one vendor at a time. Clear {lockedVendorName || 'the current selection'} to select another.
        </p>,
      )}
      className={`transition-all duration-150 border-b border-[#EEF2F6] last:border-0 ${
        lockedOut ? 'opacity-40 cursor-not-allowed [&>*]:pointer-events-none' : ''
      }`}
      style={{
        backgroundColor: isExpanded || hasSelection ? '#F8FAFF' : '#FFFFFF',
      }}
      aria-disabled={lockedOut}
    >
      {/* Cursor-following locked-card explainer (9/2/26). */}
      {lockTip &&
        createPortal(
          <div
            className="fixed pointer-events-none z-[300] max-w-[270px] p-2.5 bg-white border border-border rounded-lg shadow-md"
            style={{ left: lockTip.x, top: lockTip.y }}
          >
            {lockTip.content}
          </div>,
          document.body,
        )}
      {/* Expanded vendors pin this header (with its Selected counts chip)
          right below the modal's sticky toolbar so the selection summary
          stays visible while scrolling the PO / receiver lists. */}
      <div
        className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer group select-none transition-all ${
          isExpanded ? 'sticky z-[15] border-b border-[#E4EDFB] shadow-[0_2px_5px_-3px_rgba(15,23,42,0.10)]' : ''
        }`}
        style={isExpanded ? { top: stickyTop, backgroundColor: '#F8FAFF' } : undefined}
        onClick={onToggle}
        onMouseEnter={(e) => {
          if (!isExpanded) e.currentTarget.parentElement!.style.backgroundColor = '#F0F7FF';
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) e.currentTarget.parentElement!.style.backgroundColor = hasSelection ? '#F8FAFF' : '#FFFFFF';
        }}
      >
        {/* Chevron tile — partner pattern: w-7 h-7 rounded-md, slate-tinted
            default, primary-tinted when expanded. */}
        <div
          className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-colors"
          style={{
            backgroundColor: isExpanded ? '#D6E8FF' : 'hsl(var(--muted))',
            color: isExpanded ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
          }}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>

        {/* Vendor avatar — soft border (no heavy ring), partner card icon-tile pattern */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden flex items-center justify-center transition-all bg-white"
          style={{
            border: isExpanded ? '1px solid rgba(10,119,255,0.25)' : '1px solid hsl(var(--border))',
            boxShadow: isExpanded
              ? '0 0 0 1px rgba(10,119,255,0.10)'
              : '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          {vendor.imageUrl ? (
            <ImageWithFallback
              src={vendor.imageUrl}
              alt={vendor.vendorName}
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className={`w-5 h-5 ${isExpanded ? 'text-primary' : 'text-slate-400'}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + inline pills — partner pattern, tight spacing, no chevron
              on Active, no Customer or partner-group pills (vendor-invoicing
              only). */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3
              className="text-[14px] text-foreground tracking-tight truncate"
              style={{ fontWeight: 600 }}
            >
              {highlightText(vendor.vendorName, vendorSearch)}
            </h3>

            {/* Active + category pills harmonised with the partner
                Pricing Rules pill recipe — rounded-md (not full),
                px-1.5 py-0.5. Leading status-dot removed per BA so
                the pill is just the label. */}
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100"
              style={{ fontWeight: 600 }}
            >
              Active
            </span>

            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-50 text-slate-600 border border-slate-200"
              style={{ fontWeight: 500 }}
            >
              {vendor.category}
            </span>

            {/* The partner record's currency (spec 4.2); its POs are raised in it. */}
            <CurrencyPill code={vendor.currency} note="The vendor's default currency, from its partner record" />

            {/* Selection summary chip — original segmented pill (colored
                "Selected" tag + neutral count segments + clear ×). Forced to
                the same height as the Active / category pills via an
                explicit h-[18px] on the chip + items-stretch so every
                segment fills it; leading-none + text-[10px] keep the content
                tight (no airy line-height) so it never reads taller. Count
                segments stay clickable, jumping to the first selected PO /
                receiver / item. */}
            {selectionInfo && (
              <span
                className="inline-flex items-stretch h-[18px] rounded-md border border-blue-200 overflow-hidden text-[10px] leading-none"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Left segment — colored tag */}
                <span
                  className="inline-flex items-center gap-1 px-1.5 bg-blue-50 text-primary"
                  style={{ fontWeight: 600 }}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Selected
                </span>
                {([
                  { count: selectionInfo.poCount, label: selectionInfo.poCount === 1 ? 'PO' : 'POs', onClick: goToSelectedPO, title: 'Jump to the selected purchase orders' },
                  { count: selectionInfo.receiverCount, label: 'Rec', onClick: goToSelectedReceiver, title: 'Jump to the selected receivings' },
                  { count: selectionInfo.itemCount, label: 'Items', onClick: goToSelectedItems, title: 'Jump to the selected items' },
                ] as const).map((seg, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={seg.onClick}
                    disabled={seg.count === 0}
                    title={seg.title}
                    className="inline-flex items-center gap-0.5 px-1.5 bg-white text-slate-600 border-l border-blue-200 transition-colors enabled:cursor-pointer enabled:hover:bg-blue-50 enabled:hover:text-primary disabled:opacity-50"
                    style={{ fontWeight: 500 }}
                  >
                    <span className="text-[9px]" style={{ fontWeight: 700 }}>{seg.count}</span>
                    <span className="text-slate-400 text-[9px] tracking-wider">{seg.label}</span>
                  </button>
                ))}
                {/* Trailing × — clears the selection in one click (red) */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); selectionInfo.onClear(); }}
                  className="inline-flex items-center justify-center px-1 bg-white text-destructive hover:bg-red-50 border-l border-blue-200 transition-colors cursor-pointer"
                  title="Clear selection"
                  aria-label="Clear selection"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            )}
          </div>

          {/* Single-line description with compact inline "more"/"less" toggle
              (text-[11px], no icon). */}
          <div className="mt-0.5 text-[11px] text-slate-500 leading-snug" style={{ fontWeight: 400 }}>
            {showFullDescription ? (
              <>
                <span>{vendorDescription}</span>{' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowFullDescription(false); }}
                  className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors align-baseline text-[11px]"
                  style={{ fontWeight: 500 }}
                >
                  Show Less
                  <ChevronUp className="w-3 h-3" />
                </button>
              </>
            ) : (
              <span className="flex items-center gap-1">
                <span className="truncate min-w-0">{vendorDescription}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowFullDescription(true); }}
                  className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors shrink-0 text-[11px]"
                  style={{ fontWeight: 500 }}
                >
                  more
                  <ChevronDown className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 pr-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Stat box — partner soft card pattern. The Uninvoiced metric is
              Receivings-based, so it's dropped ENTIRELY from the PO-only
              pre-invoice flow (user 10/5: a disabled chip there made no
              sense). Inventory flows still show it. */}
          {flowKind !== 'pre' && (
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openVendorTab('receivers')}
                aria-label="Open Receivings tab"
                className="flex items-center gap-2.5 bg-white px-2.5 py-1.5 rounded-lg border border-border transition-all duration-200 group/metric text-left hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                  uninvoicedGRNs > 0
                    ? 'bg-slate-50 text-slate-500 group-hover/metric:bg-blue-50 group-hover/metric:text-primary'
                    : 'bg-slate-50 text-slate-400'
                }`}>
                  <Package className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col leading-none">
                  <span
                    className={`text-[14px] ${uninvoicedGRNs > 0 ? 'text-foreground' : 'text-slate-400'}`}
                    style={{ fontWeight: 600 }}
                  >
                    {uninvoicedGRNs}
                  </span>
                  {/* "Uninvoiced", the module's own word (Nophil 9/28):
                      nothing else here says "processed". */}
                  <span className="text-[10px] text-slate-500 mt-1" style={{ fontWeight: 500 }}>
                    Uninvoiced
                  </span>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md">
              <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 400 }}>
                Receiving documents attached to this vendor that haven't been turned into an invoice yet. Click to expand the vendor and select them.
              </p>
              <div className="mt-2 p-2 bg-slate-50 rounded-md">
                <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Example</p>
                <p className="text-[11px] text-foreground mt-1" style={{ fontWeight: 500 }}>
                  <span className="text-emerald-700" style={{ fontWeight: 600 }}>{uninvoicedGRNs} receiving{uninvoicedGRNs === 1 ? '' : 's'}</span> ready to be billed.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
          )}

          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openVendorTab('pos')}
                aria-label="Open Purchase Orders tab"
                className="flex items-center gap-2.5 bg-white px-2.5 py-1.5 rounded-lg border border-border hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group/metric text-left"
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                  uninvoicedPOs > 0
                    ? 'bg-slate-50 text-slate-500 group-hover/metric:bg-amber-50 group-hover/metric:text-amber-700'
                    : 'bg-slate-50 text-slate-400'
                }`}>
                  <ShoppingCart className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col leading-none">
                  <span
                    className={`text-[14px] ${uninvoicedPOs > 0 ? 'text-foreground' : 'text-slate-400'}`}
                    style={{ fontWeight: 600 }}
                  >
                    {uninvoicedPOs}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1" style={{ fontWeight: 500 }}>
                    POs to Invoice
                  </span>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] p-3 bg-white border border-border rounded-lg shadow-md">
              <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 400 }}>
                Purchase orders with outstanding balance that can still be invoiced, items ordered but not fully billed yet. Click to expand the vendor and review them.
              </p>
              <div className="mt-2 p-2 bg-slate-50 rounded-md">
                <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Example</p>
                <p className="text-[11px] text-foreground mt-1" style={{ fontWeight: 500 }}>
                  <span className="text-emerald-700" style={{ fontWeight: 600 }}>{uninvoicedPOs} PO{uninvoicedPOs === 1 ? '' : 's'}</span> with unbilled items remaining.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Waterfall expand (user 10/8) — the shared collapse recipe. */}
      <CollapseReveal open={isExpanded}>
        <div className="px-6 pb-6 pl-7">
          {/* Pre-Invoice flow (9/4/26): no tabs — pre-invoices are PO-only,
              so the section header names the population instead. "Open POs"
              = anything sent to the vendor and not fully received (BB-07,
              label per OPEN-01). */}
          {flowKind === 'pre' ? (
            /* Pre-invoices are PO-only, so there's nothing to switch to —
               but the header uses the SAME tab chrome as the inventory flow
               (user 10/5: keep it consistent), rendered as one always-active
               tab instead of a bare label row. */
            <div className="flex items-center gap-1 mb-5 border-b border-[#EEF2F6]">
              <div className="px-3 py-2 text-[13px] relative flex items-center gap-2 text-primary" style={{ fontWeight: 600 }}>
                <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                Open POs
                <span
                  className="inline-flex items-center px-1.5 py-0 rounded-md text-[10px] border bg-blue-50 text-blue-700 border-blue-100"
                  style={{ fontWeight: 500 }}
                >
                  {listedPOs.length}
                </span>
                <div className="absolute -bottom-px left-0 right-0 h-[2px] rounded-t-full bg-primary" />
              </div>
            </div>
          ) : (
          /* Tab Switcher, partner stepper tab pattern: clean text label,
             tighter padding, 2px primary underline on active, soft pill
             counter with partner soft-tone palette. */
          <div className="flex items-center gap-1 mb-5 border-b border-[#EEF2F6]">
            <button
              onClick={() => setActiveTab('receivers')}
              className={`px-3 py-2 text-[13px] transition-colors relative flex items-center gap-2 ${
                activeTab === 'receivers' ? 'text-primary' : 'text-slate-500 hover:text-foreground'
              }`}
              style={{ fontWeight: activeTab === 'receivers' ? 600 : 500 }}
            >
              <Package className={`w-3.5 h-3.5 ${activeTab === 'receivers' ? 'text-primary' : 'text-slate-400'}`} />
              Receivings
              <span
                className={`inline-flex items-center px-1.5 py-0 rounded-md text-[10px] border ${
                  activeTab === 'receivers'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
                style={{ fontWeight: 500 }}
              >
                {vendor.receivingDocuments.length}
              </span>
              {activeTab === 'receivers' && (
                <div className="absolute -bottom-px left-0 right-0 h-[2px] rounded-t-full bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-3 py-2 text-[13px] transition-colors relative flex items-center gap-2 ${
                activeTab === 'pos' ? 'text-primary' : 'text-slate-500 hover:text-foreground'
              }`}
              style={{ fontWeight: activeTab === 'pos' ? 600 : 500 }}
            >
              <ShoppingCart className={`w-3.5 h-3.5 ${activeTab === 'pos' ? 'text-primary' : 'text-slate-400'}`} />
              Purchase Orders
              <span
                className={`inline-flex items-center px-1.5 py-0 rounded-md text-[10px] border ${
                  activeTab === 'pos'
                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
                style={{ fontWeight: 500 }}
              >
                {listedPOs.length}
              </span>
              {activeTab === 'pos' && (
                <div className="absolute -bottom-px left-0 right-0 h-[2px] rounded-t-full bg-primary" />
              )}
            </button>
          </div>
          )}

          {activeTab === 'pos' ? (
                        <div className="space-y-3 border-l-2 border-blue-100 pl-4 py-2">
              {listedPOs.map((po) => {
                const poKey = `${vendor.vendorCode}-${po.poNumber}`;
                const relatedGRNs = vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber);

                // Deriving selection state directly from item data ensures perfect synchronization between tabs.
                // The DENOMINATOR stays "all children" on purpose (9/4/26,
                // BB-04): a partially received PO whose eligible lines are
                // all selected still shows the minus/indeterminate state,
                // signalling that part of this PO is NOT on the document.
                const selectedItemsInPO = po.items.filter(item => selectedItemIds.has(item.id)).length;
                const totalGRNItems = relatedGRNs.reduce((sum, g) => sum + g.items.length, 0);
                const selectedGRNItemsInPO = relatedGRNs.reduce(
                  (sum, g) => sum + g.items.filter(i => selectedGRNItems.has(`${g.grnNumber}:${i.id}`)).length,
                  0
                );
                const totalChildren = po.items.length + (flowKind === 'pre' ? 0 : totalGRNItems);
                const selectedChildren = selectedItemsInPO + (flowKind === 'pre' ? 0 : selectedGRNItemsInPO);
                const isSelected = selectedChildren > 0;
                const isPOExpanded = expandedPOs.has(poKey);

                // ERP Rule: Pre-Invoice only for POs with NO receiving documents
                const isPreInvoiceEligible = relatedGRNs.length === 0;
                // Flow lock (9/4/26 split): a PO with no line the current
                // flow can bill renders visible but locked — Eli explicitly
                // wants the listing machinery preserved, not filtered.
                const flowEligibleLines = po.items.filter(item => lineEligible(item, flowKind)).length;
                const isFlowLocked = !!flowKind && flowEligibleLines === 0;

                const isPOFullySelected = totalChildren > 0 && selectedChildren === totalChildren;
                const isPOIndeterminate = selectedChildren > 0 && selectedChildren < totalChildren;
                const poCheckboxState: boolean | "indeterminate" = isPOFullySelected ? true : (isPOIndeterminate ? "indeterminate" : false);

                // Determine accurate business status
                const totalReceived = po.items.reduce((sum, i) => sum + (i.receivedQty || 0), 0);
                const totalOrdered = po.items.reduce((sum, i) => sum + i.quantity, 0);
                const isInvoiced = (po.invoicedAmount || 0) > 0;
                const isFullyInvoiced = (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0;

                let effectiveStatus = po.status;
                if (relatedGRNs.length === 0) {
                  // 'Sent' keeps its own pill (9/4/26): a sent-not-confirmed
                  // PO is a real pipeline state, not a Confirmed lookalike.
                  effectiveStatus = po.status === 'Sent' ? 'Sent' : 'Confirmed';
                } else if (totalReceived >= totalOrdered) {
                  effectiveStatus = 'Fully Received';
                } else if (totalReceived > 0) {
                  effectiveStatus = 'Partially Received';
                }

                // Additional status layer: Invoicing
                const isInvoicingPartial = isInvoiced && !isFullyInvoiced;
                const displayStatus = isFullyInvoiced ? 'Fully Invoiced' : effectiveStatus;
                // POs already on the host invoice (add-more flow) lock
                // with the same disabled treatment but a different
                // tooltip so the user understands why.
                const isPOAlreadyOnInvoice = excludedPOs.has(po.poNumber);
                // V1 mixed-kind lock: once one kind is in the selection,
                // the other kind disables (this PO stays selectable if it
                // is already part of the selection).
                const isPOLocked = displayStatus === 'Closed' || displayStatus === 'Fully Invoiced' || isPOAlreadyOnInvoice || isFlowLocked;
                // Partially received PO in the Inventory flow (BA 9/6):
                // stays selectable — the cursor tip just explains why only
                // the received lines can tick.
                const isPartialInfo =
                  flowKind === 'post' &&
                  !isPOLocked &&
                  flowEligibleLines > 0 &&
                  po.items.some((i) => !lineEligible(i, 'post'));
                const partialInfoReason = (
                  <>
                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>{PARTIAL_PO_INFO.title}</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{PARTIAL_PO_INFO.body}</p>
                  </>
                );

                // The locked reason, shared by the checkbox tooltip and
                // the whole-card tooltip so hovering ANYWHERE explains
                // why the row is disabled (8/31/26 feedback).
                const lockedReason = isFlowLocked && !(displayStatus === 'Closed' || displayStatus === 'Fully Invoiced') ? (
                  flowKind === 'pre' ? (
                    <>
                      <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Nothing left to pre-invoice</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Everything on this PO has been received. A pre-invoice only covers goods not yet received. Bill this PO through the Inventory Invoice flow.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>{UNRECEIVED_LINE_LOCK.title}</p>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This PO has no receivings, so it can't be invoiced yet. To invoice it before goods arrive, use the Pre-Invoice flow.</p>
                    </>
                  )
                ) : isPOAlreadyOnInvoice ? (
                  <>
                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Already on this invoice</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This PO is already part of the invoice you're editing, so it can't be re-added.</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>{displayStatus}</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This PO is closed or fully invoiced, so its items can't be added here.</p>
                  </>
                );
                return (
                  // Locked cards explain themselves with the cursor-follow
                  // tip over the WHOLE card (9/2/26) — the old header-
                  // anchored tooltip floated over the neighbouring row.
                  <div key={po.poNumber} id={`po-${poKey}`} {...lockTipHandlers(isPOLocked || isPartialInfo, isPOLocked ? lockedReason : partialInfoReason)} className={`rounded-xl border transition-all ${
                    isSelected
                      ? 'border-blue-300 bg-blue-50/50 shadow-sm'
                      : isPOLocked
                        // Locked recipe (8/31/26 rework): near-white card so
                        // the checkbox and icon tile stay visible; the COLOR
                        // drains out of the pills/amount instead, and the
                        // card keeps its own hover.
                        ? 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-300'
                        : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                  }`}>
                    <div
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer group"
                      onClick={() => onTogglePOExpand(poKey)}
                    >
                      <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded transition-all ${
                        isPOExpanded ? 'bg-accent text-primary shadow-sm' : 'text-muted-foreground group-hover:bg-muted'
                      }`}>
                        {isPOExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>

                      <div onClick={(e) => e.stopPropagation()} className="flex items-center px-1">
                        {isPOLocked ? (
                          /* Single-tooltip rule (8/31/26): the header wrap
                             already explains the lock — the checkbox stays
                             quiet so hovering card vs checkbox reads ONE
                             message. */
                          <span className="inline-flex items-center cursor-not-allowed">
                            <Checkbox
                              checked={poCheckboxState}
                              disabled
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
                            />
                          </span>
                        ) : (
                          <Checkbox
                            checked={poCheckboxState}
                            onCheckedChange={() => onTogglePO(poKey, vendor, po)}
                          />
                        )}
                      </div>
                      
                      <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center transition-all ${
                        isPOLocked
                          ? 'bg-slate-200/80 text-slate-400'
                          : isSelected ? 'bg-accent text-primary shadow-sm' : 'bg-muted text-muted-foreground group-hover:bg-blue-50 group-hover:text-primary'
                      }`}>
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-[13px] ${
                              displayStatus === 'Closed' || displayStatus === 'Fully Invoiced'
                                ? 'text-gray-500 line-through decoration-gray-300'
                                : isPOLocked
                                  ? 'text-slate-400'
                                  : 'text-gray-900 group-hover:text-blue-600 transition-colors'
                            }`}>
                              {/* Explicit "PO No." label, don't rely on the
                                  cart icon alone to signal a PO number. */}
                              <span className="text-slate-400">PO No.</span> {highlightText(po.poNumber, poSearch)}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-sm border ${
                              isPOLocked
                                ? 'bg-slate-100 text-slate-400 border-slate-200'
                                : statusColors[displayStatus] || 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                              {displayStatus}
                            </span>
                            {isInvoiced && !isFullyInvoiced && (
                              <span className="text-[9px] font-bold px-1.5 py-0.25 rounded-sm border bg-purple-50 text-purple-700 border-purple-200">
                                Partially Invoiced
                              </span>
                            )}
                            {/* Reconciliation flag (Eli, 8/31/26): a paid
                                prepayment waits on this PO — invoicing it
                                consumes the prepayment and closes the
                                linked pre-invoice. */}
                            {prepaidPOContext?.[po.poNumber] && (() => {
                              const ctx = prepaidPOContext[po.poNumber];
                              return (
                                <Tooltip delayDuration={150}>
                                  <TooltipTrigger asChild>
                                    <span className="text-[9px] font-bold px-1.5 py-0.25 rounded-sm border bg-violet-50 text-violet-700 border-violet-200 cursor-help">
                                      {`Prepaid · ${formatMoney(ctx.amount, vendor.currency)}`}
                                    </span>
                                  </TooltipTrigger>
                                  {/* The full reconciliation story lives in
                                      THIS tooltip (9/3/26 review) — the
                                      on-card strip grew the card and broke
                                      the row rhythm, so it's gone. */}
                                  <TooltipContent side="top" className="max-w-[290px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Prepaid on this PO</p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5 ">
                                      <span className="text-violet-700" style={{ fontWeight: 600 }}>{ctx.preInvoiceNumber}</span> already paid{' '}
                                      <span className="text-violet-700" style={{ fontWeight: 600 }}>{formatMoney(ctx.amount, vendor.currency)}</span> against PO-{po.poNumber}. It's applied automatically when you invoice this receiving.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-medium text-gray-500">
                            <span className="text-gray-400"><span className="font-bold text-gray-500">{po.items.length}</span> {po.items.length === 1 ? 'item' : 'items'}</span>
                            {/* Receivings slot always renders so Confirmed
                                (not-yet-received) cards keep the same meta
                                shape as received ones. Plain muted text with
                                a bold count, matching the receiving cards'
                                PO No. meta treatment. */}
                            <span className="text-gray-300 font-normal">•</span>
                            {relatedGRNs.length > 0 ? (
                              <span className="text-gray-400"><span className="font-bold text-gray-500">{relatedGRNs.length}</span> {relatedGRNs.length === 1 ? 'Receiving' : 'Receivings'}</span>
                            ) : (
                              <span className="text-gray-400">No receivings</span>
                            )}
                            {selectedItemsInPO > 0 && (
                              <>
                                <span className="text-gray-300 font-normal">•</span>
                                <span className="text-blue-600 font-bold bg-blue-50 px-1.5 rounded-sm">{selectedItemsInPO} selected</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-0.5 px-2">
                          <div className="flex items-center gap-2">
                            {isInvoiced && (
                              <div className="flex items-center gap-1.5">
                                {/* Info icon INSIDE the pill (9/3/26
                                    review) — it floated between the pill
                                    and the PO value and read detached. */}
                                <span className={`text-[10px] font-semibold ${
                                  isPreInvoiceEligible
                                    // Pre-invoice wears its violet dashed identity (user 10/10).
                                    ? 'text-violet-700 bg-violet-50 border-violet-300 border-dashed'
                                    : 'text-green-600 bg-green-50 border-green-100'
                                } px-1.5 py-0.5 border rounded flex items-center gap-1`}>
                                  {isPreInvoiceEligible ? <Tag className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                  {isPreInvoiceEligible ? 'Pre-Invoice' : 'Invoiced'}: {formatMoney(po.invoicedAmount ?? 0, vendor.currency)}
                                  {isPreInvoiceEligible && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="w-3 h-3 text-amber-400 cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[200px] p-2 text-[10px]">
                                        Pre-invoicing is active for this PO because no goods have been received yet.
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </span>
                              </div>
                            )}
                            <span className={`text-[14px] font-semibold ${isPOLocked ? 'text-slate-400' : 'text-green-600'}`}>
                              {/* The PO date, its latest receiving and today (Currency & Exchange Rates). */}
                              <MoneyOnDates
                                value={po.poAmount}
                                currency={po.currency ?? vendor.currency}
                                poDate={po.poDate}
                                receivingDate={vendor.receivingDocuments.filter((g) => g.poNumber === po.poNumber).map((g) => g.grnDate).sort().pop()}
                                role="PO currency"
                              />
                            </span>
                          </div>
                          <span className="text-[8px] text-gray-400 font-bold">PO Value</span>
                        </div>
                      </div>
                    </div>

                    {isPOExpanded && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200 space-y-4">
                        {/* Section 1: Items Table - All PO Line Items.
                            When no Linked-Receivers section follows, the
                            items wrapper extends to the card bottom with
                            -mb-4 + rounded-b-xl so the parent's pb-4 doesn't
                            leave a tinted gap under the table (mirrors the
                            Receivers GRN expansion pattern). */}
                        {/* Items table fills to the bottom of the
                            expanded PO panel now that the "Linked
                            Receivers" cards section below was removed —
                            no more empty grey strip under the last row. */}
                        <div className="mt-4 -mx-4 -mb-4 border-t border-gray-100 bg-white overflow-hidden rounded-b-xl">
                          <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-400 tracking-widest">All PO Line Items</p>
                            <span className="text-[9px] font-medium text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100">
                              {selectedItemsInPO} / {po.items.length} Selected
                            </span>
                          </div>
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-gray-50/80 border-b border-gray-100 text-slate-500 text-[11px]" style={{ fontWeight: 500 }}>
                              <tr>
                                <th className="pl-6 pr-4 py-3 w-10">
                                  <Checkbox
                                    checked={poCheckboxState}
                                    onCheckedChange={() => onTogglePO(poKey, vendor, po)}
                                    disabled={displayStatus === 'Fully Invoiced' || isFlowLocked}
                                  />
                                </th>
                                <th className="px-4 py-3 min-w-[220px]">Items</th>
                                <th className="px-4 py-3 text-right">Ordered Qty</th>
                                <th className="px-4 py-3 text-right">Received Qty</th>
                                <th className="px-4 py-3 text-right bg-success/[0.08] text-success">Invoiced Qty / Amt</th>
                                <th className="px-4 py-3 text-right">PO Price per Unit</th>
                                {flowKind === 'pre' ? (
                                  <th className="px-4 py-3 text-right bg-violet-50/60 text-violet-600">Unreceived Qty</th>
                                ) : (
                                  <th className="px-4 py-3 text-right bg-warning/[0.08] text-warning">Remaining Qty</th>
                                )}
                                <th className="px-4 py-3 pr-6">Linked Documents</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {Array.from(new Map(po.items.map(i => [i.sku, i])).values()).filter(item => {
                                // "Show only matched" (default ON) hard-filters by the
                                // item query; OFF shows everything highlighted. Selected
                                // rows are ALWAYS visible — a selection can never hide
                                // behind a filter (design review 7/9/26).
                                if (selectedItemIds.has(item.id)) return true;
                                if (!showOnlyMatched) return true;
                                const passesSearch = !itemSearch.trim() ||
                                              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) ||
                                              item.description.toLowerCase().includes(itemSearch.toLowerCase());
                                return itemFilterMode === 'include' ? passesSearch : !passesSearch;
                              }).map(item => {
                                const isItemSelected = selectedItemIds.has(item.id);
                                const itemGRNs = vendor.receivingDocuments.filter(grn =>
                                  grn.poNumber === po.poNumber &&
                                  grn.items.some(gi => gi.sku === item.sku)
                                );

                                const isFullyInvoiced = (item.invoicedQty || 0) >= item.quantity;
                                const isPartiallyInvoiced = (item.invoicedQty || 0) > 0 && !isFullyInvoiced;
                                const prevInvoicedAmt = (item.invoicedQty || 0) * item.unitPrice;
                                // Flow-ineligible line (9/4/26 split): the
                                // OTHER side of this line's story. Visible,
                                // permanently greyed, hover explains — the
                                // copy is the entire affordance (BB-05).
                                const isFlowIneligible = !!flowKind && !lineEligible(item, flowKind) && !isFullyInvoiced;
                                // PO line items already on the host invoice
                                // render as indeterminate checkboxes (NOT
                                // disabled) so the user can re-select the
                                // row and pick up its full quantity for
                                // the current draft.
                                const isItemAlreadyOnInvoice = excludedPOItemIds.has(item.id) && !isItemSelected;
                                const itemCheckboxState: boolean | "indeterminate" =
                                  isItemSelected ? true : (isItemAlreadyOnInvoice ? "indeterminate" : false);

                                return (
                                  <tr
                                    key={item.id}
                                    // Cursor-follow tip on the whole ROW
                                    // (user 9/22): a fully invoiced line
                                    // explains itself wherever you hover,
                                    // not only on its checkbox — same
                                    // recipe as the locked PO/GRN cards.
                                    {...lockTipHandlers(
                                      isFullyInvoiced,
                                      <>
                                        <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Fully invoiced</p>
                                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This line's full quantity is on earlier invoices.</p>
                                      </>,
                                    )}
                                    className={`transition-colors ${isItemSelected ? 'bg-blue-50/50' : isFullyInvoiced ? 'bg-slate-50/60 opacity-60' : isFlowIneligible ? 'bg-slate-50/60 opacity-60' : isItemAlreadyOnInvoice ? 'bg-blue-50/20' : 'hover:bg-gray-50/50'}`}>
                                    <td className="pl-6 pr-4 py-3">
                                      {isFlowIneligible ? (
                                        <Tooltip delayDuration={150}>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center cursor-not-allowed">
                                              <Checkbox checked={false} disabled className="pointer-events-none" />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                            {flowKind === 'pre' ? (
                                              <>
                                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Fully received</p>
                                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This line is fully received. Its billing belongs on an inventory invoice.</p>
                                              </>
                                            ) : (
                                              <>
                                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>{UNRECEIVED_LINE_LOCK.title}</p>
                                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{UNRECEIVED_LINE_LOCK.body}</p>
                                              </>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : isItemAlreadyOnInvoice ? (
                                        <Tooltip delayDuration={150}>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center cursor-pointer">
                                              <Checkbox
                                                checked={itemCheckboxState}
                                                onCheckedChange={() => onToggleItem(item, poKey, po, vendor)}
                                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-white"
                                              />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Partially on this invoice</p>
                                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Some of this item's quantity is already on the invoice you're editing. Click to also add the full line. The existing portion stays put and the new quantity is appended.</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : isFullyInvoiced ? (
                                        /* Fully invoiced line inside a
                                           still-open PO (user 9/22): the
                                           lock explains itself on hover,
                                           matching every other greyed
                                           row in this picker. */
                                        <Tooltip delayDuration={150}>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center cursor-not-allowed">
                                              <Checkbox checked={false} disabled className="pointer-events-none" />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Fully invoiced</p>
                                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This line's full quantity is on earlier invoices.</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Checkbox
                                          checked={itemCheckboxState}
                                          onCheckedChange={() => onToggleItem(item, poKey, po, vendor)}
                                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <ItemImageWithPreview
                                          sku={item.sku}
                                          src={imageForSku(item.sku)}
                                          alt={item.sku}
                                          onPreview={() => setPreviewImage({ src: imageForSku(item.sku), alt: item.sku, sku: item.sku, vendorName: (vendor as any).displayName })}
                                          size={36}
                                          disabled={quickViewOpen}
                                        />
                                        {/* contain:inline-size keeps this block's
                                            intrinsic width OUT of the table's column
                                            math (the 240px floor is the same driver
                                            the old fixed-cap description gave it), so
                                            columns land exactly where they always did
                                            while the description visually fills the
                                            cell's real width. */}
                                        <div className="flex-1 min-w-[240px] [contain:inline-size]">
                                          <a
                                            href={ITEMS_MODULE_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="font-semibold text-gray-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors inline-block"
                                          >
                                            {highlightText(item.sku, itemSearch)}
                                          </a>
                                          <ItemDescriptionWithToggle
                                            description={longDescriptionFor(item.sku, item.description)}
                                            highlightText={highlightText}
                                            itemSearch={itemSearch}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="font-semibold text-gray-900">{item.quantity} {item.uom}</div>
                                      <div className="text-[10px] font-medium text-gray-500">{formatMoney(item.quantity * item.unitPrice, vendor.currency)}</div>
                                    </td>
                                    {/* Received Qty — BA UX feedback. Lights up
                                        red when received exceeds ordered (over-
                                        receipt edge case) or when invoiced
                                        exceeds received. Otherwise muted text. */}
                                    {(() => {
                                      const receivedQty = item.receivedQty || 0;
                                      const overReceived = receivedQty > item.quantity;
                                      const billOverReceived = (item.invoicedQty || 0) > receivedQty;
                                      const tone = overReceived || billOverReceived ? 'text-destructive' : receivedQty > 0 ? 'text-gray-900' : 'text-gray-400';
                                      return (
                                        <td className="px-4 py-3 text-right">
                                          <div className={`font-semibold ${tone}`}>
                                            {receivedQty} {item.uom}
                                          </div>
                                          <div className="text-[10px] text-gray-500" style={{ fontWeight: 500 }}>
                                            of {item.quantity} ordered
                                          </div>
                                        </td>
                                      );
                                    })()}
                                    <td className="px-4 py-3 text-right bg-success/[0.04]">
                                      <div className="flex flex-col items-end">
                                        <span className={`font-bold ${isFullyInvoiced ? 'text-success' : isPartiallyInvoiced ? 'text-success/80' : 'text-gray-400'}`}>
                                          {item.invoicedQty || 0} {item.uom}
                                        </span>
                                        <span className={`text-[10px] font-semibold ${prevInvoicedAmt > 0 ? 'text-success/70' : 'text-gray-300'}`}>{formatMoney(prevInvoicedAmt, vendor.currency)}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="font-semibold text-gray-900">{formatMoney(item.unitPrice, vendor.currency)}</div>
                                      <div className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>per {item.uom}</div>
                                    </td>
                                    {/* Remaining Qty — quantity only (per BA:
                                        a $ balance amalgamates mixed-price
                                        receipts and reads like a real
                                        invoice figure). In the PRE flow the
                                        column shows the unreceived remainder
                                        (violet, 9/4/26): the portion this
                                        pre-invoice can cover. */}
                                    {flowKind === 'pre' ? (
                                      <td className="px-4 py-3 text-right bg-violet-50/40">
                                        <div className="font-bold text-violet-600">{preEligibleQty(item)} {item.uom}</div>
                                        <div className="text-[10px] font-medium text-gray-500">Not Yet Received</div>
                                      </td>
                                    ) : (
                                      <td className="px-4 py-3 text-right bg-warning/[0.04]">
                                        <div className="font-bold text-warning">{item.quantity - (item.invoicedQty || 0)} {item.uom}</div>
                                        <div className="text-[10px] font-medium text-gray-500">of {item.quantity} {item.uom}</div>
                                      </td>
                                    )}
                                    <td className="px-4 py-3 pr-6">
                                      {/* Linked Documents — decision tree
                                          aligned with PO state. Clicking a
                                          chip routes to the Receivers tab
                                          and expands the target GRN
                                          (handleDocumentClick). */}
                                      {/* Pre flow: the Receivings tab is hidden,
                                          so the GRN chips (which navigate there)
                                          don't render either. */}
                                      {flowKind === 'pre' || isPreInvoiceEligible || itemGRNs.length === 0 ? null : (
                                        <div className="flex flex-wrap gap-1">
                                          {/* Compress to a single chip + "+N more"
                                              when there are multiple linked
                                              receivers. Per BA UX feedback — the
                                              old recipe surfaced 2 chips inline
                                              which crowded the row at narrow
                                              widths. */}
                                          {itemGRNs.slice(0, 1).map(grn => (
                                            <button
                                              key={grn.grnNumber}
                                              onClick={(e) => handleDocumentClick(e, poKey, grn.grnNumber)}
                                              className="text-[9px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors cursor-pointer"
                                            >
                                              <Package className="w-2.5 h-2.5" />
                                              {grn.grnNumber}
                                            </button>
                                          ))}
                                          {itemGRNs.length > 1 && (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 cursor-help">
                                                  + {itemGRNs.length - 1} more
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent className="p-2 bg-white border border-gray-200 shadow-xl rounded-xl z-[60]">
                                                <div className="space-y-1.5">
                                                  <p className="text-[10px] font-bold text-gray-400 tracking-widest px-1">Additional Documents</p>
                                                  <div className="flex flex-col gap-1">
                                                    {itemGRNs.slice(1).map(grn => (
                                                      <button
                                                        key={grn.grnNumber}
                                                        onClick={(e) => handleDocumentClick(e, poKey, grn.grnNumber)}
                                                        className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded text-[10px] font-semibold text-gray-700 transition-colors group/tool"
                                                      >
                                                        <Package className="w-3 h-3 text-gray-400 group-hover/tool:text-blue-500" />
                                                        <span>{grn.grnNumber}</span>
                                                        <ChevronRight className="w-2.5 h-2.5 ml-auto text-gray-300" />
                                                      </button>
                                                    ))}
                                                  </div>
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Linked Receivers cards section removed — the
                            per-item Linked Documents chips already give
                            the user a way to jump into a specific GRN on
                            the Receivers tab. Keeping the cards here too
                            duplicated the Receivers tab inline. */}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          ) : (
                                    <div className="space-y-3 border-l-2 border-blue-100 pl-4 py-2">
              {vendor.receivingDocuments.map((grn) => {
                const poKey = `${vendor.vendorCode}-${grn.poNumber}`;
                const po = vendor.purchaseOrders.find(p => p.poNumber === grn.poNumber);
                if (!po) return null;

                // Tri-state: derive from item selection so it stays in sync with the PO tab
                const grnSelectedCount = grn.items.filter(item => selectedGRNItems.has(`${grn.grnNumber}:${item.id}`)).length;
                const isGRNFullySelected = grn.items.length > 0 && grnSelectedCount === grn.items.length;
                const isGRNIndeterminate = grnSelectedCount > 0 && grnSelectedCount < grn.items.length;
                const isGRNSelected = grnSelectedCount > 0;
                const grnCheckboxState: boolean | "indeterminate" = isGRNFullySelected ? true : (isGRNIndeterminate ? "indeterminate" : false);
                const isGRNExpanded = expandedGRNs.has(`${poKey}-${grn.grnNumber}`);
                const grnTotalAmt = grn.items.reduce((sum, i) => sum + i.totalPrice, 0);
                // Fully-invoiced receivers can't be added to a new invoice
                // (every quantity is already billed). Card stays white at
                // rest but tints grey on hover + when expanded so the
                // user feels the "locked" affordance without it looking
                // disabled outright.
                const isGRNFullyInvoiced = grn.status === 'Fully Invoiced';
                // Receivers already on the host invoice (add-more flow)
                // share the locked treatment but with different tooltip
                // copy so the user knows why.
                const isGRNAlreadyOnInvoice = excludedGRNs.has(grn.grnNumber);
                const isGRNLocked = isGRNFullyInvoiced || isGRNAlreadyOnInvoice;
                // Shared by the cursor-follow tip over the whole locked
                // card (9/2/26) — same recipe as the locked PO cards.
                const grnLockedReason = isGRNAlreadyOnInvoice ? (
                  <>
                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Already on this invoice</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This receiving is already part of the invoice you're editing, so it can't be re-added.</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Fully invoiced</p>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Every item in this receiving has already been billed on an earlier invoice, so it can't be added here again.</p>
                  </>
                );

                return (
                  <div
                    key={grn.grnNumber}
                    id={`grn-${grn.grnNumber}`}
                    {...lockTipHandlers(isGRNLocked, grnLockedReason)}
                    className={`rounded-xl border transition-all ${
                    isGRNSelected
                      ? 'border-blue-300 bg-blue-50/50 shadow-sm'
                      : isGRNLocked
                        // Locked recipe (8/31/26): near-white card, colour
                        // drains from the content, own hover — matching
                        // the locked PO cards. FULLY INVOICED receivers
                        // wear GREEN instead (BA 9/7): still disabled, but
                        // the tint says "done" — grey read as broken/mixed.
                        ? isGRNFullyInvoiced
                          ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50/80 hover:border-emerald-300'
                          : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-300'
                        : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                  }`}>
                    {/* Locked receivers explain themselves via the
                        cursor-follow tip on the card wrapper (9/2/26) —
                        the old header-anchored tooltip floated over the
                        neighbouring row. */}
                    {isGRNLocked ? (
                    <div
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer group"
                      onClick={() => onToggleGRNExpand(`${poKey}-${grn.grnNumber}`)}
                    >
                      <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded transition-all ${
                        isGRNExpanded ? 'bg-accent text-primary shadow-sm' : 'text-muted-foreground group-hover:bg-muted'
                      }`}>
                        {isGRNExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>

                      <div onClick={(e) => e.stopPropagation()} className="flex items-center px-1">
                        {isGRNLocked ? (
                          /* Single-tooltip rule (8/31/26): the header wrap
                             carries the reason; the checkbox stays quiet. */
                          <span className="inline-flex items-center cursor-not-allowed">
                            <Checkbox
                              checked={grnCheckboxState}
                              disabled
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
                            />
                          </span>
                        ) : (
                          <Checkbox
                            checked={grnCheckboxState}
                            onCheckedChange={() => onToggleGRNSelection(grn.grnNumber, poKey, po, grn)}
                            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        )}
                      </div>
                      
                      <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center transition-all ${isGRNFullyInvoiced ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200/80 text-slate-400'}`}>
                        <Package className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-[13px] transition-colors ${isGRNFullyInvoiced ? 'text-emerald-800/80' : 'text-slate-400'}`}>
                              {highlightText(grn.grnNumber, grnSearch)}
                            </span>
                            {/* Colour drains while locked — except FULLY
                                INVOICED (BA 9/7), whose pill keeps its
                                green "done" identity. */}
                            <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-sm border ${isGRNFullyInvoiced ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                              {grn.status === 'Fully Invoiced' ? 'Fully Invoiced' : grn.status === 'Partially Invoiced' ? 'Partially Invoiced' : 'Not Invoiced'}
                            </span>
                            {/* Prepaid pill + story tooltip (9/3/26): same
                                treatment as the PO cards; the strip that
                                grew the card is gone. */}
                            {prepaidPOContext?.[grn.poNumber] && (() => {
                              const ctx = prepaidPOContext[grn.poNumber];
                              return (
                                <Tooltip delayDuration={150}>
                                  <TooltipTrigger asChild>
                                    <span className="text-[9px] font-bold px-1.5 py-0.25 rounded-sm border bg-violet-50 text-violet-700 border-violet-200 cursor-help">
                                      {`Prepaid · ${formatMoney(ctx.amount, vendor.currency)}`}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[290px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Prepaid on this PO</p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5 ">
                                      <span className="text-violet-700" style={{ fontWeight: 600 }}>{ctx.preInvoiceNumber}</span> already paid{' '}
                                      <span className="text-violet-700" style={{ fontWeight: 600 }}>{formatMoney(ctx.amount, vendor.currency)}</span> against PO-{grn.poNumber}. It's applied automatically when you invoice this receiving.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                          </div>
                          <div className={`flex items-center gap-2 mt-0.5 text-[10px] font-medium ${isGRNFullyInvoiced ? 'text-emerald-700/70' : 'text-gray-500'}`}>
                            <span
                              className={`flex items-center gap-1 font-bold hover:text-blue-600 hover:underline transition-colors cursor-pointer ${isGRNFullyInvoiced ? 'text-emerald-700' : 'text-gray-500'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('pos');
                              }}
                            >
                              <ShoppingCart className="w-3 h-3" />
                              <span className={isGRNFullyInvoiced ? 'text-emerald-600/60' : 'text-gray-400'}>PO No.</span> {grn.poNumber}
                            </span>
                            <span className={`font-normal ${isGRNFullyInvoiced ? 'text-emerald-300' : 'text-gray-300'}`}>•</span>
                            <span className={isGRNFullyInvoiced ? 'text-emerald-600/70' : 'text-gray-400'}><span className={`font-bold ${isGRNFullyInvoiced ? 'text-emerald-700' : 'text-gray-500'}`}>{grn.items.length}</span> {grn.items.length === 1 ? 'item' : 'items'}</span>
                            <span className={`font-normal ${isGRNFullyInvoiced ? 'text-emerald-300' : 'text-gray-300'}`}>•</span>
                            <span className={isGRNFullyInvoiced ? 'text-emerald-600/70' : 'text-gray-400'}>{grn.grnDate}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-0.5 px-2">
                          {/* Fully invoiced keeps its green identity on the
                              numbers too (BA 9/7) — grey read odd inside
                              the emerald card. */}
                          <div className={`text-[14px] font-bold ${isGRNFullyInvoiced ? 'text-emerald-700' : 'text-slate-400'}`}>
                            <MoneyOnDates value={grnTotalAmt} currency={po.currency ?? vendor.currency} poDate={po.poDate} receivingDate={grn.grnDate} />
                          </div>
                          <span className={`text-[8px] font-bold ${isGRNFullyInvoiced ? 'text-emerald-600/70' : 'text-gray-400'}`}>Receiving Value</span>
                        </div>
                      </div>
                    </div>
                    ) : (
                    <div
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer group"
                      onClick={() => onToggleGRNExpand(`${poKey}-${grn.grnNumber}`)}
                    >
                      <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded transition-all ${
                        isGRNExpanded ? 'bg-accent text-primary shadow-sm' : 'text-muted-foreground group-hover:bg-muted'
                      }`}>
                        {isGRNExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </div>

                      <div onClick={(e) => e.stopPropagation()} className="flex items-center px-1">
                        <Checkbox
                          checked={grnCheckboxState}
                          onCheckedChange={() => onToggleGRNSelection(grn.grnNumber, poKey, po, grn)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>

                      <div className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center transition-all ${
                        isGRNSelected
                          ? 'bg-accent text-primary shadow-sm'
                          : 'bg-gray-100 text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                      }`}>
                        <Package className="w-3.5 h-3.5" />
                      </div>

                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[13px] text-gray-900 group-hover:text-blue-600 transition-colors">
                              {highlightText(grn.grnNumber, grnSearch)}
                            </span>
                            {(() => {
                              let statusLabel = 'Not Invoiced';
                              let statusStyles = 'bg-gray-50 text-gray-500 border-gray-200';
                              if (grn.status === 'Fully Invoiced') {
                                statusLabel = 'Fully Invoiced';
                                statusStyles = 'bg-green-50 text-green-700 border-green-200';
                              } else if (grn.status === 'Partially Invoiced') {
                                statusLabel = 'Partially Invoiced';
                                statusStyles = 'bg-purple-50 text-purple-700 border-purple-200';
                              } else {
                                statusLabel = 'Not Invoiced';
                                statusStyles = 'bg-gray-50 text-gray-500 border-gray-200';
                              }
                              return (
                                <span className={`text-[9px] font-bold px-1.5 py-0.25 rounded-sm border ${statusStyles}`}>
                                  {statusLabel}
                                </span>
                              );
                            })()}
                            {/* Prepaid pill + story tooltip (9/3/26): same
                                treatment as the PO cards; the strip that
                                grew the card is gone. */}
                            {prepaidPOContext?.[grn.poNumber] && (() => {
                              const ctx = prepaidPOContext[grn.poNumber];
                              return (
                                <Tooltip delayDuration={150}>
                                  <TooltipTrigger asChild>
                                    <span className="text-[9px] font-bold px-1.5 py-0.25 rounded-sm border bg-violet-50 text-violet-700 border-violet-200 cursor-help">
                                      {`Prepaid · ${formatMoney(ctx.amount, vendor.currency)}`}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[290px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                    <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Prepaid on this PO</p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5 ">
                                      <span className="text-violet-700" style={{ fontWeight: 600 }}>{ctx.preInvoiceNumber}</span> already paid{' '}
                                      <span className="text-violet-700" style={{ fontWeight: 600 }}>{formatMoney(ctx.amount, vendor.currency)}</span> against PO-{grn.poNumber}. It's applied automatically when you invoice this receiving.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-medium text-gray-500">
                            <span
                              className="flex items-center gap-1 font-bold text-gray-500 hover:text-blue-600 hover:underline transition-colors cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('pos');
                              }}
                            >
                              <ShoppingCart className="w-3 h-3" />
                              <span className="text-gray-400">PO No.</span> {grn.poNumber}
                            </span>
                            <span className="text-gray-300 font-normal">•</span>
                            <span className="text-gray-400"><span className="font-bold text-gray-500">{grn.items.length}</span> {grn.items.length === 1 ? 'item' : 'items'}</span>
                            <span className="text-gray-300 font-normal">•</span>
                            <span className="text-gray-400">{grn.grnDate}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-0.5 px-2">
                          <div className="text-[14px] font-bold text-gray-900">
                            {/* The PO date, the receiving date and today (Currency & Exchange Rates). */}
                            <MoneyOnDates value={grnTotalAmt} currency={po.currency ?? vendor.currency} poDate={po.poDate} receivingDate={grn.grnDate} />
                          </div>
                          <span className="text-[8px] text-gray-400 font-bold">Receiving Value</span>
                        </div>
                      </div>
                    </div>
                    )}

                    {isGRNExpanded && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="border-t border-gray-100 bg-white -mx-4 -mb-4 rounded-b-xl overflow-hidden">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-gray-50/80 border-b border-gray-100 text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                              <tr>
                                <th className="px-4 py-3 w-10">
                                  <Checkbox
                                    checked={grnCheckboxState}
                                    onCheckedChange={() => onToggleGRNSelection(grn.grnNumber, poKey, po, grn)}
                                    disabled={grn.status === 'Fully Invoiced'}
                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                </th>
                                <th className="px-4 py-3 min-w-[220px]">Items</th>
                                <th className="px-4 py-3 text-right">PO Price per Unit</th>
                                <th className="px-4 py-3 text-right">Received</th>
                                <th className="px-4 py-3 text-right bg-success/[0.08] text-success">Invoiced</th>
                                <th className="px-4 py-3 text-right bg-warning/[0.08] text-warning">Remaining</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {Array.from(new Map(grn.items.map(i => [i.sku, i])).values()).filter(item => {
                                // Same rules as the PO table: selected rows are always
                                // visible; "Show only matched" gates the hard filter.
                                if (selectedGRNItems.has(`${grn.grnNumber}:${item.id}`)) return true;
                                if (!showOnlyMatched) return true;
                                const passesSearch = !itemSearch.trim() ||
                                              item.sku.toLowerCase().includes(itemSearch.toLowerCase()) ||
                                              item.description.toLowerCase().includes(itemSearch.toLowerCase());
                                return itemFilterMode === 'include' ? passesSearch : !passesSearch;
                              }).map((item, idx) => {
                                const isItemSelected = selectedGRNItems.has(`${grn.grnNumber}:${item.id}`);
                                const remainingQty = item.quantity - (item.invoicedQty || 0);
                                const invoicedValue = (item.invoicedQty || 0) * item.unitPrice;
                                // Items that are part of the host invoice
                                // already (add-more flow) lock with the
                                // same disabled treatment as fully-invoiced.
                                const isItemAlreadyOnInvoice = excludedGRNItems.has(`${grn.grnNumber}:${item.id}`);
                                // Line-level lock (user 9/22): a receiving
                                // line billed in full greys out even while
                                // the document itself is still partially
                                // invoiced — same rule as the PO tab.
                                const isLineFullyInvoiced = (item.invoicedQty || 0) >= item.quantity;
                                const isItemLocked = grn.status === 'Fully Invoiced' || isLineFullyInvoiced || isItemAlreadyOnInvoice;

                                return (
                                  <tr
                                    key={idx}
                                    // Row-level cursor-follow tip (user
                                    // 9/22): a fully billed line inside a
                                    // still-open receiving explains itself
                                    // wherever you hover. Whole-document
                                    // locks keep the card wrapper's tip.
                                    {...lockTipHandlers(
                                      isLineFullyInvoiced && !isItemAlreadyOnInvoice && grn.status !== 'Fully Invoiced',
                                      <>
                                        <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Fully invoiced</p>
                                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This line's full quantity is on earlier invoices.</p>
                                      </>,
                                    )}
                                    className={`transition-colors ${isItemSelected ? 'bg-blue-50/50' : isItemLocked ? 'bg-slate-50/40 opacity-70' : 'hover:bg-gray-50/50'}`}>
                                    <td className="px-4 py-3">
                                      {isItemLocked ? (
                                        <Tooltip delayDuration={150}>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center cursor-not-allowed">
                                              <Checkbox
                                                checked={isItemSelected}
                                                disabled
                                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
                                              />
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                            {isItemAlreadyOnInvoice ? (
                                              <>
                                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Already on this invoice</p>
                                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This item is already part of the invoice you're editing.</p>
                                              </>
                                            ) : (
                                              <>
                                                <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Fully invoiced</p>
                                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This line's full quantity is on earlier invoices.</p>
                                              </>
                                            )}
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Checkbox
                                          checked={isItemSelected}
                                          onCheckedChange={() => onToggleGRNItem(item, grn, po, poKey)}
                                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        <ItemImageWithPreview
                                          sku={item.sku}
                                          src={imageForSku(item.sku)}
                                          alt={item.sku}
                                          onPreview={() => setPreviewImage({ src: imageForSku(item.sku), alt: item.sku, sku: item.sku, vendorName: (vendor as any).displayName })}
                                          size={36}
                                          disabled={quickViewOpen}
                                        />
                                        {/* contain:inline-size keeps this block's
                                            intrinsic width OUT of the table's column
                                            math (the 240px floor is the same driver
                                            the old fixed-cap description gave it), so
                                            columns land exactly where they always did
                                            while the description visually fills the
                                            cell's real width. */}
                                        <div className="flex-1 min-w-[240px] [contain:inline-size]">
                                          <a
                                            href={ITEMS_MODULE_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="font-semibold text-gray-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors inline-block"
                                          >
                                            {highlightText(item.sku, itemSearch)}
                                          </a>
                                          <ItemDescriptionWithToggle
                                            description={longDescriptionFor(item.sku, item.description)}
                                            highlightText={highlightText}
                                            itemSearch={itemSearch}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="font-semibold text-gray-900">{formatMoney(item.unitPrice, vendor.currency)}</div>
                                      <div className="text-[10px] text-slate-400" style={{ fontWeight: 500 }}>per {item.uom}</div>
                                    </td>
                                    {/* Received, quantity only (per BA). */}
                                    <td className="px-4 py-3 text-right">
                                      <div className="font-semibold text-gray-900">{item.quantity} {item.uom}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right bg-success/[0.04]">
                                      <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-success">{item.invoicedQty || 0} {item.uom}</span>
                                          {(item.invoicedQty || 0) > 0 && (
                                            <HoverCard openDelay={300}>
                                              <HoverCardTrigger asChild>
                                                <Info className="w-3 h-3 text-success/70 cursor-help" />
                                              </HoverCardTrigger>
                                              <HoverCardContent side="top" className="w-64 p-3 bg-white border border-success/20 shadow-xl rounded-xl z-[60]">
                                                <div className="space-y-2 text-left">
                                                  <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-bold text-success tracking-widest">Linked Invoices</span>
                                                    <span className="text-[9px] font-semibold text-gray-400">Total: {formatMoney(invoicedValue, vendor.currency)}</span>
                                                  </div>
                                                  <div className="space-y-1">
                                                    <div className="flex items-center justify-between border-b border-gray-50 pb-1">
                                                      <span className="text-[10px] font-semibold text-gray-900">PINV-001-V001</span>
                                                      <span className="text-[10px] font-bold text-success">{formatMoney(invoicedValue, vendor.currency)}</span>
                                                    </div>
                                                  </div>
                                                  <p className="text-[10px] text-gray-500 font-medium">This quantity has already been recorded in preceding invoices.</p>
                                                </div>
                                              </HoverCardContent>
                                            </HoverCard>
                                          )}
                                        </div>
                                        <div className="text-[10px] font-semibold text-success/70">{formatMoney(invoicedValue, vendor.currency)}</div>
                                      </div>
                                    </td>
                                    {/* Remaining, quantity only (per BA). */}
                                    <td className="px-4 py-3 text-right bg-warning/[0.04]">
                                      <div className="font-bold text-warning">{remainingQty} {item.uom}</div>
                                      <div className="text-[10px] font-medium text-gray-500">of {item.quantity} {item.uom}</div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CollapseReveal>

    </div>
  );
}
