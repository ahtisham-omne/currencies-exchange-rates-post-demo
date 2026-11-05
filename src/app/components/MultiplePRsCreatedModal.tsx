/* ═══════════════════════════════════════════════════════════════
   MultiplePRsCreatedModal — post-submit confirmation for multi-
   vendor PR splits.
   ───────────────────────────────────────────────────────────────
   Every purchase request must belong to a single vendor. When the
   buyer's basket spans more than one preferred vendor, both the
   existing-item review modal and the new-item modal split their
   picks into N `addPR` calls (one per vendor) and hand the created
   records to this modal.

   Visual pattern mirrors the PO cart's "Purchase Orders Created"
   confirmation (`CartPage.tsx:1159-1326`): emerald check chip in
   the header, per-request rows with checkboxes + external-link
   icons, and a footer with "Back to Requests" + "Open Selected (N)".
   ═══════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { FONT } from "./designTokens";

export interface CreatedPRSummary {
  id: string;
  vendor: string;
  itemCount: number;
  total: number;
}

interface MultiplePRsCreatedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  created: CreatedPRSummary[];
  onBackToList: () => void;
  onOpen: (ids: string[]) => void;
}

export default function MultiplePRsCreatedModal({
  open,
  onOpenChange,
  created,
  onBackToList,
  onOpen,
}: MultiplePRsCreatedModalProps) {
  /* Every created PR starts checked so "Open Selected (N)" is a
     one-click open-all — matches the PO cart behavior. */
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(created.map((c) => c.id)),
  );
  useEffect(() => {
    if (!open) return;
    setChecked(new Set(created.map((c) => c.id)));
  }, [open, created]);

  const checkedCount = useMemo(
    () => created.filter((c) => checked.has(c.id)).length,
    [created, checked],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden rounded-2xl"
        style={{
          fontFamily: FONT,
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div
            className="flex items-center justify-center shrink-0 rounded-md border"
            style={{
              width: 36,
              height: 36,
              backgroundColor: "#ECFDF5",
              borderColor: "#A7F3D0",
            }}
          >
            <Check
              style={{ width: 18, height: 18, color: "#065F46" }}
              strokeWidth={2.25}
            />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "hsl(var(--foreground))",
                fontFamily: FONT,
                lineHeight: 1.4,
              }}
            >
              Purchase Requests Created
            </DialogTitle>
            <DialogDescription
              className="mt-0.5"
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "hsl(var(--muted-foreground))",
                fontFamily: FONT,
                lineHeight: 1.45,
              }}
            >
              <span className="tabular-nums">{created.length}</span> purchase
              requests have been created — one per vendor.
            </DialogDescription>
          </div>
        </div>

        {/* Request list */}
        <div className="px-5 py-3 flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
          {created.map((pr) => {
            const isChecked = checked.has(pr.id);
            return (
              <label
                key={pr.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
                style={{
                  backgroundColor: isChecked ? "#F8FAFC" : "transparent",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
                onMouseEnter={(e) => {
                  if (!isChecked)
                    e.currentTarget.style.backgroundColor = "#FAFBFD";
                }}
                onMouseLeave={(e) => {
                  if (!isChecked)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      if (next.has(pr.id)) next.delete(pr.id);
                      else next.add(pr.id);
                      return next;
                    })
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                        fontFamily: FONT,
                        lineHeight: 1.4,
                      }}
                    >
                      {pr.id}
                    </span>
                    <span
                      style={{
                        color: "hsl(var(--muted-foreground))",
                        fontSize: 11,
                      }}
                    >
                      ·
                    </span>
                    <span
                      className="truncate"
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: "hsl(var(--muted-foreground))",
                        fontFamily: FONT,
                        lineHeight: 1.4,
                      }}
                    >
                      {pr.vendor}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "hsl(var(--foreground))",
                        fontFamily: FONT,
                        lineHeight: 1.4,
                      }}
                    >
                      $
                      {pr.total.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        color: "hsl(var(--muted-foreground))",
                        fontFamily: FONT,
                        lineHeight: 1.4,
                      }}
                    >
                      <span className="tabular-nums">{pr.itemCount}</span> item
                      {pr.itemCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <ExternalLink
                  style={{
                    width: 13,
                    height: 13,
                    color: "hsl(var(--muted-foreground))",
                  }}
                  strokeWidth={2}
                />
              </label>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{
            borderTop: "1px solid hsl(var(--border))",
            backgroundColor: "#F8FAFC",
          }}
        >
          <button
            onClick={() => {
              onOpenChange(false);
              onBackToList();
            }}
            className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0 h-9 px-4"
            style={{
              backgroundColor: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1,
              fontFamily: FONT,
              border: "1px solid hsl(var(--border))",
              boxShadow: "0 1px 2px 0 rgba(0,0,0,0.03)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#F1F5F9")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor =
                "hsl(var(--background))")
            }
          >
            <ArrowLeft style={{ width: 14, height: 14 }} strokeWidth={2} />
            Back to Requests
          </button>
          <button
            disabled={checkedCount === 0}
            onClick={() => {
              const ids = created.filter((c) => checked.has(c.id)).map((c) => c.id);
              onOpenChange(false);
              onOpen(ids);
            }}
            className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 h-9 px-4 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1,
              fontFamily: FONT,
              border: "none",
            }}
            onMouseEnter={(e) => {
              if (e.currentTarget.disabled) return;
              e.currentTarget.style.backgroundColor = "#0862D0";
            }}
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "hsl(var(--primary))")
            }
          >
            <ExternalLink style={{ width: 14, height: 14 }} strokeWidth={2} />
            Open Selected{checkedCount > 0 ? ` (${checkedCount})` : ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
