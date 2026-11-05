import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, Minus, LayoutList, Grid2x2, Package, Check, ChevronDown, ChevronsDown, ChevronsUp, Trash2, Copy, Pencil, Layers } from "lucide-react";

/* Inline QtyStepper — mirrors the one in Quote's Step3LineItems and
   ProductPickerModal so SO's selected-items card reads identically
   (−, value, +). Local string draft lets users clear and retype
   freely; commit on blur clamps to min. */
function QtyStepper({ value, onChange, min = 1, max, ariaLabel = "Quantity" }: {
  value: number; onChange: (next: number) => void; min?: number; max?: number; ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) { setDraft(String(value)); return; }
    let next = parsed;
    if (typeof max === "number" && next > max) next = max;
    if (next < min) next = min;
    if (next !== value) onChange(next);
    setDraft(String(next));
  };
  const step = (delta: number) => {
    let next = value + delta;
    if (typeof max === "number" && next > max) next = max;
    if (next < min) next = min;
    if (next !== value) onChange(next);
  };
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", height: 32, borderRadius: 6, border: "1px solid var(--border)", background: "white", overflow: "hidden" }}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={value <= min}
        aria-label="Decrease quantity"
        className="flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ width: 28, height: "100%", border: "none", background: "transparent", cursor: "pointer" }}
      >
        <Minus className="w-3 h-3 text-slate-500" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); setDraft(v); }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setDraft(String(value)); (e.target as HTMLInputElement).blur(); }
        }}
        style={{
          width: 44, height: "100%", border: "none", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)",
          textAlign: "center", fontSize: 13, color: "var(--foreground)", background: "transparent", outline: "none", padding: 0,
        }}
      />
      <button
        type="button"
        onClick={() => step(+1)}
        disabled={typeof max === "number" && value >= max}
        aria-label="Increase quantity"
        className="flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ width: 28, height: "100%", border: "none", background: "transparent", cursor: "pointer" }}
      >
        <Plus className="w-3 h-3 text-slate-500" />
      </button>
    </div>
  );
}
import { useSOStore, CATALOG as STORE_CATALOG } from "./store";
import { ItemTypeBadge, DuplicateBadge } from "./StatusBadge";
import { InactiveItemPill } from "../shared/InactiveItemPill";
import { isItemInactive } from "../shared/inactiveItems";
import { ItemDescription } from "./ItemDescription";
import { useModalShortcuts, KbdHint } from "./ModalKeyboard";
import { Button } from "./ui/Button";
import { toast } from "sonner";
import { useDiscardGuard } from "./ui/DiscardChangesDialog";
import { ATPTooltip } from "./ATPTooltip";
import { HighlightText } from "../shared/HighlightText";
import { AdvancedConfiguratorModal } from "./AdvancedConfiguratorModal";
import { useItemQuickView, type ItemQuickViewItem } from "@/app/components/shared/ItemQuickView";
import type { CatalogItem } from "./types";

/* ═══ Typography — CSS variable tokens only ═══ */
const font: React.CSSProperties = {};


interface Props { soId: string; onClose: () => void; }

interface PendingItem {
  instanceId: string;
  item: CatalogItem;
  qty: number;
  /** Selected unit of measure. Defaults to "ea" when unset. Updated
   *  via the right-side UoM picker, which rescales the unit price by
   *  the conversion factor so the value the configurator and the
   *  eventual SO line item see stays consistent with the choice. */
  uom?: string;
  /** True for rows seeded from `so.lines` when the modal opened;
   *  false (or undefined) for rows the user added via the catalog
   *  during this modal session. Drives the "Duplicate of #N" badge
   *  so pre-existing lines don't get mis-labelled as duplicates of
   *  themselves just because their itemCode lives in `so.lines`. */
  wasInitial?: boolean;
}

/* UoM data layer — central `data/uomSets` module is the source of
   truth. `PENDING_UOM_OPTIONS` is kept as the discrete-set alias for
   any legacy lookup; per-product sets resolve via the helpers. */
import {
  UOM_SETS,
  type UomOption as ImportedUomOption,
  getUomSetForProduct,
  getPrimaryUomForProduct,
  findUomById,
  multiplierWithinSet,
} from '../../data/uomSets';
import { useDocMoney } from "@/app/components/currency/docCurrencyContext";
import { soFx } from "@/app/currency/soFx";
import { restateDesign } from "./soMoney";
const PENDING_UOM_OPTIONS = UOM_SETS.discrete;
type UomOption = ImportedUomOption;

/* Combined Qty + UoM capsule — mirrors the SO line items table's
   QtyUomCapsule. One bordered chip with a typeable qty on the left,
   a vertical hairline divider, and a UoM dropdown trigger on the
   right so the two controls read as a single capsule. */
