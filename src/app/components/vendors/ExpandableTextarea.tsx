import React, { useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

interface ExpandableTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  label?: string;
}

export function ExpandableTextarea({
  value,
  onChange,
  placeholder,
  maxLength = 5000,
  label,
}: ExpandableTextareaProps) {
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (expanded && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [expanded]);

  return (
    <div>
      {label && <label className="text-[12px] text-[#0F172A] mb-1.5 block" style={{ fontWeight: 500 }}>{label}</label>}
      <div className="relative" style={{ height: 72 }}>
        {expanded && <div className="fixed inset-0 z-[99]" onClick={() => setExpanded(false)} />}
        <div
          className="absolute top-0 right-0 z-[100]"
          style={{
            left: expanded ? "-80%" : 0,
            marginLeft: expanded ? -12 : 0,
            marginRight: expanded ? -12 : 0,
            marginTop: expanded ? -32 : 0,
            transition: "left 300ms cubic-bezier(0.16, 1, 0.3, 1), margin 300ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { if (e.target.value.length <= maxLength) onChange(e.target.value); }}
            onDoubleClick={() => { if (!expanded) setExpanded(true); }}
            placeholder={placeholder}
            className={`w-full rounded-lg bg-white resize-none text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] px-3 py-2 pb-6 border outline-none ${
              expanded
                ? "border-[#0A77FF] ring-2 ring-[#0A77FF]/15"
                : "border-[#E2E8F0] focus:border-[#0A77FF] focus:ring-1 focus:ring-[#0A77FF]/20"
            }`}
            style={{
              height: expanded ? 190 : 72,
              boxShadow: expanded ? "0 12px 40px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.03)" : "none",
              transition: "height 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease",
            }}
          />
          <p className="absolute bottom-1.5 right-2.5 text-[11px] text-[#94A3B8] pointer-events-none">{value.length}/{maxLength}</p>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center cursor-pointer ${
              expanded
                ? "text-[#0A77FF] hover:bg-[#EDF4FF]"
                : "text-[#94A3B8] hover:text-[#0A77FF] hover:bg-[#EDF4FF]"
            }`}
            style={{ transition: "color 200ms ease, background-color 200ms ease" }}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
