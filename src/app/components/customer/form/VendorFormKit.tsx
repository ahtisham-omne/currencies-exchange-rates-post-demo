import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ChevronUp,
  ExternalLink,
  Hash,
  Info,
  Layers,
  Lock,
  RotateCcw,
  ShoppingCart,
  Star,
  X,
  ZoomIn,
} from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/app/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

// Forked verbatim from the vendor CreateInvoiceScreen (round 2: the AR
// form is a copy of the vendor form, only data and flow differ). Item
// image + hover card, description "more", the GL account picker and the
// item quick view keep every class, size and copy pattern; only the
// account catalogue and the lock copy are customer-side.

const ITEM_IMAGES = [
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
export function imageForSku(sku: string) {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const photo = ITEM_IMAGES[Math.abs(h) % ITEM_IMAGES.length];
  return `https://images.unsplash.com/${photo}?w=160&h=160&fit=crop&auto=format&q=80`;
}
const ITEM_PHOTOS_LARGE = ITEM_IMAGES.map((p) => `https://images.unsplash.com/${p}?w=600&h=400&fit=crop&auto=format&q=80`);
function photosForSku(sku: string) {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const base = Math.abs(h);
  const count = (base % 2) + 2;
  return Array.from({ length: count }, (_, i) => ITEM_PHOTOS_LARGE[(base + i) % ITEM_PHOTOS_LARGE.length]);
}
const ITEM_UOMS_QV = ['EA', 'ft', 'PK', 'RL', 'kg', 'lb', 'BX', 'SET'];
function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
const ITEM_CATEGORIES = ['Raw Material', 'Component', 'Assembly', 'Consumable', 'Finished Good'];
const ITEM_INVENTORY_CONTROLS = ['Serialized', 'Non-Serialized'] as const;
const ITEM_ACQUISITIONS = ['Purchase', 'Manufacturing'] as const;
const ITEM_SHORT_DESCS = [
  'Industrial-grade component, batch-tracked, ready for production.',
  'Mill-certified raw material, ASTM-compliant.',
  'High-tolerance machined part for OEM assembly.',
  'Consumable supply, replenished on PAR-level schedule.',
  'Finished-good inventory item, pick-pack-ready.',
];
function itemMetaFor(sku: string) {
  const ah = hashStr(sku);
  return {
    category: ITEM_CATEGORIES[ah % ITEM_CATEGORIES.length],
    inventoryControl: ITEM_INVENTORY_CONTROLS[ah % ITEM_INVENTORY_CONTROLS.length],
    acquisition: ITEM_ACQUISITIONS[(ah * 3) % ITEM_ACQUISITIONS.length],
    shortDesc: ITEM_SHORT_DESCS[ah % ITEM_SHORT_DESCS.length],
    price: `$${(((ah * 7) % 500) + 10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  };
}
function mockItemDataFull(sku: string, fallbackDesc?: string) {
  const meta = itemMetaFor(sku);
  const h = hashStr(sku);
  return {
    ...meta,
    uom: ITEM_UOMS_QV[h % ITEM_UOMS_QV.length],
    unitPrice: (hashStr(sku + 'p') % 500) + 10 + 0.99,
    leadTime: (hashStr(sku + 'l') % 14) + 3,
    desc: fallbackDesc || meta.shortDesc,
  };
}

export const ITEMS_MODULE_URL = 'https://nimble-palette.lovable.app';
/** Sales orders and shipments open in a new tab (black, hover blue). */
export const SALES_ORDER_URL = (so: string) => `/sales-orders?so=${encodeURIComponent(so)}`;
export const SHIPMENT_URL = (sh: string) => `/shipments?shipment=${encodeURIComponent(sh)}`;

export function LineItemImage({ sku, src, alt, onPreview }: { sku: string; src: string; alt: string; onPreview: () => void }) {
  const meta = itemMetaFor(sku);
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="w-8 h-8 rounded-md border border-border bg-slate-50 overflow-hidden shrink-0 cursor-zoom-in hover:border-primary/40 transition-colors group/img"
        >
          <ImageWithFallback src={src} alt={alt} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-0 overflow-hidden z-[300]"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
              <ImageWithFallback src={src} alt={alt} className="w-full h-full object-cover" />
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
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              {meta.price}
              <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <Hash className="w-3 h-3 text-slate-400" />
              {meta.inventoryControl}
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

export function LineItemDescription({ description, query = '' }: { description: string; query?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!description) return null;
  return (
    <div className="text-[11px] text-slate-500 font-normal leading-snug mt-0.5 w-full max-w-full">
      {expanded ? (
        <span className="block leading-relaxed">
          {highlightText(description, query)}{' '}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors align-baseline text-[11px]"
            style={{ fontWeight: 500 }}
          >
            Show Less
            <ChevronUp className="w-3 h-3" />
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-1 w-full">
          <span className="truncate flex-1 min-w-0">{highlightText(description, query)}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
            }}
            className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors shrink-0 text-[11px]"
            style={{ fontWeight: 500 }}
          >
            More
            <ChevronDown className="w-3 h-3" />
          </button>
        </span>
      )}
    </div>
  );
}

// ── GL account picker (vendor GLAccountPicker, AR catalogue) ─────────

/** AR chart grouping: 1xxx assets, 2xxx liabilities, 4xxx revenue. */
export function groupArAccounts(accounts: readonly string[]): Record<string, string[]> {
  const g: Record<string, string[]> = {};
  for (const a of accounts) {
    const code = parseInt(a.split(' ')[0], 10);
    const cat = code >= 4000 && code < 5000 ? 'Revenue' : code >= 2000 && code < 3000 ? 'Liabilities' : code >= 1000 && code < 2000 ? 'Assets' : 'Other';
    (g[cat] ??= []).push(a);
  }
  return g;
}

export function GlAccountValue({ value, muted = false, placeholder = 'Select GL…' }: { value?: string; muted?: boolean; placeholder?: string }) {
  if (!value) return <span className="truncate min-w-0 flex-1 text-left mr-1 text-[11px]" style={{ fontWeight: 500 }}>{placeholder}</span>;
  const sp = value.indexOf(' ');
  const code = sp > 0 ? value.slice(0, sp) : value;
  const name = sp > 0 ? value.slice(sp + 1) : '';
  return (
    <span className="truncate min-w-0 flex-1 text-left mr-1 text-[11px]">
      <span className={muted ? 'text-slate-500' : 'text-foreground'} style={{ fontWeight: 600 }}>{code}</span>
      {name && <span className={`ml-1 ${muted ? 'text-slate-400' : 'text-slate-600'}`} style={{ fontWeight: 400 }}>{name}</span>}
    </span>
  );
}

export function GLAccountPicker({
  id,
  value,
  defaultValue,
  accounts,
  onChange,
  disabled = false,
  heightClass = 'h-8',
  error = false,
  lockedTitle,
  lockedBody = 'Mapped from the item master. Open the item to change it.',
}: {
  id?: string;
  value: string;
  defaultValue: string;
  accounts: readonly string[];
  onChange: (next: string) => void;
  disabled?: boolean;
  heightClass?: string;
  error?: boolean;
  lockedTitle?: string;
  lockedBody?: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupArAccounts(accounts), [accounts]);
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            id={id}
            className={`flex items-center justify-between w-full ${heightClass} px-2.5 bg-slate-50 text-slate-500 rounded-md border ${error ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'} cursor-not-allowed`}
          >
            <GlAccountValue value={value} muted placeholder="No account" />
            <Lock className="w-3 h-3 text-slate-300 shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
          <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>
            {lockedTitle ??
              (value ? (
                <>
                  <a
                    href={ITEMS_MODULE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] leading-snug text-foreground hover:text-primary underline decoration-slate-300 hover:decoration-primary underline-offset-2 transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    {value}
                  </a>{' '}
                  is locked for editing
                </>
              ) : (
                'Editing is disabled'
              ))}
          </p>
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{lockedBody}</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={`flex items-center justify-between w-full ${heightClass} px-2.5 bg-white hover:bg-slate-50 hover:border-primary/40 text-foreground rounded-md border ${error ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'} transition-colors group/gl`}
        >
          <GlAccountValue value={value} />
          <ChevronDown className="w-3 h-3 text-slate-400 group-hover/gl:text-primary shrink-0 transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-[340px] p-0 border border-border rounded-xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] z-[220] overflow-hidden"
        onOpenAutoFocus={() => setSearch('')}
      >
        <Command className="rounded-xl bg-white">
          <CommandInput
            placeholder="Search GL account…"
            value={search}
            onValueChange={setSearch}
            className="text-[12px] outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-6 text-center text-[12px] text-slate-400">No accounts match.</CommandEmpty>
            {Object.entries(groups).map(([category, list]) => (
              <CommandGroup
                key={category}
                heading={category}
                className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-slate-500 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:tracking-normal"
              >
                {list.map((account) => {
                  const code = account.split(' ')[0];
                  const name = account.substring(code.length + 1);
                  const isSelected = value === account;
                  return (
                    <CommandItem
                      key={account}
                      value={account}
                      onSelect={() => {
                        onChange(account);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 mx-1.5 px-2 py-1.5 rounded-md cursor-pointer data-[selected=true]:bg-blue-50"
                    >
                      <span className={`text-[11px] ${isSelected ? 'text-primary' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
                        {highlightText(code, search)}
                      </span>
                      <span className={`text-[11px] truncate flex-1 ${isSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                        {highlightText(name, search)}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          {value !== defaultValue && defaultValue && (
            <div className="border-t border-slate-100 px-2 py-1.5 bg-slate-50/60">
              <button
                type="button"
                onClick={() => {
                  onChange(defaultValue);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] text-primary hover:text-blue-700 transition-colors py-1.5 rounded-md hover:bg-blue-50"
                style={{ fontWeight: 500 }}
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Default <span style={{ fontWeight: 600 }}>{defaultValue.split(' ')[0]}</span>
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Destructive gradient confirm (vendor removal / discard recipe) ───

export function DestructiveConfirm({
  open,
  chip,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Continue Editing',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  chip: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-[400] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl max-w-[420px] w-full overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444' }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
            <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
          </div>
          <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}>
            {chip}
          </span>
        </div>
        <div className="flex flex-col items-center text-center px-8 pb-8">
          <h3 className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
            {title}
          </h3>
          <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.65, maxWidth: '310px' }}>
            {body}
          </p>
          <div className="w-full mt-7 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
              style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
              style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Item quick view (vendor ItemQuickView) ───────────────────────────

export function ItemQuickView({
  preview,
  partnerName,
  onClose,
}: {
  preview: { src: string; sku: string; description?: string } | null;
  partnerName: string;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  if (!preview) return null;
  const sku = preview.sku;
  const d = mockItemDataFull(sku, preview.description);
  const pool = photosForSku(sku);
  const photos = [preview.src.replace(/w=160&h=160/, 'w=600&h=400'), ...pool.filter((p) => p !== preview.src)];
  const currentPhoto = photos[idx % photos.length];
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 animate-in fade-in duration-200 pointer-events-auto" onClick={onClose}>
      <div
        className="relative w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-white rounded-2xl border border-gray-200/50 overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-gray-200"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>
        <div className="flex-1 overflow-y-auto">
          <div className="relative overflow-hidden bg-[#0C1222] select-none shrink-0" style={{ height: 'clamp(200px, 45vh, 420px)' }}>
            <ImageWithFallback src={currentPhoto} alt={sku} className="w-full h-full object-cover transition-opacity duration-200" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.open(currentPhoto, '_blank', 'noopener');
              }}
              className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
              aria-label="Open photo"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIdx((p) => (p - 1 + photos.length) % photos.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIdx((p) => (p + 1) % photos.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                  aria-label="Next photo"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIdx(i)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${i === idx % photos.length ? 'bg-white w-3' : 'bg-white/40 hover:bg-white/60 w-1.5'}`}
                      aria-label={`Photo ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>{sku}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border bg-slate-50 text-slate-600 border-slate-200" style={{ fontWeight: 500 }}>
                <Star className="w-3 h-3" />
                Primary: {d.category}
              </span>
            </div>
            <p className="text-[13px] text-slate-500 mt-2 leading-relaxed line-clamp-3" style={{ fontWeight: 400 }}>{d.desc}</p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-200 rounded-xl border border-gray-200 overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[13px] text-gray-900 truncate" style={{ fontWeight: 700 }}>{(partnerName || 'Customer').split(' ').slice(0, 2).join(' ')}</div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Partner</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>{formatCurrency(d.unitPrice)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Price per Unit</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>{d.uom}</div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Stocking Unit</div>
              </div>
              <div className="px-2.5 py-2.5 text-center">
                <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>
                  {d.leadTime}
                  <span className="text-[11px] text-slate-500 ml-0.5">days</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Lead Time</div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2.5 py-0.5">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{d.category}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[13px] text-slate-500">{d.uom}</span>
              </div>
              <div className="flex items-center gap-2.5 py-0.5">
                <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{d.inventoryControl}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[13px] text-slate-500">{d.acquisition}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-slate-50/60">
          <button type="button" onClick={onClose} className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              window.open(ITEMS_MODULE_URL, '_blank', 'noopener');
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer bg-primary hover:bg-blue-700"
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

/** Vendor's Label recipe for left-column fields (13px, ⓘ tooltip). */
export function InfoTip({ children, width = 240 }: { children: React.ReactNode; width?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help" onClick={(e) => e.stopPropagation()}>
          <Info className="w-3 h-3 text-slate-300" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]" style={{ maxWidth: width }}>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
