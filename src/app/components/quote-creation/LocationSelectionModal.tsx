import { useCallback, useEffect, useMemo, useRef, useState, cloneElement } from "react";
import type { ReactElement } from "react";
import { createPortal } from "react-dom";
import {
  X, Search, MapPin, Building2, Phone, Check, Star, Users, Package, Clock,
  LayoutGrid, List as ListIcon, AlignJustify, ChevronDown,
  GripVertical, ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal,
  Eye, Pencil, Archive, Wrench, Mail, Plus,
} from "lucide-react";
import { CreateLocationModal, type CreatedLocationPayload } from "@/app/components/external/partners/CreateLocationModal";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard, HoverCardTrigger, HoverCardContent,
} from "@/components/ui/hover-card";
import {
  ColumnHeaderMenu, type SortConfig,
} from "@/app/components/shared/contactDirectory/ColumnHeaderMenu";
import { OverflowTooltip } from "@/app/components/shared/contactDirectory/OverflowTooltip";
import { HighlightText } from "@/app/components/HighlightText";

/* ════════════════════════════════════════════════════════════════════
   Location selection modal — Partner v7 PartnerLocationsTab port.

   Card / Comfort / Condensed densities, the same density dropdown
   chrome, and the full table port from VendorDetailsPage.tsx
   :: PartnerLocationsTab (Partner v7). The only deviations from the
   reference:

     • The sticky-left selection column carries a radio (single
       selection) instead of a checkbox. Top-left header is empty
       because "select all" doesn't apply to a single-pick picker.
     • Clicking a row sets the selection; "Open detail" lives on the
       Actions dropdown (View Details).

   Column drag/resize handlers, HoverCards, OverflowTooltips, scope
   pills, status pills, sticky right Actions column — all retained
   verbatim so the two surfaces feel identical.
   ════════════════════════════════════════════════════════════════════ */

interface PocPerson {
  name: string;
  initials: string;
  bgColor: string;
  fgColor?: string;
  photo?: string;
}

interface Location {
  id: string;
  name: string;
  address: string;
  isDefault: boolean;
  pocCount?: number;
  primaryContact?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: "active" | "inactive";
  contacts?: number;
  items?: number;
  image?: string;
  createdBy?: PocPerson;
  lastUpdated?: string;
  type?: "Customer" | "Vendor" | "Both";
  partner?: string;
  phone?: string;
  /** Partner v7 multi-POC support. When absent, the table derives a
   *  single-entry array from `primaryContact`. */
  pocNames?: PocPerson[];
  /** Partner v7 service centers chip column. When absent the column
   *  shows an em-dash. */
  serviceCenterNames?: string[];
}

interface LocationSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: Location) => void;
  currentLocationId: string;
  customerName: string;
  locations?: Location[];
}

export type { Location };

const LOCATION_IMAGES = [
  "https://images.unsplash.com/photo-1553413077-190dd305871c?w=600&h=320&fit=crop",
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=320&fit=crop",
  "https://images.unsplash.com/photo-1601598851547-4302969d0614?w=600&h=320&fit=crop",
  "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=600&h=320&fit=crop",
  "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=600&h=320&fit=crop",
];

function mockPoc(name: string, bg = "#DBEAFE", fg = "#1E40AF"): PocPerson {
  return {
    name,
    initials: name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase(),
    bgColor: bg,
    fgColor: fg,
  };
}

const MOCK_LOCATIONS: Location[] = [
  { id: "loc1", name: "Huntsville, AL (Headquarters)",       address: "1000 Business Park Dr", city: "Huntsville",  state: "Alabama",        country: "United States", isDefault: true,  status: "active",   contacts: 21, items: 211, pocCount: 4, primaryContact: "Jane Ellison",    type: "Customer", phone: "+1 (256) 555-1010", image: LOCATION_IMAGES[0], lastUpdated: "Mar 06, 2026", createdBy: mockPoc("Lisa Anderson", "#DCFCE7", "#166534"), serviceCenterNames: ["Returns Processing", "Parts Storage"] },
  { id: "loc2", name: "Charlotte, NC (Station 12)",           address: "1000 Business Park Dr", city: "Charlotte",   state: "North Carolina", country: "United States", isDefault: false, status: "active",   contacts: 13, items: 250, pocCount: 2, primaryContact: "Robert Johnson",  type: "Customer", phone: "+1 (704) 555-2020", image: LOCATION_IMAGES[1], lastUpdated: "Dec 21, 2025", createdBy: mockPoc("Maria Garcia",  "#E0E7FF", "#3730A3"), serviceCenterNames: ["Testing Facility"] },
  { id: "loc3", name: "Daxton, GA (Regional Office)",         address: "1000 Business Park Dr", city: "Daxton",      state: "Georgia",        country: "United States", isDefault: false, status: "active",   contacts: 18, items: 261, pocCount: 3, primaryContact: "Braelyn Miller",  type: "Vendor",   phone: "+1 (404) 555-3030", image: LOCATION_IMAGES[2], lastUpdated: "Dec 14, 2025", createdBy: mockPoc("Maria Garcia",  "#E0E7FF", "#3730A3"), serviceCenterNames: ["Distribution Hub", "R&D Center"] },
  { id: "loc4", name: "Georgetown, KY (Distribution Center)", address: "1000 Business Park Dr", city: "Georgetown",  state: "Kentucky",       country: "United States", isDefault: false, status: "active",   contacts: 24, items: 216, pocCount: 1, primaryContact: "Mary Miller",     type: "Customer", phone: "+1 (502) 555-4040", image: LOCATION_IMAGES[3], lastUpdated: "Apr 22, 2025", createdBy: mockPoc("Maria Garcia",  "#E0E7FF", "#3730A3"), serviceCenterNames: ["Parts Storage"] },
  { id: "loc5", name: "San Antonio, TX (Fleet Yard)",         address: "1000 Business Park Dr", city: "San Antonio", state: "Texas",          country: "United States", isDefault: false, status: "active",   contacts: 16, items: 255, pocCount: 5, primaryContact: "Marcus Webb",     type: "Both",     phone: "+1 (210) 555-5050", image: LOCATION_IMAGES[4], lastUpdated: "Feb 06, 2026", createdBy: mockPoc("Lisa Anderson", "#DCFCE7", "#166534"), serviceCenterNames: ["Inspection Station", "Returns Processing", "Distribution Hub"] },
  { id: "loc6", name: "Santa Ana, IN (Maintenance Facility)", address: "1000 Business Park Dr", city: "Santa Ana",   state: "Indiana",        country: "United States", isDefault: false, status: "inactive", contacts: 4,  items: 284, pocCount: 2, primaryContact: "Sandra Lee",      type: "Vendor",   phone: "+1 (765) 555-6060", lastUpdated: "Jan 06, 2026", createdBy: mockPoc("Ahtisham Ahmad", "#FEF3C7", "#92400E"), serviceCenterNames: ["Assembly Floor"] },
  { id: "loc7", name: "Denver, CO (Training Center)",         address: "1000 Business Park Dr", city: "Denver",      state: "Colorado",       country: "United States", isDefault: false, status: "active",   contacts: 18, items: 316, pocCount: 1, primaryContact: "Lisa Chen",       type: "Customer", phone: "+1 (303) 555-7070", lastUpdated: "Nov 09, 2025", createdBy: mockPoc("Maria Garcia",  "#E0E7FF", "#3730A3"), serviceCenterNames: [] },
];

