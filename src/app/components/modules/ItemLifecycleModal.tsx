import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Archive,
  ArchiveRestore,
  CircleCheck,
  CircleSlash,
  AlertTriangle,
} from "lucide-react";
import { POS_BY_ITEM } from "@/app/context/purchasing/mockData";

export type ItemLifecycleAction = "archive" | "unarchive" | "disable" | "enable" | null;

/** Counts open transactions for an item across the mock data. Mirrors the
 *  spec table — Draft / Sent / Confirmed / Partially Received POs count as
 *  active; cancelled / fully_received do not. Sales orders, shipments and
 *  quotes are derived deterministically from the same PO pool so the warning
 *  numbers stay stable across renders without needing additional mocks. */
export function getItemActiveTransactions(itemId: string) {
  const pos = POS_BY_ITEM[itemId] ?? [];
  const openPOs = pos.filter((p) =>
    ["draft", "sent", "confirmed", "partially_received", "active_with_cancellation"].includes(p.status),
  ).length;
  const pendingShipments = pos.filter((p) => p.status === "partially_received").length;
  const pendingReceipts = pos.filter((p) => p.status === "confirmed" || p.status === "sent").length;
  return { openPOs, pendingShipments, pendingReceipts, total: openPOs + pendingShipments + pendingReceipts };
}

interface Props {
  open: boolean;
  action: ItemLifecycleAction;
  itemName: string;
  itemId: string;
  /** Live on-hand quantity — drives the archive gate (must be 0 to archive). */
  onHandQty?: number;
  onConfirm: (next: "active" | "inactive" | "archived") => void;
  onCancel: () => void;
}

const greenTone = { wash: "#ECFDF5", washSoft: "rgba(236,253,245,0.3)", glow: "#10B981", iconBg: "#D1FAE5", iconColor: "#065F46", chipBg: "#ECFDF5", chipFg: "#065F46", primaryBg: "#10B981" };
const redTone   = { wash: "#FEF2F2", washSoft: "rgba(254,242,242,0.3)", glow: "#EF4444", iconBg: "#FEE2E2", iconColor: "hsl(var(--destructive))", chipBg: "#FEF2F2", chipFg: "#991B1B", primaryBg: "hsl(var(--destructive))" };
const amberTone = { wash: "#FFFBEB", washSoft: "rgba(255,251,235,0.3)", glow: "#F59E0B", iconBg: "#FEF3C7", iconColor: "#B45309", chipBg: "#FFFBEB", chipFg: "#92400E", primaryBg: "#F59E0B" };

