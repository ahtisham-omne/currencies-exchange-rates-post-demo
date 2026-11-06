import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Package, Check, Plus, Minus, Trash2, Pencil, ChevronDown, ChevronsDown, ChevronsUp, ChevronRight, SlidersHorizontal, LayoutList, Grid2x2, Lightbulb, Layers, Copy, Lock } from 'lucide-react';
import { PRODUCTS, type Product } from '../../data/products';
import {
  type UomOption,
  getUomSetForProduct,
  getPrimaryUomForProduct,
  findUomById,
  multiplierWithinSet,
} from '../../data/uomSets';
import { InventoryTooltip } from '../InventoryTooltip';
import { ConfirmationModal } from '../ConfirmationModal';
import { LotTrackingTag } from '../shared/LotTrackingTag';
import { ItemTypeBadge } from '../shared/ItemTypeBadge';
import { InactiveItemPill } from '../shared/InactiveItemPill';
import { isItemInactive } from '../shared/inactiveItems';
import { useItemQuickView, type ItemQuickViewItem } from '../shared/ItemQuickView';
import { LineItemConfigModal } from '../quote-creation/LineItemConfigModal';
import { HighlightText } from '../HighlightText';

/* Local QtyStepper — mirrors the one in Step3LineItems so the
   selected-items card in the details "Add Line Items" picker reads
   and behaves identically to the creation flow's selected-items
   card. Local string draft lets the user clear and retype without
   the field auto-collapsing to `min`; commit-on-blur clamps.

   Note on the +/- handlers: the buttons read the IN-FLIGHT `draft`
   string (falling back to `value`) instead of just `value`. The old
   implementation read `value` only, which meant when the user typed
   a new quantity in the input and then clicked +, the click was
   computed off the previous prop (e.g. 5 typed, click + → 2 not 6).
   On top of that the input's onBlur fires before the button's click
   in most browsers, so a race let the blur write `5` then the click
   write `2` — net effect "the + did nothing". preventDefault on
   mousedown stops the blur from racing the click. */
function QtyStepper({ value, onChange, min = 1, max, disabled = false, ariaLabel = 'Quantity' }: {
  value: number; onChange: (next: number) => void; min?: number; max?: number; disabled?: boolean; ariaLabel?: string;
}) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : min;
  const [draft, setDraft] = useState(String(safeValue));
  useEffect(() => { setDraft(String(safeValue)); }, [safeValue]);
  /* Resolve the current "effective" value: use the in-flight draft
     when it parses, otherwise fall back to the prop. Lets the user
     type "5" then click + and land on 6. */
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
      style={{ display: 'inline-flex', alignItems: 'center', height: 32, borderRadius: 6, border: '1px solid var(--border)', background: disabled ? 'var(--muted)' : 'white', overflow: 'hidden', opacity: disabled ? 0.6 : 1 }}
    >
      <button
        type="button"
        /* mousedown.preventDefault keeps the input from blurring out
           from under the click — without this the onBlur race
           described above can swallow the step. */
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { e.stopPropagation(); step(-1); }}
        disabled={disabled || safeValue <= min}
        aria-label="Decrease quantity"
        className="flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ width: 28, height: '100%', border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <Minus className="w-3 h-3 text-slate-500" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        onChange={(e) => {
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
        disabled={disabled || (typeof max === 'number' && safeValue >= max)}
        aria-label="Increase quantity"
        className="flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{ width: 28, height: '100%', border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <Plus className="w-3 h-3 text-slate-500" />
      </button>
    </div>
  );
}

/* Combined qty + UoM capsule — same chrome as Step3LineItems /
   CreateSOStep2 / AddLineItemDialog. Single bordered chip with the
   typeable qty on the left, a hairline divider, and the UoM
   dropdown trigger on the right. The dropdown lists only the
   product's UoM set and tags the primary with a Partner-style
   "PRIMARY" pill. */
function QtyUomCapsule({
  qty, uom, uomSet, primaryUomId, onChangeQty, onChangeUom, disabled = false, bumped = false,
}: {
  qty: number;
  uom: string;
  uomSet: UomOption[];
  primaryUomId: string;
  onChangeQty: (next: number) => void;
  onChangeUom: (uomId: string) => void;
  disabled?: boolean;
  /* When the parent flags this capsule as just-bumped, we add the
     `ppm-qty-bump-capsule` class which fires a 1.1 s green-ring flash
     on the bordered chip itself so the user sees which box changed.
     Mirrors Step3LineItems' qty-bump-capsule treatment. */
  bumped?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(qty));
  const [open, setOpen] = useState(false);
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
      /* Bumping the key when the parent flags this capsule as
         just-bumped restarts the CSS animation (CSS animations don't
         replay on a class re-toggle without a key change). */
      key={bumped ? `bump-${qty}-${uom}` : 'rest'}
      className={`relative inline-flex items-stretch ${bumped ? 'ppm-qty-bump-capsule' : ''}`}
      style={{ height: 32, borderRadius: 6, border: `1px solid ${editing || open ? '#3B82F6' : 'var(--border)'}`, backgroundColor: disabled ? 'var(--muted)' : '#FFFFFF', overflow: 'visible', boxShadow: editing ? '0 0 0 2px rgba(59,130,246,0.10)' : 'none', transition: 'border-color 100ms, box-shadow 100ms', opacity: disabled ? 0.6 : 1 }}
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
          onClick={() => { if (disabled) return; setDraft(String(qty)); setEditing(true); }}
          className="flex items-center justify-center text-foreground hover:bg-slate-50 transition-colors"
          style={{ width: 64, padding: 0, border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'text', fontSize: 13, fontWeight: 600, lineHeight: 1 }}
          title={disabled ? undefined : 'Click to edit quantity'}
          disabled={disabled}
        >
          {qty.toLocaleString()}
        </button>
      )}
      <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, alignSelf: 'stretch' }} />
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen(o => !o); }}
        className={`inline-flex items-center gap-1.5 transition-colors ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${open ? 'bg-muted' : 'hover:bg-slate-50'}`}
        style={{ padding: '0 10px', border: 'none', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', borderRadius: '0 5px 5px 0' }}
        aria-label="Change unit of measure"
        title={current.name}
        disabled={disabled}
      >
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
                    {isPrimary && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#1B6EF3', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 5px', borderRadius: 3, lineHeight: 1, letterSpacing: 0.2, textTransform: 'uppercase' }}>
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

/* ─── Interfaces ─── */
interface SelectedProduct { product: Product; quantity: number; }
interface ExistingItem {
  productId: string;
  quantity: number;
  productName?: string;
  /** When > 0 the line has already been fulfilled in part or in
      whole and must not be editable from this picker. */
  shippedQty?: number;
  /** Set true once the parent quote has been converted to a Sales
      Order. The line becomes read-only because the converted SO
      now owns line edits. */
  isLocked?: boolean;
  /** Current UoM on the existing line (name, e.g. 'EA', 'Box',
      'Gallon'). Forwarded so the picker's selected-items panel
      opens on the unit the line already uses instead of defaulting
      every row back to 'EA'. */
  uom?: string;
  /** Unit price at the existing UoM. Without this the picker would
      reset PPU to the product's base (EA) price on open and a
      Pallet line would silently lose its 480× scale on first
      re-save. */
  unitPrice?: number;
}
interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProducts: (products: SelectedProduct[]) => void;
  existingProductIds?: string[];
  existingItems?: ExistingItem[];
  /** When true, all editing affordances are hidden — the quote has
      been converted to a Sales Order so line items live there now. */
  quoteIsConverted?: boolean;
  /** Notify the host that a material change was made (qty edit,
      duplicate, remove) on an existing line. The host uses this to
      kick off the auto-version draft flow. */
  onMaterialChange?: (description: string) => void;
  /** Commit edits made to lines that were already on the quote when
      the picker opened. The picker collects qty / remove edits locally
      so the user can stage them alongside new-line additions, then
      flushes the diff through this callback when they hit "Apply".
      `lineIndex` is the index in the `existingItems` array the picker
      was opened with (= the parent's items array index). */
  onUpdateExisting?: (updates: ExistingItemUpdate[]) => void;
}
export interface ExistingItemUpdate {
  lineIndex: number;
  productId: string;
  quantity?: number;
  remove?: boolean;
  /** New UoM (name) when the user swapped units inside the picker.
      Omitted when the line's UoM is unchanged. */
  uom?: string;
  /** New unit price after the picker rescaled it for a same-set UoM
      swap. Omitted when the price wasn't recomputed. */
  unitPrice?: number;
}
interface SelectedLineItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  isLocked?: boolean;
  /** Set on lines that came from `existingItems`. Captures the original
      index so we can map qty / remove edits back to the parent's
      items array on commit. */
  originalIndex?: number;
  /** Snapshot of the qty the line had when the modal opened. Used to
      diff against the live `quantity` so only actually-changed lines
      are sent back to the parent. */
  originalQuantity?: number;
  /** Per-line UoM (name, e.g. 'EA', 'Box', 'Gallon'). Defaults to the
      product's primary on add; user can swap to any unit in the
      product's set via the capsule dropdown. */
  uom?: string;
  /** Snapshot of the unit price at the chosen UoM so swap-and-back
      keeps the total honest within the product's set. */
  unitPrice?: number;
}

/* ─── Filter types ─── */
interface AdvancedFilters {
  categories: string[];
  priceMin: string;
  priceMax: string;
  sourceTypes: string[];
  stockMin: string;
  stockMax: string;
  isSerialized: boolean | null;
  isLotControlled: boolean | null;
  recentlyOrdered: boolean | null;
}
const EMPTY_FILTERS: AdvancedFilters = {
  categories: [], priceMin: '', priceMax: '', sourceTypes: [],
  stockMin: '', stockMax: '', isSerialized: null, isLotControlled: null, recentlyOrdered: null,
};

/* ─── Constants ─── */
const ALL_CATEGORIES = Array.from(new Set(PRODUCTS.map(p => p.category))).sort();
const SOURCE_TYPES: ('Manufactured' | 'Purchased')[] = ['Manufactured', 'Purchased'];
const STOCK_PRESETS = [
  { label: 'In Stock', desc: '> 20', min: '21', max: '' },
  { label: 'Low Stock', desc: '1–20', min: '1', max: '20' },
  { label: 'Out of Stock', desc: '= 0', min: '0', max: '0' },
] as const;

/* ─── Helpers ─── */
function getTrackingType(product: Product): { label: string; bg: string; color: string } {
  // Four canonical labels — "Lot Controlled" is retired in favour of
  // "Lot Serialized" / "Lot Non-Serialized" so the badge always reads
  // explicitly whether the lot-tracked item is also serial-tracked.
  const lot = !!product.isLotControlled;
  const ser = !!product.isSerialized;
  if (lot && ser)   return { label: 'Lot Serialized',     bg: 'var(--accent)', color: 'var(--primary)' };
  if (lot && !ser)  return { label: 'Lot Non-Serialized', bg: 'var(--accent)', color: 'var(--primary)' };
  if (ser)          return { label: 'Serialized',         bg: 'var(--accent)', color: 'var(--primary)' };
  return                   { label: 'Non-Serialized',     bg: 'var(--muted)',  color: 'var(--foreground)' };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

function getActiveFilterCount(f: AdvancedFilters): number {
  let c = 0;
  if (f.categories.length) c++;
  if (f.priceMin || f.priceMax) c++;
  if (f.sourceTypes.length) c++;
  if (f.stockMin || f.stockMax) c++;
  if (f.isSerialized !== null) c++;
  if (f.isLotControlled !== null) c++;
  if (f.recentlyOrdered !== null) c++;
  return c;
}

function getActiveFilterTags(f: AdvancedFilters): { key: string; label: string }[] {
  const tags: { key: string; label: string }[] = [];
  if (f.categories.length === 1) tags.push({ key: 'categories', label: `Category: ${f.categories[0]}` });
  else if (f.categories.length > 1) tags.push({ key: 'categories', label: `${f.categories.length} Categories` });
  if (f.priceMin && f.priceMax) tags.push({ key: 'price', label: `$${f.priceMin} – $${f.priceMax}` });
  else if (f.priceMin) tags.push({ key: 'price', label: `Min $${f.priceMin}` });
  else if (f.priceMax) tags.push({ key: 'price', label: `Max $${f.priceMax}` });
  if (f.sourceTypes.length === 1) tags.push({ key: 'sourceTypes', label: `Source: ${f.sourceTypes[0]}` });
  else if (f.sourceTypes.length > 1) tags.push({ key: 'sourceTypes', label: `${f.sourceTypes.length} Sources` });
  if (f.stockMin || f.stockMax) {
    const preset = STOCK_PRESETS.find(p => p.min === f.stockMin && p.max === f.stockMax);
    tags.push({ key: 'stock', label: preset ? preset.label : f.stockMin && f.stockMax ? `Stock ${f.stockMin}–${f.stockMax}` : f.stockMin ? `Stock ≥ ${f.stockMin}` : `Stock ≤ ${f.stockMax}` });
  }
  if (f.isSerialized !== null) tags.push({ key: 'isSerialized', label: f.isSerialized ? 'Serialized' : 'Not Serialized' });
  if (f.isLotControlled !== null) tags.push({ key: 'isLotControlled', label: f.isLotControlled ? 'Lot Tracked' : 'Not Lot Tracked' });
  if (f.recentlyOrdered !== null) tags.push({ key: 'recentlyOrdered', label: f.recentlyOrdered ? 'Recently Ordered' : 'Not Recently Ordered' });
  return tags;
}

/* ─── Filter Sub-components ─── */
function FilterCheckbox({ checked, onChange, label, count }: {
  checked: boolean; onChange: () => void; label: string; count?: number;
}) {
  return (
    <button onClick={onChange} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '5px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}>
      <div style={{ width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, border: checked ? 'none' : '1px solid var(--border)', backgroundColor: checked ? 'var(--primary)' : 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
        {checked && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} strokeWidth={3} />}
      </div>
      <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--foreground)', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 400, lineHeight: '1', flexShrink: 0 }}>{count}</span>}
    </button>
  );
}

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--muted)' }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 16px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1' }}>{title}</span>
        {open ? <ChevronDown style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} /> : <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />}
      </button>
      {open && <div style={{ padding: '0 16px 10px' }}>{children}</div>}
    </div>
  );
}