type StatusFilter = "all" | "active" | "inactive";
type Density = "condensed" | "comfort" | "card";
type CardSize = "large" | "medium" | "small";

const DENSITY_CONFIG: { key: Density; label: string; description: string; icon: "align-justify" | "list" | "layout-grid" }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view",   icon: "align-justify" },
  { key: "comfort",   label: "Comfort",   description: "Spacious view",  icon: "list" },
  { key: "card",      label: "Card View", description: "Grid layout",    icon: "layout-grid" },
];

/* Column definitions — copied 1:1 from
   VendorDetailsPage.tsx :: PartnerLocationsTab.LOC_COLUMNS so the
   header set + min widths match the partner reference exactly. */
const LOC_COLUMNS: { key: string; label: string; minWidth: string; sortable?: boolean }[] = [
  { key: "location_name", label: "Location Name", minWidth: "320px", sortable: true },
  { key: "type",          label: "Type",           minWidth: "200px", sortable: true },
  { key: "address",       label: "Address",        minWidth: "300px" },
  { key: "city_state",    label: "City / State",   minWidth: "200px", sortable: true },
  { key: "poc",           label: "Point of Contact", minWidth: "280px" },
  { key: "service_centers", label: "Service Centers", minWidth: "260px" },
  { key: "created_by",    label: "Created By",     minWidth: "240px" },
  { key: "last_updated",  label: "Last Updated",   minWidth: "180px", sortable: true },
  { key: "status",        label: "Status",         minWidth: "130px", sortable: true },
];
const LOC_LOCKED_COLUMNS = ["location_name"];
const LOC_CHECKBOX_W = 40;

