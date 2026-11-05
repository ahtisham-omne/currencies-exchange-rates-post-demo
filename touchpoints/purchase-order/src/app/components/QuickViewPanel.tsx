import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mail,
  Phone,
  Building2,
  Globe,
  ExternalLink,
  Warehouse,
  Layers,
  TrendingUp,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Star,
  Linkedin,
  Twitter,
  MessageCircle,
} from "lucide-react";
import { usePersonLightbox } from "./PersonAvatarLightbox";
import ItemStatusChip from "./ItemStatusChip";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../components/ui/tooltip";

/* ─────────── Types ─────────── */

export type QuickViewType = "item" | "contact";

export interface QuickViewItem {
  id: string;
  name: string;
  subtitle?: string;
  initials?: string;
  avatarBg?: string;
  avatarFg?: string;
  imageUrl?: string;
  meta?: Record<string, unknown>;
  /** Item-master lifecycle for `type: "item"`. Set when the item was
   *  marked inactive; absent = Active. Drives the Active / Inactive
   *  badge next to the item code. */
  inactive?: { by: string; role: string; at: string };
}

export interface QuickViewData {
  type: QuickViewType;
  item: QuickViewItem;
  /** Vendor display name for context */
  vendorName: string;
}

interface QuickViewPanelProps {
  data: QuickViewData | null;
  onClose: () => void;
}

/* ─────────── Mock data generators (ported verbatim from Partners) ─────────── */

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
  const count = (base % 2) + 2;
  return Array.from({ length: count }, (_, i) => ITEM_PHOTOS[(base + i) % ITEM_PHOTOS.length]);
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  "In Stock":     { bg: "#F0FDF4", fg: "#166534", border: "#BBF7D0" },
  "Low Stock":    { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A" },
  "Out of Stock": { bg: "#FEF2F2", fg: "#991B1B", border: "#FECACA" },
  "On Order":     { bg: "#EFF6FF", fg: "#1E40AF", border: "#BFDBFE" },
};

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

function mockContactData(name: string) {
  const role = pick(CONTACT_ROLES, name);
  const dept = pick(DEPARTMENTS, name + "d");
  const slug = name.toLowerCase().replace(/\s+/g, ".");
  const nameSlug = name.toLowerCase().replace(/\s+/g, "-");
  const workEmail = `${slug}@company.com`;
  const personalEmail = `${slug.replace(/\./g, "")}@gmail.com`;
  const emails: { id: string; type: "Work" | "Personal"; address: string }[] = [
    { id: "e1", type: "Work", address: workEmail },
  ];
  if (hashStr(name + "epe") % 3 !== 0) emails.push({ id: "e2", type: "Personal", address: personalEmail });
  const fmtPhone = (s: string) => `+1 (${(hashStr(name + s + "1") % 900) + 100}) ${(hashStr(name + s + "2") % 900) + 100}-${(hashStr(name + s + "3") % 9000) + 1000}`;
  const phones: { id: string; type: "Office" | "Mobile"; number: string }[] = [
    { id: "p1", type: "Office", number: fmtPhone("p") },
  ];
  if (hashStr(name + "pmp") % 10 < 7) phones.push({ id: "p2", type: "Mobile", number: fmtPhone("m") });
  const socials: { id: string; type: "LinkedIn" | "Twitter / X" | "Website" | "Skype" | "WhatsApp"; url: string }[] = [
    { id: "s1", type: "LinkedIn", url: `https://www.linkedin.com/in/${nameSlug}` },
  ];
  if (hashStr(name + "stx") % 10 < 6) socials.push({ id: "s2", type: "Twitter / X", url: `https://x.com/${nameSlug}` });
  if (hashStr(name + "sw") % 10 < 4) socials.push({ id: "s3", type: "Website", url: `https://${nameSlug}.com` });
  const orderCount = (hashStr(name + "oc") % 80) + 5;
  const interactions = (hashStr(name + "ic2") % 240) + 20;
  const avgResponseHrs = ((hashStr(name + "ar") % 90) + 5) / 10;
  const isActive = hashStr(name + "ac") % 7 !== 0;
  return { role, dept, emails, phones, socials, orderCount, interactions, avgResponseHrs, isActive };
}

