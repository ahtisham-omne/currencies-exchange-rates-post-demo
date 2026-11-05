import React, { useState, useCallback, useMemo, useSyncExternalStore, useEffect } from "react";
import BackButton from "./BackButton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ShoppingCart,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Tag,
  ChevronDown,
  ChevronUp,
  FileText,
  ArrowLeft,
  Search,
  Info,
  Package,
  X,
  Check,
  ExternalLink,
  CircleSlash,
} from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import AppShell from "./layout/AppShell";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import PurchaseSearchModal from "./PurchaseSearchModal";
import ItemsCatalogueModal from "./CatalogueModal";
import OrderFlow from "./OrderFlow";
import type { OrderFlowItem, OrderFlowResult, OrderFlowMode, OrderFlowPrefill } from "./OrderFlow";
import { CATALOG, getVendorOffersForItem } from "./catalogData";
import type { CatalogItem } from "./catalogData";
import {
  SHOW_PO_PRICING_RULES,
  getVendorRules,
  computeLineBreakdowns,
  totalDiscount as sumRuleDiscount,
  totalPremium as sumRulePremium,
} from "./poPricingRulesData";
import {
  getCart,
  subscribeToCart,
  addToCart,
  removeFromCart,
  clearCart,
  removeVendorItems,
  setCartVendorQty,
  isCartItemDeactivated,
} from "./cartStore";
import type { GlobalCartItem } from "./cartStore";
import { createPOFromVendorCheckout } from "./poStore";
import { FONT } from "./designTokens";
import TruncatedItemName from "./TruncatedItemName";
import QuickViewPanel, { type QuickViewData } from "./QuickViewPanel";
import QuantityStepperInput from "./QuantityStepperInput";
import ItemStatusChip from "./ItemStatusChip";
import { lineOneTimeNet } from "./poOrderPricing";

/* ═══════════════════════════════════════════════════════════════
   DESIGN CONSTANTS — Partners-aligned (mirrors PO detail page)
   ═══════════════════════════════════════════════════════════════ */

/* Partners-aligned horizontal padding ladder. Same as PO detail page
   (`PurchaseOrderDraft.tsx:136`) so the cart sits on the same page-edge
   rhythm as every other Partners-aligned detail surface. */
const DETAIL_PX = "px-4 lg:px-6 xl:px-8";

/* Slate ladder — Partners hardcodes these instead of going through
   `--muted-foreground` so the colour reads identically across surfaces.
   Mirrors the `C` constant pattern used in `POVersionHistoryTab.tsx`. */
const C = {
  border: "#E2E8F0",   // slate-200
  divider: "#F1F5F9",  // slate-100
  text900: "#0F172A",  // slate-900
  text700: "#334155",  // slate-700
  text600: "#475569",  // slate-600
  text500: "#64748B",  // slate-500
  text400: "#94A3B8",  // slate-400
  muted: "#F8FAFC",    // slate-50
} as const;