/* ─── Shared Filter Panel Content ─── */
export function FilterPanelContent({
  filters, setFilters, filteredCount, onDone,
}: {
  filters: AdvancedFilters;
  setFilters: React.Dispatch<React.SetStateAction<AdvancedFilters>>;
  filteredCount: number;
  onDone: () => void;
}) {
  const [categorySearch, setCategorySearch] = useState('');
  const activeCount = getActiveFilterCount(filters);

  const visibleCategories = categorySearch
    ? ALL_CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()))
    : ALL_CATEGORIES;
  const getCategoryCount = (cat: string) => PRODUCTS.filter(p => p.category === cat).length;

  const toggleCategory = (cat: string) => setFilters(prev => ({ ...prev, categories: prev.categories.includes(cat) ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat] }));
  const toggleSourceType = (st: string) => setFilters(prev => ({ ...prev, sourceTypes: prev.sourceTypes.includes(st) ? prev.sourceTypes.filter(s => s !== st) : [...prev.sourceTypes, st] }));
  const clearAll = () => { setFilters({ ...EMPTY_FILTERS }); setCategorySearch(''); };

  const isStockPresetActive = (preset: typeof STOCK_PRESETS[number]) => filters.stockMin === preset.min && filters.stockMax === preset.max;
  const toggleStockPreset = (preset: typeof STOCK_PRESETS[number]) => {
    if (isStockPresetActive(preset)) {
      setFilters(prev => ({ ...prev, stockMin: '', stockMax: '' }));
    } else {
      setFilters(prev => ({ ...prev, stockMin: preset.min, stockMax: preset.max }));
    }
  };

  return (
    <>
      {/* Panel header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1' }}>Advanced Filters</span>
        {activeCount > 0 && (
          <button onClick={clearAll} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--primary)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '2px 0', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1' }}>
            Clear all
          </button>
        )}
      </div>

      {/* Scrollable sections */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, scrollbarWidth: 'thin' as any }}>
        {/* ── Category ── */}
        <FilterSection title="Category" defaultOpen={true}>
          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <Search style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
            <input
              value={categorySearch} onChange={e => setCategorySearch(e.target.value)}
              placeholder="Search categories..."
              style={{ width: '100%', height: '28px', paddingLeft: '26px', paddingRight: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--foreground)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
          {filters.categories.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 500 }}>{filters.categories.length} selected</span>
              <button onClick={() => setFilters(prev => ({ ...prev, categories: [] }))} style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 500, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', padding: 0 }}>
                Clear
              </button>
            </div>
          )}
          <div style={{ maxHeight: '150px', overflowY: 'auto', scrollbarWidth: 'thin' as any }}>
            {visibleCategories.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', padding: '6px 0' }}>No matching categories</div>
            ) : visibleCategories.map(cat => (
              <FilterCheckbox key={cat} checked={filters.categories.includes(cat)} onChange={() => toggleCategory(cat)} label={cat} count={getCategoryCount(cat)} />
            ))}
          </div>
        </FilterSection>

        {/* ── Price Range ── */}
        <FilterSection title="Price Range" defaultOpen={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 500 }}>$</span>
              <input type="number" placeholder="Min" value={filters.priceMin}
                onChange={e => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                style={{ width: '100%', height: '28px', paddingLeft: '20px', paddingRight: '6px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--foreground)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 500 }}>to</span>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 500 }}>$</span>
              <input type="number" placeholder="Max" value={filters.priceMax}
                onChange={e => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                style={{ width: '100%', height: '28px', paddingLeft: '20px', paddingRight: '6px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--foreground)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
              />
            </div>
          </div>
        </FilterSection>

        {/* ── Source Type ── */}
        <FilterSection title="Source Type" defaultOpen={false}>
          {SOURCE_TYPES.map(st => (
            <FilterCheckbox key={st} checked={filters.sourceTypes.includes(st)} onChange={() => toggleSourceType(st)} label={st} count={PRODUCTS.filter(p => p.sourceType === st).length} />
          ))}
        </FilterSection>

        {/* ── Stock Status ── */}
        <FilterSection title="Stock Status" defaultOpen={false}>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {STOCK_PRESETS.map(preset => {
              const active = isStockPresetActive(preset);
              return (
                <button key={preset.label} onClick={() => toggleStockPreset(preset)}
                  style={{
                    height: '24px', padding: '0 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 500,
                    border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: active ? 'var(--accent)' : 'var(--background)', color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 120ms', lineHeight: '1', whiteSpace: 'nowrap',
                  }}>
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 500, marginBottom: '4px', lineHeight: '1' }}>Custom range</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="number" placeholder="Min" value={filters.stockMin}
              onChange={e => setFilters(prev => ({ ...prev, stockMin: e.target.value }))}
              style={{ flex: 1, height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--foreground)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 500 }}>to</span>
            <input type="number" placeholder="Max" value={filters.stockMax}
              onChange={e => setFilters(prev => ({ ...prev, stockMax: e.target.value }))}
              style={{ flex: 1, height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--foreground)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
          </div>
        </FilterSection>

        {/* ── Tracking ── */}
        <FilterSection title="Tracking" defaultOpen={false}>
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 500, marginBottom: '4px', lineHeight: '1' }}>Serialized</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[{ val: true as const, label: 'Yes' }, { val: false as const, label: 'No' }].map(opt => {
                const isActive = filters.isSerialized === opt.val;
                return (
                  <button key={String(opt.val)} onClick={() => setFilters(prev => ({ ...prev, isSerialized: prev.isSerialized === opt.val ? null : opt.val }))}
                    style={{ height: '24px', padding: '0 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)', backgroundColor: isActive ? 'var(--accent)' : 'var(--background)', color: isActive ? 'var(--primary)' : 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 120ms', lineHeight: '1' }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 500, marginBottom: '4px', lineHeight: '1' }}>Lot Tracked</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[{ val: true as const, label: 'Yes' }, { val: false as const, label: 'No' }].map(opt => {
                const isActive = filters.isLotControlled === opt.val;
                return (
                  <button key={String(opt.val)} onClick={() => setFilters(prev => ({ ...prev, isLotControlled: prev.isLotControlled === opt.val ? null : opt.val }))}
                    style={{ height: '24px', padding: '0 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)', backgroundColor: isActive ? 'var(--accent)' : 'var(--background)', color: isActive ? 'var(--primary)' : 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 120ms', lineHeight: '1' }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </FilterSection>
      </div>

      {/* Panel footer — keep on the same white surface as the body so
          the dropdown reads as one panel, not a stacked banner. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--card)', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 400 }}>{filteredCount} result{filteredCount !== 1 ? 's' : ''}</span>
        <button onClick={onDone}
          style={{ height: '28px', padding: '0 14px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', fontSize: '12px', fontWeight: 500, color: '#FFFFFF', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 150ms', lineHeight: '1' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}>
          Done
        </button>
      </div>
    </>
  );
}

/* ─── Shared filter application logic ─── */
export function applyAdvancedFilters(products: Product[], filters: AdvancedFilters): Product[] {
  return products.filter(p => {
    if (filters.categories.length > 0 && !filters.categories.includes(p.category)) return false;
    if (filters.priceMin && p.unitPrice < Number(filters.priceMin)) return false;
    if (filters.priceMax && p.unitPrice > Number(filters.priceMax)) return false;
    if (filters.sourceTypes.length > 0 && !filters.sourceTypes.includes(p.sourceType)) return false;
    if (filters.stockMin && p.stockQuantity < Number(filters.stockMin)) return false;
    if (filters.stockMax !== '' && filters.stockMax !== undefined && p.stockQuantity > Number(filters.stockMax)) return false;
    if (filters.isSerialized !== null && p.isSerialized !== filters.isSerialized) return false;
    if (filters.isLotControlled !== null && p.isLotControlled !== filters.isLotControlled) return false;
    if (filters.recentlyOrdered !== null && p.isRecentlyOrdered !== filters.recentlyOrdered) return false;
    return true;
  });
}

/* ─── Shared filter button + popover ─── */
export function FilterButton({
  filters, setFilters, filteredCount,
}: {
  filters: AdvancedFilters;
  setFilters: React.Dispatch<React.SetStateAction<AdvancedFilters>>;
  filteredCount: number;
}) {
  const [showPanel, setShowPanel] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPanel) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node))
        setShowPanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPanel]);

  const activeCount = getActiveFilterCount(filters);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Partner-secondary chrome: white surface, black label,
          resting 1px shadow + slate border. The previous resting
          state used `var(--background)` (#F4F6FA gray-blue) which
          made the button look randomly half-disabled next to the
          white search input. Active state keeps the primary tint. */}
      <button ref={btnRef} onClick={() => setShowPanel(!showPanel)}
        style={{
          height: 36, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8,
          border: activeCount > 0 ? '1px solid var(--primary)' : '1px solid var(--border)',
          backgroundColor: activeCount > 0 ? 'var(--accent)' : showPanel ? '#F0F7FF' : 'var(--card)',
          fontSize: 13, fontWeight: 500, color: activeCount > 0 ? 'var(--primary)' : 'var(--foreground)',
          cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms', whiteSpace: 'nowrap',
          boxShadow: activeCount > 0 ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.06)',
        }}
        onMouseEnter={e => { if (activeCount === 0 && !showPanel) { e.currentTarget.style.backgroundColor = '#F0F7FF'; e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(10, 119, 255, 0.12)'; } }}
        onMouseLeave={e => { if (activeCount === 0 && !showPanel) { e.currentTarget.style.backgroundColor = 'var(--card)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.06)'; } }}>
        <SlidersHorizontal style={{ width: '14px', height: '14px' }} />
        Filters
        {activeCount > 0 && (
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#FFFFFF', backgroundColor: 'var(--primary)', width: '18px', height: '18px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>{activeCount}</span>
        )}
      </button>

      {showPanel && (
        /* Partner-consistent surface: white card, not the muted
           `var(--background)` token (which resolves to a gray-blue
           #F4F6FA and made the dropdown read as gray-on-gray over the
           modal). */
        <div ref={panelRef} style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: '320px',
          backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 60, maxHeight: '480px', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <FilterPanelContent filters={filters} setFilters={setFilters} filteredCount={filteredCount} onDone={() => setShowPanel(false)} />
        </div>
      )}
    </div>
  );
}

/* ─── Active filter tag bar ─── */
export function ActiveFilterTags({ filters, setFilters }: { filters: AdvancedFilters; setFilters: React.Dispatch<React.SetStateAction<AdvancedFilters>> }) {
  const tags = getActiveFilterTags(filters);
  if (tags.length === 0) return null;

  const removeTag = (key: string) => {
    setFilters(prev => {
      const next = { ...prev };
      switch (key) {
        case 'categories': next.categories = []; break;
        case 'price': next.priceMin = ''; next.priceMax = ''; break;
        case 'sourceTypes': next.sourceTypes = []; break;
        case 'stock': next.stockMin = ''; next.stockMax = ''; break;
        case 'isSerialized': next.isSerialized = null; break;
        case 'isLotControlled': next.isLotControlled = null; break;
        case 'recentlyOrdered': next.recentlyOrdered = null; break;
      }
      return next;
    });
  };
  const clearAll = () => setFilters({ ...EMPTY_FILTERS });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
      {tags.map(tag => (
        <span key={tag.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '22px', padding: '0 6px 0 8px', borderRadius: '6px', backgroundColor: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '11px', fontWeight: 500, color: 'var(--primary)', lineHeight: '1' }}>
          {tag.label}
          <button onClick={() => removeTag(tag.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'rgba(10, 119, 255, 0.6)', padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(10, 119, 255, 0.6)'}>
            <X style={{ width: '10px', height: '10px' }} />
          </button>
        </span>
      ))}
      <button onClick={clearAll} style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '0 4px', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-foreground)'}>
        Clear all
      </button>
    </div>
  );
}

/* Re-export types for use in Step3 */
export type { AdvancedFilters };
export { EMPTY_FILTERS };


/* ═══════════════════════════════════════════════════════════ */
/* ═══ Main Modal Component ════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════ */
export function ProductPickerModal({ isOpen, onClose, onAddProducts, existingProductIds = [], existingItems = [], quoteIsConverted = false, onMaterialChange, onUpdateExisting }: ProductPickerModalProps) {
  /* Item peek modal — opens when the user taps any catalog or
     selected-card thumbnail. Same chrome as ItemsTabTableClean so
     the peek reads identically across the module. */
  const { open: openItemQuickView, modal: itemQuickViewModal } = useItemQuickView();
  const previewProduct = (product: Product) => {
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
        { label: 'Unit Price', value: formatCurrency(product.unitPrice), caption: 'Unit Price' },
        { label: 'In Stock', value: `${product.stockQuantity.toLocaleString()} ${findUomById(getPrimaryUomForProduct(product))?.name || 'EA'}`, caption: 'In Stock' },
      ],
    };
    openItemQuickView(peek);
  };
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedLineItem[]>([]);
  const [filters, setFilters] = useState<AdvancedFilters>({ ...EMPTY_FILTERS });
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  const [expandedSelectedDescs, setExpandedSelectedDescs] = useState<Set<string>>(new Set());
  // Creation-flow parity — newly-added card flash + qty-bump capsule
  // flash. Mirrors Step3LineItems and the SO AddLineItemDialog so the
  // detail-page picker reads with the same family of feedback when a
  // line lands or a quantity ticks.
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [qtyBumpIds, setQtyBumpIds] = useState<Set<string>>(new Set());
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyBumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  /* Refs to the left-side catalog rows, keyed by productId. After
     adding a Recently-Ordered item we scroll the matching catalog
     row into view so the user sees it land in the "Already on this
     Quote" section right below. */
  const catalogRowRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  const flashHighlight = (id: string) => {
    setNewlyAddedIds(prev => new Set([...prev, id]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 4500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const flashQtyBump = (id: string) => {
    setQtyBumpIds(prev => new Set([...prev, id]));
    if (qtyBumpTimerRef.current) clearTimeout(qtyBumpTimerRef.current);
    qtyBumpTimerRef.current = setTimeout(() => setQtyBumpIds(new Set()), 3500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };
  const [panelLayout, setPanelLayout] = useState<'narrow' | 'wide'>('narrow');
  const [showQuickTips, setShowQuickTips] = useState(true);
  const [quickTipsDismissed, setQuickTipsDismissed] = useState(false);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  /* Original lineIndex values for existing items that the user removed
     from inside the picker. The lines are stripped from `selectedItems`
     immediately so the UI updates, but the indices are kept here so
     `handleAdd` can flush "remove" entries through `onUpdateExisting`
     when the user commits. */
  const [removedExistingIndices, setRemovedExistingIndices] = useState<Set<number>>(new Set());
  const [pendingDuplicateProduct, setPendingDuplicateProduct] = useState<Product | null>(null);
  /* Which selected-side item card is currently in the Advanced
     Configurator. Mirrors SO's AddLineItemDialog → AdvancedConfiguratorModal
     pattern: set the id, render the modal, clear the id on close. The
     Advanced Configuration button on each card sets this. */
  const [configuringItemId, setConfiguringItemId] = useState<string | null>(null);

  /* Reset on open & seed existing items into the unified list.
     Dependency is `isOpen` ONLY — the parent re-renders pass a fresh
     `items.map(...)` reference for `existingItems` every time, so
     listing `existingItems` here would clobber every in-picker UoM /
     qty edit the moment the parent re-renders (which it does, e.g.,
     when liveLines change downstream of this picker). We capture
     `existingItems` + `quoteIsConverted` via a ref so the seed reads
     fresh values when isOpen flips true, without re-firing on
     reference churn. */
  const existingItemsRef = useRef(existingItems);
  existingItemsRef.current = existingItems;
  const quoteIsConvertedRef = useRef(quoteIsConverted);
  quoteIsConvertedRef.current = quoteIsConverted;
  /* Snapshot of the recently-ordered product IDs taken when the modal
     opens. The displayed "Recently Ordered" list is derived from this
     fixed pool — minus whatever's currently on the quote — so adding
     an item shrinks the section (6 → 5) instead of being backfilled
     by the next eligible SKU. Reseeds each time the modal reopens. */
  const [initialRecentlyOrderedIds, setInitialRecentlyOrderedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (isOpen) {
      setSearch(''); setFilters({ ...EMPTY_FILTERS });
      setExpandedDescs(new Set()); setExpandedSelectedDescs(new Set());
      setRemovedExistingIndices(new Set());
      const seeded: SelectedLineItem[] = [];
      const ids = new Set<string>();
      existingItemsRef.current.forEach((ei, idx) => {
        const product = PRODUCTS.find(p => p.id === ei.productId);
        if (product) {
          const id = `existing-${ei.productId}-${idx}`;
          ids.add(id);
          /* A line is read-only here when the quote has been
             converted OR when units have shipped from it. The Sales
             Order owns line edits after conversion, and shipped
             quantities can't be retroactively edited. Sent / Confirmed
             quotes stay editable here — the host wires the resulting
             material-change callback up to the auto-version flow,
             which forks a new draft before the edit lands on the
             user-visible record. */
          const isLocked = !!(quoteIsConvertedRef.current || ei.isLocked || (ei.shippedQty && ei.shippedQty > 0));
          /* Carry over the existing line's UoM + unit price so the
             picker's selected-items panel opens on the unit the line
             already uses. Falling back to the product's primary means
             freshly-imported items with no stored UoM still seed on
             primary instead of an empty value. */
          const primaryName = findUomById(getPrimaryUomForProduct(product))?.name;
          seeded.push({
            id,
            productId: ei.productId,
            product,
            quantity: ei.quantity,
            isLocked,
            originalIndex: idx,
            originalQuantity: ei.quantity,
            uom: ei.uom || primaryName || 'EA',
            unitPrice: ei.unitPrice,
          });
        }
      });
      setExistingIds(ids);
      setSelectedItems(seeded);
      /* Snapshot the FIRST 6 recently-ordered products as of the
         modal-open moment so additions during this session can only
         remove from the pool, never refill it. The display layer
         downstream also caps at 6, so the snapshot has to match that
         cap — otherwise a deeper pool would always have a backup SKU
         ready to take the freed slot. Excludes anything already on
         the quote on open. */
      const seededProductIds = new Set(seeded.map((s) => s.productId));
      const snapshot = new Set(
        PRODUCTS
          .filter((p) => p.isRecentlyOrdered && !seededProductIds.has(p.id))
          .slice(0, 6)
          .map((p) => p.id)
      );
      setInitialRecentlyOrderedIds(snapshot);
    }
  }, [isOpen]);

  /* Search is dash/whitespace tolerant — a user typing "000-100",
     "000100", or "100-" all map to the same matches. We test each
     field both as-is and with non-alphanumerics stripped, so the
     dash-separated item codes ("000-100-001") and dashless input
     both produce hits. */
  const matchesProduct = useMemo(() => {
    const raw = search.trim().toLowerCase();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const qNorm = normalize(search);
    return (p: Product) => {
      const test = (text: string | undefined) => {
        if (!text) return false;
        const t = text.toLowerCase();
        if (t.includes(raw)) return true;
        return qNorm.length > 0 && normalize(text).includes(qNorm);
      };
      return test(p.id) || test(p.name) || test(p.description) || test(p.category);
    };
  }, [search]);

  /* No-search state surfaces two sections so the user can immediately
     see what's already attached AND what they typically reach for. */
  const noSearchSections = useMemo(() => {
    const onQuoteIds = new Set(selectedItems.map(i => i.productId));
    const alreadyAdded = applyAdvancedFilters(
      PRODUCTS.filter(p => onQuoteIds.has(p.id)),
      filters,
    );
    /* Draw from the open-time snapshot, not the live PRODUCTS list —
       so adding a card from this section shrinks it (6 → 5) instead
       of pulling in the next eligible SKU to backfill. */
    const recentlyOrdered = applyAdvancedFilters(
      PRODUCTS.filter(p => initialRecentlyOrderedIds.has(p.id) && !onQuoteIds.has(p.id)),
      filters,
    );
    return { alreadyAdded, recentlyOrdered };
  }, [selectedItems, filters, initialRecentlyOrderedIds]);

  /* Search-mode list — flat ranked matches with the same advanced
     filters applied. Falls back to the legacy `filteredProducts` name
     downstream so the rest of the file keeps working. */
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    return applyAdvancedFilters(PRODUCTS.filter(matchesProduct), filters);
  }, [search, matchesProduct, filters]);

  /* Backward-compat: a flat list for callers that still want one
     array (the FilterButton count, the action-bar "N products"
     blurb). When searching = searchResults; when not = both sections
     concatenated. */
  const filteredProducts = useMemo(() =>
    search.trim()
      ? searchResults
      : [...noSearchSections.alreadyAdded, ...noSearchSections.recentlyOrdered],
    [search, searchResults, noSearchSections],
  );

  if (!isOpen) return null;

  /* ── selection helpers ── */
  const isProductAdded = (pid: string) => selectedItems.some(i => i.productId === pid);
  const getSelectedQty = (pid: string) => selectedItems.filter(i => i.productId === pid).reduce((s, i) => s + i.quantity, 0);
  const getTotalUsedStock = (pid: string) => {
    // selectedItems now includes both existing and new items — no double count
    return selectedItems.filter(i => i.productId === pid).reduce((s, i) => s + i.quantity, 0);
  };
  const getRemainingStock = (pid: string) => {
    const p = PRODUCTS.find(x => x.id === pid);
    return p ? p.stockQuantity - getTotalUsedStock(pid) : 0;
  };
  const getItemNumbersForProduct = (pid: string): number[] => {
    const numbers: number[] = [];
    selectedItems.forEach((item, index) => {
      if (item.productId === pid) {
        numbers.push(index + 1);
      }
    });
    return numbers;
  };

  const handleAddProduct = (product: Product) => {
    /* Every add path lands here (row button, duplicate confirm), so the
       inactive rule is enforced once rather than at each caller. */
    if (isItemInactive(product.id)) return;
    /* Seed the new line with the product's primary UoM so the
       capsule opens on the right unit immediately. */
    const primaryName = findUomById(getPrimaryUomForProduct(product))?.name || 'EA';
    const newItem: SelectedLineItem = { id: `sel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId: product.id, product, quantity: 1, uom: primaryName };
    const lastIdx = selectedItems.map(i => i.productId).lastIndexOf(product.id);
    if (lastIdx !== -1) { const u = [...selectedItems]; u.splice(lastIdx + 1, 0, newItem); setSelectedItems(u); }
    else setSelectedItems(prev => [...prev, newItem]);
    /* Fresh add only fires the newly-added flash. Stacking a qty-bump
       on the same element causes the two class timers to clear at
       different moments, which reads as an all-cards re-flash
       mid-animation. */
    flashHighlight(newItem.id);
    /* Scroll the left-side catalog row into view — by the time the
       state update has flushed, the product will have moved from
       "Recently Ordered" into the "Already on this Quote" section
       below it. Slight delay so the section re-renders first. */
    setTimeout(() => {
      const catalogEl = catalogRowRefsMap.current.get(product.id);
      if (catalogEl) catalogEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  const handleAddQuantityToExisting = (product: Product) => {
    if (isItemInactive(product.id)) return;
    /* Read the existing line off the current state — the previous
       implementation captured the id by mutating a closure variable
       inside the functional updater, but React 18 queues updaters
       (they don't run synchronously inside setState), so the first
       call after a render saw `flashId === null` and the flash never
       fired. Subsequent clicks landed once the queue had flushed,
       which is why the green ring only appeared on the second tap. */
    const existingItem = selectedItems.find(item => item.productId === product.id);
    if (!existingItem || existingItem.isLocked) return;
    const flashId = existingItem.id;
    const oldQty = existingItem.quantity;
    const newQty = oldQty + 1;
    const isExistingItem = existingIds.has(existingItem.id);
    setSelectedItems(prev => prev.map(item =>
      item.id === flashId ? { ...item, quantity: item.quantity + 1 } : item
    ));
    /* Existing line increment — qty-bump only. Not a fresh add. */
    flashQtyBump(flashId);
    if (isExistingItem) {
      onMaterialChange?.(`Changed quantity on "${product.name}" (${oldQty} → ${newQty})`);
    }
  };

  /* Mirror of handleAddQuantityToExisting — subtracts one unit from the
     matched line. Floored at qty 1 since the row flips back to the
     "Add" state when the line drops out; the -1 button is only
     rendered when the existing qty is greater than 1. */
  const handleSubtractQuantityFromExisting = (product: Product) => {
    const existingItem = selectedItems.find(item => item.productId === product.id);
    if (!existingItem || existingItem.quantity <= 1 || existingItem.isLocked) return;
    const flashId = existingItem.id;
    const oldQty = existingItem.quantity;
    const newQty = oldQty - 1;
    const isExistingItem = existingIds.has(existingItem.id);
    setSelectedItems(prev => prev.map(item =>
      item.id === flashId ? { ...item, quantity: item.quantity - 1 } : item
    ));
    flashQtyBump(flashId);
    if (isExistingItem) {
      onMaterialChange?.(`Changed quantity on "${product.name}" (${oldQty} → ${newQty})`);
    }
  };

  /* Edit handlers honour the per-item `isLocked` flag: locked rows
     can't be removed or have their quantity changed from this picker.
     Mutations that touch an EXISTING (already-saved) line fire the
     material-change callback so the host can spin up the auto-version
     draft flow — qty edits, dupes, and removes all qualify. New items
     (not yet saved) are picker-local until Add to Quote commits. */
  const handleRemoveItem = (id: string) => {
    const item = selectedItems.find(i => i.id === id);
    if (item?.isLocked) return;
    setSelectedItems(prev => prev.filter(i => i.id !== id));
    if (item && isExisting(id)) {
      /* Stage the remove for commit. The actual mutation on the parent's
         items array happens in `handleAdd` so the user can still cancel
         the modal without persisting anything. */
      if (typeof item.originalIndex === 'number') {
        setRemovedExistingIndices(prev => new Set(prev).add(item.originalIndex!));
      }
      onMaterialChange?.(`Removed "${item.product.name}" from quote`);
    }
  };
  const handleSetQuantity = (id: string, qty: number) => {
    const next = Math.max(1, qty);
    let transition: { oldQty: number; productName: string; isExistingItem: boolean } | null = null;
    setSelectedItems(prev => {
      const target = prev.find(i => i.id === id);
      if (!target || target.isLocked) return prev;
      if (target.quantity === next) return prev;
      transition = {
        oldQty: target.quantity,
        productName: target.product.name,
        isExistingItem: existingIds.has(id),
      };
      return prev.map(i => i.id === id ? { ...i, quantity: next } : i);
    });
    if (transition && transition.isExistingItem) {
      onMaterialChange?.(`Changed quantity on "${transition.productName}" (${transition.oldQty} → ${next})`);
    }
  };

  /* UoM swap inside the picker. Resolves multipliers within the
     product's own set so a Liter and a Box never interconvert; same-
     set conversions (e.g. EA → Box) rescale the line's unitPrice so
     the per-line total stays consistent with the underlying base
     price. Existing lines fire a material-change event so the host
     can spin up the auto-version draft flow. */
  const handleSetUom = (id: string, newUomId: string) => {
    /* Drive the lookup off the latest state inside the functional
       updater so a stale closure (e.g. when this handler was captured
       by a popover button that's been in the DOM since an earlier
       render) can't silently swallow the change. We capture the
       transition fields (oldUomName, productName, isExistingItem) so
       the post-update onMaterialChange fires with the right context. */
    let transitionMeta: { oldUomName: string | undefined; productName: string; isExistingItem: boolean; newName: string } | null = null;
    setSelectedItems(prev => {
      const target = prev.find(i => i.id === id);
      if (!target || target.isLocked) return prev;
      const set = getUomSetForProduct(target.product);
      const newOpt = set.find(u => u.id === newUomId.toLowerCase() || u.name.toLowerCase() === newUomId.toLowerCase());
      if (!newOpt) return prev;
      const oldMult = multiplierWithinSet(target.uom, set);
      const newMult = multiplierWithinSet(newOpt.id, set);
      const oldUomName = target.uom;
      transitionMeta = {
        oldUomName,
        productName: target.product.name,
        isExistingItem: existingIds.has(id),
        newName: newOpt.name,
      };
      return prev.map(i => {
        if (i.id !== id) return i;
        const basePrice = typeof i.unitPrice === 'number' ? i.unitPrice : i.product.unitPrice;
        const next: SelectedLineItem = { ...i, uom: newOpt.name };
        if (oldMult !== newMult && oldMult > 0) {
          next.unitPrice = (basePrice * newMult) / oldMult;
        }
        return next;
      });
    });
    if (transitionMeta && transitionMeta.isExistingItem && transitionMeta.oldUomName && transitionMeta.oldUomName !== transitionMeta.newName) {
      onMaterialChange?.(`Changed UoM on "${transitionMeta.productName}" (${transitionMeta.oldUomName} → ${transitionMeta.newName})`);
    }
  };

  const isExisting = (id: string) => existingIds.has(id);
  const newItems = selectedItems.filter(i => !isExisting(i.id));
  const existingCount = selectedItems.filter(i => isExisting(i.id)).length;

  /* Build the set of existing-item edits to flush back to the parent.
     Two sources contribute: quantity changes (originalQuantity !=
     current quantity on a still-visible existing line) and removals
     (existing indices captured in `removedExistingIndices`). The
     parent applies them in a single pass so the auto-version flow
     can wrap the whole set as one logical change. */
  const existingItemEdits: ExistingItemUpdate[] = (() => {
    const edits: ExistingItemUpdate[] = [];
    selectedItems.forEach(item => {
      if (!isExisting(item.id)) return;
      if (typeof item.originalIndex !== 'number') return;
      const seedRow = existingItems[item.originalIndex];
      const seedUom = seedRow?.uom;
      const seedPrice = seedRow?.unitPrice;
      const qtyChanged = typeof item.originalQuantity === 'number' && item.originalQuantity !== item.quantity;
      const uomChanged = !!(seedUom && item.uom && seedUom !== item.uom);
      const priceChanged = typeof item.unitPrice === 'number' && typeof seedPrice === 'number' && item.unitPrice !== seedPrice;
      if (qtyChanged || uomChanged || priceChanged) {
        const edit: ExistingItemUpdate = { lineIndex: item.originalIndex, productId: item.productId };
        if (qtyChanged) edit.quantity = item.quantity;
        if (uomChanged) edit.uom = item.uom;
        if (priceChanged) edit.unitPrice = item.unitPrice;
        edits.push(edit);
      }
    });
    removedExistingIndices.forEach(lineIndex => {
      /* Find the productId from the original existingItems list so the
         parent can sanity-check the index→productId pairing. */
      const ei = existingItems[lineIndex];
      if (ei) edits.push({ lineIndex, productId: ei.productId, remove: true });
    });
    return edits;
  })();

  const hasExistingEdits = existingItemEdits.length > 0;
  const hasPendingChanges = newItems.length > 0 || hasExistingEdits;

  const handleAdd = () => {
    if (hasExistingEdits) {
      onUpdateExisting?.(existingItemEdits);
    }
    if (newItems.length > 0) {
      onAddProducts(newItems.map(si => ({ product: si.product, quantity: si.quantity })));
    }
    onClose();
  };

  /* ── item numbering (sequential 1,2,3…) + duplicate tracking ── */
  const getItemNumbers = () => {
    const nums: Record<string, string> = {};
    const originalLineNums: Record<string, number | null> = {};
    const firstOccurrence: Record<string, number> = {};

    selectedItems.forEach((item, index) => {
      const lineNum = index + 1;
      nums[item.id] = `${lineNum}`;
      if (!(item.productId in firstOccurrence)) {
        firstOccurrence[item.productId] = lineNum;
        originalLineNums[item.id] = null;
      } else {
        originalLineNums[item.id] = firstOccurrence[item.productId];
      }
    });
    return { nums, originalLineNums };
  };
  const { nums: itemNumbers, originalLineNums } = getItemNumbers();

  const subtotal = selectedItems.reduce((s, i) => s + i.quantity * i.product.unitPrice, 0);
  const descTruncLen = 80;

  /* ── right panel sizing ── */
  const rightStyle: React.CSSProperties =
    panelLayout === 'narrow' ? { width: '400px', flexShrink: 0, transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1)' }
    : { width: '65%', flexShrink: 0, transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1)' };

  /* Two-column grid in wide mode (was three). Wider cards give the
     #N badge, item pills, and Duplicate/+1 EA buttons real breathing
     room — at 3 columns everything compressed onto one tight line. */
  const gridCols =
    panelLayout === 'narrow' ? undefined
    : 'repeat(2, minmax(0, 1fr))';

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />

      {/* Modal */}
      <div style={{ position: 'relative', backgroundColor: 'var(--card)', borderRadius: '12px', width: '1100px', maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {/* Card highlight animations — same recipe as Step3LineItems and
            the SO AddLineItemDialog so newly-added rings and qty-bump
            flashes read identically across creation and detail surfaces.
            Scoped via .ppm-* class names so they don't collide with the
            creation modal styles when both modals are mounted. */}
        <style>{`
          @keyframes ppmNewCardHighlight {
            0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.20); background-color: rgba(254, 249, 195, 0.55); border-color: rgba(5, 150, 105, 0.65); transform: scale(1.012); }
            15%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.20); background-color: rgba(254, 249, 195, 0.55); border-color: rgba(5, 150, 105, 0.65); transform: scale(1); }
            35%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.20); background-color: #FFFFFF; border-color: rgba(5, 150, 105, 0.65); transform: scale(1); }
            80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.20); background-color: #FFFFFF; border-color: rgba(5, 150, 105, 0.65); transform: scale(1); }
            100% { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); background-color: #FFFFFF; border-color: var(--border); transform: scale(1); }
          }
          .ppm-newly-added-card { animation: ppmNewCardHighlight 4000ms linear forwards; }

          @keyframes ppmQtyBumpPulse {
            0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: rgba(254, 249, 195, 0.50); border-color: rgba(5, 150, 105, 0.65); }
            30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: #FFFFFF; border-color: rgba(5, 150, 105, 0.65); }
            80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: #FFFFFF; border-color: rgba(5, 150, 105, 0.65); }
            100% { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); background-color: #FFFFFF; border-color: var(--border); }
          }
          .ppm-qty-bump-card { animation: ppmQtyBumpPulse 2600ms linear forwards; }

          /* Capsule-level green flash — runs on the QtyUomCapsule
             wrap div when its bumped prop is set, so the user sees
             which capsule was just affected by a +1 / -1 click in
             addition to the parent card flash. Mirrors Step3 qty
             bump capsule treatment. */
          @keyframes ppmQtyCapsuleFlash {
            0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: rgba(254, 249, 195, 0.60); }
            30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: #FFFFFF; }
            80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: #FFFFFF; }
            100% { box-shadow: none; border-color: var(--border); background-color: #FFFFFF; }
          }
          .ppm-qty-bump-capsule { animation: ppmQtyCapsuleFlash 2400ms linear forwards; }
        `}</style>

        {/* ═══ HEADER — minimal, consistent with other modals ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Package style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>Add Line Items</div>
              <div style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: '1', marginTop: '4px' }}>
                Select products and configure quantities before adding to the quote
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--muted)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* ═══ BODY — split panels ═══ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── LEFT: Product Catalog ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)', transition: 'flex 350ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
            {/* Title row with view toggle — matching Step3 layout */}
            <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1.2' }}>Add Line Items</div>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', height: '28px' }}>
                  {([
                    { key: 'narrow' as const, icon: LayoutList, tip: 'List view' },
                    { key: 'wide' as const, icon: Grid2x2, tip: 'Grid view' },
                  ] as const).map((v, idx) => (
                    <button key={v.key} onClick={() => setPanelLayout(v.key)} title={v.tip}
                      style={{
                        width: '30px', height: '27px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', borderRight: idx < 1 ? '1px solid var(--border)' : 'none',
                        backgroundColor: panelLayout === v.key ? '#E7F3FF' : 'var(--background)',
                        color: panelLayout === v.key ? 'var(--primary)' : 'var(--muted-foreground)',
                        cursor: 'pointer', transition: 'all 120ms',
                      }}>
                      <v.icon style={{ width: '14px', height: '14px' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: '1.5', marginBottom: '16px' }}>
                Add products from the catalog and configure quantities, discounts, and advanced settings for each line item.
              </div>
            </div>

            {/* Search + Filter row */}
            <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: 'var(--muted-foreground)' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." autoFocus
                    style={{ width: '100%', height: '36px', paddingLeft: '34px', paddingRight: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--foreground)', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'} onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  />
                </div>
                <FilterButton filters={filters} setFilters={setFilters} filteredCount={filteredProducts.length} />
              </div>
              <ActiveFilterTags filters={filters} setFilters={setFilters} />
            </div>

            {/* Product list — section headers are interleaved with the
                cards so the no-search state can show two sections
                ("Already on this Quote" + "Recently Ordered") without
                duplicating the giant card render block. Search mode
                stays single-section. */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px', minHeight: 0, scrollbarWidth: 'thin' as any }}>
              {(() => {
                /* "Recently Ordered" is capped at 6 so the no-search
                   state stays scannable; "Already on this Quote" sits
                   underneath as the user's own context. */
                const recentlyOrderedCapped = noSearchSections.recentlyOrdered.slice(0, 6);
                const noSearchEmpty = !search.trim() && recentlyOrderedCapped.length === 0 && noSearchSections.alreadyAdded.length === 0;
                const searchEmpty = !!search.trim() && searchResults.length === 0;
                /* Unified empty state — same chrome for "no search
                   match" and "fresh quote with no recent items".
                   Replaces the old `filteredProducts.length === 0`
                   ternary, which couldn't distinguish the two cases
                   and always showed "Try a different search term". */
                if (noSearchEmpty || searchEmpty) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', color: 'var(--muted-foreground)' }}>
                      <Package style={{ width: '32px', height: '32px', marginBottom: '12px', color: 'var(--border)' }} />
                      <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
                        {searchEmpty ? 'No items found' : 'No items to suggest yet'}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 400 }}>
                        {searchEmpty ? 'Try a different search term' : 'Search to add line items'}
                      </div>
                    </div>
                  );
                }
                /* Build a tagged list of headers + products so the
                   existing card-render map can stay inline. Empty
                   sections drop their headers entirely so the panel
                   doesn't render a "(0)" tag with no rows. */
                type Row = { kind: 'header'; label: string; count: number } | { kind: 'card'; product: Product };
                const rows: Row[] = search.trim()
                  ? [
                      { kind: 'header', label: 'Search Results', count: searchResults.length },
                      ...searchResults.map((p) => ({ kind: 'card' as const, product: p })),
                    ]
                  : [
                      ...(recentlyOrderedCapped.length > 0 ? [{ kind: 'header' as const, label: 'Recently Ordered', count: recentlyOrderedCapped.length }] : []),
                      ...recentlyOrderedCapped.map((p) => ({ kind: 'card' as const, product: p })),
                      ...(noSearchSections.alreadyAdded.length > 0 ? [{ kind: 'header' as const, label: 'Already on this Quote', count: noSearchSections.alreadyAdded.length }] : []),
                      ...noSearchSections.alreadyAdded.map((p) => ({ kind: 'card' as const, product: p })),
                    ];
                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rows.map((row, rowIdx) => {
                    if (row.kind === 'header') {
                      return (
                        <div
                          key={`h-${rowIdx}-${row.label}`}
                          style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1', marginBottom: '12px', marginTop: rowIdx === 0 ? '4px' : '12px', flexShrink: 0 }}
                        >
                          {row.label} <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '16px', padding: '0 5px', backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: '4px', fontSize: '11px', fontWeight: 600, lineHeight: '1', verticalAlign: 'middle', marginLeft: '4px' }}>{row.count}</span>
                        </div>
                      );
                    }
                    const product = row.product;
                    const added = isProductAdded(product.id);
                    const isExisting = existingProductIds.includes(product.id);
                    const addedQty = getSelectedQty(product.id);
                    const remaining = getRemainingStock(product.id);
                    const outOfStock = product.stockQuantity === 0 || remaining <= 0;
                    const tracking = getTrackingType(product);
                    const isDescExpanded = expandedDescs.has(product.id);
                    const needsMore = product.description.length > descTruncLen;
                    const itemNumbers = getItemNumbersForProduct(product.id);

                    return (
                      <div key={product.id}
                        ref={(el) => {
                          if (el) catalogRowRefsMap.current.set(product.id, el);
                          else catalogRowRefsMap.current.delete(product.id);
                        }}
                        style={{ position: 'relative', width: '100%', border: added ? '1px solid var(--success)' : '1px solid var(--border)', borderRadius: '6px', backgroundColor: added ? '#F0FDF4' : '#FFFFFF', transition: 'all 150ms', padding: 0, fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = added ? 'var(--success)' : 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.04)'; }}>
                        {/* Item numbers badge moved inline to Row 3 */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px' }}>
                          {/* Square thumbnail (8px radius) — clicking
                              opens the canonical ItemQuickView peek
                              modal. Same behaviour as Quote's items
                              list + SO line grid: thumb is the entry
                              point to the item record. */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); previewProduct(product); }}
                            title="Preview item"
                            aria-label={`Preview ${product.id}`}
                            style={{
                              width: 40, height: 40, borderRadius: 8,
                              backgroundColor: 'var(--muted)', border: '1px solid var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, overflow: 'hidden', padding: 0, cursor: 'pointer',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                          >
                            {product.images[0] ? <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package style={{ width: 18, height: 18, color: 'var(--border)' }} />}
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Row 1: SKU + pill + price */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1' }}><HighlightText text={product.id} searchTerm={search} /></span>
                                <InactiveItemPill code={product.id} size="md" noun="quote" />
                                {/* Canonical ItemTypeBadge — same spec
                                    as Quote/SO creation + SO details
                                    pickers. Was a bespoke span that
                                    drifted from the Partner pill chrome. */}
                                <ItemTypeBadge type={tracking.label} />
                              </div>
                              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)' }}>{formatCurrency(product.unitPrice)}</span>
                                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: '2px' }}>/ {findUomById(getPrimaryUomForProduct(product))?.name || 'EA'}</span>
                              </div>
                            </div>
                            {/* Row 2: Description */}
                            <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: '1.5', marginBottom: '4px' }}>
                              {isDescExpanded ? (
                                <><HighlightText text={product.description} searchTerm={search} />{' '}<span onClick={e => { e.stopPropagation(); setExpandedDescs(prev => { const n = new Set(prev); n.delete(product.id); return n; }); }} style={{ fontWeight: 500, color: 'var(--primary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>less <ChevronsUp style={{ width: '12px', height: '12px' }} /></span></>
                              ) : (
                                <><HighlightText text={needsMore ? product.description.slice(0, descTruncLen) + '…' : product.description} searchTerm={search} />{needsMore && <>{' '}<span onClick={e => { e.stopPropagation(); setExpandedDescs(prev => { const n = new Set(prev); n.add(product.id); return n; }); }} style={{ fontWeight: 500, color: 'var(--primary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>more <ChevronsDown style={{ width: '12px', height: '12px' }} /></span></>}</>
                              )}
                            </div>
                            {/* Row 3: Category + Stock + Added */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {/* Category + ATP pills follow Physical
                                    Inventory's tag spec: 13px label, 6px
                                    radius, 2px/8px padding, `--secondary`
                                    background, `--border` outline. Same
                                    as ControlTypeBadge so the row reads
                                    as a single pill family. */}
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', backgroundColor: 'var(--secondary)', padding: '2px 8px', borderRadius: 6, lineHeight: 'normal', border: '1px solid var(--border)' }}><HighlightText text={product.category} searchTerm={search} /></span>
                                {/* ATP reflects the product's static stock
                                    figure — what's available to promise
                                    independent of what the user has just
                                    selected on this dialog. Reducing it
                                    as the user adds units is misleading
                                    because the inventory hasn't actually
                                    been committed yet. */}
                                <InventoryTooltip stockQuantity={product.stockQuantity} remainingStock={product.stockQuantity}>
                                  <span
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      fontSize: 13, fontWeight: 500, lineHeight: 'normal',
                                      padding: '2px 8px', borderRadius: 6, cursor: 'default',
                                      color: product.stockQuantity === 0 ? 'var(--destructive)' : product.stockQuantity <= 5 ? 'var(--warning)' : 'var(--success)',
                                      backgroundColor: product.stockQuantity === 0 ? 'rgba(220, 38, 38, 0.10)' : product.stockQuantity <= 5 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(5, 150, 105, 0.10)',
                                      border: `1px solid ${product.stockQuantity === 0 ? 'rgba(220, 38, 38, 0.30)' : product.stockQuantity <= 5 ? '#FDE68A' : '#A7F3D0'}`,
                                    }}
                                  >
                                    {product.stockQuantity <= 0 ? '0 ATP' : `${product.stockQuantity} ATP`}
                                  </span>
                                </InventoryTooltip>
                              </div>
                              {/* Right cluster: "X EA | N lines" stat pill +
                                  +1 EA button. Pill sits to the left of
                                  the action so the qty/line counter reads
                                  as context for the button's effect. */}
                              {(
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1 }}>
                                  {itemNumbers.length > 0 && (
                                    <span
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '2px 8px',
                                        borderRadius: 6,
                                        fontSize: 13, fontWeight: 500,
                                        backgroundColor: '#EFF6FF',
                                        color: '#1D4ED8',
                                        border: '1px solid #BFDBFE',
                                        lineHeight: 'normal',
                                      }}
                                      title={`Line ${itemNumbers.length === 1 ? 'item' : 'items'} #${itemNumbers.join(', #')}`}
                                    >
                                      <Check style={{ width: 12, height: 12 }} />
                                      {/* UoM in the pill is derived
                                          from the actual lines on the
                                          quote for this product. When
                                          every line shares the same
                                          unit it surfaces verbatim;
                                          when lines differ (e.g. a
                                          duplicate was switched to
                                          Pallet) it collapses to
                                          "units" so the total isn't
                                          mis-labelled. */}
                                      {(() => {
                                        const linesForProduct = selectedItems.filter(i => i.productId === product.id);
                                        const uniqueUoms = new Set(linesForProduct.map(i => (i.uom || '').toLowerCase()).filter(Boolean));
                                        const pillUom = uniqueUoms.size > 1
                                          ? 'units'
                                          : (linesForProduct[0]?.uom || findUomById(getPrimaryUomForProduct(product))?.name || 'EA');
                                        return <span>{getTotalUsedStock(product.id)} {pillUom}</span>;
                                      })()}
                                      <span aria-hidden style={{ width: 1, height: 12, backgroundColor: 'rgba(29, 78, 216, 0.30)' }} />
                                      <span>{itemNumbers.length === 1 ? '1 line' : `${itemNumbers.length} lines`}</span>
                                    </span>
                                  )}
                                  {added ? (
                                    (() => {
                                      /* +1 / -1 button labels reflect the
                                         first existing line's UoM so the
                                         buttons read "+1 Box" / "-1 Box"
                                         on a Box-priced line. The -1
                                         button is rendered greyed out at
                                         qty <= 1 (matches Step3 — keeps
                                         layout stable so the buttons
                                         don't shuffle on the last
                                         decrement). */
                                      const firstExistingLine = selectedItems.find(i => i.productId === product.id);
                                      const buttonUomName = firstExistingLine?.uom || findUomById(getPrimaryUomForProduct(product))?.name || 'EA';
                                      const linesLocked = !!firstExistingLine?.isLocked;
                                      const canSubtract = !!firstExistingLine && firstExistingLine.quantity > 1 && !linesLocked;
                                      /* PO: an item deactivated after it was added
                                         keeps its line but takes no more quantity.
                                         Reducing stays allowed. */
                                      const canAdd = !linesLocked && !isItemInactive(product.id);
                                      return (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (canSubtract) handleSubtractQuantityFromExisting(product);
                                            }}
                                            disabled={!canSubtract}
                                            style={{
                                              display: 'inline-flex', alignItems: 'center', gap: 4,
                                              height: 28, padding: '0 10px', borderRadius: 6,
                                              fontSize: 12, fontWeight: 600, lineHeight: 1,
                                              backgroundColor: '#FFFFFF', color: 'var(--foreground)',
                                              border: '1px solid var(--border)',
                                              boxShadow: canSubtract ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                                              opacity: canSubtract ? 1 : 0.5,
                                              cursor: canSubtract ? 'pointer' : 'not-allowed',
                                              transition: 'all 150ms',
                                              fontFamily: 'Inter, system-ui, sans-serif',
                                            }}
                                            onMouseEnter={e => { if (canSubtract) { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#CBD5E1'; } }}
                                            onMouseLeave={e => { if (canSubtract) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = 'var(--border)'; } }}
                                            title={canSubtract ? `Remove one ${buttonUomName}` : linesLocked ? 'This line is locked.' : 'Remove the line with the Trash icon to drop the last unit'}
                                            aria-label={`Remove one ${buttonUomName}`}
                                          >
                                            <Minus style={{ width: 12, height: 12 }} />
                                            1 {buttonUomName}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (canAdd) handleAddQuantityToExisting(product);
                                            }}
                                            disabled={!canAdd}
                                            style={{
                                              display: 'inline-flex', alignItems: 'center', gap: 4,
                                              height: 28, padding: '0 10px', borderRadius: 6,
                                              fontSize: 12, fontWeight: 600, lineHeight: 1,
                                              backgroundColor: 'var(--primary)', color: '#FFFFFF',
                                              border: '1px solid var(--primary)',
                                              boxShadow: '0 1px 2px rgba(10, 119, 255, 0.30)',
                                              opacity: canAdd ? 1 : 0.5,
                                              cursor: canAdd ? 'pointer' : 'not-allowed',
                                              transition: 'all 150ms',
                                              fontFamily: 'Inter, system-ui, sans-serif',
                                            }}
                                            onMouseEnter={e => { if (canAdd) e.currentTarget.style.backgroundColor = '#0862D0'; }}
                                            onMouseLeave={e => { if (canAdd) e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
                                            title={isItemInactive(product.id) ? "Inactive items can't take more quantity" : `Add another ${buttonUomName}`}
                                            aria-label={`Add another ${buttonUomName}`}
                                          >
                                            <Plus style={{ width: 12, height: 12 }} />
                                            1 {buttonUomName}
                                          </button>
                                        </>
                                      );
                                    })()
                                  ) : (
                                    /* An inactive item can't start a new line, the PO rule.
                                       The button stays in place, unavailable, so the row
                                       keeps its shape and the pill beside the code says why. */
                                    isItemInactive(product.id) ? (
                                      <button
                                        type="button"
                                        disabled
                                        title="Inactive items can't be added to a quote"
                                        aria-label={`${product.id} is inactive and can't be added`}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', backgroundColor: '#F8FAFC', color: '#94A3B8', cursor: 'not-allowed', fontFamily: 'Inter, system-ui, sans-serif' }}
                                      >
                                        <Plus style={{ width: 12, height: 12 }} />
                                        Add
                                      </button>
                                    ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddProduct(product);
                                      }}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid rgba(10, 119, 255, 0.30)', backgroundColor: '#E7F3FF', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms' }}
                                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; e.currentTarget.style.color = '#FFFFFF'; }}
                                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#E7F3FF'; e.currentTarget.style.color = 'var(--primary)'; }}
                                    >
                                      <Plus style={{ width: 12, height: 12 }} />
                                      Add
                                    </button>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                );
              })()}
            </div>
          </div>

          {/* ── RIGHT: Selected Items ── */}
          {/* Right-panel background uses the same muted surface as
              Partner's selection panels (rgba on the slate-100 token)
              so the gray reads consistently across modules. */}
          <div style={{ ...rightStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'rgba(241, 245, 249, 0.65)' }}>
            {/* Quick Tips — only shown when no items selected and not dismissed */}
            {selectedItems.length === 0 && !quickTipsDismissed && (
              <>
                <div style={{ padding: '12px 20px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => setShowQuickTips(!showQuickTips)} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', padding: 0 }}>
                      <Lightbulb style={{ width: '14px', height: '14px', color: 'var(--muted-foreground)' }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)', lineHeight: '1' }}>Quick Tips</span>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={() => setQuickTipsDismissed(true)}
                        style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', borderRadius: '4px', color: 'var(--muted-foreground)', transition: 'color 100ms' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--foreground)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--muted-foreground)'}>
                        <X style={{ width: '12px', height: '12px' }} />
                      </button>
                      <button onClick={() => setShowQuickTips(!showQuickTips)}
                        style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                        <ChevronDown style={{ width: '12px', height: '12px', transition: 'transform 150ms', transform: showQuickTips ? 'rotate(180deg)' : 'none' }} />
                      </button>
                    </div>
                  </div>
                  {showQuickTips && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { text: <>Click <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>Advanced Configuration</span> to set pricing rules, shipment methods, and attachments</> },
                        { text: 'Green borders indicate products already added to the quote' },
                        { text: 'You can add the same product multiple times for different configurations' },
                      ].map((tip, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--primary)', marginTop: '5px', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: '1.5' }}>{tip.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ borderBottom: '1px solid var(--border)' }} />
              </>
            )}

            {/* Right header — QUOTE ITEMS (unified list) */}
            <div style={{ padding: '12px 20px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1' }}>Quote Items</span>
                  {selectedItems.length > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', overflow: 'hidden', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
                      <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 500, color: 'var(--foreground)' }}>{selectedItems.length}</span>
                    </div>
                  )}
                </div>
                {newItems.length > 0 && (
                  <button onClick={() => setSelectedItems(prev => prev.filter(i => isExisting(i.id)))} style={{ fontSize: '12px', fontWeight: 500, color: 'var(--destructive)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.1)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    Clear New
                  </button>
                )}
              </div>
            </div>

            {/* Right list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px', minHeight: 0, scrollbarWidth: 'thin' as any }}>
              {selectedItems.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '24px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <Package style={{ width: '28px', height: '28px', color: 'var(--muted-foreground)' }} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '4px' }}>No items selected</div>
                  <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted-foreground)' }}>Add products from the catalog</div>
                </div>
              ) : (
                <div style={gridCols ? { display: 'grid', gap: '8px', gridTemplateColumns: gridCols } : { display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedItems.map(item => {
                    const tracking = getTrackingType(item.product);
                    const isDuplicate = originalLineNums[item.id] != null;
                    const isDescExp = expandedSelectedDescs.has(item.id);
                    const needsMore = item.product.description.length > descTruncLen;
                    /* Honour the per-line UoM rescale — when the
                       user swaps from EA to Box (12×) inside the
                       picker the per-line unit price now reflects
                       that, so the total must read from
                       `item.unitPrice` when present and fall back to
                       the product's base price otherwise. */
                    const effectiveUnitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : item.product.unitPrice;
                    const total = item.quantity * effectiveUnitPrice;
                    const itemIsExisting = isExisting(item.id);

                    const isNewlyAdded = newlyAddedIds.has(item.id);
                    const isQtyBumped = qtyBumpIds.has(item.id);
                    return (
                      <div
                        key={item.id}
                        ref={(el) => {
                          if (el) cardRefsMap.current.set(item.id, el);
                          else cardRefsMap.current.delete(item.id);
                        }}
                        className={`${isNewlyAdded ? 'ppm-newly-added-card' : ''} ${isQtyBumped ? 'ppm-qty-bump-card' : ''}`.trim() || undefined}
                        style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '8px', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderLeft: item.isLocked ? '3px solid var(--warning)' : itemIsExisting ? '3px solid var(--success)' : '1px solid var(--border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' }}
                      >
                        {/* Item # badge */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: '8px', borderBottomRightRadius: '8px', fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--accent)', color: 'var(--primary)' }}>
                          {itemNumbers[item.id]}
                        </div>
                        {/* Delete — 28px tap-target with a hover tooltip
                            (`title=`) so the icon-only button explains
                            itself. Hidden when the row is locked
                            (shipped or post-conversion). */}
                        {!item.isLocked && (
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            title="Remove from quote"
                            aria-label="Remove line item"
                            style={{
                              position: 'absolute', top: '6px', right: '6px',
                              width: 28, height: 28,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--destructive)', borderRadius: 6, transition: 'background-color 120ms',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Trash2 style={{ width: '14px', height: '14px' }} />
                          </button>
                        )}
                        {item.isLocked && (
                          <span title="Locked — shipped or post-conversion" style={{ position: 'absolute', top: '8px', right: '8px', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '10px', fontWeight: 600, color: '#92400E', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '2px 6px', borderRadius: '999px', lineHeight: '1' }}>
                            <Lock style={{ width: '10px', height: '10px' }} />
                            Locked
                          </span>
                        )}
                        {/* SKU + pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', paddingLeft: '36px', paddingRight: '20px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1' }}>{item.productId}</span>
                          <InactiveItemPill code={item.productId} size="md" noun="quote" />
                          {/* Canonical ItemTypeBadge — same as catalog
                              side + the other three pickers. */}
                          <ItemTypeBadge type={tracking.label} />
                          {isDuplicate && (
                            /* Canonical Duplicate pill chrome — matches
                               ItemsTabTableClean + SO StatusBadge so every
                               "Duplicate of #N" reads identically (rounded-full,
                               11px / weight 500, white bg + #DDD6FE border). */
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, fontWeight: 500, color: '#7C3AED',
                              backgroundColor: '#FFFFFF', border: '1px solid #DDD6FE',
                              padding: '2px 10px', borderRadius: 9999, lineHeight: 1.4,
                              whiteSpace: 'nowrap',
                            }}>
                              <Layers style={{ width: 11, height: 11, flexShrink: 0 }} />
                              Duplicate of #{originalLineNums[item.id]}
                            </span>
                          )}

                        </div>
                        {/* Image + desc — thumb opens ItemQuickView peek. */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); previewProduct(item.product); }}
                            title="Preview item"
                            aria-label={`Preview ${item.productId}`}
                            style={{
                              width: 36, height: 36, borderRadius: 8,
                              backgroundColor: 'var(--muted)', border: '1px solid var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0, overflow: 'hidden', padding: 0, cursor: 'pointer',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                          >
                            {item.product.images[0] ? <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package style={{ width: 16, height: 16, color: 'var(--border)' }} />}
                          </button>
                          <div style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: '1.5' }}>
                            {isDescExp ? (
                              <>{item.product.description}{' '}<span onClick={() => setExpandedSelectedDescs(p => { const n = new Set(p); n.delete(item.id); return n; })} style={{ fontWeight: 500, color: 'var(--primary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>less <ChevronsUp style={{ width: '12px', height: '12px' }} /></span></>
                            ) : (
                              <>{needsMore ? item.product.description.slice(0, descTruncLen) + '…' : item.product.description}{needsMore && <>{' '}<span onClick={() => setExpandedSelectedDescs(p => { const n = new Set(p); n.add(item.id); return n; })} style={{ fontWeight: 500, color: 'var(--primary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>more <ChevronsDown style={{ width: '12px', height: '12px' }} /></span></>}</>
                            )}
                          </div>
                        </div>
                        {/* Qty + UoM capsule (same chrome as creation
                            flow's right-side cards) + total. The
                            capsule renders only this product's UoM
                            set; the primary is tagged with a
                            "PRIMARY" pill. Locked rows render the
                            capsule disabled. */}
                        {(() => {
                          const itemSet = getUomSetForProduct(item.product);
                          const itemPrimary = getPrimaryUomForProduct(item.product);
                          const itemUomLabel = itemSet.find(u => u.id === (item.uom || itemPrimary).toLowerCase() || u.name.toLowerCase() === (item.uom || '').toLowerCase())?.name || itemSet[0].name;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '4px', lineHeight: '1' }}>Quantity</div>
                                <QtyUomCapsule
                                  qty={item.quantity}
                                  uom={item.uom || itemPrimary}
                                  uomSet={itemSet}
                                  primaryUomId={itemPrimary}
                                  onChangeQty={(next) => handleSetQuantity(item.id, next)}
                                  onChangeUom={(id) => handleSetUom(item.id, id)}
                                  disabled={!!item.isLocked}
                                  bumped={isQtyBumped}
                                />
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', marginBottom: '4px', lineHeight: '1' }}>Item Total</div>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1' }}>
                                  {formatCurrency(total)} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted-foreground)' }}>({itemUomLabel})</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Config button — opens the shared LineItemConfigModal.
                            Locked rows still allow opening it in read-only
                            (the configurator itself enforces readOnly when
                            quote is converted). */}
                        {/* Partner-secondary chrome: white surface (not
                            the gray --background token), 36px tall, black
                            label, resting 1px shadow + slate border;
                            hover elevates to primary tint with deeper
                            shadow. Matches the creation flow exactly. */}
                        <button
                          onClick={() => setConfiguringItemId(item.id)}
                          style={{
                            width: '100%',
                            height: 36,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--card)',
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--foreground)',
                            cursor: 'pointer',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            transition: 'all 150ms',
                            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.color = 'var(--primary)';
                            e.currentTarget.style.backgroundColor = '#F0F7FF';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(10, 119, 255, 0.12)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--foreground)';
                            e.currentTarget.style.backgroundColor = 'var(--card)';
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(15, 23, 42, 0.06)';
                          }}
                        >
                          <Pencil style={{ width: '13px', height: '13px' }} />
                          {item.isLocked ? 'View Configuration' : 'Advanced Configuration'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ FOOTER — full width ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--muted)', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontWeight: 400 }}>
            {newItems.length > 0 ? (
              <>New subtotal: <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '16px' }}>{formatCurrency(newItems.reduce((s, i) => s + i.quantity * i.product.unitPrice, 0))}</span> <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>({newItems.length} new{hasExistingEdits ? ` · ${existingItemEdits.length} edited` : ''} · {existingCount} existing)</span></>
            ) : hasExistingEdits ? (
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                {existingItemEdits.length} change{existingItemEdits.length !== 1 ? 's' : ''} pending on existing item{existingItemEdits.length !== 1 ? 's' : ''}
              </span>
            ) : existingCount > 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{existingCount} existing item{existingCount !== 1 ? 's' : ''} in quote</span>
            ) : `${filteredProducts.length} products available`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={onClose}
              style={{ height: '32px', padding: '0 16px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1' }}>
              Cancel
            </button>
            {/* The commit button stays active as long as the user has
                staged any new line OR any qty/remove edit on an
                existing line. The only hard block is `quoteIsConverted`,
                which lives on the parent SO at that point and so the
                quote-side picker can't accept any line edits. Edits in
                Sent / Confirmed states flow through the auto-version
                gate at the parent. */}
            <button
              onClick={handleAdd}
              disabled={quoteIsConverted || !hasPendingChanges}
              title={quoteIsConverted ? 'Quote has been converted to a Sales Order. Edit lines on the sales order instead.' : undefined}
              style={{ height: '32px', padding: '0 20px', borderRadius: '6px', border: 'none', backgroundColor: (quoteIsConverted || !hasPendingChanges) ? 'rgba(10, 119, 255, 0.4)' : 'var(--primary)', fontSize: '13px', fontWeight: 600, color: '#FFFFFF', cursor: (quoteIsConverted || !hasPendingChanges) ? 'not-allowed' : 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms' }}
              onMouseEnter={e => { if (!quoteIsConverted && hasPendingChanges) e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={e => { if (!quoteIsConverted && hasPendingChanges) e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
            >
              {(() => {
                const totalChanges = newItems.length + existingItemEdits.length;
                if (newItems.length > 0 && hasExistingEdits) {
                  return `Apply ${totalChanges} change${totalChanges !== 1 ? 's' : ''}`;
                }
                if (newItems.length > 0) {
                  return `Add ${newItems.length} Item${newItems.length !== 1 ? 's' : ''} to Quote`;
                }
                if (hasExistingEdits) {
                  return `Apply ${existingItemEdits.length} change${existingItemEdits.length !== 1 ? 's' : ''}`;
                }
                return 'Add to Quote';
              })()}
            </button>
          </div>
        </div>
      </div>

      {/* Duplicate Line Item Confirmation Modal */}
      {pendingDuplicateProduct && (
        <ConfirmationModal
          isOpen={true}
          title="Duplicate Line Item"
          message={`This will create a new separate line item for "${pendingDuplicateProduct.name}". There ${selectedItems.filter(i => i.productId === pendingDuplicateProduct.id).length === 1 ? 'is already 1 line' : `are already ${selectedItems.filter(i => i.productId === pendingDuplicateProduct.id).length} lines`} for this product. Each duplicate can have its own quantity and configuration.`}
          confirmText="Yes, Duplicate"
          cancelText="Cancel"
          onConfirm={() => {
            handleAddProduct(pendingDuplicateProduct);
            setPendingDuplicateProduct(null);
          }}
          onCancel={() => setPendingDuplicateProduct(null)}
          variant="yellow"
          icon={<Copy className="w-6 h-6 text-white" />}
        />
      )}

      {/* Advanced Configurator — opened from the per-card "Advanced
          Configuration" button on the right panel. Mirrors SO's
          AddLineItemDialog → AdvancedConfiguratorModal wiring. The
          modal is portaled to document.body internally so it sits
          above this picker's backdrop without stacking-context issues. */}
      {configuringItemId && (() => {
        const sel = selectedItems.find((i) => i.id === configuringItemId);
        if (!sel) return null;
        const subtotal = sel.quantity * sel.product.unitPrice;
        return (
          <LineItemConfigModal
            isOpen
            onClose={() => setConfiguringItemId(null)}
            /* Locked lines open the configurator in read-only — same
               state used when the quote itself is fully read-only. */
            readOnly={sel.isLocked}
            item={{
              id: sel.id,
              productId: sel.product.id,
              name: sel.product.name,
              description: sel.product.description,
              quantity: sel.quantity,
              unitPrice: sel.product.unitPrice,
              discount: 0,
              total: subtotal,
              image: sel.product.images?.[0],
              images: sel.product.images,
              sku: sel.product.id,
            }}
            onSave={(updated: any) => {
              /* Drop the save silently on locked lines (defensive — the
                 modal is read-only there, but a save path could be
                 reached programmatically). */
              if (sel.isLocked) {
                setConfiguringItemId(null);
                return;
              }
              const nextQty = updated.quantity ?? sel.quantity;
              setSelectedItems((prev) =>
                prev.map((i) =>
                  i.id === configuringItemId
                    ? { ...i, quantity: nextQty }
                    : i,
                ),
              );
              // Material change on a saved line: bubble up.
              if (isExisting(configuringItemId) && nextQty !== sel.quantity) {
                onMaterialChange?.(`Reconfigured "${sel.product.name}" (qty ${sel.quantity} → ${nextQty})`);
              }
              setConfiguringItemId(null);
            }}
          />
        );
      })()}
      {/* Item peek modal — rendered last so it stacks above everything. */}
      {itemQuickViewModal}
    </div>
  , document.body);
}
