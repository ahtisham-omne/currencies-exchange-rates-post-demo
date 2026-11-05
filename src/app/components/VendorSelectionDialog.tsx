import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  Check,
  Phone,
  Mail,
  Briefcase,
  Search,
  Building2,
  ChevronDown,
  ChevronRight,
  User,
} from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

import type { VendorEntity, VendorLocationInfo, VendorEntityContact } from "./catalogData";
import { FONT } from "./designTokens";

/* ── Typography — all CSS-variable bound, Inter only ── */

const st = {
  dialogTitle: {
    fontSize: "var(--text-base)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  dialogDesc: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  vendorName: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  vendorMeta: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
    letterSpacing: "0.04em",
  } as React.CSSProperties,
  locationName: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  locationDesc: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  pocName: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  pocDetail: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
  countBadge: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,
  btnLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,
  tiny: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════════
   VENDOR LIST ITEM — compact row in the left panel
   Selected: subtle primary tint bg + primary check. Unselected: neutral.
   ═══════════════════════════════════════════════════════════════ */

function VendorListItem({
  vendor,
  isSelected,
  onSelect,
}: {
  vendor: VendorEntity;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const defaultLoc = vendor.locations.find((l) => l.isDefault) || vendor.locations[0];

  return (
    <button
      className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-md)] border transition-all cursor-pointer ${
        isSelected
          ? "border-primary/20 bg-primary-tint shadow-[var(--elevation-card)]"
          : "border-transparent hover:bg-secondary/60"
      }`}
      style={{ fontFamily: FONT }}
      onClick={onSelect}
    >
      {/* Avatar — primary tint when selected, neutral otherwise */}
      <div
        className={`flex items-center justify-center size-8 rounded-[var(--radius-sm)] shrink-0 ${
          isSelected ? "bg-primary/10" : "bg-secondary"
        }`}
      >
        <span
          className={isSelected ? "text-primary" : "text-muted-foreground"}
          style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}
        >
          {vendor.abbr}
        </span>
      </div>

      {/* Name + default location hint */}
      <div className="min-w-0 flex-1">
        <span className="text-foreground block truncate" style={st.vendorName}>
          {vendor.name}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="size-2.5 text-muted-foreground/50 shrink-0" />
          <span className="text-muted-foreground truncate" style={st.vendorMeta}>
            {defaultLoc?.name || "No location"}
          </span>
          {vendor.locations.length > 1 && (
            <span className="text-muted-foreground/70 shrink-0" style={st.countBadge}>
              +{vendor.locations.length - 1}
            </span>
          )}
        </div>
      </div>

      {/* Primary check when selected */}
      {isSelected && (
        <div className="flex items-center justify-center size-4 rounded-full bg-primary/15 shrink-0">
          <Check className="size-2.5 text-primary" />
        </div>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   POC INLINE ROW — compact contact row inside a location card
   ═══════════════════════════════════════════════════════════════ */

function PocInlineRow({ contact }: { contact: VendorEntityContact }) {
  return (
    <div className="flex items-start gap-2 py-2 first:pt-0 last:pb-0" style={{ fontFamily: FONT }}>
      {/* Small avatar */}
      <div className="flex items-center justify-center size-6 rounded-full bg-secondary shrink-0 mt-0.5">
        <span
          className="text-muted-foreground"
          style={{ fontSize: "8px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}
        >
          {contact.initials}
        </span>
      </div>
      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground truncate" style={st.pocName}>{contact.name}</span>
          <span className="text-foreground/12 shrink-0">&middot;</span>
          <span className="text-muted-foreground truncate" style={st.pocDetail}>{contact.role}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
          <div className="flex items-center gap-1">
            <Mail className="size-2.5 text-muted-foreground/40 shrink-0" />
            <span className="text-muted-foreground truncate" style={st.pocDetail}>{contact.email}</span>
          </div>
          <div className="flex items-center gap-1">
            <Phone className="size-2.5 text-muted-foreground/40 shrink-0" />
            <span className="text-muted-foreground" style={st.pocDetail}>{contact.phone}</span>
          </div>
          <div className="flex items-center gap-1">
            <Briefcase className="size-2.5 text-muted-foreground/40 shrink-0" />
            <span className="text-muted-foreground truncate" style={st.pocDetail}>{contact.department}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOCATION CARD — selectable location with progressive disclosure
   When selected: expands to reveal POC contacts inline.
   When not selected: compact row with just name + address.
   ═══════════════════════════════════════════════════════════════ */

function LocationCard({
  location,
  isSelected,
  onSelect,
  vendorContact,
}: {
  location: VendorLocationInfo;
  isSelected: boolean;
  onSelect: () => void;
  vendorContact?: VendorEntityContact;
}) {
  const [pocExpanded, setPocExpanded] = useState(false);

  // Resolve contacts: location-level first, fall back to vendor-level
  const contacts: VendorEntityContact[] = location.contacts?.length
    ? location.contacts
    : vendorContact
      ? [vendorContact]
      : [];

  // Auto-expand POC when this location becomes selected, collapse when deselected
  useEffect(() => {
    if (isSelected && contacts.length > 0) {
      setPocExpanded(true);
    } else if (!isSelected) {
      setPocExpanded(false);
    }
  }, [isSelected, contacts.length]);

  const handleTogglePoc = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPocExpanded((prev) => !prev);
  };

  return (
    <div
      className={`rounded-[var(--radius-md)] border transition-all ${
        isSelected
          ? "border-primary/25 bg-card shadow-[var(--elevation-card)]"
          : "border-border/60 bg-card hover:border-border"
      }`}
      style={{ fontFamily: FONT }}
    >
      {/* Clickable header row */}
      <button
        className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
        onClick={onSelect}
      >
        {/* Selection radio-like indicator */}
        <div
          className={`flex items-center justify-center size-4 rounded-full shrink-0 border transition-colors ${
            isSelected
              ? "border-primary bg-primary"
              : "border-foreground/15 bg-transparent"
          }`}
        >
          {isSelected && <Check className="size-2.5 text-primary-foreground" />}
        </div>

        <MapPin className={`size-3 shrink-0 ${isSelected ? "text-primary/60" : "text-muted-foreground/40"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={`truncate ${isSelected ? "text-foreground" : "text-foreground/80"}`} style={st.locationName}>
              {location.name}
            </span>
            {location.isDefault && (
              <span
                className="inline-flex items-center px-1.5 py-px rounded-[var(--radius-sm)] bg-secondary text-muted-foreground shrink-0"
                style={st.countBadge}
              >
                Default
              </span>
            )}
          </div>
          <span className="text-muted-foreground block truncate mt-px" style={st.locationDesc}>
            {location.description}
          </span>
        </div>
      </button>

      {/* Progressive disclosure: POC toggle + content (only when selected and has contacts) */}
      {isSelected && contacts.length > 0 && (
        <>
          {/* POC toggle strip */}
          <div className="px-3">
            <div className="border-t border-border/40" />
          </div>
          <button
            className="w-full flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-secondary/30 transition-colors"
            onClick={handleTogglePoc}
          >
            {pocExpanded ? (
              <ChevronDown className="size-3 text-muted-foreground/60" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground/60" />
            )}
            <User className="size-3 text-primary/50" />
            <span className="text-muted-foreground" style={st.countBadge}>
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            </span>
          </button>

          {/* Expanded POC list */}
          {pocExpanded && (
            <div className="px-3 pb-2.5">
              <div className="rounded-[var(--radius-sm)] bg-secondary/40 px-2.5 py-2 divide-y divide-border/30">
                {contacts.map((c, idx) => (
                  <PocInlineRow key={`${c.email}-${idx}`} contact={c} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RIGHT PANEL — Vendor header + Location cards with embedded POC
   ═══════════════════════════════════════════════════════════════ */

function VendorDetailPanel({
  vendor,
  selectedLocationId,
  onSelectLocation,
}: {
  vendor: VendorEntity;
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ fontFamily: FONT }}>
      {/* Vendor header — minimal, balanced blue accent */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-9 rounded-[var(--radius-md)] bg-primary-tint shrink-0">
            <span
              className="text-primary"
              style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}
            >
              {vendor.abbr}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-foreground block truncate" style={st.vendorName}>{vendor.name}</span>
            <span className="text-muted-foreground block" style={st.vendorMeta}>
              {vendor.locations.length} location{vendor.locations.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Scrollable content: location cards */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        <div className="px-4 pt-3 pb-1.5">
          <span className="text-muted-foreground uppercase" style={st.sectionLabel}>
            Select Location
          </span>
        </div>
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {vendor.locations.map((loc) => (
            <LocationCard
              key={loc.id}
              location={loc}
              isSelected={loc.id === selectedLocationId}
              onSelect={() => onSelectLocation(loc.id)}
              vendorContact={vendor.contact}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VENDOR SELECTION DIALOG — Main exported dialog

   Two-panel layout:
   ┌─────────────────┬──────────────────────────┐
   │  Search          │  Vendor Name              │
   │  ─────────────  │  ────────────────────     │
   │  Vendor list     │  SELECT LOCATION          │
   │  (scrollable)    │  ┌─── Location Card ───┐  │
   │                  │  │ ● Loc Name  Default  │  │
   │                  │  │   Address...          │  │
   │                  │  │ ─── 2 contacts ▾ ─── │  │
   │                  │  │  👤 Name · Role       │  │
   │                  │  │    email / phone      │  │
   │                  │  └──────────────────────┘  │
   ├──────────────────┴──────────────────────────┤
   │               [Cancel]  [Confirm]           │
   └─────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════ */

export interface VendorSelection {
  vendorName: string;
  locationId: string;
  locationName: string;
}

interface VendorSelectionDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  icon: React.ElementType;
  vendors: VendorEntity[];
  currentVendorName: string;
  onSelect: (selection: VendorSelection) => void;
}

export default function VendorSelectionDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  vendors,
  currentVendorName,
  onSelect,
}: VendorSelectionDialogProps) {
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  /* Initialize on open */
  useEffect(() => {
    if (open) {
      const found = vendors.find((v) => v.name === currentVendorName);
      if (found) {
        setSelectedVendorId(found.id);
        const defaultLoc = found.locations.find((l) => l.isDefault) || found.locations[0];
        setSelectedLocationId(defaultLoc?.id || "");
      } else if (vendors.length > 0) {
        setSelectedVendorId(vendors[0].id);
        const defaultLoc = vendors[0].locations.find((l) => l.isDefault) || vendors[0].locations[0];
        setSelectedLocationId(defaultLoc?.id || "");
      }
      setSearchQuery("");
    }
  }, [open, currentVendorName, vendors]);

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendors;
    const q = searchQuery.toLowerCase();
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.abbr.toLowerCase().includes(q) ||
        v.locations.some((l) => l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q))
    );
  }, [vendors, searchQuery]);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  const handleSelectVendor = (vendor: VendorEntity) => {
    setSelectedVendorId(vendor.id);
    const defaultLoc = vendor.locations.find((l) => l.isDefault) || vendor.locations[0];
    setSelectedLocationId(defaultLoc?.id || "");
  };

  const selectedLocation = selectedVendor?.locations.find((l) => l.id === selectedLocationId);

  const handleSave = () => {
    if (selectedVendor && selectedLocation) {
      onSelect({
        vendorName: selectedVendor.name,
        locationId: selectedLocation.id,
        locationName: selectedLocation.name,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[840px] p-0 gap-0 overflow-hidden flex flex-col"
        style={{ fontFamily: FONT, maxHeight: "min(85vh, 620px)" }}
      >
        {/* ── Header — primary-tinted icon, no count badge ── */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-center size-8 rounded-[var(--radius-md)] bg-primary-tint shrink-0">
            <Icon className="size-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle style={st.dialogTitle} className="text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription style={st.dialogDesc} className="text-muted-foreground mt-0.5">
              {description}
            </DialogDescription>
          </div>
        </div>

        {/* ── Two-panel content ── */}
        <div className="flex flex-1 min-h-0">
          {/* LEFT PANEL: Search + Vendor list */}
          <div className="w-[300px] shrink-0 flex flex-col min-w-0 border-r border-border">
            {/* Search */}
            <div className="px-3 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/40" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vendors..."
                  className="h-8 pl-8 border-border/70"
                  style={st.fieldLabel}
                />
              </div>
            </div>

            {/* Vendor list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2" style={{ scrollbarWidth: "thin" }}>
              <div className="flex flex-col gap-px">
                {filteredVendors.map((vendor) => (
                  <VendorListItem
                    key={vendor.id}
                    vendor={vendor}
                    isSelected={vendor.id === selectedVendorId}
                    onSelect={() => handleSelectVendor(vendor)}
                  />
                ))}
              </div>

              {filteredVendors.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Search className="size-5 text-muted-foreground/20" />
                  <span className="text-muted-foreground/60" style={st.vendorMeta}>
                    No vendors match your search
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Vendor detail + Location cards with embedded POC */}
          <div className="flex-1 min-w-0 overflow-hidden bg-secondary/20">
            {selectedVendor ? (
              <VendorDetailPanel
                vendor={selectedVendor}
                selectedLocationId={selectedLocationId}
                onSelectLocation={setSelectedLocationId}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 px-4">
                <Building2 className="size-6 text-muted-foreground/15" />
                <span className="text-muted-foreground/40 text-center" style={st.vendorMeta}>
                  Select a vendor to see locations and contacts
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer — clean, just actions ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 cursor-pointer"
            style={st.btnLabel}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 px-4 cursor-pointer"
            style={st.btnLabel}
            onClick={handleSave}
            disabled={!selectedVendor || !selectedLocation}
          >
            <Check className="size-3.5" />
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════
   VENDOR DISPLAY CARD — Compact card for the PO draft sidebar
   ═══════════════════════════════════════════════════════════════ */

export function VendorDisplayCard({
  vendor,
  location,
  label,
  icon: CardIcon,
  canEdit,
  onChangeClick,
}: {
  vendor: VendorEntity | undefined;
  location?: VendorLocationInfo;
  label: string;
  icon: React.ElementType;
  canEdit: boolean;
  onChangeClick: () => void;
}) {
  if (!vendor) {
    return (
      <div className="rounded-[var(--radius-md)] border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardIcon className="size-3.5 text-muted-foreground/30" />
            <span className="text-muted-foreground" style={st.locationName}>{label}</span>
          </div>
          {canEdit && (
            <button
              className="flex items-center gap-1 text-primary cursor-pointer hover:underline"
              style={st.vendorMeta}
              onClick={onChangeClick}
            >
              Select
            </button>
          )}
        </div>
        <span className="text-muted-foreground/40 block mt-1" style={st.vendorMeta}>
          No vendor selected
        </span>
      </div>
    );
  }

  const activeLocation = location || vendor.locations.find((l) => l.isDefault) || vendor.locations[0];

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden"
      style={{ fontFamily: FONT }}
    >
      {/* Label + Change button */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-1.5">
          <CardIcon className="size-3 text-muted-foreground/40" />
          <span className="text-muted-foreground/70" style={st.sectionLabel}>{label.toUpperCase()}</span>
        </div>
        {canEdit && (
          <button
            className="flex items-center gap-1 text-primary cursor-pointer hover:underline"
            style={st.vendorMeta}
            onClick={onChangeClick}
          >
            Change
          </button>
        )}
      </div>

      {/* Vendor info */}
      <div className="px-3.5 py-2.5 flex items-center gap-2.5">
        <div className="flex items-center justify-center size-8 rounded-[var(--radius-sm)] bg-primary-tint shrink-0">
          <span className="text-primary" style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>
            {vendor.abbr}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-foreground block truncate" style={st.vendorName}>{vendor.name}</span>
          {activeLocation && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="size-2.5 text-muted-foreground/40 shrink-0" />
              <span className="text-muted-foreground truncate" style={st.vendorMeta}>
                {activeLocation.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
