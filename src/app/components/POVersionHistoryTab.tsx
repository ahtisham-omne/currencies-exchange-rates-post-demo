import React, { useState, useMemo } from "react";
import {
  Search, ChevronDown, ChevronRight, RotateCcw,
  ArrowLeftRight, X, Check, Package, DollarSign, Plus, Trash2,
  Edit, Tag, Send, CheckCircle2, FileText, Clock, AlertCircle, Scale,
  Eye, EyeOff, TrendingUp
} from "lucide-react";
import { toast } from "sonner";
import { FONT } from "./designTokens";
import type { POVersionEntry, POChangeRecord, POLineItemSnapshot, POVersionSnapshot } from "./poStore";
import { refreshPOLockedRates } from "./poStore";
import UserHoverCard from "./UserHoverCard";
import { POVersionRateChip } from "./currency/POVersionRateChip";
import { CurrencyAmount } from "./ui/CurrencyAmount";
import { BASE_CURRENCY } from "@/app/data/currencyLibrary";

/* ── Types ─────────────────────────────────────────────────── */

interface POVersionHistoryTabProps {
  poNumber: string;
  poId: string;
  versions: POVersionEntry[];
  onRevert: (version: number, reason: string, rateChoice: "locked" | "refresh") => void;
  /** When set, comparison opens full-width outside the tab area */
  onCompareFullScreen?: (v1: POVersionEntry, v2: POVersionEntry) => void;
  /** Mirrors the PO-level Base ↔ Partner toggle from the detail header. */
  viewMode?: "base" | "partner";
}



type POVersionStatus = "draft" | "sent" | "confirmed" | "partially-received";

/* ── Config ─────────────────────────────────────────────────── */

const changeTypeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  "line-item-added": { icon: Plus, color: "#059669", bg: "#D1FAE5" },
  "line-item-removed": { icon: Trash2, color: "#DC2626", bg: "#FEE2E2" },
  "line-item-modified": { icon: Edit, color: "#D97706", bg: "#FEF3C7" },
  "pricing-changed": { icon: DollarSign, color: "#2563EB", bg: "#DBEAFE" },
  "vendor-changed": { icon: Edit, color: "#7C3AED", bg: "#EDE9FE" },
  "config-changed": { icon: Tag, color: "#6B7280", bg: "#F3F4F6" },
  "exchange-rate-changed": { icon: TrendingUp, color: "#7C3AED", bg: "#EDE9FE" },
};

const versionStatusConfig: Record<POVersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", bg: "#f3f4f6", color: "#4b5563", icon: FileText },
  sent: { label: "Sent", bg: "#eff6ff", color: "#1d4ed8", icon: Send },
  confirmed: { label: "Confirmed", bg: "#dbeafe", color: "#1e40af", icon: CheckCircle2 },
  "partially-received": { label: "Partially Received", bg: "#fffbeb", color: "#b45309", icon: Package },
};

/**
 * Format an amount as base currency (PKR). Every currency-bearing string in
 * the version history must carry a symbol per the global currency rule —
 * using `Rs` keeps amounts consistent with PKR display elsewhere in the PO
 * module and avoids the misleading `$` from a USD locale.
 */
const formatCurrency = (n: number) =>
  `Rs ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`;

/**
 * Render a base-PKR amount honoring the PO-level Base ↔ Partner toggle, with
 * the standard hover tooltip used everywhere else in the module — `CurrencyAmount`
 * surfaces the equivalent value in the other currency, the rate, and the rate
 * source.
 *
 * Each version converts via its own locked rate so a sent version stays frozen
 * at the rate it captured, while a draft picks up today's rate.
 */
