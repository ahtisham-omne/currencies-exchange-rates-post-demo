import React from "react";
import { Check, ChevronRight, Info } from "lucide-react";
import type { VendorSubType, ConfigSection } from "./partnerConstants";

/** ── Configuration Sub-page: Unified Profile Sidebar Nav ── */
export function ConfigUnifiedNav({
  subTypes,
  sections,
  selectedSubTypes,
  activeSubTypeTab,
  activeSection,
  onToggleSubType,
  onSetActiveSubType,
  onActiveSectionChange,
}: {
  subTypes: VendorSubType[];
  sections: ConfigSection[];
  selectedSubTypes: Set<string>;
  activeSubTypeTab: string;
  activeSection: string;
  onToggleSubType: (id: string) => void;
  onSetActiveSubType: (id: string) => void;
  onActiveSectionChange: (id: string) => void;
}) {
  const enabledCount = subTypes.filter(s => selectedSubTypes.has(s.id)).length;

  const canDisableSeller = (id: string) => {
    if (id !== "seller_items") return true;
    return enabledCount > 1;
  };

  return (
    <>
      {/* Mobile: horizontal scrollable nav */}
      <div className="sm:hidden shrink-0 border-b border-[#EEF2F6] bg-white overflow-x-auto scrollbar-hide">
        <nav className="flex flex-col">
          <div className="px-3 pt-2 pb-1">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider" style={{ fontWeight: 600 }}>
              Profiles · {enabledCount} active
            </p>
          </div>
          <div className="flex px-3 py-1.5 gap-1.5 min-w-max">
            {subTypes.map((subType) => {
              const isEnabled = selectedSubTypes.has(subType.id);
              const isActive = activeSubTypeTab === subType.id;
              return (
                <button
                  key={subType.id}
                  onClick={() => onSetActiveSubType(subType.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all whitespace-nowrap shrink-0 ${
                    isActive && isEnabled
                      ? "bg-[#EDF4FF] text-[#0A77FF] ring-1 ring-[#0A77FF]/20"
                      : isActive && !isEnabled
                      ? "bg-[#F8FAFC] text-[#475569] ring-1 ring-[#E2E8F0]"
                      : isEnabled
                      ? "text-[#475569] hover:bg-[#F8FAFC]"
                      : "text-[#94A3B8] hover:bg-[#F8FAFC]"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    isActive && isEnabled ? "bg-[#0A77FF] text-white" : isEnabled ? "bg-[#DBEAFE] text-[#0A77FF]" : "bg-[#F1F5F9] text-[#CBD5E1]"
                  }`}>
                    {React.cloneElement(subType.icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
                  </div>
                  <span className="text-xs" style={{ fontWeight: isActive ? 600 : 500 }}>{subType.label}</span>
                  {isEnabled && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-[#0A77FF]/10 text-[#0A77FF]" : "bg-[#DCFCE7] text-[#16A34A]"}`} style={{ fontWeight: 600 }}>ON</span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedSubTypes.has(activeSubTypeTab) && (
            <div className="flex px-3 pb-2 gap-1 min-w-max overflow-x-auto scrollbar-hide border-t border-[#F1F5F9] pt-1.5">
              {sections.map((section) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    onClick={() => onActiveSectionChange(section.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] transition-all whitespace-nowrap ${
                      isActive ? "bg-[#0A77FF] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"
                    }`}
                    style={{ fontWeight: isActive ? 600 : 500 }}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          )}
        </nav>
      </div>

      {/* Desktop: redesigned profile sidebar */}
      <div className="hidden sm:flex sm:flex-col w-[252px] lg:w-[272px] shrink-0 border-r border-[#EEF2F6] bg-white overflow-y-auto">
        <div className="px-3.5 pt-3.5 pb-2 border-b border-[#F1F5F9]">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-[#64748B] uppercase tracking-wider" style={{ fontWeight: 600 }}>Profiles</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EDF4FF] text-[#0A77FF]" style={{ fontWeight: 600 }}>
              {enabledCount} of {subTypes.length} active
            </span>
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Enable profiles to configure vendor capabilities</p>
        </div>

        <nav className="flex flex-col px-1.5 py-2 flex-1 gap-0.5">
          {subTypes.map((subType) => {
            const isEnabled = selectedSubTypes.has(subType.id);
            const isActive = activeSubTypeTab === subType.id;
            const isSeller = subType.id === "seller_items";
            const canToggle = !isSeller || canDisableSeller(subType.id);

            return (
              <div key={subType.id}>
                <div
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
                    isActive
                      ? isEnabled
                        ? "bg-[#EDF4FF] ring-1 ring-[#0A77FF]/15"
                        : "bg-[#F8FAFC] ring-1 ring-[#E2E8F0]"
                      : "hover:bg-[#F8FAFC]"
                  }`}
                  onClick={() => {
                    onSetActiveSubType(subType.id);
                    if (isEnabled) {
                      onActiveSectionChange(sections[0]?.id || activeSection);
                    }
                  }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${
                    isActive && isEnabled
                      ? "bg-[#0A77FF] text-white shadow-sm"
                      : isEnabled
                      ? "bg-[#DBEAFE] text-[#0A77FF]"
                      : "bg-[#F1F5F9] text-[#94A3B8]"
                  }`}>
                    {React.cloneElement(subType.icon as React.ReactElement, { className: "w-4 h-4" })}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className={`block text-[13px] truncate transition-colors duration-150 ${
                      isActive ? "text-[#0F172A]" : isEnabled ? "text-[#1E293B]" : "text-[#64748B] group-hover:text-[#334155]"
                    }`} style={{ fontWeight: isActive ? 600 : isEnabled ? 500 : 400 }}>
                      {subType.label}
                    </span>
                    <span className={`text-[10px] ${isEnabled ? "text-[#16A34A]" : "text-[#94A3B8]"}`} style={{ fontWeight: 500 }}>
                      {isEnabled ? "Active" : "Inactive"}
                      {isSeller && isEnabled && enabledCount === 1 && (
                        <span className="text-[#CBD5E1] ml-1">· Default</span>
                      )}
                    </span>
                  </div>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!canToggle && isEnabled) return;
                      onToggleSubType(subType.id);
                    }}
                    className="shrink-0"
                    title={!canToggle && isEnabled ? "Enable another profile before disabling Seller" : undefined}
                  >
                    <div className={`relative w-8 h-[18px] rounded-full transition-colors duration-200 cursor-pointer ${
                      isEnabled ? "bg-[#0A77FF]" : "bg-[#CBD5E1] hover:bg-[#94A3B8]"
                    } ${!canToggle && isEnabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        isEnabled ? "left-[16px]" : "left-[2px]"
                      }`} />
                    </div>
                  </div>
                </div>

                <div
                  className="overflow-hidden transition-all duration-200 ease-out"
                  style={{
                    maxHeight: isActive && isEnabled ? `${sections.length * 36 + 12}px` : "0px",
                    opacity: isActive && isEnabled ? 1 : 0,
                  }}
                >
                  <div className="ml-[20px] pl-[12px] border-l-[1.5px] border-[#E2E8F0] py-1 mt-0.5">
                    {sections.map((section) => {
                      const isSectionActive = isActive && isEnabled && section.id === activeSection;
                      return (
                        <button
                          key={section.id}
                          onClick={() => onActiveSectionChange(section.id)}
                          className={`group/item w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-left transition-colors duration-150 ${
                            isSectionActive ? "bg-[#EDF4FF]" : "hover:bg-[#F1F5F9]/60"
                          }`}
                        >
                          <span className={`transition-colors duration-150 ${
                            isSectionActive ? "text-[#0A77FF]" : "text-[#94A3B8] group-hover/item:text-[#64748B]"
                          }`}>
                            {React.cloneElement(section.icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
                          </span>
                          <span className={`text-[12.5px] truncate transition-colors duration-150 ${
                            isSectionActive ? "text-[#0A77FF]" : "text-[#475569] group-hover/item:text-[#1E293B]"
                          }`} style={{ fontWeight: isSectionActive ? 600 : 400 }}>
                            {section.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="px-3.5 py-2.5 border-t border-[#F1F5F9]">
          <p className="text-[10px] text-[#94A3B8] leading-relaxed">
            <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
            Seller profile is always required. Enable additional profiles to expand capabilities.
          </p>
        </div>
      </div>
    </>
  );
}
