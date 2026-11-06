import { CircleSlash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../ui/alert-dialog";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { OverflowChip } from "./OverflowChip";
import { getItemInactive, formatInactiveDate } from "./inactiveItems";

/**
 * Non-blocking warning shown when a Draft that carries inactive line items
 * is moved forward (Send to Customer, Mark as Sent, Submit for Review,
 * Release for Fulfillment).
 *
 * Ported from the Purchase Order module's `POInactiveItemsWarningModal`:
 * same Partners amber tone (`GroupStatusChangeDialog.amberTone`), gradient
 * wash and glow behind a 64px icon tile, uppercase status chip, centred
 * title and description, the affected lines, stacked full-width buttons.
 * Inactive never blocks. The user can always proceed; this only makes sure
 * they do it knowingly.
 *
 * One change from PO, for scale. PO lists every inactive line and lets the
 * list scroll at 200px, so the fourth line onward sits out of sight with
 * nothing saying it is there. Here the first two lines are always shown in
 * full and the rest collapse into a "+N more" row. That row is Partners'
 * `OverflowChip`, and hovering it opens the remainder in Partners'
 * OverflowTooltip chrome (header, count, thumbnail rows). The list is the
 * same height whether there are three inactive items or thirty.
 */

export type InactiveWarningMode = "send" | "markSent" | "submit" | "release" | "convert";

export interface InactiveWarningLine {
  id: string;
  /** Item code, used to look up the item-master inactive record. */
  code: string;
  name: string;
  image?: string;
}

interface Props {
  open: boolean;
  mode: InactiveWarningMode;
  /** Every line on the record. Only the inactive ones are listed. */
  lines: InactiveWarningLine[];
  /** Singular noun for the record, e.g. "quote", "sales order". */
  noun: string;
  onClose: () => void;
  onConfirm: () => void;
}

/* Partners amber tone (`GroupStatusChangeDialog.amberTone`), as PO uses it. */
const TONE = {
  wash: "#FFFBEB",
  washSoft: "rgba(255,251,235,0.3)",
  glow: "#F59E0B",
  iconBg: "#FEF3C7",
  iconColor: "#B45309",
  chipBg: "#FFFBEB",
  chipFg: "#92400E",
  primaryBg: "#F59E0B",
} as const;

/* PO's inline re-centring (tailwind-merge can drop shadcn's layout classes
   when they are overridden). */
const positioningStyle: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  right: "auto",
  bottom: "auto",
  translate: "none",
  transform: "translate(-50%, -50%)",
  margin: 0,
  width: "calc(100% - 2rem)",
  height: "auto",
  maxWidth: 440,
  maxHeight: "calc(100dvh - 2rem)",
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
};

/* Lines shown in full before the rest collapse into "+N more". */
const MAX_VISIBLE = 2;

/* The hover card is portalled at z-1000, below this dialog (z-15999). */
const OVERFLOW_Z = 16100;

const PRIMARY_LABEL: Record<InactiveWarningMode, string> = {
  send: "Send to Customer anyway",
  markSent: "Mark as Sent anyway",
  submit: "Submit for Review anyway",
  release: "Release for Fulfillment anyway",
  convert: "Convert to Sales Order anyway",
};

const VERB: Record<InactiveWarningMode, string> = {
  send: "Send",
  markSent: "Mark as sent",
  submit: "Submit",
  release: "Release",
  convert: "Convert",
};

function inactiveLine(code: string) {
  const inactive = getItemInactive(code);
  return inactive ? `Inactive since ${formatInactiveDate(inactive.at)} · by ${inactive.by}` : "";
}

