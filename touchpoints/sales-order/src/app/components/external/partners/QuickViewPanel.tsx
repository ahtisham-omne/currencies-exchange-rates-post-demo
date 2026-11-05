import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Package,
  MapPin,
  User,
  Mail,
  Phone,
  Building2,
  Globe,
  Clock,
  ExternalLink,
  Warehouse,
  Tag,
  Hash,
  Layers,
  TrendingUp,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Star,
  Truck,
  Linkedin,
  Twitter,
  MessageCircle,
} from "lucide-react";
import { usePersonLightbox } from "../../shared/PersonAvatarLightbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import type { OverflowItem } from "./OverflowTooltip";

/* ─────────── Types ─────────── */

export type QuickViewType = "item" | "location" | "contact" | "carrier";

export interface QuickViewData {
  type: QuickViewType;
  item: OverflowItem;
  /** Vendor display name for context */
  vendorName: string;
  /** Vendor id — used by the Location footer action to deep-link into the details page */
  vendorId?: string;
  /** 0-based index of this location in the vendor's partnerLocations array — lets the detail page auto-open the matching location modal */
  locationIdx?: number;
  /** Optional override for the footer CTA URL — used when the
   *  caller knows a more specific destination than the panel's
   *  type-based default (e.g., the partner-detail Items tab linking
   *  to the canonical Items module rather than the generic project). */
  navUrlOverride?: string;
  /** Optional override for the footer CTA label paired with navUrlOverride. */
  navLabelOverride?: string;
}

interface QuickViewPanelProps {
  data: QuickViewData | null;
  onClose: () => void;
}

/* ─────────── Mock data generators ─────────── */

const ITEM_DATA: Record<string, { name: string; desc: string }> = {
  "100219-42": { name: "Industrial Steel Pipes", desc: "Heavy-gauge seamless carbon steel pipes — Schedule 40, ASTM A106 Grade B, suitable for high-pressure steam, oil, and gas applications in petrochemical and industrial piping systems" },
  "100219-43": { name: "Copper Fittings Kit", desc: "Professional-grade copper sweat fittings assortment — includes 90° elbows, tees, couplings, and reducers in 1/2\" to 1\" sizes, lead-free for potable water systems per NSF/ANSI 61" },
  "100219-44": { name: "Welding Rods Pack", desc: "E7018 low-hydrogen welding electrodes — 1/8\" diameter, 14\" length, all-position capable with smooth arc transfer, ideal for structural steel, pressure vessels, and heavy fabrication" },
  "100219-45": { name: "Aluminum Sheet Roll", desc: "6061-T6 aluminum alloy sheet — 0.125\" thickness, mill finish, excellent machinability and weldability for aerospace, marine, and precision manufacturing applications" },
  "100219-46": { name: "Stainless Steel Bolts", desc: "18-8 stainless steel hex cap screws — Grade A2-70, fully threaded, corrosion-resistant for outdoor, marine, and food-processing equipment assembly" },
  "100219-47": { name: "Hydraulic Hose Assembly", desc: "SAE 100R2AT twin-wire braided hydraulic hose — 3/8\" ID, 4800 PSI working pressure, with JIC 37° flare fittings, suitable for mobile equipment and industrial hydraulic systems" },
  "100219-48": { name: "Carbon Fiber Panel", desc: "3K twill-weave carbon fiber composite panel — 2mm thickness, high-gloss resin finish, exceptional stiffness-to-weight ratio for aerospace, motorsport, and precision instrument enclosures" },
  "100219-49": { name: "Titanium Bracket Set", desc: "Grade 5 (Ti-6Al-4V) precision CNC-machined mounting brackets — lightweight, high-strength, corrosion-proof, designed for aerospace structural and medical device applications" },
  "100219-50": { name: "Rubber Gasket Kit", desc: "Multi-material gasket assortment — Buna-N, Viton®, and EPDM compounds in standard flange sizes, temperature rated -40°F to +400°F for chemical processing and HVAC systems" },
  "100219-51": { name: "Precision Ball Bearings", desc: "ABEC-7 deep-groove ball bearings — 6204-2RS sealed, chrome steel races with synthetic grease fill, low-noise design for electric motors, pumps, and conveyor systems" },
  "100219-52": { name: "Electrical Wire Spool", desc: "THHN/THWN-2 stranded copper building wire — 12 AWG, 500 ft spool, dual-rated for wet and dry locations, UL listed for commercial and industrial electrical installations" },
  "100219-53": { name: "LED Circuit Board", desc: "High-density SMD LED driver PCB — 24V constant-current, aluminum-core substrate with thermal management, designed for commercial lighting fixtures and architectural illumination panels" },
};

const ITEM_CATEGORIES = ["Raw Material", "Component", "Assembly", "Consumable", "Finished Good"];
const ITEM_UOMS = ["EA", "FT", "PK", "RL", "KG", "LB", "BOX", "SET"];
const ITEM_STATUSES = ["In Stock", "Low Stock", "Out of Stock", "On Order"];

