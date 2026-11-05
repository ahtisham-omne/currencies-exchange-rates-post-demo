import { useMemo } from "react";
import {
  X,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus,
  Pencil,
} from "lucide-react";
import { FONT } from "./designTokens";
import type { POVersionEntry, POChangeRecord } from "./poStore";
import { versionStatusConfig, formatCurrency } from "./poVersionDisplay";
import { snapshotOneTimeNet } from "./poOrderPricing";

/**
 * PO version comparison — inline SO-parity view.
 *
 * Ported from Sales-Order-V5 `VersionHistoryTab.tsx`'s `CompareView` so the
 * two modules read as siblings visually. Renders directly below the version
 * list when the buyer picks two versions and clicks the `Compare V{a} ↔ V{b}`
 * CTA. Layout is:
 *
 *   · Header — muted background strip with the swap icon + "Comparing
 *              V{a} ↔ V{b}" title and a close button on the right.
 *   · Summary grid — two cards side-by-side. Each card has a header row
 *              (V{n} · date · status pill) and a two-column FIELD | VALUE
 *              table with amber left-rail highlight on changed rows and
 *              up/down arrows on numeric deltas.
 *   · Changes grid — two cards side-by-side. Each card has "Changes in
 *              V{n}" + count in the header, then a list of change rows
 *              with an action-tinted icon chip + subject + subject-detail
 *              + detail + right-side timestamp.
 *
 * Colors mirror SO's palette exactly. `POCompareFullScreen` kept as the
 * default export so its lone caller (`POVersionHistoryTab`) doesn't need
 * to change; the "FullScreen" suffix is historical — the view is inline.
 */

interface POCompareFullScreenProps {
  v1: POVersionEntry;
  v2: POVersionEntry;
  onClose: () => void;
}

/* Change-kind config (icon + colour tone). Three entries only — icon +
   colour come from `change.action`, never from `change.type`. Mirrors
   SO `VersionHistoryTab.tsx`'s local `changeKindConfig` block. */
type ChangeAction = POChangeRecord["action"];
const CHANGE_KIND: Record<
  ChangeAction,
  { icon: typeof Plus; color: string; bg: string }
> = {
  Added: { icon: Plus, color: "hsl(var(--success))", bg: "rgba(5, 150, 105, 0.15)" },
  Removed: {
    icon: Minus,
    color: "hsl(var(--destructive))",
    bg: "rgba(220, 38, 38, 0.15)",
  },
  Changed: { icon: Pencil, color: "hsl(var(--warning))", bg: "rgba(217, 119, 6, 0.15)" },
};

