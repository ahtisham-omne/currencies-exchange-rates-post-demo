import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Clock,
  Maximize2,
  Minimize2,
  Receipt,
  Search,
  SquareSplitHorizontal,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { FilterPills } from "./FilterPills";
import { PaymentTermCard } from "./PaymentTermCard";
import { PaymentTermDetailModal } from "./PaymentTermDetailModal";
import { usePaymentTermStatus } from "../../context/PaymentTermStatusContext";
import { PAYMENT_TERM_PRESETS, type PaymentTermPreset } from "./partnerConstants";

/**
 * Standalone Payment Terms picker — the same browse/select surface as the
 * partner-creation flow's "Payment Terms" modal (search, NET/Pre/Split type
 * toggle, status filter pills, sort, card grid with Apply), packaged as a
 * reusable component so detail-page surfaces can change a partner's terms
 * without forking the canonical UI.
 */
interface PaymentTermsPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Currently applied term id — highlights the matching card. */
  selectedTermId?: string | null;
  /** Called when the user applies a term (from a card or its detail view). */
  onApply: (term: PaymentTermPreset) => void;
  /** Header title, e.g. "Vendor Payment Terms". Defaults to "Payment Terms". */
  title?: string;
  /** Header subtitle under the title. */
  subtitle?: string;
}

type PtSortKey = "name" | "vendorsApplied" | "duration" | "category";

