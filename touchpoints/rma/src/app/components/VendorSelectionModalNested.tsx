import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, ChevronRight, ChevronDown, ChevronUp, ChevronLeft, Minimize2, ShoppingCart, Package, Building2, AlertTriangle, Filter, Calendar, User, Tag, CheckCircle2, Info, Receipt, Layers, Star, ZoomIn, ExternalLink, ArrowUpDown, DollarSign, Hash, Check } from 'lucide-react';
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
import { mockVendors, Vendor, VendorPO, VendorGRN, LineItem } from '@/app/data/mockVendors';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import type { DateRange } from 'react-day-picker';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import {
  ITEMS_MODULE_URL,
  imageForSku,
  mockItemDataFull,
  photosForSku,
  formatCurrency,
} from '@/app/components/VendorSelectionItemCell';
import {
  HeaderStat,
  SourceGroupRow,
  SourceRows,
  GroupItemRow,
} from '@/app/components/VendorSelectionSourceGroups';
import {
  buildSourceGroups,
  buildVendorSources,
  isSourceSelected,
  type ItemSource,
  type SelectionGroupBy,
} from '@/app/components/vendorSelectionModel';

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
  /** Which surface is using the picker. Drives the header title/subtitle
   *  and column labels so the same nested picker reads naturally for the
   *  Vendor Returns (RMA) create flow — "Invoiced Qty"
   *  becomes "Already Returned", the tab label swaps, etc. Defaults to
   *  'invoice' so every existing caller keeps its current chrome. */
  variant?: 'invoice' | 'rma';
  /** Whether the picker is starting a new document or adding to one that
   *  already exists. Only the header copy differs, since the user opening
   *  it from "Add more items" is not creating anything. */
  purpose?: 'create' | 'add';
}

// Vocabulary + label bundle by variant. Isolated so the render sites
// stay uncluttered — every string that surfaces to the user reads from
// LABELS[variant] instead of a literal.
const LABELS = {
  invoice: {
    title: 'Create new inventory invoice',
    subtitle: 'Pick the purchase orders, receiving documents, or line items to invoice.',
    addTitle: 'Add more items',
    addSubtitle: 'Pick additional purchase orders, receiving documents, or line items to add to this invoice.',
    receiversPill: 'Unprocessed',
    posTab: 'POs to invoice',
    remainingSortLabel: 'Most remaining to invoice',
    columnInvoicedQty: 'Invoiced Qty / Amt',
    columnRemainingQty: 'Remaining Qty',
    grnColumnInvoiced: 'Invoiced',
    grnColumnRemaining: 'Remaining',
    // Short form of remainingSortLabel — rendered on the closed sort
    // trigger, where the full phrase would overflow the button.
    remainingSortShort: 'Most remaining',
    multiVendorWarning: 'Multiple vendors selected. You can only create an invoice against a single vendor at a time. Please deselect items from other vendors to continue.',
    recentVendorsHeading: "Vendors you've recently invoiced",
    // Vendor KPI tiles.
    receiversTooltip: "Receiving documents attached to this vendor that haven't been turned into an invoice yet. Click to expand the vendor and select them.",
    posTooltip: 'Purchase orders with outstanding balance that can still be invoiced, items ordered but not fully billed yet. Click to expand the vendor and review them.',
    // Locked / already-picked PO row.
    poAlreadyOnTitle: 'Already on this invoice',
    poAlreadyOnBody: "This PO is already part of the invoice you're editing, so it can't be re-added.",
    poLockedBody: "This PO is closed or fully invoiced, so its items can't be added here.",
    preInvoiceAmountLabel: 'Pre-Invoice',
    invoicedAmountLabel: 'Invoiced',
    preInvoiceTooltip: 'Pre-invoicing is active for this PO because no goods have been received yet.',
    // PO line item already partly consumed by the host document.
    itemPartiallyOnTitle: 'Partially on this invoice',
    itemPartiallyOnBody: "Some of this item's quantity is already on the invoice you're editing. Click to also add the full line. The existing portion stays put and the new quantity is appended.",
    // Receiving (GRN) card lock states.
    grnAlreadyOnTitle: 'Already on this invoice',
    grnAlreadyOnBody: "This receiving is already part of the invoice you're editing, so it can't be re-added.",
    grnFullyInvoicedTitle: 'Fully invoiced',
    grnFullyInvoicedBody: "Every item in this receiving has already been billed on an earlier invoice, so it can't be added here again.",
    // Receiving line item lock states.
    grnItemAlreadyOnTitle: 'Already on this invoice',
    grnItemAlreadyOnBody: "This item is already part of the invoice you're editing.",
    grnItemFullyInvoicedTitle: 'Fully invoiced',
    grnItemFullyInvoicedBody: 'This item has already been billed on an earlier invoice.',
    // Status badges (PO header + receiving header).
    statusNotInvoiced: 'Not Invoiced',
    statusFullyInvoiced: 'Fully Invoiced',
    statusPartiallyInvoiced: 'Partially Invoiced',
    // Consumed-quantity hover card on the item table.
    linkedDocsHeading: 'Linked Invoices',
    linkedDocsNote: 'This quantity has already been recorded in preceding invoices.',
    linkedDocsExampleId: 'PINV-001-V001',
    includeClosedTooltip: 'Shows fully-invoiced or cancelled POs alongside open ones. Useful for re-billing or referencing past orders.',
    // Single-vendor lockout tooltip. Prefix only — the vendor name and the
    // trailing "to select another." are appended at the render site.
    lockedOutPrefix: 'You can only invoice one vendor at a time. Clear ',
  },
  rma: {
    title: 'Create New RMA',
    subtitle: 'Search the item, then pick what it goes back against.',
    addTitle: 'Add more items',
    addSubtitle: 'Search additional items to add to this return.',
    receiversPill: 'Receivings',
    posTab: 'POs',
    remainingSortLabel: 'Most available to return',
    columnInvoicedQty: 'Already Returned',
    columnRemainingQty: 'Available to Return',
    grnColumnInvoiced: 'Already Returned',
    grnColumnRemaining: 'Available to Return',
    remainingSortShort: 'Most available to return',
    multiVendorWarning: 'Multiple vendors selected. An RMA can only be raised against one vendor at a time. Deselect items from other vendors to continue.',
    recentVendorsHeading: "Vendors you've recently returned to",
    receiversTooltip: 'Receiving documents attached to this vendor. Click to view receiving.',
    posTooltip: 'Purchase orders with received goods that can still be returned. Click to view purchase orders.',
    poAlreadyOnTitle: 'Already on this RMA',
    poAlreadyOnBody: "This PO is already part of the RMA you're editing, so it can't be re-added.",
    poLockedBody: "This PO is closed or fully returned, so its items can't be added here.",
    preInvoiceAmountLabel: 'Not received',
    invoicedAmountLabel: 'Returned',
    preInvoiceTooltip: 'No goods have been received against this PO yet, so there is nothing to return.',
    itemPartiallyOnTitle: 'Partially on this RMA',
    itemPartiallyOnBody: "Some of this item's quantity is already on the RMA you're editing. Click to add the full line; the existing portion stays put.",
    grnAlreadyOnTitle: 'Already on this RMA',
    grnAlreadyOnBody: "This receiving is already part of the RMA you're editing, so it can't be re-added.",
    grnFullyInvoicedTitle: 'Fully returned',
    grnFullyInvoicedBody: "Every item in this receiving has already been returned on an earlier RMA, so it can't be added here again.",
    grnItemAlreadyOnTitle: 'Already on this RMA',
    grnItemAlreadyOnBody: "This item is already part of the RMA you're editing.",
    grnItemFullyInvoicedTitle: 'Fully returned',
    grnItemFullyInvoicedBody: 'This item has already been returned on an earlier RMA.',
    statusNotInvoiced: 'Not Returned',
    statusFullyInvoiced: 'Fully Returned',
    statusPartiallyInvoiced: 'Partially Returned',
    linkedDocsHeading: 'Linked RMAs',
    linkedDocsNote: 'This quantity has already been returned on a previous RMA.',
    linkedDocsExampleId: 'RMA-01042',
    includeClosedTooltip: 'Shows fully-returned or cancelled POs alongside open ones. Useful for referencing past orders.',
    lockedOutPrefix: 'An RMA can only cover one vendor at a time. Clear ',
  },
} as const;

