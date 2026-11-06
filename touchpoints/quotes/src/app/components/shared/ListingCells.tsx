/**
 * Rich listing-table cells — mirrors Partner Management's gradient HoverCard +
 * LogoAvatar + OverflowTooltip pattern. Used by the Quotes list table.
 *
 * Why these live here: the design contract (gradient slate-800→700 header,
 * Mail/Phone/Building2 icon rows, "View all N contacts" footer) is shared
 * across modules; only the source data type differs. Keeping the visuals in
 * one place means the Quotes list and Partner list stay in lockstep.
 */
import { Mail, Phone, Building2, MapPin, ExternalLink } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../ui/hover-card";
import { LogoAvatar } from "./LogoAvatar";
import { OverflowTooltip, type OverflowItem } from "./OverflowTooltip";
import { getAvatarTint } from "../../utils/avatarTints";
import { isSparseCustomer } from "./customerDefaults";
import { formatCompactMoney } from "@/app/currency/money";
import { LAST_SYNC_DAY, customerCurrency } from "@/app/currency/qFx";
import { restateDesign } from "@/app/currency/quoteMoney";

/* ─── helpers ─── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

/* Deterministic mock contact details — used as a fallback when the
   row data doesn't carry phone/role/dept (mirrors the SO module helper
   so the same name yields the same values across listings). */
function deriveContactDetails(name: string) {
  if (!name) return { role: "", dept: "", email: "", phone: "" };
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const depts = ["Procurement", "Supply Chain", "Finance", "Operations", "Sales", "Logistics", "Engineering", "Quality Assurance"];
  const roles = ["Manager", "Director", "Lead", "Specialist", "Coordinator", "Analyst", "Supervisor", "Associate"];
  const dept = depts[h % depts.length];
  const role = `${dept} ${roles[(h * 7) % roles.length]}`;
  const first = name.split(" ")[0]?.toLowerCase() || "user";
  const last = name.split(" ")[1]?.toLowerCase() || "name";
  const email = `${first}.${last}@company.com`;
  const phone = `(${300 + (h % 700)}) ${100 + (h % 900)}-${1000 + (h % 9000)}`;
  return { role, dept, email, phone };
}

/* Deterministic quote-related KPIs for the customer hover card.
   Mirrors SO's CustomerHoverCard structure (Open Orders / Revenue /
   Avg. Order) but tuned to quote semantics. */
function deriveCustomerQuoteInsights(name: string) {
  if (!name) return { openQuotes: 0, winRate: 0, avgValue: 0 };
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const abs = Math.abs(h);
  const openQuotes = (abs % 9) + 1;
  const winRate = 35 + (abs % 50);
  const avgValue = ((abs % 450) + 25) * 1000;
  return { openQuotes, winRate, avgValue };
}

/* A customer's quotes are in its default currency (spec 4.3); the demo
   figure is the design's USD, restated at the last sync's rate. */
function formatCurrencyShort(usd: number, customerName: string): string {
  const code = customerCurrency(customerName);
  return formatCompactMoney(restateDesign(usd, code, LAST_SYNC_DAY), code);
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border px-3 py-2" style={{ borderColor: `${color}25`, backgroundColor: `${color}08` }}>
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color, fontWeight: 600 }}>{label}</div>
      <div className="text-[14px] text-[#0F172A] truncate" style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

interface PoCLike {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
  avatarUrl?: string;
}

/* ─── PocCellRich ─── */

interface PocCellRichProps {
  primary: PoCLike;
  additional?: PoCLike[];
  /** Optional click handler when the user clicks the primary name link or an item in the overflow tooltip. */
  onContactClick?: (contact: PoCLike) => void;
  /** When provided, "+N more" overflow opens a `viewMoreHref` link in a new tab. */
  viewMoreHref?: string;
  /** `comfortable` density renders an email subtitle below the name. */
  density?: "comfortable" | "compact";
}

