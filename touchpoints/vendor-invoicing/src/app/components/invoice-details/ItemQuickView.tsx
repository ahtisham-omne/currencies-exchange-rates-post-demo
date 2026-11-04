import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Hash,
  Layers,
  ShoppingCart,
  Star,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/app/components/ui/hover-card';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

/* ════════════════════════════════════════════════════════════════
   ItemQuickView — verbatim port of the Add-Items modal recipe in
   VendorSelectionModalNested.tsx (lines 2280-2444 hover, lines
   2022-2194 modal). Two pieces:

   1. ItemImageWithPreview — image button with a HoverCard preview
      (slate-800 gradient header + category + on-hand + price +
      status pill) and an onClick that opens the full modal.

   2. ItemQuickViewModal — overlay with photo carousel, a 4-col stat
      grid (Vendor / Unit Price / Stocking Unit / Lead Time), detail
      rows (Category / UOM, Inventory Control / Acquisition) and a
      footer with Close + "Go to Item" external link. No stock levels —
      vendor invoices bill ordered/received qty, not on-hand.

   Both pull from the same deterministic per-item metadata (itemMeta)
   so the hover preview and the modal stay in sync.
   ════════════════════════════════════════════════════════════════ */

const ITEMS_MODULE_URL = 'https://nimble-palette.lovable.app';

const ITEM_PHOTOS = [
  'photo-1772209049802-cd0e0ff1a5d3',
  'photo-1713575882582-8938739db351',
  'photo-1737223450913-2af6885945e1',
  'photo-1759159091728-e2c87b9d9315',
  'photo-1661069387900-54d5843b704d',
  'photo-1758873263527-ca53b938fbd4',
  'photo-1672689933227-2ce1249c46a9',
  'photo-1767340078306-89630b12d81c',
  'photo-1769355104335-acef3aa4c9b6',
  'photo-1758857087505-957823893209',
];

