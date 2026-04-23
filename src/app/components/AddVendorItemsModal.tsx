import React, { useState, useCallback, useMemo } from "react";

import { toast } from "sonner";

/* ── PurchaseSearchModal — the unified search experience ── */
import PurchaseSearchModal from "./PurchaseSearchModal";

/* ── OrderFlow for item detail modal ── */
import OrderFlow from "./OrderFlow";
import type { OrderFlowItem, OrderFlowResult } from "./OrderFlow";

/* ── Notes ── */
import PONotesSection from "./PONotesSection";
import { getPONotes } from "./poStore";

/* ── Data ── */
import { CATALOG } from "./catalogData";
import type { CatalogItem } from "./catalogData";
import { addLineItemToPO } from "./poStore";
import { FONT } from "./designTokens";

/* ═══════════════════════════════════════════════════════════════
   HELPER — CatalogItem → OrderFlowItem
   ═══════════════════════════════════════════════════════════════ */

function catalogToFlowItem(item: CatalogItem): OrderFlowItem {
  return {
    id: item.id,
    itemNumber: item.itemNumber,
    descriptiveName: item.descriptiveName,
    image: item.image,
    unitPrice: item.unitPrice,
    currentStock: item.currentStock,
    minQuantity: item.minQuantity,
    shortageDate: item.shortageDate,
    partnerLocation: item.partnerLocation,
    category: item.category,
    location: item.location,
    vendorUOM: item.vendorUOM,
    vendorUOMQty: item.vendorUOMQty,
    defaultUOM: item.defaultUOM,
    discount: item.discount,
  };
}

/* ═══════════════════════════════════════════════════════════════
   ADD VENDOR ITEMS MODAL
   PurchaseSearchModal (vendor-scoped) → OrderFlow → add to PO draft
   ═══════════════════════════════════════════════════════════════ */

interface AddVendorItemsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  poId: string;
  vendorName: string;
  existingItemNumbers: string[];
}

export default function AddVendorItemsModal({
  open,
  onOpenChange,
  poId,
  vendorName,
  existingItemNumbers: _existingItemNumbers,
}: AddVendorItemsModalProps) {
  

  /* ── OrderFlow state ── */
  const [flowItem, setFlowItem] = useState<CatalogItem | null>(null);
  const [flowOpen, setFlowOpen] = useState(false);

  /* ── Stable temp line-item ID for notes during add flow ── */
  const tempLineItemId = useMemo(() => `temp-add-${Date.now()}`, []);

  /* ── Notes count for the item being added ── */
  const notesCount = flowItem
    ? getPONotes(poId).filter((n) => n.lineItemId === tempLineItemId).length
    : 0;

  /* ── Search modal → item selected → close search, open OrderFlow ── */
  const handleItemSelect = useCallback((item: CatalogItem) => {
    setFlowItem(item);
    setFlowOpen(true);
    /* PurchaseSearchModal auto-closes (keepOpenOnSelect is not set) */
  }, []);

  /* ── Search modal → vendor selected → navigate to New PO page ── */
  const handleVendorSelect = useCallback(
    (_vendor: string) => {
      onOpenChange(false);
    },
    [onOpenChange]
  );

  /* ── Search modal → browse catalog ── */
  const handleBrowseCatalog = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  /* ── OrderFlow completion → add line item to PO + toast ── */
  const handleFlowComplete = useCallback(
    (result: OrderFlowResult) => {
      const catalogRef = CATALOG.find((c) => c.id === result.item.id);
      if (!catalogRef) return;

      addLineItemToPO(poId, {
        id: `add-${catalogRef.id}-${Date.now()}`,
        itemNumber: catalogRef.itemNumber,
        descriptiveName: catalogRef.descriptiveName,
        image: catalogRef.image,
        unitPrice: result.unitPrice,
        vendorQty: result.vendorQty,
        vendorUOM: catalogRef.vendorUOM,
        vendorUOMQty: catalogRef.vendorUOMQty,
        quantity: result.quantity,
        defaultUOM: catalogRef.defaultUOM,
        discount: result.discount,
        shipByDate: result.shipByDate,
        shipmentMethod: result.shipmentMethod,
        dueDeliveryDate: result.dueDeliveryDate,
        inboundLocation: result.inboundLocation,
        category: catalogRef.category,
      });

      /* Success toast with item info */
      toast.success(`${catalogRef.itemNumber} added to PO`, {
        description: `${result.quantity} ${catalogRef.defaultUOM} × $${result.unitPrice.toFixed(2)} — $${result.totalPrice.toFixed(2)}`,
        style: { fontFamily: FONT },
        duration: 3000,
      });

      /* Close everything — return to PO draft page */
      setFlowOpen(false);
      setFlowItem(null);
      onOpenChange(false);
    },
    [poId, onOpenChange]
  );

  /* ── OrderFlow closed without completing → just close everything ── */
  const handleFlowOpenChange = useCallback(
    (v: boolean) => {
      setFlowOpen(v);
      if (!v) {
        setFlowItem(null);
        onOpenChange(false);
      }
    },
    [onOpenChange]
  );

  /* ── Reset on close ── */
  const handleOpenChange = useCallback(
    (v: boolean) => {
      onOpenChange(v);
    },
    [onOpenChange]
  );

  return (
    <>
      {/* ── Step 1: Vendor-scoped Search Modal ── */}
      <PurchaseSearchModal
        open={open && !flowOpen}
        onOpenChange={handleOpenChange}
        onItemSelect={handleItemSelect}
        onVendorSelect={handleVendorSelect}
        onBrowseCatalog={handleBrowseCatalog}
        vendorFilter={vendorName}
      />

      {/* ── Step 2: Item Detail Modal (OrderFlow — "add-to-po" mode) ── */}
      <OrderFlow
        open={flowOpen}
        onOpenChange={handleFlowOpenChange}
        item={flowItem ? catalogToFlowItem(flowItem) : null}
        mode="add-to-po"
        prefill={null}
        onComplete={handleFlowComplete}
        renderNotesTab={flowItem ? (
          <PONotesSection
            poId={poId}
            lineItemId={tempLineItemId}
            allNotes={getPONotes(poId)}
            canEdit={true}
            asCollapsible={false}
          />
        ) : undefined}
        notesCount={notesCount}
      />
    </>
  );
}