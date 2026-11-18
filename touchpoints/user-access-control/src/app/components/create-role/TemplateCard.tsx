import { useEffect, useRef, useState } from "react";
import { Check, Eye } from "lucide-react";
import { highlightMatch } from "../../lib/highlight-text";
import { matchingPermissionNames, type RoleTemplate } from "./role-templates";
import { getTemplateDetail, getTemplateStats } from "../../data/role-template-details";
import { LicenseBadge } from "../table-cells";
import { TemplateSummaryModal } from "./TemplateSummaryModal";

/** Same 300ms the tooltips across the module use, so a card's hover lift only
 *  fires on a deliberate hover rather than on a pointer crossing the grid. */
const HOVER_DELAY_MS = 300;

/* ─── TemplateCard ─── */
interface TemplateCardProps {
  template: RoleTemplate;
  isSelected: boolean;
  searchQuery?: string;
  onClick: () => void;
}

export function TemplateCard({
  template: t,
  isSelected,
  searchQuery = "",
  onClick,
}: TemplateCardProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detail = getTemplateDetail(t.permissionIds);
  const stats = detail ? getTemplateStats(detail) : null;
  /* Permission names the current search matched. Shown only when neither the
   *  name nor the description matched, so the card can say why it is here. */
  const permissionHits = matchingPermissionNames(t, searchQuery).filter(
    () =>
      !t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
      !t.description.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const clearHoverTimer = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  useEffect(() => clearHoverTimer, []);

  const restingShadow = "0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(15,23,42,0.05)";
  const hoverShadow = "0 4px 16px -4px rgba(15,23,42,0.12), 0 2px 6px rgba(15,23,42,0.06)";
  const selectedShadow = "0 0 0 1px rgba(10,119,255,0.18), 0 4px 14px rgba(10,119,255,0.10)";

  return (
    <>
      <div
        onClick={onClick}
        onMouseEnter={() => {
          clearHoverTimer();
          hoverTimer.current = setTimeout(() => setIsHovered(true), HOVER_DELAY_MS);
        }}
        onMouseLeave={() => {
          clearHoverTimer();
          setIsHovered(false);
        }}
        className={`group relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer bg-white ${
          isSelected
            ? "border-[#007FFF]"
            : "border-[#E8ECF1] hover:border-[#CBD5E1]"
        }`}
        style={{
          boxShadow: isSelected
            ? selectedShadow
            : isHovered
            ? hoverShadow
            : restingShadow,
        }}
      >
        <div className="px-4 pt-3.5 pb-3 flex-1 flex flex-col">
          {/* 1. Name + description (2-line reserved) */}
          <h4
            className="text-[#0F172A] leading-tight mb-1"
            style={{ fontSize: "13.5px", fontWeight: 600 }}
          >
            {highlightMatch(t.name, searchQuery)}
          </h4>
          <p
            className="text-[#64748B] mb-2.5"
            style={{
              fontSize: "11.5px",
              fontWeight: 400,
              lineHeight: "1.5",
              minHeight: "2.25rem",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={t.description}
          >
            {highlightMatch(t.description, searchQuery)}
          </p>

          {/* 2. License row. The real listing LicenseBadge, so a template reads
           *  the same way a role does in the Roles table: purple for Full
           *  Access, slate for Field User. It carries the template's licence
           *  grouping; the licence the CREATED role ends up needing is always
           *  derived from whatever is checked, which is what the wizard and the
           *  template summary's Requires figure show. */}
          <div className="mb-3">
            <LicenseBadge license={t.group} />
          </div>

          {/* 3. Hero metrics row */}
          <div className="flex items-baseline gap-2 mb-2 mt-auto">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[#475569] tabular-nums leading-none tracking-tight"
                style={{ fontSize: "20px", fontWeight: 600 }}
              >
                {stats?.totalPermissions ?? "-"}
              </span>
              <span
                className="text-[#64748B]"
                style={{ fontSize: "11px", fontWeight: 500 }}
              >
                permissions
              </span>
            </div>
            <span
              aria-hidden="true"
              className="self-center w-0.5 h-5 rounded-full bg-[#F1F5F9]"
            />
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[#475569] tabular-nums leading-none tracking-tight"
                style={{ fontSize: "20px", fontWeight: 600 }}
              >
                {stats?.moduleCount ?? "-"}
              </span>
              <span
                className="text-[#64748B]"
                style={{ fontSize: "11px", fontWeight: 500 }}
              >
                modules
              </span>
            </div>
          </div>

          {/* 4. Licence note, for the sets whose seat is not obvious from the
           *  name: a read-only template can still cost a full seat because the
           *  gates it holds are on administrative modules. Full text on hover,
           *  since the card only has room for two lines. */}
          {t.licenseNote && (
            <p
              className="text-[#94A3B8] mb-1.5"
              style={{
                fontSize: "11px",
                fontWeight: 400,
                lineHeight: "1.45",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
              title={t.licenseNote}
            >
              {t.licenseNote}
            </p>
          )}

          {/* 5. Why this card matched, when the hit was on a permission name
           *  rather than on the template's own name or description. */}
          {permissionHits.length > 0 && (
            <p
              className="text-[#64748B] leading-[1.5]"
              style={{ fontSize: "11px", fontWeight: 400 }}
              title={permissionHits.join(", ")}
            >
              Includes {highlightMatch(permissionHits[0], searchQuery)}
              {permissionHits.length > 1 && ` +${permissionHits.length - 1} more`}
            </p>
          )}
        </div>

        {/* 6. Footer CTAs */}
        <div className="grid grid-cols-2 border-t border-[#E8ECF1]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className={`inline-flex items-center justify-center gap-1.5 py-2.5 text-[12px] transition-colors cursor-pointer border-r border-[#E8ECF1] ${
              isSelected
                ? "bg-[#007FFF] text-white hover:bg-[#0066CC]"
                : "bg-white text-[#007FFF] hover:bg-[#F8FAFC]"
            }`}
            style={{ fontWeight: 550 }}
          >
            <Check className="w-3.5 h-3.5" />
            {isSelected ? "Selected" : "Select"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSummaryOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 text-[12px] bg-white text-[#475569] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <Eye className="w-3.5 h-3.5" />
            View Summary
          </button>
        </div>
      </div>

      {/* Summary modal */}
      <TemplateSummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        template={t}
        onApply={() => {
          onClick();
          setSummaryOpen(false);
        }}
      />
    </>
  );
}