export function PocCellRich({
  primary,
  additional = [],
  onContactClick,
  viewMoreHref,
  density = "comfortable",
}: PocCellRichProps) {
  const isRelaxed = density === "comfortable";
  const tint = getAvatarTint(primary.name);
  const initials = getInitials(primary.name);

  return (
    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"} min-w-0`}>
      <HoverCard openDelay={250}>
        <HoverCardTrigger asChild>
          <div className="cursor-pointer">
            <LogoAvatar
              logoUrl={primary.avatarUrl}
              initials={initials}
              bg={tint.bg}
              size={isRelaxed ? "lg" : "md"}
              type="person"
              personName={primary.name}
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* Gradient header */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center gap-3 relative">
              <div
                className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0"
                style={{ backgroundColor: primary.avatarUrl ? "transparent" : tint.bg }}
              >
                {primary.avatarUrl ? (
                  <img src={primary.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-[13px] text-white"
                    style={{ fontWeight: 700 }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>
                  {primary.name}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {primary.role || (primary.isPrimary ? "Primary contact" : "Contact")}
                </p>
              </div>
            </div>
          </div>
          {/* Body */}
          <div className="bg-white px-4 py-3 space-y-2">
            {primary.email && (
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{primary.email}</span>
              </div>
            )}
            {primary.phone && (
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{primary.phone}</span>
              </div>
            )}
            {primary.role && (
              <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{primary.role}</span>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>

      <div
        className="min-w-0 cursor-pointer group/poc"
        onClick={(e) => {
          e.stopPropagation();
          onContactClick?.(primary);
        }}
      >
        <span
          className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate group-hover/poc:text-primary group-hover/poc:underline transition-colors`}
        >
          {primary.name}
        </span>
        {isRelaxed && primary.email && (
          <a
            href={`mailto:${primary.email}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-muted-foreground/60 truncate block hover:text-primary hover:underline transition-colors"
          >
            {primary.email}
          </a>
        )}
      </div>

      {additional.length > 0 && (
        <OverflowTooltip
          category="Point of Contacts"
          items={additional.map<OverflowItem>((c) => {
            const t = getAvatarTint(c.name);
            return {
              id: c.id,
              name: c.name,
              subtitle: c.email,
              subtitleHref: `mailto:${c.email}`,
              initials: getInitials(c.name),
              avatarBg: t.bg,
              avatarFg: t.fg,
              imageUrl: c.avatarUrl,
              meta: { role: c.role, email: c.email, phone: c.phone },
            };
          })}
          onItemClick={(item) => {
            const original = additional.find((c) => c.id === item.id);
            if (original) onContactClick?.(original);
          }}
          viewMoreHref={viewMoreHref}
          viewMoreLabel={`View all ${additional.length + 1} contacts`}
        >
          <span
            className="text-[11px] shrink-0 cursor-default leading-none"
            style={{ fontWeight: 600, color: "#085FCC" }}
          >
            +{additional.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

/* ─── CustomerCellRich ─── */

interface CustomerCellRichProps {
  customer: {
    id: string;
    name: string;
    logoUrl?: string;
    email?: string;
    phone?: string;
    industry?: string;
    location?: { name: string; isPrimary: boolean };
  };
  onClick?: () => void;
  density?: "comfortable" | "compact";
}

/** Listing cell for an optional person field (point of contact, sales
 *  rep) that is empty. Muted label from FIELD_RULES; no avatar and no
 *  hover card, so nothing is invented for a record that has no one. */
export function EmptyPersonCell({ label }: { label: string }) {
  return <span className="text-[13px] text-muted-foreground whitespace-nowrap">{label}</span>;
}

export function CustomerCellRich({ customer, onClick, density = "comfortable" }: CustomerCellRichProps) {
  const isRelaxed = density === "comfortable";
  const tint = getAvatarTint(customer.name);
  const initials = getInitials(customer.name);

  return (
    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"} min-w-0`}>
      <HoverCard openDelay={250}>
        <HoverCardTrigger asChild>
          <div className="cursor-pointer">
            <LogoAvatar logoUrl={customer.logoUrl} initials={initials} bg={tint.bg} size={isRelaxed ? "lg" : "md"} />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          className="w-[320px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {(() => {
            const insights = deriveCustomerQuoteInsights(customer.name);
            const derived = deriveContactDetails(customer.name);
            /* A name-only customer has no contact details on file, so
               nothing is derived for it and the Contact block is
               omitted rather than showing invented values. */
            const sparse = isSparseCustomer(customer.name);
            const email = customer.email || (sparse ? '' : derived.email);
            const phone = customer.phone || (sparse ? '' : derived.phone);
            return (
              <>
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                  <div className="flex items-center gap-3 relative">
                    <div
                      className="w-11 h-11 rounded-lg overflow-hidden border-2 border-white/20 shrink-0 bg-white"
                      style={{ backgroundColor: customer.logoUrl ? "white" : tint.bg }}
                    >
                      {customer.logoUrl ? (
                        <img src={customer.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-[13px] text-white"
                          style={{ fontWeight: 700 }}
                        >
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>
                        {customer.name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{customer.industry ?? "Customer"}</p>
                    </div>
                  </div>
                  {customer.location?.name && (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-white/40 relative">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{customer.location.name}</span>
                    </div>
                  )}
                </div>
                <div className="bg-white px-4 pt-3 pb-2 flex gap-2">
                  <KpiCard label="Open Quotes" value={`${insights.openQuotes}`} color="#0A77FF" />
                  <KpiCard label="Win Rate" value={`${insights.winRate}%`} color="#16A34A" />
                  <KpiCard label="Avg. Value" value={formatCurrencyShort(insights.avgValue, customer.name)} color="#7C3AED" />
                </div>
                {(email || phone || customer.industry) && (
                <div className="bg-white px-4 pb-3 pt-1 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-0.5" style={{ fontWeight: 600 }}>Contact</div>
                  {email && (
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{email}</span>
                  </div>
                  )}
                  {phone && (
                  <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{phone}</span>
                  </div>
                  )}
                  {customer.industry && (
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{customer.industry}</span>
                    </div>
                  )}
                </div>
                )}
              </>
            );
          })()}
        </HoverCardContent>
      </HoverCard>
      <div className="min-w-0 cursor-pointer group/cust" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        <span
          className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate group-hover/cust:text-primary group-hover/cust:underline transition-colors`}
          style={{ fontWeight: 500, color: "#1E293B" }}
        >
          {customer.name}
        </span>
        {isRelaxed && customer.email && (
          <span className="text-xs text-muted-foreground/60 truncate block">{customer.email}</span>
        )}
      </div>
    </div>
  );
}

/* ─── SalesRepCellRich ─── */

interface SalesRepLike {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
  phone?: string;
}

interface SalesRepCellRichProps {
  rep: SalesRepLike;
  /** Additional reps assigned to this row. When present, renders a
   *  "+N more" chip that opens an OverflowTooltip listing all reps —
   *  mirrors the PocCellRich "Point of Contacts" pattern. */
  additional?: SalesRepLike[];
  density?: "comfortable" | "compact";
}

export function SalesRepCellRich({ rep, additional = [], density = "comfortable" }: SalesRepCellRichProps) {
  const isRelaxed = density === "comfortable";
  const tint = getAvatarTint(rep.name);
  const initials = getInitials(rep.name);
  const derived = deriveContactDetails(rep.name);
  const email = rep.email || derived.email;
  const phone = rep.phone || derived.phone;
  const role = rep.role || derived.role;

  return (
    <div className={`flex items-center ${isRelaxed ? "gap-2.5" : "gap-2"} min-w-0`}>
      <HoverCard openDelay={250}>
        <HoverCardTrigger asChild>
          <div className="cursor-pointer">
            <LogoAvatar
              logoUrl={rep.avatar}
              initials={initials}
              bg={tint.bg}
              size={isRelaxed ? "lg" : "md"}
              type="person"
              personName={rep.name}
            />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
        >
          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
            <div className="flex items-center gap-3 relative">
              <div
                className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0"
                style={{ backgroundColor: rep.avatar ? "transparent" : tint.bg }}
              >
                {rep.avatar ? (
                  <img src={rep.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{rep.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{role}</p>
              </div>
            </div>
          </div>
          <div className="bg-white px-4 py-3 space-y-2">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{phone}</span>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
      <div className="min-w-0">
        <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} block truncate`}>{rep.name}</span>
        {isRelaxed && rep.email && (
          <span className="text-[11px] text-muted-foreground/60 truncate block">{rep.email}</span>
        )}
      </div>

      {additional.length > 0 && (
        <OverflowTooltip
          category="Sales Reps"
          items={additional.map<OverflowItem>((r) => {
            const t = getAvatarTint(r.name);
            return {
              id: r.id,
              name: r.name,
              subtitle: r.email,
              subtitleHref: r.email ? `mailto:${r.email}` : undefined,
              initials: getInitials(r.name),
              avatarBg: t.bg,
              avatarFg: t.fg,
              imageUrl: r.avatar,
              meta: { role: r.role, email: r.email, phone: r.phone },
            };
          })}
          viewMoreLabel={`View all ${additional.length + 1} sales reps`}
        >
          <span
            className="text-[11px] shrink-0 cursor-default leading-none"
            style={{ fontWeight: 600, color: "#085FCC" }}
          >
            +{additional.length} more
          </span>
        </OverflowTooltip>
      )}
    </div>
  );
}

/* ─── DeliveryLocationCell ─── */

interface DeliveryLocationCellProps {
  locationName: string;
  address?: string;
  density?: "comfortable" | "compact";
}

export function DeliveryLocationCell({ locationName, address, density = "comfortable" }: DeliveryLocationCellProps) {
  const isRelaxed = density === "comfortable";
  if (!locationName) {
    return <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-muted-foreground`}>—</span>;
  }
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : undefined;
  return (
    <HoverCard openDelay={250}>
      <HoverCardTrigger asChild>
        <div className={`flex items-center ${isRelaxed ? "gap-2" : "gap-1.5"} min-w-0 cursor-default`}>
          <MapPin className="w-[13px] h-[13px] text-muted-foreground/60 shrink-0" />
          <div className="min-w-0">
            <span className={`${isRelaxed ? "text-[13.5px]" : "text-sm"} text-foreground truncate block`}>{locationName}</span>
            {isRelaxed && address && (
              <span className="text-[11px] text-muted-foreground/60 truncate block">{address}</span>
            )}
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3">
          <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{locationName}</p>
          <p className="text-[11px] text-slate-400 truncate">Delivery location</p>
        </div>
        <div className="bg-white px-4 py-3 space-y-2">
          {address && (
            <div className="flex items-start gap-2.5 text-[12px] text-slate-700">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{address}</span>
            </div>
          )}
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11.5px] text-primary hover:underline"
              style={{ fontWeight: 600 }}
            >
              View on Google Maps
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
