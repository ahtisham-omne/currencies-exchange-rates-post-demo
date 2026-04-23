import React, { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { FONT } from "./designTokens";
import {
  formatQuantityValue,
  getDraftQuantityValue,
  isValidQuantityDraft,
  preventInvalidQuantityKey,
  stepQuantity,
} from "./quantityInputUtils";

interface QuantityStepperInputProps {
  value: number;
  serialized: boolean;
  onChange: (nextValue: number) => void;
  ariaLabel: string;
}

export default function QuantityStepperInput({
  value,
  serialized,
  onChange,
  ariaLabel,
}: QuantityStepperInputProps) {
  const [draft, setDraft] = useState(() => formatQuantityValue(value, serialized));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(formatQuantityValue(value, serialized));
    }
  }, [value, serialized, isEditing]);

  const commitDraft = () => {
    const nextValue = getDraftQuantityValue(draft, serialized);
    onChange(nextValue);
    setDraft(formatQuantityValue(nextValue, serialized));
    setIsEditing(false);
  };

  const handleStep = (delta: number) => {
    const nextValue = stepQuantity(value, delta, serialized);
    onChange(nextValue);
    setDraft(formatQuantityValue(nextValue, serialized));
    setIsEditing(false);
  };

  const displayValue = draft || "0";

  return (
    <div className="flex items-center h-7 rounded-[var(--radius-sm)] border border-border overflow-hidden" style={{ backgroundColor: "var(--input-background)" }}>
      <button
        className="flex items-center justify-center w-7 h-7 hover:bg-secondary transition-colors cursor-pointer"
        onClick={() => handleStep(-1)}
        aria-label={`Decrease ${ariaLabel}`}
      >
        <Minus className="size-3 text-foreground/50" />
      </button>

      <input
        type="text"
        inputMode={serialized ? "numeric" : "decimal"}
        value={draft}
        aria-label={ariaLabel}
        onChange={(event) => {
          const raw = event.target.value;
          if (!isValidQuantityDraft(raw, serialized)) return;

          setDraft(raw);
          onChange(getDraftQuantityValue(raw, serialized));
        }}
        onFocus={(event) => {
          setIsEditing(true);
          event.target.select();
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          preventInvalidQuantityKey(event, serialized);

          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(formatQuantityValue(value, serialized));
            event.currentTarget.blur();
          }
        }}
        className="text-center text-foreground bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        style={{
          fontSize: displayValue.length > 7 ? "8px" : displayValue.length > 5 ? "9px" : "10px",
          fontWeight: "var(--font-weight-medium)",
          fontFamily: FONT,
          minWidth: 0,
          width: `${Math.max(2.8, displayValue.length * 0.6 + 0.8)}rem`,
        }}
      />

      <button
        className="flex items-center justify-center w-7 h-7 hover:bg-secondary transition-colors cursor-pointer"
        onClick={() => handleStep(1)}
        aria-label={`Increase ${ariaLabel}`}
      >
        <Plus className="size-3 text-foreground/50" />
      </button>
    </div>
  );
}