// Order matters: the list reads left to right as the order a user is
// expected to reach for these. An item is what a return starts from, the
// vendor is who it goes back to, and the PO or receiving is paperwork the
// user often does not have in hand.
const VIEW_OPTIONS: { key: SelectionGroupBy; label: string; Icon: typeof Tag }[] = [
  { key: 'item', label: 'Item', Icon: Tag },
  { key: 'vendor', label: 'Vendor', Icon: Building2 },
  { key: 'po', label: 'PO', Icon: ShoppingCart },
  { key: 'receiver', label: 'Receiving', Icon: Package },
];

export interface SelectedPOData {
  vendorCode: string;
  vendorName: string;
  vendorCategory: string;
  currency: string;
  paymentTerms: string;
  poNumber: string;
  poDate: string;
  poAmount: number;
  poStatus: string;
  /** Vendor site the PO was placed with. Carried forward so the return can be
   *  grouped and routed by where the goods actually came from. */
  originId: string;
  originName: string;
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
    variant = 'invoice',
    purpose = 'create',
  } = props;
  const labels = LABELS[variant];
  const isRma = variant === 'rma';
  const headerTitle = purpose === 'add' ? labels.addTitle : labels.title;
  const headerSubtitle = purpose === 'add' ? labels.addSubtitle : labels.subtitle;
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
  // NOTE: the excluded* sets below drove the "already on this invoice"
  // locked treatment on the PO / receiver cards. Removing the vendor tabs
  // removed their only consumer, so nothing is locked in the vendor lens
  // right now. They are kept because they encode the rule; re-attach them
  // to the line table when the lock treatment is redesigned.
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
  const [vendorSearch, setVendorSearch] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [grnSearch, setGrnSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');

  // Which entity the results lead with. A return starts from the part
  // being sent back, so the RMA flow opens on items and treats the vendor
  // as an attribute of the source rather than the way in. Invoicing keeps
  // leading with the vendor, which is how that document is raised.
  const [groupBy, setGroupBy] = useState<SelectionGroupBy>(
    variant === 'rma' ? 'item' : 'vendor',
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Set initial expanded vendor if fixedVendorId is provided
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set(fixedVendorId ? [fixedVendorId] : []));
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [expandedGRNs, setExpandedGRNs] = useState<Set<string>>(new Set());
  const [selectedPOs, setSelectedPOs] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedGRNs, setSelectedGRNs] = useState<Set<string>>(new Set());
  // Which receipt a PO line was picked from, when the user named one by
  // ticking it in the Receiving lens. Selection itself is keyed by PO line,
  // because that is what the payload carries, but a PO line can arrive on
  // several receipts -- without this, picking one receipt marks the line and
  // every other receipt holding it lights up too.
  const [receiptByItem, setReceiptByItem] = useState<Map<string, string>>(new Map());
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
    if (!isRma && selectedVendorCount > 1) {
      setShowAlert({ 
        show: true, 
        type: 'warning', 
        msg: labels.multiVendorWarning
      });
    } else {
      setShowAlert(prev => ({ ...prev, show: false }));
    }
  }, [isRma, selectedVendorCount]);

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
  // Default ON (feedback 7/20/26): invoicing almost always starts from
  // goods actually received, so unreceived POs hide until asked for.
  const [showReceivedOnly, setShowReceivedOnly] = useState(true);
  
  // Date Range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // PO number range — supports sequence searches like "PO 1001–1010".
  // Strings (not numbers) so an empty field stays distinguishable from 0,
  // and so the user can paste a partial / leading-zeroed number.
  const [poRangeStart, setPoRangeStart] = useState('');
  const [poRangeEnd, setPoRangeEnd] = useState('');
  // Receiving number range — the same sequence search one level down, for
  // users who know which receipts they are after rather than which POs.
  const [grnRangeStart, setGrnRangeStart] = useState('');
  const [grnRangeEnd, setGrnRangeEnd] = useState('');

  // Result-list sorting — applied to each vendor's POs and Receivers so
  // users can prioritize "oldest receivers" or "highest-value POs" once
  // the search has narrowed the list. Default is newest-first (date desc).
  // `remaining` ranks POs by the un-invoiced value (poAmount − invoiced),
  // which is the most actionable "what should I invoice next" lens.
  const [sortKey, setSortKey] = useState<'date' | 'value' | 'poNumber' | 'remaining'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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







  const toggleItemSelection = (item: LineItem, poKey: string, po: VendorPO, vendor: Vendor) => {
    const newSelectedItemIds = new Set(selectedItemIds);
    const newSelectedPOs = new Set(selectedPOs);
    const newSelectedGRNItems = new Set(selectedGRNItems);
    const newSelectedGRNs = new Set(selectedGRNs);
    
    const isSelecting = !newSelectedItemIds.has(item.id);
    
    if (isSelecting) {
      newSelectedItemIds.add(item.id);
      // Select related GRN items
      vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber).forEach(grn => {
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

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            // Partner search-match highlight — soft amber chip on the matched
            // substring with amber-800 ink. Tight px so it sits flush with
            // adjacent characters; rounded-sm keeps the corners crisp.
            <mark
              key={index}
              className="bg-amber-100 text-amber-900 rounded-sm px-0.5"
              style={{ fontWeight: 'inherit' }}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
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
      // 1. Filter POs by poSearch AND itemSearch AND showClosedPOs AND dateRange AND showReceivedOnly
      // Note: POs already on the host invoice are NOT filtered out --
      // they render in the list with a disabled "Already on invoice"
      // treatment so the user can see them but can't re-pick them.
      const filteredPOs = v.purchaseOrders.filter(po => {
        // ERP Logic: By default hide Closed/Cancelled/Fully-Settled. If toggled, show everything.
        const isPOFullyInvoiced = (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0;
        const isPOFullyReceived = po.status === 'Fully Received' || po.status === 'Fully Invoiced' || po.items.every(item => (item.receivedQty || 0) >= item.quantity);
        const isActuallyClosed = po.status === 'Closed' || po.status === 'Cancelled' || po.status === 'Fully Invoiced' || (isPOFullyReceived && isPOFullyInvoiced);

        if (!showClosedPOs && isActuallyClosed) return false;

        // Received Only logic
        if (showReceivedOnly) {
          const hasGRN = v.receivingDocuments.some(grn => grn.poNumber === po.poNumber);
          if (!hasGRN) return false;
        }

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

        // A receiving is a delivery against an order, so naming one narrows
        // the orders too. Without this the receiving box filtered only the
        // receipt list, and every other lens carried on showing the whole
        // catalogue -- searching a receipt and staying on the item lens
        // returned every item the vendor had ever sold.
        const matchesGRNQueryOnPO = grnSearch.trim()
          ? v.receivingDocuments.some(
              (grn) =>
                grn.poNumber === po.poNumber &&
                grn.grnNumber.toLowerCase().includes(grnSearch.toLowerCase()),
            )
          : true;

        return poSearchFinal && itemSearchFinal && matchesGRNQueryOnPO;
      });

      // 2. Filter GRNs by grnSearch AND itemSearch AND dateRange.
      // Receivers already on the host invoice render with a disabled
      // "Already on invoice" treatment in the row markup (NOT filtered
      // out here) so the user keeps the visual context.
      const filteredGRNs = v.receivingDocuments.filter(grn => {
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

        // Receiving number range — same trailing-sequence rule the PO range
        // uses, so a receipt without parseable digits drops out while a range
        // is active.
        const grnStartNum = grnRangeStart.trim() ? parseInt(grnRangeStart.replace(/[^\d]/g, ''), 10) : NaN;
        const grnEndNum = grnRangeEnd.trim() ? parseInt(grnRangeEnd.replace(/[^\d]/g, ''), 10) : NaN;
        if (!isNaN(grnStartNum) || !isNaN(grnEndNum)) {
          const grnNum = extractPONumeric(grn.grnNumber);
          if (isNaN(grnNum)) return false;
          if (!isNaN(grnStartNum) && grnNum < grnStartNum) return false;
          if (!isNaN(grnEndNum) && grnNum > grnEndNum) return false;
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
      const hasActiveChildSearch = poSearch.trim() || grnSearch.trim() || itemSearch.trim() || startDate || endDate || showReceivedOnly || poRangeStart.trim() || poRangeEnd.trim() || grnRangeStart.trim() || grnRangeEnd.trim();
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
  }, [vendorSearch, poSearch, grnSearch, itemSearch, selectedCreatedBy, selectedPOStatus, selectedType, selectedDate, showClosedPOs, showReceivedOnly, vendorFilterMode, poFilterMode, grnFilterMode, itemFilterMode, startDate, endDate, poRangeStart, poRangeEnd, grnRangeStart, grnRangeEnd, sortKey, sortDir]);

  // Cold-start state — no user input yet. When idle, show a curated 10
  // "Recently used" preview; when the user types anything in any search
  // segment or applies a filter, switch to live filtered results.
  // Search is the only thing the user can now vary, so it alone decides
  // whether the list has left its cold start.
  const hasUserInput =
    vendorSearch.trim().length > 0 ||
    poSearch.trim().length > 0 ||
    grnSearch.trim().length > 0 ||
    itemSearch.trim().length > 0;

  const searchQueryText = vendorSearch || poSearch || grnSearch || itemSearch;

  // Nothing is listed until the user has searched. A cold preview of ten
  // recent rows looked like the answer to a question nobody had asked, and on
  // a return it is the wrong question: the user knows the item in their hand,
  // not which of forty vendors sold it to them. Searching the item is what
  // makes every lens meaningful, because each one is that item's own vendors,
  // orders and receipts rearranged.
  const displayVendors = hasUserInput ? filteredVendors : [];

  // Single-vendor enforcement (BA UX feedback). poKey is formatted
  // `${vendorCode}-${poNumber}` where vendorCode is e.g. `V-00001`.
  // Once any PO is selected, every other vendor row renders as
  // disabled — clicking a non-matching vendor's checkbox or expand
  // chevron is a no-op + tooltip. Clearing all selections re-enables
  // the entire list.
  // A return can be raised against several vendors at once, so nothing locks
  // there; invoicing still commits to the first vendor picked.
  const lockedToVendorCode: string | null = useMemo(() => {
    if (isRma) return null;
    if (selectedPOs.size === 0) return null;
    const first = Array.from(selectedPOs)[0];
    const idx = first.lastIndexOf('-');
    return idx > 0 ? first.slice(0, idx) : null;
  }, [isRma, selectedPOs]);
  // Display name for the lockout tooltip on the greyed-out vendor rows
  // ("Clear Acme Corp to select another.").
  const lockedVendorName = useMemo(
    () =>
      lockedToVendorCode
        ? mockVendors.find((v) => v.vendorCode === lockedToVendorCode)?.vendorName ?? null
        : null,
    [lockedToVendorCode],
  );

  // The same filtered rows, rearranged under whichever entity leads. Built
  // off filteredVendors so every filter, search and sort already applied to
  // the vendor list carries over untouched. The idle cap lands on the
  // groups rather than the vendors behind them, because the group is what
  // the user is scanning now.
  const sourceGroups = useMemo(
    () =>
      groupBy === 'vendor'
        ? []
        : buildSourceGroups(filteredVendors, groupBy, sortKey, sortDir, lockedToVendorCode, itemSearch),
    [groupBy, filteredVendors, sortKey, sortDir, lockedToVendorCode, itemSearch],
  );
  const displayGroups = hasUserInput ? sourceGroups : [];

  const hasResults =
    groupBy === 'vendor' ? displayVendors.length > 0 : displayGroups.length > 0;

  // The return flow leads with the item, so its box is the one the eye
  // lands on first; invoicing is still raised against a vendor and keeps
  // that segment in front.
  const searchSegments = useMemo(() => {
    const vendorLocked = !!fixedVendorId;
    const item = { key: 'item', Icon: Tag, placeholder: 'Search items...', value: itemSearch, onChange: setItemSearch, disabled: false };
    const vendor = {
      key: 'vendor',
      Icon: Building2,
      placeholder: vendorLocked ? 'Locked to current vendor' : 'Search vendors...',
      value: vendorLocked ? '' : vendorSearch,
      onChange: setVendorSearch,
      disabled: vendorLocked,
    };
    const po = { key: 'po', Icon: ShoppingCart, placeholder: 'Search POs...', value: poSearch, onChange: setPoSearch, disabled: false };
    const grn = { key: 'grn', Icon: Package, placeholder: 'Search receivings...', value: grnSearch, onChange: setGrnSearch, disabled: false };
    return variant === 'rma' ? [item, vendor, po, grn] : [vendor, po, grn, item];
  }, [variant, fixedVendorId, itemSearch, vendorSearch, poSearch, grnSearch]);

  // Selection stays keyed on the PO line wherever it was picked from, so the
  // payload handed back is identical whichever view it was picked in. The
  // whole set is rebuilt in one pass so a vendor-level pick lands as a single
  // update instead of a run of toggles racing each other.
  const applySourceSelection = (sources: ItemSource[], select: boolean, replace: boolean) => {
    if (sources.length === 0) return;

    const itemIds = new Set(replace ? [] : selectedItemIds);
    // Remember the receipt when the user picked the line from one, so the
    // rebuild below can stay on that receipt instead of fanning out to
    // every receipt carrying the same part.
    const receipts = new Map(replace ? [] : receiptByItem);
    sources.forEach((s) => {
      if (select) {
        itemIds.add(s.poItem.id);
        if (s.grn) receipts.set(s.poItem.id, s.grn.grnNumber);
        else receipts.delete(s.poItem.id);
      } else {
        itemIds.delete(s.poItem.id);
        receipts.delete(s.poItem.id);
      }
    });

    // Rebuilt across every vendor, not just the one being clicked, so a
    // return that spans vendors keeps the paperwork of the ones already
    // picked.
    const pos = new Set<string>();
    const grns = new Set<string>();
    const grnItems = new Set<string>();
    mockVendors.forEach((vendor) => {
      vendor.purchaseOrders.forEach((po) => {
        const picked = po.items.filter((i) => itemIds.has(i.id));
        if (picked.length === 0) return;
        pos.add(`${vendor.vendorCode}-${po.poNumber}`);
        vendor.receivingDocuments
          .filter((grn) => grn.poNumber === po.poNumber)
          .forEach((grn) => {
            grn.items.forEach((grnItem) => {
              const line = picked.find((i) => i.sku === grnItem.sku);
              if (!line) return;
              // A line picked from a named receipt belongs to that receipt
              // alone. Lines picked from the item, PO or vendor lenses name
              // no receipt, so they still take every one that carried them.
              const named = receipts.get(line.id);
              if (named && named !== grn.grnNumber) return;
              grnItems.add(`${grn.grnNumber}:${grnItem.id}`);
              grns.add(grn.grnNumber);
            });
          });
      });
    });

    setSelectedItemIds(itemIds);
    setReceiptByItem(receipts);
    setSelectedPOs(pos);
    setSelectedGRNs(grns);
    setSelectedGRNItems(grnItems);
  };

  // An invoice is raised against one vendor, so picking a different one there
  // replaces the selection. A return can span vendors and never switches.
  const isSwitchingVendor = (source: ItemSource) =>
    !isRma && !!lockedToVendorCode && lockedToVendorCode !== source.vendor.vendorCode;

  const setSourcesSelected = (sources: ItemSource[], select: boolean) => {
    const first = sources[0];
    if (!first) return;
    const switching = isSwitchingVendor(first);
    applySourceSelection(sources, switching || select, switching);
  };

  const toggleSource = (source: ItemSource) => {
    const switching = isSwitchingVendor(source);
    applySourceSelection(
      [source],
      switching || !isSourceSelected(source, selectedItemIds, receiptByItem),
      switching,
    );
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Naming an item has already answered "which one", so the groups open on
  // the sources — the choice the user still has to make.
  useEffect(() => {
    if (groupBy === 'vendor') return;
    // Open the groups only when the search names something the lens does not
    // already lead with. Searching a receipt while looking at items has to
    // reach down to that receipt, or the match sits inside a closed row. But
    // searching an item while looking at items has already put the answer on
    // screen -- opening every one of them then buries the list it just found.
    const ownQuery =
      groupBy === 'item' ? itemSearch : groupBy === 'po' ? poSearch : grnSearch;
    const deeperQuery = [itemSearch, poSearch, grnSearch, vendorSearch]
      .filter((q) => q !== ownQuery)
      .map((q) => q.trim())
      .find((q) => q.length > 1);
    if (!deeperQuery) return;
    // Every match, not the first twelve. A receiving search can return
    // twenty items off one delivery, and capping the expansion left the ones
    // below the fold shut -- which reads exactly like the feature not working.
    setExpandedGroups(new Set(sourceGroups.map((g) => g.key)));
  }, [itemSearch, poSearch, grnSearch, vendorSearch, groupBy, sourceGroups]);

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
    const selectedData: SelectedPOData[] = [];

    // Every vendor, not the filtered slice. Selection is global -- picking an
    // item marks it whatever lens or search was active -- so walking only the
    // vendors currently matching the search would silently drop lines the
    // user picked before narrowing the query.
    mockVendors.forEach(vendor => {
      vendor.purchaseOrders.forEach(po => {
        const poKey = `${vendor.vendorCode}-${po.poNumber}`;
        if (selectedPOs.has(poKey)) {
          const relatedGRNs = vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber);
          
          // Only include selected items
          const itemsToPass = po.items.filter(item => selectedItemIds.has(item.id));
          
          if (itemsToPass.length > 0) {
            const poRelatedGRNs = vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber);
            const selectedPOReceipts = poRelatedGRNs.filter(grn => selectedGRNs.has(grn.grnNumber));

            selectedData.push({
              vendorCode: vendor.vendorCode,
              vendorName: vendor.vendorName,
              vendorCategory: vendor.category,
              currency: vendor.currency,
              paymentTerms: vendor.paymentTerms,
              poNumber: po.poNumber,
              poDate: po.poDate,
              poAmount: po.poAmount,
              poStatus: po.status,
              originId: po.originId,
              originName:
                vendor.locations.find(l => l.id === po.originId)?.name ?? vendor.vendorName,
              itemCount: itemsToPass.length,
              isPreInvoice: poRelatedGRNs.length === 0,
              relatedGRNs: selectedPOReceipts.length > 0 ? selectedPOReceipts : poRelatedGRNs,
              items: itemsToPass,
              selectedItemIds: itemsToPass.map(i => i.id),
              // Scoped to the receipts of this PO that carry a line actually
              // going forward, so the supporting paperwork matches the items.
              selectedGRNItemIds: Array.from(selectedGRNItems).filter(key => {
                const gNum = key.slice(0, key.indexOf(':'));
                const grn = poRelatedGRNs.find(g => g.grnNumber === gNum);
                if (!grn) return false;
                const grnItemId = key.slice(key.indexOf(':') + 1);
                const grnItem = grn.items.find(i => i.id === grnItemId);
                return !!grnItem && itemsToPass.some(i => i.sku === grnItem.sku);
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
  // 100dvh on mobile.
  const modalClasses =
    "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[151] bg-white border border-border w-[calc(100%-2rem)] max-w-[100%] sm:max-w-[min(70vw,1320px)] h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden";

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
                    {/* Type icon — mirrors the Inventory Invoice card on the
                        type picker (Package, blue identity). */}
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                    <h2
                      className="text-[15px] sm:text-[17px] text-foreground truncate"
                      style={{ fontWeight: 700 }}
                    >
                      {headerTitle}
                    </h2>
                    <p
                      className="text-[11px] sm:text-xs text-slate-500 mt-0.5"
                      style={{ fontWeight: 400 }}
                    >
                      {headerSubtitle}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
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
                    {searchSegments.map((seg) => (
                      <div key={seg.key} className="relative group">
                        <seg.Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <Input
                          type="text"
                          placeholder={seg.placeholder}
                          value={seg.value}
                          disabled={seg.disabled}
                          onChange={(e) => seg.onChange(e.target.value)}
                          className={`pl-9 pr-3 h-10 border-0 rounded-none transition-all text-[13px] focus-visible:ring-0 focus-visible:ring-offset-0 ${seg.disabled ? 'bg-muted/30 cursor-not-allowed text-muted-foreground' : 'bg-white hover:bg-muted/20 focus:bg-white'}`}
                        />
                      </div>
                    ))}
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
            {hasResults && (
              <div className="flex items-center justify-between px-6 pt-4 pb-2 gap-3">
                <span className="text-[12px] text-slate-600 truncate" style={{ fontWeight: 500 }}>
                  {hasUserInput ? (
                    <>
                      Showing results for
                      <span className="ml-1 text-foreground" style={{ fontWeight: 600 }}>
                        {`"${searchQueryText}"`}
                      </span>
                    </>
                  ) : groupBy === 'item' ? (
                    'Items you have recently returned'
                  ) : groupBy === 'po' ? (
                    'Purchase orders you have recently received against'
                  ) : (
                    labels.recentVendorsHeading
                  )}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  {/* View-by switcher — the same result set rearranged under
                      a different lead entity. Nothing is filtered out by
                      changing it, and a selection made in one view stays
                      selected in the others because they all key off the
                      same PO line. */}
                  <div
                    className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5"
                    role="radiogroup"
                    aria-label="View results by"
                  >
                    {VIEW_OPTIONS.map((opt) => {
                      const active = groupBy === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setGroupBy(opt.key)}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] whitespace-nowrap transition-colors cursor-pointer ${
                            active ? 'bg-[#EDF4FF] text-[#0A77FF]' : 'text-muted-foreground hover:bg-muted'
                          }`}
                          style={{ fontWeight: active ? 500 : 400 }}
                        >
                          <opt.Icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

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
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
                        Collapse cards
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          setExpandedVendors(new Set());
                          setExpandedPOs(new Set());
                          setExpandedGRNs(new Set());
                          setExpandedGroups(new Set());
                        }}
                        className="text-[12px]"
                      >
                        <Layers className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Collapse all
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setExpandedVendors(new Set())}
                        className="text-[12px]"
                      >
                        <Building2 className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Vendors only
                      </DropdownMenuItem>
                      {/* A vendor-level search leaves nothing open below the
                          vendor card, so these two have no layer to collapse
                          until the user drills in. */}
                      <DropdownMenuItem
                        onSelect={() => setExpandedPOs(new Set())}
                        disabled={expandedPOs.size === 0}
                        className="text-[12px]"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Purchase orders only
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setExpandedGRNs(new Set())}
                        disabled={expandedGRNs.size === 0}
                        className="text-[12px]"
                      >
                        <Package className="w-3.5 h-3.5 mr-2 text-slate-500" />
                        Receivings only
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
                            if (sortKey === 'date') return sortDir === 'desc' ? 'Newest first' : 'Oldest first';
                            if (sortKey === 'value') return sortDir === 'desc' ? 'Highest value' : 'Lowest value';
                            if (sortKey === 'remaining') return labels.remainingSortShort;
                            return sortDir === 'desc' ? 'PO# high → low' : 'PO# low → high';
                          })()}
                        </span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[220px]">
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
                        <Calendar className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />Date
                      </DropdownMenuLabel>
                      {[
                        { key: 'date' as const, dir: 'desc' as const, label: 'Newest first' },
                        { key: 'date' as const, dir: 'asc' as const, label: 'Oldest first' },
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
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
                        <DollarSign className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />Value
                      </DropdownMenuLabel>
                      {[
                        { key: 'value' as const, dir: 'desc' as const, label: 'Highest first' },
                        { key: 'value' as const, dir: 'asc' as const, label: 'Lowest first' },
                        { key: 'remaining' as const, dir: 'desc' as const, label: labels.remainingSortLabel },
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
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>
                        <Hash className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />PO number
                      </DropdownMenuLabel>
                      {[
                        { key: 'poNumber' as const, dir: 'asc' as const, label: 'Low to high' },
                        { key: 'poNumber' as const, dir: 'desc' as const, label: 'High to low' },
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
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {hasUserInput && filteredVendors.length > 0 && (
                    <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                      Showing{' '}
                      <span className="text-foreground" style={{ fontWeight: 600 }}>
                        {groupBy === 'vendor' ? filteredVendors.length : displayGroups.length}
                      </span>{' '}
                      {/* One result is not "1 vendors". */}
                      {(() => {
                        const n = groupBy === 'vendor' ? filteredVendors.length : displayGroups.length;
                        const noun =
                          groupBy === 'vendor'
                            ? 'vendor'
                            : groupBy === 'item'
                              ? 'item'
                              : groupBy === 'po'
                                ? 'purchase order'
                                : 'receiving';
                        return n === 1 ? noun : `${noun}s`;
                      })()}
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
            {!hasResults && (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center min-h-[440px]">
                {/* Cold start and no-match are different situations: one is
                    waiting to be told what to look for, the other has looked
                    and come back empty. */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border ${
                    hasUserInput ? 'bg-slate-100 border-slate-200' : 'bg-[#EFF6FF] border-blue-100'
                  }`}
                >
                  {hasUserInput ? (
                    <Search className="w-6 h-6 text-slate-400" />
                  ) : (
                    <Package className="w-6 h-6 text-primary" />
                  )}
                </div>
                <h3 className="text-[15px] text-foreground mb-1.5" style={{ fontWeight: 600 }}>
                  {hasUserInput
                    ? 'No matches found'
                    : isRma
                      ? 'Which item are you returning?'
                      : 'Find vendors, POs, or items'}
                </h3>
                <p
                  className="text-[12px] text-slate-500 max-w-[380px] leading-relaxed"
                  style={{ fontWeight: 400 }}
                >
                  {hasUserInput
                    ? 'Try adjusting your search terms, removing filters, or expanding the date range.'
                    : isRma
                      ? 'Search an item number or description above.'
                      : 'Enter a vendor name, PO number, receiving, or item number in the search bar above to get started.'}
                </p>

                {/* The four lenses are the same result set under a different
                    lead entity, so naming them here says what the search is
                    about to unlock rather than leaving the switcher to be
                    discovered after the fact. */}
                {!hasUserInput && isRma && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-center mt-4">
                    {[
                      { icon: Tag, label: 'Item' },
                      { icon: Building2, label: 'Vendor' },
                      { icon: ShoppingCart, label: 'PO' },
                      { icon: Receipt, label: 'Receiving' },
                    ].map(({ icon: Icon, label }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-[#E8ECF1] bg-white text-[11px] text-slate-600"
                        style={{ fontWeight: 500 }}
                      >
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {!hasUserInput && isRma && (
                  <p className="text-[11px] text-slate-400 mt-2.5" style={{ fontWeight: 400 }}>
                    View the matches by any of these.
                  </p>
                )}

                {hasUserInput && fuzzySuggestion && (
                  <p className="mt-3 text-[12px] text-slate-600" style={{ fontWeight: 500 }}>
                    Did you mean{' '}
                    <button
                      type="button"
                      onClick={applyFuzzySuggestion}
                      className="text-primary hover:underline underline-offset-2 decoration-primary/60"
                      style={{ fontWeight: 600 }}
                    >
                      {fuzzySuggestion.value}
                    </button>
                    ?
                  </p>
                )}

                {hasUserInput && vendorSearch.trim() && (
                  <a
                    href={PARTNER_CREATE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-[12px] hover:bg-primary/90 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Create new partner
                  </a>
                )}
              </div>
            )}

            {groupBy !== 'vendor' && (
              <div>
                {displayGroups.map((group) => (
                  <SourceGroupRow
                    key={group.key}
                    group={group}
                    groupBy={groupBy}
                    isExpanded={expandedGroups.has(group.key)}
                    onToggle={() => toggleGroup(group.key)}
                    selectedItemIds={selectedItemIds}
                    onToggleSource={toggleSource}
                    onSelectSources={setSourcesSelected}
                    lockedVendorCode={lockedToVendorCode}
                    lockedVendorName={lockedVendorName}
                    highlightText={highlightText}
                    itemSearch={itemSearch}
                    poSearch={poSearch}
                    grnSearch={grnSearch}
                    vendorSearch={vendorSearch}
                    grnStatusLabels={{
                      notInvoiced: labels.statusNotInvoiced,
                      fullyInvoiced: labels.statusFullyInvoiced,
                      partiallyInvoiced: labels.statusPartiallyInvoiced,
                    }}
                    availableLabel={labels.columnRemainingQty}
                    onPreviewItem={(sku, vendorName) =>
                      setPreviewImage({ src: imageForSku(sku), alt: sku, sku, vendorName })
                    }
                    quickViewOpen={!!previewImage}
                    receiptByItem={receiptByItem}
                  />
                ))}
              </div>
            )}

            <div className="divide-y divide-[#EEF2F6]">
              {groupBy === 'vendor' && displayVendors.map((vendor) => (
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
                  onSelectSources={setSourcesSelected}
                  receiptByItem={receiptByItem}
                  selectedItemIds={selectedItemIds}
                  onToggleItem={toggleItemSelection}
                  highlightText={highlightText}
                  setPreviewImage={setPreviewImage}
                  quickViewOpen={!!previewImage}
                  lockedOut={!!lockedToVendorCode && lockedToVendorCode !== vendor.vendorCode}
                  lockedVendorName={lockedVendorName ?? undefined}
                  stickyTop={stickyToolbarHeight}
                  labels={labels}
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
              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                {selectedItemIds.size}
              </span>{' '}
              {selectedItemIds.size === 1 ? 'item' : 'items'} selected from{' '}
              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                {selectedPOs.size}
              </span>{' '}
              {selectedPOs.size === 1 ? 'PO' : 'POs'}
              {selectedGRNs.size > 0 && (
                <>
                  {' · '}
                  <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
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
              onClick={handleContinue}
              disabled={selectedItemIds.size === 0 || (!isRma && selectedVendorCount > 1)}
              className="gap-1.5 rounded-lg px-3 sm:px-5 text-xs sm:text-[13px] h-8 sm:h-9 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!isRma && selectedVendorCount > 1 ? 'Select Single Vendor Only' : 'Continue'}
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          </div>
      </div>

      {/* ─── Discard Confirmation — partner Create-modal pattern (1:1):
          soft red radial glow at top of card, plain red triangle icon (no
          ring), uppercase red DISCARD text (no chip), 18px bold title, body
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
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
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
                Discard item selection?
              </h3>
              <p
                className="text-[13px] mt-2 mx-auto"
                style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65, maxWidth: '300px' }}
              >
                All selected purchase orders, receiving documents, and line items will be cleared. This action cannot be undone.
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
                  Discard changes
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
                  Continue editing
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
                    <span className="text-[15px] font-mono text-gray-900" style={{ fontWeight: 700 }}>{sku}</span>
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
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Price Per Unit</div>
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
  poSearch: string;
  grnSearch: string;
  vendor: Vendor;
  vendorSearch: string;
  itemSearch: string;
  itemFilterMode: 'include' | 'exclude';
  /** When false, item search highlights instead of hard-filtering rows. */
  showOnlyMatched: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  selectedItemIds: Set<string>;
  onToggleItem: (item: LineItem, poKey: string, po: VendorPO, vendor: Vendor) => void;
  highlightText: (text: string, query: string) => React.ReactNode;
  setPreviewImage: (image: { src: string, alt: string, sku?: string, vendorName?: string } | null) => void;
  quickViewOpen: boolean;
  /** POs / GRNs / item composite keys already on the host invoice.
   *  Rows whose identifier is in these sets render with a disabled
   *  "Already on invoice" treatment so the user can see them but
   *  can't re-pick them. */
  /** Raw PO line-item IDs already on the host invoice. PO-item
   *  checkboxes render as indeterminate ("partially on invoice")
   *  with a hover tooltip; clicking escalates to a full select. */
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
  onSelectSources: (sources: ItemSource[], select: boolean) => void;
  receiptByItem: Map<string, string>;
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
  /** Label bundle threaded from the parent so nested tabs / column
   *  headers read the right vocabulary for the surface using the modal
   *  (invoice creation vs RMA creation). */
  labels: PickerLabels;
  /** Goods that were already billed can still be shipped back, so a return is
   *  capped by what was received rather than by what is left to invoice. The
   *  fully-invoiced lock is an invoicing rule and does not apply to an RMA. */
}

// String-typed shape of the label bundle. Deriving this from the LABELS
// map would keep the literal types via `as const`, and TS would reject
// the RMA vs invoice pair as incompatible unions — so we widen with a
// simple record.
type PickerLabels = {
  title: string;
  subtitle: string;
  receiversPill: string;
  posTab: string;
  remainingSortLabel: string;
  columnInvoicedQty: string;
  columnRemainingQty: string;
  grnColumnInvoiced: string;
  grnColumnRemaining: string;
  remainingSortShort: string;
  multiVendorWarning: string;
  recentVendorsHeading: string;
  receiversTooltip: string;
  posTooltip: string;
  poAlreadyOnTitle: string;
  poAlreadyOnBody: string;
  poLockedBody: string;
  preInvoiceAmountLabel: string;
  invoicedAmountLabel: string;
  preInvoiceTooltip: string;
  itemPartiallyOnTitle: string;
  itemPartiallyOnBody: string;
  grnAlreadyOnTitle: string;
  grnAlreadyOnBody: string;
  grnFullyInvoicedTitle: string;
  grnFullyInvoicedBody: string;
  grnItemAlreadyOnTitle: string;
  grnItemAlreadyOnBody: string;
  grnItemFullyInvoicedTitle: string;
  grnItemFullyInvoicedBody: string;
  statusNotInvoiced: string;
  statusFullyInvoiced: string;
  statusPartiallyInvoiced: string;
  linkedDocsHeading: string;
  linkedDocsNote: string;
  linkedDocsExampleId: string;
  includeClosedTooltip: string;
  lockedOutPrefix: string;
};
// Item-cell presentation + the deterministic mock master-data behind it
// now live in VendorSelectionItemCell (imported above) so the flat Item /
// PO / Receiving lenses can draw the same cell as the vendor lens tables.

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
  onSelectSources,
  receiptByItem,
  selectedItemIds,
  onToggleItem,
  highlightText,
  setPreviewImage,
  quickViewOpen,
  lockedOut,
  lockedVendorName,
  selectionInfo,
  stickyTop = 0,
  labels,
}: VendorNestedRowProps) {
  const [showFullDescription, setShowFullDescription] = useState(false);

  // KPI stat boxes deep-link into the vendor. There is one line-item table
  // now rather than a Receivings / Purchase Orders tab pair, so every box
  // opens the same place and only has to expand the row.
  const openVendorTab = () => {
    if (!isExpanded) onToggle();
  };

  // Description text — synthesized from vendor metadata (Vendor type doesn't
  // ship a description field). Long enough to need truncation + toggle.
  const vendorDescription = `${vendor.category} vendor specializing in ${vendor.type.toLowerCase()} operations. Established supplier with ${vendor.currency} settlements on ${vendor.paymentTerms} terms. Active across multiple purchase orders with consistent on-time delivery and competitive pricing for the supply chain.`;

  

  // "Show only matched" (default ON) hard-filters by the item query; OFF
  // shows everything highlighted. A selected row is ALWAYS visible -- a
  // selection can never hide behind a filter (design review 7/9/26).
  const vendorSources = useMemo(() => {
    const all = buildVendorSources(vendor);
    const q = itemSearch.trim().toLowerCase();
    return all.filter((source) => {
      // Already picked stays visible whatever is typed -- losing sight of a
      // selection because the query moved on is worse than a longer list.
      if (selectedItemIds.has(source.poItem.id)) return true;
      // A typed item narrows this lens too. It used to narrow only while the
      // "matched only" toggle was on, so searching an item and switching to
      // the vendor lens showed the vendor's whole catalogue instead.
      if (!q) return showOnlyMatched ? itemFilterMode === 'include' : true;
      const passesSearch =
        source.poItem.sku.toLowerCase().includes(q) ||
        source.poItem.description.toLowerCase().includes(q);
      return itemFilterMode === 'include' ? passesSearch : !passesSearch;
    });
  }, [vendor, itemSearch, showOnlyMatched, itemFilterMode, selectedItemIds]);

  const vendorItems = useMemo(() => {
    const bySku = new Map<string, ItemSource[]>();
    vendorSources.forEach((src) => {
      const list = bySku.get(src.poItem.sku) ?? [];
      list.push(src);
      bySku.set(src.poItem.sku, list);
    });
    return [...bySku.entries()];
  }, [vendorSources]);

  const selectedVendorLines = vendorSources.filter((s) => selectedItemIds.has(s.poItem.id)).length;
  const allVendorLinesSelected =
    vendorSources.length > 0 && selectedVendorLines === vendorSources.length;
  const vendorCheckboxState: boolean | 'indeterminate' =
    selectedVendorLines === 0 ? false : allVendorLinesSelected ? true : 'indeterminate';

  const totalPOs = vendor.purchaseOrders.length;
  const invoicedPOs = vendor.purchaseOrders.filter(po => (po.invoicedAmount || 0) >= po.poAmount && po.poAmount > 0).length;
  const uninvoicedPOs = totalPOs - invoicedPOs;

  
  const totalGRNs = vendor.receivingDocuments.length;
  const uninvoicedGRNs = totalGRNs; // Match the count to the total receivers shown in the list for consistency as requested

  // ── "Selected" chip navigation — clicking a count segment expands the
  // vendor and flashes the first selected line. All three segments land in
  // the same table now, so they share one target rather than routing to a
  // PO card or a receiver card.
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

  const goToSelectedItems = (e: React.MouseEvent) => {
    e.stopPropagation();
    const firstSelected = vendorSources.find((source) => selectedItemIds.has(source.poItem.id));
    if (!firstSelected) return;
    if (!isExpanded) onToggle();
    flashAndScroll(`src-${firstSelected.poItem.id}`);
  };

  // Keep a selected vendor visibly highlighted even when its card is
  // collapsed, so the selection reads at a glance (not just via the pill).
  const hasSelection =
    !!selectionInfo &&
    selectionInfo.poCount + selectionInfo.receiverCount + selectionInfo.itemCount > 0;

  return (
    // Outer row wrapper — single-vendor lockout per BA UX feedback.
    // When lockedOut, opacity drops to 40% and the row's CHILDREN stop
    // receiving pointer events while the wrapper itself keeps them, so
    // the shadcn Tooltip below can explain the lockout on hover (the
    // footer note moved here, design feedback 7/13/26).
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
    <div
      className={`transition-all duration-150 border-b border-[#EEF2F6] last:border-0 ${
        lockedOut ? 'opacity-40 cursor-not-allowed [&>*]:pointer-events-none' : ''
      }`}
      style={{
        // Matches the shared row shell in VendorSelectionSourceGroups.
        backgroundColor: isExpanded || hasSelection ? '#F8FAFF' : '#FAFBFC',
      }}
      aria-disabled={lockedOut}
    >
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
          if (!isExpanded) e.currentTarget.parentElement!.style.backgroundColor = hasSelection ? '#F8FAFF' : '#FAFBFC';
        }}
      >
        {/* Ticking the vendor takes every line it can supply — the same
            affordance the other three lenses have on their group rows. */}
        <Checkbox
          checked={vendorCheckboxState}
          disabled={lockedOut}
          onCheckedChange={() => onSelectSources(vendorSources, !allVendorLinesSelected)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select all lines from ${vendor.vendorName}`}
          className="shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />

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
                  { count: selectionInfo.poCount, label: selectionInfo.poCount === 1 ? 'PO' : 'POs', onClick: goToSelectedItems, title: 'Jump to the selected lines' },
                  { count: selectionInfo.receiverCount, label: 'REC', onClick: goToSelectedItems, title: 'Jump to the selected lines' },
                  { count: selectionInfo.itemCount, label: 'ITEMS', onClick: goToSelectedItems, title: 'Jump to the selected lines' },
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
                    <span className="tabular-nums text-[9px]" style={{ fontWeight: 700 }}>{seg.count}</span>
                    <span className="text-slate-400 text-[9px] uppercase tracking-wider">{seg.label}</span>
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
                  Show less
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
          {/* The same HeaderStat the item, PO and receiving rows use --
              interactive here because these two deep-link into the row. */}
          <HeaderStat
            Icon={Package}
            value={String(uninvoicedGRNs)}
            label={labels.receiversPill}
            muted={uninvoicedGRNs === 0}
            onClick={() => openVendorTab()}
            ariaLabel="Open receivings"
            tooltip={labels.receiversTooltip}
          />

          <HeaderStat
            Icon={ShoppingCart}
            value={String(uninvoicedPOs)}
            label={labels.posTab}
            muted={uninvoicedPOs === 0}
            onClick={() => openVendorTab()}
            ariaLabel="Open purchase orders"
            tooltip={labels.posTooltip}
            hoverTone="amber"
          />
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 pl-7">
          {/* One flat line-item table per vendor. This used to be a
              Receivings / Purchase Orders tab pair, which split a single
              question -- "what can I send back to this vendor" -- across two
              places and made a line reachable by two different routes. The
              PO and Receiving a line came in on are columns now, so the
              whole answer is one scan and the table matches the PO and
              Receiving lenses. */}
          {/* Vendor, then the items it can take back, then the orders each
              came off, then the deliveries. Same chain the item lens walks,
              entered from the other end. */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-2.5 text-[12px] text-slate-600 border-b border-[#EEF2F6] bg-[#FAFBFC]">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              {vendorItems.length} item{vendorItems.length !== 1 ? 's' : ''}
            </div>
            {vendorItems.map(([sku, itemSources]) => (
              <GroupItemRow
                key={sku}
                sku={sku}
                sources={itemSources}
                depth="po"
                selectedItemIds={selectedItemIds}
                receiptByItem={receiptByItem}
                onSelectSources={onSelectSources}
                blocked={false}
                autoOpen={poSearch.trim().length > 1 || grnSearch.trim().length > 1}
                autoOpenReceipts={poSearch.trim().length > 1 || grnSearch.trim().length > 1}
                highlightText={highlightText}
                itemSearch={itemSearch}
                poSearch={poSearch}
                grnSearch={grnSearch}
              />
            ))}
          </div>
        </div>
      )}

    </div>
      </TooltipTrigger>
      {lockedOut && (
        <TooltipContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md">
          <p className="text-[11px] text-slate-500 leading-snug">
            {labels.lockedOutPrefix}{lockedVendorName || 'the current selection'} to select another.
          </p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}
