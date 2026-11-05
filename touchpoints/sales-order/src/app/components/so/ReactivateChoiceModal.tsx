import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, RefreshCw, ArrowRight, Check } from "lucide-react";

/**
 * ReactivateChoiceModal — Partner-style two-option chooser with
 * radio-selection semantics. The user picks a path (both cards are
 * selectable; the picked one gets the highlighted primary treatment),
 * then hits Confirm at the bottom.
 *
 * Default selection is "Reactivate as a new draft" — the revision
 * path is more common when a rejection went out over pricing or
 * terms; restore-in-place is the escape hatch for approvers who
 * decide the rejection was mistaken.
 */

type Choice = "restore" | "new-draft";

interface Props {
  isOpen: boolean;
  recordLabel: string;
  restoreToStatus: string;
  newVersionNumber: number;
  onRestore: () => void;
  onNewDraft: () => void;
  onCancel: () => void;
}

export function ReactivateChoiceModal({
  isOpen,
  recordLabel,
  restoreToStatus,
  newVersionNumber,
  onRestore,
  onNewDraft,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<Choice>("new-draft");

  useEffect(() => { if (isOpen) setSelected("new-draft"); }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const submit = () => (selected === "restore" ? onRestore() : onNewDraft());

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 12200, backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
      onClick={onCancel}
    >
      <div
        className="relative flex flex-col overflow-hidden bg-white"
        style={{
          width: "min(560px, calc(100vw - 32px))",
          borderRadius: 16,
          boxShadow: "0 24px 80px -12px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient header (blue — reactivate reads as recovery). */}
        <div
          className="relative flex flex-col items-center"
          style={{ padding: "40px 0 24px", background: "linear-gradient(180deg, #EBF3FF 0%, rgba(239,246,255,0.3) 70%, transparent 100%)" }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ width: 180, height: 80, borderRadius: 9999, filter: "blur(50px)", opacity: 0.25, backgroundColor: "#3B82F6" }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "#DBEAFE" }}
          >
            <RotateCcw style={{ width: 30, height: 30, color: "#1D4ED8" }} strokeWidth={2} />
          </div>
          <span
            className="mt-4"
            style={{
              padding: "4px 12px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
              backgroundColor: "#EFF6FF", color: "#1E40AF",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}
          >
            Reactivate
          </span>
        </div>

        <div className="flex flex-col items-center text-center" style={{ padding: "0 32px 28px" }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--foreground)", letterSpacing: "-0.02em", margin: 0 }}>
            How would you like to reactivate {recordLabel}?
          </h3>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8, lineHeight: 1.55, maxWidth: 380 }}>
            Pick a path. Revise the SO with a new draft, or resume the previous version as-is.
          </p>

          <div className="w-full text-left" style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Option 1 — Reactivate as new draft (DEFAULT) */}
            <OptionCard
              icon={<RefreshCw style={{ width: 18, height: 18 }} strokeWidth={2.25} />}
              title={`Reactivate as a new draft (V${newVersionNumber})`}
              selected={selected === "new-draft"}
              onClick={() => setSelected("new-draft")}
              benefits={[
                "New version. Revise line items, dates, or terms.",
                "Previous version stays in history.",
              ]}
            />

            {/* Option 2 — Restore in place */}
            <OptionCard
              icon={<ArrowRight style={{ width: 18, height: 18 }} strokeWidth={2.25} />}
              title={<TitleWithStatePill label="Resume as" stateLabel={restoreToStatus} />}
              selected={selected === "restore"}
              onClick={() => setSelected("restore")}
              benefits={[
                "Same version. No version bump.",
                "Line items, dates, and allocations resume exactly as they were.",
              ]}
            />
          </div>

          <div className="w-full flex flex-col" style={{ marginTop: 20, gap: 10 }}>
            <button
              onClick={submit}
              className="w-full cursor-pointer transition-colors hover:opacity-90"
              style={{
                height: 44, borderRadius: 12, fontSize: 14, fontWeight: 600,
                backgroundColor: "var(--primary)", color: "#FFFFFF", border: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {selected === "restore" ? "Restore this version" : `Create V${newVersionNumber} draft`}
              <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
            <button
              onClick={onCancel}
              className="w-full cursor-pointer transition-colors"
              style={{
                height: 40, borderRadius: 12, fontSize: 13, fontWeight: 500,
                backgroundColor: "var(--muted)", color: "#334155", border: 0,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface OptionCardProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  benefits: string[];
}

function OptionCard({ icon, title, selected, onClick, benefits }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left transition-all cursor-pointer"
      style={{
        borderRadius: 12,
        border: selected ? "1px solid rgba(10, 119, 255, 0.35)" : "1px solid var(--border)",
        background: selected ? "rgba(10, 119, 255, 0.08)" : "#fff",
        padding: 16,
        boxShadow: selected ? "0 2px 8px -4px rgba(10, 119, 255, 0.18)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Radio dot on the left so the card reads as a selectable choice. */}
        <div
          aria-hidden
          style={{
            width: 16, height: 16, borderRadius: 999,
            border: `1.5px solid ${selected ? "var(--primary)" : "#CBD5E1"}`,
            background: selected ? "var(--primary)" : "#fff",
            flexShrink: 0, marginTop: 3,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {selected && <span style={{ width: 6, height: 6, borderRadius: 999, background: "#fff" }} />}
        </div>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: selected ? "var(--primary)" : "#F1F5F9",
            color: selected ? "#fff" : "#334155",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: selected ? "0 1px 4px rgba(10, 119, 255, 0.25)" : "none",
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: selected ? "var(--primary)" : "var(--foreground)", margin: 0, display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            {title}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {benefits.map((b, i) => <BenefitLine key={i}>{b}</BenefitLine>)}
          </div>
        </div>
      </div>
    </button>
  );
}

/* Title with the target status rendered as a subtle pill so the
   sentence reads like "Resume as [Pending Review]" without gluing
   the state name straight into the copy. */
function TitleWithStatePill({ label, stateLabel }: { label: string; stateLabel: string }) {
  return (
    <>
      <span>{label}</span>
      <span
        style={{
          display: "inline-flex", alignItems: "center",
          padding: "1px 8px", borderRadius: 999,
          background: "rgba(15, 23, 42, 0.06)", color: "var(--foreground)",
          fontSize: 11, fontWeight: 600, lineHeight: 1.3,
          border: "1px solid rgba(15, 23, 42, 0.10)",
        }}
      >
        {stateLabel}
      </span>
    </>
  );
}

function BenefitLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
      <Check style={{ width: 12, height: 12, color: "#10B981", flexShrink: 0, marginTop: 2 }} strokeWidth={2.5} />
      <span style={{ fontSize: 11.5, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}