/** Product photos — deterministic per item code */
const ITEM_PHOTOS = [
  "https://images.unsplash.com/photo-1772209049802-cd0e0ff1a5d3?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1713575882582-8938739db351?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1737223450913-2af6885945e1?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1759159091728-e2c87b9d9315?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1661069387900-54d5843b704d?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1758873263527-ca53b938fbd4?w=600&h=400&fit=crop",
];
function getItemPhotos(code: string): string[] {
  const base = hashStr(code);
  const count = (base % 2) + 2; // 2 or 3 photos per item
  return Array.from({ length: count }, (_, i) => ITEM_PHOTOS[(base + i) % ITEM_PHOTOS.length]);
}
const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  "In Stock": { bg: "#F0FDF4", fg: "#166534", border: "#BBF7D0" },
  "Low Stock": { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A" },
  "Out of Stock": { bg: "#FEF2F2", fg: "#991B1B", border: "#FECACA" },
  "On Order": { bg: "#EFF6FF", fg: "#1E40AF", border: "#BFDBFE" },
};

const LOCATION_TYPES = ["Warehouse", "Office", "Manufacturing", "Distribution", "R&D Center"];
const DEPARTMENTS = ["Supply Chain", "Procurement", "Finance", "Engineering", "Sales", "Operations", "Quality", "Logistics"];
const CONTACT_ROLES = ["Account Manager", "Supply Chain Lead", "Procurement Analyst", "Sales Director", "Operations Manager", "Quality Engineer", "Logistics Coordinator", "Finance Controller"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string): T {
  return arr[hashStr(seed) % arr.length];
}

const GENERIC_DESCS = [
  "High-performance industrial component — precision-engineered from premium materials, designed for demanding operational environments with extended service life and low maintenance requirements",
  "Professional-grade supply item — manufactured to strict quality standards with full traceability, suitable for production lines, maintenance operations, and capital equipment assembly",
  "Certified industrial material — meets ASTM/ISO specifications, available in standard and custom sizes for fabrication, construction, and heavy manufacturing applications",
  "Multi-purpose operational consumable — tested for reliability across temperature and pressure ranges, compatible with industry-standard equipment and tooling systems",
  "Engineered precision part — tight-tolerance machining with quality-assured dimensional accuracy, designed for critical assemblies in automotive, aerospace, and energy sectors",
];

function mockItemData(code: string) {
  const entry = ITEM_DATA[code];
  const name = entry?.name || `Part ${code}`;
  const desc = entry?.desc || GENERIC_DESCS[hashStr(code) % GENERIC_DESCS.length];
  const category = pick(ITEM_CATEGORIES, code);
  const uom = pick(ITEM_UOMS, code + "u");
  const status = pick(ITEM_STATUSES, code + "s");
  const unitPrice = ((hashStr(code + "p") % 500) + 10) + 0.99;
  const stockQty = hashStr(code + "q") % 5000;
  const reorderPoint = Math.floor(stockQty * 0.2);
  const leadTime = (hashStr(code + "l") % 14) + 3;
  return { name, desc, category, uom, status, unitPrice, stockQty, reorderPoint, leadTime };
}

const LOCATION_CONTACT_NAMES = [
  "Issac Archer", "Maya Chen", "Diego Martinez", "Priya Sharma",
  "Noah Bennett", "Sofia Lin", "Ethan Walker", "Amara Okafor",
];

const COUNTRIES: { code: string; name: string; flag: string }[] = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "CN", name: "China", flag: "🇨🇳" },
];

const LOCATION_DESCRIPTIONS: Record<string, string[]> = {
  Warehouse: [
    "High-volume distribution hub handling inbound receipts, cross-docking, and last-mile staging for the region.",
    "Climate-controlled storage facility supporting just-in-time fulfillment for strategic customer accounts.",
    "Bulk inventory warehouse with multi-bay loading docks, RFID-tracked pallets, and ASN-integrated receiving.",
  ],
  Office: [
    "Regional office overseeing sales, procurement, and account management for the North American territory.",
    "Commercial office housing partner operations, business development, and executive leadership teams.",
    "Corporate office coordinating cross-functional programs, vendor onboarding, and compliance workflows.",
  ],
  Manufacturing: [
    "Tier-1 manufacturing plant producing precision components under ISO 9001 and IATF 16949 quality programs.",
    "Production facility running multi-shift assembly lines with integrated QA, weld cells, and automated paint.",
    "Advanced manufacturing site specializing in low-volume, high-mix fabrication for OEM supply contracts.",
  ],
  Distribution: [
    "Regional distribution center routing parts and finished goods across multi-state fulfillment lanes.",
    "Automated sortation hub with cross-dock operations, feeding carrier networks across the continent.",
    "Distribution facility managing consolidated shipments, reverse logistics, and partner drop-ship pools.",
  ],
  "R&D Center": [
    "Research and development center prototyping next-generation platforms, materials, and control systems.",
    "Innovation campus running applied research, design validation, and co-development with customer engineering teams.",
    "R&D facility equipped with environmental chambers, tensile labs, and a full rapid-prototyping shop.",
  ],
};

