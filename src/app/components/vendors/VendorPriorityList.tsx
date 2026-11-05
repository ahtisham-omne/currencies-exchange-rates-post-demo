/**
 * VendorPriorityList — the tier-grouped vendor priority panel inside the
 * Manage Qualified-Vendor Items modal, ported from the Items module's
 * Add Qualified Vendors flow so both surfaces share one priority model.
 *
 * It shows EVERY qualified vendor for the focused item — the existing roster
 * plus the partner being configured now — grouped into priority tiers
 * (Priority 1, 2, 3…). Priority is a free, tie-allowing rank: drag a card by
 * its handle onto any tier lane to place it there (several vendors can share
 * a tier), or drop it between two cards to reposition via the insertion line.
 * Tiers stay contiguous (no gaps) and cap at MAX_PRIORITY. At most one vendor
 * is the primary (auto-PO anchor); its star sits on a Priority 1 card only.
 */
import React, { useRef, useState } from "react";
import { GripVertical, Star, Plus, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { PrimaryPill } from "./PrimaryPill";

export const MAX_PRIORITY = 5;

export interface RosterCard {
  /** Stable key — an existing QV's vendorId, or "__draft__" for the row being configured. */
  key: string;
  name: string;
  profileImage?: string | null;
  /** The partner being configured in this modal session. */
  isDraft: boolean;
  /** Resolved, densified tier (1..MAX_PRIORITY). */
  priority: number;
  isDefault: boolean;
  priceLabel: string;
  uomLabel: string;
  leadLabel: string;
  priced: boolean;
}

/** Pre-formatted input for one vendor before tier resolution. */
export interface RosterInputVendor {
  id: string;
  name: string;
  profileImage?: string | null;
  isDraft: boolean;
  /** Raw rank as set by the user (may have gaps / ties — resolved below). */
  priority: number;
  isDefault: boolean;
  priceLabel: string;
  uomLabel: string;
  leadLabel: string;
  priced: boolean;
}

/** Resolve raw ranks into dense, tie-preserving tiers (1..MAX_PRIORITY, no
 *  gaps) and guarantee at most one primary (kept only when flagged in the top
 *  tier). Shared by the list render and the modal's save so both agree. */
export function computeRoster(input: RosterInputVendor[]): {
  cards: RosterCard[];
  defaultKey: string | null;
  tierByKey: Record<string, number>;
} {
  if (input.length === 0) return { cards: [], defaultKey: null, tierByKey: {} };
  const distinct = Array.from(new Set(input.map((v) => v.priority))).sort((a, b) => a - b);
  const rawToTier = new Map<number, number>();
  distinct.forEach((r, i) => rawToTier.set(r, Math.min(i + 1, MAX_PRIORITY)));
  const tierByKey: Record<string, number> = {};
  input.forEach((v) => {
    tierByKey[v.id] = rawToTier.get(v.priority) ?? 1;
  });
  const topTier = Math.min(...input.map((v) => tierByKey[v.id]));
  // The primary (auto-PO anchor) is INTENTIONAL and Priority 1 only: keep a
  // vendor flagged in the top tier, otherwise there is NO primary. We never
  // auto-anchor one — the star is set by the user clicking it.
  const flaggedTop = input.find((v) => v.isDefault && tierByKey[v.id] === topTier);
  const defaultKey = flaggedTop ? flaggedTop.id : null;
  const cards: RosterCard[] = input.map((v) => ({
    key: v.id,
    name: v.name,
    profileImage: v.profileImage,
    isDraft: v.isDraft,
    priority: tierByKey[v.id],
    isDefault: v.id === defaultKey,
    priceLabel: v.priceLabel,
    uomLabel: v.uomLabel,
    leadLabel: v.leadLabel,
    priced: v.priced,
  }));
  return { cards, defaultKey, tierByKey };
}

/* Name-based initials avatar for roster cards — deterministic pastel bg so
   the same vendor always renders the same color, photo when available. */
const AVATAR_BGS = ["#6366F1", "#0EA5E9", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6", "#EF4444"];
function RosterAvatar({ name, photo }: { name: string; photo?: string | null }) {
  if (photo) {
    return <img src={photo} alt={name} className="w-8 h-8 rounded-lg object-cover border border-[#E8ECF1]" />;
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-white text-[11px] shrink-0"
      style={{ fontWeight: 600, backgroundColor: AVATAR_BGS[h % AVATAR_BGS.length] }}
    >
      {initials}
    </span>
  );
}

interface VendorPriorityListProps {
  cards: RosterCard[];
  /** Place a card at an explicit tier — a LANE drop, which joins/shares that
   *  priority level (a tie). Shown with the whole-lane highlight. */
  onSetPriority: (key: string, priority: number) => void;
  /** Reposition a card in the ranked order via the INSERTION LINE (drop
   *  between two cards). `beforeKey` is the card it lands before, or null for
   *  the end. Distinct from onSetPriority: ranks recompute from the position. */
  onReposition: (key: string, beforeKey: string | null) => void;
  /** Make this card the single primary (auto-PO anchor). Priority 1 only. */
  onToggleDefault: (key: string) => void;
  /** Remove a priority lane (tier >= 2): its vendors merge up into the lane
   *  above, and any lower lanes shift up one rank. */
  onDeleteLane: (tier: number) => void;
  /** Render the roster as a non-editable snapshot — no drag, no star
   *  toggle, no lane add/delete. Used in location scope when the item is
   *  already qualified with the partner: priority is a partner-level
   *  value a location can never diverge from. */
  readOnly?: boolean;
  /** Label on the draft card's pill. Defaults to "You're configuring
   *  this"; locked partner-sourced rosters swap in their own copy. */
  draftBadge?: string;
}

export function VendorPriorityList({
  cards,
  onSetPriority,
  onReposition,
  onToggleDefault,
  onDeleteLane,
  readOnly,
  draftBadge,
}: VendorPriorityListProps) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<number | null>(null);
  // Insertion-line target when REORDERING within the ranked list (distinct
  // from a lane drop, which joins a tier). undefined = no line, null = end of
  // list, else the key the dragged card will land before.
  const [insertBefore, setInsertBefore] = useState<string | null | undefined>(undefined);
  // Synchronous mirror of the dragged key. dragstart/dragover are CONTINUOUS
  // React events, so a setState in onDragStart isn't flushed before the first
  // onDragOver fires — reading state there would still see null and skip
  // preventDefault, which silently rejects the drop. The ref is set the
  // instant the drag starts, so lanes register as valid targets immediately.
  const dragKeyRef = useRef<string | null>(null);
  // One empty trailing lane revealed by "Add priority level". It is a
  // transient drop target; once a vendor lands in it, it becomes a real tier.
  const [extraLane, setExtraLane] = useState(false);

  // Populated tiers, contiguous from 1 (cards arrive densified; guard anyway).
  const distinctTiers = Array.from(new Set(cards.map((c) => c.priority))).sort((a, b) => a - b);
  const tierCount = Math.min(distinctTiers.length, MAX_PRIORITY);
  const lanesToShow = Math.min(MAX_PRIORITY, tierCount + (extraLane ? 1 : 0));
  const tiers = Array.from({ length: lanesToShow }, (_, i) => i + 1);
  const cardsInTier = (tier: number) => cards.filter((c) => c.priority === tier);
  // Flat ranked order across all lanes IN VISUAL ORDER (tier-grouped, stable
  // within a tier) — used to translate an insertion point ("before this
  // card") into the neighbour the parent needs.
  const flatKeys = [...cards].sort((a, b) => a.priority - b.priority).map((c) => c.key);
  const canAddLane = !readOnly && cards.length > 0 && !extraLane && tierCount < MAX_PRIORITY;

  const placeAt = (key: string, tier: number) => {
    onSetPriority(key, Math.min(tier, MAX_PRIORITY));
    if (tier > tierCount) setExtraLane(false); // the empty lane just became real
  };
  const drop = (key: string | null, tier: number) => {
    dragKeyRef.current = null;
    setDragKey(null);
    setDragOverTier(null);
    setInsertBefore(undefined);
    if (key) placeAt(key, tier);
  };
  const dropReorder = (key: string | null, beforeKey: string | null) => {
    dragKeyRef.current = null;
    setDragKey(null);
    setDragOverTier(null);
    setInsertBefore(undefined);
    if (key) onReposition(key, beforeKey);
  };
  const deleteLane = (tier: number) => {
    setExtraLane(false);
    if (tier <= tierCount) onDeleteLane(tier);
  };

  return (
    <div className={cn("flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2", readOnly ? "bg-[#FAFBFC] opacity-60 select-none" : "bg-white")}>
      {tiers.map((tier) => {
        const members = cardsInTier(tier);
        const isOver = dragOverTier === tier;
        return (
          <div
            key={tier}
            onDragOver={(e) => {
              if (!dragKeyRef.current) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverTier !== tier) setDragOverTier(tier);
              if (insertBefore !== undefined) setInsertBefore(undefined);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const key = dragKeyRef.current ?? (e.dataTransfer.getData("text/plain") || null);
              drop(key, tier);
            }}
            className={cn(
              "rounded-lg border transition-colors",
              isOver ? "border-primary bg-[#F2F8FF]" : "border-[#EEF2F6] bg-[#FBFCFE]",
            )}
          >
            <div className="flex items-center gap-2 px-2.5 pt-2 pb-1">
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md text-[10.5px]",
                  tier === 1 ? "bg-primary text-white" : "bg-[#E8EEFB] text-[#1E40AF]",
                )}
                style={{ fontWeight: 700 }}
              >
                {tier}
              </span>
              <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                Priority {tier}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                {members.length > 0 && (
                  <span
                    className="inline-flex items-center px-1.5 h-[18px] rounded-md bg-white border border-[#E2E8F0] text-[9.5px] text-slate-500"
                    style={{ fontWeight: 600 }}
                  >
                    {members.length} {members.length === 1 ? "vendor" : "vendors"}
                  </span>
                )}
                {!readOnly && tier > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteLane(tier)}
                    title={members.length ? "Remove this priority — its vendors move up one level" : "Remove this empty priority"}
                    className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-300 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <ul className="px-1.5 pb-1.5 space-y-1">
              {members.length === 0 && (
                <li className="rounded-lg border border-dashed border-slate-200 px-2 py-3 text-center text-[11px] text-slate-400" style={{ fontWeight: 500 }}>
                  Drag a vendor here to set this priority.
                </li>
              )}
              {members.map((c) => (
                <li
                  key={c.key}
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    if (readOnly) return;
                    dragKeyRef.current = c.key;
                    setDragKey(c.key);
                    e.dataTransfer.effectAllowed = "move";
                    // Firefox refuses to start a drag unless data is set.
                    try {
                      e.dataTransfer.setData("text/plain", c.key);
                    } catch {
                      /* some browsers lock dataTransfer; the ref still carries the key */
                    }
                  }}
                  onDragEnd={() => {
                    dragKeyRef.current = null;
                    setDragKey(null);
                    setDragOverTier(null);
                    setInsertBefore(undefined);
                  }}
                  onDragOver={(e) => {
                    // Hovering a CARD has three zones: the top/bottom edges
                    // reorder via the insertion line; the MIDDLE joins this
                    // card's priority level (a tie) — shown with the whole-
                    // lane highlight so "drop here to share the level" is an
                    // easy, generous target. Stop the event so the lane's own
                    // handler doesn't double-fire.
                    if (!dragKeyRef.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = "move";
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const dragged = cards.find((x) => x.key === dragKeyRef.current);
                    // Within the card's own lane a "join" is meaningless, so
                    // the whole card splits into reorder halves instead.
                    const joinable = dragged ? dragged.priority !== tier : false;
                    const zone = !joinable
                      ? (y > rect.height / 2 ? "after" : "before")
                      : y < rect.height * 0.3 ? "before" : y > rect.height * 0.7 ? "after" : "join";
                    if (zone === "join") {
                      if (insertBefore !== undefined) setInsertBefore(undefined);
                      if (dragOverTier !== tier) setDragOverTier(tier);
                    } else {
                      const idx = flatKeys.indexOf(c.key);
                      const target = zone === "after" ? flatKeys[idx + 1] ?? null : c.key;
                      if (dragOverTier !== null) setDragOverTier(null);
                      setInsertBefore((prev) => (prev === target ? prev : target));
                    }
                  }}
                  onDrop={(e) => {
                    if (!dragKeyRef.current) return;
                    e.preventDefault();
                    e.stopPropagation();
                    // Compute the landing zone from the drop point itself (not
                    // from hover state, which may not have flushed).
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const dragged = cards.find((x) => x.key === dragKeyRef.current);
                    const joinable = dragged ? dragged.priority !== tier : false;
                    const zone = !joinable
                      ? (y > rect.height / 2 ? "after" : "before")
                      : y < rect.height * 0.3 ? "before" : y > rect.height * 0.7 ? "after" : "join";
                    if (zone === "join") {
                      drop(dragKeyRef.current, tier);
                    } else {
                      const idx = flatKeys.indexOf(c.key);
                      const before = zone === "after" ? flatKeys[idx + 1] ?? null : c.key;
                      dropReorder(dragKeyRef.current, before);
                    }
                  }}
                  className={cn(
                    "group relative rounded-lg border bg-white px-2 py-2 transition-colors",
                    readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                    c.isDraft
                      ? "border-primary/40 bg-[#FCFDFF]"
                      : "border-[#E6E9F0]",
                    !readOnly && (c.isDraft ? "hover:bg-[#F7FAFF]" : "hover:border-primary/30 hover:bg-[#F7FAFF]"),
                    dragKey === c.key && "opacity-50",
                  )}
                >
                  {/* Insertion line — reorder target (distinct from the lane
                      highlight used to join a tier). */}
                  {insertBefore === c.key && (
                    <span className="absolute -top-[5px] left-1 right-1 h-[2px] rounded-full bg-primary z-10" />
                  )}
                  {insertBefore === null && c.key === flatKeys[flatKeys.length - 1] && (
                    <span className="absolute -bottom-[5px] left-1 right-1 h-[2px] rounded-full bg-primary z-10" />
                  )}
                  <span
                    className={cn(
                      "absolute left-0 top-2 bottom-2 w-[3px] rounded-r transition-opacity",
                      c.isDraft ? "bg-primary opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex items-start gap-2">
                    {!readOnly && (
                      <span
                        className="mt-1 shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-primary/60"
                        title="Drag to change priority"
                        aria-hidden
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span className="shrink-0">
                      <RosterAvatar name={c.name} photo={c.profileImage} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p
                          className={cn("text-[12px] truncate", c.isDraft ? "text-primary/90" : "text-foreground")}
                          style={{ fontWeight: 600 }}
                        >
                          {c.name}
                        </p>
                        {c.isDraft && (
                          <span
                            className="inline-flex items-center px-1.5 py-px rounded-full border text-[9.5px]"
                            style={{ fontWeight: 600, backgroundColor: "rgba(11,113,232,0.08)", color: "rgb(var(--primary))", borderColor: "rgba(11,113,232,0.18)" }}
                          >
                            {draftBadge || "You're configuring this"}
                          </span>
                        )}
                        {c.isDefault && <PrimaryPill size="xs" />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[11px]" style={{ fontWeight: 500 }}>
                        <span className={cn(c.priced ? "text-emerald-700" : "text-slate-400")} style={{ fontWeight: 600 }}>
                          {c.priceLabel}
                        </span>
                        {c.priced && <span className="text-[10px] text-slate-400">/ {c.uomLabel}</span>}
                        <span className="text-slate-300">·</span>
                        <span className={cn(c.leadLabel === "—" ? "text-slate-400" : "text-slate-500")}>
                          {c.leadLabel === "—" ? "No lead time" : `${c.leadLabel} lead`}
                        </span>
                      </div>
                    </div>
                    {/* The primary (auto-PO anchor) can only be a Priority 1
                        vendor, so the star renders on the top lane only.
                        Read-only rosters drop the toggle — the PrimaryPill
                        by the name already carries the state. */}
                    {!readOnly && tier === 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleDefault(c.key);
                        }}
                        title={c.isDefault ? "Primary vendor (auto-PO anchor)" : "Set as primary vendor"}
                        className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-amber-50 transition-colors cursor-pointer"
                      >
                        <Star className={cn("w-4 h-4", c.isDefault ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-400")} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {/* Add a fresh lowest priority lane: click to reveal it, then drag a
          card in. One at a time, capped at MAX_PRIORITY. */}
      {canAddLane && (
        <button
          type="button"
          onClick={() => setExtraLane(true)}
          className="w-full rounded-lg border border-dashed border-slate-200 px-3 py-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:border-primary/40 hover:text-primary hover:bg-[#F7FAFF] transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Priority Level
        </button>
      )}
    </div>
  );
}