export function InactiveItemsWarningModal({ open, mode, lines, noun, onClose, onConfirm }: Props) {
  /* One row per inactive item, not per line. The same item can sit on
     several lines (duplicated lines, split quantities), and listing it
     twice would read as two different problems. */
  const seen = new Set<string>();
  const inactiveLines = lines.filter((l) => {
    if (!getItemInactive(l.code) || seen.has(l.code)) return false;
    seen.add(l.code);
    return true;
  });
  const n = inactiveLines.length;
  const single = n === 1;

  const title = `${VERB[mode]} with ${single ? "an inactive item" : `${n} inactive items`}?`;
  const desc = single
    ? `${inactiveLines[0]?.code ?? "This item"} is no longer active. You can still continue with this ${noun}.`
    : `These items are no longer active. You can still continue with this ${noun}.`;

  const visible = inactiveLines.slice(0, MAX_VISIBLE);
  const overflow = inactiveLines.slice(MAX_VISIBLE);

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent className="p-0 gap-0 overflow-hidden border-0" style={positioningStyle}>
        {/* Amber gradient banner, glow blur behind the icon tile. */}
        <div
          className="relative flex flex-col items-center pt-10 pb-6"
          style={{ background: `linear-gradient(180deg, ${TONE.wash} 0%, ${TONE.washSoft} 70%, transparent 100%)` }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full blur-[50px] opacity-25"
            style={{ width: 180, height: 80, backgroundColor: TONE.glow }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: TONE.iconBg }}
          >
            <CircleSlash style={{ width: 32, height: 32, color: TONE.iconColor }} />
          </div>
          <span
            className="mt-4 rounded-full"
            style={{
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: TONE.chipFg,
              backgroundColor: TONE.chipBg,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {single ? "Inactive item" : `${n} inactive items`}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center px-8 pb-8 overflow-y-auto">
          <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
            <AlertDialogTitle className="tracking-[-0.02em]" style={{ fontSize: 18, fontWeight: 600, color: "#0F172A" }}>
              {title}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription
            className="mt-2 mx-auto"
            style={{ fontSize: 13, color: "#64748B", lineHeight: 1.65, maxWidth: 340 }}
          >
            {desc}
          </AlertDialogDescription>

          {/* Affected lines: the first two in full, the rest behind "+N more". */}
          <div
            className="w-full mt-5 flex flex-col text-left overflow-hidden"
            style={{ border: "1px solid #E2E8F0", borderRadius: 12 }}
          >
            {visible.map((li, idx) => (
              <div
                key={li.id}
                className="flex items-center gap-3 px-3 py-2.5"
                style={{ borderTop: idx === 0 ? "none" : "1px solid #F1F5F9", backgroundColor: "#FFFFFF" }}
              >
                <div
                  className="shrink-0 overflow-hidden"
                  style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid #E2E8F0", backgroundColor: "#F8FAFC" }}
                >
                  <ImageWithFallback src={li.image} alt={li.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", lineHeight: "18px" }}>
                    {li.code}
                  </div>
                  <div className="truncate" style={{ fontSize: 12, color: "#64748B", lineHeight: "16px" }}>
                    {li.name}
                  </div>
                  <div className="truncate" style={{ fontSize: 11, color: "#94A3B8", lineHeight: "16px", marginTop: 2 }}>
                    {inactiveLine(li.code)}
                  </div>
                </div>
              </div>
            ))}

            {overflow.length > 0 && (
              <div
                className="flex items-center px-3 py-2"
                style={{ borderTop: "1px solid #F1F5F9", backgroundColor: "#F8FAFC" }}
              >
                <HoverCard openDelay={150} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <span className="inline-flex">
                      <OverflowChip count={overflow.length} />
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    className="w-[280px] p-0 bg-white rounded-lg border border-border/50 overflow-hidden"
                    style={{ zIndex: OVERFLOW_Z, boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)" }}
                  >
                    {/* Partners OverflowTooltip header: category + count. */}
                    <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
                      <span className="text-[11px] tracking-wide uppercase text-muted-foreground/70" style={{ fontWeight: 600 }}>
                        More inactive items
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 tabular-nums">{overflow.length}</span>
                    </div>
                    <div className="px-1.5 pb-1.5 overflow-y-auto" style={{ maxHeight: 220 }}>
                      {overflow.map((li) => (
                        <div key={li.id} className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left">
                          <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 bg-muted border border-[#E8ECF1]">
                            <ImageWithFallback src={li.image} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[12px] truncate block text-foreground" style={{ fontWeight: 500 }}>
                              {li.code}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 block truncate">
                              {inactiveLine(li.code)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            )}
          </div>

          {/* Stacked buttons: amber proceed on top, grey stay-in-draft below. */}
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full transition-opacity hover:opacity-90"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 12,
                border: 0,
                backgroundColor: TONE.primaryBg,
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              {PRIMARY_LABEL[mode]}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full transition-colors hover:opacity-90"
              style={{
                height: 44,
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 12,
                border: 0,
                backgroundColor: "#F1F5F9",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              Keep as Draft
            </button>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default InactiveItemsWarningModal;