function mockLocationData(locationName: string) {
  const type = pick(LOCATION_TYPES, locationName);
  const descPool = LOCATION_DESCRIPTIONS[type] || LOCATION_DESCRIPTIONS.Office;
  const description = descPool[hashStr(locationName + "d") % descPool.length];
  const street = `${(hashStr(locationName + "n") % 999) + 1} ${pick(["Industrial Blvd", "Commerce Dr", "Technology Way", "Supply Chain Ave", "Factory Rd"], locationName)}`;
  const cities = ["Plano, TX", "Detroit, MI", "San Jose, CA", "Seattle, WA", "Austin, TX", "Chicago, IL", "Atlanta, GA", "Denver, CO"];
  const city = pick(cities, locationName + "c");
  const country = pick(COUNTRIES, locationName + "co");
  const phone = `+1 (${(hashStr(locationName + "p1") % 900) + 100}) ${(hashStr(locationName + "p2") % 900) + 100}-${(hashStr(locationName + "p3") % 9000) + 1000}`;
  const operatingHours = pick(["Mon–Fri, 8AM–5PM", "Mon–Sat, 7AM–6PM", "24/7 Operations", "Mon–Fri, 9AM–6PM"], locationName + "h");
  const contactCount = (hashStr(locationName + "cc") % 24) + 3;
  const itemCount = (hashStr(locationName + "it") % 280) + 15;
  const serviceCenters = (hashStr(locationName + "sc") % 12) + 1;
  const isActive = hashStr(locationName + "st") % 5 !== 0; // ~80% active
  const pcName = pick(LOCATION_CONTACT_NAMES, locationName + "pc");
  const primaryContact = {
    name: pcName,
    role: pick(CONTACT_ROLES, locationName + "pcr"),
    email: pcName.toLowerCase().replace(/\s+/g, ".") + "@company.com",
    phone: `+1 (${(hashStr(locationName + "pcp1") % 900) + 100}) ${(hashStr(locationName + "pcp2") % 900) + 100}-${(hashStr(locationName + "pcp3") % 9000) + 1000}`,
  };
  const creditUsedPct = (hashStr(locationName + "cr") % 85) + 5; // 5–89%
  const creditLimit = ((hashStr(locationName + "cl") % 45) + 5) * 1000; // $5k–$49k
  const creditAvailable = Math.max(0, Math.round(creditLimit * (1 - creditUsedPct / 100)));
  const creditStatus: "Warning" | "Moderate" | "Healthy" = creditUsedPct > 75 ? "Warning" : creditUsedPct > 50 ? "Moderate" : "Healthy";
  return { type, description, street, city, country, phone, operatingHours, contactCount, itemCount, serviceCenters, isActive, primaryContact, creditUsedPct, creditAvailable, creditStatus };
}

function mockContactData(name: string) {
  const role = pick(CONTACT_ROLES, name);
  const dept = pick(DEPARTMENTS, name + "d");
  const slug = name.toLowerCase().replace(/\s+/g, ".");
  const nameSlug = name.toLowerCase().replace(/\s+/g, "-");
  // Multiple emails — work always; personal for ~65% of contacts
  const workEmail = `${slug}@company.com`;
  const personalEmail = `${slug.replace(/\./g, "")}@gmail.com`;
  const emails: { id: string; type: "Work" | "Personal"; address: string }[] = [
    { id: "e1", type: "Work", address: workEmail },
  ];
  if (hashStr(name + "epe") % 3 !== 0) emails.push({ id: "e2", type: "Personal", address: personalEmail });
  // Multiple phones — office always; mobile for ~70% of contacts
  const fmtPhone = (s: string) => `+1 (${(hashStr(name + s + "1") % 900) + 100}) ${(hashStr(name + s + "2") % 900) + 100}-${(hashStr(name + s + "3") % 9000) + 1000}`;
  const phones: { id: string; type: "Office" | "Mobile"; number: string }[] = [
    { id: "p1", type: "Office", number: fmtPhone("p") },
  ];
  if (hashStr(name + "pmp") % 10 < 7) phones.push({ id: "p2", type: "Mobile", number: fmtPhone("m") });
  // Primary fields kept for backwards-compat / header chips
  const email = emails[0].address;
  const phone = phones[0].number;
  // Socials — matches details page types
  const socials: { id: string; type: "LinkedIn" | "Twitter / X" | "Website" | "Skype" | "WhatsApp"; url: string }[] = [
    { id: "s1", type: "LinkedIn", url: `https://www.linkedin.com/in/${nameSlug}` },
  ];
  if (hashStr(name + "stx") % 10 < 6) socials.push({ id: "s2", type: "Twitter / X", url: `https://x.com/${nameSlug}` });
  if (hashStr(name + "sw") % 10 < 4) socials.push({ id: "s3", type: "Website", url: `https://${nameSlug}.com` });
  // Stats shown in the 4-col row.
  // KPIs aligned with Eli's feedback on the partner-group lightbox:
  //   PO + SO volumes capture both trade directions, locations counts
  //   the partner's footprint. Interactions / Avg Response were dropped
  //   as they didn't carry decision-grade signal at this surface.
  const partnerCount = (hashStr(name + "pc") % 6) + 1;
  const purchaseOrderCount = (hashStr(name + "po") % 80) + 5;
  const salesOrderCount = (hashStr(name + "so") % 60) + 3;
  const locationCount = (hashStr(name + "lc") % 8) + 1;
  // Status and recent activity
  const isActive = hashStr(name + "ac") % 7 !== 0; // ~86% active
  const timezone = pick(["EST", "CST", "PST", "MST"], name + "tz");
  const lastInteraction = pick(["2 hours ago", "Today", "Yesterday", "3 days ago", "1 week ago", "2 weeks ago"], name + "li");
  const interactionChannel = pick(["Email", "Call", "Meeting", "Slack"], name + "ic");
  const linkedinSlug = nameSlug;
  const linkedinUrl = socials[0].url;
  return { role, dept, email, phone, emails, phones, socials, partnerCount, purchaseOrderCount, salesOrderCount, locationCount, isActive, timezone, lastInteraction, interactionChannel, linkedinUrl, linkedinSlug };
}

