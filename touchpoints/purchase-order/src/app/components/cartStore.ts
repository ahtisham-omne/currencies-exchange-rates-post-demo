/* ═══════════════════════════════════════════════════════════════
   GLOBAL CART STORE
   Publish/subscribe pattern — mirrors poStore architecture.
   Single cart shared across all pages.
   ═══════════════════════════════════════════════════════════════ */

import { CATALOG } from "./catalogData";
import type { CatalogItem } from "./catalogData";
import type { LineOneTimeAdjustment } from "./poOrderPricing";

/* ── Cart item type ── */

export interface GlobalCartItem {
  catalogItem: CatalogItem;
  vendorQty: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  shipByDate?: string;
  shipmentMethod: string;
  /** Buyer-entered "need by" ship date — renamed from `dueDeliveryDate` to
   *  match the new PO date model on `poStore.POLineItem`. */
  needByDate: string;
  /** Vendor-committed ship date (optional). Same field as on the PO
   *  line item — plumbed through cart so vendor commitments survive
   *  from `Item Detail Modal` → cart → checkout. */
  promisedShipDate?: string;
  /** Buyer-entered Expected Delivery Date from the Items Detail Modal
   *  (the required primary field per the 2026-07-29 date-model rebuild).
   *  Plumbed through cart so it survives to the PO line item, which is
   *  what the Send-to-Vendor gate reads. Without this the send button
   *  was permanently disabled because promisedShipDate + shipmentMethod
   *  are optional and computeExpectedDeliveryDate() returns null. */
  expectedDeliveryDate?: string;
  inboundLocation: string;
  /** Item-level one-time discounts/premiums added in the Items Detail
   *  Modal. Carried into the PO on checkout. */
  oneTimeAdjustments?: LineOneTimeAdjustment[];
  /** Set when the item master was deactivated after the line landed in
   *  the cart. A deactivated line is a hard block: it can't be selected,
   *  re-quantified, edited or checked out into a new PO — the only
   *  allowed action is removing it. */
  deactivation?: CartItemDeactivation;
}

export interface CartItemDeactivation {
  /** Who deactivated the item master (display name). */
  by: string;
  /** Their role, e.g. "Engineer". */
  role: string;
  /** ISO date the item was deactivated. */
  at: string;
}

export function isCartItemDeactivated(item: GlobalCartItem): boolean {
  return !!item.deactivation;
}

/* ── Internal state ── */

let _cart: GlobalCartItem[] = (() => {
  // Pre-populate with 3 demo items so cart is never empty on first load
  const demoItems = [
    { id: "cat-1", vendorQty: 2, method: "fedex-ground", due: "2026-03-22", location: "Pasadena, Oklahoma" },
    { id: "cat-2", vendorQty: 1, method: "air-standard", due: "2026-03-20", location: "Great Falls, Maryland" },
    { id: "cat-5", vendorQty: 3, method: "fedex-express", due: "2026-03-25", location: "Stockton, New Hampshire" },
    { id: "cat-12", vendorQty: 1, method: "fedex-ground", due: "2026-03-24", location: "Great Falls, Maryland" },
  ];
  /* Demo: cat-2 (Hydraulic Pump Unit) was deactivated in the item master
     after it was added to the cart — exercises the deactivated hard block. */
  const demoDeactivations: Record<string, CartItemDeactivation> = {
    "cat-2": { by: "Sarah Mitchell", role: "Engineer", at: "2026-09-24" },
  };
  return demoItems.map((d) => {
    const cat = CATALOG.find((c) => c.id === d.id)!;
    return {
      catalogItem: cat,
      vendorQty: d.vendorQty,
      quantity: d.vendorQty * cat.vendorUOMQty,
      unitPrice: cat.unitPrice,
      discount: cat.discount,
      shipmentMethod: d.method,
      needByDate: d.due,
      inboundLocation: d.location,
      deactivation: demoDeactivations[d.id],
    };
  });
})();

type Listener = () => void;
const _listeners = new Set<Listener>();

function _notify() {
  _listeners.forEach((fn) => fn());
}

function isSerializedCatalogItem(item: CatalogItem): boolean {
  const hash = item.id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 3 === 0;
}

function normalizeCartVendorQty(item: GlobalCartItem, vendorQty: number): number {
  const safeQty = Number.isFinite(vendorQty) ? Math.max(0, vendorQty) : 0;
  return isSerializedCatalogItem(item.catalogItem)
    ? Math.round(safeQty)
    : Math.round(safeQty * 100) / 100;
}

function syncCartItemQuantities(item: GlobalCartItem, vendorQty: number): GlobalCartItem {
  const normalizedVendorQty = normalizeCartVendorQty(item, vendorQty);

  return {
    ...item,
    vendorQty: normalizedVendorQty,
    quantity: normalizedVendorQty * item.catalogItem.vendorUOMQty,
  };
}

/* ── Public API ── */

export function getCart(): GlobalCartItem[] {
  return _cart;
}

export function subscribeToCart(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function addToCart(item: GlobalCartItem) {
  const normalizedItem = syncCartItemQuantities(item, item.vendorQty);
  // Replace if same item already in cart, otherwise append
  const idx = _cart.findIndex((c) => c.catalogItem.id === normalizedItem.catalogItem.id);
  if (idx >= 0) {
    // Deactivated lines are frozen — re-adding can't revive or re-quantify them.
    if (isCartItemDeactivated(_cart[idx])) return;
    _cart = [..._cart];
    /* Keep existing one-time adjustments unless the caller sent a list
       (the Items Detail Modal always does; quick-add paths don't). */
    _cart[idx] = normalizedItem.oneTimeAdjustments === undefined
      ? { ...normalizedItem, oneTimeAdjustments: _cart[idx].oneTimeAdjustments }
      : normalizedItem;
  } else {
    _cart = [..._cart, normalizedItem];
  }
  _notify();
}

export function removeFromCart(itemId: string) {
  _cart = _cart.filter((c) => c.catalogItem.id !== itemId);
  _notify();
}

export function updateCartVendorQty(itemId: string, delta: number) {
  _cart = _cart.map((c) => {
    if (c.catalogItem.id !== itemId || isCartItemDeactivated(c)) return c;
    return syncCartItemQuantities(c, c.vendorQty + delta);
  });
  _notify();
}

export function setCartVendorQty(itemId: string, vendorQty: number) {
  _cart = _cart.map((c) => {
    if (c.catalogItem.id !== itemId || isCartItemDeactivated(c)) return c;
    return syncCartItemQuantities(c, vendorQty);
  });
  _notify();
}

export function clearCart() {
  _cart = [];
  _notify();
}

export function removeVendorItems(vendor: string) {
  _cart = _cart.filter((c) => c.catalogItem.partnerLocation !== vendor);
  _notify();
}

export function getCartItemCount(): number {
  return _cart.length;
}

/** React hook: subscribe to cart updates */
export function useCart(): GlobalCartItem[] {
  const { useSyncExternalStore } = require("react");
  return useSyncExternalStore(subscribeToCart, getCart, getCart);
}