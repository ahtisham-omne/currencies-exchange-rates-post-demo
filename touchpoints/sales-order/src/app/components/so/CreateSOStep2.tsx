import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, Trash2, Search, Check, Package, Pencil, ChevronDown, ChevronsDown, ChevronsUp, LayoutList, Grid2x2, AlertCircle, Lightbulb, Layers, Copy } from 'lucide-react';

/* Bug B1: file-scoped quantity stepper. Same shape as the Quote
   module's Step3LineItems QtyStepper — explicit −/+ buttons plus a
   freely-editable input that only clamps on blur/Enter. */
function QtyStepper({ value, onChange, min = 1, max, ariaLabel = 'Quantity' }: {
  value: number; onChange: (next: number) => void; min?: number; max?: number; ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) { setDraft(String(value)); return; }
    let next = parsed;
    if (typeof max === 'number' && next > max) next = max;
    if (next < min) next = min;
    if (next !== value) onChange(next);
    setDraft(String(next));
  };
  const step = (delta: number) => {
    let next = value + delta;
    if (typeof max === 'number' && next > max) next = max;
    if (next < min) next = min;
    if (next !== value) onChange(next);
  };
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'inline-flex', alignItems: 'center', height: 32, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={value <= min}
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
          const v = e.target.value.replace(/[^0-9]/g, '');
          setDraft(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setDraft(String(value)); (e.target as HTMLInputElement).blur(); }
        }}
        style={{
          width: 44, height: '100%', border: 'none', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)',
          textAlign: 'center', fontSize: 'var(--text-caption)', color: 'var(--foreground)', background: 'transparent', outline: 'none', padding: 0,
        }}
      />
      <button
        type="button"
        onClick={() => step(+1)}
        disabled={typeof max === 'number' && value >= max}
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
import { CATALOG, useSOStore } from './store';
import { ATPTooltip } from './ATPTooltip';
import { ItemTypeBadge, DuplicateBadge } from './StatusBadge';
import { isItemInactive } from '../shared/inactiveItems';
import { ConfirmationDialog } from './ui/DiscardChangesDialog';
import { AdvancedConfiguratorModal } from './AdvancedConfiguratorModal';
import { useItemQuickView, type ItemQuickViewItem } from '@/app/components/shared/ItemQuickView';
import { getLineItemImage } from './lineItemImage';

/* ═══ Extended catalog for this step ═══
   Adds a handful of varied-prefix items ("001-100-…", "002-100-…") so
   searches don't dead-end on a single "000-" prefix. Production
   catalogues span many class-codes; the demo seed mirrors that so
   users testing search by partial id ("001-100", "002-") see hits. */
/* Five of the inline SKUs below (001-100-010, 001-100-022,
   001-100-070, 002-100-001, 002-100-014) also live in `CATALOG`.
   Spreading both produced duplicate entries with the same `.code`,
   which React then rendered with colliding `key={product.code}`
   props — the second card stayed visually "not-added" even after
   the user had already added the first one, so the +1 / -1 toggle
   never appeared. Dedupe by code with first-occurrence wins so the
   catalog has exactly one card per SKU. */
export const EXTENDED_CATALOG = (() => {
  const merged = [
    ...CATALOG,
    { code: "000-100-004", name: "Express 3500 cutaway with 159\" WB, 6.6L V8 Duramax turbo-diesel, heavy-duty Allison 1000 6-speed automatic, ambulance prep package with dual batteries, 220A alternator, engine exhaust brake, and prewired harness for body-builder upfit including rear HVAC, lighting circuits, and OBD-II telematics tap", description: "Pre-wired for ambulance conversion", type: "Serialized" as const, unitPrice: 44100, category: "Base Vehicles", inStock: 57 },
    { code: "000-100-005", name: "F-550 4x4 crew cab, 84\" CA, 7.3L V8 gas engine, 19,500 GVWR, PTO-ready with live-drive provision, ideal for rescue/utility body mounting, includes factory upfitter switches, auxiliary fuse panel, heavy-duty tow package with integrated brake controller, and chassis-mounted outrigger brackets for aerial or crane operations", description: "Heavy-duty rescue utility platform", type: "Serialized" as const, unitPrice: 58900, category: "Base Vehicles", inStock: 68 },
    { code: "001-100-010", name: "Whelen Cencom Carbide siren controller, 200W dual-tone capable, four hardwired light outputs with separate flash patterns, programmable park-kill, manual override switch, includes mounting bracket and 12-pin Deutsch connector harness for clean install in an ambulance dash cluster", description: "Carbide siren + light controller with park-kill", type: "Non-Serialized" as const, unitPrice: 925, category: "Audio", inStock: 42 },
    { code: "001-100-022", name: "Federal Signal Pathfinder dual-color LED beacon, surface-mount with low-profile aerodynamic housing, dual-color red/white split with synchronized flash patterns, SAE J845 Class 1, 12-24V universal input, 5-year warranty for fleet rooftop installations", description: "Dual-color LED beacon, SAE J845 Class 1", type: "Non-Serialized" as const, unitPrice: 415, category: "Lighting", inStock: 78 },
    { code: "001-100-070", name: "Knaack 60\" job-site weatherproof storage box for spare oxygen cylinders, locks for security, mounted to the cabinet rail, ventilation grilles for safe storage of compressed gas in the patient compartment of an ambulance, MIL-STD-810 rated against vibration and shock", description: "Weatherproof O2 cylinder storage", type: "Non-Serialized" as const, unitPrice: 685, category: "Storage", inStock: 36 },
    { code: "002-100-001", name: "Kenwood NX-5800 P25 Phase II mobile transceiver, 700/800 MHz with TDMA, AES-256 encryption, integrated GPS and Bluetooth, designed for first-responder use with priority-scan, emergency button, MIL-STD-810G environmental sealing", description: "P25 Phase II mobile transceiver, AES-256", type: "Serialized" as const, unitPrice: 4250, category: "Communications", inStock: 24 },
    { code: "002-100-014", name: "Stryker Power-LOAD cot fastener system for ambulances, integrates with Power-PRO XT, lifts and lowers automatically to reduce caregiver lifting injuries, includes mounting plate, hydraulic actuator, and safety harness anchors", description: "Power-LOAD cot fastener with safety anchors", type: "Serialized" as const, unitPrice: 22800, category: "Patient Care", inStock: 12 },
  ];
  const seen = new Set<string>();
  return merged.filter((p) => {
    if (seen.has(p.code)) return false;
    seen.add(p.code);
    return true;
  });
})();

