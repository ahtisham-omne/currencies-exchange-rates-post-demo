import { useState, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Search, Check, Package, Settings, ChevronDown, LayoutList, Grid2x2, AlertCircle, Lightbulb, Layers, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { CATALOG, useSOStore } from './store';
import { ATPTooltip } from './ATPTooltip';
import { ItemTypeBadge, DuplicateBadge } from './StatusBadge';
import { ConfirmationDialog } from './ui/DiscardChangesDialog';
import { AdvancedConfiguratorModal } from './AdvancedConfiguratorModal';

/* ═══ Extended catalog for this step ═══ */
export const EXTENDED_CATALOG = [
  ...CATALOG,
  { code: "000-100-004", name: "Express 3500 cutaway with 159\" WB, 6.6L V8 Duramax turbo-diesel, heavy-duty Allison 1000 6-speed automatic, ambulance prep package with dual batteries, 220A alternator, engine exhaust brake, and prewired harness for body-builder upfit including rear HVAC, lighting circuits, and OBD-II telematics tap", description: "Pre-wired for ambulance conversion", type: "Serialized" as const, unitPrice: 44100, category: "Base Vehicles", inStock: 57 },
  { code: "000-100-005", name: "F-550 4x4 crew cab, 84\" CA, 7.3L V8 gas engine, 19,500 GVWR, PTO-ready with live-drive provision, ideal for rescue/utility body mounting, includes factory upfitter switches, auxiliary fuse panel, heavy-duty tow package with integrated brake controller, and chassis-mounted outrigger brackets for aerial or crane operations", description: "Heavy-duty rescue utility platform", type: "Serialized" as const, unitPrice: 58900, category: "Base Vehicles", inStock: 68 },
];

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

const UNITS_OF_MEASURE = [
  { id: 'ea', name: 'EA', fullName: 'Each' },
  { id: 'box', name: 'Box', fullName: 'Box (12 units)' },
  { id: 'carton', name: 'Carton', fullName: 'Carton (24 units)' },
  { id: 'pallet', name: 'Pallet', fullName: 'Pallet (480 units)' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

export function CreateSOStep2({ lineItems, onLineItemsChange, hasCustomer }: Step2Props) {
  const { inventory } = useSOStore();
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

  const displayProducts = useMemo(() => {
    if (!searchQuery.trim()) return EXTENDED_CATALOG;
    const q = searchQuery.toLowerCase();
    return EXTENDED_CATALOG.filter(p =>
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
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
    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newItem: SOLineItem = {
      id: newId, productId: product.code, name: product.name, description: product.description,
      quantity: 1, unitPrice: product.unitPrice, discount: 0, total: product.unitPrice,
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
            <div className="text-foreground/40" style={{ fontSize: 'var(--text-micro)', marginTop: 2 }}>Item already exists - added as a separate line</div>
          </div>
        </div>
      ), { position: 'top-right', duration: 3000 });
    } else {
      onLineItemsChange([...lineItems, newItem]);
    }

    setNewlyAddedIds(prev => new Set([...prev, newId]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2500);
    setTimeout(() => {
      const el = cardRefsMap.current.get(newId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [lineItems, onLineItemsChange]);

  const handleAddQuantityToExisting = useCallback((product: typeof EXTENDED_CATALOG[0]) => {
    const existingItem = lineItems.find(i => i.productId === product.code);
    if (!existingItem) return;
    onLineItemsChange(lineItems.map(item =>
      item.id === existingItem.id
        ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
        : item
    ));
    setQtyBumpIds(prev => new Set([...prev, existingItem.id]));
    if (qtyBumpTimerRef.current) clearTimeout(qtyBumpTimerRef.current);
    qtyBumpTimerRef.current = setTimeout(() => setQtyBumpIds(new Set()), 1800);
    setTimeout(() => {
      const el = cardRefsMap.current.get(existingItem.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
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
          <div className="text-foreground/40" style={{ fontSize: 'var(--text-micro)', marginTop: 2 }}>{product.code} - added as a separate line</div>
        </div>
      </div>
    ), { position: 'top-right', duration: 3000 });
    setNewlyAddedIds(prev => new Set([...prev, newId]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2500);
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
      {/* CSS for animations */}
      <style>{`
        /* ── Newly added card: blue tint + soft glow, smooth 1.5s fade ── */
        @keyframes soNewCard {
          0% {
            box-shadow: 0 0 0 2px var(--primary), 0 0 16px 6px var(--primary-glow-medium);
            background-color: var(--primary-active-bg);
            border-color: var(--primary);
          }
          40% {
            box-shadow: 0 0 0 1.5px var(--primary-ring-soft), 0 0 12px 4px var(--primary-glow-subtle);
            background-color: var(--primary-hover-bg);
            border-color: var(--primary-border-soft);
          }
          100% {
            box-shadow: var(--elevation-1);
            background-color: var(--card);
            border-color: var(--border);
          }
        }
        .so-newly-added-card {
          animation: soNewCard 1.5s ease-out forwards !important;
        }

        /* ── Qty bump card — uses primary (blue) to stay consistent ── */
        @keyframes soQtyBump {
          0% { box-shadow: 0 0 0 2px var(--primary), 0 0 12px 4px var(--primary-glow-subtle); }
          50% { box-shadow: 0 0 0 3px var(--primary-ring-soft), 0 0 8px 2px var(--primary-tint-card); }
          100% { box-shadow: var(--elevation-1); }
        }
        .so-qty-bump-card { animation: soQtyBump 1s ease-out forwards; }
        @keyframes soQtyFlash {
          0% { background-color: var(--primary-glow-subtle); color: var(--primary); }
          60% { background-color: var(--primary-tint-card); }
          100% { background-color: var(--card); color: var(--foreground); }
        }
        .so-qty-bump-input { animation: soQtyFlash 1.5s ease-out forwards; }

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
          border-color: var(--accent) !important;
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

        <div style={{ fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-medium)', color: 'var(--foreground)', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          {searchQuery.trim() ? (
            <>Search Results <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 16, padding: '0 5px', background: 'var(--secondary)', color: 'var(--foreground)', borderRadius: 4, fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-semibold)', lineHeight: 1, verticalAlign: 'middle', marginLeft: 4, opacity: 0.6 }}>{displayProducts.length}</span></>
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

              const typePillClasses = product.type === 'Serialized'
                ? 'bg-primary/12 text-primary'
                : product.type === 'Lot Controlled'
                ? 'bg-chart-4/12 text-chart-4'
                : 'bg-secondary text-foreground/60';

              return (
                <div
                  key={product.code}
                  onClick={() => {
                    if (outOfStock || added) return;
                    handleAddProduct(product);
                  }}
                  className={`w-full relative so-catalog-card ${outOfStock ? 'cursor-not-allowed opacity-60 so-catalog-card-disabled' : added ? 'cursor-default so-catalog-card-added' : 'cursor-pointer'}`}
                  style={{
                    border: added ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--card)',
                  }}
                >
                  <div className={`flex items-start p-3 ${sidebarWidth === 'wide' ? 'gap-2' : 'gap-3'}`}>
                    {/* Circular thumbnail */}
                    <div className="relative shrink-0">
                      <div className={`rounded-full flex items-center justify-center ${sidebarWidth === 'wide' ? 'w-8 h-8' : 'w-10 h-10'}`} style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                        <Package className={sidebarWidth === 'wide' ? 'w-3 h-3' : 'w-4 h-4'} style={{ color: 'var(--foreground)', opacity: 0.25 }} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Row 1: SKU + type pill + price */}
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span style={{ fontSize: 'var(--text-caption)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)', lineHeight: 1 }}>
                            {product.code}
                          </span>
                          {sidebarWidth === 'narrow' && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 ${typePillClasses}`}
                              style={{ borderRadius: 3, fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-semibold)', lineHeight: 1 }}
                            >
                              {product.type}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span style={{ fontSize: 'var(--text-caption)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)' }}>
                            {formatCurrency(product.unitPrice)}
                          </span>
                          <span style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.4, marginLeft: 4 }}>/ EA</span>
                        </div>
                      </div>

                      {/* Row 2: Description with more/less — shown in both modes, shorter truncation in wide */}
                      <div style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.5, marginBottom: sidebarWidth === 'wide' ? 4 : 8, lineHeight: 1.5 }}>
                        {(() => {
                          const truncLen = sidebarWidth === 'wide' ? 50 : 80;
                          if (expandedProductDescriptions.has(product.code)) {
                            return (
                              <>
                                {product.name}{' '}
                                <span
                                  onClick={(e) => { e.stopPropagation(); const n = new Set(expandedProductDescriptions); n.delete(product.code); setExpandedProductDescriptions(n); }}
                                  style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'var(--font-weight-medium)', whiteSpace: 'nowrap' }}
                                >see less</span>
                              </>
                            );
                          }
                          if (product.name.length > truncLen) {
                            return (
                              <>
                                {product.name.slice(0, truncLen)}...{' '}
                                <span
                                  onClick={(e) => { e.stopPropagation(); const n = new Set(expandedProductDescriptions); n.add(product.code); setExpandedProductDescriptions(n); }}
                                  className="inline-flex items-center gap-0.5"
                                  style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'var(--font-weight-medium)', whiteSpace: 'nowrap' }}
                                >
                                  more <ChevronDown className="w-3 h-3 inline" />
                                </span>
                              </>
                            );
                          }
                          return product.name;
                        })()}
                      </div>

                      {/* Row 3: Stock + Actions (category hidden in wide for sleekness) */}
                      <div className="flex items-center justify-between" style={sidebarWidth === 'wide' ? { marginTop: 4 } : {}}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {sidebarWidth === 'narrow' && (
                            <span className="inline-flex items-center px-1.5 py-0.5" style={{ fontSize: 'var(--text-micro)', background: 'var(--secondary)', color: 'var(--foreground)', opacity: 0.6, borderRadius: 3, fontWeight: 'var(--font-weight-medium)' }}>
                              {product.category}
                            </span>
                          )}
                          <ATPTooltip product={product}>
                            {remainingStock > 0 ? (
                              <span
                                className={`cursor-help ${remainingStock <= 5 ? 'bg-chart-3/12 text-chart-3' : 'bg-accent/12 text-accent'}`}
                                style={{ fontSize: 'var(--text-micro)', borderRadius: 3, fontWeight: 'var(--font-weight-medium)', padding: '2px 6px' }}
                              >
                                {product.inStock} ATP
                              </span>
                            ) : (
                              <span className="cursor-help bg-destructive/12 text-destructive" style={{ fontSize: 'var(--text-micro)', borderRadius: 3, fontWeight: 'var(--font-weight-medium)', padding: '2px 6px' }}>
                                0 ATP
                              </span>
                            )}
                          </ATPTooltip>
                        </div>

                        {!outOfStock && added && (
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 flex items-center gap-1" style={{ borderRadius: 3, fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-medium)', backgroundColor: 'rgba(52, 199, 89, 0.12)', color: 'var(--accent)' }}>
                              <Check className="w-2.5 h-2.5" />
                              {addedQuantity} EA {addedLineItemCount === 1 ? '1 line' : `${addedLineItemCount} lines`}
                            </span>
                            <span
                              onClick={(e) => { e.stopPropagation(); handleAddQuantityToExisting(product); }}
                              className="px-2 py-0.5 flex items-center gap-0.5 cursor-pointer transition-colors"
                              style={{ borderRadius: 4, fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-semibold)', background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                            >
                              <Plus className="w-2.5 h-2.5" />1 EA
                            </span>
                          </div>
                        )}
                        {!outOfStock && !added && (
                          <span
                            className="so-add-hint px-2 py-0.5 flex items-center gap-0.5"
                            style={{ borderRadius: 4, fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-semibold)', opacity: 0, transition: 'opacity 150ms ease', backgroundColor: 'rgba(10, 119, 255, 0.1)', color: 'var(--primary)' }}
                          >
                            <Plus className="w-2.5 h-2.5" />Add
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

      {/* Right: Selected Items Panel */}
      <div className="so-panel-right flex flex-col overflow-hidden" style={{ ...sidebarStyle, background: 'var(--background)' }}>
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

            <div className={`flex-1 overflow-y-auto pb-4 ${sidebarWidth === 'narrow' ? 'px-4' : 'px-6'}`} style={{ background: 'var(--background)' }}>
          {lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--card)' }}>
                <Package className="w-8 h-8" style={{ color: 'var(--foreground)', opacity: 0.15 }} />
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--foreground)', opacity: 0.5 }}>No items selected</p>
              <p style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.35, marginTop: 4 }}>Add products from the catalog</p>
            </div>
          ) : (
            <div className={sidebarWidth === 'narrow' ? 'space-y-3' : 'grid gap-3'} style={sidebarWidth === 'narrow' ? {} : { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {lineItems.map((item) => {
                const isInDuplicateGroup = lineItems.filter(i => i.productId === item.productId).length > 1;
                const origNum = originalItemNumbers[item.id];
                const isNewlyAdded = newlyAddedIds.has(item.id);
                const isQtyBumped = qtyBumpIds.has(item.id);
                const product = EXTENDED_CATALOG.find(p => p.code === item.productId);

                const typePillClasses = product?.type === 'Serialized'
                  ? 'bg-primary/12 text-primary'
                  : product?.type === 'Lot Controlled'
                  ? 'bg-chart-4/12 text-chart-4'
                  : 'bg-secondary text-foreground/60';

                return (
                  <div
                    key={item.id}
                    ref={(el) => { if (el) cardRefsMap.current.set(item.id, el); else cardRefsMap.current.delete(item.id); }}
                    className={`p-3 flex flex-col relative overflow-hidden so-selected-card ${isNewlyAdded ? 'so-newly-added-card' : ''} ${isQtyBumped ? 'so-qty-bump-card' : ''}`}
                    style={{
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {/* Item Number Badge - top-left corner */}
                    <div
                      className="absolute top-0 left-0 flex items-center justify-center bg-primary/12 text-primary"
                      style={{ width: 20, height: 20, borderBottomRightRadius: 8, fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-semibold)' }}
                    >
                      {itemNumbers[item.id]}
                    </div>

                    <div className="mb-2 flex-1">
                      <div className="flex items-start justify-between mb-0.5" style={{ paddingLeft: 46 }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span style={{ fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)' }}>{item.productId}</span>
                          <span className={`px-1 py-0.5 ${typePillClasses}`} style={{ borderRadius: 3, fontSize: 'var(--text-micro)', fontWeight: 'var(--font-weight-semibold)' }}>{product?.type || 'Non-Serialized'}</span>
                          {isInDuplicateGroup && origNum != null && (
                            <DuplicateBadge ofIndex={origNum} />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setPendingDuplicateId(item.id)} className="shrink-0 p-0.5 transition-colors so-card-action" style={{ color: 'var(--foreground)', opacity: 0.15, borderRadius: 4 }} title="Duplicate as separate line item">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRemoveItem(item.id)} className="shrink-0 transition-colors so-card-action" style={{ color: 'var(--destructive)', opacity: 0.35 }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="shrink-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                            <Package className="w-3.5 h-3.5" style={{ color: 'var(--foreground)', opacity: 0.25 }} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="mb-1">
                            <div style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.5, lineHeight: 1.5 }}>
                              {expandedDescriptions.has(item.id) ? (
                                <>
                                  {item.name}{' '}
                                  <button onClick={(e) => { e.stopPropagation(); const n = new Set(expandedDescriptions); n.delete(item.id); setExpandedDescriptions(n); }} style={{ color: 'var(--primary)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--text-micro)' }}>see less</button>
                                </>
                              ) : (
                                <>
                                  {item.name.length > 80 ? item.name.slice(0, 80) + '...' : item.name}
                                  {item.name.length > 80 && (
                                    <>
                                      {' '}<button onClick={(e) => { e.stopPropagation(); const n = new Set(expandedDescriptions); n.add(item.id); setExpandedDescriptions(n); }} className="inline-flex items-center gap-0.5 whitespace-nowrap" style={{ color: 'var(--primary)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--text-micro)' }}>more <ChevronDown className="w-3 h-3 inline" /></button>
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
                        <label style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.4, fontWeight: 'var(--font-weight-medium)' }}>Quantity</label>
                        <label style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.4, fontWeight: 'var(--font-weight-medium)' }}>Item Total</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => { const newQty = Math.max(1, parseInt(e.target.value) || 1); handleUpdateQuantity(item.id, newQty - item.quantity); }}
                          className={`w-20 h-8 px-2 ${isQtyBumped ? 'so-qty-bump-input' : ''}`}
                          style={{ fontSize: 'var(--text-caption)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--card)', color: 'var(--foreground)', outline: 'none' }}
                          min="1"
                        />
                        <div className="flex-1 text-right min-w-0">
                          {sidebarWidth === 'narrow' ? (
                            <div className="truncate" style={{ fontSize: 'var(--text-caption)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)' }}>
                              {formatCurrency(item.total)} <span style={{ fontWeight: 'var(--font-weight-normal)', opacity: 0.5 }}>({UNITS_OF_MEASURE.find(u => u.id === (item.uom || 'ea'))?.name || 'EA'})</span>
                            </div>
                          ) : (
                            <>
                              <div className="truncate" style={{ fontSize: 'var(--text-label)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--foreground)' }}>{formatCurrency(item.total)}</div>
                              <div style={{ fontSize: 'var(--text-micro)', color: 'var(--foreground)', opacity: 0.4 }}>({UNITS_OF_MEASURE.find(u => u.id === (item.uom || 'ea'))?.name || 'EA'})</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={() => setConfigItemId(item.id)}
                        className="w-full h-8 flex items-center justify-center gap-2 transition-colors so-config-btn"
                        style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 'var(--text-caption)', color: 'var(--foreground)', opacity: 0.5, fontWeight: 'var(--font-weight-medium)', background: 'var(--card)' }}
                      >
                        <Settings className="w-3.5 h-3.5" />
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
          <div className="shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--card)', padding: sidebarWidth === 'narrow' ? '16px 16px' : '20px 24px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--text-label)', color: 'var(--foreground)', opacity: 0.5, fontWeight: 'var(--font-weight-medium)' }}>
                Subtotal ({lineItems.length} item{lineItems.length !== 1 ? 's' : ''})
              </span>
              <span style={{ fontSize: 'var(--text-h3)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--primary)' }}>
                {formatCurrency(subtotal)}
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--foreground)', opacity: 0.35, textAlign: 'left' }}>+ Shipping calculated on next step</p>
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
    </div>
  );
}

export default CreateSOStep2;