import {
  Send,
  CheckCircle2,
  Package,
  Ban,
  FileText,
  Archive,
  ThumbsDown,
} from "lucide-react";
import {
  StateTransitionOverlay,
  type StateTransitionTone,
} from "@/app/components/shared/StateTransitionOverlay";
import type { QuoteLifecycleStatus } from "./ModernStatusStepper";

/* ════════════════════════════════════════════════════════════════
   Quote-side bridge to the unified StateTransitionOverlay.

   Existing API is preserved (isActive / fromStatus / toStatus /
   customAction / onComplete) so callers in QuoteDetails.tsx don't
   change. Internally we resolve labels + tone + icon and forward
   to the shared component, which provides the centered animation
   and dim+blur backdrop used across modules.
   ═══════════════════════════════════════════════════════════════ */

export interface CustomActionConfig {
  processing: string;
  done: string;
  icon: typeof Send;
  accentColor: string;
  accentBg: string;
  ringColor: string;
  isNegative?: boolean;
}

interface StatusVisual {
  Icon: React.ElementType;
  tone: StateTransitionTone;
  label: string;
  /**
   * Verb-led headline shown above the pills. Each entry frames the
   * action that just happened so the overlay reads naturally per
   * case (e.g. "Sending to Customer", "Archiving Quote").
   */
  heading: string;
}

const STATUS_VISUALS: Record<QuoteLifecycleStatus, StatusVisual> = {
  draft:     { Icon: FileText,     tone: "neutral",     label: "Marked as Draft",          heading: "Reverted to Draft" },
  sent:      { Icon: Send,          tone: "info",        label: "Sent to Customer",         heading: "Sending to Customer" },
  confirmed: { Icon: CheckCircle2,  tone: "success",     label: "Confirmed by Customer",    heading: "Quote Confirmed" },
  converted: { Icon: Package,       tone: "success",     label: "Converted to Sales Order", heading: "Converting to Sales Order" },
  rejected:  { Icon: ThumbsDown,    tone: "destructive", label: "Rejected by Customer",     heading: "Marking as Rejected" },
  cancelled: { Icon: Ban,           tone: "destructive", label: "Quote Cancelled",          heading: "Cancelling Quote" },
  archived:  { Icon: Archive,       tone: "neutral",     label: "Quote Archived",           heading: "Archiving Quote" },
  expired:   { Icon: Ban,           tone: "destructive", label: "Quote Expired",            heading: "Quote Expired" },
};

interface StatusTransitionOverlayProps {
  isActive: boolean;
  fromStatus: QuoteLifecycleStatus;
  toStatus: QuoteLifecycleStatus;
  onComplete: () => void;
  customAction?: CustomActionConfig | null;
}

export function StatusTransitionOverlay({
  isActive,
  fromStatus,
  toStatus,
  onComplete,
  customAction,
}: StatusTransitionOverlayProps) {
  if (customAction) {
    // For action overlays (duplicate / archive), the destination "tone"
    // is derived from `isNegative`; the heading uses the caller's
    // `processing` verb (e.g. "Duplicating Quote", "Archiving Quote")
    // and the from/to pills frame what changed.
    return (
      <StateTransitionOverlay
        isActive={isActive}
        fromLabel={customAction.processing}
        toLabel={customAction.done}
        tone={customAction.isNegative ? "destructive" : "info"}
        Icon={customAction.icon}
        heading={customAction.processing}
        onComplete={onComplete}
      />
    );
  }

  const fromVisual = STATUS_VISUALS[fromStatus];
  const toVisual = STATUS_VISUALS[toStatus];

  return (
    <StateTransitionOverlay
      isActive={isActive}
      fromLabel={fromVisual?.label ?? fromStatus}
      toLabel={toVisual?.label ?? toStatus}
      tone={toVisual?.tone ?? "neutral"}
      Icon={toVisual?.Icon}
      heading={toVisual?.heading}
      onComplete={onComplete}
    />
  );
}

// Re-export for the kanban view so it can derive tones from a status
// without re-creating the mapping table.
export { STATUS_VISUALS as QUOTE_TRANSITION_VISUALS };
