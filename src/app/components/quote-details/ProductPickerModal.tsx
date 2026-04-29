import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Package, Check, Plus, Trash2, Settings, ChevronDown, ChevronRight, SlidersHorizontal, LayoutList, Grid2x2, Lightbulb, Layers, Copy } from 'lucide-react';
import { PRODUCTS, type Product } from '../../data/products';
import { InventoryTooltip } from '../InventoryTooltip';
import { ConfirmationModal } from '../ConfirmationModal';
import { QuoteMoney } from '../currency/QuoteMoney';

/* ─── Interfaces ─── */
interface SelectedProduct { product: Product; quantity: number; }
interface ExistingItem { productId: string; quantity: number; productName?: string; }
interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProducts: (products: SelectedProduct[]) => void;
  existingProductIds?: string[];
  existingItems?: ExistingItem[];
  /** Quote's customer currency. When non-base, amounts still render in
   *  base PKR but expose a customer-currency hover via QuoteMoney. */
  customerCurrency?: string;
}
interface SelectedLineItem { id: string; productId: string; product: Product; quantity: number; }

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
  if (product.isSerialized) return { label: 'Serialized', bg: '#DBEAFE', color: '#1E40AF' };
  if (product.isLotControlled) return { label: 'Lot Controlled', bg: '#E0E7FF', color: '#3730A3' };
  return { label: 'Non-Serialized', bg: '#F3F4F6', color: '#374151' };
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
  if (f.isLotControlled !== null) tags.push({ key: 'isLotControlled', label: f.isLotControlled ? 'Lot Controlled' : 'Not Lot Controlled' });
  if (f.recentlyOrdered !== null) tags.push({ key: 'recentlyOrdered', label: f.recentlyOrdered ? 'Recently Ordered' : 'Not Recently Ordered' });
  return tags;
}

/* ─── Filter Sub-components ─── */
function FilterCheckbox({ checked, onChange, label, count }: {
  checked: boolean; onChange: () => void; label: string; count?: number;
}) {
  return (
    <button onClick={onChange} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '5px 0', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}>
      <div style={{ width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0, border: checked ? 'none' : '1px solid #D1D5DB', backgroundColor: checked ? '#3B82F6' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' }}>
        {checked && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} strokeWidth={3} />}
      </div>
      <span style={{ fontSize: '12px', fontWeight: 400, color: '#374151', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400, lineHeight: '1', flexShrink: 0 }}>{count}</span>}
    </button>
  );
}

function FilterSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #F3F4F6' }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 16px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>{title}</span>
        {open ? <ChevronDown style={{ width: '12px', height: '12px', color: '#9CA3AF' }} /> : <ChevronRight style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />}
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>Advanced Filters</span>
        {activeCount > 0 && (
          <button onClick={clearAll} style={{ fontSize: '12px', fontWeight: 500, color: '#3B82F6', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '2px 0', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1' }}>
            Clear all
          </button>
        )}
      </div>

      {/* Scrollable sections */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, scrollbarWidth: 'thin' as any }}>
        {/* ── Category ── */}
        <FilterSection title="Category" defaultOpen={true}>
          <div style={{ position: 'relative', marginBottom: '6px' }}>
            <Search style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#9CA3AF' }} />
            <input
              value={categorySearch} onChange={e => setCategorySearch(e.target.value)}
              placeholder="Search categories..."
              style={{ width: '100%', height: '28px', paddingLeft: '26px', paddingRight: '8px', borderRadius: '5px', border: '1px solid #E5E7EB', fontSize: '12px', color: '#1F2937', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = '#93C5FD'} onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
            />
          </div>
          {filters.categories.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#3B82F6', fontWeight: 500 }}>{filters.categories.length} selected</span>
              <button onClick={() => setFilters(prev => ({ ...prev, categories: [] }))} style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', padding: 0 }}>
                Clear
              </button>
            </div>
          )}
          <div style={{ maxHeight: '150px', overflowY: 'auto', scrollbarWidth: 'thin' as any }}>
            {visibleCategories.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '6px 0' }}>No matching categories</div>
            ) : visibleCategories.map(cat => (
              <FilterCheckbox key={cat} checked={filters.categories.includes(cat)} onChange={() => toggleCategory(cat)} label={cat} count={getCategoryCount(cat)} />
            ))}
          </div>
        </FilterSection>

        {/* ── Price Range ── */}
        <FilterSection title="Price Range" defaultOpen={false}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>$</span>
              <input type="number" placeholder="Min" value={filters.priceMin}
                onChange={e => setFilters(prev => ({ ...prev, priceMin: e.target.value }))}
                style={{ width: '100%', height: '28px', paddingLeft: '20px', paddingRight: '6px', borderRadius: '5px', border: '1px solid #E5E7EB', fontSize: '12px', color: '#1F2937', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                onFocus={e => e.currentTarget.style.borderColor = '#93C5FD'} onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
              />
            </div>
            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>to</span>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>$</span>
              <input type="number" placeholder="Max" value={filters.priceMax}
                onChange={e => setFilters(prev => ({ ...prev, priceMax: e.target.value }))}
                style={{ width: '100%', height: '28px', paddingLeft: '20px', paddingRight: '6px', borderRadius: '5px', border: '1px solid #E5E7EB', fontSize: '12px', color: '#1F2937', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                onFocus={e => e.currentTarget.style.borderColor = '#93C5FD'} onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
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
                    height: '24px', padding: '0 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 500,
                    border: active ? '1px solid #3B82F6' : '1px solid #E5E7EB',
                    backgroundColor: active ? '#EFF6FF' : '#FFFFFF', color: active ? '#3B82F6' : '#6B7280',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 120ms', lineHeight: '1', whiteSpace: 'nowrap',
                  }}>
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500, marginBottom: '4px', lineHeight: '1' }}>Custom range</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="number" placeholder="Min" value={filters.stockMin}
              onChange={e => setFilters(prev => ({ ...prev, stockMin: e.target.value }))}
              style={{ flex: 1, height: '28px', padding: '0 8px', borderRadius: '5px', border: '1px solid #E5E7EB', fontSize: '12px', color: '#1F2937', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = '#93C5FD'} onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
            />
            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>to</span>
            <input type="number" placeholder="Max" value={filters.stockMax}
              onChange={e => setFilters(prev => ({ ...prev, stockMax: e.target.value }))}
              style={{ flex: 1, height: '28px', padding: '0 8px', borderRadius: '5px', border: '1px solid #E5E7EB', fontSize: '12px', color: '#1F2937', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
              onFocus={e => e.currentTarget.style.borderColor = '#93C5FD'} onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
            />
          </div>
        </FilterSection>

        {/* ── Tracking ── */}
        <FilterSection title="Tracking" defaultOpen={false}>
          <div style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500, marginBottom: '4px', lineHeight: '1' }}>Serialized</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[{ val: true as const, label: 'Yes' }, { val: false as const, label: 'No' }].map(opt => {
                const isActive = filters.isSerialized === opt.val;
                return (
                  <button key={String(opt.val)} onClick={() => setFilters(prev => ({ ...prev, isSerialized: prev.isSerialized === opt.val ? null : opt.val }))}
                    style={{ height: '24px', padding: '0 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, border: isActive ? '1px solid #3B82F6' : '1px solid #E5E7EB', backgroundColor: isActive ? '#EFF6FF' : '#FFFFFF', color: isActive ? '#3B82F6' : '#6B7280', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 120ms', lineHeight: '1' }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500, marginBottom: '4px', lineHeight: '1' }}>Lot Controlled</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[{ val: true as const, label: 'Yes' }, { val: false as const, label: 'No' }].map(opt => {
                const isActive = filters.isLotControlled === opt.val;
                return (
                  <button key={String(opt.val)} onClick={() => setFilters(prev => ({ ...prev, isLotControlled: prev.isLotControlled === opt.val ? null : opt.val }))}
                    style={{ height: '24px', padding: '0 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, border: isActive ? '1px solid #3B82F6' : '1px solid #E5E7EB', backgroundColor: isActive ? '#EFF6FF' : '#FFFFFF', color: isActive ? '#3B82F6' : '#6B7280', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 120ms', lineHeight: '1' }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </FilterSection>
      </div>

      {/* Panel footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 400 }}>{filteredCount} result{filteredCount !== 1 ? 's' : ''}</span>
        <button onClick={onDone}
          style={{ height: '28px', padding: '0 14px', borderRadius: '6px', border: 'none', backgroundColor: '#3B82F6', fontSize: '12px', fontWeight: 500, color: '#FFFFFF', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 150ms', lineHeight: '1' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2563EB'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3B82F6'}>
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
      <button ref={btnRef} onClick={() => setShowPanel(!showPanel)}
        style={{
          height: '36px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px',
          border: activeCount > 0 ? '1px solid #3B82F6' : '1px solid #E5E7EB',
          backgroundColor: activeCount > 0 ? '#EFF6FF' : showPanel ? '#F9FAFB' : '#FFFFFF',
          fontSize: '13px', fontWeight: 500, color: activeCount > 0 ? '#3B82F6' : '#6B7280',
          cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (activeCount === 0 && !showPanel) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
        onMouseLeave={e => { if (activeCount === 0 && !showPanel) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; } }}>
        <SlidersHorizontal style={{ width: '14px', height: '14px' }} />
        Filters
        {activeCount > 0 && (
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#FFFFFF', backgroundColor: '#3B82F6', width: '18px', height: '18px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>{activeCount}</span>
        )}
      </button>

      {showPanel && (
        <div ref={panelRef} style={{
          position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: '320px',
          backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px',
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
        <span key={tag.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '22px', padding: '0 6px 0 8px', borderRadius: '5px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: '11px', fontWeight: 500, color: '#1D4ED8', lineHeight: '1' }}>
          {tag.label}
          <button onClick={() => removeTag(tag.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#60A5FA', padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = '#1D4ED8'} onMouseLeave={e => e.currentTarget.style.color = '#60A5FA'}>
            <X style={{ width: '10px', height: '10px' }} />
          </button>
        </span>
      ))}
      <button onClick={clearAll} style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '0 4px', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1' }}
        onMouseEnter={e => e.currentTarget.style.color = '#374151'} onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}>
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
export function ProductPickerModal({ isOpen, onClose, onAddProducts, existingProductIds = [], existingItems = [], customerCurrency }: ProductPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedLineItem[]>([]);
  const [filters, setFilters] = useState<AdvancedFilters>({ ...EMPTY_FILTERS });
  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());
  const [expandedSelectedDescs, setExpandedSelectedDescs] = useState<Set<string>>(new Set());
  const [panelLayout, setPanelLayout] = useState<'narrow' | 'wide'>('narrow');
  const [showQuickTips, setShowQuickTips] = useState(true);
  const [quickTipsDismissed, setQuickTipsDismissed] = useState(false);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [pendingDuplicateProduct, setPendingDuplicateProduct] = useState<Product | null>(null);

  // Reset on open & seed existing items into the unified list
  useEffect(() => {
    if (isOpen) {
      setSearch(''); setFilters({ ...EMPTY_FILTERS });
      setExpandedDescs(new Set()); setExpandedSelectedDescs(new Set());
      const seeded: SelectedLineItem[] = [];
      const ids = new Set<string>();
      existingItems.forEach((ei, idx) => {
        const product = PRODUCTS.find(p => p.id === ei.productId);
        if (product) {
          const id = `existing-${ei.productId}-${idx}`;
          ids.add(id);
          seeded.push({ id, productId: ei.productId, product, quantity: ei.quantity });
        }
      });
      setExistingIds(ids);
      setSelectedItems(seeded);
    }
  }, [isOpen, existingItems]);

  const filteredProducts = useMemo(() => {
    const base = search.trim()
      ? PRODUCTS.filter(p => { const q = search.toLowerCase(); return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q); })
      : PRODUCTS.filter(p => p.isRecentlyOrdered);
    return applyAdvancedFilters(base, filters);
  }, [search, filters]);

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
    const newItem: SelectedLineItem = { id: `sel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId: product.id, product, quantity: 1 };
    const lastIdx = selectedItems.map(i => i.productId).lastIndexOf(product.id);
    if (lastIdx !== -1) { const u = [...selectedItems]; u.splice(lastIdx + 1, 0, newItem); setSelectedItems(u); }
    else setSelectedItems(prev => [...prev, newItem]);
  };

  const handleAddQuantityToExisting = (product: Product) => {
    const existingItem = selectedItems.find(item => item.productId === product.id);
    if (!existingItem) return;
    setSelectedItems(prev => prev.map(item => 
      item.id === existingItem.id 
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ));
  };

  const handleRemoveItem = (id: string) => setSelectedItems(prev => prev.filter(i => i.id !== id));
  const handleSetQuantity = (id: string, qty: number) => setSelectedItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));

  const isExisting = (id: string) => existingIds.has(id);
  const newItems = selectedItems.filter(i => !isExisting(i.id));
  const existingCount = selectedItems.filter(i => isExisting(i.id)).length;

  const handleAdd = () => {
    onAddProducts(newItems.map(si => ({ product: si.product, quantity: si.quantity })));
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

  const gridCols =
    panelLayout === 'narrow' ? undefined
    : 'repeat(3, minmax(0, 1fr))';

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} />

      {/* Modal */}
      <div style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '1100px', maxWidth: '94vw', height: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 48px rgba(0,0,0,0.16)', overflow: 'hidden' }}>

        {/* ═══ HEADER — minimal, consistent with other modals ═══ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0, backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Package style={{ width: '16px', height: '16px', color: '#3B82F6' }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: '1' }}>Add Line Items</div>
              <div style={{ fontSize: '11px', fontWeight: 400, color: '#9CA3AF', lineHeight: '1', marginTop: '4px' }}>
                Select products and configure quantities before adding to the quote
              </div>
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <X style={{ width: '16px', height: '16px', color: '#9CA3AF' }} />
          </button>
        </div>

        {/* ═══ BODY — split panels ═══ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── LEFT: Product Catalog ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #E5E7EB', transition: 'flex 350ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
            {/* Title row with view toggle — matching Step3 layout */}
            <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#1F2937', lineHeight: '1.2' }}>Add Line Items</div>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'hidden', height: '28px' }}>
                  {([
                    { key: 'narrow' as const, icon: LayoutList, tip: 'List view' },
                    { key: 'wide' as const, icon: Grid2x2, tip: 'Grid view' },
                  ] as const).map((v, idx) => (
                    <button key={v.key} onClick={() => setPanelLayout(v.key)} title={v.tip}
                      style={{
                        width: '30px', height: '27px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', borderRight: idx < 1 ? '1px solid #E5E7EB' : 'none',
                        backgroundColor: panelLayout === v.key ? '#E7F3FF' : '#FFFFFF',
                        color: panelLayout === v.key ? '#1B6EF3' : '#6B7280',
                        cursor: 'pointer', transition: 'all 120ms',
                      }}>
                      <v.icon style={{ width: '14px', height: '14px' }} />
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 400, color: '#6B7280', lineHeight: '1.5', marginBottom: '16px' }}>
                Add products from the catalog and configure quantities, discounts, and advanced settings for each line item.
              </div>
            </div>

            {/* Search + Filter row */}
            <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9CA3AF' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." autoFocus
                    style={{ width: '100%', height: '36px', paddingLeft: '34px', paddingRight: '12px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '13px', color: '#1F2937', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box', transition: 'border-color 150ms' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'} onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
                  />
                </div>
                <FilterButton filters={filters} setFilters={setFilters} filteredCount={filteredProducts.length} />
              </div>
              <ActiveFilterTags filters={filters} setFilters={setFilters} />
            </div>

            {/* Section header */}
            <div style={{ padding: '0 20px 8px', flexShrink: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>
                {search.trim() ? (
                  <>Search Results <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '16px', padding: '0 5px', backgroundColor: '#F3F4F6', color: '#6B7280', borderRadius: '4px', fontSize: '11px', fontWeight: 600, lineHeight: '1', verticalAlign: 'middle', marginLeft: '4px' }}>{filteredProducts.length}</span></>
                ) : 'Recently Ordered'}
              </div>
            </div>

            {/* Product list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px', minHeight: 0, scrollbarWidth: 'thin' as any }}>
              {filteredProducts.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', color: '#9CA3AF' }}>
                  <Package style={{ width: '32px', height: '32px', marginBottom: '12px', color: '#D1D5DB' }} />
                  <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>No items found</div>
                  <div style={{ fontSize: '12px', fontWeight: 400 }}>Try a different search term</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredProducts.map((product) => {
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
                        style={{ position: 'relative', width: '100%', border: added ? '1px solid #10B981' : '1px solid #E5E7EB', borderRadius: '6px', backgroundColor: added ? '#F0FDF4' : '#FFFFFF', transition: 'all 150ms', padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1B6EF3'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = added ? '#10B981' : '#E5E7EB'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                        {/* Item numbers badge moved inline to Row 3 */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px' }}>
                          {/* Circular thumbnail */}
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {product.images[0] ? <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package style={{ width: '18px', height: '18px', color: '#D1D5DB' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Row 1: SKU + pill + price */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>{product.id}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: tracking.color, backgroundColor: tracking.bg, padding: '2px 6px', borderRadius: '3px', lineHeight: '1', whiteSpace: 'nowrap' }}>{tracking.label}</span>
                              </div>
                              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                                  <QuoteMoney valuePKR={product.unitPrice} customerCurrency={customerCurrency} view="base" />
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 400, color: '#9CA3AF', marginLeft: '2px' }}>/ EA</span>
                              </div>
                            </div>
                            {/* Row 2: Description */}
                            <div style={{ fontSize: '12px', fontWeight: 400, color: '#6B7280', lineHeight: '1.5', marginBottom: '4px' }}>
                              {isDescExpanded ? (
                                <>{product.description}{' '}<span onClick={e => { e.stopPropagation(); setExpandedDescs(prev => { const n = new Set(prev); n.delete(product.id); return n; }); }} style={{ fontWeight: 500, color: '#3B82F6', cursor: 'pointer', whiteSpace: 'nowrap' }}>see less</span></>
                              ) : (
                                <>{needsMore ? product.description.slice(0, descTruncLen) + '...' : product.description}{needsMore && <>{' '}<span onClick={e => { e.stopPropagation(); setExpandedDescs(prev => { const n = new Set(prev); n.add(product.id); return n; }); }} style={{ fontWeight: 500, color: '#3B82F6', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>more <ChevronDown style={{ width: '11px', height: '11px' }} /></span></>}</>
                              )}
                            </div>
                            {/* Row 3: Category + Stock + Added */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {itemNumbers.length > 0 && (
                                  <span
                                    style={{ 
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      padding: '2px 6px',
                                      borderRadius: '3px',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      backgroundColor: '#ECFDF5',
                                      color: '#059669',
                                      lineHeight: '1',
                                    }}
                                    title={`Line ${itemNumbers.length === 1 ? 'item' : 'items'} #${itemNumbers.join(', #')}`}
                                  >
                                    <Check style={{ width: '12px', height: '12px' }} />
                                    {itemNumbers.length === 1 ? 'Added' : `Added · ×${itemNumbers.length}`}
                                  </span>
                                )}
                                <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '3px', lineHeight: '1' }}>{product.category}</span>
                                <InventoryTooltip stockQuantity={product.stockQuantity} remainingStock={remaining}>
                                  <span
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ fontSize: '10px', fontWeight: 500, lineHeight: '1', padding: '2px 6px', borderRadius: '3px', cursor: 'default', color: product.stockQuantity === 0 ? '#DC2626' : remaining <= 5 ? '#92400E' : '#059669', backgroundColor: product.stockQuantity === 0 ? '#FEF2F2' : remaining <= 5 ? '#FEF3C7' : '#ECFDF5' }}>
                                    {remaining <= 0 ? '0 ATP' : `${remaining} ATP`}
                                  </span>
                                </InventoryTooltip>
                              </div>
                              {(
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, lineHeight: '1' }}>
                                  {added ? (
                                    <>
                                      {/* Add as new line item button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPendingDuplicateProduct(product);
                                        }}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#6B7280', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3E8FF'; e.currentTarget.style.borderColor = '#8B5CF6'; e.currentTarget.style.color = '#7C3AED'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; }}
                                        title="Add as a separate line item with its own configuration"
                                      >
                                        <Layers style={{ width: '12px', height: '12px' }} />
                                        Duplicate
                                      </button>
                                      {/* Add quantity to existing button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAddQuantityToExisting(product);
                                        }}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', color: '#059669', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#ECFDF5'; e.currentTarget.style.borderColor = '#10B981'; }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                                        title="Increase quantity of existing item"
                                      >
                                        <Plus style={{ width: '12px', height: '12px' }} />
                                        1 EA
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddProduct(product);
                                      }}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, border: 'none', backgroundColor: '#E7F3FF', color: '#1B6EF3', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms' }}
                                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#1B6EF3'; e.currentTarget.style.color = '#FFFFFF'; }}
                                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#E7F3FF'; e.currentTarget.style.color = '#1B6EF3'; }}
                                    >
                                      <Plus style={{ width: '12px', height: '12px' }} />
                                      Add
                                    </button>
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
              )}
            </div>
          </div>

          {/* ── RIGHT: Selected Items ── */}
          <div style={{ ...rightStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#FAFBFC' }}>
            {/* Quick Tips — only shown when no items selected and not dismissed */}
            {selectedItems.length === 0 && !quickTipsDismissed && (
              <>
                <div style={{ padding: '12px 20px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button onClick={() => setShowQuickTips(!showQuickTips)} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', padding: 0 }}>
                      <Lightbulb style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280', lineHeight: '1' }}>Quick Tips</span>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button onClick={() => setQuickTipsDismissed(true)}
                        style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', borderRadius: '4px', color: '#9CA3AF', transition: 'color 100ms' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#1F2937'} onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}>
                        <X style={{ width: '12px', height: '12px' }} />
                      </button>
                      <button onClick={() => setShowQuickTips(!showQuickTips)}
                        style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9CA3AF' }}>
                        <ChevronDown style={{ width: '12px', height: '12px', transition: 'transform 150ms', transform: showQuickTips ? 'rotate(180deg)' : 'none' }} />
                      </button>
                    </div>
                  </div>
                  {showQuickTips && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { text: <>Click <span style={{ fontWeight: 500, color: '#1F2937' }}>Advanced Configuration</span> to set pricing rules, shipment methods, and attachments</> },
                        { text: 'Green borders indicate products already added to the quote' },
                        { text: 'You can add the same product multiple times for different configurations' },
                      ].map((tip, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#1B6EF3', marginTop: '5px', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', fontWeight: 400, color: '#6B7280', lineHeight: '1.5' }}>{tip.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ borderBottom: '1px solid #E5E7EB' }} />
              </>
            )}

            {/* Right header — QUOTE ITEMS (unified list) */}
            <div style={{ padding: '12px 20px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Quote Items</span>
                  {selectedItems.length > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', overflow: 'hidden', borderRadius: '4px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF' }}>
                      <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600, color: '#1F2937' }}>{selectedItems.length}</span>
                    </div>
                  )}
                </div>
                {newItems.length > 0 && (
                  <button onClick={() => setSelectedItems(prev => prev.filter(i => isExisting(i.id)))} style={{ fontSize: '12px', fontWeight: 500, color: '#DC2626', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 150ms' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FEF2F2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    Clear New
                  </button>
                )}
              </div>
            </div>

            {/* Right list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px', minHeight: 0, scrollbarWidth: 'thin' as any }}>
              {selectedItems.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '24px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <Package style={{ width: '28px', height: '28px', color: '#9CA3AF' }} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#6B7280', marginBottom: '4px' }}>No items selected</div>
                  <div style={{ fontSize: '12px', fontWeight: 400, color: '#9CA3AF' }}>Add products from the catalog</div>
                </div>
              ) : (
                <div style={gridCols ? { display: 'grid', gap: '8px', gridTemplateColumns: gridCols } : { display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedItems.map(item => {
                    const tracking = getTrackingType(item.product);
                    const isDuplicate = originalLineNums[item.id] != null;
                    const isDescExp = expandedSelectedDescs.has(item.id);
                    const needsMore = item.product.description.length > descTruncLen;
                    const total = item.quantity * item.product.unitPrice;
                    const itemIsExisting = isExisting(item.id);

                    return (
                      <div key={item.id} style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '8px', borderTop: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB', borderLeft: itemIsExisting ? '3px solid #10B981' : '1px solid #E5E7EB', padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
                        {/* Item # badge */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottomRightRadius: '8px', fontSize: '10px', fontWeight: 600, backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                          {itemNumbers[item.id]}
                        </div>
                        {/* Delete */}
                        <button onClick={() => handleRemoveItem(item.id)} style={{ position: 'absolute', top: '8px', right: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#DC2626', padding: '2px' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#991B1B'} onMouseLeave={e => e.currentTarget.style.color = '#DC2626'}>
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                        {/* SKU + pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', paddingLeft: '36px', paddingRight: '20px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>{item.productId}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 600, color: tracking.color, backgroundColor: tracking.bg, padding: '2px 5px', borderRadius: '3px', lineHeight: '1', whiteSpace: 'nowrap' }}>{tracking.label}</span>
                          {isDuplicate && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '3px',
                              fontSize: '10px', fontWeight: 500, color: '#8B5CF6',
                              backgroundColor: 'transparent', border: '1px dashed #C4B5FD',
                              padding: '1px 6px 1px 4px', borderRadius: '4px', lineHeight: '1',
                              whiteSpace: 'nowrap',
                            }}>
                              <Layers style={{ width: '9px', height: '9px', flexShrink: 0 }} />
                              Duplicate of #{originalLineNums[item.id]}
                            </span>
                          )}

                        </div>
                        {/* Image + desc */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {item.product.images[0] ? <img src={item.product.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package style={{ width: '16px', height: '16px', color: '#D1D5DB' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: 400, color: '#6B7280', lineHeight: '1.5' }}>
                            {isDescExp ? (
                              <>{item.product.description}{' '}<span onClick={() => setExpandedSelectedDescs(p => { const n = new Set(p); n.delete(item.id); return n; })} style={{ fontWeight: 500, color: '#3B82F6', cursor: 'pointer', whiteSpace: 'nowrap' }}>see less</span></>
                            ) : (
                              <>{needsMore ? item.product.description.slice(0, descTruncLen) + '...' : item.product.description}{needsMore && <>{' '}<span onClick={() => setExpandedSelectedDescs(p => { const n = new Set(p); n.add(item.id); return n; })} style={{ fontWeight: 500, color: '#3B82F6', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>more <ChevronDown style={{ width: '11px', height: '11px' }} /></span></>}</>
                            )}
                          </div>
                        </div>
                        {/* Qty + total */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', marginBottom: '4px', lineHeight: '1' }}>Quantity</div>
                            <input type="number" min={1} value={item.quantity} onClick={e => e.stopPropagation()}
                              onChange={e => handleSetQuantity(item.id, parseInt(e.target.value) || 1)}
                              style={{ width: '64px', height: '32px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '13px', fontWeight: 600, color: '#1F2937', textAlign: 'center', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                              onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'} onBlur={e => e.currentTarget.style.borderColor = '#E5E7EB'}
                            />
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', marginBottom: '4px', lineHeight: '1' }}>Item Total</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                              <QuoteMoney valuePKR={total} customerCurrency={customerCurrency} view="base" />{' '}
                              <span style={{ fontSize: '11px', fontWeight: 400, color: '#6B7280' }}>(EA)</span>
                            </div>
                          </div>
                        </div>
                        {/* Config button */}
                        <button style={{ width: '100%', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '6px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: 500, color: '#6B7280', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 150ms' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#1B6EF3'; e.currentTarget.style.color = '#1B6EF3'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; }}>
                          <Settings style={{ width: '13px', height: '13px' }} /> Advanced Configuration
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400 }}>
            {newItems.length > 0 ? (
              <>New subtotal: <span style={{ fontWeight: 600, color: '#1B6EF3', fontSize: '16px' }}>
                <QuoteMoney
                  valuePKR={newItems.reduce((s, i) => s + i.quantity * i.product.unitPrice, 0)}
                  customerCurrency={customerCurrency}
                  view="base"
                />
              </span> <span style={{ fontSize: '12px', color: '#9CA3AF' }}>({newItems.length} new · {existingCount} existing)</span></>
            ) : existingCount > 0 ? (
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{existingCount} existing item{existingCount !== 1 ? 's' : ''} in quote</span>
            ) : `${filteredProducts.length} products available`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={onClose}
              style={{ height: '32px', padding: '0 16px', borderRadius: '6px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: 500, color: '#6B7280', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1' }}>
              Cancel
            </button>
            <button onClick={handleAdd} disabled={newItems.length === 0}
              style={{ height: '32px', padding: '0 20px', borderRadius: '6px', border: 'none', backgroundColor: newItems.length === 0 ? '#93C5FD' : '#1B6EF3', fontSize: '13px', fontWeight: 600, color: '#FFFFFF', cursor: newItems.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms' }}
              onMouseEnter={e => { if (newItems.length > 0) e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={e => { if (newItems.length > 0) e.currentTarget.style.backgroundColor = '#1B6EF3'; }}>
              Add{newItems.length > 0 ? ` ${newItems.length} Item${newItems.length !== 1 ? 's' : ''}` : ''} to Quote
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
    </div>
  , document.body);
}
