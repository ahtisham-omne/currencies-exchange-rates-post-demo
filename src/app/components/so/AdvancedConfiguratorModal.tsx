import { LineItemConfigModal } from "@/app/components/quote-creation/LineItemConfigModal";
import { DEFAULT_SHIPMENT } from "@/app/components/so/ShipmentMethodModal";
import { CATALOG } from "@/app/components/so/store";
import type { SOLine, WarehouseInventory } from "./types";

/* The SOLine carries an `itemType` string but no Boolean flags; the
   configurator's pill rendering needs `isSerialized` + `isLotControlled`
   booleans + `sourceType`. Derive them from the catalog row so the
   configurator's header pills match the line items grid for every
   tracking variant (including Lot Serialized / Lot Non-Serialized). */
function deriveTrackingFlags(itemCode: string): { isSerialized: boolean; isLotControlled: boolean; sourceType: 'Manufactured' | 'Purchased' } {
  const cat = CATALOG.find((c) => c.code === itemCode);
  const type = cat?.type ?? 'Non-Serialized';
  return {
    isSerialized: type === 'Serialized' || type === 'Lot Serialized',
    isLotControlled: type === 'Lot Serialized' || type === 'Lot Non-Serialized',
    /* CATALOG doesn't track Manufactured/Purchased today; default to
       Purchased which matches the existing demo data. */
    sourceType: 'Purchased',
  };
}

interface ConfiguratorItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  uom: string;
  subtotal: number;
  pricingRules?: unknown[];
  oneTimeAdjustments?: unknown[];
}

interface AdvancedConfiguratorModalProps {
  isOpen?: boolean;
  onClose: () => void;
  item?: ConfiguratorItem;
  onSave: (updatedItem: any) => void;
  line?: SOLine;
  inventory?: WarehouseInventory[];
  onDelete?: () => void;
  readOnly?: boolean;
  /** If true, shows "Cancel Line Item" instead of "Delete from Order" */
  isPostDraft?: boolean;
  /** Display name of the customer this SO is for — forwarded into the
   *  Pricing Rules Library header and Remove confirmation copy. */
  customerName?: string;
  /** Propagated to LineItemConfigModal so per-line pricing-rule and
   *  adjustment changes bubble up to the SO page's version-prompt flow.
   *  The optional `onRevert` callback runs when the user discards the
   *  version prompt so the per-line mutation is undone. */
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
  /** Post-draft library staging — passed through to LineItemConfigModal
   *  so library Apply/Remove/Activate/Deactivate stage on the next
   *  version instead of mutating the current line. */
  stageLibraryChanges?: boolean;
  /** Shared pricing-rules state from SODetail. Forwarded into the
   *  configurator so its per-line rule list stays in lockstep with the
   *  summary modal. */
  pricingAPI?: import('./usePricingRules').PricingRulesAPI;
  /** Shared one-time-adjustments state from SODetail. Forwarded into the
   *  configurator so the per-line adjustments list stays in lockstep
   *  with the summary modal. */
  adjustmentsAPI?: import('./useAdjustments').AdjustmentsAPI;
  /** Order-level freight charge — feeds the configurator's split
   *  confirmation when the user makes the first per-line override. */
  orderDefaultFreight?: number;
  /** Total line count on the SO — used in the split math + copy. */
  siblingLineCount?: number;
  /** True if any sibling SOLine already carries a `shipmentCost`. */
  anyOtherLineHasOverride?: boolean;
  /** Bulk-seed callback: writes the same share onto every sibling
   *  via the parent's store, used on the first override conversion. */
  onSeedSiblingFreightShares?: (sharePerLine: number) => void;
  /** Parent SO id — forwarded to LineItemConfigModal so the
   *  AdjustmentFormModal inside can surface the link-picker on its
   *  internal-notes field. */
  docId?: string;
  /** Current user — forwarded to attribute inline-added links. */
  currentUser?: string;
}