function QtyUomCapsule({
  qty,
  uom,
  onChangeQty,
  onChangeUom,
  /* When the parent flags the capsule as just-bumped, we attach the
     `so-add-qty-capsule` class so the bordered chip flashes its own
     green ring + tint for ~1.1 s. */
  bumped = false,
  /* Per-product UoM list + primary id. Default to the discrete set
     for any legacy call site. */
  uomSet = PENDING_UOM_OPTIONS,
  primaryUomId = 'ea',
}: {
  qty: number;
  uom: string;
  onChangeQty: (next: number) => void;
  onChangeUom: (id: string) => void;
  bumped?: boolean;
  uomSet?: UomOption[];
  primaryUomId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(qty));
  const [open, setOpen] = useState(false);
  /* Viewport-space coordinates so the portalled panel anchors under
     the trigger. Portal escapes the right card's overflow. */
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (!editing) setDraft(String(qty)); }, [qty, editing]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.select(); }, [editing]);
  useEffect(() => {
    if (!open) { setPanelPos(null); return; }
    const reposition = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    };
    reposition();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);
  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed !== qty) onChangeQty(parsed);
    else setDraft(String(qty));
    setEditing(false);
  };
  const current = uomSet.find(u => u.id === (uom || primaryUomId).toLowerCase() || u.name.toLowerCase() === (uom || '').toLowerCase()) || uomSet[0];
  return (
    <div
      ref={wrapRef}
      key={bumped ? `bump-${qty}` : 'rest'}
      className={`relative inline-flex items-stretch ${bumped ? 'so-add-qty-capsule' : ''}`}
      style={{ height: 32, borderRadius: 6, border: `1px solid ${editing || open ? '#3B82F6' : 'var(--border)'}`, backgroundColor: '#FFFFFF', overflow: 'visible', boxShadow: editing ? '0 0 0 2px rgba(59,130,246,0.10)' : 'none', transition: 'border-color 100ms, box-shadow 100ms' }}
    >
      {editing ? (
        <div className="flex items-center" style={{ width: 64, padding: 0 }}>
          <input
            ref={inputRef}
            type="number"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(qty)); setEditing(false); } }}
            style={{ width: '100%', height: '100%', border: 'none', textAlign: 'center', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--foreground)', background: 'transparent', padding: 0 }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(String(qty)); setEditing(true); }}
          className="flex items-center justify-center text-foreground hover:bg-slate-50 transition-colors"
          style={{ width: 64, padding: 0, border: 'none', background: 'transparent', cursor: 'text', fontSize: 13, fontWeight: 600, lineHeight: 1 }}
          title="Click to edit quantity"
        >
          {qty.toLocaleString()}
        </button>
      )}
      <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, alignSelf: 'stretch' }} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${open ? 'bg-muted' : 'hover:bg-slate-50'}`}
        style={{ padding: '0 10px', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', borderRadius: '0 5px 5px 0' }}
        aria-label="Change unit of measure"
        title={current.name}
      >
        {/* Cap to ~6 characters so the capsule doesn't expand when a
            user picks a longer UoM. Anything past 6 chars truncates
            with an ellipsis. */}
        <span style={{ maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      </button>
      {open && panelPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="fixed bg-white rounded-lg"
          style={{ top: panelPos.top, right: panelPos.right, zIndex: 12500, border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, overflow: 'hidden' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {uomSet.map(u => {
            const isActive = u.id === current.id;
            const isPrimary = u.id === primaryUomId;
            return (
              <button
                key={u.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onChangeUom(u.id); setOpen(false); }}
                className={`w-full flex items-center justify-between text-left transition-colors cursor-pointer ${isActive ? 'bg-muted' : 'hover:bg-slate-50'}`}
                style={{ padding: '8px 10px', border: 'none' }}
              >
                <div className="flex flex-col items-start" style={{ gap: 2 }}>
                  <div className="flex items-center" style={{ gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1 }}>{u.name}</span>
                    {/* Partner Management "Primary" pill — surfaces the
                        item's preferred UoM at a glance. */}
                    {isPrimary && (
                      <span
                        style={{
                          fontSize: 9, fontWeight: 600,
                          color: '#1B6EF3', backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          padding: '1px 5px', borderRadius: 3, lineHeight: 1,
                          letterSpacing: 0.2, textTransform: 'uppercase',
                        }}
                      >
                        Primary
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1 }}>{u.fullName}</span>
                </div>
                {isActive && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

let _pendingCounter = 0;
function nextPendingId() { return `pend-${++_pendingCounter}-${Date.now()}`; }

export function AddLineItemDialog({ soId, onClose }: Props) {
  const store = useSOStore();

  const so = store.salesOrders.find(s => s.id === soId);
  const [search, setSearch] = useState("");
  /* The catalog's list prices are the design's USD; on this order they are
     in its currency, at the mid-market rate on its order date (spec 4.3). */
  const formatCurrency = useDocMoney();
  const fx = so ? soFx(so) : null;
  const CATALOG = useMemo(
    () => (fx ? STORE_CATALOG.map((c) => ({ ...c, unitPrice: restateDesign(c.unitPrice, fx.currency, fx.rateDate) })) : STORE_CATALOG),
    [fx?.currency, fx?.rateDate], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* Item peek modal — opens when the user taps any catalog or
     selected-card thumbnail. Same chrome as SOLineGrid. */
  const { open: openItemQuickView, modal: itemQuickViewModal } = useItemQuickView();
  const previewCatalogItem = (item: CatalogItem) => {
    const primaryName = findUomById(getPrimaryUomForProduct(item))?.name || 'EA';
    openItemQuickView({
      code: item.code,
      description: item.name,
      primaryTag: `Primary: ${item.type}`,
      material: item.category,
      uom: primaryName,
      onHand: item.inStock,
      metrics: [
        { label: "Unit Price", value: formatCurrency(item.unitPrice), caption: "Unit Price" },
        { label: "In Stock", value: `${item.inStock.toLocaleString()} ${primaryName}`, caption: "In Stock" },
      ],
    });
  };

  /* Pre-populate pending items from existing SO lines */
  const buildInitialPending = (): PendingItem[] => {
    if (!so) return [];
    return so.lines.filter(l => !l.cancelled).map(l => {
      const catalogItem = CATALOG.find(c => c.code === l.itemCode);
      if (!catalogItem) return null;
      /* Carry over each line's UoM + scaled unit price so the modal
         opens on the exact unit the table shows. Without this the
         pending row resets to the catalog item's base (primary)
         price and a Pallet line silently shrinks back to EA pricing
         on first open. */
      const pendingItem: PendingItem = {
        instanceId: nextPendingId(),
        item: typeof l.unitPrice === 'number' && l.unitPrice !== catalogItem.unitPrice
          ? { ...catalogItem, unitPrice: l.unitPrice }
          : catalogItem,
        qty: l.orderedQty,
        uom: l.uom,
        /* Mark this row as part of the initial seed so the duplicate
           badge knows it pre-existed on the SO and doesn't render
           "Duplicate of #N where N is itself" for every pending
           row. */
        wasInitial: true,
      };
      return pendingItem;
    }).filter(Boolean) as PendingItem[];
  };

  const [pending, setPending] = useState<PendingItem[]>(buildInitialPending);
  const [sidebarWidth, setSidebarWidth] = useState<"narrow" | "wide">("narrow");
  const [expandedProductDescs, setExpandedProductDescs] = useState<Set<string>>(new Set());
  const [expandedCardDescs, setExpandedCardDescs] = useState<Set<string>>(new Set());
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [qtyBumpIds, setQtyBumpIds] = useState<Set<string>>(new Set());
  const [configPendingId, setConfigPendingId] = useState<string | null>(null);
  const newlyAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyBumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  /* Refs to the left-side catalog rows, keyed by item.code. After
     adding a Recently-Ordered item we scroll the matching catalog
     row into view so the user sees it land in the "Already on this
     Order" section below. */
  const catalogRowRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  /* ── Existing item codes on the SO for duplicate detection ── */
  const existingCodeLineMap = new Map<string, number>();
  so?.lines.forEach((l, idx) => {
    if (!existingCodeLineMap.has(l.itemCode)) existingCodeLineMap.set(l.itemCode, idx + 1);
  });

  /* Dash/whitespace tolerant search. "000-100" or "000100" or "100-"
     all match a code like "000-100-001". Both raw and normalized
     substring checks run, against code/name/description/category so
     users can find items by what's printed on the tile, not just code. */
  const matchesItem = useMemo(() => {
    const raw = search.trim().toLowerCase();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const qNorm = normalize(search);
    return (item: CatalogItem) => {
      const test = (text: string | undefined) => {
        if (!text) return false;
        const t = text.toLowerCase();
        if (t.includes(raw)) return true;
        return qNorm.length > 0 && normalize(text).includes(qNorm);
      };
      return test(item.code) || test(item.name) || test(item.description) || test(item.category);
    };
  }, [search]);

  /* No-search state splits into two sections: items already on this
     order (so the user sees what's been added before scrolling), and
     the customer's recently-ordered items. "Recently Ordered" filters
     on the catalog's `isRecentlyOrdered` flag instead of using a
     blind head-of-catalogue slice, so it reflects the customer's
     familiar SKUs. Mirrors the Quote details picker. */
  const noSearchSections = useMemo(() => {
    const onOrderCodes = new Set(pending.map(p => p.item.code));
    return {
      alreadyAdded: CATALOG.filter(i => onOrderCodes.has(i.code)),
      recentlyOrdered: CATALOG.filter(i => i.isRecentlyOrdered && !onOrderCodes.has(i.code)),
    };
  }, [pending, CATALOG]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return CATALOG.filter(matchesItem);
  }, [search, matchesItem, CATALOG]);

  const filtered = useMemo(() =>
    search.trim()
      ? searchResults
      : [...noSearchSections.alreadyAdded, ...noSearchSections.recentlyOrdered],
    [search, searchResults, noSearchSections],
  );

  /* Counts per code */
  const pendingByCode = useMemo(() => {
    const map: Record<string, PendingItem[]> = {};
    pending.forEach(p => {
      if (!map[p.item.code]) map[p.item.code] = [];
      map[p.item.code].push(p);
    });
    return map;
  }, [pending]);

  const getTotalQtyForCode = (code: string) =>
    (pendingByCode[code] || []).reduce((s, p) => s + p.qty, 0);

  const getLineCountForCode = (code: string) =>
    (pendingByCode[code] || []).length;

  const isCodeAdded = (code: string) => getLineCountForCode(code) > 0;

  /* Flash highlight + scroll helper */
  const flashHighlight = useCallback((id: string) => {
    setNewlyAddedIds(prev => new Set([...prev, id]));
    if (newlyAddedTimer.current) clearTimeout(newlyAddedTimer.current);
    newlyAddedTimer.current = setTimeout(() => setNewlyAddedIds(new Set()), 4500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const flashQtyBump = useCallback((id: string) => {
    setQtyBumpIds(prev => new Set([...prev, id]));
    if (qtyBumpTimer.current) clearTimeout(qtyBumpTimer.current);
    qtyBumpTimer.current = setTimeout(() => setQtyBumpIds(new Set()), 3500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  /* Add a new item as fresh line */
  const addNewPending = useCallback((item: CatalogItem) => {
    /* PO rule: an inactive item can't start a new line. */
    if (isItemInactive(item.code)) return;
    const newId = nextPendingId();
    /* Seed each pending line with its product's primary UoM so the
       capsule opens on the right unit immediately. */
    const primaryName = findUomById(getPrimaryUomForProduct(item))?.name || 'EA';
    const existingItems = pending.filter(p => p.item.code === item.code);
    if (existingItems.length > 0) {
      // Insert after last instance of this code
      const lastIdx = pending.map(p => p.item.code).lastIndexOf(item.code);
      setPending(prev => {
        const updated = [...prev];
        updated.splice(lastIdx + 1, 0, { instanceId: newId, item, qty: 1, uom: primaryName });
        return updated;
      });
    } else {
      setPending(prev => [...prev, { instanceId: newId, item, qty: 1, uom: primaryName }]);
    }
    /* Fresh line adds only fire the newly-added flash. Stacking a
       qty-bump on the same element causes the two class timers to
       clear at different moments, which reads as an all-cards
       re-flash on the second animation loop. */
    flashHighlight(newId);
    /* Scroll the left-side catalog row into view — by the time the
       state update has flushed, the item will have moved from
       "Recently Ordered" into "Already on this Order" below it.
       Small delay so the section re-renders first. */
    setTimeout(() => {
      const catalogEl = catalogRowRefsMap.current.get(item.code);
      if (catalogEl) catalogEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, [pending, flashHighlight]);

  /* Add qty to the first existing pending instance */
  const addQtyToPending = useCallback((code: string) => {
    /* PO: a line whose item was deactivated keeps its quantity but takes
       no more. Reducing is untouched. */
    if (isItemInactive(code)) return;
    const first = pending.find(p => p.item.code === code);
    if (first) {
      setPending(prev => prev.map(p =>
        p.instanceId === first.instanceId ? { ...p, qty: p.qty + 1 } : p
      ));
      /* Existing line increment — qty-bump only. Not a fresh add. */
      flashQtyBump(first.instanceId);
    }
  }, [pending, flashQtyBump]);

  /* Mirror — subtracts one unit from the first existing pending
     instance. The -1 EA button it backs is only rendered when the
     pending qty is greater than 1. */
  const subQtyFromPending = useCallback((code: string) => {
    const first = pending.find(p => p.item.code === code);
    if (first && first.qty > 1) {
      setPending(prev => prev.map(p =>
        p.instanceId === first.instanceId ? { ...p, qty: p.qty - 1 } : p
      ));
      flashQtyBump(first.instanceId);
    }
  }, [pending, flashQtyBump]);

  /* Click handler for catalog row — first add or +1 qty */
  const handleCatalogClick = useCallback((item: CatalogItem) => {
    const exists = pending.some(p => p.item.code === item.code);
    if (!exists) {
      addNewPending(item);
    } else {
      addQtyToPending(item.code);
    }
  }, [pending, addNewPending, addQtyToPending]);

  const removePending = (instanceId: string) => setPending(prev => prev.filter(p => p.instanceId !== instanceId));
  const updatePendingQty = (instanceId: string, qty: number) => setPending(prev => prev.map(p => p.instanceId === instanceId ? { ...p, qty: Math.max(1, qty) } : p));
  /* Rescale the pending item's unit price by the UoM conversion factor
     so the line total stays consistent with the underlying item cost
     when the user swaps the selected unit (e.g. EA → Pallet × 480). */
  const updatePendingUom = (instanceId: string, newUomId: string) => {
    setPending(prev => prev.map(p => {
      if (p.instanceId !== instanceId) return p;
      /* Multipliers resolved within the item's product set — a Liter
         and a Box never interconvert. */
      const itemSet = getUomSetForProduct(p.item);
      const oldMult = multiplierWithinSet(p.uom, itemSet);
      const newMult = multiplierWithinSet(newUomId, itemSet);
      if (oldMult === newMult) return { ...p, uom: newUomId };
      return { ...p, uom: newUomId, item: { ...p.item, unitPrice: (p.item.unitPrice * newMult) / oldMult } };
    }));
  };

  /* Duplicate a right-panel pending item */
  const duplicatePending = useCallback((instanceId: string) => {
    const source = pending.find(p => p.instanceId === instanceId);
    if (!source) return;
    const newId = nextPendingId();
    const sourceIndex = pending.findIndex(p => p.instanceId === instanceId);
    setPending(prev => {
      const updated = [...prev];
      updated.splice(sourceIndex + 1, 0, { instanceId: newId, item: source.item, qty: source.qty });
      return updated;
    });
    flashHighlight(newId);
    toast.info(`Duplicated ${source.item.code} (Qty ${source.qty})`);
  }, [pending, flashHighlight]);

  /* Track initial pending IDs to distinguish pre-existing from new */
  const [initialPendingIds] = useState<Set<string>>(() => new Set(buildInitialPending().map(p => p.instanceId)));

  const handleAdd = () => {
    // Delete all existing lines first (we're replacing the full set)
    if (so) {
      so.lines.forEach(l => store.deleteSOLine(soId, l.id));
    }
    // Add all pending items as new lines
    pending.forEach(p => store.addSOLine(soId, {
      itemCode: p.item.code,
      itemName: p.item.name,
      itemType: p.item.type,
      orderedQty: p.qty,
      unitPrice: p.item.unitPrice,
      taxRate: 0.08,
    }));
    toast.success(`Updated order with ${pending.length} item(s)`);
    onClose();
  };

  const isDirty = pending.length > 0;
  const { guardedClose, discardDialog } = useDiscardGuard(isDirty, onClose);
  useModalShortcuts({ onConfirm: handleAdd, onClose: guardedClose, confirmDisabled: pending.length === 0 });
  const subtotal = pending.reduce((s, p) => s + p.qty * p.item.unitPrice, 0);

  // Sequential numbering with duplicate tracking
  const getItemMeta = () => {
    const numbers: Record<string, string> = {};
    const originalItemNumbers: Record<string, number | null> = {};
    const firstOccurrence: Record<string, number> = {};
    pending.forEach((p, index) => {
      const lineNum = index + 1;
      numbers[p.instanceId] = `${lineNum}`;
      if (!(p.item.code in firstOccurrence)) {
        firstOccurrence[p.item.code] = lineNum;
        originalItemNumbers[p.instanceId] = null;
      } else {
        originalItemNumbers[p.instanceId] = firstOccurrence[p.item.code];
      }
    });
    return { numbers, originalItemNumbers };
  };

  const { numbers: itemNumbers, originalItemNumbers } = getItemMeta();

  const sidebarStyle = sidebarWidth === "narrow"
    ? { width: "30%", flexGrow: 0, flexShrink: 0 }
    : { width: "65%", flexGrow: 0, flexShrink: 0 };

  const leftSideClass = sidebarWidth === "wide" ? "" : "flex-1";

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} onClick={guardedClose} />
      {discardDialog}

      <div
        className="relative bg-card border border-border flex flex-col overflow-hidden"
        style={{ width: 1120, maxHeight: "88vh", borderRadius: "var(--radius-xl)", boxShadow: "var(--elevation-3)" }}
      >
        {/* Header — Quotes canonical: 32px rounded-lg icon chip (bg-accent), 14px title, 11px muted subtitle, 28px close. */}
        <div className="flex items-center justify-between border-b border-border shrink-0" style={{ padding: "16px 20px" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent flex items-center justify-center" style={{ width: 32, height: 32 }}>
              <Plus className="text-primary" style={{ width: 16, height: 16 }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Add Line Items</h3>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>Select products and configure quantities before adding to order</div>
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

        {/* ═══ Body ═══ */}
        <div className="flex flex-1 overflow-hidden">
          {/* CSS for animations — mirrors CreateSOStep2 */}
          <style>{`
            /* Card highlight animations — newly-added and qty-bump
               both use green so the feedback family stays consistent
               with the Quote module and CreateSOStep2. */
            @keyframes soAddNewCard {
              0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.22); background-color: rgba(254, 249, 195, 0.55); border-color: rgba(5, 150, 105, 0.65); }
              30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.22); background-color: var(--card); border-color: rgba(5, 150, 105, 0.65); }
              80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.22); background-color: var(--card); border-color: rgba(5, 150, 105, 0.65); }
              100% { box-shadow: var(--elevation-1); background-color: var(--card); border-color: var(--border); }
            }
            .so-add-new-card { animation: soAddNewCard 4000ms linear forwards !important; }

            @keyframes soAddQtyBump {
              0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: rgba(254, 249, 195, 0.50); border-color: rgba(5, 150, 105, 0.65); }
              30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: var(--card); border-color: rgba(5, 150, 105, 0.65); }
              80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: var(--card); border-color: rgba(5, 150, 105, 0.65); }
              100% { box-shadow: var(--elevation-1); background-color: var(--card); border-color: var(--border); }
            }
            .so-add-qty-bump { animation: soAddQtyBump 2600ms linear forwards; }

            @keyframes soAddQtyCapsuleFlash {
              0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: rgba(254, 249, 195, 0.60); }
              30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: var(--card); }
              80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: var(--card); }
              100% { box-shadow: none; border-color: var(--border); background-color: var(--card); }
            }
            .so-add-qty-capsule { animation: soAddQtyCapsuleFlash 2400ms linear forwards; }
            /* No-zoom hover treatment. The previous
               transform: translateY(-1px) on catalog cards and
               transform: scale(1.1) on action icons caused the
               "Advanced Configuration zooming in an odd way on hover"
               bug. Hover now changes colours only. */
            .so-add-catalog-card { transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
            .so-add-catalog-card:hover { background-color: #F0F7FF !important; border-color: var(--primary) !important; box-shadow: 0 2px 6px rgba(10, 119, 255, 0.10); }
            .so-add-catalog-card-added { background-color: #F0FDF4 !important; }
            .so-add-catalog-card-added:hover { background-color: #ECFDF5 !important; border-color: var(--success) !important; }
            .so-add-catalog-card:hover .so-add-hint-btn { opacity: 1 !important; }
            .so-add-sel-card { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
            .so-add-sel-card .so-add-card-action { transition: background-color 120ms ease, color 120ms ease; border-radius: 6px; }
            .so-add-sel-card .so-add-card-action:hover { background-color: var(--secondary); }
            .so-add-panel-left, .so-add-panel-right { transition: width 350ms cubic-bezier(0.4, 0, 0.2, 1), flex 350ms cubic-bezier(0.4, 0, 0.2, 1), padding 350ms cubic-bezier(0.4, 0, 0.2, 1); }
          `}</style>

          {/* ═══ LEFT — Product Catalog ═══ */}
          <div
            className={`so-add-panel-left flex flex-col overflow-hidden py-5 ${leftSideClass} ${sidebarWidth === "wide" ? "px-5" : "px-6"}`}
            style={{
              borderRight: "1px solid var(--border)",
              background: "var(--card)",
              ...(sidebarWidth === "wide" ? { width: "35%", flexGrow: 0, flexShrink: 0 } : {}),
            }}
          >
            {/* Title + layout toggle */}
            <div style={{ marginBottom: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <h4 style={{ fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                  Add Line Items
                </h4>
                <div className="flex items-center overflow-hidden" style={{ border: "1px solid var(--border)", borderRadius: 6, height: 28, background: "var(--card)" }}>
                  <button
                    onClick={() => setSidebarWidth("narrow")}
                    className={`w-8 h-7 flex items-center justify-center transition-colors ${sidebarWidth === "narrow" ? "bg-primary/12" : "hover:bg-secondary"}`}
                    style={{ borderRight: "1px solid var(--border)", color: sidebarWidth === "narrow" ? "var(--primary)" : "var(--foreground)", opacity: sidebarWidth === "narrow" ? 1 : 0.4 }}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSidebarWidth("wide")}
                    className={`w-8 h-7 flex items-center justify-center transition-colors ${sidebarWidth === "wide" ? "bg-primary/12" : "hover:bg-secondary"}`}
                    style={{ color: sidebarWidth === "wide" ? "var(--primary)" : "var(--foreground)", opacity: sidebarWidth === "wide" ? 1 : 0.4 }}
                  >
                    <Grid2x2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5 }}>
                Add products from the catalog and configure quantities for each line item.
              </p>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--foreground)", opacity: 0.3 }} />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full h-9 pl-10 pr-3 transition-colors"
                  style={{ fontSize: "var(--text-caption)", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--input-background)", color: "var(--foreground)", outline: "none" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.boxShadow = "var(--focus-ring-shadow)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                  autoFocus
                />
              </div>
            </div>

            {/* Section header + cards live inside the same scroll
                container so the no-search state can show two headers
                ("Already on this Order" + "Recently Ordered") that
                scroll with the list. Search mode collapses to a
                single "Search Results" header. */}
            <div className={`flex-1 overflow-y-auto ${sidebarWidth === "wide" ? "-mx-5" : "-mx-6"}`}>
              <div className={`space-y-3 pb-3 ${sidebarWidth === "wide" ? "px-5 space-y-2" : "px-6"}`}>
                {(() => {
                  const recentlyOrderedCapped = noSearchSections.recentlyOrdered.slice(0, 12);
                  const noSearchEmpty = !search.trim() && recentlyOrderedCapped.length === 0 && noSearchSections.alreadyAdded.length === 0;
                  const searchEmpty = !!search.trim() && searchResults.length === 0;
                  /* Unified empty state: when there's nothing to show
                     (no search hit, or fresh order with no recent
                     items for the customer), prompt the user to search
                     instead of leaving a blank panel. */
                  if (noSearchEmpty || searchEmpty) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Package className="w-12 h-12 mb-3" style={{ color: "var(--foreground)", opacity: 0.15 }} />
                        <p style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5, marginBottom: 4 }}>
                          {searchEmpty ? 'No products found' : 'No items to suggest yet'}
                        </p>
                        <p style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.35 }}>
                          {searchEmpty ? 'Try a different search term' : 'Search to add line items'}
                        </p>
                      </div>
                    );
                  }
                  type Row = { kind: 'header'; label: string; count: number } | { kind: 'card'; item: CatalogItem };
                  /* No-search sections are conditionally included so
                     an empty "Recently Ordered" or empty "Already on
                     this Order" hides its header instead of rendering
                     a "(0)" tag with no rows underneath. */
                  const rows: Row[] = search.trim()
                    ? [
                        { kind: 'header', label: 'Search Results', count: searchResults.length },
                        ...searchResults.map((i) => ({ kind: 'card' as const, item: i })),
                      ]
                    : [
                        ...(recentlyOrderedCapped.length > 0 ? [{ kind: 'header' as const, label: 'Recently Ordered', count: recentlyOrderedCapped.length }] : []),
                        ...recentlyOrderedCapped.map((i) => ({ kind: 'card' as const, item: i })),
                        ...(noSearchSections.alreadyAdded.length > 0 ? [{ kind: 'header' as const, label: 'Already on this Order', count: noSearchSections.alreadyAdded.length }] : []),
                        ...noSearchSections.alreadyAdded.map((i) => ({ kind: 'card' as const, item: i })),
                      ];
                  return rows.map((row, rowIdx) => {
                    if (row.kind === 'header') {
                      return (
                        <div key={`h-${rowIdx}-${row.label}`} style={{ fontSize: 11, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.5px", lineHeight: 1, marginBottom: 12, marginTop: rowIdx === 0 ? 0 : 12 }}>
                          {row.label} <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 16, padding: "0 5px", backgroundColor: "var(--muted)", color: "var(--muted-foreground)", borderRadius: 4, fontSize: 11, fontWeight: 600, lineHeight: 1, verticalAlign: "middle", marginLeft: 4 }}>{row.count}</span>
                        </div>
                      );
                    }
                    const item = row.item;
                    const added = isCodeAdded(item.code);
                    const addedQty = getTotalQtyForCode(item.code);
                    const addedLines = getLineCountForCode(item.code);
                    const existingLineNum = existingCodeLineMap.get(item.code);
                    /* When the user already has a pending row for
                       this product, the +/− buttons add/remove in
                       the row's existing UoM (Box, Pallet, Gallon,
                       Foot, etc.) instead of always in EA. New rows
                       still seed at the product's primary. */
                    const existingPending = pending.find(p => p.item.code === item.code);
                    const buttonUomName = existingPending?.uom || findUomById(getPrimaryUomForProduct(item))?.name || 'EA';
                    /* Blue summary pill: when multiple pending rows
                       exist for this product (duplicates) and they
                       use different UoMs, collapse the unit to
                       "units" so we don't mislabel a mixed total. */
                    const allPendingForCode = pending.filter(p => p.item.code === item.code);
                    const uniquePendingUoms = new Set(allPendingForCode.map(p => (p.uom || '').toLowerCase()).filter(Boolean));
                    const pillUomName = uniquePendingUoms.size > 1
                      ? 'units'
                      : (allPendingForCode[0]?.uom || findUomById(getPrimaryUomForProduct(item))?.name || 'EA');

                    return (
                    <div
                      key={item.code}
                      ref={(el) => {
                        if (el) catalogRowRefsMap.current.set(item.code, el);
                        else catalogRowRefsMap.current.delete(item.code);
                      }}
                      onClick={() => { if (!isItemInactive(item.code)) handleCatalogClick(item); }}
                      title={isItemInactive(item.code) ? "Inactive items can't be added to an order" : undefined}
                      className={`w-full relative so-add-catalog-card ${isItemInactive(item.code) ? "cursor-not-allowed" : "cursor-pointer"} ${added ? "so-add-catalog-card-added" : ""}`}
                      style={{
                        /* PO's inactive catalogue card: amber-200 edge. */
                        border: isItemInactive(item.code) ? "1px solid #FDE68A" : added ? "1px solid var(--success)" : "1px solid var(--border)",
                        borderRadius: "var(--radius)",
                        background: "var(--card)",
                      }}
                    >
                      <div className={`flex items-start p-3 ${sidebarWidth === "wide" ? "gap-2" : "gap-3"}`}>
                        {/* Square thumbnail (8px) — clicking opens the
                            ItemQuickView peek modal so the user can see
                            the item record without leaving the dialog. */}
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); previewCatalogItem(item); }}
                            title="Preview item"
                            aria-label={`Preview ${item.code}`}
                            className={`flex items-center justify-center transition-colors cursor-pointer ${sidebarWidth === "wide" ? "w-8 h-8" : "w-10 h-10"}`}
                            style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 0 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                          >
                            <Package className={sidebarWidth === "wide" ? "w-3 h-3" : "w-4 h-4"} style={{ color: "var(--foreground)", opacity: 0.25 }} />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Row 1: SKU + type pill + price. The
                              "Duplicate of #N" badge was removed from
                              catalog (left) cards — it belongs on the
                              right-side selected-items column only,
                              matching the creation flow. The card
                              already conveys "added" via the green
                              border + "Added · ×N" pill in row 3. */}
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)", lineHeight: 1 }}>
                                <HighlightText text={item.code} searchTerm={search} />
                              </span>
                              {/* Every width: it is why the card does nothing on click. */}
                              <InactiveItemPill code={item.code} size="md" />
                              {sidebarWidth === "narrow" && <ItemTypeBadge type={item.type} />}
                            </div>
                            <div className="text-right shrink-0">
                              <span style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>
                                {formatCurrency(item.unitPrice)}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 4 }}>/ {findUomById(getPrimaryUomForProduct(item))?.name || 'EA'}</span>
                            </div>
                          </div>

                          {/* Row 2: Description */}
                          <div style={{ fontSize: "var(--text-micro)", color: "var(--muted-foreground)", marginBottom: sidebarWidth === "wide" ? 4 : 8, lineHeight: 1.5 }}>
                            {(() => {
                              const truncLen = sidebarWidth === "wide" ? 50 : 80;
                              if (expandedProductDescs.has(item.code)) {
                                return (
                                  <>
                                    <HighlightText text={item.name} searchTerm={search} />{" "}
                                    <span
                                      onClick={(e) => { e.stopPropagation(); const n = new Set(expandedProductDescs); n.delete(item.code); setExpandedProductDescs(n); }}
                                      className="inline-flex items-center gap-0.5"
                                      style={{ color: "var(--primary)", cursor: "pointer", fontWeight: "var(--font-weight-medium)", whiteSpace: "nowrap" }}
                                    >less <ChevronsUp className="w-3 h-3 inline" /></span>
                                  </>
                                );
                              }
                              if (item.name.length > truncLen) {
                                return (
                                  <>
                                    <HighlightText text={item.name.slice(0, truncLen) + "…"} searchTerm={search} />{" "}
                                    <span
                                      onClick={(e) => { e.stopPropagation(); const n = new Set(expandedProductDescs); n.add(item.code); setExpandedProductDescs(n); }}
                                      className="inline-flex items-center gap-0.5"
                                      style={{ color: "var(--primary)", cursor: "pointer", fontWeight: "var(--font-weight-medium)", whiteSpace: "nowrap" }}
                                    >
                                      more <ChevronsDown className="w-3 h-3 inline" />
                                    </span>
                                  </>
                                );
                              }
                              return <HighlightText text={item.name} searchTerm={search} />;
                            })()}
                          </div>

                          {/* Row 3: Stock + actions */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {sidebarWidth === "narrow" && (
                                <span className="inline-flex items-center border shrink-0" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 6, fontWeight: 500, lineHeight: 'normal', backgroundColor: 'var(--secondary)', color: 'var(--foreground)', borderColor: 'var(--border)' }}>
                                  <HighlightText text={item.category} searchTerm={search} />
                                </span>
                              )}
                              {/* PI tag-spec ATP pill — 13px / 2px 8px /
                                  6px radius / hairline border. Was a
                                  rounded-9999 capsule which read as a
                                  different chip family from the
                                  category pill on the same row. */}
                              <ATPTooltip product={{ code: item.code, inStock: item.inStock }}>
                                <span
                                  className="cursor-help inline-flex items-center"
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    lineHeight: "normal",
                                    backgroundColor: item.inStock === 0 ? "rgba(220, 38, 38, 0.10)" : item.inStock <= 5 ? "rgba(217, 119, 6, 0.12)" : "rgba(5, 150, 105, 0.10)",
                                    color: item.inStock === 0 ? "var(--destructive)" : item.inStock <= 5 ? "#92400E" : "var(--success)",
                                    border: `1px solid ${item.inStock === 0 ? "rgba(220, 38, 38, 0.30)" : item.inStock <= 5 ? "#FDE68A" : "#A7F3D0"}`,
                                  }}
                                >
                                  {item.inStock} ATP
                                </span>
                              </ATPTooltip>
                            </div>

                            {added ? (
                              <div className="flex items-center gap-1.5">
                                {/* "X EA | N lines" stat pill — Partner
                                    chrome (13px / weight 500 / 2px 8px /
                                    radius 6), primary-blue tint so it
                                    reads on both the white catalog card
                                    and the green `added` variant. Matches
                                    the same pill in the Quote picker. */}
                                <span
                                  className="inline-flex items-center"
                                  style={{
                                    gap: 6, padding: "2px 8px", borderRadius: 6,
                                    fontSize: 13, fontWeight: 500, lineHeight: "normal",
                                    backgroundColor: "#EFF6FF", color: "#1D4ED8",
                                    border: "1px solid #BFDBFE",
                                  }}
                                >
                                  <Check style={{ width: 12, height: 12 }} />
                                  <span>{addedQty} {pillUomName}</span>
                                  <span aria-hidden style={{ width: 1, height: 12, backgroundColor: "rgba(29, 78, 216, 0.30)" }} />
                                  <span>{addedLines === 1 ? "1 line" : `${addedLines} lines`}</span>
                                </span>
                                {/* -/+ buttons — read the pending
                                    line's existing UoM so a Box-priced
                                    line stays in Box instead of being
                                    pushed by a stray EA. */}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); if (addedQty > 1) subQtyFromPending(item.code); }}
                                  disabled={addedQty <= 1}
                                  className={`inline-flex items-center gap-1 transition-all ${addedQty <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-[0.97] cursor-pointer'}`}
                                  style={{
                                    height: 28, padding: "0 10px", borderRadius: 6,
                                    fontSize: 12, fontWeight: 600, lineHeight: 1,
                                    background: "#FFFFFF", color: "var(--foreground)",
                                    border: "1px solid var(--border)",
                                    boxShadow: addedQty <= 1 ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.08)',
                                  }}
                                  title={addedQty <= 1 ? 'Remove the line with the Trash icon' : `Remove one ${buttonUomName} from the pending line`}
                                  aria-label={`Remove one ${buttonUomName}`}
                                >
                                  <Minus className="w-3 h-3" />
                                  1 {buttonUomName}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); addQtyToPending(item.code); }}
                                  disabled={isItemInactive(item.code)}
                                  className={`inline-flex items-center gap-1 transition-all ${isItemInactive(item.code) ? "cursor-not-allowed" : "cursor-pointer hover:shadow-md active:scale-[0.97]"}`}
                                  style={{
                                    height: 28, padding: "0 10px", borderRadius: 6,
                                    fontSize: 12, fontWeight: 600, lineHeight: 1,
                                    background: "var(--primary)", color: "var(--primary-foreground)",
                                    border: "1px solid var(--primary)",
                                    boxShadow: '0 1px 2px rgba(10, 119, 255, 0.30)',
                                    opacity: isItemInactive(item.code) ? 0.5 : 1,
                                  }}
                                  title={isItemInactive(item.code) ? "Inactive items can't take more quantity" : `Add another ${buttonUomName} to the existing line`}
                                >
                                  <Plus className="w-3 h-3" />
                                  1 {buttonUomName}
                                </button>
                              </div>
                            ) : isItemInactive(item.code) ? null : (
                              <button
                                type="button"
                                className="so-add-hint-btn inline-flex items-center gap-1 transition-colors cursor-pointer"
                                style={{
                                  height: 28, padding: "0 12px", borderRadius: 6,
                                  fontSize: 12, fontWeight: 600, lineHeight: 1,
                                  background: "#E7F3FF", color: "var(--primary)",
                                  border: "1px solid rgba(10, 119, 255, 0.30)",
                                  opacity: 0, transition: "opacity 150ms ease, background-color 150ms ease, color 150ms ease",
                                }}
                              >
                                <Plus className="w-3 h-3" />
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT — Selected Items Panel ═══ */}
          <div className="so-add-panel-right flex flex-col overflow-hidden" style={{ ...sidebarStyle, background: "#FAFBFC" }}>
            <div className={`py-4 shrink-0 ${sidebarWidth === "narrow" ? "px-4" : "px-6"}`} style={{ background: "#FAFBFC" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted-foreground)", fontWeight: 500, letterSpacing: "0.06em" }}>Order Items</span>
                  {pending.length > 0 && (
                    <div className="inline-flex items-center overflow-hidden" style={{ borderRadius: 4, border: "1px solid var(--border)", background: "var(--card)" }}>
                      <span className="px-2 py-0.5" style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>{pending.length}</span>
                    </div>
                  )}
                </div>
                {pending.length > 0 && (
                  <button
                    onClick={() => setPending([])}
                    className="px-3 py-1.5 rounded transition-all"
                    style={{ fontSize: "var(--text-micro)", color: "var(--destructive)", fontWeight: "var(--font-weight-medium)", background: "transparent", border: "1px solid transparent" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--destructive)"; e.currentTarget.style.opacity = "0.08"; e.currentTarget.style.borderColor = "var(--destructive)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "1"; e.currentTarget.style.borderColor = "transparent"; }}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto pb-4 ${sidebarWidth === "narrow" ? "px-4" : "px-6"}`} style={{ background: "#FAFBFC" }}>
              {pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--card)" }}>
                    <Package className="w-8 h-8" style={{ color: "var(--foreground)", opacity: 0.15 }} />
                  </div>
                  <p style={{ fontSize: "var(--text-caption)", color: "var(--foreground)", opacity: 0.5 }}>No items selected</p>
                  <p style={{ fontSize: "var(--text-micro)", color: "var(--foreground)", opacity: 0.35, marginTop: 4 }}>Click products to add them</p>
                </div>
              ) : (
                <div className={sidebarWidth === "narrow" ? "space-y-3" : "grid gap-3"} style={sidebarWidth === "narrow" ? {} : { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  {pending.map((p) => {
                    const origNum = originalItemNumbers[p.instanceId];
                    const isNewlyAdded = newlyAddedIds.has(p.instanceId);
                    const isQtyBumped = qtyBumpIds.has(p.instanceId);
                    const existingLineNum = existingCodeLineMap.get(p.item.code);
                    // Green left-accent when this product already exists on
                    // the order (matches Quote details picker behavior so
                    // both modules read identically).
                    const itemIsExisting = existingLineNum !== undefined;
                    return (
                      <div
                        key={p.instanceId}
                        ref={(el) => { if (el) cardRefsMap.current.set(p.instanceId, el); else cardRefsMap.current.delete(p.instanceId); }}
                        className={`p-3 flex flex-col relative overflow-hidden so-add-sel-card ${isNewlyAdded ? "so-add-new-card" : ""} ${isQtyBumped ? "so-add-qty-bump" : ""}`}
                        style={{
                          borderRadius: "var(--radius)",
                          backgroundColor: "var(--card)",
                          borderTop: "1px solid var(--border)",
                          borderRight: "1px solid var(--border)",
                          borderBottom: "1px solid var(--border)",
                          borderLeft: itemIsExisting ? "3px solid var(--success)" : "1px solid var(--border)",
                        }}
                      >
                        {/* Item Number Badge - top-left corner */}
                        <div
                          className="absolute top-0 left-0 flex items-center justify-center bg-primary/12 text-primary"
                          style={{ width: 20, height: 20, borderTopLeftRadius: "var(--radius)", borderBottomRightRadius: 8, fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)" }}
                        >
                          {itemNumbers[p.instanceId]}
                        </div>

                        <div className="mb-2 flex-1">
                          <div className="flex items-start justify-between mb-0.5" style={{ paddingLeft: 28 }}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span style={{ fontSize: "var(--text-micro)", fontWeight: "var(--font-weight-semibold)", color: "var(--foreground)" }}>{p.item.code}</span>
                              <InactiveItemPill code={p.item.code} size="md" />
                              <ItemTypeBadge type={p.item.type} />
                              {origNum != null && <DuplicateBadge ofIndex={origNum} />}
                              {/* Render the "Duplicate of #N" badge
                                  against an existing SO line ONLY for
                                  rows the user newly added in this
                                  modal session. Pre-seeded rows
                                  (wasInitial = true) would otherwise
                                  flag themselves as duplicates of
                                  their own SO position. */}
                              {!p.wasInitial && existingLineNum !== undefined && origNum == null && <DuplicateBadge ofIndex={existingLineNum} />}
                            </div>
                            {/* Action icons get real 28px tap-targets +
                                tooltips on hover so the icon-only
                                buttons explain themselves. Matches the
                                Partner v7 icon-button affordance. */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => duplicatePending(p.instanceId)}
                                className="flex items-center justify-center transition-colors duration-150 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                style={{ width: 28, height: 28, borderRadius: 6, background: "transparent" }}
                                title="Duplicate as a separate line item"
                                aria-label="Duplicate line item"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => removePending(p.instanceId)}
                                className="flex items-center justify-center transition-colors duration-150 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                style={{ width: 28, height: 28, borderRadius: 6, background: "transparent" }}
                                title="Remove from order"
                                aria-label="Remove line item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {/* Thumb opens ItemQuickView peek modal. */}
                            <div className="shrink-0">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); previewCatalogItem(p.item); }}
                                title="Preview item"
                                aria-label={`Preview ${p.item.code}`}
                                className="w-9 h-9 flex items-center justify-center transition-colors cursor-pointer"
                                style={{ background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: 0 }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                              >
                                <Package className="w-3.5 h-3.5" style={{ color: "var(--foreground)", opacity: 0.25 }} />
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Description text size lifted to 12px to
                                  match Quote's right card (text-[12px]).
                                  --text-micro resolves to 10px which read
                                  too small here. */}
                              <div style={{ fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
                                {(() => {
                                  if (expandedCardDescs.has(p.instanceId)) {
                                    return (
                                      <>
                                        {p.item.name}{" "}
                                        <button onClick={() => { const n = new Set(expandedCardDescs); n.delete(p.instanceId); setExpandedCardDescs(n); }} className="inline-flex items-center gap-0.5" style={{ color: "var(--primary)", fontWeight: 500, fontSize: 12 }}>less <ChevronsUp className="w-3 h-3 inline" /></button>
                                      </>
                                    );
                                  }
                                  if (p.item.name.length > 80) {
                                    return (
                                      <>
                                        {p.item.name.slice(0, 80)}…{" "}
                                        <button onClick={() => { const n = new Set(expandedCardDescs); n.add(p.instanceId); setExpandedCardDescs(n); }} className="inline-flex items-center gap-0.5 whitespace-nowrap" style={{ color: "var(--primary)", fontWeight: 500, fontSize: 12 }}>more <ChevronsDown className="w-3 h-3 inline" /></button>
                                      </>
                                    );
                                  }
                                  return p.item.name;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto">
                          {/* Labels use muted-foreground (~#64748B) for
                              AA contrast instead of opacity 0.4 (~3:1).
                              Same colour as Quote's labels. */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <label style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>Quantity</label>
                            <label style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>Item Total</label>
                          </div>
                          {/* QtyStepper with explicit − / + buttons —
                              matches the Quote details + creation flow
                              card chrome exactly. */}
                          <div className="flex items-center justify-between gap-2">
                            {/* Combined qty + uom capsule — same chrome
                                as the SO line items table's
                                QtyUomCapsule so quantity and unit live
                                in one bordered chip. The −/+ twins on
                                the left product-picker card own the
                                increment/decrement role; qty here is a
                                direct typeable field. */}
                            {(() => {
                              const itemSet = getUomSetForProduct(p.item);
                              const itemPrimary = getPrimaryUomForProduct(p.item);
                              const itemUomLabel = itemSet.find(u => u.id === (p.uom || itemPrimary).toLowerCase() || u.name.toLowerCase() === (p.uom || '').toLowerCase())?.name || itemSet[0].name;
                              return (
                                <>
                                  <QtyUomCapsule
                                    qty={p.qty}
                                    uom={p.uom || itemPrimary}
                                    onChangeQty={(next) => updatePendingQty(p.instanceId, next)}
                                    onChangeUom={(id) => updatePendingUom(p.instanceId, id)}
                                    bumped={isQtyBumped}
                                    uomSet={itemSet}
                                    primaryUomId={itemPrimary}
                                  />
                                  <div className="flex-1 text-right min-w-0">
                                    <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                                      {formatCurrency(p.qty * p.item.unitPrice)}
                                    </div>
                                    <div className="truncate" style={{ fontSize: 11, fontWeight: 400, color: "var(--muted-foreground)" }}>
                                      {itemUomLabel}
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                          {/* Partner-secondary button: white surface,
                              black label, resting 1px shadow + slate
                              border; hover elevates to primary tint
                              with deeper shadow. No transform — the
                              `so-add-card-action` zoom is gone. */}
                          <button
                            onClick={() => setConfigPendingId(p.instanceId)}
                            className="w-full flex items-center justify-center gap-2 transition-all"
                            style={{
                              marginTop: 8,
                              height: 36,
                              border: "1px solid var(--border)",
                              borderRadius: 6,
                              fontSize: 13,
                              color: "var(--foreground)",
                              fontWeight: 500,
                              background: "var(--card)",
                              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "var(--primary)";
                              e.currentTarget.style.backgroundColor = "#F0F7FF";
                              e.currentTarget.style.color = "var(--primary)";
                              e.currentTarget.style.boxShadow = "0 2px 6px rgba(10, 119, 255, 0.12)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "var(--border)";
                              e.currentTarget.style.backgroundColor = "var(--card)";
                              e.currentTarget.style.color = "var(--foreground)";
                              e.currentTarget.style.boxShadow = "0 1px 2px rgba(15, 23, 42, 0.06)";
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Advanced Configuration
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subtotal bar — no shipping calculation line */}
            {pending.length > 0 && (
              <div className="shrink-0" style={{ borderTop: "1px solid var(--border)", background: "var(--card)", padding: sidebarWidth === "narrow" ? "12px 16px" : "16px 24px" }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="shrink-0" style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500, whiteSpace: "nowrap" }}>
                    Subtotal ({pending.length} item{pending.length !== 1 ? "s" : ""})
                  </span>
                  <span className="shrink-0" style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-weight-semibold)", color: "var(--primary)", whiteSpace: "nowrap" }}>
                    {formatCurrency(subtotal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={guardedClose} icon={<X className="w-3.5 h-3.5" />}>
            Cancel <KbdHint keys="Esc" />
          </Button>
          <Button variant="primary" size="sm" onClick={handleAdd} disabled={pending.length === 0} icon={<Plus className="w-3.5 h-3.5" />}>
            Add {pending.length} Items to Order <KbdHint keys="&#8984;&#9166;" variant="light" />
          </Button>
        </div>

        {configPendingId && (() => {
          const selectedPending = pending.find((item) => item.instanceId === configPendingId);
          if (!selectedPending) return null;

          return (
            <AdvancedConfiguratorModal
              line={{
                id: selectedPending.instanceId,
                itemCode: selectedPending.item.code,
                itemName: selectedPending.item.name,
                itemType: selectedPending.item.type,
                warehouse: 'Main Warehouse',
                orderedQty: selectedPending.qty,
                allocatedQty: 0,
                pickedQty: 0,
                shippedQty: 0,
                deliveredQty: 0,
                unitPrice: selectedPending.item.unitPrice,
                taxRate: 0,
                allocations: [],
                cancelled: false,
                cancelledQty: 0,
                readyToPick: false,
              }}
              inventory={store.inventory}
              onClose={() => setConfigPendingId(null)}
              onSave={({ orderedQty, unitPrice }) => {
                setPending(prev => prev.map((item) => item.instanceId === configPendingId
                  ? { ...item, qty: orderedQty, item: { ...item.item, unitPrice } }
                  : item));
                setConfigPendingId(null);
              }}
              onDelete={() => {
                removePending(configPendingId);
                setConfigPendingId(null);
              }}
            />
          );
        })()}
      </div>
      {/* Item peek modal — rendered last so it stacks above the dialog. */}
      {itemQuickViewModal}
    </div>
  );
}