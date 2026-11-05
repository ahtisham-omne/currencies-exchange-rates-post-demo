/* ═══════════════════════════════════════════════════════════════
   ItemsCatalogueModal — Centered Dialog catalogue modal

   Catalogue logic (search, grid/list view, add-to-cart, buy-now,
   vendor selector, pagination, etc.) rendered inside a Radix
   Dialog panel with full viewport height.

   Props:
   - open: boolean
   - onClose: () => void
   - initialSearchTerm?: string  (pre-fill search from PurchaseSearchModal)
   - initialVendor?: string      (pre-select vendor filter)
   ═══════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  ShoppingCart,
  AlertTriangle,
  Minus,
  Plus,
  Trash2,
  Package,
  Building2,
  ChevronLeft,
  ChevronRight,
  Hash,
  ChevronDown,
  FileText,
  User,
  Pencil,
  Info,
  Check,
  CircleSlash,
} from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import OrderFlow from "./OrderFlow";
import type { OrderFlowItem, OrderFlowResult, OrderFlowMode, OrderFlowPrefill } from "./OrderFlow";
import { createPOFromBuyNow, createPOFromVendorCheckout } from "./poStore";
import {
  getCart,
  subscribeToCart,
  addToCart as addToGlobalCart,
  removeFromCart as removeFromGlobalCart,
  clearCart,
  removeVendorItems,
  setCartVendorQty as setGlobalCartQty,
  isCartItemDeactivated,
} from "./cartStore";
import type { GlobalCartItem } from "./cartStore";
import VendorSelector from "./VendorSelector";
import UserHoverCard from "./UserHoverCard";
import ItemHoverCard from "./ItemHoverCard";
import {
  CATALOG,
  getVendorOffersForItem,
  getVendorContacts,
  getItemImages,
  getAllSystemVendorOffersForItem,
  VENDOR_CONTACTS,
} from "./catalogData";
import type { CatalogItem, ItemVendorOffer } from "./catalogData";
import { SHOW_PO_PRICING_RULES, getVendorRules } from "./poPricingRulesData";
import { FONT, typography as s } from "./designTokens";
import TruncatedItemName from "./TruncatedItemName";
import ImageLightbox from "./ImageLightbox";
import { QuickViewPanel, type QuickViewData } from "./QuickViewPanel";
import { toast } from "sonner";
import QuantityStepperInput from "./QuantityStepperInput";
import ItemStatusChip from "./ItemStatusChip";
import { computeCartVendorPricing } from "./poOrderPricing";
import {
  formatQuantityValue,
  getDraftQuantityValue,
  isValidQuantityDraft,
  preventInvalidQuantityKey,
  stepQuantity,
} from "./quantityInputUtils";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS (same as NewPurchaseOrderPage)
   ═══════════════════════════════��═��═��═════════������═════════════════ */

const ITEMS_PER_PAGE = 12;

const UOM_MAP: Record<string, string> = {
  Each: "EA (Each)", Kit: "KIT (Kit)", Unit: "UN (Unit)", Module: "MOD (Module)",
  Assembly: "ASM (Assembly)", Element: "EL (Element)", Valve: "VLV (Valve)",
  Box: "BX (Box)", Pack: "PK (Pack)", Case: "CS (Case)", Pair: "PR (Pair)",
  Set: "SET (Set)", Piece: "PC (Piece)", Roll: "RL (Roll)", Meter: "M (Meter)",
};
function formatUOM(uom: string) { return UOM_MAP[uom] ?? uom; }

function isSerializedCatalogItem(item: CatalogItem): boolean {
  const hash = item.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 3 === 0;
}

type SortKey = "name" | "price-asc" | "price-desc";

/* ── Avatar palette (matches PurchaseOrdersListing) ── */
const AVATAR_COLORS = [
  { bg: "hsl(var(--accent))", text: "hsl(var(--primary))" },
  { bg: "#F0FDF4", text: "#16A34A" },
  { bg: "#FFF7ED", text: "#EA580C" },
  { bg: "#F5F3FF", text: "#7C3AED" },
  { bg: "#ECFEFF", text: "#0891B2" },
  { bg: "#FFF1F2", text: "#E11D48" },
  { bg: "#FEF9C3", text: "#A16207" },
  { bg: "#F0FDFA", text: "#0D9488" },
  { bg: "#FDF2F8", text: "#DB2777" },
  { bg: "#EFF6FF", text: "#2563EB" },
  { bg: "#F5F5F4", text: "#57534E" },
];
const VENDOR_ABBR_MAP: Record<string, string> = { "General Motors (GM)": "GM", "Toyota Technical Center (TTC)": "TTC", "Ford Motor Company": "FMC", "Tesla, Inc.": "T", "Chrysler (Stellantis N.V.)": "CS", "Rivian Automotive": "RA", "Lucid Motors": "LM", "Honda Motor Co., Ltd. (USA)": "HM", "Nissan North America": "NNA", "BMW of North America": "BMW" };

function avatarTint(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function AvatarCircle({ name, initials, size = 32 }: { name: string; initials?: string; size?: number }) {
  const t = avatarTint(name);
  const ini = initials || name.split(" ").map(w => w[0] || "").join("").slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{ width: size, height: size, fontSize: size <= 24 ? "9px" : "10.5px", fontWeight: 700, fontFamily: FONT, backgroundColor: t.bg, color: t.text }}
    >
      {ini}
    </span>
  );
}

/* ── Categories with item counts ── */
const QUICK_CATEGORIES = (() => {
  const countMap = new Map<string, number>();
  CATALOG.forEach((c) => countMap.set(c.category, (countMap.get(c.category) ?? 0) + 1));
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
})();

/* ── Vendors with item counts ── */
const QUICK_VENDORS = (() => {
  const countMap = new Map<string, number>();
  CATALOG.filter((c) => c.partnerLocation).forEach((c) =>
    countMap.set(c.partnerLocation, (countMap.get(c.partnerLocation) ?? 0) + 1)
  );
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
})();
/* ═══════════════════════════════════════════════════════════════
   PROPS
   ═══════════════════════════════════════════════════════════════ */

