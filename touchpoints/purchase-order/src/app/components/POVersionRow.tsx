import { ChevronDown, ChevronRight, RotateCcw, Check } from "lucide-react";
import { FONT } from "./designTokens";
import type { POVersionEntry } from "./poStore";
import UserHoverCard from "./UserHoverCard";
import {
  versionPalette as C,
  formatCurrency,
  getUserColor,
  useDocFx,
  versionFx,
} from "./poVersionDisplay";
import { getCurrency } from "@/app/currency/currencies";
import type { PoFx } from "@/app/currency/poFx";
import { CurrencyFlag } from "./currency/CurrencyChip";

/**
 * PO version row header — the clickable strip that opens/collapses the
 * version's expanded body, with avatar, V-number, status pill, Latest tag,
 * change-tag chips, item count + total, and Revert action.
 *
 * Extracted from POVersionHistoryTab.tsx (was inline lines ~222-410 of the
 * original 774-LOC file) as part of the 2026-07-10 component split.
 *
 * Fully controlled — the parent owns expand + compare + revert state and
 * receives clicks via `onClick` / `onRevertClick`. `onClick` is fired for
 * both the compare-select and the expand-toggle cases; the parent decides
 * which to run based on its own `compareMode` flag.
 */
interface POVersionRowProps {
  version: POVersionEntry;
  isExpanded: boolean;
  /** True when this row is the PO's current version — drives the "Current"
      pill and hides the Revert action for this row. */
  isCurrent: boolean;
  compareMode: boolean;
  isCompareSelected: boolean;
  onClick: () => void;
  /** Omitted when the PO is version-locked (receiving started). */
  onRevertClick?: () => void;
  /** The version's currency differs from an adjacent version's: mark
      the total with its flag + code. */
  showCurrency?: boolean;
  /** The PO's current currency, for snapshots that recorded none.
      Defaults to the PO page's (DocCurrency). */
  fallbackFx?: PoFx | null;
}

