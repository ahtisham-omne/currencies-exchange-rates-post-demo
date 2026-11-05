/* ═══════════════════════════════════════════════════════════════
   PLANNER — MANAGE CATEGORIES MODAL
   ───────────────────────────────────────────────────────────────
   A duplicate of [[PlannerManageItemsModal]] — SAME modal: same
   header, Browse / Added toggle, sort pills, sticky-column table,
   row hover + checkbox selection, hover-card previews, pagination,
   footer CTAs, gradient bulk-remove confirm, and dialog layering.

   The ONLY difference is the data source. Items use demand-item
   data; this maps **category** data, sourced verbatim from the
   Categories module's listing table (radiant-core-fusion /
   `CategoriesPage.tsx` → `DATA`). The columns mirror that listing:
   Category Code · Description · Tags · No. of Items · Created By ·
   Created On · Status.

   Selection is keyed by category code and flows into the planner
   scope's params.categories.
   ═══════════════════════════════════════════════════════════════ */
import React, { useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { FONT } from "./designTokens";
import { Dialog, DialogPortal, DialogOverlay } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "./ui/hover-card";
import {
  Search,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Layers,
  Trash2,
  Mail,
  Building2,
  Phone,
  ExternalLink,
} from "lucide-react";
// ──────────────────────────────────────────────
// Types + data — verbatim from the Categories listing table
// (radiant-core-fusion / CategoriesPage.tsx).
// ──────────────────────────────────────────────

export interface PlannerCategoryRow {
  code: string;
  isMe: boolean;
  description: string;
  tags: string[];
  extraTags: number;
  items: number;
  owner: string;
  ownerInitials: string;
  ownerColor: string;
  ownerAvatar: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerRole: string;
  ownerDept: string;
  created: string;
  status: "active" | "inactive";
}

const OWNER_AVATARS: Record<string, string> = {
  "Ahtsham Ahmad":  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
  "Faizan Khan":    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&crop=face",
  "Areeb Tanvir":   "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
  "Nophil Anwer":   "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
  "Irtaza Abid":    "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=80&h=80&fit=crop&crop=face",
  "Eli Rosenbloom": "https://images.unsplash.com/photo-1463453091185-61582044d556?w=80&h=80&fit=crop&crop=face",
};

/** The REAL planner categories (matching `PLANNER_ITEMS.category`) — the picker
    must offer the SAME categories the demand items carry, or a selection can
    never match and the listing filters to 0. `code` IS the category name so it
    lines up with the scope filter (`params.categories` ⊂ category names). The
    repo `PLANNER_CATEGORY_DATA` below (warehouse rows, C-1001…) is kept for
    reference but is NO LONGER the picker's source — it doesn't correspond to
    any demand item. */
const CATEGORY_ROWS: PlannerCategoryRow[] = [
  { code:"Braking", isMe:true,  description:"Brake-system components — calipers, pads, rotors, boosters, and hydraulic brake hardware", tags:["Braking","Safety"], extraTags:0, items:15, owner:"Areeb Tanvir", ownerInitials:"AT", ownerColor:"#7C3AED", ownerAvatar:OWNER_AVATARS["Areeb Tanvir"], ownerEmail:"areeb.tanvir@company.com", ownerPhone:"+1 (555) 456-7890", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Jan 12, 2026", status:"active" },
  { code:"Drivetrain", isMe:false, description:"Power-transmission parts — CV joints, half-shafts, couplings, and drivetrain assemblies", tags:["Drivetrain","Powertrain"], extraTags:0, items:15, owner:"Nophil Anwer", ownerInitials:"NA", ownerColor:"#D97706", ownerAvatar:OWNER_AVATARS["Nophil Anwer"], ownerEmail:"nophil.anwer@company.com", ownerPhone:"+1 (555) 567-8901", ownerRole:"Inventory Analyst", ownerDept:"Operations", created:"Feb 03, 2026", status:"active" },
  { code:"Electrical", isMe:true,  description:"Electrical & electronic parts — connectors, sensors, wiring harnesses, and control modules", tags:["Electrical","Electronics"], extraTags:0, items:15, owner:"Faizan Khan", ownerInitials:"FK", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Faizan Khan"], ownerEmail:"faizan.khan@company.com", ownerPhone:"+1 (555) 345-6789", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Feb 18, 2026", status:"active" },
  { code:"Hydraulics", isMe:false, description:"Hydraulic-system parts — pumps, cylinders, seals, hoses, and fluid-power components", tags:["Hydraulics","Fluid Power"], extraTags:0, items:15, owner:"Ahtsham Ahmad", ownerInitials:"AA", ownerColor:"#0A77FF", ownerAvatar:OWNER_AVATARS["Ahtsham Ahmad"], ownerEmail:"ahtsham.ahmad@company.com", ownerPhone:"+1 (555) 234-5678", ownerRole:"Senior Inventory Manager", ownerDept:"Operations", created:"Mar 05, 2026", status:"active" },
  { code:"Suspension", isMe:true,  description:"Ride & handling parts — shocks, struts, springs, control arms, sway bars, and bushings", tags:["Suspension","Chassis"], extraTags:0, items:4, owner:"Areeb Tanvir", ownerInitials:"AT", ownerColor:"#7C3AED", ownerAvatar:OWNER_AVATARS["Areeb Tanvir"], ownerEmail:"areeb.tanvir@company.com", ownerPhone:"+1 (555) 456-7890", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Mar 18, 2026", status:"active" },
  { code:"Cooling System", isMe:false, description:"Thermal management — radiators, water pumps, cooling fans, thermostats, and hoses", tags:["Cooling","Thermal"], extraTags:0, items:4, owner:"Faizan Khan", ownerInitials:"FK", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Faizan Khan"], ownerEmail:"faizan.khan@company.com", ownerPhone:"+1 (555) 345-6789", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Apr 02, 2026", status:"active" },
  { code:"Fuel Systems", isMe:false, description:"Fuel delivery & injection — pumps, injectors, rails, regulators, and filter assemblies", tags:["Fuel","Powertrain"], extraTags:0, items:4, owner:"Nophil Anwer", ownerInitials:"NA", ownerColor:"#D97706", ownerAvatar:OWNER_AVATARS["Nophil Anwer"], ownerEmail:"nophil.anwer@company.com", ownerPhone:"+1 (555) 567-8901", ownerRole:"Inventory Analyst", ownerDept:"Operations", created:"Apr 14, 2026", status:"active" },
  { code:"Steering", isMe:false, description:"Steering & column parts — rack & pinion, tie rods, steering pumps, and ball joints", tags:["Steering","Chassis"], extraTags:0, items:3, owner:"Ahtsham Ahmad", ownerInitials:"AA", ownerColor:"#0A77FF", ownerAvatar:OWNER_AVATARS["Ahtsham Ahmad"], ownerEmail:"ahtsham.ahmad@company.com", ownerPhone:"+1 (555) 234-5678", ownerRole:"Senior Inventory Manager", ownerDept:"Operations", created:"Apr 22, 2026", status:"active" },
  /* ── Extended catalogue (categories 9-20) — example rows that show
     the modal handles a rich list of part families. These currently
     have no `PLANNER_ITEMS` behind them, so selecting one in the
     scope filter will produce 0 matches until items are seeded. */
  { code:"Exhaust", isMe:false, description:"Exhaust system parts — mufflers, catalytic converters, resonators, and manifolds", tags:["Exhaust","Emissions"], extraTags:0, items:0, owner:"Eli Rosenbloom", ownerInitials:"ER", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Eli Rosenbloom"], ownerEmail:"eli.rosenbloom@company.com", ownerPhone:"+1 (555) 789-0123", ownerRole:"Distribution Manager", ownerDept:"Distribution", created:"May 04, 2026", status:"active" },
  { code:"Lighting", isMe:false, description:"Lighting & signal parts — headlamps, taillights, fog lights, LED modules, and bulbs", tags:["Lighting","Electronics"], extraTags:0, items:0, owner:"Faizan Khan", ownerInitials:"FK", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Faizan Khan"], ownerEmail:"faizan.khan@company.com", ownerPhone:"+1 (555) 345-6789", ownerRole:"Category Lead", ownerDept:"Procurement", created:"May 10, 2026", status:"active" },
  { code:"Interior Trim", isMe:true,  description:"Cabin trim & finish — dash panels, seat covers, door cards, headliners, and console pieces", tags:["Interior","Trim"], extraTags:0, items:0, owner:"Areeb Tanvir", ownerInitials:"AT", ownerColor:"#7C3AED", ownerAvatar:OWNER_AVATARS["Areeb Tanvir"], ownerEmail:"areeb.tanvir@company.com", ownerPhone:"+1 (555) 456-7890", ownerRole:"Category Lead", ownerDept:"Procurement", created:"May 15, 2026", status:"active" },
  { code:"Body Panels", isMe:false, description:"Exterior sheet metal — fenders, doors, hoods, bumpers, and quarter panels", tags:["Body","Exterior"], extraTags:0, items:0, owner:"Irtaza Abid", ownerInitials:"IA", ownerColor:"#DC2626", ownerAvatar:OWNER_AVATARS["Irtaza Abid"], ownerEmail:"irtaza.abid@company.com", ownerPhone:"+1 (555) 678-9012", ownerRole:"Supply Chain Coordinator", ownerDept:"Supply Chain", created:"May 20, 2026", status:"active" },
  { code:"Wheels & Tires", isMe:false, description:"Wheels & tire assemblies — alloy rims, steel wheels, tire mounts, and balance weights", tags:["Wheels","Chassis"], extraTags:0, items:0, owner:"Nophil Anwer", ownerInitials:"NA", ownerColor:"#D97706", ownerAvatar:OWNER_AVATARS["Nophil Anwer"], ownerEmail:"nophil.anwer@company.com", ownerPhone:"+1 (555) 567-8901", ownerRole:"Inventory Analyst", ownerDept:"Operations", created:"May 26, 2026", status:"active" },
  { code:"Filters", isMe:false, description:"Filtration — oil filters, air filters, fuel filters, cabin filters, and hydraulic filters", tags:["Filters","Maintenance"], extraTags:0, items:0, owner:"Ahtsham Ahmad", ownerInitials:"AA", ownerColor:"#0A77FF", ownerAvatar:OWNER_AVATARS["Ahtsham Ahmad"], ownerEmail:"ahtsham.ahmad@company.com", ownerPhone:"+1 (555) 234-5678", ownerRole:"Senior Inventory Manager", ownerDept:"Operations", created:"May 30, 2026", status:"active" },
  { code:"Sensors", isMe:true,  description:"Sensor modules — O2, MAF, MAP, ABS wheel speed, position, and knock sensors", tags:["Sensors","Electronics"], extraTags:0, items:0, owner:"Faizan Khan", ownerInitials:"FK", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Faizan Khan"], ownerEmail:"faizan.khan@company.com", ownerPhone:"+1 (555) 345-6789", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Jun 02, 2026", status:"active" },
  { code:"Fasteners", isMe:false, description:"Bolts, nuts, clips, and retainers — grade-rated hardware for chassis and body work", tags:["Fasteners","Hardware"], extraTags:0, items:0, owner:"Eli Rosenbloom", ownerInitials:"ER", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Eli Rosenbloom"], ownerEmail:"eli.rosenbloom@company.com", ownerPhone:"+1 (555) 789-0123", ownerRole:"Distribution Manager", ownerDept:"Distribution", created:"Jun 06, 2026", status:"active" },
  { code:"Belts & Hoses", isMe:false, description:"Rubber goods — serpentine belts, timing belts, radiator hoses, and vacuum lines", tags:["Belts","Cooling"], extraTags:0, items:0, owner:"Irtaza Abid", ownerInitials:"IA", ownerColor:"#DC2626", ownerAvatar:OWNER_AVATARS["Irtaza Abid"], ownerEmail:"irtaza.abid@company.com", ownerPhone:"+1 (555) 678-9012", ownerRole:"Supply Chain Coordinator", ownerDept:"Supply Chain", created:"Jun 10, 2026", status:"inactive" },
  { code:"Ignition", isMe:false, description:"Ignition components — coils, spark plugs, ignition switches, and control modules", tags:["Ignition","Electrical"], extraTags:0, items:0, owner:"Nophil Anwer", ownerInitials:"NA", ownerColor:"#D97706", ownerAvatar:OWNER_AVATARS["Nophil Anwer"], ownerEmail:"nophil.anwer@company.com", ownerPhone:"+1 (555) 567-8901", ownerRole:"Inventory Analyst", ownerDept:"Operations", created:"Jun 14, 2026", status:"active" },
  { code:"Transmission", isMe:true,  description:"Transmission internals — clutches, torque converters, valve bodies, and shift solenoids", tags:["Transmission","Powertrain"], extraTags:0, items:0, owner:"Areeb Tanvir", ownerInitials:"AT", ownerColor:"#7C3AED", ownerAvatar:OWNER_AVATARS["Areeb Tanvir"], ownerEmail:"areeb.tanvir@company.com", ownerPhone:"+1 (555) 456-7890", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Jun 18, 2026", status:"active" },
  { code:"HVAC", isMe:false, description:"Climate control — A/C compressors, evaporators, blend doors, blowers, and heater cores", tags:["HVAC","Comfort"], extraTags:0, items:0, owner:"Ahtsham Ahmad", ownerInitials:"AA", ownerColor:"#0A77FF", ownerAvatar:OWNER_AVATARS["Ahtsham Ahmad"], ownerEmail:"ahtsham.ahmad@company.com", ownerPhone:"+1 (555) 234-5678", ownerRole:"Senior Inventory Manager", ownerDept:"Operations", created:"Jun 24, 2026", status:"active" },
];

/** Category codes the current user owns (the `isMe` rows) — the same set the
    "mine" lens above narrows to (line: `CATEGORY_ROWS.filter(c => c.isMe)`).
    Exported so the scope questionnaire can pre-select them when the buyer
    turns on "Show only owned items & categories". */
export const OWNED_CATEGORY_CODES: string[] = CATEGORY_ROWS.filter(
  (c) => c.isMe,
).map((c) => c.code);

/** The Categories listing rows (CategoriesPage `DATA`), mapped 1:1. */
export const PLANNER_CATEGORY_DATA: PlannerCategoryRow[] = [
  { code:"C-1001", isMe:true,  description:"Primary distribution hub serving all regions with multi-zone climate storage, 24/7 outbound dispatch, and integrated cross-dock operations for high-velocity SKUs", tags:["Electronics","Engine"], extraTags:2, items:15, owner:"Ahtsham Ahmad", ownerInitials:"AA", ownerColor:"#0A77FF", ownerAvatar:OWNER_AVATARS["Ahtsham Ahmad"], ownerEmail:"ahtsham.ahmad@company.com", ownerPhone:"+1 (555) 234-5678", ownerRole:"Senior Inventory Manager", ownerDept:"Operations", created:"Mar 22, 2026", status:"active" },
  { code:"C-1002", isMe:false, description:"Regional storage facility supporting east coast operations with dedicated cross-dock capabilities, surge capacity for seasonal demand, and rapid replenishment cycles", tags:["Electrical Systems","Foot"], extraTags:2, items:3, owner:"Ahtsham Ahmad", ownerInitials:"AA", ownerColor:"#0A77FF", ownerAvatar:OWNER_AVATARS["Ahtsham Ahmad"], ownerEmail:"ahtsham.ahmad@company.com", ownerPhone:"+1 (555) 234-5678", ownerRole:"Senior Inventory Manager", ownerDept:"Operations", created:"Dec 23, 2024", status:"active" },
  { code:"C-1003", isMe:false, description:"European fulfillment and distribution center handling pan-EU orders with bonded warehousing, multilingual support, and harmonized customs documentation workflows", tags:["Fuel Systems","Braking"], extraTags:2, items:4, owner:"Faizan Khan", ownerInitials:"FK", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Faizan Khan"], ownerEmail:"faizan.khan@company.com", ownerPhone:"+1 (555) 345-6789", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Dec 18, 2024", status:"active" },
  { code:"C-1004", isMe:true,  description:"Pacific region storage and shipping hub coordinating West Coast inbound, last-mile delivery, and port-adjacent container staging for trans-Pacific freight", tags:["Electronics","Foot"], extraTags:2, items:2, owner:"Areeb Tanvir", ownerInitials:"AT", ownerColor:"#7C3AED", ownerAvatar:OWNER_AVATARS["Areeb Tanvir"], ownerEmail:"areeb.tanvir@company.com", ownerPhone:"+1 (555) 456-7890", ownerRole:"Warehouse Supervisor", ownerDept:"Logistics", created:"Dec 09, 2024", status:"inactive" },
  { code:"C-1005", isMe:true,  description:"APAC distribution and fulfillment center managing high-volume regional inventory, export consolidation, and value-added kitting for OEM and aftermarket channels", tags:["Electrical Systems","Foot"], extraTags:2, items:16, owner:"Nophil Anwer", ownerInitials:"NA", ownerColor:"#D97706", ownerAvatar:OWNER_AVATARS["Nophil Anwer"], ownerEmail:"nophil.anwer@company.com", ownerPhone:"+1 (555) 567-8901", ownerRole:"Inventory Analyst", ownerDept:"Operations", created:"Dec 02, 2024", status:"active" },
  { code:"C-1006", isMe:false, description:"Temperature-controlled warehouse for perishables with end-to-end cold-chain monitoring, rapid turnover bays, and validated multi-temperature storage zones", tags:["Electronics","Foot"], extraTags:2, items:2, owner:"Irtaza Abid", ownerInitials:"IA", ownerColor:"#DC2626", ownerAvatar:OWNER_AVATARS["Irtaza Abid"], ownerEmail:"irtaza.abid@company.com", ownerPhone:"+1 (555) 678-9012", ownerRole:"Supply Chain Coordinator", ownerDept:"Supply Chain", created:"Nov 25, 2024", status:"inactive" },
  { code:"C-1007", isMe:false, description:"Centralized returns handling and refurbishment facility with QA grading, repackaging, recertification, and resale workflows feeding secondary market channels", tags:["Fuel Systems","Braking"], extraTags:2, items:3, owner:"Eli Rosenbloom", ownerInitials:"ER", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Eli Rosenbloom"], ownerEmail:"eli.rosenbloom@company.com", ownerPhone:"+1 (555) 789-0123", ownerRole:"Distribution Manager", ownerDept:"Distribution", created:"Nov 18, 2024", status:"active" },
  { code:"C-1008", isMe:true,  description:"Bulk raw materials storage facility supporting manufacturing intake, just-in-time replenishment, vendor-managed inventory, and supplier consignment programs", tags:["Electronics","Foot"], extraTags:2, items:4, owner:"Ahtsham Ahmad", ownerInitials:"AA", ownerColor:"#0A77FF", ownerAvatar:OWNER_AVATARS["Ahtsham Ahmad"], ownerEmail:"ahtsham.ahmad@company.com", ownerPhone:"+1 (555) 234-5678", ownerRole:"Senior Inventory Manager", ownerDept:"Operations", created:"Nov 11, 2024", status:"active" },
  { code:"C-1009", isMe:false, description:"Southern region logistics and shipping center with multi-modal freight, consolidation services, LTL pooling, and bonded transit options for cross-state distribution", tags:["Braking","Engine"], extraTags:1, items:3, owner:"Faizan Khan", ownerInitials:"FK", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Faizan Khan"], ownerEmail:"faizan.khan@company.com", ownerPhone:"+1 (555) 345-6789", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Nov 04, 2024", status:"active" },
  { code:"C-1010", isMe:false, description:"Scandinavian fulfillment operations covering Nordic markets with localized inventory, native-language returns, and cross-border parcel routing across the region", tags:["Accessories","Interior"], extraTags:3, items:2, owner:"Areeb Tanvir", ownerInitials:"AT", ownerColor:"#7C3AED", ownerAvatar:OWNER_AVATARS["Areeb Tanvir"], ownerEmail:"areeb.tanvir@company.com", ownerPhone:"+1 (555) 456-7890", ownerRole:"Warehouse Supervisor", ownerDept:"Logistics", created:"Nov 25, 2024", status:"inactive" },
  { code:"C-1011", isMe:false, description:"LATAM regional storage and distribution hub serving cross-border logistics across the Americas with bilingual operations and customs brokerage integration", tags:["Electronics","Engine"], extraTags:2, items:5, owner:"Nophil Anwer", ownerInitials:"NA", ownerColor:"#D97706", ownerAvatar:OWNER_AVATARS["Nophil Anwer"], ownerEmail:"nophil.anwer@company.com", ownerPhone:"+1 (555) 567-8901", ownerRole:"Inventory Analyst", ownerDept:"Operations", created:"Sep 30, 2024", status:"active" },
  { code:"C-1012", isMe:false, description:"Specialized hazardous materials handling facility certified for chemical, lithium battery, and dangerous goods shipments with full IATA and ADR compliance", tags:["Fuel Systems","Foot"], extraTags:1, items:1, owner:"Irtaza Abid", ownerInitials:"IA", ownerColor:"#DC2626", ownerAvatar:OWNER_AVATARS["Irtaza Abid"], ownerEmail:"irtaza.abid@company.com", ownerPhone:"+1 (555) 678-9012", ownerRole:"Supply Chain Coordinator", ownerDept:"Supply Chain", created:"Dec 08, 2024", status:"inactive" },
  { code:"C-1013", isMe:false, description:"Japan fulfillment and last-mile delivery center optimized for next-day urban delivery windows, time-slot precision, and high-density metropolitan routing", tags:["Electrical Systems","Braking"], extraTags:2, items:18, owner:"Faizan Khan", ownerInitials:"FK", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Faizan Khan"], ownerEmail:"faizan.khan@company.com", ownerPhone:"+1 (555) 345-6789", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Oct 15, 2024", status:"active" },
  { code:"C-1014", isMe:false, description:"Oceania regional warehouse and distribution serving Australia and New Zealand customer demand with biosecurity-compliant intake and trans-Tasman freight lanes", tags:["Interior","Foot"], extraTags:2, items:4, owner:"Eli Rosenbloom", ownerInitials:"ER", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Eli Rosenbloom"], ownerEmail:"eli.rosenbloom@company.com", ownerPhone:"+1 (555) 789-0123", ownerRole:"Distribution Manager", ownerDept:"Distribution", created:"Oct 01, 2024", status:"active" },
  { code:"C-1015", isMe:true,  description:"Mexico-US cross-border logistics facility streamlining customs clearance, bonded transfers, IMMEX program processing, and integrated nearshoring support", tags:["Electronics","Engine"], extraTags:0, items:3, owner:"Areeb Tanvir", ownerInitials:"AT", ownerColor:"#7C3AED", ownerAvatar:OWNER_AVATARS["Areeb Tanvir"], ownerEmail:"areeb.tanvir@company.com", ownerPhone:"+1 (555) 456-7890", ownerRole:"Warehouse Supervisor", ownerDept:"Logistics", created:"Sep 22, 2024", status:"active" },
  { code:"C-1016", isMe:false, description:"Customs bonded facility for import/export operations with duty-deferred storage, in-house inspection, FTZ processing, and harmonized tariff classification support", tags:["Braking","Foot"], extraTags:2, items:5, owner:"Ahtsham Ahmad", ownerInitials:"AA", ownerColor:"#0A77FF", ownerAvatar:OWNER_AVATARS["Ahtsham Ahmad"], ownerEmail:"ahtsham.ahmad@company.com", ownerPhone:"+1 (555) 234-5678", ownerRole:"Senior Inventory Manager", ownerDept:"Operations", created:"Sep 10, 2024", status:"active" },
  { code:"C-1017", isMe:false, description:"Temperature-controlled facility for pharmaceuticals with GDP compliance, full cold-chain integrity, serialization tracking, and validated qualified storage zones", tags:["Fuel Systems","Engine"], extraTags:1, items:4, owner:"Nophil Anwer", ownerInitials:"NA", ownerColor:"#D97706", ownerAvatar:OWNER_AVATARS["Nophil Anwer"], ownerEmail:"nophil.anwer@company.com", ownerPhone:"+1 (555) 567-8901", ownerRole:"Inventory Analyst", ownerDept:"Operations", created:"Aug 28, 2024", status:"active" },
  { code:"C-1018", isMe:false, description:"Port-side storage for maritime logistics supporting container drayage, ocean freight staging, transloading, and direct rail interchange for inland distribution", tags:["Electrical Systems","Interior"], extraTags:2, items:6, owner:"Irtaza Abid", ownerInitials:"IA", ownerColor:"#DC2626", ownerAvatar:OWNER_AVATARS["Irtaza Abid"], ownerEmail:"irtaza.abid@company.com", ownerPhone:"+1 (555) 678-9012", ownerRole:"Supply Chain Coordinator", ownerDept:"Supply Chain", created:"Aug 15, 2024", status:"active" },
  { code:"C-1019", isMe:false, description:"High-velocity e-commerce fulfillment center optimized for same-day pick, pack, and ship cycles with automated sortation and carrier-integrated label routing", tags:["Electronics","Braking"], extraTags:1, items:3, owner:"Faizan Khan", ownerInitials:"FK", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Faizan Khan"], ownerEmail:"faizan.khan@company.com", ownerPhone:"+1 (555) 345-6789", ownerRole:"Category Lead", ownerDept:"Procurement", created:"Aug 02, 2024", status:"inactive" },
  { code:"C-1020", isMe:false, description:"Tax-free zone warehouse for Middle East operations with regional reexport access, GCC trade hub connectivity, and bonded staging for transshipment cargo", tags:["Engine","Foot"], extraTags:3, items:8, owner:"Eli Rosenbloom", ownerInitials:"ER", ownerColor:"#059669", ownerAvatar:OWNER_AVATARS["Eli Rosenbloom"], ownerEmail:"eli.rosenbloom@company.com", ownerPhone:"+1 (555) 789-0123", ownerRole:"Distribution Manager", ownerDept:"Distribution", created:"Jul 20, 2024", status:"active" },
];

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  active:   { color: "#065F46", bg: "#ECFDF5", border: "#A7F3D0" },
  inactive: { color: "#92400E", bg: "#FFFBEB", border: "#FDE68A" },
};

// ──────────────────────────────────────────────
// Cell sub-components (same grammar as the Items modal)
// ──────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap border capitalize"
      style={{ color: style.color, backgroundColor: style.bg, borderColor: style.border, fontWeight: 600 }}
    >
      {status}
    </span>
  );
}

function TagPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap bg-muted text-muted-foreground border border-border" style={{ fontWeight: 500 }}>
      {label}
    </span>
  );
}

/** Owner cell — photo avatar + hover business-card popover, identical
 *  to the Items modal's PersonCell, fed by the category row's owner. */
function OwnerCell({ row }: { row: PlannerCategoryRow }) {
  const [imgErr, setImgErr] = React.useState(false);
  const showImg = !!row.ownerAvatar && !imgErr;
  const contactId = row.owner.toLowerCase().replace(/\s+/g, "-");
  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/partners/contacts/${contactId}`, "_blank", "noopener,noreferrer");
  };
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer group/person" onClick={handleNavigate}>
          <div
            className="w-7 h-7 text-[9px] rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden"
            style={{ backgroundColor: showImg ? "transparent" : row.ownerColor, fontWeight: 600 }}
          >
            {showImg ? (
              <img src={row.ownerAvatar} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
            ) : (
              row.ownerInitials
            )}
          </div>
          <span className="text-sm text-slate-700 truncate group-hover/person:text-primary group-hover/person:underline transition-colors">
            {row.owner}
          </span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: showImg ? "transparent" : row.ownerColor }}>
              {showImg ? (
                <img src={row.ownerAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{row.ownerInitials}</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{row.owner}</p>
              <p className="text-[11px] text-slate-400 truncate">{row.ownerRole}</p>
            </div>
          </div>
        </div>
        <div className="bg-white px-4 py-3 space-y-2">
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{row.ownerEmail}</span></div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{row.ownerDept}</span></div>
          <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{row.ownerPhone}</span></div>
          <button
            type="button"
            onClick={handleNavigate}
            className="mt-2 inline-flex items-center justify-center w-full gap-1.5 h-8 rounded-md bg-primary text-white text-[12px] hover:bg-[#0862D0] transition-colors cursor-pointer"
            style={{ fontWeight: 600 }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Go to Contact
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// ──────────────────────────────────────────────
// Manage Categories Modal
// ──────────────────────────────────────────────

/* Yellow-highlight recipe used app-wide (Partners' canonical
   ColumnHeaderMenu treatment). Wraps every case-insensitive
   substring hit of `q` inside `text`. */
function highlightText(text: string, q: string): React.ReactNode {
  const query = q.trim();
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        className="bg-transparent px-0.5 rounded-sm"
        style={{ backgroundColor: "#FEFCE8", color: "#854D0E", fontWeight: 500 }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function PlannerManageCategoriesModal({
  open,
  onOpenChange,
  selectedCodes,
  onChange,
  mineOnly = false,
  codeByName = {},
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Currently selected category codes (= planner scope params.categories). */
  selectedCodes: string[];
  /** Commit a new selection (array of category codes). */
  onChange: (codes: string[]) => void;
  /** "Mine" lens — narrows Browse to owned categories (keeps selected). */
  mineOnly?: boolean;
  /** Display the ERP code (name → C-2131…) instead of the raw category
      name. Selection still keys on the name, so filtering is unaffected. */
  codeByName?: Record<string, string>;
}) {
  const [search, setSearch] = useState("");

  /* Display label = the ERP code (C-2131…) when the parent supplies a
     name→code map; falls back to the category name otherwise. Selection
     stays keyed by `cat.code` (the name), so filtering / counts are
     unaffected — only the visible label becomes the code. */
  const codeFor = (cat: PlannerCategoryRow) => codeByName[cat.code] ?? cat.code;

  // Full universe ALWAYS — ownership no longer HIDES non-owned categories.
  // Under the "mine" lens we only float owned categories toward the top of
  // each section; every category stays browsable + addable.
  const universe = useMemo(
    () =>
      mineOnly
        ? [...CATEGORY_ROWS].sort((a, b) => Number(b.isMe) - Number(a.isMe))
        : CATEGORY_ROWS,
    [mineOnly],
  );
  const existingItemIds = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const addedItems = useMemo(
    () => universe.filter((c) => existingItemIds.has(c.code)),
    [universe, existingItemIds],
  );
  const availableItems = useMemo(
    () => universe.filter((c) => !existingItemIds.has(c.code)),
    [universe, existingItemIds],
  );

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  /* Search filters both sections independently — matched hits stay in
     their bucket (added stays on top, available stays below). Empty
     query returns the full section. */
  const matchesSearch = (c: PlannerCategoryRow, q: string) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      (codeByName[c.code] ?? c.code).toLowerCase().includes(needle) ||
      c.code.toLowerCase().includes(needle) ||
      c.description.toLowerCase().includes(needle) ||
      c.tags.some((t) => t.toLowerCase().includes(needle)) ||
      c.owner.toLowerCase().includes(needle)
    );
  };
  const addedFiltered = useMemo(
    () => addedItems.filter((c) => matchesSearch(c, search)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addedItems, search, codeByName],
  );
  const availableFiltered = useMemo(
    () => availableItems.filter((c) => matchesSearch(c, search)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableItems, search, codeByName],
  );

  function commitCodes(next: string[]) {
    onChange(Array.from(new Set(next)));
  }
  function toggleCategory(code: string) {
    if (existingItemIds.has(code)) commitCodes(selectedCodes.filter((c) => c !== code));
    else commitCodes([...selectedCodes, code]);
  }

  const modalBaseTransition = "transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const modalSizeClass = `!fixed !inset-0 !translate-x-0 !translate-y-0 !m-auto !w-full !h-full ${modalBaseTransition} !max-w-[100%] sm:!max-w-[min(75vw,1480px)] !max-h-[100dvh] sm:!max-h-[min(88vh,1180px)] sm:!min-h-[640px] rounded-none sm:!rounded-2xl`;

  // Shared row renderer — same visuals for both sections; only the
  // leading icon + trailing action button change based on `isAdded`.
  const renderRow = (cat: PlannerCategoryRow, isAdded: boolean) => {
    return (
      <TableRow
        key={cat.code}
        className="group bg-white hover:bg-[#F0F7FF] [&>td]:py-1 [&>td]:pl-4 [&>td]:pr-2 cursor-pointer"
        onClick={() => toggleCategory(cat.code)}
      >
        {/* Leading state cell — sticky leftmost. Both sections mount a
            clickable icon: Plus to add, Check (in primary tint) when
            already added. Row-level click also toggles, but the icon
            gives the buyer a direct target. */}
        <TableCell className="sticky left-0 z-10 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0 group-hover:bg-[#F0F7FF]" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleCategory(cat.code)}
            className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              isAdded
                ? "text-primary hover:bg-primary/10"
                : "text-primary hover:bg-accent"
            }`}
            title={isAdded ? "Remove category" : "Add category"}
          >
            {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </TableCell>
        {/* Category Code — sticky-left at 40px (after checkbox) */}
        <TableCell
          className="sticky left-[40px] z-10 group-hover:bg-[#F0F7FF]"
          style={{ boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)", width: 200, minWidth: 200, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <HoverCard openDelay={250} closeDelay={80}>
              <HoverCardTrigger asChild>
                <div
                  className="w-8 h-8 rounded-lg bg-accent text-primary flex items-center justify-center overflow-hidden shrink-0 border border-[#E8ECF1] cursor-default"
                  title="Category"
                >
                  <Layers className="w-4 h-4" />
                </div>
              </HoverCardTrigger>
              <HoverCardContent
                side="bottom"
                align="start"
                className="w-[300px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center gap-3 relative">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-white/5 flex items-center justify-center text-white">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-white font-mono truncate" style={{ fontWeight: 600 }}>{codeFor(cat)}</p>
                      <p className="text-[11px] text-slate-400 truncate">{cat.tags.join(" · ")}{cat.extraTags > 0 ? ` +${cat.extraTags}` : ""}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white px-4 py-3 space-y-2">
                  <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-2">{cat.description}</p>
                  <div className="flex items-center justify-between pt-1.5 border-t border-muted">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400" style={{ fontWeight: 600 }}>Items</p>
                      <p className="text-[14px] text-slate-700 tabular-nums" style={{ fontWeight: 600 }}>{cat.items}</p>
                    </div>
                    <StatusBadge status={cat.status} />
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
            <div className="min-w-0 flex-1">
              <span
                className="text-sm font-mono text-slate-800 block truncate w-full"
                style={{ fontWeight: 500 }}
                title={codeFor(cat)}
              >
                {highlightText(codeFor(cat), search)}
              </span>
            </div>
          </div>
        </TableCell>
        {/* Description */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <p className="text-sm text-slate-700 truncate" style={{ fontWeight: 400 }}>
            {highlightText(cat.description, search)}
          </p>
        </TableCell>
        {/* Tags */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <div className="flex items-center gap-1 whitespace-nowrap">
            {cat.tags.map((t) => <TagPill key={t} label={t} />)}
            {cat.extraTags > 0 && (
              <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>+{cat.extraTags}</span>
            )}
          </div>
        </TableCell>
        {/* No. of Items */}
        <TableCell className="text-right !pr-3 group-hover:bg-[#F0F7FF] tabular-nums">
          <span className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{cat.items.toLocaleString()}</span>
        </TableCell>
        {/* Created By */}
        <TableCell className="group-hover:bg-[#F0F7FF]" onClick={(e) => e.stopPropagation()}>
          <OwnerCell row={cat} />
        </TableCell>
        {/* Created On */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <span className="text-sm text-slate-700 whitespace-nowrap">{cat.created}</span>
        </TableCell>
        {/* Status */}
        <TableCell className="group-hover:bg-[#F0F7FF]">
          <StatusBadge status={cat.status} />
        </TableCell>
        {/* Actions — Add / Remove pill. Sticky right column stays
            white regardless of row hover (per feedback: it was
            mixing with the row's hover tint). Row + leading icon
            also toggle, so this is a third target. */}
        <TableCell
          className="sticky right-0 z-10 !px-2 bg-white"
          style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center w-full h-full">
            {isAdded ? (
              <button
                onClick={() => toggleCategory(cat.code)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-red-200 bg-red-50 text-destructive hover:bg-red-100 hover:border-[#FCA5A5] transition-colors cursor-pointer text-[12px]"
                style={{ fontWeight: 600 }}
                title="Remove category"
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </button>
            ) : (
              <button
                onClick={() => toggleCategory(cat.code)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary text-primary-foreground hover:bg-[#0862D0] transition-colors cursor-pointer text-[12px]"
                style={{ fontWeight: 600 }}
                title="Add category"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay
          className="z-[225] bg-black/50"
          style={{ backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
        />
        <DialogPrimitive.Content
          className={`flex flex-col p-0 gap-0 border-0 sm:border bg-white z-[230] ${modalSizeClass}`}
          style={{ boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)" }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Manage Categories</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Add or remove categories from the planning scope.</DialogPrimitive.Description>

          {/* Header */}
          <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 shrink-0 bg-white rounded-t-none sm:rounded-t-2xl border-b border-[#EEF2F6]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] sm:text-[17px] text-foreground" style={{ fontWeight: 700 }}>
                    Manage Categories
                  </h2>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1" style={{ fontWeight: 400 }}>
                  Add categories to plan for, or remove ones no longer needed.
                </p>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Search — filters both sections; matched substrings render
              with the app-wide yellow highlight recipe. */}
          <div className="px-3 sm:px-5 pt-2 pb-2 bg-white shrink-0 border-b border-[#EEF2F6]">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 h-8 text-[13px] bg-white border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Single-table body — added rows on top, available rows
              below, separated by an inline section-header row that
              spans every column. Same table = single column-header
              row, no duplicated sticky chrome, and rows literally
              slide between the two buckets when toggled. */}
          <div className="flex-1 min-h-0 overflow-auto bg-white">
            <Table style={{ tableLayout: "fixed", minWidth: 1490 }}>
              <TableHeader className="sticky top-0 z-20 bg-white">
                <TableRow className="bg-[#FAFBFC] hover:bg-[#FAFBFC] [&>th]:h-8">
                  <TableHead className="sticky left-0 z-20 bg-[#FAFBFC] w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0" />
                  <TableHead
                    className="text-[13px] text-foreground !pl-4 sticky left-[40px] z-20 bg-[#FAFBFC]"
                    style={{ fontWeight: 600, width: 200, minWidth: 200, maxWidth: 200, boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" }}
                  >Category Code</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 360 }}>Description</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 220 }}>Tags</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4 text-right" style={{ fontWeight: 600, width: 130 }}>No. of Items</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 220 }}>Created By</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 150 }}>Created On</TableHead>
                  <TableHead className="text-[13px] text-foreground !pl-4" style={{ fontWeight: 600, width: 110 }}>Status</TableHead>
                  <TableHead className="sticky right-0 z-20 bg-[#FAFBFC] w-[110px] min-w-[110px] max-w-[110px] !pl-2 !pr-2 text-center text-[13px] text-foreground" style={{ fontWeight: 600, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Added section header row */}
                <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC] pointer-events-none [&>td]:py-1.5">
                  <TableCell colSpan={9} className="!pl-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-slate-500"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          fontFamily: FONT,
                        }}
                      >
                        Added categories
                      </span>
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-1.5 tabular-nums"
                        style={{ fontSize: 10, fontWeight: 700, height: 16, fontFamily: FONT }}
                      >
                        {addedFiltered.length}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {addedFiltered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="text-center py-4">
                      <p className="text-[12px] text-muted-foreground" style={{ fontFamily: FONT }}>
                        {search
                          ? "No added categories match your search."
                          : "No categories added yet — pick from below to start."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  addedFiltered.map((cat) => renderRow(cat, true))
                )}

                {/* Available section header row */}
                <TableRow className="bg-[#F8FAFC] hover:bg-[#F8FAFC] pointer-events-none [&>td]:py-1.5">
                  <TableCell colSpan={9} className="!pl-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-slate-500"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          fontFamily: FONT,
                        }}
                      >
                        Available categories
                      </span>
                      <span
                        className="inline-flex items-center justify-center rounded-full bg-muted text-slate-600 px-1.5 tabular-nums"
                        style={{ fontSize: 10, fontWeight: 700, height: 16, fontFamily: FONT }}
                      >
                        {availableFiltered.length}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {availableFiltered.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="text-center py-4">
                      <p className="text-[12px] text-muted-foreground" style={{ fontFamily: FONT }}>
                        {search
                          ? "No available categories match your search."
                          : "All categories are already added."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  availableFiltered.map((cat) => renderRow(cat, false))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Footer — added count + Done. No Add/Back pair anymore;
              every add/remove happens inline on the row. */}
          <div className="shrink-0 border-t border-[#EEF2F6] bg-white px-3 sm:px-5 py-2.5 flex items-center justify-between sm:rounded-b-2xl">
            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <span style={{ fontWeight: 500 }}>
                {addedItems.length} categor{addedItems.length !== 1 ? "ies" : "y"} added
              </span>
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="rounded-lg px-4 text-xs h-9 bg-primary text-white hover:bg-[#0862D0] shadow-sm"
            >
              Done
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
