// @ts-nocheck
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, Trash2, Search, Check, Package, Pencil, Info, ChevronDown, ChevronsDown, ChevronsUp, LayoutList, Grid2x2, AlertCircle, Users, Lightbulb, Armchair, Laptop, Wrench, Box, Layers, Copy } from 'lucide-react';

/* Bug B1: file-scoped quantity stepper.
   The old <input value={qty} onChange={clamp}> fought with typing —
   backspace collapsed the field to 1, fresh typing concatenated onto
   the existing value, and there was no − or visible + control. Local
   string draft state lets the field behave like a normal text input
   while typing; we clamp to min=1 only when the user blurs or presses
   Enter. Adjacent − / + buttons drive `onChange(delta)` so the value
   updates in unit steps as well. */
/* Local QtyStepper — see ProductPickerModal for the matching impl.
   Buttons resolve the IN-FLIGHT draft when stepping (so typing "5"
   then clicking + lands on 6) and use mousedown.preventDefault to
   stop the input's blur from racing the click and swallowing the
   step. Both fixes were needed for the right-side selected card. */
function QtyStepper({ value, onChange, min = 1, max, ariaLabel = 'Quantity' }: {
  value: number; onChange: (next: number) => void; min?: number; max?: number; ariaLabel?: string;
}) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : min;
  const [draft, setDraft] = useState(String(safeValue));
  useEffect(() => { setDraft(String(safeValue)); }, [safeValue]);
  const resolveBase = (): number => {
    const parsed = parseInt(draft, 10);
    return Number.isFinite(parsed) ? parsed : safeValue;
  };
  const clamp = (n: number): number => {
    if (typeof max === 'number' && n > max) n = max;
    if (n < min) n = min;
    return n;
  };
  const commit = () => {
    const next = clamp(resolveBase());
    setDraft(String(next));
    if (next !== safeValue) onChange(next);
  };
  const step = (delta: number) => {
    const next = clamp(resolveBase() + delta);
    setDraft(String(next));
    if (next !== safeValue) onChange(next);
  };
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      style={{ display: 'inline-flex', alignItems: 'center', height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'white', overflow: 'hidden' }}
    >
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { e.stopPropagation(); step(-1); }}
        disabled={safeValue <= min}
        aria-label="Decrease quantity"
        className="flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ width: 28, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
      >
        <Minus className="w-3 h-3 text-slate-500" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          // Accept only digits while typing; allow empty so users can
          // clear and retype freely. Final clamp lives in commit().
          const v = e.target.value.replace(/[^0-9]/g, '');
          setDraft(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setDraft(String(safeValue)); (e.target as HTMLInputElement).blur(); }
        }}
        style={{
          width: 44, height: '100%', border: 'none', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
          textAlign: 'center', fontSize: 13, color: 'var(--foreground)', background: 'transparent', outline: 'none', padding: 0,
        }}
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { e.stopPropagation(); step(+1); }}
        disabled={typeof max === 'number' && safeValue >= max}
        aria-label="Increase quantity"
        className="flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ width: 28, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
      >
        <Plus className="w-3 h-3 text-slate-500" />
      </button>
    </div>
  );
}
import { toast } from 'sonner';
import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { useItemQuickView, type ItemQuickViewItem } from '@/app/components/shared/ItemQuickView';
import { LineItemConfigModal } from '@/app/components/quote-creation/LineItemConfigModal';
import { HighlightText } from '@/app/components/HighlightText';
import { PRODUCTS } from '@/app/data/products';
import { FilterButton, ActiveFilterTags, applyAdvancedFilters, EMPTY_FILTERS, type AdvancedFilters } from '@/app/components/quote-details/ProductPickerModal';
import { InventoryTooltip } from '@/app/components/InventoryTooltip';
import { ItemTypeBadge, itemTypeLabel } from '@/app/components/shared/ItemTypeBadge';
import { isItemInactive } from '@/app/components/shared/inactiveItems';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';

interface Step3LineItemsProps {
  quoteDraft: QuoteDraft;
  onUpdate: (updates: Partial<QuoteDraft>) => void;
}

/* UoM data layer — every consumer (capsule, table, dialog) imports
   from `../../data/uomSets`. The legacy `UNITS_OF_MEASURE` export is
   kept as an alias for the discrete set so any unconverted call site
   keeps working until it's switched to per-product lookups. */
import {
  UOM_SETS,
  type UomOption as ImportedUomOption,
  type UomSetId,
  getUomSetForProduct,
  getPrimaryUomForProduct,
  findUomById,
  multiplierWithinSet,
} from '../../data/uomSets';
const UNITS_OF_MEASURE = UOM_SETS.discrete;
type UomOption = ImportedUomOption;

/* Combined Qty + UoM capsule — mirrors the chrome of the line items
   table's QtyUomCapsule (SOLineGrid pattern). One bordered chip with
   a typeable qty on the left, a vertical hairline divider, and a UoM
   dropdown trigger on the right so the two controls read as a single
   capsule rather than two separate widgets. Used on the right-side
   selected-items card. The chosen UoM rescales the unit price
   upstream (see handleUomChange) so the configurator and the final
   line item see the same value. */
function QtyUomCapsule({
  qty,
  uom,
  onChangeQty,
  onChangeUom,
  /* When the parent flags this capsule as just-bumped, we add the
     `qty-bump-capsule` class which fires a 1.1 s green-ring flash on
     the bordered chip itself so the user sees which box changed. */
  bumped = false,
  /* Per-product UoM list + primary id. When omitted the capsule falls
     back to the discrete set (EA/Box/Carton/Pallet) for backwards-
     compatibility with any older call site. The primary id drives the
     "Primary" pill rendered next to one option in the dropdown. */
  uomSet = UNITS_OF_MEASURE,
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
  /* Viewport-space coordinates for the dropdown panel. We portal the
     panel to document.body so the right-side card's overflow can't
     clip the first character of the option labels (as it did when the
     panel was rendered inline). */
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
  /* Look the current uom up in the product's set first; if the seeded
     value points outside the set (stale data, set was edited, etc.),
     fall back to the set's primary so the capsule never renders an
     empty label. */
  const current = uomSet.find(u => u.id === (uom || primaryUomId).toLowerCase() || u.name.toLowerCase() === (uom || '').toLowerCase()) || uomSet[0];
  return (
    <div
      ref={wrapRef}
      key={bumped ? `bump-${qty}` : 'rest'}
      className={`relative inline-flex items-stretch ${bumped ? 'qty-bump-capsule' : ''}`}
      style={{ height: 32, borderRadius: 6, border: `1px solid ${editing || open ? '#3B82F6' : 'var(--border)'}`, backgroundColor: '#FFFFFF', overflow: 'visible', boxShadow: editing ? '0 0 0 2px rgba(59,130,246,0.10)' : 'none', transition: 'border-color 100ms, box-shadow 100ms' }}
    >
      {/* LEFT — qty input/display (64 px wide so layout stays stable
          between read and edit modes). */}
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
      {/* Hairline divider between qty + uom — same recipe as the line
          items table's QtyUomCapsule. */}
      <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, alignSelf: 'stretch' }} />
      {/* RIGHT — UoM dropdown trigger. */}
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
            with an ellipsis — the dropdown panel still shows the full
            name + units description for unambiguous selection. */}
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
                    {/* Partner Management's "Primary" pill — small
                        accent-tinted chip that surfaces the item's
                        preferred UoM at a glance. */}
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