export function PaymentTermsPickerModal({
  open,
  onClose,
  selectedTermId,
  onApply,
  title = "Payment Terms",
  subtitle = "Browse templates and apply payment terms",
}: PaymentTermsPickerModalProps) {
  const [ptSearch, setPtSearch] = useState("");
  const [ptTypeFilters, setPtTypeFilters] = useState<"net" | "prepayment" | "split">("net");
  const [ptStatusFilter, setPtStatusFilter] = useState("all");
  const [ptSortBy, setPtSortBy] = useState<PtSortKey>("name");
  const [ptSortDir, setPtSortDir] = useState<"asc" | "desc">("asc");
  const [ptSortOpen, setPtSortOpen] = useState(false);
  const [ptFullscreen, setPtFullscreen] = useState(false);
  const [detailTerm, setDetailTerm] = useState<PaymentTermPreset | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fresh search/filter state on every open — matches the creation flow,
  // which resets these before opening the modal.
  useEffect(() => {
    if (open) {
      setPtSearch("");
      setPtTypeFilters("net");
      setPtStatusFilter("all");
    }
  }, [open]);

  // Hide archived terms entirely. Inactive (disabled) terms stay visible
  // in the list so users can still find them — applying one is blocked
  // with an explanatory error instead.
  const { getStatus: getPtStatus } = usePaymentTermStatus();
  const filteredPaymentTermPresets = useMemo(() => {
    let terms = PAYMENT_TERM_PRESETS.filter((t) => getPtStatus(t.id) !== "archived");
    if (ptTypeFilters) terms = terms.filter((t) => t.category === ptTypeFilters);
    if (ptStatusFilter === "preset") terms = terms.filter((t) => !t.id.startsWith("pt-custom-"));
    else if (ptStatusFilter === "custom") terms = terms.filter((t) => t.id.startsWith("pt-custom-"));
    else if (ptStatusFilter === "created_by_me") terms = terms.filter((t) => t.id.startsWith("pt-custom-"));
    else if (ptStatusFilter === "in_use") terms = terms.filter((t) => t.vendorsApplied >= 1);
    if (ptSearch.trim()) {
      const q = ptSearch.toLowerCase();
      terms = terms.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    const sorted = [...terms].sort((a, b) => {
      let cmp = 0;
      if (ptSortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (ptSortBy === "vendorsApplied") cmp = a.vendorsApplied - b.vendorsApplied;
      else if (ptSortBy === "duration") {
        const da = parseInt(a.duration || a.name.match(/\d+/)?.[0] || "0", 10);
        const db = parseInt(b.duration || b.name.match(/\d+/)?.[0] || "0", 10);
        cmp = da - db;
      } else if (ptSortBy === "category") cmp = a.category.localeCompare(b.category);
      return ptSortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [ptTypeFilters, ptStatusFilter, ptSearch, ptSortBy, ptSortDir, getPtStatus]);

  const handleApply = (t: PaymentTermPreset) => {
    if (getPtStatus(t.id) === "inactive") {
      // Disabled terms stay browsable but can't be applied.
      toast.error(`${t.name} is disabled`, {
        description: "Disabled terms can't be applied to partners. Enable it from the term detail to use it again.",
      });
      return;
    }
    onApply(t);
    setDetailOpen(false);
    setDetailTerm(null);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            onClose();
            setPtFullscreen(false);
          }
        }}
      >
        <DialogContent
          className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={ptFullscreen
            ? { maxWidth: "calc(100% - 1rem)", width: "calc(100% - 1rem)", height: "calc(100dvh - 1rem)", maxHeight: "calc(100dvh - 1rem)", borderRadius: 16 }
            : { maxWidth: "min(75vw, 1080px)", width: "calc(100% - 2rem)", height: "min(88vh, 1080px)", maxHeight: "min(88vh, 1080px)", minHeight: 640, borderRadius: 16 }
          }
          hideCloseButton
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
                onClick={() => setPtFullscreen(!ptFullscreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {ptFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {ptFullscreen ? "Exit Full" : "Full View"}
              </button>
              <button
                onClick={onClose}
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
                      value={ptSearch}
                      onChange={(e) => setPtSearch(e.target.value)}
                      placeholder="Search payment terms..."
                      className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                    />
                    {ptSearch && (
                      <button onClick={() => setPtSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Type toggle — inline with search, each tab has a hover tooltip */}
                  <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
                    {([
                      { key: "net", label: "Net", color: "rgb(var(--primary))", bg: "#EBF3FF", icon: Receipt, tip: "Payment is due a fixed number of days after an event (invoice date, delivery, etc.).", example: <><span className="text-primary" style={{ fontWeight: 600 }}>Net 30</span>, full payment due 30 days after invoice.</> },
                      { key: "prepayment", label: "Pre", color: "rgb(var(--violet))", bg: "#F5F3FF", icon: Clock, tip: "Full or partial payment required before goods are shipped or services rendered.", example: <><span className="text-violet" style={{ fontWeight: 600 }}>50% upfront</span> before production starts.</> },
                      { key: "split", label: "Split", color: "rgb(var(--warning))", bg: "#FFFBEB", icon: SquareSplitHorizontal, tip: "Payment is divided into multiple installments, each due at different milestones.", example: <><span className="text-amber-600" style={{ fontWeight: 600 }}>30/70 split</span>, 30% on order, 70% on delivery.</> },
                    ] as const).map((cat) => {
                      const active = ptTypeFilters === cat.key;
                      const count = PAYMENT_TERM_PRESETS.filter((t) => t.category === cat.key).length;
                      return (
                        <Tooltip key={cat.key}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setPtTypeFilters(cat.key)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                                active ? "shadow-sm" : "hover:bg-white/60"
                              }`}
                              style={{ fontWeight: active ? 600 : 500, color: active ? cat.color : "#334155", backgroundColor: active ? cat.bg : undefined }}
                            >
                              <cat.icon className="w-3.5 h-3.5" />
                              {cat.label}
                              <span
                                className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                                style={{ fontWeight: 600, color: active ? cat.color : "rgb(var(--muted-foreground))", backgroundColor: active ? `${cat.color}15` : "rgb(var(--border))" }}
                              >
                                {count}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            <p className="text-slate-500">{cat.tip}</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                              <p className="text-[11px] text-slate-700 mt-1">{cat.example}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  <div className="flex-1" />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                      {filteredPaymentTermPresets.length}
                    </span>
                    <Popover open={ptSortOpen} onOpenChange={setPtSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${ptSortOpen ? "text-primary bg-blue-50 border-blue-100" : "text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border"}`} style={{ fontWeight: 500 }}>
                          <ArrowUpDown className="w-3 h-3" />
                          {ptSortBy === "name" ? "Name" : ptSortBy === "vendorsApplied" ? "In Use" : ptSortBy === "duration" ? "Duration" : "Type"}
                          {ptSortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[250]" sideOffset={6}>
                        <div className="space-y-0.5">
                          {([
                            { key: "name", label: "Name", icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                            { key: "vendorsApplied", label: "In Use", icon: <Building2 className="w-3.5 h-3.5" /> },
                            { key: "duration", label: "Duration", icon: <Clock className="w-3.5 h-3.5" /> },
                            { key: "category", label: "Type", icon: <Tag className="w-3.5 h-3.5" /> },
                          ] as const).map((opt) => {
                            const isActive = ptSortBy === opt.key;
                            return (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  if (isActive) {
                                    setPtSortDir((d) => (d === "asc" ? "desc" : "asc"));
                                  } else {
                                    setPtSortBy(opt.key);
                                    setPtSortDir("asc");
                                  }
                                  setPtSortOpen(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${
                                  isActive
                                    ? "bg-blue-50 text-primary"
                                    : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500 }}
                              >
                                <span className={isActive ? "text-primary" : "text-slate-400"}>{opt.icon}</span>
                                <span className="flex-1 text-left">{opt.label}</span>
                                {isActive && (
                                  ptSortDir === "asc"
                                    ? <ArrowUp className="w-3 h-3 text-primary" />
                                    : <ArrowDown className="w-3 h-3 text-primary" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center overflow-x-auto">
                  <FilterPills
                    options={(() => {
                      const base = ptTypeFilters
                        ? PAYMENT_TERM_PRESETS.filter((t) => t.category === ptTypeFilters)
                        : PAYMENT_TERM_PRESETS;
                      const presetCount = base.filter((t) => !t.id.startsWith("pt-custom-")).length;
                      const customCount = base.filter((t) => t.id.startsWith("pt-custom-")).length;
                      return [
                        { key: "all", label: "All", count: base.length, showCount: true },
                        { key: "preset", label: "Template", count: presetCount, showCount: true },
                        { key: "custom", label: "Custom", count: customCount, showCount: true },
                        { key: "created_by_me", label: "Created by Me", count: customCount, showCount: true },
                        { key: "in_use", label: "In Use", count: base.filter((t) => t.vendorsApplied >= 1).length, showCount: true },
                      ];
                    })()}
                    activeKey={ptStatusFilter}
                    onSelect={(k) => setPtStatusFilter(k)}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                {filteredPaymentTermPresets.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 rounded-lg bg-muted border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>No payment terms found</p>
                    <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filter</p>
                  </div>
                ) : (
                  <div className="@container/ptgrid">
                    <div className="grid grid-cols-1 @[400px]/ptgrid:grid-cols-2 @[750px]/ptgrid:grid-cols-3 auto-rows-fr gap-4">
                      {filteredPaymentTermPresets.map((term) => (
                        <PaymentTermCard
                          key={term.id}
                          term={term}
                          isSelected={selectedTermId === term.id}
                          onClick={() => { setDetailTerm(term); setDetailOpen(true); }}
                          onApply={handleApply}
                          searchText={ptSearch}
                          showPresetBadge
                          inactive={getPtStatus(term.id) === "inactive"}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card "View" → full detail modal with Apply */}
      <PaymentTermDetailModal
        term={detailTerm}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailTerm(null); }}
        mode="create"
        onApply={handleApply}
      />
    </>
  );
}