interface ItemsCatalogueModalProps {
  open: boolean;
  onClose: () => void;
  initialSearchTerm?: string;
  initialVendor?: string;
  lockedVendor?: string;
  headingOverride?: string;
  mode?: "cart" | "po";
  addButtonLabel?: string;
  onAddItem?: (item: CatalogItem) => void;
  existingPOItemQtyByNumber?: Record<string, number>;
  onPOsCreated?: (created: Array<{ id: string; poNumber: string; vendor: string; total: number; itemCount: number }>) => void;
  /** Override the "In PO" per-row already-added badge copy. Used by
      the PR path to display "In request" without touching the mode
      logic. Defaults to "In PO". */
  itemBadgeLabel?: string;
  /** Header CTA pill mirroring the cart-mode Review affordance. When
      provided AND `count > 0`, renders in the header where the cart
      pill would sit, so buyers on the PR path always have a clear
      "next step" once they've staged picks. */
  reviewCTA?: {
    count: number;
    label: string;
    sublabel?: string;
    onClick: () => void;
  };
  /** Suppress the OrderFlow "Item Detail" modal that normally opens
      when a buyer clicks an item's identity area. The PR path
      doesn't need buy-now / add-to-cart mechanics — items go through
      the "Add to request" button only. */
  disableItemDetail?: boolean;
  /** Override the default subtitle under the modal title. PR path
      passes "Browse the catalog and add items to the request." so
      catalog-shared strings stay accurate to purchase requests. */
  subtitleOverride?: string;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function ItemsCatalogueModal({
  open,
  onClose,
  initialSearchTerm = "",
  initialVendor = "",
  lockedVendor,
  headingOverride,
  mode = "cart",
  addButtonLabel = "Add Item",
  onAddItem,
  existingPOItemQtyByNumber = {},
  onPOsCreated,
  itemBadgeLabel,
  reviewCTA,
  disableItemDetail = false,
  subtitleOverride,
}: ItemsCatalogueModalProps) {
  const navigate = useNavigate();
  const isPOMode = mode === "po";
  const lockedVendorName = lockedVendor?.trim() ?? "";
  const initialSelectedVendor = lockedVendorName || initialVendor;

  /* ── State ── */
  /* 4-field AND search */
  const [filterItem, setFilterItem] = useState(initialSearchTerm);
  const [filterVendor, setFilterVendor] = useState("");
  const [filterContact, setFilterContact] = useState("");
  const [showOnlyMatching, setShowOnlyMatching] = useState(true);

  const [selectedVendor, setSelectedVendor] = useState(initialSelectedVendor);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const cart = useSyncExternalStore(subscribeToCart, getCart, getCart);
  const [currentPage, setCurrentPage] = useState(1);
  // Unified OrderFlow modal state
  const [orderFlowItem, setOrderFlowItem] = useState<CatalogItem | null>(null);
  const [orderFlowMode, setOrderFlowMode] = useState<OrderFlowMode>("add-to-cart");
  const [orderFlowPrefill, setOrderFlowPrefill] = useState<OrderFlowPrefill | null>(null);

  const [cartViewOpen, setCartViewOpen] = useState(false);
  const [collapsedVendors, setCollapsedVendors] = useState<Set<string>>(new Set());
  /* multiPOModal state removed — confirmation is now handled by parent */
  /* ── Checkbox selection state for modal cart — all checked by default ── */
  /* Deactivated lines are never selectable — they can't go into a new PO. */
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    () => new Set(cart.filter((c) => !isCartItemDeactivated(c)).map((c) => c.catalogItem.id)),
  );
  React.useEffect(() => {
    setCheckedItems(() => {
      const next = new Set<string>();
      cart.forEach((c) => {
        if (!isCartItemDeactivated(c)) next.add(c.catalogItem.id);
      });
      return next;
    });
  }, [cart]);
  const toggleCheck = useCallback((itemId: string) => {
    const line = getCart().find((c) => c.catalogItem.id === itemId);
    if (line && isCartItemDeactivated(line)) return;
    setCheckedItems((prev) => { const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });
  }, []);
  const toggleVendorAll = useCallback((vendor: string, items: GlobalCartItem[]) => {
    setCheckedItems((prev) => {
      const ids = items.filter((i) => !isCartItemDeactivated(i)).map((i) => i.catalogItem.id);
      if (ids.length === 0) return prev;
      const allChecked = ids.every((id) => prev.has(id));
      const n = new Set(prev);
      ids.forEach((id) => { if (allChecked) n.delete(id); else n.add(id); });
      return n;
    });
  }, []);
  /* Inline add-to-cart picker state */
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [addingQty, setAddingQty] = useState(0);
  const [addingQtyInput, setAddingQtyInput] = useState("0");
  /* "Added ✓" confirmation flash — item ID → timeout ref */
  const [addedConfirmId, setAddedConfirmId] = useState<string | null>(null);
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Image lightbox state */
  const [lightboxItem, setLightboxItem] = useState<CatalogItem | null>(null);
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  const handleThumbnailQuickView = useCallback((item: CatalogItem) => {
    setQuickViewData({
      type: "item",
      item: { id: item.itemNumber, name: item.itemNumber, imageUrl: item.image },
      vendorName: item.partnerLocation || "—",
    });
  }, []);
  const handleContactQuickView = useCallback((name: string, vendorName?: string) => {
    if (!name) return;
    const initials = name.split(" ").map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
    const t = avatarTint(name);
    setQuickViewData({
      type: "contact",
      item: { id: name, name, initials, avatarBg: t.bg, avatarFg: t.text },
      vendorName: vendorName || "—",
    });
  }, []);
  /* Accordion: which item cards are expanded + which vendors within them */
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const toggleItemExpand = (id: string) => setExpandedItems((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleVendorExpand = (key: string) => setExpandedVendors((prev) => {
    const n = new Set<string>();
    // Accordion: only one vendor expanded per item — extract item prefix
    const itemPrefix = key.split("__")[0];
    // Keep expansions from other items, toggle only within this item
    prev.forEach((k) => { if (!k.startsWith(itemPrefix + "__")) n.add(k); });
    if (!prev.has(key)) n.add(key);
    return n;
  });
  /* Force re-render counter — bumped when vendor selection changes on a card; included in filteredItems deps */
  const [vendorChangeCounter, setVendorChangeCounter] = useState(0);
  const [lastActiveField, setLastActiveField] = useState<"item" | "vendor" | "contact" | null>(null);
  const [userGroupBy, setUserGroupBy] = useState<"none" | "vendor" | "poc">("none");
  const [collapsedGroupSections, setCollapsedGroupSections] = useState<Set<string>>(new Set());
  const toggleGroupSection = useCallback((key: string) => {
    setCollapsedGroupSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);
  const [contactsExpandedGroups, setContactsExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroupContacts = useCallback((key: string) => {
    setContactsExpandedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);
  /* Add New Vendor picker state for catalogue cards */
  const [addVendorForItem, setAddVendorForItem] = useState<CatalogItem | null>(null);
  const [addVendorSearch, setAddVendorSearch] = useState("");
  const filterItemRef = useRef<HTMLInputElement>(null);

  /* Derived: does any filter have a value? */
  const hasAnySearch = !!(filterItem || filterVendor || filterContact);
  const hasVendorOrContactSearch = !!(filterVendor.trim() || filterContact.trim());

  /* ── Reset state when modal opens ── */
  useEffect(() => {
    if (open) {
      setFilterItem(initialSearchTerm);
      setFilterVendor("");
      setFilterContact("");
      setSelectedVendor(initialSelectedVendor);
      setCurrentPage(1);
      setSortBy("name");
      setCartViewOpen(false);
      setCollapsedVendors(new Set());
      setConfirmClear(false);
      setAddingItemId(null);
      setAddingQty(0);
      setAddingQtyInput("0");
      setAddedConfirmId(null);
      setLightboxItem(null);
      setExpandedItems(new Set());
      setExpandedVendors(new Set());
      setShowOnlyMatching(true);
      setLastActiveField(null);
      setUserGroupBy("none");
      setCollapsedGroupSections(new Set());
      setContactsExpandedGroups(new Set());
      // Auto-focus first filter input
      setTimeout(() => filterItemRef.current?.focus(), 100);
    }
  }, [open, initialSearchTerm, initialSelectedVendor]);

  useEffect(() => {
    if (lockedVendorName && selectedVendor !== lockedVendorName) {
      setSelectedVendor(lockedVendorName);
    }
  }, [lockedVendorName, selectedVendor]);

  /* ── Escape key closes modal (Radix Dialog handles this, but we prevent
       closing when sub-modals are open) ── */

  /* ── Filtered + sorted catalog ── */
  const activePartnerFilter = selectedVendor;

  const filteredItems = useMemo(() => {
    let items = [...CATALOG];

    /* ── 4-field AND filter ── */
    const qItem = filterItem.trim().toLowerCase();
    const qVendor = filterVendor.trim().toLowerCase();
    const qContact = filterContact.trim().toLowerCase();

    if (qItem) {
      items = items.filter(
        (it) =>
          it.itemNumber.toLowerCase().includes(qItem) ||
          it.descriptiveName.toLowerCase().includes(qItem)
      );
    }
    if (qVendor) {
      items = items.filter((it) => {
        // Check default vendor
        if (it.partnerLocation.toLowerCase().includes(qVendor)) return true;
        // Check all vendor offers (non-default vendors)
        const offers = getVendorOffersForItem(it.id);
        return offers.some((o) => o.vendorName.toLowerCase().includes(qVendor));
      });
    }
    if (qContact) {
      items = items.filter((it) => {
        // Check default vendor contacts
        const contacts = VENDOR_CONTACTS[it.partnerLocation];
        if (contacts?.some((c) => c.name.toLowerCase().includes(qContact))) return true;
        // Check all vendor offers' full POC lists
        const offers = getVendorOffersForItem(it.id);
        return offers.some((o) => {
          const pocs = getVendorContacts(o.vendorName);
          return pocs.some((p) => p.name.toLowerCase().includes(qContact));
        });
      });
    }

    if (activePartnerFilter) items = items.filter((it) => it.partnerLocation === activePartnerFilter);

    switch (sortBy) {
      case "name": items.sort((a, b) => a.descriptiveName.localeCompare(b.descriptiveName)); break;
      case "price-asc": items.sort((a, b) => a.unitPrice - b.unitPrice); break;
      case "price-desc": items.sort((a, b) => b.unitPrice - a.unitPrice); break;
    }
    return items;
  }, [filterItem, filterVendor, filterContact, activePartnerFilter, sortBy, vendorChangeCounter]);

  useEffect(() => { setCurrentPage(1); }, [filterItem, filterVendor, filterContact, activePartnerFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    pageItems.forEach((item) => {
      console.log("[CatalogueModal serialization]", item.itemNumber, isSerializedCatalogItem(item));
    });
  }, [pageItems]);

  /* ── Group mode — purely user-controlled, never auto-switches ── */
  const groupMode = useMemo<"item" | "vendor" | "poc">(() => {
    if (userGroupBy === "vendor") return "vendor";
    if (userGroupBy === "poc") return "poc";
    return "item";
  }, [userGroupBy]);

  const vendorGroupedItems = useMemo(() => {
    if (groupMode !== "vendor") return [];
    const groups = new Map<string, CatalogItem[]>();
    pageItems.forEach(item => {
      const v = item.partnerLocation || "Unassigned";
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v)!.push(item);
    });
    const qV = filterVendor.trim().toLowerCase();
    return Array.from(groups.entries())
      .sort((a, b) => {
        const aMatch = qV && a[0].toLowerCase().includes(qV) ? 0 : 1;
        const bMatch = qV && b[0].toLowerCase().includes(qV) ? 0 : 1;
        return aMatch - bMatch || a[0].localeCompare(b[0]);
      })
      .map(([vendor, items]) => ({ vendor, items }));
  }, [pageItems, groupMode, filterVendor]);

  const pocGroupedItems = useMemo(() => {
    if (groupMode !== "poc") return [];
    const vendorItemsMap = new Map<string, CatalogItem[]>();
    pageItems.forEach(item => {
      const v = item.partnerLocation || "Unassigned";
      if (!vendorItemsMap.has(v)) vendorItemsMap.set(v, []);
      vendorItemsMap.get(v)!.push(item);
    });
    const qC = filterContact.trim().toLowerCase();
    const groups: Array<{ pocName: string; pocRole: string; pocInitials: string; vendorName: string; items: CatalogItem[] }> = [];
    vendorItemsMap.forEach((items, vendor) => {
      const contacts = VENDOR_CONTACTS[vendor] || [];
      const matchingPoc = qC ? contacts.find(c => c.name.toLowerCase().includes(qC)) : contacts[0];
      const poc = matchingPoc || contacts[0] || { name: vendor, role: "Vendor" };
      const initials = poc.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
      groups.push({ pocName: poc.name, pocRole: poc.role || "", pocInitials: initials, vendorName: vendor, items });
    });
    return groups.sort((a, b) => {
      const aMatch = qC && a.pocName.toLowerCase().includes(qC) ? 0 : 1;
      const bMatch = qC && b.pocName.toLowerCase().includes(qC) ? 0 : 1;
      return aMatch - bMatch || a.pocName.localeCompare(b.pocName);
    });
  }, [pageItems, groupMode, filterContact]);

  /* Auto-expand matching sections when grouping is active */
  useEffect(() => {
    if (groupMode === "vendor") {
      setCollapsedGroupSections(new Set());
    } else if (groupMode === "poc") {
      setCollapsedGroupSections(new Set());
    }
  }, [groupMode]);

  const highlightSearchText = useCallback((text: string, query: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark
          // Partners' canonical yellow-highlight recipe (`Partners/.../ColumnHeaderMenu.tsx:32`)
          className="bg-transparent px-0.5 rounded-sm"
          style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
        >
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  }, []);

  /* ── Cart helpers (global store) ── */
  const removeFromCart = (itemId: string) => removeFromGlobalCart(itemId);
  const setCartVendorQty = (itemId: string, vendorQty: number) => setGlobalCartQty(itemId, vendorQty);

  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = cart.reduce((sum, c) => {
    const lineTotal = c.unitPrice * c.quantity;
    const disc = lineTotal * (c.discount / 100);
    return sum + lineTotal - disc;
  }, 0);
  const isInCart = (id: string) => cart.some((c) => c.catalogItem.id === id);
  const getCartItem = (id: string) => cart.find((c) => c.catalogItem.id === id);
  const totalDiscount = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity * (c.discount / 100), 0);

  /* ── Vendor groups for cart view ── */
  const vendorGroups = useMemo(() => {
    const grouped = new Map<string, GlobalCartItem[]>();
    cart.forEach((item) => {
      const vendor = item.catalogItem.partnerLocation || "Unknown Vendor";
      if (!grouped.has(vendor)) grouped.set(vendor, []);
      grouped.get(vendor)!.push(item);
    });
    return Array.from(grouped.entries()).map(([vendor, items]) => {
      const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
      const discount = items.reduce((acc, i) => acc + i.unitPrice * i.quantity * (i.discount / 100), 0);
      const checked = items.filter((i) => checkedItems.has(i.catalogItem.id) && !isCartItemDeactivated(i));
      const deactivatedCount = items.filter(isCartItemDeactivated).length;
      const checkedSubtotal = checked.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
      const checkedDiscount = checked.reduce((acc, i) => acc + i.unitPrice * i.quantity * (i.discount / 100), 0);
      /* Pricing rules + item-level one-times — same math as CartPage so
         both cart surfaces show the same totals. */
      const pricing = computeCartVendorPricing(
        vendor === "Unknown Vendor" ? "" : vendor,
        checked.map((i) => ({ id: i.catalogItem.id, itemNumber: i.catalogItem.itemNumber, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, oneTimeAdjustments: i.oneTimeAdjustments })),
      );
      return {
        vendor, items, subtotal, discount, total: subtotal - discount,
        checkedCount: checked.length, selectableCount: items.length - deactivatedCount, deactivatedCount,
        checkedSubtotal, checkedDiscount,
        checkedRulesDiscount: pricing.rulesDiscount,
        checkedRulesPremium: pricing.rulesPremium,
        checkedOneTimeNet: pricing.oneTimeNet,
        checkedTotal: checkedSubtotal - checkedDiscount - pricing.rulesDiscount + pricing.rulesPremium + pricing.oneTimeNet,
      };
    });
  }, [cart, checkedItems]);

  const toggleVendor = useCallback((vendor: string) => {
    setCollapsedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor);
      else next.add(vendor);
      return next;
    });
  }, []);

  /* ── Create all POs from cart (checked items only) ── */
  const handleCreateAllPOs = useCallback(() => {
    const checked = cart.filter((c) => checkedItems.has(c.catalogItem.id) && !isCartItemDeactivated(c));
    if (checked.length === 0) return;
    const vendorMap = new Map<string, GlobalCartItem[]>();
    checked.forEach((c) => {
      const vendor = c.catalogItem.partnerLocation || "Unknown Vendor";
      if (!vendorMap.has(vendor)) vendorMap.set(vendor, []);
      vendorMap.get(vendor)!.push(c);
    });
    const created: Array<{ id: string; poNumber: string; vendor: string; total: number; itemCount: number }> = [];
    vendorMap.forEach((items, vendor) => {
      const poLineItems = items.map((c) => ({
        id: c.catalogItem.id, itemNumber: c.catalogItem.itemNumber, descriptiveName: c.catalogItem.descriptiveName,
        image: c.catalogItem.image, unitPrice: c.unitPrice, vendorQty: c.vendorQty,
        vendorUOM: c.catalogItem.vendorUOM, vendorUOMQty: c.catalogItem.vendorUOMQty,
        quantity: c.quantity, defaultUOM: c.catalogItem.defaultUOM, discount: c.discount,
        shipByDate: c.shipByDate, shipmentMethod: c.shipmentMethod,
        needByDate: c.needByDate, promisedShipDate: c.promisedShipDate,
        expectedDeliveryDate: c.expectedDeliveryDate,
        inboundLocation: c.inboundLocation, category: c.catalogItem.category,
        oneTimeAdjustments: c.oneTimeAdjustments,
      }));
      const po = createPOFromVendorCheckout(vendor, poLineItems);
      const total = items.reduce((acc, i) => {
        const line = i.unitPrice * i.quantity;
        return acc + line - line * (i.discount / 100);
      }, 0);
      created.push({ id: po.id, poNumber: po.poNumber, vendor, total, itemCount: items.length });
    });
    checked.forEach((c) => removeFromGlobalCart(c.catalogItem.id));

    // Close catalogue modal first
    setCartViewOpen(false);
    onClose();

    if (created.length === 1) {
      navigate(`/purchase-orders/${created[0].id}`);
    } else if (onPOsCreated) {
      // Notify parent to show confirmation modal on the listing page
      // Use a small delay so the catalogue modal close animation completes first
      setTimeout(() => onPOsCreated(created), 250);
    } else {
      // Fallback: navigate to first PO
      navigate(`/purchase-orders/${created[0].id}`);
    }
  }, [cart, checkedItems, navigate, onClose, onPOsCreated]);

  /* ── Checkout single vendor → create PO (checked items only) ── */
  const handleCheckoutVendor = useCallback((vendor: string) => {
    const vendorItems = cart.filter(
      (c) => c.catalogItem.partnerLocation === vendor && checkedItems.has(c.catalogItem.id) && !isCartItemDeactivated(c),
    );
    if (vendorItems.length === 0) return;
    const poLineItems = vendorItems.map((c) => ({
      id: c.catalogItem.id, itemNumber: c.catalogItem.itemNumber, descriptiveName: c.catalogItem.descriptiveName,
      image: c.catalogItem.image, unitPrice: c.unitPrice, vendorQty: c.vendorQty,
      vendorUOM: c.catalogItem.vendorUOM, vendorUOMQty: c.catalogItem.vendorUOMQty,
      quantity: c.quantity, defaultUOM: c.catalogItem.defaultUOM, discount: c.discount,
      shipByDate: c.shipByDate, shipmentMethod: c.shipmentMethod,
      needByDate: c.needByDate, promisedShipDate: c.promisedShipDate,
      inboundLocation: c.inboundLocation, category: c.catalogItem.category,
      oneTimeAdjustments: c.oneTimeAdjustments,
    }));
    const po = createPOFromVendorCheckout(vendor, poLineItems);
    vendorItems.forEach((c) => removeFromGlobalCart(c.catalogItem.id));
    setCartViewOpen(false);
    onClose();
    navigate(`/purchase-orders/${po.id}`);
  }, [cart, checkedItems, navigate, onClose]);

  /* ── Confirm clear cart state ── */
  const [confirmClear, setConfirmClear] = useState(false);

  const hasActiveFilters = !!activePartnerFilter;
  const clearAllFilters = () => {
    setFilterItem("");
    setFilterVendor("");
    setFilterContact("");
    setSelectedVendor(lockedVendorName || "");
  };

