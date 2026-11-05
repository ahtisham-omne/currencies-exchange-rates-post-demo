import { Edit } from "lucide-react";
import { FONT } from "./designTokens";
import type { POChangeRecord } from "./poStore";
import UserHoverCard from "./UserHoverCard";
import {
  changeTypeConfig,
  versionPalette as C,
  getUserColor,
  getUserInitials,
} from "./poVersionDisplay";

/**
 * Changes list — the per-change rows shown under a version's snapshot.
 *
 * Extracted from POVersionHistoryTab.tsx (was inline lines ~529-593 of the
 * original 774-LOC file) as part of the 2026-07-10 component split.
 *
 * When `versionNumber === 1` the header reads "Creation Summary" and
 * every "Changed" action reads as "Set" — this is how the very first
 * version's fields (which have no prior value to change from) are shown.
 * All later versions read as a plain "Changes" diff.
 */
interface POVersionChangeListProps {
  changes: POChangeRecord[];
  versionNumber: number;
}

export default function POVersionChangeList({
  changes,
  versionNumber,
}: POVersionChangeListProps) {
  if (changes.length === 0) {
    return (
      <div
        style={{
          fontSize: 12,
          color: C.text400,
          fontStyle: "italic",
          lineHeight: 1,
          fontFamily: FONT,
        }}
      >
        No recorded changes in this version
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center pb-2 mb-2.5 border-b"
        style={{ gap: 8, borderColor: C.border }}
      >
        <Edit style={{ width: 12, height: 12, color: C.text500 }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.text500,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            lineHeight: 1,
            fontFamily: FONT,
          }}
        >
          {versionNumber === 1 ? "Creation Summary" : "Changes"}
        </span>
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
          {changes.length}
        </span>
      </div>
      <div className="flex flex-col">
        {changes.map((change, cidx) => {
          const ct = changeTypeConfig[change.type] ?? changeTypeConfig["config-changed"];
          const CIcon = ct.icon;
          const userInitials = change.initials ?? getUserInitials(change.user);
          const userColor = getUserColor(change.user);
          const actionColor =
            change.action === "Added"
              ? "#065F46"
              : change.action === "Removed"
                ? "#991B1B"
                : "#92400E";
          return (
            <div
              key={change.id}
              className="flex items-start py-2"
              style={{
                gap: 10,
                borderTop: cidx > 0 ? `1px solid ${C.divider}` : "none",
              }}
            >
              {/* Change-type icon tile — Partners chip recipe with 1px border */}
              <div
                className="flex items-center justify-center shrink-0 rounded-md border"
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: ct.bg,
                  borderColor: ct.border,
                  marginTop: 1,
                }}
              >
                <CIcon style={{ width: 12, height: 12, color: ct.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="flex items-baseline flex-wrap"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: C.text900,
                    lineHeight: 1.4,
                    fontFamily: FONT,
                    gap: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: actionColor,
                      marginRight: 5,
                      lineHeight: 1,
                      textTransform: "uppercase" as const,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {versionNumber === 1 && change.action === "Changed"
                      ? "Set"
                      : change.action}
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: C.text900,
                      marginRight: 4,
                    }}
                  >
                    {change.subject}
                  </span>
                </div>
                {change.subjectDetail && (
                  <div
                    className="mt-0.5"
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: C.text700,
                      lineHeight: 1.4,
                      fontFamily: FONT,
                    }}
                  >
                    {change.subjectDetail}
                  </div>
                )}
                {change.detail && (
                  <div
                    className="mt-0.5"
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: C.text500,
                      lineHeight: 1.4,
                      fontFamily: FONT,
                    }}
                  >
                    {change.detail}
                  </div>
                )}
              </div>
              <div className="flex items-center shrink-0" style={{ gap: 6 }}>
                <UserHoverCard name={change.user}>
                  <div
                    className="flex items-center justify-center rounded-full cursor-pointer"
                    style={{
                      width: 22,
                      height: 22,
                      backgroundColor: userColor,
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      lineHeight: 1,
                      fontFamily: FONT,
                      boxShadow: "0 1px 2px 0 rgba(0,0,0,0.06)",
                    }}
                  >
                    {userInitials}
                  </div>
                </UserHoverCard>
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: C.text400,
                    lineHeight: 1,
                    fontFamily: FONT,
                  }}
                >
                  {change.timestamp}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