/* ═══ Types ═══ */
export interface SOLineItem {
  id: string;
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  uom?: string;
}

export interface Step2Props {
  lineItems: SOLineItem[];
  onLineItemsChange: (items: SOLineItem[]) => void;
  hasCustomer: boolean;
}

/* UoM data layer — central `data/uomSets` module is the source of
   truth across the whole module. `UNITS_OF_MEASURE` is kept as the
   discrete-set alias so unconverted call sites keep working until
   they switch to per-product lookups. */
import {
  UOM_SETS,
  type UomOption as ImportedUomOption,
  getUomSetForProduct,
  getPrimaryUomForProduct,
  findUomById,
  multiplierWithinSet,
} from '../../data/uomSets';
import { useDocCurrency, useDocMoney } from "@/app/components/currency/docCurrencyContext";
import { localTodayIso } from "@/app/currency/soFx";
import { restateDesign } from "./soMoney";
const UNITS_OF_MEASURE = UOM_SETS.discrete;
type UomOption = ImportedUomOption;

/* Combined Qty + UoM capsule — mirrors the chrome of the SO line
   items table's QtyUomCapsule. One bordered chip with a typeable qty
   on the left, a vertical hairline divider, and a UoM dropdown trigger
   on the right so the two controls read as a single capsule. Used on
   the right-side selected-items card. The chosen UoM rescales the
   unit price upstream so the configurator and the eventual SO line
   item see the same value. */
