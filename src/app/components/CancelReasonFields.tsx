import React, { useEffect, useState } from "react";
import { Label } from "./ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { FONT } from "./designTokens";
import { CANCEL_REASONS } from "./poStore";

/* Cancellation reason fields (ERP-4799): reason dropdown, "Other" text
   (280 chars), optional Notes (500 chars). Shared by Cancel PO, Cancel
   line, Cancel remaining and Archive on Sent / Confirmed.

   The confirm button is never disabled (Eli's rule) — call `validate()`
   on click; it shows "Select a reason" under the field and returns null
   when the reason is missing. Cancel remaining passes `optional` —
   the dropdown stays, but no * and no error when it's empty
   (ERP-4799). */

export const OTHER_REASON_MAX = 280;
export const CANCEL_NOTES_MAX = 500;

export interface CancelReasonState {
  reason: string;
  setReason: (v: string) => void;
  other: string;
  setOther: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  error: string | null;
  /** Returns the final reason + notes, or null (and shows the error).
   *  With `optional`, an empty reason passes (reason comes back ""). */
  validate: (opts?: { optional?: boolean }) => { reason: string; notes?: string } | null;
}

/** Resets whenever `open` turns true. */
export function useCancelReason(open: boolean): CancelReasonState {
  const [reason, setReasonRaw] = useState("");
  const [other, setOtherRaw] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReasonRaw("");
      setOtherRaw("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  return {
    reason,
    setReason: (v) => { setReasonRaw(v); setError(null); },
    other,
    setOther: (v) => { setOtherRaw(v); setError(null); },
    notes,
    setNotes,
    error,
    validate: (opts) => {
      if (!reason && !opts?.optional) { setError("Select a reason"); return null; }
      if (reason === "Other" && !other.trim()) { setError("Describe the reason"); return null; }
      const finalReason = reason === "Other" ? other.trim() : reason;
      return { reason: finalReason, notes: notes.trim() || undefined };
    },
  };
}

const labelStyle: React.CSSProperties = { fontSize: "12px", fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"], lineHeight: "1.35", fontFamily: FONT };
const valueStyle: React.CSSProperties = { fontSize: "13px", lineHeight: "1.4", fontFamily: FONT };
const hintStyle: React.CSSProperties = { fontSize: "11px", lineHeight: "1.35", fontFamily: FONT };
const textareaClass =
  "w-full rounded-[var(--radius-md)] border border-border px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none";

export function CancelReasonFields({ state, optional = false }: { state: CancelReasonState; optional?: boolean }) {
  const { reason, setReason, other, setOther, notes, setNotes, error } = state;
  const reasonMissing = !!error && !reason;
  const otherMissing = !!error && reason === "Other";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-foreground" style={labelStyle}>
          {optional ? <>Reason <span className="text-muted-foreground" style={{ fontWeight: 400 }}>(optional)</span></> : "Reason *"}
        </Label>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger
            className="h-9 w-full"
            style={{ ...valueStyle, ...(reasonMissing ? { borderColor: "hsl(var(--destructive))" } : {}) }}
            aria-invalid={reasonMissing || undefined}
          >
            <SelectValue placeholder="Select a reason" />
          </SelectTrigger>
          <SelectContent>
            {CANCEL_REASONS.map((r) => (
              <SelectItem key={r} value={r} style={valueStyle}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {reason === "Other" && (
          <div className="flex flex-col gap-1">
            <textarea
              className={textareaClass}
              style={{ ...valueStyle, ...(otherMissing ? { borderColor: "hsl(var(--destructive))" } : {}) }}
              rows={2}
              maxLength={OTHER_REASON_MAX}
              placeholder="Describe the reason..."
              value={other}
              onChange={(e) => setOther(e.target.value)}
              autoFocus
            />
            <span className="text-muted-foreground self-end tabular-nums" style={hintStyle}>
              {other.length}/{OTHER_REASON_MAX}
            </span>
          </div>
        )}
        {error && (
          <span style={{ ...hintStyle, color: "hsl(var(--destructive))" }} role="alert">{error}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-foreground" style={labelStyle}>
          Notes <span className="text-muted-foreground" style={{ fontWeight: 400 }}>(optional)</span>
        </Label>
        <textarea
          className={textareaClass}
          style={valueStyle}
          rows={3}
          maxLength={CANCEL_NOTES_MAX}
          placeholder="Add any details for the team or vendor..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <span className="text-muted-foreground self-end tabular-nums" style={hintStyle}>
          {notes.length}/{CANCEL_NOTES_MAX}
        </span>
      </div>
    </div>
  );
}