export default function POCompareFullScreen({
  v1,
  v2,
  onClose,
}: POCompareFullScreenProps) {
  const fields = useMemo(
    () => [
      {
        label: "Line Items",
        val1: String(v1.snapshot.lineItemCount),
        val2: String(v2.snapshot.lineItemCount),
      },
      {
        label: "Subtotal",
        val1: formatCurrency(v1.snapshot.subtotal),
        val2: formatCurrency(v2.snapshot.subtotal),
      },
      {
        label: "Discount",
        val1: formatCurrency(v1.snapshot.discountTotal),
        val2: formatCurrency(v2.snapshot.discountTotal),
      },
      {
        label: "One-Time Discounts/Premiums",
        val1: (() => { const n = snapshotOneTimeNet(v1.snapshot); return `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatCurrency(Math.abs(n))}`; })(),
        val2: (() => { const n = snapshotOneTimeNet(v2.snapshot); return `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatCurrency(Math.abs(n))}`; })(),
      },
      {
        label: "Total",
        val1: formatCurrency(v1.snapshot.total),
        val2: formatCurrency(v2.snapshot.total),
      },
    ],
    [v1, v2],
  );

  const v1Cfg =
    versionStatusConfig[v1.versionStatus] || versionStatusConfig["confirmed"];
  const v2Cfg =
    versionStatusConfig[v2.versionStatus] || versionStatusConfig["confirmed"];

  const renderSummaryCard = (v: POVersionEntry, side: "left" | "right") => {
    const cfg = side === "left" ? v1Cfg : v2Cfg;
    const dateLabel = (() => {
      const raw = v.createdAt;
      if (!raw) return "—";
      try {
        return new Date(raw).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        });
      } catch {
        return raw;
      }
    })();
    return (
      <div
        style={{
          border: "1px solid hsl(var(--border))",
          borderRadius: 8,
          overflow: "hidden",
          fontFamily: FONT,
        }}
      >
        {/* Card header — V{n} · date + status pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            backgroundColor: "#FAFBFC",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "hsl(var(--muted-foreground))",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            V{v.version} · {dateLabel}
          </span>
          <span
            className="inline-flex items-center rounded-full whitespace-nowrap"
            style={{
              padding: "2px 10px",
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.4,
              backgroundColor: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.border}`,
            }}
          >
            {cfg.label}
          </span>
        </div>
        {/* Column-header row — FIELD | VALUE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr",
            padding: "6px 12px",
            backgroundColor: "#FAFBFC",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "hsl(var(--muted-foreground))",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Field
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "hsl(var(--muted-foreground))",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Value
          </span>
        </div>
        {/* Field rows */}
        {fields.map((f) => {
          const val = side === "left" ? f.val1 : f.val2;
          const changed = f.val1 !== f.val2;
          const n1 = Number(String(f.val1).replace(/[^0-9.-]/g, ""));
          const n2 = Number(String(f.val2).replace(/[^0-9.-]/g, ""));
          const numeric =
            changed && Number.isFinite(n1) && Number.isFinite(n2) && n1 !== n2;
          const direction =
            numeric && side === "right" ? (n2 > n1 ? "up" : "down") : null;
          const isStruck = changed && side === "left" && !numeric;
          return (
            <div
              key={f.label}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr",
                padding: "10px 12px",
                borderBottom: "1px solid hsl(var(--border))",
                backgroundColor: changed
                  ? "rgba(245, 158, 11, 0.04)"
                  : "hsl(var(--card))",
                borderLeft: changed ? "3px solid #F59E0B" : "3px solid transparent",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                {f.label}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: side === "right" && changed ? 600 : 500,
                    color:
                      side === "right" && changed
                        ? "#0F172A"
                        : changed
                          ? "hsl(var(--muted-foreground))"
                          : "hsl(var(--foreground))",
                    textDecoration: isStruck ? "line-through" : "none",
                    textDecorationColor: "rgba(107, 114, 128, 0.4)",
                  }}
                >
                  {val}
                </span>
                {direction === "up" && (
                  <ArrowUp
                    style={{ width: 12, height: 12, color: "hsl(var(--success))" }}
                    strokeWidth={2.5}
                  />
                )}
                {direction === "down" && (
                  <ArrowDown
                    style={{ width: 12, height: 12, color: "hsl(var(--destructive))" }}
                    strokeWidth={2.5}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderChangeRow = (change: POChangeRecord) => {
    const ct = CHANGE_KIND[change.action];
    const CIcon = ct.icon;
    return (
      <div
        key={change.id}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid hsl(var(--border))",
          fontFamily: FONT,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            backgroundColor: ct.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <CIcon style={{ width: 11, height: 11, color: ct.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "hsl(var(--foreground))",
              lineHeight: 1.3,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: ct.color,
                marginRight: 4,
              }}
            >
              {change.action}:
            </span>
            {change.subject}
            {change.itemRef && (
              <span
                style={{
                  fontSize: 10,
                  color: "hsl(var(--muted-foreground))",
                  marginLeft: 3,
                }}
              >
                on {change.itemRef}
              </span>
            )}
          </div>
          {change.subjectDetail && (
            <div
              style={{
                fontSize: 10,
                color: "hsl(var(--muted-foreground))",
                lineHeight: 1.3,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {change.subjectDetail}
            </div>
          )}
          {change.detail && (
            <div
              style={{
                fontSize: 10,
                color: "hsl(var(--muted-foreground))",
                lineHeight: 1.3,
                marginTop: 1,
              }}
            >
              {change.detail}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            color: "hsl(var(--muted-foreground))",
            flexShrink: 0,
            marginTop: 3,
            whiteSpace: "nowrap",
          }}
        >
          {change.timestamp}
        </span>
      </div>
    );
  };

  const renderChangesCard = (v: POVersionEntry) => (
    <div
      style={{
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          backgroundColor: "hsl(var(--muted))",
          borderBottom: "1px solid hsl(var(--border))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "hsl(var(--muted-foreground))",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Changes in V{v.version}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "hsl(var(--muted-foreground))",
            fontWeight: 500,
          }}
        >
          ({v.changes.length})
        </span>
      </div>
      {v.changes.length === 0 ? (
        <div style={{ padding: "24px 12px", textAlign: "center" }}>
          <span
            style={{
              fontSize: 11,
              color: "hsl(var(--muted-foreground))",
              fontStyle: "italic",
            }}
          >
            No changes recorded
          </span>
        </div>
      ) : (
        v.changes.map(renderChangeRow)
      )}
    </div>
  );

  return (
    <div
      style={{
        backgroundColor: "hsl(var(--card))",
        borderRadius: 8,
        border: "1px solid hsl(var(--border))",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      {/* Header — muted strip with swap icon + title + close */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          backgroundColor: "hsl(var(--muted))",
          borderBottom: "1px solid hsl(var(--border))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ArrowLeftRight
            style={{ width: 14, height: 14, color: "hsl(var(--primary))" }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "hsl(var(--foreground))",
              lineHeight: 1,
            }}
          >
            Comparing V{v1.version} ↔ V{v2.version}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close compare view"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X
            style={{ width: 14, height: 14, color: "hsl(var(--muted-foreground))" }}
          />
        </button>
      </div>

      {/* Body — summary grid + changes grid, side by side */}
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {renderSummaryCard(v1, "left")}
          {renderSummaryCard(v2, "right")}
        </div>
        {(v1.changes.length > 0 || v2.changes.length > 0) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 12,
            }}
          >
            {renderChangesCard(v1)}
            {renderChangesCard(v2)}
          </div>
        )}
      </div>
    </div>
  );
}
