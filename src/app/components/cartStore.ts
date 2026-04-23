/* ═══════════════════════════════════════════════════════════════
   GLOBAL CART STORE
   Publish/subscribe pattern — mirrors poStore architecture.
   Single cart shared across all pages.
   ═══════════════════════════════════════════════════════════════ */

import { CATALOG } from "./catalogData";
import type { CatalogItem } from "./catalogData";

/* ── Cart item type ── */

export interface GlobalCartItem {
  catalogItem: CatalogItem;
  vendorQty: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  shipByDate?: string;
  shipmentMethod: string;
  dueDeliveryDate: string;
  inboundLocation: string;
}

/* ── Internal state ── */

let _cart: GlobalCartItem[] = (() => {
  // Pre-populate with 3 demo items so cart is never empty on first load
  const demoItems = [
    { id: "cat-1", vendorQty: 2, method: "fedex-ground", due: "2026-03-22", location: "Pasadena, Oklahoma" },
    { id: "cat-2", vendorQty: 1, method: "air-standard", due: "2026-03-20", location: "Great Falls, Maryland" },
    { id: "cat-5", vendorQty: 3, method: "fedex-express", due: "2026-03-25", location: "Stockton, New Hampshire" },
  ];
  return demoItems.map((d) => {
    const cat = CATALOG.find((c) => c.id === d.id)!;
    return {
      catalogItem: cat,
      vendorQty: d.vendorQty,
      quantity: d.vendorQty * cat.vendorUOMQty,
      unitPrice: cat.unitPrice,
      discount: cat.discount,
      shipmentMethod: d.method,
      dueDeliveryDate: d.due,
      inboundLocation: d.location,
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
    _cart = [..._cart];
    _cart[idx] = normalizedItem;
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
    if (c.catalogItem.id !== itemId) return c;
    return syncCartItemQuantities(c, c.vendorQty + delta);
  });
  _notify();
}

export function setCartVendorQty(itemId: string, vendorQty: number) {
  _cart = _cart.map((c) => {
    if (c.catalogItem.id !== itemId) return c;
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