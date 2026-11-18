/**
 * Carrier browser — the partner Freight & Logistics shell (search, mode toggle
 * with counts, status pills, sort popover, CarrierCard grid). Shared so the
 * create form and the RMA detail sidebar pick from the same catalogue in the
 * same shape: changing the carrier on a Draft after the fact is the same
 * decision it was during creation, and should not read as a smaller one.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Clock, Maximize2, Minimize2, Plus, Search, Truck, X } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { FilterPills } from '@/app/components/vendors/FilterPills';
import { CarrierCard } from '@/app/components/CarrierCard';
import {
  CARRIER_CATALOGUE,
  CARRIER_MODE_LABEL,
  type CarrierMode,
  type VendorCarrier,
} from '@/app/data/vendorCarriers';

export function CarrierBrowseModal({
  open,
  onOpenChange,
  title,
  subtitle,
  entityNoun,
  selectedId,
  vendorDefaultCarrierId,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  /** Reads into the card's apply copy: "for this return" / "for this invoice". */
  entityNoun: string;
  selectedId: string | null;
  vendorDefaultCarrierId: string | null;
  onApply: (carrier: VendorCarrier) => void;
}) {
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'' | CarrierMode>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fullscreen, setFullscreen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'transit' | 'mode'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortOpen, setSortOpen] = useState(false);

  // Reopening starts on the whole catalogue: the last visit's narrowing is
  // about a decision already made, and silently hides carriers this time.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setModeFilter('');
    setStatusFilter('all');
  }, [open]);

  const filtered = useMemo(() => {
    let list = CARRIER_CATALOGUE.filter((c) => {
      if (modeFilter && c.mode !== modeFilter) return false;
      if (statusFilter === 'active' && c.status !== 'Active') return false;
      if (statusFilter === 'under_review' && c.status !== 'Under Review') return false;
      if (statusFilter === 'vendor' && c.id !== vendorDefaultCarrierId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.methodName.toLowerCase().includes(q) && !c.region.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'mode') return a.mode.localeCompare(b.mode) * dir;
      return (a.minDays - b.minDays) * dir; // transit
    });
    return list;
  }, [modeFilter, statusFilter, search, sortBy, sortDir, vendorDefaultCarrierId]);

  return (
<Dialog
  open={open}
  onOpenChange={(v) => { onOpenChange(v); if (!v) setFullscreen(false); }}
>
  <DialogContent
    className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:max-w-none"
    style={fullscreen
      ? { maxWidth: 'calc(100% - 1rem)', width: 'calc(100% - 1rem)', height: 'calc(100dvh - 1rem)', maxHeight: 'calc(100dvh - 1rem)', borderRadius: 16 }
      : { maxWidth: 'min(75vw, 1080px)', width: 'calc(100% - 2rem)', height: 'min(88vh, 1080px)', maxHeight: 'min(88vh, 1080px)', minHeight: 640, borderRadius: 16 }
    }
    showCloseButton={false}
  >
    <div className="flex items-center justify-between border-b border-[#EEF2F6] bg-card px-6 h-12 shrink-0">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{title}</h3>
          <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          {fullscreen ? 'Exit full' : 'Full view'}
        </button>
        <button
          onClick={() => onOpenChange(false)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
        <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search carriers..."
                className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
              {([
                { key: '' as const, label: 'All' },
                { key: 'air' as const, label: CARRIER_MODE_LABEL.air },
                { key: 'ground' as const, label: CARRIER_MODE_LABEL.ground },
                { key: 'sea' as const, label: CARRIER_MODE_LABEL.sea },
              ]).map((cat) => {
                const active = modeFilter === cat.key;
                const count = cat.key === '' ? CARRIER_CATALOGUE.length : CARRIER_CATALOGUE.filter((c) => c.mode === cat.key).length;
                return (
                  <button
                    key={cat.key || 'all'}
                    onClick={() => setModeFilter(cat.key)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                      active ? 'shadow-sm bg-white text-primary' : 'hover:bg-white/60 text-slate-600'
                    }`}
                    style={{ fontWeight: active ? 600 : 500 }}
                  >
                    {cat.label}
                    <span
                      className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                      style={{ fontWeight: 600, color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', backgroundColor: active ? 'rgba(10,119,255,0.10)' : 'hsl(var(--border))' }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1" />
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                {filtered.length}
              </span>
              <Popover open={sortOpen} onOpenChange={setSortOpen}>
                <PopoverTrigger asChild>
                  <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${sortOpen ? 'text-primary bg-blue-50 border-blue-100' : 'text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border'}`} style={{ fontWeight: 500 }}>
                    <ArrowUpDown className="w-3 h-3" />
                    {sortBy === 'name' ? 'Name' : sortBy === 'transit' ? 'Transit' : 'Mode'}
                    {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[250]" sideOffset={6}>
                  <div className="space-y-0.5">
                    {([
                      { key: 'name' as const, label: 'Name', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                      { key: 'transit' as const, label: 'Transit', icon: <Clock className="w-3.5 h-3.5" /> },
                      { key: 'mode' as const, label: 'Mode', icon: <Truck className="w-3.5 h-3.5" /> },
                    ]).map((opt) => {
                      const isActive = sortBy === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => {
                            if (isActive) {
                              setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortBy(opt.key);
                              setSortDir('asc');
                            }
                            setSortOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${
                            isActive ? 'bg-blue-50 text-primary' : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
                          }`}
                          style={{ fontWeight: isActive ? 600 : 500 }}
                        >
                          <span className={isActive ? 'text-primary' : 'text-slate-400'}>{opt.icon}</span>
                          <span className="flex-1 text-left">{opt.label}</span>
                          {isActive && (
                            sortDir === 'asc'
                              ? <ArrowUp className="w-3 h-3 text-primary" />
                              : <ArrowDown className="w-3 h-3 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                onClick={() => { toast.info('Add new carriers from the partner profile.'); }}
                className="bg-primary text-primary-foreground shrink-0 h-8 px-3 text-[12px]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Create New
              </Button>
            </div>
          </div>

          <div className="flex items-center overflow-x-auto">
            <FilterPills
              options={[
                { key: 'all', label: 'All', count: CARRIER_CATALOGUE.length, showCount: true },
                { key: 'active', label: 'Active', count: CARRIER_CATALOGUE.filter((c) => c.status === 'Active').length, showCount: true },
                { key: 'under_review', label: 'Under Review', count: CARRIER_CATALOGUE.filter((c) => c.status === 'Under Review').length, showCount: true },
                { key: 'vendor', label: 'Vendor Default', count: CARRIER_CATALOGUE.filter((c) => c.id === vendorDefaultCarrierId).length, showCount: true },
              ]}
              activeKey={statusFilter}
              onSelect={(k) => setStatusFilter(k)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 rounded-lg bg-muted border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                <Search className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>No carriers found</p>
              <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="@container/carriergrid">
            <div className="grid grid-cols-1 @[400px]/carriergrid:grid-cols-2 @[750px]/carriergrid:grid-cols-3 auto-rows-fr gap-4">
              {filtered.map((carrier) => {
                const isSelected = selectedId === carrier.id;
                const applyCarrier = (c: VendorCarrier) => {
                  onOpenChange(false);
                  onApply(c);
                };
                return (
                  <CarrierCard
                    key={carrier.id}
                    carrier={carrier}
                    isSelected={isSelected}
                    onClick={() => applyCarrier(carrier)}
                    onApply={(c) => applyCarrier(c)}
                    searchText={search}
                    showStatusBadge
                    entityNoun={entityNoun}
                    isVendorDefault={carrier.id === vendorDefaultCarrierId}
                  />
                );
              })}
            </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
  );
}