export function VersionAmount({
  amountPKR,
  version,
  viewMode = "base",
  className,
}: {
  amountPKR: number;
  version: POVersionEntry;
  viewMode?: "base" | "partner";
  className?: string;
}) {
  const partnerCode = (version.snapshot.vendorAmountCurrency ?? BASE_CURRENCY).toUpperCase();
  const isVendorBase = partnerCode === BASE_CURRENCY;
  const lockedRate = version.rateSnapshot?.lockedRate;
  const lockedAt = version.rateSnapshot?.lockedAt;

  if (isVendorBase) {
    return (
      <CurrencyAmount
        mode="single"
        currency={BASE_CURRENCY}
        value={amountPKR}
        className={className}
      />
    );
  }

  // Partner-currency value, derived through this version's own locked rate.
  const partnerValue = lockedRate && lockedRate > 0 ? amountPKR / lockedRate : amountPKR;

  if (viewMode === "partner") {
    return (
      <CurrencyAmount
        mode="listing-partner"
        currency={partnerCode}
        value={partnerValue}
        lockedRate={lockedRate}
        lockedAt={lockedAt}
        className={className}
      />
    );
  }

  return (
    <CurrencyAmount
      mode="listing-base"
      currency={BASE_CURRENCY}
      value={amountPKR}
      partnerDefaultCurrency={partnerCode}
      partnerDefaultValue={partnerValue}
      lockedRate={lockedRate}
      lockedAt={lockedAt}
      className={className}
    />
  );
}

/**
 * Render a base-PKR amount honoring the PO-level Base ↔ Partner toggle. In
 * partner mode we convert the stored PKR figure back through the version's
 * own locked rate so each version reads in the FX context it was recorded
 * in (sent versions are frozen; refreshed drafts pick up today's rate).
 *
 * Falls back to base PKR when the version has no rate snapshot or the
 * vendor currency is already PKR.
 */
export function formatVersionAmount(
  amountPKR: number,
  version: POVersionEntry,
  viewMode: "base" | "partner" = "base",
): string {
  if (viewMode === "base") return formatCurrency(amountPKR);
  const partnerCode = (version.snapshot.vendorAmountCurrency ?? "PKR").toUpperCase();
  if (partnerCode === "PKR") return formatCurrency(amountPKR);
  const rate = version.rateSnapshot?.lockedRate;
  if (!rate || rate <= 0) return formatCurrency(amountPKR);
  const partnerValue = amountPKR / rate;
  const sym = (() => {
    const map: Record<string, string> = {
      USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF", CAD: "C$", AUD: "A$",
      CNY: "¥", INR: "₹", KRW: "₩", SGD: "S$", HKD: "HK$", AED: "د.إ", SAR: "﷼",
    };
    return map[partnerCode] ?? partnerCode;
  })();
  // Keep 2 decimals in partner mode — most non-PKR currencies (USD, EUR, GBP)
  // need cent precision to be readable, especially for line-item totals.
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(partnerValue);
  return `${sym} ${formatted}`;
}

const CURRENT_USER = "Areeb Tanvir";


/* ── Main Component ────────────────────────────────────────── */