export function LocationSelectionModal({
  isOpen, onClose, onSelect, currentLocationId, customerName, locations,
}: LocationSelectionModalProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(currentLocationId);
  const [search, setSearch] = useState("");
  /* Slim "Create Location" modal (external/partners). Opens from the
     "New Location" button next to the search bar. New locations are
     held in `extraLocations` so they merge with the seeded list and
     can be picked immediately. */
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [extraLocations, setExtraLocations] = useState<Location[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [density, setDensity] = useState<Density>("card");
  const [cardSize, setCardSize] = useState<CardSize>("medium");

  // ── Column infrastructure (port of PartnerLocationsTab state) ──
  const [locColumnOrder, setLocColumnOrder] = useState<string[]>(LOC_COLUMNS.map((c) => c.key));
  const [locColumnWidths, setLocColumnWidths] = useState<Record<string, number>>(
    () => Object.fromEntries(LOC_COLUMNS.map((c) => [c.key, parseInt(c.minWidth, 10)])),
  );
  const [locSortConfig, setLocSortConfig] = useState<SortConfig | null>(null);
  const [locDraggingColumnKey, setLocDraggingColumnKey] = useState<string | null>(null);
  const [locIsResizing, setLocIsResizing] = useState(false);
  const [locResizingColumnKey, setLocResizingColumnKey] = useState<string | null>(null);

  const locColDragRef = useRef<{ columnKey: string; startX: number; startY: number; isDragging: boolean; lastSwapTime: number } | null>(null);
  const locSuppressClickRef = useRef(false);
  const locResizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);

  const locColDef = (key: string) => LOC_COLUMNS.find((c) => c.key === key)!;
  const locVisibleColumns = useMemo(() => {
    const ordered = locColumnOrder.filter((k) => LOC_COLUMNS.some((c) => c.key === k));
    if (!ordered.includes("location_name")) ordered.unshift("location_name");
    else if (ordered[0] !== "location_name") {
      ordered.splice(ordered.indexOf("location_name"), 1); ordered.unshift("location_name");
    }
    return ordered;
  }, [locColumnOrder]);
  const locTotalWidth = useMemo(
    () => LOC_CHECKBOX_W + locVisibleColumns.reduce((s, k) => s + (locColumnWidths[k] ?? parseInt(locColDef(k).minWidth, 10)), 0) + 60,
    [locVisibleColumns, locColumnWidths],
  );

  const handleLocSort = useCallback((key: string, direction?: "asc" | "desc" | null) => {
    if (direction !== undefined) {
      setLocSortConfig(direction === null ? null : { key, direction });
    } else {
      setLocSortConfig((prev) => {
        if (prev?.key === key) return prev.direction === "asc" ? { key, direction: "desc" } : null;
        return { key, direction: "asc" };
      });
    }
  }, []);

  // Column drag reorder — copied from PartnerLocationsTab
  const handleLocHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOC_LOCKED_COLUMNS.includes(columnKey) || locIsResizing || e.button !== 0) return;
    const startX = e.clientX; const startY = e.clientY;
    locColDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };
    const THRESHOLD = 5; const SETTLE = 60;
    const onMove = (me: MouseEvent) => {
      if (!locColDragRef.current) return;
      const dx = me.clientX - locColDragRef.current.startX;
      const dy = me.clientY - locColDragRef.current.startY;
      if (!locColDragRef.current.isDragging) {
        if (Math.sqrt(dx * dx + dy * dy) < THRESHOLD) return;
        locColDragRef.current.isDragging = true;
        document.body.style.userSelect = "none"; document.body.style.cursor = "grabbing";
        setLocDraggingColumnKey(locColDragRef.current.columnKey);
      }
      const now = performance.now();
      if (now - locColDragRef.current.lastSwapTime < SETTLE) return;
      const cursorX = me.clientX; const draggedKey = locColDragRef.current.columnKey;
      const draggedTh = document.querySelector<HTMLElement>(`th[data-loc-col-key="${draggedKey}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();
      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;
      const allThs = document.querySelectorAll<HTMLElement>("th[data-loc-col-key]");
      for (const th of allThs) {
        const rect = th.getBoundingClientRect();
        if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute("data-loc-col-key");
        if (!k || k === draggedKey || LOC_LOCKED_COLUMNS.includes(k)) break;
        setLocColumnOrder((prev) => { const next = [...prev]; const s = next.indexOf(draggedKey); const t = next.indexOf(k); if (s === -1 || t === -1 || s === t) return prev; next.splice(s, 1); next.splice(t, 0, draggedKey); return next; });
        locColDragRef.current.lastSwapTime = now; break;
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = ""; document.body.style.cursor = "";
      if (locColDragRef.current?.isDragging) { locSuppressClickRef.current = true; requestAnimationFrame(() => { locSuppressClickRef.current = false; }); }
      locColDragRef.current = null; setLocDraggingColumnKey(null);
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  }, [locIsResizing]);

  // Column resize — copied from PartnerLocationsTab
  const handleLocResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault(); e.stopPropagation();
    const startWidth = locColumnWidths[columnKey] ?? parseInt(locColDef(columnKey).minWidth, 10);
    locResizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setLocIsResizing(true); setLocResizingColumnKey(columnKey);
    const onMove = (me: MouseEvent) => {
      if (!locResizeRef.current) return;
      const delta = me.clientX - locResizeRef.current.startX;
      const newW = Math.max(1, locResizeRef.current.startWidth + delta);
      setLocColumnWidths((prev) => ({ ...prev, [locResizeRef.current!.columnKey]: newW }));
    };
    const onUp = () => {
      locResizeRef.current = null; setLocIsResizing(false); setLocResizingColumnKey(null);
      document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = ""; document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
  }, [locColumnWidths]);

  /* Merge any user-created locations (`extraLocations`) ahead of the
     seeded list so the freshest entries surface at the top. */
  const allLocations = [...extraLocations, ...(locations || MOCK_LOCATIONS)];

  const handleLocationCreated = useCallback((payload: CreatedLocationPayload) => {
    const newId = `l_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newLocation: Location = {
      id: newId,
      name: payload.name,
      address: payload.address.full,
      isDefault: false,
      city: payload.address.cityState,
      state: payload.address.state,
      status: 'active',
      phone: payload.phone || undefined,
      pocCount: 0,
      contacts: 0,
      items: 0,
    };
    setExtraLocations((prev) => [newLocation, ...prev]);
    setSelectedLocationId(newId);
    /* Auto-confirm the newly created location so the parent flow can
       proceed without the user having to click it a second time. */
    setTimeout(() => onSelect(newLocation), 0);
  }, [onSelect]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedLocationId(currentLocationId);
    setSearch("");
    setStatusFilter("all");
    setDensity("card");
    setCardSize("medium");
    setLocSortConfig(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, currentLocationId, onClose]);

  const filtered = useMemo(() => {
    let list = allLocations.filter((loc) => {
      if (statusFilter === "active" && loc.status === "inactive") return false;
      if (statusFilter === "inactive" && loc.status !== "inactive") return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !loc.name.toLowerCase().includes(q) &&
          !loc.address.toLowerCase().includes(q) &&
          !(loc.city ?? "").toLowerCase().includes(q) &&
          !(loc.state ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });

    if (locSortConfig) {
      const dir = locSortConfig.direction === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const aVal = sortValue(a, locSortConfig.key);
        const bVal = sortValue(b, locSortConfig.key);
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    }
    return list;
  }, [allLocations, search, statusFilter, locSortConfig]);

  const counts = useMemo(() => ({
    all: allLocations.length,
    active: allLocations.filter((l) => l.status !== "inactive").length,
    inactive: allLocations.filter((l) => l.status === "inactive").length,
  }), [allLocations]);

  const handleConfirm = () => {
    const location = allLocations.find((loc) => loc.id === selectedLocationId);
    if (!location) return;
    onSelect(location);
    onClose();
  };

  if (!isOpen) return null;

  const currentDensity = DENSITY_CONFIG.find((d) => d.key === density)!;

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 12100, backgroundColor: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          zIndex: 12101,
          width: "min(96vw, 1280px)",
          height: "min(92vh, 860px)",
          background: "var(--card)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Partner v7 modal pattern (PartnerGroupDetailModal
            .tsx:2460). 40-px rounded primary/10 icon tile + 16/17-px
            semibold title + 12-px slate-500 subtitle; close button is
            a 32-px ghost icon-only with `text-slate-400 hover:bg-muted`. */}
        <div className="px-5 pt-4 pb-3.5 shrink-0 bg-white border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(10, 119, 255, 0.10)", color: "#0A77FF" }}>
                <MapPin className="w-[18px] h-[18px]" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-[16px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                  Change Location
                </h2>
                <p className="text-[12px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>
                  Pick a location for{" "}
                  <span className="text-foreground" style={{ fontWeight: 600 }}>{customerName}</span>.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scope row removed — the customer / scope is already communicated
            in the modal subtitle so this strip was duplicate UI. */}

        {/* Search + count + density dropdown */}
        <div className="flex items-center shrink-0" style={{ padding: "12px 24px", borderBottom: "1px solid #EEF2F6", gap: 12 }}>
          <div className="relative" style={{ flex: 1, minWidth: 0, maxWidth: 360 }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "#94A3B8" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by location name, city, or address..."
              autoFocus
              style={{
                width: "100%", height: 34, paddingLeft: 32, paddingRight: 12,
                borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)",
                fontSize: 13, color: "var(--foreground)", outline: "none",
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)", marginLeft: "auto" }}>
            <strong style={{ color: "var(--foreground)", fontWeight: 600 }}>{filtered.length}</strong> locations
          </span>

          {/* Create-new affordance — opens the slim
              external/partners/CreateLocationModal so users can add a
              location without leaving the creation flow. The new
              location is pushed onto `extraLocations` so it surfaces
              in the search results immediately. */}
          <button
            type="button"
            onClick={() => setShowCreateLocation(true)}
            className="inline-flex items-center justify-center h-9 gap-1.5 px-3 rounded-lg bg-primary text-white hover:bg-[#0862D0] transition-colors cursor-pointer"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Location
          </button>

          {/* Density dropdown — Partner v7 pattern */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none"
                style={{ borderColor: "var(--border)" }}
              >
                {density === "condensed" && <AlignJustify className="w-[18px] h-[18px]" style={{ color: "#94A3B8" }} />}
                {density === "comfort"   && <ListIcon     className="w-[18px] h-[18px]" style={{ color: "#94A3B8" }} />}
                {density === "card"      && <LayoutGrid   className="w-[18px] h-[18px]" style={{ color: "#94A3B8" }} />}
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>
                  {currentDensity.label}
                </span>
                <ChevronDown className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[230px] p-1.5" style={{ zIndex: 12200 }}>
              {DENSITY_CONFIG.map((opt) => (
                <DropdownMenuItem
                  key={opt.key}
                  className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md"
                  onSelect={(e) => {
                    if (opt.key === "card") e.preventDefault();
                    setDensity(opt.key);
                  }}
                >
                  {opt.icon === "align-justify" && <AlignJustify className="w-5 h-5 shrink-0" style={{ color: "#94A3B8" }} />}
                  {opt.icon === "list"          && <ListIcon     className="w-5 h-5 shrink-0" style={{ color: "#94A3B8" }} />}
                  {opt.icon === "layout-grid"   && <LayoutGrid   className="w-5 h-5 shrink-0" style={{ color: "#94A3B8" }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>{opt.description}</p>
                  </div>
                  {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: "#0A77FF" }} />}
                </DropdownMenuItem>
              ))}
              {density === "card" && (
                <>
                  <div className="mx-2 my-1.5 border-t" style={{ borderColor: "#F1F5F9" }} />
                  <div className="px-3 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "#94A3B8", fontWeight: 600 }}>Card Size</p>
                    <div className="flex items-center gap-1.5">
                      {(["large", "medium", "small"] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => setCardSize(size)}
                          className="flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer"
                          style={{
                            backgroundColor: cardSize === size ? "#0A77FF" : "#F1F5F9",
                            color: cardSize === size ? "#FFFFFF" : "#64748B",
                            fontWeight: cardSize === size ? 600 : 500,
                            boxShadow: cardSize === size ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                            border: "none",
                          }}
                        >
                          {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status pills */}
        <div className="flex items-center overflow-x-auto shrink-0" style={{ padding: "10px 24px", borderBottom: "1px solid #EEF2F6", gap: 8 }}>
          <FilterPill label="All status"  count={counts.all}      active={statusFilter === "all"}      onClick={() => setStatusFilter("all")} />
          <FilterPill label="Active"      count={counts.active}   active={statusFilter === "active"}   onClick={() => setStatusFilter("active")} />
          <FilterPill label="Inactive"    count={counts.inactive} active={statusFilter === "inactive"} onClick={() => setStatusFilter("inactive")} />
        </div>

        {/* Body */}
        {density === "card" ? (
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 20, background: "#F8FAFC" }}>
            {filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <div
                className="grid"
                style={{
                  gap: 16,
                  gridTemplateColumns:
                    cardSize === "large"  ? "repeat(auto-fill, minmax(420px, 1fr))" :
                    cardSize === "small"  ? "repeat(auto-fill, minmax(220px, 1fr))" :
                                            "repeat(auto-fill, minmax(300px, 1fr))",
                }}
              >
                {filtered.map((location) => (
                  <LocationCard
                    key={location.id}
                    location={location}
                    customerName={customerName}
                    isSelected={selectedLocationId === location.id}
                    onClick={() => setSelectedLocationId(location.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Table View — port of PartnerLocationsTab condensed/comfort */
          <div className={`min-h-0 overflow-auto flex-1 ${locIsResizing || locDraggingColumnKey ? "select-none" : ""}`}>
            <Table style={{ tableLayout: "fixed", width: `max(${locTotalWidth}px, 100%)` }}>
              <TableHeader className="sticky top-0 z-20 bg-card">
                <TableRow className={`bg-muted/30 hover:bg-muted/30 ${density === "condensed" ? "[&>th]:h-8" : "[&>th]:h-9"}`}>
                  {/* Selection column — empty in single-select mode (no
                      "select all" applies). 40-px sticky-left placeholder
                      so the radio dots in body rows line up cleanly. */}
                  <TableHead className="sticky left-0 z-20 bg-slate-50 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0">
                    <span className="sr-only">Select</span>
                  </TableHead>
                  {locVisibleColumns.map((key) => {
                    const def = locColDef(key);
                    const isLocked = LOC_LOCKED_COLUMNS.includes(key);
                    const isDraggable = !isLocked;
                    const currentSort: "asc" | "desc" | null = locSortConfig?.key === key ? locSortConfig.direction : null;
                    const w = locColumnWidths[key] ?? parseInt(def.minWidth, 10);
                    const isBeingDragged = locDraggingColumnKey === key;
                    return (
                      <TableHead
                        key={key}
                        data-loc-col-key={key}
                        onMouseDown={isDraggable ? (e) => handleLocHeaderMouseDown(e, key) : undefined}
                        onClickCapture={isDraggable ? (e) => { if (locSuppressClickRef.current) { e.stopPropagation(); e.preventDefault(); } } : undefined}
                        className={`whitespace-nowrap relative group/colheader ${isDraggable ? "cursor-grab" : ""}`}
                        style={{
                          width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden", textOverflow: "ellipsis",
                          ...(isBeingDragged ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" } : {}),
                        }}
                      >
                        {isBeingDragged && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />}
                        {isDraggable && (
                          <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />
                        )}
                        <div className="flex items-center">
                          <ColumnHeaderMenu
                            columnKey={key}
                            label={def.label}
                            sortable={def.sortable}
                            sortConfig={locSortConfig}
                            onSort={handleLocSort}
                            onAddFilter={() => {}}
                            onHideColumn={() => {}}
                            isLocked={isLocked}
                          >
                            <div className="inline-flex items-center gap-1">
                              <span className="text-[13px]" style={currentSort ? { color: "#0A77FF" } : undefined}>{def.label}</span>
                              {currentSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                              {currentSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                              {!currentSort && def.sortable && <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />}
                            </div>
                          </ColumnHeaderMenu>
                        </div>
                        <div
                          onMouseDown={(e) => { e.stopPropagation(); handleLocResizeStart(e, key); }}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => { e.stopPropagation(); setLocColumnWidths((prev) => ({ ...prev, [key]: parseInt(def.minWidth, 10) })); }}
                          className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                          style={{ touchAction: "none" }}
                        >
                          <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${locResizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                        </div>
                      </TableHead>
                    );
                  })}
                  <TableHead className="whitespace-nowrap w-[60px] sticky right-0 bg-slate-50 z-20 !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                    <span className="text-[13px]">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={locVisibleColumns.length + 2} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <MapPin className="w-8 h-8" />
                        <p className="text-sm">No locations found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((loc) => {
                    const isComfort = density === "comfort";
                    const isSelected = selectedLocationId === loc.id;
                    return (
                      <TableRow
                        key={loc.id}
                        className={`cursor-pointer group hover:bg-[#F0F7FF] ${
                          density === "condensed" ? "[&>td]:py-1 [&>td]:pl-3 [&>td]:pr-2" : "[&>td]:py-2 [&>td]:pl-3 [&>td]:pr-3"
                        } ${isSelected ? "bg-[rgba(10,119,255,0.06)]" : ""}`}
                        onClick={() => setSelectedLocationId(loc.id)}
                      >
                        {/* Selection radio — sticky left */}
                        <TableCell
                          className="sticky left-0 z-10 group-hover:bg-[#F0F7FF] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0"
                          style={{ backgroundColor: isSelected ? "rgba(10,119,255,0.06)" : "var(--card)" }}
                          onClick={(e) => { e.stopPropagation(); setSelectedLocationId(loc.id); }}
                        >
                          <RadioDot active={isSelected} />
                        </TableCell>
                        {locVisibleColumns.map((colKey) => {
                          const cell = renderLocCell(colKey, loc, isComfort, customerName, search);
                          const w = locColumnWidths[colKey] ?? parseInt(locColDef(colKey).minWidth, 10);
                          const isDraggedCol = locDraggingColumnKey === colKey;
                          const cellWidthStyle: React.CSSProperties = {
                            width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: "hidden", textOverflow: "ellipsis",
                            ...(isDraggedCol ? { backgroundColor: "rgba(10,119,255,0.035)" } : {}),
                          };
                          return cloneElement(cell as ReactElement, { style: { ...(cell as ReactElement).props.style, ...cellWidthStyle } });
                        })}
                        <TableCell
                          className="sticky right-0 group-hover:bg-[#F0F7FF] z-10 !pl-2 !pr-2"
                          style={{ backgroundColor: isSelected ? "rgba(10,119,255,0.06)" : "var(--card)", boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center h-full">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" style={{ zIndex: 12200 }}>
                                <DropdownMenuItem onClick={() => setSelectedLocationId(loc.id)}>
                                  <Check className="w-4 h-4 mr-2" /> Select this location
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { /* opens detail in Partner; selection modal stays focused on picking */ }}>
                                  <Eye className="w-4 h-4 mr-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled>
                                  <Pencil className="w-4 h-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled className="text-destructive focus:text-destructive focus:bg-red-50">
                                  <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end shrink-0"
          style={{ padding: "14px 24px", borderTop: "1px solid #EEF2F6", gap: 8, background: "var(--card)" }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 34, padding: "0 14px", borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--card)",
              color: "var(--foreground)", fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedLocationId}
            style={{
              height: 34, padding: "0 16px", borderRadius: 8, border: "none",
              background: selectedLocationId ? "var(--primary)" : "rgba(27, 110, 243, 0.45)",
              color: "#FFFFFF", fontSize: 13, fontWeight: 600,
              cursor: selectedLocationId ? "pointer" : "not-allowed",
            }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Slim Create-Location modal — full identity + address; full
          configuration (pay/ship partner, freight, contacts) defers
          to Partner Management via toasts inside the modal. */}
      <CreateLocationModal
        open={showCreateLocation}
        onOpenChange={setShowCreateLocation}
        customerName={customerName}
        onCreated={handleLocationCreated}
      />
    </>,
    document.body
  );
}

/* ──────────────────────────────────────────────────────────────────── */

function sortValue(loc: Location, key: string): string | number {
  switch (key) {
    case "location_name": return loc.name.toLowerCase();
    case "type":          return loc.type ?? "";
    case "city_state":    return `${loc.city ?? ""} ${loc.state ?? ""}`.toLowerCase();
    case "last_updated":  return loc.lastUpdated ? new Date(loc.lastUpdated).getTime() : 0;
    case "status":        return loc.status === "inactive" ? 1 : 0;
    default:              return "";
  }
}

function getPocNames(loc: Location): PocPerson[] {
  if (loc.pocNames && loc.pocNames.length > 0) return loc.pocNames;
  if (loc.primaryContact) return [mockPocFromName(loc.primaryContact)];
  return [];
}

function mockPocFromName(name: string): PocPerson {
  return {
    name,
    initials: name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase(),
    bgColor: "#DBEAFE",
    fgColor: "#1E40AF",
  };
}

function FilterPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center"
      style={{
        height: 28, padding: "0 10px", borderRadius: 999,
        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
        background: "var(--card)",
        color: active ? "var(--primary)" : "var(--muted-foreground)",
        fontSize: 12, fontWeight: 500, gap: 6, cursor: "pointer",
        whiteSpace: "nowrap", flexShrink: 0,
      }}
    >
      {label}
      <span
        style={{
          padding: "1px 6px", borderRadius: 999,
          background: active ? "rgba(27, 110, 243, 0.16)" : "var(--muted)",
          color: active ? "var(--primary)" : "var(--muted-foreground)",
          fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: "center",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted-foreground)", fontSize: 13 }}>
      <MapPin style={{ width: 32, height: 32, margin: "0 auto 12px", color: "var(--border)" }} />
      No locations match the current filters.
    </div>
  );
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width: 16, height: 16,
        borderWidth: 2, borderStyle: "solid",
        borderColor: active ? "#0A77FF" : "#CBD5E1",
        backgroundColor: "transparent",
      }}
    >
      {active && <div className="rounded-full" style={{ width: 8, height: 8, backgroundColor: "#0A77FF" }} />}
    </div>
  );
}

function ScopePills({ type, comfort }: { type?: Location["type"]; comfort?: boolean }) {
  if (!type) return <span style={{ fontSize: 11, color: "#94A3B8" }}>—</span>;
  const showVendor = type === "Vendor" || type === "Both";
  const showCustomer = type === "Customer" || type === "Both";
  const sizeCls = comfort ? "text-[11px]" : "text-[10.5px]";
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {showVendor && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border ${sizeCls}`}
          style={{ fontWeight: 600, backgroundColor: "#EFF6FF", color: "#1E40AF", borderColor: "#BFDBFE" }}
        >
          Vendor
        </span>
      )}
      {showCustomer && (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border ${sizeCls}`}
          style={{ fontWeight: 600, backgroundColor: "#F5F3FF", color: "#5B21B6", borderColor: "#DDD6FE" }}
        >
          Customer
        </span>
      )}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: active ? "#ECFDF5" : "#FFFBEB",
        color: active ? "#065F46" : "#92400E",
        borderColor: active ? "#A7F3D0" : "#FDE68A",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

/* ── POC HoverCard — same dark gradient header + white body as
   PartnerLocationsTab. Renders the avatar trigger and the popover
   content shared across the POC and Created-By columns. */
function PocHoverCard({
  person, locationName, side,
}: {
  person: PocPerson;
  locationName: string;
  side: "POC" | "Team";
}) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="cursor-pointer">
          <Avatar person={person} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
        style={{ zIndex: 12300 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div
              className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0"
              style={{ backgroundColor: person.photo ? "transparent" : person.bgColor }}
            >
              {person.photo
                ? <img src={person.photo} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{person.initials}</div>}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{person.name}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {side === "POC" ? `Contact · ${locationName}` : "Team Member"}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white px-4 py-3 space-y-2">
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{person.name.toLowerCase().replace(/\s+/g, ".")}@company.com</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>+1 (555) 012-3456</span>
          </div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{side === "POC" ? locationName : "Operations"}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Avatar({ person, size = "md" }: { person: PocPerson; size?: "md" | "sm" }) {
  const cls = size === "md" ? "w-8 h-8" : "w-7 h-7";
  const txt = size === "md" ? "text-[10px]" : "text-[9px]";
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]`}
      style={{ backgroundColor: person.photo ? "transparent" : person.bgColor }}
    >
      {person.photo
        ? <img src={person.photo} alt="" className="w-full h-full object-cover" />
        : <span className={txt} style={{ fontWeight: 700, color: person.fgColor || "#334155" }}>{person.initials}</span>}
    </div>
  );
}

/* Cell renderer — same switch / cell shapes as
   PartnerLocationsTab.renderLocCell (Partner v7). */
function renderLocCell(colKey: string, loc: Location, isComfort: boolean, customerName: string, searchTerm = ""): ReactElement {
  switch (colKey) {
    case "location_name": {
      const subtitle = `${loc.city ?? ""}${loc.state ? `, ${loc.state}` : ""}`;
      return (
        <TableCell key={colKey}>
          <div className="flex items-center gap-2.5">
            <div className={`${isComfort ? "w-9 h-9" : "w-7 h-7"} rounded-md overflow-hidden bg-muted shrink-0 flex items-center justify-center`}>
              {loc.image
                ? <img src={loc.image} alt={loc.name} className="w-full h-full object-cover" />
                : <MapPin className="w-4 h-4" style={{ color: "#94A3B8" }} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm truncate" style={{ fontWeight: 500, color: "#1E293B" }}><HighlightText text={loc.name} searchTerm={searchTerm} /></span>
                {loc.isDefault && <Star className="w-3 h-3 shrink-0" style={{ fill: "#0A77FF", color: "#0A77FF" }} aria-label="Default" />}
              </div>
              {isComfort && <span className="text-[11px] text-slate-400 truncate block"><HighlightText text={subtitle || (loc.partner ?? customerName)} searchTerm={searchTerm} /></span>}
            </div>
          </div>
        </TableCell>
      );
    }
    case "type":
      return <TableCell key={colKey}><ScopePills type={loc.type} comfort={isComfort} /></TableCell>;
    case "address":
      return (
        <TableCell key={colKey}>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loc.address}, ${loc.city}, ${loc.state}, ${loc.country}`)}`}
            target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-muted-foreground hover:text-primary hover:underline truncate block transition-colors"
          >
            {loc.address}
          </a>
        </TableCell>
      );
    case "city_state":
      return <TableCell key={colKey} className="text-sm text-muted-foreground whitespace-nowrap">{loc.city}{loc.state ? `, ${loc.state}` : ""}</TableCell>;
    case "poc": {
      const pocs = getPocNames(loc);
      if (pocs.length === 0) return <TableCell key={colKey}><span className="text-sm text-muted-foreground">—</span></TableCell>;
      const primary = pocs[0];
      return (
        <TableCell key={colKey}>
          <div className={`flex items-center ${isComfort ? "gap-2.5" : "gap-2"}`}>
            <PocHoverCard person={primary} locationName={loc.name} side="POC" />
            <div className="min-w-0">
              <span className="text-sm truncate block max-w-[90px]" style={{ fontWeight: 500 }}>{primary.name}</span>
              {isComfort && <span className="text-[10px] text-muted-foreground/60 block">Contact</span>}
            </div>
            {pocs.length > 1 && (
              <OverflowTooltip
                category="Point of Contacts"
                items={pocs.slice(1).map((p, i) => ({
                  id: `${loc.id}-poc-${i}`,
                  name: p.name,
                  subtitle: "CONTACT",
                  initials: p.initials,
                  avatarBg: p.bgColor,
                  avatarFg: p.fgColor,
                }))}
              >
                <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{pocs.length - 1} more</span>
              </OverflowTooltip>
            )}
          </div>
        </TableCell>
      );
    }
    case "service_centers": {
      const centers = loc.serviceCenterNames ?? [];
      if (centers.length === 0) return <TableCell key={colKey}><span className="text-sm text-muted-foreground">—</span></TableCell>;
      return (
        <TableCell key={colKey}>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 ${isComfort ? "px-2 py-0.5 text-xs" : "px-1.5 py-px text-[11px]"} rounded-md border`} style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}>
              <Wrench className="w-3 h-3" style={{ color: "#94A3B8" }} />
              {centers[0]}
            </span>
            {centers.length > 1 && (
              <OverflowTooltip
                category="Service Centers"
                items={centers.slice(1).map((sc, i) => ({
                  id: `${loc.id}-sc-${i}`,
                  name: sc,
                  subtitle: "SERVICE CENTER",
                }))}
              >
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default" style={{ fontWeight: 600, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}>+{centers.length - 1}</span>
              </OverflowTooltip>
            )}
          </div>
        </TableCell>
      );
    }
    case "created_by": {
      const creator = loc.createdBy;
      if (!creator) return <TableCell key={colKey}><span className="text-sm text-muted-foreground">—</span></TableCell>;
      return (
        <TableCell key={colKey}>
          <div className={`flex items-center ${isComfort ? "gap-2.5" : "gap-2"}`}>
            <PocHoverCard person={creator} locationName={loc.name} side="Team" />
            <div className="min-w-0">
              <span className="text-sm truncate block max-w-[120px]" style={{ fontWeight: 500, color: "#1E293B" }}>{creator.name}</span>
              {isComfort && <span className="text-[10px] text-muted-foreground/50 block">Team Member</span>}
            </div>
          </div>
        </TableCell>
      );
    }
    case "last_updated": {
      const lu = loc.lastUpdated;
      if (!lu) return <TableCell key={colKey}><span className="text-sm text-muted-foreground">—</span></TableCell>;
      const days = Math.floor((Date.now() - new Date(lu).getTime()) / 86400000);
      const rel = (() => {
        if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
        if (days < 365) { const m = Math.floor(days / 30); return `${m} ${m === 1 ? 'month' : 'months'} ago`; }
        const y = Math.floor(days / 365); return `${y} ${y === 1 ? 'year' : 'years'} ago`;
      })();
      return (
        <TableCell key={colKey}>
          <div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{lu}</span>
            {isComfort && <span className="text-[10px] text-muted-foreground/50 block">{rel}</span>}
          </div>
        </TableCell>
      );
    }
    case "status":
      return <TableCell key={colKey}><StatusPill active={loc.status !== "inactive"} /></TableCell>;
    default:
      return <TableCell key={colKey}>—</TableCell>;
  }
}

/* ── Card view — Partner v7 card pattern (unchanged from the
   previous revision). Selection state retained: ring + Default
   pill + blue check circle anchored to the image top-right. */
function LocationCard({
  location, customerName, isSelected, onClick,
}: {
  location: Location;
  customerName: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const subtitle = location.partner ?? customerName;
  const isInactive = location.status === "inactive";
  const isActive = !isInactive;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      aria-pressed={isSelected}
      className="rounded-xl flex flex-col overflow-hidden transition-all duration-150 group/card"
      style={{
        /* Partners v7 selection chrome — same as the warehouse +
           carrier pickers. Solid blue stroke on select with a light
           blue card tint, a single 1px ring (no heavy shadow), and a
           soft hover outline at rest. */
        cursor: "pointer",
        border: `1px solid ${isSelected ? "#0A77FF" : "#E2E8F0"}`,
        backgroundColor: isSelected ? "#F5F9FF" : "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(10,119,255,0.15), 0 1px 3px rgba(10,119,255,0.06)"
          : "none",
        opacity: isInactive ? 0.75 : 1,
      }}
      onMouseEnter={(e) => {
        if (isSelected) return;
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)";
        e.currentTarget.style.borderColor = "#CBD5E1";
        e.currentTarget.style.backgroundColor = "#FAFCFF";
      }}
      onMouseLeave={(e) => {
        if (isSelected) return;
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "#E2E8F0";
        e.currentTarget.style.backgroundColor = "#FFFFFF";
      }}
    >
      <div className="relative w-full overflow-hidden" style={{ height: 160, backgroundColor: "#F1F5F9" }}>
        {location.image ? (
          <img
            src={location.image}
            alt={location.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#EFF6FF" }}>
            <MapPin style={{ width: 48, height: 48, color: "#0A77FF", opacity: 0.35 }} />
          </div>
        )}
        <div className="absolute" style={{ bottom: 10, right: 10, zIndex: 1 }}>
          <StatusPill active={isActive} />
        </div>
        {(location.isDefault || isSelected) && (
          <div className="absolute flex items-center" style={{ top: 10, right: 10, gap: 6, zIndex: 1 }}>
            {location.isDefault && (
              <span
                className="inline-flex items-center"
                style={{
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 11, fontWeight: 600,
                  backgroundColor: "rgba(255, 255, 255, 0.92)",
                  color: "#0A77FF",
                  border: "1px solid #BFDBFE",
                  backdropFilter: "blur(4px)",
                }}
              >
                <Star style={{ width: 11, height: 11 }} /> Default
              </span>
            )}
            {isSelected && (
              <span
                className="inline-flex items-center justify-center"
                style={{
                  width: 20, height: 20, borderRadius: 999,
                  backgroundColor: "#0A77FF",
                }}
              >
                <Check style={{ width: 12, height: 12, color: "#FFFFFF" }} strokeWidth={3} />
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1">
        <div style={{ padding: "10px 14px 0" }}>
          <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "#334155", lineHeight: "20px" }}>
            {location.name}
          </p>
          <p className="truncate" style={{ fontSize: 12, color: "#64748B", lineHeight: "18px", marginTop: 2 }}>
            {location.address}{location.city ? `, ${location.city}` : ""}{location.state ? `, ${location.state}` : ""}
          </p>
        </div>

        <div className="flex-1 flex items-center justify-between" style={{ padding: "10px 14px 12px", gap: 8 }}>
          <div className="min-w-0">
            <ScopePills type={location.type} comfort />
            {!location.type && <span style={{ fontSize: 11.5, color: "#94A3B8" }}>{subtitle}</span>}
          </div>
          {/* POC count only. Items count removed — locations on a quote
              / SO are about who to contact, not inventory. */}
          {(() => {
            const pocCount = location.pocCount ?? location.contacts ?? 0;
            return (
              <div className="flex items-center shrink-0" style={{ gap: 4, fontSize: 11.5 }}>
                <Users className="w-3 h-3" style={{ color: "#94A3B8" }} />
                <span className="tabular-nums" style={{ color: "#334155", fontWeight: 600 }}>{pocCount}</span>
                <span style={{ color: "#94A3B8", fontWeight: 500 }}>
                  {pocCount === 1 ? "contact" : "contacts"}
                </span>
              </div>
            );
          })()}
        </div>

        {/* Footer row — primary POC of this location with a star. Mirrors
            Partner's location card footer. When no primary contact is on
            file we collapse the row to a muted "No primary contact yet"
            line rather than rendering em-dashes / empty avatars. */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9", fontSize: 11, color: "#94A3B8" }}
        >
          {location.primaryContact ? (
            <div className="flex items-center min-w-0" style={{ gap: 6 }}>
              <div
                className="rounded-md flex items-center justify-center shrink-0"
                style={{
                  width: 20, height: 20,
                  backgroundColor: location.createdBy?.bgColor ?? "#EFF6FF",
                  color: location.createdBy?.fgColor ?? "#1E40AF",
                  fontSize: 9, fontWeight: 700,
                  border: "1px solid #E8ECF1",
                }}
              >
                {(location.createdBy?.initials) ??
                  location.primaryContact.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <span className="truncate" style={{ color: "#64748B", fontWeight: 500 }}>
                {location.primaryContact}
              </span>
              <Star className="w-3 h-3 shrink-0" style={{ fill: "#0A77FF", color: "#0A77FF" }} aria-label="Primary contact" />
            </div>
          ) : (
            <div className="flex items-center min-w-0" style={{ gap: 6, color: "#94A3B8", fontStyle: "italic" }}>
              <Users className="w-3 h-3" />
              <span className="truncate">No primary contact on file</span>
            </div>
          )}
          {location.lastUpdated && (
            <div className="flex items-center shrink-0" style={{ gap: 4 }}>
              <Clock className="w-3 h-3" style={{ color: "#CBD5E1" }} />
              <span style={{ color: "#64748B", fontWeight: 500 }}>{location.lastUpdated}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
