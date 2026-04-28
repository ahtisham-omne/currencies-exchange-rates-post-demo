import React, { useState, useMemo } from "react";
import {
  ArrowLeftRight, ArrowLeft, Package, Plus, Trash2,
  Edit, DollarSign, Tag, Send, CheckCircle2, FileText,
  Clock, User, Eye, EyeOff
} from "lucide-react";
import { FONT } from "./designTokens";
import type { POVersionEntry, POChangeRecord, POLineItemSnapshot } from "./poStore";
import UserHoverCard from "./UserHoverCard";
import {
  versionStatusConfig,
  changeTypeConfig,
  formatCurrency,
  formatVersionAmount,
  VersionAmount,
} from "./POVersionHistoryTab";
import type { POVersionStatus } from "./POVersionHistoryTab";

/* ── Types ── */

interface POCompareFullScreenProps {
  v1: POVersionEntry;
  v2: POVersionEntry;
  onClose: () => void;
  /** Mirrors the PO-level Base ↔ Partner toggle so amounts align with the rest of the page. */
  viewMode?: "base" | "partner";
}

type DiffStatus = "unchanged" | "added" | "removed" | "modified";

/* ── Helpers ── */

const getUserColor = (name: string) => {
  if (name === "Areeb Tanvir") return "#3B82F6";
  if (name === "Nophil Anwer") return "#8B5CF6";
  if (name === "Irtaza Abid") return "#F59E0B";
  if (name === "Shehryar Hasan") return "#10B981";
  if (name === "Eli Rosenbloom") return "#EC4899";
  return "#6B7280";
};

const getUserInitials = (name: string) => name.split(" ").map(n => n[0]).join("");

/* ═══════════════════════════════════════════════════════════════
   Inline Comparison — side-by-side layout with readable typography
   ═══════════════════════════════════════════════════════════════ */