export function ItemLifecycleModal({ open, action, itemName, itemId, onHandQty, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] bg-white"
        style={{ zIndex: 220 }}
      >
        {(() => {
          if (!action) return null;
          const isUnarchive = action === "unarchive";
          const isArchive = action === "archive";
          const isEnable = action === "enable";
          const isDisable = action === "disable";
          // Transaction + stock signals — reuse the existing PO-derived counts (no WOs).
          const tx = (isArchive || isDisable) ? getItemActiveTransactions(itemId) : null;
          const txTotal = tx?.total ?? 0;
          const onHand = onHandQty ?? 0;
          // Archive gate (lifecycle matrix): allowed ONLY when on-hand is zero AND
          // there are no open transactions. Every other combination is blocked.
          const archiveBlocked = isArchive && (onHand > 0 || txTotal > 0);
          // "Mark as Inactive" keeps a soft, informational warning (no hard gate).
          const disableHasActive = isDisable && txTotal > 0;
          const tone = isUnarchive || isEnable ? greenTone : isArchive ? redTone : amberTone;
          const Icon = isUnarchive ? ArchiveRestore : isEnable ? CircleCheck : isArchive ? Archive : CircleSlash;
          const chipLabel = isUnarchive ? "Restore" : isEnable ? "Mark as Active" : isArchive ? "Archive" : "Mark as Inactive";
          const title = isUnarchive
            ? `Restore ${itemName}?`
            : isEnable
              ? `Mark ${itemName} as Active?`
              : isArchive
                ? `Archive ${itemName}?`
                : `Mark ${itemName} as Inactive?`;
          const desc = archiveBlocked
            ? "Archiving is only available once on-hand stock is zero and there are no open transactions. Clear the items listed above, then archive."
            : isUnarchive
            ? "This item is restored to active status. It becomes available for purchasing, selling, and inventory transactions and reappears in pickers, search, and default listings."
            : isEnable
              ? "This item becomes available for purchasing, selling, and inventory transactions. It will appear in item pickers, search results, and default listings."
              : isArchive
                ? "This item is removed from active lists and all pickers. Existing transactions, inventory records, and purchase history stay exactly as-is. The item can be restored from the archive at any time."
                : "This item won't be available for new transactions. Existing purchase orders, sales orders, and inventory records stay exactly as-is. You can still move existing inventory of this item.";
          const primaryLabel = isUnarchive ? "Restore item" : isEnable ? "Mark as Active" : isArchive ? "Archive item" : "Mark as Inactive";
          const cancelLabel = isUnarchive ? "Keep archived" : isEnable ? "Keep inactive" : "Keep active";
          const nextStatus: "active" | "inactive" | "archived" =
            isUnarchive || isEnable ? "active" : isArchive ? "archived" : "inactive";

          return (
            <>
              <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: `linear-gradient(180deg, ${tone.wash} 0%, ${tone.washSoft} 70%, transparent 100%)` }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: tone.glow }} />
                <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: tone.iconBg }}>
                  <Icon className="w-8 h-8" style={{ color: tone.iconColor }} />
                </div>
                <span
                  className="mt-4 px-3 py-1 rounded-full text-[11px]"
                  style={{ fontWeight: 600, backgroundColor: tone.chipBg, color: tone.chipFg, textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                  {chipLabel}
                </span>
              </div>
              <div className="flex flex-col items-center text-center px-8 pb-8">
                <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
                  <AlertDialogTitle className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>
                    {title}
                  </AlertDialogTitle>
                </AlertDialogHeader>

                {archiveBlocked && (
                  <div
                    className="w-full mt-5 rounded-xl border text-left px-4 py-3"
                    style={{ backgroundColor: redTone.wash, borderColor: "#FECACA" }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4" style={{ color: redTone.iconColor }} />
                      <span className="text-[12px]" style={{ fontWeight: 600, color: redTone.chipFg }}>
                        Resolve these before archiving:
                      </span>
                    </div>
                    <ul className="text-[12px] pl-6" style={{ color: "#7F1D1D", listStyle: "disc", lineHeight: 1.6 }}>
                      {onHand > 0 && <li>{onHand.toLocaleString()} unit{onHand === 1 ? "" : "s"} on hand — zero out first (consume, scrap, transfer, or write-off)</li>}
                      {tx!.openPOs > 0 && <li>{tx!.openPOs} open Purchase Order{tx!.openPOs === 1 ? "" : "s"} — close or cancel first</li>}
                      {tx!.pendingShipments > 0 && <li>{tx!.pendingShipments} pending shipment{tx!.pendingShipments === 1 ? "" : "s"} — complete or cancel first</li>}
                      {tx!.pendingReceipts > 0 && <li>{tx!.pendingReceipts} pending receipt{tx!.pendingReceipts === 1 ? "" : "s"} — receive or cancel first</li>}
                    </ul>
                  </div>
                )}

                {disableHasActive && (
                  <div
                    className="w-full mt-5 rounded-xl border text-left px-4 py-3"
                    style={{ backgroundColor: amberTone.wash, borderColor: "#FDE68A" }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4" style={{ color: amberTone.iconColor }} />
                      <span className="text-[12px]" style={{ fontWeight: 600, color: amberTone.chipFg }}>
                        This item has active transactions:
                      </span>
                    </div>
                    <ul className="text-[12px] pl-6" style={{ color: "#78350F", listStyle: "disc", lineHeight: 1.6 }}>
                      {tx!.openPOs > 0 && <li>{tx!.openPOs} open Purchase Order{tx!.openPOs === 1 ? "" : "s"}</li>}
                      {tx!.pendingShipments > 0 && <li>{tx!.pendingShipments} pending shipment{tx!.pendingShipments === 1 ? "" : "s"}</li>}
                      {tx!.pendingReceipts > 0 && <li>{tx!.pendingReceipts} pending receipt{tx!.pendingReceipts === 1 ? "" : "s"}</li>}
                    </ul>
                    <div className="text-[11.5px] mt-2" style={{ color: "#78350F", lineHeight: 1.55 }}>
                      Marking as inactive won't cancel these transactions, but no new ones can be created.
                    </div>
                  </div>
                )}

                <AlertDialogDescription className="text-[13px] mt-4 max-w-[360px] mx-auto" style={{ color: "hsl(var(--muted-foreground))", lineHeight: "1.65" }}>
                  {desc}
                </AlertDialogDescription>

                <div className="w-full mt-7 flex flex-col gap-2.5">
                  <button
                    onClick={() => onConfirm(nextStatus)}
                    disabled={archiveBlocked}
                    className={`w-full h-11 text-[14px] rounded-xl border-0 transition-colors ${archiveBlocked ? "cursor-not-allowed" : "cursor-pointer hover:opacity-90"}`}
                    style={{ fontWeight: 600, backgroundColor: tone.primaryBg, color: "#fff", opacity: archiveBlocked ? 0.5 : 1 }}
                  >
                    {primaryLabel}
                  </button>
                  <button
                    onClick={onCancel}
                    className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                    style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "#334155" }}
                  >
                    {cancelLabel}
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </AlertDialogContent>
    </AlertDialog>
  );
}