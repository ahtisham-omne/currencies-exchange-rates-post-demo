import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { highlightMatch } from "../../lib/highlight-text";
import { popoverVisibleRows, popoverListMaxHeight } from "../../lib/popover-sizing";
import { createPortal } from "react-dom";
import { Shield, Package, MapPin, User, FileText, X, ExternalLink, Lock, Users, Check, AlertTriangle } from "lucide-react";
import { roles as allRoles } from "../../data/roles-data";
import { ExpandableDescription } from "./ExpandableDescription";

/* ─── Types ─── */
export interface OverflowItem {
  id: string;
  name: string;
  icon?: ReactNode;
  initials?: string;
  avatarBg?: string;
  avatarFg?: string;
  /**
   * When set, the row renders as an anchor opening this href in a new tab,
   * applying the system-wide linked-entity treatment.
   */
  href?: string;
  /**
   * When true, the row is rendered with a soft red background + amber alert
   * icon to signal the role is inaccessible (e.g. license-tier mismatch).
   */
  licenseAlert?: boolean;
  /** Optional tooltip text shown when hovering the alert icon. */
  licenseAlertTooltip?: string;
}

interface OverflowTooltipProps {
  items: OverflowItem[];
  category: string;
  children: ReactNode;
  onItemClick?: (item: OverflowItem) => void;
  /** When provided, matching text inside popover items will be highlighted */
  searchQuery?: string;
}

/* ─── Helpers ─── */
function getCategoryIcon(category: string): ReactNode {
  const c = category.toLowerCase();
  if (c.includes("role")) return <Shield className="w-3.5 h-3.5" />;
  if (c.includes("item")) return <Package className="w-3.5 h-3.5" />;
  if (c.includes("location")) return <MapPin className="w-3.5 h-3.5" />;
  if (c.includes("contact") || c.includes("user")) return <User className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

function getCategoryColor(category: string): { bg: string; fg: string } {
  const c = category.toLowerCase();
  if (c.includes("role")) return { bg: "#EFF6FF", fg: "#2563EB" };
  if (c.includes("item")) return { bg: "#EFF6FF", fg: "#2563EB" };
  if (c.includes("location")) return { bg: "#F0FDF4", fg: "#16A34A" };
  if (c.includes("contact") || c.includes("user")) return { bg: "#F5F3FF", fg: "#7C3AED" };
  return { bg: "#F1F5F9", fg: "#64748B" };
}

function getTipWidth(): number {
  if (typeof window === "undefined") return 240;
  const w = window.innerWidth;
  if (w < 640) return 200;
  if (w < 1024) return 220;
  return 240;
}

/* ─── CSS keyframes (injected once) ─── */
const STYLE_ID = "overflow-tooltip-anim";
function ensureStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `@keyframes overflowTooltipIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.overflow-link:hover .overflow-link-name{color:#0A77FF !important;text-decoration:underline !important;text-decoration-color:#0A77FF !important;text-underline-offset:2px;}`;
  document.head.appendChild(style);
}

