/**
 * Ship-To picker — the PO detail page's partner/location selector, ported
 * so a return picks its destination from the same partner catalogue rather
 * than a flat list of three synthesized vendor addresses. Partners expand
 * into their locations; a search flattens the accordion open.
 */
import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, MapPin, Search, Truck, X } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/app/components/ui/dialog';
import { PARTNER_LOCATION_ITEMS, type PartnerLocationItem } from '@/app/data/partnerLocations';

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <span>
      {text.slice(0, idx)}
      <span className="bg-[#FEF08A] text-foreground rounded-sm px-0.5" style={{ fontWeight: 600 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </span>
  );
}

function PartnerLogo({ item, size = 32 }: { item: PartnerLocationItem; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  if (item.logoUrl && !imgErr) {
    return (
      <div
        className="rounded-lg border border-[#E8ECF1] bg-white flex items-center justify-center shrink-0 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img
          src={item.logoUrl}
          alt={item.name}
          className="w-full h-full object-contain p-1"
          onError={() => setImgErr(true)}
        />
      </div>
    );
  }
  return (
    <div
      className="rounded-lg flex items-center justify-center text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: item.logoColor, fontWeight: 700, fontSize: size * 0.3 }}
    >
      {item.logoText}
    </div>
  );
}

// Partners own the locations that share their logo identity; anything left
// over is a standalone location and lists flat under the groups.
function buildGroupedItems(items: PartnerLocationItem[], searchQuery: string) {
  const partners = items.filter((i) => i.type === 'partner');
  const locations = items.filter((i) => i.type === 'location');
  const q = searchQuery.toLowerCase().trim();
  const matches = (i: PartnerLocationItem) =>
    i.name.toLowerCase().includes(q) || (i.location?.toLowerCase().includes(q) ?? false);

  const grouped = partners.map((p) => {
    const pLocations = locations.filter((l) => l.logoText === p.logoText && l.logoColor === p.logoColor);
    const partnerMatches = !q || matches(p);
    const matchingLocations = !q ? pLocations : pLocations.filter(matches);
    return {
      partner: p,
      locations: pLocations,
      matchingLocations,
      hasMatch: partnerMatches || matchingLocations.length > 0,
    };
  });

  const groupedLocationIds = new Set(grouped.flatMap((g) => g.locations.map((l) => l.id)));
  const orphans = locations.filter((l) => !groupedLocationIds.has(l.id));
  return {
    grouped: grouped.filter((g) => !q || g.hasMatch),
    orphanLocations: !q ? orphans : orphans.filter(matches),
  };
}

/**
 * The destination list on its own.
 *
 * A consolidated return has to be told where it goes before it is anything at
 * all, and hiding that behind a dialog made the one blocking decision on the
 * step the one thing you could not see. The same list therefore renders in
 * place as well as inside the picker dialog -- one implementation, so the two
 * cannot drift.
 */
export function ShipToPicker({
  selectedId,
  onSelect,
  items = PARTNER_LOCATION_ITEMS,
  autoFocus = false,
  className = '',
  listClassName = 'max-h-[420px]',
  onDone,
  selectionStyle = 'check',
}: {
  selectedId: string | null;
  onSelect: (item: PartnerLocationItem) => void;
  items?: PartnerLocationItem[];
  autoFocus?: boolean;
  className?: string;
  listClassName?: string;
  /** Dismisses the surface the picker sits in. Absent when it is the surface
   *  -- rendered in place there is nothing to dismiss. */
  onDone?: (() => void) | undefined;
  /** A tick reads as "this one is chosen" in a dialog you are about to leave.
   *  Standing on the page as the only way to answer, the list is a choice
   *  between options and shows its unpicked ones too. */
  selectionStyle?: 'check' | 'radio';
}) {
  const Mark = ({ on }: { on: boolean }) =>
    selectionStyle === 'radio' ? (
      <span
        className={`w-3.5 h-3.5 rounded-full border-[1.5px] flex items-center justify-center shrink-0 ${
          on ? 'border-primary' : 'border-slate-300'
        }`}
      >
        {on && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
      </span>
    ) : on ? (
      <Check className="w-4 h-4 text-primary shrink-0" />
    ) : null;

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const choose = (item: PartnerLocationItem) => onSelect(item);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const { grouped, orphanLocations } = buildGroupedItems(items, search);
  const hasSearch = search.trim().length > 0;

  const openMap = (address: string) =>
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');

  return (
    <div className={className}>
      <div className="px-5 pt-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partners & locations..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            autoFocus={autoFocus}
          />
        </div>
      </div>

      <div className={`${listClassName} overflow-y-auto custom-scrollbar`}>
          {grouped.length === 0 && orphanLocations.length === 0 ? (
            <div className="py-10 text-center">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500" style={{ fontWeight: 500 }}>No results found</p>
              <p className="text-xs text-slate-400 mt-0.5">Try a different search term</p>
            </div>
          ) : (
            <div className="py-1">
              {grouped.map(({ partner, locations: allLocs, matchingLocations }) => {
                const locsToShow = hasSearch ? matchingLocations : allLocs;
                const isPartnerSelected = selectedId === partner.id;
                const isExpanded = hasSearch ? true : expanded.has(partner.id);
                const hasLocs = locsToShow.length > 0;
                return (
                  <div key={partner.id} className="border-b border-slate-50 last:border-b-0">
                    <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-black/[0.03] ${isPartnerSelected ? 'bg-accent/60' : ''}`}>
                      {hasLocs ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggle(partner.id); }}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      ) : (
                        <div className="w-5 h-5 shrink-0" />
                      )}
                      <PartnerLogo item={partner} />
                      <button onClick={() => choose(partner)} className="flex flex-col min-w-0 flex-1 text-left">
                        <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 600 }}>
                          {highlightMatch(partner.name, search)}
                        </span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {partner.isDefault && (
                          <span className="text-[10px] text-primary bg-primary/[0.06] border border-primary/15 px-1.5 py-0.5 rounded" style={{ fontWeight: 600 }}>
                            Primary
                          </span>
                        )}
                        {hasLocs && (
                          <span className="text-[10px] text-slate-400 bg-slate-50 border border-[#E8ECF1] px-1.5 py-0.5 rounded" style={{ fontWeight: 500 }}>
                            {locsToShow.length} loc{locsToShow.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        <Mark on={isPartnerSelected} />
                      </div>
                    </div>
                    {isExpanded && hasLocs && (
                      <div className="ml-9 border-l border-[#E8ECF1] bg-[#FAFBFC]/50">
                        {locsToShow.map((loc) => (
                          <button
                            key={loc.id}
                            onClick={() => choose(loc)}
                            className={`w-full flex items-center gap-3 pl-4 pr-4 py-2 text-left transition-colors hover:bg-black/[0.03] ${selectedId === loc.id ? 'bg-accent/60' : ''}`}
                          >
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[12px] text-slate-700 truncate" style={{ fontWeight: 500 }}>
                                {highlightMatch(loc.name, search)}
                              </span>
                              {loc.location && (
                                <span
                                  className="text-[10px] text-slate-400 hover:text-primary hover:underline transition-colors cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); openMap(loc.location!); }}
                                >
                                  {highlightMatch(loc.location, search)}
                                </span>
                              )}
                            </div>
                            <Mark on={selectedId === loc.id} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {orphanLocations.length > 0 && (
                <>
                  {grouped.length > 0 && <div className="border-t border-muted my-1" />}
                  {orphanLocations.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => choose(loc)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.03] ${selectedId === loc.id ? 'bg-accent/60' : ''}`}
                    >
                      <div className="w-5 h-5 shrink-0" />
                      <PartnerLogo item={loc} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>
                          {highlightMatch(loc.name, search)}
                        </span>
                        {loc.location && (
                          <span
                            className="text-[10px] text-slate-400 hover:text-primary hover:underline transition-colors cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); openMap(loc.location!); }}
                          >
                            {highlightMatch(loc.location, search)}
                          </span>
                        )}
                      </div>
                      <Mark on={selectedId === loc.id} />
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {selectedId && onDone && (
          <div className="px-4 py-3 border-t border-muted bg-[#FAFBFC] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
              <span className="text-xs text-slate-700 truncate" style={{ fontWeight: 500 }}>
                Selected{' '}
                <span style={{ fontWeight: 600 }}>{items.find((i) => i.id === selectedId)?.name ?? ''}</span>
              </span>
            </div>
            <button
              onClick={onDone}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-[#0966DB] transition-colors"
              style={{ fontWeight: 600 }}
            >
              Done
            </button>
          </div>
        )}
    </div>
  );
}

export function ShipToSelectionModal({
  open,
  onOpenChange,
  selectedId,
  onSelect,
  items = PARTNER_LOCATION_ITEMS,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | null;
  onSelect: (item: PartnerLocationItem) => void;
  items?: PartnerLocationItem[];
}) {
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent
        className="z-[240] !max-w-[520px] p-0 gap-0 rounded-2xl border-0 overflow-hidden"
        style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)' }}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Select Ship To</DialogTitle>
        <DialogDescription className="sr-only">Choose delivery destination</DialogDescription>

        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
              <Truck className="w-4 h-4 text-[#22C55E]" />
            </div>
            <div>
              <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Select Ship To</h3>
              <p className="text-[11px] text-slate-500">Choose delivery destination</p>
            </div>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ShipToPicker
          selectedId={selectedId}
          onSelect={(item) => {
            onSelect(item);
            close();
          }}
          items={items}
          autoFocus
          onDone={close}
        />
      </DialogContent>
    </Dialog>
  );
}
