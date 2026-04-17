import { useEffect, useCallback } from "react";
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
} from "lucide-react";
import type { OverflowItem } from "./OverflowTooltip";

/* ─────────── Types ─────────── */

export type QuickViewType = "item" | "location" | "contact";

export interface QuickViewData {
  type: QuickViewType;
  item: OverflowItem;
  /** Vendor display name for context */
  vendorName: string;
}

interface QuickViewPanelProps {
  data: QuickViewData | null;
  onClose: () => void;
}

/* ─────────── Mock data generators ─────────── */

const ITEM_NAMES: Record<string, string> = {
  "100219-42": "Industrial Steel Pipes",
  "100219-43": "Copper Fittings Kit",
  "100219-44": "Welding Rods Pack",
  "100219-45": "Aluminum Sheet Roll",
  "100219-46": "Stainless Steel Bolts",
  "100219-47": "Hydraulic Hose Assembly",
  "100219-48": "Carbon Fiber Panel",
  "100219-49": "Titanium Bracket Set",
  "100219-50": "Rubber Gasket Kit",
  "100219-51": "Precision Ball Bearings",
  "100219-52": "Electrical Wire Spool",
  "100219-53": "LED Circuit Board",
};

const ITEM_CATEGORIES = ["Raw Material", "Component", "Assembly", "Consumable", "Finished Good"];
const ITEM_UOMS = ["EA", "FT", "PK", "RL", "KG", "LB", "BOX", "SET"];
const ITEM_STATUSES = ["In Stock", "Low Stock", "Out of Stock", "On Order"];
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

function mockItemData(code: string) {
  const name = ITEM_NAMES[code] || `Part ${code}`;
  const category = pick(ITEM_CATEGORIES, code);
  const uom = pick(ITEM_UOMS, code + "u");
  const status = pick(ITEM_STATUSES, code + "s");
  const unitPrice = ((hashStr(code + "p") % 500) + 10) + 0.99;
  const stockQty = hashStr(code + "q") % 5000;
  const reorderPoint = Math.floor(stockQty * 0.2);
  const leadTime = (hashStr(code + "l") % 14) + 3;
  return { name, category, uom, status, unitPrice, stockQty, reorderPoint, leadTime };
}

function mockLocationData(locationName: string) {
  const type = pick(LOCATION_TYPES, locationName);
  const street = `${(hashStr(locationName + "n") % 999) + 1} ${pick(["Industrial Blvd", "Commerce Dr", "Technology Way", "Supply Chain Ave", "Factory Rd"], locationName)}`;
  const cities = ["Plano, TX", "Detroit, MI", "San Jose, CA", "Seattle, WA", "Austin, TX", "Chicago, IL", "Atlanta, GA", "Denver, CO"];
  const city = pick(cities, locationName + "c");
  const operatingHours = pick(["Mon–Fri, 8AM–5PM", "Mon–Sat, 7AM–6PM", "24/7 Operations", "Mon–Fri, 9AM–6PM"], locationName + "h");
  const contactCount = (hashStr(locationName + "cc") % 8) + 1;
  const sqft = ((hashStr(locationName + "sf") % 200) + 10) * 1000;
  return { type, street, city, operatingHours, contactCount, sqft };
}

function mockContactData(name: string) {
  const role = pick(CONTACT_ROLES, name);
  const dept = pick(DEPARTMENTS, name + "d");
  const email = name.toLowerCase().replace(/\s+/g, ".") + "@company.com";
  const phone = `+1 (${(hashStr(name + "p1") % 900) + 100}) ${(hashStr(name + "p2") % 900) + 100}-${(hashStr(name + "p3") % 9000) + 1000}`;
  const timezone = pick(["EST", "CST", "PST", "MST"], name + "tz");
  const lastActive = pick(["2 hours ago", "Today", "Yesterday", "3 days ago", "1 week ago"], name + "la");
  return { role, dept, email, phone, timezone, lastActive };
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
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color, fontWeight: 600 }}>{label}</div>
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

/* ─────────── Item Quick View ─────────── */

function ItemQuickView({ code, vendorName }: { code: string; vendorName: string }) {
  const d = mockItemData(code);
  const sc = STATUS_COLORS[d.status] || STATUS_COLORS["In Stock"];
  return (
    <>
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: "linear-gradient(135deg, #0C1222 0%, #162033 100%)" }}>
        <div className="flex items-center gap-3 pr-10">
          <div className="w-10 h-10 rounded-lg bg-[#1E3A5F] flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-[#7AB5FF]" />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] text-white truncate" style={{ fontWeight: 600 }}>{d.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[12px] text-white/50" style={{ fontWeight: 500 }}>{code}</span>
              <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] border" style={{ fontWeight: 600, backgroundColor: sc.bg, color: sc.fg, borderColor: sc.border }}>{d.status}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-white/40">
          <Building2 className="w-3 h-3" />
          <span>{vendorName}</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-5 pt-4 pb-3 flex gap-2">
        <KpiCard label="Unit Price" value={formatCurrency(d.unitPrice)} color="#0A77FF" />
        <KpiCard label="In Stock" value={`${formatNumber(d.stockQty)} ${d.uom}`} color="#16A34A" />
        <KpiCard label="Lead Time" value={`${d.leadTime} days`} color="#7C3AED" />
      </div>

      {/* Details */}
      <div className="px-5 pb-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1" style={{ fontWeight: 600 }}>Details</div>
        <div className="divide-y divide-border/30">
          <InfoRow icon={Tag} label="Category" value={d.category} />
          <InfoRow icon={Layers} label="Unit of Measure" value={d.uom} />
          <InfoRow icon={TrendingUp} label="Reorder Point" value={`${formatNumber(d.reorderPoint)} ${d.uom}`} />
          <InfoRow icon={Hash} label="Item Code" value={code} />
        </div>
      </div>
    </>
  );
}

