// @ts-nocheck
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Plus, Minus, Trash2, Search, Check, Package, Settings, Info, ChevronDown, LayoutList, Grid2x2, AlertCircle, Users, Lightbulb, Armchair, Laptop, Wrench, Box, Layers, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { CurrencyAmount } from '@/app/components/ui/CurrencyAmount';
import { BASE_CURRENCY, convertBetween, getLibraryCurrency } from '@/app/data/currencyLibrary';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { LineItemConfigModal } from '@/app/components/quote-creation/LineItemConfigModal';
import { HighlightText } from '@/app/components/HighlightText';
import { PRODUCTS } from '@/app/data/products';
import { FilterButton, ActiveFilterTags, applyAdvancedFilters, EMPTY_FILTERS, type AdvancedFilters } from '@/app/components/quote-details/ProductPickerModal';
import { InventoryTooltip } from '@/app/components/InventoryTooltip';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';

interface Step3LineItemsProps {
  quoteDraft: QuoteDraft;
  onUpdate: (updates: Partial<QuoteDraft>) => void;
}

const UNITS_OF_MEASURE = [
  { id: 'ea', name: 'EA', fullName: 'Each' },
  { id: 'box', name: 'Box', fullName: 'Box (12 units)' },
  { id: 'carton', name: 'Carton', fullName: 'Carton (24 units)' },
  { id: 'pallet', name: 'Pallet', fullName: 'Pallet (480 units)' },
];

// Helper function to generate Item ID from item.id in xxx-xxx-xxx format
const generateItemId = (itemId: string): string => {
  const numericPart = itemId.replace(/\D/g, '');
  const last9 = numericPart.slice(-9).padStart(9, '0');
  return `${last9.slice(0, 3)}-${last9.slice(3, 6)}-${last9.slice(6)}`;
};