  /* ── Convert catalog item for OrderFlow ── */
  const toFlowItem = (item: CatalogItem): OrderFlowItem => ({
    id: item.id, itemNumber: item.itemNumber, descriptiveName: item.descriptiveName,
    image: item.image, unitPrice: item.unitPrice, currentStock: item.currentStock,
    minQuantity: item.minQuantity, shortageDate: item.shortageDate, partnerLocation: item.partnerLocation,
    category: item.category, location: item.location, vendorUOM: item.vendorUOM,
    vendorUOMQty: item.vendorUOMQty, defaultUOM: item.defaultUOM, discount: item.discount,
  });

  /* ── Open OrderFlow for Add to Cart ── */
  const openAddToCart = (item: CatalogItem) => {
    setOrderFlowMode("add-to-cart");
    setOrderFlowPrefill(null);
    setOrderFlowItem(item);
  };

  /* ── Open OrderFlow for Buy Now ── */
  const openBuyNow = (item: CatalogItem) => {
    setOrderFlowMode("buy-now");
    setOrderFlowPrefill(null);
    setOrderFlowItem(item);
  };

  /* ── Edit item from cart ── */
  const _handleEditCartItem = (itemId: string) => {
    const cartItem = cart.find((c) => c.catalogItem.id === itemId);
    if (cartItem) {
      setOrderFlowMode("edit-cart");
      setOrderFlowPrefill({
        vendorQty: cartItem.vendorQty,
        shipByDate: cartItem.shipByDate,
        shipmentMethod: cartItem.shipmentMethod,
        needByDate: cartItem.needByDate,
        promisedShipDate: cartItem.promisedShipDate,
        inboundLocation: cartItem.inboundLocation,
        oneTimeAdjustments: cartItem.oneTimeAdjustments,
      });
      setOrderFlowItem(cartItem.catalogItem);
    }
  };

  /* ── Close OrderFlow ── */
  const closeOrderFlow = () => {
    setOrderFlowItem(null);
    setOrderFlowPrefill(null);
    setOrderFlowMode("add-to-cart");
  };

  /** Unified onComplete handler -- dispatches based on result.completedMode */
  const handleOrderFlowComplete = (result: OrderFlowResult) => {
    const actionMode = result.completedMode || orderFlowMode;

    // Sync CATALOG entry with vendor info from the result (handles no-vendor → vendor assignment)
    const catIdx = CATALOG.findIndex((c) => c.id === result.item.id);
    if (catIdx >= 0 && result.item.partnerLocation) {
      CATALOG[catIdx] = {
        ...CATALOG[catIdx],
        partnerLocation: result.item.partnerLocation,
        unitPrice: result.unitPrice,
        discount: result.discount,
        vendorUOM: result.item.vendorUOM,
        vendorUOMQty: result.item.vendorUOMQty,
        defaultUOM: result.item.defaultUOM,
      };
      setVendorChangeCounter((c) => c + 1);
    }

    if (actionMode === "add-to-cart" || actionMode === "edit-cart") {
      const catalogRef = CATALOG.find((c) => c.id === result.item.id)!;
      addToGlobalCart({
        catalogItem: catalogRef,
        vendorQty: result.vendorQty,
        quantity: result.quantity,
        unitPrice: result.unitPrice,
        discount: result.discount,
        shipByDate: result.shipByDate,
        shipmentMethod: result.shipmentMethod,
        needByDate: result.needByDate,
        promisedShipDate: result.promisedShipDate,
        expectedDeliveryDate: result.expectedDeliveryDate,
        inboundLocation: result.inboundLocation,
        oneTimeAdjustments: result.oneTimeAdjustments,
      });
    } else if (actionMode === "buy-now") {
      const po = createPOFromBuyNow(
        {
          id: result.item.id,
          itemNumber: result.item.itemNumber,
          descriptiveName: result.item.descriptiveName,
          image: result.item.image,
          unitPrice: result.unitPrice,
          vendorUOM: result.item.vendorUOM,
          vendorUOMQty: result.item.vendorUOMQty,
          defaultUOM: result.item.defaultUOM,
          discount: result.discount,
          partnerLocation: result.item.partnerLocation,
          category: result.item.category,
        },
        {
          vendorQty: result.vendorQty,
          quantity: result.quantity,
          shipByDate: result.shipByDate,
          shipmentMethod: result.shipmentMethod,
          needByDate: result.needByDate,
          promisedShipDate: result.promisedShipDate,
          expectedDeliveryDate: result.expectedDeliveryDate,
          inboundLocation: result.inboundLocation,
          contactName: result.vendorContactName,
          contactEmail: result.vendorContactEmail,
          contactPhone: result.vendorContactPhone,
          notes: result.notes,
          totalPrice: result.totalPrice,
          oneTimeAdjustments: result.oneTimeAdjustments,
        }
      );
      onClose();
      navigate(`/purchase-orders/${po.id}`);
    }
    closeOrderFlow();
  };

  /* ── Pagination helpers ── */
  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  /* ── Inline add-to-cart: open picker on the card itself ── */
  const startInlineAdd = useCallback((item: CatalogItem) => {
    if (!item.partnerLocation) {
      // No vendor — fall back to OrderFlow for vendor assignment
      openAddToCart(item);
      return;
    }
    setAddingItemId(item.id);
    setAddingQty(0);
    setAddingQtyInput("0");
  }, []);

