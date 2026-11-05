import React from "react";

export interface PurchasingSectionHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

/**
 * Title + description + right-aligned action slot.
 * Used at the top of each Purchasing sub-tab panel.
 */
export function PurchasingSectionHeader({
  title,
  description,
  action,
}: PurchasingSectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-[18px] font-semibold leading-6 text-foreground">{title}</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}