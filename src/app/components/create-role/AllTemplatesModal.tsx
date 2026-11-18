import { useState, useMemo, useEffect } from "react";
import { X, Search, Maximize2, Minimize2 } from "lucide-react";
import { ModalShell } from "../shared/ModalShell";
import { TemplateCard } from "./TemplateCard";
import {
  ALL_ROLE_TEMPLATES,
  templateMatchesQuery,
  type RoleTemplate,
} from "./role-templates";

interface AllTemplatesModalProps {
  open: boolean;
  onClose: () => void;
  /** Currently selected template name from the parent (for syncing initial state) */
  selectedTemplateName?: string | null;
  /** Called when user clicks Continue with a template selected */
  onApply: (template: RoleTemplate) => void;
}

export function AllTemplatesModal({
  open,
  onClose,
  selectedTemplateName,
  onApply,
}: AllTemplatesModalProps) {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(selectedTemplateName ?? null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedName(selectedTemplateName ?? null);
      setIsFullScreen(false);
    }
  }, [open, selectedTemplateName]);

  /* One flat A to Z list, no sections and no filter chips. Each card carries its
   * own licence chip, so splitting the library by licence would only add a
   * heading for something already on the card. Search covers template name,
   * description, and permission name. */
  const filtered = useMemo(
    () => ALL_ROLE_TEMPLATES.filter((t) => templateMatchesQuery(t, search)),
    [search]
  );

  const handleApply = () => {
    const t = ALL_ROLE_TEMPLATES.find((x) => x.name === selectedName);
    if (t) onApply(t);
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose} z={70}>
      <div
        className="bg-white flex flex-col overflow-hidden transition-[max-width,max-height,border-radius] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          width: "100vw",
          height: "100vh",
          maxWidth: isFullScreen ? "calc(100vw - 2rem)" : "1280px",
          maxHeight: isFullScreen ? "calc(100vh - 2rem)" : "min(860px, calc(100vh - 48px))",
          borderRadius: "16px",
          boxShadow:
            "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="px-4 lg:px-5 pt-4 pb-3 shrink-0 bg-white border-b border-[#EEF2F6]"
          style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] sm:text-[17px] text-[#0F172A]" style={{ fontWeight: 700 }}>
                Browse Role Templates
              </h2>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5" style={{ fontWeight: 400 }}>
                Pick a template to pre-fill role details and permissions. You can fine-tune everything later.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[#E2E8F0] bg-white text-xs text-[#475569] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFullScreen ? "Exit full" : "Full view"}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto bg-[#FAFBFC] px-4 lg:px-5 py-4 scrollbar-hide">
          {/* Search row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-full sm:w-1/2 max-w-[50%]">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "#CBD5E1" }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full h-9 pl-9 pr-3 border border-[#E2E8F0] rounded-[8px] text-sm text-[#0F172A] bg-white shadow-xs focus:outline-none focus:ring-1 focus:ring-[#007FFF]/20 focus:border-[#007FFF] transition-all placeholder:text-[#94A3B8]"
              />
            </div>
          </div>

          {/* One A to Z grid of every template */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-[12.5px] text-[#94A3B8]">
              No templates match "{search.trim()}"
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isSelected={selectedName === t.name}
                  searchQuery={search}
                  onClick={() => {
                    /* Selecting a card only marks it. Nothing is applied until
                     * Continue, so the admin can compare cards, open a summary,
                     * and change their mind without the library closing under
                     * them. Clicking the selected card clears the selection. */
                    setSelectedName(selectedName === t.name ? null : t.name);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-4 lg:px-5 py-3 shrink-0 bg-white border-t border-[#EEF2F6] flex items-center justify-between gap-3" style={{ borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
          <div className="text-[12px] text-[#64748B]" style={{ fontWeight: 450 }}>
            {filtered.length} of {ALL_ROLE_TEMPLATES.length} template{ALL_ROLE_TEMPLATES.length !== 1 ? "s" : ""}
            {selectedName && (
              <span className="ml-2 text-[#007FFF]" style={{ fontWeight: 500 }}>
                · {selectedName} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13px] text-[#334155] transition-colors cursor-pointer"
              style={{ fontWeight: 500 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!selectedName}
              className="h-9 px-5 rounded-[8px] bg-[#007FFF] hover:bg-[#0066D6] text-white text-[13px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              style={{ fontWeight: 600 }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
