import { useState } from "react";
import { X, Ban, AlertTriangle, Package, Check, ChevronsDown, ChevronsUp } from "lucide-react";
import { ItemTypeBadge } from "./StatusBadge";
import { InactiveItemPill } from "../shared/InactiveItemPill";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import type { SalesOrder, SOLine } from "./types";

interface Props { so: SalesOrder; onConfirm: (lineIds: string[], reason: string) => void; onClose: () => void; }

export function PartialCancelModal({ so, onConfirm, onClose }: Props) {
  const cancellableLines = so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty);
  const nonCancellableLines = so.lines.filter(l => !l.cancelled && l.shippedQty >= l.orderedQty);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  
  const toggleLine = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleAll = () => { if (selectedIds.size === cancellableLines.length) setSelectedIds(new Set()); else setSelectedIds(new Set(cancellableLines.map(l => l.id))); };
  const handleConfirm = () => { if (selectedIds.size === 0) return; onConfirm(Array.from(selectedIds), reason || "Partial cancellation"); onClose(); };

  const isDirty = selectedIds.size > 0 || reason.length > 0;
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: handleConfirm, onClose: guardedClose, confirmDisabled: selectedIds.size === 0 });
  const selectedLines = cancellableLines.filter(l => selectedIds.has(l.id));
  const totalAllocToRelease = selectedLines.reduce((s, l) => s + l.allocations.filter(a => !a.locked).reduce((as, a) => as + a.qty, 0), 0);

  const toggleDescription = (lineId: string) => {
    setExpandedDescriptions(prev => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId); else next.add(lineId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      <div className="relative bg-card rounded-xl border border-border w-[640px] max-h-[80vh] flex flex-col overflow-hidden shadow-elevation-sm">
        {/* Header — Quotes canonical warn variant: 32px chip (warning/20 bg), 14px title, 11px muted subtitle, 28px close. */}
        <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: "16px 20px" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg flex items-center justify-center" style={{ width: 32, height: 32, backgroundColor: "rgba(217, 119, 6, 0.18)" }}>
              <Ban style={{ width: 16, height: 16, color: "var(--warning)" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Partial Cancellation</h3>
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4, margin: 0 }}>{so.soNumber} · Select lines to cancel</p>
            </div>
          </div>
          <button
            onClick={guardedClose}
            className="rounded-md flex items-center justify-center transition-colors"
            style={{ width: 28, height: 28, border: "none", backgroundColor: "transparent", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <X style={{ width: 16, height: 16, color: "var(--muted-foreground)" }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[length:var(--text-caption)] text-foreground font-semibold">Cancellable Lines</span>
                <span className="text-[length:var(--text-small)] text-muted-foreground">({cancellableLines.length})</span>
              </div>
              <button onClick={toggleAll} className="text-[length:var(--text-caption)] text-primary hover:underline font-medium">{selectedIds.size === cancellableLines.length ? "Deselect All" : "Select All"}</button>
            </div>
            {cancellableLines.length === 0 && <div className="text-center py-6 text-[length:var(--text-caption)] text-muted-foreground">No lines eligible for cancellation -- all fully shipped.</div>}
            <div className="space-y-2">
              {cancellableLines.map(line => {
                const isSelected = selectedIds.has(line.id);
                const isExpanded = expandedDescriptions.has(line.id);
                const descriptionLines = line.itemName.split(' ').length > 12;
                const unshippedAlloc = line.allocations.filter(a => !a.locked).reduce((s, a) => s + a.qty, 0);
                return (
                  <div
                    key={line.id}
                    className={`rounded-lg border transition-colors ${isSelected ? "border-destructive/30 bg-destructive/5" : "border-border hover:bg-secondary"}`}
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 cursor-pointer mt-0.5 ${isSelected ? "border-destructive bg-destructive" : "border-border"}`}
                        onClick={() => toggleLine(line.id)}
                      >
                        {isSelected && <Check className="w-3 h-3 text-destructive-foreground" strokeWidth={3} />}
                      </div>
                      
                      {/* Thumbnail */}
                      <div className="w-9 h-9 rounded-md bg-secondary/70 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-foreground/15" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[length:var(--text-caption)] text-foreground font-semibold">{line.itemCode}</span>
                          <InactiveItemPill code={line.itemCode} size="md" />
                          <ItemTypeBadge type={line.itemType} />
                        </div>
                        <div className="text-[length:var(--text-caption)] text-foreground/50" style={{ position: "relative" }}>
                          <div
                            className={`${!isExpanded ? "line-clamp-2" : ""}`}
                            style={!isExpanded && descriptionLines ? { paddingRight: 56 } : undefined}
                          >
                            {line.itemName}
                          </div>
                          {!isExpanded && descriptionLines && (
                            <span
                              onClick={(e) => { e.stopPropagation(); toggleDescription(line.id); }}
                              className="text-primary hover:underline font-medium"
                              style={{
                                position: "absolute", right: 0, bottom: 0,
                                display: "inline-flex", alignItems: "center", gap: 3,
                                paddingLeft: 28,
                                background: "linear-gradient(to right, rgba(255,255,255,0) 0%, #FFFFFF 24px, #FFFFFF 100%)",
                                cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1.45,
                              }}
                            >
                              more <ChevronsDown className="w-3 h-3" />
                            </span>
                          )}
                          {isExpanded && descriptionLines && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleDescription(line.id); }}
                              className="text-primary hover:underline font-medium text-[length:var(--text-small)] mt-0.5 inline-flex items-center gap-0.5"
                            >
                              less <ChevronsUp className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-[length:var(--text-small)] text-muted-foreground mt-1">
                          Ord: {line.orderedQty} · Alloc: {line.allocatedQty} · Ship: {line.shippedQty}
                          {unshippedAlloc > 0 && <span className="text-chart-3 ml-1">· {unshippedAlloc} will be released</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {nonCancellableLines.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2"><span className="text-[length:var(--text-caption)] text-muted-foreground font-medium">Cannot cancel ({nonCancellableLines.length})</span></div>
                <div className="space-y-1.5">
                  {nonCancellableLines.map(line => (
                    <div key={line.id} className="flex items-center gap-3 px-4 py-2 rounded-lg border border-border/50 bg-secondary opacity-50">
                      <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-[length:var(--text-caption)] text-foreground/50 truncate">{line.itemCode} -- fully shipped ({line.shippedQty}/{line.orderedQty})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4">
              <label className="text-[length:var(--text-caption)] text-foreground/50 mb-1.5 block font-medium">Cancellation Reason (optional)</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Customer requested, spec change, budget cut..." className="w-full border border-border rounded-lg px-3 py-2 text-[length:var(--text-caption)] text-foreground placeholder-foreground/35 outline-none focus:ring-2 focus:ring-ring resize-none bg-card" rows={2} />
            </div>
            {selectedIds.size > 0 && (
              <div className="mt-4 border border-chart-3/20 bg-chart-3/5 rounded-lg p-3.5">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-chart-3" /><span className="text-[length:var(--text-caption)] text-chart-3 font-semibold">Impact Summary</span></div>
                <ul className="space-y-1 text-[length:var(--text-caption)] text-chart-3">
                  <li>- {selectedIds.size} line(s) will be cancelled</li>
                  {totalAllocToRelease > 0 && <li>- {totalAllocToRelease} unit(s) of reserved inventory will be released</li>}
                  <li>- SO status may change based on remaining active lines</li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary shrink-0">
          <span className="text-[length:var(--text-caption)] text-foreground/50">{selectedIds.size} of {cancellableLines.length} lines selected</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
              Cancel <KbdHint keys="Esc" />
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={selectedIds.size === 0} icon={<Ban className="w-3.5 h-3.5" />}>
              Cancel {selectedIds.size} Line{selectedIds.size !== 1 ? "s" : ""} <KbdHint keys="⌘↵" variant="light" />
            </Button>
          </div>
        </div>
      </div>
      {discardDialog}
    </div>
  );
}