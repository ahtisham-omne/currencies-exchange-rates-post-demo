import { LineItemConfigModal } from "@/app/components/quote-creation/LineItemConfigModal";
import type { SOLine, WarehouseInventory } from "./types";

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
  /** Customer-facing transaction currency for the parent order — drives the customer-pays helper line. */
  customerCurrency?: string;
  /** Optional locked rate captured at order send-time. */
  lockedRate?: number;
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
  customerCurrency,
  lockedRate,
}: AdvancedConfiguratorModalProps) {
  if (!isOpen) return null;

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
      customerCurrency={customerCurrency}
      lockedRate={lockedRate}
      onSave={(updatedItem) => {
        if (line) {
          const qty = Number(updatedItem?.quantity ?? mappedItem.quantity);
          const rawTotal = Number(updatedItem?.total ?? qty * Number(updatedItem?.unitPrice ?? mappedItem.unitPrice));
          const effectiveUnitPrice = qty > 0 ? rawTotal / qty : Number(updatedItem?.unitPrice ?? mappedItem.unitPrice);
          onSave({ orderedQty: qty, unitPrice: effectiveUnitPrice });
          return;
        }

        onSave(updatedItem);
      }}
    />
  );
}