/* ═══════════════════════════════════════════════════════════════
   TYPOGRAPHY — CSS variable-bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const T = {
  pageTitle: { fontSize: "var(--text-h3)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "28px", fontFamily: FONT } as React.CSSProperties,
  pageDesc: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  breadcrumb: { fontSize: "12px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "16px", fontFamily: FONT } as React.CSSProperties,
  vendorTitle: { fontSize: "var(--text-base)", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  vendorMeta: { fontSize: "12px", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "16px", fontFamily: FONT } as React.CSSProperties,
  partNum: { fontSize: "14px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  desc: { fontSize: "12px", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "16px", fontFamily: FONT } as React.CSSProperties,
  priceUnit: { fontSize: "12px", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "18px", fontFamily: FONT } as React.CSSProperties,
  meta: { fontSize: "11px", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "15px", fontFamily: FONT } as React.CSSProperties,
  metaMed: { fontSize: "11px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "15px", fontFamily: FONT } as React.CSSProperties,
  lineTotal: { fontSize: "15px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  uiLabel: { fontSize: "12px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "16px", fontFamily: FONT } as React.CSSProperties,
  uiSmall: { fontSize: "11px", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "15px", fontFamily: FONT } as React.CSSProperties,
  badge: { fontSize: "10px", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "16px", fontFamily: FONT } as React.CSSProperties,
  tiny: { fontSize: "10px", fontWeight: "var(--font-weight-medium)" as string, lineHeight: "14px", fontFamily: FONT } as React.CSSProperties,
  sectionLabel: { fontSize: "10px", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "14px", fontFamily: FONT, letterSpacing: "0.05em", textTransform: "uppercase" as const } as React.CSSProperties,
  summaryLabel: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  summaryValue: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  totalLabel: { fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "22px", fontFamily: FONT } as React.CSSProperties,
  totalValue: { fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "28px", fontFamily: FONT } as React.CSSProperties,
  suggestTitle: { fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "20px", fontFamily: FONT } as React.CSSProperties,
  suggestPartNum: { fontSize: "11px", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "15px", fontFamily: FONT } as React.CSSProperties,
  suggestName: { fontSize: "11px", fontWeight: "var(--font-weight-normal)" as string, lineHeight: "15px", fontFamily: FONT } as React.CSSProperties,
  suggestPrice: { fontSize: "12px", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "16px", fontFamily: FONT } as React.CSSProperties,
};

/* ══��════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function catalogToFlowItem(item: CatalogItem): OrderFlowItem {
  return {
    id: item.id, itemNumber: item.itemNumber, descriptiveName: item.descriptiveName,
    image: item.image, unitPrice: item.unitPrice, currentStock: item.currentStock,
    minQuantity: item.minQuantity, shortageDate: item.shortageDate, partnerLocation: item.partnerLocation,
    category: item.category, location: item.location, vendorUOM: item.vendorUOM,
    vendorUOMQty: item.vendorUOMQty, defaultUOM: item.defaultUOM, discount: item.discount,
  };
}

interface VendorGroup {
  vendor: string;
  items: GlobalCartItem[];
  subtotal: number;
  discount: number;
  total: number;
  checkedCount: number;
  /** Lines that can be selected for checkout (excludes deactivated). */
  selectableCount: number;
  deactivatedCount: number;
  checkedSubtotal: number;
  checkedDiscount: number;
  checkedTotal: number;
  checkedRulesDiscount: number;
  checkedRulesPremium: number;
  /** Net of item-level one-time discounts/premiums on checked lines. */
  checkedOneTimeNet: number;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function CartPage() {
  const navigate = useNavigate();
  const cart = useSyncExternalStore(subscribeToCart, getCart, getCart);

  /* ── In-cart search filter ── */
  const [cartSearch, setCartSearch] = useState("");

  /* ── Modal states ── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVendorFilter, setSearchVendorFilter] = useState<string | undefined>(undefined);
  const [vendorCatalogOpen, setVendorCatalogOpen] = useState(false);
  const [browseCatalogOpen, setBrowseCatalogOpen] = useState(false);
  const [vendorCatalogName, setVendorCatalogName] = useState("");
  const [orderFlowOpen, setOrderFlowOpen] = useState(false);
  const [orderFlowItem, setOrderFlowItem] = useState<OrderFlowItem | null>(null);
  const [orderFlowMode, setOrderFlowMode] = useState<OrderFlowMode>("add-to-cart");
  const [orderFlowPrefill, setOrderFlowPrefill] = useState<OrderFlowPrefill | null>(null);
  const [collapsedVendors, setCollapsedVendors] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);

  /* ── Quick-view panel state ──
     Mirrors the canonical thumbnail interaction from `PurchaseOrdersListing`
     (`handleThumbnailClick` at line 750) so clicking the cart-item image
     opens the same side panel everywhere in the app instead of the old
     ImageLightbox carousel. `vendorName` is optional — call sites that have
     vendor context pass it; standalone callers (recently-ordered carousel)
     can omit it and the panel falls back to a neutral dash. */
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  const handleThumbnailClick = useCallback((cat: CatalogItem, vendorName?: string) => {
    setQuickViewData({
      type: "item",
      item: { id: cat.itemNumber, name: cat.itemNumber, imageUrl: cat.image },
      vendorName: vendorName || "—",
    });
  }, []);
  /* ── Multi-PO confirmation modal state ── */
  const [multiPOModal, setMultiPOModal] = useState<{ created: Array<{ id: string; poNumber: string; vendor: string; total: number; itemCount: number }> } | null>(null);
  const [multiPOChecked, setMultiPOChecked] = useState<Set<string>>(new Set());

  /* ── Checkbox selection state — all checked by default ──
     Deactivated lines are never selectable, so they never count toward
     a Create PO action. */
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    () => new Set(cart.filter((c) => !isCartItemDeactivated(c)).map((c) => c.catalogItem.id)),
  );
  const knownIdsRef = React.useRef<Set<string>>(new Set(cart.map((c) => c.catalogItem.id)));

  // Keep checkedItems in sync when cart changes: prune removed + deactivated
  // lines, keep existing lines' state, default brand-new lines to checked.
  useEffect(() => {
    setCheckedItems((prev) => {
      const result = new Set<string>();
      cart.forEach((c) => {
        const id = c.catalogItem.id;
        if (isCartItemDeactivated(c)) return;
        if (prev.has(id) || !knownIdsRef.current.has(id)) result.add(id);
      });
      return result;
    });
    knownIdsRef.current = new Set(cart.map((c) => c.catalogItem.id));
  }, [cart]);

  const deactivatedItems = useMemo(() => cart.filter(isCartItemDeactivated), [cart]);

  const toggleCheck = useCallback((itemId: string) => {
    const line = getCart().find((c) => c.catalogItem.id === itemId);
    if (line && isCartItemDeactivated(line)) return;
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

  const toggleVendorAll = useCallback((vendor: string, items: GlobalCartItem[]) => {
    setCheckedItems((prev) => {
      const ids = items.filter((i) => !isCartItemDeactivated(i)).map((i) => i.catalogItem.id);
      if (ids.length === 0) return prev;
      const allChecked = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => { if (allChecked) next.delete(id); else next.add(id); });
      return next;
    });
  }, []);

  /* ── Vendor groups (filtered by cart search) ── */
  const vendorGroups: VendorGroup[] = useMemo(() => {
    const q = cartSearch.trim().toLowerCase();
    const filteredCart = q
      ? cart.filter((item) => {
          const cat = item.catalogItem;
          return (
            cat.itemNumber.toLowerCase().includes(q) ||
            cat.descriptiveName.toLowerCase().includes(q) ||
            (cat.partnerLocation || "").toLowerCase().includes(q)
          );
        })
      : cart;
    const grouped = new Map<string, GlobalCartItem[]>();
    filteredCart.forEach((item) => {
      const vendor = item.catalogItem.partnerLocation || "Unknown Vendor";
      if (!grouped.has(vendor)) grouped.set(vendor, []);
      grouped.get(vendor)!.push(item);
    });
    return Array.from(grouped.entries()).map(([vendor, items]) => {
      const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const discount = items.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
      const checked = items.filter((i) => checkedItems.has(i.catalogItem.id) && !isCartItemDeactivated(i));
      const deactivatedCount = items.filter(isCartItemDeactivated).length;
      const checkedSubtotal = checked.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const checkedDiscount = checked.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
      /* Pricing rules — buyer feedback 2026-07-20. Compute the rule
         impact for THIS vendor's checked cart items using the vendor's
         rule book. All applicable rules are considered active (no
         per-line deactivation until a PO draft is opened). Net-of-
         static-discount PPU is the base so rules stack correctly. */
      let checkedRulesDiscount = 0;
      let checkedRulesPremium = 0;
      if (SHOW_PO_PRICING_RULES && vendor !== "Unknown Vendor" && checked.length > 0) {
        const vendorRules = getVendorRules(vendor);
        if (vendorRules.length > 0) {
          const linesForCompute = checked.map((i) => ({
            id: i.catalogItem.id,
            itemCode: i.catalogItem.itemNumber,
            orderedQty: i.quantity,
            unitPrice: i.unitPrice * (1 - i.discount / 100),
          }));
          const activation = new Map<string, Set<string>>();
          for (const r of vendorRules) {
            const activeLines = new Set<string>();
            for (const line of linesForCompute) {
              if (r.appliesToItemCodes.includes(line.itemCode)) activeLines.add(line.id);
            }
            if (activeLines.size > 0) activation.set(r.id, activeLines);
          }
          const bds = computeLineBreakdowns(linesForCompute, vendorRules, activation);
          checkedRulesDiscount = sumRuleDiscount(bds);
          checkedRulesPremium = sumRulePremium(bds);
        }
      }
      const checkedOneTimeNet = checked.reduce(
        (s, i) => s + lineOneTimeNet(i.oneTimeAdjustments, i.unitPrice * (1 - i.discount / 100) * i.quantity).net,
        0,
      );
      return {
        vendor,
        items,
        subtotal,
        discount,
        total: subtotal - discount,
        checkedCount: checked.length,
        selectableCount: items.length - deactivatedCount,
        deactivatedCount,
        checkedSubtotal,
        checkedDiscount,
        checkedRulesDiscount,
        checkedRulesPremium,
        checkedOneTimeNet,
        checkedTotal:
          checkedSubtotal - checkedDiscount - checkedRulesDiscount + checkedRulesPremium + checkedOneTimeNet,
      };
    });
  }, [cart, checkedItems, cartSearch]);

  /* ── Totals (checked items only) ── */
  const checkedCart = cart.filter((c) => checkedItems.has(c.catalogItem.id) && !isCartItemDeactivated(c));
  const totalCheckedCount = checkedCart.length;
  const totalCheckedVendors = new Set(checkedCart.map((c) => c.catalogItem.partnerLocation || "Unknown Vendor")).size;
  const itemCount = checkedCart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = checkedCart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const totalDiscount = checkedCart.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
  /* Rule impact rolls up across every vendor group (buyer feedback
     2026-07-20). Each vendorGroups entry already carries the
     vendor-scoped rule impact for its checked items; sum them here. */
  const totalRulesDiscount = vendorGroups.reduce((s, g) => s + g.checkedRulesDiscount, 0);
  const totalRulesPremium = vendorGroups.reduce((s, g) => s + g.checkedRulesPremium, 0);
  const totalOneTimeNet = vendorGroups.reduce((s, g) => s + g.checkedOneTimeNet, 0);
  const grandTotal = subtotal - totalDiscount - totalRulesDiscount + totalRulesPremium + totalOneTimeNet;

  /* ── Suggestions: items from vendors already in cart + same categories ── */
  const suggestions = useMemo(() => {
    const cartVendors = new Set(cart.map((c) => c.catalogItem.partnerLocation));
    const cartCategories = new Set(cart.map((c) => c.catalogItem.category));
    const cartItemIds = new Set(cart.map((c) => c.catalogItem.id));

    // Priority 1: same vendor, not in cart
    const vendorMatches = CATALOG.filter(
      (c) => c.partnerLocation && cartVendors.has(c.partnerLocation) && !cartItemIds.has(c.id)
    );
    // Priority 2: same category from other vendors
    const categoryMatches = CATALOG.filter(
      (c) => c.partnerLocation && !cartVendors.has(c.partnerLocation) && cartCategories.has(c.category) && !cartItemIds.has(c.id)
    );
    // Priority 3: items with discounts from any vendor
    const discountMatches = CATALOG.filter(
      (c) => c.partnerLocation && c.discount > 0 && !cartItemIds.has(c.id) && !cartVendors.has(c.partnerLocation)
    );

    // Deduplicate and take up to 9
    const seen = new Set<string>();
    const result: CatalogItem[] = [];
    for (const item of [...vendorMatches, ...categoryMatches, ...discountMatches]) {
      if (!seen.has(item.id) && result.length < 9) {
        seen.add(item.id);
        result.push(item);
      }
    }
    return result;
  }, [cart]);

  /* ── Toggle vendor collapse ── */
  const toggleVendor = (vendor: string) => {
    setCollapsedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(vendor)) next.delete(vendor); else next.add(vendor);
      return next;
    });
  };

  /* ── Edit item from cart → open OrderFlow on top ── */
  const handleEditItem = useCallback((itemId: string) => {
    const ci = cart.find((c) => c.catalogItem.id === itemId);
    if (!ci || isCartItemDeactivated(ci)) return;
    setOrderFlowMode("edit-cart");
    setOrderFlowPrefill({
      vendorQty: ci.vendorQty,
      shipmentMethod: ci.shipmentMethod,
      needByDate: ci.needByDate,
      promisedShipDate: ci.promisedShipDate,
      inboundLocation: ci.inboundLocation,
      oneTimeAdjustments: ci.oneTimeAdjustments,
    });
    setOrderFlowItem(catalogToFlowItem(ci.catalogItem));
    setOrderFlowOpen(true);
  }, [cart]);

  /* ── Add items for a vendor → open vendor-locked catalogue modal ── */
  const handleAddItemsForVendor = useCallback((vendor: string) => {
    setVendorCatalogName(vendor);
    setVendorCatalogOpen(true);
  }, []);

  /* ── Continue Shopping / Browse Catalog → open catalogue modal ── */
  const handleContinueShopping = useCallback(() => {
    setBrowseCatalogOpen(true);
  }, []);

  /* ── Search modal → item selected → open OrderFlow ── */
  const handleSearchItemSelect = useCallback((item: CatalogItem) => {
    setOrderFlowMode("add-to-cart");
    setOrderFlowPrefill(null);
    setOrderFlowItem(catalogToFlowItem(item));
    setSearchOpen(false);
    setOrderFlowOpen(true);
  }, []);

  /* ── OrderFlow completion ── */
  const handleOrderFlowComplete = useCallback((result: OrderFlowResult) => {
    const catalogRef = CATALOG.find((c) => c.id === result.item.id);
    if (!catalogRef) return;

    addToCart({
      catalogItem: catalogRef,
      vendorQty: result.vendorQty,
      quantity: result.quantity,
      unitPrice: result.unitPrice,
      discount: result.discount,
      shipmentMethod: result.shipmentMethod,
      needByDate: result.needByDate,
      promisedShipDate: result.promisedShipDate,
      expectedDeliveryDate: result.expectedDeliveryDate,
      inboundLocation: result.inboundLocation,
      oneTimeAdjustments: result.oneTimeAdjustments,
    });

    const isEdit = orderFlowMode === "edit-cart";
    toast.success(isEdit ? `${catalogRef.itemNumber} updated` : `${catalogRef.itemNumber} added to cart`, {
      description: `${result.quantity} ${catalogRef.defaultUOM} × $${result.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — $${result.totalPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      style: { fontFamily: FONT },
      duration: 3000,
    });

    setOrderFlowOpen(false);
    setOrderFlowItem(null);
  }, [orderFlowMode]);

  /* ── Checkout vendor → create PO (checked items only) ── */
  const handleCheckoutVendor = useCallback((vendor: string) => {
    const vendorItems = cart.filter(
      (c) => c.catalogItem.partnerLocation === vendor && checkedItems.has(c.catalogItem.id) && !isCartItemDeactivated(c),
    );
    if (vendorItems.length === 0) { toast.error("No items selected for this vendor"); return; }
    const poLineItems = vendorItems.map((c) => ({
      id: c.catalogItem.id, itemNumber: c.catalogItem.itemNumber, descriptiveName: c.catalogItem.descriptiveName,
      image: c.catalogItem.image, unitPrice: c.unitPrice, vendorQty: c.vendorQty,
      vendorUOM: c.catalogItem.vendorUOM, vendorUOMQty: c.catalogItem.vendorUOMQty,
      quantity: c.quantity, defaultUOM: c.catalogItem.defaultUOM, discount: c.discount,
      shipmentMethod: c.shipmentMethod, needByDate: c.needByDate, promisedShipDate: c.promisedShipDate,
      expectedDeliveryDate: c.expectedDeliveryDate,
      inboundLocation: c.inboundLocation, category: c.catalogItem.category,
      oneTimeAdjustments: c.oneTimeAdjustments,
    }));
    const po = createPOFromVendorCheckout(vendor, poLineItems);
    // Remove only checked items from cart
    vendorItems.forEach((c) => removeFromCart(c.catalogItem.id));
    toast.success(`PO ${po.poNumber} created for ${vendor}`, {
      description: `${vendorItems.length} items`,
      style: { fontFamily: FONT },
      duration: 4000,
    });
    navigate(`/purchase-orders/${po.id}`);
  }, [cart, checkedItems, navigate]);

  /* ── Create all POs (checked items only) ── */
  const handleCreateAllPOs = useCallback(() => {
    const checked = cart.filter((c) => checkedItems.has(c.catalogItem.id) && !isCartItemDeactivated(c));
    if (checked.length === 0) { toast.error("No items selected"); return; }
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
        shipmentMethod: c.shipmentMethod, needByDate: c.needByDate, promisedShipDate: c.promisedShipDate,
        expectedDeliveryDate: c.expectedDeliveryDate,
        inboundLocation: c.inboundLocation, category: c.catalogItem.category,
        oneTimeAdjustments: c.oneTimeAdjustments,
      }));
      const po = createPOFromVendorCheckout(vendor, poLineItems);
      /* Use the created PO's computed total (rules + one-times). */
      const total = po.total;
      created.push({ id: po.id, poNumber: po.poNumber, vendor, total, itemCount: items.length });
    });

    // Remove only checked items from cart
    checked.forEach((c) => removeFromCart(c.catalogItem.id));

    if (created.length === 1) {
      toast.success(`PO ${created[0].poNumber} created`, { style: { fontFamily: FONT }, duration: 4000 });
      navigate(`/purchase-orders/${created[0].id}`);
    } else {
      // Show multi-PO confirmation modal
      const allIds = new Set(created.map((c) => c.id));
      setMultiPOChecked(allIds);
      setMultiPOModal({ created });
    }
  }, [cart, checkedItems, navigate]);

  /* ── Add suggestion to cart → open OrderFlow ── */
  const handleSuggestionClick = useCallback((item: CatalogItem) => {
    setOrderFlowMode("add-to-cart");
    setOrderFlowPrefill(null);
    setOrderFlowItem(catalogToFlowItem(item));
    setOrderFlowOpen(true);
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <AppShell>
      {/* Page surface: `bg-slate-50` verbatim from Partners
          (`Partners/.../VendorDetailsPage.tsx:671`) — same surface our PO
          detail page sits on (`PurchaseOrderDraft.tsx:2776`). Previously
          `hsl(var(--secondary))` which resolved one shade darker and made
          the white header card feel muddy against the page. */}
      <div className="flex flex-col h-full bg-slate-50 overflow-y-auto" style={{ fontFamily: FONT }}>

        {/* ══════════ PAGE HEADER ══════════
            White rounded-xl card on slate-50 surface — exact recipe used
            on PO detail page (`PurchaseOrderDraft.tsx:2796-2804`). 44×44
            BackButton + 44×44 primary-tinted icon chip + 16/700 title +
            slate-500 meta pill. Replaces the prior 32×32 icon + h4 title
            + inline meta which read inconsistent with the rest of the
            Partners-aligned surfaces. */}
        <div className="shrink-0 z-10 bg-slate-50">
          <div className={`${DETAIL_PX} pt-3 pb-1 lg:pt-4 lg:pb-1`}>
            <div className="max-w-[1280px] mx-auto w-full">
              <div
                className="rounded-xl"
                style={{
                  background: "hsl(var(--card))",
                  border: `1px solid ${C.border}`,
                  boxShadow:
                    "0 1px 3px 0 rgba(0,0,0,0.04), 0 4px 16px -6px rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
                }}
              >
                {/* Title row */}
                <div className="px-4 lg:px-5" style={{ paddingTop: 12, paddingBottom: 12 }}>
                  <div className="flex items-center justify-between gap-4">
                    {/* Left block — BackButton + icon chip + title + meta pill */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Back link — 44×44 icon-only square (Partners verbatim). */}
                      <BackButton onClick={() => navigate("/purchase-orders")} title="Back to Purchase Orders" />

                      {/* Cart icon chip — 44×44 rounded-xl, primary-tinted, matches PO
                          detail page's FileText chip (`PurchaseOrderDraft.tsx:2832-2844`). */}
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-xl"
                        style={{
                          width: 44,
                          height: 44,
                          backgroundColor: "#EFF6FF" /* Partners vendor-blue tint */,
                          border: "1px solid #BFDBFE",
                          boxShadow:
                            "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                        }}
                      >
                        <ShoppingCart style={{ width: 20, height: 20, color: "#1E40AF" }} strokeWidth={2} />
                      </div>

                      {/* Title + inline summary chip — Partners 16/700/22 vendor-name
                          recipe (`Partners/.../VendorDetailsPage.tsx:774-779`). */}
                      <div className="flex items-center flex-wrap min-w-0" style={{ gap: 8 }}>
                        <h1
                          className="flex-shrink-0 truncate text-foreground"
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            lineHeight: "22px",
                            color: C.text900,
                            fontFamily: FONT,
                            margin: 0,
                          }}
                        >
                          Purchase Order Cart
                        </h1>
                        {cart.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md border tabular-nums"
                            style={{
                              padding: "2px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              lineHeight: 1.35,
                              backgroundColor: "#F8FAFC" /* slate-50 */,
                              color: C.text700,
                              borderColor: C.border,
                              fontFamily: FONT,
                            }}
                          >
                            {vendorGroups.length} vendor{vendorGroups.length !== 1 ? "s" : ""} · {cart.length} item{cart.length !== 1 ? "s" : ""} · {itemCount} unit{itemCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right block — Clear cart (outline-neutral recipe) */}
                    {cart.length > 0 && (
                      <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                        {confirmClear ? (
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--destructive))", fontFamily: FONT }}>
                              Clear all?
                            </span>
                            <button
                              onClick={() => { clearCart(); setConfirmClear(false); }}
                              className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 h-8 px-3"
                              style={{
                                backgroundColor: "hsl(var(--destructive))",
                                color: "hsl(var(--destructive-foreground))",
                                fontSize: 12,
                                fontWeight: 600,
                                lineHeight: 1,
                                fontFamily: FONT,
                                border: "none",
                              }}
                            >
                              Yes, clear
                            </button>
                            <button
                              onClick={() => setConfirmClear(false)}
                              className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0 h-8 px-3"
                              style={{
                                backgroundColor: "hsl(var(--background))",
                                color: C.text700,
                                fontSize: 12,
                                fontWeight: 500,
                                lineHeight: 1,
                                fontFamily: FONT,
                                border: `1px solid ${C.border}`,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmClear(true)}
                            className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0 h-9 px-3.5"
                            style={{
                              backgroundColor: "hsl(var(--background))",
                              color: C.text700,
                              fontSize: 13,
                              fontWeight: 500,
                              lineHeight: 1,
                              fontFamily: FONT,
                              border: `1px solid ${C.border}`,
                              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.03)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#F8FAFC";
                              e.currentTarget.style.color = "hsl(var(--destructive))";
                              e.currentTarget.style.borderColor = "color-mix(in srgb, hsl(var(--destructive)) 30%, transparent)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "hsl(var(--background))";
                              e.currentTarget.style.color = C.text700;
                              e.currentTarget.style.borderColor = C.border;
                            }}
                          >
                            <Trash2 style={{ width: 14, height: 14 }} strokeWidth={2} />
                            Clear cart
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Compact-form search — Partners recipe (h-9, border-border/80,
                      shadow-sm, focus:border-primary focus:ring-2 focus:ring-primary/20).
                      Mirrors the search input used on Partners' detail surfaces. */}
                  <div className="mt-3">
                    <div
                      className="flex items-center gap-2.5 w-full transition-all"
                      style={{
                        height: 36,
                        padding: "0 12px",
                        borderRadius: 8,
                        backgroundColor: cart.length === 0 ? "#F8FAFC" : "hsl(var(--background))",
                        border: `1px solid ${C.border}`,
                        opacity: cart.length === 0 ? 0.6 : 1,
                        boxShadow: cart.length === 0 ? "none" : "0 1px 2px 0 rgba(0,0,0,0.03)",
                      }}
                      onFocus={(e) => {
                        if (cart.length === 0) return;
                        e.currentTarget.style.borderColor = "hsl(var(--primary))";
                        e.currentTarget.style.boxShadow = "0 0 0 3px color-mix(in srgb, hsl(var(--primary)) 20%, transparent)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = C.border;
                        e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(0,0,0,0.03)";
                      }}
                    >
                      <Search style={{ width: 14, height: 14, color: C.text400 }} strokeWidth={2} />
                      <input
                        type="text"
                        placeholder="Search items in cart..."
                        value={cartSearch}
                        onChange={(e) => setCartSearch(e.target.value)}
                        disabled={cart.length === 0}
                        className="flex-1 bg-transparent outline-none disabled:cursor-not-allowed"
                        style={{
                          fontSize: 13,
                          fontWeight: 400,
                          fontFamily: FONT,
                          color: C.text900,
                          lineHeight: 1.4,
                        }}
                      />
                      {cartSearch && (
                        <button
                          className="cursor-pointer transition-colors flex items-center justify-center"
                          style={{ width: 20, height: 20, color: C.text400 }}
                          onClick={() => setCartSearch("")}
                          onMouseEnter={(e) => (e.currentTarget.style.color = C.text700)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = C.text400)}
                          aria-label="Clear search"
                        >
                          <X style={{ width: 14, height: 14 }} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ MAIN CONTENT ══════════
            Body padding ladder mirrors PO detail page
            (`PurchaseOrderDraft.tsx:3357`). Max-width 1280px stays in
            sync with the header card above so the column rhythm reads
            as one surface. */}
        {cart.length === 0 ? (
          /* ── Empty State — Partners PlaceholderTab recipe
                (`PurchaseOrderDraft.tsx` TabPlaceholderPanel).
                slate-400 icon, slate-900 13/600 heading, slate-500 13/400
                description, filled-primary + outline-neutral buttons. */
          <div className={`${DETAIL_PX} pt-3 pb-5`}>
            <div className="max-w-[1280px] mx-auto w-full flex flex-col items-center py-14 gap-4">
              {/* Icon — 64×64 rounded-xl slate-50 chip with slate-400 icon */}
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: 64,
                  height: 64,
                  backgroundColor: "#F8FAFC" /* slate-50 */,
                  border: `1px solid ${C.border}`,
                }}
              >
                <ShoppingCart style={{ width: 32, height: 32, color: C.text400 }} strokeWidth={1.5} />
              </div>
              <div className="text-center flex flex-col gap-1 max-w-md">
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}>
                  Your cart is empty
                </span>
                <span style={{ fontSize: 13, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.5 }}>
                  Start by browsing items or selecting from recently ordered items below.
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={handleContinueShopping}
                  className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 h-9 px-4"
                  style={{
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1,
                    fontFamily: FONT,
                    border: "none",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D0")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--primary))")}
                >
                  <Search style={{ width: 14, height: 14 }} strokeWidth={2} />
                  Browse Items
                </button>
                <button
                  onClick={() => navigate("/purchase-orders")}
                  className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0 h-9 px-4"
                  style={{
                    backgroundColor: "hsl(var(--background))",
                    color: C.text700,
                    fontSize: 13,
                    fontWeight: 500,
                    lineHeight: 1,
                    fontFamily: FONT,
                    border: `1px solid ${C.border}`,
                    boxShadow: "0 1px 2px 0 rgba(0,0,0,0.03)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--background))")}
                >
                  <ArrowLeft style={{ width: 14, height: 14 }} strokeWidth={2} />
                  Back to Orders
                </button>
              </div>

              {/* ── Recently Ordered Items ── */}
              {CATALOG.filter((c) => c.partnerLocation).length > 0 && (
                <div className="w-full max-w-[1080px] mt-10">
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: C.text400,
                      fontFamily: FONT,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Recently ordered
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                    {CATALOG.filter((c) => c.partnerLocation).slice(0, 6).map((item) => (
                      <RecentlyOrderedCard
                        key={item.id}
                        item={item}
                        onAddToCart={(it) => handleSuggestionClick(it)}
                        onBuyNow={(it) => {
                          setOrderFlowMode("buy-now" as OrderFlowMode);
                          setOrderFlowPrefill(null);
                          setOrderFlowItem(catalogToFlowItem(it));
                          setOrderFlowOpen(true);
                        }}
                        onImageClick={handleThumbnailClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Cart with items ── */
          <div className={`${DETAIL_PX} pt-3 pb-5`}>
            <div className="max-w-[1280px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-5 items-start">

              {/* ─────── Left Column: Vendor groups ───────
                  Each vendor group is a rounded-xl card matching the PO
                  detail line-items card recipe — slate-200 border, white
                  bg, soft Partners shadow. */}
              <div className="flex flex-col gap-4 min-w-0">
                {vendorGroups.map((group) => {
                  const isCollapsed = collapsedVendors.has(group.vendor);
                  const allSelected = group.selectableCount > 0 && group.checkedCount === group.selectableCount;

                  return (
                    <div
                      key={group.vendor}
                      className="rounded-xl overflow-hidden"
                      style={{
                        backgroundColor: "hsl(var(--card))",
                        border: `1px solid ${C.border}`,
                        boxShadow:
                          "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                      }}
                    >
                      {/* Vendor header — Partners-aligned. Checkbox + 36×36 Building2
                          chip + title (14/600/20) + slate-500 meta + action buttons
                          (w-8 h-8 rounded-md slate-500 icon hover:bg-muted/60) +
                          filled-primary CTA. */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors"
                        style={{ borderBottom: isCollapsed ? "none" : `1px solid ${C.divider}` }}
                        onClick={() => toggleVendor(group.vendor)}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFBFD")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        {/* Select-all checkbox */}
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={allSelected ? true : group.checkedCount > 0 ? "indeterminate" : false}
                            onCheckedChange={() => toggleVendorAll(group.vendor, group.items)}
                            disabled={group.selectableCount === 0}
                            className="size-[18px]"
                            aria-label={allSelected ? "Deselect all" : "Select all"}
                          />
                        </div>

                        {/* Vendor icon chip — 36×36 rounded-lg, slate-50 bg, slate-400 icon */}
                        <div
                          className="flex items-center justify-center shrink-0 rounded-lg"
                          style={{
                            width: 36,
                            height: 36,
                            backgroundColor: "#F8FAFC" /* slate-50 */,
                            border: `1px solid ${C.border}`,
                          }}
                        >
                          <Building2 style={{ width: 16, height: 16, color: C.text400 }} strokeWidth={1.75} />
                        </div>

                        {/* Vendor name + count chip + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="truncate"
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                lineHeight: "20px",
                                color: C.text900,
                                fontFamily: FONT,
                              }}
                            >
                              {group.vendor}
                            </span>
                            <span
                              className="inline-flex items-center rounded-md border shrink-0 tabular-nums"
                              style={{
                                padding: "1px 6px",
                                fontSize: 10,
                                fontWeight: 600,
                                lineHeight: 1.4,
                                backgroundColor: "#F8FAFC",
                                color: C.text700,
                                borderColor: C.border,
                                fontFamily: FONT,
                              }}
                            >
                              {group.checkedCount}/{group.selectableCount} selected
                            </span>
                            {group.deactivatedCount > 0 && (
                              <DeactivatedTag label={`${group.deactivatedCount} inactive`} />
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span style={{ fontSize: 12, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}>
                              Subtotal:{" "}
                              <span className="tabular-nums" style={{ fontWeight: 600, color: C.text900 }}>
                                ${group.checkedTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </span>
                            {group.checkedDiscount > 0 && (
                              <span
                                className="tabular-nums"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: "#065F46" /* emerald-700 */,
                                  fontFamily: FONT,
                                  lineHeight: 1.4,
                                }}
                              >
                                Discount ${group.checkedDiscount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons — Partners recipe (w-8 h-8 rounded-md slate-500 icon hover:bg-muted/60) */}
                        <div className="flex items-center shrink-0" style={{ gap: 8 }}>
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAddItemsForVendor(group.vendor); }}
                                className="flex items-center justify-center rounded-md cursor-pointer transition-colors"
                                style={{ width: 32, height: 32, backgroundColor: "transparent" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F1F5F9")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                aria-label="Add items"
                              >
                                <Plus style={{ width: 14, height: 14, color: C.text500 }} strokeWidth={2} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={6}>Add items</TooltipContent>
                          </Tooltip>

                          {/* Secondary CTA — Partners' canonical outline-button
                              token (the recipe applied to every Cancel button
                              in CreatePartnerModal / CreatePartnerGroupModal /
                              PricingRulesTab):
                                border-border + text-slate-500 + no shadow
                                hover: bg-accent + text-foreground +
                                       border-slate-300
                              Per-vendor Create PO is subordinate; the page-
                              level "Create Purchase Orders" footer button is
                              the primary CTA. */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCheckoutVendor(group.vendor); }}
                            disabled={group.checkedCount === 0}
                            className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0 h-9 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: "hsl(var(--background))",
                              color: C.text500,
                              fontSize: 13,
                              fontWeight: 500,
                              lineHeight: 1,
                              fontFamily: FONT,
                              border: `1px solid ${C.border}`,
                            }}
                            onMouseEnter={(e) => {
                              if (e.currentTarget.disabled) return;
                              e.currentTarget.style.backgroundColor = "hsl(var(--accent))";
                              e.currentTarget.style.color = "hsl(var(--foreground))";
                              e.currentTarget.style.borderColor = "#CBD5E1";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "hsl(var(--background))";
                              e.currentTarget.style.color = C.text500;
                              e.currentTarget.style.borderColor = C.border;
                            }}
                            title={`Create PO for ${group.vendor}`}
                          >
                            <FileText style={{ width: 14, height: 14 }} strokeWidth={2} />
                            <span className="hidden sm:inline">Create PO ({group.checkedCount})</span>
                          </button>

                          {/* Collapse chevron — slate-400, matches Partners */}
                          {isCollapsed ? (
                            <ChevronDown style={{ width: 16, height: 16, color: C.text400 }} strokeWidth={2} />
                          ) : (
                            <ChevronUp style={{ width: 16, height: 16, color: C.text400 }} strokeWidth={2} />
                          )}
                        </div>
                      </div>

                      {/* Vendor items */}
                      {!isCollapsed && (
                        <div className="flex flex-col gap-0 px-3 pt-2 pb-2">
                          {group.items.map((ci) => (
                            <CartLineItemCard
                              key={ci.catalogItem.id}
                              item={ci}
                              checked={checkedItems.has(ci.catalogItem.id)}
                              deactivated={isCartItemDeactivated(ci)}
                              onToggleCheck={() => toggleCheck(ci.catalogItem.id)}
                              onEdit={() => handleEditItem(ci.catalogItem.id)}
                              onRemove={() => removeFromCart(ci.catalogItem.id)}
                              onUpdateQty={(nextQty) => setCartVendorQty(ci.catalogItem.id, nextQty)}
                              onImageClick={() => handleThumbnailClick(ci.catalogItem, group.vendor)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ── Suggestions Section ── */}
                {suggestions.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package style={{ width: 14, height: 14, color: C.text500 }} strokeWidth={1.75} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}>
                          Items you might need
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {suggestions.map((item) => (
                        <RecentlyOrderedCard
                          key={item.id}
                          item={item}
                          onAddToCart={handleSuggestionClick}
                          onBuyNow={(it) => {
                            setOrderFlowMode("buy-now" as OrderFlowMode);
                            setOrderFlowPrefill(null);
                            setOrderFlowItem(catalogToFlowItem(it));
                            setOrderFlowOpen(true);
                          }}
                          onImageClick={handleThumbnailClick}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ─────── Right Column: Order Summary (sticky) ─────── */}
              <div className="min-w-0">
                <div className="lg:sticky lg:top-3">
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{
                      backgroundColor: "hsl(var(--card))",
                      border: `1px solid ${C.border}`,
                      boxShadow:
                        "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* Summary header — 14/600 title, slate-100 divider */}
                    <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.divider}` }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: "20px" }}>
                        Order Summary
                      </span>
                    </div>

                    {/* Vendor breakdown — slate-700 label / slate-900 value */}
                    <div className="px-5 py-3 flex flex-col gap-2.5" style={{ borderBottom: `1px solid ${C.divider}` }}>
                      {vendorGroups.map((g) => (
                        <div key={g.vendor} className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="truncate block" style={{ fontSize: 12, fontWeight: 500, color: C.text700, fontFamily: FONT, lineHeight: 1.4 }}>
                              {g.vendor}
                            </span>
                            <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}>
                              {g.checkedCount} of {g.selectableCount} selected
                            </span>
                          </div>
                          <span className="shrink-0 tabular-nums" style={{ fontSize: 12, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}>
                            ${g.checkedTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="px-5 py-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 13, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}>
                          Subtotal (<span className="tabular-nums">{itemCount}</span> units)
                        </span>
                        <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}>
                          ${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: 13, fontWeight: 400, color: "#065F46" /* emerald-700 */, fontFamily: FONT, lineHeight: 1.4 }}>
                            Discounts
                          </span>
                          <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: "#065F46", fontFamily: FONT, lineHeight: 1.4 }}>
                            -${totalDiscount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {/* Pricing rules — buyer feedback 2026-07-20. Cart
                          aggregates each vendor group's rule impact.
                          Discount row rendered in emerald; premium in
                          amber. Both silent when zero. */}
                      {totalRulesDiscount > 0 && (
                        <div className="flex items-center justify-between">
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{ fontSize: 13, fontWeight: 400, color: "#065F46", fontFamily: FONT, lineHeight: 1.4 }}
                          >
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                color: "#1B6EF3",
                                backgroundColor: "#EFF6FF",
                                border: "1px solid #BFDBFE",
                                padding: "1px 5px",
                                borderRadius: 3,
                                lineHeight: 1,
                                letterSpacing: 0.2,
                                textTransform: "uppercase",
                              }}
                            >
                              Rules
                            </span>
                            Pricing rules (discount)
                          </span>
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 13, fontWeight: 600, color: "#065F46", fontFamily: FONT, lineHeight: 1.4 }}
                          >
                            −${totalRulesDiscount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {totalRulesPremium > 0 && (
                        <div className="flex items-center justify-between">
                          <span
                            className="inline-flex items-center gap-1.5"
                            style={{ fontSize: 13, fontWeight: 400, color: "#B45309", fontFamily: FONT, lineHeight: 1.4 }}
                          >
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                color: "#1B6EF3",
                                backgroundColor: "#EFF6FF",
                                border: "1px solid #BFDBFE",
                                padding: "1px 5px",
                                borderRadius: 3,
                                lineHeight: 1,
                                letterSpacing: 0.2,
                                textTransform: "uppercase",
                              }}
                            >
                              Rules
                            </span>
                            Pricing rules (premium)
                          </span>
                          <span
                            className="tabular-nums"
                            style={{ fontSize: 13, fontWeight: 600, color: "#B45309", fontFamily: FONT, lineHeight: 1.4 }}
                          >
                            +${totalRulesPremium.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {/* One-time discounts/premiums (item-level, set in the
                          Items Detail Modal). Same colour grammar as the
                          rules rows: green when net-negative, violet when
                          net-positive. Silent when zero. */}
                      {totalOneTimeNet !== 0 && (
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: 13, fontWeight: 400, color: totalOneTimeNet < 0 ? "#065F46" : "#7C3AED", fontFamily: FONT, lineHeight: 1.4 }}>
                            One-time discounts/premiums
                          </span>
                          <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: totalOneTimeNet < 0 ? "#065F46" : "#7C3AED", fontFamily: FONT, lineHeight: 1.4 }}>
                            {totalOneTimeNet < 0 ? "−" : "+"}${Math.abs(totalOneTimeNet).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      <div className="h-px mt-1" style={{ backgroundColor: C.divider }} />
                      <div className="flex items-center justify-between pt-1">
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: "22px" }}>Total</span>
                        <span className="tabular-nums" style={{ fontSize: 20, fontWeight: 700, color: C.text900, fontFamily: FONT, lineHeight: "28px" }}>
                          ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Multi-vendor info — white card + Vendor-blue icon chip, matching
                        the banner pattern used on the PO detail page. */}
                    {vendorGroups.length > 1 && totalCheckedVendors > 1 && (
                      <div
                        className="mx-4 mb-3 flex items-start gap-3 rounded-md border bg-white shadow-sm px-3 py-2.5"
                        style={{ borderColor: C.border }}
                      >
                        <div
                          className="flex items-center justify-center shrink-0 rounded-md border"
                          style={{ width: 24, height: 24, backgroundColor: "#EFF6FF", borderColor: "#BFDBFE", marginTop: 1 }}
                        >
                          <Info style={{ width: 12, height: 12, color: "#1E40AF" }} strokeWidth={2} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 400, color: C.text600, fontFamily: FONT, lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 600, color: C.text900 }} className="tabular-nums">
                            {totalCheckedVendors} separate POs
                          </span>{" "}
                          will be created — one per vendor.
                        </span>
                      </div>
                    )}

                    {/* Primary CTA — Partners filled-primary recipe (h-9 px-4 13/600 shadow-sm) */}
                    <div className="px-4 pb-4 pt-1">
                      <button
                        onClick={handleCreateAllPOs}
                        disabled={totalCheckedCount === 0}
                        className="w-full rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm h-9 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: "hsl(var(--primary))",
                          color: "hsl(var(--primary-foreground))",
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: 1,
                          fontFamily: FONT,
                          border: "none",
                        }}
                        onMouseEnter={(e) => {
                          if (e.currentTarget.disabled) return;
                          e.currentTarget.style.backgroundColor = "#0862D0";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "hsl(var(--primary))";
                        }}
                      >
                        <FileText style={{ width: 14, height: 14 }} strokeWidth={2} />
                        {totalCheckedCount === cart.length - deactivatedItems.length && deactivatedItems.length === 0
                          ? "Create PO for All Items"
                          : "Create Purchase Orders"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Vendor Add Modal (listing cart + button) ── */}
      <ItemsCatalogueModal
        open={vendorCatalogOpen}
        onClose={() => setVendorCatalogOpen(false)}
        initialVendor={vendorCatalogName}
        lockedVendor={vendorCatalogName}
        headingOverride={vendorCatalogName ? `Add Items from ${vendorCatalogName}` : undefined}
      />

      {/* ── Browse Catalog Modal (empty state + continue shopping) ── */}
      <ItemsCatalogueModal
        open={browseCatalogOpen}
        onClose={() => setBrowseCatalogOpen(false)}
      />

      {/* ── Search Modal ── */}
      <PurchaseSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onItemSelect={handleSearchItemSelect}
        onVendorSelect={(vendor) => { setSearchOpen(false); }}
        onBrowseCatalog={() => { setSearchOpen(false); }}
        vendorFilter={searchVendorFilter}
      />

      {/* ── OrderFlow Modal — opens on top of cart page ── */}
      {orderFlowItem && (
        <OrderFlow
          open={orderFlowOpen}
          onOpenChange={(v) => { setOrderFlowOpen(v); if (!v) setOrderFlowItem(null); }}
          item={orderFlowItem}
          mode={orderFlowMode}
          prefill={orderFlowPrefill}
          onComplete={handleOrderFlowComplete}
        />
      )}

      {/* ── Multi-PO Confirmation Modal — Partners white-card + icon-chip
              recipe matching the PO detail banners. */}
      <Dialog open={!!multiPOModal} onOpenChange={(open) => { if (!open) setMultiPOModal(null); }}>
        <DialogContent
          className="sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl"
          style={{
            fontFamily: FONT,
            border: `1px solid ${C.border}`,
            boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
          }}
        >
          {multiPOModal && (() => {
            const { created } = multiPOModal;
            const checkedCount = created.filter((c) => multiPOChecked.has(c.id)).length;
            return (
              <>
                {/* Header — emerald icon chip + Partners typography */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.divider}` }}>
                  <div
                    className="flex items-center justify-center shrink-0 rounded-md border"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: "#ECFDF5" /* emerald-50 */,
                      borderColor: "#A7F3D0" /* emerald-200 */,
                    }}
                  >
                    <Check style={{ width: 18, height: 18, color: "#065F46" /* emerald-700 */ }} strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle
                      style={{ fontSize: 15, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}
                    >
                      Purchase Orders Created
                    </DialogTitle>
                    <DialogDescription
                      className="mt-0.5"
                      style={{ fontSize: 12, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.45 }}
                    >
                      <span className="tabular-nums">{created.length}</span> purchase orders have been created — one per vendor.
                    </DialogDescription>
                  </div>
                </div>

                {/* PO list */}
                <div className="px-5 py-3 flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
                  {created.map((po) => {
                    const isChecked = multiPOChecked.has(po.id);
                    return (
                      <label
                        key={po.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isChecked ? "#F8FAFC" : "transparent",
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                        }}
                        onMouseEnter={(e) => {
                          if (!isChecked) e.currentTarget.style.backgroundColor = "#FAFBFD";
                        }}
                        onMouseLeave={(e) => {
                          if (!isChecked) e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => {
                            setMultiPOChecked((prev) => {
                              const next = new Set(prev);
                              if (next.has(po.id)) next.delete(po.id); else next.add(po.id);
                              return next;
                            });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}>
                              {po.poNumber}
                            </span>
                            <span style={{ color: C.text400, fontSize: 11 }}>·</span>
                            <span
                              className="truncate"
                              style={{ fontSize: 12, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}
                            >
                              {po.vendor}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="tabular-nums"
                              style={{ fontSize: 12, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}
                            >
                              ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}>
                              <span className="tabular-nums">{po.itemCount}</span> item{po.itemCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <ExternalLink style={{ width: 13, height: 13, color: C.text400 }} strokeWidth={2} />
                      </label>
                    );
                  })}
                </div>

                {/* Footer — Partners outline-neutral + filled-primary recipe */}
                <div
                  className="flex items-center justify-end gap-2 px-5 py-3"
                  style={{ borderTop: `1px solid ${C.divider}`, backgroundColor: "#F8FAFC" }}
                >
                  <button
                    onClick={() => { setMultiPOModal(null); navigate("/purchase-orders"); }}
                    className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0 h-9 px-4"
                    style={{
                      backgroundColor: "hsl(var(--background))",
                      color: C.text700,
                      fontSize: 13,
                      fontWeight: 500,
                      lineHeight: 1,
                      fontFamily: FONT,
                      border: `1px solid ${C.border}`,
                      boxShadow: "0 1px 2px 0 rgba(0,0,0,0.03)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F1F5F9")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--background))")}
                  >
                    <ArrowLeft style={{ width: 14, height: 14 }} strokeWidth={2} />
                    Back to Orders
                  </button>
                  <button
                    disabled={checkedCount === 0}
                    onClick={() => {
                      const selected = created.filter((c) => multiPOChecked.has(c.id));
                      setMultiPOModal(null);
                      if (selected.length === 1) {
                        navigate(`/purchase-orders/${selected[0].id}`);
                      } else {
                        selected.forEach((po) => {
                          window.open(`/purchase-orders/${po.id}`, "_blank");
                        });
                        navigate("/purchase-orders");
                      }
                    }}
                    className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 h-9 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                      fontSize: 13,
                      fontWeight: 600,
                      lineHeight: 1,
                      fontFamily: FONT,
                      border: "none",
                    }}
                    onMouseEnter={(e) => {
                      if (e.currentTarget.disabled) return;
                      e.currentTarget.style.backgroundColor = "#0862D0";
                    }}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--primary))")}
                  >
                    <ExternalLink style={{ width: 14, height: 14 }} strokeWidth={2} />
                    Open Selected{checkedCount > 0 ? ` (${checkedCount})` : ""}
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Quick View Panel ──
            Same component used on `PurchaseOrdersListing` so clicking any
            cart thumbnail surfaces the identical item preview side panel. */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />
    </AppShell>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CART LINE ITEM CARD — matches PO detail LineItemCard design
   ═════════════════════════════════════════════════════════════ */

/* Inactive status — Items v2 `ItemStatusBadge` "Inactive" tokens
   (amber-800 on amber-50, amber-200 border) + its `CircleSlash` icon. */
const INACTIVE = { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", icon: "#D97706" } as const;

/* Grey-out palette for an inactive line — real slate colours, no opacity. */
const MUTED = {
  chipBg: "#F1F5F9",   // slate-100
  chipBorder: "#E2E8F0", // slate-200
  strong: "#64748B",   // slate-500
  text: "#94A3B8",     // slate-400
} as const;

/* Inactive tag used on inactive cart lines + vendor headers. */
function DeactivatedTag({ label = "Inactive" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border shrink-0"
      style={{
        padding: "1px 6px",
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1.4,
        backgroundColor: INACTIVE.bg,
        color: INACTIVE.text,
        borderColor: INACTIVE.border,
        fontFamily: FONT,
      }}
    >
      <CircleSlash style={{ width: 10, height: 10, color: INACTIVE.icon }} strokeWidth={2.25} />
      {label}
    </span>
  );
}

function CartLineItemCard({
  item,
  checked,
  deactivated = false,
  onToggleCheck,
  onEdit,
  onRemove,
  onUpdateQty,
  onImageClick,
}: {
  item: GlobalCartItem;
  checked: boolean;
  /** Hard block — grayed out, unselectable, qty/edit locked; only Remove works. */
  deactivated?: boolean;
  onToggleCheck: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onUpdateQty: (nextQty: number) => void;
  onImageClick?: () => void;
}) {
  const cat = item.catalogItem;
  const effectivePrice = item.unitPrice * (1 - item.discount / 100);

  /* Serialization derived from item id hash — matches modal cart */
  const hash = cat.id.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const serialized = hash % 3 === 0;
  /* Inactive lines are greyed with real slate colours (no opacity). */
  const tx = (normal: string) => (deactivated ? MUTED.text : normal);

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-150 mb-2"
      style={{
        backgroundColor: deactivated || checked ? "hsl(var(--card))" : "#FAFBFD",
        fontFamily: FONT,
        border: `1px solid ${deactivated ? INACTIVE.border : C.border}`,
        opacity: deactivated || checked ? 1 : 0.65,
      }}
    >
      {/* ── Main row ── */}
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Checkbox — deactivated lines can never be selected for a PO */}
        <div className="shrink-0 mt-5">
          {deactivated ? (
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-not-allowed">
                  <Checkbox checked={false} disabled className="size-[18px] disabled:opacity-100 bg-slate-200 border-slate-300" aria-label="Inactive item can't be selected" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Inactive items can't be selected for a PO</TooltipContent>
            </Tooltip>
          ) : (
            <Checkbox
              checked={checked}
              onCheckedChange={onToggleCheck}
              className="size-[18px]"
              aria-label={checked ? "Deselect item" : "Select item"}
            />
          )}
        </div>
        {/* Thumbnail — 64×64 */}
        <div
          className={`relative shrink-0 w-16 h-16 min-w-16 min-h-16 overflow-hidden transition-all ${deactivated ? "cursor-default" : "cursor-pointer"}`}
          style={{
            backgroundColor: deactivated ? MUTED.chipBg : "#F8FAFC",
            border: `1px solid ${deactivated ? MUTED.chipBorder : C.border}`,
            borderRadius: 8,
          }}
          onClick={deactivated ? undefined : onImageClick}
          onMouseEnter={(e) => {
            if (deactivated) return;
            e.currentTarget.style.borderColor = "color-mix(in srgb, hsl(var(--primary)) 35%, transparent)";
            e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, hsl(var(--primary)) 18%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <ImageWithFallback
            src={cat.image}
            alt={cat.descriptiveName}
            className="w-full h-full object-cover"
            style={deactivated ? { filter: "grayscale(1)" } : undefined}
          />
        </div>

        {/* Content area — Partners typography ladder */}
        <div className="flex flex-col flex-1 min-w-0 gap-0">
          {/* Row 1: Part number + serialization chip (+ Deactivated tag) */}
          <div className="flex items-center gap-2">
            <span
              className="truncate"
              style={{ fontSize: 13, fontWeight: 600, color: deactivated ? MUTED.strong : C.text900, fontFamily: FONT, lineHeight: 1.4 }}
            >
              {cat.itemNumber}
            </span>
            {/* Shared record-status chip — same Inactive ⓘ + who/when card as
                the PO line, edit modal and Quick View. */}
            {deactivated && <ItemStatusChip inactive={item.deactivation} size="sm" showActive={false} />}
            <span
              className="inline-flex items-center rounded-md border shrink-0"
              style={{
                padding: "1px 6px",
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1.4,
                backgroundColor: deactivated ? MUTED.chipBg : "#F8FAFC",
                color: deactivated ? MUTED.strong : C.text700,
                borderColor: deactivated ? MUTED.chipBorder : C.border,
                fontFamily: FONT,
              }}
            >
              {serialized ? "Serialized" : "Non-Serialized"}
            </span>
          </div>

          {/* Row 2: Item name */}
          <TruncatedItemName
            name={cat.descriptiveName}
            maxChars={50}
            style={{ fontSize: 12, fontWeight: 400, color: tx(C.text600), fontFamily: FONT, lineHeight: 1.45 }}
            className="mt-0.5"
          />

          {/* Row 3: Vendor + price/unit */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <div className="inline-flex items-center gap-1 min-w-0">
              <Building2 style={{ width: 10, height: 10, color: C.text400 }} strokeWidth={1.75} />
              <span
                className="truncate"
                style={{ fontSize: 11, fontWeight: 400, color: tx(C.text500), fontFamily: FONT, lineHeight: 1.4 }}
              >
                {cat.partnerLocation || "No vendor"}
              </span>
            </div>
            <span style={{ color: C.text400, fontSize: 10 }}>·</span>
            <div className="flex items-baseline gap-1 tabular-nums">
              <span style={{ fontSize: 13, fontWeight: 600, color: tx(C.text900), fontFamily: FONT, lineHeight: 1.4 }}>
                ${effectivePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: 10, fontWeight: 400, color: tx(C.text500), fontFamily: FONT, lineHeight: 1.4 }}>
                / {cat.vendorUOM}
              </span>
            </div>
            {deactivated && (
              <>
                <span style={{ color: C.text400, fontSize: 10 }}>·</span>
                <span className="tabular-nums" style={{ fontSize: 11, fontWeight: 400, color: MUTED.text, fontFamily: FONT, lineHeight: 1.4 }}>
                  Qty {item.vendorQty} {cat.vendorUOM}{item.vendorQty === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Inactive footer — one amber strip carrying the reason + the only
            allowed action (Remove). Replaces the qty/edit bar entirely. ── */}
      {deactivated ? (
        <div
          className="flex items-center gap-3 px-3 py-2"
          style={{ backgroundColor: INACTIVE.bg, borderTop: `1px solid ${INACTIVE.border}` }}
          role="status"
        >
          <CircleSlash style={{ width: 14, height: 14, color: INACTIVE.icon, flexShrink: 0 }} strokeWidth={2} />
          <div className="flex-1 min-w-0" style={{ fontFamily: FONT, color: INACTIVE.text }}>
            <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4 }}>
              No longer available to order
            </div>
            <div style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.45 }}>
              This item is inactive. Remove it from your cart to continue.
            </div>
          </div>
          <button
            onClick={onRemove}
            className="rounded-md inline-flex items-center gap-1.5 cursor-pointer shrink-0 h-7 px-2.5 transition-colors"
            style={{
              backgroundColor: "#FFFFFF",
              color: INACTIVE.text,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1,
              fontFamily: FONT,
              border: `1px solid ${INACTIVE.border}`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FEF3C7" /* amber-100 */)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
          >
            <Trash2 style={{ width: 13, height: 13 }} strokeWidth={2} />
            Remove
          </button>
        </div>
      ) : (
      /* ── Bottom action bar — qty stepper + Partners-recipe action buttons ── */
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderTop: `1px solid ${C.divider}`, backgroundColor: "#F8FAFC" /* slate-50 */ }}
      >
        {/* Qty stepper */}
        <div className="flex items-center gap-2.5">
          <QuantityStepperInput
            value={item.vendorQty}
            serialized={serialized}
            onChange={onUpdateQty}
            ariaLabel={`${cat.itemNumber} quantity`}
          />
          <span style={{ fontSize: 11, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}>
            {cat.vendorUOM}{item.vendorQty === 1 ? "" : "s"}
          </span>
        </div>

        {/* Action buttons — Partners recipe: w-8 h-8 rounded-md slate-500 icon hover:bg-muted/60 */}
        <div className="flex items-center" style={{ gap: 4 }}>
          <button
            onClick={onEdit}
            title="Edit item details"
            className="flex items-center justify-center rounded-md cursor-pointer transition-colors"
            style={{ width: 28, height: 28, backgroundColor: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F1F5F9")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Pencil style={{ width: 13, height: 13, color: C.text500 }} strokeWidth={2} />
          </button>
          <button
            onClick={onRemove}
            title="Remove item"
            className="flex items-center justify-center rounded-md cursor-pointer transition-colors"
            style={{ width: 28, height: 28, backgroundColor: "transparent" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#FEF2F2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Trash2
              style={{ width: 13, height: 13, color: C.text500 }}
              strokeWidth={2}
              onMouseEnter={(e) => ((e.currentTarget as SVGElement).style.color = "hsl(var(--destructive))")}
            />
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   RECENTLY ORDERED CARD — catalogue-style card with Add to Cart / Buy Now
   ═══════════════════════════════════════════════════════════════ */

function RecentlyOrderedCard({
  item,
  onAddToCart,
  onBuyNow,
  onImageClick,
}: {
  item: CatalogItem;
  onAddToCart: (item: CatalogItem) => void;
  onBuyNow: (item: CatalogItem) => void;
  onImageClick?: (item: CatalogItem) => void;
}) {
  const effectivePrice = item.unitPrice * (1 - item.discount / 100);
  const vendorOffers = getVendorOffersForItem(item.id);
  const vendorCount = vendorOffers.length;

  /* Serialization derived from item id hash */
  const hash = item.id.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const serialized = hash % 3 === 0;

  return (
    <div
      className="flex flex-col overflow-hidden transition-all group/rc"
      style={{
        fontFamily: FONT,
        backgroundColor: "hsl(var(--card))",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "color-mix(in srgb, hsl(var(--foreground)) 12%, transparent)";
        e.currentTarget.style.boxShadow =
          "0 4px 12px -4px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow =
          "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)";
      }}
    >
      {/* Image */}
      <div
        className="w-full overflow-hidden cursor-pointer"
        style={{ height: 120, backgroundColor: "#F8FAFC" }}
        onClick={() => onImageClick?.(item)}
      >
        <ImageWithFallback
          src={item.image}
          alt={item.descriptiveName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover/rc:scale-105"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 px-3 pt-2.5 pb-2 gap-0">
        {/* Part number + serialization badge */}
        <div className="flex items-center gap-1.5">
          <span
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}
          >
            {item.itemNumber}
          </span>
          <span
            className="inline-flex items-center rounded-md border shrink-0"
            style={{
              padding: "1px 6px",
              fontSize: 10,
              fontWeight: 600,
              lineHeight: 1.4,
              backgroundColor: "#F8FAFC",
              color: C.text700,
              borderColor: C.border,
              fontFamily: FONT,
            }}
          >
            {serialized ? "Serialized" : "Non-Serialized"}
          </span>
        </div>

        {/* Item name */}
        <TruncatedItemName
          name={item.descriptiveName}
          maxChars={40}
          style={{ fontSize: 12, fontWeight: 400, color: C.text600, fontFamily: FONT, lineHeight: 1.45 }}
          className="mt-0.5"
        />

        {/* Price + unit + discount chip */}
        <div className="flex items-baseline gap-1 mt-1.5 tabular-nums">
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text900, fontFamily: FONT, lineHeight: 1.4 }}>
            ${effectivePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ fontSize: 10, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}>
            / {item.defaultUOM}
          </span>
          {item.discount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 rounded-md border ml-1 shrink-0"
              style={{
                padding: "1px 6px",
                fontSize: 10,
                fontWeight: 600,
                lineHeight: 1.4,
                backgroundColor: "#ECFDF5" /* emerald-50 */,
                color: "#065F46" /* emerald-700 */,
                borderColor: "#A7F3D0" /* emerald-200 */,
                fontFamily: FONT,
              }}
            >
              <Tag style={{ width: 9, height: 9 }} strokeWidth={2} /> {item.discount}%
            </span>
          )}
        </div>

        {/* Vendor + vendor count */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {item.partnerLocation && (
            <div className="flex items-center gap-1 min-w-0">
              <Building2 style={{ width: 10, height: 10, color: C.text400 }} strokeWidth={1.75} />
              <span
                className="truncate"
                style={{ fontSize: 11, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}
              >
                {item.partnerLocation}
              </span>
            </div>
          )}
          {vendorCount > 1 && (
            <>
              <span style={{ color: C.text400, fontSize: 10 }}>·</span>
              <span className="shrink-0" style={{ fontSize: 11, fontWeight: 400, color: C.text500, fontFamily: FONT, lineHeight: 1.4 }}>
                {vendorCount} vendors
              </span>
            </>
          )}
        </div>
      </div>

      {/* Action buttons — Partners filled-primary + outline-neutral recipe */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1">
        <button
          onClick={() => onAddToCart(item)}
          className="flex-1 rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm h-8 px-3"
          style={{
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1,
            fontFamily: FONT,
            border: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D0")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--primary))")}
        >
          <ShoppingCart style={{ width: 12, height: 12 }} strokeWidth={2} />
          Add to cart
        </button>
        <button
          onClick={() => onBuyNow(item)}
          className="rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer h-8 px-3"
          style={{
            backgroundColor: "hsl(var(--background))",
            color: C.text700,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1,
            fontFamily: FONT,
            border: `1px solid ${C.border}`,
            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.03)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8FAFC")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--background))")}
        >
          <FileText style={{ width: 12, height: 12 }} strokeWidth={2} />
          Buy now
        </button>
      </div>
    </div>
  );
}