export function AdvancedConfiguratorModal({
  isOpen = true,
  onClose,
  item,
  onSave,
  line,
  onDelete,
  readOnly,
  isPostDraft,
  customerName,
  onMaterialEvent,
  stageLibraryChanges,
  pricingAPI,
  adjustmentsAPI,
  orderDefaultFreight,
  siblingLineCount,
  anyOtherLineHasOverride,
  onSeedSiblingFreightShares,
  docId,
  currentUser,
}: AdvancedConfiguratorModalProps) {
  if (!isOpen) return null;

  const lineFlags = line ? deriveTrackingFlags(line.itemCode) : null;
  const itemFlags = item ? deriveTrackingFlags(item.productId) : null;

  const mappedItem = line
    ? {
        id: line.id,
        productId: line.itemCode,
        name: line.itemName,
        description: line.itemName,
        quantity: line.orderedQty,
        unitPrice: line.unitPrice,
        discount: 0,
        total: line.orderedQty * line.unitPrice,
        warehouse: line.warehouse,
        /* Forward the line's stored UoM so the configurator opens on
           the same unit the line items table shows. Without this the
           configurator silently defaulted to the product's primary
           every open. */
        uom: line.uom,
        /* Tracking + sourcing flags drive the configurator's header
           pills (Lot tag, Serialized icon, Purchased badge). Derived
           from CATALOG so a Lot Non-Serialized line shows the
           two-segment LotTrackingTag here just like in the grid. */
        isSerialized: lineFlags?.isSerialized,
        isLotControlled: lineFlags?.isLotControlled,
        sourceType: lineFlags?.sourceType,
        /* Seed the configurator's freight row from the SOLine's own
           shipmentCost + pickupLocation while keeping every other
           ShipmentConfig field valid (method, carrier, dates, etc).
           Without merging in DEFAULT_SHIPMENT the editor crashes
           when the user opens ShipmentMethodModal because `method`
           would be undefined. */
        shipmentConfig: (typeof line.shipmentCost === 'number' || line.shipmentConfig?.pickupLocation)
          ? {
              ...DEFAULT_SHIPMENT,
              ...(line.shipmentConfig ?? {}),
              shipmentCost: typeof line.shipmentCost === 'number' ? line.shipmentCost : undefined,
            }
          : undefined,
      }
    : item
      ? {
          id: item.id,
          productId: item.productId,
          name: item.productName,
          description: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: 0,
          total: item.subtotal,
          uom: (item as any).uom,
          isSerialized: itemFlags?.isSerialized,
          isLotControlled: itemFlags?.isLotControlled,
          sourceType: itemFlags?.sourceType,
        }
      : null;

  if (!mappedItem) return null;

  const deleteLabel = isPostDraft ? "Cancel Line Item" : "Delete from Order";

  return (
    <LineItemConfigModal
      isOpen={isOpen}
      onClose={onClose}
      item={mappedItem}
      readOnly={readOnly}
      deleteLabel={deleteLabel}
      onDelete={onDelete}
      customerName={customerName}
      onMaterialEvent={onMaterialEvent}
      stageLibraryChanges={stageLibraryChanges}
      pricingAPI={pricingAPI}
      adjustmentsAPI={adjustmentsAPI}
      lineId={line?.id}
      /* Forward the SO-side split-context props using the configurator's
         existing Quote-flavoured prop names. The configurator is agnostic
         to whether it sits in a Quote or SO surface. */
      quoteDefaultFreight={orderDefaultFreight}
      siblingLineCount={siblingLineCount}
      anyOtherLineHasOverride={anyOtherLineHasOverride}
      onSeedSiblingFreightShares={onSeedSiblingFreightShares}
      docId={docId}
      currentUser={currentUser}
      onSave={(updatedItem) => {
        if (line) {
          const qty = Number(updatedItem?.quantity ?? mappedItem.quantity);
          const rawTotal = Number(updatedItem?.total ?? qty * Number(updatedItem?.unitPrice ?? mappedItem.unitPrice));
          const effectiveUnitPrice = qty > 0 ? rawTotal / qty : Number(updatedItem?.unitPrice ?? mappedItem.unitPrice);
          /* Forward shipmentCost + pickupLocation so SODetail can
             persist both on the SOLine. Undefined values clear the
             override / pickup. */
          const nextShipmentCost = updatedItem?.shipmentConfig?.shipmentCost;
          const nextPickup = updatedItem?.shipmentConfig?.pickupLocation;
          onSave({
            orderedQty: qty,
            unitPrice: effectiveUnitPrice,
            shipmentCost: typeof nextShipmentCost === 'number' ? nextShipmentCost : undefined,
            shipmentConfig: nextPickup ? { pickupLocation: nextPickup } : undefined,
          });
          return;
        }

        onSave(updatedItem);
      }}
    />
  );
}