/* ─── Synthetic role data for roles not in the main dataset ─── */
function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  manager: "Oversees team operations, approvals, and resource allocation.",
  "team lead": "Leads a functional team, coordinates tasks and mentors members.",
  reviewer: "Reviews submissions, approvals, and quality checks.",
  tester: "Executes test plans and validates system functionality.",
  approver: "Authorized to approve requests, purchases, and workflows.",
  "department head": "Manages an entire department's strategy and operations.",
  "finance lead": "Leads financial planning, budgeting, and reporting.",
  admin: "Administrative access for system configuration and user management.",
  "compliance officer": "Ensures regulatory compliance and policy adherence.",
  "budget reviewer": "Reviews and approves budget allocations and expenditures.",
  "operations head": "Directs daily operations and process optimization.",
  "project coordinator": "Coordinates project timelines, resources, and deliverables.",
  scheduler: "Manages scheduling of resources, shifts, and appointments.",
  "resource planner": "Plans and allocates resources across projects and teams.",
  "stakeholder liaison": "Bridges communication between stakeholders and teams.",
  "risk analyst": "Identifies, assesses, and mitigates organizational risks.",
  "resource manager": "Manages resource pools and capacity planning.",
  "workforce planner": "Forecasts workforce needs and optimizes staffing levels.",
  "capacity analyst": "Analyzes and plans system and team capacity.",
  "talent coordinator": "Coordinates talent acquisition and development programs.",
  "allocation specialist": "Specializes in optimal resource and budget allocation.",
  "scheduling lead": "Leads scheduling operations across departments.",
  "demand forecaster": "Forecasts demand patterns for planning and procurement.",
  "operations support": "Provides operational support and troubleshooting.",
  "report builder": "Creates and maintains reports and dashboards.",
  "BI specialist": "Builds business intelligence solutions and analytics.",
  "data steward": "Ensures data quality, governance, and standards.",
  "metrics owner": "Owns and maintains key performance metrics.",
  "insights lead": "Leads data-driven insights and recommendations.",
  "dashboard admin": "Administers and maintains analytical dashboards.",
  "client relations manager": "Manages client relationships and satisfaction.",
  "account executive": "Handles key accounts and business development.",
  "partnership lead": "Develops and manages strategic partnerships.",
  "customer success manager": "Ensures customer adoption and value realization.",
  "business analyst": "Analyzes business processes and recommends improvements.",
  "requirements engineer": "Gathers and documents system requirements.",
  "process mapper": "Maps and optimizes business processes and workflows.",
  "product owner": "Defines product vision, roadmap, and backlog priorities.",
  "scrum master": "Facilitates agile ceremonies and removes team blockers.",
  "financial officer": "Manages financial operations and regulatory compliance.",
  "budget planner": "Plans and manages organizational budgets.",
  "audit lead": "Leads internal and external audit processes.",
};

function getSyntheticRoleData(roleName: string) {
  const lower = roleName.toLowerCase();
  const desc = ROLE_DESCRIPTIONS[lower] || `Responsible for ${lower} duties and related tasks.`;
  // Generate a pseudo-consistent user count from the name
  const hash = lower.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const usersCount = (hash % 20) + 3;
  const needsFullAccess = ["manager", "admin", "head", "lead", "officer", "director", "owner"].some((k) => lower.includes(k));
  return {
    roleName: toTitleCase(roleName),
    description: desc,
    usersCount,
    licenseRequired: needsFullAccess ? "Full Access" : "Field User",
    status: "Active" as const,
    isSystem: false,
    id: hash,
  };
}

