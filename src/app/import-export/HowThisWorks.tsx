/* "How This Works" for the Import modal: the header pill and the in-modal
 * side panel, mirrored from Financial Reporting's Create Custom Report
 * (lovely-ledger src/components/fr/HowThisWorks.tsx). Byte-identical in
 * radiant-core-fusion, nimble-palette, partner-management-module and
 * role-zen; edit one copy, then copy it to the other three.
 *
 * The content is each module's own import guide (the same sections the
 * guide always had), only laid out the Financial Reporting way:
 *   • pill: 30px, #EFF6FF on #BFDBFE, Info icon, "How This Works" 12px / 500
 *   • scrim over the whole modal (header included), rgba(0,0,0,0.25), click closes
 *   • panel: 548px, inset 6px, white, 1px #EAEBF0, 10px corner, slides in
 *   • header: "HOW THIS WORKS" eyebrow, 20px title, optional intro
 *   • body: one accordion card per guide section, one open at a time (the
 *     first on open); "Label: text" lines render as a two-column table
 * Escape closes the panel first (captured, so the modal stays open).
 *
 * The panel must be rendered inside the modal box (relative overflow-hidden),
 * not portalled, so the scrim matches the modal. No motion library: plain
 * CSS keyframes, so the file works in every repo. */

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Info, X } from "lucide-react";

export type HowThisWorksBlock =
  | { kind: "subheader"; text: string }
  | { kind: "labeled"; label: string; body: string }
  | { kind: "paragraph"; text: string };

export interface HowThisWorksSection {
  title: string;
  /** Structured guide copy (preferred). */
  blocks?: HowThisWorksBlock[];
  /** Already rendered copy, for guides authored as JSX. */
  body?: ReactNode;
}

const FONT = "'Inter', sans-serif";
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const C = {
  primary: "#0A77FF",
  blue50: "#EFF6FF",
  blue75: "#EDF4FF",
  blue200: "#BFDBFE",
  border: "#EAEBF0",
  ink800: "#0F1729",
  text: "#000000",
  textSecondary: "#68727D",
  textTertiary: "#9CA3AF",
  surface: "#F9FAFB",
  muted: "#F7F7F8",
};
const DRAWER_SHADOW = "0 10px 28px -6px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.06)";
const KEYFRAMES = `
@keyframes htw-scrim-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes htw-scrim-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes htw-drawer-in { from { transform: translateX(calc(100% + 24px)) } to { transform: translateX(0) } }
@keyframes htw-drawer-out { from { transform: translateX(0) } to { transform: translateX(calc(100% + 24px)) } }
@keyframes htw-reveal { from { opacity: 0; transform: translateY(-2px) } to { opacity: 1; transform: none } }
`;

/** The header pill. Goes immediately before the modal's close X. */
export function HowThisWorksButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="inline-flex items-center cursor-pointer outline-none active:scale-[0.98] shrink-0"
      style={{
        gap: 6,
        height: 30,
        padding: "0 10px",
        borderRadius: 6,
        border: `1px solid ${C.blue200}`,
        background: hover ? C.blue75 : C.blue50,
        transition: "background 150ms ease, transform 150ms ease",
        fontFamily: FONT,
        whiteSpace: "nowrap",
      }}
    >
      <Info style={{ width: 14, height: 14, color: C.primary }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: C.primary, lineHeight: 1 }}>How This Works</span>
    </button>
  );
}

/** Consecutive "Label: text" blocks as one bordered term | explanation table. */
function DefList({ rows }: { rows: { label: string; body: string }[] }) {
  return (
    <div role="table" style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: "#FFFFFF", overflow: "hidden", marginTop: 4 }}>
      {rows.map((r, i) => (
        <div
          key={i}
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 34%) 1fr",
            gap: 12,
            padding: "9px 12px",
            borderTop: i === 0 ? "none" : `1px solid ${C.border}`,
            alignItems: "baseline",
          }}
        >
          <div role="cell" style={{ fontSize: 13, fontWeight: 600, color: C.ink800, lineHeight: 1.45 }}>{r.label}</div>
          <div role="cell" style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.55 }}>{r.body}</div>
        </div>
      ))}
    </div>
  );
}

