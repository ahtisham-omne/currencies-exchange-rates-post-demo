import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";

/**
 * Reusable Quantity + UoM edit capsule component.
 * - Inline editing with click-to-edit interaction
 * - Shows pencil icon on hover
 * - Confirm/cancel actions when editing
 * - Uses CSS variables, Inter font, 4px grid spacing
 */

interface QtyUoMEditProps {
  qty: number;
  uom: string;
  onSave: (qty: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  compact?: boolean;
}

export function QtyUoMEdit({ qty, uom, onSave, min = 1, max = 999999, disabled = false, compact = false }: QtyUoMEditProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(qty.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(qty.toString());
  }, [qty]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const parsed = parseInt(value) || min;
    const clamped = Math.max(min, Math.min(max, parsed));
    onSave(clamped);
    setEditing(false);
    setValue(clamped.toString());
  };

  const handleCancel = () => {
    setEditing(false);
    setValue(qty.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (disabled) {
    return (
      <div
        className="inline-flex items-center rounded-md bg-secondary/50 text-foreground/50"
        style={{
          fontSize: compact ? "var(--text-caption)" : "var(--text-label)",
          fontWeight: "var(--font-weight-medium)",
          padding: compact ? "4px 8px" : "4px 12px",
          gap: 4,
        }}
      >
        <span>{qty.toLocaleString()}</span>
        <span className="text-foreground/35">{uom}</span>
      </div>
    );
  }

  if (editing) {
    return (
      <div
        className="inline-flex items-center rounded-md bg-primary/5 border border-primary/30"
        style={{
          fontSize: compact ? "var(--text-caption)" : "var(--text-label)",
          fontWeight: "var(--font-weight-medium)",
          padding: compact ? "4px 8px" : "4px 12px",
          gap: 4,
        }}
      >
        <input
          ref={inputRef}
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          min={min}
          max={max}
          className="bg-transparent text-foreground outline-none"
          style={{
            width: Math.max(32, value.length * 8 + 16),
            fontSize: "inherit",
            fontWeight: "inherit",
          }}
        />
        <span className="text-foreground/35">{uom}</span>
        <div className="flex items-center border-l border-primary/20" style={{ gap: 4, paddingLeft: 4, marginLeft: 4 }}>
          <button
            onClick={handleSave}
            className="text-accent hover:text-accent/80 transition-colors"
            title="Confirm"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCancel}
            className="text-foreground/30 hover:text-foreground/60 transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group inline-flex items-center rounded-md bg-secondary hover:bg-primary/5 transition-colors"
      style={{
        fontSize: compact ? "var(--text-caption)" : "var(--text-label)",
        fontWeight: "var(--font-weight-medium)",
        padding: compact ? "4px 8px" : "4px 12px",
        gap: 4,
      }}
    >
      <span className="text-foreground">{qty.toLocaleString()}</span>
      <span className="text-foreground/35">{uom}</span>
      <Pencil className="w-3 h-3 text-foreground/15 group-hover:text-primary transition-colors" style={{ marginLeft: 4 }} />
    </button>
  );
}