/* ─── Item Detail Modal ─── */
function ItemDetailModal({ item, category, onClose }: { item: OverflowItem; category: string; onClose: () => void }) {
  const catLower = category.toLowerCase();
  const isRole = catLower.includes("role");
  const color = getCategoryColor(category);

  // Try to find role data, case-insensitive match
  const roleData = isRole
    ? allRoles.find((r) => r.roleName.toLowerCase() === item.name.toLowerCase()) || getSyntheticRoleData(item.name)
    : null;

  const details = isRole && roleData
    ? [
        { icon: <Shield className="w-4 h-4" />, label: "Type", value: roleData.isSystem ? "Predefined Role" : "Custom Role" },
        { icon: <Users className="w-4 h-4" />, label: "Users Assigned", value: String(roleData.usersCount) },
        { icon: <Lock className="w-4 h-4" />, label: "License Required", value: roleData.licenseRequired },
        { icon: <Check className="w-4 h-4" />, label: "Status", value: roleData.status },
      ]
    : [
        { icon: getCategoryIcon(category), label: "Name", value: item.name },
      ];

  const statusConfig = roleData?.status === "Active"
    ? { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" }
    : { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[400] bg-black/30" onClick={onClose} />
      <div
        className="fixed z-[400] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl overflow-hidden"
        style={{ width: 420, maxWidth: "calc(100vw - 48px)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Header */}
        <div className="relative px-5 pt-5 pb-4" style={{ background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)" }}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")}
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)" }}
            >
              {item.initials ? (
                <span className="text-sm" style={{ fontWeight: 600 }}>{item.initials}</span>
              ) : (
                <span style={{ color: color.fg === "#2563EB" ? "#93B8F7" : color.fg }}>
                  {getCategoryIcon(category)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-white truncate" style={{ fontSize: "15px", fontWeight: 600, lineHeight: 1.3 }}>
                {roleData ? toTitleCase(item.name) : item.name}
              </h3>
              {roleData && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {roleData.isSystem ? "Predefined" : "Custom"}
                  </span>
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border"
                    style={{ backgroundColor: statusConfig.bg, color: statusConfig.text, borderColor: statusConfig.border, fontWeight: 600 }}
                  >
                    {roleData.status === "Inactive" ? "Deactivated" : roleData.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI Strip (for roles) */}
        {roleData && (
          <div className="grid grid-cols-3 gap-px bg-[#F1F5F9]">
            {[
              { label: "Users", value: String(roleData.usersCount) },
              { label: "License", value: roleData.licenseRequired === "Full Access" ? "Full" : "Field" },
              { label: "Type", value: roleData.isSystem ? "Predefined" : "Custom" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ fontWeight: 600, color: "#94A3B8" }}>{kpi.label}</p>
                <p className="text-[15px]" style={{ fontWeight: 600, color: "#0F172A" }}>{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Details Section */}
        <div className="px-5 py-4">
          <p className="text-[11px] uppercase tracking-wide mb-3" style={{ fontWeight: 600, color: "#94A3B8" }}>Details</p>
          <div className="space-y-0 divide-y" style={{ borderColor: "#F1F5F9" }}>
            {details.map((d, i) => (
              <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#F8FAFC", color: "#64748B" }}
                >
                  {d.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide" style={{ fontWeight: 500, color: "#94A3B8" }}>{d.label}</p>
                  <p className="text-[13px] truncate" style={{ fontWeight: 500, color: "#1E293B" }}>{d.value}</p>
                </div>
              </div>
            ))}
            {roleData?.description && (
              <div className="flex items-start gap-3 py-3">
                <div
                  className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: "#F8FAFC", color: "#64748B" }}
                >
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wide" style={{ fontWeight: 500, color: "#94A3B8" }}>Description</p>
                  <ExpandableDescription
                    text={roleData.description}
                    lines={2}
                    className="text-[13px]"
                    style={{ fontWeight: 450, color: "#1E293B", lineHeight: 1.5 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t" style={{ borderColor: "#F1F5F9", backgroundColor: "#FAFBFC" }}>
          <button
            onClick={onClose}
            className="text-[13px] cursor-pointer transition-colors"
            style={{ fontWeight: 500, color: "#64748B" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#334155")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748B")}
          >
            Close
          </button>
          {isRole && roleData && (
            <a
              href={`/company-settings/user-access-control/role/${roleData.id}`}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-[13px] text-white transition-colors cursor-pointer"
              style={{ backgroundColor: "#2563EB", fontWeight: 600 }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1D4ED8")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563EB")}
            >
              Go to Role
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

/* ─── Component ─── */
export function OverflowTooltip({ items, category, children, onItemClick, searchQuery }: OverflowTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const [detailItem, setDetailItem] = useState<OverflowItem | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const openTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => ensureStyles(), []);

  const position = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const w = getTipWidth();
    const rowH = 36;
    const estH = Math.min(items.length, popoverVisibleRows()) * rowH + 40;
    const vH = window.innerHeight;
    const vW = window.innerWidth;

    let place: "bottom" | "top" = "bottom";
    let top: number;
    if (r.bottom + estH + 8 > vH && r.top - estH - 8 > 0) {
      place = "top";
      top = r.top - estH - 6;
    } else {
      top = r.bottom + 6;
    }
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, vW - w - 8));

    setCoords({ top, left });
    setPlacement(place);
  }, [items.length]);

  const enter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => { position(); setOpen(true); }, 200);
  }, [position]);

  const leave = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  }, []);

  const tipEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  const tipLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 100);
  }, []);

  useEffect(() => {
    if (!open) return;
    const r = () => position();
    window.addEventListener("scroll", r, true);
    window.addEventListener("resize", r);
    return () => { window.removeEventListener("scroll", r, true); window.removeEventListener("resize", r); };
  }, [open, position]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
  }, []);

  const tipW = getTipWidth();
  /* Text rows, 36px each, against the avatar popovers' 40px. */
  const listMaxH = popoverListMaxHeight(items.length, 36);
  const color = getCategoryColor(category);

  return (
    <>
      <span ref={triggerRef} onMouseEnter={enter} onMouseLeave={leave} className="inline-flex cursor-pointer">
        {children}
      </span>

      {open && createPortal(
        <div
          onMouseEnter={tipEnter}
          onMouseLeave={tipLeave}
          className="fixed z-[300]"
          style={{ top: coords.top, left: coords.left, width: tipW, animation: "overflowTooltipIn 120ms ease-out forwards" }}
        >
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2" style={placement === "bottom" ? { top: -4 } : { bottom: -4 }}>
            <div className="w-2 h-2 rotate-45 bg-white border-border/50" style={placement === "bottom" ? { borderTopWidth: 1, borderLeftWidth: 1 } : { borderBottomWidth: 1, borderRightWidth: 1 }} />
          </div>

          <div className="bg-white rounded-[8px] border border-border/50 overflow-hidden" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)" }}>
            {/* Header */}
            <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
              <span className="text-[11px] tracking-wide uppercase text-muted-foreground/70" style={{ fontWeight: 600 }}>{category}</span>
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">{items.length}</span>
            </div>

            {/* Items */}
            <div className={`px-1.5 pb-1.5 ${listMaxH ? "overflow-y-auto scrollbar-hide" : ""}`} style={{ maxHeight: listMaxH }}>
              {items.map((item) => {
                const alert = item.licenseAlert;
                const isRoleCategory = category.toLowerCase().includes("role");
                const matchedRole = isRoleCategory && !alert
                  ? allRoles.find((r) => r.roleName.toLowerCase() === item.name.toLowerCase())
                  : null;
                const linkHref = item.href
                  ? item.href
                  : matchedRole && !onItemClick
                    ? `/company-settings/user-access-control/role/${matchedRole.id}`
                    : null;

                const inner = (
                  <>
                    {alert ? (
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    ) : item.initials ? (
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[9px]"
                        style={{ backgroundColor: item.avatarBg || color.bg, color: item.avatarFg || color.fg, fontWeight: 600 }}
                      >
                        {item.initials}
                      </div>
                    ) : (
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color.bg, color: color.fg }}
                      >
                        {item.icon || getCategoryIcon(category)}
                      </div>
                    )}
                    <span
                      className="text-[12px] truncate overflow-link-name"
                      style={{ fontWeight: 500, color: alert ? "#B45309" : "#1E293B" }}
                    >
                      {searchQuery ? highlightMatch(item.name, searchQuery) : item.name}
                    </span>
                  </>
                );

                const className = "overflow-link w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer text-left no-underline";
                const onMouseEnter = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.backgroundColor = "#EDF4FF");
                const onMouseLeave = (e: React.MouseEvent<HTMLElement>) => (e.currentTarget.style.backgroundColor = "transparent");

                if (linkHref) {
                  return (
                    <a
                      key={item.id}
                      href={linkHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={className}
                      style={{ backgroundColor: "transparent" }}
                      onMouseEnter={onMouseEnter}
                      onMouseLeave={onMouseLeave}
                      title={alert ? item.licenseAlertTooltip : undefined}
                    >
                      {inner}
                    </a>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      if (onItemClick) {
                        onItemClick(item);
                      } else {
                        setDetailItem(item);
                      }
                    }}
                    className={className}
                    style={{ backgroundColor: "transparent" }}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    title={alert ? item.licenseAlertTooltip : undefined}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>

          </div>
        </div>,
        document.body
      )}

      {detailItem && (
        <ItemDetailModal item={detailItem} category={category} onClose={() => setDetailItem(null)} />
      )}
    </>
  );
}