  const confirmInlineAdd = useCallback((item: CatalogItem) => {
    if (addingQty <= 0) return;
    addToGlobalCart({
      catalogItem: item,
      vendorQty: addingQty,
      quantity: addingQty * item.vendorUOMQty,
      unitPrice: item.unitPrice,
      discount: item.discount,
      shipByDate: "",
      shipmentMethod: "",
      needByDate: "",
      inboundLocation: "",
    });
    // Show "Added ✓" confirmation for 1.5s
    setAddedConfirmId(item.id);
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current);
    addedTimerRef.current = setTimeout(() => setAddedConfirmId(null), 1500);
    setAddingItemId(null);
    setAddingQty(0);
    setAddingQtyInput("0");
  }, [addingQty]);

  const cancelInlineAdd = useCallback(() => {
    setAddingItemId(null);
    setAddingQty(0);
    setAddingQtyInput("0");
  }, []);

  /* ── Intercept item interactions: OrderFlow handles no-vendor items inline ── */
  const openItemOrAssignVendor = useCallback((item: CatalogItem) => {
    openAddToCart(item);
  }, []);

  /* ── Handle buy now — directly creates a Draft PO and navigates ── */
  const handleBuyNowWithCheck = useCallback((item: CatalogItem) => {
    if (!item.partnerLocation) {
      // No vendor — open Item Detail modal in buy-now mode so user can assign vendor + price
      openBuyNow(item);
      return;
    }
    const contacts = getVendorContacts(item.partnerLocation);
    const contact = contacts[0];
    const now = new Date();
    const shipBy = new Date(now.getTime() + 7 * 86400000);
    const dueDelivery = new Date(now.getTime() + 14 * 86400000);
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const quantity = item.vendorUOMQty || 1;
    const totalPrice = item.unitPrice * quantity * (1 - item.discount / 100);

    const po = createPOFromBuyNow(
      {
        id: item.id,
        itemNumber: item.itemNumber,
        descriptiveName: item.descriptiveName,
        image: item.image,
        unitPrice: item.unitPrice,
        vendorUOM: item.vendorUOM,
        vendorUOMQty: item.vendorUOMQty,
        defaultUOM: item.defaultUOM,
        discount: item.discount,
        partnerLocation: item.partnerLocation,
        category: item.category,
      },
      {
        vendorQty: 1,
        quantity,
        shipByDate: fmt(shipBy),
        shipmentMethod: "Standard Ground",
        needByDate: fmt(dueDelivery),
        inboundLocation: item.location || "",
        contactName: contact.name,
        contactEmail: contact.email,
        contactPhone: contact.phone,
        notes: "",
        totalPrice,
      }
    );
    onClose();
    navigate(`/purchase-orders/${po.id}`);
  }, [navigate, onClose]);

  /* ── Vendor change handler (used by VendorSelector on cards) ── */
  const handleCardVendorChange = useCallback((item: CatalogItem, offer: ItemVendorOffer) => {
    const idx = CATALOG.findIndex((c) => c.id === item.id);
    if (idx >= 0) {
      CATALOG[idx] = {
        ...CATALOG[idx],
        partnerLocation: offer.vendorName,
        unitPrice: offer.unitPrice,
        discount: offer.discount,
        vendorUOM: offer.uom,
        vendorUOMQty: offer.uomQty,
        defaultUOM: offer.defaultUOM,
      };
    }
    const existing = cart.find((c) => c.catalogItem.id === item.id);
    if (existing) {
      addToGlobalCart({
        ...existing,
        catalogItem: {
          ...existing.catalogItem,
          partnerLocation: offer.vendorName,
          unitPrice: offer.unitPrice,
          discount: offer.discount,
          vendorUOM: offer.uom,
          vendorUOMQty: offer.uomQty,
          defaultUOM: offer.defaultUOM,
        },
        unitPrice: offer.unitPrice,
        discount: offer.discount,
      });
    }
    // Force re-render so the UI reflects the new vendor selection
    setVendorChangeCounter((c) => c + 1);
  }, [cart]);

  /* ── Handle picking a system vendor to add to a catalogue card item ── */
  const handleCatalogueAddVendor = useCallback((targetItem: CatalogItem, offer: ItemVendorOffer) => {
    const existingOffers = getVendorOffersForItem(targetItem.id);
    const newOffer: ItemVendorOffer = {
      ...offer,
      unitPrice: 0,
      priority: String(existingOffers.length + 1),
      isDefault: false,
      defaultUOM: targetItem.defaultUOM,
      uom: targetItem.vendorUOM,
      uomQty: targetItem.vendorUOMQty,
      // Seed an empty default tier — multi-unit views need at least one entry to render
      unitPrices: [
        { unit: targetItem.vendorUOM || targetItem.defaultUOM || "Each", price: 0, isDefault: true, conversionFactor: targetItem.vendorUOMQty || 1 },
      ],
      discount: 0,
    };
    // Dynamically import to mutate the map
    import("./catalogData").then(({ ITEM_VENDOR_OFFERS }) => {
      const current = ITEM_VENDOR_OFFERS.get(targetItem.id) || [];
      ITEM_VENDOR_OFFERS.set(targetItem.id, [...current, newOffer]);
    });
    handleCardVendorChange(targetItem, newOffer);
    setAddVendorForItem(null);
    setAddVendorSearch("");
    toast.success(`${offer.vendorName} added to ${targetItem.itemNumber}`, {
      description: "Vendor assigned with $0.00 price — update in Item Detail",
      style: { fontFamily: FONT }, duration: 3000,
    });
  }, [handleCardVendorChange]);

  /* ══════════════════════════════════════════════════════════════
     RENDER — Don't render anything if not open
     ═══════════════════════════════════════════════════════════════ */

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent
          /* Sizing recipe — verbatim port of Partners' canonical
             CONTENT-HEAVY modal recipe (`Partners/.../PaymentTermDetailModal.tsx:329`)
             — used for modals with scrollable lists / tables inside so
             the surface feels FIXED on 2K/4K rather than growing taller
             with the screen.
             Key choices that match Partners 1:1:
             - Width cap `min(70vw, 1480px)` — wider than Step-1 forms
               (1320px) because list-heavy modals benefit from extra
               horizontal real estate for row content.
             - **Height cap `min(88vh, 1180px)`** — this is the
               critical bit. On 1080p (88vh = 950px) the modal grows
               up to 950px. On 2K (88vh = 1267px) it caps at 1180px.
               On 4K (88vh = 1900px) it still caps at 1180px. That's
               what gives Partners the "fixed modal height on 2K/4K"
               feel — without it the modal would stretch with the
               viewport and dwarf the content.
             - Min height `640px` so empty / no-results states still
               look substantial.
             - Smooth resize transition `transition-[max-width,max-height,
               border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]`. */
          className="flex flex-col p-0 gap-0 overflow-hidden border-0 sm:border [&>[data-slot=dialog-close]]:hidden !fixed !top-[50%] !left-[50%] !translate-x-[-50%] !translate-y-[-50%] !w-[calc(100%-2rem)] transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] !max-w-[100%] sm:!max-w-[min(70vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl"
          style={{
            backgroundColor: "hsl(var(--card))",
            fontFamily: FONT,
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
          }}
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{cartViewOpen ? "Cart" : "New Purchase Order"}</DialogTitle>
          <DialogDescription className="sr-only">Browse the catalog and add items to your purchase order.</DialogDescription>

        {/* ═════════ TOP HEADER ══════════ */}
        <div className="shrink-0 z-10 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
                <div className="px-3 sm:px-4 lg:px-5 pt-3 sm:pt-4 pb-3 sm:pb-3.5">
                  {/* Row 1: Icon + Title block + Controls */}
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      {/* Back button — only in cart view */}
                      {cartViewOpen && (
                        <button
                          onClick={() => setCartViewOpen(false)}
                          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                          title="Back to Catalogue"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-500" />
                        </button>
                      )}
                      {/* Icon — changes based on view */}
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-lg"
                        style={{ width: "32px", height: "32px", backgroundColor: "hsl(var(--accent))" }}
                      >
                        {cartViewOpen ? (
                          <ShoppingCart style={{ width: "16px", height: "16px", color: "hsl(var(--primary))" }} />
                        ) : (
                          <Package style={{ width: "16px", height: "16px", color: "hsl(var(--primary))" }} />
                        )}
                      </div>
                      {/* Title block: title + subtitle */}
                      <div className="min-w-0">
                        <h2 className="!text-[15px] sm:!text-[17px] !text-foreground truncate !leading-tight !font-bold" style={{ fontFamily: FONT, letterSpacing: "-0.01em" }}>
                          {cartViewOpen
                            ? "Cart"
                            : headingOverride || (lockedVendorName ? `Add Items from ${lockedVendorName}` : "New Purchase Order")}
                        </h2>
                        <p className="!text-[11px] sm:!text-xs !text-slate-500 mt-0.5 truncate !font-normal" style={{ fontFamily: FONT }}>
                          {cartViewOpen
                            ? cart.length > 0
                              ? `${vendorGroups.length} vendor${vendorGroups.length !== 1 ? "s" : ""} · ${cart.length} item${cart.length !== 1 ? "s" : ""} · ${cartItemCount} unit${cartItemCount !== 1 ? "s" : ""}`
                              : "Review your selected items before creating purchase orders."
                            : subtitleOverride
                              ? subtitleOverride
                              : lockedVendorName
                                ? `Add items from ${lockedVendorName} to this purchase order.`
                                : "Browse the catalog and add items to your new purchase order."}
                        </p>
                      </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Clear cart — only in cart view */}
                      {cartViewOpen && cart.length > 0 && (
                        <>
                          {confirmClear ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-destructive" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>Clear all?</span>
                              <button className="h-7 px-2 rounded-[var(--radius-sm)] bg-destructive text-destructive-foreground cursor-pointer transition-colors hover:bg-destructive/90" style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", fontFamily: FONT }} onClick={() => { clearCart(); setConfirmClear(false); setCartViewOpen(false); }}>Yes</button>
                              <button className="h-7 px-2 rounded-[var(--radius-sm)] border border-border text-foreground/60 cursor-pointer transition-colors hover:bg-secondary" style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", fontFamily: FONT }} onClick={() => setConfirmClear(false)}>No</button>
                            </div>
                          ) : (
                            <button className="text-muted-foreground hover:text-destructive cursor-pointer transition-colors" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }} onClick={() => setConfirmClear(true)}>
                              Clear cart
                            </button>
                          )}
                        </>
                      )}

                      {/* Review CTA — used by non-cart callers (e.g. the
                          PR flow) that manage picks in local state. Sits
                          in the same header slot as the cart pill, mirrors
                          its layout, and fires the caller's onClick to
                          transition out of the modal. */}
                      {!cartViewOpen && reviewCTA && reviewCTA.count > 0 && (
                        <button
                          className="flex items-center gap-2.5 cursor-pointer rounded-[var(--radius-md)] px-3.5 py-2 border border-primary/20 transition-all hover:border-primary/30 hover:shadow-[var(--elevation-sm)]"
                          style={{ backgroundColor: "hsl(var(--primary-tint))", fontFamily: FONT }}
                          onClick={reviewCTA.onClick}
                        >
                          <div className="relative">
                            <ShoppingCart className="size-4 text-primary" strokeWidth={1.5} />
                            <span
                              className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[14px] h-3.5 rounded-full bg-primary text-primary-foreground px-0.5"
                              style={{ fontSize: "9px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}
                            >
                              {reviewCTA.count}
                            </span>
                          </div>
                          <div className="flex flex-col items-start gap-0">
                            <span
                              className="text-foreground"
                              style={{ fontSize: "12px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px", fontFamily: FONT }}
                            >
                              {reviewCTA.count} item{reviewCTA.count !== 1 ? "s" : ""}
                            </span>
                            <span
                              className="text-muted-foreground"
                              style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "13px", fontFamily: FONT }}
                            >
                              {reviewCTA.sublabel ?? reviewCTA.label}
                            </span>
                          </div>
                        </button>
                      )}

                      {/* Cart button — only in catalogue view, hidden when vendor-locked */}
                      {!cartViewOpen && !lockedVendorName && !reviewCTA && (
                        <button
                          className={`flex items-center gap-2.5 cursor-pointer rounded-[var(--radius-md)] px-3.5 py-2 border transition-all hover:border-primary/30 hover:shadow-[var(--elevation-sm)] ${cart.length > 0 ? "border-primary/20" : "border-border"}`}
                          style={{ backgroundColor: cart.length > 0 ? "hsl(var(--primary-tint))" : "hsl(var(--card))", fontFamily: FONT }}
                          onClick={() => setCartViewOpen(true)}
                        >
                          <div className="relative">
                            <ShoppingCart className={`size-4 ${cart.length > 0 ? "text-primary" : "text-muted-foreground"}`} strokeWidth={1.5} />
                            {cart.length > 0 && (
                              <span
                                className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[14px] h-3.5 rounded-full bg-primary text-primary-foreground px-0.5"
                                style={{ fontSize: "9px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}
                              >
                                {cart.length}
                              </span>
                            )}
                          </div>
                          {cart.length > 0 ? (
                            <div className="flex flex-col items-start gap-0">
                              <span className="text-foreground" style={{ fontSize: "12px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px", fontFamily: FONT }}>
                                {cart.length} item{cart.length !== 1 ? "s" : ""}
                              </span>
                              <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "13px", fontFamily: FONT }}>
                                {vendorGroups.length} vendor{vendorGroups.length !== 1 ? "s" : ""} · Review
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>Cart</span>
                          )}
                        </button>
                      )}

                      {/* Close button — icon-only, top-right */}
                      <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
                        title="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Row 2: search filters — only in catalogue view */}
                  {/* When vendor-locked: only show item search field */}
                  {!cartViewOpen && <div
                    className="mt-3 flex items-stretch rounded-md border border-border overflow-hidden transition-all bg-card hover:border-slate-300 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
                    style={{ fontFamily: FONT }}
                  >
                    {/* Search icon */}
                    <div className="flex items-center justify-center pl-3 pr-0.5 shrink-0">
                      <Search className="size-4 text-muted-foreground" strokeWidth={1.5} />
                    </div>

                    {/* Item */}
                    <div className="relative flex-1 min-w-0 flex items-center">
                      <Hash className="shrink-0 ml-2 size-3.5" style={{ color: "hsl(var(--muted-foreground))" }} strokeWidth={1.5} />
                      <input
                        ref={filterItemRef}
                        type="text"
                        placeholder="Item"
                        value={filterItem}
                        onChange={(e) => { setFilterItem(e.target.value); setLastActiveField("item"); }}
                        className="w-full h-9 bg-transparent text-foreground placeholder:text-muted-foreground outline-none pl-1.5 pr-6 text-sm"
                        style={{ fontFamily: FONT }}
                      />
                      {filterItem && (
                        <button
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          onClick={() => { setFilterItem(""); filterItemRef.current?.focus(); }}
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>

                    {/* Vendor + Contact fields — hidden in locked vendor mode */}
                    {!lockedVendorName && (
                      <>
                        {/* Divider */}
                        <div className="w-px shrink-0 my-2" style={{ backgroundColor: "hsl(var(--border))" }} />

                        {/* Vendor */}
                        <div className="relative flex-1 min-w-0 flex items-center">
                          <Building2 className="shrink-0 ml-2 size-3.5" style={{ color: "hsl(var(--muted-foreground))" }} strokeWidth={1.5} />
                          <input
                            type="text"
                            placeholder="Vendor"
                            value={filterVendor}
                            onChange={(e) => { setFilterVendor(e.target.value); setLastActiveField("vendor"); }}
                            className="w-full h-9 bg-transparent text-foreground placeholder:text-muted-foreground outline-none pl-1.5 pr-6 text-sm"
                            style={{ fontFamily: FONT }}
                          />
                          {filterVendor && (
                            <button
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                              onClick={() => { setFilterVendor(""); }}
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>

                        {/* Divider */}
                        <div className="w-px shrink-0 my-2" style={{ backgroundColor: "hsl(var(--border))" }} />

                        {/* Point of Contact */}
                        <div className="relative flex-1 min-w-0 flex items-center">
                          <User className="shrink-0 ml-2 size-3.5" style={{ color: "hsl(var(--muted-foreground))" }} strokeWidth={1.5} />
                          <input
                            type="text"
                            placeholder="Point of Contact"
                            value={filterContact}
                            onChange={(e) => { setFilterContact(e.target.value); setLastActiveField("contact"); }}
                            className="w-full h-9 bg-transparent text-foreground placeholder:text-muted-foreground outline-none pl-1.5 pr-7 text-sm"
                            style={{ fontFamily: FONT }}
                          />
                          {filterContact && (
                            <button
                              className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                              onClick={() => { setFilterContact(""); }}
                            >
                              <X className="size-3" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>}


                </div>
        </div>

        {/* ══════════ CONTENT AREA ══════════ */}
        <div className="flex flex-1 overflow-hidden w-full">

          {/* ══════════ CART VIEW (inline, replaces content) — matches CartPage design ══════════ */}
          {cartViewOpen ? (
            <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: "#FAFBFC", fontFamily: FONT }}>

              {/* ── Cart content (always has items — clearing redirects to catalogue) ── */}
              {cart.length > 0 && (
                /* ── Two-column layout matching CartPage ── */
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}>
                  <div className="px-5 py-5">
                    <div className="flex flex-col lg:flex-row gap-5">

                      {/* ─────── Left Column: Vendor groups ─────── */}
                      <div className="flex-1 min-w-0 flex flex-col gap-4">
                        {vendorGroups.map((group) => {
                          const isCollapsed = collapsedVendors.has(group.vendor);
                          const checkedCount = group.checkedCount;
                          const totalCheckedCount = cart.filter((c) => checkedItems.has(c.catalogItem.id)).length;
                          return (
                            <div
                              key={group.vendor}
                              className="rounded-[var(--radius-lg)] border border-border overflow-hidden"
                              style={{ backgroundColor: "hsl(var(--card))" }}
                            >
                              {/* Vendor header */}
                              <div
                                className="flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none hover:bg-accent/40 transition-colors"
                                style={{ borderBottom: isCollapsed ? "none" : "1px solid hsl(var(--border))" }}
                                onClick={() => toggleVendor(group.vendor)}
                              >
                                {/* Select all checkbox */}
                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={group.selectableCount > 0 && checkedCount === group.selectableCount ? true : checkedCount > 0 ? "indeterminate" : false}
                                    onCheckedChange={() => toggleVendorAll(group.vendor, group.items)}
                                    disabled={group.selectableCount === 0}
                                    className="size-[18px]"
                                    aria-label={checkedCount === group.selectableCount ? "Deselect all" : "Select all"}
                                  />
                                </div>
                                <AvatarCircle name={group.vendor} initials={(VENDOR_ABBR_MAP[group.vendor] || group.vendor.split(/[\s(]+/).filter(Boolean).map(w => w[0]).join("").slice(0, 3).toUpperCase())} size={32} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-foreground truncate text-sm font-semibold leading-[20px]" style={{ fontFamily: FONT }}>{group.vendor}</span>
                                    <span className="inline-flex items-center px-1.5 py-0 rounded-full shrink-0 bg-muted text-muted-foreground text-[10px] font-semibold leading-[16px]" style={{ fontFamily: FONT }}>
                                      {checkedCount}/{group.selectableCount} selected
                                    </span>
                                    {group.deactivatedCount > 0 && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-md shrink-0 border text-[10px] font-semibold leading-[16px]" style={{ fontFamily: FONT, backgroundColor: "#FFFBEB", color: "#92400E", borderColor: "#FDE68A" }}>
                                        <CircleSlash className="size-2.5" style={{ color: "#D97706" }} /> {group.deactivatedCount} inactive
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-muted-foreground text-xs leading-[16px]" style={{ fontFamily: FONT }}>
                                      Subtotal: <span className="text-foreground font-semibold" style={{ fontFamily: FONT }}>${group.checkedTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </span>
                                    {group.checkedDiscount > 0 && (
                                      <span className="text-xs leading-[16px] text-emerald-600 font-medium" style={{ fontFamily: FONT }}>
                                        Discount ${group.checkedDiscount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    variant={checkedCount > 0 ? "default" : "outline"}
                                    className="h-8 gap-1.5 rounded-md text-[13px] shadow-sm disabled:opacity-50"
                                    onClick={(e) => { e.stopPropagation(); handleCheckoutVendor(group.vendor); }}
                                    disabled={checkedCount === 0}
                                    title={`Create PO for ${group.vendor}`}
                                  >
                                    <FileText className="size-3.5" />
                                    <span className="hidden sm:inline">Create PO ({checkedCount})</span>
                                  </Button>
                                  {isCollapsed ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" style={{ transform: "rotate(180deg)" }} />}
                                </div>
                              </div>

                              {/* Vendor items — with checkboxes matching CartPage */}
                              {!isCollapsed && (
                                <div className="flex flex-col gap-0 px-3 pt-2 pb-2">
                                  {group.items.map((ci) => {
                                    const cat = ci.catalogItem;
                                    const effectivePrice = ci.unitPrice * (1 - ci.discount / 100);
                                    const deactivated = isCartItemDeactivated(ci);
                                    const isChecked = !deactivated && checkedItems.has(cat.id);
                                    /* Inactive lines greyed with real slate colours (Items v2 Inactive tokens for the tag/notice). */
                                    const muted = (normal: string) => (deactivated ? "text-slate-400" : normal);
                                    return (
                                      <div
                                        key={cat.id}
                                        className={`rounded-xl border overflow-hidden transition-all duration-150 group/card mb-2 ${deactivated ? "bg-card border-amber-200" : "border-border " + `hover:shadow-sm hover:border-primary/20 ${isChecked ? "bg-card" : "bg-muted/30"}`}`}
                                        style={{ fontFamily: FONT }}
                                      >
                                        {/* Main row */}
                                        <div className="flex items-start gap-3 px-3 py-2.5">
                                          {/* Checkbox */}
                                          <div className="shrink-0 mt-5">
                                            <Checkbox
                                              checked={isChecked}
                                              onCheckedChange={() => toggleCheck(cat.id)}
                                              disabled={deactivated}
                                              className={`size-[18px] ${deactivated ? "disabled:opacity-100 bg-slate-100 border-slate-300" : ""}`}
                                              aria-label={deactivated ? "Inactive item can't be selected" : isChecked ? "Deselect item" : "Select item"}
                                              title={deactivated ? "Inactive items can't be selected for a PO" : undefined}
                                            />
                                          </div>
                                          {/* Thumbnail 64×64 — opens QuickViewPanel item modal */}
                                          <div
                                            className={`relative shrink-0 w-16 h-16 min-w-16 min-h-16 rounded-md overflow-hidden transition-all border ${deactivated ? "bg-slate-100 border-slate-200" : "bg-muted border-border cursor-pointer hover:ring-2 hover:ring-primary/30"}`}
                                            onClick={deactivated ? undefined : () => handleThumbnailQuickView(cat)}
                                            title={deactivated ? undefined : "View item details"}
                                          >
                                            <ImageWithFallback
                                              src={cat.image}
                                              alt={cat.descriptiveName}
                                              className={`w-full h-full object-cover transition-transform duration-300 ${deactivated ? "grayscale" : "group-hover/card:scale-105"}`}
                                            />
                                          </div>

                                          {/* Content area */}
                                          <div className="flex flex-col flex-1 min-w-0 gap-0">
                                            <div className="flex items-center gap-2">
                                              <ItemHoverCard code={cat.itemNumber} imageUrl={cat.image}>
                                                <span className={`truncate text-sm font-semibold leading-[20px] cursor-pointer hover:text-primary transition-colors ${deactivated ? "text-slate-500" : "text-foreground"}`}>{cat.itemNumber}</span>
                                              </ItemHoverCard>
                                              {deactivated && <ItemStatusChip inactive={ci.deactivation} size="sm" showActive={false} />}
                                              {(() => {
                                                const hash = cat.id.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                                                const serialized = hash % 3 === 0;
                                                return (
                                                  <span className={`inline-flex items-center px-1.5 py-0 rounded-md shrink-0 text-[10px] font-semibold leading-[16px] ${deactivated ? "bg-slate-100 text-slate-500" : "bg-muted text-muted-foreground"}`} style={{ fontFamily: FONT }}>
                                                    {serialized ? "Serialized" : "Non-Serialized"}
                                                  </span>
                                                );
                                              })()}
                                            </div>
                                            <TruncatedItemName name={cat.descriptiveName} maxChars={50} style={{ fontSize: "12px", fontWeight: 400, lineHeight: "16px" }} className={`${muted("text-muted-foreground")} mt-0.5`} />
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                              <div className="inline-flex items-center gap-1 min-w-0">
                                                <Building2 className="size-2.5 text-muted-foreground/50 shrink-0" />
                                                <span className={`${muted("text-muted-foreground")} truncate text-[10px] leading-[14px]`} style={{ fontFamily: FONT }}>{cat.partnerLocation || "No vendor"}</span>
                                              </div>
                                              <span className="text-muted-foreground/50 text-[10px]">·</span>
                                              <div className="flex items-baseline gap-1">
                                                <span className={`${muted("text-foreground")} text-xs font-semibold leading-[18px]`} style={{ fontFamily: FONT }}>${effectivePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                <span className={`${muted("text-muted-foreground")} text-[10px] leading-[14px]`} style={{ fontFamily: FONT }}>/ {cat.vendorUOM}</span>
                                              </div>
                                              {deactivated && (
                                                <>
                                                  <span className="text-muted-foreground/50 text-[10px]">·</span>
                                                  <span className="text-slate-400 text-[10px] leading-[14px] tabular-nums" style={{ fontFamily: FONT }}>Qty {ci.vendorQty} {cat.vendorUOM}{ci.vendorQty === 1 ? "" : "s"}</span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Inactive footer — one amber strip with the reason + the only allowed action (Remove). */}
                                        {deactivated ? (
                                          <div className="flex items-center gap-3 px-3 py-2 border-t" style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }} role="status">
                                            <CircleSlash className="size-3.5 shrink-0" style={{ color: "#D97706" }} />
                                            <div className="flex-1 min-w-0" style={{ fontFamily: FONT, color: "#92400E" }}>
                                              <div className="text-xs font-semibold leading-[17px]">No longer available to order</div>
                                              <div className="text-[11px] leading-[16px]">
                                                This item is inactive. Remove it from your cart to continue.
                                              </div>
                                            </div>
                                            <button
                                              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-white text-xs font-medium transition-colors cursor-pointer hover:bg-amber-100 shrink-0"
                                              style={{ fontFamily: FONT, color: "#92400E", borderColor: "#FDE68A" }}
                                              onClick={() => removeFromCart(cat.id)}
                                            >
                                              <Trash2 className="size-3.5" /> Remove
                                            </button>
                                          </div>
                                        ) : (
                                        /* Bottom action bar — qty stepper + actions */
                                        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/30">
                                          <div className="flex items-center gap-2.5">
                                            <QuantityStepperInput
                                              value={ci.vendorQty}
                                              serialized={isSerializedCatalogItem(cat)}
                                              onChange={(nextQty) => setCartVendorQty(cat.id, nextQty)}
                                              ariaLabel={`${cat.itemNumber} quantity`}
                                            />
                                            <span className="text-muted-foreground text-[11px] leading-[15px]" style={{ fontFamily: FONT }}>{cat.vendorUOM}{ci.vendorQty === 1 ? "" : "s"}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button
                                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/60 transition-colors cursor-pointer"
                                              onClick={() => _handleEditCartItem(cat.id)}
                                              title="Edit item details"
                                            >
                                              <Pencil className="size-3.5" />
                                            </button>
                                            <button
                                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                              onClick={() => removeFromCart(cat.id)}
                                              title="Remove item"
                                            >
                                              <Trash2 className="size-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* ─────── Right Column: Order Summary ─────── */}
                      {(() => {
                        const checkedCart = cart.filter((c) => checkedItems.has(c.catalogItem.id));
                        const totalCheckedCount = checkedCart.length;
                        const checkedVendorCount = new Set(checkedCart.map((c) => c.catalogItem.partnerLocation || "Unknown Vendor")).size;
                        const checkedItemCount = checkedCart.reduce((sum, i) => sum + i.quantity, 0);
                        const checkedSubtotal = checkedCart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                        const checkedTotalDiscount = checkedCart.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
                        const checkedRulesDiscount = vendorGroups.reduce((s, g) => s + g.checkedRulesDiscount, 0);
                        const checkedRulesPremium = vendorGroups.reduce((s, g) => s + g.checkedRulesPremium, 0);
                        const checkedOneTimeNet = vendorGroups.reduce((s, g) => s + g.checkedOneTimeNet, 0);
                        const checkedGrandTotal = checkedSubtotal - checkedTotalDiscount - checkedRulesDiscount + checkedRulesPremium + checkedOneTimeNet;
                        const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        return (
                      <div className="lg:w-[320px] shrink-0">
                        <div className="lg:sticky lg:top-0">
                          <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                            <div className="px-5 pt-4 pb-3 border-b border-border">
                              <span className="text-foreground text-base font-semibold leading-[20px]" style={{ fontFamily: FONT }}>Order Summary</span>
                            </div>

                            <div className="px-5 py-3 flex flex-col gap-2.5 border-b border-border">
                              {vendorGroups.map((g) => (
                                <div key={g.vendor} className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-foreground truncate block text-xs font-medium leading-[16px]" style={{ fontFamily: FONT }}>{g.vendor}</span>
                                    <span className="text-muted-foreground text-[11px] leading-[15px]" style={{ fontFamily: FONT }}>{g.checkedCount} of {g.selectableCount} selected</span>
                                  </div>
                                  <span className="text-foreground shrink-0 text-xs font-semibold leading-[16px]" style={{ fontFamily: FONT }}>${g.checkedTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              ))}
                            </div>

                            <div className="px-5 py-3 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground text-sm leading-[20px]" style={{ fontFamily: FONT }}>Subtotal ({checkedItemCount} units)</span>
                                <span className="text-foreground text-sm font-semibold leading-[20px]" style={{ fontFamily: FONT }}>${checkedSubtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              {checkedTotalDiscount > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-emerald-600 text-sm leading-[20px]" style={{ fontFamily: FONT }}>Discounts</span>
                                  <span className="text-emerald-600 text-sm font-semibold leading-[20px]" style={{ fontFamily: FONT }}>-${checkedTotalDiscount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              )}
                              {checkedRulesDiscount > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-emerald-600 text-sm leading-[20px]" style={{ fontFamily: FONT }}>Pricing rules (discount)</span>
                                  <span className="text-emerald-600 text-sm font-semibold leading-[20px]" style={{ fontFamily: FONT }}>−${money(checkedRulesDiscount)}</span>
                                </div>
                              )}
                              {checkedRulesPremium > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm leading-[20px]" style={{ fontFamily: FONT, color: "#7C3AED" }}>Pricing rules (premium)</span>
                                  <span className="text-sm font-semibold leading-[20px]" style={{ fontFamily: FONT, color: "#7C3AED" }}>+${money(checkedRulesPremium)}</span>
                                </div>
                              )}
                              {checkedOneTimeNet !== 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm leading-[20px]" style={{ fontFamily: FONT, color: checkedOneTimeNet < 0 ? "#059669" : "#7C3AED" }}>One-time discounts/premiums</span>
                                  <span className="text-sm font-semibold leading-[20px]" style={{ fontFamily: FONT, color: checkedOneTimeNet < 0 ? "#059669" : "#7C3AED" }}>{checkedOneTimeNet < 0 ? "−" : "+"}${money(Math.abs(checkedOneTimeNet))}</span>
                                </div>
                              )}
                              <div className="h-px mt-1 bg-border" />
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-foreground text-base font-semibold leading-[22px]" style={{ fontFamily: FONT }}>Total</span>
                                <span className="text-foreground text-xl font-bold leading-[28px]" style={{ fontFamily: FONT }}>${checkedGrandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>

                            {checkedVendorCount > 1 && (
                              <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-md bg-accent border border-primary/15">
                                <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
                                <span className="text-muted-foreground text-[11px] leading-[15px]" style={{ fontFamily: FONT }}>
                                  <strong className="text-foreground font-semibold" style={{ fontFamily: FONT }}>{checkedVendorCount} separate POs</strong> will be created — one per vendor.
                                </span>
                              </div>
                            )}

                            <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
                              <Button className="w-full h-10 gap-2 text-sm font-medium shadow-sm" style={{ fontFamily: FONT }} onClick={handleCreateAllPOs} disabled={totalCheckedCount === 0}>
                                <FileText className="size-4" />
                                {totalCheckedCount === cart.length ? "Create PO for All Items" : "Create Purchase Orders"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (

          /* ══════════ MAIN CONTENT (search/browse) ══════════ */
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto" style={{ backgroundColor: "#FAFBFC" }}>

            {/* ══════════ EMPTY STATE — search-focused visual ══════════ */}
            {!hasAnySearch && !activePartnerFilter ? (
              <div className="flex-1 flex flex-col items-center justify-center px-5 lg:px-8 py-10">
                <div className="flex flex-col items-center text-center max-w-[400px]">

                  {/* Search icon — clean centered visual */}
                  <div
                    className="flex items-center justify-center rounded-full mb-6"
                    style={{
                      width: "72px",
                      height: "72px",
                      backgroundColor: "hsl(var(--primary-tint))",
                      border: "1.5px solid color-mix(in srgb, hsl(var(--primary)) 15%, transparent)",
                      boxShadow: "0 0 0 8px color-mix(in srgb, hsl(var(--primary)) 4%, transparent)",
                    }}
                  >
                    <Search
                      className="size-8"
                      style={{ color: "hsl(var(--primary))" }}
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Headline */}
                  <h2
                    style={{
                      fontSize: "var(--text-h4)",
                      fontWeight: "var(--font-weight-semibold)",
                      lineHeight: "26px",
                      fontFamily: FONT,
                      color: "hsl(var(--foreground))",
                      letterSpacing: "-0.01em",
                      marginBottom: "6px",
                    }}
                  >
                    Find items for your order
                  </h2>

                  {/* Subtitle */}
                  <p
                    style={{
                      fontSize: "var(--text-label)",
                      fontWeight: "var(--font-weight-normal)",
                      lineHeight: "20px",
                      fontFamily: FONT,
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    Enter a part number, vendor, or point of contact in the search bar above to get started.
                  </p>

                </div>
              </div>
            ) : (
              /* ══════════ ACTIVE SEARCH RESULTS ══════════ */
              <>
            {/* ── Active filter chips ── */}
            {hasActiveFilters && !lockedVendorName && (
              <div className="shrink-0 px-4 pt-4 pb-0 lg:px-6">
                <div className="flex items-center gap-2 pb-3 flex-wrap">
                  {activePartnerFilter && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-border" style={{ fontSize: "12px", fontWeight: "var(--font-weight-normal)", fontFamily: FONT, backgroundColor: "hsl(var(--card))" }}>
                      {activePartnerFilter}
                      {!lockedVendorName && (
                        <button className="text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setSelectedVendor("")}>
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ══════════ ITEM GRID ══════════ */}
            <div className="flex-1 px-4 pt-3 pb-3 lg:px-5 lg:pb-4" style={{ backgroundColor: "#FAFBFC", borderRadius: "var(--radius-lg)" }}>
              {/* Results toolbar: Showing count (left) + Sort / View toggle (right) */}
              <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-muted-foreground" style={s.cardMeta}>
                  Showing{" "}
                  <span className="text-foreground" style={s.cardMetaBold}>
                    {filteredItems.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}
                  </span>{" "}
                  of <span className="text-foreground" style={s.cardMetaBold}>{filteredItems.length}</span> items
                </span>

                <div className="flex items-center gap-2">

                  {/* View segmented control — always visible */}
                  <div className="flex items-center h-8 rounded-[var(--radius)] border border-border/60 overflow-hidden p-0.5 gap-0.5" style={{ backgroundColor: "hsl(var(--muted))" }}>
                    {([
                      { value: "none" as const, label: "Items" },
                      { value: "vendor" as const, label: "By Vendor" },
                      { value: "poc" as const, label: "By POC" },
                    ]).map((opt) => {
                      const isActive = userGroupBy === opt.value;
                      return (
                        <button
                          key={opt.value}
                          className={`flex items-center justify-center px-3 h-full text-nowrap cursor-pointer transition-all duration-150 rounded-[calc(var(--radius)-2px)] ${
                            isActive
                              ? "bg-background text-foreground shadow-[0_1px_3px_0_hsl(var(--foreground)/0.08)]"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          style={{ fontSize: "11px", fontWeight: isActive ? "var(--font-weight-semibold)" : "var(--font-weight-medium)", fontFamily: FONT }}
                          onClick={() => setUserGroupBy(opt.value)}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-[var(--radius-lg)] border border-border" style={{ backgroundColor: "hsl(var(--card))" }}>
                  <div className="flex items-center justify-center size-12 rounded-full" style={{ backgroundColor: "hsl(var(--secondary))" }}>
                    <Package className="size-5 text-foreground/25" strokeWidth={1.5} />
                  </div>
                  <div className="text-center flex flex-col gap-0.5">
                    <span className="text-foreground" style={s.cardTitle}>No items found</span>
                    <span className="text-muted-foreground" style={s.cardMeta}>Try adjusting your search or filters.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasAnySearch && (
                      <Button variant="outline" size="sm" className="h-7 gap-1" style={s.uiLabel} onClick={clearAllFilters}>Clear search</Button>
                    )}
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" className="h-7 gap-1" style={s.uiLabel} onClick={clearAllFilters}>Clear filters</Button>
                    )}
                  </div>
                </div>
              ) : (() => {
                const renderCard = (item: CatalogItem) => {
                    const inCart = isInCart(item.id);
                    const cartItem = getCartItem(item.id);
                    const poQty = existingPOItemQtyByNumber[item.itemNumber] ?? 0;
                    const inPO = isPOMode && poQty > 0;
                    const isAlreadyAdded = isPOMode ? inPO : inCart;
                    const vendorOffers = getVendorOffersForItem(item.id);

                    /* ── Search helpers ── */
                    const qItem = filterItem.trim().toLowerCase();
                    const qVendor = filterVendor.trim().toLowerCase();
                    const qContact = filterContact.trim().toLowerCase();

                    const highlightText = (text: string, query: string) => {
                      if (!query) return <>{text}</>;
                      const idx = text.toLowerCase().indexOf(query);
                      if (idx === -1) return <>{text}</>;
                      return (
                        <>
                          {text.slice(0, idx)}
                          <mark
                            // Partners' canonical yellow-highlight recipe (`Partners/.../ColumnHeaderMenu.tsx:32`)
                            className="bg-transparent px-0.5 rounded-sm"
                            style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
                          >
                            {text.slice(idx, idx + query.length)}
                          </mark>
                          {text.slice(idx + query.length)}
                        </>
                      );
                    };

                    /* Which vendors/contacts match search? */
                    const matchedVendorName = qVendor ? vendorOffers.find((o) => o.vendorName.toLowerCase().includes(qVendor))?.vendorName ?? null : null;
                    const matchedContactInfo = qContact ? (() => {
                      for (const offer of vendorOffers) {
                        const pocs = getVendorContacts(offer.vendorName);
                        const matched = pocs.find((p) => p.name.toLowerCase().includes(qContact));
                        if (matched) return { vendorName: offer.vendorName, contactName: matched.name };
                      }
                      return null;
                    })() : null;
                    const hasDeepMatch = !!(matchedVendorName || matchedContactInfo);

                    /* Auto-expand: when search matches vendor/POC, force-open the accordion + matched vendor POC layer */
                    /* Collapse non-matching vendors when vendor/contact search is active */
                    const isExpanded = expandedItems.has(item.id) || hasDeepMatch;
                    const autoExpandVendorKeys = new Set<string>();
                    const collapseNonMatchingVendors = !!(qVendor || qContact);
                    if (qContact) {
                      vendorOffers.forEach((o) => {
                        const allPocs = getVendorContacts(o.vendorName);
                        if (allPocs.some((poc) => poc.name.toLowerCase().includes(qContact))) {
                          autoExpandVendorKeys.add(`${item.id}__${o.vendorName}`);
                        }
                      });
                    }
                    if (qVendor) {
                      vendorOffers.forEach((o) => {
                        if (o.vendorName.toLowerCase().includes(qVendor)) {
                          autoExpandVendorKeys.add(`${item.id}__${o.vendorName}`);
                        }
                      });
                    }

                    const isSelected = item.partnerLocation;
                    const serialized = isSerializedCatalogItem(item);

                      return (
                      <div
                        key={item.id}
                        data-card
                        className={`group/card relative flex flex-col rounded-[var(--radius-lg)] border overflow-hidden transition-all duration-200 ${
                          isAlreadyAdded ? "border-primary/25" : hasDeepMatch ? "border-primary/15" : "border-border hover:border-foreground/15"
                        }`}
                        style={{
                          backgroundColor: isAlreadyAdded ? "color-mix(in srgb, hsl(var(--primary)) 3%, hsl(var(--card)))" : "hsl(var(--card))",
                          fontFamily: FONT,
                        }}
                      >
                        {/* ═══ Header row — always visible, has its own hover ═══ */}
                          <div
                            className="flex items-start gap-4 px-3 pt-2.5 pb-2.5 transition-colors duration-150 cursor-pointer"
                          style={{ borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isAlreadyAdded
                              ? "color-mix(in srgb, hsl(var(--primary)) 6%, hsl(var(--card)))"
                              : "hsl(var(--accent))";
                            const card = e.currentTarget.closest('[data-card]') as HTMLElement;
                            if (card) card.style.boxShadow = "var(--elevation-sm)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                            const card = e.currentTarget.closest('[data-card]') as HTMLElement;
                            if (card) card.style.boxShadow = "none";
                          }}
                        >
                          {/* Thumbnail — 56×56, opens lightbox */}
                          <div
                            className="relative shrink-0 w-14 h-14 min-w-[56px] min-h-[56px] rounded-[var(--radius)] overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                            style={{ backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
                            onClick={(e) => { e.stopPropagation(); handleThumbnailQuickView(item); }}
                          >
                            <ImageWithFallback src={item.image} alt={item.descriptiveName} className="w-full h-full object-cover" />
                            {/* Multi-image indicator */}
                            {getItemImages(item).length > 1 && (
                              <div className="absolute bottom-0.5 right-0.5 flex items-center justify-center px-1 rounded-sm" style={{ backgroundColor: "rgba(0,0,0,0.6)", fontSize: "7px", color: "white", fontWeight: "var(--font-weight-semibold)", lineHeight: "12px" }}>
                                {getItemImages(item).length}
                              </div>
                            )}
                          </div>

                          {/* LEFT: Part number + description — item
                              identity only. On PR-mode callers (see
                              `disableItemDetail`) we skip the OrderFlow
                              trigger so clicking the identity does
                              nothing; the buyer uses the row's "Add to
                              request" button to stage picks instead. */}
                          <div
                            className={`flex flex-col flex-1 min-w-0 gap-0.5 ${disableItemDetail ? "" : "cursor-pointer"}`}
                            onClick={
                              disableItemDetail
                                ? undefined
                                : () => openItemOrAssignVendor(item)
                            }
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <ItemHoverCard code={item.itemNumber} imageUrl={item.image}>
                                <span className="text-foreground truncate text-sm font-semibold leading-[18px] hover:text-primary transition-colors" onClick={(e) => e.stopPropagation()}>
                                  {highlightText(item.itemNumber, qItem)}
                                </span>
                              </ItemHoverCard>
                              <span
                                className="inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] shrink-0"
                                style={{
                                  backgroundColor: "hsl(var(--secondary))",
                                  color: "hsl(var(--muted-foreground))",
                                  fontSize: "var(--text-3xs)",
                                  fontWeight: "var(--font-weight-semibold)",
                                  lineHeight: "16px",
                                  fontFamily: FONT,
                                }}
                              >
                                {serialized ? "Serialized" : "Non-Serialized"}
                              </span>
                            </div>
                            <TruncatedItemName
                              name={item.descriptiveName}
                              maxChars={80}
                              style={{ fontSize: item.descriptiveName.length <= 80 ? "13px" : "11px", fontWeight: "var(--font-weight-normal)", lineHeight: item.descriptiveName.length <= 80 ? "18px" : "15px" }}
                              className="text-muted-foreground"
                              highlightFn={(text) => highlightText(text, qItem)}
                            />
                          </div>

                          {/* RIGHT: Stacked rows — Row 1: Info, Row 2: Actions */}
                          <div className="flex shrink-0 flex-col items-end gap-2 pl-6 min-w-[280px]" onClick={(e) => e.stopPropagation()}>
                            {/* Row 1 — Information: Vendor + Price */}
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {inPO && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full shrink-0" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)", color: "hsl(var(--primary))", fontSize: "9px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px" }}>
                                  <Check className="size-2.5" /> {itemBadgeLabel ?? "In PO"} · {poQty}
                                </span>
                              )}
                              {/* Pricing rule indicator (buyer feedback
                                  2026-07-20). Small "Rule" pill shows on
                                  catalog cards whenever the item's vendor
                                  has a rule attached to this itemNumber
                                  — discovery signal that the buyer will
                                  see a pricing adjustment on add. Ported
                                  from Sales-Order-V5. */}
                              {SHOW_PO_PRICING_RULES && item.partnerLocation &&
                                getVendorRules(item.partnerLocation).some((r) =>
                                  r.appliesToItemCodes.includes(item.itemNumber),
                                ) && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full shrink-0"
                                  title="This vendor has a pricing rule that applies to this item"
                                  style={{
                                    backgroundColor: "#EFF6FF",
                                    color: "#1B6EF3",
                                    border: "1px solid #BFDBFE",
                                    fontSize: "9px",
                                    fontWeight: "var(--font-weight-semibold)",
                                    lineHeight: "14px",
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Rule
                                </span>
                              )}
                              {item.partnerLocation && item.unitPrice > 0 ? (
                                <>
                                  {groupMode === "item" && (
                                    <>
                                      <span className="inline-flex max-w-[146px] items-center rounded-full border border-border bg-secondary px-1.5 py-0.5 align-middle">
                                        <span className="truncate text-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px" }} title={item.partnerLocation}>
                                          {item.partnerLocation}
                                        </span>
                                      </span>
                                      <span className="text-muted-foreground" style={{ fontSize: "10px" }}>·</span>
                                    </>
                                  )}
                                  <span className="text-foreground whitespace-nowrap" style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px" }}>
                                    ${(item.unitPrice * (1 - item.discount / 100)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  <span className="text-muted-foreground whitespace-nowrap" style={{ fontSize: "9px", fontWeight: "var(--font-weight-normal)", lineHeight: "13px" }}>
                                    per {formatUOM(item.defaultUOM)}
                                  </span>
                                </>
                              ) : !item.partnerLocation ? (
                                <span className="text-muted-foreground italic whitespace-nowrap" style={{ fontSize: "10px" }}>Select a vendor</span>
                              ) : (
                                <span className="text-muted-foreground whitespace-nowrap" style={{ fontSize: "10px" }}>No price</span>
                              )}
                            </div>

                            {/* Row 2 — Actions: buttons or qty input */}
                            <div className="flex items-center justify-end">
                              {isPOMode ? (
                                /* PO mode — "Add Item" / "In PO" */
                                inPO ? (
                                  <span className="inline-flex items-center justify-center gap-1 h-[26px] px-3 rounded-[var(--radius)] border border-primary/20 bg-primary/5 text-primary" style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)" }}>
                                    <Check className="size-3" /> {itemBadgeLabel ?? "In PO"} · {poQty}
                                  </span>
                                ) : (
                                  <button
                                    className="flex items-center justify-center h-[26px] px-3 rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary/90 group-hover/card:shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)" }}
                                    onClick={() => onAddItem?.(item)}
                                    disabled={!onAddItem}
                                  >
                                    {addButtonLabel}
                                  </button>
                                )
                              ) : addedConfirmId === item.id ? (
                                /* "Added ✓" confirmation flash — green pill badge */
                                <span className="inline-flex items-center gap-1.5 h-[26px] px-3 rounded-full" style={{ backgroundColor: "hsl(142 71% 45% / 0.12)", color: "hsl(142 71% 35%)", fontSize: "10px", fontWeight: "var(--font-weight-semibold)" }}>
                                  <Check className="size-3" /> Added to cart
                                </span>
                              ) : addingItemId === item.id ? (
                                /* Qty input mode — text input + live total + "Add" */
                                (() => {
                                  const serializedItem = isSerializedCatalogItem(item);
                                  const qtyStr = addingQtyInput || "0";
                                  const handleAddingQtyChange = (raw: string) => {
                                    if (!isValidQuantityDraft(raw, serializedItem)) return;
                                    setAddingQtyInput(raw);
                                    setAddingQty(getDraftQuantityValue(raw, serializedItem));
                                  };

                                  const commitAddingQty = () => {
                                    setAddingQtyInput(formatQuantityValue(addingQty, serializedItem));
                                  };

                                  const stepInlineQty = (delta: number) => {
                                    const nextQty = stepQuantity(addingQty, delta, serializedItem);
                                    setAddingQty(nextQty);
                                    setAddingQtyInput(formatQuantityValue(nextQty, serializedItem));
                                  };

                                  return (
                                <div className="flex items-center gap-1.5">
                                  {inCart && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full shrink-0 border" style={{ backgroundColor: "hsl(142 71% 45% / 0.08)", color: "hsl(142 71% 30%)", borderColor: "hsl(142 71% 45% / 0.25)", fontSize: "9px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px" }}>
                                      <ShoppingCart className="size-2.5" style={{ color: "hsl(142 71% 35%)" }} /> In Cart ({cartItem?.quantity ?? 0})
                                    </span>
                                  )}
                                  <div className="flex items-center h-[26px] rounded-[var(--radius)] border border-border overflow-hidden bg-background">
                                    <button className="flex items-center justify-center w-6 h-[26px] bg-background hover:bg-secondary transition-colors cursor-pointer" onClick={() => stepInlineQty(-1)}><Minus className="size-3 text-primary" /></button>
                                    <input
                                      type="text"
                                      inputMode={serializedItem ? "numeric" : "decimal"}
                                      value={addingQtyInput}
                                      onChange={(e) => handleAddingQtyChange(e.target.value)}
                                      onKeyDown={(e) => {
                                        preventInvalidQuantityKey(e, serializedItem);
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          confirmInlineAdd(item);
                                        }
                                        if (e.key === "Escape") {
                                          e.preventDefault();
                                          cancelInlineAdd();
                                        }
                                      }}
                                      onBlur={commitAddingQty}
                                      className="min-w-[2.5rem] max-w-[5rem] text-center text-foreground bg-background border-none outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                      style={{ fontSize: qtyStr.length > 7 ? "8px" : qtyStr.length > 5 ? "9px" : "10px", fontWeight: "var(--font-weight-medium)", minWidth: 0, width: `${Math.max(2.8, qtyStr.length * 0.6 + 0.8)}rem` }}
                                      autoFocus
                                      onFocus={(e) => e.target.select()}
                                    />
                                    <button className="flex items-center justify-center w-6 h-[26px] bg-background hover:bg-secondary transition-colors cursor-pointer" onClick={() => stepInlineQty(1)}><Plus className="size-3 text-primary" /></button>
                                  </div>
                                  {/* Live total */}
                                  {item.unitPrice > 0 && addingQty > 0 && (
                                    <span className="text-foreground shrink-0 whitespace-nowrap" style={{ fontSize: "9px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                                      = ${(item.unitPrice * addingQty * item.vendorUOMQty * (1 - item.discount / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  )}
                                  <button
                                    className="flex items-center justify-center gap-1 h-[26px] px-2.5 rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)" }}
                                    onClick={() => confirmInlineAdd(item)}
                                    disabled={addingQty <= 0}
                                  >
                                    Add
                                  </button>
                                  <button className="flex items-center justify-center size-[26px] rounded-[var(--radius)] border border-border text-foreground/30 hover:text-foreground transition-all cursor-pointer" onClick={cancelInlineAdd}>
                                    <X className="size-3" />
                                  </button>
                                </div>
                                  );
                                })()
                              ) : cartItem && isCartItemDeactivated(cartItem) ? (
                                /* Deactivated after it was carted — no more qty, no Buy now. */
                                <span
                                  className="inline-flex items-center gap-1 px-2 rounded-md border whitespace-nowrap"
                                  style={{ height: 26, fontSize: "10px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT, backgroundColor: "#FFFBEB", color: "#92400E", borderColor: "#FDE68A" }}
                                  title="This item is inactive — remove it from your cart"
                                >
                                  <CircleSlash className="size-3" style={{ color: "#D97706" }} /> Inactive · in cart
                                </span>
                              ) : (
                                /* Default state — "Add to cart" + "Buy now" */
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  {inCart && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded-full shrink-0 border" style={{ backgroundColor: "hsl(142 71% 45% / 0.08)", color: "hsl(142 71% 30%)", borderColor: "hsl(142 71% 45% / 0.25)", fontSize: "9px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px" }}>
                                      <ShoppingCart className="size-2.5" style={{ color: "hsl(142 71% 35%)" }} /> In Cart ({cartItem?.quantity ?? 0})
                                    </span>
                                  )}
                                  <button className={`flex items-center justify-center h-[26px] px-3 rounded-[var(--radius)] transition-all cursor-pointer ${
                                    inCart
                                      ? "border border-border bg-background text-foreground/80 hover:bg-secondary hover:border-foreground/20"
                                      : "border border-border text-foreground hover:border-primary hover:text-primary hover:bg-primary/[0.04] group-hover/card:border-foreground/20 group-hover/card:bg-secondary/40"
                                  }`} style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)" }} onClick={() => {
                                    if (!item.partnerLocation) { openAddToCart(item); return; }
                                    startInlineAdd(item);
                                  }}>
                                    {inCart ? "Add More" : "Add to cart"}
                                  </button>
                                  <button className="flex items-center justify-center h-[26px] px-3 rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary/90 group-hover/card:shadow-sm transition-all cursor-pointer" style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)" }} onClick={() => handleBuyNowWithCheck(item)}>
                                    Buy now
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* ── Divider + vendor rows (collapsed or expanded) ── */}
                        {groupMode === "item" && vendorOffers.length > 0 && (isExpanded || (!isExpanded && isSelected)) && (
                          <div className="border-t border-border/60 mx-3 my-2" />
                        )}

                        {/* ── Selected vendor bar — when collapsed, show current vendor ── */}
                        {groupMode === "item" && !isExpanded && isSelected && vendorOffers.length > 0 && (
                          <div
                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                            onClick={(e) => { e.stopPropagation(); toggleItemExpand(item.id); }}
                          >
                            <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground/80 shrink-0" style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", lineHeight: "16px" }}>
                              {vendorOffers.length} vendor{vendorOffers.length !== 1 ? "s" : ""}
                            </span>
                            <ChevronDown
                              className="size-[18px] text-muted-foreground ml-auto shrink-0 transition-transform duration-200"
                            />
                          </div>
                        )}

                        {/* ═══ Expanded accordion — Vendors → POCs ═══ */}
                        {groupMode === "item" && isExpanded && vendorOffers.length > 0 && (
                          <div>
                            {/* Collapse header row */}
                            <div
                              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={(e) => { e.stopPropagation(); toggleItemExpand(item.id); }}
                            >
                              <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground/80 shrink-0" style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", lineHeight: "16px" }}>
                                {vendorOffers.length} vendor{vendorOffers.length !== 1 ? "s" : ""}
                              </span>
                              <ChevronDown
                                className="size-[18px] text-muted-foreground ml-auto shrink-0 transition-transform duration-200"
                                style={{ transform: "rotate(180deg)" }}
                              />
                            </div>
                            {vendorOffers.map((offer, vi) => {
                              const vKey = `${item.id}__${offer.vendorName}`;
                              const isCurrentVendor = offer.vendorName === item.partnerLocation;
                              const vendorMatches = qVendor && offer.vendorName.toLowerCase().includes(qVendor);
                              const vendorPocs = getVendorContacts(offer.vendorName);
                              const contactMatches = qContact && vendorPocs.some((poc) => poc.name.toLowerCase().includes(qContact));
                              const isMatchRow = vendorMatches || contactMatches;
                              /* Hide non-matching vendors when "show only matching" toggle is on */
                              if (hasVendorOrContactSearch && showOnlyMatching && !isMatchRow) return null;
                              /* Collapse non-matching vendors when search is active */
                              /* Non-matching vendors: show collapsed (not hidden) when search is active */
                              const isVendorExpanded = expandedVendors.has(vKey) || autoExpandVendorKeys.has(vKey);
                              const shouldAutoExpandContacts = !!qContact;
                              const isContactsExpanded = expandedVendors.has(`${vKey}__contacts`) || (isVendorExpanded && shouldAutoExpandContacts);

                              return (
                                <div key={vKey}>
                                  {/* ── Vendor row — entire row clickable to select vendor ── */}
                                  <div
                                    className={`group/vendor w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all duration-150 ${
                                      isCurrentVendor
                                        ? "bg-primary/[0.07] cursor-default"
                                        : "cursor-pointer hover:bg-[hsl(213_94%_97%)]"
                                    }`}
                                    style={{
                                      borderTop: vi > 0 ? "1px solid hsl(var(--border))" : "none",
                                      borderLeft: isCurrentVendor ? "3px solid hsl(var(--primary))" : "3px solid transparent",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isCurrentVendor) {
                                        handleCardVendorChange(item, offer);
                                      } else {
                                        toggleVendorExpand(vKey);
                                      }
                                    }}
                                  >
                                    {/* Expand chevron — always toggles POC expand */}
                                    <button
                                      className="flex items-center justify-center size-5 rounded-[var(--radius-sm)] hover:bg-secondary transition-colors cursor-pointer shrink-0"
                                      onClick={(e) => { e.stopPropagation(); toggleVendorExpand(vKey); }}
                                    >
                                      <ChevronRight
                                        className="size-3 text-muted-foreground/50 shrink-0 transition-transform duration-150"
                                        style={{ transform: isVendorExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                                      />
                                    </button>
                                    {/* Vendor avatar */}
                                    <div
                                      className="flex items-center justify-center size-7 rounded-full shrink-0"
                                      style={{
                                        backgroundColor: isCurrentVendor ? "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)" : "hsl(var(--secondary))",
                                        color: isCurrentVendor ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                                        fontSize: "9px",
                                        fontWeight: "var(--font-weight-semibold)",
                                      }}
                                    >
                                      {offer.abbr}
                                    </div>
                                    {/* Vendor info */}
                                    <div className="flex flex-col flex-1 min-w-0 gap-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-foreground truncate" style={{ fontSize: "12px", fontWeight: "var(--font-weight-medium)", lineHeight: "16px" }}>
                                          {vendorMatches ? highlightText(offer.vendorName, qVendor) : offer.vendorName}
                                        </span>
                                        {/* Priority label — always shown */}
                                        <span className="inline-flex items-center px-1 rounded-[var(--radius-sm)] shrink-0" style={{ backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))", fontSize: "8px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px" }}>
                                          {offer.priority === "default" ? "Default" : (() => { const n = parseInt(offer.priority, 10); return n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`; })()}
                                        </span>
                                        {/* Selected badge — after priority */}
                                        {isCurrentVendor && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)] shrink-0" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 15%, transparent)", color: "hsl(var(--primary))", fontSize: "9px", fontWeight: "var(--font-weight-bold)", lineHeight: "14px" }}>
                                            <Check className="size-3" /> Selected
                                          </span>
                                        )}
                                        {!isCurrentVendor && (
                                          <span className="inline-flex items-center shrink-0 text-xs transition-colors duration-150 text-muted-foreground/60 group-hover/vendor:text-primary" style={{ fontSize: "9px", fontFamily: FONT, lineHeight: "14px" }}>
                                            Select
                                          </span>
                                        )}
                                      </div>
                                      {/* POC count preview */}
                                      <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px" }}>
                                        {vendorPocs.length} contact{vendorPocs.length !== 1 ? "s" : ""}
                                        {contactMatches && qContact && (() => {
                                          const matched = vendorPocs.filter((p) => p.name.toLowerCase().includes(qContact));
                                          return matched.length > 0 ? <> · {highlightText(matched[0].name, qContact)}</> : null;
                                        })()}
                                      </span>
                                    </div>
                                    {/* Price */}
                                    <div className="flex flex-col items-end shrink-0 gap-0">
                                      <span className="text-foreground" style={{ fontSize: "12px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px" }}>
                                        ${offer.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                      <span className="text-muted-foreground" style={{ fontSize: "9px", fontWeight: "var(--font-weight-normal)", lineHeight: "13px" }}>
                                        per {offer.uom}
                                      </span>
                                    </div>
                                  </div>

                                  {/* ── Contacts section — collapsed by default, auto-expands only with POC search ── */}
                                  {isVendorExpanded && (() => {
                                    const allContacts = getVendorContacts(offer.vendorName);
                                    if (allContacts.length === 0) return null;
                                    const contactsToggleKey = `${vKey}__contacts`;
                                    return (
                                      <div className="pl-[52px] pr-3 pb-2 pt-0.5">
                                        {/* Collapsed indicator — clickable to expand */}
                                        <div
                                          className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
                                          style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}
                                          onClick={(e) => { e.stopPropagation(); toggleVendorExpand(contactsToggleKey); }}
                                        >
                                          <span>{allContacts.length} contact{allContacts.length !== 1 ? "s" : ""}</span>
                                          <ChevronDown className="size-3 transition-transform duration-150" style={{ transform: isContactsExpanded ? "rotate(0deg)" : "rotate(-90deg)" }} />
                                        </div>
                                        {/* Expanded contacts list */}
                                        {isContactsExpanded && (
                                          <div className="mt-1.5 flex flex-col gap-0 rounded-[var(--radius)] overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                                            {allContacts.map((poc, pi) => {
                                              const pocMatches = qContact && poc.name.toLowerCase().includes(qContact);
                                              const initials = poc.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                                              return (
                                                <div
                                                  key={`${offer.vendorName}__poc__${pi}`}
                                                  className={`flex items-center gap-2.5 px-3 py-2 ${pocMatches ? "bg-primary/[0.04]" : ""}`}
                                                  style={{ borderTop: pi > 0 ? "1px solid hsl(var(--border))" : "none" }}
                                                >
                                                  <div
                                                    className="flex items-center justify-center size-6 rounded-full shrink-0"
                                                    style={{
                                                      backgroundColor: pocMatches ? "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)" : "hsl(var(--secondary))",
                                                      color: pocMatches ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                                                      fontSize: "8px",
                                                      fontWeight: "var(--font-weight-semibold)",
                                                    }}
                                                  >
                                                    {initials}
                                                  </div>
                                                  <div className="flex flex-col flex-1 min-w-0 gap-0">
                                                    <span className="text-foreground truncate" style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", lineHeight: "16px" }}>
                                                      {pocMatches ? highlightText(poc.name, qContact) : poc.name}
                                                    </span>
                                                    <span className="text-muted-foreground truncate" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px" }}>
                                                      {poc.role}
                                                    </span>
                                                  </div>
                                                  <div className="flex flex-col items-end shrink-0 gap-0 min-w-0">
                                                    <span className="text-muted-foreground truncate" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px" }}>
                                                      {poc.email}
                                                    </span>
                                                    <span className="text-muted-foreground truncate" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px" }}>
                                                      {poc.phone}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  };

                  if (groupMode === "item") {
                    return (
                      <div className="flex flex-col gap-1.5">
                        {pageItems.map((item) => renderCard(item))}
                      </div>
                    );
                  }

                  if (groupMode === "vendor") {
                    return (
                      <div className="flex flex-col gap-3">
                        {vendorGroupedItems.map((group) => {
                          const isGroupCollapsed = collapsedGroupSections.has(group.vendor);
                          const qV = filterVendor.trim().toLowerCase();
                          const vendorMatches = qV && group.vendor.toLowerCase().includes(qV);
                          const abbr = VENDOR_ABBR_MAP[group.vendor] || group.vendor.split(/[\s(]+/).filter(Boolean).map(w => w[0]).join("").slice(0, 3).toUpperCase();
                          return (
                            <div key={group.vendor} className="rounded-lg border border-border overflow-hidden shadow-sm" style={{ backgroundColor: "hsl(var(--card))" }}>
                              <div
                                className="flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none hover:bg-accent/40 transition-colors"
                                style={{ borderBottom: isGroupCollapsed ? "none" : "1px solid hsl(var(--border))" }}
                                onClick={() => toggleGroupSection(group.vendor)}
                              >
                                <AvatarCircle name={group.vendor} initials={abbr} size={28} />
                                <span className="text-foreground flex-1 min-w-0 truncate text-sm font-semibold leading-[18px]" style={{ fontFamily: FONT }}>
                                  {vendorMatches ? highlightSearchText(group.vendor, qV) : group.vendor}
                                </span>
                                <span className="text-muted-foreground shrink-0" style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                                  {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                                </span>
                                <ChevronDown className="size-4 text-muted-foreground shrink-0 transition-transform duration-200" style={{ transform: isGroupCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }} />
                              </div>
                              {!isGroupCollapsed && (() => {
                                const contacts = getVendorContacts(group.vendor);
                                return (
                                  <div className="flex flex-col">
                                    {/* Contacts row — collapsed by default, inside the card */}
                                    {contacts.length > 0 && (
                                      <div style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                                        <div
                                          className="flex items-center gap-1.5 px-4 py-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
                                          style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}
                                          onClick={() => toggleGroupContacts(group.vendor)}
                                        >
                                          <span>{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</span>
                                          <ChevronDown className="size-3 transition-transform duration-150" style={{ transform: contactsExpandedGroups.has(group.vendor) ? "rotate(0deg)" : "rotate(-90deg)" }} />
                                        </div>
                                        {contactsExpandedGroups.has(group.vendor) && (
                                          <div className="px-4 pb-2">
                                            <div className="flex flex-col gap-0 rounded-[var(--radius)] overflow-hidden" style={{ border: "1px solid hsl(var(--border))" }}>
                                              {contacts.map((poc, pi) => {
                                                const initials = poc.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                                                return (
                                                  <div key={pi} className="flex items-center gap-2.5 px-3 py-2" style={{ borderTop: pi > 0 ? "1px solid hsl(var(--border))" : "none" }}>
                                                    <UserHoverCard name={poc.name}>
                                                      <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleContactQuickView(poc.name, group.vendor); }}>
                                                        <AvatarCircle name={poc.name} initials={initials} size={24} />
                                                      </div>
                                                    </UserHoverCard>
                                                    <div className="flex flex-col flex-1 min-w-0 gap-0">
                                                      <UserHoverCard name={poc.name}>
                                                        <span className="text-foreground truncate text-[11px] font-medium leading-[16px] cursor-pointer hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); handleContactQuickView(poc.name, group.vendor); }}>{poc.name}</span>
                                                      </UserHoverCard>
                                                      <span className="text-muted-foreground truncate text-[10px] leading-[14px]">{poc.role}</span>
                                                    </div>
                                                    <span className="text-muted-foreground truncate shrink-0 text-[10px] leading-[14px]">{poc.email}</span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {/* Item cards */}
                                    <div className="flex flex-col gap-1.5 p-2">
                                      {group.items.map((item) => renderCard(item))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  // POC mode
                  return (
                    <div className="flex flex-col gap-3">
                      {pocGroupedItems.map((group) => {
                        const groupKey = `poc__${group.pocName}__${group.vendorName}`;
                        const isGroupCollapsed = collapsedGroupSections.has(groupKey);
                        const qC = filterContact.trim().toLowerCase();
                        const pocMatches = qC && group.pocName.toLowerCase().includes(qC);
                        return (
                          <div key={groupKey} className="rounded-lg border border-border overflow-hidden shadow-sm" style={{ backgroundColor: "hsl(var(--card))" }}>
                            <div
                              className="flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none hover:bg-accent/40 transition-colors"
                              style={{ borderBottom: isGroupCollapsed ? "none" : "1px solid hsl(var(--border))" }}
                              onClick={() => toggleGroupSection(groupKey)}
                            >
                              <UserHoverCard name={group.pocName}>
                                <div className="cursor-pointer" onClick={(e) => { e.stopPropagation(); handleContactQuickView(group.pocName, group.vendorName); }}>
                                  <AvatarCircle name={group.pocName} initials={group.pocInitials} size={32} />
                                </div>
                              </UserHoverCard>
                              <div className="flex flex-col flex-1 min-w-0 gap-0">
                                <UserHoverCard name={group.pocName}>
                                  <span className="text-foreground truncate text-sm font-semibold leading-[18px] cursor-pointer hover:text-primary transition-colors" style={{ fontFamily: FONT }} onClick={(e) => { e.stopPropagation(); handleContactQuickView(group.pocName, group.vendorName); }}>
                                    {pocMatches ? highlightSearchText(group.pocName, qC) : group.pocName}
                                  </span>
                                </UserHoverCard>
                                <span className="text-muted-foreground truncate text-[11px] leading-[15px]" style={{ fontFamily: FONT }}>
                                  {group.pocRole} · {group.vendorName}
                                </span>
                              </div>
                              <span className="text-muted-foreground shrink-0" style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
                                {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                              </span>
                              <ChevronDown className="size-4 text-muted-foreground shrink-0 transition-transform duration-200" style={{ transform: isGroupCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }} />
                            </div>
                            {!isGroupCollapsed && (
                              <div className="flex flex-col gap-1.5 p-2">
                                {group.items.map((item) => renderCard(item))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

              {/* ── PAGINATION ── */}
              {filteredItems.length > ITEMS_PER_PAGE && (
                <div className="mt-4 py-3 border-t border-border flex items-center justify-between">
                  <span className="text-muted-foreground" style={s.cardMeta}>Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 px-2 gap-1" style={s.tiny} disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="size-3" /> Prev
                    </Button>
                    {getPageNumbers().map((pg, idx) =>
                      pg === "..." ? (
                        <span key={`dots-${idx}`} className="px-1 text-muted-foreground" style={s.cardMeta}>...</span>
                      ) : (
                        <Button key={pg} variant={pg === currentPage ? "default" : "ghost"} size="sm" className={`size-7 p-0 ${pg !== currentPage ? "text-foreground/40 hover:text-foreground" : ""}`} style={s.tiny} onClick={() => setCurrentPage(pg)}>
                          {pg}
                        </Button>
                      )
                    )}
                    <Button variant="outline" size="sm" className="h-7 px-2 gap-1" style={s.tiny} disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                      Next <ChevronRight className="size-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
              </>
            )}

          </div>
          )}
        </div>

        </DialogContent>
      </Dialog>

      {/* ── UNIFIED ORDER FLOW (replaces ItemDetailModal + BuyNowFlow) ── */}
      <OrderFlow
        open={!!orderFlowItem}
        onOpenChange={(o) => { if (!o) closeOrderFlow(); }}
        item={orderFlowItem ? toFlowItem(orderFlowItem) : null}
        mode={orderFlowMode}
        prefill={orderFlowPrefill}
        onComplete={handleOrderFlowComplete}
      />


      {/* ── ADD NEW VENDOR PICKER (for catalogue cards) ── */}
      <Dialog open={!!addVendorForItem} onOpenChange={(v) => { if (!v) { setAddVendorForItem(null); setAddVendorSearch(""); } }}>
        <DialogContent className="max-w-[420px] p-0 gap-0" style={{ fontFamily: FONT }}>
          <DialogTitle className="sr-only">Add New Vendor</DialogTitle>
          {addVendorForItem && (() => {
            const allSystem = getAllSystemVendorOffersForItem(addVendorForItem);
            const assignedNames = new Set(getVendorOffersForItem(addVendorForItem.id).map(o => o.vendorName));
            const available = allSystem.filter(o => !assignedNames.has(o.vendorName));
            const q = addVendorSearch.toLowerCase();
            const filtered = q ? available.filter(o => o.vendorName.toLowerCase().includes(q) || o.abbr.toLowerCase().includes(q)) : available;
            const nextPriority = getVendorOffersForItem(addVendorForItem.id).length + 1;
            const ordinal = nextPriority === 2 ? "2nd" : nextPriority === 3 ? "3rd" : `${nextPriority}th`;

            return (
              <div className="flex flex-col" style={{ maxHeight: "min(520px, 80vh)" }}>
                <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
                  <div>
                    <span className="text-foreground block" style={{ fontSize: "14px", fontWeight: "var(--font-weight-semibold)", lineHeight: "20px" }}>Add New Vendor</span>
                    <span className="text-muted-foreground block" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "16px" }}>
                      {available.length} vendor{available.length !== 1 ? "s" : ""} available · Will be assigned as {ordinal}
                    </span>
                  </div>
                </div>
                <div className="px-3 pt-2.5 pb-1.5 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      type="text" value={addVendorSearch} onChange={(e) => setAddVendorSearch(e.target.value)}
                      placeholder="Search vendors..."
                      className="w-full h-8 rounded-[var(--radius)] border border-border pl-8 pr-8 text-foreground placeholder:text-muted-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/15"
                      style={{ fontSize: "12px", backgroundColor: "hsl(var(--input-background))", fontFamily: FONT }}
                      autoFocus
                    />
                    {addVendorSearch && (
                      <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" onClick={() => setAddVendorSearch("")}>
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 py-1" style={{ scrollbarWidth: "thin" }}>
                  {filtered.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <span className="text-muted-foreground" style={{ fontSize: "12px" }}>
                        {available.length === 0 ? "All system vendors are already assigned" : "No vendors match your search"}
                      </span>
                    </div>
                  ) : filtered.map((offer) => {
                    const contacts = getVendorContacts(offer.vendorName);
                    return (
                      <button
                        key={offer.vendorName}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 mx-1.5 rounded-[var(--radius)] cursor-pointer transition-all hover:bg-primary/5 text-left"
                        style={{ width: "calc(100% - 12px)" }}
                        onClick={() => handleCatalogueAddVendor(addVendorForItem, offer)}
                      >
                        <div className="flex items-center justify-center size-8 rounded-full bg-secondary border border-border shrink-0">
                          <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{offer.abbr}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground truncate" style={{ fontSize: "13px", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}>{offer.vendorName}</span>
                            <span className="inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] border border-border shrink-0" style={{ fontSize: "9px", fontWeight: "var(--font-weight-medium)", color: "hsl(var(--muted-foreground))", backgroundColor: "hsl(var(--secondary))", lineHeight: "16px" }}>
                              {ordinal}
                            </span>
                          </div>
                          <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px" }}>
                            {contacts[0]?.name ?? "No contact"} · {offer.locations?.[0]?.name ?? "—"}
                          </span>
                        </div>
                        <Plus className="size-4 text-muted-foreground shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── IMAGE LIGHTBOX ── */}
      <ImageLightbox
        open={!!lightboxItem}
        onClose={() => setLightboxItem(null)}
        images={lightboxItem ? getItemImages(lightboxItem) : []}
        partNumber={lightboxItem?.itemNumber ?? ""}
        itemName={lightboxItem?.descriptiveName ?? ""}
      />

      {/* ── QUICK VIEW PANEL (item / contact) — parity with listing ── */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />

    </>
  );
}