export default function POVersionHistoryTab({ poNumber, poId, versions, onRevert, onCompareFullScreen, viewMode = "base" }: POVersionHistoryTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set([versions[0]?.version ?? 1]));
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelections, setCompareSelections] = useState<number[]>([]);
  const [showRevertConfirm, setShowRevertConfirm] = useState<number | null>(null);


  const sorted = useMemo(() => [...versions].sort((a, b) => b.version - a.version), [versions]);
  const lastApprovedVersionNum = -1;
  const latestVersionNum = sorted[0]?.version ?? 1;


  const toggleExpanded = (v: number) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const handleCompareSelect = (v: number) => {
    setCompareSelections(prev => {
      if (prev.includes(v)) return prev.filter(x => x !== v);
      if (prev.length >= 2) return [prev[1], v];
      return [...prev, v];
    });
  };

  const handleStartComparison = () => {
    if (compareSelections.length !== 2) return;
    const v1 = sorted.find(v => v.version === Math.min(...compareSelections));
    const v2 = sorted.find(v => v.version === Math.max(...compareSelections));
    if (!v1 || !v2) return;
    if (onCompareFullScreen) {
      onCompareFullScreen(v1, v2);
    }
  };

  // Filter logic
  const filteredVersions = useMemo(() => {
    return sorted.map(v => {
      const filteredChanges = v.changes.filter(c => {
        return !searchQuery ||
          c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.detail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.user.toLowerCase().includes(searchQuery.toLowerCase());
      });
      return { ...v, changes: filteredChanges };
    }).filter(v => {
      if (!searchQuery) return true;
      if (v.changes.length > 0) return true;
      return v.reason.toLowerCase().includes(searchQuery.toLowerCase()) || v.createdBy.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [sorted, searchQuery]);

  const getUserColor = (name: string) => {
    if (name === "Areeb Tanvir") return "#3B82F6";
    if (name === "Nophil Anwer") return "#8B5CF6";
    if (name === "Irtaza Abid") return "#F59E0B";
    if (name === "Shehryar Hasan") return "#10B981";
    if (name === "Eli Rosenbloom") return "#EC4899";
    return "#6B7280";
  };

  const getUserInitials = (name: string) => name.split(" ").map(n => n[0]).join("");

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", width: "100%", maxWidth: "100%", minWidth: 0, overflow: "hidden" }}>
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "10px", border: "1px solid #E5E7EB", overflow: "hidden", width: "100%", maxWidth: "100%" }}>
        {/* ── Toolbar ── */}
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Search */}
            <div style={{ position: "relative", width: "240px", flexShrink: 0 }}>
              <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "#9CA3AF", pointerEvents: "none" }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search changes..."
                style={{ width: "100%", height: "32px", padding: "0 12px 0 32px", fontSize: "13px", fontWeight: 400, color: "#1F2937", border: "1px solid #E5E7EB", borderRadius: "6px", outline: "none", backgroundColor: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", boxSizing: "border-box" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#93C5FD"; e.currentTarget.style.boxShadow = "0 0 0 2px #DBEAFE"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "none"; }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", width: "20px", height: "20px", borderRadius: "4px", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  <X style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
                </button>
              )}
            </div>


            <div style={{ flex: 1 }} />

            {/* Compare toggle */}
            <button
              onClick={() => { setCompareMode(!compareMode); setCompareSelections([]); }}
              style={{ height: "32px", padding: "0 12px", fontSize: "13px", fontWeight: 500, color: compareMode ? "#DC2626" : "#6B7280", backgroundColor: compareMode ? "#FEF2F2" : "#FFFFFF", border: `1px solid ${compareMode ? "#FECACA" : "#E5E7EB"}`, borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontFamily: "Inter, system-ui, sans-serif", lineHeight: "1" }}
            >
              <ArrowLeftRight style={{ width: "14px", height: "14px" }} />
              {compareMode ? "Cancel" : "Compare"}
            </button>
          </div>
        </div>

        {!compareMode && <div style={{ height: "1px", backgroundColor: "#E5E7EB" }} />}

        {/* Compare action bar */}
        {compareMode && (
          <div style={{ backgroundColor: "#EFF6FF", borderTop: "1px solid #BFDBFE", borderBottom: "1px solid #BFDBFE", padding: "8px 16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <ArrowLeftRight style={{ width: "14px", height: "14px", color: "#3B82F6" }} />
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#1E40AF", lineHeight: "1" }}>
              Select two versions to compare
              {compareSelections.length > 0 && ` · ${compareSelections.length}/2 selected`}
            </span>
            <div style={{ flex: 1 }} />
            {compareSelections.length === 2 && (
              <button
                onClick={handleStartComparison}
                style={{ height: "28px", padding: "0 12px", fontSize: "12px", fontWeight: 500, color: "#FFFFFF", backgroundColor: "#3B82F6", border: "none", borderRadius: "6px", cursor: "pointer", fontFamily: "Inter, system-ui, sans-serif", lineHeight: "1" }}
              >
                Compare V{Math.min(...compareSelections)} → V{Math.max(...compareSelections)}
              </button>
            )}
          </div>
        )}

        {/* ── Version list ── */}
        <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
          {filteredVersions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <Package style={{ width: "24px", height: "24px", color: "#D1D5DB", margin: "0 auto 8px" }} />
              <div style={{ fontSize: "13px", color: "#9CA3AF" }}>No matching changes found</div>
            </div>
          ) : (
            filteredVersions.map((ver, vidx) => {
              const isExpanded = expandedVersions.has(ver.version);
              const isCompareSelected = compareSelections.includes(ver.version);
              const isLastApproved = ver.version === lastApprovedVersionNum;
              const isLatestVersion = ver.version === latestVersionNum;
              const vsCfg = versionStatusConfig[ver.versionStatus] || versionStatusConfig["confirmed"];
              const VSIcon = vsCfg.icon;

                return (
                <div key={ver.version} style={{ overflow: "hidden", maxWidth: "100%" }}>
                  {vidx > 0 && <div style={{ height: "1px", backgroundColor: "#E5E7EB" }} />}

                  {/* Version header row */}
                  <div
                    onClick={() => compareMode ? handleCompareSelect(ver.version) : toggleExpanded(ver.version)}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "14px 16px", cursor: "pointer",
                      backgroundColor: isCompareSelected ? "#F0F7FF" : isExpanded ? "#F9FAFB" : "transparent",
                      transition: "background-color 150ms",
                    }}
                    onMouseEnter={e => { if (!isExpanded && !isCompareSelected) e.currentTarget.style.backgroundColor = "#FAFBFC"; }}
                    onMouseLeave={e => { if (!isExpanded && !isCompareSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    {/* Checkbox or Chevron */}
                    {compareMode ? (
                      <div style={{ width: "16px", height: "16px", borderRadius: "4px", border: isCompareSelected ? "none" : "1.5px solid #D1D5DB", backgroundColor: isCompareSelected ? "#3B82F6" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 150ms" }}>
                        {isCompareSelected && <Check style={{ width: "10px", height: "10px", color: "#FFFFFF" }} strokeWidth={3} />}
                      </div>
                    ) : (
                      isExpanded
                        ? <ChevronDown style={{ width: "14px", height: "14px", color: "#9CA3AF", flexShrink: 0 }} />
                        : <ChevronRight style={{ width: "14px", height: "14px", color: "#9CA3AF", flexShrink: 0 }} />
                    )}

                    {/* Avatar */}
                    <UserHoverCard name={ver.createdBy}>
                      <div style={{ width: "30px", height: "30px", borderRadius: "50%", backgroundColor: getUserColor(ver.createdBy), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "#FFFFFF", flexShrink: 0, cursor: "pointer" }}>
                        {ver.avatar}
                      </div>
                    </UserHoverCard>

                    {/* Version info */}
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px", flexWrap: "wrap", maxWidth: "100%" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#1F2937", lineHeight: "1", flexShrink: 0 }}>V{ver.version}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", backgroundColor: vsCfg.bg, color: vsCfg.color, lineHeight: "1", flexShrink: 0 }}>
                          <VSIcon style={{ width: "9px", height: "9px" }} />
                          {vsCfg.label}
                        </span>
                        {isLatestVersion && (
                          <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", backgroundColor: "#F3F4F6", color: "#374151", lineHeight: "1", border: "1px solid #E5E7EB", flexShrink: 0 }}>Latest</span>
                        )}
                        {ver.isRevert && (
                          <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", backgroundColor: "#FEF3C7", color: "#92400E", lineHeight: "1", flexShrink: 0 }}>Revert from v{ver.revertedFrom}</span>
                        )}
                        <span style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: "1", flexShrink: 0 }}>·</span>
                        <span style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: "1", flexShrink: 0 }}>{new Date(ver.createdAt).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}</span>
                        <span style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: "1", flexShrink: 0 }}>·</span>
                        <span style={{ fontSize: "11px", color: "#6B7280", lineHeight: "1", flexShrink: 0 }}>{ver.createdBy}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#6B7280", lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                        {ver.previousStatus && ver.newStatus && ver.previousStatus !== ver.newStatus ? (
                          <span style={{ fontWeight: 500, color: "#92400E" }}>Reset from {ver.previousStatus} → {ver.newStatus}</span>
                        ) : (
                          ver.reason
                        )}
                      </div>
                      {ver.changeTags && ver.changeTags.length > 0 && (() => {
                        const MAX_VISIBLE = 4;
                        const visible = ver.changeTags.slice(0, MAX_VISIBLE);
                        const overflow = ver.changeTags.length - MAX_VISIBLE;
                        return (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "5px", maxWidth: "100%" }}>
                            {visible.map((tag, ti) => (
                              <span key={ti} style={{ display: "inline-flex", alignItems: "center", fontSize: "10px", fontWeight: 500, padding: "2px 7px", borderRadius: "4px", backgroundColor: "#EFF6FF", color: "#1D4ED8", lineHeight: "1", fontFamily: "Inter, system-ui, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
                                {tag}
                              </span>
                            ))}
                            {overflow > 0 && (
                              <span
                                title={ver.changeTags.slice(MAX_VISIBLE).join(", ")}
                                style={{ display: "inline-flex", alignItems: "center", fontSize: "10px", fontWeight: 500, padding: "2px 7px", borderRadius: "4px", backgroundColor: "#F3F4F6", color: "#6B7280", lineHeight: "1", fontFamily: "Inter, system-ui, sans-serif", whiteSpace: "nowrap", flexShrink: 0, cursor: "default" }}
                              >
                                +{overflow} more
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Snapshot badges */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <span style={{ fontSize: "11px", color: "#6B7280", lineHeight: "1" }}>{ver.snapshot.lineItemCount} items</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#1F2937", lineHeight: "1" }}>
                        <VersionAmount amountPKR={ver.snapshot.total} version={ver} viewMode={viewMode} />
                      </span>
                      <POVersionRateChip version={ver} dense />
                    </div>

                    {/* Revert */}
                    {!compareMode && ver.versionStatus === "confirmed" && (
                      <button
                        onClick={e => { e.stopPropagation(); setShowRevertConfirm(ver.version); }}
                        title="Revert to this version"
                        style={{ width: "28px", height: "28px", borderRadius: "5px", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F3F4F6"; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <RotateCcw style={{ width: "13px", height: "13px", color: "#9CA3AF" }} />
                      </button>
                    )}
                  </div>

                  {/* Expanded content — improved spacing */}
                  {isExpanded && !compareMode && (
                    <div style={{ padding: "0 16px 16px 58px", overflow: "hidden", minWidth: 0, maxWidth: "100%" }}>
                      {/* Timestamps */}
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px", paddingTop: "10px", borderTop: "1px solid #F3F4F6", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Clock style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
                          <span style={{ fontSize: "12px", color: "#6B7280", lineHeight: "1" }}>Created {new Date(ver.createdAt).toLocaleString()}</span>
                        </div>
                        {ver.versionStatus === "confirmed" && (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <CheckCircle2 style={{ width: "12px", height: "12px", color: "#059669" }} />
                            <span style={{ fontSize: "12px", color: "#065F46", lineHeight: "1" }}>Confirmed</span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Package style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
                          <span style={{ fontSize: "12px", color: "#6B7280", lineHeight: "1" }}>Delivery: {ver.snapshot.deliveryDate}</span>
                        </div>
                      </div>

                      {/* Line Items Table — improved sizing */}
                      <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden", marginBottom: "16px", width: "100%", maxWidth: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                          <Package style={{ width: "12px", height: "12px", color: "#6B7280" }} />
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", lineHeight: "1" }}>Line Items</span>
                          <span style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: 500, lineHeight: "1" }}>({ver.snapshot.lineItems?.length || 0})</span>
                        </div>
                        {/* Column headers */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px", backgroundColor: "#F7F8F9", borderBottom: "1px solid #E5E7EB" }}>
                          <div style={{ width: "24px", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: "10px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.5px", lineHeight: "1" }}>Item</span></div>
                          <span style={{ fontSize: "10px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.5px", lineHeight: "1", flexShrink: 0, width: "40px", textAlign: "right" as const }}>Qty</span>
                          <span style={{ fontSize: "10px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.5px", lineHeight: "1", flexShrink: 0, width: "40px", textAlign: "center" as const }}>UOM</span>
                          <span style={{ fontSize: "10px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.5px", lineHeight: "1", flexShrink: 0, width: "72px", textAlign: "right" as const }}>Price</span>
                          <span style={{ fontSize: "10px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase" as const, letterSpacing: "0.5px", lineHeight: "1", flexShrink: 0, width: "72px", textAlign: "right" as const }}>Total</span>
                        </div>
                        {/* Rows */}
                        {ver.snapshot.lineItems && ver.snapshot.lineItems.length > 0 ? (
                          <div style={{ backgroundColor: "#FFFFFF" }}>
                            {ver.snapshot.lineItems.map((li, liIdx) => (
                              <div key={li.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", borderTop: liIdx > 0 ? "1px solid #F3F4F6" : "none" }}>
                                <div style={{ width: "24px", height: "24px", borderRadius: "4px", flexShrink: 0, backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <Package style={{ width: "11px", height: "11px", color: "#6B7280", opacity: 0.5 }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#6B7280", lineHeight: "1", marginBottom: "2px" }}>{li.itemNumber}</div>
                                  <div style={{ fontSize: "12px", color: "#374151", lineHeight: "1.2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{li.descriptiveName}</div>
                                </div>
                                <span style={{ fontSize: "11px", color: "#6B7280", lineHeight: "1", flexShrink: 0, width: "40px", textAlign: "right" as const }}>{li.vendorQty}</span>
                                <span style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: "1", flexShrink: 0, width: "40px", textAlign: "center" as const }}>{li.vendorUOM}</span>
                                <span style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: "1", flexShrink: 0, width: "72px", textAlign: "right" as const }}>
                                  <VersionAmount amountPKR={li.unitPrice} version={ver} viewMode={viewMode} />
                                </span>
                                <span style={{ fontSize: "12px", fontWeight: 600, color: "#1F2937", lineHeight: "1", flexShrink: 0, width: "72px", textAlign: "right" as const }}>
                                  <VersionAmount amountPKR={li.lineTotal} version={ver} viewMode={viewMode} />
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: "12px 14px", fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>No line items</div>
                        )}
                        {/* Subtotal */}
                        {ver.snapshot.lineItems && ver.snapshot.lineItems.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "6px 14px", borderTop: "1px solid #E5E7EB", backgroundColor: "#FFFFFF" }}>
                            <span style={{ fontSize: "11px", fontWeight: 500, color: "#6B7280", textTransform: "uppercase" as const, letterSpacing: "0.3px", lineHeight: "1", marginRight: "8px" }}>Subtotal</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#374151", lineHeight: "1", width: "72px", textAlign: "right" as const }}>
                              <VersionAmount amountPKR={ver.snapshot.lineItems.reduce((s, li) => s + li.lineTotal, 0)} version={ver} viewMode={viewMode} />
                            </span>
                          </div>
                        )}
                        {/* Footer */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", backgroundColor: "#F9FAFB", borderTop: "1px solid #E5E7EB" }}>
                          <span style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: "1" }}>
                            Shipping: <VersionAmount amountPKR={ver.snapshot.shippingFee} version={ver} viewMode={viewMode} /> · Discount: <VersionAmount amountPKR={ver.snapshot.discountTotal} version={ver} viewMode={viewMode} />
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 500, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.3px", lineHeight: "1" }}>Total</span>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1F2937", lineHeight: "1" }}>
                              <VersionAmount amountPKR={ver.snapshot.total} version={ver} viewMode={viewMode} />
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Changes list — clear visual separation */}
                      {ver.changes.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#9CA3AF", fontStyle: "italic", lineHeight: "1" }}>No recorded changes in this version</div>
                      ) : (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #E5E7EB" }}>
                            <Edit style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
                            <span style={{ fontSize: "11px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", lineHeight: "1" }}>
                              {ver.version === 1 ? "Creation Summary" : "Changes"} ({ver.changes.length})
                            </span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                            {ver.changes.map((change, cidx) => {
                              const ct = changeTypeConfig[change.type] || changeTypeConfig["config-changed"];
                              const CIcon = ct.icon;
                              const userInitials = getUserInitials(change.user);
                              const userColor = getUserColor(change.user);
                              return (
                                <div key={change.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0", borderTop: cidx > 0 ? "1px solid #F7F8F9" : "none" }}>
                                  <div style={{ width: "24px", height: "24px", borderRadius: "6px", backgroundColor: ct.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                                    <CIcon style={{ width: "12px", height: "12px", color: ct.color }} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: "12px", fontWeight: 500, color: "#1F2937", lineHeight: "1.3", display: "flex", alignItems: "baseline", gap: "0", flexWrap: "wrap" }}>
                                      <span style={{ fontSize: "11px", fontWeight: 600, color: change.action === "Added" ? "#059669" : change.action === "Removed" ? "#DC2626" : "#D97706", marginRight: "5px", lineHeight: "1" }}>{ver.version === 1 && change.action === "Changed" ? "Set" : change.action}:</span>
                                      <span style={{ fontWeight: 600, color: "#1F2937", marginRight: "4px" }}>{change.subject}</span>
                                    </div>
                                    {change.detail && (
                                      <div style={{ fontSize: "11px", color: "#9CA3AF", lineHeight: "1.3", marginTop: "2px" }}>{change.detail}</div>
                                    )}
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                                    <UserHoverCard name={change.user}>
                                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: userColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: 700, color: "#FFFFFF", lineHeight: "1", cursor: "pointer" }}>
                                        {userInitials}
                                      </div>
                                    </UserHoverCard>
                                    <span style={{ fontSize: "10px", color: "#9CA3AF", lineHeight: "1" }}>{change.timestamp}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Revert Confirm Modal ── */}
      {showRevertConfirm !== null && (
        <RevertConfirmModal
          version={showRevertConfirm}
          nextVersion={(sorted[0]?.version ?? 1) + 1}
          sourceEntry={sorted.find(v => v.version === showRevertConfirm) ?? null}
          onClose={() => setShowRevertConfirm(null)}
          onConfirm={(reason: string, rateChoice: "locked" | "refresh") => {
            onRevert(showRevertConfirm, reason, rateChoice);
            setShowRevertConfirm(null);
            toast.success(`Reverted to Version ${showRevertConfirm}`, {
              description: rateChoice === "refresh"
                ? "Created as a new version with today's rate applied."
                : "Created as a new version with the locked rate restored.",
              position: "top-right",
            });
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RevertConfirmModal
   ═══════════════════════════════════════════════════════════════ */

function RevertConfirmModal({ version, nextVersion, sourceEntry, onClose, onConfirm }: {
  version: number;
  nextVersion: number;
  sourceEntry: POVersionEntry | null;
  onClose: () => void;
  onConfirm: (reason: string, rateChoice: "locked" | "refresh") => void;
}) {
  const [reason, setReason] = useState("");
  const [rateChoice, setRateChoice] = useState<"locked" | "refresh">("locked");

  const lockedRateLabel = (() => {
    const r = sourceEntry?.rateSnapshot?.lockedRate;
    if (!r) return null;
    const partner = (sourceEntry?.snapshot.vendorAmountCurrency ?? "").toUpperCase();
    if (!partner || partner === "PKR") return null;
    return `1 ${partner} = Rs ${r.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  })();

  const lockedDateLabel = (() => {
    const at = sourceEntry?.rateSnapshot?.lockedAt;
    if (!at) return null;
    try {
      return new Date(at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    } catch {
      return null;
    }
  })();

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      <div style={{ position: "relative", backgroundColor: "#FFFFFF", borderRadius: "12px", width: "480px", boxShadow: "0 16px 48px rgba(0,0,0,0.12)", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <RotateCcw style={{ width: "16px", height: "16px", color: "#D97706" }} />
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827", lineHeight: "1" }}>Revert to V{version}</span>
          </div>
          <button onClick={onClose} style={{ width: "28px", height: "28px", borderRadius: "6px", border: "none", backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: "16px", height: "16px", color: "#9CA3AF" }} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px", padding: "8px 10px", backgroundColor: "#FFFBEB", borderRadius: "6px" }}>
            <AlertCircle style={{ width: "13px", height: "13px", color: "#D97706", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#92400E", lineHeight: "1.3" }}>
              This will create a new version (V{nextVersion}) based on V{version}. The current state will be preserved in history.
            </span>
          </div>

          {lockedRateLabel && (
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px", lineHeight: "1" }}>
                Currency rate
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {([
                  { key: "locked", title: `Restore locked rate from V${version}`, sub: `${lockedRateLabel}${lockedDateLabel ? ` · locked on ${lockedDateLabel}` : ""}` },
                  { key: "refresh", title: "Refresh to today's rate", sub: "Recompute totals against today's market snapshot" },
                ] as const).map((opt) => {
                  const active = rateChoice === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setRateChoice(opt.key)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px",
                        borderRadius: 8, border: `1px solid ${active ? "#1B6EF3" : "#E5E7EB"}`,
                        backgroundColor: active ? "#EFF6FF" : "#FFFFFF",
                        textAlign: "left", cursor: "pointer", fontFamily: "Inter, system-ui, sans-serif",
                      }}
                    >
                      <span style={{
                        marginTop: 2, width: 14, height: 14, borderRadius: "50%",
                        border: `1.5px solid ${active ? "#1B6EF3" : "#D1D5DB"}`,
                        backgroundColor: active ? "#1B6EF3" : "#FFFFFF",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {active && <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#FFFFFF" }} />}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#111827", lineHeight: "1.3" }}>{opt.title}</span>
                        <span style={{ fontSize: 11, color: "#6B7280", lineHeight: "1.3" }}>{opt.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label style={{ fontSize: "11px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "6px", lineHeight: "1" }}>
            Reason for revert <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g., Vendor requested to go back to the original quantities..."
            rows={3}
            style={{ width: "100%", fontSize: "13px", fontWeight: 400, color: "#1F2937", border: "1px solid #E5E7EB", borderRadius: "6px", padding: "8px 12px", outline: "none", resize: "none", fontFamily: "Inter, system-ui, sans-serif", lineHeight: "1.5", boxSizing: "border-box" }}
            onFocus={e => { e.currentTarget.style.borderColor = "#93C5FD"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: "1px solid #E5E7EB" }}>
          <button onClick={onClose} style={{ height: "34px", padding: "0 16px", fontSize: "13px", fontWeight: 500, color: "#374151", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: "6px", cursor: "pointer", fontFamily: "Inter, system-ui, sans-serif" }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim(), rateChoice)}
            style={{ height: "34px", padding: "0 16px", fontSize: "13px", fontWeight: 500, color: "#FFFFFF", backgroundColor: "#D97706", border: "none", borderRadius: "6px", cursor: "pointer", fontFamily: "Inter, system-ui, sans-serif", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RotateCcw style={{ width: "13px", height: "13px" }} />
            Revert as V{nextVersion}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Full-Width CompareView — G2-style comparison table
   Exported for use by parent component
   ═══════════════════════════════════════════════════════════════ */

export { versionStatusConfig, changeTypeConfig, formatCurrency };
export type { POVersionStatus };
