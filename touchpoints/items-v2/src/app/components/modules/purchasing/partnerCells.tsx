/**
 * partnerCells — the partner-identity table cells shared between the Qualified
 * Vendors LISTING (QVTable) and the Add-vendor BROWSE picker
 * (AddQualifiedVendorModal). Extracted verbatim from QVTable so both tables
 * render the columns identically (Partner Locations, Points of Contact,
 * Country, Credit Limit, Carrier (Vendor)) — change them here once and both
 * tables stay in lockstep. Each cell takes primitive props rather than a full
 * QualifiedVendor so the browse pool (AvailableVendor) can reuse them.
 */
import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { MapPin, Building2, Truck } from "lucide-react";
import {
  OverflowTooltip,
  UserCell,
  getPersonAvatar,
  getContactDetails,
} from "../../items-v3";
import { CarrierIcon } from "./CarrierIcon";
import type { VendorContact } from "../../../context/purchasing/types";
import { formatWhole } from "../../../currency/vendorFx";

/* Deterministic location thumbnails + site-type mock for the Partner Locations
   cell and its "+N more" overflow (ported from VendorsListPage's LOC_PHOTOS_PL
   / address generation). */
const LOC_PHOTOS = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=80&h=80&fit=crop",
  "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=80&h=80&fit=crop",
];
const LOC_TYPES = ["Warehouse", "Distribution Center", "Manufacturing", "Regional Office", "HQ"];
function locHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

/** Deterministic thumbnail + site-type for a location string — exported so the
 *  Browse-step location picker renders the SAME imagery as this cell. */
export function getLocationPhoto(site: string): string {
  return LOC_PHOTOS[locHash(site || "") % LOC_PHOTOS.length];
}
export function getLocationType(site: string): string {
  return LOC_TYPES[locHash(site || "") % LOC_TYPES.length];
}
const LOC_STREETS = ["Industrial Pkwy", "Commerce Dr", "Logistics Blvd", "Enterprise Way", "Distribution Ave", "Warehouse Rd", "Production St", "Supply Chain Dr"];
/** Deterministic mock street address for a location string (the mock model has
 *  no real per-site address). Shared by the cell overflow + the picker rows. */
export function getLocationAddress(site: string): string {
  if (!site) return "";
  const h = locHash(site);
  return `${100 + (h % 8900)} ${LOC_STREETS[h % LOC_STREETS.length]}, ${site}`;
}

/* Partner Locations — photo thumbnail + hover business card + the primary site
   name, with a "+N more" overflow listing the rest. */
export function PartnerLocationsCell({
  rowId,
  primaryLocation,
  partnerLocations,
  vendorName,
}: {
  rowId: string;
  primaryLocation: string;
  partnerLocations?: string[];
  vendorName: string;
}) {
  const locs = partnerLocations && partnerLocations.length ? partnerLocations : [primaryLocation];
  const primary = locs[0];
  const extra = locs.slice(1);
  const h = locHash(primary || "");
  const photo = LOC_PHOTOS[h % LOC_PHOTOS.length];
  const locType = LOC_TYPES[h % LOC_TYPES.length];
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <HoverCard>
        <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <div className="w-7 h-7 rounded-md bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer">
            <img src={photo} alt="" className="w-full h-full object-cover" />
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center gap-3 relative">
              <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0"><img src={photo} alt="" className="w-full h-full object-cover" /></div>
              <div className="min-w-0">
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{primary || "Location"}</p>
                <p className="text-[11px] text-slate-400 truncate">{vendorName}</p>
              </div>
            </div>
          </div>
          <div className="bg-white px-3.5 py-3 space-y-2">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{primaryLocation}</span></div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{locType}</span></div>
          </div>
        </HoverCardContent>
      </HoverCard>
      <span className="text-sm text-foreground truncate" title={primary}>{primary}</span>
      {extra.length > 0 && (
        <OverflowTooltip
          category="Locations"
          items={extra.map((loc, i) => ({
            id: `${rowId}-loc-${i}`,
            name: loc,
            subtitle: locType,
            imageUrl: LOC_PHOTOS[locHash(loc) % LOC_PHOTOS.length],
          }))}
        >
          <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extra.length} more</span>
        </OverflowTooltip>
      )}
    </div>
  );
}

