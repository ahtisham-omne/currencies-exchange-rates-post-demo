import React, { useState } from "react";
import { Zap, Info, Trash2, Pencil, Plus, TrendingDown, TrendingUp, CirclePlus } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { AdjustmentFormModal, type AdjustmentFormData } from "./AdjustmentFormModal";
import { ConfirmationModal } from "./ConfirmationModal";
import {
  adjustmentDollarImpact,
  adjustmentDisplayLabel,
  newAdjustmentId,
  type LineOneTimeAdjustment,
} from "./poOrderPricing";
import { useDocMoney } from "./currency/docCurrencyContext";

/**
 * Item-level "One-Time Discounts/Premiums" section — ported from
 * Sales-Order-V5 `quote-creation/LineItemConfigModal.tsx` (the card that
 * sits under Pricing Rules in the line configurator, plus its
 * AdjustmentFormModal wiring and Remove / Remove-all confirmations).
 *
 * PO adaptation: it edits a local list (`value` / `onChange`) that the
 * Items Detail Modal commits on save — so it works in creation flows
 * (no PO yet) and Cancel discards. Removing here only affects THIS line
 * (fix for SO's remove-from-every-line bug — the parent applies the
 * list via `replaceLineAdjustments`).
 */
export function LineOneTimeAdjustmentsSection({
  value,
  onChange,
  baseSubtotal,
  readOnly = false,
  itemName,
}: {
  value: LineOneTimeAdjustment[];
  onChange: (next: LineOneTimeAdjustment[]) => void;
  /** Line value % one-times are measured against (qty × net PPU). */
  baseSubtotal: number;
  readOnly?: boolean;
  itemName: string;
}) {
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null);
  const [removeAdjConfirm, setRemoveAdjConfirm] = useState<{ id: string; label: string } | null>(null);
  const [showDeleteAllAdjustmentsConfirm, setShowDeleteAllAdjustmentsConfirm] = useState(false);

  // Fixed amounts and impacts are in the order's currency.
  const formatCurrency = useDocMoney();

  const oneTimeTotal = value
    .filter((adj) => adj.isApplied)
    .reduce((sum, adj) => {
      const amount = adjustmentDollarImpact(adj, baseSubtotal);
      return sum + (adj.type === "discount" ? -amount : amount);
    }, 0);
  const totalActiveDiscountAmount = value
    .filter((adj) => adj.isApplied && adj.type === "discount")
    .reduce((s, adj) => s + adjustmentDollarImpact(adj, baseSubtotal), 0);
  const discountCapHit = baseSubtotal > 0 && totalActiveDiscountAmount >= baseSubtotal;

  const editAdjustment = (adj: LineOneTimeAdjustment) => {
    setEditingAdjustmentId(adj.id);
    setShowAdjustmentModal(true);
  };

  const closeForm = () => {
    setShowAdjustmentModal(false);
    setEditingAdjustmentId(null);
  };

  return (
    <>
      {/* One-Time Discounts/Premiums Section */}
      <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: "12px", overflow: "hidden" }}>
        {value.length > 0 ? (
          <div>
            {/* Header — Partner ContentCard chrome. */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EEF2F6]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5 text-[#1B6EF3]" />
                </div>
                <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>One-Time Discounts/Premiums</span>
                <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap shrink-0" style={{ fontWeight: 500, color: "#475569", backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }}>
                  Item-Level
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="About item-level one-time discounts and premiums"
                      className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" collisionPadding={12} avoidCollisions className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]">
                    One-time item-level discounts and premiums apply to this line item only. Use them for per-line adjustments.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[13px] ${oneTimeTotal < 0 ? "text-[#10B981]" : oneTimeTotal > 0 ? "text-[#7C3AED]" : "text-[#6B7280]"}`} style={{ fontWeight: 600 }}>
                  {oneTimeTotal < 0 ? "−" : "+"}{formatCurrency(Math.abs(oneTimeTotal))}
                </span>
                {!readOnly && value.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteAllAdjustmentsConfirm(true)}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    aria-label="Remove all adjustments"
                    title="Remove all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {/* Adjustment bars */}
            {value.map((adj, index) => {
              const amount = adjustmentDollarImpact(adj, baseSubtotal);
              const isDiscount = adj.type === "discount";
              const isUnapplied = !adj.isApplied;
              const leftBorderColor = isUnapplied ? "#E5E7EB" : isDiscount ? "#10B981" : "#7C3AED";
              const iconColor = isUnapplied ? "text-[#9CA3AF]" : isDiscount ? "text-[#10B981]" : "text-[#7C3AED]";
              const valueColor = isUnapplied ? "text-[#9CA3AF]" : isDiscount ? "text-[#10B981]" : "text-[#7C3AED]";
              const isLast = index === value.length - 1;
              return (
                <div
                  key={adj.id}
                  className="flex items-start justify-between pr-4 group transition-colors cursor-pointer"
                  style={{
                    paddingLeft: "12px",
                    paddingTop: "8px",
                    paddingBottom: "8px",
                    borderLeftWidth: "3px",
                    borderLeftStyle: "solid",
                    borderLeftColor: leftBorderColor,
                    borderBottomWidth: isLast ? "0px" : "1px",
                    borderBottomStyle: "solid",
                    borderBottomColor: "#F3F4F6",
                    background: "#FFFFFF",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#FFFFFF"; }}
                  onClick={() => !readOnly && !isUnapplied && editAdjustment(adj)}
                >
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {isDiscount
                      ? <TrendingDown className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0 mt-[2px]`} />
                      : <TrendingUp className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0 mt-[2px]`} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[12px] ${isUnapplied ? "text-[#9CA3AF]" : "text-[#1F2937]"}`} style={{ fontWeight: 500 }}>{adjustmentDisplayLabel(adj)}</span>
                        {isUnapplied && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]" style={{ borderRadius: "3px", fontWeight: 500 }}>Deactivated</span>
                        )}
                      </div>
                      {isUnapplied && adj.unappliedReason === "EXCEEDS_100_PERCENT" && (
                        <div className="text-[10px] text-[#B45309] mt-0.5" style={{ fontWeight: 500 }}>Exceeds 100% of item price — deactivated automatically</div>
                      )}
                      {isUnapplied && adj.unappliedReason === "USER_UNAPPLIED" && (
                        <div className="text-[10px] text-[#6B7280] mt-0.5" style={{ fontWeight: 400 }}>Manually deactivated — re-apply it from the Order Summary <CirclePlus className="inline w-2.5 h-2.5 align-text-bottom" /></div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 mt-[2px]">
                    <div className="text-right flex items-baseline justify-end gap-2" style={{ minWidth: 130 }}>
                      <span className={`text-[12px] ${valueColor}`} style={{ fontWeight: 600, textDecoration: isUnapplied ? "line-through" : undefined }}>
                        {isDiscount ? "−" : "+"}{adj.amountType === "$" ? formatCurrency(adj.amount) : `${adj.amount}%`}
                      </span>
                      {adj.amountType === "%" && (
                        <span className={`text-[11px] ${valueColor}`} style={{ fontWeight: 500, opacity: 0.8, textDecoration: isUnapplied ? "line-through" : undefined }}>{isDiscount ? "−" : "+"}{formatCurrency(amount)}</span>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); editAdjustment(adj); }}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#1B6EF3] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                          aria-label="Edit adjustment"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setRemoveAdjConfirm({ id: adj.id, label: adjustmentDisplayLabel(adj) }); }}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          aria-label="Remove adjustment"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Add more adjustments link inside card */}
            {!readOnly && (
              <div className="px-3 py-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(true)}
                  className="flex items-center gap-1.5 text-[12px] text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors"
                  style={{ fontWeight: 500 }}
                  title={discountCapHit ? "Discount cap reached — only premium adjustments will apply. New discounts will be auto-unapplied." : undefined}
                >
                  <Plus className="w-3 h-3" />
                  Add One-Time Discount/Premium
                  {discountCapHit && <span className="text-[10px] text-[#B45309] ml-1">(discount cap reached)</span>}
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Compact empty state — label + dashed Add button. */
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[13px] text-[#6B7280] flex items-center gap-2" style={{ fontWeight: 400 }}>
              <Zap className="w-3.5 h-3.5" />
              One-Time Discounts/Premiums
              <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap shrink-0" style={{ fontWeight: 500, color: "#475569", backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }}>
                Item-Level
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="About item-level one-time discounts and premiums"
                    className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" collisionPadding={12} avoidCollisions className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]">
                  One-time item-level discounts and premiums apply to this line item only. Use them for per-line adjustments.
                </TooltipContent>
              </Tooltip>
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(true)}
                className="h-7 px-2.5 flex items-center gap-1 text-[12px] text-[#1B6EF3] border border-dashed border-[#93C5FD] hover:bg-[#F0F9FF] hover:border-[#1B6EF3] transition-colors"
                style={{ borderRadius: "5px", fontWeight: 500 }}
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit — shared AdjustmentFormModal (item scope, this line only) */}
      {showAdjustmentModal && (
        <AdjustmentFormModal
          mode={editingAdjustmentId ? "edit" : "add"}
          scope="item"
          recordLabel="order"
          initial={editingAdjustmentId ? (() => {
            const adj = value.find((a) => a.id === editingAdjustmentId);
            return adj
              ? { id: adj.id, label: adj.label, type: adj.type, amountType: adj.amountType, amount: adj.amount, scope: "item" as const, internalNotes: adj.internalNotes }
              : undefined;
          })() : undefined}
          onSave={(data: AdjustmentFormData) => {
            if (editingAdjustmentId) {
              const id = editingAdjustmentId;
              onChange(value.map((adj) => adj.id === id
                ? { ...adj, type: data.type, amountType: data.amountType, amount: data.amount, label: data.label, internalNotes: data.internalNotes }
                : adj));
              toast.success(`"${adjustmentDisplayLabel(data)}" updated`);
            } else {
              onChange([...value, {
                id: newAdjustmentId(),
                type: data.type,
                amountType: data.amountType,
                amount: data.amount,
                label: data.label,
                internalNotes: data.internalNotes,
                isApplied: true,
              }]);
              toast.success(`"${adjustmentDisplayLabel(data)}" added to ${itemName}`);
            }
            closeForm();
          }}
          onCancel={closeForm}
        />
      )}

      {/* Remove single one-time adjustment. */}
      {removeAdjConfirm && (
        <ConfirmationModal
          isOpen
          title="Remove this adjustment?"
          message={`"${removeAdjConfirm.label}" will be removed from this line. You can add a new one anytime.`}
          confirmText="Remove"
          cancelText="Keep"
          onConfirm={() => {
            onChange(value.filter((a) => a.id !== removeAdjConfirm.id));
            toast.success(`"${removeAdjConfirm.label}" removed`);
            setRemoveAdjConfirm(null);
          }}
          onCancel={() => setRemoveAdjConfirm(null)}
          variant="red"
          icon={<Trash2 className="w-6 h-6 text-white" />}
        />
      )}

      {/* Remove All Adjustments Confirmation. */}
      <ConfirmationModal
        isOpen={showDeleteAllAdjustmentsConfirm}
        title="Remove all adjustments?"
        message={`All ${value.length} adjustments will be removed from this line. You can add new ones anytime.`}
        confirmText="Remove all"
        cancelText="Keep"
        onConfirm={() => {
          const total = value.length;
          onChange([]);
          setShowDeleteAllAdjustmentsConfirm(false);
          toast.success(total === 1 ? "1 adjustment removed" : `${total} adjustments removed`);
        }}
        onCancel={() => setShowDeleteAllAdjustmentsConfirm(false)}
        variant="red"
        icon={<Trash2 className="w-6 h-6 text-white" />}
      />
    </>
  );
}