// Helper function to generate Item ID from item.id in xxx-xxx-xxx format
const generateItemId = (itemId: string): string => {
  const numericPart = itemId.replace(/\D/g, '');
  const last9 = numericPart.slice(-9).padStart(9, '0');
  return `${last9.slice(0, 3)}-${last9.slice(3, 6)}-${last9.slice(6)}`;
};

export function Step3LineItems({ quoteDraft, onUpdate }: Step3LineItemsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedItemForConfig, setSelectedItemForConfig] = useState<any>(null);
  const [uomDropdownOpen, setUomDropdownOpen] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [expandedProductDescriptions, setExpandedProductDescriptions] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState<'narrow' | 'wide'>('narrow'); // narrow=440px, wide=mostly right with grid
  const [stockAlert, setStockAlert] = useState<{ message: string; productId: string } | null>(null);
  const [showQuickTips, setShowQuickTips] = useState(true);
  const [quickTipsDismissed, setQuickTipsDismissed] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [qtyBumpIds, setQtyBumpIds] = useState<Set<string>>(new Set());
  const [pendingDuplicateItemId, setPendingDuplicateItemId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyBumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  /* Search is tolerant of dashes/spaces — a user typing "000-100",
     "000100", or "100-" all map to the same matches. We test each
     field both as-is and with non-alphanumerics stripped, so the
     dash-separated item codes ("000-100-001") and dashless input
     both produce hits. The id field was missing from the old
     predicate, which is why users searching "000-100" got nothing. */
  const displayProducts = useMemo(() => {
    const raw = searchQuery.trim().toLowerCase();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const qNorm = normalize(searchQuery);
    const matches = (text: string | undefined) => {
      if (!text) return false;
      const t = text.toLowerCase();
      if (t.includes(raw)) return true;
      return qNorm.length > 0 && normalize(text).includes(qNorm);
    };
    /* Creation never offers an inactive item: it can't start a new line,
       so it isn't shown at all rather than shown and refused. The edit
       picker is different; there an item can go inactive after it was
       added, so it keeps the pill. Filtered before the search and before
       the 12-item cap so "Recently Ordered" still fills. */
    const catalog = PRODUCTS.filter((product) => !isItemInactive(product.id));
    const base = raw
      ? catalog.filter((product) =>
          matches(product.id) ||
          matches(product.name) ||
          matches(product.description) ||
          matches(product.category),
        )
      /* No-search "Recently Ordered" is capped at 12 so the cross-set
         variety (liquid + length items beyond the discrete majority)
         is visible without searching. The full catalogue is still
         reachable via search. */
      : catalog.filter(product => product.isRecentlyOrdered).slice(0, 12);
    return applyAdvancedFilters(base, advancedFilters);
  }, [searchQuery, advancedFilters]);

  const isProductAdded = (productId: string) => {
    return quoteDraft.lineItems.some((item) => item.productId === productId);
  };

  // Calculate total quantity of a product across all line items
  const getTotalQuantityForProduct = (productId: string): number => {
    return quoteDraft.lineItems
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Get count of distinct line items for a product
  const getLineItemCountForProduct = (productId: string): number => {
    return quoteDraft.lineItems.filter((item) => item.productId === productId).length;
  };

  // Get all item numbers for a product (to show on left side)
  const getItemNumbersForProduct = (productId: string): number[] => {
    const numbers: number[] = [];
    quoteDraft.lineItems.forEach((item, index) => {
      if (item.productId === productId) {
        numbers.push(index + 1);
      }
    });
    return numbers;
  };

  // Get remaining stock for a product
  const getRemainingStock = (productId: string): number => {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return 0;
    const totalUsed = getTotalQuantityForProduct(productId);
    return product.stockQuantity - totalUsed;
  };

  const handleAddProduct = (product: typeof PRODUCTS[0]) => {
    if (isItemInactive(product.id)) return;
    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    /* Seed the new line with the product's primary UoM so the capsule
       opens on the right unit immediately. Past code hardcoded 'EA'
       which broke once liquid/length products were introduced. */
    const primaryUomId = getPrimaryUomForProduct(product);
    const primaryUom = findUomById(primaryUomId);
    const newItem = {
      id: newId,
      productId: product.id,
      name: product.name,
      description: product.description,
      quantity: 1,
      unitPrice: product.unitPrice,
      discount: 0,
      total: product.unitPrice,
      images: product.images,
      isSerialized: product.isSerialized,
      sourceType: product.sourceType,
      isLotControlled: product.isLotControlled,
      sku: product.sku,
      uom: primaryUom?.name || 'EA',
    };

    // Insert next to existing siblings of the same product, or append if new
    const existingItems = quoteDraft.lineItems;
    const lastIndex = existingItems.map(i => i.productId).lastIndexOf(product.id);
    const isDuplicate = lastIndex !== -1;

    if (isDuplicate) {
      const updatedItems = [...existingItems];
      updatedItems.splice(lastIndex + 1, 0, newItem);
      onUpdate({ lineItems: updatedItems });
      // Show duplicate toast
      toast.custom((tid) => (
        <div
          onClick={() => toast.dismiss(tid)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '8px',
            backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
            fontFamily: 'Inter, system-ui, sans-serif',
            width: '320px', cursor: 'pointer',
          }}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px',
            backgroundColor: 'var(--accent)', border: '1px solid #DDD6FE',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Layers style={{ width: '14px', height: '14px', color: '#7C3AED' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2 }}>
              Duplicate of {product.name} added
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px', lineHeight: 1.3 }}>
              Item already exists — added as a separate line
            </div>
          </div>
        </div>
      ), { position: 'top-right', duration: 3000 });
    } else {
      onUpdate({ lineItems: [...existingItems, newItem] });
    }

    // Fresh line adds only fire the newly-added flash. Stacking a
    // qty-bump on the same element causes the two class timers to
    // clear at different moments, which reads as an all-cards
    // re-flash mid-animation.
    setNewlyAddedIds(prev => new Set([...prev, newId]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 4500);
    // Scroll after DOM updates
    setTimeout(() => {
      const el = cardRefsMap.current.get(newId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // New function to add quantity to an existing item
  const handleAddQuantityToExisting = (product: typeof PRODUCTS[0]) => {
    if (isItemInactive(product.id)) return;
    // Find the first item with this product
    const existingItem = quoteDraft.lineItems.find(item => item.productId === product.id);
    if (!existingItem) return;

    // Increment its quantity
    const updatedItems = quoteDraft.lineItems.map(item =>
      item.id === existingItem.id
        ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
        : item
    );
    onUpdate({ lineItems: updatedItems });

    // Existing line increment — qty-bump only. Not a fresh add.
    setQtyBumpIds(prev => new Set([...prev, existingItem.id]));
    if (qtyBumpTimerRef.current) clearTimeout(qtyBumpTimerRef.current);
    qtyBumpTimerRef.current = setTimeout(() => setQtyBumpIds(new Set()), 3500);

    // Scroll to it
    setTimeout(() => {
      const el = cardRefsMap.current.get(existingItem.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  /* Mirror of handleAddQuantityToExisting — subtracts one unit from
     the matched existing line. Floored at qty 1 since the card flips
     into the empty `Add` state when the line drops out of the quote
     entirely, and the -1 EA button is only rendered when the
     existing qty is greater than 1. */
  const handleSubtractQuantityFromExisting = (product: typeof PRODUCTS[0]) => {
    const existingItem = quoteDraft.lineItems.find(item => item.productId === product.id);
    if (!existingItem || existingItem.quantity <= 1) return;
    const updatedItems = quoteDraft.lineItems.map(item =>
      item.id === existingItem.id
        ? { ...item, quantity: item.quantity - 1, total: (item.quantity - 1) * item.unitPrice }
        : item
    );
    onUpdate({ lineItems: updatedItems });

    setQtyBumpIds(prev => new Set([...prev, existingItem.id]));
    if (qtyBumpTimerRef.current) clearTimeout(qtyBumpTimerRef.current);
    qtyBumpTimerRef.current = setTimeout(() => setQtyBumpIds(new Set()), 3500);
  };

  const handleRemoveItem = (itemId: string) => {
    onUpdate({
      lineItems: quoteDraft.lineItems.filter((item) => item.id !== itemId),
    });
  };

  // Duplicate a specific line item as a new separate line
  const handleDuplicateItem = (itemId: string) => {
    const sourceItem = quoteDraft.lineItems.find(i => i.id === itemId);
    if (!sourceItem) return;

    const product = PRODUCTS.find(p => p.id === sourceItem.productId);
    if (!product) return;

    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newItem = {
      ...sourceItem,
      id: newId,
      quantity: 1,
      total: sourceItem.unitPrice * (1 - (sourceItem.discount || 0) / 100),
    };

    // Insert right after the source item
    const sourceIndex = quoteDraft.lineItems.findIndex(i => i.id === itemId);
    const updatedItems = [...quoteDraft.lineItems];
    updatedItems.splice(sourceIndex + 1, 0, newItem);
    onUpdate({ lineItems: updatedItems });

    // Toast
    toast.custom((tid) => (
      <div
        onClick={() => toast.dismiss(tid)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', borderRadius: '8px',
          backgroundColor: '#FFFFFF', border: '1px solid var(--border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
          fontFamily: 'Inter, system-ui, sans-serif',
          width: '320px', cursor: 'pointer',
        }}
      >
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px',
          backgroundColor: 'var(--accent)', border: '1px solid #DDD6FE',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Layers style={{ width: '14px', height: '14px', color: '#7C3AED' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2 }}>
            Line item duplicated
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px', lineHeight: 1.3 }}>
            {product.name} — added as a separate line
          </div>
        </div>
      </div>
    ), { position: 'top-right', duration: 3000 });

    // Highlight & scroll
    setNewlyAddedIds(prev => new Set([...prev, newId]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 4500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(newId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleRemoveAll = () => {
    onUpdate({
      lineItems: [],
    });
  };

  /* Multiplier table mirroring the catalog UoM definitions. Used to
     rescale unit price when the user swaps UoM on the right-side card
     so the line total stays consistent with the underlying item cost
     (e.g. $10/EA × 12 EA per Box → $120/Box). */
  /* UoM change on a selected-items card. Rescales the unit price by
     the conversion factor (newMult / oldMult) so the price the user
     sees in the configurator and the final line item stays in sync
     with the UoM choice. Total recomputes from the rescaled price.
     Multipliers are resolved within the product's own set — a Liter
     and a Box never interconvert. */
  const handleUomChange = (itemId: string, newUomId: string) => {
    const item = quoteDraft.lineItems.find(i => i.id === itemId);
    if (!item) return;
    const product = PRODUCTS.find(p => p.id === item.productId);
    const itemSet = product ? getUomSetForProduct(product) : UNITS_OF_MEASURE;
    const oldMult = multiplierWithinSet(item.uom, itemSet);
    const newMult = multiplierWithinSet(newUomId, itemSet);
    if (oldMult === newMult) {
      onUpdate({ lineItems: quoteDraft.lineItems.map(li => li.id === itemId ? { ...li, uom: newUomId } : li) });
      return;
    }
    const scaledUnitPrice = (item.unitPrice * newMult) / oldMult;
    onUpdate({
      lineItems: quoteDraft.lineItems.map(li =>
        li.id === itemId
          ? { ...li, uom: newUomId, unitPrice: scaledUnitPrice, total: scaledUnitPrice * li.quantity * (1 - (li.discount || 0) / 100) }
          : li
      ),
    });
  };

  const handleUpdateQuantity = (itemId: string, change: number) => {
    const item = quoteDraft.lineItems.find(i => i.id === itemId);
    if (!item) return;

    const newQty = Math.max(1, item.quantity + change);

    onUpdate({
      lineItems: quoteDraft.lineItems.map((lineItem) => {
        if (lineItem.id === itemId) {
          return {
            ...lineItem,
            quantity: newQty,
            total: newQty * lineItem.unitPrice * (1 - lineItem.discount / 100),
          };
        }
        return lineItem;
      }),
    });
  };

  const handleOpenConfig = (item: any) => {
    const product = PRODUCTS.find(p => p.id === item.productId);
    setSelectedItemForConfig({
      ...item,
      sku: product?.sku,
    });
    setConfigModalOpen(true);
  };

  const handleSaveConfig = (updatedItem: any) => {
    onUpdate({
      lineItems: quoteDraft.lineItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    });
  };

  /* Item peek modal — opens when the user taps any catalog or
     selected-card thumbnail. Same chrome as the details surfaces. */
  const { open: openItemQuickView, modal: itemQuickViewModal } = useItemQuickView();
  const previewProduct = (product: any) => {
    const peek: ItemQuickViewItem = {
      code: product.id,
      description: product.description,
      images: product.images?.length ? product.images : undefined,
      primaryTag: (() => {
        const ser = !!product.isSerialized;
        const lot = !!product.isLotControlled;
        if (lot && ser) return 'Primary: Lot Serialized';
        if (lot && !ser) return 'Primary: Lot Non-Serialized';
        if (ser) return 'Primary: Serialized';
        return 'Primary: Non-Serialized';
      })(),
      material: product.category,
      uom: findUomById(getPrimaryUomForProduct(product))?.name || 'EA',
      onHand: product.stockQuantity,
      metrics: [
        { label: 'Unit Price', value: formatCurrencyImmediate(product.unitPrice), caption: 'Unit Price' },
        ...(typeof product.stockQuantity === 'number'
          ? [{ label: 'In Stock', value: `${product.stockQuantity.toLocaleString()} ${findUomById(getPrimaryUomForProduct(product))?.name || 'EA'}`, caption: 'In Stock' }]
          : []),
      ],
    };
    openItemQuickView(peek);
  };
  const formatCurrencyImmediate = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const subtotal = quoteDraft.lineItems.reduce((sum, item) => sum + item.total, 0);

  // Sequential numbering: 1, 2, 3, 4, 5... with duplicate tracking
  const getItemMeta = () => {
    const numbers: { [itemId: string]: string } = {};
    const originalItemNumbers: { [itemId: string]: number | null } = {};
    const firstOccurrence: { [productId: string]: number } = {};

    quoteDraft.lineItems.forEach((item, index) => {
      const lineNum = index + 1;
      numbers[item.id] = `${lineNum}`;

      if (!(item.productId in firstOccurrence)) {
        firstOccurrence[item.productId] = lineNum;
        originalItemNumbers[item.id] = null;
      } else {
        originalItemNumbers[item.id] = firstOccurrence[item.productId];
      }
    });
    return { numbers, originalItemNumbers };
  };

  const { numbers: itemNumbers, originalItemNumbers } = getItemMeta();

  // Calculate sidebar styles based on width setting
  const sidebarStyle: React.CSSProperties =
    sidebarWidth === 'narrow'
      ? { width: '440px', flexGrow: 0, flexShrink: 0, transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1)' }
      : { width: '70%', flexGrow: 0, flexShrink: 0, transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1)' };

  const leftSideClass =
    sidebarWidth === 'wide' ? '' : 'flex-1';
  
  // Helper function to get category icon
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('furniture')) return Armchair;
    if (cat.includes('technology') || cat.includes('laptop')) return Laptop;
    if (cat.includes('equipment') || cat.includes('tool')) return Wrench;
    return Box;
  };

  // Show empty state if no customer or POC selected
  if (!quoteDraft.customer || !quoteDraft.primaryPoC) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/40">
        <div className="text-center max-w-md px-8">
          {/* Icon */}
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>

          {/* Title */}
          <h3 className="text-[14px] text-foreground mb-2" style={{ fontWeight: 600 }}>
            Select a Customer First
          </h3>

          {/* Description */}
          <p className="text-[13px] text-muted-foreground">
            Before adding items to your quote, please select a customer and primary contact.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Card highlight animations — both states use green so adding a
          new line and bumping its quantity read as the same family of
          feedback. Newly-added carries a 1.5 px green ring + soft
          green halo + a subtle pulse so the card "lands" on the
          right; qty-bump fires the same ring shorter so a quantity
          change is unmistakable. The QtyUomCapsule itself picks up an
          inner green flash via .qty-bump-capsule so the user always
          sees the exact box that changed. */}
      <style>{`
        @keyframes newCardHighlight {
          0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.20); background-color: rgba(254, 249, 195, 0.55); border-color: rgba(5, 150, 105, 0.65); transform: scale(1.012); }
          15%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.20); background-color: rgba(254, 249, 195, 0.55); border-color: rgba(5, 150, 105, 0.65); transform: scale(1); }
          35%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.20); background-color: #FFFFFF; border-color: rgba(5, 150, 105, 0.65); transform: scale(1); }
          80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.20); background-color: #FFFFFF; border-color: rgba(5, 150, 105, 0.65); transform: scale(1); }
          100% { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); background-color: #FFFFFF; border-color: var(--border); transform: scale(1); }
        }
        .newly-added-card { animation: newCardHighlight 4000ms linear forwards; }

        @keyframes qtyBumpPulse {
          0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: rgba(254, 249, 195, 0.50); border-color: rgba(5, 150, 105, 0.65); }
          30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: #FFFFFF; border-color: rgba(5, 150, 105, 0.65); }
          80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: #FFFFFF; border-color: rgba(5, 150, 105, 0.65); }
          100% { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); background-color: #FFFFFF; border-color: var(--border); }
        }
        .qty-bump-card { animation: qtyBumpPulse 2600ms linear forwards; }

        @keyframes qtyCapsuleFlash {
          0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: rgba(254, 249, 195, 0.60); }
          30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: #FFFFFF; }
          80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: #FFFFFF; }
          100% { box-shadow: none; border-color: var(--border); background-color: #FFFFFF; }
        }
        .qty-bump-capsule { animation: qtyCapsuleFlash 2400ms linear forwards; }
      `}</style>
      {/* Left: Product Catalog */}
      <div className={`flex flex-col overflow-hidden px-8 py-6 border-r border-border ${leftSideClass}`} style={sidebarWidth === 'wide' ? { width: '30%', flexGrow: 0, flexShrink: 0, transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1), flex 350ms cubic-bezier(0.4, 0, 0.2, 1)' } : { transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1), flex 350ms cubic-bezier(0.4, 0, 0.2, 1)' }} >
        {/* Title and Description */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[20px] text-foreground" style={{ fontWeight: 600 }}>
              Add Line Items
            </h2>
            <div className="flex items-center border border-border bg-white overflow-hidden" style={{ borderRadius: '6px', height: '28px' }}>
              <button
                onClick={() => setSidebarWidth('narrow')}
                className={`w-8 h-7 flex items-center justify-center transition-colors border-r border-border ${
                  sidebarWidth === 'narrow' 
                    ? 'bg-accent text-primary' 
                    : 'text-muted-foreground hover:bg-[#F0F7FF]'
                }`}
                title="List view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSidebarWidth('wide')}
                className={`w-8 h-7 flex items-center justify-center transition-colors ${
                  sidebarWidth === 'wide' 
                    ? 'bg-accent text-primary' 
                    : 'text-muted-foreground hover:bg-[#F0F7FF]'
                }`}
                title="Grid view"
              >
                <Grid2x2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground mb-4">
            Add products from the catalog and configure quantities, discounts, and advanced settings for each line item.{' '}
            <a 
              href="#" 
              className="text-primary hover:text-primary transition-colors inline-flex items-center gap-1"
              style={{ fontWeight: 500 }}
              onClick={(e) => e.preventDefault()}
            >
              Learn more
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
                <path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </p>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full h-9 pl-10 pr-3 text-[13px] border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                style={{ borderRadius: '6px' }}
              />
            </div>
            <FilterButton filters={advancedFilters} setFilters={setAdvancedFilters} filteredCount={displayProducts.length} />
          </div>
          <ActiveFilterTags filters={advancedFilters} setFilters={setAdvancedFilters} />
        </div>

        <div
          className="text-[11px] text-muted-foreground uppercase tracking-wide mb-3"
          style={{ fontWeight: 500, letterSpacing: '0.5px' }}
        >
          {searchQuery.trim() ? <>Search Results <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '16px', padding: '0 5px', backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: '4px', fontSize: '11px', fontWeight: 600, lineHeight: '1', verticalAlign: 'middle', marginLeft: '4px' }}>{displayProducts.length}</span></> : 'Recently Ordered'}
        </div>

        {displayProducts.length === 0 && searchQuery.trim() && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-[13px] text-muted-foreground mb-1">No products found</p>
            <p className="text-[12px] text-muted-foreground">Try a different search term</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-8">
          <div className="px-8 space-y-3 pb-3">
          {displayProducts.map((product) => {
            const added = isProductAdded(product.id);
            const addedQuantity = getTotalQuantityForProduct(product.id);
            const addedLineItemCount = getLineItemCountForProduct(product.id);
            const remainingStock = getRemainingStock(product.id);
            const outOfStock = product.stockQuantity === 0 || remainingStock <= 0;
            const itemNumbers = getItemNumbersForProduct(product.id);
            /* When the product already has a line on the quote, the
               +/− buttons should add/remove in THAT line's unit (Box,
               Pallet, etc.) — not the product's catalog-default
               primary. Falls back to primary when the product hasn't
               been added yet. */
            const existingLine = quoteDraft.lineItems.find(li => li.productId === product.id);
            const buttonUomName = existingLine?.uom || findUomById(getPrimaryUomForProduct(product))?.name || 'EA';
            /* Blue summary pill reads the UoM across ALL existing
               lines for this product. When every line shares the
               same unit (e.g. two 4-Box lines → "8 Box · 2 lines")
               surface that unit; when lines differ (one Box, one
               Pallet) collapse to a neutral "units" label so the
               pill doesn't mislabel mixed-UoM totals. */
            const allLinesForProduct = quoteDraft.lineItems.filter(li => li.productId === product.id);
            const uniqueLineUoms = new Set(allLinesForProduct.map(li => (li.uom || '').toLowerCase()).filter(Boolean));
            const pillUomName = uniqueLineUoms.size > 1
              ? 'units'
              : (allLinesForProduct[0]?.uom || findUomById(getPrimaryUomForProduct(product))?.name || 'EA');

            return (
              <div
                key={product.id}
                onClick={() => {
                  if (added) {
                    handleAddQuantityToExisting(product);
                  } else {
                    handleAddProduct(product);
                  }
                }}
                className={`w-full border transition-all relative group cursor-pointer ${
                  added
                    ? 'border-success'
                    : 'border-border hover:border-primary'
                }`}
                style={{
                  borderRadius: '6px',
                  backgroundColor: added ? '#F0FDF4' : '#FFFFFF',
                  // Resting + hover shadow that matches the other three
                  // pickers (Quote details, SO creation, SO details).
                  // Same `0 1px 2px rgba(15, 23, 42, 0.04)` Partner spec.
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                  transition: 'background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                }}
                onMouseEnter={e => { if (!added) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.04)'; }}
              >
                {/* Item numbers badge moved inline to Row 3 */}
              
                {/* Compact responsive layout mirrors SO's CreateSOStep2:
                    in 'wide' mode the left rail shrinks to ~30% of the
                    modal, so the thumbnail drops to 32px, padding /
                    gaps tighten, and the row-1 type pill + row-3
                    category pill collapse. Narrow mode keeps the full
                    Partner-style chrome. Same density both modules. */}
                <div className={`flex items-start ${sidebarWidth === 'wide' ? 'gap-2 p-2.5' : 'gap-3 p-3'}`}>
                  {/* Square thumbnail (8px) — clicking opens the
                      canonical ItemQuickView peek so the user can see
                      the item record without leaving the wizard. */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); previewProduct(product); }}
                      title="Preview item"
                      aria-label={`Preview ${product.id}`}
                      className={`block ${sidebarWidth === 'wide' ? 'w-8 h-8' : 'w-10 h-10'} overflow-hidden cursor-pointer transition-colors`}
                      style={{ borderRadius: 8, border: '1px solid var(--border)', padding: 0, background: 'transparent' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                    >
                      <ImageWithFallback
                        src={product.images[0]}
                        alt={product.description}
                        className={`${sidebarWidth === 'wide' ? 'w-8 h-8' : 'w-10 h-10'} object-cover`}
                        style={{ borderRadius: 8 }}
                      />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Row 1: SKU bold + type pill (narrow only) + price */}
                    <div className="flex items-center justify-between gap-3 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600, lineHeight: '1' }}>
                          <HighlightText text={product.id} searchTerm={searchQuery} />
                        </span>
                        {sidebarWidth === 'narrow' && (
                          <ItemTypeBadge type={itemTypeLabel(product.isSerialized, product.isLotControlled)} />
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          {formatCurrency(product.unitPrice)}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-1" style={{ fontWeight: 400 }}>/ {findUomById(getPrimaryUomForProduct(product))?.name || 'EA'}</span>
                      </div>
                    </div>

                    {/* Row 2: Description with more/less. Tighter bottom
                        margin in wide mode for the compacted layout. */}
                    <div
                      className={`text-[12px] text-muted-foreground ${sidebarWidth === 'wide' ? 'mb-1' : 'mb-2'}`}
                      style={{ fontWeight: 400, lineHeight: '1.5' }}
                    >
                      {expandedProductDescriptions.has(product.id) ? (
                        <>
                          <HighlightText text={product.description} searchTerm={searchQuery} />{' '}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              const newExpanded = new Set(expandedProductDescriptions);
                              newExpanded.delete(product.id);
                              setExpandedProductDescriptions(newExpanded);
                            }}
                            className="text-primary hover:text-primary transition-colors inline-flex items-center gap-0.5 whitespace-nowrap text-[12px] cursor-pointer"
                            style={{ fontWeight: 500 }}
                          >
                            less <ChevronsUp className="w-3 h-3 inline" />
                          </span>
                        </>
                      ) : (
                        <>
                          {product.description.length > 80 ? (
                            <>
                              <HighlightText text={product.description.slice(0, 80) + '…'} searchTerm={searchQuery} />{' '}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newExpanded = new Set(expandedProductDescriptions);
                                  newExpanded.add(product.id);
                                  setExpandedProductDescriptions(newExpanded);
                                }}
                                className="text-primary hover:text-primary transition-colors inline-flex items-center gap-0.5 whitespace-nowrap text-[12px] cursor-pointer"
                                style={{ fontWeight: 500 }}
                              >
                                more <ChevronsDown className="w-3 h-3 inline" />
                              </span>
                            </>
                          ) : (
                            <HighlightText text={product.description} searchTerm={searchQuery} />
                          )}
                        </>
                      )}
                    </div>

                    {/* Row 3: Category (narrow only) + Stock + Actions.
                        Pills follow Physical Inventory's tag spec — 13px
                        label, 2px/8px padding, 6px radius, `--secondary`
                        background, `--border` outline. Identical to
                        ControlTypeBadge so the row reads as one chip
                        family. */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sidebarWidth === 'narrow' && (
                          <span
                            className="inline-flex items-center border shrink-0"
                            style={{ padding: '2px 8px', borderRadius: 6, fontSize: 13, fontWeight: 500, lineHeight: 'normal', backgroundColor: 'var(--secondary)', color: 'var(--foreground)', borderColor: 'var(--border)' }}
                          >
                            {product.category}
                          </span>
                        )}
                        {remainingStock > 0 ? (
                          <InventoryTooltip stockQuantity={product.stockQuantity} remainingStock={remainingStock}>
                            <span
                              className="inline-flex items-center cursor-default"
                              style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: 13, fontWeight: 500, lineHeight: 'normal',
                                backgroundColor: remainingStock <= 5 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(5, 150, 105, 0.10)',
                                color: remainingStock <= 5 ? '#92400E' : 'var(--success)',
                                border: `1px solid ${remainingStock <= 5 ? '#FDE68A' : '#A7F3D0'}`,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {product.stockQuantity} ATP
                            </span>
                          </InventoryTooltip>
                        ) : (
                          <InventoryTooltip stockQuantity={product.stockQuantity} remainingStock={0}>
                            <span
                              className="inline-flex items-center cursor-default"
                              style={{ padding: '2px 8px', borderRadius: 6, fontSize: 13, fontWeight: 500, lineHeight: 'normal', backgroundColor: 'rgba(220, 38, 38, 0.10)', color: 'var(--destructive)', border: '1px solid rgba(220, 38, 38, 0.30)' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              0 ATP
                            </span>
                          </InventoryTooltip>
                        )}
                      </div>

                      {added && (
                        <div className="flex items-center gap-1.5">
                          {/* "X EA | N lines" stat pill — Partner chrome
                              (13px / weight 500 / 2px 8px / radius 6),
                              primary-blue tint so it reads on both the
                              white catalog card and the green `added`
                              variant. Same spec as the details pickers. */}
                          <span
                            className="inline-flex items-center"
                            style={{
                              gap: 6, padding: '2px 8px', borderRadius: 6,
                              fontSize: 13, fontWeight: 500, lineHeight: 'normal',
                              backgroundColor: '#EFF6FF', color: '#1D4ED8',
                              border: '1px solid #BFDBFE',
                            }}
                          >
                            <Check style={{ width: 12, height: 12 }} />
                            <span>{addedQuantity} {pillUomName}</span>
                            <span aria-hidden style={{ width: 1, height: 12, backgroundColor: 'rgba(29, 78, 216, 0.30)' }} />
                            <span>{addedLineItemCount === 1 ? '1 line' : `${addedLineItemCount} lines`}</span>
                          </span>
                          {/* -/+ buttons — when the product already
                              has a line on the quote we add/remove in
                              the line's existing UoM (Box / Carton /
                              Gallon / Foot, etc.) so the user can't
                              push a 4-Box line up by 1 EA. New rows
                              still seed at the product's primary. */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (addedQuantity > 1) handleSubtractQuantityFromExisting(product);
                            }}
                            disabled={addedQuantity <= 1}
                            className={`inline-flex items-center gap-1 transition-all ${addedQuantity <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-[0.97] cursor-pointer'}`}
                            style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, lineHeight: 1, backgroundColor: '#FFFFFF', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: addedQuantity <= 1 ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.08)' }}
                            title={addedQuantity <= 1 ? 'Remove the line with the Trash icon' : `Remove one ${buttonUomName}`}
                            aria-label={`Remove one ${buttonUomName}`}
                          >
                            <Minus className="w-3 h-3" />
                            1 {buttonUomName}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddQuantityToExisting(product);
                            }}
                            className="inline-flex items-center gap-1 bg-primary text-primary-foreground hover:bg-[#0862D0] hover:shadow-md active:scale-[0.97] transition-all cursor-pointer border border-primary"
                            style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, lineHeight: 1, boxShadow: '0 1px 2px rgba(10, 119, 255, 0.30)' }}
                            title={`Add another ${buttonUomName}`}
                          >
                            <Plus className="w-3 h-3" />
                            1 {buttonUomName}
                          </button>
                        </div>
                      )}

                      {!added && (
                        <span
                          className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity border border-primary/30"
                          style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, lineHeight: 1, backgroundColor: '#E7F3FF', color: 'var(--primary)' }}
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {stockAlert && stockAlert.productId === product.id && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="flex items-start gap-2 px-2.5 py-2 bg-destructive/10 border border-destructive/20 text-destructive" style={{ borderRadius: '4px' }}>
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="text-[11px]" style={{ fontWeight: 500, lineHeight: '1.4' }}>
                        {stockAlert.message}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Right: Selected Items Panel */}
      <div className="flex flex-col overflow-hidden bg-muted/40" style={sidebarStyle}>
        {quoteDraft.lineItems.length === 0 && !quickTipsDismissed && (
          <>
            <div className="px-6 pb-6 pt-4 flex-shrink-0 group">
              <div className="w-full flex items-center justify-between">
                <button
                  onClick={() => setShowQuickTips(!showQuickTips)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <Lightbulb className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <h4 className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors" style={{ fontWeight: 500 }}>
                    Quick Tips
                  </h4>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuickTipsDismissed(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 flex items-center justify-center"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowQuickTips(!showQuickTips)}
                    className="text-muted-foreground flex items-center justify-center"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuickTips ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {showQuickTips && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Click <span className="text-foreground" style={{ fontWeight: 500 }}>Advanced Configuration</span> to set pricing rules, shipment methods, and attachments
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Green borders indicate products already added to the quote
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Adjust quantities and discounts directly in the item card
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border"></div>
          </>
        )}

        <div className="px-6 py-4 flex-shrink-0 bg-muted/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase text-muted-foreground" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                Selected Items
              </span>
              {quoteDraft.lineItems.length > 0 && (
                <div 
                  className="inline-flex items-center gap-0 overflow-hidden" 
                  style={{ 
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  <span 
                    className="px-2 py-0.5 text-[11px] text-foreground" 
                    style={{ fontWeight: 600, backgroundColor: '#FFFFFF' }}
                  >
                    {quoteDraft.lineItems.length}
                  </span>
                </div>
              )}
            </div>
            {quoteDraft.lineItems.length > 0 && (
              <button
                onClick={() => setShowClearAllConfirm(true)}
                className="text-[12px] text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded transition-all border border-transparent hover:border-destructive/40"
                style={{ fontWeight: 500 }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Right panel uses a single muted/40 surface throughout —
            previously the list area was muted/50 and the header /
            footer muted/40, which read as a two-tone band. Partner v7
            keeps the side panel as one continuous gray. */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 bg-muted/40">
          {quoteDraft.lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-3">
                <Package className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">No items selected</p>
              <p className="text-[12px] text-muted-foreground mt-1">Add products from the catalog</p>
            </div>
          ) : (
            /* Two-column grid in wide mode keeps each card wide enough
               for the #N badge + pills + action icons to breathe.
               Three columns squeezed everything together. */
            <div className={sidebarWidth === 'narrow' ? 'space-y-3' : 'grid gap-3'} style={sidebarWidth === 'narrow' ? {} : { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {quoteDraft.lineItems.map((item) => {
                const isInDuplicateGroup = quoteDraft.lineItems.filter(i => i.productId === item.productId).length > 1;
                const origNum = originalItemNumbers[item.id];
                const isNewlyAdded = newlyAddedIds.has(item.id);
                const isQtyBumped = qtyBumpIds.has(item.id);
                return (
                <div
                  key={item.id}
                  ref={(el) => { if (el) cardRefsMap.current.set(item.id, el); else cardRefsMap.current.delete(item.id); }}
                  className={`border bg-white flex flex-col relative ${isNewlyAdded ? 'newly-added-card' : ''} ${isQtyBumped ? 'qty-bump-card' : ''}`}
                  style={{
                    /* Bumped padding: tighter cards left no room for
                       the #N badge to clear the SKU + pills and the
                       trash/dup icons to land cleanly in the corner.
                       16px all-around matches Partner v7's card chrome. */
                    padding: 14,
                    borderRadius: 10,
                    /* Resting tone — the .newly-added-card and
                       .qty-bump-card keyframes override these for the
                       duration of their animation so the card lands on
                       a strong green halo, then settles back here. */
                    borderColor: 'var(--border)',
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    transition: 'border-color 300ms ease, box-shadow 300ms ease',
                  }}
                >
                  {/* Item Number Badge - top-left corner */}
                  <div
                    className="absolute top-0 left-0 flex items-center justify-center text-[11px]"
                    style={{
                      /* 24px badge instead of 20px — easier to read at
                         a glance, and clears the SKU row by 32px. */
                      width: 24,
                      height: 24,
                      borderTopLeftRadius: 10,
                      borderBottomRightRadius: 10,
                      fontWeight: 700,
                      backgroundColor: 'var(--accent)',
                      color: 'var(--primary)',
                    }}
                  >
                    {itemNumbers[item.id]}
                  </div>

                  <div className="mb-2 flex-1">
                    <div className="flex items-start justify-between mb-1" style={{ paddingLeft: 32, gap: 8 }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          {item.productId}
                        </span>
                        {(() => {
                          const product = PRODUCTS.find(p => p.id === item.productId);
                          return <ItemTypeBadge type={itemTypeLabel(product?.isSerialized, product?.isLotControlled)} />;
                        })()}
                        {isInDuplicateGroup && origNum != null && (
                          /* Canonical Duplicate pill chrome — matches the rest
                             of the modules so every "Duplicate of #N" reads
                             identically (rounded-full, 11px / weight 500). */
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 500, color: '#7C3AED',
                            backgroundColor: '#FFFFFF', border: '1px solid #DDD6FE',
                            padding: '2px 10px', borderRadius: 9999, lineHeight: 1.4,
                            whiteSpace: 'nowrap',
                          }}>
                            <Layers style={{ width: 11, height: 11, flexShrink: 0 }} />
                            Duplicate of #{origNum}
                          </span>
                        )}
                      </div>
                      {/* Action icons get real hit-targets (28px square)
                          so they're easy to click on a touchpad. */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Copy + Trash hover treatment mirrors Purchase
                            Order's per-row pattern: muted at rest, tinted
                            text + tinted background on hover. The Copy
                            button previously used a violet `#7C3AED`
                            accent that diverged from the suite's primary
                            blue; switched to the primary token. */}
                        <button
                          onClick={() => setPendingDuplicateItemId(item.id)}
                          className="flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-150"
                          style={{ width: 28, height: 28, borderRadius: 6 }}
                          title="Duplicate as separate line item"
                          aria-label="Duplicate line item"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                          style={{ width: 28, height: 28, borderRadius: 6 }}
                          title="Remove from quote"
                          aria-label="Remove line item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {/* Thumb opens ItemQuickView peek. */}
                      <div className="flex-shrink-0">
                        {item.images && item.images.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); previewProduct({ id: item.productId, description: item.description, images: item.images, category: undefined, stockQuantity: undefined, unitPrice: item.unitPrice }); }}
                            title="Preview item"
                            aria-label={`Preview ${item.productId}`}
                            className="block w-9 h-9 overflow-hidden cursor-pointer transition-colors"
                            style={{ borderRadius: 8, border: '1px solid var(--border)', padding: 0, background: 'transparent' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                          >
                            <ImageWithFallback
                              src={item.images[0]}
                              alt={item.description}
                              className="w-9 h-9 object-cover flex-shrink-0"
                              style={{ borderRadius: 8 }}
                            />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="mb-1">
                          <div className="text-[12px] text-muted-foreground" style={{ fontWeight: 400, lineHeight: '1.5' }}>
                            {expandedDescriptions.has(item.id) ? (
                              <>
                                {item.description}{' '}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newExpanded = new Set(expandedDescriptions);
                                    newExpanded.delete(item.id);
                                    setExpandedDescriptions(newExpanded);
                                  }}
                                  className="text-primary hover:text-primary transition-colors inline-flex items-center gap-0.5 text-[12px]"
                                  style={{ fontWeight: 500 }}
                                >
                                  less <ChevronsUp className="w-3 h-3 inline" />
                                </button>
                              </>
                            ) : (
                              <>
                                {item.description.length > 80
                                  ? item.description.slice(0, 80) + '…'
                                  : item.description}
                                {item.description.length > 80 && (
                                  <>
                                    {' '}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const newExpanded = new Set(expandedDescriptions);
                                        newExpanded.add(item.id);
                                        setExpandedDescriptions(newExpanded);
                                      }}
                                      className="text-primary hover:text-primary transition-colors inline-flex items-center gap-0.5 whitespace-nowrap text-[12px]"
                                      style={{ fontWeight: 500 }}
                                    >
                                      more <ChevronsDown className="w-3 h-3 inline" />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-2 mt-auto">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label
                        className="text-[11px] text-muted-foreground"
                        style={{ fontWeight: 500 }}
                      >
                        Quantity
                      </label>
                      <label
                        className="text-[11px] text-muted-foreground"
                        style={{ fontWeight: 500 }}
                      >
                        Item Total
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Combined qty + uom capsule — same chrome as the
                          line items table's QtyUomCapsule so quantity
                          and unit live in one bordered chip. The −/+
                          twins on the left product-picker card own the
                          increment/decrement role now; qty here is a
                          direct typeable field. */}
                      {(() => {
                        /* Per-item UoM set + primary id, derived from
                           the product. Liquid/length products surface
                           Liter/Gallon/Drum or Foot/Yard/Roll; the
                           rest stay on the discrete EA/Box/Carton/
                           Pallet ladder. */
                        const product = PRODUCTS.find(p => p.id === item.productId);
                        const itemSet = product ? getUomSetForProduct(product) : UNITS_OF_MEASURE;
                        const itemPrimary = product ? getPrimaryUomForProduct(product) : 'ea';
                        const itemUomLabel = itemSet.find(u => u.id === (item.uom || itemPrimary).toLowerCase() || u.name.toLowerCase() === (item.uom || '').toLowerCase())?.name || itemSet[0].name;
                        return (
                          <>
                            <QtyUomCapsule
                              qty={item.quantity}
                              uom={item.uom || itemPrimary}
                              onChangeQty={(next) => handleUpdateQuantity(item.id, next - item.quantity)}
                              onChangeUom={(id) => handleUomChange(item.id, id)}
                              bumped={isQtyBumped}
                              uomSet={itemSet}
                              primaryUomId={itemPrimary}
                            />
                            <div className="flex-1 text-right min-w-0">
                              <div className={`${sidebarWidth === 'narrow' ? 'text-[13px]' : 'text-[16px]'} text-foreground truncate`} style={{ fontWeight: 600 }}>
                                {formatCurrency(item.total)}
                              </div>
                              {/* Selected unit label so the user always sees
                                  which unit the total is priced in. */}
                              <div className="text-[11px] text-muted-foreground truncate" style={{ fontWeight: 400 }}>
                                {itemUomLabel}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div>
                    {/* Partner-secondary button: 36px tall, white surface,
                        black label, resting 1px shadow + 8% slate border.
                        Hover elevates to a deeper shadow + primary tint.
                        Mirrors Partner v7's `Secondary` button so the
                        primary line-item action reads as a tappable
                        control, not as decorative text. */}
                    <button
                      onClick={() => handleOpenConfig(item)}
                      className="w-full flex items-center justify-center gap-2 text-[13px] text-foreground transition-all"
                      style={{
                        height: 36,
                        borderRadius: 6,
                        fontWeight: 500,
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.color = 'var(--primary)';
                        e.currentTarget.style.backgroundColor = '#F0F7FF';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(10, 119, 255, 0.12)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--foreground)';
                        e.currentTarget.style.backgroundColor = 'var(--card)';
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.06)';
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

        {quoteDraft.lineItems.length > 0 && (
          <div className="border-t border-border bg-muted/40 px-6 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">
                Subtotal
              </span>
              <span className="text-[20px] text-primary" style={{ fontWeight: 600 }}>
                {formatCurrency(subtotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mount the configurator only when actually open. Previously this
          stayed mounted (returning null) after close because we kept
          `selectedItemForConfig` truthy — that left the configurator's
          stateful subtree alive across opens and meant React had to
          reconcile a "render null" pass on close, which combined with
          the host wizard's transform-animated card produced the
          black-screen flash on dismiss. Tying the mount to
          `configModalOpen` + a real value gives us a clean
          mount/unmount cycle per open. */}
      {configModalOpen && selectedItemForConfig && (
        <LineItemConfigModal
          isOpen
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedItemForConfig(null);
          }}
          item={selectedItemForConfig}
          onSave={handleSaveConfig}
        />
      )}

      {stockAlert && (
        <div className="absolute top-4 right-4 px-4 py-2 bg-white border border-destructive/40 text-destructive rounded shadow-md" style={{ fontWeight: 500, fontSize: '13px' }}>
          {stockAlert.message}
        </div>
      )}

      {/* Duplicate Line Item Confirmation Modal */}
      <ConfirmationModal
        isOpen={pendingDuplicateItemId !== null}
        title="Duplicate Line Item"
        message={(() => {
          if (!pendingDuplicateItemId) return '';
          const item = quoteDraft.lineItems.find(i => i.id === pendingDuplicateItemId);
          if (!item) return '';
          const product = PRODUCTS.find(p => p.id === item.productId);
          const existingCount = quoteDraft.lineItems.filter(i => i.productId === item.productId).length;
          return `This will create a new separate line item for "${product?.name || item.productId}". There ${existingCount === 1 ? 'is already 1 line' : `are already ${existingCount} lines`} for this product. Each duplicate can have its own quantity and configuration.`;
        })()}
        confirmText="Yes, Duplicate"
        cancelText="Cancel"
        onConfirm={() => {
          if (pendingDuplicateItemId) {
            handleDuplicateItem(pendingDuplicateItemId);
          }
          setPendingDuplicateItemId(null);
        }}
        onCancel={() => setPendingDuplicateItemId(null)}
        variant="yellow"
        icon={<Copy className="w-6 h-6 text-white" />}
      />

      {/* Clear All Line Items Confirmation Modal */}
      <ConfirmationModal
        isOpen={showClearAllConfirm}
        title="Clear all line items?"
        message={`All ${quoteDraft.lineItems.length} item${quoteDraft.lineItems.length !== 1 ? 's' : ''} will be removed from this draft. You can add them back from the catalog.`}
        confirmText="Clear All"
        cancelText="Keep items"
        onConfirm={() => {
          handleRemoveAll();
          setShowClearAllConfirm(false);
        }}
        onCancel={() => setShowClearAllConfirm(false)}
        variant="red"
        icon={<Trash2 className="w-6 h-6 text-white" />}
      />
      {/* Item peek modal — rendered last so it stacks above everything. */}
      {itemQuickViewModal}
    </div>
  );
}