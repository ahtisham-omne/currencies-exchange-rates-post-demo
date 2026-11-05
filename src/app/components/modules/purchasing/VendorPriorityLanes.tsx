/**
 * VendorPriorityLanes — the Configure-step "Vendor priority" panel.
 *
 * Priority is a TIERED ranking that ALLOWS TIES: every tier (Priority 1, 2, 3…)
 * can hold one OR MORE vendors. There are NO empty/open slots — tiers are
 * derived from the vendors actually present and stay contiguous.
 *
 * Existing qualified vendors show at their current tier for context (re-ranking
 * them is done in the listing table). The vendors being added are draggable —
 * drop a card onto a tier to place it there (sharing a tier = a tie), or onto
 * the "new tier" zone for a fresh lowest tier.
 *
 * Exactly one vendor is the default (the auto-PO anchor); it must sit in the top
 * tier, so the star is offered only on Priority-1 cards.
 */
import React, { useState } from "react";
import { ListOrdered, GripVertical, Star, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PRIORITY } from "../../../context/PurchasingContext";

export interface PriorityExistingVendor {
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  priority: number;
  price: number;
  uom: string;
  leadTimeDays: number;
}

export interface PriorityDraftConfig {
  priority: string; // "auto" | rank number as string
  pricePerUnit: string;
  uom: string;
  leadTimeDays: string;
  isDefault?: boolean;
}

interface VendorPriorityLanesProps {
  /** The item's already-qualified vendors (shown for context, fixed tier). */
  existing: PriorityExistingVendor[];
  /** Vendors being added this session — id + display name. Draggable. */
  drafts: { id: string; name: string }[];
  /** Captured config per draft vendor id (rank + price/lead + default flag). */
  draftConfig: Record<string, PriorityDraftConfig>;
  /** The draft vendor currently focused in the Configure rail. */
  focusedDraftId: string;
  /** The item's current persisted default vendor (read-only context). */
  existingDefaultVendorId?: string;
  /** Whether any draft has a non-auto rank or default (drives "Reset"). */
  hasArrangement: boolean;
  onSetDraftPriority: (draftVendorId: string, priority: string) => void;
  onSetDefaultDraft: (draftVendorId: string) => void;
  onResetAuto: () => void;
  onFocusDraft: (draftVendorId: string) => void;
}

interface LaneMember {
  id: string; // existing.vendorId | DRAFT_PREFIX + draft id
  draftVendorId?: string;
  isDraft: boolean;
  rawRank: number;
  name: string;
  subtitle?: string;
  priceLabel: string;
  priceFilled: boolean;
  uomLabel: string;
  leadLabel: string;
  leadFilled: boolean;
  isFocusedDraft: boolean;
  isDefault: boolean;
}

const DRAFT_PREFIX = "draft:";

const fmtLead = (days: number) =>
  days <= 0
    ? "—"
    : days < 7
      ? `${days} ${days === 1 ? "day" : "days"}`
      : `${Math.round((days / 7) * 10) / 10} wk${Math.round((days / 7) * 10) / 10 === 1 ? "" : "s"}`;

