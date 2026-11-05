/**
 * itemFieldLocks — the "parent computes, component renders" lock layer.
 *
 * Mirrors the Category pattern (ConfigureCategory accepts lockedFields/disabledFields
 * as props) but centralises the *condition logic* here so the UI stays declarative.
 * Given an item's lifecycle state (on-hand, open transactions, valuation, control
 * flags) this returns, per config field, whether it is fully Locked, or One-way
 * (an unsafe option is disabled and/or a value change needs an upgrade-confirm modal).
 *
 * Spec: "Item Editing Behaviour — Designer Handoff".
 *  - Base UOM            → Locked once linked or moved against.
 *  - Cost / Valuation    → Locked once the item has been valued.
 *  - Control Type        → One-way (non-serialized → serialized only).
 *  - Lot Tracking        → One-way (off → on only).
 *  - Inventory Type      → One-way (conditional): can't leave a stocked type with stock on hand.
 *  - Everything else     → always editable (absent from this map).
 *
 * Signals are derived (the mock Item model has no explicit "valued"/BOM/SO/WO flags).
 * They live in one place so they can be swapped for real fields later without
 * touching any UI. Transactions reuse the SAME source as the archive gate
 * (getItemActiveTransactions) so lock state and archive state always agree.
 */
import { getItemActiveTransactions } from './ItemLifecycleModal';

/** Tier 1 = permanent integrity lock (red). Tier 2 = temporary / active-tx (gray). */
export interface FieldLockInfo {
  tier: 1 | 2;
  reason: string;
}

export interface UpgradeCopy {
  title: string;
  body: string;
  confirmLabel: string;
}

export interface OneWayRule {
  /** Option value → reason it is disabled (the unsafe / reverse direction). */
  disabledOptions?: Record<string, string>;
  /** Target value → confirm-modal copy shown before applying the safe upgrade. */
  confirm?: Record<string, UpgradeCopy>;
}

export interface ItemFieldLocks {
  /** Fully read-only fields, keyed by AdvancedConfig key. */
  locked: Record<string, FieldLockInfo>;
  /** One-way fields, keyed by AdvancedConfig key. */
  oneWay: Record<string, OneWayRule>;
}

/** Draft microcopy from the handoff. Adjust to system voice in one place. */
const COPY = {
  uom:
    "Base unit can't be changed once this item has inventory or is linked to other records. It anchors all historical stock and valuation.",
  valuation:
    "Cost method can't be changed once this item has been valued. Changing it would revalue inventory you already hold.",
  reverseDisabled:
    "Can't be removed once enabled — past transactions already reference it.",
  inventoryTypeDisabled:
    "Can't change to a non-stocked type while this item has inventory on hand. Clear the stock first.",
};

/** Loose shape — we only read lifecycle-relevant fields off the persisted Item. */
export interface ItemLockInput {
  id?: string;
  onHandQty?: number;
  onOrderQty?: number;
  /** "Serialized" | "Non-Serialized" on the Item model. */
  inventoryControlType?: string;
  /** Persisted lot-tracking flag. */
  lotControl?: boolean;
}

const EMPTY: ItemFieldLocks = { locked: {}, oneWay: {} };

/**
 * Compute the lock descriptors for an item. Pass the *persisted* item (not the
 * live in-modal config) — these rules describe what's already committed and
 * therefore can't be undone; in-session upgrades flow through the confirm modal.
 */
export function getItemFieldLocks(item: ItemLockInput | null | undefined): ItemFieldLocks {
  if (!item) return EMPTY;

  const onHand = item.onHandQty ?? 0;
  const onOrder = item.onOrderQty ?? 0;
  const tx = item.id ? getItemActiveTransactions(item.id) : null;
  const txTotal = tx?.total ?? 0;

  // Derived lifecycle signals (swap for real fields when the model gains them).
  const hasMovementOrLinkage = onHand > 0 || onOrder > 0 || txTotal > 0;
  const hasBeenValued = onHand > 0; // proxy: stock on hand ⇒ a valued receipt created a cost layer
  const hasStock = onHand > 0;
  const isSerialized = (item.inventoryControlType ?? '').toLowerCase() === 'serialized';
  const lotOn = !!item.lotControl;

  const locked: Record<string, FieldLockInfo> = {};
  if (hasMovementOrLinkage) locked.uom = { tier: 1, reason: COPY.uom };
  if (hasBeenValued) locked.valuationMethod = { tier: 1, reason: COPY.valuation };

  const oneWay: Record<string, OneWayRule> = {};

  // Control Type — non-serialized → serialized only; reverse permanently disabled.
  oneWay.controlType = {
    disabledOptions: isSerialized ? { 'Non-serialized': COPY.reverseDisabled } : {},
    confirm: {
      Serialized: {
        title: 'Turn on serialization for this item?',
        body: 'Every unit will need its own serial number from now on. This can’t be turned off later.',
        confirmLabel: 'Enable serialization',
      },
    },
  };

  // Lot Tracking — off → on only; reverse permanently disabled.
  oneWay.lotControlEnabled = {
    disabledOptions: lotOn ? { false: COPY.reverseDisabled } : {},
    confirm: {
      true: {
        title: 'Turn on lot tracking for this item?',
        body: 'All future receipts will require a lot number. This can’t be turned off later.',
        confirmLabel: 'Enable lot tracking',
      },
    },
  };

  // Inventory Type — conditional: once stock exists, can't move off a stocked type.
  oneWay.inventoryType = {
    disabledOptions: hasStock
      ? { 'Non-stock': COPY.inventoryTypeDisabled, Asset: COPY.inventoryTypeDisabled }
      : {},
  };

  return { locked, oneWay };
}
