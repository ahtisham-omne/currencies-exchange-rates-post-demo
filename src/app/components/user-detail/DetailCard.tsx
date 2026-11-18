import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface DetailCardProps {
  title: string;
  icon: ElementType;
  children: ReactNode;
  /** Optional count badge shown in header. */
  count?: number;
  /** Optional action element (e.g. Edit button) rendered right-aligned in header. */
  action?: ReactNode;
  /** Optional extra classes for the body wrapper (e.g. for flex layouts). */
  bodyClassName?: string;
  /** When true, the entire header acts as a toggle and the body collapses/expands
   *  with a height transition. Used by right-column sidebar cards on the overview
   *  tab to match ContactSidebarCard behaviour. */
  collapsible?: boolean;
  /** Initial open state for collapsible cards. Defaults to true. */
  defaultOpen?: boolean;
}

/**
 * Shared card wrapper for user-detail tab sections.
 * Shows an icon + title header with optional count pill.
 * Pass `collapsible` to make the body toggleable via header click.
 */
export function DetailCard({
  title,
  icon: Icon,
  children,
  count,
  action,
  bodyClassName,
  collapsible = false,
  defaultOpen = true,
}: DetailCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  // Track content height for smooth max-height transition. Re-measured on
  // content change so cards with dynamic data (e.g. roles list) animate to
  // the right height instead of clipping.
  useEffect(() => {
    if (collapsible && contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [collapsible, children]);

  const HeaderTag = collapsible ? "button" : "div";
  // White by default, slate-tinted on hover, same treatment for collapsible
  // and static cards so the whole overview tab feels consistent.
  const headerHover = "hover:bg-[#FAFBFC]";
  const headerInteractive = collapsible ? "w-full text-left cursor-pointer" : "";

  return (
    <div
      className="rounded-xl border overflow-hidden bg-white transition-all h-full flex flex-col"
      style={{
        borderColor: "#E2E8F0",
        boxShadow: "0 1px 3px 0 rgba(15,23,42,0.04), 0 1px 2px -1px rgba(15,23,42,0.04)",
      }}
    >
      {/* Header, `bg-white` + `hover:bg-[#FAFBFC]` from Tailwind. Background
       *  must NOT be inline (inline styles beat hover utilities). */}
      <HeaderTag
        type={collapsible ? ("button" as const) : undefined}
        onClick={collapsible ? () => setIsOpen((v) => !v) : undefined}
        className={`flex items-center gap-2.5 px-5 py-3.5 shrink-0 transition-colors bg-white ${headerInteractive} ${headerHover}`}
        style={{
          borderBottom: !collapsible || isOpen ? "1px solid #F1F5F9" : "1px solid transparent",
        }}
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ backgroundColor: "#EDF4FF" }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: "#007FFF" }} />
        </div>
        <h3
          className="text-[13.5px] flex-1"
          style={{ fontWeight: 600, color: "#0F172A" }}
        >
          {title}
        </h3>
        {count !== undefined && count > 0 && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: "#F1F5F9",
              color: "#64748B",
              fontWeight: 600,
            }}
          >
            {count}
          </span>
        )}
        {action}
        {collapsible && (
          // Open → chevron points down (▼), closed → chevron points up (▲).
          // Avoids the sideways "►" affordance which was confusing.
          <ChevronDown
            className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
            style={{
              color: "#94A3B8",
              transform: isOpen ? "rotate(0deg)" : "rotate(180deg)",
            }}
          />
        )}
      </HeaderTag>

      {/* Body */}
      {collapsible ? (
        <div
          className="overflow-hidden transition-all duration-200 ease-in-out"
          style={{
            maxHeight: isOpen ? (contentHeight != null ? contentHeight + 24 + "px" : "2000px") : "0px",
            opacity: isOpen ? 1 : 0,
          }}
        >
          <div ref={contentRef} className={`px-5 py-1 ${bodyClassName ?? ""}`}>{children}</div>
        </div>
      ) : (
        <div className={`px-5 py-1 flex-1 ${bodyClassName ?? ""}`}>{children}</div>
      )}
    </div>
  );
}