export function VendorPriorityLanes({
  existing,
  drafts,
  draftConfig,
  focusedDraftId,
  existingDefaultVendorId,
  hasArrangement,
  onSetDraftPriority,
  onSetDefaultDraft,
  onResetAuto,
  onFocusDraft,
}: VendorPriorityLanesProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<number | null>(null);

  const maxExistingRank = existing.reduce((m, x) => Math.max(m, x.priority), 0);

  // The session default: a starred draft (must be top tier) wins, else the
  // item's persisted default.
  const starredDraft = drafts.find((d) => draftConfig[d.id]?.isDefault);
  const defaultMemberId = starredDraft ? DRAFT_PREFIX + starredDraft.id : existingDefaultVendorId;

  // Build members with raw ranks. Auto drafts each take their own lowest tier.
  const existingMembers: LaneMember[] = existing.map((x) => ({
    id: x.vendorId,
    isDraft: false,
    rawRank: x.priority,
    name: x.vendorName,
    subtitle: x.vendorCode,
    priceLabel: `$${x.price.toFixed(2)}`,
    priceFilled: true,
    uomLabel: x.uom,
    leadLabel: fmtLead(x.leadTimeDays),
    leadFilled: x.leadTimeDays > 0,
    isFocusedDraft: false,
    isDefault: x.vendorId === defaultMemberId,
  }));

  const draftMembers: LaneMember[] = drafts.map((d, i) => {
    const cfg = draftConfig[d.id];
    const parsed = cfg && cfg.priority !== "auto" ? parseInt(cfg.priority, 10) : NaN;
    const rawRank = Number.isFinite(parsed) ? parsed : maxExistingRank + 1 + i;
    const lead = cfg?.leadTimeDays ? Number(cfg.leadTimeDays) : 0;
    const id = DRAFT_PREFIX + d.id;
    return {
      id,
      draftVendorId: d.id,
      isDraft: true,
      rawRank,
      name: d.name,
      priceLabel: cfg?.pricePerUnit.trim() ? `$${cfg.pricePerUnit}` : "—",
      priceFilled: !!cfg?.pricePerUnit.trim(),
      uomLabel: cfg?.uom || "Each",
      leadLabel: fmtLead(lead),
      leadFilled: lead > 0,
      isFocusedDraft: d.id === focusedDraftId.replace(DRAFT_PREFIX, ""),
      isDefault: id === defaultMemberId,
    };
  });

  const members = [...existingMembers, ...draftMembers];

  // Densify raw ranks (ties preserved) -> contiguous tiers 1..MAX_PRIORITY.
  // Anything beyond the cap ties into the lowest tier.
  const distinctRanks = Array.from(new Set(members.map((m) => m.rawRank))).sort((a, b) => a - b);
  const rankToTier = new Map<number, number>();
  distinctRanks.forEach((r, i) => rankToTier.set(r, Math.min(i + 1, MAX_PRIORITY)));
  const tierCount = Math.min(distinctRanks.length, MAX_PRIORITY);
  const lanes: LaneMember[][] = Array.from({ length: tierCount }, () => []);
  members.forEach((m) => lanes[rankToTier.get(m.rawRank)! - 1].push(m));

  const dropOnTier = (tier: number) => {
    const id = dragId;
    setDragId(null);
    setDragOverTier(null);
    if (!id) return;
    const member = draftMembers.find((m) => m.id === id);
    if (!member?.draftVendorId) return; // only drafts move
    if (tier <= tierCount) {
      // Join an existing tier (tie) — reuse that tier's raw rank.
      onSetDraftPriority(member.draftVendorId, String(distinctRanks[tier - 1]));
    } else {
      // Fresh lowest tier.
      const maxRaw = members.reduce((m, x) => Math.max(m, x.rawRank), 0);
      onSetDraftPriority(member.draftVendorId, String(maxRaw + 1));
    }
  };

  return (
    <div className="rounded-xl border border-violet-200 bg-white overflow-hidden flex flex-col h-full max-h-[620px]">
      <div className="px-3.5 py-3 border-b border-violet-200 bg-[#FAF5FF] flex items-start gap-3 shrink-0">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#EDE9FE] border border-violet-200 shrink-0">
          <ListOrdered className="w-3.5 h-3.5 text-violet-600" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13px] text-violet-800" style={{ fontWeight: 600 }}>Vendor priority</p>
            <span className="text-[11px] text-slate-400">·</span>
            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
              {tierCount} {tierCount === 1 ? "tier" : "tiers"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-px truncate" style={{ fontWeight: 400 }}>
            Drag a card onto a tier to rank it. Several vendors can share a tier.
          </p>
        </div>
        {hasArrangement && (
          <button
            type="button"
            onClick={onResetAuto}
            className="text-[11px] text-primary hover:underline cursor-pointer shrink-0 whitespace-nowrap"
            style={{ fontWeight: 600 }}
          >
            Reset to auto
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-white p-2.5 space-y-2">
        {lanes.map((laneMembers, li) => {
          const tier = li + 1;
          const isTop = tier === 1;
          const isOver = dragOverTier === tier;
          return (
            <div
              key={tier}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                if (dragOverTier !== tier) setDragOverTier(tier);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOnTier(tier);
              }}
              className={cn(
                "rounded-lg border transition-colors",
                isOver ? "border-primary bg-[#F2F8FF]" : "border-[#EEE7F7] bg-[#FCFBFE]",
              )}
            >
              <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md text-[10.5px] tabular-nums",
                    isTop ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700",
                  )}
                  style={{ fontWeight: 700 }}
                >
                  {tier}
                </span>
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                  Priority {tier}
                </span>
                {isTop && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-600" style={{ fontWeight: 600 }}>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                    Default tier
                  </span>
                )}
                {laneMembers.length > 1 && (
                  <span className="ml-auto text-[10px] text-violet-500" style={{ fontWeight: 600 }}>
                    Tie · {laneMembers.length}
                  </span>
                )}
              </div>
              <ul className="px-1.5 pb-1.5 space-y-1">
                {laneMembers.map((m) => {
                  const canStar = isTop && m.isDraft;
                  return (
                    <li
                      key={m.id}
                      draggable={m.isDraft}
                      onDragStart={() => m.isDraft && setDragId(m.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOverTier(null);
                      }}
                      onClick={m.isDraft && !m.isFocusedDraft ? () => onFocusDraft(m.draftVendorId!) : undefined}
                      className={cn(
                        "group relative rounded-md border px-2.5 py-2 bg-white transition-colors",
                        m.isDraft ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                        m.isFocusedDraft
                          ? "border-primary/40 bg-[#EFF6FF]"
                          : m.isDraft
                            ? "border-[#E6E9F0] hover:border-primary/30 hover:bg-[#F7FAFF]"
                            : "border-[#EEF1F5]",
                        dragId === m.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {m.isDraft ? (
                          <GripVertical className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/50" />
                        ) : (
                          <span className="w-3.5 shrink-0" aria-hidden />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={cn("text-[12.5px] truncate", m.isDraft ? "text-primary/90" : "text-slate-700")}
                              style={{ fontWeight: 600 }}
                            >
                              {m.name}
                            </p>
                            {m.isFocusedDraft && (
                              <span
                                className="inline-flex items-center px-1.5 py-px rounded-full border text-[10px]"
                                style={{ fontWeight: 600, backgroundColor: "rgba(11,113,232,0.08)", color: "hsl(var(--primary))", borderColor: "rgba(11,113,232,0.18)" }}
                              >
                                Configuring
                              </span>
                            )}
                            {!m.isDraft && m.subtitle && (
                              <span className="text-[10px] text-slate-400 tabular-nums font-mono">{m.subtitle}</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-x-4 gap-y-1 flex-wrap">
                            <span className="inline-flex items-baseline gap-1.5 min-w-0">
                              <span className="text-[10.5px] text-slate-400" style={{ fontWeight: 500 }}>Price</span>
                              <span className={cn("text-[12px] tabular-nums", m.priceFilled ? "text-emerald-700" : "text-slate-400")} style={{ fontWeight: 600 }}>
                                {m.priceLabel}
                              </span>
                              {m.priceFilled && <span className="text-[10.5px] text-slate-400" style={{ fontWeight: 500 }}>/ {m.uomLabel}</span>}
                            </span>
                            <span className="inline-flex items-baseline gap-1.5">
                              <span className="text-[10.5px] text-slate-400" style={{ fontWeight: 500 }}>Lead time</span>
                              <span className={cn("text-[12px] tabular-nums", m.leadFilled ? "text-slate-700" : "text-slate-400")} style={{ fontWeight: 600 }}>
                                {m.leadLabel}
                              </span>
                            </span>
                          </div>
                        </div>
                        {/* Default star — only on the top tier. */}
                        {isTop ? (
                          canStar ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetDefaultDraft(m.draftVendorId!);
                              }}
                              title={m.isDefault ? "Default vendor" : "Set as default vendor"}
                              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-amber-50 transition-colors cursor-pointer"
                            >
                              <Star className={cn("w-4 h-4", m.isDefault ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-400")} />
                            </button>
                          ) : m.isDefault ? (
                            <span className="shrink-0 inline-flex items-center justify-center w-7 h-7" title="Current default vendor">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                            </span>
                          ) : (
                            <span className="w-7 shrink-0" aria-hidden />
                          )
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* New lowest tier drop zone — only while under the 5-tier cap. */}
        {tierCount < MAX_PRIORITY && (
        <div
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            if (dragOverTier !== tierCount + 1) setDragOverTier(tierCount + 1);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropOnTier(tierCount + 1);
          }}
          className={cn(
            "rounded-lg border border-dashed px-3 py-2.5 flex items-center justify-center gap-1.5 text-[11px] transition-colors",
            dragOverTier === tierCount + 1
              ? "border-primary bg-[#F2F8FF] text-primary"
              : "border-slate-200 text-slate-400",
          )}
          style={{ fontWeight: 600 }}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Drop here for a new lowest tier
        </div>
        )}
      </div>
    </div>
  );
}
