import { PriorityChip } from "../../items-v3/PriorityChip";
import { PriceWithUom } from "../../items-v3/PriceWithUom";
import { OnTimeCell } from "../../items-v3/OnTimeCell";
import { InitialAvatar } from "../../items-v3/InitialAvatar";
import type { QualifiedVendor } from "../../../context/purchasing/types";

export interface QVCardProps {
  qv: QualifiedVendor;
  onClick?: () => void;
}

/**
 * Compact card variant of a qualified-vendor row — used by the grid view.
 */
export function QVCard({ qv, onClick }: QVCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-[12px] border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <PriorityChip priority={qv.priority} />
        <InitialAvatar name={qv.vendorName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{qv.vendorName}</p>
          <p className="text-xs text-muted-foreground truncate">{qv.location}</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Price</span>
          <PriceWithUom price={qv.pricePerUnit} uom={qv.vendorUOM} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Lead Time</span>
          <span className="text-foreground font-medium">{qv.lastPOLeadTime} Days</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">On-time</span>
          <OnTimeCell
            onTimePercent={qv.shipOnTime}
            onTimeCount={qv.onTimeShipments ?? 0}
            onTimeTotal={qv.totalShipments ?? 0}
          />
        </div>
      </div>
    </button>
  );
}