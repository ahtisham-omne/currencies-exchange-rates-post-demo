import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface TypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
  selectClassName?: string;
}

/**
 * A type dropdown that supports custom "Other" labels.
 * When "Other" is selected, switches to an inline text input for custom label.
 * If value is not in options, renders as custom label with edit capability.
 */
export function TypeSelector({
  value,
  onChange,
  options,
  className = "",
  selectClassName = "",
}: TypeSelectorProps) {
  const isPreset = options.includes(value);
  const isCustom = !isPreset && value !== "";
  const [editingCustom, setEditingCustom] = useState(false);
  const [customText, setCustomText] = useState(isCustom ? value : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCustom && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCustom]);

  const commitCustom = () => {
    const trimmed = customText.trim();
    if (trimmed && trimmed !== "Other") {
      onChange(trimmed);
    } else {
      onChange("Other");
    }
    setEditingCustom(false);
  };

  const handleSelectChange = (newValue: string) => {
    if (newValue === "__other__") {
      setCustomText("Other");
      setEditingCustom(true);
      onChange("Other");
    } else {
      setEditingCustom(false);
      onChange(newValue);
    }
  };

  const handleRevertToSelect = () => {
    setEditingCustom(false);
    onChange(options[0] || "Work");
  };

  // Custom label mode (value is not in preset list)
  if (isCustom && !editingCustom) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={() => {
            setCustomText(value);
            setEditingCustom(true);
          }}
          className="h-9 sm:h-10 inline-flex items-center gap-1 px-2.5 rounded-[8px] text-sm border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] cursor-pointer transition-colors"
          style={{ fontWeight: 500, color: "#334155" }}
          title="Click to edit label"
        >
          {value}
        </button>
        <button
          type="button"
          onClick={handleRevertToSelect}
          className="w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer transition-colors"
          title="Switch to preset types"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  // Editing custom text
  if (editingCustom) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitCustom();
            if (e.key === "Escape") handleRevertToSelect();
          }}
          className="h-9 sm:h-10 px-2.5 border-2 border-[#007FFF] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-2 focus:ring-[#007FFF]/20 transition-all w-[120px]"
          style={{ fontWeight: 500, caretColor: "#007FFF", fontSize: "14px" }}
          placeholder="Type label..."
          autoFocus
        />
        <button
          type="button"
          onClick={handleRevertToSelect}
          className="w-5 h-5 rounded flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] cursor-pointer transition-colors"
          title="Cancel"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  // Standard select mode
  return (
    <select
      value={value}
      onChange={(e) => handleSelectChange(e.target.value)}
      className={selectClassName || className}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
      <option value="__other__">Other…</option>
    </select>
  );
}