export default function POVersionRow({
  version: ver,
  isExpanded,
  isCurrent,
  compareMode,
  isCompareSelected,
  onClick,
  onRevertClick,
  showCurrency = false,
  fallbackFx,
}: POVersionRowProps) {
  const docFx = useDocFx();
  const code = versionFx(ver.snapshot, fallbackFx ?? docFx).currency;
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-150"
      style={{
        backgroundColor: isCompareSelected
          ? "#EFF6FF"
          : isExpanded
            ? C.muted
            : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!isExpanded && !isCompareSelected) {
          e.currentTarget.style.backgroundColor =
            "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded && !isCompareSelected) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      {/* Checkbox (compare mode) or Chevron (idle mode) */}
      {compareMode ? (
        <div
          className="flex items-center justify-center shrink-0 transition-all duration-150"
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: isCompareSelected ? "none" : `1.5px solid ${C.text400}`,
            backgroundColor: isCompareSelected ? "hsl(var(--primary))" : "#FFFFFF",
          }}
        >
          {isCompareSelected && (
            <Check style={{ width: 10, height: 10, color: "#FFFFFF" }} strokeWidth={3} />
          )}
        </div>
      ) : isExpanded ? (
        <ChevronDown
          style={{ width: 14, height: 14, color: C.text400 }}
          className="shrink-0"
        />
      ) : (
        <ChevronRight
          style={{ width: 14, height: 14, color: C.text400 }}
          className="shrink-0"
        />
      )}

      {/* Avatar — 30×30 with Partners-style gradient. Initials font
          bumped 10→11 and weight kept 700 for legibility. */}
      <UserHoverCard name={ver.createdBy}>
        <div
          className="flex items-center justify-center rounded-full shrink-0 cursor-pointer"
          style={{
            width: 30,
            height: 30,
            backgroundColor: getUserColor(ver.createdBy),
            fontSize: 11,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: FONT,
            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.06)",
          }}
        >
          {ver.avatar}
        </div>
      </UserHoverCard>

      {/* Version info */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Top line — V{n} + Current + · date · author. Status pill
            + Revert-from pill dropped 2026-07-28 to match SO's tab
            (buyer: "we only need to show current version nothing
            else"). vsCfg / VSIcon are still exported from
            poVersionDisplay for the expanded body but are not
            rendered on the header row itself. */}
        <div
          className="flex items-center flex-wrap mb-1.5"
          style={{ gap: 6 }}
        >
          <span
            className="tabular-nums shrink-0"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.text900,
              lineHeight: 1,
              fontFamily: FONT,
            }}
          >
            V{ver.version}
          </span>
          {isCurrent && (
            <span
              className="inline-flex items-center rounded-md border shrink-0"
              style={{
                padding: "1px 6px",
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: "hsl(var(--primary-tint))",
                color: "hsl(var(--primary))",
                borderColor: "hsl(var(--primary))",
                lineHeight: 1.4,
                fontFamily: FONT,
              }}
            >
              Current Version
            </span>
          )}
          <span
            style={{ fontSize: 11, color: C.text400, lineHeight: 1, fontFamily: FONT }}
            className="shrink-0"
          >
            ·
          </span>
          <span
            className="tabular-nums shrink-0"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: C.text500,
              lineHeight: 1,
              fontFamily: FONT,
            }}
          >
            {new Date(ver.createdAt).toLocaleDateString("en-US", {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            })}
          </span>
          <span
            style={{ fontSize: 11, color: C.text400, lineHeight: 1, fontFamily: FONT }}
            className="shrink-0"
          >
            ·
          </span>
          <span
            className="shrink-0"
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: C.text600,
              lineHeight: 1,
              fontFamily: FONT,
            }}
          >
            {ver.createdBy}
          </span>
        </div>

        {/* Status-reset line — only rendered when the version marks a
            lifecycle transition (e.g. Sent → Draft on revert). The
            free-text reason was intentionally removed 2026-07-22:
            change tags below already surface what changed, and the
            reason was adding noise (buyer feedback). */}
        {ver.previousStatus &&
          ver.newStatus &&
          ver.previousStatus !== ver.newStatus && (
            <div
              className="overflow-hidden text-ellipsis whitespace-nowrap"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#92400E",
                lineHeight: 1.4,
                fontFamily: FONT,
                maxWidth: "100%",
              }}
            >
              Reset from {ver.previousStatus} → {ver.newStatus}
            </div>
          )}

        {/* Change tags moved to the expanded body — the row header is
            now V{n} + Current + · date · author only (SO parity). */}
      </div>

      {/* Snapshot badges — items count chip + total */}
      <div className="flex items-center shrink-0" style={{ gap: 10 }}>
        <span
          className="inline-flex items-center rounded-md tabular-nums"
          style={{
            padding: "1px 6px",
            backgroundColor: C.divider,
            color: C.text600,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: FONT,
            lineHeight: 1.4,
          }}
        >
          {ver.snapshot.lineItemCount}{" "}
          {ver.snapshot.lineItemCount === 1 ? "item" : "items"}
        </span>
        {/* Currency chip — only where the currency changed between
            versions; same recipe as the items chip. */}
        {showCurrency && (
          <span
            className="inline-flex items-center rounded-md"
            title={`In ${getCurrency(code)?.name ?? code}`}
            style={{
              gap: 4,
              padding: "1px 6px",
              backgroundColor: C.divider,
              color: C.text600,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: FONT,
              lineHeight: 1.4,
            }}
          >
            <CurrencyFlag code={code} size={10} />
            {code}
          </span>
        )}
        <span
          className="tabular-nums"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: C.text900,
            lineHeight: 1,
            fontFamily: FONT,
          }}
        >
          {formatCurrency(ver.snapshot.total, code)}
        </span>
      </div>

      {/* Revert — Partners action-button recipe (32×32 muted icon with
          hover:bg-muted/60). Same as line-items row actions. Shown for any
          non-current version when we're not in compare mode — reverting is
          allowed from any status (draft / sent / confirmed etc). */}
      {!compareMode && !isCurrent && onRevertClick && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRevertClick();
          }}
          title="Revert to this version"
          aria-label="Revert to this version"
          className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 cursor-pointer transition-colors duration-150 hover:bg-muted/60"
          style={{ border: "none", backgroundColor: "transparent", color: C.text500 }}
        >
          <RotateCcw style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );
}
