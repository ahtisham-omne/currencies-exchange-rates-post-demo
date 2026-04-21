import React, { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "../ui/tooltip";
import {
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  MapPin,
  X,
  Building2,
  Truck,
} from "lucide-react";
import {
  type PartnerLocationItem,
  type PaymentMethodType,
  type PaymentMethodEntry,
  FUNDED_BY_ITEMS,
  CURRENCY_OPTIONS,
} from "./partnerConstants";

// ── Reusable pill-style option button ──
export function PillOption({ label, isSelected, onClick }: { label: string; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border text-xs sm:text-sm transition-all ${
        isSelected
          ? "border-primary bg-accent text-primary"
          : "border-border bg-white text-slate-700 hover:border-slate-300"
      }`}
      style={{ fontWeight: isSelected ? 600 : 500 }}
    >
      {label}
    </button>
  );
}

// ── Reusable: radio option card ──
export function RadioOption({ label, description, isSelected, onClick }: { label: string; description?: string; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
        isSelected
          ? "border-primary bg-accent/30"
          : "border-border hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
          isSelected ? "border-primary" : "border-slate-300"
        }`}>
          {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
        </div>
        <div>
          <p className="text-xs text-foreground" style={{ fontWeight: 600 }}>{label}</p>
          {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
    </button>
  );
}

// ── Reusable: icon card option (like Purchased / Manufactured) ──
export function IconCardOption({ label, icon, isSelected, onClick }: { label: string; icon: React.ReactNode; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 transition-all min-w-[100px] ${
        isSelected
          ? "border-primary bg-accent/40 text-primary"
          : "border-border bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        isSelected ? "bg-[#D6E8FF]" : "bg-muted"
      }`}>
        {icon}
      </div>
      <span className="text-sm" style={{ fontWeight: 600 }}>{label}</span>
    </button>
  );
}

// ── Searchable partner/location dropdown ──
export function SearchablePartnerDropdown({
  label,
  tooltip,
  placeholder,
  items,
  selectedId,
  onSelect,
  showDefaultBadge,
  disabled,
  hideLabel,
  showLocationFilter,
  useDialog,
}: {
  label: string;
  tooltip: string;
  placeholder: string;
  items: PartnerLocationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showDefaultBadge?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  showLocationFilter?: boolean;
  useDialog?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "partners" | "locations">("all");

  const selectedItem = items.find((i) => i.id === selectedId) || null;

  const filtered = useMemo(() => {
    let list = items;
    if (showLocationFilter) {
      if (filterTab === "partners") list = list.filter((i) => i.type === "partner");
      if (filterTab === "locations") list = list.filter((i) => i.type === "location");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || (i.location && i.location.toLowerCase().includes(q)));
    }
    return list;
  }, [items, filterTab, search, showLocationFilter]);

  // Group items by type for dialog view
  const groupedItems = useMemo(() => {
    if (!useDialog) return { partners: [], locations: [] };
    const partners = filtered.filter((i) => i.type === "partner");
    const locations = filtered.filter((i) => i.type === "location");
    return { partners, locations };
  }, [filtered, useDialog]);

  const triggerButton = (
    <button
      disabled={disabled}
      onClick={useDialog ? () => !disabled && setOpen(true) : undefined}
      className={`w-full min-h-[40px] px-3 py-2 rounded-lg border flex items-center justify-between text-sm transition-colors ${
        disabled
          ? "bg-slate-50 border-border cursor-not-allowed"
          : open
            ? "bg-white border-primary ring-2 ring-primary/10"
            : "bg-white border-border hover:border-slate-300"
      }`}
    >
      {selectedItem ? (
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] shrink-0 mt-0.5"
            style={{ backgroundColor: selectedItem.logoColor, fontWeight: 700 }}
          >
            {selectedItem.logoText}
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-foreground text-[13px]" style={{ fontWeight: 500 }}>{selectedItem.name}</span>
            {selectedItem.location && (
              <span className="text-[10px] text-slate-500 flex items-start gap-0.5 leading-relaxed">
                <MapPin className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                <span className="break-words">{selectedItem.location}</span>
              </span>
            )}
          </div>
          {showDefaultBadge && selectedItem.isDefault && (
            <span className="text-[10px] text-primary bg-accent border border-primary/20 px-1.5 py-0.5 rounded shrink-0" style={{ fontWeight: 600 }}>Primary</span>
          )}
        </div>
      ) : (
        <span className="text-slate-400">{placeholder}</span>
      )}
      {open ? (
        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
      ) : (
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      )}
    </button>
  );

  const renderItemRow = (item: PartnerLocationItem, compact?: boolean) => (
    <button
      key={item.id}
      onClick={() => {
        onSelect(item.id);
        setOpen(false);
        setSearch("");
        setFilterTab("all");
      }}
      className={`w-full flex items-center gap-3 px-4 ${compact ? "py-2.5" : "py-3"} text-left transition-colors hover:bg-slate-50 ${
        selectedId === item.id ? "bg-accent/50" : ""
      }`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] shrink-0"
        style={{ backgroundColor: item.logoColor, fontWeight: 700 }}
      >
        {item.logoText}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-foreground" style={{ fontWeight: 500 }}>{item.name}</span>
        {item.location && (
          <span
            className="flex items-start gap-1 text-[10px] text-slate-500 hover:text-primary hover:underline leading-relaxed mt-0.5 transition-colors cursor-pointer"
            onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location!)}`, "_blank"); }}
          >
            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
            <span className="break-words">{item.location}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-md border ${
          item.type === "location"
            ? "text-[#22C55E] bg-emerald-50 border-[#22C55E]/20"
            : "text-violet-500 bg-violet-50 border-violet-500/20"
        }`} style={{ fontWeight: 600 }}>
          {item.type === "location" ? "Location" : "Partner"}
        </span>
        {selectedId === item.id && <Check className="w-4 h-4 text-primary shrink-0" />}
      </div>
    </button>
  );

  const searchBar = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${label.toLowerCase()}...`}
        className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        autoFocus
      />
    </div>
  );

  if (useDialog) {
    // Dialog-based picker for Ship To (handles large lists)
    return (
      <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
        {!hideLabel && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>{label}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex" tabIndex={-1}>
                  <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[12px] leading-[1.5] z-[300]">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        {triggerButton}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="!max-w-[520px] p-0 gap-0 rounded-2xl border-0 overflow-hidden"
            style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
            hideCloseButton
          >
            <DialogTitle className="sr-only">Select {label}</DialogTitle>
            <DialogDescription className="sr-only">Choose a partner or location for {label}</DialogDescription>

            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-muted">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Truck className="w-4 h-4 text-[#22C55E]" />
                  </div>
                  <div>
                    <h3 className="text-sm text-foreground" style={{ fontWeight: 600 }}>Select {label}</h3>
                    <p className="text-[11px] text-slate-500">{filtered.length} results available</p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); setSearch(""); setFilterTab("all"); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search */}
              {searchBar}

              {/* Filter tabs */}
              <div className="flex items-center gap-1.5 mt-3">
                {(["all", "partners", "locations"] as const).map((tab) => {
                  const count = tab === "all" ? items.length : items.filter(i => tab === "partners" ? i.type === "partner" : i.type === "location").length;
                  return (
                    <button
                      key={tab}
                      onClick={() => setFilterTab(tab)}
                      className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                        filterTab === tab
                          ? "border border-primary text-primary bg-accent"
                          : "border border-border text-slate-700 bg-white hover:bg-slate-50"
                      }`}
                      style={{ fontWeight: filterTab === tab ? 600 : 500 }}
                    >
                      {tab === "all" ? "All" : tab === "partners" ? "Partners" : "Locations"} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grouped list */}
            <div className="max-h-[380px] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-10 text-center">
                  <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500" style={{ fontWeight: 500 }}>No results found</p>
                  <p className="text-xs text-slate-400 mt-0.5">Try a different search term</p>
                </div>
              ) : filterTab === "all" && !search.trim() ? (
                <>
                  {/* Locations group */}
                  {groupedItems.locations.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-[#FAFBFC] border-b border-muted flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span className="text-[11px] text-slate-500 uppercase tracking-wide" style={{ fontWeight: 600 }}>
                          Partner Locations ({groupedItems.locations.length})
                        </span>
                      </div>
                      {groupedItems.locations.map((item) => renderItemRow(item, true))}
                    </div>
                  )}
                  {/* Partners group */}
                  {groupedItems.partners.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-[#FAFBFC] border-b border-muted flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-violet-500" />
                        <span className="text-[11px] text-slate-500 uppercase tracking-wide" style={{ fontWeight: 600 }}>
                          Partners ({groupedItems.partners.length})
                        </span>
                      </div>
                      {groupedItems.partners.map((item) => renderItemRow(item, true))}
                    </div>
                  )}
                </>
              ) : (
                filtered.map((item) => renderItemRow(item, true))
              )}
            </div>

            {/* Selected footer */}
            {selectedItem && (
              <div className="px-4 py-3 border-t border-muted bg-[#FAFBFC] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />
                  <span className="text-xs text-slate-700 truncate" style={{ fontWeight: 500 }}>
                    Selected: <span style={{ fontWeight: 600 }}>{selectedItem.name}</span>
                  </span>
                </div>
                <button
                  onClick={() => { setOpen(false); setSearch(""); setFilterTab("all"); }}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs hover:bg-[#0966DB] transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  Done
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Default: Popover dropdown (for Pay To, etc.)
  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      {!hideLabel && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>{label}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex" tabIndex={-1}>
                <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[12px] leading-[1.5] z-[300]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          {triggerButton}
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border border-border shadow-lg z-[200]"
          align="start"
          sideOffset={4}
        >
          {/* Filter tabs - only when showLocationFilter */}
          {showLocationFilter && (
            <div className="px-3 pt-3 pb-2 flex items-center gap-1.5">
              {(["all", "partners", "locations"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    filterTab === tab
                      ? "border border-primary text-primary bg-white"
                      : "border border-border text-slate-700 bg-white hover:bg-slate-50"
                  }`}
                  style={{ fontWeight: filterTab === tab ? 600 : 500 }}
                >
                  {tab === "all" ? "All" : tab === "partners" ? "Partners" : "Locations"}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className={`px-3 ${showLocationFilter ? "pb-2" : "py-3"}`}>
            {searchBar}
          </div>

          {/* List */}
          <div className="max-h-[240px] overflow-y-auto border-t border-muted">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No results found</div>
            ) : (
              filtered.map((item) => renderItemRow(item))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
// ── Currency dropdown ──
export function CurrencyDropdown({
  selectedId,
  onSelect,
  hideLabel,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  hideLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = CURRENCY_OPTIONS.find((c) => c.id === selectedId);

  const filtered = useMemo(() => {
    if (!search.trim()) return CURRENCY_OPTIONS;
    const q = search.toLowerCase();
    return CURRENCY_OPTIONS.filter((c) => c.label.toLowerCase().includes(q));
  }, [search]);

  return (
    <div>
      {!hideLabel && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>Currency</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex" tabIndex={-1}>
                <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[12px] leading-[1.5] z-[300]">
              The currency used for all transactions with this partner. Ensure it matches your billing and funding requirements.
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`w-full h-10 px-3 rounded-lg border bg-white flex items-center justify-between text-sm transition-colors ${
              open ? "border-primary ring-2 ring-primary/10" : "border-border hover:border-slate-300"
            }`}
          >
            {selected ? (
              <span className="flex items-center gap-2 text-foreground truncate" style={{ fontWeight: 500 }}>
                <span className="text-base shrink-0">{(selected as any).flag || ""}</span>
                {selected.label}
              </span>
            ) : (
              <span className="text-slate-400">Select a currency</span>
            )}
            {open ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border border-border shadow-lg z-[250]"
          align="start"
          sideOffset={4}
          style={{ maxHeight: "min(380px, var(--radix-popover-content-available-height))" }}
        >
          <div className="p-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search currency..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                autoFocus
              />
            </div>
          </div>
          <div className="border-t border-muted" style={{ maxHeight: 300, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No results found</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelect(c.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                    selectedId === c.id ? "bg-accent/50" : ""
                  }`}
                >
                  <span className="text-base shrink-0">{(c as any).flag || ""}</span>
                  <span className="w-7 text-center text-[12px] text-slate-500 shrink-0" style={{ fontWeight: 600 }}>{c.symbol}</span>
                  <span className="text-sm text-foreground truncate" style={{ fontWeight: 500 }}>{c.label}</span>
                  {selectedId === c.id && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Funded By dropdown (simple list, no tabs/search) ──
export function FundedByDropdown({
  selectedId,
  onSelect,
  disabled,
  hideLabel,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedItem = FUNDED_BY_ITEMS.find((i) => i.id === selectedId) || null;

  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      {!hideLabel && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs text-foreground" style={{ fontWeight: 600 }}>Funded By</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex" tabIndex={-1}>
                <Info className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="max-w-[260px] text-[12px] leading-[1.5] z-[300]">
              The organization or entity covering the costs of this transaction. This is usually the buyer or their funding partner.
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className={`w-full h-10 px-3 rounded-lg border flex items-center justify-center text-sm transition-colors ${
              disabled
                ? "bg-slate-50 border-border cursor-not-allowed"
                : open
                  ? "bg-white border-primary ring-2 ring-primary/10"
                  : "bg-white border-border hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              {selectedItem ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] shrink-0"
                    style={{ backgroundColor: selectedItem.logoColor, fontWeight: 700 }}
                  >
                    {selectedItem.logoText}
                  </div>
                  <span className="text-foreground truncate" style={{ fontWeight: 500 }}>{selectedItem.name}</span>
                  {selectedItem.isDefault && (
                    <span className="text-[10px] text-primary bg-accent border border-primary/20 px-1.5 py-0.5 rounded shrink-0" style={{ fontWeight: 600 }}>Primary</span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400">Select funding source</span>
              )}
              {open ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl border border-border shadow-lg z-[200]"
          align="start"
          sideOffset={4}
        >
          <div className="max-h-[280px] overflow-y-auto py-1">
            {FUNDED_BY_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                  selectedId === item.id ? "bg-accent/50" : ""
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] shrink-0"
                  style={{ backgroundColor: item.logoColor, fontWeight: 700 }}
                >
                  {item.logoText}
                </div>
                <span className="text-sm text-foreground truncate" style={{ fontWeight: 500 }}>{item.name}</span>
                {item.isDefault && (
                  <span className="text-[10px] text-primary bg-accent border border-primary/20 px-1.5 py-0.5 rounded shrink-0 ml-auto" style={{ fontWeight: 600 }}>Primary</span>
                )}
                {selectedId === item.id && !item.isDefault && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function createEmptyPaymentEntry(type: PaymentMethodType): PaymentMethodEntry {
  return {
    id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    expanded: true,
    isSaved: false,
    isPrimary: false,
    nickname: "",
    bankName: "",
    accountTitle: "",
    accountNumber: "",
    routingNumber: "",
    swiftCode: "",
    accountType: "checking",
    cardholderName: "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    billingAddress: "",
    walletProvider: "",
    walletId: "",
    payeeName: "",
    mailingAddress: "",
    recipientName: "",
    collectionPoint: "",
    methodName: "",
    description: "",
    documentLink: "",
    phone: "",
    countryCode: "+1",
    specialInstructions: "",
    applyDiscount: false,
    discountPercent: "",
    discountMode: "percent",
    additionalCharges: "",
    additionalChargesMode: "percent",
  };
}