function Blocks({ blocks }: { blocks: HowThisWorksBlock[] }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const first = out.length === 0;
    if (b.kind === "labeled") {
      const rows: { label: string; body: string }[] = [];
      while (i < blocks.length && blocks[i].kind === "labeled") {
        const l = blocks[i] as { kind: "labeled"; label: string; body: string };
        rows.push({ label: l.label, body: l.body });
        i++;
      }
      i--;
      out.push(
        <div key={`t${i}`} style={{ marginTop: first ? 0 : 8 }}>
          <DefList rows={rows} />
        </div>,
      );
    } else if (b.kind === "subheader") {
      out.push(
        <div key={i} style={{ margin: first ? "0 0 6px" : "14px 0 6px", fontSize: 13, fontWeight: 600, color: C.ink800 }}>
          {b.text}
        </div>,
      );
    } else {
      out.push(
        <p key={i} style={{ margin: first ? 0 : "8px 0 0" }}>
          {b.text}
        </p>,
      );
    }
  }
  return <>{out}</>;
}

function SectionCard({ section, open, onToggle, last }: { section: HowThisWorksSection; open: boolean; onToggle: () => void; last: boolean }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 18px", marginBottom: last ? 0 : 12 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 text-left cursor-pointer outline-none"
        style={{ background: "none", border: "none", padding: 0, fontFamily: FONT }}
      >
        <span className="flex-1 min-w-0" style={{ fontSize: 13, fontWeight: 600, color: C.ink800 }}>{section.title}</span>
        <ChevronDown
          className="shrink-0"
          style={{ width: 15, height: 15, color: C.textTertiary, transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}
        />
      </button>
      {open && (
        <div style={{ paddingTop: 10, fontSize: 13.5, color: C.textSecondary, lineHeight: 1.65, animation: `htw-reveal 240ms ${EASE}` }}>
          {section.blocks ? <Blocks blocks={section.blocks} /> : section.body}
        </div>
      )}
    </div>
  );
}

/** The scrim and the side panel. Render inside the modal box, after its content. */
export function HowThisWorksDrawer({
  open,
  onClose,
  title,
  intro,
  sections,
  hostRadius = 16,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro?: string;
  sections: HowThisWorksSection[];
  /** The modal's corner radius, so the scrim follows it. */
  hostRadius?: number;
}) {
  /* Stay mounted through the slide-out. */
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [openIndex, setOpenIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setOpenIndex(0);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, 320);
    return () => window.clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!mounted) return null;
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          background: "rgba(0,0,0,0.25)",
          borderRadius: hostRadius,
          animation: `${closing ? "htw-scrim-out 300ms" : "htw-scrim-in 400ms"} ${EASE} forwards`,
        }}
      />
      <div
        role="dialog"
        aria-label="How this works"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          bottom: 6,
          width: "min(548px, calc(100% - 12px))",
          zIndex: 50,
          background: "#FFFFFF",
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          boxShadow: DRAWER_SHADOW,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: FONT,
          animation: `${closing ? "htw-drawer-out 300ms" : "htw-drawer-in 450ms"} ${EASE} forwards`,
        }}
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <div className="min-w-0">
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: C.primary, marginBottom: 4 }}>How This Works</div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: C.text, lineHeight: 1.2, letterSpacing: "-0.01em", margin: 0 }}>{title}</h2>
            {intro && <p style={{ margin: "8px 0 0", fontSize: 13, color: C.textSecondary, lineHeight: 1.55 }}>{intro}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close how this works"
            className="inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            style={{ width: 30, height: 30, borderRadius: 8, color: C.textSecondary, border: "none", background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.muted)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1, scrollbarWidth: "thin", scrollbarColor: "rgba(0,0,0,0.18) transparent" }}>
          {sections.map((s, i) => (
            <SectionCard
              key={`${s.title}-${i}`}
              section={s}
              open={openIndex === i}
              last={i === sections.length - 1}
              onToggle={() => setOpenIndex((cur) => (cur === i ? -1 : i))}
            />
          ))}
        </div>
      </div>
    </>
  );
}