/** Deterministic soft palette for department pills */
const DEPT_PALETTES: Record<string, { bg: string; fg: string; border: string }> = {
  "Supply Chain": { bg: "#EEF2FF", fg: "#3730A3", border: "#C7D2FE" }, // indigo
  Procurement: { bg: "#F5F3FF", fg: "#5B21B6", border: "#DDD6FE" }, // violet
  Finance: { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0" }, // emerald
  Engineering: { bg: "#EFF6FF", fg: "#1E40AF", border: "#BFDBFE" }, // blue
  Sales: { bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" }, // amber
  Operations: { bg: "hsl(var(--muted))", fg: "#334155", border: "hsl(var(--border))" }, // slate
  Quality: { bg: "#FFF1F2", fg: "#9F1239", border: "#FECDD3" }, // rose
  Logistics: { bg: "#ECFEFF", fg: "#155E75", border: "#A5F3FC" }, // cyan
};
function deptPalette(dept: string) {
  return DEPT_PALETTES[dept] ?? { bg: "hsl(var(--muted))", fg: "#334155", border: "hsl(var(--border))" };
}

/* ─────────── Formatting ─────────── */

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/* ─────────── Sub-components ─────────── */

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-border/50 px-3 py-2.5" style={{ backgroundColor: `${color}08` }}>
      <div className="text-[11px] mb-0.5" style={{ color, fontWeight: 600 }}>{label}</div>
      <div className="text-[15px] text-foreground truncate" style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60" style={{ fontWeight: 500 }}>{label}</div>
        <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

/* ─────────── Item Quick View — large image carousel + detail card ─────────── */

function ItemQuickView({ code, vendorName, tableImageUrl }: { code: string; vendorName: string; tableImageUrl?: string }) {
  const d = mockItemData(code);
  const sc = STATUS_COLORS[d.status] || STATUS_COLORS["In Stock"];
  // Use the table's image as the first photo so images match; append others from the pool
  const poolPhotos = getItemPhotos(code);
  const photos = tableImageUrl
    ? [tableImageUrl.replace(/w=80&h=80/, "w=600&h=400"), ...poolPhotos.filter((p) => !tableImageUrl.includes(p.split("?")[0]))]
    : poolPhotos;
  const [photoIdx, setPhotoIdx] = useState(0);
  const { openLightbox } = usePersonLightbox();
  const currentPhoto = photos[photoIdx % photos.length];
  return (
    <>
      {/* Image carousel — responsive height: compact on small screens, generous on large */}
      <div className="relative overflow-hidden bg-[#0C1222] select-none shrink-0" style={{ height: "clamp(200px, 45vh, 420px)" }}>
        <img
          src={currentPhoto}
          alt={d.name}
          className="w-full h-full object-cover transition-opacity duration-200"
        />
        {/* Gradient overlays */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />

        {/* Status pill — top-left */}
        <span
          className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
          style={{ fontWeight: 600, backgroundColor: sc.bg + "E6", color: sc.fg, borderColor: sc.border }}
        >
          {d.status}
        </span>

        {/* Zoom button — top-right (offset from close) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openLightbox({ src: currentPhoto, name: d.name, subtitle: `${code} · ${vendorName}` }); }}
          className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Prev / Next carousel arrows */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setPhotoIdx((prev) => (prev - 1 + photos.length) % photos.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPhotoIdx((prev) => (prev + 1) % photos.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dot indicators + counter — bottom-right */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPhotoIdx(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${i === photoIdx ? "bg-white w-3" : "bg-white/40 hover:bg-white/60"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Data area: code + description + stat cards + vendor */}
      <div className="px-5 pt-4 pb-4">
        {/* Item code + category context pill */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[15px] font-mono text-foreground" style={{ fontWeight: 700 }}>{code}</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
            style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}
          >
            <Star className="w-3 h-3" />
            Primary: {d.category}
          </span>
        </div>

        {/* Long description */}
        <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed line-clamp-3" style={{ fontWeight: 400 }}>
          {d.desc}
        </p>

        {/* 4-column stat cards */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 700 }}>{vendorName.split(" ").slice(0, 2).join(" ")}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Partner</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatCurrency(d.unitPrice)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Unit Price</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.stockQty)}<span className="text-[11px] text-slate-500 ml-0.5">{d.uom}</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>In Stock</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{d.leadTime}<span className="text-[11px] text-slate-500 ml-0.5">days</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Lead Time</div>
          </div>
        </div>

        {/* Detail rows with icons */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2.5 py-0.5">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{d.category}</span>
            <span className="text-slate-300">·</span>
            <span className="text-[13px] text-slate-500">{d.uom}</span>
          </div>
          <div className="flex items-center gap-2.5 py-0.5">
            <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[13px] text-slate-700">On-Hand: <b>{formatNumber(d.stockQty)}</b></span>
            <span className="text-slate-300">·</span>
            <span className="text-[13px] text-slate-500">Reorder at {formatNumber(d.reorderPoint)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── Location Quick View ─────────── */

/** Deterministic location photos */
const LOCATION_PHOTOS = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1565008447742-97f6f38c985c?w=600&h=400&fit=crop",
  "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=400&fit=crop",
];
function getLocationPhoto(name: string): string {
  return LOCATION_PHOTOS[hashStr(name) % LOCATION_PHOTOS.length];
}

function LocationQuickView({ locationName, vendorName, subtitle, tableImageUrl, locationIdx }: { locationName: string; vendorName: string; subtitle?: string; tableImageUrl?: string; locationIdx?: number }) {
  // Display name matches the Partner Locations tab convention on the details page: "{Vendor} Location {100 + idx + 1}"
  const displayName = typeof locationIdx === "number" ? `${vendorName} Location ${100 + locationIdx + 1}` : locationName;
  // Use the raw locationName as the data seed so the modal data stays stable regardless of display name
  const d = mockLocationData(locationName);
  const { openLightbox } = usePersonLightbox();
  // Use the table's image if provided (upscale 80x80 → 600x400) so the modal matches the row thumbnail
  const photo = tableImageUrl ? tableImageUrl.replace(/w=80&h=80/, "w=600&h=400") : getLocationPhoto(locationName);
  const isCarrier = subtitle?.toLowerCase().includes("carrier");
  const primaryPhoto = getPersonPhotoUrl(d.primaryContact.name);

  const statusBg = d.isActive ? "#DCFCE7" : "#FEE2E2";
  const statusFg = d.isActive ? "#166534" : "#991B1B";
  const statusBorder = d.isActive ? "#BBF7D0" : "#FECACA";

  const creditPalette = {
    Warning: { bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A", bar: "hsl(var(--warning))" },
    Moderate: { bg: "#D1FAE5", fg: "#047857", border: "#A7F3D0", bar: "#10B981" },
    Healthy: { bg: "#DCFCE7", fg: "#166534", border: "#BBF7D0", bar: "#16A34A" },
  }[d.creditStatus];

  return (
    <>
      {/* Image area */}
      <div className="relative overflow-hidden bg-[#052E16] shrink-0" style={{ height: "clamp(160px, 32vh, 260px)" }}>
        <img src={photo} alt={displayName} className="w-full h-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Active / Inactive badge — top-left (no dot, per design convention) */}
        <span
          className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
          style={{ fontWeight: 600, backgroundColor: statusBg + "E6", color: statusFg, borderColor: statusBorder }}
        >
          {d.isActive ? "Active" : "Inactive"}
        </span>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openLightbox({ src: photo, name: displayName, subtitle: `${isCarrier ? subtitle : d.type} · ${vendorName}` }); }}
          className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Name + description overlay (facility type moved out — shown contextually elsewhere) */}
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-[16px] text-white truncate" style={{ fontWeight: 700 }}>{displayName}</p>
          <div className="text-[11.5px] text-white/80 mt-0.5 line-clamp-2" style={{ fontWeight: 400, lineHeight: 1.35 }}>
            {isCarrier ? subtitle : d.description}
          </div>
        </div>
      </div>

      {/* Data area */}
      <div className="px-5 pt-4 pb-4">
        {/* Address, phone */}
        <div className="space-y-1.5">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.street}, ${d.city}, ${d.country.name}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0"
              style={{ fontWeight: 500 }}
            >
              {d.street}, {d.city}
              <span className="text-slate-500"> • {d.country.flag} {d.country.name}</span>
            </a>
          </div>
          <div className="flex items-center gap-2.5">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <a
              href={`tel:${d.phone.replace(/[^\d+]/g, "")}`}
              className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors"
              style={{ fontWeight: 500 }}
            >{d.phone}</a>
          </div>
        </div>

        {/* 4-col stat row — Partner | Items | Contacts | Area (matches Items modal's trailing Partner cell) */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 700 }}>{vendorName.split(" ").slice(0, 2).join(" ")}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Partner</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.itemCount)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Items</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{d.contactCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Contacts</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{d.serviceCenters}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Service Centers</div>
          </div>
        </div>

        {/* Primary Contact + Credit — side by side */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {/* Primary Contact — larger avatar, email fills negative space, avatar opens lightbox */}
          <div className="rounded-xl border border-border px-3 py-2.5">
            <div className="text-[10.5px] text-muted-foreground/70 mb-1.5" style={{ fontWeight: 600 }}>Primary contact</div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openLightbox({ src: primaryPhoto, name: d.primaryContact.name, subtitle: `${d.primaryContact.role} · ${vendorName}` }); }}
                className="group relative w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0 border border-[#E8ECF1] cursor-pointer hover:border-slate-300 transition-colors"
                aria-label={`Expand photo of ${d.primaryContact.name}`}
              >
                <img src={primaryPhoto} alt={d.primaryContact.name} className="w-full h-full object-cover" />
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </button>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[12.5px] text-foreground truncate" style={{ fontWeight: 600 }}>{d.primaryContact.name}</div>
                <div className="text-[10.5px] text-slate-500 truncate mt-0.5" style={{ fontWeight: 500 }}>{d.primaryContact.role}</div>
              </div>
            </div>
            <a
              href={`mailto:${d.primaryContact.email}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-primary hover:underline transition-colors min-w-0"
              style={{ fontWeight: 500 }}
            >
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{d.primaryContact.email}</span>
            </a>
          </div>

          {/* Credit Status */}
          <div className="rounded-xl border border-border px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] text-muted-foreground/70" style={{ fontWeight: 600 }}>Credit</span>
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] border"
                style={{ fontWeight: 600, backgroundColor: creditPalette.bg, color: creditPalette.fg, borderColor: creditPalette.border }}
              >{d.creditStatus}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[14px] text-foreground" style={{ fontWeight: 700 }}>{d.creditUsedPct}%</span>
              <span className="text-[10.5px] text-slate-500" style={{ fontWeight: 500 }}>used</span>
            </div>
            {/* Tiny progress bar */}
            <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.creditUsedPct)}%`, backgroundColor: creditPalette.bar }} />
            </div>
            <div className="text-[10.5px] text-slate-500 mt-1" style={{ fontWeight: 500 }}>{formatCurrency(d.creditAvailable)} available</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────── Contact Quick View ─────────── */

/** Deterministic person photos for QuickView */
const PERSON_PHOTOS = [
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/75.jpg",
  "https://randomuser.me/api/portraits/women/65.jpg",
  "https://randomuser.me/api/portraits/men/46.jpg",
  "https://randomuser.me/api/portraits/women/28.jpg",
  "https://randomuser.me/api/portraits/men/85.jpg",
  "https://randomuser.me/api/portraits/women/91.jpg",
];
function getPersonPhotoUrl(name: string): string {
  return PERSON_PHOTOS[hashStr(name) % PERSON_PHOTOS.length];
}

function ContactQuickView({
  contactName,
  initials,
  avatarBg,
  avatarFg,
  imageUrl,
  roleOverride,
  deptOverride,
  emailOverride,
  phoneOverride,
  vendorName,
}: {
  contactName: string;
  initials?: string;
  avatarBg?: string;
  avatarFg?: string;
  /** Photo URL from the table row — when absent, the hero falls back to an initials tile to match the row. */
  imageUrl?: string;
  /** Optional canonical data from the table row, so the modal matches the row's hover card exactly. */
  roleOverride?: string;
  deptOverride?: string;
  emailOverride?: string;
  phoneOverride?: string;
  vendorName: string;
}) {
  const d = mockContactData(contactName);
  const { openLightbox } = usePersonLightbox();
  // Only use a photo when the row had one — otherwise we render an initials hero below.
  const photo = imageUrl;

  // Prefer the table-provided values so the modal matches what the row/hover-card shows.
  const role = roleOverride || d.role;
  const dept = deptOverride || d.dept;
  const dPalette = deptPalette(dept);

  // Keep "+N more" phones/emails from the mock data but swap the primary entry with the table's value.
  const phones = phoneOverride
    ? [{ id: "p1", type: "Office" as const, number: phoneOverride }, ...d.phones.slice(1)]
    : d.phones;
  const emails = emailOverride
    ? [{ id: "e1", type: "Work" as const, address: emailOverride }, ...d.emails.slice(1)]
    : d.emails;

  // Fallback initials derived from the name if the caller didn't pass any.
  const heroInitials = (initials || contactName.split(" ").map((p) => p[0] || "").join("").slice(0, 2) || "?").toUpperCase();
  const heroBg = avatarBg || "hsl(var(--border))";
  const heroFg = avatarFg || "hsl(var(--foreground))";

  const statusBg = d.isActive ? "#DCFCE7" : "#FEE2E2";
  const statusFg = d.isActive ? "#166534" : "#991B1B";
  const statusBorder = d.isActive ? "#BBF7D0" : "#FECACA";

  // Same social icon registry as the contact details page header
  const socialMeta: Record<string, { icon: typeof Linkedin; color: string; label: string }> = {
    "LinkedIn": { icon: Linkedin, color: "#0A66C2", label: "LinkedIn" },
    "Twitter / X": { icon: Twitter, color: "#000000", label: "X (Twitter)" },
    "Website": { icon: Globe, color: "hsl(var(--primary))", label: "Website" },
    "Skype": { icon: MessageCircle, color: "#00AFF0", label: "Skype" },
    "WhatsApp": { icon: MessageCircle, color: "#25D366", label: "WhatsApp" },
  };

  return (
    <>
      {/* Image area — photo when available, otherwise an initials tile over a gradient derived from avatarBg. */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{
          height: "clamp(200px, 45vh, 420px)",
          background: photo ? "#1E1B4B" : `linear-gradient(135deg, ${heroBg} 0%, ${heroBg} 55%, #1E293B 100%)`,
        }}
      >
        {photo ? (
          <img src={photo} alt={contactName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center text-[40px] shadow-[0_6px_24px_rgba(0,0,0,0.25)] border-2 border-white/30"
              style={{ backgroundColor: heroBg, color: heroFg, fontWeight: 700, letterSpacing: 1 }}
            >
              {heroInitials}
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Active / Inactive badge — top-left (matches Location convention) */}
        <span
          className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
          style={{ fontWeight: 600, backgroundColor: statusBg + "E6", color: statusFg, borderColor: statusBorder }}
        >
          {d.isActive ? "Active" : "Inactive"}
        </span>

        {/* Zoom — only meaningful when we actually have a photo */}
        {photo && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openLightbox({ src: photo, name: contactName, subtitle: `${role} · ${vendorName}` }); }}
            className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}

        {/* Name + role overlay */}
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-[16px] text-white truncate" style={{ fontWeight: 700 }}>{contactName}</p>
          <div className="text-[11.5px] text-white/80 mt-0.5 truncate" style={{ fontWeight: 500 }}>{role}</div>
        </div>
      </div>

      {/* Data area */}
      <div className="px-5 pt-4 pb-4">
        {/* Context: vendor + department pill */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
            <Building2 className="w-3 h-3" />{vendorName}
          </span>
          <span className="text-slate-300">•</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
            style={{ fontWeight: 600, backgroundColor: dPalette.bg, color: dPalette.fg, borderColor: dPalette.border }}
          >
            <Briefcase className="w-3 h-3" />
            {dept}
          </span>
        </div>

        {/* 4-col stat row — matches Items/Location modals. Per Eli's
            feedback the KPIs surface both trade directions (PO + SO)
            plus the partner's location footprint; Interactions and Avg
            Response weren't carrying decision-grade signal here. */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 700 }}>{vendorName.split(" ").slice(0, 2).join(" ")}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Partner</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.purchaseOrderCount)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Purchase Orders</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.salesOrderCount)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Sales Orders</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.locationCount)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Locations</div>
          </div>
        </div>

        {/* Contact rows — phone + email with "+N more" tooltips (matches details page) */}
        <div className="mt-3 space-y-1">
          {/* Phone */}
          <div className="flex items-center gap-2.5 py-1">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <a
              href={`tel:${phones[0].number.replace(/[^\d+]/g, "")}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0 truncate"
              style={{ fontWeight: 500 }}
            >
              {phones[0].number}
            </a>
            {phones.length > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="text-[11px] shrink-0 cursor-default leading-none ml-0.5"
                    style={{ fontWeight: 600, color: "#085FCC" }}
                  >
                    +{phones.length - 1} more
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="z-[300] max-w-[300px]">
                  <div className="space-y-1.5">
                    {phones.slice(1).map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{p.type}</span>
                        <span className="text-[11px] text-slate-700">{p.number}</span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Email */}
          <div className="flex items-center gap-2.5 py-1">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <a
              href={`mailto:${emails[0].address}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] text-foreground hover:text-primary hover:underline transition-colors min-w-0 truncate"
              style={{ fontWeight: 500 }}
            >
              {emails[0].address}
            </a>
            {emails.length > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="text-[11px] shrink-0 cursor-default leading-none ml-0.5"
                    style={{ fontWeight: 600, color: "#085FCC" }}
                  >
                    +{emails.length - 1} more
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="z-[300] max-w-[300px]">
                  <div className="space-y-1.5">
                    {emails.slice(1).map((e) => (
                      <div key={e.id} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>{e.type}</span>
                        <span className="text-[11px] text-slate-700">{e.address}</span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Socials — same icon set + hover treatment as details page */}
          {d.socials.length > 0 && (
            <div className="flex items-center gap-2.5 pt-1.5">
              <span className="text-[11px] text-muted-foreground/70 shrink-0" style={{ fontWeight: 600 }}>Connect</span>
              <div className="flex items-center gap-1">
                {d.socials.map((s) => {
                  const meta = socialMeta[s.type];
                  if (!meta) return null;
                  const SIcon = meta.icon;
                  return (
                    <Tooltip key={s.id}>
                      <TooltipTrigger asChild>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="group/social relative w-6 h-6 rounded flex items-center justify-center transition-all duration-150 hover:bg-muted"
                        >
                          <SIcon className="w-3.5 h-3.5 text-slate-400 group-hover/social:opacity-0 transition-opacity duration-150" />
                          <SIcon className="w-3.5 h-3.5 absolute opacity-0 group-hover/social:opacity-100 transition-opacity duration-150" style={{ color: meta.color }} />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="z-[300]"><span className="text-[11px]">{meta.label}</span></TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────── Main Panel ─────────── */

/* ─────────── Carrier Quick View ─────────── */

const CARRIER_LOGOS: Record<string, string> = {
  FedEx: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/FedEx_Corporation_-_2016_Logo.svg/200px-FedEx_Corporation_-_2016_Logo.svg.png",
  DHL: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/DHL_Logo.svg/200px-DHL_Logo.svg.png",
  UPS: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/United_Parcel_Service_logo_2014.svg/200px-United_Parcel_Service_logo_2014.svg.png",
};

function CarrierQuickView({ carrierName, carrierRole, vendorName }: { carrierName: string; carrierRole: string; vendorName: string }) {
  const h = hashStr(carrierName);
  const SERVICES = ["Ground & Express", "Freight", "Ground", "Express & Priority", "Standard & Freight", "Air & Sea"];
  const SERVICE_TAGS = [["Air", "Ground", "Freight"], ["Sea", "Express"], ["Ground", "Freight"], ["Air", "Express"], ["Ground"], ["Sea", "Freight"]];
  const REGIONS = ["North America, Europe", "Global", "Asia Pacific", "Americas", "North America"];
  const DESCRIPTIONS = [
    "Premium express shipping for time-critical deliveries with real-time tracking and guaranteed delivery windows.",
    "Reliable ground freight and LTL services with extensive regional and cross-border coverage.",
    "Global logistics and international shipping solutions with customs brokerage and warehousing.",
    "Regional courier with strong domestic network coverage and competitive pricing for SMBs.",
    "World-leading ocean container shipping and intermodal logistics services.",
    "Regional ground delivery and last-mile fulfillment services with flexible scheduling.",
  ];

  const price = ((h % 40) + 5).toFixed(2);
  const deliveryDays = `${(h % 5) + 1}–${(h % 5) + 5} days`;
  const shipments = ((h % 1200) + 100);
  const methodCount = ((h % 6) + 1);
  const service = SERVICES[h % SERVICES.length];
  const tags = SERVICE_TAGS[h % SERVICE_TAGS.length];
  const region = REGIONS[h % REGIONS.length];
  const desc = DESCRIPTIONS[h % DESCRIPTIONS.length];
  const methods = (h % 3) + 1;
  const isActive = h % 5 !== 0;

  // Try to find a carrier logo
  let logoUrl: string | undefined;
  for (const key of Object.keys(CARRIER_LOGOS)) {
    if (carrierName.includes(key)) { logoUrl = CARRIER_LOGOS[key]; break; }
  }

  const initials = carrierName.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      {/* Hero header with gradient */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{ height: "clamp(120px, 22vh, 200px)", background: "linear-gradient(135deg, #1E293B 0%, #334155 50%, #0F172A 100%)" }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {logoUrl ? (
            <div className="w-24 h-24 rounded-2xl bg-white/95 flex items-center justify-center shadow-lg p-4">
              <img src={logoUrl} alt={carrierName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center text-[32px] text-white/80 shadow-lg border border-white/10" style={{ fontWeight: 700, letterSpacing: 1 }}>
              {initials}
            </div>
          )}
        </div>
        {/* Status pill */}
        <span
          className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
          style={{ fontWeight: 600, backgroundColor: isActive ? "#DCFCE7E6" : "#FEE2E2E6", color: isActive ? "#166534" : "#991B1B", borderColor: isActive ? "#BBF7D0" : "#FECACA" }}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
        {/* Name overlay */}
        <div className="absolute bottom-3 left-4 right-4 text-center">
          <p className="text-[16px] text-white" style={{ fontWeight: 700 }}>{carrierName}</p>
          <p className="text-[11.5px] text-white/70 mt-0.5" style={{ fontWeight: 500 }}>{carrierRole}</p>
        </div>
      </div>

      {/* Data area */}
      <div className="px-5 pt-4 pb-4">
        {/* Description */}
        <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2" style={{ fontWeight: 400 }}>{desc}</p>

        {/* Service tags */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border" style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}>{tag}</span>
          ))}
        </div>

        {/* 4-column stat cards */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>${price}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>/shipment</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{deliveryDays}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Delivery</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(shipments)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Shipments</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{methodCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Methods</div>
          </div>
        </div>

        {/* Detail rows with icons */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2.5 py-0.5">
            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{service}</span>
            <span className="text-slate-300">·</span>
            <span className="text-[13px] text-slate-500">{methods} method{methods > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2.5 py-0.5">
            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[13px] text-slate-700">{region}</span>
          </div>
          <div className="flex items-center gap-2.5 py-0.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[13px] text-slate-700">{vendorName}</span>
          </div>
          <div className="flex items-center gap-2.5 py-0.5">
            <TrendingUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[13px] text-slate-700">Tracking</span>
            <span className="text-[13px] text-success" style={{ fontWeight: 500 }}>Available</span>
          </div>
        </div>
      </div>
    </>
  );
}

export function QuickViewPanel({ data, onClose }: QuickViewPanelProps) {
  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!data) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [data, handleKeyDown]);

  if (!data) return null;

  const { type, item, vendorName, vendorId, locationIdx, navUrlOverride, navLabelOverride } = data;

  const defaultNavLabel = type === "item"
    ? "Go to Item"
    : type === "location"
    ? "View Partner Location Details"
    : type === "carrier"
    ? "Go to Carrier Management"
    : "Go to Contact";
  const defaultNavUrl = type === "item"
    ? "https://lovable.dev/projects/e2a76e6d-aa32-48d4-afb2-14909ce77ec2"
    : type === "location"
    ? `/vendors/${vendorId ?? encodeURIComponent(vendorName)}?tab=partner_locations${typeof locationIdx === "number" ? `&loc=${locationIdx}` : ""}`
    : type === "carrier"
    ? "/partners/carriers"
    : `/partners/contacts/${encodeURIComponent(item.id)}`;

  const navLabel = navLabelOverride ?? defaultNavLabel;
  const navUrl = navUrlOverride ?? defaultNavUrl;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 animate-modal-overlay"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-[210] top-1/2 left-1/2 w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col"
        style={{
          transform: "translate(-50%, -50%)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)",
          animation: "quickViewIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Close button — pinned top-right, above everything. White pill for visibility over both dark images and light content. */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-border"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {type === "item" && <ItemQuickView code={item.name} vendorName={vendorName} tableImageUrl={item.imageUrl} />}
          {type === "location" && <LocationQuickView locationName={item.name} vendorName={vendorName} subtitle={item.subtitle} tableImageUrl={item.imageUrl} locationIdx={locationIdx} />}
          {type === "carrier" && <CarrierQuickView carrierName={item.name} carrierRole={item.subtitle || "Carrier"} vendorName={vendorName} />}
          {type === "contact" && (
            <ContactQuickView
              contactName={item.name}
              initials={item.initials}
              avatarBg={item.avatarBg}
              avatarFg={item.avatarFg}
              imageUrl={item.imageUrl}
              roleOverride={item.meta?.role as string | undefined}
              deptOverride={item.meta?.dept as string | undefined}
              emailOverride={item.meta?.email as string | undefined}
              phoneOverride={item.meta?.phone as string | undefined}
              vendorName={vendorName}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/30">
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => { window.open(navUrl, "_blank", "noopener"); onClose(); }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: "hsl(var(--primary))" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "hsl(var(--primary))")}
          >
            {navLabel}
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}