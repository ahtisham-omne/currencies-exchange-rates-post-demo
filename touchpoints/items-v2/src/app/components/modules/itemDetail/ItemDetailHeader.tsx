import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Edit,
  Archive,
  PowerOff,
  ArchiveRestore,
  CircleCheck,
  CircleSlash,
  Tag as TagIcon,
  Shapes,
  Factory,
  LayoutDashboard,
  Layers,
  Settings,
  ShoppingCart,
  TrendingUp,
  Paperclip,
  Image as ImageIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useItemQuickView } from "@/app/components/items-v3/ItemQuickViewModal";
import { toCategoryCode } from "@/app/lib/categoryCode";

export const ITEM_DETAIL_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "inventory", label: "Inventory", icon: Layers },
  { id: "configurations", label: "Configurations", icon: Settings },
  { id: "purchasing", label: "Purchasing", icon: ShoppingCart },
  { id: "production", label: "Production", icon: Factory },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "attachments", label: "Attachments", icon: Paperclip },
] as const;

/* AAA-compliant status pill colours — mirrors Partners StatusPill visual. Static (no dropdown). */
const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  "In Stock":     { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0", label: "In Stock" },
  "Low Stock":    { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A", label: "Low Stock" },
  "Out of Stock": { color: "#991B1B", bg: "#FEF2F2", border: "#FECACA", label: "Out of Stock" },
  Discontinued:   { color: "#475569", bg: "#F1F5F9", border: "#E2E8F0", label: "Discontinued" },
  Archived:       { color: "#475569", bg: "#F8FAFC", border: "#E2E8F0", label: "Archived" },
};

interface Item {
  id: string;
  partNumber: string;
  description: string;
  status: string;
  images: string[];
  primaryCategory: string;
  additionalCategories: string[];
  acquisitionMethod: string;
  manufacturer: string;
  [key: string]: any;
}

interface ItemDetailHeaderProps {
  item: Item;
  activeTab: string;
  onTabChange: (id: string) => void;
  onBack: () => void;
  onEdit: () => void;
  isFullscreen: boolean;
  onFullscreenChange: (next: boolean) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  activeImageIndex?: number;
  /** Lifecycle action requested from header — opens the canonical confirm modal. */
  onLifecycleAction?: (action: "archive" | "unarchive" | "disable" | "enable") => void;
}

export function ItemDetailHeader({
  item,
  activeTab,
  onTabChange,
  onBack,
  onEdit,
  isFullscreen,
  onFullscreenChange,
  scrollContainerRef,
  activeImageIndex = 0,
  onLifecycleAction,
}: ItemDetailHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descNeedsTruncation, setDescNeedsTruncation] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // IntersectionObserver — flips compact mode once sentinel scrolls out of view
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollContainerRef]);

  // Detect description truncation
  useEffect(() => {
    const check = () => {
      const el = descRef.current;
      if (!el) return;
      setDescNeedsTruncation(el.scrollHeight > 22);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [item.description]);

  const stockKey = (item.stockStatus as string | undefined) ?? item.status;
  const status = statusConfig[stockKey] ?? statusConfig["In Stock"];
  // Lifecycle status — Active / Inactive / Archived (separate from stock state).
  const lifecycleRaw = (item.status as string) || "Active";
  const lifecycle = ["Active", "Inactive", "Archived"].includes(lifecycleRaw) ? lifecycleRaw : "Active";
  const lifecycleTone =
    lifecycle === "Active"
      ? { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0" }
      : lifecycle === "Inactive"
        ? { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A" }
        : { bg: "#FEF2F2", fg: "#991B1B", border: "#FECACA" };
  const activeImage = item.images?.[activeImageIndex] ?? item.images?.[0];
  // Acquisition is normalised on primaryAcquisition / acquisitionMethods — the legacy
  // `acquisitionMethod` field can be an object, so derive from the normalised value.
  const primaryAcq = item.primaryAcquisition ?? item.acquisitionMethods?.[0] ?? null;
  const isPurchased = primaryAcq === "Purchase";
  const acquisitionLabel = isPurchased ? "Purchased" : "Manufactured";
  const additional = item.additionalCategories ?? [];
  const itemQuickView = useItemQuickView();

  return (
    <TooltipProvider delayDuration={150}>
      {/* Sentinel — sits above sticky wrapper */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* Sticky morphing card wrapper */}
      <div className="shrink-0 sticky top-0 z-20 bg-slate-50">
        <div
          style={{
            paddingTop: isScrolled ? "8px" : "12px",
            paddingBottom: "4px",
            transition: "padding-top 250ms ease",
          }}
        >
          <div
            className={`mx-auto px-4 lg:px-6 xl:px-8 transition-all duration-300 ${
              isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"
            }`}
          >
            <div
              className={`border rounded-xl overflow-hidden transition-shadow duration-250 ${
                isScrolled
                  ? "shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.05)]"
                  : "shadow-sm"
              } ${
                lifecycle === "Archived"
                  ? "border-rose-200"
                  : lifecycle === "Inactive"
                    ? "border-amber-200"
                    : "bg-white border-border"
              }`}
              // Inactive / Archived headers use the same vertical wash gradient as the
              // lifecycle confirmation modal (amber for inactive, red for archived).
              style={
                lifecycle === "Archived"
                  ? { background: "linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)" }
                  : lifecycle === "Inactive"
                    ? { background: "linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)" }
                    : undefined
              }
            >
              {/* Top row */}
              <div
                className="flex items-center justify-between gap-4 px-4 lg:px-5 transition-all duration-250 ease-in-out"
                style={{ padding: isScrolled ? "6px 16px" : "12px 16px" }}
              >
                {/* Left: Back + Thumbnail + Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Back button */}
                  <button
                    onClick={onBack}
                    className="rounded-xl border border-border bg-white hover:bg-slate-50 flex items-center justify-center shrink-0 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] transition-all duration-250"
                    style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                    aria-label="Back to Items"
                  >
                    <ChevronLeft
                      className="text-slate-400 transition-all duration-250"
                      style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }}
                    />
                  </button>

                  {/* Active image thumbnail */}
                  {activeImage ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); itemQuickView.open(item as any); }}
                      className="rounded-xl shrink-0 border border-border bg-white overflow-hidden hover:border-slate-300 transition-all duration-250 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)]"
                      style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                      aria-label={`Quick view ${item.partNumber}`}
                    >
                      <img
                        src={activeImage}
                        alt={item.description || item.partNumber}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div
                      className="rounded-xl flex items-center justify-center shrink-0 border border-border bg-slate-100 text-slate-400 transition-all duration-250"
                      style={{ width: isScrolled ? 32 : 44, height: isScrolled ? 32 : 44 }}
                    >
                      <ImageIcon style={{ width: isScrolled ? 14 : 18, height: isScrolled ? 14 : 18 }} />
                    </div>
                  )}

                  {/* Name + Badges + Description */}
                  <div className="min-w-0 flex-1">
                    {/* Line 1: Name + badges */}
                    <div
                      className="flex items-center flex-wrap gap-1.5 transition-all duration-250"
                      style={{ gap: isScrolled ? 6 : 8 }}
                    >
                      <h1
                        className="text-foreground truncate transition-all duration-250"
                        style={{
                          fontSize: isScrolled ? 13 : 16,
                          fontWeight: isScrolled ? 600 : 700,
                          lineHeight: isScrolled ? "18px" : "22px",
                        }}
                      >
                        {item.partNumber}
                      </h1>

                      {/* Lifecycle status pill — clickable Popover for every state.
                          Mirrors Partners' VendorDetailsPage StatusPill: dropdown
                          shows Active / Inactive. Selecting Active while archived
                          triggers Restore (unarchive). Archive lives in the
                          Actions menu. */}
                      <Popover open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
                          <PopoverTrigger asChild>
                            <button
                              className={`inline-flex items-center rounded-full border cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-border ${isScrolled ? "px-1.5 py-px text-[10px] gap-0.5" : "px-2 py-0.5 text-[11px] gap-1"}`}
                              style={{ fontWeight: 500, backgroundColor: lifecycleTone.bg, color: lifecycleTone.fg, borderColor: lifecycleTone.border }}
                            >
                              {lifecycle}
                              <ChevronDown className={isScrolled ? "w-2.5 h-2.5" : "w-3 h-3"} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="bottom" align="start" sideOffset={6} className="w-[170px] p-1.5 z-[300] bg-popover" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <div className="space-y-1">
                              {(["Active", "Inactive"] as const).map((s) => {
                                const sc = s === "Active"
                                  ? { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0" }
                                  : { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A" };
                                const isCurrent = s === lifecycle;
                                return (
                                  <button
                                    key={s}
                                    onClick={() => {
                                      if (!isCurrent) {
                                        if (s === "Active") {
                                          // From Archived → Restore; from Inactive → Enable.
                                          onLifecycleAction?.(lifecycle === "Archived" ? "unarchive" : "enable");
                                        } else {
                                          onLifecycleAction?.("disable");
                                        }
                                        setStatusDropdownOpen(false);
                                      }
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${isCurrent ? "bg-slate-50" : "hover:bg-slate-50"}`}
                                  >
                                    <span
                                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]"
                                      style={{ fontWeight: 500, backgroundColor: sc.bg, color: sc.fg, borderColor: sc.border }}
                                    >
                                      {s}
                                    </span>
                                    {isCurrent && <span className="ml-auto text-primary text-[12px]">✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>

                      {/* Acquisition pill — icon + hover tooltip */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-slate-50 text-slate-700 transition-all duration-250 cursor-default"
                            style={{
                              padding: isScrolled ? "1px 6px" : "2px 8px",
                              fontSize: isScrolled ? 10 : 11,
                              fontWeight: 600,
                            }}
                          >
                            {isPurchased ? (
                              <ShoppingCart style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                            ) : (
                              <Factory style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                            )}
                            {acquisitionLabel}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" sideOffset={6} className="z-[300] max-w-[260px]">
                          <p className="text-[10px] text-slate-400 mb-1" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            Acquisition Method
                          </p>
                          <p className="text-[11px] text-slate-700" style={{ fontWeight: 500, lineHeight: 1.5 }}>
                            {isPurchased
                              ? "Sourced externally from vendors via purchase orders."
                              : "Produced in-house via manufacturing."}
                          </p>
                        </TooltipContent>
                      </Tooltip>

                      {/* Primary category — partner-style: one pill, dot separator, inline +N count; hover reveals the full list */}
                      {item.primaryCategory && (additional.length === 0 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 text-violet-700 transition-all duration-250"
                          style={{
                            padding: isScrolled ? "1px 6px" : "2px 8px",
                            fontSize: isScrolled ? 10 : 11,
                            fontWeight: 600,
                          }}
                        >
                          <Shapes style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                          {toCategoryCode(item.primaryCategory)}
                        </span>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 text-violet-700 transition-all duration-250 cursor-default"
                              style={{
                                padding: isScrolled ? "1px 6px" : "2px 8px",
                                fontSize: isScrolled ? 10 : 11,
                                fontWeight: 600,
                              }}
                            >
                              <Shapes style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                              {toCategoryCode(item.primaryCategory)}
                              <span className="text-violet-300" style={{ fontWeight: 400 }} aria-hidden="true">·</span>
                              <span style={{ fontWeight: 600 }}>+{additional.length}</span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" sideOffset={6} className="z-[300] max-w-[260px]">
                            <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              Categories
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 py-0.5">
                                <span className="text-[11px] text-slate-700" style={{ fontWeight: 600 }}>{toCategoryCode(item.primaryCategory)}</span>
                                <span className="text-[9px] text-violet-500 uppercase tracking-wide" style={{ fontWeight: 600 }}>Primary</span>
                              </div>
                              {additional.map((cat, i) => (
                                <div key={i} className="flex items-center gap-2 py-0.5">
                                  <span className="text-[11px] text-slate-700" style={{ fontWeight: 600 }}>{toCategoryCode(cat)}</span>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}

                      {/* Tags — partner-style: one pill, dot separator, inline +N count; hover reveals the full list */}
                      {Array.isArray(item.tags) && item.tags.length > 0 && (item.tags.length === 1 ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 text-amber-800 transition-all duration-250"
                          style={{
                            padding: isScrolled ? "1px 6px" : "2px 8px",
                            fontSize: isScrolled ? 10 : 11,
                            fontWeight: 600,
                          }}
                        >
                          <TagIcon style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                          {item.tags[0]}
                        </span>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 text-amber-800 transition-all duration-250 cursor-default"
                              style={{
                                padding: isScrolled ? "1px 6px" : "2px 8px",
                                fontSize: isScrolled ? 10 : 11,
                                fontWeight: 600,
                              }}
                            >
                              <TagIcon style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                              {item.tags[0]}
                              <span className="text-amber-300" style={{ fontWeight: 400 }} aria-hidden="true">·</span>
                              <span style={{ fontWeight: 600 }}>+{item.tags.length - 1}</span>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" sideOffset={6} className="z-[300] max-w-[260px]">
                            <p className="text-[10px] text-slate-400 mb-1.5" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              Tags
                            </p>
                            <div className="space-y-1">
                              {item.tags.map((tag: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 py-0.5">
                                  <TagIcon className="w-3 h-3 text-amber-800 shrink-0" />
                                  <span className="text-[11px] text-slate-700" style={{ fontWeight: 500 }}>{tag}</span>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>

                    {/* Description — hidden when compact */}
                    <div
                      className="overflow-hidden transition-all duration-250 ease-in-out max-w-3xl relative"
                      style={{
                        maxHeight: isScrolled ? 0 : descExpanded ? 500 : 20,
                        opacity: isScrolled ? 0 : 1,
                        marginTop: isScrolled ? 0 : 6,
                      }}
                    >
                      <div className="overflow-hidden" style={{ maxHeight: descExpanded ? 500 : 20 }}>
                        <p ref={descRef} className="text-[12px] text-slate-500 leading-[1.6]">
                          {item.description}
                          {descExpanded && descNeedsTruncation && (
                            <>
                              {" "}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDescExpanded(false);
                                }}
                                className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer align-baseline"
                                style={{ fontWeight: 500 }}
                              >
                                Show less <ChevronUp className="w-3 h-3 inline" />
                              </button>
                            </>
                          )}
                        </p>
                      </div>
                      {!descExpanded && descNeedsTruncation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDescExpanded(true);
                          }}
                          className="absolute right-0 bottom-0 bg-gradient-to-l from-white via-white to-transparent pl-6 pr-0 inline-flex items-center gap-0.5 text-[11px] text-primary hover:text-[#0862D0] cursor-pointer"
                          style={{ fontWeight: 500, lineHeight: "20px" }}
                        >
                          ... more <ChevronDown className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Fullscreen + Actions + Edit CTA */}
                <div
                  className="flex items-center shrink-0 transition-all duration-250"
                  style={{ gap: isScrolled ? 6 : 8 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onFullscreenChange(!isFullscreen)}
                        className="rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-250"
                        style={{ width: isScrolled ? 32 : 36, height: isScrolled ? 32 : 36 }}
                        aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                      >
                        {isFullscreen ? (
                          <Minimize2
                            className="text-slate-500 transition-all duration-250"
                            style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }}
                          />
                        ) : (
                          <Maximize2
                            className="text-slate-500 transition-all duration-250"
                            style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }}
                          />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[300]">
                      {isFullscreen ? "Exit Full Screen" : "Full Screen"}
                    </TooltipContent>
                  </Tooltip>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${
                          isScrolled ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]"
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        Actions
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="z-[200] w-48">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      {lifecycle === "Archived" ? (
                        <DropdownMenuItem
                          onClick={() => onLifecycleAction?.("unarchive")}
                          className="focus:bg-emerald-50"
                          style={{ color: "#059669" }}
                        >
                          <ArchiveRestore className="w-4 h-4 mr-2" style={{ color: "#10B981" }} /> Restore
                        </DropdownMenuItem>
                      ) : (
                        <>
                          {lifecycle === "Active" ? (
                            <DropdownMenuItem
                              onClick={() => onLifecycleAction?.("disable")}
                              className="focus:bg-amber-50"
                              style={{ color: "#B45309" }}
                            >
                              <CircleSlash className="w-4 h-4 mr-2" style={{ color: "#F59E0B" }} /> Mark as Inactive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => onLifecycleAction?.("enable")}
                              className="focus:bg-emerald-50"
                              style={{ color: "#059669" }}
                            >
                              <CircleCheck className="w-4 h-4 mr-2" style={{ color: "#10B981" }} /> Mark as Active
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => onLifecycleAction?.("archive")}
                            className="focus:bg-red-50"
                            style={{ color: "#B91C1C" }}
                          >
                            <Archive className="w-4 h-4 mr-2" style={{ color: "#EF4444" }} /> Archive
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    onClick={onEdit}
                    className={`rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${
                      isScrolled ? "h-8 px-3.5 text-[12px]" : "h-9 px-4 text-[13px]"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    <Edit className={isScrolled ? "w-3 h-3" : "w-3.5 h-3.5"} />
                    Edit
                  </button>
                </div>
              </div>

              {/* Inner tab bar */}
              <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-muted px-4 lg:px-5">
                {ITEM_DETAIL_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`flex items-center gap-1.5 border-b-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                      }`}
                      style={{
                        padding: isScrolled ? "8px 14px" : "10px 14px",
                        fontSize: isScrolled ? 12 : 13,
                        fontWeight: isActive ? 600 : 400,
                        transition: "padding 250ms ease, font-size 250ms ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div
          className="pointer-events-none transition-opacity duration-300"
          style={{
            height: 8,
            background:
              "linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)",
            opacity: isScrolled ? 1 : 0,
          }}
        />
      </div>

      {/* Scroll to top FAB */}
      <button
        onClick={() => {
          const el = scrollContainerRef.current;
          if (el) el.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white border border-border shadow-[0_2px_12px_-3px_rgba(0,0,0,0.12),0_4px_16px_-4px_rgba(0,0,0,0.08)] flex items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] active:scale-95 transition-all duration-300"
        style={{
          width: 40,
          height: 40,
          opacity: isScrolled ? 1 : 0,
          transform: isScrolled ? "translateY(0) scale(1)" : "translateY(16px) scale(0.9)",
          pointerEvents: isScrolled ? "auto" : "none",
        }}
        aria-label="Scroll to top"
      >
        <ChevronUp className="w-5 h-5 text-slate-500" />
      </button>
      {/* Item Quick View modal — opens when the header thumbnail is clicked */}
      {itemQuickView.modal}
    </TooltipProvider>
  );
}