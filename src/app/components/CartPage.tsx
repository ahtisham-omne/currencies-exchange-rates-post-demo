import React, { useState, useCallback, useMemo, useSyncExternalStore, useEffect } from "react";
import BackButton from "./BackButton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ShoppingCart,
  Building2,
  Minus,
  Plus,
  Pencil,
  Trash2,
  Tag,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  FileText,
  ArrowLeft,
  Search,
  Info,
  Package,
  X,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "./ui/button";
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
import { CATALOG, getVendorOffersForItem, getItemImages } from "./catalogData";
import type { CatalogItem } from "./catalogData";
import {
  getCart,
  subscribeToCart,
  addToCart,
  removeFromCart,
  clearCart,
  removeVendorItems,
  setCartVendorQty,
} from "./cartStore";
import type { GlobalCartItem } from "./cartStore";
import { createPOFromVendorCheckout } from "./poStore";
import { FONT } from "./designTokens";
import TruncatedItemName from "./TruncatedItemName";
import ImageLightbox from "./ImageLightbox";
import QuantityStepperInput from "./QuantityStepperInput";

/* ══════════════════���════════════════════════════════════════
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
  checkedSubtotal: number;
  checkedDiscount: number;
  checkedTotal: number;
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

  /* ── Image Lightbox state ── */
  const [lightboxData, setLightboxData] = useState<{ images: string[]; partNumber: string; itemName: string } | null>(null);
  const handleThumbnailClick = useCallback((cat: CatalogItem) => {
    setLightboxData({ images: getItemImages(cat), partNumber: cat.itemNumber, itemName: cat.descriptiveName });
  }, []);
  /* ── Multi-PO confirmation modal state ── */
  const [multiPOModal, setMultiPOModal] = useState<{ created: Array<{ id: string; poNumber: string; vendor: string; total: number; itemCount: number }> } | null>(null);
  const [multiPOChecked, setMultiPOChecked] = useState<Set<string>>(new Set());

  /* ── Checkbox selection state — all checked by default ── */
  const [checkedItems, setCheckedItems] = useState<Set<string>>(() => new Set(cart.map((c) => c.catalogItem.id)));

  // Keep checkedItems in sync when cart changes (new items default to checked, removed items pruned)
  useEffect(() => {
    const cartIds = new Set(cart.map((c) => c.catalogItem.id));
    setCheckedItems((prev) => {
      const next = new Set<string>();
      cart.forEach((c) => {
        const id = c.catalogItem.id;
        // existing items: keep their state; new items: default checked
        if (prev.has(id) || !prev.has(id)) next.add(id);
      });
      // Actually: keep prev checked state, default new to checked
      const result = new Set<string>();
      cart.forEach((c) => {
        if (prev.has(c.catalogItem.id)) result.add(c.catalogItem.id);
        else result.add(c.catalogItem.id); // new → checked
      });
      return result;
    });
  }, [cart]);

  const toggleCheck = useCallback((itemId: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, []);

  const toggleVendorAll = useCallback((vendor: string, items: GlobalCartItem[]) => {
    setCheckedItems((prev) => {
      const ids = items.map((i) => i.catalogItem.id);
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
      const checked = items.filter((i) => checkedItems.has(i.catalogItem.id));
      const checkedSubtotal = checked.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const checkedDiscount = checked.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
      return { vendor, items, subtotal, discount, total: subtotal - discount, checkedCount: checked.length, checkedSubtotal, checkedDiscount, checkedTotal: checkedSubtotal - checkedDiscount };
    });
  }, [cart, checkedItems, cartSearch]);

  /* ── Totals (checked items only) ── */
  const checkedCart = cart.filter((c) => checkedItems.has(c.catalogItem.id));
  const totalCheckedCount = checkedCart.length;
  const totalCheckedVendors = new Set(checkedCart.map((c) => c.catalogItem.partnerLocation || "Unknown Vendor")).size;
  const itemCount = checkedCart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = checkedCart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const totalDiscount = checkedCart.reduce((s, i) => s + i.unitPrice * i.quantity * (i.discount / 100), 0);
  const grandTotal = subtotal - totalDiscount;

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
    if (!ci) return;
    setOrderFlowMode("edit-cart");
    setOrderFlowPrefill({
      vendorQty: ci.vendorQty,
      shipmentMethod: ci.shipmentMethod,
      dueDeliveryDate: ci.dueDeliveryDate,
      inboundLocation: ci.inboundLocation,
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
      dueDeliveryDate: result.dueDeliveryDate,
      inboundLocation: result.inboundLocation,
    });

    const isEdit = orderFlowMode === "edit-cart";
    toast.success(isEdit ? `${catalogRef.itemNumber} updated` : `${catalogRef.itemNumber} added to cart`, {
      description: `${result.quantity} ${catalogRef.defaultUOM} × $${result.unitPrice.toFixed(2)} — $${result.totalPrice.toFixed(2)}`,
      style: { fontFamily: FONT },
      duration: 3000,
    });

    setOrderFlowOpen(false);
    setOrderFlowItem(null);
  }, [orderFlowMode]);

  /* ── Checkout vendor → create PO (checked items only) ── */
  const handleCheckoutVendor = useCallback((vendor: string) => {
    const vendorItems = cart.filter((c) => c.catalogItem.partnerLocation === vendor && checkedItems.has(c.catalogItem.id));
    if (vendorItems.length === 0) { toast.error("No items selected for this vendor"); return; }
    const poLineItems = vendorItems.map((c) => ({
      id: c.catalogItem.id, itemNumber: c.catalogItem.itemNumber, descriptiveName: c.catalogItem.descriptiveName,
      image: c.catalogItem.image, unitPrice: c.unitPrice, vendorQty: c.vendorQty,
      vendorUOM: c.catalogItem.vendorUOM, vendorUOMQty: c.catalogItem.vendorUOMQty,
      quantity: c.quantity, defaultUOM: c.catalogItem.defaultUOM, discount: c.discount,
      shipmentMethod: c.shipmentMethod, dueDeliveryDate: c.dueDeliveryDate,
      inboundLocation: c.inboundLocation, category: c.catalogItem.category,
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
    const checked = cart.filter((c) => checkedItems.has(c.catalogItem.id));
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
        shipmentMethod: c.shipmentMethod, dueDeliveryDate: c.dueDeliveryDate,
        inboundLocation: c.inboundLocation, category: c.catalogItem.category,
      }));
      const po = createPOFromVendorCheckout(vendor, poLineItems);
      const total = items.reduce((s, i) => {
        const line = i.unitPrice * i.quantity;
        return s + line - line * (i.discount / 100);
      }, 0);
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
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--secondary)", fontFamily: FONT }}>

        {/* ── Page Header ── */}
        <div className="shrink-0 z-10 bg-secondary border-b border-border">
          <div className="px-4 lg:px-6 pt-3 pb-3 lg:pt-4 lg:pb-4">
            <div className="max-w-[1096px] mx-auto w-full">
              <div
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: "var(--card)", boxShadow: "var(--elevation-card)" }}
              >
                <div className="px-5" style={{ paddingTop: "16px", paddingBottom: "14px" }}>
                  {/* Row 1: Back + Separator + Icon + Title + Clear cart */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Back link — shared component */}
                      <BackButton onClick={() => navigate("/purchase-orders")} title="Back to Purchase Orders" />
                      {/* Separator */}
                      <div style={{ width: "1px", height: "20px", backgroundColor: "var(--border)", flexShrink: 0 }} />
                      {/* Cart icon */}
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-lg"
                        style={{ width: "32px", height: "32px", backgroundColor: "var(--primary-tint)", border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)", transition: "all 300ms ease" }}
                      >
                        <ShoppingCart style={{ width: "16px", height: "16px", color: "var(--primary)", transition: "color 300ms ease" }} />
                      </div>
                      {/* Title + inline summary */}
                      <div className="min-w-0 flex items-baseline gap-2.5">
                        <h1 className="flex-shrink-0" style={{ fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)", lineHeight: 1.2, color: "var(--foreground)", fontFamily: FONT, letterSpacing: "-0.01em" }}>
                          Purchase Order Cart
                        </h1>
                        {cart.length > 0 && (
                          <span className="text-muted-foreground shrink-0" style={T.meta}>
                            {vendorGroups.length} vendor{vendorGroups.length !== 1 ? "s" : ""} · {cart.length} item{cart.length !== 1 ? "s" : ""} · {itemCount} unit{itemCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Clear cart — right side */}
                    {cart.length > 0 && (
                      <div className="flex items-center shrink-0">
                        {confirmClear ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-destructive" style={T.uiSmall}>Clear all?</span>
                            <button className="h-7 px-2 rounded-[var(--radius-sm)] bg-destructive text-destructive-foreground cursor-pointer transition-colors hover:bg-destructive/90" style={T.tiny} onClick={() => { clearCart(); setConfirmClear(false); }}>Yes</button>
                            <button className="h-7 px-2 rounded-[var(--radius-sm)] border border-border text-foreground/60 cursor-pointer transition-colors hover:bg-secondary" style={T.tiny} onClick={() => setConfirmClear(false)}>No</button>
                          </div>
                        ) : (
                          <button className="text-muted-foreground hover:text-destructive cursor-pointer transition-colors" style={T.uiSmall} onClick={() => setConfirmClear(true)}>
                            Clear cart
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 2: In-cart search filter */}
                  <div className="mt-3">
                    <div
                      className="flex items-center gap-2.5 h-9 px-3.5 rounded-[var(--radius)] border border-border transition-all w-full"
                      style={{
                        backgroundColor: cart.length === 0 ? "var(--secondary)" : "var(--secondary)",
                        opacity: cart.length === 0 ? 0.5 : 1,
                        ...(cart.length === 0 ? {} : {}),
                      }}
                    >
                      <Search className="size-4 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        placeholder={cart.length === 0 ? "Search items in cart..." : "Search items in cart..."}
                        value={cartSearch}
                        onChange={(e) => setCartSearch(e.target.value)}
                        disabled={cart.length === 0}
                        className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed"
                        style={{ ...T.uiLabel, fontWeight: "var(--font-weight-normal)" }}
                      />
                      {cartSearch && (
                        <button className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors" onClick={() => setCartSearch("")}>
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        {cart.length === 0 ? (
          /* ── Empty State ── */
          <div className="max-w-[1096px] mx-auto w-full px-4 lg:px-6 py-12 flex flex-col items-center gap-5">
            {/* Icon + copy */}
            <div className="flex items-center justify-center size-20 rounded-full" style={{ backgroundColor: "var(--secondary)" }}>
              <ShoppingCart className="size-9 text-foreground/15" strokeWidth={1.5} />
            </div>
            <div className="text-center flex flex-col gap-1 max-w-md">
              <span className="text-foreground" style={T.vendorTitle}>Your cart is empty</span>
              <span className="text-muted-foreground" style={T.vendorMeta}>
                Start by browsing items or selecting from recently ordered items below
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button className="gap-2 h-10" style={T.uiLabel} onClick={handleContinueShopping}>
                <Search className="size-4" /> Browse Items
              </Button>
              <Button variant="outline" className="gap-2 h-10" style={T.uiLabel} onClick={() => navigate("/purchase-orders")}>
                <ArrowLeft className="size-4" /> Back to Orders
              </Button>
            </div>

            {/* ── Recently Ordered Items ── */}
            {CATALOG.filter((c) => c.partnerLocation).length > 0 && (
              <div className="w-full max-w-[960px] mt-10">
                <span className="text-muted-foreground" style={T.sectionLabel}>Recently ordered</span>
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
        ) : (
          /* ── Cart with items ── */
          <div className="max-w-[1096px] mx-auto w-full px-4 lg:px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6">

              {/* ─────── Left Column: Vendor groups ─────── */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {vendorGroups.map((group) => {
                  const isCollapsed = collapsedVendors.has(group.vendor);

                  return (
                    <div
                      key={group.vendor}
                      className="rounded-[var(--radius-lg)] border border-border overflow-hidden"
                      style={{ backgroundColor: "var(--card)" }}
                    >
                      {/* Vendor header */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-secondary/30 transition-colors"
                        style={{ borderBottom: isCollapsed ? "none" : "1px solid var(--border)" }}
                        onClick={() => toggleVendor(group.vendor)}
                      >
                        {/* Select all checkbox */}
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={group.checkedCount === group.items.length ? true : group.checkedCount > 0 ? "indeterminate" : false}
                            onCheckedChange={() => toggleVendorAll(group.vendor, group.items)}
                            className="size-[18px]"
                            aria-label={group.checkedCount === group.items.length ? "Deselect all" : "Select all"}
                          />
                        </div>
                        <div className="flex items-center justify-center size-9 rounded-[var(--radius)] bg-secondary border border-border shrink-0">
                          <Building2 className="size-4 text-foreground/40" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground truncate" style={T.vendorTitle}>{group.vendor}</span>
                            <span
                              className="inline-flex items-center px-1.5 py-0 rounded-full shrink-0"
                              style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", ...T.badge }}
                            >
                              {group.checkedCount}/{group.items.length} selected
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-muted-foreground" style={T.vendorMeta}>
                              Subtotal: <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>${group.checkedTotal.toFixed(2)}</span>
                            </span>
                            {group.checkedDiscount > 0 && (
                              <span className="text-accent" style={T.vendorMeta}>
                                Discount ${group.checkedDiscount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Tooltip delayDuration={300}>
                            <TooltipTrigger asChild>
                              <button
                                className="flex items-center justify-center size-8 rounded-[var(--radius)] border border-border cursor-pointer transition-all hover:bg-secondary hover:border-foreground/20"
                                style={{ backgroundColor: "var(--card)" }}
                                onClick={(e) => { e.stopPropagation(); handleAddItemsForVendor(group.vendor); }}
                              >
                                <Plus className="size-4 text-muted-foreground" strokeWidth={1.5} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="bottom"
                              className="border-border/60 shadow-sm"
                              style={{ fontFamily: FONT, fontSize: "11px", fontWeight: "var(--font-weight-normal)", backgroundColor: "var(--card)", color: "var(--muted-foreground)", padding: "4px 8px" }}
                            >
                              Add items
                            </TooltipContent>
                          </Tooltip>
                          <button
                            className="flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius)] cursor-pointer transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ backgroundColor: group.checkedCount > 0 ? "var(--primary-tint)" : "var(--secondary)", color: group.checkedCount > 0 ? "var(--primary)" : "var(--muted-foreground)", ...T.uiLabel }}
                            onClick={(e) => { e.stopPropagation(); handleCheckoutVendor(group.vendor); }}
                            disabled={group.checkedCount === 0}
                            title={`Create PO for ${group.vendor}`}
                          >
                            <FileText className="size-3.5" />
                            <span className="hidden sm:inline">Create PO ({group.checkedCount})</span>
                          </button>
                          {isCollapsed ? <ChevronDown className="size-4 text-foreground/30" /> : <ChevronUp className="size-4 text-foreground/30" />}
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
                              onToggleCheck={() => toggleCheck(ci.catalogItem.id)}
                              onEdit={() => handleEditItem(ci.catalogItem.id)}
                              onRemove={() => removeFromCart(ci.catalogItem.id)}
                              onUpdateQty={(nextQty) => setCartVendorQty(ci.catalogItem.id, nextQty)}
                              onImageClick={() => handleThumbnailClick(ci.catalogItem)}
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
                        <Package className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                        <span className="text-foreground" style={T.suggestTitle}>Items you might need</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {suggestions.map((item) => (
                        <RecentlyOrderedCard key={item.id} item={item} onAddToCart={handleSuggestionClick} onBuyNow={(it) => {
                          setOrderFlowMode("buy-now" as OrderFlowMode);
                          setOrderFlowPrefill(null);
                          setOrderFlowItem(catalogToFlowItem(it));
                          setOrderFlowOpen(true);
                        }} onImageClick={handleThumbnailClick} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ─────── Right Column: Order Summary (sticky) ─────── */}
              <div className="lg:w-[340px] xl:w-[380px] shrink-0">
                <div className="lg:sticky lg:top-6">
                  <div
                    className="rounded-[var(--radius-lg)] border border-border overflow-hidden"
                    style={{ backgroundColor: "var(--card)" }}
                  >
                    {/* Header */}
                    <div className="px-5 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
                      <span className="text-foreground" style={T.vendorTitle}>Order Summary</span>
                    </div>

                    {/* Vendor breakdown */}
                    <div className="px-5 py-3 flex flex-col gap-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                      {vendorGroups.map((g) => (
                        <div key={g.vendor} className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground truncate block" style={T.uiLabel}>{g.vendor}</span>
                            <span className="text-muted-foreground" style={T.meta}>{g.checkedCount} of {g.items.length} selected</span>
                          </div>
                          <span className="text-foreground shrink-0" style={T.uiLabel}>${g.checkedTotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="px-5 py-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground" style={T.summaryLabel}>Subtotal ({itemCount} units)</span>
                        <span className="text-foreground" style={T.summaryValue}>${subtotal.toFixed(2)}</span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-accent" style={T.summaryLabel}>Discounts</span>
                          <span className="text-accent" style={T.summaryValue}>-${totalDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="h-px mt-1" style={{ backgroundColor: "var(--border)" }} />
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-foreground" style={T.totalLabel}>Total</span>
                        <span className="text-foreground" style={T.totalValue}>${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Multi-vendor info */}
                    {vendorGroups.length > 1 && totalCheckedVendors > 1 && (
                      <div className="mx-4 mb-3 flex items-start gap-2 px-3 py-2.5 rounded-[var(--radius)]"
                        style={{ backgroundColor: "var(--primary-tint-faint)", border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)" }}>
                        <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground" style={T.meta}>
                          <strong className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{totalCheckedVendors} separate POs</strong> will be created — one per vendor.
                        </span>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
                      <Button className="w-full h-10 gap-2" style={T.uiLabel} onClick={handleCreateAllPOs} disabled={totalCheckedCount === 0}>
                        <FileText className="size-4" />
                        {totalCheckedCount === cart.length
                          ? "Create PO for All Items"
                          : "Create Purchase Orders"
                        }
                      </Button>
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

      {/* ── Multi-PO Confirmation Modal ── */}
      <Dialog open={!!multiPOModal} onOpenChange={(open) => { if (!open) setMultiPOModal(null); }}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
          {multiPOModal && (() => {
            const { created } = multiPOModal;
            const checkedCount = created.filter((c) => multiPOChecked.has(c.id)).length;
            return (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
                  <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0" style={{ backgroundColor: "var(--success-tint)" }}>
                    <Check className="size-5" style={{ color: "var(--success)" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle style={{ ...T.vendorTitle, fontSize: "var(--text-label)" }} className="text-foreground">
                      Purchase Orders Created
                    </DialogTitle>
                    <DialogDescription style={T.meta} className="text-muted-foreground mt-0.5">
                      {created.length} purchase orders have been created — one per vendor.
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
                        className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius)] cursor-pointer transition-colors hover:bg-secondary/60"
                        style={{ backgroundColor: isChecked ? "var(--secondary)" : "transparent", border: "1px solid var(--border)" }}
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
                            <span className="text-foreground" style={T.partNum}>{po.poNumber}</span>
                            <span className="text-muted-foreground" style={T.meta}>·</span>
                            <span className="text-muted-foreground truncate" style={T.meta}>{po.vendor}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-foreground" style={T.priceUnit}>${po.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-muted-foreground" style={T.meta}>{po.itemCount} item{po.itemCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                        <ExternalLink className="size-3.5 text-muted-foreground/40 shrink-0" />
                      </label>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-4 gap-1.5"
                    style={T.uiLabel}
                    onClick={() => { setMultiPOModal(null); navigate("/purchase-orders"); }}
                  >
                    <ArrowLeft className="size-3.5" />
                    Back to Orders
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 px-4 gap-1.5"
                    style={T.uiLabel}
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
                  >
                    <ExternalLink className="size-3.5" />
                    Open Selected{checkedCount > 0 ? ` (${checkedCount})` : ""}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Image Lightbox ── */}
      <ImageLightbox
        open={!!lightboxData}
        onClose={() => setLightboxData(null)}
        images={lightboxData?.images ?? []}
        partNumber={lightboxData?.partNumber ?? ""}
        itemName={lightboxData?.itemName ?? ""}
      />
    </AppShell>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CART LINE ITEM CARD — matches PO detail LineItemCard design
   ═════════════════════════════════════════════════════════════ */

function CartLineItemCard({
  item,
  checked,
  onToggleCheck,
  onEdit,
  onRemove,
  onUpdateQty,
  onImageClick,
}: {
  item: GlobalCartItem;
  checked: boolean;
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

  return (
    <div
      className="rounded-[var(--radius-lg)] border overflow-hidden transition-all duration-150 group/card hover:shadow-[var(--elevation-sm)] mb-2"
      style={{ backgroundColor: checked ? "var(--card)" : "color-mix(in srgb, var(--card) 60%, var(--secondary))", fontFamily: FONT, borderColor: "var(--border)", opacity: checked ? 1 : 0.7 }}
    >
      {/* ── Main row ── */}
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Checkbox */}
        <div className="shrink-0 mt-5">
          <Checkbox
            checked={checked}
            onCheckedChange={onToggleCheck}
            className="size-[18px]"
            aria-label={checked ? "Deselect item" : "Select item"}
          />
        </div>
        {/* Thumbnail — 64×64 */}
        <div
          className="relative shrink-0 w-16 h-16 min-w-16 min-h-16 rounded-[var(--radius-md)] overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
          style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}
          onClick={onImageClick}
        >
          <ImageWithFallback
            src={cat.image}
            alt={cat.descriptiveName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
          />
        </div>

        {/* Content area — matches modal cart card layout */}
        <div className="flex flex-col flex-1 min-w-0 gap-0">
          {/* Row 1: Part number + serialization tag */}
          <div className="flex items-center gap-2">
            <span className="text-foreground truncate" style={T.partNum}>{cat.itemNumber}</span>
            <span
              className="inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] shrink-0"
              style={{
                backgroundColor: "var(--secondary)",
                color: "var(--muted-foreground)",
                ...T.badge,
              }}
            >
              {serialized ? "Serialized" : "Non-Serialized"}
            </span>
          </div>

          {/* Row 2: Item name */}
          <TruncatedItemName name={cat.descriptiveName} maxChars={50} style={T.desc} className="text-foreground mt-0.5" />

          {/* Row 3: Vendor + price/unit */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <div className="inline-flex items-center gap-1 min-w-0">
              <Building2 className="size-2.5 text-muted-foreground/50 shrink-0" />
              <span className="text-muted-foreground truncate" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px", fontFamily: FONT }}>{cat.partnerLocation || "No vendor"}</span>
            </div>
            <span style={{ color: "var(--border)", fontSize: "10px" }}>·</span>
            <div className="flex items-baseline gap-1">
              <span className="text-foreground" style={T.priceUnit}>${effectivePrice.toFixed(2)}</span>
              <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px", fontFamily: FONT }}>/ {cat.vendorUOM}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom action bar — qty stepper + actions ── */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderTop: "1px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--secondary) 40%, var(--card))" }}
      >
        {/* Qty stepper */}
        <div className="flex items-center gap-2.5">
          <QuantityStepperInput
            value={item.vendorQty}
            serialized={serialized}
            onChange={onUpdateQty}
            ariaLabel={`${cat.itemNumber} quantity`}
          />
          <span className="text-muted-foreground" style={T.meta}>{cat.vendorUOM}{item.vendorQty === 1 ? "" : "s"}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] border border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/[0.04] transition-all cursor-pointer"
            onClick={onEdit}
            title="Edit item details"
          >
            <Pencil className="size-3" />
          </button>
          <button
            className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-all cursor-pointer"
            onClick={onRemove}
            title="Remove item"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>
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
      className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-card hover:shadow-[var(--elevation-sm)] hover:border-foreground/15 transition-all overflow-hidden group/rc"
      style={{ fontFamily: FONT }}
    >
      {/* Image */}
      <div
        className="w-full h-[120px] overflow-hidden cursor-pointer"
        style={{ backgroundColor: "var(--secondary)" }}
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
          <span className="text-foreground truncate" style={T.partNum}>{item.itemNumber}</span>
          <span
            className="inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] shrink-0"
            style={{
              backgroundColor: "var(--secondary)",
              color: "var(--muted-foreground)",
              ...T.badge,
            }}
          >
            {serialized ? "Serialized" : "Non-Serialized"}
          </span>
        </div>

        {/* Item name */}
        <TruncatedItemName name={item.descriptiveName} maxChars={40} style={T.desc} className="text-foreground mt-0.5" />

        {/* Price + unit */}
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className="text-foreground" style={T.priceUnit}>
            ${effectivePrice.toFixed(2)}
          </span>
          <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px", fontFamily: FONT }}>
            / {item.defaultUOM}
          </span>
          {item.discount > 0 && (
            <span
              className="inline-flex items-center gap-0.5 px-1 py-0 rounded-[var(--radius-sm)] ml-1 shrink-0"
              style={{ backgroundColor: "var(--success-tint)", color: "var(--success)", ...T.badge }}
            >
              <Tag className="size-2" /> {item.discount}%
            </span>
          )}
        </div>

        {/* Vendor + vendor count */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {item.partnerLocation && (
            <div className="flex items-center gap-1 min-w-0">
              <Building2 className="size-2.5 text-muted-foreground/50 shrink-0" />
              <span className="text-muted-foreground truncate" style={T.meta}>{item.partnerLocation}</span>
            </div>
          )}
          {vendorCount > 1 && (
            <>
              <span style={{ color: "var(--border)", fontSize: "10px" }}>·</span>
              <span className="text-muted-foreground shrink-0" style={T.meta}>{vendorCount} vendors</span>
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
        <Button
          size="sm"
          className="flex-1 h-8 gap-1.5"
          style={{ ...T.uiLabel, fontSize: "11px" }}
          onClick={() => onAddToCart(item)}
        >
          <ShoppingCart className="size-3" />
          Add to cart
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          style={{ ...T.uiLabel, fontSize: "11px" }}
          onClick={() => onBuyNow(item)}
        >
          <FileText className="size-3" />
          Buy now
        </Button>
      </div>
    </div>
  );
}