export function Step3LineItems({ quoteDraft, onUpdate }: Step3LineItemsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const customerCurrency = (quoteDraft.currency || quoteDraft.customerDefaultCurrency || BASE_CURRENCY).toUpperCase();
  const customerCurrencyIsBase = customerCurrency === BASE_CURRENCY;
  // Default to base currency display; toggle is hidden when customer settles in PKR.
  const [priceView, setPriceView] = useState<'base' | 'customer'>('base');
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
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qtyBumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  const displayProducts = useMemo(() => {
    const base = searchQuery.trim() 
      ? PRODUCTS.filter(
          (product) =>
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : PRODUCTS.filter(product => product.isRecentlyOrdered);
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
    const newId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
            fontFamily: 'Inter, system-ui, sans-serif',
            width: '320px', cursor: 'pointer',
          }}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px',
            backgroundColor: '#F3E8FF', border: '1px solid #DDD6FE',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Layers style={{ width: '14px', height: '14px', color: '#7C3AED' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>
              Duplicate of {product.name} added
            </div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.3 }}>
              Item already exists — added as a separate line
            </div>
          </div>
        </div>
      ), { position: 'top-right', duration: 3000 });
    } else {
      onUpdate({ lineItems: [...existingItems, newItem] });
    }

    // Highlight and scroll to newly added card
    setNewlyAddedIds(prev => new Set([...prev, newId]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2500);
    // Scroll after DOM updates
    setTimeout(() => {
      const el = cardRefsMap.current.get(newId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // New function to add quantity to an existing item
  const handleAddQuantityToExisting = (product: typeof PRODUCTS[0]) => {
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

    // Highlight the updated card
    setQtyBumpIds(prev => new Set([...prev, existingItem.id]));
    if (qtyBumpTimerRef.current) clearTimeout(qtyBumpTimerRef.current);
    qtyBumpTimerRef.current = setTimeout(() => setQtyBumpIds(new Set()), 1800);
    
    // Scroll to it
    setTimeout(() => {
      const el = cardRefsMap.current.get(existingItem.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
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
          backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
          fontFamily: 'Inter, system-ui, sans-serif',
          width: '320px', cursor: 'pointer',
        }}
      >
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px',
          backgroundColor: '#F3E8FF', border: '1px solid #DDD6FE',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Layers style={{ width: '14px', height: '14px', color: '#7C3AED' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>
            Line item duplicated
          </div>
          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.3 }}>
            {product.name} — added as a separate line
          </div>
        </div>
      </div>
    ), { position: 'top-right', duration: 3000 });

    // Highlight & scroll
    setNewlyAddedIds(prev => new Set([...prev, newId]));
    if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
    newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2500);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  /**
   * Render a PKR amount under the active price-view toggle. When the customer
   * settles in PKR there's nothing to flip — render a plain base value with
   * no hover. Otherwise honor the toggle: base view shows ₨ with customer
   * hover, customer view shows the converted value with ₨ hover.
   */
  const Money = ({ valuePKR, className }: { valuePKR: number; className?: string }) => {
    if (customerCurrencyIsBase) {
      return <CurrencyAmount mode="single" currency={BASE_CURRENCY} value={valuePKR} className={className} />;
    }
    if (priceView === 'customer') {
      const customerValue = convertBetween(valuePKR, BASE_CURRENCY, customerCurrency);
      return (
        <CurrencyAmount
          mode="listing-partner"
          currency={customerCurrency}
          value={customerValue}
          className={className}
        />
      );
    }
    return (
      <CurrencyAmount
        mode="listing-base"
        currency={BASE_CURRENCY}
        value={valuePKR}
        partnerDefaultCurrency={customerCurrency}
        partnerDefaultValue={convertBetween(valuePKR, BASE_CURRENCY, customerCurrency)}
        className={className}
      />
    );
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
      <div className="flex h-full items-center justify-center bg-[#FAFBFC]">
        <div className="text-center max-w-md px-8">
          {/* Icon */}
          <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-[#9CA3AF]" />
          </div>

          {/* Title */}
          <h3 className="text-[14px] text-[#1F2937] mb-2" style={{ fontWeight: 600 }}>
            Select a Customer First
          </h3>

          {/* Description */}
          <p className="text-[13px] text-[#6B7280]">
            Before adding items to your quote, please select a customer and primary contact.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* CSS for newly-added card animation */}
      <style>{`
        @keyframes newCardHighlight {
          0% { background-color: #DBEAFE; transform: scale(1.01); }
          30% { background-color: #EFF6FF; transform: scale(1); }
          100% { background-color: #FFFFFF; }
        }
        .newly-added-card {
          animation: newCardHighlight 2.5s ease-out forwards;
        }
        @keyframes qtyBumpPulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .qty-bump-card {
          animation: qtyBumpPulse 1s ease-out;
        }
        @keyframes qtyInputFlash {
          0% { background-color: #D1FAE5; color: #065F46; }
          60% { background-color: #ECFDF5; }
          100% { background-color: #FFFFFF; color: #1F2937; }
        }
        .qty-bump-input {
          animation: qtyInputFlash 1.5s ease-out forwards;
        }
      `}</style>
      {/* Left: Product Catalog */}
      <div className={`flex flex-col overflow-hidden px-8 py-6 border-r border-[#E5E7EB] ${leftSideClass}`} style={sidebarWidth === 'wide' ? { width: '30%', flexGrow: 0, flexShrink: 0, transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1), flex 350ms cubic-bezier(0.4, 0, 0.2, 1)' } : { transition: 'width 350ms cubic-bezier(0.4, 0, 0.2, 1), flex 350ms cubic-bezier(0.4, 0, 0.2, 1)' }} >
        {/* Title and Description */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[20px] text-[#1F2937]" style={{ fontWeight: 600 }}>
              Add Line Items
            </h2>
            <div className="flex items-center border border-[#E5E7EB] bg-white overflow-hidden" style={{ borderRadius: '6px', height: '28px' }}>
              <button
                onClick={() => setSidebarWidth('narrow')}
                className={`w-8 h-7 flex items-center justify-center transition-colors border-r border-[#E5E7EB] ${
                  sidebarWidth === 'narrow' 
                    ? 'bg-[#E7F3FF] text-[#1B6EF3]' 
                    : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                }`}
                title="List view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSidebarWidth('wide')}
                className={`w-8 h-7 flex items-center justify-center transition-colors ${
                  sidebarWidth === 'wide' 
                    ? 'bg-[#E7F3FF] text-[#1B6EF3]' 
                    : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                }`}
                title="Grid view"
              >
                <Grid2x2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[13px] text-[#6B7280] mb-4">
            Add products from the catalog and configure quantities, discounts, and advanced settings for each line item.{' '}
            <a 
              href="#" 
              className="text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors inline-flex items-center gap-1"
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full h-9 pl-10 pr-3 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3] focus:border-transparent"
                style={{ borderRadius: '6px' }}
              />
            </div>
            <FilterButton filters={advancedFilters} setFilters={setAdvancedFilters} filteredCount={displayProducts.length} />
            {/* Price-view toggle — Base ↔ Customer. Hidden when customer
                already settles in PKR (nothing meaningful to flip). */}
            {!customerCurrencyIsBase && (() => {
              const cur = getLibraryCurrency(customerCurrency);
              const sym = cur?.symbol ?? customerCurrency;
              return (
                <div className="inline-flex items-center h-9 rounded-md border border-[#E5E7EB] bg-white p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPriceView('base')}
                    className={`inline-flex items-center h-7 px-2.5 rounded text-[12px] whitespace-nowrap cursor-pointer transition-colors ${
                      priceView === 'base' ? 'bg-[#EDF4FF] text-[#1B6EF3]' : 'text-[#6B7280] hover:text-[#1F2937]'
                    }`}
                    style={{ fontWeight: priceView === 'base' ? 600 : 500 }}
                    title={`Show prices in ${BASE_CURRENCY} (base)`}
                  >
                    ₨ {BASE_CURRENCY}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriceView('customer')}
                    className={`inline-flex items-center h-7 px-2.5 rounded text-[12px] whitespace-nowrap cursor-pointer transition-colors ${
                      priceView === 'customer' ? 'bg-[#EDF4FF] text-[#1B6EF3]' : 'text-[#6B7280] hover:text-[#1F2937]'
                    }`}
                    style={{ fontWeight: priceView === 'customer' ? 600 : 500 }}
                    title={`Show prices in customer currency (${customerCurrency})`}
                  >
                    {sym} {customerCurrency}
                  </button>
                </div>
              );
            })()}
          </div>
          <ActiveFilterTags filters={advancedFilters} setFilters={setAdvancedFilters} />
        </div>

        <div
          className="text-[11px] text-[#6B7280] uppercase tracking-wide mb-3"
          style={{ fontWeight: 500, letterSpacing: '0.5px' }}
        >
          {searchQuery.trim() ? <>Search Results <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '16px', padding: '0 5px', backgroundColor: '#F3F4F6', color: '#6B7280', borderRadius: '4px', fontSize: '11px', fontWeight: 600, lineHeight: '1', verticalAlign: 'middle', marginLeft: '4px' }}>{displayProducts.length}</span></> : 'Recently Ordered'}
        </div>

        {displayProducts.length === 0 && searchQuery.trim() && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-[#9CA3AF] mb-3" />
            <p className="text-[13px] text-[#6B7280] mb-1">No products found</p>
            <p className="text-[12px] text-[#9CA3AF]">Try a different search term</p>
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
                className={`w-full border transition-all hover:shadow-sm relative group cursor-pointer ${
                  added 
                    ? 'border-[#10B981]' 
                    : 'border-[#E5E7EB] hover:border-[#1B6EF3]'
                }`}
                style={{ borderRadius: '6px', backgroundColor: added ? '#F0FDF4' : '#FFFFFF' }}
              >
                {/* Item numbers badge moved inline to Row 3 */}
              
                <div className="flex items-start gap-3 p-3">
                  {/* Circular thumbnail */}
                  <div className="relative flex-shrink-0">
                    <ImageWithFallback
                      src={product.images[0]}
                      alt={product.description}
                      className="w-10 h-10 object-cover"
                      style={{ borderRadius: '50%', border: '1px solid #E5E7EB' }}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Row 1: SKU bold + type pill + price */}
                    <div className="flex items-center justify-between gap-3 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600, lineHeight: '1' }}>
                          <HighlightText text={product.id} searchTerm={searchQuery} />
                        </span>
                        {product.isSerialized ? (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 text-[11px] bg-[#DBEAFE] text-[#1E40AF]"
                            style={{ borderRadius: '3px', fontWeight: 600, lineHeight: '1' }}
                          >
                            Serialized
                          </span>
                        ) : product.isLotControlled ? (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 text-[11px] bg-[#E0E7FF] text-[#3730A3]"
                            style={{ borderRadius: '3px', fontWeight: 600, lineHeight: '1' }}
                          >
                            Lot Controlled
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 text-[11px] bg-[#F3F4F6] text-[#374151]"
                            style={{ borderRadius: '3px', fontWeight: 600, lineHeight: '1' }}
                          >
                            Non-Serialized
                          </span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                          <Money valuePKR={product.unitPrice} />
                        </span>
                        <span className="text-[11px] text-[#9CA3AF] ml-1" style={{ fontWeight: 400 }}>/ EA</span>
                      </div>
                    </div>

                    {/* Row 2: Description with more/less */}
                    <div
                      className="text-[12px] text-[#6B7280] mb-2"
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
                            className="text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors inline whitespace-nowrap text-[12px] cursor-pointer"
                            style={{ fontWeight: 500 }}
                          >
                            see less
                          </span>
                        </>
                      ) : (
                        <>
                          {product.description.length > 80 ? (
                            <>
                              <HighlightText text={product.description.slice(0, 80) + '...'} searchTerm={searchQuery} />{' '}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newExpanded = new Set(expandedProductDescriptions);
                                  newExpanded.add(product.id);
                                  setExpandedProductDescriptions(newExpanded);
                                }}
                                className="text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors inline-flex items-center gap-0.5 whitespace-nowrap text-[12px] cursor-pointer"
                                style={{ fontWeight: 500 }}
                              >
                                more <ChevronDown className="w-3 h-3 inline" />
                              </span>
                            </>
                          ) : (
                            <HighlightText text={product.description} searchTerm={searchQuery} />
                          )}
                        </>
                      )}
                    </div>

                    {/* Row 3: Item badges + Category + Stock + Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-[#F3F4F6] text-[#6B7280]"
                          style={{ borderRadius: '3px', fontWeight: 500 }}
                        >
                          {product.category}
                        </span>
                        {remainingStock > 0 ? (
                          <InventoryTooltip stockQuantity={product.stockQuantity} remainingStock={remainingStock}>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] cursor-default ${
                                remainingStock <= 5
                                  ? 'bg-[#FEF3C7] text-[#92400E]'
                                  : 'bg-[#ECFDF5] text-[#059669]'
                              }`}
                              style={{ borderRadius: '3px', fontWeight: 500 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {product.stockQuantity} ATP
                            </span>
                          </InventoryTooltip>
                        ) : (
                          <InventoryTooltip stockQuantity={product.stockQuantity} remainingStock={0}>
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-[#FEE2E2] text-[#991B1B] cursor-default"
                              style={{ borderRadius: '3px', fontWeight: 500 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              0 ATP
                            </span>
                          </InventoryTooltip>
                        )}
                      </div>

                      {added && (
                        <div className="flex items-center gap-1.5">
                          {/* Added indicator with quantity info */}
                          <span
                            className="px-1.5 py-0.5 text-[10px] flex items-center gap-1 bg-[#ECFDF5] text-[#059669]"
                            style={{ borderRadius: '3px', fontWeight: 500 }}
                          >
                            <Check className="w-2.5 h-2.5" />
                            {addedQuantity} EA · {addedLineItemCount === 1 ? '1 line' : `${addedLineItemCount} lines`}
                          </span>
                          {/* Interactive +1 EA pill */}
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddQuantityToExisting(product);
                            }}
                            className="px-2 py-0.5 text-[10px] flex items-center gap-0.5 bg-[#1B6EF3] text-white hover:bg-[#0D5ED7] transition-colors cursor-pointer"
                            style={{ borderRadius: '4px', fontWeight: 600 }}
                          >
                            <Plus className="w-2.5 h-2.5" />
                            1 EA
                          </span>
                        </div>
                      )}

                      {!added && (
                        <span
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ borderRadius: '4px', fontWeight: 600, backgroundColor: '#E7F3FF', color: '#1B6EF3' }}
                        >
                          <Plus className="w-2.5 h-2.5" />
                          Add
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {stockAlert && stockAlert.productId === product.id && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="flex items-start gap-2 px-2.5 py-2 bg-[#FEF2F2] border border-[#FEE2E2] text-[#991B1B]" style={{ borderRadius: '4px' }}>
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
      <div className="flex flex-col overflow-hidden bg-[#FAFBFC]" style={sidebarStyle}>
        {quoteDraft.lineItems.length === 0 && !quickTipsDismissed && (
          <>
            <div className="px-6 pb-6 pt-4 flex-shrink-0 group">
              <div className="w-full flex items-center justify-between">
                <button
                  onClick={() => setShowQuickTips(!showQuickTips)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <Lightbulb className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                  <h4 className="text-[12px] text-[#6B7280] group-hover:text-[#1F2937] transition-colors" style={{ fontWeight: 500 }}>
                    Quick Tips
                  </h4>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuickTipsDismissed(true)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9CA3AF] hover:text-[#1F2937] p-1 flex items-center justify-center"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowQuickTips(!showQuickTips)}
                    className="text-[#9CA3AF] flex items-center justify-center"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showQuickTips ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {showQuickTips && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1B6EF3] mt-1.5 flex-shrink-0"></div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">
                      Click <span className="text-[#1F2937]" style={{ fontWeight: 500 }}>Advanced Configuration</span> to set pricing rules, shipment methods, and attachments
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1B6EF3] mt-1.5 flex-shrink-0"></div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">
                      Green borders indicate products already added to the quote
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1B6EF3] mt-1.5 flex-shrink-0"></div>
                    <p className="text-[11px] text-[#6B7280] leading-relaxed">
                      Adjust quantities and discounts directly in the item card
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[#E5E7EB]"></div>
          </>
        )}

        <div className="px-6 py-4 flex-shrink-0 bg-[#FAFBFC]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase text-[#6B7280]" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                Selected Items
              </span>
              {quoteDraft.lineItems.length > 0 && (
                <div 
                  className="inline-flex items-center gap-0 overflow-hidden" 
                  style={{ 
                    borderRadius: '4px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  <span 
                    className="px-2 py-0.5 text-[11px] text-[#1F2937]" 
                    style={{ fontWeight: 600, backgroundColor: '#FFFFFF' }}
                  >
                    {quoteDraft.lineItems.length}
                  </span>
                </div>
              )}
            </div>
            {quoteDraft.lineItems.length > 0 && (
              <button
                onClick={handleRemoveAll}
                className="text-[12px] text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-1.5 rounded transition-all border border-transparent hover:border-[#FCA5A5]"
                style={{ fontWeight: 500 }}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 bg-[#F9FAFB]">
          {quoteDraft.lineItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-3">
                <Package className="w-8 h-8 text-[#9CA3AF]" />
              </div>
              <p className="text-[13px] text-[#6B7280]">No items selected</p>
              <p className="text-[12px] text-[#9CA3AF] mt-1">Add products from the catalog</p>
            </div>
          ) : (
            <div className={sidebarWidth === 'narrow' ? 'space-y-3' : 'grid gap-3'} style={sidebarWidth === 'narrow' ? {} : { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {quoteDraft.lineItems.map((item) => {
                const isInDuplicateGroup = quoteDraft.lineItems.filter(i => i.productId === item.productId).length > 1;
                const origNum = originalItemNumbers[item.id];
                const isNewlyAdded = newlyAddedIds.has(item.id);
                const isQtyBumped = qtyBumpIds.has(item.id);
                return (
                <div
                  key={item.id}
                  ref={(el) => { if (el) cardRefsMap.current.set(item.id, el); else cardRefsMap.current.delete(item.id); }}
                  className={`border bg-white p-3 flex flex-col relative ${isNewlyAdded ? 'newly-added-card' : ''} ${isQtyBumped ? 'qty-bump-card' : ''}`}
                  style={{ 
                    borderRadius: '8px',
                    borderColor: isNewlyAdded ? '#93C5FD' : isQtyBumped ? '#10B981' : '#E5E7EB',
                    boxShadow: isNewlyAdded ? '0 0 0 2px rgba(59,130,246,0.12)' : isQtyBumped ? '0 0 0 2px rgba(16, 185, 129, 0.12)' : undefined,
                    transition: 'border-color 300ms ease, box-shadow 300ms ease',
                  }}
                >
                  {/* Item Number Badge - top-left corner */}
                  <div 
                    className="absolute top-0 left-0 flex items-center justify-center text-[10px]"
                    style={{ 
                      width: '20px',
                      height: '20px',
                      borderBottomRightRadius: '8px',
                      fontWeight: 600,
                      backgroundColor: '#DBEAFE',
                      color: '#1E40AF',
                    }}
                  >
                    {itemNumbers[item.id]}
                  </div>

                  <div className="mb-2 flex-1">
                    <div className="flex items-start justify-between mb-0.5" style={{ paddingLeft: '46px' }}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                          {item.productId}
                        </span>
                        {(() => {
                          const product = PRODUCTS.find(p => p.id === item.productId);
                          if (product?.isSerialized) return <span className="text-[10px] px-1 py-0.5 bg-[#DBEAFE] text-[#1E40AF]" style={{ borderRadius: '3px', fontWeight: 600 }}>Serialized</span>;
                          if (product?.isLotControlled) return <span className="text-[10px] px-1 py-0.5 bg-[#E0E7FF] text-[#3730A3]" style={{ borderRadius: '3px', fontWeight: 600 }}>Lot Controlled</span>;
                          return <span className="text-[10px] px-1 py-0.5 bg-[#F3F4F6] text-[#374151]" style={{ borderRadius: '3px', fontWeight: 600 }}>Non-Serialized</span>;
                        })()}
                        {isInDuplicateGroup && origNum != null && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '10px', fontWeight: 500, color: '#8B5CF6',
                            backgroundColor: 'transparent', border: '1px dashed #C4B5FD',
                            padding: '1px 6px 1px 4px', borderRadius: '4px', lineHeight: '1',
                            whiteSpace: 'nowrap',
                          }}>
                            <Layers style={{ width: '9px', height: '9px', flexShrink: 0 }} />
                            Duplicate of #{origNum}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPendingDuplicateItemId(item.id)}
                          className="flex-shrink-0 text-[#9CA3AF] hover:text-[#7C3AED] hover:bg-[#F3E8FF] p-0.5 transition-colors"
                          style={{ borderRadius: '4px' }}
                          title="Duplicate as separate line item"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="flex-shrink-0 text-[#DC2626] hover:text-[#991B1B] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-shrink-0">
                        {item.images && item.images.length > 0 && (
                          <ImageWithFallback
                            src={item.images[0]}
                            alt={item.description}
                            className="w-9 h-9 object-cover flex-shrink-0"
                            style={{ borderRadius: '50%', border: '1px solid #E5E7EB' }}
                          />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="mb-1">
                          <div className="text-[12px] text-[#6B7280]" style={{ fontWeight: 400, lineHeight: '1.5' }}>
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
                                  className="text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors inline text-[12px]"
                                  style={{ fontWeight: 500 }}
                                >
                                  see less
                                </button>
                              </>
                            ) : (
                              <>
                                {item.description.length > 80
                                  ? item.description.slice(0, 80) + '...'
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
                                      className="text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors inline-flex items-center gap-0.5 whitespace-nowrap text-[12px]"
                                      style={{ fontWeight: 500 }}
                                    >
                                      more <ChevronDown className="w-3 h-3 inline" />
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
                        className="text-[11px] text-[#6B7280]"
                        style={{ fontWeight: 500 }}
                      >
                        Quantity
                      </label>
                      <label
                        className="text-[11px] text-[#6B7280]"
                        style={{ fontWeight: 500 }}
                      >
                        Item Total
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const newQty = Math.max(1, parseInt(e.target.value) || 1);
                          handleUpdateQuantity(item.id, newQty - item.quantity);
                        }}
                        className={`w-20 h-8 px-2 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3] focus:border-transparent ${isQtyBumped ? 'qty-bump-input' : ''}`}
                        style={{ borderRadius: '6px' }}
                        min="1"
                      />
                      <div className="flex-1 text-right min-w-0">
                        {sidebarWidth === 'narrow' ? (
                          <div className="text-[13px] text-[#1F2937] truncate" style={{ fontWeight: 600 }}>
                            <Money valuePKR={item.total} /> <span className="text-[#6B7280]" style={{ fontWeight: 400 }}>({UNITS_OF_MEASURE.find(u => u.id === (item.uom || 'ea'))?.name || 'EA'})</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-[16px] text-[#1F2937] truncate" style={{ fontWeight: 600 }}>
                              <Money valuePKR={item.total} />
                            </div>
                            <div className="text-[11px] text-[#6B7280]" style={{ fontWeight: 400 }}>
                              ({UNITS_OF_MEASURE.find(u => u.id === (item.uom || 'ea'))?.name || 'EA'})
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => handleOpenConfig(item)}
                      className="w-full h-8 flex items-center justify-center gap-2 border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#1B6EF3] hover:text-[#1B6EF3] transition-colors"
                      style={{ borderRadius: '6px', fontWeight: 500 }}
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

        {quoteDraft.lineItems.length > 0 && (
          <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] px-6 py-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] text-[#6B7280]">
                Subtotal ({quoteDraft.lineItems.length} items)
              </span>
              <span className="text-[20px] text-[#1B6EF3]" style={{ fontWeight: 600 }}>
                <Money valuePKR={subtotal} />
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF]">+ Shipping calculated on next step</p>
          </div>
        )}
      </div>

      {selectedItemForConfig && (
        <LineItemConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          item={selectedItemForConfig}
          onSave={handleSaveConfig}
          customerCurrency={customerCurrency}
        />
      )}

      {stockAlert && (
        <div className="absolute top-4 right-4 px-4 py-2 bg-white border border-[#FCA5A5] text-[#DC2626] rounded shadow-md" style={{ fontWeight: 500, fontSize: '13px' }}>
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
    </div>
  );
}