/* Points of Contact — avatar + name with a hover business card, plus "+N more"
   overflow. Reuses our canonical UserCell. */
export function PointsOfContactCell({
  rowId,
  contacts,
}: {
  rowId: string;
  contacts?: VendorContact[];
}) {
  const list = contacts ?? [];
  if (!list.length) return <span className="text-muted-foreground/50 text-sm">—</span>;
  const primary = list[0];
  const extra = list.slice(1);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <UserCell name={primary.name} subtitle={primary.title || "Contact"} />
      {extra.length > 0 && (
        <OverflowTooltip
          category="Contacts"
          items={extra.map((c, i) => {
            const cd = getContactDetails(c.name || "");
            return {
              id: `${rowId}-poc-${i}`,
              name: c.name,
              subtitle: c.email || cd.email,
              subtitleHref: `mailto:${c.email || cd.email}`,
              imageUrl: getPersonAvatar(c.name || ""),
            };
          })}
        >
          <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: "#085FCC" }}>+{extra.length} more</span>
        </OverflowTooltip>
      )}
    </div>
  );
}

/* Country — flag emoji + country name. */
export function CountryCell({ country, countryFlag }: { country?: string; countryFlag?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-base">{countryFlag ?? "🌍"}</span>
      <span className="text-sm text-foreground truncate" title={country}>{country ?? "—"}</span>
    </div>
  );
}

/* Credit Limit — right-aligned, in the partner's currency with its code
   (spec 4.2): "¥2,896,000 JPY". */
export function CreditLimitCell({ creditLimit, currency }: { creditLimit?: number; currency?: string }) {
  return (
    <span className="text-sm tabular-nums text-foreground">
      {creditLimit != null ? formatWhole(creditLimit, currency || "USD") : "—"}
    </span>
  );
}

/* Carrier (Vendor) — brand logo tile + carrier name with a hover business card. */
export function CarrierVendorCell({ carrier }: { carrier?: string }) {
  if (!carrier) return <span className="text-muted-foreground/50 text-sm">—</span>;
  const ch = locHash(carrier);
  const cvPrice = `$${(ch % 40) + 8}.00`;
  const cvDays = `${(ch % 5) + 1}–${(ch % 5) + 5} days`;
  const CV_SERVICES = ["Ground & Express", "Freight", "Ground", "Express & Priority", "Standard & Freight"];
  const CV_REGIONS = ["North America", "Global", "North America, Europe", "Asia Pacific", "Americas"];
  return (
    <div className="flex items-center gap-2 min-w-0">
      <HoverCard>
        <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <div className="cursor-pointer"><CarrierIcon carrier={carrier} /></div>
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center gap-3 relative">
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 overflow-hidden"><CarrierIcon carrier={carrier} /></div>
              <div className="min-w-0">
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{carrier}</p>
                <p className="text-[11px] text-slate-400">Primary Vendor Carrier</p>
              </div>
            </div>
          </div>
          <div className="bg-white px-3.5 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{cvPrice}<span className="text-[11px] text-slate-400 ml-0.5" style={{ fontWeight: 400 }}>/shipment</span></span>
              <span className="text-[12px] text-slate-700" style={{ fontWeight: 500 }}>{cvDays}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{CV_SERVICES[ch % CV_SERVICES.length]}</span></div>
            <div className="flex items-center justify-between text-[12px]"><span className="text-slate-500">{CV_REGIONS[ch % CV_REGIONS.length]}</span><span className="text-slate-500" style={{ fontWeight: 500 }}>Tracking available</span></div>
          </div>
        </HoverCardContent>
      </HoverCard>
      <span className="text-sm text-foreground truncate" title={carrier}>{carrier}</span>
    </div>
  );
}
