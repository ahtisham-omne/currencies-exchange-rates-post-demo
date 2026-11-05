import { useEffect, useRef, useState } from "react";
import {
  Truck,
  Ban,
  Archive,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  ThumbsDown,
} from "lucide-react";
import {
  StateTransitionOverlay,
  type StateTransitionTone,
} from "@/app/components/shared/StateTransitionOverlay";
import type { SOStatus } from "./types";

/* ════════════════════════════════════════════════════════════════
   Thin SO-specific wrapper around the shared StateTransitionOverlay.
   Watches `status` for changes and fires the centered transition
   animation. Existing call site in SODetail.tsx is unchanged.
   ═══════════════════════════════════════════════════════════════ */

interface StatusVisual {
  tone: StateTransitionTone;
  Icon: React.ElementType;
  label: string;
  /**
   * Verb-led headline shown above the pills. Should describe the
   * action that just completed in past tense or progressive form so
   * the overlay reads naturally per case (e.g. "Order Cancelled",
   * "Sending to Customer", "Archiving Order").
   */
  heading: string;
}

const STATUS_VISUALS: Record<SOStatus, StatusVisual> = {
  "Draft":              { tone: "neutral",     Icon: Pencil,        label: "Marked as Draft",        heading: "Reverted to Draft" },
  "Pending Review":     { tone: "warning",     Icon: AlertTriangle, label: "Submitted for Review",   heading: "Submitting for Review" },
  "Cleared":            { tone: "info",        Icon: CheckCircle2,  label: "Released",         heading: "Order Released" },
  "Rejected":           { tone: "destructive", Icon: ThumbsDown,    label: "Rejected on Review",     heading: "Rejecting Order" },
  "Partially Shipped":  { tone: "warning",     Icon: Truck,         label: "Partially Shipped",      heading: "Partial Shipment Recorded" },
  "Shipped":            { tone: "success",     Icon: Truck,         label: "Order Shipped",          heading: "Order Shipped" },
  "Cancelled":          { tone: "destructive", Icon: Ban,           label: "Order Cancelled",        heading: "Cancelling Order" },
  "Partially Cancelled":{ tone: "warning",     Icon: Ban,           label: "Lines Cancelled",        heading: "Cancelling Lines" },
  "Archived":           { tone: "neutral",     Icon: Archive,       label: "Marked as Archived",     heading: "Archiving Order" },
};

interface StageTransitionOverlayProps {
  status: SOStatus;
  suppressNextRef?: React.MutableRefObject<boolean>;
}

export function StageTransitionOverlay({ status, suppressNextRef }: StageTransitionOverlayProps) {
  const [active, setActive] = useState(false);
  const [fromStatus, setFromStatus] = useState<SOStatus | null>(null);
  const [toStatus, setToStatus] = useState<SOStatus | null>(null);
  const prevStatusRef = useRef(status);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevStatusRef.current = status;
      return;
    }
    if (status !== prevStatusRef.current) {
      if (suppressNextRef?.current) {
        suppressNextRef.current = false;
        prevStatusRef.current = status;
        return;
      }
      setFromStatus(prevStatusRef.current);
      setToStatus(status);
      prevStatusRef.current = status;
      setActive(true);
    }
  }, [status, suppressNextRef]);

  if (!toStatus || !fromStatus) return null;

  const toVisual = STATUS_VISUALS[toStatus];

  return (
    <StateTransitionOverlay
      isActive={active}
      fromLabel={fromStatus}
      toLabel={toVisual?.label ?? toStatus}
      tone={toVisual?.tone ?? "neutral"}
      Icon={toVisual?.Icon}
      heading={toVisual?.heading}
      onComplete={() => setActive(false)}
    />
  );
}

// Re-exported so other call sites that need to drive the overlay directly
// (e.g. via labels not derived from a SOStatus) can do so without
// reaching past this module boundary.
export { STATUS_VISUALS as SO_TRANSITION_VISUALS };