export default function POCompareFullScreen({ v1, v2, onClose, viewMode = "base" }: POCompareFullScreenProps) {
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "line-items" | "pricing" | "config">("all");

  /* ── Field comparison data ── */
  const fmtCurrencyConfig = (v: POVersionEntry) => {
    const vendor = (v.snapshot.vendorAmountCurrency ?? "PKR").toUpperCase();
    const settle = (v.snapshot.settlementCurrency ?? vendor).toUpperCase();
    const rateLabel = v.rateSnapshot
      ? `${v.rateSnapshot.rateType === "market" ? "Mid-market" : "Corporate"}${
          v.rateSnapshot.lockedRate ? ` @ ${v.rateSnapshot.lockedRate.toFixed(2)}` : ""
        }`
      : "—";
    return vendor === "PKR" ? `${vendor}` : `${vendor} → ${settle} · ${rateLabel}`;
  };
  const fmtRateLockedAt = (v: POVersionEntry) => {
    const at = v.rateSnapshot?.lockedAt;
    if (!at) return "—";
    try {
      return new Date(at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    } catch {
      return at;
    }
  };

  // Money rows carry both a string (used for the change/diff comparison) and
  // a JSX node (used for rendering with the standard CurrencyAmount hover).
  const moneyRow = (label: string, snapKey: "total" | "subtotal" | "shippingFee" | "discountTotal") => ({
    label,
    val1: formatVersionAmount(v1.snapshot[snapKey], v1, viewMode),
    val2: formatVersionAmount(v2.snapshot[snapKey], v2, viewMode),
    node1: <VersionAmount amountPKR={v1.snapshot[snapKey]} version={v1} viewMode={viewMode} />,
    node2: <VersionAmount amountPKR={v2.snapshot[snapKey]} version={v2} viewMode={viewMode} />,
    category: "pricing",
  });

  const fields = useMemo(() => [
    { label: "Line Items", val1: String(v1.snapshot.lineItemCount), val2: String(v2.snapshot.lineItemCount), category: "config" },
    moneyRow("Total", "total"),
    moneyRow("Subtotal", "subtotal"),
    moneyRow("Shipping", "shippingFee"),
    moneyRow("Discount", "discountTotal"),
    { label: "Currency", val1: fmtCurrencyConfig(v1), val2: fmtCurrencyConfig(v2), category: "pricing" },
    { label: "Rate Locked At", val1: fmtRateLockedAt(v1), val2: fmtRateLockedAt(v2), category: "pricing" },
    { label: "Status", val1: v1.snapshot.status, val2: v2.snapshot.status, category: "config" },
    { label: "Delivery Date", val1: v1.snapshot.deliveryDate, val2: v2.snapshot.deliveryDate, category: "config" },
    { label: "Payment Terms", val1: v1.snapshot.payment.paymentTerms, val2: v2.snapshot.payment.paymentTerms, category: "config" },
    { label: "Vendor", val1: v1.snapshot.vendorName, val2: v2.snapshot.vendorName, category: "config" },
    { label: "Pay To", val1: v1.snapshot.payment.payTo, val2: v2.snapshot.payment.payTo, category: "config" },
    { label: "Payment Method", val1: v1.snapshot.payment.paymentMethod, val2: v2.snapshot.payment.paymentMethod, category: "config" },
    { label: "Shipped To", val1: v1.snapshot.payment.shippedTo, val2: v2.snapshot.payment.shippedTo, category: "config" },
  ] as Array<{ label: string; val1: string; val2: string; category: string; node1?: React.ReactNode; node2?: React.ReactNode }>, [v1, v2, viewMode]);

  const filteredFields = useMemo(() => {
    let result = fields;
    if (activeFilter === "pricing") result = result.filter(f => f.category === "pricing");
    else if (activeFilter === "config") result = result.filter(f => f.category === "config");
    if (showOnlyDiffs) result = result.filter(f => f.val1 !== f.val2);
    return result;
  }, [fields, showOnlyDiffs, activeFilter]);

  /* ── Line item diff ── */
  const v1Map = useMemo(() => new Map((v1.snapshot.lineItems || []).map(li => [li.itemNumber, li])), [v1]);
  const v2Map = useMemo(() => new Map((v2.snapshot.lineItems || []).map(li => [li.itemNumber, li])), [v2]);
  const allItemIds = useMemo(() => Array.from(new Set([
    ...(v1.snapshot.lineItems || []).map(li => li.itemNumber),
    ...(v2.snapshot.lineItems || []).map(li => li.itemNumber),
  ])), [v1, v2]);

  const getDiffStatus = (id: string): DiffStatus => {
    const inV1 = v1Map.has(id);
    const inV2 = v2Map.has(id);
    if (inV1 && !inV2) return "removed";
    if (!inV1 && inV2) return "added";
    if (inV1 && inV2) {
      const a = v1Map.get(id)!;
      const b = v2Map.get(id)!;
      if (a.vendorQty !== b.vendorQty || a.unitPrice !== b.unitPrice || a.lineTotal !== b.lineTotal || a.discount !== b.discount) return "modified";
    }
    return "unchanged";
  };

  const filteredItemIds = useMemo(() => {
    if (activeFilter === "pricing" || activeFilter === "config") return showOnlyDiffs ? allItemIds.filter(id => getDiffStatus(id) !== "unchanged") : allItemIds;
    let result = allItemIds;
    if (showOnlyDiffs) result = result.filter(id => getDiffStatus(id) !== "unchanged");
    return result;
  }, [allItemIds, showOnlyDiffs, activeFilter]);

  /* ── Change counts ── */
  const stats = useMemo(() => {
    const changedFields = fields.filter(f => f.val1 !== f.val2).length;
    const addedItems = allItemIds.filter(id => getDiffStatus(id) === "added").length;
    const removedItems = allItemIds.filter(id => getDiffStatus(id) === "removed").length;
    const modifiedItems = allItemIds.filter(id => getDiffStatus(id) === "modified").length;
    return { total: changedFields + addedItems + removedItems + modifiedItems, added: addedItems, removed: removedItems, modified: modifiedItems + changedFields };
  }, [fields, allItemIds]);

  const v1Cfg = versionStatusConfig[v1.versionStatus] || versionStatusConfig["confirmed"];
  const v2Cfg = versionStatusConfig[v2.versionStatus] || versionStatusConfig["confirmed"];
  const V1Icon = v1Cfg.icon;
  const V2Icon = v2Cfg.icon;

  const filterTabs = [
    { key: "all" as const, label: "All Changes" },
    { key: "line-items" as const, label: "Line Items" },
    { key: "pricing" as const, label: "Pricing" },
    { key: "config" as const, label: "Config" },
  ];

  /* ── Changes log alignment ── */
  const maxChanges = Math.max(v1.changes.length, v2.changes.length);

  return (
    <div style={{ fontFamily: FONT }} className="flex flex-col">
      {/* ── Summary Bar ── */}
      <div
        className="rounded-t-lg border border-border"
        style={{ backgroundColor: "#F8FAFC" }}
      >
        <div style={{ padding: "12px 16px" }}>
          {/* Top row: title + stats + close */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={onClose}
              style={{
                height: "32px", padding: "0 10px", fontSize: "13px", fontWeight: 500,
                color: "#6B7280", backgroundColor: "#FFFFFF", border: "1px solid #E5E7EB",
                borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
                fontFamily: FONT, lineHeight: "1"
              }}
            >
              <ArrowLeft style={{ width: "13px", height: "13px" }} />
              Back
            </button>

            <div style={{ width: "1px", height: "22px", backgroundColor: "#E5E7EB" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ArrowLeftRight style={{ width: "15px", height: "15px", color: "#3B82F6" }} />
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                V{v1.version} → V{v2.version}
              </span>
            </div>

            {/* Stats pills — neutral gray */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", padding: "3px 8px", backgroundColor: "#F3F4F6", borderRadius: "4px", border: "1px solid #E5E7EB" }}>
                {stats.total} change{stats.total !== 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Show only differences toggle */}
            <button
              onClick={() => setShowOnlyDiffs(!showOnlyDiffs)}
              style={{
                height: "28px", padding: "0 10px", fontSize: "12px", fontWeight: 500,
                color: showOnlyDiffs ? "#1B6EF3" : "#6B7280",
                backgroundColor: showOnlyDiffs ? "#EFF6FF" : "#FFFFFF",
                border: `1px solid ${showOnlyDiffs ? "#BFDBFE" : "#E5E7EB"}`,
                borderRadius: "5px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
                fontFamily: FONT, lineHeight: "1"
              }}
            >
              {showOnlyDiffs
                ? <Eye style={{ width: "12px", height: "12px" }} />
                : <EyeOff style={{ width: "12px", height: "12px" }} />
              }
              {showOnlyDiffs ? "Diffs only" : "Show all"}
            </button>
          </div>

          {/* Filter pills row */}
          <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "10px" }}>
            {filterTabs.map(f => {
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    height: "28px", padding: "0 10px", fontSize: "12px", fontWeight: 500,
                    color: isActive ? "#1B6EF3" : "#6B7280",
                    backgroundColor: isActive ? "#E7F3FF" : "transparent",
                    border: `1px solid ${isActive ? "#1B6EF3" : "#E2E8F0"}`,
                    borderRadius: "14px", cursor: "pointer", fontFamily: FONT, lineHeight: "1"
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="border-x border-b border-border rounded-b-lg" style={{ backgroundColor: "#FFFFFF" }}>

        {/* ── Section: Summary Fields (3-column table) ── */}
        {(activeFilter === "all" || activeFilter === "pricing" || activeFilter === "config") && (
          <div style={{ padding: "18px 16px 0" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              Summary
            </div>
            <div style={{ borderRadius: "8px", border: "1px solid #E5E7EB", overflow: "hidden" }}>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1fr) minmax(100px, 1.5fr) minmax(100px, 1.5fr)", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                <div style={{ padding: "10px 16px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px" }}>Field</span>
                </div>
                <div style={{ padding: "10px 16px", borderLeft: "1px solid #E5E7EB" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1F2937" }}>V{v1.version}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", backgroundColor: v1Cfg.bg, color: v1Cfg.color }}>
                      <V1Icon style={{ width: "9px", height: "9px" }} />{v1Cfg.label}
                    </span>
                  </div>
                </div>
                <div style={{ padding: "10px 16px", borderLeft: "1px solid #E5E7EB" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1F2937" }}>V{v2.version}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", backgroundColor: v2Cfg.bg, color: v2Cfg.color }}>
                      <V2Icon style={{ width: "9px", height: "9px" }} />{v2Cfg.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Field rows */}
              {filteredFields.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "#9CA3AF" }}>
                  {showOnlyDiffs ? "No differences in summary fields" : "No fields to display"}
                </div>
              ) : (
                filteredFields.map((f, idx) => {
                  const changed = f.val1 !== f.val2;
                  const isEven = idx % 2 === 0;
                  return (
                    <div
                      key={f.label}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(120px, 1fr) minmax(100px, 1.5fr) minmax(100px, 1.5fr)",
                        borderBottom: "1px solid #F3F4F6",
                        backgroundColor: isEven ? "#FFFFFF" : "#F9FAFB",
                        borderLeft: changed ? "3px solid #D1D5DB" : "3px solid transparent",
                      }}
                    >
                      <div style={{ padding: "10px 16px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#6B7280" }}>{f.label}</span>
                      </div>
                      <div style={{ padding: "10px 16px", borderLeft: "1px solid #F3F4F6" }}>
                        <span style={{
                          fontSize: "14px", fontWeight: 500,
                          color: "#6B7280",
                          textDecoration: changed ? "line-through" : "none",
                        }}>
                          {f.node1 ?? f.val1}
                        </span>
                      </div>
                      <div style={{ padding: "10px 16px", borderLeft: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 500, color: "#111827" }}>
                          {f.node2 ?? f.val2}
                        </span>
                        {changed && <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#3B82F6", flexShrink: 0 }} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Section: Line Items — Side-by-Side ── */}
        {(activeFilter === "all" || activeFilter === "line-items") && (
          <div style={{ padding: "18px 16px 0" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              Line Items
            </div>

            {filteredItemIds.length === 0 ? (
              <div style={{ padding: "28px", textAlign: "center", fontSize: "13px", color: "#9CA3AF", border: "1px solid #E5E7EB", borderRadius: "8px" }}>
                {showOnlyDiffs ? "No differences in line items" : "No line items to display"}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* V1 Table */}
                <LineItemsTable
                  version={v1}
                  cfg={v1Cfg}
                  Icon={V1Icon}
                  itemIds={filteredItemIds}
                  itemMap={v1Map}
                  getDiffStatus={getDiffStatus}
                  side="left"
                  viewMode={viewMode}
                />
                {/* V2 Table */}
                <LineItemsTable
                  version={v2}
                  cfg={v2Cfg}
                  Icon={V2Icon}
                  itemIds={filteredItemIds}
                  itemMap={v2Map}
                  getDiffStatus={getDiffStatus}
                  side="right"
                  viewMode={viewMode}
                />
              </div>
            )}
          </div>
        )}


        {/* ── Section: Changes Log — Side-by-Side ── */}
        {(activeFilter === "all") && (v1.changes.length > 0 || v2.changes.length > 0) && (
          <div style={{ padding: "18px 16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
              Changes Log
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* V1 Changes */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Changes in V{v1.version}</span>
                  <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: 500 }}>({v1.changes.length})</span>
                </div>
                {Array.from({ length: maxChanges }).map((_, idx) => {
                  const change = v1.changes[idx];
                  if (!change) {
                    return (
                      <div key={`v1-empty-${idx}`} style={{ padding: "10px 14px", backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB", borderBottom: "1px solid #F3F4F6", minHeight: "44px", display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: "13px", color: "#D1D5DB", fontStyle: "italic" }}>—</span>
                      </div>
                    );
                  }
                  return <ChangeEntry key={change.id} change={change} isEven={idx % 2 === 0} />;
                })}
              </div>
              {/* V2 Changes */}
              <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Changes in V{v2.version}</span>
                  <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: 500 }}>({v2.changes.length})</span>
                </div>
                {Array.from({ length: maxChanges }).map((_, idx) => {
                  const change = v2.changes[idx];
                  if (!change) {
                    return (
                      <div key={`v2-empty-${idx}`} style={{ padding: "10px 14px", backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB", borderBottom: "1px solid #F3F4F6", minHeight: "44px", display: "flex", alignItems: "center" }}>
                        <span style={{ fontSize: "13px", color: "#D1D5DB", fontStyle: "italic" }}>—</span>
                      </div>
                    );
                  }
                  return <ChangeEntry key={change.id} change={change} isEven={idx % 2 === 0} />;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bottom padding if no changes section */}
        {(activeFilter !== "all" || (v1.changes.length === 0 && v2.changes.length === 0)) && (
          <div style={{ height: "18px" }} />
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function LineItemsTable({
  version, cfg, Icon, itemIds, itemMap, getDiffStatus, side, viewMode = "base",
}: {
  version: POVersionEntry;
  cfg: { label: string; bg: string; color: string };
  Icon: React.ElementType;
  itemIds: string[];
  itemMap: Map<string, POLineItemSnapshot>;
  getDiffStatus: (id: string) => DiffStatus;
  side: "left" | "right";
  viewMode?: "base" | "partner";
}) {
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: "8px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Package style={{ width: "13px", height: "13px", color: "#6B7280" }} />
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>V{version.version} Line Items</span>
          <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: 500 }}>({version.snapshot.lineItems?.length || 0})</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", backgroundColor: cfg.bg, color: cfg.color }}>
          <Icon style={{ width: "9px", height: "9px" }} />{cfg.label}
        </span>
      </div>
      {/* Column headers */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", backgroundColor: "#F7F8F9", borderBottom: "1px solid #E5E7EB" }}>
        <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: "11px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px" }}>Item</span></div>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0, width: "48px", textAlign: "right" }}>Qty</span>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0, width: "48px", textAlign: "center" }}>UOM</span>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0, width: "80px", textAlign: "right" }}>Price</span>
        <span style={{ fontSize: "11px", fontWeight: 500, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.5px", flexShrink: 0, width: "80px", textAlign: "right" }}>Total</span>
      </div>
      {/* Rows */}
      {itemIds.map(id => {
        const status = getDiffStatus(id);
        const li = itemMap.get(id);
        return <LineItemRow key={id} li={li || null} status={status} side={side} version={version} viewMode={viewMode} />;
      })}
      {/* Total footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "8px 14px", borderTop: "1px solid #E5E7EB", backgroundColor: "#F9FAFB" }}>
        <span style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.3px", marginRight: "10px" }}>Total</span>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#1F2937" }}>
          <VersionAmount amountPKR={version.snapshot.total} version={version} viewMode={viewMode} />
        </span>
      </div>
    </div>
  );
}

function LineItemRow({ li, status, side, version, viewMode = "base" }: { li: POLineItemSnapshot | null; status: DiffStatus; side: "left" | "right"; version: POVersionEntry; viewMode?: "base" | "partner" }) {
  const isRemoved = status === "removed" || (side === "left" && status === "modified");
  const isAdded = status === "added";
  const rowBg = isAdded ? "#F8FAFC" : "#FFFFFF";
  const textDecoration = (side === "left" && (status === "removed")) ? "line-through" : "none";
  const textColor = (side === "left" && status === "removed") ? "#9CA3AF" : "#374151";

  if (!li) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", backgroundColor: "#F9FAFB", borderBottom: "1px solid #F3F4F6", opacity: 0.4 }}>
        <div style={{ flex: 1, fontSize: "13px", color: "#D1D5DB", fontStyle: "italic" }}>—</div>
      </div>
    );
  }

  const isChanged = status === "modified";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 14px", backgroundColor: rowBg, borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#6B7280", lineHeight: "1.2", marginBottom: "2px", textDecoration }}>{li.itemNumber}</div>
        <div style={{ fontSize: "13px", color: textColor, lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration }}>{li.descriptiveName}</div>
      </div>
      <span style={{ fontSize: "13px", color: "#6B7280", fontWeight: 400, flexShrink: 0, width: "48px", textAlign: "right", textDecoration }}>{li.vendorQty}</span>
      <span style={{ fontSize: "13px", color: "#9CA3AF", flexShrink: 0, width: "48px", textAlign: "center", textDecoration }}>{li.vendorUOM}</span>
      <span style={{ fontSize: "13px", color: "#9CA3AF", fontWeight: 400, flexShrink: 0, width: "80px", textAlign: "right", textDecoration }}>
        <VersionAmount amountPKR={li.unitPrice} version={version} viewMode={viewMode} />
      </span>
      <span style={{ fontSize: "13px", fontWeight: 600, color: textColor, flexShrink: 0, width: "80px", textAlign: "right", textDecoration }}>
        <VersionAmount amountPKR={li.lineTotal} version={version} viewMode={viewMode} />
      </span>
    </div>
  );
}

function ChangeEntry({ change, isEven }: { change: POChangeRecord; isEven: boolean }) {
  const ct = changeTypeConfig[change.type] || changeTypeConfig["config-changed"];
  const CIcon = ct.icon;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 14px", backgroundColor: isEven ? "#FFFFFF" : "#F9FAFB", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ width: "22px", height: "22px", borderRadius: "5px", backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
        <CIcon style={{ width: "11px", height: "11px", color: "#9CA3AF" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#1F2937", lineHeight: "1.4" }}>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "#9CA3AF", marginRight: "5px" }}>
            {change.action}:
          </span>
          {change.subject}
        </div>
        {change.detail && (
          <div style={{ fontSize: "12px", color: "#9CA3AF", lineHeight: "1.3", marginTop: "2px" }}>{change.detail}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
        <UserHoverCard name={change.user}>
          <div style={{ width: "18px", height: "18px", borderRadius: "50%", backgroundColor: getUserColor(change.user), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: 700, color: "#FFFFFF", cursor: "pointer" }}>
            {getUserInitials(change.user)}
          </div>
        </UserHoverCard>
        <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{change.timestamp}</span>
      </div>
    </div>
  );
}