const DEPT_PALETTES: Record<string, { bg: string; fg: string; border: string }> = {
  "Supply Chain": { bg: "#EEF2FF", fg: "#3730A3", border: "#C7D2FE" },
  Procurement: { bg: "#F5F3FF", fg: "#5B21B6", border: "#DDD6FE" },
  Finance: { bg: "#ECFDF5", fg: "#065F46", border: "#A7F3D0" },
  Engineering: { bg: "#EFF6FF", fg: "#1E40AF", border: "#BFDBFE" },
  Sales: { bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" },
  Operations: { bg: "hsl(var(--muted))", fg: "#334155", border: "hsl(var(--border))" },
  Quality: { bg: "#FFF1F2", fg: "#9F1239", border: "#FECDD3" },
  Logistics: { bg: "#ECFEFF", fg: "#155E75", border: "#A5F3FC" },
};
function deptPalette(dept: string) {
  return DEPT_PALETTES[dept] ?? { bg: "hsl(var(--muted))", fg: "#334155", border: "hsl(var(--border))" };
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/* ─────────── Item Quick View ─────────── */

function ItemQuickView({ code, vendorName, tableImageUrl, inactive }: { code: string; vendorName: string; tableImageUrl?: string; inactive?: QuickViewItem["inactive"] }) {
  const d = mockItemData(code);
  const sc = STATUS_COLORS[d.status] || STATUS_COLORS["In Stock"];
  const poolPhotos = getItemPhotos(code);
  const photos = tableImageUrl
    ? [tableImageUrl.replace(/w=80&h=80/, "w=600&h=400"), ...poolPhotos.filter((p) => !tableImageUrl.includes(p.split("?")[0]))]
    : poolPhotos;
  const [photoIdx, setPhotoIdx] = useState(0);
  const { openLightbox } = usePersonLightbox();
  const currentPhoto = photos[photoIdx % photos.length];
  return (
    <>
      <div className="relative overflow-hidden bg-[#0C1222] select-none shrink-0" style={{ height: "clamp(200px, 45vh, 420px)" }}>
        <img
          src={currentPhoto}
          alt={d.name}
          className="w-full h-full object-cover transition-opacity duration-200"
        />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />

        <span
          className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
          style={{ fontWeight: 600, backgroundColor: sc.bg + "E6", color: sc.fg, borderColor: sc.border }}
        >
          {d.status}
        </span>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openLightbox({ src: currentPhoto, name: d.name, subtitle: `${code} · ${vendorName}` }); }}
          className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

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

        {photos.length > 1 && (
          <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPhotoIdx(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${i === photoIdx ? "bg-white w-3" : "bg-white/40 w-1.5 hover:bg-white/60"}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pt-4 pb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[15px] font-mono text-foreground" style={{ fontWeight: 700 }}>{code}</span>
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border"
            style={{ fontWeight: 500, backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }}
          >
            <Star className="w-3 h-3" />
            Primary: {d.category}
          </span>
          {/* Record status (Active / Inactive) — Partners item QuickView chip
              verbatim (`RECORD_STATUS_COLORS`, no icon), placed after the
              Primary pill. Inactive keeps a hover explaining who/when. */}
          <ItemStatusChip inactive={inactive} size="md" tooltipZIndex={10000} />
        </div>

        <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed line-clamp-3" style={{ fontWeight: 400 }}>
          {d.desc}
        </p>

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

/* ─────────── Contact Quick View (ported from Partners) ─────────── */

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
  imageUrl?: string;
  roleOverride?: string;
  deptOverride?: string;
  emailOverride?: string;
  phoneOverride?: string;
  vendorName: string;
}) {
  const d = mockContactData(contactName);
  const { openLightbox } = usePersonLightbox();
  const photo = imageUrl;

  const role = roleOverride || d.role;
  const dept = deptOverride || d.dept;
  const dPalette = deptPalette(dept);

  const phones = phoneOverride
    ? [{ id: "p1", type: "Office" as const, number: phoneOverride }, ...d.phones.slice(1)]
    : d.phones;
  const emails = emailOverride
    ? [{ id: "e1", type: "Work" as const, address: emailOverride }, ...d.emails.slice(1)]
    : d.emails;

  const heroInitials = (initials || contactName.split(" ").map((p) => p[0] || "").join("").slice(0, 2) || "?").toUpperCase();
  const heroBg = avatarBg || "hsl(var(--border))";
  const heroFg = avatarFg || "hsl(var(--foreground))";

  const statusBg = d.isActive ? "#DCFCE7" : "#FEE2E2";
  const statusFg = d.isActive ? "#166534" : "#991B1B";
  const statusBorder = d.isActive ? "#BBF7D0" : "#FECACA";

  const socialMeta: Record<string, { icon: typeof Linkedin; color: string; label: string }> = {
    "LinkedIn": { icon: Linkedin, color: "#0A66C2", label: "LinkedIn" },
    "Twitter / X": { icon: Twitter, color: "#000000", label: "X (Twitter)" },
    "Website": { icon: Globe, color: "hsl(var(--primary))", label: "Website" },
    "Skype": { icon: MessageCircle, color: "#00AFF0", label: "Skype" },
    "WhatsApp": { icon: MessageCircle, color: "#25D366", label: "WhatsApp" },
  };

  return (
    <>
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

        <span
          className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-sm"
          style={{ fontWeight: 600, backgroundColor: statusBg + "E6", color: statusFg, borderColor: statusBorder }}
        >
          {d.isActive ? "Active" : "Inactive"}
        </span>

        {photo && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openLightbox({ src: photo, name: contactName, subtitle: `${role} · ${vendorName}` }); }}
            className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        )}

        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-[16px] text-white truncate" style={{ fontWeight: 700 }}>{contactName}</p>
          <div className="text-[11.5px] text-white/80 mt-0.5 truncate" style={{ fontWeight: 500 }}>{role}</div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-4">
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

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-border rounded-xl border border-border overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[13px] text-foreground truncate" style={{ fontWeight: 700 }}>{vendorName.split(" ").slice(0, 2).join(" ")}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Partner</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.orderCount)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Orders</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{formatNumber(d.interactions)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Interactions</div>
          </div>
          <div className="px-2.5 py-2.5 text-center">
            <div className="text-[15px] text-foreground" style={{ fontWeight: 700 }}>{d.avgResponseHrs.toFixed(1)}<span className="text-[11px] text-slate-500 ml-0.5">hrs</span></div>
            <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Avg Response</div>
          </div>
        </div>

        <div className="mt-3 space-y-1">
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

export function QuickViewPanel({ data, onClose }: QuickViewPanelProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!data) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [data, handleKeyDown]);

  if (!data) return null;

  const { type, item, vendorName } = data;

  const navLabel = type === "item" ? "Go to Item" : "Go to Contact";

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/50 animate-modal-overlay"
        onClick={onClose}
      />

      <div
        className="fixed z-[210] top-1/2 left-1/2 w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col"
        style={{
          transform: "translate(-50%, -50%)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)",
          animation: "quickViewIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-border"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {type === "item" && <ItemQuickView code={item.name} vendorName={vendorName} tableImageUrl={item.imageUrl} inactive={item.inactive} />}
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
            onClick={onClose}
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

      <style>{`
        @keyframes quickViewIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>,
    document.body
  );
}

export default QuickViewPanel;