const ITEM_CATEGORIES = ['Raw Material', 'Component', 'Assembly', 'Consumable', 'Finished Good'];
const ITEM_INVENTORY_CONTROLS = ['Serialized', 'Non-Serialized'] as const;
const ITEM_ACQUISITIONS = ['Purchase', 'Manufacturing'] as const;
const ITEM_UOMS = ['EA', 'ft', 'PK', 'RL', 'kg', 'lb', 'BX', 'SET'];
const ITEM_SHORT_DESCS = [
  'Industrial-grade component, batch-tracked, ready for production.',
  'Mill-certified raw material, ASTM-compliant.',
  'High-tolerance machined part for OEM assembly.',
  'Consumable supply, replenished on PAR-level schedule.',
  'Finished-good inventory item, pick-pack-ready.',
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function itemMetaFor(sku: string) {
  const ah = hashStr(sku);
  const category = ITEM_CATEGORIES[ah % ITEM_CATEGORIES.length];
  const inventoryControl = ITEM_INVENTORY_CONTROLS[ah % ITEM_INVENTORY_CONTROLS.length];
  const acquisition = ITEM_ACQUISITIONS[(ah * 3) % ITEM_ACQUISITIONS.length];
  const shortDesc = ITEM_SHORT_DESCS[ah % ITEM_SHORT_DESCS.length];
  const price = `$${(((ah * 7) % 500) + 10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return { category, inventoryControl, acquisition, shortDesc, price };
}

function mockItemDataFull(sku: string, fallbackDesc?: string) {
  const meta = itemMetaFor(sku);
  const uom = ITEM_UOMS[hashStr(sku) % ITEM_UOMS.length];
  const unitPrice = ((hashStr(sku + 'p') % 500) + 10) + 0.99;
  const leadTime = (hashStr(sku + 'l') % 14) + 3;
  return { ...meta, uom, unitPrice, leadTime, desc: fallbackDesc || meta.shortDesc };
}

export function imageForSku(sku: string) {
  const photo = ITEM_PHOTOS[hashStr(sku) % ITEM_PHOTOS.length];
  return `https://images.unsplash.com/${photo}?w=160&h=160&fit=crop&auto=format&q=80`;
}

export function largePhotosForSku(sku: string) {
  const base = hashStr(sku);
  const count = (base % 2) + 2;
  return Array.from({ length: count }, (_, i) =>
    `https://images.unsplash.com/${ITEM_PHOTOS[(base + i) % ITEM_PHOTOS.length]}?w=600&h=400&fit=crop&auto=format&q=80`,
  );
}

const formatCurrency = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

/* ── Image with HoverCard quick-preview ─────────────────────── */

interface ItemImageWithPreviewProps {
  sku: string;
  alt?: string;
  onPreview: () => void;
  /** When true, force the HoverCard closed (used while the big
   *  QuickView modal is open so the small preview doesn't stack). */
  disabled?: boolean;
  size?: 32 | 36 | 40;
  /** Actual invoice-line values so the preview matches the row (not
   *  fabricated from the item number hash). */
  unitPrice?: number;
  uom?: string;
  serialized?: boolean;
}

export function ItemImageWithPreview({ sku, alt, onPreview, disabled, size = 36, unitPrice, uom, serialized }: ItemImageWithPreviewProps) {
  const src = imageForSku(sku);
  const meta = itemMetaFor(sku);
  const dim = size === 32 ? 'w-8 h-8' : size === 40 ? 'w-10 h-10' : 'w-9 h-9';
  const priceLabel = unitPrice != null ? formatCurrency(unitPrice) : meta.price;
  const controlLabel = serialized != null ? (serialized ? 'Serialized' : 'Non-Serialized') : meta.inventoryControl;
  return (
    <HoverCard openDelay={300} closeDelay={80} open={disabled ? false : undefined}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className={`${dim} rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 cursor-zoom-in hover:border-primary/40 transition-colors group/img`}
          aria-label={`Preview ${sku}`}
        >
          <ImageWithFallback
            src={src}
            alt={alt || sku}
            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-0 overflow-hidden z-[70]"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
              <ImageWithFallback src={src} alt={alt || sku} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{sku}</p>
              <p className="text-[11px] text-slate-400 truncate">{meta.shortDesc}</p>
            </div>
          </div>
        </div>
        <div className="bg-white px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{meta.category}</span>
            </div>
            <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
              {priceLabel}
              <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ {uom || 'unit'}</span>
            </span>
          </div>
          {/* Master-data attributes (neutral pills) — no stock status. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <Hash className="w-3 h-3 text-slate-400" />
              {controlLabel}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <ShoppingCart className="w-3 h-3 text-slate-400" />
              {meta.acquisition}
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/* ── Full-size QuickView modal ──────────────────────────────── */

interface ItemQuickViewModalProps {
  open: boolean;
  onClose: () => void;
  sku: string;
  vendorName?: string;
  description?: string;
  /** Actual invoice-line values so the card matches the row it opened from. */
  unitPrice?: number;
  uom?: string;
  serialized?: boolean;
}

export function ItemQuickViewModal({ open, onClose, sku, vendorName, description, unitPrice, uom, serialized }: ItemQuickViewModalProps) {
  const [photoIdx, setPhotoIdx] = useState(0);
  if (!open) return null;
  const d = mockItemDataFull(sku, description);
  const photos = largePhotosForSku(sku);
  const currentPhoto = photos[photoIdx % photos.length];
  // Prefer the real invoice-line values over the hash-derived placeholders so
  // the card never contradicts the row (price / UOM / serialization).
  const displayPrice = unitPrice != null ? unitPrice : d.unitPrice;
  const displayUom = uom || d.uom;
  const displayControl = serialized != null ? (serialized ? 'Serialized' : 'Non-Serialized') : d.inventoryControl;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-white rounded-2xl border border-slate-200/50 overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close — pinned top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-slate-200"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>

        <div className="flex-1 overflow-y-auto">
          {/* Image carousel */}
          <div className="relative overflow-hidden bg-[#0C1222] select-none shrink-0" style={{ height: 'clamp(200px, 45vh, 420px)' }}>
            <ImageWithFallback src={currentPhoto} alt={sku} className="w-full h-full object-cover transition-opacity duration-200" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); window.open(currentPhoto, '_blank', 'noopener'); }}
              className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setPhotoIdx((p) => (p - 1 + photos.length) % photos.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoIdx((p) => (p + 1) % photos.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoIdx(i)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${i === photoIdx % photos.length ? 'bg-white w-3' : 'bg-white/40 hover:bg-white/60 w-1.5'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Detail body */}
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[15px] text-slate-900" style={{ fontWeight: 700 }}>{sku}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border bg-slate-50 text-slate-600 border-slate-200" style={{ fontWeight: 500 }}>
                <Star className="w-3 h-3" />
                Primary: {d.category}
              </span>
            </div>

            <p className="text-[13px] text-slate-500 mt-2 leading-relaxed line-clamp-3" style={{ fontWeight: 400 }}>
              {d.desc}
            </p>

            {/* 4-col stat grid */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200 rounded-xl border border-slate-200 overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[13px] text-slate-900 truncate" style={{ fontWeight: 700 }}>{(vendorName || 'Vendor').split(' ').slice(0, 2).join(' ')}</div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Vendor</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-slate-900" style={{ fontWeight: 700 }}>{formatCurrency(displayPrice)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Price per Unit</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-slate-900" style={{ fontWeight: 700 }}>
                  {displayUom}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Stocking Unit</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-slate-900" style={{ fontWeight: 700 }}>
                  {d.leadTime}
                  <span className="text-[11px] text-slate-500 ml-0.5">days</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Lead Time</div>
              </div>
            </div>

            {/* Detail rows — master-data attributes (category / UOM,
                inventory control / acquisition). No stock levels. */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2.5 py-0.5">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{d.category}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[13px] text-slate-500">{displayUom}</span>
              </div>
              <div className="flex items-center gap-2.5 py-0.5">
                <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{displayControl}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[13px] text-slate-500">{d.acquisition}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => { window.open(ITEMS_MODULE_URL, '_blank', 'noopener'); onClose(); }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer bg-primary hover:bg-[#0654BC]"
            style={{ fontWeight: 600 }}
          >
            Go to Item
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
