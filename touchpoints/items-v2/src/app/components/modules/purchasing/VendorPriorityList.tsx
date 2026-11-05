/**
 * VendorPriorityList — the Configure-step LEFT rail, now the primary surface for
 * managing the item's qualified-vendor roster.
 *
 * It shows EVERY qualified vendor for the item — those already saved plus the
 * ones being added this session — grouped into priority tiers (Priority 1, 2,
 * 3…). Priority is a free, tie-allowing rank: drag a card by its handle onto any
 * tier to place it there (several vendors can share a tier, a tie). Reordering is
 * drag-and-drop only. Tiers stay contiguous (no gaps) and cap at MAX_PRIORITY.
 * Exactly one vendor is the default (the auto-PO anchor); its star sits on a
 * Priority 1 card only.
 *
 * Clicking a card focuses that vendor so the right panel shows its details.
 * The avatar and the per-vendor location chip are injected by the parent (the
 * modal owns those components) via render props, so this stays decoupled.
 */
import React, { useEffect, useRef, useState } from "react";
import { GripVertical, Star, Trash2, Plus, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_PRIORITY } from "../../../context/PurchasingContext";

export interface RosterCard {
  /** Stable key — an existing QV row id, or a newly-picked vendor id. */
  key: string;
  name: string;
  /** Location line under the name. */
  location: string;
  /** Saved (already qualified) vs New (being added this session). */
  isNew: boolean;
  /** Resolved, densified tier (1..MAX_PRIORITY). */
  priority: number;
  isDefault: boolean;
  priceLabel: string;
  uomLabel: string;
  leadLabel: string;
  priced: boolean;
}

/** Pre-formatted input for one vendor (existing or new) before tier resolution. */
export interface RosterInputVendor {
  id: string;
  name: string;
  location: string;
  isNew: boolean;
  /** Raw rank as set by the user (may have gaps / ties — resolved below). */
  priority: number;
  isDefault: boolean;
  priceLabel: string;
  uomLabel: string;
  leadLabel: string;
  priced: boolean;
}

/** Resolve raw ranks into dense, tie-preserving tiers (1..MAX_PRIORITY, no gaps)
 *  and guarantee exactly one default (kept where flagged, else the top tier).
 *  Shared by the list render and the modal's commit so both agree. */
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
  // The default (auto-PO anchor) is INTENTIONAL and Priority 1 only: keep a
  // vendor flagged in the top tier, otherwise there is NO default. We never
  // auto-anchor one — the star is set by the user clicking it.
  const flaggedTop = input.find((v) => v.isDefault && tierByKey[v.id] === topTier);
  const defaultKey = flaggedTop ? flaggedTop.id : null;
  const cards: RosterCard[] = input.map((v) => ({
    key: v.id,
    name: v.name,
    location: v.location,
    isNew: v.isNew,
    priority: tierByKey[v.id],
    isDefault: v.id === defaultKey,
    priceLabel: v.priceLabel,
    uomLabel: v.uomLabel,
    leadLabel: v.leadLabel,
    priced: v.priced,
  }));
  return { cards, defaultKey, tierByKey };
}

interface VendorPriorityListProps {
  cards: RosterCard[];
  focusedKey: string | null;
  onFocus: (key: string) => void;
  /** Place a card at an explicit tier — a LANE drop, which joins/shares that
   *  priority level (a tie). Shown with the whole-lane highlight. */
  onSetPriority: (key: string, priority: number) => void;
  /** Reposition a card in the ranked order via the INSERTION LINE (drop between
   *  two cards). `beforeKey` is the card it lands before, or null for the end.
   *  Distinct from onSetPriority: ranks recompute from the new position. */
  onReposition?: (key: string, beforeKey: string | null) => void;
  /** Make this card the single default (auto-PO anchor). Priority 1 only. */
  onToggleDefault: (key: string) => void;
  /** Remove a priority lane (tier >= 2): its vendors merge up into the lane
   *  above, and any lower lanes shift up one rank. */
  onDeleteLane: (tier: number) => void;
  /** Drop a New card from the roster (an unsaved pick; removed instantly). */
  onRemove?: (key: string) => void;
  /** Remove a Saved (already-qualified) vendor. Parent gates this behind a
   *  warning that spells out the implications before it actually removes. */
  onRemoveSaved?: (key: string) => void;
  onAddMore?: () => void;
  /** Parent-supplied renderers (avatar + wired location chip). */
  avatar: (name: string) => React.ReactNode;
  locationChip?: (card: RosterCard) => React.ReactNode;
  /** Keys of saved vendors with unsaved edits — renders a "Modified" pill. */
  modifiedKeys?: Set<string>;
}

