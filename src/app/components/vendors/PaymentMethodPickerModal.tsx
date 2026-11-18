/**
 * Browse the vendor's payment methods.
 *
 * The partner module's own picker (`PaymentMethodPickerModal.tsx` in
 * omne-frontend), which is what a purchase order opens from its Payment
 * Method row: a full-width modal with a Full view toggle, a search, category
 * pills counting what is behind them, and a grid of `PaymentMethodCard`s.
 * Picking a card commits it -- the source auto-selects when there is no
 * save-as-default decision to make -- so there is no footer to press.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Maximize2, Minimize2, Search, X } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { PaymentMethodCard } from '@/app/components/vendors/PaymentMethodCard';
import {
  paymentEntriesFor,
  paymentTypeMeta,
  PAYMENT_TYPE_CATEGORIES,
  type PaymentMethodEntry,
} from '@/app/data/vendorPaymentInstruments';

type FilterKey = 'All' | 'Default' | (typeof PAYMENT_TYPE_CATEGORIES)[number];

export function PaymentMethodPickerModal({
  open,
  onClose,
  vendorName,
  methods,
  vendorDefault,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  vendorName: string;
  /** What this vendor accepts, which is the partner-scoped list the order
   *  shows when the picker is opened from a purchase order. */
  methods: string[];
  vendorDefault: string;
  /** The method the document is on. */
  value: string;
  onApply: (name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('All');
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setFilter('All');
    setFullscreen(false);
  }, [open]);

  const entries = useMemo(
    () => paymentEntriesFor(vendorName, methods, vendorDefault),
    [vendorName, methods, vendorDefault],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === 'Default' && !e.isPrimary) return false;
      if (filter !== 'All' && filter !== 'Default' && paymentTypeMeta(e.type).category !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        e.nickname.toLowerCase().includes(q) ||
        paymentTypeMeta(e.type).label.toLowerCase().includes(q) ||
        e.bankName.toLowerCase().includes(q) ||
        e.walletProvider.toLowerCase().includes(q)
      );
    });
  }, [entries, search, filter]);

  const pills = useMemo(() => {
    const present = [...new Set(entries.map((e) => paymentTypeMeta(e.type).category))];
    return [
      { key: 'All' as FilterKey, label: 'All', count: entries.length },
      ...PAYMENT_TYPE_CATEGORIES.filter((c) => present.includes(c)).map((c) => ({
        key: c as FilterKey,
        label: c,
        count: entries.filter((e) => paymentTypeMeta(e.type).category === c).length,
      })),
      {
        key: 'Default' as FilterKey,
        label: 'Default',
        count: entries.filter((e) => e.isPrimary).length,
      },
    ];
  }, [entries]);

  if (!open || typeof document === 'undefined') return null;

  const commit = (entry: PaymentMethodEntry) => {
    onApply(entry.nickname);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col overflow-hidden border-0 bg-white shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] animate-in zoom-in-95 duration-200"
        style={
          fullscreen
            ? { maxWidth: 'calc(100% - 1rem)', height: 'calc(100dvh - 1rem)', borderRadius: 16 }
            : {
                maxWidth: 'min(75vw, 1080px)',
                height: 'min(88vh, 1080px)',
                minHeight: 560,
                borderRadius: 16,
              }
        }
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#EEF2F6] px-6">
          <div>
            <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              Payment Method
            </h3>
            <p className="text-[11px] text-muted-foreground">Methods {vendorName} accepts</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              className="hidden cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-slate-300 hover:bg-slate-50 sm:inline-flex"
              style={{ fontWeight: 500 }}
            >
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {fullscreen ? 'Exit full' : 'Full view'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex w-8 h-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-muted hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-b border-[#EEF2F6] px-5 pb-3 pt-4">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payment methods…"
              autoFocus
              className="h-9 rounded-lg border-[#D0D7E1] bg-white pl-9 pr-8 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] placeholder:text-slate-400 focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {pills.map((pill) => {
              const on = filter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilter(pill.key)}
                  aria-pressed={on}
                  className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
                    on
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/60 hover:text-foreground'
                  }`}
                  style={{ fontWeight: on ? 600 : 400 }}
                >
                  {pill.label}
                  <span
                    className="min-w-[18px] rounded-full px-1.5 py-px text-center text-[10px] tabular-nums"
                    style={{
                      fontWeight: 600,
                      backgroundColor: on ? 'rgba(10,119,255,0.10)' : 'hsl(var(--border))',
                      color: on ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto mb-3 flex w-12 h-12 items-center justify-center rounded-lg border border-[#E8ECF1] bg-muted">
                <CreditCard className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>
                No payment methods found
              </p>
              <p className="mt-1 text-[12px] text-slate-400">Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((entry) => (
                <PaymentMethodCard
                  key={entry.id}
                  entry={entry}
                  isSelected={entry.nickname === value}
                  onApply={commit}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