function QtyUomCapsule({
  qty,
  uom,
  onChangeQty,
  onChangeUom,
  /* When the parent flags the capsule as just-bumped, we attach the
     `so-qty-bump-capsule` class so the bordered chip flashes its own
     green ring + tint for ~1.1 s. Tells the user exactly which box
     changed when the −/+ EA buttons fire from the left card. */
  bumped = false,
  /* Per-product UoM list + primary id. When omitted the capsule falls
     back to the discrete set for backwards-compatibility. */
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
  /* Viewport-space coordinates so the portalled panel anchors under
     the trigger. Portal escapes the right card's overflow which was
     clipping the first character of the option labels. */
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
      className={`relative inline-flex items-stretch ${bumped ? 'so-qty-bump-capsule' : ''}`}
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

export function CreateSOStep2({ lineItems, onLineItemsChange, hasCustomer }: Step2Props) {
  const { inventory } = useSOStore();
  /* The order will be in the customer's currency (CreateSOModal provides
     it): catalog list prices, written in USD, are shown and added in it at
     today's mid-market rate, the rate the new order takes. */
  const formatCurrency = useDocMoney();
  const { currency } = useDocCurrency();
  const listPrice = useCallback((usd: number) => restateDesign(usd, currency, localTodayIso()), [currency]);

  /* Item peek modal — opens when the user taps any catalog or
     selected-card thumbnail. Same chrome as the SO details picker. */
  const { open: openItemQuickView, modal: itemQuickViewModal } = useItemQuickView();
  const previewCatalogProduct = (product: any) => {
    const peek: ItemQuickViewItem = {
      code: product.code,
      description: product.name,
      primaryTag: `Primary: ${product.type}`,
      material: product.category,
      uom: findUomById(getPrimaryUomForProduct(product))?.name || 'EA',
      onHand: product.inStock,
      metrics: [
        { label: 'Unit Price', value: formatCurrency(listPrice(product.unitPrice)), caption: 'Unit Price' },
        ...(typeof product.inStock === 'number'
          ? [{ label: 'In Stock', value: `${product.inStock.toLocaleString()} ${findUomById(getPrimaryUomForProduct(product))?.name || 'EA'}`, caption: 'In Stock' }]
          : []),
      ],
    };
    openItemQuickView(peek);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [expandedProductDescriptions, setExpandedProductDescriptions] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState<'narrow' | 'wide'>('narrow');
  const [stockAlert, setStockAlert] = useState<{ message: string; productId: string } | null>(null);
  const [showQuickTips, setShowQuickTips] = useState(true);
  const [quickTipsDismissed, setQuickTipsDismissed] = useState(false);
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const [qtyBumpIds, setQtyBumpIds] = useState<Set<string>>(new Set());
  const [pendingDuplicateId, setPendingDuplicateId] = useState<string | null>(null);
  const [configItemId, setConfigItemId] = useState<string | null>(null);
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyBumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  /* Dash/whitespace tolerant: searching "000-100" or "000100" or
     "100-" all match item codes like "000-100-001". Both raw and
     normalized substring checks run. */
  const displayProducts = useMemo(() => {
    const raw = searchQuery.trim().toLowerCase();
    /* No-search "Recently Ordered" filters on the `isRecentlyOrdered`
       catalog flag so the panel reflects the customer's familiar SKUs
       instead of an arbitrary head-of-catalogue slice. Capped at 12
       so the cross-set variety (a couple of liquid + length items
       beyond the discrete chassis/lightbar/etc.) is visible without
       searching; the full catalogue is still reachable via search. */
    /* Creation never offers an inactive item: it can't start a new line,
       so it isn't shown at all rather than shown and refused. The edit
       dialog keeps the pill, because an item can go inactive after it was
       added. Filtered before the search and the 12-item cap. */
    const catalog = EXTENDED_CATALOG.filter(p => !isItemInactive(p.code));
    if (!raw) return catalog.filter(p => p.isRecentlyOrdered).slice(0, 12);
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const qNorm = normalize(searchQuery);
    const matches = (text: string | undefined) => {
      if (!text) return false;
      const t = text.toLowerCase();
      if (t.includes(raw)) return true;
      return qNorm.length > 0 && normalize(text).includes(qNorm);
    };
    return catalog.filter(p =>
      matches(p.code) ||
      matches(p.name) ||
      matches(p.description) ||
      matches(p.category),
    );
  }, [searchQuery]);

  const isProductAdded = (productId: string) => lineItems.some(i => i.productId === productId);

  const getTotalQuantityForProduct = (productId: string): number =>
    lineItems.filter(i => i.productId === productId).reduce((sum, i) => sum + i.quantity, 0);

  const getLineItemCountForProduct = (productId: string): number =>
    lineItems.filter(i => i.productId === productId).length;

  const getRemainingStock = (productId: string): number => {
    const product = EXTENDED_CATALOG.find(p => p.code === productId);
    if (!product) return 0;
    return product.inStock - getTotalQuantityForProduct(productId);
  };

  const handleAddProduct = useCallback((product: typeof EXTENDED_CATALOG[0]) => {
    if (isItemInactive(product.code)) return;
    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    /* Seed with the product's primary UoM so the capsule opens on
       the right unit immediately (Liter for liquids, Foot for length,
       EA for the discrete majority). */
    const primaryUom = findUomById(getPrimaryUomForProduct(product));
    const newItem: SOLineItem = {
      id: newId, productId: product.code, name: product.name, description: product.description,
      quantity: 1, unitPrice: listPrice(product.unitPrice), discount: 0, total: listPrice(product.unitPrice),
      uom: primaryUom?.name || 'EA',
    };

    const lastIndex = lineItems.map(i => i.productId).lastIndexOf(product.code);
    const isDuplicate = lastIndex !== -1;

    if (isDuplicate) {
      const updated = [...lineItems];
      updated.splice(lastIndex + 1, 0, newItem);
      onLineItemsChange(updated);
      toast.custom((tid) => (
        <div onClick={() => toast.dismiss(tid)} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-card border border-border rounded-lg shadow-lg cursor-pointer" style={{ width: 320 }}>
          <div className="w-7 h-7 rounded-md bg-chart-4/12 border border-chart-4/20 flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5 text-chart-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-foreground truncate" style={{ fontSize: 'var(--text-caption)', fontWeight: 'var(--font-weight-semibold)' }}>Duplicate of {product.code} added</div>
            <div className="text-muted-foreground" style={{ fontSize: 'var(--text-micro)', marginTop: 2 }}>Item already exists - added as a separate line</div>
          </div>
        </div>
      ), { position: 'top-right', duration: 3000 });
    } else {
      onLineItemsChange([...lineItems, newItem]);
    }

    /* Fresh line adds only fire the newly-added flash. Skipping the
       qty-bump flash on the same element avoids a class-list churn
       (qty-bump timer clearing before the newly-added one) that reads
       as an all-cards re-flash mid-animation. */
    setNewlyAddedIds(prev => new Set([...prev, newId]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 4500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(newId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [lineItems, onLineItemsChange, listPrice]);

  const handleAddQuantityToExisting = useCallback((product: typeof EXTENDED_CATALOG[0]) => {
    if (isItemInactive(product.code)) return;
    const existingItem = lineItems.find(i => i.productId === product.code);
    if (!existingItem) return;
    onLineItemsChange(lineItems.map(item =>
      item.id === existingItem.id
        ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
        : item
    ));
    /* Increment on an existing line only fires the qty-bump flash
       (card + capsule). Not a new card, so newly-added does not fire. */
    setQtyBumpIds(prev => new Set([...prev, existingItem.id]));
    if (qtyBumpTimerRef.current) clearTimeout(qtyBumpTimerRef.current);
    qtyBumpTimerRef.current = setTimeout(() => setQtyBumpIds(new Set()), 3500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(existingItem.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [lineItems, onLineItemsChange]);

  /* Mirror of handleAddQuantityToExisting — subtracts one unit. Only
     wired through the -1 EA button which is itself gated on quantity
     > 1, so removal flows through the explicit Trash icon. */
  const handleSubtractQuantityFromExisting = useCallback((product: typeof EXTENDED_CATALOG[0]) => {
    const existingItem = lineItems.find(i => i.productId === product.code);
    if (!existingItem || existingItem.quantity <= 1) return;
    onLineItemsChange(lineItems.map(item =>
      item.id === existingItem.id
        ? { ...item, quantity: item.quantity - 1, total: (item.quantity - 1) * item.unitPrice }
        : item
    ));
    setQtyBumpIds(prev => new Set([...prev, existingItem.id]));
    if (qtyBumpTimerRef.current) clearTimeout(qtyBumpTimerRef.current);
    qtyBumpTimerRef.current = setTimeout(() => setQtyBumpIds(new Set()), 3500);
  }, [lineItems, onLineItemsChange]);

  /* UoM change rescales the unit price by the conversion factor so
     the configurator and the eventual SO line item see a value that
     stays consistent with the underlying item cost. Total recomputes
     from the rescaled price. */
  const handleUomChange = useCallback((itemId: string, newUomId: string) => {
    const item = lineItems.find(i => i.id === itemId);
    if (!item) return;
    /* Resolve multipliers within the product's UoM set — a Liter and
       a Box never interconvert. */
    const product = EXTENDED_CATALOG.find(p => p.code === item.productId);
    const itemSet = product ? getUomSetForProduct(product) : UNITS_OF_MEASURE;
    const oldMult = multiplierWithinSet(item.uom, itemSet);
    const newMult = multiplierWithinSet(newUomId, itemSet);
    if (oldMult === newMult) {
      onLineItemsChange(lineItems.map(li => li.id === itemId ? { ...li, uom: newUomId } : li));
      return;
    }
    const scaledUnitPrice = (item.unitPrice * newMult) / oldMult;
    onLineItemsChange(lineItems.map(li =>
      li.id === itemId
        ? { ...li, uom: newUomId, unitPrice: scaledUnitPrice, total: scaledUnitPrice * li.quantity * (1 - (li.discount || 0) / 100) }
        : li
    ));
  }, [lineItems, onLineItemsChange]);

  const handleRemoveItem = useCallback((itemId: string) => {
    onLineItemsChange(lineItems.filter(i => i.id !== itemId));
  }, [lineItems, onLineItemsChange]);

  const handleDuplicateItem = useCallback((itemId: string) => {
    const sourceItem = lineItems.find(i => i.id === itemId);
    if (!sourceItem) return;
    const product = EXTENDED_CATALOG.find(p => p.code === sourceItem.productId);
    if (!product) return;
    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newItem: SOLineItem = { ...sourceItem, id: newId, quantity: 1, total: sourceItem.unitPrice * (1 - (sourceItem.discount || 0) / 100) };
    const sourceIndex = lineItems.findIndex(i => i.id === itemId);
    const updated = [...lineItems];
    updated.splice(sourceIndex + 1, 0, newItem);
    onLineItemsChange(updated);
    toast.custom((tid) => (
      <div onClick={() => toast.dismiss(tid)} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-card border border-border rounded-lg shadow-lg cursor-pointer" style={{ width: 320 }}>
        <div className="w-7 h-7 rounded-md bg-chart-4/12 border border-chart-4/20 flex items-center justify-center shrink-0">
          <Layers className="w-3.5 h-3.5 text-chart-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-foreground" style={{ fontSize: 'var(--text-caption)', fontWeight: 'var(--font-weight-semibold)' }}>Line item duplicated</div>
          <div className="text-muted-foreground" style={{ fontSize: 'var(--text-micro)', marginTop: 2 }}>{product.code} - added as a separate line</div>
        </div>
      </div>
    ), { position: 'top-right', duration: 3000 });
    setNewlyAddedIds(prev => new Set([...prev, newId]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 4500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(newId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [lineItems, onLineItemsChange]);

  const handleRemoveAll = useCallback(() => { onLineItemsChange([]); }, [onLineItemsChange]);

  const handleUpdateQuantity = useCallback((itemId: string, change: number) => {
    const item = lineItems.find(i => i.id === itemId);
    if (!item) return;
    const newQty = Math.max(1, item.quantity + change);
    onLineItemsChange(lineItems.map(li =>
      li.id === itemId ? { ...li, quantity: newQty, total: newQty * li.unitPrice * (1 - li.discount / 100) } : li
    ));
  }, [lineItems, onLineItemsChange]);

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  // Sequential numbering with duplicate tracking
  const getItemMeta = () => {
    const numbers: { [itemId: string]: string } = {};
    const originalItemNumbers: { [itemId: string]: number | null } = {};
    const firstOccurrence: { [productId: string]: number } = {};
    lineItems.forEach((item, index) => {
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

  const sidebarStyle = sidebarWidth === 'narrow'
    ? { width: '30%', flexGrow: 0, flexShrink: 0 }
    : { width: '70%', flexGrow: 0, flexShrink: 0 };

  const leftSideClass = sidebarWidth === 'wide' ? '' : 'flex-1';

  // Show empty state if no customer selected
  if (!hasCustomer) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: 'var(--secondary)' }}>
        <div className="text-center max-w-md px-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <Package className="w-8 h-8" style={{ color: 'var(--foreground)', opacity: 0.25 }} />
          </div>
          <h3 style={{ fontSize: 'var(--text-label)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)', marginBottom: 8 }}>
            Select a Customer First
          </h3>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--foreground)', opacity: 0.5 }}>
            Before adding items to your sales order, please select a customer and primary contact.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Card highlight animations — both states use green so adding
          a new line and bumping its quantity read as the same family
          of feedback (matches the Quote module). The QtyUomCapsule
          itself picks up a 1.1 s green-ring flash via `.so-qty-bump-
          capsule` so the user always sees the exact box that changed. */}
      <style>{`
        @keyframes soNewCard {
          0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.22); background-color: rgba(254, 249, 195, 0.55); border-color: rgba(5, 150, 105, 0.65); }
          30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.22); background-color: var(--card); border-color: rgba(5, 150, 105, 0.65); }
          80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 18px 6px rgba(5, 150, 105, 0.22); background-color: var(--card); border-color: rgba(5, 150, 105, 0.65); }
          100% { box-shadow: var(--elevation-1); background-color: var(--card); border-color: var(--border); }
        }
        .so-newly-added-card { animation: soNewCard 4000ms linear forwards !important; }

        @keyframes soQtyBump {
          0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: rgba(254, 249, 195, 0.50); border-color: rgba(5, 150, 105, 0.65); }
          30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: var(--card); border-color: rgba(5, 150, 105, 0.65); }
          80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55), 0 0 14px 4px rgba(5, 150, 105, 0.20); background-color: var(--card); border-color: rgba(5, 150, 105, 0.65); }
          100% { box-shadow: var(--elevation-1); background-color: var(--card); border-color: var(--border); }
        }
        .so-qty-bump-card { animation: soQtyBump 2600ms linear forwards; }

        @keyframes soQtyCapsuleFlash {
          0%   { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: rgba(254, 249, 195, 0.60); }
          30%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: var(--card); }
          80%  { box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.55); border-color: rgba(5, 150, 105, 0.70); background-color: var(--card); }
          100% { box-shadow: none; border-color: var(--border); background-color: var(--card); }
        }
        .so-qty-bump-capsule { animation: soQtyCapsuleFlash 2400ms linear forwards; }

        /* ── Catalog card — subtle rest shadow, denser on hover ── */
        .so-catalog-card {
          transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
          box-shadow: var(--elevation-1);
        }
        .so-catalog-card:hover:not(.so-catalog-card-disabled) {
          background-color: var(--primary-tint-card) !important;
          border-color: var(--primary) !important;
          box-shadow: var(--elevation-2);
          transform: translateY(-1px);
        }
        /* Added cards keep accent border on hover but still blue bg */
        .so-catalog-card-added {
          background-color: var(--accent-tint-card) !important;
        }
        .so-catalog-card-added:hover:not(.so-catalog-card-disabled) {
          background-color: var(--accent-tint-hover) !important;
          border-color: var(--success) !important;
        }
        /* Show +Add hint on catalog card hover (first-instance only) */
        .so-catalog-card:hover:not(.so-catalog-card-disabled) .so-add-hint {
          opacity: 1 !important;
        }

        /* ── Selected item card — subtle rest shadow, no card-level hover ── */
        .so-selected-card {
          box-shadow: var(--elevation-1);
        }
        /* Reveal action icons on card hover */
        .so-selected-card:hover .so-card-action { opacity: 0.6 !important; }
        .so-selected-card .so-card-action {
          transition: opacity 150ms ease, background-color 150ms ease, transform 150ms ease;
          border-radius: 4px;
        }
        .so-selected-card .so-card-action:hover {
          opacity: 1 !important;
          background-color: var(--secondary);
          transform: scale(1.1);
        }

        /* ── Config button hover — light blue bg ── */
        .so-config-btn {
          transition: border-color 180ms ease, color 180ms ease, opacity 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
        }
        .so-config-btn:hover {
          border-color: var(--primary) !important;
          color: var(--primary) !important;
          opacity: 1 !important;
          background: var(--primary-hover-bg) !important;
          box-shadow: var(--elevation-1);
        }

        /* ── Smooth panel resize transitions ── */
        .so-panel-left,
        .so-panel-right {
          transition: width 350ms cubic-bezier(0.4, 0, 0.2, 1),
                      flex 350ms cubic-bezier(0.4, 0, 0.2, 1),
                      padding 350ms cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* Left: Product Catalog */}
      <div
        className={`so-panel-left flex flex-col overflow-hidden py-6 ${leftSideClass} ${sidebarWidth === 'wide' ? 'px-5' : 'px-8'}`}
        style={{
          borderRight: '1px solid var(--border)',
          background: 'var(--card)',
          ...(sidebarWidth === 'wide' ? { width: '35%', flexGrow: 0, flexShrink: 0 } : {}),
        }}
      >
        {/* Title and Description */}
        <div style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <h2 style={{ fontSize: 'var(--text-h4)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)' }}>
              Add Line Items
            </h2>
            <div className="flex items-center overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: 6, height: 28, background: 'var(--card)' }}>
              <button
                onClick={() => setSidebarWidth('narrow')}
                className={`w-8 h-7 flex items-center justify-center transition-colors ${sidebarWidth === 'narrow' ? 'bg-primary/12' : 'hover:bg-secondary'}`}
                style={{
                  borderRight: '1px solid var(--border)',
                  color: sidebarWidth === 'narrow' ? 'var(--primary)' : 'var(--foreground)',
                  opacity: sidebarWidth === 'narrow' ? 1 : 0.4,
                }}
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSidebarWidth('wide')}
                className={`w-8 h-7 flex items-center justify-center transition-colors ${sidebarWidth === 'wide' ? 'bg-primary/12' : 'hover:bg-secondary'}`}
                style={{
                  color: sidebarWidth === 'wide' ? 'var(--primary)' : 'var(--foreground)',
                  opacity: sidebarWidth === 'wide' ? 1 : 0.4,
                }}
              >
                <Grid2x2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p style={{ fontSize: 'var(--text-caption)', color: 'var(--foreground)', opacity: 0.5, marginBottom: 16 }}>
            Add products from the catalog and configure quantities, discounts, and advanced settings for each line item.{' '}
            <span style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'var(--font-weight-medium)' }} onClick={e => e.preventDefault()}>
              Learn more
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block ml-1" style={{ verticalAlign: 'middle' }}>
                <path d="M3 9L9 3M9 3H4.5M9 3V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </p>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--foreground)', opacity: 0.3 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full h-9 pl-10 pr-3 transition-colors"
              style={{ fontSize: 'var(--text-caption)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--input-background)', color: 'var(--foreground)', outline: 'none' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.boxShadow = 'var(--focus-ring-shadow)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Section label is the canonical Quote treatment — 11px /
            weight 500 / uppercase / 0.5px tracking / muted foreground
            — and the count badge uses `var(--muted)` so the two
            modules read identically. */}
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          {searchQuery.trim() ? (
            <>Search Results <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 16, padding: '0 5px', backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', borderRadius: 4, fontSize: 11, fontWeight: 600, lineHeight: 1, verticalAlign: 'middle', marginLeft: 4 }}>{displayProducts.length}</span></>
          ) : 'Recently Ordered'}
        </div>

        {displayProducts.length === 0 && searchQuery.trim() && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 mb-3" style={{ color: 'var(--foreground)', opacity: 0.15 }} />
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--foreground)', opacity: 0.5, marginBottom: 4 }}>No products found</p>
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.35 }}>Try a different search term</p>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto ${sidebarWidth === 'wide' ? '-mx-5' : '-mx-8'}`}>
          <div className={`space-y-3 pb-3 ${sidebarWidth === 'wide' ? 'px-5 space-y-2' : 'px-8'}`}>
            {displayProducts.map(product => {
              const added = isProductAdded(product.code);
              const addedQuantity = getTotalQuantityForProduct(product.code);
              const addedLineItemCount = getLineItemCountForProduct(product.code);
              const remainingStock = getRemainingStock(product.code);
              const outOfStock = product.inStock === 0;
              /* When the product already has a line on the SO, the
                 +/− buttons should add/remove in THAT line's unit
                 (Box, Pallet, Gallon, etc.) instead of always firing
                 in the product's catalog-default primary. */
              const existingLine = lineItems.find(li => li.productId === product.code);
              const buttonUomName = existingLine?.uom || findUomById(getPrimaryUomForProduct(product))?.name || 'EA';
              /* Blue summary pill collapses to "N units" when lines
                 for this product carry different UoMs (e.g. one Box,
                 one Pallet after a duplicate-and-change). When they
                 all share a unit the pill surfaces it verbatim. */
              const allLinesForProduct = lineItems.filter(li => li.productId === product.code);
              const uniqueLineUoms = new Set(allLinesForProduct.map(li => (li.uom || '').toLowerCase()).filter(Boolean));
              const pillUomName = uniqueLineUoms.size > 1
                ? 'units'
                : (allLinesForProduct[0]?.uom || findUomById(getPrimaryUomForProduct(product))?.name || 'EA');

              return (
                <div
                  key={product.code}
                  onClick={() => {
                    if (outOfStock) return;
                    /* Re-query lineItems instead of trusting the
                       closure-captured `added` so a second click
                       inside the same React batch still routes to
                       the increment handler. Matches the Quote
                       creation Step 3 behaviour. */
                    if (lineItems.some(i => i.productId === product.code)) {
                      handleAddQuantityToExisting(product);
                    } else {
                      handleAddProduct(product);
                    }
                  }}
                  className={`w-full relative so-catalog-card ${outOfStock ? 'cursor-not-allowed opacity-60 so-catalog-card-disabled' : 'cursor-pointer'} ${added ? 'so-catalog-card-added' : ''}`}
                  style={{
                    border: added ? '1px solid var(--success)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--card)',
                  }}
                >
                  <div className={`flex items-start p-3 ${sidebarWidth === 'wide' ? 'gap-2' : 'gap-3'}`}>
                    {/* Square thumbnail (8px) — opens ItemQuickView peek. */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); previewCatalogProduct(product); }}
                        title="Preview item"
                        aria-label={`Preview ${product.code}`}
                        className={`flex items-center justify-center transition-colors cursor-pointer overflow-hidden ${sidebarWidth === 'wide' ? 'w-8 h-8' : 'w-10 h-10'}`}
                        style={{ background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                      >
                        <img
                          src={getLineItemImage(product.code)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Row 1: SKU + type pill + price */}
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span style={{ fontSize: 'var(--text-caption)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)', lineHeight: 1 }}>
                            {product.code}
                          </span>
                          {sidebarWidth === 'narrow' && (
                            <ItemTypeBadge type={product.type} />
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span style={{ fontSize: 'var(--text-caption)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)' }}>
                            {formatCurrency(listPrice(product.unitPrice))}
                          </span>
                          <span style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.4, marginLeft: 4 }}>/ {findUomById(getPrimaryUomForProduct(product))?.name || 'EA'}</span>
                        </div>
                      </div>

                      {/* Row 2: Description — uses var(--muted-foreground)
                          (~#64748B, AA-passing contrast on white) instead
                          of opacity 0.5 (~#878E99, only 3.5:1), matching
                          the Quote module's text contrast. */}
                      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--muted-foreground)', marginBottom: sidebarWidth === 'wide' ? 4 : 8, lineHeight: 1.5 }}>
                        {(() => {
                          const truncLen = sidebarWidth === 'wide' ? 50 : 80;
                          if (expandedProductDescriptions.has(product.code)) {
                            return (
                              <>
                                {product.name}{' '}
                                <span
                                  onClick={(e) => { e.stopPropagation(); const n = new Set(expandedProductDescriptions); n.delete(product.code); setExpandedProductDescriptions(n); }}
                                  className="inline-flex items-center gap-0.5"
                                  style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'var(--font-weight-medium)', whiteSpace: 'nowrap' }}
                                >less <ChevronsUp className="w-3 h-3 inline" /></span>
                              </>
                            );
                          }
                          if (product.name.length > truncLen) {
                            return (
                              <>
                                {product.name.slice(0, truncLen)}…{' '}
                                <span
                                  onClick={(e) => { e.stopPropagation(); const n = new Set(expandedProductDescriptions); n.add(product.code); setExpandedProductDescriptions(n); }}
                                  className="inline-flex items-center gap-0.5"
                                  style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'var(--font-weight-medium)', whiteSpace: 'nowrap' }}
                                >
                                  more <ChevronsDown className="w-3 h-3 inline" />
                                </span>
                              </>
                            );
                          }
                          return product.name;
                        })()}
                      </div>

                      {/* Row 3: Stock + Actions. Pills follow Physical
                          Inventory's tag spec — 13px label, 2px/8px
                          padding, 6px radius, `--secondary` background,
                          `--border` outline. Same chrome as the Quote
                          module's left-rail pills and ControlTypeBadge. */}
                      <div className="flex items-center justify-between" style={sidebarWidth === 'wide' ? { marginTop: 4 } : {}}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {sidebarWidth === 'narrow' && (
                            <span className="inline-flex items-center border shrink-0" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 6, fontWeight: 500, lineHeight: 'normal', backgroundColor: 'var(--secondary)', color: 'var(--foreground)', borderColor: 'var(--border)' }}>
                              {product.category}
                            </span>
                          )}
                          <ATPTooltip product={product}>
                            {remainingStock > 0 ? (
                              <span
                                className="cursor-help"
                                style={{
                                  fontSize: 13, padding: '2px 8px', borderRadius: 6, fontWeight: 500, lineHeight: 'normal',
                                  backgroundColor: remainingStock <= 5 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(5, 150, 105, 0.10)',
                                  color: remainingStock <= 5 ? '#92400E' : 'var(--success)',
                                  border: `1px solid ${remainingStock <= 5 ? '#FDE68A' : '#A7F3D0'}`,
                                }}
                              >
                                {product.inStock} ATP
                              </span>
                            ) : (
                              <span className="cursor-help" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 6, fontWeight: 500, lineHeight: 'normal', backgroundColor: 'rgba(220, 38, 38, 0.10)', color: 'var(--destructive)', border: '1px solid rgba(220, 38, 38, 0.30)' }}>
                                0 ATP
                              </span>
                            )}
                          </ATPTooltip>
                        </div>

                        {!outOfStock && added && (
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
                            {/* -/+ buttons — when a line already
                                exists for this product, the buttons
                                add/remove in the line's existing UoM
                                so a Box-priced line stays in Box. */}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (addedQuantity > 1) handleSubtractQuantityFromExisting(product); }}
                              disabled={addedQuantity <= 1}
                              className={`inline-flex items-center gap-1 transition-all ${addedQuantity <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-[0.97] cursor-pointer'}`}
                              style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, lineHeight: 1, background: '#FFFFFF', color: 'var(--foreground)', border: '1px solid var(--border)', boxShadow: addedQuantity <= 1 ? 'none' : '0 1px 2px rgba(15, 23, 42, 0.08)' }}
                              title={addedQuantity <= 1 ? 'Remove the line with the Trash icon' : `Remove one ${buttonUomName}`}
                              aria-label={`Remove one ${buttonUomName}`}
                            >
                              <Minus className="w-3 h-3" />
                              1 {buttonUomName}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleAddQuantityToExisting(product); }}
                              className="inline-flex items-center gap-1 cursor-pointer transition-all border hover:shadow-md active:scale-[0.97]"
                              style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, lineHeight: 1, background: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)', boxShadow: '0 1px 2px rgba(10, 119, 255, 0.30)' }}
                              title={`Add another ${buttonUomName}`}
                            >
                              <Plus className="w-3 h-3" />
                              1 {buttonUomName}
                            </button>
                          </div>
                        )}
                        {!outOfStock && !added && (
                          <span
                            className="so-add-hint inline-flex items-center gap-1 border"
                            style={{ height: 28, padding: '0 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, lineHeight: 1, opacity: 0, transition: 'opacity 150ms ease', backgroundColor: 'rgba(10, 119, 255, 0.1)', color: 'var(--primary)', borderColor: 'rgba(10, 119, 255, 0.30)' }}
                          >
                            <Plus className="w-3 h-3" />
                            Add
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {stockAlert && stockAlert.productId === product.code && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="flex items-start gap-2 px-2.5 py-2 bg-destructive/8 text-destructive" style={{ borderRadius: 4, border: '1px solid var(--destructive)', opacity: 0.6 }}>
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span style={{ fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-medium)', lineHeight: 1.4 }}>{stockAlert.message}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Selected Items Panel — single muted-slate surface
          matching Quote's `bg-muted/40`, so the right column reads as
          one continuous gray instead of the previous two-tone band
          (the panel was `var(--background)` while the subtotal strip
          was its own gray). */}
      <div className="so-panel-right flex flex-col overflow-hidden" style={{ ...sidebarStyle, background: 'rgba(241, 245, 249, 0.4)' }}>
        {lineItems.length === 0 && !quickTipsDismissed && (
          <>
            <div className={`pb-6 pt-4 shrink-0 group ${sidebarWidth === 'narrow' ? 'px-4' : 'px-6'}`}>
              <div className="w-full flex items-center justify-between">
                <button onClick={() => setShowQuickTips(!showQuickTips)} className="flex items-center gap-2 text-left flex-1">
                  <Lightbulb className="w-4 h-4 shrink-0" style={{ color: 'var(--foreground)', opacity: 0.5 }} />
                  <h4 className="group-hover:text-foreground transition-colors" style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.5, fontWeight: 'var(--font-weight-medium)' }}>Quick Tips</h4>
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuickTipsDismissed(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 flex items-center justify-center" style={{ color: 'var(--foreground)', opacity: 0.3 }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <button onClick={() => setShowQuickTips(!showQuickTips)} style={{ color: 'var(--foreground)', opacity: 0.3 }}>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuickTips ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {showQuickTips && (
               <div className="mt-3 space-y-3">
                  {['Click Advanced Configuration to set pricing rules, shipment methods, and attachments',
                    'Green borders indicate products already added to the order',
                    'Adjust quantities and discounts directly in the item card',
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--primary)' }} />
                      <p style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.5, lineHeight: 1.6 }}>{tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ borderTop: '1px solid var(--border)' }} />
          </>
        )}

        <div className={`py-4 shrink-0 ${sidebarWidth === 'narrow' ? 'px-4' : 'px-6'}`} style={{ background: 'var(--secondary)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 'var(--text-micro)', textTransform: 'uppercase', color: 'var(--foreground)', opacity: 0.4, fontWeight: 'var(--font-weight-medium)', letterSpacing: '0.5px' }}>Selected Items</span>
              {lineItems.length > 0 && (
                <div className="inline-flex items-center overflow-hidden" style={{ borderRadius: 4, border: '1px solid var(--border)', background: 'var(--card)' }}>
                  <span className="px-2 py-0.5" style={{ fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)' }}>{lineItems.length}</span>
                </div>
              )}
            </div>
            {lineItems.length > 0 && (
              <button
                onClick={handleRemoveAll}
                className="px-3 py-1.5 rounded transition-all"
                style={{ fontSize: 'var(--text-micro)', color: 'var(--destructive)', fontWeight: 'var(--font-weight-medium)', background: 'transparent', border: '1px solid transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--destructive)'; e.currentTarget.style.opacity = '0.08'; e.currentTarget.style.borderColor = 'var(--destructive)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

            <div className={`flex-1 overflow-y-auto pb-4 ${sidebarWidth === 'narrow' ? 'px-4' : 'px-6'}`} style={{ background: 'transparent' }}>
          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--card)' }}>
                <Package className="w-8 h-8" style={{ color: 'var(--foreground)', opacity: 0.15 }} />
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--foreground)', opacity: 0.5 }}>No items selected</p>
              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.35, marginTop: 4 }}>Add products from the catalog</p>
            </div>
          ) : (
            /* Two-column grid in wide mode. Three was too dense for
               the card chrome — pills + #N badge + dual action icons
               lost their breathing room and the row read as a wall of
               identical chips. Matches Partner v7's right-panel
               density. */
            <div className={sidebarWidth === 'narrow' ? 'space-y-3' : 'grid gap-3'} style={sidebarWidth === 'narrow' ? {} : { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {lineItems.map((item) => {
                const isInDuplicateGroup = lineItems.filter(i => i.productId === item.productId).length > 1;
                const origNum = originalItemNumbers[item.id];
                const isNewlyAdded = newlyAddedIds.has(item.id);
                const isQtyBumped = qtyBumpIds.has(item.id);
                const product = EXTENDED_CATALOG.find(p => p.code === item.productId);

                return (
                  <div
                    key={item.id}
                    ref={(el) => { if (el) cardRefsMap.current.set(item.id, el); else cardRefsMap.current.delete(item.id); }}
                    className={`flex flex-col relative overflow-hidden so-selected-card ${isNewlyAdded ? 'so-newly-added-card' : ''} ${isQtyBumped ? 'so-qty-bump-card' : ''}`}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    {/* Item Number Badge — 24px so it reads as a real
                        chip and clears the SKU + pills row by 32px. */}
                    <div
                      className="absolute top-0 left-0 flex items-center justify-center bg-primary/12 text-primary"
                      style={{ width: 24, height: 24, borderTopLeftRadius: 10, borderBottomRightRadius: 10, fontSize: 11, fontWeight: 700 }}
                    >
                      {itemNumbers[item.id]}
                    </div>

                    <div className="mb-2 flex-1">
                      <div className="flex items-start justify-between mb-1" style={{ paddingLeft: 32, gap: 8 }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{item.productId}</span>
                          <ItemTypeBadge type={product?.type || 'Non-Serialized'} />
                          {isInDuplicateGroup && origNum != null && (
                            <DuplicateBadge ofIndex={origNum} />
                          )}
                        </div>
                        {/* Action icons get real 28px tap-targets — the
                            previous 0.5 padding + opacity-15 treatment
                            made them practically invisible/un-clickable. */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Copy + Trash hover treatment mirrors Purchase
                              Order's per-row pattern: tinted text + tinted
                              background only on hover, no opacity dance, no
                              scale bump (the previous `so-card-action`
                              class faded these to opacity 0.55 at rest and
                              flashed scale(1.1) + secondary bg on hover —
                              which read as bouncy rather than crisp). */}
                          <button
                            onClick={() => setPendingDuplicateId(item.id)}
                            className="flex items-center justify-center transition-colors duration-150 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent' }}
                            title="Duplicate as separate line item"
                            aria-label="Duplicate line item"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="flex items-center justify-center transition-colors duration-150 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent' }}
                            title="Remove from order"
                            aria-label="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {/* Thumb opens ItemQuickView peek. */}
                        <div className="shrink-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); if (product) previewCatalogProduct(product); }}
                            title="Preview item"
                            aria-label={`Preview ${item.productId}`}
                            className="w-9 h-9 flex items-center justify-center transition-colors cursor-pointer overflow-hidden"
                            style={{ background: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 0 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                          >
                            <img
                              src={getLineItemImage(item.productId)}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="mb-1">
                            {/* Description size lifted to 12px and
                                muted-foreground to match Quote's right
                                card. --text-micro (10px) + opacity 0.5
                                read much fainter than the Quote module. */}
                            <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                              {expandedDescriptions.has(item.id) ? (
                                <>
                                  {item.name}{' '}
                                  <button onClick={(e) => { e.stopPropagation(); const n = new Set(expandedDescriptions); n.delete(item.id); setExpandedDescriptions(n); }} className="inline-flex items-center gap-0.5" style={{ color: 'var(--primary)', fontWeight: 500, fontSize: 12 }}>less <ChevronsUp className="w-3 h-3 inline" /></button>
                                </>
                              ) : (
                                <>
                                  {item.name.length > 80 ? item.name.slice(0, 80) + '…' : item.name}
                                  {item.name.length > 80 && (
                                    <>
                                      {' '}<button onClick={(e) => { e.stopPropagation(); const n = new Set(expandedDescriptions); n.add(item.id); setExpandedDescriptions(n); }} className="inline-flex items-center gap-0.5 whitespace-nowrap" style={{ color: 'var(--primary)', fontWeight: 500, fontSize: 12 }}>more <ChevronsDown className="w-3 h-3 inline" /></button>
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
                        {/* Field labels at 11px / muted-foreground so they
                            clear AA contrast (~4.5:1) instead of the prior
                            opacity-0.4 ghost. Matches the Quote card. */}
                        <label style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>Quantity</label>
                        <label style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>Item Total</label>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Combined qty + uom capsule — same chrome as
                            the SO line items table's QtyUomCapsule so
                            quantity and unit live in one bordered chip.
                            The −/+ twins on the left product-picker
                            card own the increment/decrement role; qty
                            here is a direct typeable field. */}
                        {(() => {
                          const productForUom = EXTENDED_CATALOG.find((p) => p.code === item.productId);
                          const itemSet = productForUom ? getUomSetForProduct(productForUom) : UNITS_OF_MEASURE;
                          const itemPrimary = productForUom ? getPrimaryUomForProduct(productForUom) : 'ea';
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
                                <div className={`truncate`} style={{ fontSize: sidebarWidth === 'narrow' ? 'var(--text-caption)' : 'var(--text-label)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)' }}>
                                  {formatCurrency(item.total)}
                                </div>
                                <div className="truncate" style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted-foreground)' }}>
                                  {itemUomLabel}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div>
                      {/* Partner-secondary button: white surface, black
                          label, resting 1px shadow + slate border;
                          hover elevates to a deeper shadow with primary
                          tint. Same chrome as the Quote module so the
                          action reads identically across both. */}
                      <button
                        onClick={() => setConfigItemId(item.id)}
                        className="w-full flex items-center justify-center gap-2 transition-all so-config-btn"
                        style={{
                          height: 36,
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          fontSize: 13,
                          color: 'var(--foreground)',
                          fontWeight: 500,
                          background: 'var(--card)',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.backgroundColor = '#F0F7FF';
                          e.currentTarget.style.color = 'var(--primary)';
                          e.currentTarget.style.boxShadow = '0 2px 6px rgba(10, 119, 255, 0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.backgroundColor = 'var(--card)';
                          e.currentTarget.style.color = 'var(--foreground)';
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

        {lineItems.length > 0 && (
          /* Match the Quote creation footer exactly: muted/40 gray panel
             (same surface as the right-side selected-items column),
             12px label, 20px primary amount, 11px caption. The previous
             white card with token-based sizes read as a different
             component class from Quote's. */
          <div
            className="shrink-0"
            style={{
              borderTop: '1px solid var(--border)',
              background: 'rgba(241, 245, 249, 0.4)',
              padding: sidebarWidth === 'narrow' ? '16px 16px' : '16px 24px',
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontWeight: 500 }}>
                Subtotal
              </span>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--primary)' }}>
                {formatCurrency(subtotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate confirmation dialog */}
      <ConfirmationDialog
        open={pendingDuplicateId !== null}
        icon={<Copy className="w-5 h-5" style={{ color: 'var(--chart-4)' }} />}
        badge="DUPLICATE"
        title="Duplicate Line Item?"
        description={(() => {
          const src = pendingDuplicateId ? lineItems.find(i => i.id === pendingDuplicateId) : null;
          return [
            'Duplicating creates a new line item copied from the original. Use this when you need a separate entry with different parameters — such as a different requested ship date, handling notes, or delivery instructions — rather than increasing quantity on the existing line.',
            ...(src
              ? [`This will create a new line item for ${src.productId} with quantity 1, inserted directly below the original.`, 'Pricing and configuration will be copied from the source item.']
              : ['This will create a duplicate of the selected line item.']),
          ];
        })()}
        confirmLabel="Duplicate"
        dismissLabel="Cancel"
        variant="info"
        onConfirm={() => {
          if (pendingDuplicateId) handleDuplicateItem(pendingDuplicateId);
          setPendingDuplicateId(null);
        }}
        onDismiss={() => setPendingDuplicateId(null)}
      />

      {configItemId && (() => {
        const selectedItem = lineItems.find((item) => item.id === configItemId);
        const selectedProduct = selectedItem ? EXTENDED_CATALOG.find((product) => product.code === selectedItem.productId) : null;
        if (!selectedItem) return null;

        return (
          <AdvancedConfiguratorModal
            line={{
              id: selectedItem.id,
              itemCode: selectedItem.productId,
              itemName: selectedItem.name,
              itemType: selectedProduct?.type || 'Non-Serialized',
              warehouse: 'Main Warehouse',
              orderedQty: selectedItem.quantity,
              allocatedQty: 0,
              pickedQty: 0,
              shippedQty: 0,
              deliveredQty: 0,
              unitPrice: selectedItem.unitPrice,
              taxRate: 0,
              allocations: [],
              cancelled: false,
              cancelledQty: 0,
              readyToPick: false,
            }}
            inventory={inventory}
            onClose={() => setConfigItemId(null)}
            onSave={({ orderedQty, unitPrice }) => {
              onLineItemsChange(lineItems.map((item) => item.id === configItemId
                ? { ...item, quantity: orderedQty, unitPrice, total: orderedQty * unitPrice * (1 - item.discount / 100) }
                : item));
              setConfigItemId(null);
            }}
            onDelete={() => {
              handleRemoveItem(configItemId);
              setConfigItemId(null);
            }}
          />
        );
      })()}
      {/* Item peek modal — rendered last so it stacks above everything. */}
      {itemQuickViewModal}
    </div>
  );
}

export default CreateSOStep2;