/* ─────────── Location Quick View ─────────── */

function LocationQuickView({ locationName, vendorName }: { locationName: string; vendorName: string }) {
  const d = mockLocationData(locationName);
  return (
    <>
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: "linear-gradient(135deg, #0C1222 0%, #162033 100%)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1A3D2E] flex items-center justify-center">
            <MapPin className="w-5 h-5 text-[#4ADE80]" />
          </div>
          <div>
            <div className="text-[15px] text-white" style={{ fontWeight: 600 }}>{locationName}</div>
            <div className="text-[12px] text-white/50" style={{ fontWeight: 500 }}>{d.type}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-white/40">
          <Building2 className="w-3 h-3" />
          <span>{vendorName}</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-5 pt-4 pb-3 flex gap-2">
        <KpiCard label="Type" value={d.type} color="#16A34A" />
        <KpiCard label="Staff" value={`${d.contactCount} contacts`} color="#0A77FF" />
        <KpiCard label="Area" value={`${formatNumber(d.sqft)} sqft`} color="#7C3AED" />
      </div>

      {/* Details */}
      <div className="px-5 pb-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1" style={{ fontWeight: 600 }}>Details</div>
        <div className="divide-y divide-border/30">
          <div className="flex items-start gap-2.5 py-2">
            <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60" style={{ fontWeight: 500 }}>Address</div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.street}, ${d.city}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-foreground hover:text-[#0A77FF] hover:underline transition-colors block"
                style={{ fontWeight: 500 }}
              >{d.street}, {d.city}</a>
            </div>
          </div>
          <InfoRow icon={Warehouse} label="Facility Type" value={d.type} />
          <InfoRow icon={Clock} label="Operating Hours" value={d.operatingHours} />
          <InfoRow icon={User} label="On-Site Contacts" value={`${d.contactCount} people`} />
        </div>
      </div>
    </>
  );
}

/* ─────────── Contact Quick View ─────────── */

function ContactQuickView({ contactName, initials, avatarBg, avatarFg, vendorName }: { contactName: string; initials?: string; avatarBg?: string; avatarFg?: string; vendorName: string }) {
  const d = mockContactData(contactName);
  const ini = initials || contactName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <>
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: "linear-gradient(135deg, #0C1222 0%, #162033 100%)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center text-[13px]"
            style={{ backgroundColor: avatarBg || "#F5F3FF", color: avatarFg || "#7C3AED", fontWeight: 700 }}
          >
            {ini}
          </div>
          <div>
            <div className="text-[15px] text-white" style={{ fontWeight: 600 }}>{contactName}</div>
            <div className="text-[12px] text-white/50" style={{ fontWeight: 500 }}>{d.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2.5 text-[11px] text-white/40">
          <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{vendorName}</span>
          <span>•</span>
          <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{d.dept}</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-5 pt-4 pb-3 flex gap-2">
        <KpiCard label="Department" value={d.dept} color="#7C3AED" />
        <KpiCard label="Timezone" value={d.timezone} color="#0A77FF" />
        <KpiCard label="Last Active" value={d.lastActive} color="#16A34A" />
      </div>

      {/* Details */}
      <div className="px-5 pb-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-1" style={{ fontWeight: 600 }}>Contact Info</div>
        <div className="divide-y divide-border/30">
          <InfoRow icon={Mail} label="Email" value={d.email} />
          <InfoRow icon={Phone} label="Phone" value={d.phone} />
          <InfoRow icon={Briefcase} label="Role" value={d.role} />
          <InfoRow icon={Globe} label="Timezone" value={d.timezone} />
        </div>
      </div>
    </>
  );
}

/* ─────────── Main Panel ─────────── */

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

  const { type, item, vendorName } = data;

  const navLabel = type === "item" ? "Go to Item" : type === "location" ? "Go to Location" : "Go to Contact";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 animate-modal-overlay"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed z-[210] top-1/2 left-1/2 w-[420px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)] bg-card rounded-2xl border border-border/50 overflow-hidden flex flex-col"
        style={{
          transform: "translate(-50%, -50%)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.03), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.14)",
          animation: "quickViewIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Close button — pinned top-right, above everything */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 w-7 h-7 rounded-full flex items-center justify-center bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors cursor-pointer ring-1 ring-white/10"
        >
          <X className="w-3.5 h-3.5 text-white" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {type === "item" && <ItemQuickView code={item.name} vendorName={vendorName} />}
          {type === "location" && <LocationQuickView locationName={item.name} vendorName={vendorName} />}
          {type === "contact" && (
            <ContactQuickView
              contactName={item.name}
              initials={item.initials}
              avatarBg={item.avatarBg}
              avatarFg={item.avatarFg}
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
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer"
            style={{ fontWeight: 600, backgroundColor: "#0A77FF" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0862D4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0A77FF")}
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