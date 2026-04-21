/**
 * ItemQuickViewTrigger — a reusable wrapper that opens the QuickViewPanel
 * for an item when the user clicks the wrapped content.
 *
 * Usage:
 *   <ItemQuickViewTrigger itemCode="100219-42" vendorName="Toyota International" imageUrl={photo}>
 *     <span className="cursor-pointer hover:underline">100219-42</span>
 *   </ItemQuickViewTrigger>
 *
 * The component renders its children inline (no extra DOM wrapper) and attaches
 * a click handler that calls the provided `onOpenQuickView` callback with the
 * correct QuickViewData shape. It also stops event propagation so row-level
 * clicks (e.g. navigate to partner) are not triggered.
 */

import React, { useCallback } from "react";
import type { QuickViewData } from "./QuickViewPanel";

interface ItemQuickViewTriggerProps {
  /** The item/part code shown in the table cell */
  itemCode: string;
  /** Partner display name — used as context in the card */
  vendorName: string;
  /** Optional thumbnail URL from the table — passed through so the card shows the same image */
  imageUrl?: string;
  /** Callback that sets the QuickViewPanel data (typically `setQuickViewData`) */
  onOpen: (data: QuickViewData) => void;
  /** The clickable content (item code text, thumbnail, etc.) */
  children: React.ReactNode;
  /** Additional className for the wrapper */
  className?: string;
}

export function ItemQuickViewTrigger({
  itemCode,
  vendorName,
  imageUrl,
  onOpen,
  children,
  className,
}: ItemQuickViewTriggerProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpen({
        type: "item",
        item: {
          id: `item-${itemCode}`,
          name: itemCode,
          subtitle: "ITEM",
          imageUrl,
        },
        vendorName,
      });
    },
    [itemCode, vendorName, imageUrl, onOpen]
  );

  return (
    <div
      className={`cursor-pointer ${className || ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(e as unknown as React.MouseEvent); } }}
    >
      {children}
    </div>
  );
}