export function VendorPriorityList({
  cards,
  focusedKey,
  onFocus,
  onSetPriority,
  onReposition,
  onToggleDefault,
  onDeleteLane,
  onRemove,
  onRemoveSaved,
  onAddMore,
  avatar,
  locationChip,
  modifiedKeys,
}: VendorPriorityListProps) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<number | null>(null);
  // Insertion-line target when REORDERING within the ranked list (distinct from
  // a lane drop, which joins a tier). undefined = no line, null = end of list,
  // else the key the dragged card will land before. Only active when
  // onReposition is wired; otherwise drags fall back to lane-only behaviour.
  const [insertBefore, setInsertBefore] = useState<string | null | undefined>(undefined);
  // Synchronous mirror of the dragged key. dragstart/dragover are CONTINUOUS
  // React events, so a setState in onDragStart isn't flushed before the first
  // onDragOver fires — reading state there would still see null and skip
  // preventDefault, which silently rejects the drop. The ref is set the instant
  // the drag starts, so the lane registers as a valid drop target immediately.
  const dragKeyRef = useRef<string | null>(null);
  // One empty trailing lane revealed by "Add priority level". It is a transient
  // drop target; once a vendor lands in it, it becomes a real (counted) tier.
  const [extraLane, setExtraLane] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bring the focused vendor's card into view when focus changes. A newly added
  // vendor is auto-focused on returning from Browse and lands in the lowest
  // tier, which is usually below the fold — without this, the user can't tell
  // the vendor was added. Only scrolls when the card is actually out of view.
  useEffect(() => {
    if (!focusedKey) return;
    const container = scrollRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-card-key="${CSS.escape(focusedKey)}"]`);
    if (!container || !el) return;
    const c = container.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    if (e.top < c.top || e.bottom > c.bottom) {
      container.scrollBy({ top: e.top - c.top - 12, behavior: "smooth" });
    }
  }, [focusedKey]);

  // Populated tiers, contiguous from 1 (cards arrive densified; guard anyway).
  const distinctTiers = Array.from(new Set(cards.map((c) => c.priority))).sort((a, b) => a - b);
  const tierCount = Math.min(distinctTiers.length, MAX_PRIORITY);
  // Lanes rendered = populated tiers plus, optionally, one empty trailing lane.
  const lanesToShow = Math.min(MAX_PRIORITY, tierCount + (extraLane ? 1 : 0));
  const tiers = Array.from({ length: lanesToShow }, (_, i) => i + 1);
  const cardsInTier = (tier: number) => cards.filter((c) => c.priority === tier);
  // Flat ranked order across all lanes — used to translate an insertion point
  // ("before this card" / "after this card") into the neighbour the parent needs.
  const flatKeys = cards.map((c) => c.key);
  const canAddLane = cards.length > 0 && !extraLane && tierCount < MAX_PRIORITY;

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
  // Drop on the insertion line: reposition `key` before `beforeKey` (null = end).
  const dropReorder = (key: string | null, beforeKey: string | null) => {
    dragKeyRef.current = null;
    setDragKey(null);
    setDragOverTier(null);
    setInsertBefore(undefined);
    if (key && onReposition) onReposition(key, beforeKey);
  };
  // Delete a lane header. A populated lane merges its vendors up one rank (via
  // the parent); the empty trailing lane just collapses.
  const deleteLane = (tier: number) => {
    setExtraLane(false);
    if (tier <= tierCount) onDeleteLane(tier);
  };

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-white p-2.5 space-y-2">
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
                  "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md text-[10.5px] tabular-nums",
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
                  <span className="text-[10px] text-slate-400" style={{ fontWeight: 600 }}>
                    {members.length} {members.length === 1 ? "vendor" : "vendors"}
                  </span>
                )}
                {tier > 1 && (
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
              {members.map((c) => {
                const isFocused = c.key === focusedKey;
                return (
                  <li
                    key={c.key}
                    data-card-key={c.key}
                    draggable
                    onDragStart={(e) => {
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
                      // Hovering a CARD = reorder via the insertion line. Stop the
                      // event so the lane's drop-highlight doesn't also fire — the
                      // two interactions stay visually distinct.
                      if (!dragKeyRef.current || !onReposition) return;
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      const isBottom = e.clientY > rect.top + rect.height / 2;
                      const idx = flatKeys.indexOf(c.key);
                      const target = isBottom ? flatKeys[idx + 1] ?? null : c.key;
                      if (dragOverTier !== null) setDragOverTier(null);
                      setInsertBefore((prev) => (prev === target ? prev : target));
                    }}
                    onDrop={(e) => {
                      if (!onReposition || !dragKeyRef.current) return;
                      e.preventDefault();
                      e.stopPropagation();
                      // Compute the landing slot from the drop point itself (not
                      // from insertBefore state, which may not have flushed) so
                      // the drop is self-contained.
                      const rect = e.currentTarget.getBoundingClientRect();
                      const isBottom = e.clientY > rect.top + rect.height / 2;
                      const idx = flatKeys.indexOf(c.key);
                      const before = isBottom ? flatKeys[idx + 1] ?? null : c.key;
                      dropReorder(dragKeyRef.current, before);
                    }}
                    onClick={() => onFocus(c.key)}
                    className={cn(
                      "group relative rounded-lg border bg-white px-2 py-2 cursor-pointer transition-colors",
                      isFocused
                        ? "border-primary/40 bg-[#EFF6FF] ring-1 ring-[#BFDBFE]"
                        : "border-[#E6E9F0] hover:border-primary/30 hover:bg-[#F7FAFF]",
                      dragKey === c.key && "opacity-50",
                    )}
                  >
                    {/* Insertion line — reorder target (distinct from the lane
                        highlight used to join a tier). */}
                    {onReposition && insertBefore === c.key && (
                      <span className="absolute -top-[5px] left-1 right-1 h-[2px] rounded-full bg-primary z-10" />
                    )}
                    {onReposition && insertBefore === null && c.key === flatKeys[flatKeys.length - 1] && (
                      <span className="absolute -bottom-[5px] left-1 right-1 h-[2px] rounded-full bg-primary z-10" />
                    )}
                    <span
                      className={cn(
                        "absolute left-0 top-2 bottom-2 w-[3px] rounded-r transition-opacity",
                        isFocused ? "bg-primary opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex items-start gap-2">
                      <span
                        className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-primary/60"
                        title="Drag to change priority"
                        aria-hidden
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                      <span className="shrink-0">{avatar(c.name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p
                            className={cn("text-[12px] truncate", isFocused ? "text-primary" : "text-foreground")}
                            style={{ fontWeight: 600 }}
                          >
                            {c.name}
                          </p>
                          {c.isNew ? (
                            <span
                              className="inline-flex items-center px-1.5 py-px rounded-full text-[9.5px] border bg-emerald-50 text-emerald-700 border-emerald-200"
                              style={{ fontWeight: 600 }}
                            >
                              New
                            </span>
                          ) : modifiedKeys?.has(c.key) ? (
                            <span
                              className="inline-flex items-center px-1.5 py-px rounded-full text-[9.5px] border"
                              style={{ fontWeight: 600, color: "#92400E", backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }}
                            >
                              Modified
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10.5px] text-slate-500 truncate mt-px">{c.location}</p>
                        {locationChip && <div className="mt-1">{locationChip(c)}</div>}
                      </div>
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        {/* The default (auto-PO anchor) can only be a Priority 1
                            vendor, so the star renders on the top lane only. */}
                        {tier === 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleDefault(c.key);
                            }}
                            title={c.isDefault ? "Default vendor (auto-PO anchor)" : "Set as default vendor"}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-amber-50 transition-colors cursor-pointer"
                          >
                            <Star className={cn("w-4 h-4", c.isDefault ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-400")} />
                          </button>
                        )}
                        {c.isNew && onRemove && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove(c.key);
                            }}
                            title="Remove from selection"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-300 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                        {!c.isNew && onRemoveSaved && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSaved(c.key);
                            }}
                            title="Remove vendor"
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-300 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {/* Master-detail cue: the focused card's details open in the
                          right panel, so point a small arrow toward it. */}
                      {isFocused && (
                        <span
                          aria-hidden
                          className="shrink-0 self-center inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white shadow-sm animate-in fade-in zoom-in-75 duration-150"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {/* Add a fresh lowest priority lane: click to reveal it, then drag a card
          in. One at a time, capped at MAX_PRIORITY. */}
      {canAddLane && (
        <button
          type="button"
          onClick={() => setExtraLane(true)}
          className="w-full rounded-lg border border-dashed border-slate-200 px-3 py-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:border-primary/40 hover:text-primary hover:bg-[#F7FAFF] transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add priority level
        </button>
      )}

      {cards.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>No vendors selected yet.</p>
          {onAddMore && (
            <button
              type="button"
              onClick={onAddMore}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-white text-[12px] hover:bg-[#0862D0] transition-colors cursor-pointer"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add vendors
            </button>
          )}
        </div>
      )}
    </div>
  );
}
