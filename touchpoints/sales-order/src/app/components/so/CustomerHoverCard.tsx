import { useState } from "react";
import {
  Building2, MapPin, Phone, Mail, Package, DollarSign,
  ExternalLink, User,
} from "lucide-react";
import { getAvatarTint } from "./avatarTints";

/* ─── Mock data generator (deterministic per customer name) ─── */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
function pick<T>(arr: T[], seed: string): T {
  return arr[hashStr(seed) % arr.length];
}

const INDUSTRIES = ["Manufacturing", "Logistics", "Retail", "Technology", "Healthcare", "Construction", "Automotive", "Energy"];
const CITIES = ["Plano, TX", "Detroit, MI", "San Jose, CA", "Seattle, WA", "Austin, TX", "Chicago, IL", "Atlanta, GA", "Denver, CO"];
const STREETS = ["Industrial Blvd", "Commerce Dr", "Technology Way", "Supply Chain Ave", "Corporate Pkwy"];

function mockCustomerData(name: string) {
  const industry = pick(INDUSTRIES, name);
  const city = pick(CITIES, name + "c");
  const street = `${(hashStr(name + "n") % 999) + 1} ${pick(STREETS, name + "s")}`;
  const phone = `+1 (${(hashStr(name + "p1") % 900) + 100}) ${(hashStr(name + "p2") % 900) + 100}-${(hashStr(name + "p3") % 9000) + 1000}`;
  const email = name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) + "@company.com";
  const openOrders = (hashStr(name + "o") % 8) + 1;
  const totalRevenue = ((hashStr(name + "r") % 500) + 50) * 1000;
  const avgOrderValue = Math.round(totalRevenue / ((hashStr(name + "a") % 20) + 5));
  return { industry, city, street, phone, email, openOrders, totalRevenue, avgOrderValue };
}

function formatCurrency(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;
}

/* ─── KPI Card ─── */
function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border px-3 py-2" style={{ borderColor: `${color}25`, backgroundColor: `${color}08` }}>
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color, fontWeight: 600 }}>{label}</div>
      <div className="text-[14px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/* ─── Info Row ─── */
function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "#F1F5F9" }}>
        <Icon className="w-3 h-3 text-[#94A3B8]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-[#94A3B8]" style={{ fontWeight: 500 }}>{label}</div>
        <div className="text-[12px] text-[#0F172A] truncate" style={{ fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}

/* ─── Main Hover Card ─── */
interface CustomerHoverCardProps {
  customerName: string;
  customerInitials: string;
  children: React.ReactNode;
}

export function CustomerHoverCard({ customerName, customerInitials, children }: CustomerHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const tint = getAvatarTint(customerName);
  const d = mockCustomerData(customerName);

  const handleEnter = () => {
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setOpen(true), 300);
    setTimer(t);
  };

  const handleLeave = () => {
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setOpen(false), 150);
    setTimer(t);
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {open && (
        <div
          className="absolute z-[100] left-0 top-full mt-1"
          style={{
            width: 340,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.08), 0 24px 56px rgba(0,0,0,0.12)",
            animation: "fadeIn 150ms ease-out",
          }}
        >
          {/* Dark header */}
          <div className="px-4 pt-4 pb-3" style={{ background: "linear-gradient(135deg, #0C1222 0%, #162033 100%)" }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-[12px] shrink-0"
                style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
              >
                {customerInitials}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{customerName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-white/50" style={{ fontWeight: 500 }}>{d.industry}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/40">
              <MapPin className="w-3 h-3" />
              <span>{d.city}</span>
            </div>
          </div>

          {/* White body */}
          <div className="bg-white">
            {/* KPI cards */}
            <div className="px-4 pt-3 pb-2 flex gap-2">
              <KpiCard label="Open Orders" value={`${d.openOrders}`} color="#0A77FF" />
              <KpiCard label="Revenue" value={formatCurrency(d.totalRevenue)} color="#16A34A" />
              <KpiCard label="Avg. Order" value={formatCurrency(d.avgOrderValue)} color="#7C3AED" />
            </div>

            {/* Details */}
            <div className="px-4 pb-3">
              <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-0.5" style={{ fontWeight: 600 }}>Contact</div>
              <div className="divide-y divide-[#F1F5F9]">
                <InfoRow icon={Mail} label="Email" value={d.email} />
                <InfoRow icon={Phone} label="Phone" value={d.phone} />
                <InfoRow icon={MapPin} label="Address" value={`${d.street}, ${d.city}`} />
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-[#F1F5F9] flex items-center justify-end">
              <button className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] text-white transition-colors cursor-pointer"
                style={{ fontWeight: 600, backgroundColor: "#0A77FF" }}
                onClick={(e) => e.stopPropagation()}
              >
                View Customer <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
