import { Copy } from "lucide-react";
import { type ElementType, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { duplicatePO, type PurchaseOrderData, type POVendor } from "./poStore";
import type { VendorEntity, VendorLocationInfo } from "./catalogData";
import type { StateTransitionTone } from "./StateTransitionOverlay";

/**
 * PO-side counterpart to SO's `useQuoteTransitions`. Owns the
 * `StateTransitionOverlay` plan and defers the real mutation until the
 * animation completes.
 *
 * For now this only routes the duplicate action — status transitions in PO
 * still go through the older `TransitionOverlay` (colored glassmorphism)
 * from `PurchaseOrderDraft.tsx`. New actions can slot in by adding another
 * `start*` method that resolves an {@link OverlayPlan}.
 */

export interface OverlayPlan {
  fromLabel: string;
  toLabel: string;
  tone: StateTransitionTone;
  Icon?: ElementType;
  heading: string;
  meta?: string;
  /** Runs when the overlay's self-timer fires — commits the real mutation. */
  commit: () => void;
}

export interface StartDuplicateOptions {
  /** Fired after `duplicatePO` succeeds and the overlay clears. Receives the
   *  freshly-created PO so callers can navigate to it. Skipped when the
   *  source can't be found. */
  onDone?: (created: PurchaseOrderData) => void;
  /** Optional version number to seed line items from. Defaults to the
   *  source's current version. */
  sourceVersion?: number;
  /** Optional Pay-To vendor to swap onto the new PO. Passing `null` (or
   *  omitting) preserves the source's vendor. */
  vendor?: VendorEntity | null;
  /** Ship-to location picked in the Duplicate dialog when the buyer chose
   *  Different vendor. Overrides the vendor's default location on the
   *  new PO. Ignored when `vendor` is null / undefined. */
  vendorLocation?: VendorLocationInfo;
}

/** Map a shared `VendorEntity` to the PO's flat `POVendor` shape used
 *  inside the store. `locationOverride` lets the Duplicate PO dialog
 *  pin a non-default ship-to location; falls back to the vendor's
 *  default (or first) location when omitted. */
function vendorEntityToPOVendor(
  v: VendorEntity,
  locationOverride?: VendorLocationInfo,
): POVendor {
  const location =
    locationOverride ??
    v.locations.find((l) => l.isDefault) ??
    v.locations[0];
  return {
    name: v.name,
    address: location?.description ?? "",
    phone: v.contact.phone,
    email: v.contact.email,
    taxId: `TAX-${v.abbr}-${v.id.slice(-4).toUpperCase()}`,
  };
}

export interface POTransitions {
  overlay: OverlayPlan | null;
  onOverlayComplete: () => void;
  /** Escape hatch — set an arbitrary overlay plan. Used by the listing's
   *  mock-PO duplicate branch which mutates via `createPOFromVendorCheckout`
   *  rather than `duplicatePO`. */
  start: (plan: OverlayPlan) => void;
  startDuplicate: (
    po: Pick<PurchaseOrderData, "id" | "poNumber">,
    opts?: StartDuplicateOptions,
  ) => void;
}

export function usePOTransitions(): POTransitions {
  const [overlay, setOverlay] = useState<OverlayPlan | null>(null);
  const overlayRef = useRef<OverlayPlan | null>(null);
  overlayRef.current = overlay;

  const start: POTransitions["start"] = useCallback((plan) => {
    setOverlay(plan);
  }, []);

  const startDuplicate: POTransitions["startDuplicate"] = useCallback(
    (po, opts) => {
      /* Compose the meta line — surfaces the user's choices on the overlay
         so they see what's being duplicated. Format:
         "PO-{poNumber} · V{n} · Vendor: {name} · @ {loc}" (parts optional). */
      const metaParts = [po.poNumber];
      if (opts?.sourceVersion != null) metaParts.push(`V${opts.sourceVersion}`);
      if (opts?.vendor) metaParts.push(`Vendor: ${opts.vendor.name}`);
      if (opts?.vendorLocation) metaParts.push(`@ ${opts.vendorLocation.name}`);

      setOverlay({
        fromLabel: po.poNumber,
        toLabel: "New Draft",
        tone: "info",
        Icon: Copy,
        heading: "Duplicating PO",
        meta: metaParts.join(" · "),
        commit: () => {
          const created = duplicatePO(po.id, {
            sourceVersion: opts?.sourceVersion,
            vendorOverride: opts?.vendor
              ? vendorEntityToPOVendor(opts.vendor, opts.vendorLocation)
              : undefined,
            vendorLabel: opts?.vendor?.name,
            vendorLocationSeed: opts?.vendorLocation
              ? { id: opts.vendorLocation.id, name: opts.vendorLocation.name }
              : undefined,
          });
          if (!created) {
            toast.error("Could not duplicate PO.", { position: "top-right" });
            return;
          }
          toast.success("PO duplicated.", {
            description: `A copy of ${po.poNumber} was created as a new draft.`,
            position: "top-right",
          });
          opts?.onDone?.(created);
        },
      });
    },
    [],
  );

  const onOverlayComplete = useCallback(() => {
    overlayRef.current?.commit();
    setOverlay(null);
  }, []);

  return { overlay, onOverlayComplete, start, startDuplicate };
}
